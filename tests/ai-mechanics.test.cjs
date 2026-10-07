const assert=require('node:assert/strict');
const E=require('../dist/engineering.js'),Army=require('../dist/army-needs.js'),Brain=require('../dist/operations.js'),Support=require('../dist/support-policy.js');
const soldier=(id,team=0,x=750,y=1000,extra={})=>({id,team,type:'rifle',x,y,hp:100,maxhp:100,gren:2,manualUntil:0,suppression:0,cohesion:1,...extra});
const context=()=>({team:0,time:120,width:2400,height:2000,own:Array.from({length:24},(_,i)=>soldier(i)),workers:6,projects:[],assets:[],cash:1000,income:12,catalog:{trench:{line:1},nest:{},dugout:{},depot:{},aid:{},kitchen:{},op:{},sniper:{},foxhole:{},sandbag:{},pillbox:{},gunf:{},gunh:{},chevaux:{}},plan:{sectors:[{id:2,y:1000,front:770,threat:0}],operation:{sector:2,phase:'hold'}},enemies:[],shells:[],dry:()=>true,cost:i=>({trench:30,nest:150,dugout:70,depot:90,aid:120,kitchen:70,op:80,sniper:60,foxhole:8,sandbag:50,pillbox:240,gunf:220,gunh:320,chevaux:22}[i.kind])});
function pick(c){E.reset(123);return E.choose(c)}
let c=context();assert.equal(pick(c).kind,'trench','uncut terrain first needs cover');
c=context();c.own=c.own.map(u=>({...u,cohesion:.4}));assert.equal(pick(c).kind,'kitchen','exhausted troops justify a kitchen ahead of more cover');
c=context();c.assets=[{kind:'trench',x:750,y:1000}];c.own=c.own.map(u=>({...u,gren:0}));assert.equal(pick(c).kind,'depot','covered troops without grenades need supply');
c=context();c.wounded=Array.from({length:8},(_,i)=>soldier(100+i,0,750,1000,{hp:1,down:true}));assert.equal(pick(c).kind,'aid');
for(const kind of ['op','sniper','foxhole','sandbag','pillbox','gunf','gunh','chevaux']){
 c=context();c.catalog={[kind]:{}};c.artillery=true;c.plan.operation.phase=kind==='chevaux'?'withdraw':'recon';c.plan.sectors[0].threat=8;
 c.own=c.own.map(u=>({...u,cls:'marksman'}));if(['foxhole','sandbag'].includes(kind))c.own=c.own.slice(0,5);
 if(kind==='gunh')c.assets.push({kind:'gunf',x:470,y:1000});
 assert.equal(pick(c)?.kind,kind,'native paid mechanic '+kind+' becomes available when needed');
}
c=context();c.catalog={kitchen:{}};assert.equal(pick(c),null,'no kitchen demand for rested army');
c.own=c.own.map(u=>({...u,cohesion:.4}));c.projects=[{kind:'kitchen',done:false,segs:[{x:650,y:1000}]}];assert.equal(pick(c),null,'pending kitchen prevents duplicates');
c=context();c.catalog={kitchen:{}};c.own=c.own.map(u=>({...u,cohesion:.4}));c.projects=[{kind:'wire',done:true,segs:Array.from({length:220},()=>({}))}];c.maxSegments=44;assert.equal(pick(c).kind,'kitchen','finished wire does not exhaust the trench cap and block all support');
c=context();c.catalog={trench:{line:1},kitchen:{}};c.own=c.own.map(u=>({...u,cohesion:.4}));c.anchorCount=44;c.maxSegments=44;assert.equal(pick(c).kind,'kitchen');
c=context();c.serviceDemand=true;c.projects=[{done:false,kind:'trench',segs:[{x:500,y:500}]}];assert.equal(pick(c),null,'real maintenance leaves a crew free');
c=context();c.serviceDemand=true;c.workers=3;c.time=145;assert.equal(pick(c),null,'small engineer force gives service a bounded turn');c.time=150;assert.ok(E.choose(c),'construction resumes after service turn');
c=context();c.own=c.own.map(u=>({...u,cohesion:.4}));c.catalog={kitchen:{}};c.enemies=[{x:650,y:1000}];assert.equal(pick(c),null,'no kitchen under observed enemy fire');
c=context();c.own=c.own.map(u=>({...u,cohesion:.4}));c.catalog={kitchen:{}};c.cash=180;assert.equal(pick(c),null,'construction still protects combat reinforcements');
const defs={rifle:{count:8,cost:80,speed:47},sapper:{count:3,cost:90},specialists:{count:4,cost:140},assault:{count:6,cost:150},mg:{count:3,cost:100},tank:{count:1,cost:260},cavalry:{count:5,cost:140},artillery:{cost:160},fighter:{cost:180},reinforce:{cost:200},sandbag:{cost:50},wire:{cost:40},bunker:{cost:220}};
const army=()=>({team:0,time:40,units:Array.from({length:32},(_,i)=>soldier(i)),maxUnits:100,supplies:600,defs,sappersOn:true,classesOn:true});
let s=army();assert.equal(Army.choose(s,{phase:'hold'},'rifle'),'sapper');
s.units.push(...Array.from({length:6},(_,i)=>soldier(80+i,0,350,1000,{sap:1})));assert.equal(Army.choose(s,{phase:'hold'},'rifle'),'rifle','sufficient crew stops automatic engineer recruitment');
s.units[0].down=true;s.units[1].down=true;assert.equal(Army.choose(s,{phase:'hold'},'rifle'),'specialists');
s.units.push(soldier(99,0,350,1000,{cls:'medic'}));assert.equal(Army.choose(s,{phase:'prepare'},'rifle'),'assault');
s.units.push(...Array.from({length:6},(_,i)=>soldier(110+i,0,350,1000,{cls:'assault'})));assert.equal(Army.choose(s,{phase:'prepare'},'rifle'),'rifle','assault is bounded');
s.units=s.units.slice(0,4);assert.equal(Army.choose(s,{phase:'prepare'},null),'rifle','restore combat strength before services');
s=army();s.maxUnits=33;assert.equal(Army.choose(s,{phase:'prepare'},null),null,'cannot purchase above troop cap');
s=army();s.supplies=169;assert.equal(Army.choose(s,{phase:'hold'},null),null,'paid engineers retain reserve');
s=army();s.sappersOn=false;s.classesOn=false;assert.equal(Army.choose(s,{phase:'prepare'},'rifle'),'rifle','disabled mechanics stay disabled');
// Real squad planner uses depots for squads formerly excluded by id modulo and protects its base guard.
function battle(extra={}){return {team:0,time:0,width:2400,height:2000,units:Array.from({length:48},(_,i)=>soldier(i+1,0,650+(i%3)*8,750+Math.floor(i/8)*65,{gren:0})),points:[{name:'EUA',x:260,y:1000,home:0,owner:0},{name:'ALEMANHA',x:2140,y:1000,home:1,owner:1}],trenches:[],buildings:[],decor:[],maxUnits:100,supplies:600,tickets:[500,500],defs,supportReady:false,buildReady:false,reinforceReady:false,...extra}}
Brain.operations.reset();Brain.setRoles(['attack','defend']);s=battle({supplyPosts:[{team:0,x:610,y:820,stock:80}]});let p=Brain.plan(s);
assert.ok(p.orders.some(o=>o.role==='reabastecimento'));
assert.ok(p.orders.some(o=>o.role==='guarda-objetivo'));
assert.ok(new Set(p.orders.filter(o=>o.role==='reabastecimento').map(o=>o.squad)).size<=1,'service does not pull the whole army back');
Brain.operations.reset();s=battle({recoveryPosts:[{team:0,x:610,y:820,hp:260}]});s.units=s.units.map(u=>({...u,gren:2,cohesion:.5}));p=Brain.plan(s);
assert.ok(p.orders.some(o=>o.role==='recuperação-logística'),'stressed squad uses actual kitchen');
Brain.operations.reset();s=battle({time:40,sappersOn:true,classesOn:true});p=Brain.plan(s);assert.equal(p.purchase,'sapper','capability recruitment reaches real commander plan');
assert.ok(Support.route({height:2000,enemies:[],shells:[]},{x:350,y:1800},{x:600,y:1800}).y>1700,'support reaches expanded southern sectors');
console.log('AI mechanics: needs, paid diverse works, caps, fair service capacity, force composition, recovery, supply and expanded-map support OK');
