const assert=require('node:assert/strict');
const Brain=require('../dist/operations.js');
const defs={rifle:{count:8,cost:80,speed:47},mg:{count:3,cost:100,speed:34},tank:{count:1,cost:260,speed:28},cavalry:{count:5,cost:140,speed:85},artillery:{cost:160},fighter:{cost:180},wire:{cost:40},bunker:{cost:220},sandbag:{cost:50},reinforce:{cost:200}};
const unit=(id,team,x,y,extra={})=>({id,team,x,y,type:'rifle',hp:100,maxhp:100,suppression:0,manualUntil:0,cohesion:1,...extra});
const trenches=Array.from({length:15},(_,i)=>({id:'t'+i,type:'trench',team:0,x:i%3===0?520:720,y:80+i*100,hp:100,line:i%3===0?'support':'front',slots:8}));
function make(extra={}){return {team:0,time:0,units:Array.from({length:64},(_,i)=>unit(i+1,0,700+(i%4)*8,180+Math.floor(i/8)*170)),points:[{name:'A',x:930,y:400,owner:-1},{name:'B',x:1200,y:800,owner:-1},{name:'C',x:1470,y:1200,owner:1}],trenches,buildings:[],decor:[],maxUnits:160,supplies:2000,tickets:[500,500],defs,visibilityRange:700,supportReady:false,buildReady:false,reinforceReady:false,...extra}}
function fresh(roles=['attack','defend']){Brain.operations.reset();Brain.setRoles(roles)}
fresh();let s=make(),p=Brain.plan(s);
assert.equal(p.operation.phase,'recon');assert.equal(p.sectors.length,5);
assert.ok(p.orders.some(o=>o.role==='reserva-movel'),'uma reserva fica fora do esforço principal');
assert.ok(p.orders.some(o=>o.role==='reagrupamento'));
const assignments=new Map(p.orders.map(o=>[o.id,o.squad]));
s.time=9;p=Brain.plan(s);assert.equal(p.operation.phase,'muster');
s.time=14;p=Brain.plan(s);assert.equal(p.operation.phase,'prepare');
s.time=25;p=Brain.plan(s);assert.equal(p.operation.phase,'advance','sem resistência, não fica esperando relógio de ondas');
assert.ok(p.orders.some(o=>o.role==='avanço-alternado'));assert.ok(!p.orders.some(o=>o.role==='cobrindo-avanco'),'sem contato, esquadrões não param em alternância artificial');
for(const o of p.orders)assert.equal(o.squad,assignments.get(o.id),'esquadrões persistem entre etapas');
const current=p.operation.sector;s.time=90;p=Brain.plan(s);
assert.equal(p.operation.phase,'withdraw','ataque sem progresso é abortado');
assert.ok(Brain.operations.state(0).fail[current]>0);
s.time=110;p=Brain.plan(s);assert.notEqual(p.operation.sector,current,'troca o acesso depois de fracassar');

// Captura da missão original não se perde quando o ranking muda de objetivo.
fresh();s=make();for(const time of [0,9,14,25]){s.time=time;p=Brain.plan(s)}
const objective=s.points.slice().sort((a,b)=>Math.abs(a.y-p.operation.y)-Math.abs(b.y-p.operation.y))[0];
objective.owner=0;s.time=30;p=Brain.plan(s);assert.equal(p.operation.phase,'consolidate');
assert.ok(p.orders.some(o=>o.role==='consolidação'));

// Ordens humanas, combatente, feridos e sapadores ficam sob seus próprios controles.
fresh();s=make();s.units[0].manualUntil=50;s.units[1].down=true;s.units[2].sap=1;s.controlledId=s.units[3].id;
p=Brain.plan(s);for(const id of [1,2,3,4])assert.ok(!p.orders.some(o=>o.id===id));
s.time=5;const suppressed=s.units[4];suppressed.suppression=2;s.units.push(unit(900,1,suppressed.x+60,suppressed.y));
p=Brain.plan(s);assert.ok(['fixado','reorganização','retirada-trincheira','socorro'].includes(p.orders.find(o=>o.id===suppressed.id).role),'reação individual vence plano');

// Informações vencem e não incluem inimigos invisíveis.
fresh();s=make({visibilityRange:150});s.units.push(unit(800,1,2250,1500,{type:'tank'}));p=Brain.plan(s);assert.equal(Brain.operations.state(0).known,0);
s.units.push(unit(801,1,750,190,{type:'mg'}));s.time=5;Brain.plan(s);assert.equal(Brain.operations.state(0).known,1);
s.units.find(u=>u.id===801).x=2250;s.time=10;Brain.plan(s);assert.equal(Brain.operations.state(0).known,1);
s.time=41;Brain.plan(s);assert.equal(Brain.operations.state(0).known,0);

// Defesa não sai em ofensiva periódica; reage localmente e termina o contra-ataque.
fresh(['defend','attack']);s=make({points:[{name:'A',x:930,y:400,owner:0}]});
for(const time of [0,40,80,120]){s.time=time;p=Brain.plan(s);assert.equal(p.operation.phase,'hold');assert.ok(!p.assault)}
s.units.push(unit(950,1,690,450,{suppression:1}));s.time=125;p=Brain.plan(s);assert.equal(p.operation.phase,'counter');
assert.ok(p.orders.some(o=>o.role==='contra-ataque'));
for(const o of p.orders.filter(o=>o.role==='contra-ataque'))assert.ok(o.tx<=760,'contra-ataque não sai perseguindo rumo à retaguarda inimiga');
s.units=s.units.filter(u=>u.id!==950);s.time=170;p=Brain.plan(s);assert.equal(p.operation.phase,'hold');

