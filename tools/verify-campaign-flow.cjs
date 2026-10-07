/* Fluxo real de campanha/história (menu → operação → fim): confirma o resultado, o texto de colapso e o progresso salvo com o victory.js.
   node tools/verify-campaign-flow.cjs [campaign|story] — joga 20 s, destrói o QG inimigo e confere diálogo de resultado e localStorage. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root='C:/Users/ryan/Desktop/iron-front-codigo-fonte/dist';
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.setHeader('Cache-Control','no-store');res.end(d)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))errors.push(m.text())});
 const mode=process.argv[2]||'campaign';
 await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0`);
 await page.locator(`[data-go="${mode}"]`).click();await page.waitForTimeout(400);
 await page.locator(mode==='campaign'?'#op-go':'#brief-go').click();await page.waitForTimeout(800);
 const info=await page.evaluate(()=>({sandbox,run:document.body.dataset.run,ai:aiEnabled,units:units.length,scale:maxUnits,player:playerTeam,mode}));
 console.log('inicio',JSON.stringify(info));
 // acelera a partida (sem usar o laço em tempo real)
 const r=await page.evaluate(()=>{running=false;PXFORT.endPrep?.();const o={t:[]};for(let i=0;i<10*20&&!ended;i++){update(.1);if(i%2000===0)o.t.push([Math.round(time),IronFront.victory.state().superiority.join('/'),IronFront.victory.state().crisis.join('/')])}
  o.ended=ended;o.time=Math.round(time);o.result=IronFront.victory.state().result;o.dialog=document.getElementById('result').open;return o});
 console.log('apos 20 s:',JSON.stringify(r));
 // força a vitória do jogador: destrói o QG inimigo e deixa a contagem correr
 const w=await page.evaluate(()=>{if(ended)return null;const e=PXSTRUCT.list.find(x=>x.team!==playerTeam&&x.kind==='hq');explode(e.x,e.y,60,9000,playerTeam);for(let i=0;i<10*60&&!ended;i++)update(.1);return {ended,dialog:document.getElementById('result').open,title:document.getElementById('resulttitle').textContent,text:document.getElementById('resulttext').textContent,note:document.getElementById('resultnote').textContent,save:localStorage.length?Object.fromEntries(Object.entries(localStorage).filter(([k])=>/save|iron|campaign|story/i.test(k)).map(([k,v])=>[k,v.slice(0,200)])):null}});
 console.log('vitoria forcada:',JSON.stringify(w));
 console.log('erros',errors.length?errors.slice(0,5):'nenhum');await browser.close();server.close()})().catch(e=>{console.error(e);process.exit(1)});
