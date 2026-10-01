/* Deterministic local battle samples; compare the same seeds before/after tuning. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],results=[];
try{const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0`,{waitUntil:'load'});
 for(const map of ['trenches','forest'])for(const attacker of [0,1]){
  const result=await page.evaluate(({map,attacker})=>{
   let seed=907+attacker;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
   document.getElementById('mapselect').value=map;document.getElementById('gametype').value='conquest';document.getElementById('scale').value='80';document.getElementById('blueai').value='on';document.getElementById('redai').value='on';document.getElementById('rolesel').value=attacker?'a1':'a0';document.getElementById('difficulty').value='normal';setup();running=false;
   const phases={},changes=[],first=[null,null],start=units.map(u=>({id:u.id,team:u.team}));let cashMin=Infinity,advanceSamples=0,samples=0,initialOwner=points.find(p=>p.name==='B').owner;
   for(let i=0;i<1800;i++){update(.1);cashMin=Math.min(cashMin,...supplies);if(i%50===49){samples++;const plans=IronFrontBrain.lastPlans;
    for(const t of [0,1]){const phase=plans[t]?.operation.phase;if(phase==='advance'&&first[t]===null)first[t]=time;if(t===attacker){phases[phase]=(phases[phase]||0)+1;if(phase==='advance')advanceSamples++}}
    const owner=points.find(p=>p.name==='B').owner;if(owner!==initialOwner){changes.push({time:+time.toFixed(1),owner});initialOwner=owner}
   }}
   const losses=[0,1].map(t=>start.filter(s=>s.team===t&&!units.some(u=>u.id===s.id&&u.team===t&&u.hp>0&&!u.down)).length);
   return {map,attacker,firstAdvance:first[attacker],attackDuty:advanceSamples/samples,phases,centerChanges:changes,losses,kills:[...teamKills],cashMin,points:points.map(p=>({name:p.name,owner:p.owner})),engineering:[0,1].map(t=>IronFrontEngineering.state(t)?.spent||0),units:[0,1].map(t=>units.filter(u=>u.team===t&&u.hp>0&&!u.down).length)};
  },{map,attacker});assert.ok(result.cashMin>=0);results.push(result);console.log(JSON.stringify(result));
 }
 assert.deepEqual(errors,[]);const target=process.argv[2]||'tests/artifacts/balance-report.json';fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify({duration:180,seeds:[907,908],scale:80,errors,results},null,2));
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
