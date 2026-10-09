const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tests/artifacts');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),report={errors:[],battles:[]};
try{
 const page=await browser.newPage({viewport:{width:1360,height:900}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))report.errors.push(m.text())});
 await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0`);await page.locator('[data-go="sandbox"]').click();await page.locator('#start').click();
 if(process.argv.includes('--probe-only'))report.battles=JSON.parse(fs.readFileSync(path.join(out,'battle-plans-report.json'),'utf8')).battles;
 // Run complete, finite-resource matches with combat, construction, aircraft and medical care active.
 for(const map of process.argv.includes('--probe-only')?[]:['trenches']){
  await page.evaluate(map=>{let seed=2718;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};document.getElementById('result').close();document.getElementById('mapselect').value=map;document.getElementById('gametype').value='conquest';document.getElementById('blueai').value='on';document.getElementById('redai').value='on';document.getElementById('scale').value='120';setup();sandbox=false;running=false;supplies=[1800,1800];PXW.setKind('clear');window.maneuverLog=[];window.maneuverSeen=new Set()},map);
  for(let batch=0;batch<6;batch++){
   const snapshot=await page.evaluate(()=>{for(let i=0;i<300&&!ended;i++){update(.1);for(let t=0;t<2;t++){const p=IronFrontBrain.lastPlans[t],m=p?.strategy?.active;if(m){const key=t+':'+m.id+':'+m.stage;if(!maneuverSeen.has(key)){maneuverSeen.add(key);maneuverLog.push({time,team:t,kind:m.kind,stage:m.stage})}}}}hud();render();return {time,units:units.filter(u=>u.hp>0).length,stages:maneuverLog.length}});console.log(JSON.stringify({map,...snapshot}));
  }
  const result=await page.evaluate(()=>({time,cash:[...supplies],cap:maxUnits,counts:[0,1].map(t=>units.filter(u=>u.team===t&&u.hp>0).length),stages:maneuverLog,plans:IronFrontBrain.lastPlans.map(p=>({operation:p?.operation,strategy:p?.strategy,opponent:p?.opponent})),airErrors:PXAW.stats.errors,constructionErrors:PXSAP.stats.errors,ended}));result.map=map;report.battles.push(result);fs.writeFileSync(path.join(out,'battle-plans-report.json'),JSON.stringify(report,null,2));
  assert.ok(result.cash.every(n=>Number.isFinite(n)&&n>=0));assert.ok(result.counts.every(n=>n<=result.cap));assert.equal(result.airErrors,0);assert.equal(result.constructionErrors,0);assert.ok(result.plans.every(p=>p.strategy&&p.opponent));
 }
 // Place native squads in an observed MG scenario, then move actual participants to verify commander integration.
 report.probe=await page.evaluate(()=>{
  document.getElementById('result').close();document.getElementById('mapselect').value='trenches';setup();running=false;units=[];buildings=[];fieldTrenches=[];decor=[];shells=[];time=0;aiEnabled=[true,false];supplies=[0,0];IronFrontBrain.operations.reset();IronFrontBrain.setRoles(['attack','defend']);PXW.setKind('clear');
  for(const [x,y,n,type] of [[820,900,8,'rifle'],[810,1070,8,'rifle'],[810,1120,8,'rifle'],[450,1000,8,'rifle'],[270,1000,8,'rifle'],[840,1010,3,'mg']])for(let i=0;i<n;i++){const u=newUnit(type,0,x+i*3,y);u.cls=undefined;u.gren=2;u.manualUntil=0;u.suppression=0;u.cohesion=1}
  const enemy=newUnit('mg',1,1100,1000);enemy.cls=undefined;enemy.manualUntil=999;
  for(const t of [0,5,6]){time=t;runCommander(0)}
  let p=IronFrontBrain.lastPlans[0],strategy=p.strategy.active;const phases=[strategy?.stage];
  if(!strategy)return {phases,operation:p.operation,roles:[...new Set(p.orders.map(o=>o.role))]};
  function moveSquad(id,target){for(const u of units.filter(u=>u.aiSquad===id)){u.x=target.x;u.y=target.y;u.suppression=0;u.manualUntil=0}}
  // The scout waypoint is the flank, 135 units back along x.
  moveSquad(strategy.participants[0],{x:strategy.flank.x-135,y:strategy.flank.y});time=7;runCommander(0);p=IronFrontBrain.lastPlans[0];phases.push(p.strategy.active?.stage);
  moveSquad(strategy.participants[2],{x:enemy.x-210,y:enemy.y+(strategy.flank.y>enemy.y?-65:65)});enemy.suppression=.8;time=10;runCommander(0);p=IronFrontBrain.lastPlans[0];phases.push(p.strategy.active?.stage);
  moveSquad(strategy.participants[0],strategy.flank);time=13;runCommander(0);p=IronFrontBrain.lastPlans[0];phases.push(p.strategy.active?.stage);
  cam.x=900;cam.y=1000;hud();render();minimap();return {phases,roles:[...new Set(p.orders.map(o=>o.role))],strategy:p.strategy,dialogue:p.dialogue,summary:document.getElementById('tacticalStatus').textContent,panel:document.getElementById('aiLearning').textContent};
 });
 assert.deepEqual(report.probe.phases,['recon','fix','flank','commit'],JSON.stringify(report.probe));assert.ok(report.probe.roles.includes('assalto-coordenado'));assert.ok(report.probe.summary.includes('Avançar sob cobertura'));assert.ok(report.probe.panel.includes('Manobra:'));
 await page.screenshot({path:path.join(out,'battle-plans-in-game.png')});assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'battle-plans-report.json'),JSON.stringify(report,null,2));console.log('Battle plans: three finite-resource matches, staged commander orders, HUD and native rendering verified');
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
