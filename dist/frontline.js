'use strict';
/* Iron Front 1.3 — atrito da frente: lama, calor das metralhadoras, emperramento e reconhecimento aéreo.
   Carrega DEPOIS de sappers.js (e antes do ui-art.js). Não altera game.js: envolve setup / update / shoot / explode / damage /
   place / choose / makeCards / icon, Brain.selectTarget e PXBAT.mission, e desenha em WW1A.over como physics/sappers/battery.
   1  Lama ........ chuva → terreno (PXW.mudAt): infantaria a ~40% da velocidade e sem corrida; tanques atolam em crateras
                    encharcadas (mobility kill); 1 a cada 5 projéteis em lama saturada não detona (UXO no chão) ou é abafado
                    (raio letal −75% e gêiser de terra negra).
   2  MG .......... camisa d'água de 4 L: a água ferve aos 100 °C (vapor denuncia a posição e atrai fogo inimigo); sem água o
                    cano trava até a troca (20 s vulneráveis). Um municiador corre até a trincheira da retaguarda buscar água.
   3  Sujeira ..... u.atr.dirt sobe na lama e perto de explosões; chance de emperrar 1% → 18%; desengasgar leva 2–3 s.
   4  Observação .. APOIO › Reconhecimento (tecla 5): biplano orbita o setor por ~55 s; artilharia amiga no setor erra 75% menos
                    e a névoa de guerra some ali. Flak (2 canhões de 75 mm por lado) e MGs próximas tentam derrubá-lo.
   Desliga com ?frente=0 na URL ou PXFL.on=false. Estado por unidade em u.atr. Coordenadas em unidades do mundo (2400×1600);
   o desenho usa pixels de arte (1 px = 2 unidades, PX.Z). */
