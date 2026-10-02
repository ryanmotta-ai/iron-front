const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tests/artifacts');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(d)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),report=process.argv.includes('--preview-only')?JSON.parse(fs.readFileSync(path.join(out,'construction-layouts-report.json'),'utf8')):{layouts:[],maps:[],errors:[]};
try{const page=await browser.newPage({viewport:{width:1360,height:900}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))report.errors.push(m.text())});
 await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=300`);await page.locator('[data-go="sandbox"]').click();await page.locator('#start').click();await page.evaluate(()=>{running=false});
 const ids=await page.evaluate(()=>IronFrontLayouts.layouts.map(p=>p.id));
 for(const id of (process.argv.includes('--preview-only')?[]:ids)){const result=await page.evaluate(id=>{
  document.getElementById('mapselect').value='trenches';document.getElementById('gametype').value='conquest';document.getElementById('scale').value='160';document.getElementById('blueai').value='on';document.getElementById('redai').value='on';setup();running=false;
  let seed=0;while(IronFrontLayouts.select((seed^Math.imul(1,2654435761))>>>0).id!==id)seed++;
  IronFrontEngineering.reset(seed);PXFORT.startPrep();const initial=PXFORT.plan(0),selected=IronFrontEngineering.state(0).layout;
  for(let i=0;i<700;i++)update(.1);hud();render();minimap();
  const projects=PXSAP.projects.filter(p=>p.team===0&&p.src==='fort'),completed=projects.filter(p=>p.segs.every(s=>s.stage>=p.target));
  return {id,selected,stable:IronFrontEngineering.state(0).layout.id===id,blueprint:initial.map(it=>({kind:it.kind,pts:it.pts,line:it.line})),projects:projects.length,completed:completed.length,south:projects.filter(p=>p.segs.some(s=>s.y>1600)).length,supplies:[...supplies],errors:[PXFORT.stats.errors,PXSAP.stats.errors,PHYS.stats.errors]};
 },id);
 assert.equal(result.selected.id,id);assert.ok(result.stable);assert.ok(result.projects>0);assert.ok(result.completed>0);assert.ok(result.south>0);assert.ok(result.supplies.every(v=>v>=0));assert.ok(result.errors.every(v=>v===0));report.layouts.push(result);console.log(JSON.stringify({id,projects:result.projects,completed:result.completed,south:result.south}));
 }
 if(!process.argv.includes('--preview-only')){await page.evaluate(()=>{cam.x=730;cam.y=1000;render()});await page.screenshot({path:path.join(out,'construction-in-game.png')});}
 for(const map of (process.argv.includes('--preview-only')?[]:['forest','winter'])){
  const result=await page.evaluate(map=>{document.getElementById('mapselect').value=map;document.getElementById('gametype').value='sandbox';setup();running=false;IronFrontBrain.setRoles(['attack','defend']);
   for(let i=0;i<900;i++)update(.1);hud();render();return {map,layouts:PXFORT.state().layouts,spent:[0,1].map(t=>IronFrontEngineering.state(t)?.spent||0),projects:PXSAP.projects.length,errors:[PXFORT.stats.errors,PXSAP.stats.errors,PHYS.stats.errors]};},map);
  assert.ok(result.layouts.every(p=>p?.id));assert.ok(result.spent.some(n=>n>0));assert.ok(result.errors.every(n=>n===0));report.maps.push(result);console.log(JSON.stringify(result));
 }
 if(!process.argv.includes('--preview-only'))report.reset=await page.evaluate(()=>{const before=IronFrontEngineering.state(0).layout;IronFrontEngineering.reset();return {before,cleared:IronFrontEngineering.state(0)===null}});assert.ok(report.reset.cleared);
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'construction-layouts-report.json'),JSON.stringify(report,null,2));
 // A contact sheet of the exact playable preparation blueprints for comparison.
 const cards=report.layouts.map((p,index)=>{const x=(index%3)*420,y=Math.floor(index/3)*420;const colors={trench:'#d6b26b',wire:'#be7770',comm:'#839ea1',nest:'#c5d996',bunker:'#ddd0ad',dugout:'#a89dce',mortar:'#ce9e76',aa:'#aabcbc'};
  const lines=p.blueprint.map(it=>it.pts.length===1?`<circle cx="${80+(it.pts[0][0]-180)*.3}" cy="${48+it.pts[0][1]*.16}" r="3" fill="${colors[it.kind]||'#a8b3a2'}"/>`:`<polyline points="${it.pts.map(([x,y])=>`${80+(x-180)*.3},${48+y*.16}`).join(' ')}" fill="none" stroke="${colors[it.kind]||'#a8b3a2'}" stroke-width="2" stroke-linecap="round"/>`).join('');
  return `<g transform="translate(${x},${y})"><rect x="8" y="8" width="404" height="404" rx="12" fill="#202b26"/><text x="24" y="33" font-size="17" fill="#efe6c9">${p.selected.name}</text><path d="M300 48V368" stroke="#58715d" stroke-dasharray="4 5"/>${lines}<text x="24" y="390" font-size="13" fill="#b9c3b1">${p.completed} obras concluídas no cenário de teste</text></g>`;
 }).join('');
 const html=`<html><body style="margin:0;background:#121b16;font-family:Arial"><svg width="1260" height="900" xmlns="http://www.w3.org/2000/svg"><text x="24" y="32" fill="#f2e9cc" font-size="24">Seis layouts de construção da IA</text><text x="24" y="54" fill="#b9c3b1" font-size="14">Plantas reais · amarelo: trincheira · vermelho: arame · azul: comunicação · pontos: apoio</text><g transform="translate(0,68)">${cards}</g></svg></body></html>`;
 fs.writeFileSync(path.join(out,'construction-layouts.html'),html);
 await page.setContent(html);await page.setViewportSize({width:1260,height:920});await page.screenshot({path:path.join(out,'construction-layouts.png')});console.log('Construction layouts: all six blueprints built, two combat maps, budgets and reset passed');
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
