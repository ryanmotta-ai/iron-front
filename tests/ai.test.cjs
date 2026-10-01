const assert = require('node:assert/strict');
const Brain = require('../dist/ai.js');

const defs = {
  rifle: {cost:80,count:8}, mg:{cost:100,count:3},
  cavalry:{cost:140,count:5}, tank:{cost:260,count:1},
  sandbag:{cost:50}, wire:{cost:40}, bunker:{cost:220},
  artillery:{cost:160}, fighter:{cost:180}, reinforce:{cost:200}
};
const points = [
  {name:'A',x:930,y:400,owner:0},
  {name:'B',x:1200,y:800,owner:-1},
  {name:'C',x:1470,y:1200,owner:1}
];
const unit = (id,team,x,y,extras={}) => ({id,team,x,y,hp:100,maxhp:100,type:'rifle',manualUntil:0,underFire:0,...extras});
const state = overrides => ({team:1,units:[unit(1,1,1800,800),unit(2,0,650,800)],points,buildings:[],decor:[],time:10,maxUnits:80,supplies:600,tickets:[500,500],defs,visibilityRange:760,controlledId:null,supportReady:false,buildReady:false,reinforceReady:false,...overrides});

const baseline = Brain.plan(state());
assert.match(baseline.summary,/B:/);
assert.equal(baseline.orders.length,1);
assert.equal(baseline.purchase,'mg');

const targetShooter=unit(50,1,1000,800);
const priorityTargets=[targetShooter,unit(51,0,1120,800,{type:'mg'}),unit(52,0,1080,800,{type:'rifle'})];
assert.equal(Brain.selectTarget(targetShooter,priorityTargets,240).type,'mg');
const mixedTargets=[unit(53,0,1120,800,{type:'tank',hp:650,maxhp:650}),unit(54,0,1080,800,{type:'rifle'})];
assert.equal(Brain.selectTarget(targetShooter,[targetShooter,...mixedTargets],240).type,'rifle');
assert.equal(Brain.selectTarget(unit(58,1,1000,800,{type:'tank',hp:650,maxhp:650}),mixedTargets,370).type,'tank');
const shooter=unit(55,1,100,100),blocked=unit(56,0,300,100),exposed=unit(57,0,190,180);
assert.equal(Brain.clearShot(shooter,blocked,[{type:'ruin',x:200,y:100}],[]),false);
assert.equal(Brain.clearShot(shooter,blocked,[],[{type:'bunker',x:200,y:100,hp:1000}]),false);
assert.equal(Brain.clearShot(shooter,blocked,[{type:'tree',x:200,y:100}],[]),false);
assert.equal(Brain.clearShot(shooter,exposed,[{type:'ruin',x:200,y:100}],[]),true);
assert.equal(Brain.selectTarget(shooter,[shooter,blocked,exposed],250,(a,b)=>Brain.clearShot(a,b,[{type:'ruin',x:200,y:100}],[])).id,57);
const tankShooter=unit(59,1,100,100,{type:'tank',hp:650,maxhp:650});
assert.equal(Brain.safeShot(tankShooter,blocked,[tankShooter,unit(60,1,305,100)],[],[]),false);
assert.equal(Brain.safeShot(tankShooter,blocked,[tankShooter,unit(60,1,500,100)],[],[]),true);

assert.equal(Brain.plan(state({supplies:0})).purchase,null);
assert.equal(Brain.plan(state({units:[unit(1,1,1800,800,{manualUntil:30})]})).orders.length,0);
assert.equal(Brain.plan(state({controlledId:1})).orders.length,0);

const wounded = Brain.plan(state({units:[unit(1,1,1800,800,{hp:25}),unit(2,0,1700,800)]}));
assert.equal(wounded.orders[0].role,'recuo');
assert.equal(wounded.orders[0].tx,1950);
const woundedNearCover = Brain.plan(state({units:[unit(1,1,1800,800,{hp:25,underFire:7}),unit(2,0,1700,800)],decor:[{x:1830,y:800,type:'ruin'}]}));
assert.equal(woundedNearCover.orders[0].role,'recuo');

const covered = Brain.findCover(unit(1,1,100,100),unit(2,0,210,100),[{x:145,y:100,type:'ruin'}],[]);
assert.deepEqual(covered,{x:145,y:100,factor:.55});

