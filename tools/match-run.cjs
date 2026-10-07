/* Roda partidas completas IA×IA no navegador (Edge/Playwright) e mede: fim da partida, causa, superioridade e a maior "massa"
   de infantaria (unidades a < 110 px umas das outras). Uso:
     node tools/match-run.cjs [--maps trenches,forest,winter] [--scale 80] [--max 900] [--game sandbox|conquest] [--seed 7] [--query "vitoria=1"] [--out arquivo.json]
   Serve só dist/. NODE_PATH aponta para o Playwright do runtime do Codex. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../dist');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d};
const maps=arg('maps','trenches,forest,winter').split(','),scale=arg('scale','80'),maxT=+arg('max','900'),game=arg('game','sandbox'),seed=+arg('seed','7'),extra=arg('query',''),outFile=arg('out','');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.setHeader('Cache-Control','no-store');res.end(d)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}),report={args:{maps,scale,maxT,game,seed,extra},matches:[]};
 for(const map of maps){
  const page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))errors.push(m.text())});
  await page.addInitScript(s=>{let a=s>>>0;Math.random=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}},seed);
  await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0${extra?'&'+extra:''}`);
  await page.evaluate(({map,scale,game})=>{document.getElementById('mapselect').value=map;document.getElementById('gametype').value=game;document.getElementById('scale').value=scale;document.getElementById('blueai').value='on';document.getElementById('redai').value='on';setup();PXFORT.endPrep?.();
   window.__cluster=team=>{const us=units.filter(u=>u.team===team&&u.hp>0&&u.type==='rifle'&&!u.down&&!u.sap&&u.cls!=='medic'),seen=new Set(),R=110;let best=0;for(const s of us){if(seen.has(s.id))continue;let n=0;const q=[s];seen.add(s.id);while(q.length){const c=q.pop();n++;for(const o of us)if(!seen.has(o.id)&&Math.hypot(o.x-c.x,o.y-c.y)<R){seen.add(o.id);q.push(o)}}best=Math.max(best,n)}return best};
   window.__dens=team=>{const us=units.filter(u=>u.team===team&&u.hp>0&&u.type==='rifle'&&!u.down&&!u.sap&&u.cls!=='medic'&&!u.inBunk);let best=0;for(const a of us){let n=0;for(const b of us)if(Math.hypot(a.x-b.x,a.y-b.y)<110)n++;if(n>best)best=n}return best};window.__samples=[];window.__peak=[0,0];window.__dpeak=[0,0];window.__dsum=[0,0];window.__dn=0},{map,scale,game});
  const t0=Date.now();let done=null;
  while(!done){
   done=await page.evaluate(({maxT})=>{const stop=Math.min(maxT,time+30);while(time<stop&&!ended){update(.1)}
    const s=window.IronFront?.victory?.state?.()||{};const c=[__cluster(0),__cluster(1)];__peak[0]=Math.max(__peak[0],c[0]);__peak[1]=Math.max(__peak[1],c[1]);const dd=[__dens(0),__dens(1)];__dpeak[0]=Math.max(__dpeak[0],dd[0]);__dpeak[1]=Math.max(__dpeak[1],dd[1]);__dsum[0]+=dd[0];__dsum[1]+=dd[1];__dn++;
    __samples.push({t:Math.round(time),units:[0,1].map(t=>units.filter(u=>u.team===t).length),cluster:c,dens:dd,sup:s.superiority,crisis:s.crisis,bases:points.map(p=>p.owner)});
    return (ended||time>=maxT)?{ended,time,result:s.result||null,sup:s.superiority,peakCluster:__peak.slice(),peakDensity:__dpeak.slice(),meanDensity:__dsum.map(v=>+(v/__dn).toFixed(1)),samples:__samples,modules:{strategy:IronFront.strategy?.state?.().stats,structs:IronFront.structures?.state?.().destroyed,captured:IronFront.structures?.state?.().captured,orders:IronFront.orders?.state?.().stats,eng:IronFront.engineers?.state?.().stats,clean:IronFront.cleanup?.state?.().stats,bunk:IronFront.bunkers?.state?.().stats,air:IronFront.airbase?.state?.().stats,comms:IronFront.comms?.state?.().stats}}:null},{maxT});
   process.stdout.write(`\r${map}: sim ${Math.round((await page.evaluate(()=>time)))} s · real ${Math.round((Date.now()-t0)/1000)} s   `);
  }
  console.log();report.matches.push({map,...done,realSeconds:Math.round((Date.now()-t0)/1000),errors});
  const r=report.matches.at(-1);console.log(JSON.stringify({map,ended:r.ended,time:Math.round(r.time),result:r.result,peakCluster:r.peakCluster,peakDensity:r.peakDensity,meanDensity:r.meanDensity,errors:r.errors.length}));
  await page.close();
 }
 await browser.close();server.close();
 if(outFile)fs.writeFileSync(path.resolve(outFile),JSON.stringify(report,null,1));
})().catch(e=>{console.error(e);process.exit(1)});
