'use strict';
/* Iron Front — refino de animações: EFEITOS (anim-fx.js). Carrega no fim (depois do heavyfx.js); não edita nenhum outro arquivo.
   Explosões em várias etapas: clarão (quadro branco + luz no chão), bola de fogo com núcleo escuro e borda acesa (sprites com
   lóbulos tipo couve-flor e luz de cima-esquerda), coluna de fumaça que sobe, engorda e é arrastada pelo vento (cisalhamento:
   quanto mais alto, mais vento), anel de choque rente ao chão + anel de poeira, cortina de terra (pluma marrom que sobe e cai),
   torrões em arco balístico com sombra, quique e repouso no chão, faíscas de estilhaço, brasas e fumaça residual na cratera.
   Variantes: granada (seca, curta, fumaça preta), morteiro, 75 mm, 155 mm (coluna alta, clarão de tela), bomba de avião e
   lama (gêiser negro de lama no lugar do fogo, respingos que grudam). Água fica com o physics.js (coluna d'água).
   Também: shrapnel no ar (nuvem branca + cone de balins caindo e levantando poeira), cortina de fumaça volumosa ao vento,
   sopro de boca das baterias (anel de vórtice, nuvem dirigida, poeira na frente), fumacinha dos fuzis à deriva, impacto de
   bala no chão (jato de terra / respingo de lama), chamas animadas nas fogueiras e no depósito destruído, respingos de chuva.
   Ganchos: envolve explode / update / shoot / setup, PXBAT.detonate, PHYS.skipBlastFx (o pixel.js não desenha o blast que
   esta camada redesenha; a cratera pintada é re-carimbada aqui), WW1A.under (chão) e PLN.under (ar: depois das tropas, antes
   dos aviões). Simulação no update (pausa junto com o jogo); desenho só desenha. Pool fixo em arrays tipados (sem alocação
   por quadro), sprites pontilhados em cache, pixels inteiros. ?animfx=0 desliga; 12 erros desligam e devolvem o padrão. */
(function(){
if(!window.PX||!window.PXGAME)return;
const Z=PX.Z||.5,TAU=Math.PI*2,{mk,g2,hex2rgb,ring:pring,pline}=PX,hyp=Math.hypot;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v,RD=Math.round;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('anim-fx.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const S=window.PXFX={on:!/[?&]animfx=0/.test(location.search),version:'1.0',
 stats:{blasts:0,mud:0,airbursts:0,smokeShells:0,muzzles:0,impacts:0,craters:0,passed:0,duds:0,errors:0,dropped:0},
 cost:{upd:0,draw:0,peakUpd:0,peakDraw:0}};
let errs=0;function fail(e){S.stats.errors++;if(++errs<=3)console.error('anim-fx.js:',e);if(errs>=12&&S.on){S.on=false;reset();console.error('anim-fx.js desligado após erros repetidos (efeitos voltam ao padrão)')}}

/* ---------- ruído e cores ---------- */
function h2(x,y,s){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296}
function vn(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=h2(xi,yi,s),b=h2(xi+1,yi,s),c=h2(xi,yi+1,s),d=h2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16),bay=(i,j)=>BAY[(j&3)*4+(i&3)];
const pk=c=>{const[r,g,b]=hex2rgb(c);return((255<<24)|(b<<16)|(g<<8)|r)>>>0};
/* rampas de 4 tons (sombra → luz): 0 fumaça de HE · 1 fumaça cinza/pólvora · 2 shrapnel branco · 3 cortina de fumaça ·
   4 pluma de terra · 5 lama negra · 6 poeira · 7 fumaça acesa pelo fogo · 8 poeira na neve */
const RAMP=[['#262421','#36322d','#4b463f','#68625a'],['#57534c','#726e65','#8f8a7f','#aaa597'],['#8f8c82','#b9b6aa','#dad8cc','#f3f1e6'],
 ['#a3a59d','#c6c8c1','#e0e1db','#f3f4ef'],['#2c2219','#433427','#5e4a35','#7d6849'],['#120e0a','#1f1811','#2e241a','#4a3c2b'],
 ['#7c6a4c','#988560','#b1a07c','#c8b893'],['#3b2116','#5c2f1a','#87451f','#b8692a'],['#a9b7ba','#c9d4d5','#e2eaea','#f6fafa']].map(r=>r.map(pk));
const FIRE=['#3a120a','#6b1f10','#a3341a','#d8571f','#f08a2a','#f5b443','#ffe08a','#fff6d2','#ffffff'].map(pk);
const DIRT=['#2a2219','#3d3123','#4f4030','#62503a','#7a6548','#937c58','#ad9670'],DIRT_HI='#c4ae84',SNOWD=['#dfe8e8','#c9d4d4','#f2f6f6'];
const MUDC=['#15100b','#21190f','#2e2316','#3d2f1f'],MUD_HI='#6f5d45';

/* ---------- sprites em cache (ImageData, pixels exatos) ---------- */
function canvasFrom(w,h,fill){const c=mk(w,h),x=g2(c),img=x.createImageData(w,h),d=new Uint32Array(img.data.buffer);fill(d,w,h);x.putImageData(img,0,0);return c}
/* lóbulos (couve-flor): um central e 4–5 em volta; cada pixel pega o lóbulo mais "alto" e é sombreado pela normal dele */
const LOBES=[0,1,2].map(v=>{const L=[{x:0,y:0,r:1}];const n=4+(v%2);for(let i=0;i<n;i++){const a=(i+h2(v,i,7)*.6)/n*TAU+v;L.push({x:Math.cos(a)*.42,y:Math.sin(a)*.42-.06,r:.5+h2(v,i,3)*.16})}return L});
function lobeAt(L,dx,dy,o){let best=-1,lx=0,ly=0;for(const l of L){const ex=(dx-l.x)/l.r,ey=(dy-l.y)/l.r,d2=ex*ex+ey*ey;if(d2>=1)continue;const hgt=Math.sqrt(1-d2)*l.r+(l===L[0]?.0:.08);if(hgt>best){best=hgt;lx=ex;ly=ey}}o.h=best;o.x=lx;o.y=ly;return best>=0}
const LO={h:0,x:0,y:0},PUFF=new Map(),RB=r=>r<=12?Math.max(1,RD(r)):r<=24?RD(r/2)*2:Math.min(56,RD(r/4)*4);
function puffSprite(rp,r,v){const key=(rp*64+r)*4+v;let c=PUFF.get(key);if(c)return c;const R=r+1,s=R*2+1,L=LOBES[v],ramp=RAMP[rp];
 c=canvasFrom(s,s,(d,w)=>{for(let j=0;j<s;j++)for(let i=0;i<s;i++){const dx=(i-R)/(r+.5),dy=(j-R)/(r+.5);if(!lobeAt(L,dx,dy,LO))continue;
  const dd=Math.sqrt(dx*dx+dy*dy),edge=LO.h<.22?LO.h/.22:1;if(r>2&&bay(i,j)>edge*1.05)continue;   // borda pontilhada (macia)
  const nz=Math.sqrt(Math.max(0,1-LO.x*LO.x-LO.y*LO.y)),l=-.55*LO.x-.7*LO.y+.45*nz+(vn(i*.45,j*.45,v*11+r)-.5)*.5-dd*.25;
  const k=clamp(Math.floor((l+.55)/1.25*4+bay(i+1,j)-.5),0,3);d[j*w+i]=ramp[k]}});
 c={c,a:R};PUFF.set(key,c);return c}
/* bola de fogo: 6 fases; a fuligem cobre o miolo e o fogo sobra na borda e embaixo (núcleo escuro, borda acesa) */
const FB=new Map(),SOOT=[-.6,-.25,.15,.45,.75,1.05],HEAT=[8.6,7.6,6.6,5.8,4.6,3.4];
function fireSprite(r,ph,v){const key=(r*8+ph)*4+v;let c=FB.get(key);if(c)return c;const R=r+1,s=R*2+1,L=LOBES[v];
 c=canvasFrom(s,s,(d,w)=>{for(let j=0;j<s;j++)for(let i=0;i<s;i++){const dx=(i-R)/(r+.5),dy=(j-R)/(r+.5)*.92;if(!lobeAt(L,dx,dy,LO))continue;
  const fq=3.2/(r+2),dd=Math.sqrt(dx*dx+dy*dy),n=vn(i*fq*1.6+v*7,j*fq*1.6,31+ph),n2=vn(i*fq*2.6,j*fq*2.6,77+v);if(r>3&&LO.h<.18&&bay(i,j)>LO.h/.18)continue;
  const lit=-.5*LO.x-.6*LO.y,soot=SOOT[ph]+(1-dd)*.55-(dy>0?dy*.35:0)+(n-.5)*.9-lit*.25;   // fuligem no miolo e no alto, fogo na borda de baixo
  if(soot>.5){const nz=Math.sqrt(Math.max(0,1-LO.x*LO.x-LO.y*LO.y)),l=lit+.4*nz+(n2-.5)*.5;d[j*w+i]=RAMP[ph>=4?0:7][clamp(Math.floor((l+.5)*2.6+bay(i,j)-.5),0,3)];continue}
  const t=HEAT[ph]-dd*(ph<2?2.6:1.6)+(n2-.5)*1.6+lit*.8+(.5-soot)*.8;d[j*w+i]=FIRE[clamp(Math.floor(t+bay(i,j)-.5),0,8)]}});
 c={c,a:R};FB.set(key,c);return c}
/* clarão: núcleo branco, coroa amarela e 8 raios curtos */
const FL_=new Map();function flashSprite(r,soft){const key=r*2+(soft?1:0);let c=FL_.get(key);if(c)return c;const L=Math.ceil(r*1.7),s=L*2+1;
 c=canvasFrom(s,s,(d,w)=>{for(let j=0;j<s;j++)for(let i=0;i<s;i++){const dx=i-L,dy=(j-L)*1.15,dd=Math.sqrt(dx*dx+dy*dy)/r,a=Math.atan2(dy,dx),ray=Math.pow(Math.abs(Math.cos(a*4+.4)),18)*(.9+.4*h2(Math.floor((a+4)*4/Math.PI*2),0,5));
  let t=dd<.45?8:dd<.75?7:dd<1?6:!soft&&dd<1.7&&ray>(dd-1)*1.3+.05?(dd<1.3?6:5):-1;if(t<0)continue;if(dd>.75&&dd<1&&bay(i,j)>.7)t=5;d[j*w+i]=FIRE[t]}});
 c={c,a:L};FL_.set(key,c);return c}
/* luz no chão: elipse pontilhada quente (25–50%) */
const GL=new Map();function glowSprite(r,col){const key=r*8+col;let c=GL.get(key);if(c)return c;const ry=Math.max(1,RD(r*.55)),w=r*2+1,h=ry*2+1,[cr,cg,cb]=hex2rgb(['#ffd27a','#ff9b32','#ffe9b0'][col]);
 c=canvasFrom(w,h,(d)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++){const dx=(i-r)/r,dy=(j-ry)/ry,dd=dx*dx+dy*dy;if(dd>1)continue;const a=dd<.16?120:dd<.45?78:44;d[j*w+i]=((a<<24)|(cb<<16)|(cg<<8)|cr)>>>0}});
 c={c,ax:r,ay:ry};GL.set(key,c);return c}
