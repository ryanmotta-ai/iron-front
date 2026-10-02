'use strict';
/* Iron Front 1.1 — física de corpos, balística, blindados, explosões e água.
   Carrega DEPOIS de planefx.js (e antes do ui.js). Não altera a lógica de game.js: envolve (wrap) update / shoot / explode /
   setup / bulletObstacleHit / aiGrenade / sound e lê o resto do jogo por nome, como pixel.js e weather.js já fazem.
   Pilar 1  corpos .......... separação elástica entre tropas, inércia com atrito do solo (lama, água, neve), caixas rígidas
   Pilar 2  balística ....... tiro varrido contra obstáculos, parapeito das trincheiras, ricochete em blindagem, granadas
   Pilar 3  blindados ....... lagartas com tração diferencial, esmagamento, coice do canhão e balanço da suspensão
   Pilar 4  explosões ....... onda de choque (arremesso e atordoamento) e estilhaços
   Pilar 5  água ............ correnteza do rio, destroços flutuantes e detonações na água
   Desliga com ?fisica=0 na URL ou PHYS.on=false. Coordenadas em unidades do mundo (2400×1600); o terreno pintado vive em
   pixels de arte (1 px = 2 unidades, PX.Z). Convenção de nomes: u.pv guarda o estado físico de cada unidade. */
