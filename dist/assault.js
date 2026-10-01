'use strict';
/* Iron Front 1.4 — assalto de trincheira: supressão realista, "Over the Top", gás e concussão, limpeza de trincheira.
   Carrega DEPOIS de sappers.js/frontline.js/blood.js (e antes do ui-art.js). Não altera game.js: envolve setup / update /
   protectedBy / explode / shoot / place / makeCards / icon / hud / render e desenha em WW1A.over e PHYS.draw.
   1  Supressão .... sob fogo (u.suppression > 1,15) fora de trincheira, o infante se joga na lama (pinned), rasteja até a
                     cratera mais próxima (≤110 px, 13 px/s) e só levanta quando o fogo cai (< 0,45). Deitado: 40% menos
                     dano; na cratera: 55% menos. Jogador: Z deita/levanta.
   2  Over the Top . V: sinalizador verde da pistola Very, apitos ao longo da trincheira, os pelotões sobem as escadas em
                     escalonamento e avançam em onda até a linha inimiga (Shift+V: com barragem móvel de fumaça à frente).
                     A IA faz o mesmo depois de preparar com fumaça.
   3  Gás .......... granadas de gás mostarda (APOIO, tecla 6; a IA usa contra grupos em terra de ninguém, lendo o vento).
                     A nuvem vai com o vento e escorre para crateras e trincheiras. Corneta de alarme; quem não põe a máscara
                     a tempo cai tossindo. Jogador: G põe a máscara quando há gás (senão é granada), M alterna.
      Concussão .... explosão perto do jogador: tela treme e embaça, o som da batalha some e fica o zumbido (tinnitus).
   4  Trincheira ... corpo a corpo a menos de 16 px (faca, pá, queima-roupa; jogador: Q). Granada que rola perto da entrada
                     de um abrigo (ninho de MG, bunker) cai lá dentro: explosão confinada silencia a guarnição.
                     Setor da linha tomado → bandeira hasteada.
   Desliga com ?assalto=0 na URL ou PXAS.on=false. Coordenadas em unidades do mundo; desenho em pixels de arte (PX.Z). */
(function(){
if(!window.PX)return;
const Z=PX.Z||.5,hyp=Math.hypot,TAU=Math.PI*2;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('assault.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
const face=t=>t?-1:1;

/* ---------- parâmetros ---------- */
const CFG={
 PIN:{on:1.15,off:.45,crawl:13,seek:110,prot:.6,crater:.45},
 OTT:{cd:90,aiCd:210,ladder:[.2,2.6],stop:30,hold:10},
 GAS:{life:75,grow:22,r0:18,r1:58,dmg:5,maskDelay:[.6,2.8],fail:.12,maskDmg:.1,shells:4,spread:70,cost:170,aiCd:120,alarm:700},
 CONC:{reach:2.2,min:.15},
 MELEE:{range:16,cd:[.8,1.3],dmg:[30,58],player:[60,80],preach:24},
 DUG:{pull:34,in:8,r:60,dmg:150,bunker:600},
 SECTOR:200
};
const S=window.PXAS={on:!/[?&]assalto=0/.test(location.search),version:'1.4',cfg:CFG,stats:{errors:0,pins:0,waves:0,gas:0,melee:0,dugouts:0,flags:0}};
let FRONT=[724,1676],WAVES=[],FLARES=[],GS=[],PUFFS=[],ENTR=[],SECT=[],FX=[],GGRID=new Map(),gT=0,eT=0,sT=0,aiT=[6,9],ottAt=[-999,-999],gasAt=[-999,-999],alarm=[-99,-99],errs=0;
const CONC={t:0,max:0,k:0,tin:null},PL={prone:false,maskT:0,breathT:0,mcd:0};
function fail(e){S.stats.errors++;if(++errs<=3)console.error('assault.js:',e);if(errs>=12){S.on=false;try{canvas.style.filter=''}catch{}console.error('assault.js desligado após erros repetidos')}}
function say(team,msg){if(team===playerTeam)try{toast(msg)}catch{}}
function pay(team,n){if(sandbox)return true;if(supplies[team]<n)return false;supplies[team]-=n;return true}
const infantry=u=>u.hp>0&&(u.type==='rifle'||u.type==='mg');
const controlled=u=>u===player&&mode==='soldier';

/* ======================================================================================
   ÁUDIO: toda a mixagem passa por um ganho mestre (para a concussão abafar a batalha); o zumbido fica por fora
   ====================================================================================== */
const rawConnect=AudioNode.prototype.connect;
function master(ctx){if(!ctx.__ifm){const g=ctx.createGain();g.__raw=1;rawConnect.call(g,ctx.destination);ctx.__ifm=g}return ctx.__ifm}
AudioNode.prototype.connect=function(dst,...a){if(dst&&typeof AudioDestinationNode!=='undefined'&&dst instanceof AudioDestinationNode&&!this.__raw)return rawConnect.call(this,master(dst.context),...a);return rawConnect.call(this,dst,...a)};
const ac=()=>{try{return soundOn&&audio?audio:null}catch{return null}};
const near=(x,y,r=700)=>{try{return clamp(1-hyp(x-cam.x,y-cam.y)/r,0,1)}catch{return 0}};
function noiseBuf(a,dur){const n=Math.ceil(a.sampleRate*dur),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
function whistle(vol,delay=0){const a=ac();if(!a||vol<=.02)return;try{const t=a.currentTime+delay,o=a.createOscillator(),l=a.createOscillator(),lg=a.createGain(),g=a.createGain();
 o.type='sine';o.frequency.value=2500+Math.random()*500;l.frequency.value=24+Math.random()*10;lg.gain.value=220;l.connect(lg);lg.connect(o.frequency);
 g.gain.setValueAtTime(0,t);for(const[s,e]of[[0,.42],[.55,1.15]]){g.gain.linearRampToValueAtTime(.045*vol,t+s+.03);g.gain.setValueAtTime(.045*vol,t+e-.05);g.gain.linearRampToValueAtTime(0,t+e)}
 o.connect(g);g.connect(a.destination);o.start(t);l.start(t);o.stop(t+1.2);l.stop(t+1.2)}catch{}}
function bugle(){const a=ac();if(!a)return;try{const t=a.currentTime;[523,659,523,659,784,784].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.type='sawtooth';o.frequency.value=f;
 const s=t+i*.24;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.035,s+.03);g.gain.linearRampToValueAtTime(0,s+.22);const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800;o.connect(lp);lp.connect(g);g.connect(a.destination);o.start(s);o.stop(s+.24)})}catch{}}
function thud(vol){const a=ac();if(!a||vol<=.02)return;try{const t=a.currentTime,s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=noiseBuf(a,.09);f.type='lowpass';f.frequency.value=320;g.gain.value=.12*vol;s.connect(f);f.connect(g);g.connect(a.destination);s.start(t)}catch{}}
function plop(vol){const a=ac();if(!a||vol<=.02)return;try{const t=a.currentTime,s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=noiseBuf(a,.35);f.type='lowpass';f.frequency.value=480;
 g.gain.setValueAtTime(.14*vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);s.connect(f);f.connect(g);g.connect(a.destination);s.start(t)}catch{}}
function breath(){const a=ac();if(!a)return;try{const t=a.currentTime;for(const[st,d,f0,f1,v]of[[0,1.1,650,1200,.05],[1.45,1.3,900,420,.065]]){const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();
 s.buffer=noiseBuf(a,d);f.type='bandpass';f.Q.value=1.4;f.frequency.setValueAtTime(f0,t+st);f.frequency.linearRampToValueAtTime(f1,t+st+d);g.gain.setValueAtTime(0,t+st);g.gain.linearRampToValueAtTime(v,t+st+d*.4);g.gain.linearRampToValueAtTime(0,t+st+d);
 s.connect(f);f.connect(g);g.connect(a.destination);s.start(t+st)}}catch{}}
/* concussão: abafa o mestre e toca o zumbido direto na saída */
function deafen(k,T){const a=ac();if(!a)return;try{const m=master(a),t=a.currentTime;m.gain.cancelScheduledValues(t);m.gain.setValueAtTime(m.gain.value,t);m.gain.linearRampToValueAtTime(clamp(.35-k*.33,.02,1),t+.06);
 m.gain.setValueAtTime(clamp(.35-k*.33,.02,1),t+T*.45);m.gain.linearRampToValueAtTime(1,t+T);
 const g=a.createGain();g.__raw=1;rawConnect.call(g,a.destination);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.03+.04*k,t+.08);g.gain.exponentialRampToValueAtTime(.0005,t+T);
 for(const f of[4200,6150]){const o=a.createOscillator();o.__raw=1;o.type='sine';o.frequency.value=f+rnd(-60,60);rawConnect.call(o,g);o.start(t);o.stop(t+T)}}catch{}}

