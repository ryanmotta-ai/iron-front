const assert=require('node:assert/strict'),C=require('../dist/coordination.js'),Brain=require('../dist/operations.js');
const unit=(id,type='rifle',extra={})=>({id,type,team:0,x:710,y:480,hp:100,maxhp:100,manualUntil:0,...extra});
function setup(){const a={id:1,kind:'infantry',x:710,y:480,strength:8,pressure:0,source:{task:'avanço-alternado'},members:Array.from({length:8},(_,i)=>unit(i+1))};
 const b={id:2,kind:'fire',x:700,y:490,strength:7.5,pressure:0,source:{task:'base-de-fogo'},members:[unit(11,'mg'),unit(12,'mg'),unit(13,'mg')]};
 return {mem:C.create(),groups:[a,b],state:{team:0,time:10,units:[...a.members,...b.members],visibilityRange:700,buildings:[],shells:[],breaches:[],clearSight:()=>true},op:{phase:'advance',sector:{id:1,x:930,y:480,front:720}},enemies:[{id:90,type:'mg',x:880,y:480,at:10,suppression:0}]};}
let x=setup(),orders=C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);
assert.equal(orders.get(1).task,'flanco-apoiado');assert.equal(orders.get(2).task,'apoio-solicitado');assert.equal(x.mem.requests.length,1);
const mission=x.mem.missions[0].id;x.state.time=12;x.enemies[0].at=12;orders=C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);assert.equal(x.mem.missions[0].id,mission,'não recria a ação a cada decisão');
x.groups[1].pressure=1.5;C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);assert.equal(x.mem.missions.length,0,'apoio incapaz libera o assalto');assert.equal(x.mem.history[0].success,false);
x=setup();x.groups[0].members[0].manualUntil=30;C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);x.groups[0].members[1].manualUntil=30;x.state.time=11;C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);assert.equal(x.mem.missions.length,0);assert.equal(Object.keys(x.mem.scores).length,0,'ordem humana não ensina fracasso militar');
x=setup();C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);x.state.time=20;C.update(x.mem,x.state,x.groups,[],x.op,false);assert.equal(x.mem.history[0].cancelled,true,'perda de contato não conta como vitória');
x=setup();C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);x.enemies[0].suppression=1; x.state.time=12;x.enemies[0].at=12;C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);assert.equal(x.mem.scores['apoio/visivel'].attempts,1);
x=setup();x.enemies=[];x.state.breaches=[{team:1,type:'wire',x:820,y:480,t:5}];orders=C.update(x.mem,x.state,x.groups,[],x.op,false);assert.equal(orders.get(1).task,'preparar-brecha');
x.state.time=19;orders=C.update(x.mem,x.state,x.groups,[],x.op,false);assert.equal(orders.get(1).task,'assalto-brecha');
x.groups[0].x=900;x.state.time=20;C.update(x.mem,x.state,x.groups,[],x.op,false);assert.equal(x.mem.history[0].success,true);assert.ok(x.mem.scores['brecha/visivel'].value>0);
for(const extra of [{clearSight:()=>false},{buildings:[{type:'wire',team:1,x:820,y:480,hp:100}]},{shells:[{x:820,y:480,t:1,r:65}]}]){x=setup();x.enemies=[];Object.assign(x.state,extra);x.state.breaches=[{team:1,x:820,y:480,t:5}];C.update(x.mem,x.state,x.groups,[],x.op,false);assert.equal(x.mem.missions.length,0,'passagem não observada, fechada ou bombardeada é descartada')}
x=setup();x.enemies=[];x.state.breaches=[{team:1,x:820,y:480,t:5}];C.update(x.mem,x.state,x.groups,[],x.op,false);
x.groups[0].members.forEach(u=>u.hp=30);x.state.units.push(...Array.from({length:8},(_,i)=>unit(100+i)));x.state.time=12;C.update(x.mem,x.state,x.groups,[],x.op,false);assert.ok(x.mem.history[0].loss>.5,'reforços não escondem perdas dos participantes');
x=setup();x.groups[0].source.reserve=true;x.op.phase='hold';x.enemies[0].x=730;orders=C.update(x.mem,x.state,x.groups,x.enemies,x.op,true);assert.equal(orders.get(1).task,'conter-acesso');assert.equal(orders.size,1,'defensor usa uma equipe e preserva as demais');
x.state.time=40;C.update(x.mem,x.state,x.groups,x.enemies,x.op,true);assert.equal(x.mem.missions.length,0,'contenção tem prazo');
x=setup();x.groups[0].source.reserve=true;x.op.phase='hold';x.enemies[0].x=730;C.update(x.mem,x.state,x.groups,x.enemies,x.op,true);x.groups[0].x=655;x.state.time=17;x.enemies[0].at=17;x.enemies[0].suppression=1;C.update(x.mem,x.state,x.groups,x.enemies,x.op,true);assert.ok(x.mem.scores['conter/visivel'].value>0,'pressão observada reduzida e posição mantida recompensam contenção');
assert.doesNotThrow(()=>JSON.stringify(C.snapshot(x.mem)));
x=setup();C.update(x.mem,x.state,x.groups,x.enemies,x.op,false);C.cancel(x.mem,x.state);assert.equal(x.mem.missions.length,0);assert.equal(Object.keys(x.mem.scores).length,0,'desligamento não registra derrota');
// Integrate with the real commander; the optional switch leaves old operations available.
const defs={rifle:{count:8,cost:80},mg:{count:3,cost:100},tank:{count:1,cost:260},cavalry:{count:5,cost:140},artillery:{cost:160},reinforce:{cost:200}};
x=setup();Brain.operations.reset();Brain.setRoles(['attack','defend']);let state={...x.state,defs,maxUnits:80,supplies:1000,tickets:[500,500],points:[{name:'A',x:930,y:480,owner:1}],trenches:[],decor:[]};
state.breaches=[{team:1,x:820,y:480,t:5}];let plan;for(const time of [0,5,6,12]){state.time=time;plan=Brain.plan(state)}
assert.ok(plan.coordination.missions.some(m=>m.kind==='brecha'));assert.ok(plan.orders.some(o=>o.role==='assalto-brecha'||o.role==='preparar-brecha'));assert.ok(plan.orders.some(o=>o.role==='apoio-solicitado'));
assert.equal(Brain.operations.state(0).squads.find(s=>s.kind==='infantry').reserve,false,'único esquadrão não fica marcado como reserva antes dos reforços');
Brain.operations.reset();state.jointAI=false;for(const time of [0,5,6,12]){state.time=time;plan=Brain.plan(state)}assert.equal(plan.coordination.missions.length,0);assert.equal(plan.operation.phase,'advance');
console.log('Coordination: pedidos, apoio real, brechas observadas, fases, perdas, cancelamento humano, contenção limitada, aprendizado e integração OK');
