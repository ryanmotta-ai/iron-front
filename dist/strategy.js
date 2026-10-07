/* Estratégia da IA, fim das "blobs" e unidades que não ficam presas (feedback #1, itens 4, 5, 9, 18 e 19).
   · INFRAESTRUTURA — a IA passa a ter objetivos que não são soldados: escolhe entre posto médico, artilharia, antiaérea, depósitos,
     comunicações, QG e bunkers conhecidos (avistados ou entregues por tiro/artilharia) e envia um grupo tático (8–14 homens + MG,
     engenheiro com carga, tanque quando a estrutura é dura) com PXORD.assault. Peças que disparam são localizadas e recebem fogo de
     contra-bateria. Missões simultâneas limitadas; o resto do exército segue o plano principal.
   · BLOBS — o avanço final deixa de convergir 150 homens na bandeira: no máximo 3 esquadrões (faixas de ±150 px) ocupam o eixo do
     objetivo; os demais esperam em posição de apoio atrás e entram quando uma faixa fica livre.
   · PRESOS — bunker só atira com linha de visada; alvo que não sofre dano depois de muitos tiros é marcado inválido por 8 s e a busca
     recomeça; unidade que não anda contorna, e na terceira falha desiste da ordem e abriga-se, em vez de correr contra a barreira.
   · OCIOSOS — unidade sem missão procura trincheira, cobertura ou companhia de aliados, em vez de ficar exposta no campo.
   Liga/desliga: ?estrategia=0 · API: IronFront.strategy (raids, lanes, stats, state). */