/* anel de choque: 3 elipses (frente clara, miolo, sombra) com alfa embutido, raio em degraus de 2 px */
const RG=new Map();function ringSprite(rx,v){rx=rx<8?rx:rx&~1;const key=rx*4+v;let c=RG.get(key);if(c)return c;const ry=Math.max(1,RD(rx*.45)),w=rx*2+5,h=ry*2+6,cv=mk(w,h),x=g2(cv),ox=rx+2,oy=ry+2;
 const C=[['#cdbd92','#a89870','#5b4a36'],['#2e241a','#4a3c2b','#1a140e'],['#f2f6f6','#c9d4d4','#8fa0a2']][v];
 x.globalAlpha=.4;pring(x,ox,oy,Math.max(1,rx-2),Math.max(1,ry-1),C[1]);if(rx>6){x.globalAlpha=.3;pring(x,ox,oy+1,rx+1,ry+1,C[2])}x.globalAlpha=.75;pring(x,ox,oy,rx,ry,C[0]);
 c={c:cv,ax:ox,ay:oy};RG.set(key,c);return c}
/* chamas: 8 quadros por tamanho; ruído que sobe; base larga, línguas que se separam no alto */
const FLM=new Map();function flameFrames(big){const k=big?1:0;let f=FLM.get(k);if(f)return f;const w=big?13:9,h=big?20:13;f=[];
 for(let fr=0;fr<8;fr++)f.push(canvasFrom(w,h,(d)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++){const y=1-j/(h-1),x=(i-(w-1)/2)/((w-1)/2),n=vn(i*.55,j*.42+fr*1.1,big?5:9),n2=vn(i*.3+fr*.4,j*.25+fr*.8,13);
  const wid=(1-y*.82)*(.75+.35*n2),core=1-Math.abs(x)/Math.max(.05,wid),T=core*1.15+(n-.5)*1.1-y*1.05+.35;if(T<.05)continue;
  d[j*w+i]=FIRE[clamp(Math.floor(T*6.2+bay(i,j)-.2),1,8)]}}));
 FLM.set(k,f);return f}

/* ---------- pool de partículas (arrays tipados; compactação estável) ---------- */
const N=1500,K=new Uint8Array(N),RP=new Uint8Array(N),FG=new Uint8Array(N),SD=new Uint8Array(N);
const X=new Float32Array(N),Y=new Float32Array(N),ZH=new Float32Array(N),VX=new Float32Array(N),VY=new Float32Array(N),VZ=new Float32Array(N),
 T=new Float32Array(N),MX=new Float32Array(N),S0=new Float32Array(N),S1=new Float32Array(N),DR=new Float32Array(N),GV=new Float32Array(N),WK=new Float32Array(N),AL=new Float32Array(N);
let n=0;
const P_PUFF=1,P_DUST=2,P_CLOD=3,P_LAND=4,P_SPARK=5,P_EMBER=6,P_PELLET=7,P_MUD=8,P_SPLAT=9,P_DROP=10,P_RIP=11,P_SCREEN=12,P_WISP=13;
const F_BOUNCE=1,F_LIT=2,F_FADEIN=4,F_DUSTKICK=8;
const cnt=new Uint16Array(16);
/* orçamento: as bolas de fumaça são o que custa no desenho (drawImage grande); acima do teto, as novas são descartadas */
const CAPK=new Uint16Array(16).fill(65535);CAPK[1]=200;CAPK[13]=60;CAPK[12]=150;CAPK[4]=220;CAPK[2]=140;
function add(k,x,y,z,vx,vy,vz,life,s0,s1,rp,drag,grav,wind,al,fl){if(n>=N||cnt[k]>=CAPK[k]){S.stats.dropped++;return-1}const i=n++;K[i]=k;X[i]=x;Y[i]=y;ZH[i]=z;VX[i]=vx;VY[i]=vy;VZ[i]=vz;T[i]=0;MX[i]=life;S0[i]=s0;S1[i]=s1;RP[i]=rp;DR[i]=drag;GV[i]=grav;WK[i]=wind;AL[i]=al;FG[i]=fl|0;SD[i]=(Math.random()*255)|0;cnt[k]++;return i}
function kill(i){T[i]=MX[i]+1}
function copy(a,b){K[a]=K[b];RP[a]=RP[b];FG[a]=FG[b];SD[a]=SD[b];X[a]=X[b];Y[a]=Y[b];ZH[a]=ZH[b];VX[a]=VX[b];VY[a]=VY[b];VZ[a]=VZ[b];T[a]=T[b];MX[a]=MX[b];S0[a]=S0[b];S1[a]=S1[b];DR[a]=DR[b];GV[a]=GV[b];WK[a]=WK[b];AL[a]=AL[b]}
/* eventos (bola de fogo, clarão, anel, luz, brasas na cratera, emissores): poucos objetos, criados só na detonação */
let EV=[],craters=0;
function reset(){n=0;cnt.fill(0);EV=[];craters=0;FIRES=null}
const lod=()=>{const p=cnt[1]/200,f=n/N,m=Math.max(p,f);return m>.85?.35:m>.65?.55:m>.45?.75:1};
const snowy=()=>!!(window.PXW&&PXW.state&&PXW.state.snow);
function wind(){const w=window.PXW&&PXW.windVec?PXW.windVec():null;WX=w?w.x*Z:3;WY=w?w.y*Z:0}
let WX=3,WY=0;

