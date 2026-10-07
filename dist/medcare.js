'use strict';
/* Iron Front 1.11 — refino médico (medcare.js). Carrega DEPOIS de anim-infantry.js, medcare-art.js, casualty.js e art-medics.js: é o
   invólucro MAIS EXTERNO de PHYS.draw para fuzileiros (precisa estar fora do anim-infantry, que só adia quando u.down/u.rs, mas não
   conhece a recuperação). Só desenho e gestos — a simulação do socorro continua em medics.js / casualty.js (que ganharam o pouso no catre,
   a alta visível e o arraste que não emperra).
   Ferido no chão ..... deitado de costas com a orientação em que caiu (de costas, pés para o inimigo), pose conforme a gravidade:
                        leve rasteja com cotovelos e joelhos (e deixa rastro de sangue) ou senta encostado na cobertura apertando a
                        ferida; grave se contorce (joelho dobrado, mão na ferida) e, a cada grito, ergue o braço e acena ~1,4 s;
                        quando alguém vem socorrer estende o braço e grita "AQUI!"; crítico desmaia (cabeça de lado, braço solto).
                        A atadura fica no corpo depois do socorro; poça de sangue que cresce e seca.
   Resgate ............ o resgatador corre, ajoelha à cabeça do ferido, agarra-o pelo colarinho e o ARRASTA DE COSTAS, inclinado, com
                        a passada travada na distância (sem patinar): o ferido de costas, cabeça junto às pernas dele, braços
                        soltos, calcanhares riscando o chão (rastro de poeira e de sangue). Ao chegar ao posto, pousa no catre.
                        O par é desenhado como UM conjunto a partir do resgatador (sem trocar de ordem no y-sort).
   ?medcare=0 desliga · PXMC.state() · PXMC.sheet() · PXMCA (arte). */