(function(){
'use strict';
if(typeof update!=='function'||typeof units==='undefined')return;
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const S=window.PXSTRAT={on:!/[?&]estrategia=0/.test(location.search),version:'1.0',
 cfg:{SEP:125,CAP:14,RAID_EVERY:7,RAID_MIN:8,RAID_MAX:14,RAIDS:[1,1,2,3],START:150,COOL:35,FRONT:3,LANE:150,STAGEBACK:300,STUCK_SECS:6,BADSHOTS:10,BADSECS:8,IDLE:7,CB_EVERY:40,KEEP:.55},
 raids:[],front:[new Map(),new Map()],stage:[new Map(),new Map()],stats:{raids:0,raidsDone:0,retargets:0,badTargets:0,noLosBunker:0,stuck:[0,0,0],idleMoves:0,counterBattery:0,errors:0},cool:[0,0],cbAt:[0,0],failed:new Map()};
let errs=0,raidT=0,idleT=0,stuckT=0,cbT=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('strategy.js:',e);if(errs>=12){S.on=false;console.error('strategy.js desligado após erros repetidos')}}
const live=u=>u&&u.hp>0&&!u.down&&!u.rs&&!u.carried&&!u.inBed;
const O=()=>window.PXORD,T=()=>window.PXSTRUCT,C=()=>window.PXCOMM;
const VAL={rifle:10,mg:26,tank:70,cavalry:24};

/* ---------- 1) missões contra infraestrutura ---------- */
function defenders(x,y,team,r=320){let v=0;for(const e of units)if(e.team!==team&&e.hp>0&&!e.down&&hyp(e.x-x,e.y-y)<r)v+=VAL[e.type]||10;
 for(const b of buildings)if(b.team!==team&&b.type==='bunker'&&b.hp>0&&hyp(b.x-x,b.y-y)<r)v+=40;return v}
function score(e,team,from){
 if(S.failed.get(e.id)>time)return -1e9;
 const d=hyp(e.x-from.x,e.y-from.y),def=defenders(e.x,e.y,team);
 return e.value*1.5+(e.kind==='gun'?30:0)+(e.kind==='medpost'?12:0)+(e.kind==='aa'&&window.PXAW?.on?18:0)-d*.03-def*.55;
}
/* perigo de uma rota: soma o valor inimigo a menos de 280 px de pontos ao longo do caminho (poligonal seed → alvo, com desvio opcional) */
function routeDanger(team,pts){
 let danger=0;const foes=[];for(const e of units)if(e.team!==team&&e.hp>0&&!e.down&&!e.sap&&e.cls!=='medic')foes.push(e);
 for(const b of buildings)if(b.team!==team&&b.type==='bunker'&&b.hp>0)foes.push({x:b.x,y:b.y,type:'bunker',hp:1});
 for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],n=Math.max(2,Math.ceil(hyp(b.x-a.x,b.y-a.y)/200));
  for(let k=0;k<=n;k++){const x=a.x+(b.x-a.x)*k/n,y=a.y+(b.y-a.y)*k/n;let v=0;for(const f of foes)if(Math.abs(f.x-x)<280&&Math.abs(f.y-y)<280&&hyp(f.x-x,f.y-y)<280)v+=f.type==='bunker'?40:VAL[f.type]||10;
   danger=Math.max(danger,v)}}
 return danger;
}
/* escolhe o caminho mais seguro: direto, ou com desvio pelos flancos; devolve {danger,wp} */
function bestRoute(team,seed,t){
 const direct=routeDanger(team,[seed,t]);let best={danger:direct,wp:null};
 if(direct<=60)return best;
 const mx=(seed.x+t.x)/2;
 for(const y of [150,H-150,seed.y-450,seed.y+450]){const wp={x:mx,y:clamp(y,80,H-80)},d=routeDanger(team,[seed,wp,t]);if(d<best.danger-15)best={danger:d,wp}}
 return best;
}
function compose(team,target){
 const free=O().free(team);if(free.length<S.cfg.RAID_MIN)return null;
 const own=units.filter(u=>u.team===team&&live(u)&&!u.sap&&u.cls!=='medic'&&u.cls!=='mechanic').length;
 // não esvazia a frente: mantém pelo menos KEEP do exército fora das incursões
 const raiding=S.raids.filter(r=>r.team===team).reduce((n,r)=>n+(r.g?r.g.units.length:0),0);
 if((own-raiding-S.cfg.RAID_MAX)/Math.max(1,own)<S.cfg.KEEP-.1)return null;
 const base=free.filter(u=>u.type==='rifle'||u.type==='mg').sort((a,b)=>hyp(a.x-target.x,a.y-target.y)-hyp(b.x-target.x,b.y-target.y));
 if(!base.length)return null;
 const seed=base[0],pick=base.filter(u=>hyp(u.x-seed.x,u.y-seed.y)<420).slice(0,S.cfg.RAID_MAX);
 if(pick.length<S.cfg.RAID_MIN)return null;
 const hard=(T().MAT[target.mat]?.bullet||0)<.1;
 if(hard||target.hp>700){
  const eng=units.filter(u=>u.team===team&&u.sap&&live(u)&&!u.gid&&!u.engJob&&!u.sapJob&&!(u.manualUntil>time+3)&&hyp(u.x-seed.x,u.y-seed.y)<700).slice(0,2);pick.push(...eng);
  const tank=units.filter(u=>u.team===team&&u.type==='tank'&&live(u)&&!u.gid&&!(u.manualUntil>time+3)&&hyp(u.x-seed.x,u.y-seed.y)<700&&!u.trk)[0];if(tank&&target.hp>500)pick.push(tank)}
 if(T().estimate(target,pick)>520)return null;
 return pick;
}
function raidTick(){
 if(!O()||!T())return;
 for(const r of S.raids.slice()){const g=r.g;
  if(!g||!O().groups().includes(g)||g.state==='done'||r.target.destroyed||time-r.t0>330){
   if(r.target.destroyed)S.stats.raidsDone++;else if(g&&O().groups().includes(g)&&time-r.t0>330){O().retreat(g);S.failed.set(r.target.id,time+120)}
   S.raids=S.raids.filter(q=>q!==r);S.cool[r.team]=time+S.cfg.COOL}}
 for(const team of [0,1]){
  if(!aiEnabled[team]||time<S.cfg.START||time<S.cool[team])continue;
  const mine=S.raids.filter(r=>r.team===team).length,army=units.filter(u=>u.team===team&&live(u)).length,cap=army>=200?S.cfg.RAIDS[3]:army>=100?S.cfg.RAIDS[2]:S.cfg.RAIDS[1];
  if(mine>=cap)continue;
  const hq=T().list.find(e=>e.team===team&&e.kind==='hq')||{x:team?W-130:130,y:H/2};
  let best=null,bs=-1e9;
  for(const e of T().list){if(e.team===team||e.destroyed||!T().known(e,team)||S.raids.some(r=>r.target===e))continue;
   const sc=score(e,team,hq);if(sc>bs){bs=sc;best=e}}
  if(!best||bs<8)continue;
  const us=compose(team,best);if(!us){S.failed.set(best.id,time+25);continue}
  const seed=us[0],mass=us.reduce((n,u)=>n+(VAL[u.type]||10),0),route=bestRoute(team,seed,best);
  if(route.danger>mass*.75){S.failed.set(best.id,time+30);S.stats.unsafe=(S.stats.unsafe||0)+1;continue}   // caminho guarnecido demais: espera uma brecha
  const g=O().assault(us,best,{ai:true,via:'estrategia',waypoint:route.wp});
  if(g){S.raids.push({team,target:best,g,t0:time});S.stats.raids++;S.cool[team]=time+S.cfg.COOL*.4;if(route.wp)S.stats.flankRoutes=(S.stats.flankRoutes||0)+1}}
}
/* contra-bateria dirigida: peça/antiaérea localizada (disparou há pouco) leva uma salva da artilharia da IA */
function counterBattery(){
 if(!T()||!window.PXBAT?.mission)return;
 for(const team of [0,1]){if(!aiEnabled[team]||time<S.cbAt[team]||time<120)continue;
  const tgt=T().list.find(e=>e.team!==team&&!e.destroyed&&e.kind==='gun'&&e.gun&&e.gun.hot>time-30&&!e.abandoned);
  if(!tgt)continue;S.cbAt[team]=time+S.cfg.CB_EVERY;
  if(typeof spend==='function'&&!spend('artillery',team,false))continue;
  try{if(PXBAT.mission(team,tgt.x,tgt.y,6,70)){S.stats.counterBattery++;tgt.known[team]=true}}catch(e){}}
}