/* ---------- câmera (px de arte) ---------- */
const camOX=()=>RD(vw/2-cam.x*Z),camOY=()=>RD(vh/2-cam.y*Z);
function viewDist(ax,ay){const sx=ax+camOX(),sy=ay+camOY(),dx=sx<0?-sx:sx>vw?sx-vw:0,dy=sy<0?-sy:sy>vh?sy-vh:0;return Math.max(dx,dy)}

/* ---------- perfis de explosão (R = raio do jogo em px de arte) ---------- */
const PROF={
 gren: {fb:.3,fbd:.2,fl:.42,clod:16,cv:[40,95],ch:[18,60],plume:7,pv:[30,60],col:0,cold:0,smoke:7,ss:[3,8],sl:[1.6,2.6],ring:1.05,rd:.2,dust:9,spark:10,ember:3,glow:1.4,wisp:2},
 small:{fb:.3,fbd:.26,fl:.42,clod:24,cv:[50,110],ch:[16,55],plume:12,pv:[45,85],col:16,cold:.45,smoke:3,ss:[4,10],sl:[2.4,3.6],ring:1.2,rd:.26,dust:11,spark:10,ember:4,glow:1.5,wisp:5},
 med:  {fb:.32,fbd:.32,fl:.44,clod:34,cv:[60,130],ch:[16,60],plume:18,pv:[65,125],col:24,cold:.6,smoke:4,ss:[5,13],sl:[3,4.6],ring:1.3,rd:.3,dust:15,spark:12,ember:6,glow:1.6,wisp:8},
 big:  {fb:.34,fbd:.42,fl:.46,clod:50,cv:[80,170],ch:[16,65],plume:26,pv:[90,165],col:42,cold:1.1,smoke:6,ss:[7,18],sl:[5,7.5],ring:1.45,rd:.36,dust:20,spark:16,ember:10,glow:1.8,wisp:12,flashScr:1},
 bomb: {fb:.36,fbd:.42,fl:.5,clod:56,cv:[75,160],ch:[22,80],plume:30,pv:[80,150],col:40,cold:1,smoke:8,ss:[7,18],sl:[5,7.5],ring:1.6,rd:.4,dust:24,spark:14,ember:10,glow:1.9,wisp:12,flashScr:1},
 mud:  {fb:0,fbd:.12,fl:.26,clod:0,mudc:40,cv:[70,160],ch:[8,40],plume:0,mudp:16,pv:[100,190],col:0,smoke:2,ss:[3,7],sl:[1.6,2.6],ring:1,rd:.26,dust:0,spark:2,ember:0,glow:.9,wisp:3}};
function blast(ax,ay,R,type,shell){const P=PROF[type]||PROF.med,L=lod(),sn=snowy(),far=viewDist(ax,ay);S.stats.blasts++;if(type==='mud')S.stats.mud++;
 if(far>vw*1.2)return;                                   // longe demais: nem a fumaça chega à tela
 const full=far<60,q=v=>Math.max(0,RD(v*L*(full?1:.35)));
 /* coluna de fumaça e fumaça residual (vista mesmo de fora da tela, se perto) */
 if(P.col)EV.push({k:'col',x:ax,y:ay,R,t:0,dur:P.cold,acc:0,rate:q(P.col)/P.cold,P,big:type==='big'||type==='bomb'});
 for(let i=0;i<q(P.smoke);i++){const a=rnd(0,TAU),d=rnd(0,R*.28);add(P_PUFF,ax+Math.cos(a)*d,ay+Math.sin(a)*d*.6,rnd(0,R*.2),Math.cos(a)*rnd(4,14),Math.sin(a)*rnd(3,8),rnd(8,22),rnd(P.sl[0],P.sl[1]),P.ss[0]*rnd(.8,1.2),P.ss[1]*rnd(.8,1.2),0,1.6,0,.8,type==='mud'?.6:.95,type==='mud'?0:F_LIT)}
 EV.push({k:'wisp',x:ax,y:ay,R,t:0,dur:P.cold+rnd(5,9),acc:0,rate:P.wisp*.25*L,mud:type==='mud'});
 if(!full)return;
 /* clarão + luz no chão + clarão de tela (pesados perto da câmera) */
 EV.push({k:'fl',x:ax,y:ay,r:Math.max(3,RD(R*P.fl)),t:0,dur:type==='mud'?.05:.08,soft:type==='mud'});
 EV.push({k:'gl',x:ax,y:ay,r:Math.min(60,RD(R*P.glow)),t:0,dur:P.fbd*1.1});
 if(P.flashScr&&far<1)EV.push({k:'scr',t:0,dur:.06});
 if(P.fb){const nb=type==='gren'?3:type==='small'?4:6,r0=R*P.fb,B=[];for(let j=0;j<nb;j++){const a=rnd(0,TAU),d=j?rnd(.45,.95)*r0:0;
  B.push({dx:Math.cos(a)*d,dy:Math.sin(a)*d*.6-(j?rnd(0,r0*.4):0),r:j?r0*rnd(.5,.78):r0*.9,v:(Math.random()*3)|0,vz:rnd(8,26)*(R/35),dl:j?rnd(0,.07):0,du:P.fbd*(j?rnd(.7,1.15):1)})}
  B.sort((a,b)=>a.dy-b.dy);EV.push({k:'fb',x:ax,y:ay,t:0,dur:P.fbd*1.3+.08,b:B})}
 EV.push({k:'rg',x:ax,y:ay,R:R*P.ring,t:0,dur:P.rd,mud:type==='mud',sn});
 EV.push({k:'sc',x:ax,y:ay,R:R*(type==='gren'?.3:.42),t:0,dur:type==='mud'?0:rnd(3,5.5),seed:(Math.random()*999)|0});
 /* cortina de terra: pluma marrom que sobe rápido, para e desaba */
 for(let i=0;i<q(P.plume);i++){const a=rnd(0,TAU),s=rnd(.15,1);add(P_PUFF,ax+Math.cos(a)*R*.1,ay+Math.sin(a)*R*.06,2,Math.cos(a)*s*R*.3,Math.sin(a)*s*R*.15,rnd(P.pv[0],P.pv[1])*(1-s*.35),rnd(1.1,1.9),R*.06*rnd(.8,1.3),R*.17*rnd(.8,1.2),sn?8:4,1.2,110,.4,.95,0)}
 /* gêiser de lama negra (lama encharcada: sem bola de fogo) */
 if(P.mudp)for(let i=0;i<q(P.mudp*(R/35));i++){const a=rnd(0,TAU),s=rnd(0,1);add(P_PUFF,ax+Math.cos(a)*R*.06,ay+Math.sin(a)*R*.04,1,Math.cos(a)*s*12,Math.sin(a)*s*6,rnd(P.pv[0],P.pv[1])*(1-s*.3)*(R/35+.4)/1.4,rnd(.9,1.5),R*.06*rnd(.8,1.3),R*.14*rnd(.8,1.3),5,1.2,150,.3,1,0)}
 /* torrões: arco balístico com sombra; os grandes quicam uma vez e ficam no chão */
 const cl=q(P.clod);for(let i=0;i<cl;i++){const a=rnd(0,TAU),hs=rnd(P.ch[0],P.ch[1]),big=Math.random()<.3;add(P_CLOD,ax+Math.cos(a)*rnd(0,R*.15),ay+Math.sin(a)*rnd(0,R*.1),rnd(1,4),Math.cos(a)*hs,Math.sin(a)*hs*.62,rnd(P.cv[0],P.cv[1])*(big?.8:1),rnd(4,8),big?(Math.random()<.35?3:2):1,0,sn&&Math.random()<.4?7:(Math.random()*7)|0,.25,160,0,1,big?F_BOUNCE:0)}
 const mc=q(P.mudc||0);for(let i=0;i<mc;i++){const a=rnd(0,TAU),hs=rnd(P.ch[0],P.ch[1]);add(P_MUD,ax+Math.cos(a)*rnd(0,R*.1),ay+Math.sin(a)*rnd(0,R*.07),rnd(1,6),Math.cos(a)*hs,Math.sin(a)*hs*.62,rnd(P.cv[0],P.cv[1]),rnd(6,11),Math.random()<.45?(Math.random()<.4?3:2):1,0,(Math.random()*4)|0,.15,170,0,1,0)}
 /* faíscas (estilhaços quentes) e brasas */
 for(let i=0;i<q(P.spark);i++){const a=rnd(0,TAU),s=rnd(120,260);add(P_SPARK,ax,ay,rnd(1,5),Math.cos(a)*s,Math.sin(a)*s*.62,rnd(10,70),rnd(.09,.24),1,0,0,.5,200,0,1,0)}
 for(let i=0;i<q(P.ember);i++){add(P_EMBER,ax+rnd(-R*.25,R*.25),ay+rnd(-R*.15,R*.15),rnd(2,R*.3),rnd(-12,12),rnd(-6,6),rnd(14,40),rnd(1.2,2.6),1,0,0,1.2,-6,.9,1,0)}
 /* anel de poeira rente ao chão */
 for(let i=0;i<q(P.dust);i++){const a=i/Math.max(1,q(P.dust))*TAU+rnd(-.35,.35),d=R*rnd(.2,.75);add(P_DUST,ax+Math.cos(a)*d,ay+Math.sin(a)*d*.55,rnd(0,2),Math.cos(a)*rnd(30,95),Math.sin(a)*rnd(15,48),rnd(1,4),rnd(.7,1.7),R*.03*rnd(.6,1.3)+1,R*.11*rnd(.6,1.4)+2,sn?8:6,2.6,0,.5,.5,0)}}