const cluster=Array.from({length:8},(_,i)=>unit(i+10,0,1210+i*8,800+i%2*8));
const air=Brain.plan(state({units:[unit(1,1,1800,800),...cluster],supportReady:true}));
assert.equal(air.support?.type,'fighter');
const threatenedTank=Brain.plan(state({units:[unit(1,1,1470,1200),unit(40,0,1470,1200,{type:'tank',hp:650,maxhp:650}),...Array.from({length:5},(_,i)=>unit(50+i,0,1478+i*9,1200))],supportReady:true}));
assert.equal(threatenedTank.support,null,'apoio não deve atingir aliados misturados ao alvo');
const isolatedTank=Brain.plan(state({units:[unit(1,1,1800,1550),unit(40,0,1470,1200,{type:'tank',hp:650,maxhp:650}),...Array.from({length:5},(_,i)=>unit(50+i,0,1478+i*9,1200))],supportReady:true}));
assert.equal(isolatedTank.support?.type,'artillery');
const unseenCluster=Brain.plan(state({units:[unit(1,1,1800,800),...cluster],visibilityRange:180,supportReady:true}));
assert.equal(unseenCluster.support,null,'comandante não deve chamar apoio sobre tropas que não observou');
const distantCluster=Array.from({length:8},(_,i)=>unit(150+i,0,1000+i*8,800));
assert.equal(Brain.plan(state({units:[unit(1,1,1800,800),...distantCluster],supportReady:true})).support,null);
assert.ok(Brain.plan(state({units:[unit(1,1,1800,800),unit(9,1,1500,800,{type:'cavalry'}),...distantCluster],supportReady:true})).support,
  'patrulha avançada deve revelar um agrupamento antes de pedir apoio');
const noAir=Brain.plan(state({units:[unit(1,1,1800,800),...cluster],supportReady:true,airAvailable:false}));
assert.equal(noAir.support?.type,'artillery');
const walkingIntoFire=Brain.plan(state({units:[unit(1,1,1500,1450),...Array.from({length:6},(_,i)=>unit(130+i,0,1300+i*4,1200))],supportReady:true}));
assert.equal(walkingIntoFire.support,null,'apoio deve considerar aliados avançando para a zona de impacto');

const defenders=Array.from({length:7},(_,i)=>unit(i+20,0,1470+i*4,1200));
const fortify=Brain.plan(state({units:[unit(1,1,1800,800),...defenders],buildReady:true}));
assert.equal(fortify.defense?.type,'bunker');
const wireThreat=Array.from({length:4},(_,i)=>unit(80+i,0,1470+i*8,1200));
const wireDefense=Brain.plan(state({units:[unit(81,1,1470,1200),...wireThreat],buildReady:true,supplies:300}));
assert.equal(wireDefense.defense?.type,'wire');
const counterattack=Brain.plan(state({units:[unit(3,1,1600,1200),...defenders]}));
assert.equal(counterattack.orders[0].role,'contra-ataque');

const overrunFriends=Array.from({length:4},(_,i)=>unit(100+i,1,1200+i*12,800));
const overrunEnemies=Array.from({length:8},(_,i)=>unit(120+i,0,1210+i*10,800));
const regroup=Brain.plan(state({units:[...overrunFriends,...overrunEnemies]}));
assert.ok(regroup.orders.some(o=>o.role==='reagrupamento'));
const isolated=Brain.plan(state({units:[unit(1,1,1500,800),unit(3,1,1750,800),unit(2,0,1500,860),unit(4,0,1510,840)]}));
assert.equal(isolated.orders[0].role,'socorro');
assert.equal(isolated.orders[0].tx,1750);
const recon=Brain.plan(state({units:[unit(9,1,1800,800,{type:'cavalry'}),unit(2,0,650,800)]}));
assert.equal(recon.orders[0].role,'reconhecimento');
const mobileReserve=Brain.plan(state({units:[unit(11,1,1800,800),unit(2,0,650,800)]}));
assert.equal(mobileReserve.orders[0].role,'reserva-movel');
const breach=Brain.plan(state({units:[unit(11,1,2050,700),...Array.from({length:4},(_,i)=>unit(70+i,0,1470+i*8,1200))]}));
assert.equal(breach.orders[0].role,'reforço-defensivo');
assert.ok(Math.hypot(breach.orders[0].tx-1470,breach.orders[0].ty-1200)<120);
const heldFront=Brain.plan(state({units:[unit(11,1,1800,800),unit(71,1,1200,790),unit(72,1,1210,800),unit(73,1,1200,810)]}));
assert.equal(heldFront.orders[0].role,'assalto','reserva deve avançar quando a linha já tem força suficiente');
const loneObjective=[points[1]];
const scoutReached=Brain.plan(state({points:loneObjective,units:[unit(9,1,1410,1020,{type:'cavalry'})]}));
assert.equal(scoutReached.orders[0].role,'incursão');
assert.equal(scoutReached.orders[0].reconGoal,'B');
const scoutContinues=Brain.plan(state({points:loneObjective,units:[unit(9,1,1500,1100,{type:'cavalry',reconGoal:'B'})]}));
assert.equal(scoutContinues.orders[0].role,'incursão','patrulha concluída não deve voltar ao mesmo ponto');
const mgSupport=Brain.plan(state({units:[unit(2,1,1800,800,{type:'mg'}),...Array.from({length:4},(_,i)=>unit(60+i,0,1200+i*5,800))]}));
assert.equal(mgSupport.orders[0].role,'base-de-fogo');