/* ---------- 2) fim das blobs: faixas no eixo do objetivo ---------- */
function installLanes(){
 const R=window.IronFrontRefinement;if(!R||!R.attackGoal||R._ag0)return;
 R._ag0=R.attackGoal;
 R.attackGoal=function(state,op,group){
  const base=R._ag0.call(this,state,op,group);if(!S.on)return base;
  const target=R.objective(state,op);if(!target||base.x!==target.x||base.y!==target.y)return base;
  const team=state.team,d=team?-1:1,fr=S.front[team],now=state.time,id=group.id??0;
  for(const [k,v] of fr)if(now-v.t>15)fr.delete(k);
  let f=fr.get(id);
  if(!f&&fr.size<S.cfg.FRONT){const used=new Set([...fr.values()].map(v=>v.lane));const lane=[0,-1,1].find(l=>!used.has(l));f={lane,t:now};fr.set(id,f)}
  if(f){f.t=now;return {x:target.x-d*Math.abs(f.lane)*45,y:clamp(target.y+f.lane*S.cfg.LANE,50,(state.height||H)-50)}}
  // apoio: cada esquadrão espera na sua própria posição (8 pontos em arco atrás do eixo) até uma faixa abrir
  S.stats.retargets++;const sg=S.stage[team];for(const [k,v] of sg)if(now-v.t>15)sg.delete(k);
  let st=sg.get(id);if(!st){const used=new Set([...sg.values()].map(v=>v.slot));let slot=0;while(used.has(slot)&&slot<15)slot++;st={slot,t:now};sg.set(id,st)}st.t=now;
  const i=st.slot%8,ring=Math.floor(st.slot/8);
  return {x:target.x-d*(S.cfg.STAGEBACK+(i%2)*80+ring*170),y:clamp(target.y+(i-3.5)*120,50,(state.height||H)-50)};
 };
}

