/* Engenheiros de campo e engenheiros mecânicos (feedback #1, itens 12 e 13).
   · "Pioneiros" passam a ser Engenheiros de Campo e respondem a ordens de interação: selecionados + clique direito numa estrutura aliada
     danificada → REPARAR (ou reconstruir uma estrutura destruída que admita); numa obra/fortificação aliada → REPARAR / REFORÇAR
     (reforço acrescenta HP máximo, até 2 vezes); com cargas de demolição acompanham assaltos (orders.js).
   · Engenheiro Mecânico (card novo, 2 homens): repara tanques — casco, esteira e motor —, e recupera carcaças recuperáveis, devolvendo
     o blindado à luta com 35 % da vida. Tanques passam a sofrer avarias: esteira quebrada (anda a ~35 %) e motor danificado (~60 % e atira mais devagar).
   · IA: engenheiros ociosos consertam estruturas e tanques danificados; a IA compra mecânicos quando tem blindados.
   Liga/desliga: ?engenheiros=0 · API: IronFront.engineers (repair, repairVehicle, repairBuilding, recover, jobs, state). */
(function(){
'use strict';
if(typeof update!=='function'||typeof units==='undefined')return;
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const S=window.PXENG={on:!/[?&]engenheiros=0/.test(location.search),version:'1.0',cfg:{HULL:14,HULLMECH:42,TRACK:14,MOTOR:18,STRUCT:20,REBUILD:12,REBUILDCOST:120,COSTHP:.05,RECOVER:20,REFORCE:10,MAXREINF:2},stats:{repaired:0,rebuilt:0,recovered:0,tracks:0,motors:0,reinforced:0,errors:0}};
let J=[],jid=0,errs=0,aiT=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('engineers.js:',e);if(errs>=12){S.on=false;console.error('engineers.js desligado após erros repetidos')}}
const live=u=>u&&u.hp>0&&!u.down&&!u.rs&&!u.carried&&!u.inBed;
const C=()=>window.PXCOMM,T=()=>window.PXSTRUCT;
const pay=(team,n)=>{if(sandbox)return true;if(supplies[team]<n)return false;supplies[team]-=n;return true};
function go(u,x,y){x=clamp(x,24,W-24);y=clamp(y,24,H-24);if(u.order!=='move'||hyp((u.tx||0)-x,(u.ty||0)-y)>12){u.order='move';u.tx=x;u.ty=y;if(u.pv)u.pv.path=null}u.manualUntil=u._ord=time+2.6;u.aiStepAt=0}
function halt(u){u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=u._ord=time+2.6;u.sapProne=0}
const isEng=u=>u&&(u.sap||u.cls==='mechanic');

/* ---------- empregos de reparo ---------- */
function job(kind,us,target,opts={}){
 us=us.filter(u=>live(u)&&isEng(u));if(!us.length||!target)return null;
 for(const j of J)j.units=j.units.filter(u=>!us.includes(u));
 const j={id:++jid,kind,team:us[0].team,units:us.slice(),target,t0:time,work:0,ai:!!opts.ai,byPlayer:!!opts.byPlayer};J.push(j);
 for(const u of us){u.engJob=j.id;u.gid=u.gid&&u.gid!==j.id?null:u.gid}
 if(j.byPlayer&&j.team===playerTeam&&C())C().say(j.team,C().nameFor(j.team,j.id+1),`${{repair:'Consertando',rebuild:'Reconstruindo',vehicle:'Consertando o blindado',building:'Reparando a obra',recover:'Recuperando o blindado'}[kind]||'A caminho'}…`,'ok',us[0],{immediate:true});
 return j}
S.repair=(us,ent,o)=>job(ent.destroyed?'rebuild':'repair',us,ent,o);
S.repairVehicle=(us,tank,o)=>job('vehicle',us,tank,o);
S.repairBuilding=(us,b,o)=>job('building',us,b,o);
S.recover=(us,hulk,o)=>job('recover',us,hulk,o);
S.jobs=()=>J;
const pos=t=>({x:t.x,y:t.y});
const dead=j=>{const t=j.target;if(j.kind==='repair')return t.destroyed||t.hp>=t.max*.999;if(j.kind==='rebuild')return !t.destroyed||!t.rebuild;if(j.kind==='vehicle')return t.hp<=0||(t.hp>=t.maxhp*.999&&!t.trk&&!t.mot);
 if(j.kind==='building')return t.hp<=0||(t.hp>=t.maxhp*.999&&(t.reinf||0)>=S.cfg.MAXREINF);if(j.kind==='recover')return !t.rec||t.t<=0;return true};
function endJob(j,ok){for(const u of j.units)if(u.engJob===j.id){u.engJob=null;if(live(u))halt(u);u.manualUntil=Math.min(u.manualUntil,time+.4)}J=J.filter(q=>q!==j)}
function stepJob(j,dt){
 j.units=j.units.filter(u=>live(u));
 for(const u of j.units.slice()){if(u.manualUntil>time+3.3&&u._ord!==u.manualUntil){u.engJob=null;j.units=j.units.filter(q=>q!==u)}}
 if(!j.units.length||dead(j)){if(j.units.length&&j.team===playerTeam&&j.byPlayer&&C()&&!j.target.destroyed&&j.kind!=='recover')C().say(j.team,C().nameFor(j.team,j.id+1),'Serviço concluído.','ok',j.units[0],{immediate:true});endJob(j,true);return}
 const t=j.target,tp=pos(t),reach=j.kind==='repair'||j.kind==='rebuild'?Math.max(24,(t.w||40)*.4):j.kind==='building'?36:44;
 let workers=0,mech=0;
 for(const u of j.units){const d=hyp(u.x-tp.x,u.y-tp.y);if(d>reach){const n=d||1,ax=(u.x-tp.x)/n,ay=(u.y-tp.y)/n,k=Math.max(10,reach-10);go(u,tp.x+ax*k+(u.id%3-1)*6,tp.y+ay*k);}else{halt(u);workers++;if(u.cls==='mechanic')mech++;u.angle=Math.atan2(tp.y-u.y,tp.x-u.x);u.sapProne=0}}
 if(!workers)return;
 const c=S.cfg;
 if(j.kind==='repair'){const n=workers*c.STRUCT*dt;if(pay(j.team,n*c.COSTHP)){const got=T().repair(t,n);S.stats.repaired+=got}else{if(j.byPlayer&&!j.warned){j.warned=1;toast('Faltam suprimentos para o conserto.')}}}
 else if(j.kind==='rebuild'){j.work+=workers*dt;if(!j.paid&&pay(j.team,c.REBUILDCOST))j.paid=1;if(j.paid&&j.work>=c.REBUILD){if(T().rebuild(t)){S.stats.rebuilt++;if(j.team===playerTeam)toast(`${t.name} ${T().ge(t,'reconstruído','reconstruída')}.`)}}else if(!j.paid&&j.byPlayer&&!j.warned){j.warned=1;toast(`Faltam ◈ ${c.REBUILDCOST} para reconstruir.`)}}
 else if(j.kind==='vehicle'){
  if(t.trk){j.work+=mech*dt;if(mech&&j.work>=c.TRACK){t.trk=0;j.work=0;S.stats.repaired++;say(t,'Esteira consertada.')}}
  else if(t.mot){j.work+=mech*dt;if(mech&&j.work>=c.MOTOR){t.mot=0;j.work=0;S.stats.repaired++;say(t,'Motor consertado.')}}
  else{const n=(mech?c.HULLMECH:c.HULL)*dt*Math.max(1,workers*(mech?1:.6));if(pay(j.team,n*c.COSTHP*1.4))t.hp=Math.min(t.maxhp,t.hp+n)}
}
 else if(j.kind==='building'){const b=t;
  if(b.hp<b.maxhp){const n=workers*c.STRUCT*dt;if(pay(j.team,n*c.COSTHP))b.hp=Math.min(b.maxhp,b.hp+n)}
  else if((b.reinf||0)<c.MAXREINF){j.work+=workers*dt;if(j.work>=c.REFORCE&&pay(j.team,40)){b.reinf=(b.reinf||0)+1;b.maxhp*=1.25;b.hp=b.maxhp;j.work=0;S.stats.reinforced++;if(j.team===playerTeam)toast('Fortificação reforçada.')}}}
 else if(j.kind==='recover'){j.work+=workers*dt;if(j.work>=c.RECOVER){recoverHulk(j)}}
}
function say(tank,txt){if(tank.team===playerTeam&&C())C().report(tank.team,tank,'repair',`General, ${txt}`,{kind:'ok',cd:6,gap:2,short:'CONSERTADO!'})}
function recoverHulk(j){
 const h=j.target;if(!h.rec||h.t<=0)return;
 if(units.filter(u=>u.team===h.team&&u.hp>0).length+1>maxUnits){if(j.byPlayer)toast('Limite de tropas atingido: não dá para recuperar o blindado.');return}
 h.rec=false;h.t=0;const t=newUnit('tank',h.team,h.x,h.y);t.hp=t.maxhp*.35;t.trk=1;t.angle=h.angle||0;t.manualUntil=0;S.stats.recovered++;
 if(h.team===playerTeam)toast('Blindado recuperado: voltou à luta com 35 % da vida.')}

/* ---------- avarias de tanque: esteira e motor ---------- */
const WRAP=(n,fn)=>{const o=window[n];if(typeof o!=='function'){console.warn('engineers.js: função ausente: '+n);return}window[n]=function(...a){return fn(o,...a)}};
WRAP('damage',(orig,u,n,attacker)=>{
 const before=u&&u.hp;const r=orig(u,n,attacker);
 if(S.on&&u&&u.type==='tank'&&u.hp>0&&before>0&&n>=14){
  if(!u.trk&&Math.random()<.16){u.trk=1;S.stats.tracks++;if(u.team===playerTeam&&C())C().report(u.team,u,'track','General, nosso tanque perdeu uma esteira!',{kind:'warn',cd:25,short:'ESTEIRA!'})}
  else if(!u.mot&&Math.random()<.11){u.mot=1;S.stats.motors++;if(u.team===playerTeam&&C())C().report(u.team,u,'motor','General, o motor do tanque foi atingido!',{kind:'warn',cd:25,short:'MOTOR!'})}}
 return r});
const lastPos=new Map();
function tankTick(dt){
 for(const u of units){if(u.type!=='tank'||u.hp<=0)continue;
  const p=lastPos.get(u.id);
  if(p&&(u.trk||u.mot)){const dx=u.x-p.x,dy=u.y-p.y,f=u.trk?.65:.4;if(Math.abs(dx)+Math.abs(dy)>.01&&Math.abs(dx)+Math.abs(dy)<40){u.x-=dx*f;u.y-=dy*f}if(u.mot&&u.cd>0)u.cd=Math.max(0,u.cd-0)+dt*.25}
  lastPos.set(u.id,{x:u.x,y:u.y});
  if((u.trk||u.mot)&&Math.random()<dt*.9&&Math.abs(u.x-cam.x)<760&&Math.abs(u.y-cam.y)<560)particles.push({x:u.x+rnd(-6,6),y:u.y+rnd(-6,6),vx:rnd(-8,8),vy:rnd(-24,-12),t:rnd(.9,1.6),max:1.6,color:u.mot?'#4a463f':'#8a8472',size:rnd(4,7)})}
 if(lastPos.size>240)for(const id of lastPos.keys())if(!units.some(u=>u.id===id))lastPos.delete(id);
}

/* ---------- carta do Engenheiro Mecânico ---------- */
if(typeof defs==='object'&&!defs.mechanic)defs.mechanic={name:'Engenheiros Mecânicos',sub:'Equipe · 2 mecânicos · reparam blindados',cost:110,count:2,hp:100,speed:47,range:200,rate:1.8,damage:24};
WRAP('newUnit',(orig,type,team,x,y)=>{if(type!=='mechanic')return orig(type,team,x,y);const u=orig('rifle',team,x,y);u.cls='mechanic';u.gren=0;u.mech=1;return u});
WRAP('makeCards',orig=>{orig();try{if(tab!=='units')return;const d=defs.mechanic,box=document.getElementById('cards');if(!box||box.querySelector('[data-kind="mechanic"]'))return;
 const b=document.createElement('button');b.className='card'+(placement==='mechanic'?' active':'');b.dataset.kind='mechanic';
 b.innerHTML=`<canvas width="48" height="48"></canvas><b>${d.name}</b><small>${d.sub}</small><span class="cost">◈ ${sandbox?'∞':d.cost}</span>`;b.onclick=()=>choose('mechanic');
 const cv=b.querySelector('canvas').getContext('2d');cv.fillStyle='#252a1f';cv.fillRect(0,0,48,48);cv.fillStyle='#6f7448';cv.fillRect(18,10,12,22);cv.fillStyle='#c9b26a';cv.fillRect(14,16,6,3);cv.fillRect(26,28,12,3);cv.fillStyle='#8a8a7a';cv.fillRect(30,14,3,14);cv.fillRect(28,12,7,3);
 box.append(b)}catch(e){fail(e)}});

/* ---------- IA: reparos automáticos e compra de mecânicos ---------- */
function aiTick(){
 for(const team of [0,1]){if(!aiEnabled[team]&&!(team===playerTeam&&false))continue;
  const idle=units.filter(u=>u.team===team&&live(u)&&isEng(u)&&!u.engJob&&!u.sapJob&&!(u.manualUntil>time)&&!u.gid);if(!idle.length)continue;
  // tanque danificado → mecânico; estrutura danificada → engenheiro
  const tanks=units.filter(t=>t.team===team&&t.type==='tank'&&t.hp>0&&(t.hp<t.maxhp*.75||t.trk||t.mot));
  const mechs=idle.filter(u=>u.cls==='mechanic');
  if(tanks.length&&mechs.length){const t=tanks.sort((a,b)=>(b.trk?2:0)+(b.mot?1:0)-(a.trk?2:0)-(a.mot?1:0))[0];job('vehicle',mechs.slice(0,2),t,{ai:true});continue}
  const engs=idle.filter(u=>u.sap);
  if(engs.length&&T()){let best=null,bs=1e9;for(const e of T().list){if(e.team!==team||e.destroyed||e.hp>=e.max*.7||e.legacy&&e.bld)continue;const d=hyp(e.x-engs[0].x,e.y-engs[0].y);if(d<bs&&d<900){bs=d;best=e}}
   if(best)job('repair',engs.slice(0,3),best,{ai:true})}
  // compra: com 2+ blindados e nenhum mecânico
  if(tanks.length+units.filter(t=>t.team===team&&t.type==='tank'&&t.hp>0).length>=2&&!units.some(u=>u.team===team&&u.cls==='mechanic'&&u.hp>0)&&time>120&&(S.boughtAt?.[team]??-99)+120<time){
   const spendOk=typeof spend==='function'&&spend('mechanic',team,false);if(spendOk){(S.boughtAt||(S.boughtAt=[-99,-99]))[team]=time;const rx=window.PX&&PX.WW1&&map==='trenches'?PX.WW1.reinforceX(team):(team?W-350:350);squad('mechanic',team,rx,clamp(H/2+rnd(-160,160),180,H-180))}}}
}

/* marca visual: chave inglesa sobre o mecânico */
if(window.WW1A){const over=WW1A.over;WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);if(!S.on||!started)return;try{const Z=(window.PX&&PX.Z)||.5;
 for(const u of units){if(u.cls!=='mechanic'||u.hp<=0)continue;const x=ox+Math.round(u.x*Z),y=oy+Math.round(u.y*Z);if(x<-10||y<-10||x>vw+10||y>vh+10)continue;c.fillStyle='#14160f';c.fillRect(x-3,y-14,6,4);c.fillStyle='#e0a040';c.fillRect(x-2,y-13,4,1);c.fillRect(x+1,y-13,1,3);c.fillStyle='#bfc4b0';c.fillRect(x-2,y-12,2,1)}}catch(e){fail(e)}}}

/* ---------- ligações ---------- */
const update0=window.update;
window.update=function(dt){const r=update0.apply(this,arguments);if(!S.on||!started||ended||!(dt>0))return r;
 try{tankTick(dt);for(const j of J.slice())stepJob(j,dt);if((aiT-=dt)<=0){aiT=3;aiTick()}}catch(e){fail(e)}return r};
const setup0=window.setup;
window.setup=function(){J=[];jid=0;lastPos.clear();S.boughtAt=[-99,-99];const r=setup0.apply(this,arguments);for(const u of units)u.engJob=null;return r};
S.state=()=>({on:S.on,jobs:J.map(j=>({id:j.id,kind:j.kind,team:j.team,n:j.units.length,target:j.target.name||j.target.type})),stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.engineers=S;
})();