/* ======================================================================================
   1 · SUPRESSÃO: deitar, rastejar até a cratera, levantar quando o fogo cai
   ====================================================================================== */
function craterNear(x,y,r){let best=null,bd=r*r;for(const c of allCraters){if(c.r<12)continue;const d=(c.x-x)**2+(c.y-y)**2;if(d<bd){bd=d;best=c}}return best}
function inCrater(u){for(const c of allCraters)if((c.x-u.x)**2+(c.y-u.y)**2<(c.r*.8)**2)return c;return null}
function pin(u){const save={order:u.order,tx:u.tx,ty:u.ty,mu:u.manualUntil,role:u.aiRole};u.pinned=true;u.pinSave=save;S.stats.pins++;
 const c=inCrater(u)?null:craterNear(u.x,u.y,CFG.PIN.seek);u.crawlTo=c?{x:c.x+rnd(-c.r*.35,c.r*.35),y:c.y+rnd(-c.r*.3,c.r*.3)}:null;u.aiRole='deitado';u.target=null}
function unpin(u,restore=true){u.pinned=false;u.crawlTo=null;const s=u.pinSave;u.pinSave=null;if(!restore||!s)return;
 u.order=s.order;u.tx=s.tx;u.ty=s.ty;u.aiRole=s.role||'';u.manualUntil=s.mu>time?s.mu:0}
function pinTick(u){
 if(u.sap||controlled(u)||!infantry(u)){if(u.pinned)unpin(u);return}
 if(u.pinned){
  if(u.manualUntil>time&&u.manualUntil!==u.pinStamp){unpin(u,false);u.pinCool=time+4;return}           // ordem nova por cima (jogador, sapadores)
  if(u.suppression<CFG.PIN.off){unpin(u);return}
  u.manualUntil=u.pinStamp=time+.6;
  if(u.crawlTo&&hyp(u.crawlTo.x-u.x,u.crawlTo.y-u.y)>7){u.order='move';u.tx=u.crawlTo.x;u.ty=u.crawlTo.y}else{u.crawlTo=null;u.order='hold';u.tx=u.x;u.ty=u.y}
  return}
 if(u.suppression>CFG.PIN.on&&(u.pinCool||0)<time&&protectedBy(u)>.5&&!(window.PXW&&PXW.depth(u.x,u.y)>=.25))pin(u)}

/* ======================================================================================
   2 · OVER THE TOP
   ====================================================================================== */
