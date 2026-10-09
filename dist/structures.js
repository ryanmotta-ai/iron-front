/* Estruturas militares destrutíveis (feedback #1, itens 3, 4, 5 e 6).
   Um registro único (PXSTRUCT) de tudo o que a guerra pode atacar, defender, consertar ou capturar:
     · retaguarda de cada lado — quartel-general, centro de comunicações, hospital de campanha, depósito de combustível;
     · adaptadores sobre o que já existia — depósito de munição e peças da bateria (battery.js), posto médico (medics.js),
       depósito/posto de obras (works.js), antiaéreas e canhões construídos (fortify.js), bunkers (buildings[]);
     · fontes externas (airwar.js registra o aeródromo) por PXSTRUCT.addSource().
   Cada estrutura tem HP, resistência por material, estados (ok → danificada → crítica → destruída), eficiência derivada do estado
   (eff 1 / .75 / .4 / 0), fogo, escombros desenhados e captura (peças abandonadas). O dano vem de explosões (artilharia, bombas,
   tanque, granadas), de balas (muito reduzidas por material) e de cargas de demolição (PXSTRUCT.charge).
   Liga/desliga: ?estruturas=0 · API: IronFront.structures (list, at, damage, repair, charge, state, integrity, logistics, hqDown). */
(function(){
'use strict';
if(typeof update!=='function'||typeof explode!=='function'||typeof buildings==='undefined')return;
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const S=window.PXSTRUCT={on:!/[?&]estruturas=0/.test(location.search),version:'1.0',list:[],stats:{destroyed:[0,0],captured:0,charges:0,errors:0},events:[],listeners:[],sources:[]};
let errs=0;function fail(e){S.stats.errors++;if(++errs<=3)console.error('structures.js:',e);if(errs>=12){S.on=false;console.error('structures.js desligado após erros repetidos')}}

/* multiplicador de dano por material × tipo de ataque (bala de fuzil/MG, canhão, explosão, bomba, carga de demolição, fogo) */
const MAT={
 brick:{bullet:.03,cannon:.55,expl:1,bomb:1.2,charge:2,fire:.15},
 concrete:{bullet:.012,cannon:.35,expl:.6,bomb:.9,charge:1.5,fire:0},
 wood:{bullet:.12,cannon:.85,expl:1.3,bomb:1.4,charge:2,fire:1},
 canvas:{bullet:.25,cannon:1,expl:1.2,bomb:1.5,charge:2,fire:1.4},
 steel:{bullet:.02,cannon:.4,expl:.7,bomb:1,charge:1.5,fire:.1},
 earth:{bullet:.02,cannon:.6,expl:.8,bomb:1,charge:1.4,fire:0}};
S.MAT=MAT;
/* tipos: nome, material, HP, pegada (mundo), valor estratégico, inflamável (0..1), reconstrutível */
const KIND={
 hq:{name:'Quartel-general',mat:'brick',hp:2400,w:128,h:92,value:100,flam:.3},
 comms:{name:'Centro de comunicações',mat:'wood',hp:800,w:84,h:62,value:85,flam:.6,rebuild:1},
 fuel:{name:'Depósito de combustível',mat:'steel',hp:520,w:62,h:48,value:55,flam:1,rebuild:1},
 hospital:{name:'Hospital de campanha',mat:'canvas',hp:650,w:112,h:150,value:50,flam:.8,rebuild:1},
 depot:{name:'Depósito de munição',mat:'brick',hp:450,w:110,h:70,value:60,flam:.2},
 medpost:{name:'Posto médico',mat:'canvas',hp:400,w:56,h:40,value:60,flam:.7},
 gun:{name:'Posição de artilharia',mat:'steel',hp:520,w:46,h:38,value:90,flam:0,f:1},
 aa:{name:'Bateria antiaérea',mat:'steel',hp:300,w:36,h:34,value:45,flam:0,f:1},
 bunker:{name:'Bunker',mat:'concrete',hp:1000,w:50,h:40,value:40,flam:0},
 wdepot:{name:'Depósito de campo',mat:'wood',hp:300,w:44,h:36,value:40,flam:.6},
 op:{name:'Posto de observação',mat:'wood',hp:250,w:30,h:30,value:25,flam:.5}};
S.KIND=KIND;
/* concordância de gênero nas mensagens: S.ge(e,'inimigo','inimiga') */
S.ge=(e,m,f)=>KIND[e.kind]?.f?f:m;
S.ofE=e=>`${e.name.toLowerCase()}`;
const STATE=[{k:'ok',eff:1},{k:'damaged',eff:.75},{k:'critical',eff:.4},{k:'destroyed',eff:0}];
const ratio=e=>e.max>0?clamp(e.hp/e.max,0,1):0;
const stateOf=e=>e.hp<=0?3:ratio(e)<=.33?2:ratio(e)<=.66?1:0;
let serial=0;const byRef=new Map();

/* ---------- retaguarda: coordenadas de arte do mapa "trenches" × 2; nos outros mapas relativas à bandeira ---------- */
const baked=()=>typeof map!=='undefined'&&map==='trenches'&&!!(window.PX&&PX.WW1);
const REAR=[ // kind, dx e dy relativos à bandeira (recuados), arte x/y (lado 0)
 {kind:'hq',ax:66,ay:420,dx:-128,dy:40},{kind:'comms',ax:70,ay:374,dx:-120,dy:-52},
 {kind:'fuel',ax:42,ay:324,dx:-176,dy:-152},{kind:'hospital',ax:66,ay:236,dx:-128,dy:-314}];
let STATIC=[];
function buildStatic(){
 STATIC=[];if(typeof points==='undefined'||!points.length)return;
 for(const team of [0,1]){const home=points.find(p=>p.home===team);if(!home)continue;const back=team?1:-1;
  for(const r of REAR){const K=KIND[r.kind];void back;
   const x=baked()?(team?W-r.ax*2:r.ax*2):home.x+(team?-r.dx:r.dx),y=baked()?r.ay*2:home.y+r.dy;
   STATIC.push({own:1,kind:r.kind,team,x,y,hp:K.hp,max:K.hp,dead:false,burn:0,smoke:0,seed:STATIC.length*7+team})}}
}
/* ---------- fontes (adaptadores) ---------- */
const spec=(ref,kind,team,x,y,extra={})=>Object.assign({ref,kind,team,x,y},extra);
S.addSource=fn=>{S.sources.push(fn)};
function sourceStatic(out){for(const s of STATIC)out.push(spec(s,s.kind,s.team,s.x,s.y,{own:1}))}
function sourceBattery(out){const B=window.PXBAT;if(!B)return;
 try{for(const d of B.depots||[])out.push(spec(d,'depot',d.team,d.x*2,d.y*2,{legacy:1,deadFlag:1}))}catch(e){}
 try{const gs=B.batteries||[];const GU=window.PXFORT?.guns||[];
  for(const g of gs){if(g.hp===undefined){g.hp=KIND.gun.hp;g.max=KIND.gun.hp}
   const built=GU.find(q=>q.b===g);out.push(spec(built||g,'gun',g.team,g.cx*2,g.cy*2,{gun:g,legacy:built?1:0,own:built?0:1,big:g.big}))}}catch(e){}}
function sourceMedics(out){const m=window.PXMED?.posts;if(m&&m.length!==undefined)for(const p of m)out.push(spec(p,'medpost',p.team,p.x,p.y,{legacy:1}))}
function sourceWorks(out){const w=window.PXWORKS;if(!w)return;try{for(const d of w.depots?.()||[])out.push(spec(d,'wdepot',d.team,d.x,d.y,{legacy:1}));for(const o of w.ops?.()||[])out.push(spec(o,'op',o.team,o.x,o.y,{legacy:1}))}catch(e){}}
function sourceFort(out){const f=window.PXFORT;if(!f)return;try{for(const a of f.aa||[])out.push(spec(a,'aa',a.team,a.x,a.y,{legacy:1}))}catch(e){}}
function sourceBunkers(out){for(const b of buildings)if(b.type==='bunker'&&b.hp>0)out.push(spec(b,'bunker',b.team,b.x,b.y,{legacy:1,bld:1}))}

function sync(){
 const seen=new Set(),out=[];
 sourceStatic(out);sourceBattery(out);sourceMedics(out);sourceWorks(out);sourceFort(out);sourceBunkers(out);
 for(const fn of S.sources)try{fn(out)}catch(e){fail(e)}
 for(const sp of out){let e=byRef.get(sp.ref);const K=KIND[sp.kind]||{name:sp.kind,mat:'wood',hp:100,w:40,h:40,value:20,flam:0};
  if(!e){e={id:++serial,ref:sp.ref,kind:sp.kind,team:sp.team,x:sp.x,y:sp.y,w:sp.w||K.w,h:sp.h||K.h,name:sp.name||K.name,mat:sp.mat||K.mat,value:sp.value||K.value,flam:K.flam,
   max:sp.ref.max||sp.ref.maxhp||K.hp,hp:sp.ref.hp,own:!!sp.own,legacy:!!sp.legacy,bld:!!sp.bld,state:0,eff:1,burn:0,smoke:0,known:[sp.team===0||false,sp.team===1||false],born:time,seed:serial*13,gun:sp.gun||null,rebuild:K.rebuild};
   if(sp.kind==='hq'||sp.kind==='hospital'||sp.kind==='comms'||sp.knownAll)e.known=[true,true];  // as retaguardas são conhecidas (a bandeira denuncia o QG)
   byRef.set(sp.ref,e);S.list.push(e)}
  seen.add(e);e.team=sp.team;e.x=sp.x;e.y=sp.y;if(sp.big!==undefined)e.big=sp.big;
  e.max=sp.ref.max||sp.ref.maxhp||e.max;e.hp=Math.max(0,sp.ref.hp);
  if(sp.kind==='depot'&&sp.ref.dead)e.hp=0;
  if(e.hp<=0)die(e);else if(e.destroyed&&e.rebuilt){e.destroyed=false;e.rebuilt=false}}
 for(const e of S.list)if(!seen.has(e)&&!e.destroyed){e.hp=0;die(e)}      // a fonte removeu (HP≤0 em buildings[], peça desmontada…)
 for(const e of S.list){const st=stateOf(e);if(st!==e.state){const was=e.state;e.state=st;e.eff=STATE[st].eff;if(st>was&&st<3)emit('state',e)}}
}
function emit(type,e,extra){const ev=Object.assign({type,e,t:time},extra);S.events.push(ev);if(S.events.length>80)S.events.shift();for(const f of S.listeners)try{f(ev)}catch(x){fail(x)}}
S.listen=f=>{S.listeners.push(f)};

/* ---------- destruição ---------- */
function die(e){
 if(e.destroyed)return;e.destroyed=true;e.state=3;e.eff=0;e.hp=0;e.dyingAt=time;e.smoke=e.flam>.4?70:40;e.burn=0;
 S.stats.destroyed[e.team]++;
 if(e.ref&&e.own&&e.ref.hp>0)e.ref.hp=0;
 if(e.ref&&e.ref.dead===false)e.ref.dead=true;
 if(e.gun){e.gun.hp=0;for(const c of e.gun.crew||[])if(c.alive&&Math.random()<.7){c.alive=false;c.hp=0}try{window.PXBAT?.removeGun?.(e.gun)}catch(x){}}
 const big=e.kind==='fuel'||e.kind==='depot'||e.kind==='hq'||e.kind==='wdepot';
 if(!e.bld)explode(e.x,e.y,big?(e.kind==='fuel'?95:75):42,big?(e.kind==='fuel'?170:130):60,e.dmgTeam??1-e.team);
 const mine=e.team===playerTeam;
 try{if(typeof toast==='function')toast(`${e.name} ${mine?S.ge(e,'aliado','aliada'):S.ge(e,'inimigo','inimiga')} ${S.ge(e,'destruído','destruída')}!`)}catch(x){}
 emit('destroyed',e);
}
S.die=die;

/* dano: raw já em pontos de dano; kind escolhe o multiplicador do material */
function hurt(e,raw,kind,srcTeam){
 if(e.destroyed||raw<=0)return 0;const m=MAT[e.mat]||MAT.wood,n=raw*(m[kind]??1);
 if(srcTeam!==undefined)e.dmgTeam=srcTeam;
 e.lastHit=time;e.lastKind=kind;e.ref.hp-=n;e.hp=Math.max(0,e.ref.hp);
 if((kind==='expl'||kind==='bomb'||kind==='charge'||kind==='cannon')&&e.flam>0&&Math.random()<e.flam*.5&&e.burn<=0)e.burn=rnd(14,34)*(e.kind==='fuel'?1.6:1);
 if(e.ref.hp<=0)die(e);return n;
}
S.damage=hurt;
/* quanto tempo um grupo leva para destruir (estimativa para a IA e para as ordens): dps por tipo de ataque */
const DPS={rifle:{bullet:30/1.7},mg:{bullet:13/.22},tank:{cannon:180*2/3.2},grenade:{expl:120*2/10},charge:{charge:700/20}};
S.estimate=(e,units)=>{const m=MAT[e.mat]||MAT.wood;let dps=0;for(const u of units){const t=u.type==='tank'?DPS.tank.cannon*m.cannon:u.type==='mg'?DPS.mg.bullet*m.bullet:DPS.rifle.bullet*m.bullet+(u.gren>0?DPS.grenade.expl*m.expl:0)+(u.sap?DPS.charge.charge*m.charge:0);dps+=t}
 return dps>.01?e.hp/dps:Infinity};
S.canHurt=(e,u)=>{const m=MAT[e.mat]||MAT.wood;if(u.type==='tank')return m.cannon>=.3;if(u.sap||u.gren>0)return true;if(u.type==='mg')return m.bullet>=.08;return m.bullet>=.1}
S.repair=(e,n)=>{if(!e||e.destroyed||n<=0)return 0;const was=e.ref.hp;e.ref.hp=Math.min(e.max,e.ref.hp+n);e.hp=e.ref.hp;if(e.burn>0&&ratio(e)>.5)e.burn=0;return e.ref.hp-was};
S.rebuild=(e)=>{if(!e||!e.destroyed||!e.rebuild||!e.own)return false;e.ref.hp=e.max*.3;e.ref.dead=false;e.hp=e.ref.hp;e.destroyed=false;e.rebuilt=true;e.smoke=0;e.state=2;e.eff=.4;emit('rebuilt',e);return true};
/* carga de demolição: explode depois de 'delay' s; quem a coloca fica exposto */
const CHARGES=[];
S.charge=(e,team,delay=6)=>{if(!e||e.destroyed)return false;CHARGES.push({e,team,t:delay,x:e.x+rnd(-14,14),y:e.y+rnd(-10,10)});S.stats.charges++;return true};

/* ---------- consultas ---------- */
S.alive=team=>S.list.filter(e=>!e.destroyed&&(team===undefined||e.team===team));
S.at=(x,y,team,pad=0)=>{let best=null,bd=1e9;for(const e of S.list){if(team!==undefined&&e.team!==team)continue;if(Math.abs(x-e.x)<=e.w/2+pad&&Math.abs(y-e.y)<=e.h/2+pad){const d=hyp(x-e.x,y-e.y);if(d<bd){bd=d;best=e}}}return best};
S.near=(x,y,r,team)=>S.list.filter(e=>!e.destroyed&&(team===undefined||e.team===team)&&hyp(e.x-x,e.y-y)<=r+Math.max(e.w,e.h)/2);
S.effOf=(team,kind)=>{let m=0;for(const e of S.list)if(e.team===team&&e.kind===kind)m=Math.max(m,e.eff);return m};
S.hqDown=team=>S.list.some(e=>e.team===team&&e.kind==='hq'&&e.destroyed);
S.integrity=team=>{let a=0,b=0;for(const e of S.list)if(e.team===team&&e.value>=40){b+=e.value;a+=e.value*ratio(e)}return b?a/b:1};
S.logistics=team=>{let a=0,b=0;for(const e of S.list)if(e.team===team&&['depot','fuel','wdepot','hq','comms'].includes(e.kind)){const w=e.kind==='hq'?.5:1;b+=w;a+=w*(e.destroyed?0:.35+.65*ratio(e))}return b?a/b:1};
S.label=e=>`${e.name}${e.destroyed?' (destruído)':e.state?` · ${['','danificado','crítico'][e.state]}`:''}`;
S.gridRef=(x,y)=>{const c=clamp(Math.floor(x/200),0,11),r=clamp(Math.floor(y/250),0,7);return String.fromCharCode(65+c)+(r+1)};
const known=(e,team)=>!!e.known[team];S.known=known;

/* ---------- tick ---------- */
let syncT=0,fxT=0,scanT=0,gunT=0;
function nearEnemy(e,r){let n=0;for(const u of units)if(u.team!==e.team&&u.hp>0&&!u.down&&u.cls!=='medic'&&Math.abs(u.x-e.x)<r&&Math.abs(u.y-e.y)<r&&hyp(u.x-e.x,u.y-e.y)<r)n++;return n}
function nearOwn(e,r){let n=0;for(const u of units)if(u.team===e.team&&u.hp>0&&!u.down&&Math.abs(u.x-e.x)<r&&Math.abs(u.y-e.y)<r&&hyp(u.x-e.x,u.y-e.y)<r)n++;return n}
function discover(){for(const e of S.list){if(e.destroyed)continue;
  if(e.gun&&e.gun.hot>time-40&&!e.known[1-e.team]){e.known[1-e.team]=true;emit('spotted',e,{by:1-e.team})}for(const t of [0,1]){if(e.known[t]||e.team===t)continue;
  for(const u of units){if(u.team!==t||u.hp<=0)continue;if(Math.abs(u.x-e.x)<430&&Math.abs(u.y-e.y)<430&&hyp(u.x-e.x,u.y-e.y)<430){e.known[t]=true;emit('spotted',e,{by:t});break}}}}}
function bullets_(){
 if(typeof bullets==='undefined'||!bullets.length)return;
 for(const e of S.list){if(e.destroyed||e.bld)continue;
  const hw=e.w/2,hh=e.h/2;
  for(const b of bullets){if(!(b.damage>0)||b.t<=0||b.team===e.team)continue;if(b.x<e.x-hw||b.x>e.x+hw||b.y<e.y-hh||b.y>e.y+hh)continue;
   hurt(e,b.damage,'bullet',b.team);b.t=-1;if(Math.random()<.2)particles.push({x:b.x,y:b.y,vx:rnd(-30,30),vy:rnd(-30,30),t:.2,max:.2,color:'#b8a27a',size:3})}}
}
function chargesTick(dt){
 for(let i=CHARGES.length-1;i>=0;i--){const c=CHARGES[i];c.t-=dt;if(c.t>0)continue;CHARGES.splice(i,1);if(c.e.destroyed)continue;
  explode(c.x,c.y,58,70,c.team);hurt(c.e,380,'charge',c.team)}
}
function burnTick(dt){
 for(const e of S.list){
  if(e.destroyed){if(e.smoke>0)e.smoke-=dt;continue}
  if(e.burn>0){e.burn-=dt;hurt(e,(e.kind==='fuel'?7:3.5)*dt,'fire',e.dmgTeam);}
  if(e.state>=1&&e.team===playerTeam&&!e.warned){e.warned=time;}
 }
}
function smokeFx(dt){
 fxT-=dt;if(fxT>0||typeof particles==='undefined')return;fxT=.35;
 for(const e of S.list){const burning=e.burn>0||e.state>=2&&!e.destroyed||e.destroyed&&e.smoke>0;if(!burning)continue;
  if(Math.abs(e.x-cam.x)>760||Math.abs(e.y-cam.y)>560)continue;
  particles.push({x:e.x+rnd(-e.w/3,e.w/3),y:e.y+rnd(-e.h/4,e.h/4),vx:rnd(-6,6),vy:rnd(-26,-14),t:rnd(1.2,2.4),max:2.4,color:e.destroyed?'#3b3a36':e.burn>0?'#4a463f':'#6a665c',size:rnd(5,9)})}
}
/* peças de artilharia: abandonada (sem tripulantes vivos) pode ser capturada por infantaria inimiga */
function guns(dt){
 gunT-=dt;if(gunT>0)return;gunT=.5;
 for(const e of S.list){const g=e.gun;if(!g||e.destroyed)continue;
  const alive=(g.crew||[]).filter(c=>c.alive).length;e.crewAlive=alive;
  e.abandoned=alive===0;
  if(!e.abandoned){e.capT=0;continue}
  const foe=nearEnemy(e,60),own=nearOwn(e,95);
  if(foe>=2&&!own){e.capT=(e.capT||0)+.5;if(e.capT>=7&&!e.destroyed){capture(e)}}else e.capT=Math.max(0,(e.capT||0)-.5)}
}
function capture(e){
 const g=e.gun,newTeam=1-e.team,old=e.team;g.team=newTeam;e.team=newTeam;e.capT=0;e.abandoned=false;g.captured=1;
 (g.crew||[]).forEach((c,i)=>{if(i<2){c.alive=true;c.hp=70}});g.ammo=Math.max(g.ammo||0,10);
 S.stats.captured++;emit('captured',e,{from:old});
 try{if(typeof toast==='function')toast(newTeam===playerTeam?'Peça de artilharia inimiga capturada!':'Uma peça aliada foi capturada!')}catch(x){}
}

/* ---------- ligações ---------- */
const wrap=(n,fn)=>{const o=window[n];if(typeof o!=='function'){console.warn('structures.js: função ausente: '+n);return}window[n]=function(...a){return fn(o,...a)}};
wrap('setup',(orig,...a)=>{const r=orig(...a);try{S.list=[];byRef.clear();S.events=[];CHARGES.length=0;buildStatic();sync()}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{orig(dt);if(!S.on||!started||ended||!(dt>0))return;
 try{if((syncT-=dt)<=0){syncT=.25;sync();discover()}bullets_();chargesTick(dt);burnTick(dt);smokeFx(dt);guns(dt)}catch(e){fail(e)}});
/* explosões: dano só nas estruturas "próprias" (as legadas já têm o próprio tratamento em seus módulos) */
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on||power<=0)return;
 try{for(const e of S.list){if(e.destroyed||!e.own||e.legacy)continue;const rad=r+Math.max(e.w,e.h)*.35,d=hyp(e.x-x,e.y-y);if(d>=rad)continue;
   hurt(e,power*2*(1-d/rad),r>=80?'bomb':'expl',team)}}catch(err){fail(err)}});