(function(){
if(!window.PX)return;
const PXO=window.PX,ZZ=PXO.Z||.5,TAU2=Math.PI*2,hyp=Math.hypot;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const angDiff=(a,b)=>{let d=(a-b)%TAU2;if(d>Math.PI)d-=TAU2;else if(d<-Math.PI)d+=TAU2;return d};
const sstep=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('physics.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};

/* ---------- parâmetros ---------- */
const CFG={
 R:{rifle:7,mg:7,cavalry:11,tank:26},          // raio de separação elástica (px)
 RW:{rifle:5,mg:5,cavalry:9,tank:22},          // raio contra paredes rígidas
 M:{rifle:1,mg:1.15,cavalry:3.2,tank:16},      // massa relativa: quem é mais leve cede mais
 KPUSH:7.5,                                     // rigidez: velocidade de afastamento por px de sobreposição (px/s por px)
 PUSHMAX:{rifle:52,mg:52,cavalry:40,tank:10},   // teto da velocidade de afastamento (px/s)
 MAXV:420,                                      // acima disso o deslocamento é teleporte (nascimento, troca de facção)
 /* aceleração, frenagem e atrito do arremesso em seco (1/s): [acc, brk, kdrag] */
 BASE:{rifle:[11,15,8],mg:[10,14,8],cavalry:[5.5,4.2,6],tank:[1.7,2.4,14]},
 G_PX:380,                                      // gravidade das granadas (px/s²) — o jogo usa 340; o excedente é somado aqui
 E_GREN:.35                                     // coeficiente de restituição das granadas
};
const PH=window.PHYS={on:!/[?&]fisica=0/.test(location.search),version:'1.1',cfg:CFG,stats:{errors:0},noted:{}};
const pvOf=u=>u.pv||(u.pv={vx:0,vy:0,kx:0,ky:0,stun:0,cT:-9,cnx:0,cny:0,ds:(u.id&1)?1:-1,esc:-9,at:-9,ax:0,ay:0,ad:0,path:null,pi:0,pathT:-9,hdg:u.angle||0,w:0,sp:0,pk:-9,pt:0,pa:0});
const note=(key,msg)=>{if(!PH.noted[key]){PH.noted[key]=1;try{toast(msg)}catch{}}};

/* ======================================================================================
   TERRENO: mapa de altura (lido do gerador do mapa, sem editar ww1-*.js) + bacias das crateras
   O gerador de "A Última Trincheira" entrega G (com G.Hm, em pixels de arte) a WW.paint. Uma segunda geração, com o
   paint trocado por uma captura, devolve o relevo e o chão limpo (sem arame, cena nem crateras) — 1 vez por sessão.
   ====================================================================================== */
const GND={hm:null,w:0,h:0,mat:null,bare:null,tried:false};
function ensureGround(){
 if(GND.tried||!PXO.WW1||typeof map==='undefined'||map!=='trenches')return;GND.tried=true;
 const WW=PXO.WW1,saved=WW.paint;let cap=null,out=null;
 WW.paint=(c,G)=>{cap=G};
 try{out=PXO.genTerrain(WW.MAPKEY,W,H)}catch(e){console.warn('physics.js: terreno limpo indisponível',e)}finally{WW.paint=saved}
 if(cap&&cap.Hm){GND.hm=cap.Hm;GND.w=cap.w;GND.h=cap.h;GND.mat=cap.mat}
 if(out&&out.canvas)GND.bare=out.canvas}
const onWW=()=>typeof map!=='undefined'&&map==='trenches'&&!!PXO.WW1;     // relevo, chão limpo e arame pintado só existem em "A Última Trincheira"
function hmAt(x,y){ // altura do mapa (unidades de arte) em coordenadas do mundo, bilinear
 const hm=GND.hm;if(!hm||!onWW())return 0;const fx=clamp(x*ZZ-.5,0,GND.w-1.001),fy=clamp(y*ZZ-.5,0,GND.h-1.001),ix=fx|0,iy=fy|0,ax=fx-ix,ay=fy-iy,w=GND.w,i=iy*w+ix;
 return hm[i]*(1-ax)*(1-ay)+hm[i+1]*ax*(1-ay)+hm[i+w]*(1-ax)*ay+hm[i+w+1]*ax*ay}
/* crateras: bacia com leve borda elevada. Vêm do mapa ao iniciar e de cada explosão grande (o array allCraters do jogo descarta as antigas) */
const CR={list:[],grid:new Map()};
const crKey=(cx,cy)=>cx*1000+cy;
function craterAdd(x,y,r){const c={x,y,r,dp:clamp(.45*(r*ZZ)+.5,1.4,3.4)};CR.list.push(c);const k=crKey(Math.floor(x/96),Math.floor(y/96));let a=CR.grid.get(k);if(!a)CR.grid.set(k,a=[]);a.push(c);if(CR.list.length>700)craterTrim()}
function craterTrim(){CR.list=CR.list.slice(-560);CR.grid.clear();for(const c of CR.list){const k=crKey(Math.floor(c.x/96),Math.floor(c.y/96));let a=CR.grid.get(k);if(!a)CR.grid.set(k,a=[]);a.push(c)}}
function craterH(x,y){let h=0;const cx=Math.floor(x/96),cy=Math.floor(y/96);
 for(let gx=cx-1;gx<=cx+1;gx++)for(let gy=cy-1;gy<=cy+1;gy++){const a=CR.grid.get(crKey(gx,gy));if(!a)continue;
  for(let i=0;i<a.length;i++){const c=a[i],d=hyp(x-c.x,y-c.y);if(d>c.r*1.4)continue;const t=d/c.r;
   if(t<1){const q=1-t*t;h-=c.dp*q*(1-t*t*.35)}else h+=c.dp*.22*(1-(t-1)/.4)}}
 return h}
const heightAt=(x,y)=>hmAt(x,y)+craterH(x,y);
/* gradiente (altura por px do mundo) por diferenças centrais */
const GRAD={x:0,y:0};
function gradAt(x,y){const e=4;GRAD.x=(heightAt(x+e,y)-heightAt(x-e,y))/(2*e);GRAD.y=(heightAt(x,y+e)-heightAt(x,y-e))/(2*e);return GRAD}

/* ======================================================================================
   ESTÁTICOS: caixas rígidas e obstáculos balísticos numa grade de 64 px
   bunker/ruína = sólidos para tropas e blindados · saco de areia = só para balas e para o esmagamento dos tanques
   ====================================================================================== */
const SC=64,SGX=Math.ceil(W/SC)+1,SGY=Math.ceil(H/SC)+1;
let sGrid=[],statics=[],sigLast='',qid=0;
function sInsert(s){const x0=Math.max(0,Math.floor(s.x0/SC)),x1=Math.min(SGX-1,Math.floor(s.x1/SC)),y0=Math.max(0,Math.floor(s.y0/SC)),y1=Math.min(SGY-1,Math.floor(s.y1/SC));
 for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++){const i=gy*SGX+gx;(sGrid[i]||(sGrid[i]=[])).push(s)}}
function mkBox(k,cx,cy,hx,hy,mhx,mhy,ref,extra){return Object.assign({k,x:cx,y:cy,x0:cx-hx,y0:cy-hy,x1:cx+hx,y1:cy+hy,mx0:cx-mhx,my0:cy-mhy,mx1:cx+mhx,my1:cy+mhy,ref,q:0},extra)}
function refreshStatics(force){
 let sig=decor.length*13+buildings.length;
 for(let i=0;i<buildings.length;i++){const b=buildings[i];if(b.type!=='wire')sig=(sig*31+b.id)|0}
 if(!force&&sig===sigLast)return;sigLast=sig;
 sGrid=new Array(SGX*SGY);statics=[];
 for(const b of buildings){
  if(b.type==='bunker')statics.push(mkBox('bunker',b.x,b.y,24,22,21,19,b));
  else if(b.type==='sandbag')statics.push(b.vert?mkBox('sandbag',b.x,b.y,b.bw||9,b.bh||16,b.bw||9,b.bh||16,b):mkBox('sandbag',b.x,b.y,30,10,30,10,b))}
 for(const d of decor){
  if(d.type==='ruin')statics.push(mkBox('ruin',d.x,d.y,22,12,19,9,d));
  else if(d.type==='tree'){const thick=d.size>18,r=thick?7+(d.size-18)*.35:6;statics.push({k:'tree',x:d.x,y:d.y,x0:d.x-r,y0:d.y-r,x1:d.x+r,y1:d.y+r,r,thick,ref:d,q:0})}}
 for(const s of statics)sInsert(s);
 trenchRebuild()}
/* percorre os estáticos sob a caixa [x0,x1]×[y0,y1]; cb devolve true para parar */
function sQuery(x0,y0,x1,y1,cb){
 const a=Math.max(0,Math.floor(x0/SC)),b=Math.min(SGX-1,Math.floor(x1/SC)),c=Math.max(0,Math.floor(y0/SC)),d=Math.min(SGY-1,Math.floor(y1/SC));const id=++qid;
 for(let gy=c;gy<=d;gy++)for(let gx=a;gx<=b;gx++){const l=sGrid[gy*SGX+gx];if(!l)continue;
  for(let i=0;i<l.length;i++){const s=l[i];if(s.q===id)continue;s.q=id;if(cb(s))return true}}
 return false}
/* segmento (ox,oy)+t·(dx,dy), t∈[0,1], contra uma caixa: devolve t da entrada (ou -1) e a normal em HN */
const HN={x:0,y:0};
function segBox(ox,oy,dx,dy,x0,y0,x1,y1){let tmin=0,tmax=1,nx=0,ny=0;
 if(Math.abs(dx)<1e-9){if(ox<x0||ox>x1)return -1}
 else{let t1=(x0-ox)/dx,t2=(x1-ox)/dx,sg=-1;if(t1>t2){const tt=t1;t1=t2;t2=tt;sg=1}if(t1>tmin){tmin=t1;nx=sg;ny=0}if(t2<tmax)tmax=t2;if(tmin>tmax)return -1}
 if(Math.abs(dy)<1e-9){if(oy<y0||oy>y1)return -1}
 else{let t1=(y0-oy)/dy,t2=(y1-oy)/dy,sg=-1;if(t1>t2){const tt=t1;t1=t2;t2=tt;sg=1}if(t1>tmin){tmin=t1;nx=0;ny=sg}if(t2<tmax)tmax=t2;if(tmin>tmax)return -1}
 HN.x=nx;HN.y=ny;return tmin}
function segCircle(ox,oy,dx,dy,cx,cy,r){const fx=ox-cx,fy=oy-cy,a=dx*dx+dy*dy;if(a<1e-9)return fx*fx+fy*fy<r*r?0:-1;
 const b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-r*r;if(c<=0){HN.x=0;HN.y=0;return 0}const disc=b*b-4*a*c;if(disc<0)return -1;const t=(-b-Math.sqrt(disc))/(2*a);if(t<0||t>1)return -1;
 const hx=fx+dx*t,hy=fy+dy*t,l=hyp(hx,hy)||1;HN.x=hx/l;HN.y=hy/l;return t}

/* ======================================================================================
   SOLO: aceleração, frenagem e atrito do arremesso conforme lama, água, neve e chuva
   ====================================================================================== */
const GR={acc:10,brk:14,kd:8,d:0,m:0};
function ground(u){const B=CFG.BASE[u.type]||CFG.BASE.rifle,w=window.PXW;let acc=B[0],brk=B[1],kd=B[2],d=0,m=0,snow=false,I=0;
 if(w){d=w.depth(u.x,u.y);m=w.mudAt?w.mudAt(u.x,u.y):0;snow=!!(w.state&&w.state.snow);I=Math.min(1,(w.state&&w.state.I)||0)}
 const tkn=u.type==='tank';
 if(snow){acc*=.8;brk*=.55}else{acc*=1-.18*I;brk*=1-.25*I;acc*=1-(tkn?.5:.72)*m;brk*=1-(tkn?.6:.85)*m;kd*=1+.6*m}
 if(d>=.55){acc*=.3;brk*=.95;kd*=2}else if(d>=.25){acc*=.55;brk*=.6;kd*=1.4}
 if(u===player&&mode==='soldier')acc*=1.5;
 GR.acc=Math.max(.35,acc);GR.brk=Math.max(.3,brk);GR.kd=kd;GR.d=d;GR.m=m;return GR}

/* ======================================================================================
   PILAR 1 — corpos: separação elástica, inércia, paredes
   A movimentação original (game.js + clima) continua decidindo PARA ONDE cada unidade quer ir; aqui o deslocamento do
   quadro é relido como velocidade desejada e integrado com aceleração limitada:  v ← v + (v_des − v)·(1−e^(−α·dt))
   ====================================================================================== */
const UC=56,UGX=Math.ceil(W/UC)+2,UGY=Math.ceil(H/UC)+2;
let uHead=new Int32Array(UGX*UGY),uNext=new Int32Array(1024),cHead=new Int32Array(UGX*UGY),cNext=new Int32Array(512);
let RA=new Float32Array(1024),MA=new Float32Array(1024),SX=new Float32Array(1024),SY=new Float32Array(1024);
const ucell=(x,y)=>clamp(Math.floor(y/UC),0,UGY-1)*UGX+clamp(Math.floor(x/UC),0,UGX-1);
function growBuffers(n){if(n<=RA.length)return;const m=n*2;uNext=new Int32Array(m);RA=new Float32Array(m);MA=new Float32Array(m);SX=new Float32Array(m);SY=new Float32Array(m)}
function separation(U,n){
 uHead.fill(-1);
 for(let i=0;i<n;i++){const u=U[i];if(u.hp<=0){RA[i]=0;continue}const pv=pvOf(u);
  RA[i]=pv.stun>0&&u.type!=='tank'?4:(CFG.R[u.type]||7);MA[i]=(u===player&&mode==='soldier')?1.6:(CFG.M[u.type]||1);SX[i]=0;SY[i]=0;
  const c=ucell(u.x,u.y);uNext[i]=uHead[c];uHead[c]=i}
 for(let i=0;i<n;i++){const Ri=RA[i];if(Ri<=0)continue;const u=U[i],cx=Math.floor(u.x/UC),cy=Math.floor(u.y/UC);
  for(let gy=Math.max(0,cy-1);gy<=Math.min(UGY-1,cy+1);gy++)for(let gx=Math.max(0,cx-1);gx<=Math.min(UGX-1,cx+1);gx++)
   for(let j=uHead[gy*UGX+gx];j>=0;j=uNext[j]){if(j<=i)continue;const v=U[j],rr=Ri+RA[j],dx=u.x-v.x,dy=u.y-v.y,d2=dx*dx+dy*dy;if(d2>=rr*rr)continue;
    let d=Math.sqrt(d2),nx,ny;if(d<.01){const a=(u.id*2.399+v.id*1.7)%TAU2;nx=Math.cos(a);ny=Math.sin(a);d=0}else{nx=dx/d;ny=dy/d}
    const f=CFG.KPUSH*(rr-d),mi=MA[i],mj=MA[j],wi=mj/(mi+mj),wj=mi/(mi+mj);
    SX[i]+=nx*f*wi;SY[i]+=ny*f*wi;SX[j]-=nx*f*wj;SY[j]-=ny*f*wj}}
 /* corpos no chão: empurrão fraco, só para a infantaria desviar de quem caiu */
 cHead.fill(-1);const nc=corpses.length;if(cNext.length<nc)cNext=new Int32Array(nc*2);
 for(let k=0;k<nc;k++){const c=corpses[k],q=ucell(c.x,c.y);cNext[k]=cHead[q];cHead[q]=k}
 if(nc)for(let i=0;i<n;i++){if(RA[i]<=0)continue;const u=U[i];if(u.type==='tank')continue;const cx=Math.floor(u.x/UC),cy=Math.floor(u.y/UC),Ri=5+3.5;
  for(let gy=Math.max(0,cy-1);gy<=Math.min(UGY-1,cy+1);gy++)for(let gx=Math.max(0,cx-1);gx<=Math.min(UGX-1,cx+1);gx++)
   for(let k=cHead[gy*UGX+gx];k>=0;k=cNext[k]){const c=corpses[k],dx=u.x-c.x,dy=u.y-c.y,d2=dx*dx+dy*dy;if(d2>=Ri*Ri)continue;const d=Math.sqrt(d2)||.01,f=CFG.KPUSH*.35*(Ri-d);SX[i]+=dx/d*f;SY[i]+=dy/d*f}}}
/* teto do afastamento; quem está de guarnição (trincheira) ou em posição resiste mais */
function pushOf(u,i){let px=SX[i],py=SY[i];const m=hyp(px,py);if(m<.01){SX[i]=SY[i]=0;return 0}
 let cap=CFG.PUSHMAX[u.type]||50;if(u.order==='hold'&&u.aiRole&&u.aiRole.indexOf('trinch')>=0)cap*=.4;else if(u.order==='hold')cap*=.75;
 if(u.dodgeUntil>time)cap*=.6;if(m>cap){SX[i]=px*cap/m;SY[i]=py*cap/m;return cap}return m}

/* paredes rígidas: empurra o círculo para fora da caixa, tira da velocidade só a parte que entra na parede (deslizamento) */
let CX=0,CY=0;const CN={x:0,y:0,hit:false};
function collideSolids(rc,pv,tank){CN.hit=false;
 for(let it=0;it<2;it++){let any=false;
  sQuery(CX-rc-2,CY-rc-2,CX+rc+2,CY+rc+2,s=>{
   let nx,ny,pen;
   if(s.k==='bunker'||s.k==='ruin'){
    const px=clamp(CX,s.mx0,s.mx1),py=clamp(CY,s.my0,s.my1),dx=CX-px,dy=CY-py,d2=dx*dx+dy*dy;if(d2>=rc*rc)return false;
    if(d2>1e-6){const d=Math.sqrt(d2);nx=dx/d;ny=dy/d;pen=rc-d}
    else{const l=CX-s.mx0,r=s.mx1-CX,t=CY-s.my0,b=s.my1-CY,m=Math.min(l,r,t,b);if(m===l){nx=-1;ny=0}else if(m===r){nx=1;ny=0}else if(m===t){nx=0;ny=-1}else{nx=0;ny=1}pen=m+rc}}
   else if(s.k==='tree'&&tank&&s.thick){const dx=CX-s.x,dy=CY-s.y,d=hyp(dx,dy),rr=rc+s.r;if(d>=rr)return false;if(d<.01){nx=1;ny=0}else{nx=dx/d;ny=dy/d}pen=rr-d}
   else return false;
   CX+=nx*pen;CY+=ny*pen;any=true;CN.hit=true;CN.x=nx;CN.y=ny;
   const vn=pv.vx*nx+pv.vy*ny;if(vn<0){pv.vx-=vn*nx;pv.vy-=vn*ny}
   const kn=pv.kx*nx+pv.ky*ny;if(kn<0){pv.kx-=1.35*kn*nx;pv.ky-=1.35*kn*ny}
   pv.cnx=nx;pv.cny=ny;pv.cT=time;return false});
  if(!any)break}}
/* encostou numa parede e ainda quer atravessá-la: desliza pelo lado da parede escolhido (persistente por unidade) */
function steerAround(pv,vdx,vdy){if(time-pv.cT>.3)return false;const dn=vdx*pv.cnx+vdy*pv.cny;if(dn>=-1)return false;
 const tx=-pv.cny,ty=pv.cnx,sp=hyp(vdx,vdy);let s=vdx*tx+vdy*ty,g;
 if(time<pv.esc)g=pv.ds;                                      // modo de fuga: segue o lado escolhido, ignora o rumo desejado
 else if(Math.abs(s)<sp*.22)g=pv.ds;
 else{g=s>0?1:-1;pv.ds=g}
 SV.x=tx*g*sp*.95+pv.cnx*sp*.12;SV.y=ty*g*sp*.95+pv.cny*sp*.12;return true}
const SV={x:0,y:0};
/* sem progresso há 1,8 s encostado numa parede: planeja um caminho (A* local) em volta dos sólidos; sem caminho, inverte o lado do contorno */
function unstick(u,pv,ox,oy,moving){
 if(!moving||(u===player&&mode==='soldier')){pv.ax=ox;pv.ay=oy;pv.at=time;pv.ad=hyp(u.tx-ox,u.ty-oy);return}
 const dT=hyp(u.tx-ox,u.ty-oy);
 if(time-pv.at>1.8){if(pv.ad-dT<14&&time-pv.cT<1&&!pv.path){if(!planPath(u,pv)){pv.ds=-pv.ds;pv.esc=time+3}}pv.ax=ox;pv.ay=oy;pv.at=time;pv.ad=dT}}     // sem chegar mais perto do alvo (mesmo que balance ao longo da parede)
/* A* de 8 vizinhos numa janela em torno da unidade e do alvo (células de 12 px). Bloqueia onde o centro da célula está a menos que o raio de um sólido. */
const PCS=12;
function planPath(u,pv){
 const rc=(CFG.RW[u.type]||5)+3,tank=u.type==='tank';
 const x0=Math.max(0,Math.min(u.x,u.tx)-140),y0=Math.max(0,Math.min(u.y,u.ty)-140),x1=Math.min(W,Math.max(u.x,u.tx)+140),y1=Math.min(H,Math.max(u.y,u.ty)+140),gw=Math.ceil((x1-x0)/PCS),gh=Math.ceil((y1-y0)/PCS);
 if(gw<2||gh<2||gw*gh>7000)return false;
 const blk=new Uint8Array(gw*gh);let any=false;
 sQuery(x0,y0,x1,y1,s=>{let a,b,c,d;
  if(s.k==='bunker'||s.k==='ruin'){a=s.mx0-rc;b=s.my0-rc;c=s.mx1+rc;d=s.my1+rc}
  else if(s.k==='tree'&&s.thick&&tank){a=s.x-s.r-rc;b=s.y-s.r-rc;c=s.x+s.r+rc;d=s.y+s.r+rc}else return false;
  any=true;
  for(let gy=Math.max(0,Math.ceil((b-y0)/PCS-.5));gy<gh&&y0+(gy+.5)*PCS<=d;gy++)for(let gx=Math.max(0,Math.ceil((a-x0)/PCS-.5));gx<gw&&x0+(gx+.5)*PCS<=c;gx++)blk[gy*gw+gx]=1;
  return false});
 if(!any)return false;
 const cell=(x,y)=>clamp(Math.floor((y-y0)/PCS),0,gh-1)*gw+clamp(Math.floor((x-x0)/PCS),0,gw-1);
 const s0=cell(u.x,u.y);let g0=cell(u.tx,u.ty);blk[s0]=0;
 if(blk[g0]){let bd=1e9,bi=-1;for(let i=0;i<blk.length;i++)if(!blk[i]){const dx=i%gw-g0%gw,dy=((i/gw)|0)-((g0/gw)|0),d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i}}if(bi<0)return false;g0=bi}   // destino dentro de parede: célula livre mais próxima
 const n=gw*gh,G=new Float32Array(n).fill(1e9),Fp=new Int32Array(n).fill(-1),done=new Uint8Array(n),F=new Float32Array(n),heap=[s0],gx0=g0%gw,gy0=(g0/gw)|0;
 G[s0]=0;const hf=i=>{const dx=Math.abs(i%gw-gx0),dy=Math.abs(((i/gw)|0)-gy0);return dx+dy-.586*Math.min(dx,dy)};F[s0]=hf(s0);
 const up=k=>{while(k>0){const p=(k-1)>>1;if(F[heap[p]]<=F[heap[k]])break;const t=heap[p];heap[p]=heap[k];heap[k]=t;k=p}};
 const dn=k=>{for(;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&F[heap[l]]<F[heap[m]])m=l;if(r<heap.length&&F[heap[r]]<F[heap[m]])m=r;if(m===k)break;const t=heap[m];heap[m]=heap[k];heap[k]=t;k=m}};
 let found=false,guard=0;
 while(heap.length&&guard++<9000){
  const cur=heap[0],last=heap.pop();if(heap.length){heap[0]=last;dn(0)}
  if(done[cur])continue;done[cur]=1;if(cur===g0){found=true;break}
  const cx=cur%gw,cy=(cur/gw)|0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=gw||ny>=gh)continue;const ni=ny*gw+nx;if(blk[ni]||done[ni])continue;
   if(dx&&dy&&(blk[cy*gw+nx]||blk[ny*gw+cx]))continue;                                   // sem cortar quina
   const g=G[cur]+(dx&&dy?1.414:1);if(g<G[ni]){G[ni]=g;Fp[ni]=cur;F[ni]=g+hf(ni);heap.push(ni);up(heap.length-1)}}}
 if(!found)return false;
 const cells=[];for(let i=g0;i!==-1;i=Fp[i])cells.push(i);cells.reverse();
 const pts=cells.map(i=>[x0+(i%gw+.5)*PCS,y0+(((i/gw)|0)+.5)*PCS]);
 const los=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.ceil(hyp(dx,dy)/(PCS*.5));for(let k=1;k<L;k++){const t=k/L;if(blk[cell(a[0]+dx*t,a[1]+dy*t)])return false}return true};
 const path=[];let anchor=pts[0],i=1;                                                    // alisa: só os pontos necessários (linha de visada na grade)
 while(i<pts.length){let j=pts.length-1;while(j>i&&!los(anchor,pts[j]))j--;path.push(pts[j]);anchor=pts[j];i=j+1}
 pv.path=path;pv.pi=0;pv.pathT=time+14;return true}
