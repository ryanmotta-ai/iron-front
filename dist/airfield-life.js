'use strict';
/* Iron Front 1.13 — vida do aeródromo (airfield-life.js). Carrega DEPOIS do airwar-view.js. Só desenho e gestos: quem anda, quando e por quanto
   tempo é do airwar.js (pilotos e observadores têm posição, passo e roteiro; cada avião tem fase de solo, rpm e calços).
   Pessoas ....... pilotos e observadores com a roupa da época (casaco de couro, capacete de couro com óculos, cachecol de seda, luvas e botas;
                   EUA em tom de couro claro com gola de pele, Alemanha em couro escuro) e mecânicos de macacão (EUA oliva, Alemanha azul-
                   acinzentado), desenhados em escala com os aviões (≈ 10 px de altura para 1,75 m). Andam, correm, fazem o pré-voo, sobem na asa
                   e entram na cabine (as pernas somem primeiro), descem e vão ao relatório. Sentados: capacete visto de cima, óculos, cachecol
                   que esvoaça com a velocidade.
   Partida ....... o mecânico vem à hélice, dá os puxões com o contato aberto, "contato!", gira a hélice (o motor pega ou não), recua; dois
                   tiram os calços; dois acompanham as pontas das asas no início do táxi. No pouso um sinaleiro recebe o avião e os calços entram.
   Motor ......... a hélice gira pelo rpm do airwar (parada = pás de madeira com ponta de latão; arranque = pá com rastro; marcha lenta e
                   plena = disco). Poeira e capim jogados atrás do avião na prova de motor e na corrida, fumaça azulada de rícino na partida.
   Chão .......... marcas de roda e capim deitado pelo vento da hélice ficam gravados no fundo do aeródromo.
   ?aerodromo=0 desliga a vida do aeródromo (pessoas, poeira, calços; voltam as cabeças pintadas nos sprites) · PXAFL.state() · PXAFL.sheet() */
