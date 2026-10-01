/* QA de captura de posição (roteiro de QA do passe 1.9).
   Roda uma batalha IA×IA e registra QUANDO cada posição (pontos A/B/C do jogo e setores de trincheira do assault.js)
   muda de dono. Uso: PW=<caminho do playwright> node tools/qa-capture.cjs [segundos=900] [query=preparo=60] [rodadas=1]
   Saída: uma linha JSON por rodada e um resumo. Falha (exit 1) se nenhuma posição mudou de mãos em nenhuma rodada. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PW||'playwright');
const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
 if(!t.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(t,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');res.end(d)})});
const total=+process.argv[2]||900,query=process.argv[3]||'preparo=60',rounds=+process.argv[4]||1;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
 for(let round=0;round<rounds;round++){
  const page=await browser.newPage({viewport:{width:1360,height:900}}),errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/?${query}`,{waitUntil:'load'});
  await page.locator('[data-go="sandbox"]').click();
  await page.locator('.sbgroup').filter({has:page.locator('#blueai')}).locator('button[data-v="on"]').click();
  await page.locator('.sbgroup').filter({has:page.locator('#rolesel')}).locator('button[data-v="a0"]').click();await page.locator('#start').click();
  await page.evaluate(()=>{running=false;window.__prev={p:points.map(p=>p.owner),s:[]};window.__flips=[]});
  for(let t=0;t<total;t+=10){
   await page.evaluate(()=>{for(let i=0;i<100;i++){update(.1);
    points.forEach((p,k)=>{if(p.owner!==__prev.p[k]){__flips.push({t:+time.toFixed(1),what:'ponto '+p.name,de:__prev.p[k],para:p.owner});__prev.p[k]=p.owner}});
    PXAS.sectors.forEach((s,k)=>{if(__prev.s[k]===undefined)__prev.s[k]=s.holder;if(s.holder!==__prev.s[k]){__flips.push({t:+time.toFixed(1),what:'setor '+s.name+(s.team?'(DE)':'(EUA)'),de:__prev.s[k],para:s.holder});__prev.s[k]=s.holder}})}});}
  const r=await page.evaluate(()=>({time:+time.toFixed(0),flips:__flips,tickets:tickets.map(Math.round)}));r.errors=errs.slice(0,3);results.push(r);console.log(JSON.stringify(r));await page.close();}
 await browser.close();server.close();
 const any=results.filter(r=>r.flips.length).length;console.log(`rodadas com troca de posição: ${any}/${results.length}`);
 process.exitCode=any?0:1;})().catch(e=>{console.error(e);server.close();process.exit(1)});