/* shrapnel: nuvem branca no ar (puxada na direção do voo) e cone de balins até o chão */
function airburst(ax,ay,dx,dy,R){S.stats.airbursts++;const far=viewDist(ax,ay);if(far>vw)return;const L=lod(),z=20;
 EV.push({k:'fl',x:ax,y:ay-z,r:5,t:0,dur:.06});
 for(let i=0;i<RD(9*L);i++){const s=rnd(-.3,1);add(P_PUFF,ax+rnd(-2,2),ay+rnd(-1,1),z+rnd(-2,2),dx*s*30+rnd(-8,8),dy*s*30+rnd(-5,5),rnd(-4,6),rnd(3.5,6),rnd(2.5,4),rnd(8,13),2,2.2,0,.7,.92,i<2?F_LIT:0)}
 if(far>40)return;
 for(let i=0;i<RD(46*L);i++){const sp=rnd(.25,1),a=rnd(-1,1),cx=Math.cos(a),sx=Math.sin(a),fx=dx*cx-dy*sx,fy=dy*cx+dx*sx;
  add(P_PELLET,ax,ay,z,fx*sp*R*2.4+rnd(-12,12),fy*sp*R*1.5+rnd(-8,8),-rnd(15,60),.6,1,0,0,0,140,0,1,Math.random()<.7?F_DUSTKICK:0)}
 for(let i=0;i<RD(6*L);i++){const a=rnd(0,TAU),s=rnd(80,180);add(P_SPARK,ax,ay,z,Math.cos(a)*s,Math.sin(a)*s*.6,rnd(-60,30),rnd(.08,.18),1,0,0,.5,120,0,1,0)}}

/* cortina de fumaça: emissores que soltam bolas brancas por ~30 s, derivando com o vento como a cortina do battery.js */
function smokeShell(ax,ay){S.stats.smokeShells++;const R=29;for(let k=0;k<3;k++){const x=ax+rnd(-21,21),y=ay+rnd(-15,15);
 EV.push({k:'scr2',x,y,t:0,dur:30,acc:rnd(0,.2),R});
 for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(10,26);add(P_SCREEN,x,y,rnd(0,3),Math.cos(a)*s,Math.sin(a)*s*.6,rnd(4,10),rnd(6,9),rnd(4,6),rnd(14,20),3,1.4,0,.36,.9,F_FADEIN)}
 for(let i=0;i<5;i++){const a=rnd(0,TAU),s=rnd(50,110);add(P_SPARK,x,y,2,Math.cos(a)*s,Math.sin(a)*s*.6,rnd(30,70),rnd(.3,.55),1,0,1,.8,130,0,1,0)}}}

/* sopro de boca de uma peça da bateria (coordenadas de arte; ang = direção do cano) */
function muzzle(mx,my,ang,big){S.stats.muzzles++;if(viewDist(mx,my)>80)return;const ca=Math.cos(ang),sa=Math.sin(ang),px=-sa,py=ca,L=lod(),k=big?1.35:1;
 EV.push({k:'vr',x:mx+ca*3,y:my+sa*3,ca,sa,t:0,dur:big?1:.85,big});
 EV.push({k:'gl',x:mx+ca*4,y:my+5,r:RD(9*k),t:0,dur:.08});
 for(let i=0;i<RD(8*L);i++){const s=rnd(40,130)*k,sd=rnd(-.35,.35);add(P_PUFF,mx+ca*2,my+sa*2,rnd(0,2),ca*s+px*s*sd,(sa*s+py*s*sd)*.7,rnd(2,8),rnd(1.6,3)*k,rnd(2,3)*k,rnd(7,11)*k,1,4.2,-2,.7,.85,i<3?F_LIT:0)}
 for(let i=0;i<RD(7*L);i++){const s=rnd(25,70),sd=rnd(-.9,.9);add(P_DUST,mx+ca*rnd(4,10),my+5+sa*rnd(2,6),0,ca*s+px*s*sd*.8,(sa*s+py*s*sd*.8)*.55,rnd(1,3),rnd(.8,1.5),rnd(2,3),rnd(5,8)*k,6,2.4,0,.4,.55,0)}}

