const assert=require('node:assert/strict');
const Plans=require('../dist/battle-plans.js'),Patterns=require('../dist/opponent-patterns.js'),Stories=require('../dist/battle-stories.js'),Learning=require('../dist/learning.js');
const unit=(id,x,y,type='rifle')=>({id,team:0,x,y,type,hp:100,maxhp:100,suppression:0,manualUntil:0,cohesion:1});
const group=(id,x,y,kind='infantry')=>{const members=Array.from({length:kind==='fire'?3:8},(_,i)=>unit(id*10+i,x,y,kind==='fire'?'mg':'rifle'));return {id,x,y,kind,members,ids:members.map(u=>u.id),strength:8,pressure:0,source:{id,task:'posição-defensiva',mind:{leader:members[0].id,morale:.8,recoverUntil:0}}}};
function fixture(team=0){const groups=[group(1,800,800),group(2,790,900),group(3,790,830,'fire'),group(4,500,1000),group(5,300,1000)];groups[3].source.reserve=true;groups[4].source.task='guarda-objetivo';const s={team,time:0,width:2400,height:2000,units:groups.flatMap(g=>g.members),points:[],visibilityRange:550,clearSight:()=>true,terrainRisk:()=>0};const target={id:900,team:1,type:'mg',hp:100,x:1060,y:800,at:0,suppression:0};return {groups,s,target,op:{phase:'advance',sector:{x:1500,y:800,front:750}}}}
function move(g,p){g.x=p.x;g.y=p.y;for(const u of g.members){u.x=p.x;u.y=p.y}}
function tick(f,mem,t,def=false,patterns=null){f.s.time=t;f.target.at=t;return Plans.update(mem,f.s,f.groups,[f.target],f.op,def,patterns,new Set([5]))}
let f=fixture(),mem=Plans.create(),orders=tick(f,mem,0);
assert.equal(mem.active.stage,'recon');assert.equal(orders.size,3);assert.ok(!orders.has(4)&&!orders.has(5),'reserva e guarda ficam fora da manobra');
const selected=mem.active.participants.map(id=>f.groups.find(g=>g.id===id));
const [flanker,assault,cover]=selected;
tick(f,mem,3);assert.equal(mem.active.stage,'recon','relógio não substitui reconhecimento');
move(flanker,mem.active.scout);f.s.clearSight=()=>false;tick(f,mem,4);assert.equal(mem.active.stage,'recon','chegar sem observar o acesso não libera');
f.s.clearSight=()=>true;tick(f,mem,5);assert.equal(mem.active.stage,'fix');
move(cover,mem.active.cover);tick(f,mem,8);assert.equal(mem.active.stage,'fix','apoio em posição ainda precisa suprimir a ameaça');
f.target.suppression=.7;tick(f,mem,9);assert.equal(mem.active.stage,'flank');
tick(f,mem,12);assert.equal(mem.active.stage,'flank','espera chegada real ao flanco');
move(flanker,mem.active.flank);orders=tick(f,mem,13);assert.equal(mem.active.stage,'commit');assert.equal(orders.get(assault.id).task,'assalto-coordenado');
move(flanker,{x:1140,y:990});move(assault,{x:1080,y:800});tick(f,mem,15);assert.equal(mem.active,null);assert.equal(mem.history.at(-1).success,true);

// Missing support, losses, human orders and stale contacts release the same troops.
for(const cause of ['timeout','loss','human','lost-contact','guard']){
 f=fixture();mem=Plans.create();tick(f,mem,0);
 if(cause==='timeout')tick(f,mem,26);
 if(cause==='loss'){for(const u of f.groups[0].members)u.hp=0;tick(f,mem,1)}
 if(cause==='human'){f.groups[0].members[0].manualUntil=50;tick(f,mem,1)}
 if(cause==='lost-contact'){f.s.time=13;Plans.update(mem,f.s,f.groups,[],f.op,false,null,new Set([5]))}
 if(cause==='guard'){f.groups[0].source.task='guarda-objetivo';tick(f,mem,1)}
 assert.equal(mem.active,null,cause);assert.equal(mem.history.at(-1).success,false,cause);
}
f=fixture();mem=Plans.create();f.s.terrainRisk=()=>8;assert.equal(tick(f,mem,0).size,0,'não cria flanco em terreno impassável');
f=fixture();f.groups=f.groups.filter(g=>g.kind!=='fire');mem=Plans.create();assert.equal(tick(f,mem,0).size,0,'não inventa equipe de apoio');

// A feigned retreat requires actual covering positions and observed pursuit.
f=fixture();f.op.phase='hold';f.target.type='rifle';mem=Plans.create();const habit={habit:{sector:2,x:1060,y:800,confidence:.8,episodes:2}};
tick(f,mem,0,true,habit);assert.equal(mem.active.kind,'ambush');assert.equal(mem.active.stage,'setup');
const [bait,strike,mg]=mem.active.participants.map(id=>f.groups.find(g=>g.id===id));
move(mg,mem.active.cover);move(strike,mem.active.scout);tick(f,mem,1,true,habit);assert.equal(mem.active.stage,'lure');
move(bait,mem.active.bait);tick(f,mem,5,true,habit);assert.equal(mem.active.stage,'lure','não obriga o inimigo a perseguir');
f.target.x=mem.active.bait.x+100;f.target.y=mem.active.bait.y;tick(f,mem,6,true,habit);assert.equal(mem.active.stage,'spring');
f.target.suppression=.9;tick(f,mem,13,true,habit);assert.equal(mem.history.at(-1).success,true);
f=fixture();f.op.phase='hold';f.target.type='rifle';mem=Plans.create();tick(f,mem,0,true,habit);const p=mem.active;move(f.groups.find(g=>g.id===p.participants[2]),p.cover);move(f.groups.find(g=>g.id===p.participants[1]),p.scout);tick(f,mem,1,true,habit);tick(f,mem,20,true,habit);assert.equal(mem.active,null,'isca ignorada volta ao plano normal');