function inOwnTrench(u){for(const t of fieldTrenches){if(t.team!==u.team)continue;if(Math.abs(t.x-u.x)<(t.hw||52)+6&&Math.abs(t.y-u.y)<(t.hh||22)+6)return true}return false}
function overTop(team,opt={}){if(S.hold){if(!opt.ai)toast('Trégua: ninguém sai da trincheira antes do fim da preparação.');return 0}
 if(time-ottAt[team]<(opt.ai?CFG.OTT.aiCd:CFG.OTT.cd)){if(!opt.ai)toast(`Os pelotões ainda se reorganizam (${Math.ceil((opt.ai?CFG.OTT.aiCd:CFG.OTT.cd)-(time-ottAt[team]))} s).`);return 0}
 const fc=face(team),fx=FRONT[team],ex=FRONT[1-team];
 let pool=units.filter(u=>u.team===team&&u.type==='rifle'&&!u.sap&&u.hp>0&&!u.down&&!controlled(u)&&(inOwnTrench(u)||Math.abs(u.x-fx)<120)&&(!opt.ai||u.manualUntil<=time));
 if(opt.ids){const ids=new Set(opt.ids);pool=pool.filter(u=>ids.has(u.id))}
 if(!opt.ai&&selected.size){const sel=pool.filter(u=>selected.has(u.id));if(sel.length)pool=sel}
 if(opt.frac)pool=pool.filter(()=>Math.random()<opt.frac);
 if(pool.length<3){if(!opt.ai)toast('Nenhum pelotão na trincheira para sair ao ataque.');return 0}
 ottAt[team]=time;S.stats.waves++;
 const cy=pool.reduce((n,u)=>n+u.y,0)/pool.length;
 FLARES.push({x:fx-fc*10,y:cy,z:4,vz:230,t:0,life:8,team});
 const ys=pool.map(u=>u.y).sort((a,b)=>a-b),y0=ys[0],y1=ys[ys.length-1];
 for(let i=0;i<7;i++){const y=y0+(y1-y0)*(i+.5)/7,d=.5+i*.16+rnd(0,.25);WAVES.push({kind:'whistle',at:time+d,x:fx,y})}
 for(const u of pool){const d=CFG.OTT.ladder[0]+Math.random()*(CFG.OTT.ladder[1]-CFG.OTT.ladder[0])+.9;
  if(opt.coordinated)u.aiStepAt=time+d;
  WAVES.push({kind:'go',at:time+d,u,coordinated:!!opt.coordinated,tx:clamp(opt.target?.x??ex-fc*rnd(8,34),30,W-30),ty:clamp(u.y+rnd(-22,22),30,H-30)})}
 if(opt.smoke&&window.PXBAT&&typeof PXBAT.mission==='function'){                                    // barragem móvel: 3 cortinas avançando à frente da onda
  for(let k=0;k<3;k++)WAVES.push({kind:'smoke',at:time+1+k*9,team,x:fx+fc*(260+k*170),y:cy})}
 if(team===playerTeam)toast(`OVER THE TOP! ${pool.length} homens saindo da trincheira${opt.smoke?' atrás da cortina de fumaça':''}.`);
 else toast('Apitos na linha inimiga: eles estão saindo das trincheiras!');
 return pool.length}
function waveTick(){
 for(const w of WAVES){if(w.done||w.at>time)continue;w.done=true;
  if(w.kind==='whistle')whistle(near(w.x,w.y,900));
  else if(w.kind==='smoke'){if(pay(w.team,40)&&!PXBAT.mission(w.team,w.x,w.y,3,90,'smoke')&&!sandbox)supplies[w.team]+=40}
  else if(w.kind==='go'){const u=w.u;if(u.hp<=0||u.down||w.coordinated&&(u.manualUntil>time||!aiEnabled[u.team]||controlled(u)))continue;
   if(w.coordinated){particles.push({x:u.x,y:u.y+3,vx:0,vy:-8,t:.35,max:.35,color:'#8a7656',size:4});continue}
   const mu=time+CFG.OTT.stop+hyp(w.tx-u.x,w.ty-u.y)/20;
   const tgt={order:'move',tx:w.tx,ty:w.ty,mu,role:'assalto'};u.wave={tx:w.tx,ty:w.ty,until:mu};
   if(u.pinned){u.pinSave=tgt}else{u.order='move';u.tx=w.tx;u.ty=w.ty;u.manualUntil=mu;u.aiRole='assalto';u.target=null}
   particles.push({x:u.x,y:u.y+3,vx:rnd(-12,12),vy:rnd(-14,-4),t:.35,max:.35,color:'#8a7656',size:4})}}
 WAVES=WAVES.filter(w=>!w.done);
 for(const u of units){const w=u.wave;if(!w||u.pinned)continue;if(u.hp<=0||time>w.until){u.wave=null;continue}
  if(hyp(u.x-w.tx,u.y-w.ty)<24){u.wave=null;u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=time+CFG.OTT.hold}}}

/* ======================================================================================
   3 · GÁS MOSTARDA
   ====================================================================================== */
function launchGas(team,x,y){const C=CFG.GAS;S.stats.gas++;
 for(let i=0;i<C.shells;i++){const t=2.2+i*.3+rnd(0,.2);GS.push({x:clamp(x+rnd(-C.spread,C.spread),20,W-20),y:clamp(y+rnd(-C.spread,C.spread),20,H-20),t,team,wh:false})}
 gasAt[team]=time}
function gasLand(s){const C=CFG.GAS;plop(near(s.x,s.y,800));
 for(let i=0;i<5;i++)PUFFS.push({x:s.x+rnd(-14,14),y:s.y+rnd(-14,14),vx:0,vy:0,age:0,r:C.r0,c:1,team:s.team,ph:Math.random()*TAU});
 particles.push({x:s.x,y:s.y,vx:0,vy:-10,t:.4,max:.4,color:'#d8d08a',size:7});
 for(let t=0;t<2;t++){let hit=false;for(const u of units)if(u.team===t&&u.hp>0&&hyp(u.x-s.x,u.y-s.y)<C.alarm){hit=true;break}
  if(!hit)continue;if(time-alarm[t]>12){alarm[t]=time;if(t===playerTeam){bugle();toast('GÁS! GÁS! GÁS! Máscaras! (G / M)')}}
  for(const u of units)if(u.team===t&&infantry(u)&&!u.mask&&u.maskAt==null&&!controlled(u)&&hyp(u.x-s.x,u.y-s.y)<C.alarm*.5)u.maskAt=time+(Math.random()<C.fail?rnd(5,9):rnd(...C.maskDelay))}}
const gkey=(x,y)=>Math.floor(x/64)*1000+Math.floor(y/64);
function gasGrid(){GGRID.clear();for(const p of PUFFS){const r=p.r,x0=Math.floor((p.x-r)/64),x1=Math.floor((p.x+r)/64),y0=Math.floor((p.y-r)/64),y1=Math.floor((p.y+r)/64);
 for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){const cx=gx*64+32,cy=gy*64+32,d=hyp(cx-p.x,cy-p.y);if(d>r+32)continue;const k=gx*1000+gy;GGRID.set(k,Math.min(1.6,(GGRID.get(k)||0)+p.c*clamp(1-d/(r+32),0,1)))}}}