/* dispersão do plano: esquadrões que mirariam o mesmo ponto ganham um deslocamento lateral próprio (≥ SEP px entre âncoras) */
const KEEP_TOGETHER=new Set(['guarda-objetivo','posição-defensiva','fogo-cruzado','cobrindo-avanco','cobrindo-retirada','blindado-imobilizado','reunindo-esquadrao']);
function spreadPlan(plan,state){
 if(!plan||!Array.isArray(plan.orders)||!S.on)return plan;
 const by=new Map();
 for(const o of plan.orders){if(o.squad===undefined||!Number.isFinite(o.tx)||!Number.isFinite(o.ty)||KEEP_TOGETHER.has(o.role))continue;let g=by.get(o.squad);if(!g)by.set(o.squad,g={id:o.squad,list:[],x:0,y:0});g.list.push(o);g.x+=o.tx;g.y+=o.ty}
 const sq=[...by.values()].filter(g=>g.list.length>=2).sort((a,b)=>a.id-b.id);if(sq.length<2)return plan;
 const placed=[],Hh=(state&&state.height)||H;let shifted=0;
 for(const g of sq){g.x/=g.list.length;g.y/=g.list.length;const sep=Math.max(S.cfg.SEP,34*Math.sqrt(g.list.length));
  const free=(x,y)=>placed.every(p=>hyp(p.x-x,p.y-y)>=Math.max(sep,p.sep)*.92);
  let best=null;const side=g.id%2?1:-1;
  search:for(let k=0;k<=8;k++){for(const s of (k?[side,-side]:[0])){const dy=s*k*sep*.85,ny=g.y+dy;if(ny<50||ny>Hh-50)continue;if(free(g.x,ny)){best={dx:0,dy};break search}}}
  if(!best){const back=state&&state.team?1:-1;for(let k=1;k<=4&&!best;k++){const nx=g.x+back*k*sep*.7;if(free(nx,g.y))best={dx:back*k*sep*.7,dy:0}}}
  if(!best)best={dx:0,dy:0};
  if(best.dx||best.dy){shifted++;for(const o of g.list){o.tx=clamp(o.tx+best.dx,24,W-24);o.ty=clamp(o.ty+best.dy,24,Hh-24)}}
  placed.push({x:g.x+best.dx,y:g.y+best.dy,sep})}
 S.stats.spread=(S.stats.spread||0)+shifted;
 capDensity(plan,state);
 return plan;
}
/* teto de densidade por unidade: no máximo CAP destinos a menos de 110 px uns dos outros; o excedente é aberto lateralmente */
function capDensity(plan,state){
 const ord=plan.orders.filter(o=>Number.isFinite(o.tx)&&Number.isFinite(o.ty)&&o.role!=='cobrindo-avanco'&&o.role!=='cobrindo-retirada'&&o.role!=='blindado-imobilizado'&&o.role!=='guarda-objetivo');
 if(ord.length<=S.cfg.CAP)return;const Hh=(state&&state.height)||H,placed=[];let moved=0;
 const crowd=(x,y)=>{let n=0;for(const p of placed)if(Math.abs(p.x-x)<110&&Math.abs(p.y-y)<110&&hyp(p.x-x,p.y-y)<110)n++;return n};
 // pontos de uma grade de passo 112 px ao redor do destino (vizinhos a ≥112 px não se contam), do mais perto ao mais longe
 const lattice=[];for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++)if(i||j)lattice.push([i,j,Math.abs(i)+Math.abs(j)+Math.hypot(i,j)*.01]);lattice.sort((a,b)=>a[2]-b[2]);
 for(const o of ord.sort((a,b)=>(a.id||0)-(b.id||0))){let x=o.tx,y=o.ty;
  if(crowd(x,y)>=S.cfg.CAP){let ok=false;const flip=(o.id||0)%2?1:-1;
   for(const [i,j] of lattice){const nx=x+i*140,ny=y+j*140*flip;if(ny<40||ny>Hh-40||nx<30||nx>W-30)continue;if(crowd(nx,ny)<S.cfg.CAP*.6){x=nx;y=ny;ok=true;break}}
   if(ok){o.tx=x;o.ty=y;moved++}}
  placed.push({x,y})}
 S.stats.capped=(S.stats.capped||0)+moved;
}
function hookPlan(){
 const Brain=window.IronFrontBrain;if(!Brain||!Brain.plan||Brain._plan0)return;Brain._plan0=Brain.plan;
 Brain.plan=function(state){const plan=Brain._plan0.apply(this,arguments);try{return spreadPlan(plan,state)}catch(e){fail(e);return plan}};
}