/* ---------- simulação ---------- */
let FIRES=null,fireAcc=0;
function fireList(){if(FIRES)return FIRES;const b=PXGAME.base;FIRES=b&&b.ambient&&typeof map!=='undefined'&&map==='trenches'?b.ambient.filter(a=>a.t==='fire').map(a=>({x:a.x,y:a.y,big:!!a.big,ph:Math.random()*8,acc:0})):[];return FIRES}
function step(dt){wind();const snw=snowy();
 for(let i=0;i<n;i++){const k=K[i];T[i]+=dt;if(T[i]>=MX[i])continue;const dr=Math.max(0,1-DR[i]*dt);VX[i]*=dr;VY[i]*=dr;
  if(k===P_CLOD||k===P_MUD||k===P_SPARK||k===P_PELLET){VZ[i]-=GV[i]*dt;X[i]+=VX[i]*dt;Y[i]+=VY[i]*dt;ZH[i]+=VZ[i]*dt;
   if(ZH[i]<=0){ZH[i]=0;
    if(k===P_PELLET){if(FG[i]&F_DUSTKICK&&cnt[P_DUST]<260)add(P_DUST,X[i],Y[i],0,rnd(-6,6),rnd(-3,3),rnd(3,8),rnd(.5,1),1,rnd(2.5,4.5),snw?8:6,2,0,.5,.7,0);kill(i);continue}
    if(k===P_SPARK){kill(i);continue}
    if(k===P_MUD){K[i]=P_SPLAT;cnt[P_MUD]--;cnt[P_SPLAT]++;T[i]=0;MX[i]=rnd(5,9);VX[i]=VY[i]=VZ[i]=0;continue}
    if(FG[i]&F_BOUNCE&&VZ[i]<-25){FG[i]&=~F_BOUNCE;VZ[i]=-VZ[i]*.32;VX[i]*=.45;VY[i]*=.45;if(cnt[P_DUST]<260&&S0[i]>=2)add(P_DUST,X[i],Y[i],0,0,0,2,.5,1,3,snw?8:6,0,0,.3,.5,0);continue}
    if(cnt[P_LAND]>220){kill(i);continue}K[i]=P_LAND;cnt[P_CLOD]--;cnt[P_LAND]++;T[i]=0;MX[i]=rnd(2.5,4.5);VX[i]=VY[i]=VZ[i]=0;continue}continue}
  /* fumaça, poeira, brasas: arrasto, empuxo, vento com cisalhamento (mais alto → mais vento) */
  const wk=WK[i]*(1+Math.min(1.5,ZH[i]/30));X[i]+=(VX[i]+WX*wk)*dt;Y[i]+=(VY[i]+WY*wk)*dt;
  if(GV[i]){VZ[i]-=GV[i]*dt}else VZ[i]*=Math.max(0,1-.9*dt);ZH[i]=Math.max(0,ZH[i]+VZ[i]*dt);
  if(k===P_EMBER){VX[i]+=Math.sin((T[i]+SD[i])*7)*20*dt}}
 /* compacta mantendo a ordem (a ordem de desenho não pisca) */
 let w=0;for(let i=0;i<n;i++){if(T[i]<MX[i]){if(w!==i)copy(w,i);w++}else cnt[K[i]]--}n=w;
 /* eventos e emissores */
 for(const e of EV){e.t+=dt;
  if(e.k==='col'&&e.t<e.dur){e.acc+=dt*e.rate;const P=e.P;while(e.acc>=1){e.acc-=1;const f=e.t/e.dur,a=rnd(0,TAU),d=rnd(0,e.R*.18);   // coluna: os primeiros sobem rápido e alto
    add(P_PUFF,e.x+Math.cos(a)*d,e.y+Math.sin(a)*d*.5,rnd(1,6)+f*e.R*.3,rnd(-6,6),rnd(-3,3),(e.big?rnd(50,80):rnd(30,48))*(1.15-f*.65),rnd(P.sl[0],P.sl[1])*(1-f*.25),P.ss[0]*rnd(.7,1)*(1-f*.3),P.ss[1]*rnd(.6,.9)*(1.25-f*.5),0,.35,0,.7,.95,f<.5?F_LIT|F_FADEIN:F_FADEIN)}}
  else if(e.k==='wisp'&&e.t<e.dur){e.acc+=dt*e.rate*(1-e.t/e.dur);while(e.acc>=1){e.acc-=1;add(P_WISP,e.x+rnd(-e.R*.25,e.R*.25),e.y+rnd(-e.R*.15,e.R*.15),0,rnd(-2,2),rnd(-1,1),rnd(5,10),rnd(2.6,4.2),rnd(1.5,2.5),rnd(5,9),e.mud?2:1,.6,0,.9,e.mud?.35:.55,F_FADEIN)}}
  else if(e.k==='scr2'&&e.t<e.dur){e.x+=WX*.36*dt;e.y+=WY*.36*dt;const f=e.t/e.dur,rate=f<.06?6:f<.7?2.4:2.4*(1-(f-.7)/.3);e.acc+=dt*rate;
   while(e.acc>=1){e.acc-=1;if(cnt[P_SCREEN]>=150)break;const a=rnd(0,TAU),d=rnd(0,e.R*.4);add(P_SCREEN,e.x+Math.cos(a)*d,e.y+Math.sin(a)*d*.6,rnd(0,4),Math.cos(a)*rnd(3,9),Math.sin(a)*rnd(2,5),rnd(2,5),rnd(8,12),rnd(5,8),rnd(16,24),3,.5,0,.36,.82,F_FADEIN)}}}
 let we=0;for(let i=0;i<EV.length;i++){const e=EV[i];if(e.t<e.dur)EV[we++]=e}EV.length=we;
 /* fogueiras e depósito destruído: brasas e fumaça preta (só perto da tela) */
 fireAcc+=dt;if(fireAcc>.06){const fd=fireAcc;fireAcc=0;
  for(const f of fireList()){if(viewDist(f.x,f.y)>40)continue;f.acc+=fd;if(f.acc>(f.big?.14:.32)){f.acc=0;add(P_EMBER,f.x+rnd(-2,2),f.y-rnd(3,6),rnd(0,3),rnd(-5,5),rnd(-3,1),rnd(16,30),rnd(1,2),1,0,0,1,-4,.8,1,0)}}
  if(window.PXBAT&&PXBAT.depots)for(const d of PXBAT.depots){if(!d.dead||viewDist(d.x,d.y)>120)continue;d._fxa=(d._fxa||0)+fd;if(d._fxa>.16){d._fxa=0;
   add(P_PUFF,d.x+rnd(-9,9),d.y+rnd(-5,3),rnd(6,12),rnd(-3,3),rnd(-2,2),rnd(14,22),rnd(4,6.5),rnd(3,5),rnd(11,17),0,.3,0,.8,.9,F_LIT|F_FADEIN);
   add(P_EMBER,d.x+rnd(-10,10),d.y-rnd(4,10),rnd(2,8),rnd(-8,8),rnd(-4,2),rnd(20,40),rnd(1,2.2),1,0,0,1,-4,.8,1,0)}}}}

/* ---------- desenho ---------- */
let gA=1;const alpha=(c,a)=>{if(a!==gA){c.globalAlpha=a;gA=a}};
const ease=x=>1-(1-x)*(1-x);
function drawPuff(c,i,ox,oy){const k=T[i]/MX[i],x=RD(X[i])+ox,y=RD(Y[i]-ZH[i])+oy,r=RB(S0[i]+(S1[i]-S0[i])*ease(Math.min(1,k*1.25)));if(x<-r-2||y<-r-2||x>vw+r+2||y>vh+r+2)return;
 let rp=RP[i],aged=1;if(rp===0||rp===1){if(FG[i]&F_LIT&&T[i]<.2)rp=7;else if(rp===0&&k>.62){rp=1;aged=.62}}   // a base acesa pelo fogo, depois fuligem, depois cinza
 let a=AL[i]*aged*(k<.4?1:k<.6?.78:k<.76?.55:k<.9?.32:.16);if(FG[i]&F_FADEIN&&T[i]<.25)a*=T[i]<.1?.4:.7;
 const sp=puffSprite(rp,r,SD[i]%3);alpha(c,RD(a*10)/10);c.drawImage(sp.c,x-sp.a,y-sp.a)}