function followPath(u,pv,vdm){
 if(!pv.path||time>pv.pathT||!(u.order==='move'||u.order==='attack'||u.order==='retreat')){pv.path=null;return false}
 let p=pv.path[pv.pi];
 while(p){const wx=p[0]-u.x,wy=p[1]-u.y,wd=hyp(wx,wy);if(wd<14){pv.pi++;p=pv.path[pv.pi];continue}const s=Math.max(vdm,20);SV.x=wx/wd*s;SV.y=wy/wd*s;return true}
 pv.path=null;return false}
/* alvo dentro de parede (cobertura da IA aponta para o centro do bunker/ruína): leva para a face oposta ao inimigo */
function fixTarget(u){if(!(u.order==='move'||u.order==='attack'||u.order==='retreat'))return;const rw=(CFG.RW[u.type]||5)+3;let hit=null;
 sQuery(u.tx-rw,u.ty-rw,u.tx+rw,u.ty+rw,s=>{if((s.k==='bunker'||s.k==='ruin')&&u.tx>s.mx0-rw&&u.tx<s.mx1+rw&&u.ty>s.my0-rw&&u.ty<s.my1+rw){hit=s;return true}return false});
 if(!hit)return;const e=nearest(u,420),cx=(hit.mx0+hit.mx1)/2,cy=(hit.my0+hit.my1)/2;let dx=cx-(e?e.x:u.x),dy=cy-(e?e.y:u.y);const l=hyp(dx,dy)||1;dx/=l;dy/=l;
 const hx=(hit.mx1-hit.mx0)/2,hy=(hit.my1-hit.my0)/2,ext=Math.abs(dx)*hx+Math.abs(dy)*hy;u.tx=clamp(cx+dx*(ext+rw+4),20,W-20);u.ty=clamp(cy+dy*(ext+rw+4),20,H-20)}

/* integração de quem anda a pé ou a cavalo */
function stepFoot(u,pv,dt,i){
 const ox=u._qx,oy=u._qy,dx=u.x-ox,dy=u.y-oy,lim=CFG.MAXV*dt;
 if(dx*dx+dy*dy>lim*lim){pv.vx=pv.vy=pv.kx=pv.ky=0;return}
 let vdx=dx/dt,vdy=dy/dt;const g=ground(u);
 if(pv.stun>0){pv.stun-=dt;vdx=vdy=0;u.cd=Math.max(u.cd,pv.stun);if(u.thr>0){u.thr=0;u.tg=null}}
 let vdm=hyp(vdx,vdy);
 if(vdm>4&&WIRE.on&&wireAt(u.x,u.y)){const f=u.type==='cavalry'?.3:.42;vdx*=f;vdy*=f;vdm*=f;if(Math.random()<dt*3)dustPuff(u.x,u.y+3,1,2,8)}   // arame pintado: enrosca
 unstick(u,pv,ox,oy,vdm>10);
 if(pv.path&&followPath(u,pv,vdm)){vdx=SV.x;vdy=SV.y;vdm=hyp(vdx,vdy)}   // segue o caminho planejado
 if(vdm>4){fixTarget(u);
  /* chegada suave: a frenagem do solo não pode estourar o alvo (lama desliza longe) */
  if(u.order==='move'||u.order==='retreat'){const len=hyp(u.tx-ox,u.ty-oy),Ds=vdm/g.brk;if(len<Ds+8){const f=clamp((len-6)/Ds,.2,1);vdx*=f;vdy*=f;vdm*=f}}
  if(steerAround(pv,vdx,vdy)){vdx=SV.x;vdy=SV.y}}
 if(PH.gait&&PH.gait(u,pv,dt,vdx,vdy,vdm)){vdx=PH.gv.x;vdy=PH.gv.y;vdm=hyp(vdx,vdy)}   // marcha humana (gait.js): ritmo, partida, giro e frenagem de cada soldado
 /* afastamento elástico entre tropas */
 const sm=pushOf(u,i);let sepx=SX[i],sepy=SY[i];
 /* quem já está perto do próprio destino e só vive sendo empurrado considera que chegou (evita tremer na multidão) */
 if(sm>10&&vdm>0&&u.order==='move'&&u.type!=='cavalry'&&hyp(u.tx-u.x,u.ty-u.y)<26){u.order='hold';u.tx=u.x;u.ty=u.y;vdx=vdy=vdm=0}
 vdx+=sepx;vdy+=sepy;
 /* inércia: acelera com g.acc, freia com g.brk (lama desliza), o que sobra do arremesso decai com g.kd */
 const sp=hyp(pv.vx,pv.vy),tsp=hyp(vdx,vdy),along=sp>.5?(vdx*pv.vx+vdy*pv.vy)/sp:tsp,brake=sp>.5?clamp((sp-Math.max(0,along))/sp,0,1):0,a=g.acc+(g.brk-g.acc)*brake,k=1-Math.exp(-a*dt);
 pv.vx+=(vdx-pv.vx)*k;pv.vy+=(vdy-pv.vy)*k;
 const kd=Math.exp(-g.kd*dt);pv.kx*=kd;pv.ky*=kd;
 CX=ox+(pv.vx+pv.kx)*dt;CY=oy+(pv.vy+pv.ky)*dt;
 if(g.d>=.25){flowAt(u.x,u.y);const sh=g.d>=.55?(u.type==='cavalry'?.3:.55):.18;CX+=FLW.x*sh*dt;CY+=FLW.y*sh*dt}     // a correnteza leva quem nada
 collideSolids(CFG.RW[u.type]||5,pv,false);
 u.x=clamp(CX,15,W-15);u.y=clamp(CY,15,H-15);
 u.moving=hyp(pv.vx+pv.kx*.5,pv.vy+pv.ky*.5)>9}

/* ======================================================================================
   PIPELINE POR QUADRO
   ====================================================================================== */
function pre(dt){for(let i=0;i<units.length;i++){const u=units[i];u._qx=u.x;u._qy=u.y}preTanks();
 PEND.length=0;for(let i=0;i<shells.length;i++){const s=shells[i];if(s.t-dt<=0)PEND.push(s)}
 preWater(dt)}
const PROF={on:false,t:{}};const pm=(k,t0)=>{if(PROF.on)PROF.t[k]=(PROF.t[k]||0)+performance.now()-t0};
function post(dt){
 let t0=PROF.on?performance.now():0;
 refreshStatics();
 const U=units,n=U.length;growBuffers(n);pm('refresh',t0);t0=PROF.on?performance.now():0;
 separation(U,n);pm('separation',t0);t0=PROF.on?performance.now():0;
 for(let i=0;i<n;i++){const u=U[i];if(u.hp<=0)continue;const pv=pvOf(u);
  if(u._qx===undefined){u._qx=u.x;u._qy=u.y;continue}
  if(u.type==='tank')stepTank(u,pv,dt,i);else stepFoot(u,pv,dt,i)}
 pm('step',t0);t0=PROF.on?performance.now():0;
 post2(dt);pm('post2',t0)}
PH.prof=PROF;
let errs=0;
wrap('update',(orig,dt)=>{
 if(!PH.on||!(dt>0))return orig(dt);
 let t0=PROF.on?performance.now():0;
 try{pre(dt)}catch(e){fail(e)}
 pm('pre',t0);t0=PROF.on?performance.now():0;
 const r=orig(dt);
 pm('orig',t0);t0=PROF.on?performance.now():0;
 try{post(dt)}catch(e){fail(e)}
 pm('post',t0);
 return r});