/* ---------- 3) não ficar preso ---------- */
function bunkerLos(dt){
 const Brain=window.IronFrontBrain;if(!Brain||!Brain.clearShot||typeof nearest!=='function')return;
 for(const b of buildings){if(b.type!=='bunker'||b.hp<=0||(b.cd||0)-dt>0.001)continue;
  const e=nearest(b,360);if(!e)continue;
  const others=buildings.filter(x=>x!==b);
  if(!Brain.clearShot(b,e,decor,others)){b.cd=.5+dt;b.noLos=time;S.stats.noLosBunker++}}
}
const snap=new Map();
function preTargets(){for(const u of units){const t=u.target;if(t&&t.hp>0)snap.set(u,{h:t.hp,cd:u.cd,id:t.id})}}
function postTargets(){
 for(const [u,s] of snap){const t=u.target;if(!t||t.id!==s.id||u.hp<=0){u._sh=0;u._ht=time;continue}
  if(u.cd>s.cd+.05){u._sh=(u._sh||0)+1}
  if(t.hp<s.h-.01){u._sh=0;u._ht=time}
  if(u._ht===undefined)u._ht=time;
  if(u._sh>=S.cfg.BADSHOTS&&time-u._ht>S.cfg.BADSECS&&u.type!=='tank'){
   (u.bad||(u.bad={}))[t.id]=time+S.cfg.BADSECS;u.target=null;u.aimCheckAt=0;u._sh=0;u._ht=time;S.stats.badTargets++;
   const g=O()?.groupOf(u);if(g&&!g.ai&&g.team===playerTeam&&C())C().report(g.team,u,'blocked','General, não temos linha de tiro: há um obstáculo entre nós e o alvo.',{kind:'warn',cd:40,scope:g.id,short:'SEM LINHA DE TIRO!'})}}
 snap.clear();
}
function hookSelect(){
 const Brain=window.IronFrontBrain;if(!Brain||!Brain.selectTarget||Brain._st0)return;Brain._st0=Brain.selectTarget;
 Brain.selectTarget=function(u,list,range,canHit){return Brain._st0.call(this,u,list,range,(a,e)=>!(a.bad&&a.bad[e.id]>time)&&(!canHit||canHit(a,e)))};
}
const track=new Map();
function stuckTick(){
 for(const u of units){if(u.hp<=0||u.type==='tank'&&false||(u===player&&mode==='soldier'))continue;
  const moving=u.order==='move'&&u.moving&&hyp((u.tx||0)-u.x,(u.ty||0)-u.y)>40;
  let t=track.get(u);if(!t){t={x:u.x,y:u.y,at:time,n:0,last:-99};track.set(u,t)}
  if(!moving){t.x=u.x;t.y=u.y;t.at=time;continue}
  if(time-t.at<S.cfg.STUCK_SECS)continue;
  const moved=hyp(u.x-t.x,u.y-t.y);t.x=u.x;t.y=u.y;t.at=time;
  if(moved>10){if(time-t.last>40)t.n=0;continue}
  // preso: 1ª contornar, 2ª desvio lateral, 3ª desistir e abrigar-se
  t.n=(time-t.last>45?0:t.n)+1;t.last=time;S.stats.stuck[Math.min(2,t.n-1)]++;
  const g=O()?.groupOf(u);if(g)continue;                 // grupos de PXORD têm a própria lógica de contorno
  if(t.n===1){if(u.pv){u.pv.path=null;u.pv.ds=-(u.pv.ds||1)}}
  else if(t.n===2){const dx=(u.tx||u.x)-u.x,dy=(u.ty||u.y)-u.y,n=hyp(dx,dy)||1,side=u.id%2?1:-1;u.tx=clamp(u.x+dx/n*60-dy/n*side*90,24,W-24);u.ty=clamp(u.y+dy/n*60+dx/n*side*90,24,H-24);u.order='move';u.manualUntil=time+3;if(u.pv)u.pv.path=null}
  else{giveUp(u);t.n=0}}
 if(track.size>500)for(const k of track.keys())if(k.hp<=0)track.delete(k);
}
function giveUp(u){
 u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=u.pinStamp=time+5;if(u.pv)u.pv.path=null;u.giveUp=time;
 const cov=O()?.coverFor?.(u,{x:u.team?u.x-200:u.x+200,y:u.y},170);if(cov){u.order='move';u.tx=cov.x;u.ty=cov.y}
 if(u.team===playerTeam&&C()&&!aiEnabled[u.team])C().report(u.team,u,'blocked','General, o caminho está bloqueado. Estamos abrigados e aguardando.',{kind:'warn',cd:35,short:'CAMINHO BLOQUEADO!'});
}