(function(){
const A=window.PXAW,PX=window.PX,AA=window.IronFront&&IronFront.animAir;if(!A||!PX||!AA)return;
const Z=PX.Z||.5,TAU=Math.PI*2,hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,rnd=(a,b)=>a+Math.random()*(b-a);
const L=window.PXAFL={on:A.on&&!/[?&]aerodromo=0/.test(location.search),version:'1.13',stats:{errors:0,drawn:0,ms:0,figs:0}};
let errs=0;function fail(e){L.stats.errors++;if(++errs<=3)console.error('airfield-life.js:',e);if(errs>=12&&L.on){L.on=false;console.error('airfield-life.js desligado após erros repetidos')}}
const hsh=(n,s=0)=>{let h=(Math.imul(n|0,374761393)+Math.imul(s|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const mk=PX.mk,g2=PX.g2;

/* ======================================================================================
   FIGURAS (7 px de largura × 11 de altura, mais o contorno do jogo): frente, costas e perfil, pernas em 3 quadros
   ====================================================================================== */
const PAL={
 p0:{h:'#7a5230',H:'#a37444',L:'#15171a',S:'#d8ac84',s:'#b2885f',w:'#f0ead8',W:'#bfb8a2',f:'#d2c196',c:'#9a7345',C:'#7d5a34',b:'#2c2118',G:'#4b3521',k:'#6d6c46',K:'#52502f',B:'#2e2117'},
 p1:{h:'#4a3828',H:'#6b503a',L:'#15171a',S:'#d8ac84',s:'#b2885f',w:'#f0ead8',W:'#bfb8a2',f:'#8a7a60',c:'#5b5144',C:'#463e34',b:'#1c1a17',G:'#2c2620',k:'#5d6252',K:'#454a3a',B:'#1b1917'},
 m0:{h:'#6e6c45',H:'#8c8a5c',L:'#15171a',S:'#d2a57c',s:'#aa7f58',w:'#d6cfb6',W:'#aaa38c',f:'#8a8a63',c:'#7d7b50',C:'#5e5c3b',b:'#3a3622',G:'#d2a57c',k:'#5e5c3b',K:'#47452c',B:'#2e2117'},
 m1:{h:'#5e6670',H:'#7c8691',L:'#15171a',S:'#d2a57c',s:'#aa7f58',w:'#d6cfb6',W:'#aaa38c',f:'#6e7a85',c:'#5a6773',C:'#44505a',b:'#2b3138',G:'#d2a57c',k:'#44505a',K:'#343e47',B:'#1d1c1a'}};
/* piloto / observador: capacete de couro com óculos, cachecol, casaco de couro até o meio da coxa, luvas, calça de montaria e botas */
const PILOT={
 F:['..hhh..','.hHhhh.','.LLSLL.','..sSs..','.fwwwf.','cCCCCCc','cCCbCCc','GCCCCCG','.CCCCC.'],
 B:['..hhh..','.hhhhh.','.hhhhh.','..hhh..','.fffff.','cCCCCCc','cCCCCCc','GCCCCCG','.CCCCC.'],
 S:['..hhh..','.hhhhL.','.hhhSS.','..hwss.','..fwwf.','..CCCc.','.CCbCCc','.CCCCGc','..CCCC.']};
/* mecânico: boné, macacão com mangas arregaçadas (antebraços à mostra) */
const MECH={
 F:['..hhh..','.hHHHh.','..SSS..','..sSs..','.CwwwC.','cCCCCCc','SCCbCCS','SCCCCCS','.CCCCC.'],
 B:['..hhh..','.hhhhh.','..sss..','..sss..','.CCCCC.','cCCCCCc','SCCCCCS','SCCCCCS','.CCCCC.'],
 S:['..hhhh.','.hHhhhh','..hSS..','..ssS..','..CwwC.','..CCCc.','.CCbCCS','.CCCCCS','..CCCC.']};
const LEGS={F:[['.kk.kk.','.BB.BB.'],['.kk.kk.','.BB..B.'],['.kk.kk.','..B.BB.']],B:[['.kk.kk.','.BB.BB.'],['.kk.kk.','.BB..B.'],['.kk.kk.','..B.BB.']],S:[['..kkk..','..BBB..'],['..k.kk.','.BB.BB.'],['.kk.k..','.BB.BB.']]};
const FIG=new Map();
function figure(role,team,view,fr,pose){const key=role+team+view+fr+pose;let c=FIG.get(key);if(c)return c;
 const base=(role==='m'?MECH:PILOT)[view],pal=PAL[(role==='m'?'m':'p')+team];let rows=base.slice();
 const legs=LEGS[view][fr||0];
 if(pose==='crouch'){rows=rows.slice(0,8).concat(view==='S'?['.kkkk..','.BBBB..']:['.kkkkk.','.BB.BB.']);rows[7]=rows[7].replace(/C/g,'C')}
 else rows=rows.concat(legs);
 if(pose==='up'){/* braços para o alto (sinal): mangas sobem ao lado da cabeça */
  rows=rows.map((r,i)=>{if(i>=5&&i<=7){r=r.split('');r[0]=i===7&&view!=='S'?'.':r[0];if(view==='F'||view==='B'){r[0]='.';r[6]='.'}return r.join('')}return r});
  const up=r=>r.split('');for(const i of[1,2,3,4]){const r=up(rows[i]);r[0]=i===1?'G':'c';r[6]=i===1?'G':'c';rows[i]=r.join('')}}
 c=PX.outlined(PX.fromGrid(rows,pal),.6);c.ax=(c.width>>1);c.ay=c.height-2;FIG.set(key,c);L.stats.figs++;return c}
const flipC=new Map();
function flipped(c,key){let f=flipC.get(key);if(!f){f=PX.flipX(c);f.ax=c.width-1-c.ax;f.ay=c.ay;flipC.set(key,f)}return f}
/* direção → vista: frente (olhando para o sul), costas (norte), perfil (leste; oeste = espelhado) */
function viewOf(hd){const dx=Math.cos(hd),dy=Math.sin(hd);return Math.abs(dy)>Math.abs(dx)*1.15?(dy>0?['F',0]:['B',0]):['S',dx<0?1:0]}
function draw(c,role,team,hd,fr,pose,sx0,sy0,cut){const[v,fl]=viewOf(hd);let f=figure(role,team,v,fr,pose);if(fl)f=flipped(f,role+team+v+fr+pose);
 const x=sx0-f.ax,y=sy0-f.ay;
 if(cut>0){const h=Math.max(1,f.height-cut);c.drawImage(f,0,0,f.width,h,x,y,f.width,h)}else c.drawImage(f,x,y)}
/* sombra no chão */
const shadow=(c,x,y,w=5)=>{c.fillStyle='rgba(10,12,8,.32)';c.fillRect(x-(w>>1),y,w,1);c.fillRect(x-(w>>1)+1,y+1,w-2,1)};

/* ======================================================================================
   CABEÇA SENTADA (vista de cima): capacete de couro, óculos à frente, ombros, cachecol esvoaçante
   ====================================================================================== */
const HEADC={p0:['#7a5230','#a37444','#e0c9a0'],p1:['#4a3828','#6b503a','#e0c9a0']};
function seatHead(c,x,y,hd,team,fast,fl,shoulders){const f=[Math.cos(hd),Math.sin(hd)],r=[-f[1],f[0]],P=HEADC['p'+team],R=(v,w)=>[Math.round(x+f[0]*v+r[0]*w),Math.round(y+f[1]*v+r[1]*w)];
 /* ombros (casaco) atrás da cabeça */
 if(shoulders){c.fillStyle=team?'#463e34':'#7d5a34';for(let w=-2;w<=2;w++){const q=R(-1.6,w);c.fillRect(q[0],q[1],1,1)}c.fillStyle=team?'#5b5144':'#9a7345';for(const w of[-2,2]){const q=R(-1.6,w);c.fillRect(q[0],q[1],1,1)}}
 /* capacete 3×3 */
 c.fillStyle=P[0];for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const q=R(a*.9,b*.9);c.fillRect(q[0],q[1],1,1)}
 c.fillStyle=P[1];{const q=R(-.5,-.5);c.fillRect(q[0],q[1],1,1)}
 /* óculos à frente */
 c.fillStyle='#15171a';for(const w of[-.7,.7]){const q=R(1.35,w);c.fillRect(q[0],q[1],1,1)}
 /* cachecol de seda ao vento */
 if(fast>.15){c.fillStyle=P[2];const k=Math.round(1+fast*2.2),fl2=Math.sin(time*30+x)*.8;for(let i=0;i<k;i++){const q=R(-1.5-i,.6+fl2*(i*.35)+.4);c.fillRect(q[0],q[1],1,1)}}
 else{c.fillStyle=P[2];const q=R(-1.2,0);c.fillRect(q[0],q[1],1,1)}}
function seatsOf(p){const T=p.T,n=T.crew,r=[];for(let i=0;i<n;i++){const who=i===T.ps?p.pilot:p.seats[i<T.ps?i:i-1];r.push(who)}return r}
const seated=(p,who)=>!!who&&(p.air&&p.st==='air'||who.act==='seat'&&who.plane===p);
/* gancho do anim-air (drawPlane, fonte 'd'): sentados, calços */
L.overPlane=function(c,p,x,y,sp,o){const T=p.T,cock=sp.pts.cock,sc=seatsOf(p);
 if(p.chocks&&(p.st==='park'||p.st==='start')&&!p.air){/* calços de madeira à frente das rodas principais */
  c.fillStyle='#4a3420';for(const s of[-1,1]){c.fillRect(Math.round(x+s*5),Math.round(y+5),2,2)}c.fillStyle='#8a6238';for(const s of[-1,1])c.fillRect(Math.round(x+s*5),Math.round(y+5),2,1)}
 const fast=p.air||p.st==='roll'?clamp((Math.hypot(...p.V)||p.gv||0)/180,0,1):0;
 for(let i=0;i<sc.length;i++){const who=sc[i],ck=cock[i];if(!ck||!seated(p,who))continue;
  seatHead(c,x+ck.x,y+ck.y,o.hd,p.team,fast,0,true)}};

/* ======================================================================================
   PESSOAS NO SOLO
   ====================================================================================== */
const FR=[0,1,0,2];
let OX=0,OY=0;const sx=x=>OX+Math.round(x*Z),sy=y=>OY+Math.round(y*Z);
const onS=(x,y,m)=>x>-m&&y>-m&&x<vw+m&&y<vh+m;
const ease=k=>k*k*(3-2*k);
const GPc=()=>A.cfg.GP;
function cockpitPt(p,seat){const vp=AA.vp&&AA.vp(p),ck=vp&&vp.spr&&vp.spr.pts.cock[seat];return ck?[sx(vp.x)+ck.x,sy(vp.y)+ck.y]:[sx(p.x),sy(p.y+p.T.seat[seat])]}
/* desenha uma pessoa (piloto/observador do airwar ou mecânico daqui) */
function drawPerson(c,q,items){
 const role=q.role==='m'?'m':'p',team=q.team,X=sx(q.x),Y=sy(q.y);if(!onS(X,Y,24))return;
 const act=q.act,tt=time-q.t0;
 if(act==='climb'||act==='climbout'){
  const p=q.plane;if(!p)return;const dur=q.dur||GPc().climb,k=clamp(tt/dur,0,1),kk=act==='climb'?k:1-k,cp=cockpitPt(p,q.seat),bx=sx(p.slot.x+17),by=sy(p.slot.y+p.T.seat[q.seat]+3);
  const e=ease(kk),px=Math.round(lerp(bx,cp[0],e)),py=Math.round(lerp(by,cp[1]+1,e)-Math.sin(kk*Math.PI)*3),cut=Math.round(ease(clamp((kk-.3)/.65,0,1))*7);
  shadow(c,bx,by);items.push([by+1,()=>draw(c,role,team,Math.PI,kk>.15&&kk<.8?1:0,'stand',px,py,cut)]);return}
 const pose=q.pose||'stand';let fr=0;
 if(q.moving&&(act==='walk'||act==='run'||act==='inspect'))fr=FR[Math.floor(q.wph/(act==='run'?5:3.6))&3];
 let hd=q.hd;
 if(!q.moving){if(q.fac!=null)hd=q.fac;else if(act==='idle'||act==='debrief'){const g=Math.floor(time/3.2+q.ph*1.7),h=hsh(g,q.ph*13|0);hd=h<.35?q.hd:h<.6?Math.PI/2:h<.8?0:Math.PI}}
 shadow(c,X,Y);
 items.push([Y,()=>{draw(c,role,team,hd,fr,pose,X,Y,0);
  if(q.item==='can'){c.fillStyle='#9a8b62';c.fillRect(X-4,Y-4,3,4);c.fillStyle='#c4b584';c.fillRect(X-4,Y-4,3,1);c.fillStyle='#c9532f';c.fillRect(X-3,Y-3,1,1)}
  if(q.item==='chock'){c.fillStyle='#8a6238';c.fillRect(X+2,Y-3,3,2);c.fillStyle='#4a3420';c.fillRect(X+2,Y-2,3,1)}
  if(act==='debrief'){c.fillStyle='#e6dfc6';c.fillRect(X+2,Y-6,2,2)}
  else if(act==='idle'&&role==='p'&&!q.moving&&hsh(q.ph*7|0,3)<.3){const sd=Math.cos(hd)>.3?1:-1;c.fillStyle='#e6dfc6';c.fillRect(X+sd*3,Y-7,1,1);if(((time*2+q.ph)|0)%4===0){c.fillStyle='#ff7a24';c.fillRect(X+sd*4,Y-7,1,1)}}}])}

/* ---- mecânicos (só visuais): amarrados à fase de solo que o airwar informa em cada avião ---- */
const CR=new Map(),ALL=new Set();
function ent(team,x,y){const m={role:'m',team,x,y,hd:Math.PI/2,act:'idle',moving:false,wph:0,t0:time,pose:'stand',ph:rnd(0,9),fac:null,item:null,plane:null,seat:-1};ALL.add(m);return m}
function stepTo(m,tx,ty,spd,dt){const dx=tx-m.x,dy=ty-m.y,d=hyp(dx,dy);if(d<1.2){m.moving=false;if(m.act==='walk'||m.act==='run')m.act='idle';return true}const s=Math.min(d,spd*dt);m.x+=dx/d*s;m.y+=dy/d*s;m.hd=Math.atan2(dy,dx);m.wph+=s;m.moving=true;m.act=spd>40?'run':'walk';m.pose='stand';return d<=s+.5}
function setAct(m,act,pose){if(m.act!==act||m.pose!==pose){m.act=act;m.pose=pose||'stand';m.t0=time}}
const fwd=p=>[Math.cos(p.hd),Math.sin(p.hd)],lft=p=>[Math.sin(p.hd),-Math.cos(p.hd)];
/* ponto da hélice no mundo (pelo sprite quando já existe) */
function propPt(p){const vp=AA.vp&&AA.vp(p),pr=vp&&vp.spr&&vp.spr.pts.props[0],f=fwd(p);return pr?[vp.x+pr.x/Z,vp.y+pr.y/Z]:[p.x+f[0]*p.T.len*.36,p.y+f[1]*p.T.len*.36]}
const leaveFrom=(m,dir)=>{if(m.leave)return;m.leave=dir||1;m.t0=time};
function crewOf(p){let c=CR.get(p);if(!c){c={fit:null,ch:[],ww:[],mar:null,prev:''};CR.set(p,c)}return c}
function dismiss(c){for(const m of[c.fit,c.mar,...c.ch,...c.ww])if(m)leaveFrom(m,m.x<(m.plane?m.plane.x:0)?-1:1);c.fit=c.mar=null;c.ch=[];c.ww=[]}
function crewTick(dt){
 for(const p of A.planes()){if(p.dead||p.gone)continue;const c=crewOf(p),f=fwd(p),l=lft(p),pr=propPt(p),T=p.T;
  if(p.st==='start'){
   if(!c.fit){c.fit=ent(p.team,p.slot.x-T.span/2-26,p.slot.y-14);c.fit.plane=p}
   const F=c.fit,stand=[pr[0]-26,pr[1]+14],at=[pr[0]+5,pr[1]+19],el=time-p.gt;
   if(!F.leave){
    if(p.gp==='crew'){const near=A.people().some(q=>q.plane===p&&(q.act==='climb'||q.act==='seat'));if(stepTo(F,near?at[0]:stand[0],near?at[1]:stand[1],34,dt)){F.fac=near?-Math.PI/2:0;setAct(F,'idle',near?'up':'stand')}}
    else if(p.gp==='prime'){if(stepTo(F,at[0],at[1],34,dt)){F.fac=-Math.PI/2;const n=Math.floor(el/.9),ph=el-n*.9;setAct(F,'idle',ph<.5&&el<(p.primeT||3)?'crouch':'up')}}
    else if(p.gp==='swing'){if(stepTo(F,at[0],at[1],34,dt)){F.fac=-Math.PI/2;const k=A.cfg.GP.kick;setAct(F,'idle',el>k-.35&&el<k+.25?'crouch':'up')}}
    else if(p.gp==='warm'||p.gp==='chocks'){if(stepTo(F,pr[0]-30-T.span*.2,pr[1]-4,36,dt)){F.fac=-Math.PI/4;setAct(F,'idle','stand')}}}
   /* calços: dois mecânicos agachados nas rodas, saem com a madeira na mão */
   if(p.gp==='chocks'){if(!c.ch.length){for(const s of[-1,1]){const m=ent(p.team,p.x+s*(T.span/2+22),p.y-2);m.plane=p;c.ch.push(m)}}
    c.ch.forEach((m,i)=>{if(m.leave)return;const s=i?1:-1,w=[p.x+s*10,p.y+14],e2=time-p.gt;if(e2<.5)stepTo(m,w[0]+s*5,w[1]+4,34,dt);else if(e2<1.2){m.fac=-Math.PI/2+.2*s;setAct(m,'idle','crouch')}else{m.item='chock';setAct(m,'idle','stand');leaveFrom(m,s)}})}}
  else if(p.st==='taxi'){
   const d=hyp(p.x-p.slot.x,p.y-p.slot.y);
   if(d<120&&!c.ww.length&&c.prev!=='ww'){c.prev='ww';for(const s of[-1,1]){const m=ent(p.team,p.x+l[0]*s*(T.span/2+9),p.y+l[1]*s*(T.span/2+9));m.plane=p;m.side=s;c.ww.push(m)}if(c.fit)leaveFrom(c.fit,1)}
   for(const m of c.ww){if(m.leave)continue;if(d<110){const tx=p.x+l[0]*m.side*(T.span/2+9)+f[0]*6,ty=p.y+l[1]*m.side*(T.span/2+9)+f[1]*6;m.x=lerp(m.x,tx,Math.min(1,dt*8));m.y=lerp(m.y,ty,Math.min(1,dt*8));m.hd=p.hd;m.moving=true;m.wph+=Math.max(0,p.gv)*dt*1.1;m.act='walk';m.pose='stand'}
    else{m.moving=false;m.fac=Math.atan2(p.y-m.y,p.x-m.x);setAct(m,'idle','up');if(time-m.t0>1.6)leaveFrom(m,m.side)}}}
  else if(p.st==='taxiin'){
   const d=hyp(p.x-p.slot.x,p.y-p.slot.y);
   if(d<190&&!c.mar){c.mar=ent(p.team,p.slot.x+14,p.slot.y+T.len/2+120);c.mar.plane=p;c.mar.fac=-Math.PI/2;c.mar.pose='up'}
   if(c.mar&&!c.mar.leave){const ty=p.slot.y+T.len/2+Math.max(34,Math.min(120,d*.5+26));if(stepTo(c.mar,p.slot.x+10,ty,36,dt)){c.mar.fac=-Math.PI/2;setAct(c.mar,'idle','up')}}}
  else if(p.st==='park'&&p.gp==='out'){
   if(c.mar&&!c.mar.leave){c.mar.fac=-Math.PI/2;setAct(c.mar,'idle','stand');if(time-p.gt>1.4)leaveFrom(c.mar,1)}
   if(!c.ch.length&&time-p.gt<3&&c.prev!=='ch'){c.prev='ch';for(const s of[-1,1]){const m=ent(p.team,p.slot.x+s*(T.span/2+40),p.slot.y+30);m.plane=p;c.ch.push(m)}}
   c.ch.forEach((m,i)=>{if(m.leave)return;const s=i?1:-1,e2=time-p.gt;if(e2<2.4)stepTo(m,p.slot.x+s*15,p.slot.y+16,38,dt);else if(e2<3.3){m.fac=-Math.PI/2+.2*s;setAct(m,'idle','crouch')}else leaveFrom(m,s)})}
  else if(p.st==='hold'||p.st==='lineup'||p.st==='roll'||p.air){if(c.fit||c.ww.length||c.mar||c.ch.length)dismiss(c);if(p.air||p.st==='roll')c.prev=''}
  else if(p.st==='park'&&c.prev&&time-p.gt>8){c.prev='';dismiss(c)}}
 /* quem está de saída anda até sumir (volta ao trabalho no campo, fora de quadro) */
 for(const m of ALL){if(!m.leave)continue;const d=m.leave,ex=m.plane?m.plane.slot.x+d*(m.plane.T.span/2+80):m.x+d*80,ey=m.plane?m.plane.slot.y-46:m.y-30;stepTo(m,ex,ey,26,dt);if(time-m.t0>7||hyp(m.x-ex,m.y-ey)<3)ALL.delete(m)}
 for(const m of ALL)if(m.plane&&(m.plane.dead||m.plane.gone))ALL.delete(m)}
/* ---- vida de fundo: mecânicos que cuidam dos aviões parados (os que esperam rearme e conserto recebem mais visitas), buscam latas de gasolina no depósito; sentinelas ---- */
const AMB=[[],[]];
function ambInit(){for(const t of[0,1]){const af=A.airfields()[t];if(!af||AMB[t].length)continue;
  for(let i=0;i<6;i++){const m=ent(t,af.x+rnd(-320,320),af.y+rnd(-250,-130));m.amb=1;AMB[t].push({m,st:'idle',t:time+rnd(0,5),path:[],tp:null})}
  const sg=t?-1:1,gate=[af.x+sg*420,af.compact?af.y+58:af.y+250],ops=[af.ops.x+sg*-26,af.ops.y+26];
  for(const q of[gate,ops]){const m=ent(t,q[0],q[1]);m.amb=1;m.sentry=1;m.fac=Math.PI/2;AMB[t].push({m,st:'guard',t:time+rnd(2,6),path:[],home:q})}}}
function frontY(p){return p.slot.y+p.T.len/2+34}
function ambTick(dt){if(!A.airfields()[0])return;if(!AMB[0].length)ambInit();
 for(const t of[0,1]){const af=A.airfields()[t];if(!af)continue;if(typeof cam!=='undefined'&&hyp(af.x-cam.x,af.y-cam.y)>1900)continue;
  for(const o of AMB[t]){const m=o.m;
   if(o.st==='guard'){if(time>o.t){o.t=time+rnd(5,12);m.fac=[Math.PI/2,0,Math.PI,-Math.PI/2][(hsh(o.t*7|0,3)*4)|0]}m.pose='stand';m.act='idle';continue}
   if(o.tp&&(o.tp.st!=='park'||o.tp.dead||o.tp.gone)&&o.st!=='idle'){o.st='idle';o.t=time+rnd(1,3);o.tp=null;m.item=null;m.pose='stand';o.path=[]}
   if(o.st==='idle'){if(time<o.t){m.pose='stand';if(!m.moving)m.act='idle';continue}
    const park=A.planes().filter(a=>a.team===t&&a.st==='park'&&!a.dead&&!a.gone),w=park.map(a=>(a.serviceWaiting||a.ready>time)?5:1),tot=w.reduce((s,v)=>s+v,0);if(!tot){o.t=time+rnd(2,5);continue}
    let r=Math.random()*tot,i=0;while(r>w[i]&&i<park.length-1){r-=w[i];i++}const p=park[i];o.tp=p;
    const kinds=['engine','wheel','tail'],k=kinds[(Math.random()*3)|0],T=p.T,spot=k==='engine'?[p.slot.x-14,p.slot.y+T.len/2-10]:k==='wheel'?[p.slot.x+T.span*.2,p.slot.y+8]:[p.slot.x+4,p.slot.y-T.len/2-8];
    o.spot=spot;o.kind=k;const fy=frontY(p);const cans=Math.random()<.35&&af.truck;
    o.path=cans?[[af.truck.x+14,af.truck.y-20],[spot[0],fy],spot]:[[m.x,fy],[spot[0],fy],spot];if(cans)o.carry=true;else o.carry=false;o.st='go'}
   else if(o.st==='go'){const q=o.path[0];if(!q){o.st='work';o.t=time+rnd(4,9);const p=o.tp;m.fac=p?Math.atan2(p.slot.y-m.y,p.slot.x-m.x):0;setAct(m,'idle',o.kind==='engine'?'up':'crouch');m.item=null;continue}
    if(o.carry&&o.path.length===3)m.item=null;if(o.carry&&o.path.length<3)m.item='can';
    if(stepTo(m,q[0],q[1],24,dt))o.path.shift()}
   else if(o.st==='work'){if(time>o.t){o.st='idle';o.t=time+rnd(2,7);m.item=null;m.pose='stand';m.act='idle'}else{const p=o.tp;if(p)m.fac=Math.atan2(p.slot.y-m.y,p.slot.x-m.x)}}}}}
function peoplePass(c,ox,oy,dt){OX=ox;OY=oy;const items=[],pe=A.people();
 for(const q of pe){if(q.act==='seat'||!onS(sx(q.x),sy(q.y),30))continue;if(q.role==='pilot'&&q.alive===false)continue;drawPerson(c,q,items)}
 for(const m of ALL)drawPerson(c,m,items);
 items.sort((a,b)=>a[0]-b[0]);for(const it of items)it[1]();L.stats.drawn=items.length}

/* ======================================================================================
   CHÃO: poeira, capim jogado pela hélice, marcas de roda e capim deitado (gravados no fundo do aeródromo)
   ====================================================================================== */
const GR=[],LAST=new WeakMap(),ACC=new WeakMap(),MK=new WeakMap();
const V=()=>window.PXAWV;
function stamp(side,wx,wy,col,a,w=1,h=1){const v=V(),F=v&&v.airfieldCanvas&&v.airfieldCanvas()[side];let R,x,y;if(F){R=F.c;x=Math.floor((wx-F.x)*Z);y=Math.floor((wy-F.y)*Z)}else{R=v&&v.rear&&v.rear()[side];if(!R)return;x=Math.floor((wx-v.rearX()[side])*Z);y=Math.floor(wy*Z)}if(x<0||y<0||x>=R.width||y>=R.height)return;const g=R.getContext('2d');g.globalAlpha=a;g.fillStyle=col;g.fillRect(x,y,w,h);g.globalAlpha=1}
function puffDust(x,y,vx,vy,r1,a,life){if(AA.puff)AA.puff(x,y,0,vx,vy,life,1,r1,'dust',a)}
function grass(x,y,vx,vy,vz,col){if(GR.length>360)GR.shift();GR.push({x,y,z:1,vx,vy,vz,t:0,max:rnd(.35,.8),col})}
function fxTick(dt){
 for(const p of A.planes()){if(p.dead||p.gone)continue;const prev=LAST.get(p)||{};
  /* pouso: nuvem de pó no toque; partida: fumaça azulada de rícino quando o motor pega */
  if(prev.st==='air'&&p.st==='rollout'){const f=fwd(p);for(let i=0;i<5;i++)puffDust(p.x+rnd(-8,8),p.y+rnd(-6,6),-f[0]*rnd(10,40)+rnd(-14,14),-f[1]*rnd(10,40)+rnd(-14,14),rnd(3,5),.4,rnd(.8,1.5))}
  if(prev.gp==='swing'&&p.gp==='warm'){const vp=AA.vp&&AA.vp(p),f=fwd(p);if(vp&&vp.spr)for(const e of vp.spr.pts.exh.length?vp.spr.pts.exh:[{x:0,y:0}])for(let i=0;i<4;i++)AA.puff(vp.x+e.x/Z,vp.y+e.y/Z,0,-f[0]*rnd(8,30)+rnd(-8,8),-f[1]*rnd(8,30)+rnd(-8,8),rnd(.9,1.6),1,rnd(3,5),p.T.torque?'oil':'exh',.5)}
  LAST.set(p,{st:p.st,gp:p.gp});
  if(p.air||p.st==='park'||p.st==='start')continue;
  const f=fwd(p),l=lft(p),T=p.T,pr=propPt(p),rpm=p.rpm||0,sp=Math.abs(p.gv||0);let acc=(ACC.get(p)||0);
  /* vento da hélice: poeira e capim voam para trás na prova de motor e na corrida */
  if(rpm>.5&&(p.st==='roll'||p.st==='lineup')){acc+=(rpm-.45)*(p.st==='roll'?46:30)*dt;
   while(acc>=1){acc--;const k=rnd(6,34),w=rnd(-1,1)*T.span*.14;
    puffDust(pr[0]-f[0]*k+l[0]*w,pr[1]-f[1]*k+l[1]*w,-f[0]*rnd(20,60)-f[0]*sp*.25+rnd(-10,10),-f[1]*rnd(20,60)-f[1]*sp*.25+rnd(-10,10),rnd(2.5,4.5),clamp(.12+rpm*.2,.1,.34),rnd(.8,1.5));
    if(Math.random()<.7)grass(pr[0]-f[0]*k+l[0]*w,pr[1]-f[1]*k+l[1]*w,-f[0]*rnd(40,110)+rnd(-24,24),-f[1]*rnd(40,110)+rnd(-24,24),rnd(18,50),Math.random()<.6?'#a9b06a':'#7f8a4e')}}
  else if(sp>16){acc+=(p.st==='taxi'||p.st==='taxiin'?.9:.5)*dt*sp*.04;while(acc>=1){acc--;const tx=p.x-f[0]*T.len*.4,ty=p.y-f[1]*T.len*.4;puffDust(tx+rnd(-5,5),ty+rnd(-5,5),-f[0]*rnd(4,14),-f[1]*rnd(4,14),rnd(1.5,2.5),.16,rnd(.6,1))}}
  ACC.set(p,acc);
  /* marcas: rodas principais e bequilha deixam o capim mais escuro; o vento da hélice deixa riscos claros */
  if(sp>5){const st=MK.get(p)||{};const d=hyp(p.x-(st.mx??1e9),p.y-(st.my??1e9));if(d>2.4){st.mx=p.x;st.my=p.y;MK.set(p,st);const side=p.team;
    for(const s of[-1,1])stamp(side,p.x+f[0]*3+l[0]*s*10,p.y+f[1]*3+l[1]*s*10,'#3c4524',.34);
    stamp(side,p.x-f[0]*T.len*.4,p.y-f[1]*T.len*.4,'#3c4524',.25);
    if(rpm>.6&&(p.st==='roll'||p.st==='lineup'))for(let i=0;i<2;i++){const k=rnd(10,60),w=rnd(-1,1)*T.span*.2,wx=pr[0]-f[0]*k+l[0]*w,wy=pr[1]-f[1]*k+l[1]*w;stamp(side,wx,wy,'#8f9b55',.3,Math.abs(f[0])>.7?3:1,Math.abs(f[1])>.7?3:1)}}}}
 for(let i=GR.length-1;i>=0;i--){const g=GR[i];g.t+=dt;if(g.t>g.max){GR.splice(i,1);continue}g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;g.vz-=150*dt;if(g.z<0)g.z=0}}
function grassPass(c,ox,oy){OX=ox;OY=oy;for(const g of GR){const x=sx(g.x),y=sy(g.y)-Math.round(g.z*Z);if(!onS(x,y,2))continue;c.fillStyle=g.col;c.fillRect(x,y,1,1)}}

/* ======================================================================================
   LIGAÇÕES
   ====================================================================================== */
if(window.WW1A){const u0=WW1A.under;WW1A.under=function(c,ox,oy,dt){const r=u0.apply(this,arguments);if(L.on&&A.on&&typeof started!=='undefined'&&started)try{grassPass(c,ox,oy)}catch(e){fail(e)}return r}}
if(window.PLN){const d0=PLN.draw;PLN.draw=function(c,ox,oy,dt){const r=d0.apply(this,arguments);if(L.on&&A.on&&typeof started!=='undefined'&&started){const t0=performance.now();try{peoplePass(c,ox,oy,Math.min(.05,dt||.016))}catch(e){fail(e)}L.stats.ms=L.stats.ms*.95+(performance.now()-t0)*.05}return r}}
if(window.setup){const s0=window.setup;window.setup=function(...a){const r=s0.apply(this,a);try{AMB[0].length=0;AMB[1].length=0;ALL.clear();CR.clear();GR.length=0}catch(e){fail(e)}return r}}
if(window.update){const u0=window.update;window.update=function(dt){const r=u0.apply(this,arguments);if(L.on&&A.on&&typeof started!=='undefined'&&started&&dt>0)try{crewTick(Math.min(dt,.05));ambTick(Math.min(dt,.05));fxTick(Math.min(dt,.05))}catch(e){fail(e)}return r}}
L.state=()=>({on:L.on,figs:L.stats.figs,drawn:L.stats.drawn,ms:+L.stats.ms.toFixed(3),errors:L.stats.errors});
/* folha de contato: todas as figuras ampliadas (para conferir a arte) */
L.sheet=function(){const cv=mk(200,150),x=g2(cv);x.fillStyle='#4b5631';x.fillRect(0,0,200,150);let j=0;
 for(const team of[0,1])for(const role of['p','m']){let i=0;for(const[v,pose]of[['F','stand'],['B','stand'],['S','stand'],['F','crouch'],['S','crouch'],['F','up']]){for(const fr of(pose==='stand'?[0,1,2]:[0])){x.drawImage(figure(role,team,v,fr,pose),4+i*14,4+j*18);i++}}j++}
 return cv};
if(window.IronFront)window.IronFront.airfieldLife=L;
})();