const trench={id:'rear-1',type:'trench',team:1,x:1840,y:800,hp:650};
const garrison=Brain.plan(state({units:[unit(6,1,1800,800),unit(2,0,650,800)],buildings:[trench]}));
assert.equal(garrison.orders[0].role,'trincheira');
const escorted=Brain.plan(state({units:[unit(5,1,1800,800),unit(7,1,1760,800,{type:'tank',hp:650,maxhp:650}),unit(2,0,650,800)]}));
assert.equal(escorted.orders[0].role,'escolta');
assert.equal(Brain.trenchSlots(state({units:[unit(6,1,1840,800)],buildings:[{...trench,team:0}]})).length,5);
assert.equal(Brain.trenchSlots(state({units:[unit(6,1,1840,800),unit(9,0,1860,800)],buildings:[{...trench,team:0}]})).length,0);
const sheltered=Brain.plan(state({units:[unit(1,1,1800,800,{underFire:7}),unit(2,0,1700,800)],buildings:[trench]}));
assert.equal(sheltered.orders[0].role,'trincheira');
assert.ok(Math.abs(sheltered.orders[0].tx-trench.x)<50);
const suppressed=Brain.plan(state({units:[unit(1,1,1800,800,{suppression:1}),unit(2,0,1700,800)],buildings:[trench]}));
assert.equal(suppressed.orders[0].role,'trincheira');
const pinned=Brain.plan(state({units:[unit(1,1,1800,800,{suppression:1.25,cohesion:.5}),unit(2,0,1700,800)],buildings:[trench]}));
assert.equal(pinned.orders[0].role,'fixado');
assert.ok(Math.abs(pinned.orders[0].tx-trench.x)<50,'unidade fixada procura uma vaga na trincheira');
const rally=Brain.plan(state({units:[unit(1,1,1800,800,{suppression:1.3,cohesion:.45}),unit(3,1,2030,800,{type:'mg'}),unit(4,1,1660,800),unit(2,0,1700,800)]}));
assert.equal(rally.orders[0].role,'reorganização');
assert.ok(rally.orders[0].tx>2030,'reunião procura apoio atrás da linha e não corre para o inimigo');
const remainsPinned=Brain.plan(state({units:[unit(1,1,1800,800,{suppression:.65,cohesion:.9,aiRole:'fixado'}),unit(2,0,1700,800)]}));
assert.equal(remainsPinned.orders[0].role,'fixado','unidade não retoma o avanço após um único intervalo de alívio');
const recovered=Brain.plan(state({units:[unit(1,1,1800,800,{suppression:.2,cohesion:.85,aiRole:'fixado'}),unit(2,0,1700,800)]}));
assert.equal(recovered.orders[0].role,'assalto','unidade recuperada volta ao objetivo');
const supported=Brain.plan(state({units:[unit(1,1,1800,800,{suppression:1.1,cohesion:1}),unit(3,1,1810,810),unit(4,1,1810,790),unit(5,1,1780,800),unit(2,0,1700,800)]}));
assert.notEqual(supported.orders[0].role,'fixado','apoio próximo aumenta resistência à pressão moderada');
const pinnedTank=Brain.plan(state({units:[unit(1,1,1800,800,{type:'tank',suppression:2,cohesion:0}),unit(2,0,1700,800)]}));
assert.notEqual(pinnedTank.orders[0].role,'fixado','blindado não usa a reação da infantaria');
const invaders=Array.from({length:5},(_,i)=>unit(30+i,0,1880+i*8,800));
const invasion=Brain.plan(state({units:[unit(4,1,1800,800),...invaders],buildings:[trench]}));
assert.match(invasion.summary,/Invasão/);
assert.equal(invasion.orders[0].role,'trincheira');
const twoInTrench=Brain.plan(state({units:[unit(1,1,1800,800,{underFire:7}),unit(3,1,1801,800,{underFire:7}),unit(2,0,1700,800)],buildings:[trench]}));
assert.notEqual(twoInTrench.orders[0].tx,twoInTrench.orders[1].tx);
assert.equal(Brain.plan(state({units:[unit(1,1,1800,800,{dodgeUntil:20})]})).orders.length,0);
const escape=Brain.evadeShells(unit(1,1,1800,800),[{x:1800,y:800,r:65,t:1.5}]);
assert.ok(Math.hypot(escape.tx-1800,escape.ty-800)>=55);
const clusteredEscape=Brain.evadeShells(unit(1,1,1800,800),[{x:1800,y:800,r:65,t:1.5},{x:1900,y:800,r:65,t:1.4}]);
assert.ok(Math.hypot(clusteredEscape.tx-1800,clusteredEscape.ty-800)>90);
assert.ok(Math.hypot(clusteredEscape.tx-1900,clusteredEscape.ty-800)>90);
assert.equal(Brain.evadeShells(unit(1,1,1800,800),[{x:1400,y:800,r:65,t:1.5}]),null);

console.log('IA 1.2: objetivos, compras, alvos, supressão, coesão, abrigo, reunião, recuperação, ordens manuais, apoio, trincheiras, invasão, evasão, reconhecimento e reservas OK');