function drawGroundPre(c,ox,oy){gA=c.globalAlpha=1;const snw=snowy();
 for(const e of EV){
  if(e.k==='gl'){const k=e.t/e.dur;if(k>=1)continue;const g=glowSprite(e.r,k<.4?2:0);alpha(c,k<.4?.9:.55);c.drawImage(g.c,RD(e.x)+ox-g.ax,RD(e.y)+oy-g.ay)}
  else if(e.k==='rg'){const k=e.t/e.dur,rx=Math.max(2,RD(e.R*(.18+.9*ease(k)))),ry=Math.max(1,RD(rx*.45)),x=RD(e.x)+ox,y=RD(e.y)+oy;if(x<-rx||x>vw+rx||y<-ry||y>vh+ry)continue;
   const sp=ringSprite(rx,e.mud?1:e.sn?2:0);alpha(c,RD((1-k)*10)/10);c.drawImage(sp.c,x-sp.ax,y-sp.ay)}
  else if(e.k==='sc'){if(e.t>=e.dur)continue;const k=e.t/e.dur,x=RD(e.x)+ox,y=RD(e.y)+oy,R=e.R;if(x<-R||x>vw+R||y<-R||y>vh+R)continue;
   const nE=RD(4+R*.5);for(let j=0;j<nE;j++){const hx=h2(e.seed,j,1),hy=h2(e.seed,j,2),fl=h2(e.seed+((time*9)|0),j,3);if(fl<k*.9)continue;
    const px=x+RD((hx-.5)*R*1.3),py=y+RD((hy-.5)*R*.7);alpha(c,1);c.fillStyle=fl>.75&&k<.4?'#ffd27a':fl>.45?'#ff8a2a':'#a3341a';c.fillRect(px,py,1,1)}}}
 /* sombras dos torrões no ar, torrões no chão, respingos de lama, gotas de chuva */
 alpha(c,1);
 for(let i=0;i<n;i++){const k=K[i];if(k!==P_LAND&&k!==P_SPLAT&&k!==P_DROP&&k!==P_RIP&&!((k===P_CLOD||k===P_MUD)&&ZH[i]>1.5))continue;
  const x=RD(X[i])+ox,y=RD(Y[i])+oy;if(x<-4||y<-4||x>vw+4||y>vh+4)continue;const f=T[i]/MX[i];
  if(k===P_CLOD||k===P_MUD){const s=S0[i];alpha(c,ZH[i]>30?.18:.32);c.fillStyle='#120f0a';c.fillRect(x,y,s>1?2:1,1);continue}
  if(k===P_LAND){const s=S0[i];alpha(c,f<.7?1:f<.85?.6:.3);c.fillStyle=RP[i]===7?SNOWD[SD[i]%3]:DIRT[RP[i]];c.fillRect(x,y,s,s>2?2:s);if(s>1){c.fillStyle=RP[i]===7?'#ffffff':DIRT_HI;c.fillRect(x,y,1,1)}continue}
  if(k===P_SPLAT){alpha(c,f<.6?.95:f<.85?.6:.3);const s=S0[i];c.fillStyle=MUDC[RP[i]&3];if(s>2){c.fillRect(x-2,y,5,2);c.fillRect(x-1,y-1,3,1)}else c.fillRect(x-(s>1?1:0),y,s>1?3:2,s>1?2:1);if(f<.5){c.fillStyle=MUD_HI;c.fillRect(x,y,1,1)}continue}
  if(k===P_DROP){alpha(c,.8);c.fillStyle=RP[i]?'#3d2f1f':'#cfdde2';if(f<.4){c.fillRect(x,y,1,1)}else{c.fillRect(x-1,y,1,1);c.fillRect(x+1,y,1,1);c.fillRect(x,y-1,1,1)}continue}
  if(k===P_RIP){const r=1+f*2.6;alpha(c,(1-f)*.7);pring(c,x,y,r,r*.55,'#d8e6e4')}}
 alpha(c,1)}
function drawFires(c,ox,oy){const fl=fireList();if(!fl.length&&!(window.PXBAT&&PXBAT.depots))return;const tt=time;
 const one=(x,y,big,ph)=>{const fr=flameFrames(big),f=fr[((tt*11+ph*3)|0)&7],gw=glowSprite(big?14:9,((tt*7+ph)|0)%3===0?1:0);alpha(c,.45+.1*Math.sin(tt*13+ph));c.drawImage(gw.c,x-gw.ax,y-gw.ay);alpha(c,1);c.drawImage(f,x-(f.width>>1),y-f.height+2)};
 for(const f of fl){const x=RD(f.x)+ox,y=RD(f.y)+oy;if(x<-20||y<-30||x>vw+20||y>vh+20)continue;one(x,y,f.big,f.ph);if(f.big)one(x+3,y+1,false,f.ph+2)}
 if(window.PXBAT&&PXBAT.depots)for(const d of PXBAT.depots){if(!d.dead)continue;const x=RD(d.x)+ox,y=RD(d.y)+oy;if(x<-40||y<-50||x>vw+40||y>vh+40)continue;
  one(x-8,y-1,true,1);one(x+1,y+3,true,4);one(x+8,y-2,false,6);one(x-2,y-5,false,3)}
 alpha(c,1)}
