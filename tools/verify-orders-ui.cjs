/* Verifica, com mouse real (Playwright), as ordens de intenção: selecionar tropas arrastando e dar clique direito em
   estrutura inimiga, trincheira, bandeira inimiga, terreno e obra aliada danificada (engenheiros). Salva capturas em tests/artifacts/.
   node tools/verify-orders-ui.cjs */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tests/artifacts');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.setHeader('Cache-Control','no-store');res.end(d)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[],report={steps:[]};
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))errors.push(m.text())});
 await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0`);await page.locator('[data-go="sandbox"]').click();await page.locator('#start').click();
 await page.evaluate(()=>{document.getElementById('blueai').value='off';document.getElementById('redai').value='off';setup();PXFORT.endPrep?.();PXWIN.on=false;units=[];
  window.__client=(wx,wy)=>{const r=document.getElementById('game').getBoundingClientRect();return {x:r.left+((wx-cam.x)*cam.z+vw/2)*r.width/vw,y:r.top+((wy-cam.y)*cam.z+vh/2)*r.height/vh}};
  window.__mk=(t,type,x,y)=>{const u=newUnit(type,t,x,y);u.cls=undefined;u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=0;return u};});
 /* o renderizador pixel usa o próprio zoom/offset: calibra a projeção movendo o mouse e lendo mouse.wx/wy */
 let cal=null;
 async function calibrate(){const p0=[560,360],p1=[860,520];let a,b;for(let k=0;k<4;k++){await page.mouse.move(p0[0]+k*3,p0[1]);await page.waitForTimeout(80);a=await page.evaluate(()=>[mouse.wx,mouse.wy]);await page.mouse.move(p1[0]+k*3,p1[1],{steps:4});await page.waitForTimeout(80);b=await page.evaluate(()=>[mouse.wx,mouse.wy]);if(b[0]!==a[0])break}
  cal={p0,a,sx:(b[0]-a[0])/(p1[0]-p0[0]),sy:(b[1]-a[1])/(p1[1]-p0[1])};if(!isFinite(1/cal.sx)||!isFinite(1/cal.sy)||!cal.sx||!cal.sy)throw new Error('calibração falhou '+JSON.stringify({a,b,el:await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.id||e.className||e.tagName)},p1)}))}
 const client=async(x,y)=>{await calibrate();return {x:cal.p0[0]+(x-cal.a[0])/cal.sx,y:cal.p0[1]+(y-cal.a[1])/cal.sy}};
 async function dragSelect(x0,y0,x1,y1){const a=await client(x0,y0),b=await client(x1,y1);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});await page.mouse.up();await page.waitForTimeout(80)}
 async function rclick(wx,wy){const c=await client(wx,wy);await page.mouse.move(c.x,c.y);await page.mouse.click(c.x,c.y,{button:'right'});await page.waitForTimeout(120)}
 const step=async(name,fn)=>{const r=await fn();report.steps.push({name,...r});console.log(name,JSON.stringify(r));return r};

 // 1) assalto a estrutura inimiga (posto médico)
 await step('assault',async()=>{
  await page.evaluate(()=>{cam.x=1950;cam.y=800;cam.z=.9;mode='commander';const med=PXSTRUCT.list.find(e=>e.team===1&&e.kind==='medpost');window.__med=med;
   for(let i=0;i<10;i++)__mk(0,'rifle',1700+(i%5)*16,800+Math.floor(i/5)*16)});
  await dragSelect(1680,780,1800,850);
  const sel=await page.evaluate(()=>selected.size);
    const med=await page.evaluate(()=>({x:__med.x,y:__med.y}));await rclick(med.x,med.y);
  await page.evaluate(()=>{for(let i=0;i<30;i++)update(.1)});
  const g=await page.evaluate(()=>PXORD.state().groups);
  assert.equal(sel,10,'seleção por arrasto');assert.equal(g.length,1);assert.equal(g[0].kind,'assault');assert.ok(/posto médico/i.test(g[0].mission));
  await page.evaluate(()=>{for(let i=0;i<30*20&&!__med.destroyed;i++)update(.1);hud()});
  await page.screenshot({path:path.join(out,'orders-assault.png')});
  return {selected:sel,group:g[0],destroyed:await page.evaluate(()=>__med.destroyed)}});

 // 2) ocupar trincheira
 await step('occupy',async()=>{
  const info=await page.evaluate(()=>{units=units.filter(u=>false);PXORD.groups().forEach(g=>PXORD.end(g));for(let i=0;i<3;i++)fieldTrenches.push({id:'tt'+i,type:'trench',team:0,x:1000+i*50,y:900,hp:Infinity,hw:28,hh:10,ax:1,ay:0,slots:2,len:56});indexTerrainCover();const tr=fieldTrenches.find(a=>a.id==='tt1');cam.x=tr.x+150;cam.y=tr.y;cam.z=1;
   for(let i=0;i<8;i++)__mk(0,'rifle',tr.x+160+(i%4)*14,tr.y+120+Math.floor(i/4)*14);window.__tr=tr;hud();return {x:tr.x,y:tr.y}});
  await dragSelect(info.x+130,info.y+100,info.x+250,info.y+170);
  await rclick(info.x,info.y);
  await page.evaluate(()=>{for(let i=0;i<30*14;i++)update(.1);hud()});
  const r=await page.evaluate(()=>{const g=PXORD.state().groups[0];const us=units.filter(u=>u.team===0);const slots=us.filter(u=>u.slot&&Math.hypot(u.x-u.slot.x,u.y-u.slot.y)<8).length;return {group:g,seated:slots,total:us.length,panel:document.getElementById('intentPanel').innerText}});
  assert.equal(r.group.kind,'occupy');assert.ok(r.seated>=6,'a maioria ocupa os segmentos: '+r.seated);
  await page.screenshot({path:path.join(out,'orders-occupy.png')});return r});

 // 3) região do terreno rumo ao inimigo -> avanço cuidadoso
 await step('advance',async()=>{
  await page.evaluate(()=>{units=units.filter(u=>false);PXORD.groups().forEach(g=>PXORD.end(g));cam.x=1100;cam.y=900;cam.z=.8;for(let i=0;i<8;i++)__mk(0,'rifle',980+(i%4)*16,900+Math.floor(i/4)*16);hud()});
  await dragSelect(960,880,1050,950);await rclick(1260,900);
  const seen=await page.evaluate(()=>{const st=new Set();let last=null;for(let i=0;i<30*25;i++){update(.1);const g=PXORD.state().groups[0];if(g){st.add(g.state);last=g}}return {states:[...st],last,left:PXORD.state().groups.length}});
  const g=seen.last;assert.equal(g.kind,'advance');assert.ok(seen.states.includes('arrived')&&seen.left===0,'chegou e o grupo se desfez: '+JSON.stringify(seen.states));return {group:g,cx:await page.evaluate(()=>Math.round(units.filter(u=>u.team===0).reduce((n,u)=>n+u.x,0)/units.length))}});

 // 4) engenheiros consertam estrutura aliada danificada
 await step('repair',async()=>{
  const info=await page.evaluate(()=>{units=units.filter(u=>false);PXORD.groups().forEach(g=>PXORD.end(g));const c=PXSTRUCT.list.find(e=>e.team===0&&e.kind==='comms');c.ref.hp=c.max*.4;for(let i=0;i<3;i++)update(.1);cam.x=c.x+60;cam.y=c.y;cam.z=1.2;
   for(let i=0;i<3;i++){const u=newUnit('sapper',0,c.x+90+i*12,c.y+40);u.manualUntil=0}hud();return {x:c.x,y:c.y,hp:c.hp}});
  await dragSelect(info.x+70,info.y+20,info.x+140,info.y+80);
  const sel=await page.evaluate(()=>selected.size);await rclick(info.x,info.y);
  await page.evaluate(()=>{for(let i=0;i<30*25;i++)update(.1)});
  const hp=await page.evaluate(()=>{const c=PXSTRUCT.list.find(e=>e.team===0&&e.kind==='comms');return Math.round(c.hp)});
  assert.ok(hp>info.hp+100,'conserto: '+hp);return {selected:sel,before:info.hp,after:hp}});

 // 5) sem seleção, o clique direito continua sendo o deslocamento do jogo
 await step('legacy',async()=>{
  await page.evaluate(()=>{units=units.filter(u=>false);PXORD.groups().forEach(g=>PXORD.end(g));selected.clear();__mk(0,'rifle',1000,1000);cam.x=1000;cam.y=1000;cam.z=1});
  await rclick(1100,1000);const r=await page.evaluate(()=>({order:units[0].order,groups:PXORD.state().groups.length}));assert.equal(r.groups,0);return r});
 report.errors=errors;fs.writeFileSync(path.join(out,'orders-ui-report.json'),JSON.stringify(report,null,1));
 console.log('errors',errors.length?errors:'nenhum');await browser.close();server.close();process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
