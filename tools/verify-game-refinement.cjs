const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tests/artifacts');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(d)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),report={errors:[],battles:[]};
try{
 const page=await browser.newPage({viewport:{width:1360,height:900}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))report.errors.push(m.text())});
 await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0`);await page.locator('[data-go="sandbox"]').click();await page.locator('#start').click();
 if(process.argv.includes('--ui-only'))report.battles=JSON.parse(fs.readFileSync(path.join(out,'game-refinement-report.json'),'utf8')).battles;
 report.search=await page.evaluate(()=>{
  const policy=IronFrontRefinement.shouldSearch,select=IronFrontBrain.selectTarget,results=[];
  for(const cached of [false,true]){
   setup();running=false;aiEnabled=[false,false];units=[];PXW.setKind('clear');
   for(let t=0;t<2;t++)for(let i=0;i<120;i++){const u=newUnit('rifle',t,t?2100:300,100+i*14);u.cls=undefined;u.sap=0;u.order='hold';u.tx=u.x;u.ty=u.y}
   let searches=0;IronFrontBrain.selectTarget=function(...args){searches++;return select.apply(this,args)};
   IronFrontRefinement.shouldSearch=cached?policy:(u,t,r)=>!u.target||u.target.hp<=0||Math.hypot(u.x-u.target.x,u.y-u.target.y)>r||u.aimCheckAt<=t;
   const timings=[];for(let i=0;i<120;i++){const start=performance.now();update(1/60);timings.push(performance.now()-start)}timings.sort((a,b)=>a-b);results.push({cached,searches,median:timings[60],p95:timings[114]});
  }
  IronFrontRefinement.shouldSearch=policy;IronFrontBrain.selectTarget=select;return results;
 });assert.ok(report.search[1].searches<report.search[0].searches*.1,JSON.stringify(report.search));console.log(JSON.stringify({search:report.search}));
 report.controls=await page.evaluate(()=>{
  setup();running=false;aiEnabled=[false,false];units=[];time=10;selected.clear();
  const a=newUnit('rifle',0,700,1000),sap=newUnit('sapper',0,600,1000),medic=newUnit('rifle',0,600,1100),wound=newUnit('rifle',0,750,1000),rescue=newUnit('rifle',0,800,1000);
  a.cls=undefined;sap.sap=1;medic.cls='medic';wound.down=true;rescue.rs={};for(const u of units){u.manualUntil=0;u.tx=u.x;u.ty=u.y;u.order='hold'}
  order('move',900,1000);const preserved=[sap,medic,wound,rescue].every(u=>u.manualUntil===0&&u.order==='hold'),combatMoved=a.order==='move';
  selected.add(sap.id);order('move',750,1100);const selectedEngineer=sap.manualUntil>time;
  selected.clear();formation('line');const servicesPreserved=medic.manualUntil===0&&wound.manualUntil===0&&rescue.manualUntil===0;
  points[0].progress=-40;hud();const button=document.querySelector('#objectives button'),capture={label:button.getAttribute('aria-label'),width:button.lastChild.style.width,contested:button.classList.contains('contested')};button.focus();hud();const keptFocus=document.activeElement===button;button.click();const focusedBase=Math.abs(cam.x-points[0].x)<1&&Math.abs(cam.y-points[0].y)<1;
  const markup=document.getElementById('toast').textContent;return {preserved,combatMoved,selectedEngineer,servicesPreserved,capture,keptFocus,focusedBase,markup};
 });assert.ok(report.controls.preserved&&report.controls.combatMoved&&report.controls.selectedEngineer&&report.controls.servicesPreserved);assert.ok(report.controls.keptFocus&&report.controls.focusedBase);assert.equal(report.controls.capture.width,'30%');assert.ok(report.controls.capture.contested);
 report.visibility=await page.evaluate(()=>{
  setup();running=false;aiEnabled=[false,false];units=[];decor=[];buildings=[];fieldTrenches=[];indexTerrainCover();const own=newUnit('rifle',0,260,1000),enemy=newUnit('rifle',1,2140,1000);for(const u of [own,enemy]){u.cls=undefined;u.order='hold';u.tx=u.x;u.ty=u.y}PXW.setKind('clear');for(let i=0;i<12;i++)update(.05);PXW.fow.on=true;PXW.fow.team=playerTeam;PXW.fow.grid.fill(0);
  const draw=mini.fillRect,paint=[];mini.fillRect=function(x,y,w,h){paint.push({x,y,w,h,color:this.fillStyle});return draw.call(this,x,y,w,h)};minimap();mini.fillRect=draw;
  const result={visible:PXW.visible(enemy),leaked:paint.some(p=>['#d18a76','#e08a72'].includes(p.color)&&Math.abs(p.x-enemy.x/W*mini.canvas.width)<1&&Math.abs(p.y-enemy.y/H*mini.canvas.height)<1)};PXW.fow.on=false;return result;
 });assert.ok(!report.visibility.visible&&!report.visibility.leaked);
 report.cards=await page.evaluate(()=>{
  PXW.setKind('clear');sandbox=false;supplies[0]=0;tab='units';makeCards();hud();const money=[...document.querySelectorAll('#cards .card')].map(b=>({kind:b.dataset.kind,reason:b.dataset.unavailableReason}));supplies[0]=2000;maxUnits=units.filter(u=>u.team===0&&u.hp>0).length;hud();const full=document.querySelector('[data-kind="rifle"]').dataset.unavailableReason;
  tab='support';makeCards();PXW.setKind('storm');PXW.state.I=1;hud();const air=document.querySelector('[data-kind="cap"]').dataset.unavailableReason;PXW.setKind('clear');tab='build';makeCards();hud();const build=[...document.querySelectorAll('#cards .card')].every(b=>b.dataset.kind&&Number.isFinite(+b.dataset.cost));return {money,full,air,build};
 });assert.ok(report.cards.money.every(c=>c.kind&&/suprimentos/.test(c.reason)));assert.ok(/grupo inteiro/.test(report.cards.full));assert.ok(/Clima/.test(report.cards.air));assert.ok(report.cards.build);
 report.captureFinish=[];
 for(const team of [0,1]){
  const finish=await page.evaluate(team=>{
   document.getElementById('result').close();document.getElementById('mapselect').value='trenches';document.getElementById('gametype').value='conquest';document.getElementById('scale').value='120';document.getElementById('playerside').value=String(team);setup();running=false;aiEnabled=[team===0,team===1];supplies=[0,0];units=[];buildings=[];decor=[];fieldTrenches=[];shells=[];bullets=[];indexTerrainCover();PXW.setKind('clear');PXW.setRain(0);IronFrontBrain.operations.reset();IronFrontBrain.setRoles(team?['defend','attack']:['attack','defend']);
   const d=team?-1:1;for(const [x,y,n] of [[team?1650:750,180,24],[points[team].x,1000,8],[team?1800:600,900,8]])for(let i=0;i<n;i++){const u=newUnit('rifle',team,x+i%4*4,y+Math.floor(i/8)*65);u.cls=undefined;u.sap=0;u.gren=2;u.manualUntil=0}
   for(const t of [0,5,6,12]){time=t;runCommander(team)}const plan=IronFrontBrain.lastPlans[team],ids=new Set(plan.orders.filter(o=>o.role==='avanço-alternado').map(o=>o.id)),target=points[1-team];
   for(const u of units)if(ids.has(u.id)){u.x=target.x-d*350;u.y=200;if(u.pv){u.pv.vx=0;u.pv.vy=0;u.pv.path=null}}
   const phases=[];for(let i=0;i<2800&&!ended;i++){update(.05);if(i%100===0)phases.push({time,phase:IronFrontBrain.lastPlans[team]?.operation.phase,nearest:Math.min(...units.filter(u=>u.team===team&&ids.has(u.id)).map(u=>Math.hypot(u.x-target.x,u.y-target.y)))})}
   return {team,ended,winner:IronFront.victory.state().result?.winner??IronFrontBases.winner(points),progress:target.progress,participants:ids.size,phases};
  },team);report.captureFinish.push(finish);assert.ok(finish.participants>=8);assert.ok(finish.ended&&finish.winner===team,JSON.stringify(finish));console.log(JSON.stringify({captureFinish:finish}));
 }
 // Three complete matches, keeping all systems active and finite resources.
 for(const map of process.argv.includes('--ui-only')?[]:['trenches']){
  await page.evaluate(map=>{let seed=619;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};document.getElementById('result').close();document.getElementById('mapselect').value=map;document.getElementById('gametype').value='conquest';document.getElementById('scale').value='120';document.getElementById('blueai').value='on';document.getElementById('redai').value='on';setup();running=false;PXW.setKind('clear');window.refineTiming=[];window.refineSamples=[]},map);
  for(let batch=0;batch<6;batch++){
   const snap=await page.evaluate(()=>{for(let i=0;i<600&&!ended;i++){const start=performance.now();update(.05);refineTiming.push(performance.now()-start)}hud();render();minimap();const snapshot={time:Math.round(time),alive:[0,1].map(t=>units.filter(u=>u.team===t&&u.hp>0&&!u.down).length),kills:[...teamKills],cash:[...supplies],points:points.map(p=>({name:p.name,owner:p.owner,progress:p.progress})),phase:IronFrontBrain.lastPlans.map(p=>p?.operation?.phase)};refineSamples.push(snapshot);return snapshot});console.log(JSON.stringify({map,...snap}));
  }
  const result=await page.evaluate(()=>{refineTiming.sort((a,b)=>a-b);return {samples:refineSamples,updateMedian:refineTiming[Math.floor(refineTiming.length*.5)],updateP95:refineTiming[Math.floor(refineTiming.length*.95)],invalid:units.filter(u=>!Number.isFinite(u.x)||!Number.isFinite(u.y)).length,airErrors:PXAW.stats.errors,constructionErrors:PXSAP.stats.errors,plans:IronFrontBrain.lastPlans.map(p=>({operation:p?.operation,strategy:p?.strategy})),ended}});result.map=map;report.battles.push(result);assert.equal(result.invalid,0);assert.equal(result.airErrors,0);assert.equal(result.constructionErrors,0);assert.ok(result.samples.every(s=>s.cash.every(n=>Number.isFinite(n)&&n>=0)));fs.writeFileSync(path.join(out,'game-refinement-report.json'),JSON.stringify(report,null,2));
 }
 await page.evaluate(()=>{document.getElementById('result').close();document.getElementById('mapselect').value='trenches';document.getElementById('gametype').value='conquest';document.getElementById('scale').value='120';document.getElementById('playerside').value='0';document.getElementById('blueai').value='on';document.getElementById('redai').value='on';setup();running=false;PXW.setKind('clear');for(let i=0;i<600;i++)update(.05);supplies[0]=1000;IronFrontAirCommand.request(0,'rec',1300,1000,{manual:true,reason:'Reconheçam o acesso lateral para a infantaria'});cam.x=1100;cam.y=1000;tab='units';makeCards();hud();render();minimap()});await page.screenshot({path:path.join(out,'game-refinement-in-game.png')});
 // Verify a soldier chapter gives allies a commander and keyboard navigation stays usable.
 await page.reload();await page.evaluate(()=>IFUI.go('story'));await page.locator('#brief-go').click();report.story=await page.evaluate(()=>({mode,ai:[...aiEnabled],cap:maxUnits}));assert.equal(report.story.mode,'soldier');assert.deepEqual(report.story.ai,[true,true]);
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'game-refinement-report.json'),JSON.stringify(report,null,2));console.log('General refinement: commands, focus, capture, visibility, cards, search budget, three finite-resource matches and soldier chapter verified');
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