const gasAtPos=(x,y)=>GGRID.get(gkey(x,y))||0;
function puffTick(dt){const C=CFG.GAS,w=window.PXW&&PXW.windVec?PXW.windVec():{x:6,y:4};
 for(const p of PUFFS){p.age+=dt;const f=p.age/C.life;p.c=clamp(1-f,0,1)*(p.age<1.5?p.age/1.5:1);p.r=C.r0+(C.r1-C.r0)*clamp(p.age/C.grow,0,1);
  /* mais pesado que o ar: vai com o vento e escorre para a cratera ou trincheira mais próxima */
  let ax=w.x*.3,ay=w.y*.3;const cr=craterNear(p.x,p.y,70);if(cr){const d=hyp(cr.x-p.x,cr.y-p.y)||1;ax+=(cr.x-p.x)/d*10;ay+=(cr.y-p.y)/d*10}
  p.vx+=(ax-p.vx)*Math.min(1,dt*.6);p.vy+=(ay-p.vy)*Math.min(1,dt*.6);p.x=clamp(p.x+p.vx*dt,0,W);p.y=clamp(p.y+p.vy*dt,0,H)}
 PUFFS=PUFFS.filter(p=>p.age<C.life);if(PUFFS.length>360)PUFFS.splice(0,PUFFS.length-360)}
function exposure(dt){const C=CFG.GAS;
 for(const u of units){if(u.hp<=0||u.type==='tank')continue;
  if(u.maskAt!=null&&!u.mask&&time>=u.maskAt){u.mask=1;u.maskAt=null}
  const g=PUFFS.length?gasAtPos(u.x,u.y):0;
  if(g>.05){u.gasSeen=time;
   if(!u.mask){if(u.maskAt==null&&!controlled(u))u.maskAt=time+(Math.random()<C.fail?rnd(4,8):rnd(...C.maskDelay));
    damage(u,C.dmg*g*dt,PUFFS.find(p=>hyp(p.x-u.x,p.y-u.y)<p.r+30)?.team);u.cough=time+1.2;
    if(u.type!=='cavalry')u.suppression=Math.min(2,(u.suppression||0)+g*dt*1.4)}          // tosse: cai no chão
   else damage(u,C.dmg*C.maskDmg*g*dt)}
  else if(u.mask&&time-(u.gasSeen||0)>25&&!controlled(u)){u.mask=0;u.maskAt=null}}}
function gasTick(dt){
 for(const s of GS){s.t-=dt;if(!s.wh&&s.t<1.1){s.wh=true;const v=near(s.x,s.y,900);if(v>.05)try{shellWhistle(v)}catch{}}if(s.t<=0){s.done=true;gasLand(s)}}GS=GS.filter(s=>!s.done);
 if(!PUFFS.length)return;puffTick(dt);gT-=dt;if(gT<=0){gT=.25;gasGrid()}eT+=dt;if(eT>=.25){exposure(eT);eT=0}}
function shellWhistle(v){const a=ac();if(!a)return;const t=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.setValueAtTime(2100,t);o.frequency.exponentialRampToValueAtTime(700,t+1.05);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.03*v,t+.2);g.gain.exponentialRampToValueAtTime(.0005,t+1.1);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+1.12)}
/* IA: gás contra grupo inimigo em terra de ninguém perto da própria linha, só com vento a favor */
function aiGas(team){const C=CFG.GAS;if(time<60||time-gasAt[team]<C.aiCd)return;const fx=FRONT[team],fc=face(team),cells=new Map();
 for(const u of units){if(u.team===team||!infantry(u))continue;const ahead=(u.x-fx)*fc;if(ahead<60||ahead>420)continue;const k=Math.floor(u.x/150)+','+Math.floor(u.y/150);let c=cells.get(k);if(!c)cells.set(k,c={n:0,x:0,y:0});c.n++;c.x+=u.x;c.y+=u.y}
 let best=null;for(const c of cells.values())if(c.n>=6&&(!best||c.n>best.n))best=c;if(!best)return;const x=best.x/best.n,y=best.y/best.n;
 for(const u of units)if(u.team===team&&u.hp>0&&hyp(u.x-x,u.y-y)<170)return;
 const w=window.PXW&&PXW.windVec?PXW.windVec():{x:0,y:0};if(w.x*fc<-12)return;                     // vento soprando de volta para a própria linha
 if(!pay(team,C.cost))return;launchGas(team,x,y)}

/* ======================================================================================
   4 · LIMPEZA DE TRINCHEIRA: corpo a corpo, granada no abrigo, bandeira de setor
   ====================================================================================== */
function strike(u,e,dmg){damage(e,dmg,u.team);u.lunge={t:.16,dx:(e.x-u.x),dy:(e.y-u.y)};u.angle=Math.atan2(e.y-u.y,e.x-u.x);S.stats.melee++;
 particles.push({x:e.x,y:e.y-2,vx:rnd(-20,20),vy:rnd(-20,5),t:.18,max:.18,color:'#e9d6a5',size:4});thud(near(u.x,u.y,450))}
function meleeTick(dt){const M=CFG.MELEE;
 for(const u of units){if(!infantry(u)&&!(u.sap&&u.hp>0))continue;if(u.lunge){u.lunge.t-=dt;if(u.lunge.t<=0)u.lunge=null}
  u.mcd=(u.mcd||0)-dt;if(u.mcd>0||controlled(u))continue;u.mcd=.12;
  const e=typeof nearest==='function'?nearest(u,M.range):null;if(!e||e.type==='tank'||e.hp<=0)continue;
  strike(u,e,rnd(...M.dmg)*(e.pinned?1.25:1));u.mcd=rnd(...M.cd)}}
