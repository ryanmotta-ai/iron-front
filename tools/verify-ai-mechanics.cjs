const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tests/artifacts');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(d)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),report={maps:[],probes:[],errors:[]};
try{const page=await browser.newPage({viewport:{width:1360,height:900}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))report.errors.push(m.text())});
await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0`);await page.locator('[data-go="sandbox"]').click();await page.locator('#start').click();
for(const map of (process.argv.includes('--probes-only')?[]:['trenches','forest','winter'])){
 await page.evaluate(map=>{document.getElementById('mapselect').value=map;document.getElementById('gametype').value='conquest';document.getElementById('blueai').value='on';document.getElementById('redai').value='on';setup();running=false;IronFrontBrain.setRoles(['attack','defend'])},map);
 const samples=[];
 for(let batch=0;batch<4;batch++)samples.push(await page.evaluate(()=>{for(let i=0;i<300&&!ended;i++)update(.1);return {time:Math.round(time),ended,supplies:[...supplies],engineers:[0,1].map(t=>units.filter(u=>u.team===t&&u.hp>0&&!u.down&&u.sap).length),works:[0,1].map(t=>PXSAP.projects.filter(p=>p.team===t&&!p.mgr).map(p=>({kind:p.kind,done:p.done,complete:p.segs.every(s=>s.stage>=p.target)}))),roles:IronFront.state().aiRoles,errors:[PXSAP.stats.errors,PXFORT.stats.errors,PXWORKS.stats.errors,PXLOGI.stats.errors,PXMANAGE.stats.errors,PXDEF.stats.errors,PXAIR.stats.errors],invalid:units.filter(u=>!Number.isFinite(u.x)||!Number.isFinite(u.y)||u.x<0||u.x>W||u.y<0||u.y>H).length}}));
 assert.ok(samples.every(s=>s.supplies.every(n=>Number.isFinite(n)&&n>=0)));assert.ok(samples.every(s=>s.errors.every(n=>n===0)&&!s.invalid));assert.ok(samples.some(s=>s.engineers.every(n=>n>=3)));assert.ok(samples.at(-1).works.every(w=>w.length>0));
 assert.ok(samples.at(-1).works.every(w=>w.some(p=>p.complete)),'each army completes real work');
 report.maps.push({map,samples});console.log(JSON.stringify({map,time:samples.at(-1).time,engineers:samples.at(-1).engineers,kinds:samples.at(-1).works.map(w=>[...new Set(w.map(p=>p.kind))])}));
}
if(!process.argv.includes('--probes-only')){
 report.preparation=await page.evaluate(()=>{document.getElementById('result').close();document.getElementById('mapselect').value='trenches';PXFORT.cfg.PREP=80;setup();running=false;for(let i=0;i<300;i++)update(.1);const before=PXSAP.projects.filter(p=>!p.done&&p.src==='fort'),cash=[...supplies],progress=before.map(p=>p.segs.map(s=>s.work));PXFORT.endPrep();const preserved=JSON.stringify(progress)===JSON.stringify(before.map(p=>p.segs.map(s=>s.work))),sameCash=JSON.stringify(cash)===JSON.stringify(supplies),deferred=before.filter(p=>p.aiDeferred).length,warAt=time;
  for(let i=0;i<900&&!ended;i++)update(.1);PXFORT.cfg.PREP=0;return {before:before.length,preserved,sameCash,deferred,newWorks:PXSAP.projects.filter(p=>p.src==='fort'&&p.t0>=warAt).map(p=>p.kind),errors:[PXSAP.stats.errors,PXFORT.stats.errors]}});
 assert.ok(report.preparation.before>0&&report.preparation.deferred===report.preparation.before);assert.ok(report.preparation.preserved&&report.preparation.sameCash);assert.ok(report.preparation.newWorks.length>0);assert.ok(report.preparation.errors.every(n=>n===0));console.log(JSON.stringify({preparation:report.preparation}));
}
// Actual pioneer work and native building effects in controlled, finite-resource situations.
for(const need of ['kitchen','depot','op']){
 await page.evaluate(need=>{document.getElementById('result').close();document.getElementById('mapselect').value='forest';document.getElementById('gametype').value='conquest';setup();running=false;units=[];buildings=[];fieldTrenches=[];decor=[];shells=[];time=120;supplies=[1600,1600];aiEnabled=[true,false];PXSAP.reset();IronFrontEngineering.reset(123);IronFrontBrain.operations.reset();IronFrontBrain.setRoles(['attack','defend']);
  for(let i=0;i<24;i++){const u=newUnit('rifle',0,750+(i%4)*6,1000+Math.floor(i/4)*5);u.cls=undefined;u.gren=need==='depot'?0:2;u.cohesion=need==='kitchen'?.4:1;u.manualUntil=time+180;u.order='hold';u.tx=u.x;u.ty=u.y}
  for(let i=0;i<6;i++){const u=newUnit('sapper',0,660+i*7,1000);u.cls=undefined}
  if(need==='depot'||need==='op'){fieldTrenches.push({id:'probe-cover',team:0,type:'trench',hp:Infinity,x:750,y:1000,hw:100,hh:100});indexTerrainCover()}
  if(need==='op'){runCommander(0);IronFrontBrain.lastPlans[0].operation.sector=2;IronFrontBrain.lastPlans[0].operation.phase='recon'}
 const choose=window.probeOriginalChoose||IronFrontEngineering.choose;window.probeOriginalChoose=choose;window.probeDecisions=[];IronFrontEngineering.choose=c=>{const it=choose(c);if(it&&probeDecisions.length<10)probeDecisions.push({time:c.time,stress:c.own.filter(u=>!u.sap&&u.cohesion<.65).length,phase:c.plan?.operation?.phase,chosen:it?.kind,service:c.serviceDemand,cash:c.cash});return it};
 },need);
 let result;
 for(let batch=0;batch<4;batch++){
  result=await page.evaluate(need=>{for(let i=0;i<150;i++){update(.1);const p=PXSAP.projects.find(p=>p.team===0&&p.kind===need&&p.segs.every(s=>s.stage>=p.target));if(p)break}hud();render();return {need,cash:supplies[0],projects:PXSAP.projects.filter(p=>p.team===0).map(p=>({kind:p.kind,complete:p.segs.every(s=>s.stage>=p.target),crew:p.crew.length})),native:need==='kitchen'?PXLOGI.kitchens().filter(p=>p.team===0&&p.hp>0).length:need==='depot'?PXWORKS.depots().filter(p=>p.team===0&&p.hp>0).length:PXWORKS.ops().filter(p=>p.team===0&&p.hp>0).length,decisions:probeDecisions,errors:[PXSAP.stats.errors,PXFORT.stats.errors,PXLOGI.stats.errors,PXWORKS.stats.errors]}},need);
  if(result.native)break;
 }
 assert.ok(result.native>0,JSON.stringify(result));assert.ok(result.cash>=0);assert.ok(result.errors.every(n=>n===0));
 if(need==='kitchen')result.effect=await page.evaluate(()=>{const post=PXLOGI.kitchens().find(p=>p.team===0),u=units.find(u=>u.team===0&&!u.sap);u.x=post.x;u.y=post.y;u.cohesion=.4;u.suppression=1;PXLOGI.kitchenTick(2);return {cohesion:u.cohesion,suppression:u.suppression}});
 if(need==='depot')result.effect=await page.evaluate(()=>{const post=PXWORKS.depots().find(p=>p.team===0),u=units.find(u=>u.team===0&&!u.sap);u.x=post.x;u.y=post.y;u.tx=post.x;u.ty=post.y;u.gren=0;u.ammo=0;u.manualUntil=time+10;u.order='hold';aiEnabled=[false,false];for(let i=0;i<55;i++)update(.1);return {gren:u.gren,ammo:u.ammo}});
 if(need==='kitchen')assert.ok(result.effect.cohesion>.4&&result.effect.suppression<1);
 if(need==='depot')assert.ok(result.effect.gren>0&&result.effect.ammo>0);
 report.probes.push(result);console.log(JSON.stringify({need,native:result.native,cash:result.cash,effect:result.effect}));
}
await page.evaluate(()=>{cam.x=700;cam.y=1000;hud();render();minimap()});await page.screenshot({path:path.join(out,'ai-mechanics-in-game.png')});
report.obsolete=await page.evaluate(()=>{document.getElementById('mapselect').value='forest';setup();running=false;units=[];buildings=[];fieldTrenches=[];decor=[];time=121;PXFL.on=false;PXAIR.on=false;PXAS.on=false;PXLOGI.on=false;supplies=[1000,1000];aiEnabled=[true,false];maxUnits=3;for(let i=0;i<3;i++){const u=newUnit('rifle',0,750,1000);u.cls=undefined;u.manualUntil=time+20}
 const make=progress=>{const pts=[[250,1700]],p=PXSAP.project(0,'dugout','fort',pts,{keep:true});p.t0=0;p.item={kind:'dugout',pts};supplies[0]-=PXSAP.cfg.KIND.dugout.cost;p.segs[0].work=progress;return p};
 const untouched=make(0),partial=make(5),before=supplies[0],cost=PXSAP.cfg.KIND.dugout.cost;update(.1);const after=supplies[0];update(.1);return {before,after,cost,afterAgain:supplies[0],untouchedCancelled:untouched.done,partialPreserved:!partial.done&&partial.segs[0].work===5}});
assert.ok(report.obsolete.untouchedCancelled&&report.obsolete.partialPreserved);assert.equal(report.obsolete.after,report.obsolete.before+report.obsolete.cost);assert.equal(report.obsolete.afterAgain,report.obsolete.after);
assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'ai-mechanics-report.json'),JSON.stringify(report,null,2));console.log('AI mechanics: three finite-resource battles and completed native kitchen, depot and observation post verified');
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