function fail(e){PH.stats.errors++;if(++errs<=3)console.error('physics.js:',e);if(errs>=12){PH.on=false;console.error('physics.js desligado após erros repetidos')}}

/* ======================================================================================
   PARTIDA NOVA
   ====================================================================================== */
function resetAll(){
 CR.list=[];CR.grid.clear();const base=window.PXGAME&&PXGAME.base;
 if(base&&base.craters)for(const c of base.craters)craterAdd(c.x*2,c.y*2,c.r*2);
 sigLast='';refreshStatics(true);
 for(const u of units){u._qx=u.x;u._qy=u.y}
 if(typeof resetFase2==='function')resetFase2()}
wrap('setup',(orig,demo)=>{const r=orig(demo);try{resetAll();if(map==='trenches'&&!GND.tried)setTimeout(ensureGround,400)}catch(e){fail(e)}return r});
PH.state=()=>({on:PH.on,statics:statics.length,craters:CR.list.length,hasHeight:!!GND.hm,hasBare:!!GND.bare,errors:PH.stats.errors,fx:FX.length,floaters:FL.length,piers:PIERS.length,wireCells:WIRE.cells.size});
PH.floaters=()=>FL;PH.flowAt=(x,y)=>{flowAt(x,y);return{x:FLW.x,y:FLW.y}};PH.addFloater=floatAdd;
PH.pv=pvOf;PH.tp=()=>TP;PH.refresh=()=>{annotateTrenches();refreshStatics(true)};PH.wire=()=>({on:WIRE.on,cells:WIRE.cells.size,list:[...WIRE.cells.keys()]});PH.felled=()=>FELLED.size;PH.ensureGround=ensureGround;PH.heightAt=heightAt;PH.gradAt=gradAt;PH.hmAt=hmAt;PH.statics=()=>statics;PH.rebuild=()=>{sigLast='';refreshStatics(true)};PH.GND=GND;
if(window.IronFront)window.IronFront.physics=PH;
/* ======================================================================================
   EFEITOS PRÓPRIOS (poeira, lascas de material, faíscas, água) — desenhados por cima das unidades, via PLN.draw
   ====================================================================================== */
const FX=[],pick=a=>a[Math.floor(Math.random()*a.length)];
const nearCam=(x,y,r)=>hyp(x-cam.x,y-cam.y)<(r||900);
function fxAdd(p){if(FX.length<700){p.t=p.t||0;FX.push(p)}return p}
function dustPuff(x,y,n,size,vel){for(let i=0;i<n;i++)fxAdd({k:'dust',x:x+rnd(-2,2),y:y+rnd(-2,2),vx:rnd(-1,1)*(vel||14),vy:rnd(-1,.3)*(vel||14),z:rnd(0,3),vz:rnd(2,9),max:rnd(.35,.75),size:size*rnd(.75,1.25)})}
function chipBurst(x,y,nx,ny,n,cols,spd){for(let i=0;i<n;i++){const s=rnd(.4,1)*(spd||110);fxAdd({k:'chip',x,y,vx:nx*s*.7+rnd(-45,45),vy:ny*s*.7+rnd(-45,45),z:rnd(0,2),vz:rnd(30,95),max:rnd(.3,.65),col:pick(cols),sz:Math.random()<.3?2:1})}}
function sparkBurst(x,y,nx,ny,n){for(let i=0;i<n;i++){const s=rnd(.5,1)*130;fxAdd({k:'spark',x,y,vx:nx*s*.6+rnd(-70,70),vy:ny*s*.6+rnd(-70,70),z:rnd(0,2),vz:rnd(10,60),max:rnd(.08,.22)})}}
function fxStep(dt){
 for(let i=FX.length-1;i>=0;i--){const p=FX[i];p.t+=dt;if(p.t>=p.max){FX[i]=FX[FX.length-1];FX.pop();continue}
  p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;
  if(p.k==='chip'||p.k==='spark'||p.k==='drop'){p.vz-=(p.k==='drop'?330:260)*dt;p.z+=p.vz*dt;if(p.z<0){p.z=0;if(p.k==='drop')p.t=p.max;else{p.vx*=.4;p.vy*=.4;p.vz=0}}}
  else if(p.k==='dust'){p.vx*=.95;p.vy*=.95;p.z+=p.vz*dt}}}
function fxDraw(c,ox,oy){const snow=!!(window.PXW&&PXW.state&&PXW.state.snow);
 for(let i=0;i<FX.length;i++){const p=FX[i];if(p.t<0)continue;const k=p.t/p.max,x=ox+Math.round(p.x*ZZ),y=oy+Math.round(p.y*ZZ)-Math.round(p.z||0);
  if(x<-30||y<-60||x>vw+30||y>vh+30)continue;
  if(p.k==='dust'){const r=Math.max(1,Math.round(p.size*(.6+k*.9)));c.globalAlpha=k<.3?.55:k<.65?.34:.16;PXO.disc(c,x,y,r,snow?'#dfe8e6':'#a8946c');c.globalAlpha=1}
  else if(p.k==='chip'){c.globalAlpha=k>.75?1-(k-.75)*3:1;c.fillStyle=p.col;c.fillRect(x,y,p.sz,p.sz);c.globalAlpha=1}
  else if(p.k==='spark'){c.fillStyle=k<.4?'#fff6cc':'#ffb347';c.fillRect(x,y,1,1);if(k<.25){c.fillStyle='#ffd27a';c.fillRect(x+1,y,1,1)}}
  else if(p.k==='drop'){c.fillStyle=p.col||'#dcebea';c.fillRect(x,y,1,1)}
  else if(p.k==='frag'){const hk=Math.min(1,k*1.7),tk=Math.max(0,k*1.7-.5),X0=ox+p.x0*ZZ,Y0=oy+p.y0*ZZ,X1=ox+p.x1*ZZ,Y1=oy+p.y1*ZZ;
   PXO.pline(c,Math.round(X0+(X1-X0)*tk),Math.round(Y0+(Y1-Y0)*tk),Math.round(X0+(X1-X0)*hk),Math.round(Y0+(Y1-Y0)*hk),k<.45?'#fff2b8':'#ffa83a')}
  else if(p.k==='ring'){const R=Math.max(1,Math.round(p.r*ZZ*(.25+.85*(1-Math.pow(1-k,2)))));c.globalAlpha=(1-k)*(p.a||.6);PXO.ring(c,ox+Math.round(p.x*ZZ),oy+Math.round(p.y*ZZ),R,Math.max(1,Math.round(R*.55)),p.col||'#dcebea');c.globalAlpha=1}
  else if(p.k==='wcol'&&typeof drawWaterColumn==='function')drawWaterColumn(c,p,x,y,k)}}
(function installDraw(){
 if(window.PLN&&PLN.draw){const o=PLN.draw;PLN.draw=function(c,ox,oy,dt){const r=o.apply(this,arguments);try{if(PH.on)fxDraw(c,ox,oy)}catch(e){fail(e)}return r}}
 else console.warn('physics.js: PLN.draw ausente; efeitos próprios desligados')})();

/* ======================================================================================
   SOM: impacto seco, esmagamento, chapa, água (sintetizados, como o resto)
   ====================================================================================== */
function synth(kind){if(!soundOn||!audio)return;try{const now=audio.currentTime,g=audio.createGain();g.connect(audio.destination);
 if(kind==='clank'){for(const f of[540,830]){const o=audio.createOscillator();o.type='square';o.frequency.setValueAtTime(f,now);o.frequency.exponentialRampToValueAtTime(f*.6,now+.09);o.connect(g);o.start(now);o.stop(now+.1)}g.gain.setValueAtTime(.03,now);g.gain.exponentialRampToValueAtTime(.001,now+.1);return}
 const dur=kind==='splash'?.55:kind==='crunch'?.24:kind==='whump'?.32:.1,len=Math.ceil(audio.sampleRate*dur),buf=audio.createBuffer(1,len,audio.sampleRate),d=buf.getChannelData(0);
 for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,kind==='crunch'?1.2:2);
 const src=audio.createBufferSource(),f=audio.createBiquadFilter();src.buffer=buf;f.type=kind==='crunch'?'bandpass':'lowpass';f.frequency.value=kind==='splash'?1500:kind==='crunch'?900:kind==='whump'?230:420;
 g.gain.value=kind==='splash'?.11:kind==='whump'?.16:.07;src.connect(f);f.connect(g);src.start(now);src.stop(now+dur)}catch{}}
wrap('sound',(orig,kind)=>(kind==='thud'||kind==='crunch'||kind==='splash'||kind==='clank'||kind==='whump')?synth(kind):orig(kind));
const sfx=(kind,x,y,r)=>{if(nearCam(x,y,r||850))sound(kind)};

/* ======================================================================================
   PILAR 2 — balística
   2.1 o tiro é um SEGMENTO (posição anterior → atual) testado contra sacos de areia, bunkers, ruínas, troncos e cascos de tanque;
       vence a primeira colisão ao longo do segmento. Quem atira colado ao próprio parapeito atira por cima dele.
   2.1 trincheira: o parapeito só importa para quem está DENTRO da baía. Tiro que cruza o eixo da baía é barrado com
       probabilidade pk·f(ângulo); tiro alinhado com o eixo (enfilada) passa. Uma rolagem por bala (nada de 38% por quadro).
   2.2 blindagem: ângulo de incidência contra a face do casco (caixa orientada); > 45° ricocheteia (reflexão), ≤ 45° não penetra.
   ====================================================================================== */
const TR=[],tGrid=new Map(),TPK={front:.92,support:.8,reserve:.4,comm:.3,sap:.85};
function annotateTrenches(){const groups=new Map();
 for(const t of fieldTrenches){const m=/^field-(\d)-([a-z]+)-(-?\d+)-(\d+)$/.exec(t.id||'');t.bw=t.hw||52;t.bh=t.hh||22;
  if(!m){t.ax=0;t.ay=1;t.pk=t.hw?TPK.front*.7:.78;continue}             // mapas antigos: a coluna de trincheiras corre norte-sul, o tiro de frente (leste-oeste) cruza o eixo
  const key=m[1]+m[2]+m[3];let g=groups.get(key);if(!g)groups.set(key,g=[]);g[+m[4]]=t;t.pk=TPK[m[2]]||.6}
 for(const g of groups.values())for(let i=0;i<g.length;i++){const t=g[i];if(!t)continue;const a=g[i-1]||t,b=g[i+1]||t;let dx=b.x-a.x,dy=b.y-a.y;const l=hyp(dx,dy);if(l<.1){dx=0;dy=1}else{dx/=l;dy/=l}t.ax=dx;t.ay=dy}}
function trenchRebuild(){TR.length=0;tGrid.clear();
 for(const t of fieldTrenches){if(t.ax===undefined)annotateTrenches();TR.push(t)}
 for(const b of buildings)if(b.type==='trench')TR.push({x:b.x,y:b.y,bw:48,bh:18,ax:0,ay:1,pk:.8,team:b.team,line:'bld',ref:b});
 for(const a of TR){const x0=Math.floor((a.x-a.bw)/64),x1=Math.floor((a.x+a.bw)/64),y0=Math.floor((a.y-a.bh)/64),y1=Math.floor((a.y+a.bh)/64);
  for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){const k=gx*1000+gy;let l=tGrid.get(k);if(!l)tGrid.set(k,l=[]);l.push(a)}}}
function trenchAt(x,y){const l=tGrid.get(Math.floor(x/64)*1000+Math.floor(y/64));if(!l)return null;let best=null,bd=1e9;
 for(const a of l){const dx=Math.abs(x-a.x),dy=Math.abs(y-a.y);if(dx<a.bw&&dy<a.bh){const d=dx*dx+dy*dy;if(d<bd){bd=d;best=a}}}return best}