function playerMelee(){if(mode!=='soldier'||!player||player.type==='tank'||PL.mcd>time)return;PL.mcd=time+.8;
 const a=Math.atan2(mouse.wy-player.y,mouse.wx-player.x);let best=null,bd=CFG.MELEE.preach**2;
 for(const e of units){if(e.team===player.team||e.hp<=0||e.type==='tank')continue;const dx=e.x-player.x,dy=e.y-player.y,d=dx*dx+dy*dy;if(d>bd)continue;
  if(Math.cos(Math.atan2(dy,dx)-a)<.2)continue;bd=d;best=e}
 player.lunge={t:.16,dx:Math.cos(a)*8,dy:Math.sin(a)*8};
 if(best)strike(player,best,rnd(...CFG.MELEE.player));else thud(.3)}
/* entradas de abrigo: ninhos de MG do mapa, bunkers e ninhos cavados pelos sapadores */
function entrances(){const r=[...ENTR];
 for(const b of buildings)if(b.type==='bunker')r.push({x:b.x,y:b.y+14,team:b.team,b});
 if(window.PXSAP)for(const s of PXSAP.segs)if(s.kind==='nest'&&s.stage>=2)r.push({x:s.x,y:s.y,team:s.team});
 return r}
function dugTick(dt){const D=CFG.DUG;let E=null;
 for(const s of shells){if(!s.gren||s.inside)continue;if(s.gz>3)continue;E=E||entrances();
  for(const e of E){if(e.team===s.team)continue;const dx=e.x-s.gx,dy=e.y-s.gy,d=hyp(dx,dy);if(d>D.pull)continue;
   if(d<D.in){s.inside=e;s.gvx=s.gvy=0;s.gx=e.x;s.gy=e.y;s.x=e.x;s.y=e.y;if(s.team===playerTeam)say(s.team,'Granada dentro do abrigo!');break}
   const k=90*(1-d/D.pull)*dt;s.gvx+=dx/d*k*8;s.gvy+=dy/d*k*8;break}}}
function confined(s){const D=CFG.DUG,e=s.inside;S.stats.dugouts++;let kills=0;
 for(const u of units){if(u.hp<=0||u.team===s.team&&hyp(u.x-e.x,u.y-e.y)>20)continue;const d=hyp(u.x-e.x,u.y-e.y);if(d>D.r)continue;const was=u.hp;damage(u,D.dmg*(1-d/D.r)*(u.type==='tank'?.2:1),s.team);if(was>0&&u.hp<=0)kills++}
 if(e.b)e.b.hp-=D.bunker;
 const out=face(e.team)*-1;for(let i=0;i<22;i++)particles.push({x:e.x,y:e.y,vx:out*rnd(20,120)+rnd(-40,40),vy:rnd(-80,20),t:rnd(.5,1.3),max:1.3,color:i%3?'#6b5a40':'#b2a280',size:rnd(3,8)});
 screenShake=Math.max(screenShake,1.5);
 if(s.team===playerTeam)toast(kills?`Explosão no abrigo: ${kills} baixa${kills>1?'s':''}. A metralhadora silenciou.`:'Explosão dentro do abrigo.')}
/* setores da linha: âncoras da primeira linha agrupadas em faixas de 200 px */
function buildSectors(){SECT=[];for(let t=0;t<2;t++){const map=new Map();
 for(const a of fieldTrenches){if(a.team!==t||(a.line&&a.line!=='front'))continue;const k=Math.floor(a.y/CFG.SECTOR);let s=map.get(k);if(!s)map.set(k,s={team:t,holder:t,anchors:[],x:0,y:0,n:0,since:0});s.anchors.push(a);s.x+=a.x;s.y+=a.y;s.n++}
 for(const s of map.values()){s.x/=s.n;s.y/=s.n;const a=s.anchors.reduce((b,c)=>Math.abs(c.y-s.y)<Math.abs(b.y-s.y)?c:b);s.fx=a.x;s.fy=a.y;s.name=String.fromCharCode(65+SECT.filter(q=>q.team===t).length);SECT.push(s)}}}
function sectorTick(){for(const s of SECT){const c=[0,0];
 for(const u of units){if(!infantry(u)&&!(u.sap&&u.hp>0))continue;if(Math.abs(u.x-s.x)>70||Math.abs(u.y-s.y)>CFG.SECTOR*.7)continue;
  for(const a of s.anchors)if(Math.abs(a.x-u.x)<(a.hw||16)+14&&Math.abs(a.y-u.y)<(a.hh||16)+14){c[u.team]++;break}}
 const other=1-s.holder;s.pend=c[other]>=2&&c[s.holder]===0?(s.pend||0)+1:0;if(s.pend>=3){s.pend=0;s.holder=other;s.since=time;S.stats.flags++;
  toast(other===s.team?`Setor ${s.name} da linha ${s.team?'alemã':'aliada'} retomado.`:`Bandeira hasteada no setor ${s.name} da linha ${s.team?'alemã':'aliada'}!`)}}}

/* ======================================================================================
   IA E LAÇO
   ====================================================================================== */
function aiTick(team){aiGas(team);
 if(window.IronFrontBrain?.operations)return;
 if(time<100||time-ottAt[team]<CFG.OTT.aiCd)return;
 let n=0;for(const u of units)if(u.team===team&&u.type==='rifle'&&!u.sap&&u.hp>0&&inOwnTrench(u))n++;
 if(n<20||Math.random()>.35)return;
 const fx=FRONT[1-team];let cy=800;try{const f=window.IronFrontBrain?.rankObjectives?.(team,points,units)?.[0];if(f&&f.point)cy=f.point.y}catch{}
 if(window.PXBAT&&typeof PXBAT.mission==='function'&&pay(team,60))PXBAT.mission(team,fx,cy,4,140,'smoke');
 WAVES.push({kind:'ai-ott',at:time+5,team})}
