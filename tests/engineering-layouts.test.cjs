const assert=require('node:assert/strict'),L=require('../dist/engineering-layouts.js'),E=require('../dist/engineering.js');
const catalog=Object.fromEntries(['trench','comm','wire','nest','dugout','mortar','bunker','pillbox','aa','aid','depot','gunf','gunh'].map(k=>[k,{}]));
const roads=[462.5,1000,1525],signatures=new Set();
for(const {id} of L.layouts){
 const p=L.select(123,id),c={team:0,width:2400,height:2000,roads,catalog,guns:[{x:340,y:500,k:'f'}]},a=L.preparation(p,c),b=L.preparation(p,{...c,team:1});
 assert.deepEqual(a,L.preparation(p,c),'planta não muda a cada consulta');
 assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++)for(let j=0;j<a[i].pts.length;j++){
  assert.ok(Math.abs(a[i].pts[j][0]+b[i].pts[j][0]-2400)<1e-8,'layout espelhado');assert.equal(a[i].pts[j][1],b[i].pts[j][1]);
  assert.ok(a[i].pts[j][1]>=40&&a[i].pts[j][1]<=1960);
 }
 assert.ok(a.some(it=>it.pts.some(([x,y])=>y>1600)),'preparação usa o sul ampliado');
 for(const it of a.filter(it=>it.kind==='wire'))for(const [x,y] of L.samples(it.pts))for(const road of roads)assert.ok(Math.abs(y-road)>=48-1e-8,'arame mantém corredores');
 assert.ok(a.filter(it=>it.kind==='trench').length>=5);
 signatures.add(JSON.stringify(a.filter(it=>it.kind==='trench').map(it=>it.pts)));
 assert.ok(L.preparation(p,{...c,second:true}).some(it=>it.kind==='comm'));
 assert.ok(!L.preparation(p,{...c,artillery:false}).some(it=>it.kind.startsWith('gun')));
}
assert.equal(signatures.size,6,'seis geometrias realmente diferentes');
assert.equal(new Set(Array.from({length:100},(_,i)=>L.select(i).id)).size,6,'sorteio alcança todos os layouts');
const safe={dry:()=>true,enemies:[],shells:[],obstacles:[]};
assert.equal(L.safe([[400,400],[600,400]],{...safe,dry:(x,y)=>x<475||x>525}),false,'verifica água entre as pontas');
assert.equal(L.safe([[400,400],[600,400]],{...safe,obstacles:[{x:500,y:400,type:'ruin',size:30}]}),false,'obra não atravessa sólido');
assert.equal(L.safe([[400,400],[600,400]],{...safe,shells:[{x:500,y:400,t:2,r:30}]}),false);
assert.equal(L.safe([[400,400],[600,400]],{...safe,shells:[{x:500,y:400,t:2,r:30,kind:'smoke'}]}),true,'fumaça não impede cobertura');
const p=L.select(99,'redoubts'),sector={id:2,y:1000};
assert.equal(L.sites(p,'comm',sector,800,100,{height:2000,assets:[]}).length,0,'ligação exige destino real');
const target={kind:'trench',x:810,y:1010},sites=L.sites(p,'comm',sector,800,100,{height:2000,assets:[target]});assert.equal(sites.length,3);assert.deepEqual(sites[0].pts.at(-1),[810,1010]);
const own=Array.from({length:24},(_,id)=>({id,team:0,type:'rifle',hp:100,maxhp:100,x:750,y:1000}));
const context={team:0,time:0,height:2000,width:2400,own,workers:6,projects:[],assets:[],catalog,cash:800,income:12,plan:{operation:{sector:2,phase:'hold'},sectors:[{id:2,y:1000,front:770,threat:0}]},enemies:[],shells:[],obstacles:[],dry:()=>true,cost:()=>60};
E.reset(777);const blueprint=E.layout(0,0),first=E.choose(context);assert.equal(first.layout,blueprint.id);E.choose({...context,time:5});assert.equal(E.state(0).layout.seed,blueprint.seed);
E.reset(777);assert.deepEqual(E.layout(0,0),blueprint,'semente reproduz layout da facção');
E.reset(777);E.choose({...context,plan:{...context.plan,operation:{sector:2,phase:'withdraw'}},own:own.map(u=>({...u,x:550}))});assert.equal(E.state(0).stage,'recuo');
E.reset(777);E.choose({...context,wounded:own.slice(0,8).map(u=>({...u,down:true,hp:1}))});assert.equal(E.state(0).stage,'socorro');
E.reset(777);E.choose({...context,wounded:own.slice(0,8).map(u=>({...u,team:1,down:true,hp:1}))});assert.equal(E.state(0).stage,'posição','feridos inimigos não comandam a logística');
E.reset();assert.equal(E.state(0),null);
console.log('Engineering layouts: seis plantas, sorteio estável, espelho, mapa ampliado, corredores, segurança do trajeto, conexões reais e adaptação OK');