const TANKS=[],HULL=[{hl:30,hw:17,arm:[.12,.2,.25]},{hl:40,hw:22,arm:[.1,.16,.22]}];
function preTanks(){TANKS.length=0;for(const u of units)if(u.type==='tank'&&u.hp>0)TANKS.push(u)}
const near=(sx,sy,s,m)=>sx>s.x0-m&&sx<s.x1+m&&sy>s.y0-m&&sy<s.y1+m;
const DIRT=['#b5a57c','#a08d6a','#c4b78e','#8a7656'],STONE=['#92917c','#b3b1a0','#727465','#c9c6b2'],BARK=['#5f5138','#3f3425','#7a6848'];

function bulletHit(b,ox,oy,nx,ny){
 if(b.sx===undefined){b.sx=ox;b.sy=oy}
 const dx=b.x-ox,dy=b.y-oy;let best=2,kind=0,ref=null,hx=0,hy=0;
 sQuery(Math.min(ox,b.x)-1,Math.min(oy,b.y)-1,Math.max(ox,b.x)+1,Math.max(oy,b.y)+1,s=>{let t=-1;
  if(s.k==='sandbag'){if(b.team===s.ref.team&&!b.friendlyFire)return false;t=segBox(ox,oy,dx,dy,s.x0,s.y0,s.x1,s.y1)}   // o dono atira por cima do próprio parapeito
  else if(s.k==='bunker'){if(b.team===s.ref.team&&hyp(b.sx-s.x,b.sy-s.y)<10)return false;t=segBox(ox,oy,dx,dy,s.x0,s.y0,s.x1,s.y1)}
  else if(s.k==='ruin')t=segBox(ox,oy,dx,dy,s.x0,s.y0,s.x1,s.y1);
  else if(s.k==='tree')t=segCircle(ox,oy,dx,dy,s.x,s.y,6);
  if(t>=0&&t<best){best=t;kind=1;ref=s;hx=HN.x;hy=HN.y}return false});
 for(let i=0;i<TANKS.length;i++){const u=TANKS[i];if(u.hp<=0||u.id===b.noTank||(u.team===b.team&&!b.friendlyFire))continue;
  if(Math.abs(u.x-ox)>70+Math.abs(dx)&&Math.abs(u.x-b.x)>70)continue;
  const hd=u.pv?u.pv.hdg:(u.angle||0),c=Math.cos(hd),s=Math.sin(hd),Hh=HULL[u.team?1:0],rx=ox-u.x,ry=oy-u.y;
  const t=segBox(rx*c+ry*s,-rx*s+ry*c,dx*c+dy*s,-dx*s+dy*c,-Hh.hl,-Hh.hw,Hh.hl,Hh.hw);
  if(t>=0&&t<best&&(HN.x||HN.y)){best=t;kind=2;ref=u;hx=HN.x*c-HN.y*s;hy=HN.x*s+HN.y*c}}
 if(kind===1)return hitStatic(b,ref,ox+dx*best,oy+dy*best,hx,hy);
 if(kind===2)return hitTank(b,ref,ox+dx*best,oy+dy*best,hx,hy,nx,ny);
 return trenchVictim(b,ox,oy,dx,dy,nx,ny)}
function hitStatic(b,s,px,py,hx,hy){b.x=px;b.y=py;b.t=-1;const k=s.k;
 if(k==='sandbag'){s.ref.hp-=b.damage*.65;chipBurst(px,py,hx,hy,4,DIRT,90);dustPuff(px,py,2,3,16);if(Math.random()<.3)sfx('thud',px,py)}
 else if(k==='bunker'){s.ref.hp-=b.damage*.45;chipBurst(px,py,hx,hy,3,STONE,110);sparkBurst(px,py,hx,hy,4);if(Math.random()<.45)sfx('clank',px,py)}
 else if(k==='ruin'){chipBurst(px,py,hx,hy,3,STONE,100);sparkBurst(px,py,hx,hy,3);if(Math.random()<.25)sfx('thud',px,py)}
 else chipBurst(px,py,hx||-b.vx/900,hy||-b.vy/900,3,BARK,80);
 return true}
function hitTank(b,u,px,py,hx,hy,nx,ny){
 const hd=u.pv?u.pv.hdg:(u.angle||0),c=Math.cos(hd),s=Math.sin(hd),lx=hx*c+hy*s,Hh=HULL[u.team?1:0];
 const cosI=-(nx*hx+ny*hy),face=lx>.5?0:lx<-.5?2:1;             // frente, lados ou traseira
 if(cosI<.7071){                                                // > 45°: ricochete, o projétil sai refletido e mais lento
  const d=nx*hx+ny*hy;let rx=nx-2*d*hx,ry=ny-2*d*hy;const j=rnd(-.12,.12),cj=Math.cos(j),sj=Math.sin(j),qx=rx*cj-ry*sj,qy=rx*sj+ry*cj,sp=hyp(b.vx,b.vy)*rnd(.55,.75);
  b.vx=qx*sp;b.vy=qy*sp;b.x=px+hx*2.5;b.y=py+hy*2.5;b.t=Math.min(b.t,.32);b.damage*=.6;b.friendlyFire=true;b.ricochet=true;b.noTank=u.id;
  damage(u,rnd(.4,1.4),b.team);sparkBurst(px,py,hx,hy,5);sound('ping')}
 else{                                                          // fuzil leve não fura a chapa: só a frestas e rebites
  damage(u,b.damage*Hh.arm[face],b.team);b.t=-1;b.x=px;b.y=py;sparkBurst(px,py,hx,hy,3);if(Math.random()<.4)sfx('clank',px,py)}
 return true}
function trenchVictim(b,ox,oy,dx,dy,nx,ny){
 if(b.trDone||b.damage<=0)return false;const gx=Math.floor(b.x/160),gy=Math.floor(b.y/160),l2=dx*dx+dy*dy||1;
 for(let xx=gx-1;xx<=gx+1;xx++)for(let yy=gy-1;yy<=gy+1;yy++){const L=grid.get(xx+','+yy);if(!L)continue;
  for(let i=0;i<L.length;i++){const u=L[i];if(u.hp<=0||u.type==='tank'||(u.team===b.team&&!b.friendlyFire))continue;
   const f=clamp(((u.x-ox)*dx+(u.y-oy)*dy)/l2,0,1);if(hyp(u.x-ox-f*dx,u.y-oy-f*dy)>8)continue;
   const a=trenchAt(u.x,u.y);if(!a)continue;b.trDone=1;
   const cosA=Math.abs(nx*a.ax+ny*a.ay),sinA=Math.sqrt(Math.max(0,1-cosA*cosA));let p=a.pk*sstep(.35,.85,sinA);
   if(u.cd>((defs[u.type]&&defs[u.type].rate)||1.5)-.45)p*=.55;      // acabou de atirar: a cabeça passou do parapeito
   if(Math.random()<p){b.t=-1;b.x=u.x-nx*11;b.y=u.y-ny*11;chipBurst(b.x,b.y,-nx,-ny,3,DIRT,80);dustPuff(b.x,b.y,2,3,14);return true}
   return false}}
 return false}
const origHit=window.bulletObstacleHit;
window.bulletObstacleHit=function(b,ox,oy,nx,ny){
 if(!PH.on)return origHit(b,ox,oy,nx,ny);
 const t0=PROF.on?performance.now():0;
 try{return bulletHit(b,ox,oy,nx,ny)}catch(e){fail(e);return origHit(b,ox,oy,nx,ny)}finally{pm('bullets',t0)}};

/* 2.3 granadas: gravidade de 380 px/s², quique de 0,35, rolamento pelo declive (mapa de altura + bacias das crateras) e quique em ruínas */
const K_ROLL=1100;
const origFNC=window.findNearestCrater;
window.findNearestCrater=function(x,y){return PH.on?null:origFNC(x,y)};
function grenadePhysics(dt){
 for(let i=0;i<shells.length;i++){const s=shells[i];if(!s.gren||s.gx===undefined)continue;
  if(s._bn===undefined)s._bn=0;
  if(s.gz>.001)s.gvz-=(CFG.G_PX-340)*dt;
  else{const g=gradAt(s.gx,s.gy);s.gvx-=g.x*K_ROLL*dt;s.gvy-=g.y*K_ROLL*dt}
  if(s.bounces>s._bn){s._bn=s.bounces;s.gvz*=CFG.E_GREN/.38}
  if(s.gz<22)sQuery(s.gx-2,s.gy-2,s.gx+2,s.gy+2,st=>{if(st.k!=='ruin'||s.gx<=st.x0||s.gx>=st.x1||s.gy<=st.y0||s.gy>=st.y1)return false;
   const dl=s.gx-st.x0,dr=st.x1-s.gx,dtp=s.gy-st.y0,db=st.y1-s.gy,m=Math.min(dl,dr,dtp,db);
   if(m===dl){s.gx=st.x0-1;s.gvx=-Math.abs(s.gvx)*.45}else if(m===dr){s.gx=st.x1+1;s.gvx=Math.abs(s.gvx)*.45}else if(m===dtp){s.gy=st.y0-1;s.gvy=-Math.abs(s.gvy)*.45}else{s.gy=st.y1+1;s.gvy=Math.abs(s.gvy)*.45}
   s.bounces++;s._bn=s.bounces;s.x=s.gx;s.y=s.gy;chipBurst(s.gx,s.gy,0,0,3,STONE,60);sfx('thud',s.gx,s.gy,600);return true})}}
/* a IA só joga se não houver aliado num raio maior que o original (56): os estilhaços chegam a 100 px */
wrap('aiGrenade',(orig,u,target,dt)=>{if(!PH.on)return orig(u,target,dt);const g0=u.gren,t0=u.thr;orig(u,target,dt);
 if(u.gren<g0&&u.thr>t0){for(const f of units)if(f!==u&&f.team===u.team&&f.hp>0&&hyp(f.x-target.x,f.y-target.y)<92){u.gren=g0;u.thr=0;u.tg=null;u.gcd=rnd(2,5);break}}});

/* ======================================================================================
   PILAR 4 — ondas de choque e estilhaços
   4.1 impulso radial  v = (x_unidade − x_explosão)/d · I · (1 − d/R)  em vivos e cadáveres; quem sobrevive e está perto cai (0,6–1,2 s)
   4.2 8–16 estilhaços a ~1200 px/s, alcance de 60–100 px, dano penetrante; parados por relevo (bordas de cratera, parapeitos),
       sacos de areia, bunkers, ruínas e troncos; passam por cima de quem está fundo na trincheira
   ====================================================================================== */
const PEND=[],IBLAST=330,MASSF={rifle:1,mg:.9,cavalry:.42,tank:.035};
let WETNOW=null;
const isWet=(x,y)=>!!(window.PXW&&PXW.depth(x,y)>=.3);
function pendFind(x,y,r){for(let i=0;i<PEND.length;i++){const s=PEND[i];if(Math.abs(s.x-x)<.6&&Math.abs(s.y-y)<.6&&s.r===r)return s}return null}
wrap('explode',(orig,x,y,r,power=100,team=0)=>{
 if(!PH.on)return orig(x,y,r,power,team);
 const sh=pendFind(x,y,r),gren=!!gblast||!!(sh&&sh.gren),smoke=!!(sh&&sh.kind==='smoke'),wet=!smoke&&isWet(x,y);
 let pw=power;if(!smoke&&power>0){pw*=gren?.78:.9;if(wet)pw*=.7}                 // os estilhaços somam letalidade: a parte radial cai um pouco
 WETNOW=wet?{x,y}:null;
 try{orig(x,y,r,pw,team)}finally{WETNOW=null}
 if(!smoke){try{blastPhysics(x,y,r,power,team,sh,gren,wet)}catch(e){fail(e)}}
 if(r>=40&&!gblast&&!wet)craterAdd(x,y,r*.85)});
