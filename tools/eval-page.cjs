/* Abre o jogo (Edge headless), faz setup de uma partida IA×IA e executa um script JS na página. Uso:
   node tools/eval-page.cjs --code arquivo.js [--map trenches] [--query "preparo=0"] [--ai both|none] [--shot saida.png] [--game sandbox|conquest]
   O script tem acesso ao jogo e deve devolver (return) um valor JSON-serializável. Erros da página são impressos. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(process.argv.includes('--root')?process.argv[process.argv.indexOf('--root')+1]:path.join(__dirname,'../dist'));
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d};
const code=fs.readFileSync(path.resolve(arg('code')),'utf8'),map=arg('map','trenches'),query=arg('query','preparo=0'),ai=arg('ai','both'),shot=arg('shot',''),game=arg('game','sandbox'),seed=+arg('seed','7'),scale=arg('scale','80'),vp=arg('viewport','1360x900').split('x').map(Number),keepPrep=arg('keepprep','')==='1';
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.setHeader('Cache-Control','no-store');res.end(d)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:vp[0],height:vp[1]}}),errors=[];
 page.on('pageerror',e=>errors.push('pageerror: '+String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type())&&!/net::ERR|fonts.googleapis/.test(m.text()))errors.push(m.type()+': '+m.text())});
 await page.addInitScript(s=>{let a=s>>>0;Math.random=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}},seed);
 await page.goto(`http://127.0.0.1:${server.address().port}/?${query}`);
 await page.locator('[data-go="sandbox"]').click();await page.locator('#start').click();
 await page.evaluate(({map,ai,game,scale,keepPrep})=>{document.getElementById('mapselect').value=map;document.getElementById('gametype').value=game;document.getElementById('scale').value=scale;
  document.getElementById('blueai').value=ai==='both'?'on':'off';document.getElementById('redai').value=ai==='none'?'off':'on';setup();if(!keepPrep)PXFORT.endPrep?.()},{map,ai,game,scale,keepPrep});
 let result;try{result=await page.evaluate(`(async()=>{${code}})()`)}catch(e){result={evalError:String(e)}}
 if(shot){await page.screenshot({path:path.resolve(shot)})}
 console.log(JSON.stringify({result,errors:errors.slice(0,25)},null,1));
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
