/* Run with NODE_PATH pointing to a Playwright installation. Serves only dist. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tests/artifacts');
const server=http.createServer((req,res)=>{
 const target=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');res.end(data)});
});
function jointScenario(){
 PXFORT.endPrep();sandbox=true;mode='commander';ended=false;units=[];buildings=[];fieldTrenches=[];decor=[];shells=[];points=[{name:'Passagem',x:930,y:480,owner:1}];time=200;
 IronFrontBrain.setRoles(['attack','defend']);IronFrontBrain.operations.reset();
 for(let i=0;i<8;i++){const u=newUnit('rifle',0,710+i,480);u.cls=undefined;u.rs=null;u.manualUntil=0}
 for(let i=0;i<3;i++)newUnit('mg',0,700+i,490);
 const wire=newBuilding('wire',1,820,480);PXSAP.reset();for(const u of units){u.sap=0;u.manualUntil=0}buildings=buildings.filter(b=>b!==wire);PXSAP.tick(.5);
 for(const t of [200,205,206,212]){time=t;runCommander(0)}
 const staged=IronFrontBrain.lastPlans[0].orders.some(o=>o.role==='preparar-brecha');time=220;runCommander(0);
 const plan=IronFrontBrain.lastPlans[0];hud();const passed={staged,nativeBreaches:PXSAP.breaches.length,phase:plan.operation.phase,missions:plan.coordination.missions.length,roles:plan.orders.map(o=>o.role),panel:document.getElementById('squadStatus').textContent};
 IronFrontHuman.joint=false;runCommander(0);passed.disabled=IronFrontBrain.lastPlans[0].coordination.missions.length===0;IronFrontHuman.joint=true;
 return passed;
}
function checkJoint(joint){console.log(JSON.stringify({joint}));assert.ok(joint.staged&&joint.nativeBreaches>0&&joint.missions>0&&joint.disabled);assert.ok(joint.roles.includes('assalto-brecha'));assert.ok(joint.roles.includes('apoio-solicitado'));assert.match(joint.panel,/Ações conjuntas/)}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  fs.mkdirSync(out,{recursive:true});
  const page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))errors.push(m.text())});
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url+'/?preparo=60',{waitUntil:'load'});
  await page.locator('[data-go="sandbox"]').click();
  await page.locator('.sbgroup').filter({has:page.locator('#blueai')}).locator('button[data-v="on"]').click();
  await page.locator('.sbgroup').filter({has:page.locator('#rolesel')}).locator('button[data-v="a0"]').click();await page.locator('#start').click();
  if(process.argv.includes('--joint-only')){await page.evaluate(()=>{running=false});const joint=await page.evaluate(jointScenario);checkJoint(joint);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'joint-report.json'),JSON.stringify({joint,errors},null,2));return}
  await page.screenshot({path:path.join(out,'preparation.png')});
  assert.equal(await page.locator('#game').isVisible(),true);
  await page.evaluate(()=>{running=false});
  const checkpoints=[];
  for(let batch=0;batch<12;batch++){
   const result=await page.evaluate(()=>{
    for(let i=0;i<300;i++)update(.1);hud();render();minimap();
    return {game:IronFront.state(),operations:[0,1].map(t=>IronFront.tactics.state(t)),engineering:[0,1].map(t=>IronFrontEngineering.state(t)),formations:[...new Set(units.map(u=>u.aiFormation).filter(Boolean))],stats:[PXAS.stats,PXSAP.stats,PXFL.stats,PHYS.stats],posted:units.filter(u=>u.post).length};
   });
   checkpoints.push(result);console.log(JSON.stringify({time:result.game.time,phases:result.operations.map(o=>o?.phase),sectors:result.operations.map(o=>o?.sector),roles:result.game.aiRoles,posted:result.posted}));
  }
  assert.ok(checkpoints.some(r=>r.operations[0]?.phase==='advance'),'atacante executa avanço');
  assert.ok(checkpoints.every(r=>!r.operations[1]||!['advance','prepare','recon'].includes(r.operations[1].phase)),'defensor respeita papel');
  assert.ok(checkpoints.at(-1).game.aiRoles[0]['reserva-movel']||checkpoints.at(-1).game.aiRoles[0]['reforço-defensivo']);
  assert.equal(checkpoints.at(-1).posted,0,'postos automáticos foram liberados para coordenação');
  assert.ok(checkpoints.some(r=>r.operations[0]?.learning.evaluated>0),'operações geram aprendizado durante a partida');
  assert.ok(checkpoints.some(r=>r.engineering.some(e=>e?.spent>0)),'engenharia continua construindo durante combate');
  assert.ok(checkpoints.some(r=>r.engineering.some(e=>e?.evaluated>0)),'obras geram avaliações');
  assert.ok(checkpoints.some(r=>r.formations.includes('wedge')),'tropas recebem formações');
  assert.ok(await page.locator('#aiLearning').textContent());
  const benchmark=await page.evaluate(()=>{
   const samples=[];for(let i=0;i<12;i++){const start=performance.now();runCommander(i%2);samples.push(performance.now()-start)}
   return {units:units.length,averageMs:samples.reduce((a,b)=>a+b,0)/samples.length,maxMs:Math.max(...samples)};
  });console.log(JSON.stringify({commander:benchmark}));
  await page.screenshot({path:path.join(out,'battle-tactics.png')});
  assert.ok(await page.locator('#tacticalStatus').innerText());
  await page.evaluate(()=>IronFront.tactics.toggle());await page.evaluate(()=>hud());assert.equal(await page.locator('#tacticalStatus').innerText(),'');
  await page.evaluate(()=>IronFront.tactics.toggle());
  // Other maps, mirrored roles, manual commands and restarting in the same page.
  for(const map of ['forest','winter']){
   const result=await page.evaluate(map=>{
    document.getElementById('mapselect').value=map;document.getElementById('rolesel').value='a1';setup();running=false;
    for(let i=0;i<1200;i++)update(.1);hud();render();minimap();
    const u=units.find(u=>u.team===1&&u.type==='rifle'&&!u.down&&!u.sap);u.manualUntil=time+25;u.tx=u.x;u.ty=u.y;
    runCommander(1);const respected=u.tx===u.x&&u.ty===u.y;
    return {map,state:IronFront.state(),roles:IronFrontBrain.getRoles(),manual:respected,operation:[0,1].map(t=>IronFront.tactics.state(t)?.phase)};
   },map);
   assert.equal(result.manual,true);assert.equal(result.roles.join(','),'defend,attack');
   console.log(JSON.stringify(result));
  }
  const economy=await page.evaluate(()=>{
   document.getElementById('mapselect').value='forest';document.getElementById('gametype').value='conquest';setup();running=false;
   let minCash=Infinity,maxActive=0;
   for(let i=0;i<1800;i++){update(.1);minCash=Math.min(minCash,...supplies);maxActive=Math.max(maxActive,PXSAP.projects.filter(p=>!p.done&&p.src==='fort').length)}
   return {sandbox,minCash,maxActive,cash:[...supplies],engineering:[0,1].map(t=>IronFrontEngineering.state(t))};
  });
  assert.equal(economy.sandbox,false);assert.ok(economy.minCash>=0);assert.ok(economy.maxActive<=8);assert.ok(economy.engineering.some(e=>e?.spent>0));
  console.log(JSON.stringify({economy}));
  const human=await page.evaluate(()=>{
   const p=IronFrontBrain.lastPlans[playerTeam];JSON.stringify(p);
   const groups=p.squadMind||[],reports=p.intelligence||[];
   const protectedUnit=units.find(u=>u.team===playerTeam&&u.hp>0&&!u.down&&!u.sap&&!u.sapJob&&!u.rs&&u.cls!=='medic');
   protectedUnit.manualUntil=0;protectedUnit.cls='medic';protectedUnit.tx=protectedUnit.x;protectedUnit.ty=protectedUnit.y;runCommander(playerTeam);
   const medical=protectedUnit.tx===protectedUnit.x&&protectedUnit.ty===protectedUnit.y;
   protectedUnit.cls=undefined;const savedMode=mode,savedPlayer=player;mode='soldier';player=protectedUnit;runCommander(playerTeam);
   const controlled=protectedUnit.tx===protectedUnit.x&&protectedUnit.ty===protectedUnit.y;mode=savedMode;player=savedPlayer;
   IronFrontHuman.on=false;runCommander(playerTeam);const switchWorks=IronFrontHuman.on===false;IronFrontHuman.on=true;
   setup();const reset=IronFrontBrain.lastPlans.every(p=>p===null);running=false;
   return {groups:groups.length,leaders:groups.filter(g=>g.leader!==null).length,morale:groups.every(g=>g.morale>=0&&g.morale<=1),reports:reports.length,medical,controlled,switchWorks,reset};
  });
  assert.ok(human.groups>0&&human.leaders>0&&human.morale&&human.medical&&human.controlled&&human.switchWorks&&human.reset);console.log(JSON.stringify({human}));
  const joint=await page.evaluate(jointScenario);checkJoint(joint);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'battle-report.json'),JSON.stringify({checkpoints,benchmark,economy,human,joint,errors},null,2));
  console.log('Browser: preparação, ataque/defesa, três mapas, papéis espelhados, ordens manuais e interface OK');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