// Rotas desviam de perigo e reagem à lama específica de blindados.
fresh();s=make({terrainRisk:(x,y,type)=>y>700&&y<900&&x>750?(type==='tank'?15:7):0});
const path=Brain.operations.route(s,[],{x:700,y:800},{x:1200,y:800},'tank');assert.ok(Math.abs(path.y-800)>=70);
const hazard=Brain.operations.route(make({shells:[{x:890,y:800,r:65,t:1}]}),[],{x:700,y:800},{x:1200,y:800},'rifle');assert.ok(Math.abs(hazard.y-800)>=70);

// Novo jogo limpa lembranças e planos visuais.
Brain.lastPlans[0]=p;Brain.operations.reset();assert.equal(Brain.operations.state(0),null);assert.equal(Brain.lastPlans[0],null);

// Fumaça solicitada não equivale a fumaça no campo; falta de apoio leva a reorganização.
fresh();s=make({supportReady:true,smokeAvailable:true});
s.units.push(...Array.from({length:25},(_,i)=>unit(1000+i,1,1050,160+Math.floor(i/5)*320,{type:'mg'})));
for(const time of [0,9,14]){s.time=time;p=Brain.plan(s)}
assert.equal(p.operation.phase,'prepare');assert.equal(p.support.kind,'smoke');
Brain.operations.supportResult(0,true);s.time=25;p=Brain.plan(s);assert.equal(p.operation.phase,'prepare','pedido aceito não libera avanço sem cobertura');
s.smokeCover=true;s.time=30;p=Brain.plan(s);assert.equal(p.operation.phase,'advance');

// Defesa em inferioridade usa a segunda linha, em vez de abandonar a reserva num ataque frontal.
fresh(['defend','attack']);s=make({units:Array.from({length:8},(_,i)=>unit(i+1,0,720,450+i*5))});
s.units.push(...Array.from({length:20},(_,i)=>unit(2000+i,1,680,440+i*4)));
p=Brain.plan(s);assert.ok(p.orders.some(o=>o.role==='retirada-coberta'));
assert.ok(p.orders.filter(o=>o.role==='retirada-coberta').every(o=>o.tx<650));

// Ritmo ofensivo maior em acesso livre; sem transformar inferioridade em ataque suicida.
fresh();s=make();for(const time of [0,5,6,12]){s.time=time;p=Brain.plan(s)}
assert.equal(p.operation.phase,'advance','acesso livre libera ofensiva em 12 segundos');
const offensive=p.orders.filter(o=>o.role==='avanço-alternado').length;
assert.ok(offensive>p.orders.filter(o=>o.role==='reserva-movel').length,'maior parte da força mantém pressão');
s.units.push(unit(3000,1,930,p.operation.y));s.time=13;p=Brain.plan(s);
assert.ok(p.orders.some(o=>o.role==='cobrindo-avanco'),'contato real mantém cobertura alternada');
fresh();s=make({units:Array.from({length:8},(_,i)=>unit(i+1,0,720,800+i*4))});
s.units.push(...Array.from({length:60},(_,i)=>unit(4000+i,1,950,160+Math.floor(i/12)*320,{type:'mg'})));
for(const time of [0,5,6,12,30,60]){s.time=time;p=Brain.plan(s);assert.notEqual(p.operation.phase,'advance','forte inferioridade continua impedindo ofensiva');}
console.log('operations: setores, etapas, reservas, esquadrões, captura, adaptação, defesa, neblina e rotas OK');

// Apenas os combatentes disponíveis contam para liberar um assalto.
fresh();s=make({units:Array.from({length:8},(_,i)=>unit(i+1,0,720,480+i*2,{manualUntil:i?100:0}))});
for(const time of [0,5,10,20]){s.time=time;p=Brain.plan(s)}assert.equal(p.operation.phase,'muster');

// Baixas na retaguarda não cancelam a ofensiva; reforços não escondem perdas do assalto original.
fresh();s=make();for(const time of [0,5,6,12]){s.time=time;p=Brain.plan(s)}
const fighters=new Set(p.orders.filter(o=>['avanço-alternado','flanqueamento-coordenado','infiltração','cobrindo-avanco','escolta','ruptura'].includes(o.role)).map(o=>o.id));
for(const u of s.units)if(!fighters.has(u.id))u.hp=0;
s.time=13;p=Brain.plan(s);assert.equal(p.operation.phase,'advance','baixas de outros grupos não causam retirada artificial');
for(const u of s.units)if(fighters.has(u.id))u.hp=40;
s.units.push(...Array.from({length:40},(_,i)=>unit(5000+i,0,720,480)));
s.time=14;p=Brain.plan(s);assert.equal(p.operation.phase,'withdraw','35% de perda efetiva aciona reorganização mesmo com reforços');

// O defensor protege e pode recuperar objetivos anteriores, apenas no seu lado e por tempo limitado.
fresh(['defend','attack']);s=make({points:[{name:'A',x:930,y:400,owner:0}]});p=Brain.plan(s);
assert.ok(p.orders.some(o=>o.role==='guarda-objetivo'));
s.points[0].owner=1;s.time=5;p=Brain.plan(s);assert.equal(p.operation.phase,'counter');
assert.ok(p.orders.some(o=>o.role==='recuperar-objetivo'));assert.ok(p.orders.filter(o=>o.role==='recuperar-objetivo').every(o=>o.tx<1200));
s.time=36;p=Brain.plan(s);assert.equal(p.operation.phase,'hold');
s.time=40;p=Brain.plan(s);assert.equal(p.operation.phase,'hold','há recuperação entre contra-ataques');
