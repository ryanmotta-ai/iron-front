const assert=require('node:assert/strict');
const Learning=require('../dist/learning.js'),Brain=require('../dist/operations.js');
const unit=(id,x=700,y=480,extra={})=>({id,team:0,type:'rifle',x,y,hp:100,maxhp:100,manualUntil:0,suppression:0,cohesion:1,...extra});
const defs={rifle:{count:8,cost:80,speed:47},mg:{count:3,cost:100,speed:34},tank:{count:1,cost:260,speed:28},cavalry:{count:5,cost:140,speed:85},artillery:{cost:160},fighter:{cost:180},wire:{cost:40},bunker:{cost:220},sandbag:{cost:50},reinforce:{cost:200}};
const make=()=>({team:0,time:0,units:Array.from({length:24},(_,i)=>unit(i+1,700+i%4*8,470+i%6*5)),points:[{name:'A',x:930,y:400,owner:-1}],trenches:[],buildings:[],decor:[],maxUnits:80,supplies:2000,tickets:[500,500],defs,visibilityRange:700,supportReady:false,buildReady:false,reinforceReady:false});

// Casualty locations change the selected route; repeated planning at the same timestamp is idempotent.
let l=Learning.create(),s=make();Learning.update(s,s.units,[],l);
for(const u of s.units.slice(0,8)){u.x=890;u.y=480;u.hp=10}s.time=5;Learning.update(s,s.units,[],l);
const danger=Learning.risk(l,890,480);assert.ok(danger>.3);
Learning.update(s,s.units,[],l);assert.equal(Learning.risk(l,890,480),danger);
const safest=Brain.operations.route({...s,learnedRisk:(x,y)=>Learning.risk(l,x,y)},[],{x:700,y:480},{x:1200,y:480},'rifle');
assert.notEqual(safest.y,480,'experiência de baixas altera rota mesmo sem inimigo visível');
s.time=400;Learning.update(s,s.units,[],l);assert.equal(l.heat.size,0,'perigo antigo vence');

// Outcomes teach tactics, and new recruits cannot conceal the loss of the original assault force.
l=Learning.create();s=make();const op={sector:{id:1},style:{name:'balanced'},objective:'A',best:400};
Learning.begin(l,op,s,s.units.map(u=>u.id));s.units=Array.from({length:24},(_,i)=>unit(100+i));s.time=50;
Learning.finish(l,op,s,false);assert.equal(l.history.length,1);assert.equal(l.history[0].loss,1);
assert.notEqual(Learning.select(l,1,s,[]).name,'balanced','não repete a tática que perdeu toda a força');
Learning.finish(l,op,s,false);assert.equal(l.history.length,1,'não avalia o mesmo ataque duas vezes');
op.style.name='flank';Learning.begin(l,op,s,s.units.map(u=>u.id));op.best=40;s.time=100;Learning.finish(l,op,s,true);
assert.equal(l.history.at(-1).success,true);assert.equal(Learning.select(l,1,s,[]).name,'flank','manobra que funcionou ganha preferência');

// Pinning's internal order marker is not mistaken for a human takeover.
l=Learning.create();s=make();Learning.begin(l,op,s,[1,2]);s.units[0].hp=10;s.units[0].manualUntil=s.units[0].pinStamp=30;
s.time=20;Learning.finish(l,op,s,false);assert.ok(l.history[0].loss>.4);
l=Learning.create();s=make();Learning.begin(l,op,s,[1,2]);s.units[0].hp=10;s.units[0].manualUntil=30;
s.time=20;Learning.finish(l,op,s,false);assert.equal(l.history[0].loss,0,'homem assumido pelo jogador não penaliza tática');

// Full commander integration: failure is evaluated and exposed to the UI; a capture is rewarded once.
Brain.operations.reset();Brain.setRoles(['attack','defend']);s=make();let p;
for(const time of [0,9,14,25]){s.time=time;p=Brain.plan(s)}
assert.equal(p.operation.phase,'advance');s.time=90;p=Brain.plan(s);
assert.equal(p.operation.phase,'withdraw');assert.equal(p.learning.history.length,1);assert.equal(p.learning.history[0].success,false);
assert.match(p.learning.note,/progresso|baixas/);
Brain.operations.reset();s=make();for(const time of [0,9,14,25]){s.time=time;p=Brain.plan(s)}
s.points[0].owner=0;s.time=30;p=Brain.plan(s);assert.equal(p.learning.history[0].success,true);
s.time=35;p=Brain.plan(s);assert.equal(p.learning.history.length,1);

// Unseen enemies never train threat patterns or influence reinforcement purchases.
Brain.operations.reset();s=make();s.visibilityRange=100;s.units.push(unit(900,2300,480,{team:1,type:'mg'}));
s.time=30;p=Brain.plan(s);assert.ok(p.learning.sectors.every(t=>t.mg===0&&t.tanks===0));
Brain.operations.reset();s=make();s.units.push(...Array.from({length:4},(_,i)=>unit(910+i,1100+i*8,480,{team:1,type:'mg'})));
Brain.plan(s);s.time=30;p=Brain.plan(s);assert.equal(p.purchase,'tank','MGs observadas repetidamente mudam composição dos reforços');
Brain.operations.reset();s=make();s.supportReady=true;s.units.push(unit(950,1100,480,{team:1,type:'mg'}));
p=Brain.plan(s);assert.equal(p.support?.type,'artillery','apoio pode neutralizar uma MG importante sem esperar uma multidão');
s.units[0].x=1090;s.units[0].y=480;s.time=5;p=Brain.plan(s);assert.equal(p.support,null,'prioridade aprendida não ignora fogo amigo');
Brain.operations.reset();s=make();s.maxUnits=24;s.units[0].down=true;p=Brain.plan(s);assert.equal(p.purchase,null,'feridos ainda ocupam a capacidade do exército');
Brain.operations.reset();assert.equal(Brain.operations.state(0),null);
console.log('Learning: perdas reais, escolha de táticas, rotas perigosas, memória limitada, ordens humanas, captura e informação observada OK');