(function(){
if(!window.PX)return;
const Z=PX.Z||.5,hyp=Math.hypot,PI=Math.PI;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const angDiff=(a,b)=>{let d=(a-b)%(2*PI);if(d>PI)d-=2*PI;else if(d<-PI)d+=2*PI;return d};
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('frontline.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};

/* ---------- parâmetros ---------- */
const CFG={
 MUD:{INF:.465,CAV:.7,NOSPRINT:1.65,DUD:.2,FROM:.2,SPAN:.7,MUFFLE:.25,MUFFLE_POW:.6,UXO:40,
      BOG_RATE:.35,BOG_MIN:.3,BOG_T:[8,13],BOG_FREE:6,BOG_OPEN:.25},
 MG:{WAT:4,AMB:15,HEAT:.85,COOL:.013,BOIL:100,STEAM:95,EVAP:.02,LOW:1.0,SWAP:20,T_AFTER:45,WAT_AFTER:2.2,RUN:55,FILL:2.5,DMG_SWAP:1.5,HUNT:.85},
 JAM:{BASE:.01,MAX:.18,T:[2,3],DMG:1.25,NEAR:30,MG_SCALE:.15,NEAR_DIRT:.6,MUD_MOVE:.05,MUD_STAND:.012,CLEAN:.02},
 AIR:{HP:100,V:125,ORBIT:55,RX:300,RY:190,SEC:380,SPREAD:.25,COST:120,ALT:46,FALL:2.4,
      FLAK_R:720,FLAK_CD:1.8,FLAK_FLY:.65,FLAK_DMG:34,FLAK_HP:260,HIT_R:26,
      MG_R:320,MG_P:.05,MG_DMG:7,AI_EVERY:[45,80]}};
const C=CFG.MUD,G=CFG.MG,J=CFG.JAM,A=CFG.AIR;
const FL=window.PXFL={on:!/[?&]frente=0/.test(location.search),version:'1.3',cfg:CFG,stats:{errors:0,duds:0,muffled:0,bogs:0,jams:0,seizures:0,downed:0,flakShots:0,flakHits:0,launched:0},mudForce:null};
let errs=0;function fail(e){FL.stats.errors++;if(++errs<=3)console.error('frontline.js:',e);if(errs>=12){FL.on=false;console.error('frontline.js desligado após erros repetidos')}}

const M=(x,y)=>FL.mudForce!=null?FL.mudForce:(window.PXW&&PXW.mudAt?PXW.mudAt(x,y):0);
const st=e=>e.atr||(e.atr={T:G.AMB+5,wat:G.WAT,dirt:0,clearUntil:0,swapUntil:0,seized:false,run:null,bog:0,free:0,steam:false});
const mine=t=>typeof playerTeam==='number'&&t===playerTeam;
const say=(t,msg)=>{if(mine(t)&&typeof toast==='function')toast(msg)};
const snd=k=>{try{if(typeof sound==='function')sound(k)}catch(e){}};
const grounded=()=>{const w=window.PXW&&PXW.state;return!!w&&((w.cur==='storm'&&w.I>.9)||w.fog>.7)};

/* ---------- estado ---------- */
let FX=[],UXO=[],SP=[],AAG=[],BURST=[],WRECK=[],STEAMERS=[],callAt=[0,0],spSerial=0,noteAt={};
const note=(k,t,msg,gap=8)=>{if(!mine(t)||(noteAt[k]||-99)>time-gap)return;noteAt[k]=time;if(typeof toast==='function')toast(msg)};
function reset(){FX=[];UXO=[];SP=[];BURST=[];WRECK=[];STEAMERS=[];noteAt={};spSerial=0;callAt=[time+rnd(...A.AI_EVERY),time+rnd(...A.AI_EVERY)];buildFlak();
 if(typeof defs==='object'&&!defs.recon)defs.recon={name:'Reconhecimento',sub:'Observador · artilharia erra −75%',cost:A.COST}}
function buildFlak(){AAG=[];for(let team=0;team<2;team++)for(let k=0;k<2;k++){const x=team?W-rnd(300,390):rnd(300,390),y=H*(k?.68:.32)+rnd(-90,90);
 AAG.push({team,x,y,hp:A.FLAK_HP,cd:rnd(0,1),lock:0,idle:9,flash:0,ang:team?PI:0})}}

/* ---------- efeitos próprios (mundo → arte: x·Z) ---------- */
const fxAdd=o=>{if(FX.length<700){o.t=0;FX.push(o)}};
function fxStep(dt){for(let i=FX.length-1;i>=0;i--){const p=FX[i];p.t+=dt;if(p.t>=p.max){FX[i]=FX[FX.length-1];FX.pop();continue}
  p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;if(p.vz!==undefined){p.z=(p.z||0)+p.vz*dt;p.vz-=(p.g===undefined?220:p.g)*dt;if(p.z<0&&p.k==='clod'){p.z=0;p.vz=0;p.vx*=.3;p.vy*=.3}}
  if(p.k==='steam'||p.k==='smoke'||p.k==='flak'){const w=window.PXW&&PXW.windVec?PXW.windVec():null;if(w){p.x+=w.x*dt*.5;p.y+=w.y*dt*.5}}}}
function spout(x,y,size,dark){ // gêiser de terra úmida: coluna escura + torrões
 fxAdd({k:'geys',x,y,max:.95,h:16+size*22,w:2+size*3});
 for(let i=0;i<8+size*10;i++)fxAdd({k:'clod',x:x+rnd(-4,4),y:y+rnd(-3,3),vx:rnd(-30,30)*size,vy:rnd(-18,18)*size,z:rnd(0,6),vz:rnd(60,150)*(.5+size*.5),max:rnd(.6,1.3),col:i%3?'#2a2017':'#4a3826',sz:Math.random()<.35?2:1});
 if(!dark)for(let i=0;i<4;i++)fxAdd({k:'smoke',x:x+rnd(-5,5),y:y+rnd(-5,5),vx:rnd(-6,6),vy:rnd(-10,-2),max:rnd(.8,1.5),size:3+size*3,a:.35,col:'#7d6d55'})}

/* ---------- 1 · lama: duds, abafamento, UXO ---------- */
function dudAt(x,y,r,team){FL.stats.duds++;UXO.push({x,y,team,big:r>=62,a:rnd(-.7,.7),t0:time});if(UXO.length>C.UXO)UXO.shift();spout(x,y,.7,true);snd('click')}
function nearBlast(x,y,r,power){for(const u of units){if(u.hp<=0||u.type==='tank')continue;if(hyp(u.x-x,u.y-y)<J.NEAR&&(u.type==='rifle'||u.type==='mg')){const a=st(u);a.dirt=Math.min(1,a.dirt+J.NEAR_DIRT*(power>40?1:.5))}}
 for(const g of AAG)if(g.hp>0&&hyp(g.x-x,g.y-y)<r+8){g.hp-=power*(1-hyp(g.x-x,g.y-y)/(r+8))*1.3;if(g.hp<=0){spout(g.x,g.y,1.2,false);note('aak'+g.team,1-g.team,'Canhão antiaéreo inimigo destruído.',4)}}}
const RAW=window.explode;
wrap('explode',(orig,x,y,r,power=100,team=0)=>{
 if(!FL.on||!(power>0)||r<30)return orig(x,y,r,power,team);
 let sat=0;try{sat=clamp((M(x,y)-C.FROM)/C.SPAN,0,1)}catch(e){fail(e)}
 if(sat>0&&Math.random()<C.DUD*sat){
  if(Math.random()<.5){try{dudAt(x,y,r,team)}catch(e){fail(e)}return}                 // enterrou fundo: não detona
  FL.stats.muffled++;try{spout(x,y,1.25,false)}catch(e){fail(e)}                       // abafada: raio letal −75%
  const v=orig(x,y,r*C.MUFFLE,power*C.MUFFLE_POW,team);try{nearBlast(x,y,r*C.MUFFLE,power)}catch(e){fail(e)}return v}
 const v=orig(x,y,r,power,team);try{nearBlast(x,y,r,power)}catch(e){fail(e)}return v});

/* ---------- 2/3 · metralhadora: calor, água, emperramento ---------- */
const isGun=e=>e.type==='mg'||e.type==='bunker';
function heat(e,a){const k=G.HEAT*G.WAT/Math.max(.6,a.wat);
 if(a.T<G.BOIL-1.5)a.T=Math.min(G.BOIL,a.T+k);else{a.T=G.BOIL;a.wat=Math.max(0,a.wat-G.EVAP)}
 if(a.wat<=0&&!a.seized){a.seized=true;a.swapUntil=time+G.SWAP;a.run=null;FL.stats.seizures++;
  say(e.team,'Metralhadora sem água: o cano travou. Troca do cano em '+G.SWAP+' s.');fxAdd({k:'steam',x:e.x,y:e.y-4,vx:rnd(-4,4),vy:-8,z:8,vz:14,g:0,max:1.6,size:5})}}
function waterPoint(e){const rear=e.team?1:-1;let best=null,bd=1e9;
 for(const t of fieldTrenches||[]){if(t.team!==e.team||(t.x-e.x)*rear<70)continue;const d=hyp(t.x-e.x,t.y-e.y);if(d<bd&&d<760){bd=d;best=t}}
 return best?{x:best.x,y:best.y}:{x:e.x+rear*160,y:e.y+rnd(-30,30)}}
function startRun(e,a){const p=waterPoint(e),d=hyp(p.x-e.x,p.y-e.y),m=M(e.x,e.y),sp=G.RUN*(1-.55*m);
 a.run={t0:time,dur:clamp(2*d/sp+G.FILL,6,38),ox:e.x,oy:e.y,bx:p.x,by:p.y}}
function gunTick(e,dt){const a=st(e);
 a.T=Math.max(G.AMB,a.T-(a.T-G.AMB)*G.COOL*dt);a.steam=a.T>=G.STEAM&&a.wat>0&&!a.seized;
 if(a.seized&&time>=a.swapUntil){a.seized=false;a.swapUntil=0;a.T=G.T_AFTER;a.wat=G.WAT_AFTER;say(e.team,'Cano trocado: metralhadora de volta ao combate.')}
 if(a.run&&time-a.run.t0>=a.run.dur){a.wat=G.WAT;a.T=Math.min(a.T,40);a.run=null}
 else if(!a.run&&!a.seized&&a.wat<=G.LOW)startRun(e,a);
 if(a.steam){if(Math.random()<dt*(a.T>=G.BOIL-.5?16:7))fxAdd({k:'steam',x:e.x+Math.cos(e.angle||0)*7,y:e.y-2,vx:rnd(-5,5),vy:rnd(-9,-2),z:8,vz:rnd(14,26),g:0,max:rnd(1.1,2.1),size:rnd(2.6,4.8)});
  if(a.T>=G.BOIL-.5)note('hot'+e.id,e.team,'Metralhadora fervendo: o vapor entrega a posição.',12)}}
/* emperramento: sujeira dos fuzileiros e das MG */
const jammable=u=>u.type==='rifle'||u.type==='mg';
function dirtTick(u,dt){const a=st(u),m=M(u.x,u.y);
 if(m>.45)a.dirt=Math.min(1,a.dirt+dt*(u.moving?J.MUD_MOVE:J.MUD_STAND)*m);else a.dirt=Math.max(0,a.dirt-dt*J.CLEAN)}
const jamP=(a,u)=>(J.BASE+(J.MAX-J.BASE)*a.dirt)*(u&&u.type==='mg'?J.MG_SCALE:1);
function startJam(u,a){FL.stats.jams++;a.clearUntil=time+rnd(...J.T);a.dirt*=.6;u.cd=Math.max(u.cd,a.clearUntil-time);snd('bolt');
 fxAdd({k:'spark',x:u.x+Math.cos(u.angle||0)*8,y:u.y-2,vx:rnd(-14,14),vy:rnd(-14,-4),z:6,vz:rnd(20,45),max:.25});
 if(u===player)say(u.team,'Arma emperrada! Desengasgando o ferrolho…')}
/* o jogador em modo soldado pode mirar no biplano */
function aimAtPlane(){if(typeof mode==='undefined'||mode!=='soldier'||!player)return null;
 for(const p of SP){if(p.team===player.team||p.st==='down')continue;const v=vis(p);if(hyp(mouse.wx-v.x,mouse.wy-v.y)<70&&hyp(player.x-p.x,player.y-p.y)<440)return p}return null}
wrap('shoot',(orig,u,target,manual)=>{
 if(!FL.on||u.type==='tank'||u.type==='cavalry')return orig(u,target,manual);
 try{const a=st(u);
  if(a.swapUntil>time||a.seized){u.cd=Math.max(u.cd,.35);return}
  if(a.clearUntil>time){u.cd=Math.max(u.cd,a.clearUntil-time);return}
  const arm=manual&&typeof weapon!=='undefined'?weapon:'';
  if(jammable(u)&&arm!=='pistol'&&Math.random()<jamP(a,u)){startJam(u,a);return}
  if(manual&&u===player){const p=aimAtPlane();if(p)hitPlane(p,arm==='rifle'?14:arm==='smg'?6:5,u.team,Math.random()<(arm==='rifle'?.1:arm==='smg'?.05:.02))}}catch(e){fail(e)}
 const n=bullets.length,r=orig(u,target,manual);
 try{if(u.type==='mg'&&bullets.length>n)heat(u,st(u))}catch(e){fail(e)}return r});
wrap('damage',(orig,u,n,attacker)=>{if(FL.on&&u&&u.atr&&u.hp>0){const a=u.atr;if(a.swapUntil>time)n*=G.DMG_SWAP;else if(a.clearUntil>time)n*=J.DMG}return orig(u,n,attacker)});
/* vapor vira alvo: soldados inimigos preferem a metralhadora que está fervendo */
if(window.IronFrontBrain&&IronFrontBrain.selectTarget){const o=IronFrontBrain.selectTarget;
 IronFrontBrain.selectTarget=function(u,us,range,canHit){const t=o.apply(this,arguments);if(!FL.on||!STEAMERS.length||u.type==='tank')return t;
  try{const full=(typeof defs==='object'&&defs[u.type]?defs[u.type].range:range)*G.HUNT;let best=null,bd=1e9;
   for(const s of STEAMERS){if(s.team===u.team||s.hp<=0)continue;const d=hyp(s.x-u.x,s.y-u.y);if(d<full&&d<bd&&(!canHit||canHit(u,s))){bd=d;best=s}}
   if(best&&(!t||bd<hyp(t.x-u.x,t.y-u.y)*1.5))return best}catch(e){fail(e)}return t}}

/* ---------- 4 · reconhecimento aéreo e flak ---------- */
const altW=p=>p.alt/Z;
function vis(p){return{x:p.x,y:p.y-altW(p)}}
function launch(team,x,y){const cx=clamp(x,A.SEC*.7,W-A.SEC*.7),cy=clamp(y,A.RY+40,H-A.RY-40),phi0=team?0:PI,
  p={id:++spSerial,team,hp:A.HP,x:team?W+140:-140,y:clamp(cy+rnd(-120,120),90,H-90),cx,cy,st:'in',phi:phi0,dir:team?-1:1,orb:0,ang:team?PI:0,alt:A.ALT,fall:0,vx:0,vy:0,seen:false};
 SP.push(p);FL.stats.launched++;return p}
function spStep(p,dt){const t=(x,y,v)=>{const dx=x-p.x,dy=y-p.y,d=hyp(dx,dy)||1,s=Math.min(d,v*dt);p.vx=dx/d*v;p.vy=dy/d*v;p.x+=dx/d*s;p.y+=dy/d*s;return d-s};
 if(p.st==='in'){const ex=p.cx+A.RX*Math.cos(p.phi),ey=p.cy+A.RY*Math.sin(p.phi);if(t(ex,ey,A.V)<6){p.st='orbit';p.orb=0;if(!p.seen){p.seen=true;say(p.team,'Observador sobre o setor: artilharia erra −75% e a névoa some ali.')}}}
 else if(p.st==='orbit'){p.orb+=dt;const sx=-A.RX*Math.sin(p.phi),sy=A.RY*Math.cos(p.phi),ds=hyp(sx,sy)||1;p.phi+=p.dir*A.V/ds*dt;
  const nx=p.cx+A.RX*Math.cos(p.phi),ny=p.cy+A.RY*Math.sin(p.phi);p.vx=(nx-p.x)/dt;p.vy=(ny-p.y)/dt;p.x=nx;p.y=ny;if(p.orb>=A.ORBIT){p.st='out';say(p.team,'Observador deixou o setor.')}}
 else if(p.st==='out'){t(p.team?W+260:-260,p.y,A.V*1.15);if(p.team?p.x>W+200:p.x<-200)p.dead=true}
 else if(p.st==='down'){p.fall+=dt;p.alt=A.ALT*Math.max(0,1-p.fall/A.FALL);p.x+=p.vx*dt*.7;p.y+=p.vy*dt*.7;p.ang+=dt*7;
  if(Math.random()<dt*40)fxAdd({k:'smoke',x:p.x,y:p.y-altW(p),vx:rnd(-8,8),vy:rnd(-8,4),max:rnd(1.6,3),size:rnd(3,6),a:.6,col:Math.random()<.4?'#e8822a':'#1c1a17'});
  if(p.fall>=A.FALL){p.dead=true;RAW(p.x,p.y,44,70,1-p.team);spout(p.x,p.y,1,false);WRECK.push({x:p.x,y:p.y,team:p.team,t:90,a:rnd(0,6.28)});if(WRECK.length>10)WRECK.shift()}}
 if(p.st!=='down'){const h=Math.atan2(p.vy,p.vx);if(p.vx||p.vy)p.ang+=clamp(angDiff(h,p.ang),-2.2*dt,2.2*dt);
  if(p.hp<55&&Math.random()<dt*(p.hp<30?26:11))fxAdd({k:'smoke',x:p.x,y:p.y-altW(p),vx:rnd(-6,6),vy:rnd(-6,2),max:rnd(1,2),size:rnd(2,4),a:.5,col:p.hp<30?'#1c1a17':'#6a655c'})}}
function hitPlane(p,dmg,by,real=true){if(p.st==='down'||p.dead)return;const v=vis(p);
 fxAdd({k:'spark',x:v.x+rnd(-6,6),y:v.y+rnd(-4,4),vx:rnd(-20,20),vy:rnd(-20,5),z:0,vz:0,g:0,max:.3});
 if(!real)return;p.hp-=dmg;snd('ping');
 if(p.hp<=0){p.st='down';p.fall=0;FL.stats.downed++;if(typeof teamKills!=='undefined'&&by!==p.team)teamKills[by]++;
  say(p.team,'Seu avião de observação foi abatido!');say(1-p.team,'Avião de observação inimigo abatido!')}}
const spotted=(team,x,y)=>SP.some(p=>p.team===team&&p.st!=='down'&&hyp(p.x-x,p.y-y)<=A.SEC);
function aaTick(dt){
 /* flak: cada canhão ajusta a mira (lock) enquanto o alvo está no alcance; o tiro leva ~0,65 s e leva em conta a velocidade */
 for(const g of AAG){g.flash=Math.max(0,g.flash-dt);if(g.hp<=0)continue;let tgt=null,bd=A.FLAK_R;
  for(const p of SP)if(p.team!==g.team&&p.st!=='down'){const d=hyp(p.x-g.x,p.y-g.y);if(d<bd){bd=d;tgt=p}}
  if(!tgt){g.idle+=dt;if(g.idle>3)g.lock=0;continue}
  g.idle=0;g.lock+=dt;g.cd-=dt;const v=vis(tgt);g.ang=Math.atan2(v.y-g.y,v.x-g.x);
  if(g.cd<=0){g.cd=A.FLAK_CD*rnd(.9,1.3);g.flash=.12;FL.stats.flakShots++;
   const err=Math.max(A.HIT_R,38+bd*.2+Math.max(0,70-g.lock*6)),a=rnd(0,2*PI),rr=Math.sqrt(Math.random())*err;
   BURST.push({at:time+A.FLAK_FLY,x:v.x+tgt.vx*A.FLAK_FLY+Math.cos(a)*rr,y:v.y+tgt.vy*A.FLAK_FLY+Math.sin(a)*rr,team:g.team,p:tgt});
   fxAdd({k:'smoke',x:g.x+Math.cos(g.ang)*8,y:g.y-6,vx:rnd(-4,4),vy:-6,max:.9,size:3,a:.5,col:'#8b8a80'});
   if(hyp(g.x-cam.x,g.y-cam.y)<1000)snd('boom')}}
 for(let i=BURST.length-1;i>=0;i--){const b=BURST[i];if(time<b.at)continue;BURST.splice(i,1);
  fxAdd({k:'flak',x:b.x,y:b.y,vx:rnd(-3,3),vy:rnd(-5,-1),max:rnd(5,8),size:rnd(5,8),seed:Math.random()*9});
  const p=b.p;if(p&&p.st!=='down'){const v=vis(p);if(hyp(b.x-v.x,b.y-v.y)<A.HIT_R){FL.stats.flakHits++;hitPlane(p,A.FLAK_DMG,b.team)}}}
 /* metralhadoras apontadas para o céu: só quem não tem alvo no chão */
 if(!SP.length)return;
 const engage=(e,isB)=>{if(e.hp<=0)return;const a=st(e);if(a.swapUntil>time||a.seized)return;if(e.cd>0)return;
  let tgt=null,bd=A.MG_R;for(const p of SP)if(p.team!==e.team&&p.st!=='down'){const d=hyp(p.x-e.x,p.y-e.y);if(d<bd){bd=d;tgt=p}}
  if(!tgt)return;const busy=e.target&&e.target.hp>0&&hyp(e.target.x-e.x,e.target.y-e.y)<(isB?360:(defs.mg.range||330));if(busy)return;
  const v=vis(tgt);e.cd=isB?.2:defs.mg.rate;if(!isB)e.angle=Math.atan2(v.y-e.y,v.x-e.x);
  heat(e,a);fxAdd({k:'tr',x:e.x,y:e.y-4,x1:v.x+rnd(-10,10),y1:v.y+rnd(-10,10),max:.1});
  hitPlane(tgt,A.MG_DMG,e.team,Math.random()<A.MG_P*(1-bd/(A.MG_R*1.4)))};
 for(const u of units)if(u.type==='mg')engage(u,false);
 for(const b of buildings)if(b.type==='bunker')engage(b,true)}
function revealFog(){const f=window.PXW&&PXW.fow;if(!f||!f.on||!f.grid)return;
 for(const p of SP){if(p.team!==f.team||p.st==='down')continue;const R=A.SEC+45,ch=Math.ceil(H/64);
  for(let y=Math.max(0,Math.floor((p.y-R)/64));y<=Math.min(ch-1,Math.floor((p.y+R)/64));y++)for(let x=Math.max(0,Math.floor((p.x-R)/64));x<=Math.min(f.cw-1,Math.floor((p.x+R)/64));x++)
   if(hyp(x*64+32-p.x,y*64+32-p.y)<R)f.grid[y*f.cw+x]=1}}
function aiCalls(){if(typeof aiEnabled==='undefined'||typeof started==='undefined'||!started||ended||grounded())return;
 for(let team=0;team<2;team++){if(!aiEnabled[team]||time<callAt[team])continue;callAt[team]=time+rnd(...A.AI_EVERY);
  if(SP.some(p=>p.team===team&&p.st!=='down'&&p.st!=='out'))continue;
  if(!sandbox&&supplies[team]<A.COST+defs.artillery.cost)continue;
  let best=null,bd=1e9;for(const pt of points){if(pt.owner===team)continue;const d=Math.abs(pt.x-(team?W-400:400));if(d<bd){bd=d;best=pt}}
  if(!best)continue;if(!spend('recon',team,false))continue;launch(team,best.x,best.y)}}

/* ---------- laço principal ---------- */
function pre(dt){for(const u of units){u._fx=u.x;u._fy=u.y}
 for(const b of buildings)if(b.type==='bunker'&&b.atr){b._cd0=b.cd;if(b.atr.seized||b.atr.swapUntil>time)b.cd=1}}
function post(dt){
 for(const u of units){if(u.hp<=0)continue;const isT=u.type==='tank';
  st(u);
  if(u._fx!==undefined){const dx=u.x-u._fx,dy=u.y-u._fy,d2=dx*dx+dy*dy;
   if(d2>1e-6&&d2<64){const a=u.atr;let k=1;
    if(a&&(a.clearUntil>time||a.bog>time))k=0;
    else if(!isT){const m=M(u.x,u.y);if(m>.02){k=lerp(1,u.type==='cavalry'?C.CAV:C.INF,m);if(u===player&&mode==='soldier')k*=lerp(1,1/C.NOSPRINT,clamp(m*1.4,0,1))}}
    if(k<1){u.x=u._fx+dx*k;u.y=u._fy+dy*k}
    if(isT&&d2>.02&&a.bog<=time&&a.free<time){const m=M(u.x,u.y);
     if(m>=C.BOG_MIN){const cr=typeof findNearestCrater==='function'?findNearestCrater(u.x,u.y):null,rate=C.BOG_RATE*clamp((m-C.BOG_MIN)/(1-C.BOG_MIN),0,1)*(cr?1:C.BOG_OPEN);
      if(Math.random()<rate*dt){a.bog=time+rnd(...C.BOG_T);a.bogT0=time;FL.stats.bogs++;say(u.team,'Tanque atolado na lama! Esteiras patinando.');spout(u.x,u.y,1,false)}}}}}
  if(u.atr){const a=u.atr;if(isT){if(a.bog>time){if(Math.random()<dt*14)fxAdd({k:'clod',x:u.x+rnd(-18,18),y:u.y+rnd(-10,10),vx:rnd(-40,40),vy:rnd(-40,40),z:2,vz:rnd(50,110),max:rnd(.5,.9),col:'#2a2017',sz:2});
    if(a.bog<=time+dt)a.free=time+C.BOG_FREE}}
   else{if(u.type==='mg')gunTick(u,dt);if(jammable(u))dirtTick(u,dt)}}}
 for(const b of buildings){if(b.type!=='bunker'||b.hp<=0)continue;const a=st(b);
  if(b._cd0!==undefined&&b._cd0-dt<=0&&b.cd>.15)heat(b,a);gunTick(b,dt);b._cd0=undefined}
 STEAMERS.length=0;for(const u of units)if(u.atr&&u.atr.steam&&u.hp>0)STEAMERS.push(u);for(const b of buildings)if(b.atr&&b.atr.steam&&b.hp>0)STEAMERS.push(b);
 for(let i=UXO.length-1;i>=0;i--){const x=UXO[i];for(const u of units)if(u.type==='tank'&&u.hp>0&&hyp(u.x-x.x,u.y-x.y)<16){UXO.splice(i,1);RAW(x.x,x.y,x.big?60:40,x.big?110:70,x.team);break}}
 for(const p of SP)spStep(p,dt);SP=SP.filter(p=>!p.dead);
 for(const w of WRECK)w.t-=dt;WRECK=WRECK.filter(w=>w.t>0);
 aaTick(dt);fxStep(dt);revealFog();aiCalls()}
wrap('update',(orig,dt)=>{if(!FL.on||!(dt>0))return orig(dt);try{pre(dt)}catch(e){fail(e)}orig(dt);try{post(dt)}catch(e){fail(e)}});
wrap('setup',(orig,...a)=>{const r=orig(...a);try{reset()}catch(e){fail(e)}return r});
if(window.PXBAT&&PXBAT.mission){const o=PXBAT.mission;PXBAT.mission=function(team,x,y,count,spread,kind,cb){
 if(FL.on&&spotted(team,x,y)){spread*=A.SPREAD;FL.stats.spotted=(FL.stats.spotted||0)+1;note('spot',team,'Observador aéreo corrigindo o tiro: dispersão −75%.',6)}
 return o.call(this,team,x,y,count,spread,kind,cb)}}

/* ---------- interface: carta de Reconhecimento (APOIO · tecla 5) ---------- */
wrap('choose',(orig,type)=>{if(FL.on&&type==='recon'&&grounded()){toast('Sem condições de voo: os aviões ficam em solo.');return}return orig(type)});
wrap('place',(orig,x,y)=>{if(!FL.on||placement!=='recon')return orig(x,y);
 if(!spend('recon'))return;const p=launch(playerTeam,x,y),eta=Math.round(hyp(p.x-(p.cx+A.RX*Math.cos(p.phi)),p.y-(p.cy+A.RY*Math.sin(p.phi)))/A.V);
 toast(`Avião de observação a caminho (~${eta} s). Ele orbita o setor por ${A.ORBIT} s.`);snd('click');hud();
 if(!keys.Shift){placement=null;makeCards();$('placehint').textContent='Escolha uma unidade e posicione no campo'}});
wrap('makeCards',orig=>{orig();try{if(tab!=='support'||!defs.recon)return;const d=defs.recon,b=document.createElement('button');b.className='card'+(placement==='recon'?' active':'');
 b.innerHTML=`<canvas width="48" height="48"></canvas><b>${['Salmson 2A2','Rumpler C.VII'][playerTeam]}</b><small>${d.sub}</small><span class="cost">◈ ${sandbox?'∞':d.cost}</span><kbd>5</kbd>`;
 b.onclick=()=>choose('recon');$('cards').append(b);icon('recon',b.querySelector('canvas').getContext('2d'))}catch(e){fail(e)}});
wrap('icon',(orig,type,c)=>{if(type!=='recon')return orig(type,c);c.clearRect(0,0,48,48);try{const s=planeSprite(playerTeam,-PI/6);if(s)c.drawImage(s.c,24-s.c.width/2,24-s.c.height/2)}catch(e){}});
window.addEventListener('keydown',e=>{if(e.key==='5'&&tab==='support'&&!e.repeat&&!document.querySelector('dialog[open]')&&typeof started!=='undefined'&&started&&mode==='commander'){e.stopImmediatePropagation();choose('recon')}},true);

/* ---------- desenho (arte) ---------- */
const PC=new Map();
function planeBase(team){const c=document.createElement('canvas');c.width=c.height=44;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
 const R=(a,b,w,h,col)=>{x.fillStyle=col;x.fillRect(a+22,b+22,w,h)},P=team?{w:'#a59878',w2:'#7d7358',f:'#6b654e',d:'#3c3a2c',cross:1}:{w:'#6e7a45',w2:'#4f5a31',f:'#58613a',d:'#2c321d',cross:0};
 R(-9,-15,8,30,P.w2);R(-6,-17,8,34,P.w);R(-6,-17,8,1,'rgba(255,255,255,.22)');R(-6,-9,1,18,P.w2);R(-1,-17,1,34,'rgba(0,0,0,.18)');   // asas
 R(-17,-2,30,4,P.f);R(-17,-1,30,1,'rgba(255,255,255,.16)');R(-15,-6,4,12,P.w2);R(-18,-1,2,2,P.d);R(-19,-3,2,6,P.w);                          // fuselagem, profundor, leme
 R(11,-2,4,4,'#3b3f34');R(15,-1,2,2,'#26291f');R(16,-7,1,14,'rgba(200,200,190,.4)');                                                       // motor e hélice
 R(3,-2,3,3,P.d);R(-3,-2,3,3,P.d);R(-2,-1,1,1,'#d6b48a');R(4,-1,1,1,'#d6b48a');R(-6,-4,2,1,P.d);                                          // cabines e metralhadora do observador
 if(P.cross){R(-3,-16,4,1,'#e8e5d6');R(-2,-17,2,3,'#14130f');R(-3,-15,4,1,'#14130f');R(-3,14,4,1,'#e8e5d6');R(-2,13,2,3,'#14130f')}
 else{R(-3,-16,3,3,'#e9e6d8');R(-2,-15,1,1,'#2b4a8a');R(-3,13,3,3,'#e9e6d8');R(-2,14,1,1,'#2b4a8a');R(-3,-16,1,3,'#b3302b')}
 return c}
function planeSprite(team,ang){const n=((Math.round(ang/(2*PI)*24)%24)+24)%24,k=team+':'+n;let s=PC.get(k);if(s)return s;
 let b=PC.get('b'+team);if(!b){b=planeBase(team);PC.set('b'+team,b)}
 const c=document.createElement('canvas');c.width=c.height=44;let x=c.getContext('2d');x.imageSmoothingEnabled=false;x.translate(22,22);x.rotate(n/24*2*PI);x.drawImage(b,-22,-22);
 const sh=document.createElement('canvas');sh.width=sh.height=44;x=sh.getContext('2d');x.drawImage(c,0,0);x.globalCompositeOperation='source-in';x.fillStyle='rgba(10,12,8,.34)';x.fillRect(0,0,44,44);
 s={c,sh};PC.set(k,s);return s}
function disc(c,x,y,r,col){if(PX.disc)return PX.disc(c,x,y,r,col);c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,2*PI);c.fill()}
const onS=(c,x,y,m)=>x>-m&&y>-m&&x<c.canvas.width+m&&y<c.canvas.height+m;
function drawOver(c,ox,oy){
 const sx=v=>ox+Math.round(v*Z),sy=v=>oy+Math.round(v*Z);
 for(const w of WRECK){const x=sx(w.x),y=sy(w.y);if(!onS(c,x,y,30))continue;c.fillStyle='#16130f';c.fillRect(x-7,y-1,15,3);c.fillRect(x-2,y-7,4,14);c.fillStyle='#3b3a2c';c.fillRect(x-6,y,10,1);c.fillStyle='#b3302b';c.fillRect(x+4,y-1,2,1)}
 for(const x of UXO){const X=sx(x.x),Y=sy(x.y);if(!onS(c,X,Y,10))continue;c.fillStyle='rgba(24,17,10,.75)';c.fillRect(X-3,Y+1,7,2);c.fillStyle='#2a1f14';c.fillRect(X-2,Y+2,5,1);
  c.fillStyle=x.big?'#4a4d38':'#46493a';c.fillRect(X-2,Y-1,x.big?5:3,2);c.fillStyle='#8a7538';c.fillRect(X+(x.big?1:0),Y-2,2,1);c.fillStyle='#b1a060';c.fillRect(X+(x.big?2:1),Y-1,1,1)}
 for(const g of AAG)drawFlakGun(c,sx(g.x),sy(g.y),g);
 for(const u of units)if(isGun(u)||u.atr)drawUnitFx(c,u,sx,sy);
 for(const b of buildings)if(b.type==='bunker'&&b.atr)drawUnitFx(c,b,sx,sy);
 for(const p of FX){const x=sx(p.x),y=sy(p.y)-Math.round((p.z||0)*Z);if(!onS(c,x,y,40))continue;const k=p.t/p.max;
  if(p.k==='steam'){c.globalAlpha=k<.15?.3+k*3:.75*(1-k);disc(c,x,y,Math.max(1,Math.round(p.size*(.5+k*.9))),'#eef2f0');c.globalAlpha=.3*(1-k);disc(c,x+1,y-1,Math.max(1,Math.round(p.size*(.35+k*.6))),'#ffffff');c.globalAlpha=1}
  else if(p.k==='clod'){c.fillStyle=p.col;c.fillRect(x,y,p.sz,p.sz)}
  else if(p.k==='geys'){const h=Math.sin(Math.PI*Math.min(1,k*1.15))*p.h*Z,w=Math.max(1,Math.round(p.w*(1-k*.4)*Z)+1);c.fillStyle='#1e160f';c.fillRect(x-w,Math.round(y-h),w*2,Math.round(h)+1);c.fillStyle='#46331f';c.fillRect(x-w+1,Math.round(y-h),Math.max(1,w-1),Math.round(h)+1);disc(c,x,Math.round(y-h),w+1,'#2a2017');c.fillStyle='#5b4530';c.fillRect(x-1,Math.round(y-h)-1,2,1)}
  else if(p.k==='smoke'){c.globalAlpha=(1-k)*(p.a||.5);disc(c,x,y,Math.max(1,Math.round(p.size*(.6+k*.9))),p.col||'#77736a');c.globalAlpha=1}
  else if(p.k==='spark'){c.fillStyle=k<.4?'#fff6cc':'#ffb347';c.fillRect(x,y,1,1);c.fillRect(x+1,y,1,1)}
  else if(p.k==='tr'){const x1=sx(p.x1),y1=sy(p.y1),q=Math.min(1,k*2.2);PX.pline?PX.pline(c,Math.round(lerp(x,x1,Math.max(0,q-.45))),Math.round(lerp(y,y1,Math.max(0,q-.45))),Math.round(lerp(x,x1,q)),Math.round(lerp(y,y1,q)),'#ffe9a0'):0}
  else if(p.k==='flak'){const a=k<.08?1:k<.6?.92:(1-k)/.4*.92,r=Math.max(2,Math.round(p.size*(.55+Math.min(1,k*4)*.5+k*.4)));c.globalAlpha=Math.max(0,a);
   disc(c,x,y,r,'#16140f');for(let i=0;i<5;i++){const ang=p.seed+i*1.25,d=r*.75;disc(c,x+Math.round(Math.cos(ang)*d),y+Math.round(Math.sin(ang)*d*.8),Math.max(1,Math.round(r*.55)),i%2?'#23201a':'#1b1913')}
   if(k<.12){disc(c,x,y,Math.max(1,r-2),'#ffb84a');disc(c,x,y,Math.max(1,r-4),'#fff2b8')}else disc(c,x-1,y-1,Math.max(1,Math.round(r*.4)),'#3a362d');c.globalAlpha=1}}
 for(const p of SP){const v=vis(p),gx=sx(p.x),gy=sy(p.y);if(!onS(c,gx,gy,120)&&!onS(c,sx(v.x),sy(v.y),60))continue;
  if(p.st!=='down'&&mine(p.team)){c.save();c.globalAlpha=.4;c.strokeStyle=p.team?'#e29a87':'#aed6d4';c.lineWidth=1;c.setLineDash([4,5]);c.beginPath();c.ellipse(gx,gy,A.SEC*Z,A.SEC*Z*.8,0,0,2*PI);c.stroke();c.restore()}
  const s=planeSprite(p.team,p.ang),alt=p.alt;
  c.drawImage(s.sh,Math.round(gx-22+alt*.35),Math.round(gy-22+4));c.drawImage(s.c,Math.round(gx-22),Math.round(gy-22-alt))}
}
function drawFlakGun(c,x,y,g){if(!onS(c,x,y,30))return;
 c.fillStyle='rgba(20,16,10,.5)';c.fillRect(x-9,y+2,18,5);
 if(g.hp<=0){c.fillStyle='#1b1a16';c.fillRect(x-7,y-1,14,5);c.fillStyle='#3d3a2f';c.fillRect(x-5,y-3,4,3);c.fillRect(x+1,y,5,2);c.fillStyle='#b3302b';c.fillRect(x+3,y-1,2,1);return}
 for(let i=0;i<8;i++){const a=i/8*2*PI;c.fillStyle=i%2?'#b5a57c':'#a99970';c.fillRect(x+Math.round(Math.cos(a)*9)-2,y+Math.round(Math.sin(a)*5)-1,4,2)}
 c.fillStyle='#2d3127';c.fillRect(x-4,y-2,8,5);c.fillStyle='#4b5140';c.fillRect(x-3,y-3,6,3);
 const ca=Math.cos(g.ang),sa=Math.sin(g.ang);for(let i=2;i<11;i++){c.fillStyle=i>8?'#15170f':'#2a2e22';c.fillRect(x+Math.round(ca*i),y-3+Math.round(sa*i*.7)-Math.round(i*.35),2,2)}
 if(g.flash>0){c.fillStyle='#fff2b8';c.fillRect(x+Math.round(ca*12)-1,y-6+Math.round(sa*8),3,3);c.fillStyle='#ffb84a';c.fillRect(x+Math.round(ca*12),y-5+Math.round(sa*8),2,2)}}
function drawUnitFx(c,u,sx,sy){const x=sx(u.x),y=sy(u.y);if(!onS(c,x,y,30))return;const a=u.atr;if(!a)return;
 const own=mine(u.team),top=y-(u.type==='tank'?13:u.type==='bunker'?14:11);
 if(u.type==='tank'){if(a.bog>time){c.fillStyle='rgba(30,22,14,.7)';c.fillRect(x-14,y+4,28,6);c.fillStyle='#46331f';c.fillRect(x-12,y+5,24,3);c.fillStyle='#b9a77a';const t=(time*4|0)%2;c.fillRect(x-2,top-4+t,5,1);c.fillRect(x-1,top-3+t,3,1);c.fillRect(x,top-2+t,1,1)}return}
 if(isGun(u)&&(own&&(a.T>60||selected.has(u.id))||a.seized)){const w=12,f=clamp((a.T-G.AMB)/(G.BOIL-G.AMB),0,1);c.fillStyle='#14120e';c.fillRect(x-w/2-1,top-1,w+2,4);c.fillStyle='#2a2e26';c.fillRect(x-w/2,top,w,1);
  c.fillStyle=f<.6?'#8fc3d2':f<.9?'#e8a13a':'#e0553a';c.fillRect(x-w/2,top,Math.round(w*f),1);c.fillStyle='#4f93b8';c.fillRect(x-w/2,top+1,Math.round(w*clamp(a.wat/G.WAT,0,1)),1)}
 if(a.clearUntil>time){const t=(time*7|0)%2;c.fillStyle='#14120e';c.fillRect(x-1,top-7,3,7);c.fillStyle=t?'#ffd45a':'#e8a13a';c.fillRect(x,top-6,1,4);c.fillRect(x,top-1,1,1)}
 if(a.seized){c.fillStyle='#14120e';c.fillRect(x-5,top-7,11,5);c.fillStyle='#e0553a';c.fillRect(x-4,top-6,9,3);c.fillStyle='#ffd8c8';c.fillRect(x-3,top-5,1,1);c.fillRect(x-1,top-5,1,1);c.fillRect(x+1,top-5,1,1);c.fillRect(x+3,top-5,1,1)}
 if(a.run){const r=a.run,t=time-r.t0,h=r.dur/2;let px,py;if(t<h){const k=t/h;px=lerp(r.ox,r.bx,k);py=lerp(r.oy,r.by,k)}else{const k=clamp((t-h)/h,0,1);px=lerp(r.bx,u.x,k);py=lerp(r.by,u.y,k)}
  const X=sx(px),Y=sy(py),col=u.team?'#a09275':'#809c91';c.fillStyle='rgba(20,16,10,.4)';c.fillRect(X-2,Y+4,5,1);c.fillStyle='#303b32';c.fillRect(X-1,Y+2,1,3);c.fillRect(X+1,Y+2,1,3);c.fillStyle=col;c.fillRect(X-1,Y-2,3,4);c.fillStyle='#ceb38b';c.fillRect(X-1,Y-4,3,2);c.fillStyle=u.team?'#626353':'#4b6456';c.fillRect(X-2,Y-5,5,2);c.fillStyle='#5b7d99';c.fillRect(X+2,Y-1,2,3);c.fillStyle='#d8d8c8';c.fillRect(X+2,Y-2,2,1)}}
if(window.WW1A){const over=WW1A.over;WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);try{if(FL.on)drawOver(c,ox,oy)}catch(e){fail(e)}}}

/* ---------- API de teste ---------- */
FL.state=()=>({on:FL.on,stats:{...FL.stats},uxo:UXO.length,planes:SP.map(p=>({team:p.team,st:p.st,hp:p.hp,x:Math.round(p.x),y:Math.round(p.y)})),flak:AAG.map(g=>({team:g.team,hp:g.hp,lock:+g.lock.toFixed(1)})),steam:STEAMERS.length,fx:FX.length});
FL.launch=launch;FL.spotted=spotted;FL.st=st;FL.heat=heat;FL.reset=reset;FL.planes=()=>SP;FL.flak=()=>AAG;FL.uxo=()=>UXO;FL.tick=post;FL.hitPlane=hitPlane;FL.jamP=jamP;FL.startJam=startJam;FL.mud=M;
reset();
})();