PH.skipBlastFx=(x,y)=>!!(WETNOW&&WETNOW.x===x&&WETNOW.y===y);
function blastPhysics(x,y,r,power,team,sh,gren,wet){
 const shrap=!!(sh&&sh.kind==='shrap'),inten=clamp(Math.max(power,r*1.4)/160,.35,1.6),Rk=r*1.25;
 for(let i=0;i<units.length;i++){const u=units[i];if(u.hp<=0)continue;const dx=u.x-x,dy=u.y-y,d=hyp(dx,dy);if(d>=Rk)continue;
  const f=1-d/Rk,nx=d<1?Math.cos(u.id):dx/d,ny=d<1?Math.sin(u.id):dy/d,pv=pvOf(u),sub=wet&&window.PXW&&PXW.depth(u.x,u.y)>=.25,imp=IBLAST*inten*f*(MASSF[u.type]||1)*(sub?.5:1);
  pv.kx+=nx*imp;pv.ky+=ny*imp;
  if(u.type==='tank'){pv.pk=time;pv.pkA=Math.min(1,f*inten)*.8;continue}                // a carcaça só sente o tranco
  if(f>.22){const st=rnd(.6,1.2)*(.55+.6*f);if(st>pv.stun){pv.stun=st;dustPuff(u.x,u.y+3,3,4,18)}u.suppression=Math.min(2,(u.suppression||0)+.45)}}
 for(let k=0;k<corpses.length;k++){const c=corpses[k],dx=c.x-x,dy=c.y-y,d=hyp(dx,dy);if(d>=Rk)continue;const f=1-d/Rk,nx=d<1?1:dx/d,ny=d<1?0:dy/d;c.kx=(c.kx||0)+nx*IBLAST*inten*f*1.2;c.ky=(c.ky||0)+ny*IBLAST*inten*f*1.2}
 if(!shrap&&(gren||power>0))fragments(x,y,r,power,team,gren,wet);
 if(wet)waterBlast(x,y,r,power,team);else if(power>0)plankBurst(x,y)}
function fragments(x,y,r,power,team,gren,wet){
 let n=gren?(team?8+((Math.random()*4)|0):10+((Math.random()*5)|0)):r>=85?14+((Math.random()*3)|0):r>=65?12+((Math.random()*5)|0):8+((Math.random()*5)|0);
 if(wet)n=Math.ceil(n*.5);
 const dmg=clamp(10+power*.06,11,24),h0=heightAt(x,y),fh=h0+1.5,cand=[],obs=[];
 for(let i=0;i<units.length;i++){const u=units[i];if(u.hp<=0)continue;const dx=u.x-x,dy=u.y-y;if(dx*dx+dy*dy<115*115)cand.push(u)}
 sQuery(x-105,y-105,x+105,y+105,s=>{obs.push(s);return false});
 const base=Math.random()*TAU2;
 for(let i=0;i<n;i++){
  const a=base+(i+rnd(.05,.95))/n*TAU2,ca=Math.cos(a),sa=Math.sin(a),range=rnd(60,100)*(wet?.6:1);
  let hitU=null,hitAlong=range;
  for(let k=0;k<cand.length;k++){const u=cand[k],dx=u.x-x,dy=u.y-y,along=dx*ca+dy*sa;if(along<2||along>=hitAlong)continue;
   const rU=u.type==='tank'?22:u.type==='cavalry'?9:5.5;if(Math.abs(dx*sa-dy*ca)>rU)continue;
   if(heightAt(u.x,u.y)+(u.pv&&u.pv.stun>0?.5:1.6)<fh-1.2)continue;                 // fundo na baía: o estilhaço voa por cima
   hitU=u;hitAlong=along}
  let stop=-1,by=null;const climb=Math.random()*.09;                                 // elevação do estilhaço: alguns passam por cima da borda da cratera
  for(let d=3;d<hitAlong;d+=5){const px=x+ca*d,py=y+sa*d;
   if(heightAt(px,py)>h0+1.9+climb*d){stop=d;break}
   let hs=null;for(let k=0;k<obs.length;k++){const s=obs[k];if(s.k==='tree'){if((px-s.x)*(px-s.x)+(py-s.y)*(py-s.y)<20)hs=s}else if(px>s.x0&&px<s.x1&&py>s.y0&&py<s.y1)hs=s;if(hs)break}
   if(hs&&!(hs.k==='tree'&&Math.random()<.5)){stop=d;by=hs;break}}
  let ex,ey;
  if(stop>=0){ex=x+ca*stop;ey=y+sa*stop;
   if(by){if(by.k==='sandbag'){by.ref.hp-=dmg*.4;chipBurst(ex,ey,-ca,-sa,2,DIRT,60)}else if(by.k==='bunker'){by.ref.hp-=dmg*.25;sparkBurst(ex,ey,-ca,-sa,2)}else chipBurst(ex,ey,-ca,-sa,2,by.k==='tree'?BARK:STONE,60)}
   else dustPuff(ex,ey,1,2,10)}
  else{ex=x+ca*hitAlong;ey=y+sa*hitAlong;
   if(hitU){if(hitU.type==='tank'){damage(hitU,dmg*.04,team);sparkBurst(ex,ey,-ca,-sa,2)}
    else{const wd=window.PXW?PXW.depth(hitU.x,hitU.y):0;damage(hitU,dmg*(1-.25*hitAlong/range)*(wd>=.55?.4:1),team)}}}
  fxAdd({k:'frag',x0:x+ca*3,y0:y+sa*3,x1:ex,y1:ey,max:.07+Math.random()*.03})}}
/* cadáveres arremessados deslizam e vão perdendo velocidade */
function corpsePhysics(dt){for(let k=0;k<corpses.length;k++){const c=corpses[k];
 if(c.kx||c.ky){c.x=clamp(c.x+c.kx*dt,6,W-6);c.y=clamp(c.y+c.ky*dt,6,H-6);const f=Math.exp(-6*dt);c.kx*=f;c.ky*=f;if(Math.abs(c.kx)+Math.abs(c.ky)<2)c.kx=c.ky=0;
  if(!c.fl&&window.PXW&&PXW.depth(c.x,c.y)>=.4){c.fl=1;c.t=Math.min(c.t,55);c.dx=0;c.dy=0}}      // lançado dentro d'água: passa a boiar
 if(c.fl&&window.PXW){
  if(PXW.depth(c.x,c.y)<.2&&!inBridge(c.x,c.y)){c.fl=0}                                             // encalhou na margem
  else{
   if(!c.stuck){flowAt(c.x,c.y);c.x+=FLW.x*.7*dt;c.y+=FLW.y*.7*dt;if(pierPush(c,8)){c.dx=0;c.dy=0;c.stuck=1}}   // corpos não passam entre os pilares
   if(!c.hl){c.hl=1;if(Math.random()<.6)floatAdd('helmet',c.x+rnd(-6,6),c.y+rnd(-4,4),c.team)}}}}}
wrap('hud',orig=>{const r=orig();if(PH.on&&typeof mode!=='undefined'&&mode==='soldier'&&player&&player.pv&&player.pv.stun>0){const e=$('coverstatus');if(e)e.textContent='ATORDOADO'}return r});
PH.blast=(x,y,r,power,team)=>explode(x,y,r,power,team);

/* ======================================================================================
   PILAR 3 — blindados (Renault FT / A7V)
   3.1 lagartas com tração diferencial: o casco (pv.hdg) gira com aceleração angular limitada, o raio de giro cresce com a
       velocidade linear e o giro no próprio eixo é mais lento na lama; só anda para onde o casco aponta (sem "deslizar de lado");
       o canhão só dispara dentro do arco de tiro do casco (tp.arc) — fora dele o tanque se vira para o alvo
   3.2 esmagamento: arame (construído e pintado) e sacos de areia inimigos, árvores mortas finas na terra de ninguém
   3.3 coice do canhão (impulso para trás) e balanço da suspensão (amortecimento senoidal, declive e crateras)
   ====================================================================================== */
const TP=[{pivot:.62,arc:.95,aw:2.1,acc:1,brk:1},{pivot:.46,arc:.7,aw:1.5,acc:.82,brk:.9}],tp=u=>TP[u.team?1:0];
const FELLED=new Set(),WIRE={cells:new Map(),on:false},WCS=12,wkey=(x,y)=>Math.floor(x/WCS)*1000+Math.floor(y/WCS),wireAt=(x,y)=>WIRE.cells.has(wkey(x,y));
const circleBox=(cx,cy,R,x0,y0,x1,y1)=>{const px=clamp(cx,x0,x1),py=clamp(cy,y0,y1);return(cx-px)*(cx-px)+(cy-py)*(cy-py)<R*R};
function stepTank(u,pv,dt,i){
 const T=tp(u),ox=u._qx,oy=u._qy,dx=u.x-ox,dy=u.y-oy,lim=CFG.MAXV*dt,aimA=u.angle;
 if(!(pv.hdg===pv.hdg))pv.hdg=aimA||0;
 if(dx*dx+dy*dy>lim*lim){pv.vx=pv.vy=pv.kx=pv.ky=0;pv.sp=0;pv.w=0;pv.hdg=aimA||0;u.angle=pv.hdg;return}
 let vdx=dx/dt,vdy=dy/dt,vdm=hyp(vdx,vdy);const g=ground(u);pv.stun=0;
 unstick(u,pv,ox,oy,vdm>8);
 if(pv.path&&followPath(u,pv,vdm)){vdx=SV.x;vdy=SV.y;vdm=hyp(vdx,vdy)}
 if(vdm>3&&steerAround(pv,vdx,vdy)){vdx=SV.x;vdy=SV.y}
 /* rumo desejado: o do deslocamento; se há alvo fora do arco do canhão e o tiro está pronto (ou parado), vira para ele */
 let want=null;if(vdm>2)want=Math.atan2(vdy,vdx);
 const isP=u===player&&mode==='soldier',eng=isP?mouse.down:!!(u.target&&u.target.hp>0);
 if(eng&&Math.abs(angDiff(aimA,pv.hdg))>T.arc-.12&&(isP||u.cd<1.3||vdm<2))want=aimA;
 let spDes=vdm;
 if(want!==null){const err=angDiff(want,pv.hdg),moving=Math.abs(pv.sp)>6,
   wmax=T.pivot*(1-.55*Math.min(1,Math.abs(pv.sp)/30))*(1-.4*g.m)*(g.d>=.55?.45:g.d>=.25?.8:1)*(moving?1:1-.25*g.m),
   wdes=clamp(err*2.4,-wmax,wmax);
  pv.w+=clamp(wdes-pv.w,-T.aw*dt,T.aw*dt);
  const ae=Math.abs(angDiff(want,pv.hdg+pv.w*dt));spDes=ae<1.05?vdm*(.15+.85*(1-ae/1.05)):0}      // curva leve: segue devagar; mais de 60° fora: gira no lugar
 else pv.w*=Math.exp(-4*dt);
 pv.hdg=(pv.hdg+pv.w*dt)%TAU2;
 const c0=Math.cos(pv.hdg),s0=Math.sin(pv.hdg),slope=(heightAt(u.x+c0*26,u.y+s0*26)-heightAt(u.x-c0*26,u.y-s0*26))/(52*ZZ);
 spDes*=clamp(1-1.3*slope,.55,1.25);
 const sp0=pv.sp;pv.sp+=(spDes-pv.sp)*(1-Math.exp(-(spDes>pv.sp?g.acc*T.acc:g.brk*T.brk)*dt));
 pushOf(u,i);
 pv.vx=c0*pv.sp+SX[i]*.6;pv.vy=s0*pv.sp+SY[i]*.6;
 const kd=Math.exp(-g.kd*dt);pv.kx*=kd;pv.ky*=kd;
 CX=ox+(pv.vx+pv.kx)*dt;CY=oy+(pv.vy+pv.ky)*dt;
 collideSolids(CFG.RW.tank,pv,true);
 if(CN.hit&&pv.sp*(c0*CN.x+s0*CN.y)<0)pv.sp*=Math.exp(-4*dt);
 u.x=clamp(CX,20,W-20);u.y=clamp(CY,20,H-20);u.angle=pv.hdg;u.moving=Math.abs(pv.sp)>3||Math.abs(pv.w)>.12;
 /* suspensão: declive ao longo do casco (crateras, trincheiras), tranco de aceleração/frenagem e coice */
 pv.pt+=(clamp(slope*1.8,-1,1)-pv.pt)*Math.min(1,dt*6);
 pv.pa=(pv.pa||0)+(clamp((pv.sp-sp0)/dt/12,-1,1)*.45-(pv.pa||0))*Math.min(1,dt*10);
 if(Math.abs(pv.w)>.22&&Math.abs(pv.sp)<8&&Math.random()<dt*9)dustPuff(u.x-c0*14+rnd(-8,8),u.y-s0*14+rnd(-6,6)+6,1,5,16);   // esteira cavando no giro
 crush(u,pv,dt)}