function drawAir(c,ox,oy){gA=c.globalAlpha=1;
 /* 1 poeira rasteira · 2 fumaça/plumas · 3 bola de fogo e clarão · 4 detritos, faíscas, brasas, balins */
 for(let i=0;i<n;i++)if(K[i]===P_DUST)drawPuff(c,i,ox,oy);
 for(let i=0;i<n;i++){const k=K[i];if(k===P_PUFF||k===P_SCREEN||k===P_WISP)drawPuff(c,i,ox,oy)}
 for(const e of EV){
  if(e.k==='fb'){for(const b of e.b){const lt=e.t-b.dl;if(lt<0||lt>=b.du)continue;const k=lt/b.du,ph=Math.min(5,Math.floor(Math.pow(k,.75)*6)),r=RB(Math.max(2,b.r*(.5+.7*ease(Math.min(1,k*2.5))))),
    sp=fireSprite(r,ph,b.v),x=RD(e.x+b.dx*(1+k*.5))+ox,y=RD(e.y+b.dy*(1+k*.5)-b.vz*lt-k*k*4)+oy;if(x<-r-4||y<-r-4||x>vw+r+4||y>vh+r+4)continue;alpha(c,k>.85?.65:1);c.drawImage(sp.c,x-sp.a,y-sp.a)}}
  else if(e.k==='fl'){const sp=flashSprite(e.r,e.soft),x=RD(e.x)+ox,y=RD(e.y)+oy;alpha(c,e.t<e.dur*.5?1:.6);c.drawImage(sp.c,x-sp.a,y-sp.a)}
  else if(e.k==='vr'){const k=e.t/e.dur,rr=(e.big?2.5:2)+(e.big?8:6)*ease(k),d=4+(e.big?34:26)*ease(k),cx=e.x+e.ca*d,cy=e.y+e.sa*d*.8,px=-e.sa,py=e.ca,rs=RB(e.big?2.6+k*2:2+k*1.6);
   alpha(c,RD((k<.4?.6:.6*(1-(k-.4)/.6))*10)/10);for(let j=0;j<10;j++){const a=j/10*TAU,sx=RD(cx+px*Math.cos(a)*rr)+ox,sy=RD(cy+py*Math.cos(a)*rr*.7-Math.sin(a)*rr-3)+oy,sp=puffSprite(Math.sin(a)<-.2?2:1,rs,j%3);c.drawImage(sp.c,sx-sp.a,sy-sp.a)}}
  else if(e.k==='scr'&&e.t<e.dur){alpha(c,.09);c.fillStyle='#fff3d6';c.fillRect(0,0,vw,vh)}}
 alpha(c,1);
 for(let i=0;i<n;i++){const k=K[i];if(k!==P_CLOD&&k!==P_MUD&&k!==P_SPARK&&k!==P_EMBER&&k!==P_PELLET)continue;
  const x=RD(X[i])+ox,y=RD(Y[i]-ZH[i])+oy;if(x<-4||y<-4||x>vw+4||y>vh+4)continue;
  if(k===P_CLOD){const s=S0[i],col=RP[i]===7?SNOWD[SD[i]%3]:DIRT[RP[i]];c.fillStyle=col;
   if(s===3){const ph=((T[i]*14+SD[i])|0)&1;if(ph){c.fillRect(x-1,y,3,2);c.fillRect(x,y-1,1,1)}else{c.fillRect(x,y-1,2,3);c.fillRect(x-1,y,1,1)}c.fillStyle=RP[i]===7?'#ffffff':DIRT_HI;c.fillRect(x,y-1,1,1)}
   else if(s===2){c.fillRect(x,y,2,2);c.fillStyle=RP[i]===7?'#ffffff':DIRT_HI;c.fillRect(x,y,1,1)}else c.fillRect(x,y,1,1);continue}
  if(k===P_MUD){c.fillStyle=MUDC[RP[i]&3];const s=S0[i];if(s===3){c.fillRect(x-1,y,3,2);c.fillRect(x,y-1,1,1)}else c.fillRect(x,y,s,s);if(s>1){c.fillStyle=MUD_HI;c.fillRect(x,y,1,1)}continue}
  if(k===P_SPARK){const f=T[i]/MX[i],tx=RD(X[i]-VX[i]*.018)+ox,ty=RD(Y[i]-ZH[i]-(VY[i]-VZ[i])*.018)+oy;
   if(RP[i]===1){alpha(c,.5);c.fillStyle='#e9e8e0';c.fillRect(tx,ty,1,1);alpha(c,1)}pline(c,tx,ty,x,y,f<.4?'#ffe9a0':'#ff9b32');c.fillStyle='#fff6d2';c.fillRect(x,y,1,1);continue}
  if(k===P_EMBER){const fl=((T[i]*12+SD[i])|0)%3,f=T[i]/MX[i];if(f>.8&&fl===0)continue;c.fillStyle=f<.4?(fl?'#ffd27a':'#ff9b32'):fl?'#ff8a2a':'#a3341a';c.fillRect(x,y,1,1);continue}
  if(k===P_PELLET){alpha(c,.8);c.fillStyle='#d6d2c4';c.fillRect(x,y,1,1);alpha(c,.4);c.fillRect(x,y-1,1,2);alpha(c,1)}}
 alpha(c,1)}

/* ---------- ganchos ---------- */
let CUR=null;
const PH=window.PHYS;
if(PH){const prev=PH.skipBlastFx;PH.skipBlastFx=function(x,y){const p=prev?!!prev.call(this,x,y):false;
 if(S.on&&CUR&&!CUR.hit&&CUR.x===x&&CUR.y===y){CUR.hit=true;CUR.wet=p;return true}return p}}
function mudLevel(x,y){try{if(window.PXFL&&PXFL.on===false)return 0;if(window.PXFL&&PXFL.mudForce!=null)return PXFL.mudForce;return window.PXW&&PXW.mudAt?PXW.mudAt(x,y):0}catch{return 0}}
function stamp(x,y,r,power){const tc=PXGAME.tctx,b=PXGAME.base;if(!tc||!b||!b.P||craters>=200||!PX.stampCrater)return;craters++;S.stats.craters++;
 PX.stampCrater(tc,RD(x*Z),RD(y*Z),Math.max(4,r*Z*(power?.36:.3)),b.P,{seed:craters*3+1001,scorch:1.1})}
wrap('explode',(orig,x,y,r,power=100,team=0)=>{
 if(!S.on||!PH||!(power>0))return orig(x,y,r,power,team);                          // destroço de tanque (power 0) fica com a camada de veículos
 const prev=CUR,cur={x,y,hit:false,wet:false},FLs=window.PXFL&&PXFL.stats,mu0=FLs?FLs.muffled:0;CUR=cur;
 const gb=typeof gblast!=='undefined'&&!!gblast;
 let ret;try{ret=orig(x,y,r,power,team)}finally{CUR=prev}
 try{if(!cur.hit){S.stats.duds++;return ret}                                         // não chegou ao pixel.js: bomba enterrada na lama (frontline) etc.
  if(cur.wet){S.stats.passed++;return ret}                                           // água: coluna do physics.js
  const muffled=FLs&&FLs.muffled>mu0,sh=typeof shells!=='undefined'?shells.find(s=>s.t<=0&&Math.abs(s.x-x)<.5&&Math.abs(s.y-y)<.5):null,ax=x*Z,ay=y*Z,R=r*Z;
  if(r>=40&&!gb&&!muffled)try{stamp(x,y,r,power)}catch(e){fail(e)}
  if(muffled){blast(ax,ay,R*1.6,'mud',sh);return ret}
  const gren=gb||!!(sh&&sh.gren),type=mudLevel(x,y)>=.45&&!gren?'mud':gren?'gren':sh&&(sh.bomb||sh._afxB)?'bomb':(sh&&sh.big)||r>=90?'big':r>=62?'med':'small';
  if(type==='bomb'&&typeof screenShake!=='undefined'&&hyp(x-cam.x,y-cam.y)<900)screenShake=Math.max(screenShake,4.2);
  blast(ax,ay,R,type,sh)}catch(e){fail(e)}
 return ret});
if(window.PXBAT&&typeof PXBAT.detonate==='function'){const det0=PXBAT.detonate;PXBAT.detonate=function(s){const P=S.on&&s&&s.kind==='shrap'&&PXBAT.fx?PXBAT.fx.parts:null,n0=P?P.length:0,r=det0.apply(this,arguments);
 if(P&&r&&P.length>n0)P.length=n0;                                                       // a nuvem do shrapnel é redesenhada aqui (sem duplicar a do battery.js)
 try{if(S.on&&r&&s){if(s.kind==='shrap'){let dx=s.x-(s.ox!=null?s.ox:s.x-1),dy=s.y-(s.oy!=null?s.oy:s.y),l=hyp(dx,dy)||1;airburst(s.x*Z,s.y*Z,dx/l,dy/l,s.r*Z*.8)}else if(s.kind==='smoke')smokeShell(s.x*Z,s.y*Z)}}catch(e){fail(e)}return r}}
const BUL=[],BT=[],BOMBS=[];let bulN=0;
wrap('update',(orig,dt)=>{
 if(!S.on)return orig(dt);bulN=0;
 try{if(typeof bullets!=='undefined')for(const b of bullets){if(b.damage&&b.t-dt<=0&&b.t>0&&bulN<64){BUL[bulN]=b;BT[bulN]=b.t;bulN++}}}catch(e){fail(e)}
 /* bomba no último quadro: esconde s.bomb só durante este update para o planefx.js não somar o próprio estouro (discos de
    fumaça por cima deste); a detonação, o dano e o tremor seguem iguais (o tremor de 4,2 é refeito aqui) */
 let nb=0;try{if(typeof shells!=='undefined')for(const s of shells)if(s.bomb&&s.t-dt<=0&&nb<24){BOMBS[nb++]=s;s._afxB=s.bomb;delete s.bomb}}catch(e){fail(e)}
 let r;try{r=orig(dt)}finally{for(let i=0;i<nb;i++){const s=BOMBS[i];if(s._afxB&&!s.bomb)s.bomb=s._afxB;BOMBS[i]=null}}
 const t0=performance.now();
 try{if(dt>0){step(dt);postFrame(dt)}}catch(e){fail(e)}
 const ms=performance.now()-t0;S.cost.upd=S.cost.upd*.95+ms*.05;if(ms>S.cost.peakUpd)S.cost.peakUpd=ms;
 for(let i=0;i<bulN;i++)BUL[i]=null;return r});