function tick(dt){
 if(!S.on||!started||ended)return;
 for(const u of units)pinTick(u);
 for(const u of units){if(!u.pinned||u._ax===undefined)continue;const dx=u.x-u._ax,dy=u.y-u._ay,L=hyp(dx,dy),m=CFG.PIN.crawl*dt;if(L>m){u.x=u._ax+dx/L*m;u.y=u._ay+dy/L*m}}
 if(PL.prone&&player&&mode==='soldier'&&player._ax!==undefined){player.x=player._ax+(player.x-player._ax)*.3;player.y=player._ay+(player.y-player._ay)*.3}
 for(const w of WAVES)if(w.kind==='ai-ott'&&!w.done&&w.at<=time){w.done=true;overTop(w.team,{ai:true,frac:.6})}
 waveTick();meleeTick(dt);gasTick(dt);dugTick(dt);
 sT-=dt;if(sT<=0){sT=1;sectorTick()}
 for(const f of FLARES){f.t+=dt;f.vz-=90*dt;if(f.vz<-9)f.vz=-9;f.z=Math.max(0,f.z+f.vz*dt)}FLARES=FLARES.filter(f=>f.t<f.life);
 for(const p of FX){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt}FX=FX.filter(p=>p.t>0);
 for(const u of units)if(u.cough>time&&Math.random()<dt*3&&FX.length<200)FX.push({x:u.x+rnd(-2,2),y:u.y-9,vx:rnd(-4,4),vy:rnd(-10,-4),t:.6});
 for(let t=0;t<2;t++){if(!aiEnabled[t]||S.hold)continue;aiT[t]-=dt;if(aiT[t]<=0){aiT[t]=8;aiTick(t)}}
 if(!player||mode!=='soldier'){PL.prone=false;PL.maskT=0}
 if(CONC.t>0)CONC.t=Math.max(0,CONC.t-dt);
 if(PL.maskT&&time>=PL.maskT){PL.maskT=0;if(player&&mode==='soldier'){player.mask=1;PL.breathT=0}}
 if(player&&mode==='soldier'&&player.mask){PL.breathT-=dt;if(PL.breathT<=0){PL.breathT=3.3;breath()}}}
function reset(){WAVES=[];FLARES=[];GS=[];PUFFS=[];FX=[];GGRID.clear();ottAt=[-999,-999];gasAt=[-999,-999];alarm=[-99,-99];aiT=[6,9];sT=1;CONC.t=0;PL.prone=false;
 try{canvas.style.filter=''}catch{}
 refresh()}
/* frente, abrigos do mapa e setores: no início e de novo quando as linhas construídas na preparação ficam prontas */
function refresh(){for(let t=0;t<2;t++){const f=fieldTrenches.filter(a=>a.team===t&&(!a.line||a.line==='front'));FRONT[t]=f.length?f.reduce((n,a)=>n+a.x,0)/f.length:(t?1700:720)}
 ENTR=[];try{if(window.PX&&PX.WW1&&map==='trenches'&&!(PX.WW1.CLEAN&&PX.WW1.CLEAN.forts===false))for(let t=0;t<2;t++)for(const[x,y]of PX.WW1.nestSpots(t))ENTR.push({x:x-face(t)*8,y:y+6,team:t})}catch{}
 buildSectors()}

/* ======================================================================================
   DESENHO
   ====================================================================================== */
const mkc=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const PUFFSPR=new Map();let HALO=null;
function haloSprite(R){if(HALO)return HALO;HALO=mkc(R*2+1,R*2+1);const g=HALO.getContext('2d');g.fillStyle='#a8ff7a';
 for(let y=-R;y<=R;y++)for(let x=-R;x<=R;x++){const d=hyp(x,y)/R;if(d<=1&&BAYER[((y+64)&3)*4+((x+64)&3)]/16<(1-d)*.8)g.fillRect(x+R,y+R,1,1)}return HALO}
function puffSprite(r,lv){const k=r+'|'+lv;let c=PUFFSPR.get(k);if(c)return c;const s=r*2+1;c=mkc(s,s);const g=c.getContext('2d');
 for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){const d=hyp(x,y)/r;if(d>1)continue;const dens=(1-d*d)*(1-d*.5)*(lv+1)/7,th=BAYER[((y+64)&3)*4+((x+64)&3)]/16;if(th>=dens)continue;
  g.fillStyle=th<dens*.35?'#cfc778':th<dens*.7?'#aaa75e':'#8f8f52';g.fillRect(x+r,y+r,1,1)}PUFFSPR.set(k,c);return c}
function drawOver(c,ox,oy){if(!S.on)return;
 /* gás: puffs em pontilhado amarelado, ondulando */
 for(const p of PUFFS){const x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z),r=Math.max(4,Math.round(p.r*Z/4)*4);if(x<-r||y<-r||x>vw+r||y>vh+r)continue;
  const lv=clamp(Math.round(p.c*3),0,3),sp=puffSprite(r,lv);c.globalAlpha=.34*clamp(p.c*1.3,0,1);c.drawImage(sp,x-r+Math.round(Math.sin(time*.7+p.ph)*1.5),y-r)}
 c.globalAlpha=1;
 for(const s of GS)if(s.t<.8){const x=ox+Math.round(s.x*Z),y=oy+Math.round(s.y*Z);rect(c,x,y-Math.round(s.t*40),1,2,'#2b2e28')}
 for(const p of FX){const x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z);c.globalAlpha=clamp(p.t/.6,0,1)*.8;rect(c,x,y,1,1,'#e8e4c8')}c.globalAlpha=1;
 /* sinalizador verde da pistola Very: sobe, abre e desce devagar clareando o chão */
 for(const f of FLARES){const x=ox+Math.round(f.x*Z),y=oy+Math.round((f.y-f.z)*Z),k=clamp(1-f.t/f.life,0,1);
  if(f.vz>0){for(let i=1;i<5;i++)rect(c,x,y+i*2,1,1,i<2?'#e8ffd0':'#6f9a55')}else{const R=20,g=haloSprite(R);c.globalAlpha=.35*k;c.drawImage(g,x-R,y+Math.round(f.z*Z)-R);c.globalAlpha=1}
  rect(c,x-1,y-1,3,3,'#3f7a2a');rect(c,x,y,1,1,'#eaffd8');if(f.vz<=0&&((time*14)|0)%2)rect(c,x-1,y,1,1,'#b8ff8a')}
 /* bandeiras de setor tomado */
 for(const s of SECT){if(s.holder===s.team)continue;const x=ox+Math.round(s.fx*Z),y=oy+Math.round(s.fy*Z);if(x<-10||y<-20||x>vw+10||y>vh+10)continue;
  const col=s.holder?'#b67765':'#679fae',wv=((time*4+s.fx)|0)%2;rect(c,x,y-12,1,12,'#c1b993');rect(c,x+1,y-12,5,3+wv,col);rect(c,x+1,y-12,5,1,s.holder?'#d89a88':'#8ec2d0');rect(c,x-1,y,3,1,'#3b3124')}}