/* ---------- 4) ociosos procuram abrigo ---------- */
function idleTick(){
 const slice=Math.floor(time/ S.cfg.IDLE)%4;
 for(const u of units){
  if(u.id%4!==slice||!live(u)||u.type==='tank'||u.type==='cavalry'||u.sap||u.cls==='medic'||u.cls==='mechanic'||u.gid||u.engJob||u.bunkerOf||u.post||u.sh||u===player)continue;
  if(u.order!=='hold'||u.moving||u.manualUntil>time||u.target&&u.target.hp>0||u.underFire>0)continue;
  const idle=u._idle=(u._idle||0)+S.cfg.IDLE;if(idle<S.cfg.IDLE*1.2)continue;
  if(!aiEnabled[u.team]&&idle<40)continue;
  if(window.PXFORT?.isPrep?.())continue;
  const prot=typeof protectedBy==='function'?protectedBy(u):1;if(prot<.7){u._idle=0;continue}
  let enemyNear=false;for(const e of units)if(e.team!==u.team&&e.hp>0&&Math.abs(e.x-u.x)<260&&Math.abs(e.y-u.y)<260){enemyNear=true;break}
  const from={x:u.team?u.x-260:u.x+260,y:u.y},cov=O()?.coverFor?.(u,from,260);
  if(cov){u.order='move';u.tx=cov.x;u.ty=cov.y;u.manualUntil=u.pinStamp=time+4;S.stats.idleMoves++;u._idle=0}
  else if(!enemyNear){const f=units.find(a=>a!==u&&a.team===u.team&&live(a)&&!a.sap&&hyp(a.x-u.x,a.y-u.y)>60&&hyp(a.x-u.x,a.y-u.y)<300);if(f){u.order='move';u.tx=f.x+rnd(-24,24);u.ty=f.y+rnd(-24,24);u.manualUntil=u.pinStamp=time+4;S.stats.idleMoves++;u._idle=0}}}
}

/* ---------- ligações ---------- */
const update0=window.update;
window.update=function(dt){
 if(!S.on||!started||ended||!(dt>0))return update0.apply(this,arguments);
 try{bunkerLos(dt);preTargets()}catch(e){fail(e)}
 const r=update0.apply(this,arguments);
 try{postTargets();
  if(window.PXFORT?.isPrep?.())return r;
  if((raidT-=dt)<=0){raidT=S.cfg.RAID_EVERY;raidTick()}
  if((cbT-=dt)<=0){cbT=6;counterBattery()}
  if((stuckT-=dt)<=0){stuckT=1;stuckTick()}
  if((idleT-=dt)<=0){idleT=S.cfg.IDLE;idleTick()}
 }catch(e){fail(e)}
 return r;
};
const setup0=window.setup;
window.setup=function(){S.raids=[];S.front=[new Map(),new Map()];S.stage=[new Map(),new Map()];S.cool=[0,0];S.cbAt=[0,0];S.failed.clear();track.clear();snap.clear();return setup0.apply(this,arguments)};
installLanes();hookSelect();hookPlan();
S.routeDanger=routeDanger;S.bestRoute=bestRoute;S.spreadPlan=spreadPlan;S.capDensity=capDensity;
S.state=()=>({on:S.on,raids:S.raids.map(r=>({team:r.team,target:r.target.name,state:r.g&&r.g.state,n:r.g&&r.g.units.length,age:Math.round(time-r.t0)})),front:S.front.map(m=>m.size),stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.strategy=S;
})();