/* ---------- desenho: sprite próprio onde a arte não está pintada, estados em todos ---------- */
const COL={0:{wall:'#6f7448',roof:'#4c5236',dark:'#2f3220'},1:{wall:'#6a6f77',roof:'#474c53',dark:'#262a2f'}};
function intact(c,x,y,e){
 const hw=Math.round(e.w*.5*.5),hh=Math.round(e.h*.5*.5),k=COL[e.team];
 c.fillStyle='#14160f';c.fillRect(x-hw-1,y-hh-1,hw*2+2,hh*2+2);
 if(e.kind==='fuel'){c.fillStyle='#55584d';for(let i=0;i<3;i++){c.fillRect(x-hw+1+i*Math.round(hw*.7),y-hh+2,Math.round(hw*.6),hh*2-3)}c.fillStyle='#b8442e';c.fillRect(x-hw+2,y-hh+4,hw*2-4,2);return}
 c.fillStyle=k.wall;c.fillRect(x-hw,y-hh,hw*2,hh*2);c.fillStyle=k.roof;c.fillRect(x-hw,y-hh,hw*2,Math.max(3,hh));c.fillStyle=k.dark;c.fillRect(x-hw,y+hh-2,hw*2,2);
 if(e.kind==='comms'){commsHut(c,x,y,e);return}
 if(e.kind==='hospital'){c.fillStyle='#d8d4c2';c.fillRect(x-hw+2,y-hh+2,hw*2-4,hh*2-4);c.fillStyle='#b8402f';c.fillRect(x-3,y-1,7,2);c.fillRect(x-1,y-3,3,6)}
 if(e.kind==='hq'){c.fillStyle='#14160f';c.fillRect(x-2,y,5,hh)}
}
/* centro de comunicações: cabana de tábuas com telhado de papelão alcatroado, porta, janela com lâmpada, sacos de areia e mastro de rádio com fios */
function commsHut(c,x,y,e){
 const hw=Math.round(e.w*.25),hh=Math.round(e.h*.25),k=COL[e.team];
 c.fillStyle='#14160f';c.fillRect(x-hw-1,y-hh+3,hw*2+2,hh*2-2);
 c.fillStyle='#7a6747';c.fillRect(x-hw,y-hh+5,hw*2,hh*2-5);                      // paredes de tábua
 c.fillStyle='#5e4f36';for(let i=-hw+3;i<hw;i+=4)c.fillRect(x+i,y-hh+5,1,hh*2-5);
 c.fillStyle=k.roof;c.fillRect(x-hw-1,y-hh+1,hw*2+2,6);c.fillStyle='#2c2f26';c.fillRect(x-hw-1,y-hh+6,hw*2+2,1);c.fillStyle=k.wall;c.fillRect(x-hw+2,y-hh+2,hw*2-4,1);   // telhado
 c.fillStyle='#1e1b15';c.fillRect(x-hw+4,y+1,5,hh-1);                            // porta
 c.fillStyle='#e8d588';c.fillRect(x+hw-10,y-1,5,4);c.fillStyle='#14160f';c.fillRect(x+hw-10,y+1,5,1);        // janela acesa
 c.fillStyle='#8f8466';for(let i=-hw;i<hw-2;i+=6)c.fillRect(x+i,y+hh-1,5,2);     // sacos de areia
 const mx=x+hw-3;c.fillStyle='#cfc9a8';c.fillRect(mx,y-hh-18,1,19);c.fillRect(mx-4,y-hh-14,9,1);c.fillRect(mx-3,y-hh-9,7,1);   // mastro e travessas
 c.fillStyle='#14160f';for(let i=0;i<=hw*2-6;i+=2)c.fillRect(mx-i,y-hh-17+Math.floor(i/4),1,1);                                      // fio
 c.fillStyle=e.team?'#b8442e':'#3a6ea5';c.fillRect(mx+1,y-hh-18,3,2)}
