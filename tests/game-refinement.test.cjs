const assert=require('node:assert/strict'),R=require('../dist/battle-refinement.js'),Brain=require('../dist/operations.js'),Bases=require('../dist/base-objectives.js'),Air=require('../dist/air-support-policy.js');
const unit=(id,team,x,y,extra={})=>({id,team,x,y,hp:100,maxhp:100,type:'rifle',manualUntil:0,cohesion:1,suppression:0,...extra});
for(const team of [0,1]){
 const state={team,width:2400,height:2000,points:Bases.create(2400,2000)},target=state.points[1-team],op={objective:target.name,sector:{x:target.x,y:200,target}};
 assert.deepEqual(R.attackGoal(state,op,{x:team?1700:700,y:200}),{x:target.x,y:200},'conserva acesso lateral antes da linha inimiga');
 assert.deepEqual(R.attackGoal(state,op,{x:target.x+(team?400:-400),y:200}),{x:target.x,y:1000},'converge para a bandeira real após atravessar a linha');
 const own=state.points[team];op.objective=own.name;assert.deepEqual(R.attackGoal(state,op,{x:1200,y:200}),{x:own.x,y:own.y},'recuperação da própria base vai ao objetivo exato');
}
const units=[unit(1,0,700,900),unit(2,0,700,900,{sap:1,sapJob:{}}),unit(3,0,700,900,{cls:'medic'}),unit(4,0,700,900,{down:true}),unit(5,0,700,900,{rs:{}}),unit(6,0,700,900,{hp:0}),unit(7,1,700,900)];
assert.deepEqual(R.commandGroup(units,0,new Set(),null).map(u=>u.id),[1]);assert.deepEqual(R.commandGroup(units,0,new Set([2,3,4,5]),null).map(u=>u.id),[2,3]);assert.equal(R.commandGroup(units,0,new Set(),1).length,0);
const shooter=unit(10,0,700,900,{aimCheckAt:1});assert.equal(R.shouldSearch(shooter,.5,240),false);assert.equal(R.shouldSearch(shooter,1,240),true);shooter.target=unit(20,1,800,900,{down:true});assert.equal(R.shouldSearch(shooter,.5,240),true);shooter.target.down=false;assert.equal(R.shouldSearch(shooter,.5,240),false);shooter.target.x=1200;assert.equal(R.shouldSearch(shooter,.5,240),true);
assert.equal(Brain.selectTarget(shooter,[unit(21,1,700,900,{down:true}),unit(22,1,780,900)],240).id,22);
const points=Bases.create(2400,2000);assert.equal(R.baseStatus(points[0]).kind,'secure');points[0].progress=-50;assert.equal(R.baseStatus(points[0]).hostile,.25);assert.equal(R.baseStatus(points[0]).kind,'contested');points[0].progress=100;points[0].owner=1;assert.equal(R.baseStatus(points[0]).kind,'lost');assert.equal(R.baseStatus(points[1]).kind,'secure');
const air={team:0,time:120,own:Array.from({length:20},(_,i)=>unit(i,0,500,1000)),next:{},flights:[],contacts:[],front:1200,width:2400,y:1000,phase:'prepare',available:{cap:false,int:false,rec:true}};
assert.equal(Air.choose(air).kind,'rec','frota sem caças prontos não bloqueia observador');assert.equal(Air.choose({...air,available:{cap:false,rec:false,bmb:false,atk:false}}),null);

// End-to-end commander goals: reaching the extreme-north rear does not mean capturing a central base.
const defs={rifle:{count:8,cost:80,speed:47},mg:{count:3,cost:100,speed:34},tank:{count:1,cost:260,speed:28},cavalry:{count:5,cost:140,speed:85},artillery:{cost:160},fighter:{cost:180},wire:{cost:40},bunker:{cost:220},sandbag:{cost:50},reinforce:{cost:200}};
for(const team of [0,1]){
 Brain.operations.reset();Brain.setRoles(team?['defend','attack']:['attack','defend']);const d=team?-1:1,p=Bases.create(2400,2000),x=team?1650:750;
 const own=[...Array.from({length:24},(_,i)=>unit(i+1,team,x+i%4*4,180+Math.floor(i/8)*65)),...Array.from({length:8},(_,i)=>unit(100+i,team,p[team].x,1000)),...Array.from({length:8},(_,i)=>unit(120+i,team,x-d*150,900))];
 const state={team,time:0,width:2400,height:2000,units:own,points:p,trenches:[],buildings:[],decor:[],maxUnits:120,supplies:0,tickets:[500,500],defs,visibilityRange:760};let plan;for(const t of [0,5,6,12]){state.time=t;plan=Brain.plan(state)}assert.equal(plan.operation.phase,'advance');
 const army=new Set(plan.orders.filter(o=>o.role==='avanço-alternado').map(o=>o.id));assert.ok(army.size>=8);
 for(const u of own)if(army.has(u.id)){u.x=p[1-team].x-d*350;u.y=200}
 state.time=13;plan=Brain.plan(state);assert.equal(plan.operation.phase,'advance','atingir retaguarda no setor não consolida longe da base');
 const convergence=plan.orders.filter(o=>army.has(o.id)&&o.role==='avanço-alternado');assert.ok(convergence.length);assert.ok(convergence.every(o=>o.ty>220),'rotas começam a virar para a bandeira central');
}
console.log('game refinement: mirrored capture convergence, protected services, bounded searches, wounded targets, base alerts and available air missions OK');