function postFrame(dt){
 /* bocas das baterias: cada clarão novo ganha anel de vórtice, nuvem dirigida e poeira */
 if(window.PXBAT&&PXBAT.fx){const fx=PXBAT.fx,bs=PXBAT.batteries||[];for(const f of fx.flashes){if(f._afx)continue;f._afx=1;let ang=f.dir>0?0:Math.PI;
  for(const b of bs)if(Math.abs((b.mx||0)-f.x)<1.5&&Math.abs((b.my||0)-f.y)<1.5){ang=b.ang!=null?b.ang:ang;break}muzzle(f.x,f.y,ang,!!f.big)}}
 /* impacto de bala no chão (as que acabaram o alcance; as que bateram em obstáculo já têm lascas do physics.js) */
 let imp=0;const snw=snowy();
 for(let i=0;i<bulN&&imp<8;i++){const b=BUL[i];if(b.t>0)continue;const ax=b.x*Z,ay=b.y*Z;if(viewDist(ax,ay)>4)continue;if(Math.abs(b.t-(BT[i]-dt))>1e-4)continue;                                   // b.t=-1: bateu em alguém/obstáculo (sangue do pixel.js, lascas do physics.js)
  const wd=window.PXW?PXW.depth(b.x,b.y):0;if(wd>=.12)continue;imp++;S.stats.impacts++;
  if(mudLevel(b.x,b.y)>=.4){for(let j=0;j<3;j++)add(P_MUD,ax,ay,0,rnd(-14,14),rnd(-8,8),rnd(30,60),2,1,0,(Math.random()*4)|0,.2,170,0,1,0);continue}
  add(P_DUST,ax,ay,0,rnd(-3,3),rnd(-2,1),rnd(10,18),rnd(.45,.75),1,rnd(2.5,3.5),snw?8:6,2.5,0,.4,.6,0);
  for(let j=0;j<3;j++)add(P_CLOD,ax,ay,0,rnd(-14,14),rnd(-9,9),rnd(35,70),2,1,0,snw&&j===0?7:3+((Math.random()*4)|0),.2,170,0,1,0)}
 /* chuva: coroinhas no chão seco, anéis em poça rasa, respingo escuro na lama (a água funda é do weather.js) */
 const W_=window.PXW&&PXW.state;if(W_&&!W_.snow&&W_.I>.04&&typeof running!=='undefined'&&running){let m=W_.I*vw*vh/300*dt;const ox=camOX(),oy=camOY();
  while(m>0&&cnt[P_DROP]+cnt[P_RIP]<170){if(m<1&&Math.random()>m)break;m-=1;const sx=Math.random()*vw,sy=Math.random()*vh,ax=sx-ox,ay=sy-oy,wx=ax/Z,wy=ay/Z,d=PXW.depth(wx,wy);if(d>=.2)continue;
   if(d>.04)add(P_RIP,ax,ay,0,0,0,0,rnd(.4,.6),1,0,0,0,0,0,1,0);else add(P_DROP,ax,ay,0,0,0,0,rnd(.12,.2),1,0,mudLevel(wx,wy)>.35?1:0,0,0,0,1,0)}}}
let smallN=0;
wrap('shoot',(orig,u,target,manual)=>{const r=orig(u,target,manual);
 try{if(S.on&&u&&u.type!=='tank'&&u.type!=='cavalry'&&smallN<6&&cnt[P_PUFF]<500){const a=u.angle||0,ax=(u.x+Math.cos(a)*24)*Z,ay=(u.y+Math.sin(a)*24+2)*Z;
  if(viewDist(ax,ay)<10&&Math.random()<(u.type==='mg'?.3:.85)){smallN++;add(P_PUFF,ax,ay,2,Math.cos(a)*rnd(14,24),Math.sin(a)*rnd(9,16),rnd(2,5),rnd(1.3,2.1),1,rnd(3,4.5),1,2.6,0,1,.5,F_FADEIN)}}}catch(e){fail(e)}return r});
wrap('setup',(orig,...a)=>{const r=orig(...a);reset();if(S.on)warm();return r});
/* aquece o cache de sprites em fatias ociosas (evita picos de 5–15 ms no primeiro estouro) */
let warmQ=null;function warm(){if(warmQ)return;warmQ=[];for(const rp of[0,1,4,6,7,2])for(let r=1;r<=24;r=r<12?r+1:r+2)for(let v=0;v<3;v++)warmQ.push(()=>puffSprite(rp,r,v));
 for(let r=2;r<=20;r=r<12?r+1:r+2)for(let ph=0;ph<6;ph++)for(let v=0;v<3;v++)warmQ.push(()=>fireSprite(r,ph,v));
 const ric=window.requestIdleCallback||(f=>setTimeout(()=>f({timeRemaining:()=>6}),40));const go=dl=>{try{const t0=performance.now();while(warmQ.length&&performance.now()-t0<Math.min(6,dl.timeRemaining()))warmQ.pop()()}catch(e){fail(e);warmQ.length=0}if(warmQ.length)ric(go);else warmQ=null};ric(go)}
/* desenho: chão (antes do resto do WW1A.under: guns/fortes por cima) + chamas (depois); ar no PLN.under (depois das tropas, antes dos aviões) */
function timed(fn){return function(c,ox,oy){if(!S.on)return;const t0=performance.now();try{fn(c,ox,oy)}catch(e){fail(e);try{c.globalAlpha=1}catch{}}const ms=performance.now()-t0;S.cost.draw=S.cost.draw*.95+ms*.05;if(ms>S.cost.peakDraw)S.cost.peakDraw=ms}}
const dPre=timed(drawGroundPre),dFire=timed(drawFires),dAir=timed((c,ox,oy)=>{smallN=0;drawAir(c,ox,oy)});
if(window.WW1A){const u0=WW1A.under;WW1A.under=function(c,ox,oy,dt){dPre(c,ox,oy);const r=u0.apply(this,arguments);dFire(c,ox,oy);return r}}
if(window.PLN&&typeof PLN.under==='function'){const p0=PLN.under;PLN.under=function(c,ox,oy,dt){dAir(c,ox,oy);return p0.apply(this,arguments)}}
else if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){dAir(c,ox,oy);return o0.apply(this,arguments)}}
S.state=()=>({on:S.on,version:S.version,live:n,cap:N,events:EV.length,byKind:{puff:cnt[P_PUFF],dust:cnt[P_DUST],clod:cnt[P_CLOD],land:cnt[P_LAND],spark:cnt[P_SPARK],ember:cnt[P_EMBER],pellet:cnt[P_PELLET],mud:cnt[P_MUD],splat:cnt[P_SPLAT],drop:cnt[P_DROP]+cnt[P_RIP],screen:cnt[P_SCREEN],wisp:cnt[P_WISP]},
 sprites:PUFF.size+FB.size+FL_.size+GL.size,stats:Object.assign({},S.stats),cost:{upd:+S.cost.upd.toFixed(3),draw:+S.cost.draw.toFixed(3),peakUpd:+S.cost.peakUpd.toFixed(3),peakDraw:+S.cost.peakDraw.toFixed(3)}});
S.reset=reset;S.blast=(x,y,r,type)=>blast(x*Z,y*Z,r*Z,type||'med');S.airburst=(x,y,r)=>airburst(x*Z,y*Z,1,0,(r||80)*Z*.8);S.smokeShell=(x,y)=>smokeShell(x*Z,y*Z);
S.setOn=v=>{S.on=!!v;if(!S.on)reset()};
})();