const tiltOf=pv=>{let p=pv.pt+(pv.pa||0);const t=time-pv.pk;if(t>=0&&t<.3)p+=(pv.pkA||1)*Math.exp(-7*t)*Math.cos(TAU2*5*t)*.9;return clamp(p,-1.3,1.3)};
/* coice e balanço: só dispara dentro do arco do casco; o impulso sai para trás da mira */
wrap('shoot',(orig,u,target,manual)=>{
 if(!PH.on||u.type!=='tank')return orig(u,target,manual);
 let pv=null,a=0,blocked=false;
 try{pv=pvOf(u);a=manual?Math.atan2(mouse.wy-u.y,mouse.wx-u.x):Math.atan2(target.y-u.y,target.x-u.x);
  if(Math.abs(angDiff(a,pv.hdg))>tp(u).arc){if(manual)note('arc','Canhão fora do arco de tiro: o casco gira para o alvo antes de disparar.');blocked=true}}catch(e){fail(e)}
 if(blocked)return;
 orig(u,target,manual);
 try{if(pv){pv.kx-=Math.cos(a)*42;pv.ky-=Math.sin(a)*42;pv.pk=time;pv.pkA=1}}catch(e){fail(e)}});
/* esmagamento */
function crushFx(x,y,kind,u,pv){
 if(kind==='sand'){chipBurst(x,y,0,0,9,DIRT,110);dustPuff(x,y,4,5,22)}
 else{chipBurst(x,y,0,0,8,['#2b2e25','#6b5a40','#a8ae9c','#5b4a34'],110);dustPuff(x,y,3,4,18)}
 pv.pk=time;pv.pkA=.55;pv.sp*=.85;sfx('crunch',x,y);if(nearCam(x,y,500))screenShake=Math.max(screenShake,1.2)}
function crush(u,pv,dt){
 if(Math.abs(pv.sp)<3)return;
 const c=Math.cos(pv.hdg),s=Math.sin(pv.hdg),cx=u.x+c*12,cy=u.y+s*12,R=26;
 sQuery(cx-R-34,cy-R-14,cx+R+34,cy+R+14,st=>{
  if(st.k==='sandbag'){const b=st.ref;if(b.team===u.team||b.hp<=0)return false;
   if(circleBox(cx,cy,R,st.x0,st.y0,st.x1,st.y1)){b.crushT=(b.crushT||0)+dt;if(b.crushT>.3){b.hp=-1;crushFx(st.x,st.y,'sand',u,pv);note('sand','Tanque esmagou os sacos de areia.')}}}
  else if(st.k==='tree'&&st.ref.size<=14&&GND.bare&&onWW()&&PXO.WW1.zoneAt(st.x,st.y).id==='nml'&&hyp(st.x-cx,st.y-cy)<R)fellTree(st.ref,u,pv);
  return false});
 for(let i=0;i<buildings.length;i++){const b=buildings[i];if(b.type!=='wire'||b.team===u.team||b.hp<=0)continue;
  if(Math.abs(b.x-cx)<40+R*.5&&Math.abs(b.y-cy)<22+R*.5){b.hp=-1;crushFx(b.x,b.y,'wire',u,pv);note('wire','Tanque amassou o arame farpado.')}}
 if(WIRE.on)crushPainted(cx,cy,R,u,pv)}
/* arame pintado no terreno: detectado pela cor dos fios (ww1-props.js) e tratado como obstáculo até um tanque abrir a brecha */
function scanWire(){
 WIRE.cells.clear();WIRE.on=false;const base=window.PXGAME&&PXGAME.base,WW=PXO.WW1;
 if(!base||!base.canvas||!WW||typeof map==='undefined'||map!=='trenches')return;
 let img;try{img=base.canvas.getContext('2d').getImageData(0,0,base.canvas.width,base.canvas.height)}catch(e){return}
 const w=img.width,d=img.data,Lay=WW.layout(),cnt=new Map();
 for(let y=0;y<img.height;y++){const xf=WW.xAt(Lay.P.front,clamp(y,4,796));
  for(let side=0;side<2;side++){const a=Math.max(0,Math.floor(side?w-(xf+58):xf+22)),b=Math.min(w-1,Math.ceil(side?w-(xf+22):xf+58));
   for(let x=a;x<=b;x++){const i=(y*w+x)*4;if(!d[i+3])continue;const r=d[i],g=d[i+1],bl=d[i+2];
    if((r===0x24&&g===0x27&&bl===0x1f)||(r===0x2b&&g===0x2e&&bl===0x25)||(r===0x1d&&g===0x20&&bl===0x19)){const k=wkey(x/ZZ,y/ZZ);cnt.set(k,(cnt.get(k)||0)+1)}}}}
 for(const[k,n]of cnt)if(n>=3)WIRE.cells.set(k,n);
 WIRE.on=WIRE.cells.size>0}
function breachPatch(gx,gy){const g=window.PXGAME&&PXGAME.tctx;if(!g||!GND.bare)return;const ax=Math.floor(gx*WCS*ZZ)-1,ay=Math.floor(gy*WCS*ZZ)-1,s=8;
 g.drawImage(GND.bare,ax,ay,s,s,ax,ay,s,s);
 for(let i=0;i<8;i++){g.fillStyle=Math.random()<.6?'rgba(26,18,10,.62)':'rgba(84,66,44,.72)';g.fillRect(ax+((Math.random()*s)|0),ay+((Math.random()*s)|0),1+(Math.random()<.3),1)}
 if(Math.random()<.6){g.fillStyle='#2b2e25';g.fillRect(ax+((Math.random()*6)|0),ay+((Math.random()*6)|0),2,1)}}
function crushPainted(cx,cy,R,u,pv){let n=0;
 for(let gx=Math.floor((cx-R)/WCS);gx<=Math.floor((cx+R)/WCS);gx++)for(let gy=Math.floor((cy-R)/WCS);gy<=Math.floor((cy+R)/WCS);gy++){
  const k=gx*1000+gy;if(!WIRE.cells.has(k))continue;if(hyp(gx*WCS+WCS/2-cx,gy*WCS+WCS/2-cy)>R+4)continue;WIRE.cells.delete(k);breachPatch(gx,gy);n++}
 if(n){crushFx(cx,cy,'wire',u,pv);note('breach','Arame farpado rompido pelo tanque: brecha aberta para a infantaria.')}}
/* árvore morta fina: cai para longe do tanque; some da cobertura e da pintura (chão limpo por cima) e vira tronco caído */
function fellTree(d,u,pv){
 if(FELLED.has(d))return;FELLED.add(d);const i=decor.indexOf(d);if(i>=0)decor.splice(i,1);sigLast='';if(typeof indexTerrainCover==='function')indexTerrainCover();
 const a=Math.atan2(d.y-u.y,d.x-u.x),g=window.PXGAME&&PXGAME.tctx;
 if(g&&GND.bare){const bx=Math.round(d.x*ZZ),by=Math.round(d.y*ZZ),L=15+((Math.random()*7)|0),ca=Math.cos(a),sa=Math.sin(a);
  g.drawImage(GND.bare,bx-15,by-33,34,42,bx-15,by-33,34,42);
  for(let t=0;t<L;t++){const px=Math.round(bx+ca*t),py=Math.round(by+sa*t*.8);g.fillStyle=t%3?'#4a3b2c':'#2b2219';g.fillRect(px,py,2,2);g.fillStyle='#6b5a45';g.fillRect(px,py-1,1,1)}
  for(let k=0;k<3;k++){const t=3+k*4,px=Math.round(bx+ca*t),py=Math.round(by+sa*t*.8),s=k%2?1:-1;g.fillStyle='#4a3b2c';g.fillRect(px+s*2,py-2,1,1);g.fillRect(px+s*3,py-3,1,1)}
  g.fillStyle='#2a2118';g.fillRect(bx-3,by-1,7,3);g.fillStyle='#6b5a45';g.fillRect(bx-2,by-2,3,1)}
 chipBurst(d.x,d.y,Math.cos(a),Math.sin(a),10,BARK,120);dustPuff(d.x,d.y,5,6,24);
 pv.pk=time;pv.pkA=.6;pv.sp*=.85;sfx('crunch',d.x,d.y);note('tree','Tanque derrubou uma árvore morta.')}
/* desenho: balanço da suspensão (casco fatiado ao meio) e soldado caído pela onda de choque */
function drawUnit(c,u,sp,sx,sy,vis,bob){
 if(!PH.on||u.hp<=0)return false;const pv=u.pv;if(!pv)return false;
 if(u.type==='tank'){const amp=Math.round(clamp(tiltOf(pv),-1.3,1.3)*1.6);if(!amp)return false;
  const cs=Math.cos(pv.hdg),sn=Math.sin(pv.hdg),w=sp.c.width,x0=sx-sp.ax,y0=sy-sp.ay+bob;
  if(Math.abs(cs)>=Math.abs(sn)){const cut=sp.ax,fr=cs>0;                       // focinho sobe (amp>0): a metade da frente sobe e a traseira desce
   c.drawImage(sp.c,0,0,cut,vis,x0,y0+(fr?amp:-amp),cut,vis);c.drawImage(sp.c,cut,0,w-cut,vis,x0+cut,y0+(fr?-amp:amp),w-cut,vis)}
  else c.drawImage(sp.c,0,0,w,vis,x0,y0+Math.round(sn*amp*.6),w,vis);
  return true}
 if(pv.stun>.05&&u.type!=='cavalry'&&!(window.PXW&&PXW.depth(u.x,u.y)>=.25)){
  const cs=PXO.corpseSprite(u.team,PXO.dir8(u.angle||0),((u.id*5+u.team*3)&3));c.drawImage(cs.c,sx-cs.ax,sy-cs.ay+1);
  if(pv.stun>.25){const a=time*9;c.fillStyle='#fff3c2';c.fillRect(Math.round(sx+Math.cos(a)*4),Math.round(sy-8+Math.sin(a)*1.5),1,1);c.fillRect(Math.round(sx-Math.cos(a)*4),Math.round(sy-8-Math.sin(a)*1.5),1,1)}
  return true}
 return false}