/* deitado: sprite girado 90° (sem antialias), cabeça para o inimigo; rastejando: balança 1 px */
const ROT=[new WeakMap(),new WeakMap()];
function rot(src,cw){const m=ROT[cw?0:1];let r=m.get(src);if(r)return r;r=mkc(src.height,src.width);const g=r.getContext('2d');
 if(cw){g.translate(src.height,0);g.rotate(Math.PI/2)}else{g.translate(0,src.width);g.rotate(-Math.PI/2)}g.drawImage(src,0,0);m.set(src,r);return r}
function drawUnit(c,u,sp,sx,sy,vis,bob,orig){
 if(u.pv&&u.pv.stun>.05)return orig();
 const prone=u.pinned||(u===player&&mode==='soldier'&&PL.prone);
 if(u.lunge){const k=u.lunge.t/.16,L=hyp(u.lunge.dx,u.lunge.dy)||1;sx+=Math.round(u.lunge.dx/L*3*k);sy+=Math.round(u.lunge.dy/L*2*k)}
 if(prone&&!(window.PXW&&PXW.depth(u.x,u.y)>=.25)){const r=rot(sp.c,Math.cos(u.angle||0)>=0),wig=u.moving?(((time*6+u.id)|0)&1):0;
  c.drawImage(r,sx-(r.width>>1)+wig,sy-(r.height>>1)+4);return true}
 if(u.lunge){c.drawImage(sp.c,0,0,sp.c.width,vis,sx-sp.ax,sy-sp.ay+bob,sp.c.width,vis);return true}
 return orig()}
/* máscara de gás do jogador: duas lentes embaçadas; fora delas, o escuro da borracha */
let MASK=null;
function maskCanvas(){if(MASK&&MASK.width===vw&&MASK.height===vh)return MASK;MASK=mkc(vw,vh);const g=MASK.getContext('2d'),cy=vh*.47,rx=vw*.2,ry=vh*.36,L=[vw/2-vw*.215,vw/2+vw*.215];
 for(let y=0;y<vh;y++){const q=(y-cy)/ry,h=q*q<1?rx*Math.sqrt(1-q*q):-1;let x=0;
  for(const cx of L){if(h<0)continue;const a=Math.round(cx-h),b=Math.round(cx+h);g.fillStyle='#0a0c09';g.fillRect(x,y,Math.max(0,a-x),1);g.fillStyle='#3a3b30';g.fillRect(a-2,y,2,1);g.fillRect(b,y,2,1);x=b+2}
  g.fillStyle='#0a0c09';g.fillRect(x,y,vw-x,1)}
 for(let i=0;i<vw*vh*.05;i++){const x=Math.random()*vw|0,y=Math.random()*vh|0;let e=9;for(const cx of L){const dx=(x-cx)/rx,dy=(y-cy)/ry;e=Math.min(e,dx*dx+dy*dy)}
  if(e<1&&Math.random()<e*e*.9){g.fillStyle=Math.random()<.25?'rgba(90,80,55,.5)':'rgba(205,212,190,.28)';g.fillRect(x,y,1,1)}}
 return MASK}
function drawScreen(){
 if(!S.on||mode!=='soldier'||!player)return;
 const sup=player.suppression||0;
 if(sup>.8&&!player.mask){const a=clamp((sup-.8)/1.2,0,1)*.45;ctx.globalAlpha=a;for(const t of[4,8,12]){rect(ctx,0,0,vw,t,'#000');rect(ctx,0,vh-t,vw,t,'#000');rect(ctx,0,0,t,vh,'#000');rect(ctx,vw-t,0,t,vh,'#000')}ctx.globalAlpha=1}
 if(player.mask){ctx.drawImage(maskCanvas(),0,0);const b=.1+.08*Math.sin(time*TAU/3.3);ctx.globalAlpha=b;rect(ctx,0,0,vw,vh,'#c9d0bc');ctx.globalAlpha=1}}
function screenFilter(){try{if(!S.on||CONC.t<=0){if(canvas.style.filter)canvas.style.filter='';return}const k=CONC.k*clamp(CONC.t/CONC.max,0,1);
 canvas.style.filter=`blur(${(k*2.6).toFixed(2)}px) saturate(${(1-k*.6).toFixed(2)}) brightness(${(1+k*.25).toFixed(2)})`}catch{}}

/* ======================================================================================
   ENTRADA DO JOGADOR
   ====================================================================================== */
function playerMask(on){if(!player||mode!=='soldier'||player.type==='tank')return false;if(on===!!player.mask)return false;
 if(on){if(PL.maskT>time)return true;PL.maskT=time+1.2;player.cd=Math.max(player.cd,1.2);toast('Colocando a máscara…')}
 else{player.mask=0;PL.maskT=0;toast('Máscara retirada.')}return true}
window.addEventListener('keydown',e=>{if(!S.on||e.repeat||document.querySelector('dialog[open]')||!started||ended)return;const k=e.key.toLowerCase();
 if(k==='v'){overTop(playerTeam,{smoke:e.shiftKey});e.preventDefault();return}
 if(mode==='soldier'&&player&&player.type!=='tank'){
  if(k==='g'&&!player.mask&&(time-alarm[playerTeam]<60||gasAtPos(player.x,player.y)>.03)){e.stopImmediatePropagation();playerMask(true);return}
  if(k==='m'){e.stopImmediatePropagation();playerMask(!player.mask);return}
  if(k==='z'){PL.prone=!PL.prone;toast(PL.prone?'Deitado: menos exposto, rastejando.':'De pé.');return}
  if(k==='q'){playerMelee();return}}
 if(k==='6'&&tab==='support'&&mode==='commander'){e.stopImmediatePropagation();choose('gas')}},true);

/* ======================================================================================
   LIGAÇÕES COM O JOGO
   ====================================================================================== */