function flame(c,x,y,t,seed){const f=Math.floor((t*9+seed)%3);c.fillStyle='#e0702a';c.fillRect(x,y-3-f,2,3+f);c.fillStyle='#f4c04a';c.fillRect(x,y-2-f,1,2+f)}
function rubble(c,x,y,e){const hw=Math.round(e.w*.25),hh=Math.round(e.h*.25);
 c.fillStyle='#1d1b17';c.fillRect(x-hw,y-hh+2,hw*2,hh*2-2);
 for(let i=0;i<9;i++){const r=(e.seed*31+i*17)%97,px=x-hw+3+(r*7)%Math.max(4,hw*2-6),py=y-hh+4+(r*5)%Math.max(4,hh*2-6);c.fillStyle=i%3?'#3b352c':'#6a5a43';c.fillRect(px,py,2+(r%4),1+(r%2))}
 c.fillStyle='#8a7a58';c.fillRect(x-hw+2,y-1,Math.max(3,hw),1)}
function drawEnt(c,ox,oy,e,t){
 const Z=(window.PX&&PX.Z)||.5,x=ox+Math.round(e.x*Z),y=oy+Math.round(e.y*Z);
 if(x<-90||y<-90||x>vw+90||y>vh+90)return;
 const hw=Math.round(e.w*Z/2),hh=Math.round(e.h*Z/2);
 if(e.destroyed){rubble(c,x,y,e);if(e.smoke>0&&e.smoke>40)flame(c,x+((e.seed%5)-2)*3,y-2,t,e.seed);return}
 if(e.own&&!e.legacy&&(!baked()&&['hq','comms','fuel','hospital'].includes(e.kind)||e.kind==='comms'))intact(c,x,y,e);
 if(e.state>=1){
  for(let i=0;i<3+e.state*3;i++){const r=(e.seed*13+i*29)%89;c.fillStyle=i%2?'#1f1c17':'#34302a';c.fillRect(x-hw+3+(r*3)%Math.max(4,hw*2-6),y-hh+3+(r*5)%Math.max(4,hh*2-6),2+r%3,2)}
  if(e.state>=2)for(let i=0;i<2+Math.floor(hw/8);i++)flame(c,x-hw+4+((i*13+e.seed)%Math.max(5,hw*2-8)),y-hh+6+(i*7)%Math.max(4,hh),t,e.seed+i)}
 else if(e.burn>0)flame(c,x,y-2,t,e.seed);
 if(e.state>=1||e.hp<e.max*.995&&e.lastHit&&time-e.lastHit<8){const f=ratio(e),w=Math.max(16,Math.round(hw*1.4));
  c.fillStyle='#14160f';c.fillRect(x-(w>>1)-1,y-hh-9,w+2,5);c.fillStyle=f>.66?'#8fb25a':f>.33?'#d4b04a':'#d2603e';c.fillRect(x-(w>>1),y-hh-8,Math.max(1,Math.round(w*f)),3)}
}
if(window.WW1A){const over=WW1A.over;WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);if(!S.on||!started)return;
 try{const t=performance.now()/1000;for(const e of S.list)if(e.bld&&!e.destroyed&&e.hp>=e.max*.995)continue;else drawEnt(c,ox,oy,e,t)}catch(e){fail(e)}}}

S.state=()=>({on:S.on,count:S.list.length,destroyed:S.stats.destroyed.slice(),captured:S.stats.captured,integrity:[S.integrity(0),S.integrity(1)],
 list:S.list.map(e=>({id:e.id,kind:e.kind,team:e.team,x:Math.round(e.x),y:Math.round(e.y),hp:Math.round(e.hp),max:e.max,state:STATE[e.state].k,burn:e.burn>0,abandoned:!!e.abandoned}))});
window.IronFront=window.IronFront||{};window.IronFront.structures=S;
})();