(function(){
if(!window.PX||!window.PXMED||!window.PXCAS||!window.PXMCA||!window.IFK||!window.PHYS)return;
const M=PXMED,C=PXCAS,K=IFK,A=PXMCA,Z=PX.Z||.5,hyp=Math.hypot,TAU=Math.PI*2;
const S=window.PXMC={on:!/[?&]medcare=0/.test(location.search)&&C.on&&K.on,version:'1.11',errors:0,
 stats:{ground:0,pair:0,sit:0,crawl:0,errors:0}};
let errs=0;
function fail(e){S.stats.errors++;S.errors++;if(++errs<=3)console.error('medcare.js:',e);if(errs>=12&&S.on){S.on=false;console.error('medcare.js desligado após erros repetidos (volta o desenho do casualty.js / art-medics.js)')}}
const clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const hash=(n,s=0)=>{let h=(n*374761393+s*668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const angd=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const chase=(cur,tgt,rate,dt)=>cur+(tgt-cur)*(1-Math.exp(-rate*dt));
const d16=a=>Math.round((((a%TAU)+TAU)%TAU)/(TAU/16))%16;
const mkc=PX.mk,g2=PX.g2;
const PI=Math.PI;

/* ---------- falas extras (o life-kit.js só tem as básicas; K.lang devolve a própria chave quando não conhece) ---------- */
{const X=[{here:'OVER HERE!',dont:"DON'T LEAVE ME!",thx:'THANKS, DOC!',pull:'COME ON!',easy:'EASY...',almost:'ALMOST THERE!',stay:'STAY WITH ME!',still:'HOLD STILL!',ok:"YOU'RE OKAY!"},
  {here:'HIER!',dont:'LASS MICH NICHT!',thx:'DANKE, SANI!',pull:'KOMM!',easy:'LANGSAM...',almost:'GLEICH GESCHAFFT!',stay:'BLEIB WACH!',still:'STILL HALTEN!',ok:'ALLES GUT!'}];
 const lang0=K.lang;K.lang=(t,k)=>X[t?1:0][k]||lang0(t,k)}

/* ======================================================================================
   ESTADO VISUAL POR FERIDO
   ====================================================================================== */
const VS=new WeakMap();
function vOf(u){let v=VS.get(u);if(!v){const a=(u.angle||0)+(hash(u.id,3)-.5)*.9;v={ang:a,x:u.x,y:u.y,t:time,born:time,wv:u.id%3,gest:null,lastCall:0,lastX:u.x,lastY:u.y,cw:0,kneeT:time+rnd(.5,2),clutch:false,sitSwap:0,reachT:-9,stabT:-9,smearT:0};VS.set(u,v)}return v}
const stepOf=(v,dt)=>{const d=Math.min(dt,.1);return d};

/* poça de sangue que cresce e seca (cache por raio e semente) */
function poolSprite(r,seed){return A.cache.get('pool'+r+'_'+seed)||(()=>{const w=r*2+5,h=Math.ceil(r*1.3)*2+3,c=mkc(w,h),cx=g2(c);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-w/2+.5)/(r+1),dy=(y-h/2+.5)/(r*.68+1),n=(hash(x*7+y*13,seed)-.5)*.5;const d=Math.hypot(dx,dy)+n*.55;if(d>1)continue;
  cx.fillStyle=d>.8?'#4d0b10':d>.45?'#6d0f16':'#8a1219';cx.fillRect(x,y,1,1)}
 cx.fillStyle='#b3171e';const hx=Math.round(w/2-r*.3),hy=Math.round(h/2-r*.25);cx.fillRect(hx,hy,2,1);
 A.cache.set('pool'+r+'_'+seed,{c,ax:w>>1,ay:h>>1});return A.cache.get('pool'+r+'_'+seed)})()}

/* ======================================================================================
   FERIDO NO CHÃO
   ====================================================================================== */
const SH_TOP=[6,3],SH_BOT=[6,12];                       // ombros do corpo deitado (coordenadas locais de A.lying: cabeça à esquerda)
const FACE={lie:'pain',calm:'calm',limp:'closed',shout:'shout'};
function shoulderOff(d,top){/* ombro mais alto na tela (para o braço erguido sair na vertical sem cruzar o corpo) */
 const a=A.lyPt(d,SH_TOP[0],SH_TOP[1]),b=A.lyPt(d,SH_BOT[0],SH_BOT[1]);return top?(a[1]<=b[1]?a:b):(a[1]<=b[1]?b:a)}
function groundKind(u,z){/* 'limp' desmaiado · 'crawl' rasteja · 'sit' sentado na cobertura (leve) · 'lie' deitado */
 if(z.st==='ko'||z.sev==='critical'&&!(time<z.ko))return'limp';
 if(z.st==='crawl')return'crawl';
 if(z.sev==='light'&&(z.st==='cover'||z.cover))return'sit';
 return'lie'}
/* quem está vindo socorrer este ferido (padioleiros a caminho ou companheiro), e a que distância (px de tela) */
function helperNear(u,z){let best=1e9;const cl=u.claimed;if(cl&&cl.x!=null&&(cl.st==='go'))best=Math.min(best,hyp(cl.x-u.x,cl.y-u.y)*Z);
 const r=z.res;if(r&&r.rs&&r.rs.st==='go')best=Math.min(best,hyp(r.x-u.x,r.y-u.y)*Z);return best}

function drawGround(c,u,sx,sy,vis){
 const z=u.cz||{sev:'serious',st:'down',ko:Infinity},v=vOf(u),dt=clamp(time-v.t,0,.1);v.t=time;
 const kind=groundKind(u,z),tm=time-v.born,sev=z.sev||'serious',team=u.team;
 /* centro visual segue a posição simulada sem saltos; direção do corpo vem do rumo da queda (ou do rastejo) */
 v.x=chase(v.x,u.x,14,dt);v.y=chase(v.y,u.y,14,dt);
 const ox=Math.round((v.x-u.x)*Z),oy=Math.round((v.y-u.y)*Z);let X=sx+ox,Y=sy+oy+4;
 const stab=!!z.stab,helper=helperNear(u,z),conscious=kind!=='limp';
 /* gesto de socorro: nasce junto com o grito (z.called é carimbado quando o K.shout vale) */
 if(z.called&&z.called!==v.lastCall){v.lastCall=z.called;if(conscious)v.gest={t0:time,dur:1.5}}
 if(conscious&&helper<95&&!stab&&time-v.reachT>3.5&&kind!=='crawl'){v.reachT=time;v.gest={t0:time,dur:2.2,reach:true};K.shout(u,'here',1.4)}
 const g=v.gest?(time-v.gest.t0)/v.gest.dur:2;if(g>=1)v.gest=null;
 const wound=v.wv,band=stab?(wound===0?1:wound===1?2:3):0;
 /* poça */
 const age=Math.min(1,tm/40),pr=Math.round(2.5+age*(stab?2:4.5)),ps=poolSprite(clamp(pr,3,8),(u.id*3)%8);
 if(kind!=='sit'){c.globalAlpha=.8;c.drawImage(ps.c,X-ps.ax+(u.id&1?-1:1),Y-ps.ay+2);c.globalAlpha=1}
 if(kind==='crawl'){S.stats.crawl++;return drawCrawl(c,u,z,v,X,Y,tm)}
 if(kind==='sit'){S.stats.sit++;return drawSit(c,u,z,v,X,Y-3,g,band,helper)}
 /* corpo deitado */
 const d=d16(v.ang),pose=kind==='limp'?'limp':(!stab&&sev!=='light'&&v.clutch?'clutch':'rest');
 /* serious se contorce: alterna mão-na-ferida / braços soltos */
 if(time>v.kneeT){v.kneeT=time+rnd(1.4,3.2);v.clutch=!v.clutch}
 const face=kind==='limp'?'closed':(g<1&&g>.1)||helper<95&&!stab?'shout':stab?'calm':'pain';
 const gear=A.lyingGear(team,d);if(!v.moved)c.drawImage(gear.c,X-gear.ax,Y-gear.ay);
 const body=A.lying(team,{pose,helmet:'off',band,face},d);
 /* respiração: o corpo sobe 1 px a cada ciclo (mais rápido quanto mais grave) */
 const br=Math.sin(tm*(sev==='serious'&&!stab?3.4:2)+u.id)>.55&&kind!=='limp'?-1:0;
 c.drawImage(body.c,X-body.ax,Y-body.ay+br);
 /* mancha da ferida antes do curativo */
 if(!stab){const loc=wound===0?[7,7]:wound===1?[1,8]:[12,10],o=A.lyPt(d,loc[0],loc[1]);c.fillStyle='#8a1219';c.fillRect(X+o[0],Y+o[1]+br,2,2);c.fillStyle='#d3212a';c.fillRect(X+o[0],Y+o[1]+br,1,1)}
 /* braço erguido */
 const reach=v.gest&&v.gest.reach;
 if(conscious&&(g<1||(helper<95&&!stab))){const k=g<1?(g<.18?g/.18:g>.85?(1-g)/.15:1):1,h=Math.max(0,Math.round(k*4)),sw=reach?0:Math.round(Math.sin(tm*11)*3*Math.min(1,k));
  const sh=shoulderOff(d,true),arm=A.armUp(team,Math.max(1,h),clamp(sw,-3,3));if(h>0)c.drawImage(arm.c,X+sh[0]-arm.ax,Y+sh[1]-arm.ay+br)}
 /* estabilizado, um dedo erguido: "estou bem" quando o médico se afasta */
 if(stab&&conscious&&((time*.35+u.id*.13)%4)<.5){const sh=shoulderOff(d,true),arm=A.armUp(team,2,1,{thumb:true});c.drawImage(arm.c,X+sh[0]-arm.ax,Y+sh[1]-arm.ay+br)}
 S.stats.ground++;return true}

/* rastejando: sprite de bruços do anim-infantry (cotovelos e joelhos alternados), cadência pela distância, rastro de sangue */
function drawCrawl(c,u,z,v,X,Y,tm){const dx=u.x-v.lastX,dy=u.y-v.lastY,dd=hyp(dx,dy);v.lastX=u.x;v.lastY=u.y;if(dd<30)v.cw+=dd;
 const a=Math.atan2(Math.sin(u.angle||0),Math.cos(u.angle||0));v.ang=chase(v.ang,v.ang+angd(a,v.ang),9,.03);
 const ph=Math.floor(v.cw/5)%2,dir=d16(a);let sp=null;if(window.PXINF&&PXINF.prone)sp=PXINF.prone(u.team,dir,ph);
 if(sp)c.drawImage(sp.c,X-sp.ax,Y-sp.ay);else{const b=A.lying(u.team,{pose:'rest',helmet:'on',face:'pain'},dir);c.drawImage(b.c,X-b.ax,Y-b.ay)}
 /* a mão livre procura apoio: rastro de sangue no chão atrás (som de arrasto = poeira) */
 if(dd>.2&&time>v.smearT){v.smearT=time+.18;if(window.BLOOD&&BLOOD.splat)BLOOD.splat(u.x-Math.cos(a)*5,u.y-Math.sin(a)*5,0,0,1,1);
  if(window.particles)particles.push({x:u.x-Math.cos(a)*6,y:u.y-Math.sin(a)*6+2,vx:-Math.cos(a)*6,vy:-2,t:.4,max:.4,color:'#8d7b5a',size:3})}
 return true}

/* sentado encostado na cobertura, de frente, apertando a ferida com uma das mãos; a outra acena ou cai (leve) */
function drawSit(c,u,z,v,X,Y,g,band,helper){const team=u.team,wv=v.wv,tm=time-v.born,wave=(g<1&&g>0)||(helper<95&&!z.stab);
 const sw=wave?clamp(Math.round(Math.sin(tm*10)*2),-2,2):0,up=wave?3:0,slump=((tm*.5+u.id*.2)%3)<.4;
 const sp=A.sitting(team,{wv,stab:!!z.stab||band>0,wave:up?sw:null,face:wave?'shout':'pain',slump});
 c.drawImage(sp.c,X-sp.ax,Y-sp.ay+(slump?1:0));return true}


/* ======================================================================================
   RESGATE: o par resgatador + ferido é desenhado como UM conjunto, a partir do resgatador
   ====================================================================================== */
const PVS=new WeakMap();
function pvOf(r){let p=PVS.get(r);if(!p){p={dir:null,dd:0,lx:r.x,ly:r.y,t:time,wx:null,wy:null,wang:null,k:0,tr:0,heave:0};PVS.set(r,p)}return p}
const INK='#1b1f16';
function linepx(x0,y0,x1,y1){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const out=[],dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;for(;;){out.push([x0,y0]);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}return out}
/* braço de 1 px (manga) com contorno e mão em pele; bend = deslocamento do cotovelo em relação ao ponto médio */
function drawArm(c,team,x0,y0,x1,y1,bend,glove){const P=A.pal(team),ex=(x0+x1)/2+bend[0],ey=(y0+y1)/2+bend[1],seg=[...linepx(x0,y0,ex,ey),...linepx(ex,ey,x1,y1)];
 c.fillStyle=INK;const steep=Math.abs(y1-y0)>Math.abs(x1-x0);for(const[x,y]of seg){if(steep)c.fillRect(x+1,y,1,1);else c.fillRect(x,y+1,1,1)}
 const n=seg.length;seg.forEach(([x,y],i)=>{c.fillStyle=i<n*.45?P.u:P.U;c.fillRect(x,y,1,1)});
 c.fillStyle=glove||P.s;c.fillRect(Math.round(x1),Math.round(y1),1,1);c.fillStyle=P.S;c.fillRect(Math.round(x1)+1,Math.round(y1),1,1)}
/* rumo → vista do resgatador: S (perfil, espelhado se olha para a esquerda), F (olha para a câmera), B (de costas) */
function viewOf(fx,fy){if(Math.abs(fx)>=Math.abs(fy)*.75)return{v:'S',flip:fx<0};return{v:fy>0?'F':'B',flip:false}}
/* figura do resgatador por modo/fase (sem braços: eles são desenhados ao vivo até os ombros do ferido) */
function resFig(team,vw,mode,ph){const {v,flip}=vw;
 if(mode==='kneel'){const o=v==='S'?{legs:'kneel',torso:{arms:false,lean:2,dy:2},head:{dx:2,dy:2},flip}:v==='F'?{legs:'kneel',torso:{arms:false,dy:2},head:{dy:3,crop:5},flip}:{legs:'kneel',torso:{arms:false,dy:2},head:{dy:3},flip};return A.figure(team,v,Object.assign({k:`rk${mode}${v}${flip?1:0}`},o))}
 /* arrasto: 4 fases da passada de costas (apoio, impulso, apoio, impulso); o tronco recua no esforço */
 const LEGS=v==='S'?['stepA','stand','stepB','stand']:['stepL','stand','stepR','stand'],pull=ph===1||ph===3;
 const o=v==='S'?{legs:LEGS[ph],torso:{arms:false,lean:pull?1:2,dy:pull?0:1,dx:pull?-1:0},head:{dx:pull?1:2,dy:pull?1:2},flip}:
  v==='F'?{legs:LEGS[ph],torso:{arms:false,dy:pull?1:2},head:{dy:pull?2:3,crop:pull?5:4},flip}:{legs:LEGS[ph],torso:{arms:false,dy:pull?1:2},head:{dy:pull?1:2},flip};
 return A.figure(team,v,Object.assign({k:`rd${v}${flip?1:0}${ph}`},o))}
/* ombros do resgatador relativos ao pé (px de tela): [esq., dir.] */
function shouldersOf(vw,mode,ph){const {v}=vw,pull=ph===1||ph===3;
 if(v==='S'){const sx=vw.flip?-1:1,dy=mode==='kneel'?-4:pull?-6:-5,ex=mode==='kneel'?3:pull?2:3;return[[sx*ex,dy],[sx*(ex-1),dy+1]]}
 const dy=mode==='kneel'?-4:pull?-5:-4;return[[-3,dy],[3,dy]]}

/* poeira e rastro: o ferido arrastado risca o chão (sulco que some em ~25 s, mais sangue se ainda sangra) */
const TRAIL=[];
function trailAdd(x,y,bleed,t){const L=TRAIL[TRAIL.length-1];if(L&&hyp(L.x-x,L.y-y)<5)return;TRAIL.push({x,y,t,b:bleed});if(TRAIL.length>140)TRAIL.shift()}
function drawTrail(c,ox,oy){if(!TRAIL.length)return;for(let i=TRAIL.length-1;i>=0;i--){const q=TRAIL[i],age=time-q.t;if(age>28){TRAIL.splice(i,1);continue}
 const x=ox+Math.round(q.x*Z),y=oy+Math.round(q.y*Z);if(x<-4||y<-4||x>vw+4||y>vh+4)continue;c.globalAlpha=age>18?(28-age)/10*.55:.55;
 c.fillStyle='#4a3b26';c.fillRect(x-1,y,3,1);c.fillStyle='#5d4a32';c.fillRect(x,y+1,1,1);if(q.b){c.fillStyle='#5a0d12';c.fillRect(x,y,1,1)}}
 c.globalAlpha=1}
if(window.WW1A){const u0=WW1A.under;WW1A.under=function(c,ox,oy,dt){u0.call(this,c,ox,oy,dt);if(!S.on)return;try{drawTrail(c,ox,oy)}catch(e){fail(e)}}}

/* ---------- o conjunto ---------- */
function chaseAng(a,b,k){return a+angd(b,a)*k}
function drawPair(c,r,w,sx,sy,fake){const z=fake||r.rs,st=z.st,P=r.team,pv=pvOf(r),wv=vOf(w),dt=clamp(time-pv.t,0,.1);pv.t=time;
 const mdx=r.x-pv.lx,mdy=r.y-pv.ly,md=hyp(mdx,mdy);pv.lx=r.x;pv.ly=r.y;
 /* sentido da marcha: do deslocamento real (suavizado); parado, mantém */
 if(pv.dir==null){pv.dir=r.ty!=null?Math.atan2(r.ty-r.y,r.tx-r.x):Math.atan2(r.y-w.y,r.x-w.x)}
 if(md>.08&&st==='drag'){const t=Math.atan2(mdy,mdx);pv.dir+=angd(t,pv.dir)*(1-Math.exp(-7*dt))}
 if(st==='drag'&&md<30)pv.dd+=md;
 const Dx=Math.cos(pv.dir),Dy=Math.sin(pv.dir);
 /* centro e direção do ferido (alvos) */
 let tx,ty,tang;const L=22;                              // distância (unidades de mundo) do resgatador ao centro do corpo
 if(pv.wx==null){pv.wx=wv.x;pv.wy=wv.y;pv.wang=wv.ang}
 if(st==='grab'){const a=Math.atan2(r.y-w.y,r.x-w.x);tx=r.x-Math.cos(a)*L;ty=r.y-Math.sin(a)*L;tang=a+PI}
 else if(st==='lay'){const lay=w.cz&&w.cz.lay,to=lay?lay.to:{x:w.x,y:w.y},k=clamp((time-(lay?lay.t0:time))/1.5,0,1),e=k*k*(3-2*k);
  tx=pv.wx+(to.x-pv.wx)*e;ty=pv.wy+(to.y-pv.wy)*e;tang=chaseAng(pv.wang,PI/2,e)}
 else{tx=r.x-Dx*L;ty=r.y-Dy*L;tang=pv.dir+PI}           // drag
 const fast=st==='lay'?18:9;pv.wx=chase(pv.wx,tx,fast,dt);pv.wy=chase(pv.wy,ty,fast,dt);pv.wang=pv.wang+angd(tang,pv.wang)*(1-Math.exp(-fast*.8*dt));
 wv.x=pv.wx;wv.y=pv.wy;wv.ang=pv.wang;wv.t=time;
 /* telas */
 const WXs=sx+Math.round((pv.wx-r.x)*Z),WYs=sy+4+Math.round((pv.wy-r.y)*Z),RX=sx,RY=sy+6;
 /* ferido: corpo deitado de costas, capacete no lugar */
 const dW=d16(pv.wang),stab=!!(w.cz&&w.cz.stab),body=A.lying(w.team,{pose:'rest',helmet:'on',band:stab?(wv.wv===0?1:wv.wv===1?2:3):0,face:(st==='drag'&&((pv.dd*.04)%1)<.35)?'pain':'closed'},dW);
 c.drawImage(body.c,WXs-body.ax,WYs-body.ay);
 /* resgatador */
 const dx=pv.wx-r.x,dy=pv.wy-r.y,vwv=viewOf(dx,dy),ph=st==='drag'?Math.floor(pv.dd/6)&3:0,mode=st==='drag'||st==='lay'?'bend':'kneel';
 const fig=resFig(P,vwv,mode,ph);c.drawImage(fig.c,RX-fig.ax,RY-fig.ay);
 /* braços: dos ombros até os ombros do ferido (um de cada lado do pescoço) */
 const sh=shouldersOf(vwv,mode,ph),hT=A.lyPt(dW,6,4),hB=A.lyPt(dW,6,12);
 const pts=[[WXs+hT[0],WYs+hT[1]],[WXs+hB[0],WYs+hB[1]]];
 const s0=[RX+sh[0][0],RY+sh[0][1]],s1=[RX+sh[1][0],RY+sh[1][1]];
 const straight=(s0[0]-pts[0][0])**2+(s0[1]-pts[0][1])**2+(s1[0]-pts[1][0])**2+(s1[1]-pts[1][1])**2,cross=(s0[0]-pts[1][0])**2+(s0[1]-pts[1][1])**2+(s1[0]-pts[0][0])**2+(s1[1]-pts[0][1])**2;
 const hands=straight<=cross?[pts[0],pts[1]]:[pts[1],pts[0]],pull=st==='drag'&&(ph===1||ph===3);
 drawArm(c,P,s0[0],s0[1],hands[0][0],hands[0][1],[dy>=0?1:-1,pull?0:1]);drawArm(c,P,s1[0],s1[1],hands[1][0],hands[1][1],[dy>=0?-1:1,pull?0:1]);
 /* calcanhares riscam o chão: sulco, poeira e (se ainda sangra) pingos */
 if(st==='drag'&&md>.05){const fa=pv.wang,fxw=pv.wx+Math.cos(fa)*9,fyw=pv.wy+Math.sin(fa)*9;trailAdd(fxw,fyw,!stab,time);
  if(Math.random()<dt*7&&window.particles)particles.push({x:fxw+rnd(-2,2),y:fyw+rnd(0,3),vx:Dx*-8+rnd(-4,4),vy:rnd(-5,-1),t:.45,max:.45,color:'#8d7b5a',size:3})}
 S.stats.pair++;return true}

/* ---------- primeiros socorros: o médico ajoelha ao lado do peito, abre a bolsa e enfaixa; o ferido relaxa ---------- */
const AIDV=new WeakMap();
function aidOf(u){/* {w, f 0..1} se esta unidade está prestando primeiros socorros agora (IA ou jogador) */
 const z=u.rs;if(z&&z.st==='aid'&&z.w&&z.w.down)return{w:z.w,f:1-clamp(z.t/C.cfg.AID,0,1)};
 const pd=u===player&&C.pd&&C.pd();if(pd&&pd.st==='aid'&&pd.w&&pd.w.down)return{w:pd.w,f:1-clamp(pd.t/C.cfg.AID,0,1)};return null}
function drawAid(c,r,a,sx,sy){const w=a.w,f=a.f,P=r.team,wv=vOf(w),av=AIDV.get(r)||(AIDV.set(r,{x:null,y:null,t:time}),AIDV.get(r)),dt=clamp(time-av.t,0,.1);av.t=time;
 /* orientação do ferido fixa; o médico fica do lado em que está */
 const d=d16(wv.ang),wp0=wv.wv===0?[7,8]:wv.wv===1?[1,8]:[12,10],Wp=A.lyPt(d,wp0[0],wp0[1]);
 const WXs=sx+Math.round((w.x-r.x)*Z),WYs=sy+4+Math.round((w.y-r.y)*Z),px_=WXs+Wp[0],py_=WYs+Wp[1];
 const axis=A.lyPt(d,10,8),ax=axis[0]/(hyp(axis[0],axis[1])||1),ay=axis[1]/(hyp(axis[0],axis[1])||1);                  // do ferido para os pés
 let nx=-ay,ny=ax;if((r.x-w.x)*nx+(r.y-w.y)*ny<0){nx=-nx;ny=-ny}                                                   // normal do lado do médico
 if(Math.abs(ny)>.5&&Math.abs(nx)<.5)ny=ny<0?-1:1;
 const tx=px_+nx*5,ty=py_+ny*5;
 if(av.x==null){av.x=sx;av.y=sy+6}av.x=chase(av.x,tx,12,dt);av.y=chase(av.y,ty,12,dt);
 const RX=Math.round(av.x),RY=Math.round(av.y),tm=time-wv.born;
 /* corpo do ferido (atadura final só quando termina; durante o socorro desenhamos o enrolar) */
 const band=f>.97?(wv.wv===0?1:wv.wv===1?2:3):0,face=f<.2?'pain':f>.8?'calm':'pain';
 const body=A.lying(w.team,{pose:'rest',helmet:'off',band,face},d);
 const gear=A.lyingGear(w.team,d);c.drawImage(gear.c,WXs-gear.ax,WYs-gear.ay);
 const pr=poolSprite(clamp(Math.round(3+Math.min(1,tm/40)*2),3,8),(w.id*3)%8);c.globalAlpha=.8;c.drawImage(pr.c,WXs-pr.ax,WYs-pr.ay+2);c.globalAlpha=1;
 c.drawImage(body.c,WXs-body.ax,WYs-body.ay);
 /* bolsa aberta ao lado dos pés do ferido, do lado do médico */
 const bag=A.medBag(f>.12);c.drawImage(bag.c,Math.round(px_+nx*7+ax*9)-bag.ax,Math.round(py_+ny*7+ay*9)-bag.ay+3);
 /* o médico: vista conforme onde está em relação ao ferido */
 const vw=viewOf(px_-RX,py_-RY),fig=resFig(P,vw,'kneel',0);
 const bob=f>.25&&f<.85?(Math.sin(tm*14)>0?0:0):0;c.drawImage(fig.c,RX-fig.ax,RY-fig.ay+bob);
 /* mãos no ferimento: pulso no pescoço (início), enrola (meio), bate no ombro (fim) */
 const sh=shouldersOf(vw,'kneel',0);let hx=px_,hy=py_,hx2=px_,hy2=py_;
 if(f<.2){const nk=A.lyPt(d,6,8);hx=WXs+nk[0];hy=WYs+nk[1];hx2=hx+1;hy2=hy+1}
 else if(f<.87){const k=(f-.2)/.67,sw=Math.sin(tm*12)*2.2,cwv=Math.cos(tm*12)*1.2;hx=px_+ax*sw*(1)+nx*cwv;hy=py_+ay*sw+ny*cwv;hx2=px_-ax*sw+nx*(-cwv);hy2=py_-ay*sw+ny*(-cwv);
  const wb=A.wrapBand;wb(c,Math.round(px_),Math.round(py_),k,Math.abs(ax)>.6)}
 else{const sd=A.lyPt(d,5,5);hx=WXs+sd[0];hy=WYs+sd[1];hx2=px_;hy2=py_}
 drawArm(c,P,RX+sh[0][0],RY+sh[0][1],hx,hy,[nx>0?-1:1,0]);drawArm(c,P,RX+sh[1][0],RY+sh[1][1],hx2,hy2,[nx>0?1:-1,0]);
 S.stats.aid=(S.stats.aid||0)+1;return true}
S.drawAid=drawAid;
S.drawPair=drawPair;S.pvOf=pvOf;S.vOf=vOf;S.resFig=resFig;S.viewOf=viewOf;
S.groundDraw=drawGround;
/* ---------- ligação com PHYS.draw (mais externo) ---------- */
{const d0=PHYS.draw||(()=>false);
 PHYS.draw=function(c,u,sp,sx,sy,vis,bob){
  if(!S.on||(u.type!=='rifle'&&u.type!=='mg'))return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
  try{
   /* resgatador em ação: grab (ajoelha), drag (arrasta de costas), lay (pousa no catre) — o ferido é desenhado junto */
   const rz=u.rs;if(rz&&rz.w&&rz.w.down&&(rz.st==='grab'||rz.st==='drag'||rz.st==='lay')){u.hitT=0;return drawPair(c,u,rz.w,sx,sy)}
   const pd=u===player&&C.pd&&C.pd();if(pd&&pd.w&&pd.w.down&&(pd.st==='grab'||pd.st==='drag')){u.hitT=0;return drawPair(c,u,pd.w,sx,sy,{st:pd.st,w:pd.w})}      // o jogador (modo soldado) arrastando
   const aid=aidOf(u);if(aid){u.hitT=0;return drawAid(c,u,aid,sx,sy)}
   if(u.down&&!u.carried&&!u.inBed){const z=u.cz;
    const res=z&&z.res,pd0=res===player&&C.pd&&C.pd();if(res&&((res.rs&&res.rs.w===u&&(res.rs.st==='grab'||res.rs.st==='drag'||res.rs.st==='aid'))||aidOf(res)&&aidOf(res).w===u||pd0&&pd0.w===u&&(pd0.st==='grab'||pd0.st==='drag'))){u.hitT=0;return true}       // desenhado com o resgatador
    const cl=u.claimed;if(cl&&cl.st==='load'&&cl.u===u&&cl.t!=null&&(1-cl.t/M.cfg.LOAD)>=.2){u.hitT=0;return true}      // já está na maca (a maca desenha)
    u.hitT=0;return drawGround(c,u,sx,sy,vis)}
   if(u.down&&u.cz&&u.cz.st==='recover'&&u.cz.rec&&u.cz.rec.where==='field'&&window.PXMCH&&PXMCH.on&&PXMCH.fieldRise(c,u,sx,sy)){u.hitT=0;return true}
   if(u.down&&(u.carried||u.inBed)){u.hitT=0;return true}                   // na maca, no catre ou em recuperação: quem desenha é o hospital/padioleiros
  }catch(e){fail(e)}
  return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}
const PXMC_dummy=0;
S.state=()=>({on:S.on,errors:S.errors,stats:{...S.stats}});
if(window.IronFront)window.IronFront.medcare=S;
})();