/* o desenho roda dentro do render do pixel.js: uma exceção aqui pararia o laço de animação, então nunca propaga */
PH.draw=function(c,u,sp,sx,sy,vis,bob){try{return drawUnit(c,u,sp,sx,sy,vis,bob)}catch(e){fail(e);return false}};

/* ======================================================================================
   PILAR 5 — água
   correnteza: o rio corre do norte para o sul (mais forte no meio do leito, seguindo as curvas) e arrasta cadáveres, capacetes caídos e
   madeira até encalharem nas margens ou nos pilares das pontes; quem nada é levado devagar. Detonação na água: coluna d'água,
   borrifos (e lama nas margens) no lugar da bola de fogo, menos dano radial e onda hidrostática contra quem está submerso.
   ====================================================================================== */
const FLOW_V=20,FL=[],PIERS=[],BRIDGES=[],FLW={x:0,y:0};
/* sob o tabuleiro o mapa marca "seco" (a ponte cobre o leito), mas a água passa por baixo: lá os objetos continuam flutuando até os pilares */
function inBridge(x,y){for(let i=0;i<BRIDGES.length;i++){const b=BRIDGES[i];if(y>b.y-46&&y<b.y+46){const ay=y*ZZ;return Math.abs(x-PXO.riverX(ay)/ZZ)<PXO.riverHW(ay)/ZZ*1.05}}return false}
function flowAt(x,y){FLW.x=FLW.y=0;if(!window.PXW||(PXW.depth(x,y)<.25&&!inBridge(x,y)))return FLW;
 const ay=y*ZZ,xc=PXO.riverX(ay)/ZZ,hw=PXO.riverHW(ay)/ZZ,r=Math.abs(x-xc)/hw;if(r>1.25)return FLW;          // poças e crateras alagadas não correm
 const q=Math.min(1,r),f=FLOW_V*(.3+.7*(1-q*q)),dxdy=(PXO.riverX(ay+4)-PXO.riverX(ay-4))/8,l=Math.hypot(dxdy,1);FLW.x=dxdy/l*f;FLW.y=f/l;return FLW}
function buildPiers(){PIERS.length=0;BRIDGES.length=0;if(!PXO.ROADS||!PXO.riverX)return;
 for(const yy of PXO.ROADS){const bx=PXO.riverX(yy)/ZZ,by=yy/ZZ;BRIDGES.push({x:bx,y:by});
  for(const off of[-48,-36,-24,-12,12,24,36,48]){PIERS.push({x:bx+off/ZZ,y:by-33,r:4});PIERS.push({x:bx+off/ZZ,y:by+31,r:4})}}}
function floatAdd(k,x,y,team){if(FL.length<120)FL.push({k,x,y,vx:rnd(-5,5),vy:rnd(-5,5),team:team?1:0,ph:Math.random()*6.283,age:0,r:k==='helmet'?3:4,cf:k==='helmet'?1:.9})}
function pierPush(o,rad){for(let i=0;i<PIERS.length;i++){const p=PIERS[i],dx=o.x-p.x;if(dx>30||dx<-30)continue;const dy=o.y-p.y,rr=p.r+rad;
 if(dx*dx+dy*dy<rr*rr){const d=Math.sqrt(dx*dx+dy*dy)||1;o.x=p.x+dx/d*rr;o.y=p.y+dy/d*rr;return true}}return false}
function floatStep(dt){
 for(let i=FL.length-1;i>=0;i--){const f=FL[i];f.age+=dt;
  if(f.stuck){if(f.age>220)FL.splice(i,1);continue}                                          // preso num pilar
  if(PXW.depth(f.x,f.y)<.2&&!inBridge(f.x,f.y)){f.beach=(f.beach||0)+dt;f.vx*=.8;f.vy*=.8;if(f.beach>120||f.age>220)FL.splice(i,1);continue}
  flowAt(f.x,f.y);const k=Math.min(1,dt*1.3);f.vx+=(FLW.x*f.cf-f.vx)*k+rnd(-1,1)*dt*5;f.vy+=(FLW.y*f.cf-f.vy)*k;
  f.x+=f.vx*dt;f.y+=f.vy*dt;if(pierPush(f,f.r+1.5)){f.vx*=.2;f.vy*=.05;f.snag=1;if(Math.random()<.65)f.stuck=1}   // bate no pilar: 65% fica preso, o resto escorrega pelo vão
  if(f.age>220)FL.splice(i,1)}}
function floatDraw(ox,oy){if(!FL.length)return;
 for(let i=0;i<FL.length;i++){const f=FL[i],x=ox+Math.round(f.x*ZZ),y=oy+Math.round(f.y*ZZ);if(x<-8||y<-8||x>vw+8||y>vh+8)continue;
  const bob=f.beach?0:Math.round(Math.sin(time*2.3+f.ph)*.6);ctx.globalAlpha=.38;ctx.fillStyle='#16221f';ctx.fillRect(x-1,y+2+bob,5,1);ctx.globalAlpha=1;
  if(f.k==='helmet'){const c=f.team?['#585f66','#7e868e','#3b4146']:['#5b6238','#838c55','#3f4527'];ctx.fillStyle=c[0];ctx.fillRect(x-2,y-1+bob,5,2);ctx.fillStyle=c[1];ctx.fillRect(x-1,y-2+bob,3,1);ctx.fillStyle=c[2];ctx.fillRect(x-2,y+1+bob,5,1);
   if(f.team)ctx.fillRect(x-3,y+bob,1,2);else{ctx.fillRect(x-3,y+bob,1,1);ctx.fillRect(x+3,y+bob,1,1)}}
  else{const v=f.ph>3.14;ctx.fillStyle='#6b5640';if(v){ctx.fillRect(x,y-3+bob,2,6);ctx.fillStyle='#8a7652';ctx.fillRect(x,y-3+bob,1,6)}else{ctx.fillRect(x-3,y+bob,7,2);ctx.fillStyle='#8a7652';ctx.fillRect(x-3,y+bob,7,1);ctx.fillStyle='#3a2c1c';ctx.fillRect(x+3,y+1+bob,1,1)}}}
 ctx.globalAlpha=1}
if(window.PXW&&PXW.under){const o=PXW.under;PXW.under=function(ox,oy,fdt){const r=o.apply(this,arguments);try{if(PH.on)floatDraw(ox,oy)}catch(e){fail(e)}return r}}
function drawWaterColumn(c,p,x,y,k){
 const up=k<.3?k/.3:1,down=k>.5?(k-.5)/.5:0,h=Math.round(p.h*up*(1-down*.9)),w=p.w*(k<.3?.55+.45*k/.3:1-.3*down);if(h<1)return;
 c.globalAlpha=1-down*.55;
 for(let j=0;j<h;j+=2){const t=j/h,ww=Math.max(2,Math.round(w*(1-t*.5))),jit=((j*7+Math.floor(time*24))%3)-1;
  c.fillStyle=t<.3?'#cfe3e3':t<.75?'#e9f3f2':'#ffffff';c.fillRect(x-(ww>>1)+jit,y-j,ww,2);
  c.fillStyle='#8fb0b3';c.fillRect(x-(ww>>1)+jit,y-j,1,2);c.fillRect(x+(ww>>1)+jit-1,y-j,1,2)}
 c.fillStyle='#ffffff';c.fillRect(x-2,y-h-1,5,2);c.fillRect(x-1,y-h-2,3,1);c.globalAlpha=1}
function splashSmall(x,y){fxAdd({k:'ring',x,y,max:.5,r:16,a:.6});for(let i=0;i<4;i++)fxAdd({k:'drop',x,y,vx:rnd(-18,18),vy:rnd(-18,18),z:1,vz:rnd(40,90),max:.6,col:'#dcebea'})}
function waterBlast(x,y,r,power,team){
 fxAdd({k:'wcol',x,y,max:.95,h:Math.round(18+r*.42),w:Math.round(5+r*.16)});
 for(let i=0;i<3;i++)fxAdd({k:'ring',x,y,t:-i*.09,max:.75+i*.08,r:r*(1.05+i*.12),a:.7-i*.15,col:i?'#c9dcdc':'#eaf3f3'});
 const big=clamp(r/65,.6,1.6),nd=Math.round(14+r*.35);
 for(let i=0;i<nd;i++){const a=rnd(0,TAU2),s=rnd(25,115);fxAdd({k:'drop',x:x+Math.cos(a)*rnd(0,r*.25),y:y+Math.sin(a)*rnd(0,r*.25),vx:Math.cos(a)*s*.5,vy:Math.sin(a)*s*.5,z:rnd(2,8),vz:rnd(60,190)*big,max:rnd(.5,1.2),col:Math.random()<.3?'#ffffff':'#dcebea'})}
 if(PXW.depth(x,y)<.6)chipBurst(x,y,0,0,12,['#4a3c28','#6b583a','#8a7652'],140);                      // fundo raso: lama junto com a água
 sfx('splash',x,y,1000);
 for(const u of units){if(u.hp<=0||u.type==='tank')continue;const d=hyp(u.x-x,u.y-y);if(d>=r*1.1)continue;const wd=PXW.depth(u.x,u.y);if(wd<.25)continue;
  const f=1-d/(r*1.1),k=wd>=.55?1:.4;damage(u,power*.75*f*k,team);const pv=pvOf(u);pv.stun=Math.max(pv.stun,rnd(.7,1.3)*k*(.6+f))}   // onda de choque hidrostática
 const nw=2+((Math.random()*3)|0);for(let i=0;i<nw;i++)floatAdd('wood',x+rnd(-r*.4,r*.4),y+rnd(-r*.4,r*.4),team)}
/* explosão perto de uma ponte: tábuas caem no rio */
function plankBurst(x,y){for(const b of BRIDGES)if(Math.abs(x-b.x)<110&&Math.abs(y-b.y)<72){const n=3+((Math.random()*4)|0);for(let i=0;i<n;i++)floatAdd('wood',b.x+rnd(-28,28),b.y-50+rnd(-6,6),0);return}}
/* bala que morre na água levanta um esguicho */
function preWater(dt){for(let i=0;i<bullets.length;i++){const b=bullets[i];if(b.damage&&b.t-dt<=0&&b.t>0&&Math.random()<.5&&isWet(b.x,b.y)&&nearCam(b.x,b.y,700))splashSmall(b.x,b.y)}}

function post2(dt){fxStep(dt);grenadePhysics(dt);corpsePhysics(dt);floatStep(dt)}
function resetFase2(){FX.length=0;PEND.length=0;FL.length=0;buildPiers();FELLED.clear();decor=decor.slice();      // cópia própria: derrubar uma árvore não altera o terreno em cache
 for(const t of fieldTrenches)if(t.ax===undefined||t.bw===undefined){annotateTrenches();break}trenchRebuild();try{scanWire()}catch(e){console.warn('physics.js: arame pintado',e)}}
try{resetAll();setTimeout(ensureGround,900)}catch(e){fail(e)}
})();