defs.gas={name:'Gás mostarda',sub:'4 granadas · nuvem vai com o vento',cost:CFG.GAS.cost};
wrap('setup',(orig,...a)=>{const r=orig(...a);try{reset()}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{let boom=null;
 if(S.on)try{for(const u of units){u._ax=u.x;u._ay=u.y}for(const s of shells)if(s.inside&&s.t-dt<=0)(boom||(boom=[])).push(s)}catch(e){fail(e)}
 orig(dt);
 if(!S.on)return;try{if(boom)for(const s of boom)confined(s);tick(dt)}catch(e){fail(e)}});
wrap('protectedBy',(orig,u)=>{let f=orig(u);if(!S.on||u.type==='tank')return f;
 if(u.pinned||(u===player&&mode==='soldier'&&PL.prone)){f*=CFG.PIN.prot;if(inCrater(u))f=Math.min(f,CFG.PIN.crater)}return f});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on)return;try{
 if(mode==='soldier'&&player&&player.type!=='tank'&&r>=30){const d=hyp(player.x-x,player.y-y),R=r*CFG.CONC.reach;if(d<R){let k=clamp((1-d/R)*(power/150),0,1.2);if(PL.prone)k*=.5;if(protectedBy(player)<.4)k*=.7;
  if(k>CFG.CONC.min){const T=1.5+k*4.5;if(T>CONC.t){CONC.t=T;CONC.max=T;CONC.k=k}screenShake=Math.max(screenShake,3+k*6);deafen(k,T)}}}}catch(e){fail(e)}});
wrap('shoot',(orig,u,target,manual)=>{if(S.on&&u.mask&&!manual&&u.type!=='tank'&&Math.random()<.3){u.cd=defs[u.type]?.rate||1;return}           // lentes embaçadas: erra mais
 if(S.on&&manual&&u===player&&PL.maskT>time)return;return orig(u,target,manual)});
wrap('place',(orig,x,y)=>{if(!S.on||placement!=='gas')return orig(x,y);if(!spend('gas'))return;launchGas(playerTeam,x,y);toast('Gás a caminho. Cuidado com o vento.');sound('click');hud();
 if(!keys.Shift){placement=null;makeCards();const h=document.getElementById('placehint');if(h)h.textContent='Escolha uma unidade e posicione no campo'}});
wrap('makeCards',orig=>{orig();try{if(tab!=='support'||!S.on)return;const d=defs.gas,b=document.createElement('button');b.className='card'+(placement==='gas'?' active':'');
 b.innerHTML=`<canvas width="48" height="48"></canvas><b>${d.name}</b><small>${d.sub}</small><span class="cost">◈ ${sandbox?'∞':d.cost}</span><kbd>6</kbd>`;b.onclick=()=>choose('gas');
 document.getElementById('cards').append(b);icon('gas',b.querySelector('canvas').getContext('2d'))}catch(e){fail(e)}});
wrap('icon',(orig,type,c)=>{if(type!=='gas')return orig(type,c);orig('artillery',c);const k=c.canvas.width/56;
 for(let y=-12;y<=12;y++)for(let x=-16;x<=16;x++){const d=(x/16)**2+(y/12)**2;if(d>1||BAYER[((y+64)&3)*4+((x+64)&3)]/16>(1-d)*.9)continue;c.fillStyle=d<.35?'#e4dc84':'#b5ad58';c.fillRect(Math.round((28+x)*k),Math.round((34+y)*k),Math.max(1,Math.round(k)),Math.max(1,Math.round(k)))}});
wrap('hud',orig=>{orig();try{if(!S.on||mode!=='soldier'||!player)return;const el=document.getElementById('coverstatus');if(!el)return;const bits=[];
 if((player.suppression||0)>.8)bits.push('SUPRIMIDO '+'▮'.repeat(clamp(Math.round(player.suppression*2),1,4)));if(PL.prone)bits.push('DEITADO');
 if(player.mask)bits.push('MÁSCARA');else if(PL.maskT>time)bits.push('MÁSCARA…');else if(gasAtPos(player.x,player.y)>.05)bits.push('GÁS! (G)');
 if(bits.length)el.textContent=el.textContent+' · '+bits.join(' · ')}catch(e){fail(e)}});
wrap('render',(orig,...a)=>{const r=orig(...a);try{drawScreen();screenFilter()}catch(e){fail(e)}return r});
if(window.WW1A){const over=WW1A.over;WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);try{drawOver(c,ox,oy)}catch(e){fail(e)}}}
if(!window.PHYS)window.PHYS={on:false,draw:()=>false};
{const orig=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){const o=()=>orig.call(PHYS,c,u,sp,sx,sy,vis,bob);
 if(!S.on||!(u.pinned||u.lunge||(u===player&&PL.prone)))return o();try{return drawUnit(c,u,sp,sx,sy,vis,bob,o)}catch(e){fail(e);return o()}}}
/* botão AO ATAQUE ao lado de AVANÇAR */
try{const adv=document.getElementById('column')||document.getElementById('advance');if(adv){const b=document.createElement('button');b.id='overtop';b.textContent='ATAQUE · V';b.title='Pistola Very + apitos: os pelotões saem da trincheira (Shift+V com fumaça)';
 b.onclick=e=>{if(started&&!ended)overTop(playerTeam,{smoke:e.shiftKey})};adv.after(b)}}catch{}

S.state=()=>({on:S.on,pinned:units.filter(u=>u.pinned).length,waves:WAVES.length,puffs:PUFFS.length,gasShells:GS.length,masked:[0,1].map(t=>units.filter(u=>u.team===t&&u.mask).length),
 sectors:SECT.map(s=>s.name+s.team+'→'+s.holder),front:[...FRONT],conc:+CONC.t.toFixed(2),stats:{...S.stats}});
S.refresh=refresh;S.overTop=overTop;S.launchGas=launchGas;S.tick=tick;S.reset=reset;S.aiTick=aiTick;S.gasAt=gasAtPos;S.player=PL;
Object.defineProperties(S,{puffs:{get:()=>PUFFS},sectors:{get:()=>SECT},entrances:{get:entrances}});
if(window.IronFront)window.IronFront.assault=S;
})();