// Patterns count distinct observed advances, never static units or repeated reports.
const pattern=Patterns.create(),state={team:0,time:0,height:2000},sectors=Array.from({length:5},(_,id)=>({front:750,name:'setor '+id}));
const reports=(at,x,ids=[901,902])=>ids.map(id=>({id,hp:100,x,y:850,at,type:'rifle'}));
Patterns.update(pattern,state,reports(0,1100),sectors);state.time=3;Patterns.update(pattern,state,reports(3,1050),sectors);assert.equal(pattern.lanes[2].episodes,1);
for(const time of [4,5,6]){state.time=time;Patterns.update(pattern,state,reports(3,1050),sectors)}assert.equal(pattern.lanes[2].episodes,1);assert.equal(Patterns.preferred(pattern),null);
state.time=55;Patterns.update(pattern,state,reports(55,1100,[903,904]),sectors);state.time=58;Patterns.update(pattern,state,reports(58,1040,[903,904]),sectors);assert.equal(pattern.lanes[2].episodes,2);assert.equal(Patterns.preferred(pattern).sector,2);
state.time=360;Patterns.update(pattern,state,[],sectors);assert.equal(Patterns.preferred(pattern),null);assert.equal(pattern.tracks.size,0);
const staticMem=Patterns.create();for(let t=0;t<100;t+=3){state.time=t;Patterns.update(staticMem,state,reports(t,1000),sectors)}assert.equal(staticMem.lanes[2].episodes,0);

// Tactical conversations reference the exact orders issued by the staged plan.
f=fixture();mem=Plans.create();orders=tick(f,mem,0);for(const g of f.groups)if(orders.has(g.id))g.source.task=orders.get(g.id).task;
const actual=f.groups.flatMap(g=>g.members.map(u=>({id:u.id,role:orders.get(g.id)?.task||g.source.task}))),stories=Stories.create();
const dialogue=Stories.update(stories,f.s,f.groups,actual,mem.reports);assert.ok(dialogue.some(e=>e.kind==='relato-tatico'&&e.text.includes('MG')));assert.ok(dialogue.some(e=>e.kind==='resposta'&&e.task==='fixar-posicao'));
assert.equal(Stories.update(Stories.create(),f.s,f.groups,[],mem.reports).length,0,'sem ordens reais não anuncia o plano');

// Experience maps use the expanded map height, matching operational sectors.
const learning=Learning.create(),ls={team:0,time:0,height:2000,units:[],points:[],trenches:[]};Learning.update(ls,[],[{id:900,type:'mg',hp:100,x:1000,y:1100,at:0}],learning);assert.ok(learning.sectors[2].mg>0);assert.equal(learning.sectors[3].mg,0);
console.log('battle plans: observed reconnaissance, real suppression, staged flank, ambush, ignored bait, fading habits, dialogue, priorities and expanded-map learning OK');

// Mirror the complete maneuver: both factions use the same rules and thresholds.
f=fixture();f.s.team=1;f.op.sector={x:900,y:800,front:1650};f.target.x=1340;f.target.team=0;
for(const g of f.groups){g.x=2400-g.x;for(const u of g.members){u.team=1;u.x=2400-u.x}}
mem=Plans.create();tick(f,mem,0);assert.equal(mem.active.stage,'recon');let mirrored=mem.active.participants.map(id=>f.groups.find(g=>g.id===id));
move(mirrored[0],mem.active.scout);tick(f,mem,1);assert.equal(mem.active.stage,'fix');move(mirrored[2],mem.active.cover);f.target.suppression=.7;tick(f,mem,4);assert.equal(mem.active.stage,'flank');move(mirrored[0],mem.active.flank);tick(f,mem,5);assert.equal(mem.active.stage,'commit');move(mirrored[0],{x:1250,y:990});move(mirrored[1],{x:1320,y:800});tick(f,mem,6);assert.equal(mem.history.at(-1).success,true);
f=fixture();mem=Plans.create();tick(f,mem,0);move(f.groups.find(g=>g.id===mem.active.participants[0]),mem.active.scout);tick(f,mem,1);move(f.groups.find(g=>g.id===mem.active.participants[2]),mem.active.cover);f.target.suppression=.8;tick(f,mem,4);move(f.groups.find(g=>g.id===mem.active.participants[0]),mem.active.flank);f.op.phase='prepare';tick(f,mem,5);assert.equal(mem.active.stage,'flank','assalto aguarda autorização da operação principal');
f=fixture();mem=Plans.create();tick(f,mem,0);f.target.x+=200;tick(f,mem,1);assert.equal(mem.active,null,'posição antiga não orienta assalto contra MG que se moveu');
const AirPolicy=require('../dist/air-support-policy.js'),air={team:0,time:100,own:Array.from({length:12},(_,i)=>unit(i,300,1000)),next:{},flights:[],contacts:[],width:2400,front:1200,y:1000,phase:'advance',reconPoint:{x:1300,y:800}};
assert.deepEqual(AirPolicy.choose(air),{kind:'rec',x:1300,y:800,reason:'Infantaria pediu reconhecimento do acesso lateral; informem resistência'});
assert.equal(AirPolicy.choose({...air,grounded:true}),null);assert.equal(AirPolicy.choose({...air,intruder:{x:500,y:600}}).kind,'int');assert.notEqual(AirPolicy.choose({...air,flights:[{kind:'rec',phase:'work'}]}).kind,'rec');
