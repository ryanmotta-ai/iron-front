const assert=require('node:assert/strict'),B=require('../dist/base-objectives.js'),Brain=require('../dist/operations.js');
const unit=(id,team,x,y,extra={})=>({id,team,x,y,hp:100,maxhp:100,type:'rifle',manualUntil:0,cohesion:1,suppression:0,...extra});
for(const height of [1600,2000]){const p=B.create(2400,height);assert.equal(p.length,2);assert.equal(p[0].home,0);assert.equal(p[1].home,1);assert.equal(p[0].x,2400-p[1].x);assert.equal(p[0].y,height/2);assert.ok(p[0].x<350);assert.ok(p[1].x>2050);assert.ok(p.every(p=>p.owner===p.home));assert.equal(B.drain(p,0),0);assert.equal(B.drain(p,1),0);assert.equal(B.winner(p),null)}
let p=B.create(2400,2000),target=p[1];
const attackers=Array.from({length:8},(_,id)=>unit(id,0,target.x,target.y));
assert.equal(B.capture(p,attackers,5)[0].team,0);assert.equal(target.owner,0);assert.equal(B.winner(p),0);assert.equal(B.drain(p,0),1);
p=B.create();target=p[0];const invalid=[unit(1,1,target.x,target.y,{down:true}),unit(2,1,target.x,target.y,{hp:0}),unit(3,1,target.x,target.y,{cls:'medic'}),unit(4,1,target.x,target.y,{sap:1}),unit(5,1,target.x,target.y,{rs:{}})];B.capture(p,invalid,30);assert.equal(target.owner,0,'feridos, mortos, médicos e construtores não capturam');
B.capture(p,[unit(6,1,target.x,target.y),unit(7,0,target.x,target.y)],30);assert.equal(target.progress,-100,'forças iguais contestam sem progresso');
B.capture(p,Array.from({length:8},(_,id)=>unit(id,1,target.x,target.y)),5);assert.equal(B.winner(p),1);
p=B.create();p[0].owner=1;p[1].owner=0;assert.equal(B.winner(p),null,'bases trocadas exigem recuperar a própria');
const defs={rifle:{count:8,cost:80,speed:47},mg:{count:3,cost:100,speed:34},tank:{count:1,cost:260,speed:28},cavalry:{count:5,cost:140,speed:85},artillery:{cost:160},fighter:{cost:180},wire:{cost:40},bunker:{cost:220},sandbag:{cost:50},reinforce:{cost:200}};
function state(team=0){const units=Array.from({length:64},(_,i)=>unit(i+1,team,team?1700:700,200+Math.floor(i/8)*180));units.push(...Array.from({length:8},(_,i)=>unit(100+i,team,team?2140:260,1000)));return {team,time:0,width:2400,height:2000,units,points:B.create(2400,2000),trenches:[],buildings:[],decor:[],maxUnits:160,supplies:600,tickets:[500,500],defs,visibilityRange:760,supportReady:false,buildReady:false,reinforceReady:false}}
for(const team of [0,1]){Brain.operations.reset();Brain.setRoles(team?['defend','attack']:['attack','defend']);let s=state(team),plan=Brain.plan(s);
 const guards=plan.orders.filter(o=>o.role==='guarda-objetivo');assert.ok(guards.length>0);assert.ok(guards.every(o=>Math.abs(o.tx-s.points[team].x)<120&&Math.abs(o.ty-1000)<100),'guarnição vai à própria retaguarda');
 assert.ok(plan.sectors.every(sector=>sector.x===s.points[1-team].x),'objetivo ofensivo está na base inimiga');
 for(const time of [5,6,12,18]){s.time=time;plan=Brain.plan(s)}assert.equal(plan.operation.phase,'advance');assert.ok(plan.orders.some(o=>o.role==='reserva-movel'),'a proteção da base não consome toda reserva');
}
console.log('Base objectives: duas bandeiras na retaguarda, captura válida, vitória, sem sangria inicial, guarnição, reservas e ofensiva espelhada OK');
