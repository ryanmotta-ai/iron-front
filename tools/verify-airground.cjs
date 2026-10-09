/* Verificação em navegador da integração terra × ar e do mapa único: dimensões e alinhamento do mapa, aeródromos DENTRO do mapa, nada
   planejado na faixa aérea, captura/defesa do aeródromo, dano no solo (obuses, rajadas), fogo de infantaria contra aviões, prontidão
   aérea e tempo entre o pedido de apoio e o avião sobre o alvo. node tools/verify-airground.cjs → tests/artifacts/airground-report.json */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tests/artifacts');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.setHeader('Cache-Control','no-store');res.end(d)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[],report={};
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))errors.push(m.text())});
 let seed=7;
 const boot=async s=>{seed=s;await page.addInitScript(sd=>{let a=sd>>>0;Math.random=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}},s)};
 await boot(7);
 await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0`);await page.locator('[data-go="sandbox"]').click();await page.locator('#start').click();
 const fresh=(ai=false)=>page.evaluate(ai=>{document.getElementById('blueai').value=ai?'on':'off';document.getElementById('redai').value=ai?'on':'off';setup();PXFORT.endPrep?.();PXWIN.on=false;if(!ai)units=[];
  window.mk=(t,type,x,y)=>{const u=newUnit(type,t,x,y);u.cls=undefined;u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=1e9;return u};window.run=(s,dt=.1)=>{for(let i=0;i<s/dt;i++)update(dt)}},ai);
 const scenario=async(name,fn,ai=false)=>{await fresh(ai);const r=await page.evaluate(fn);report[name]=r;console.log(name.padEnd(14),JSON.stringify(r).slice(0,460));return r};

 // ---- mapa único e dimensões ----
 let r=await scenario('mapa',()=>{run(1);const sel=[...document.getElementById('mapselect').options].map(o=>o.value);const hq=PXSTRUCT.list.find(e=>e.team===0&&e.kind==='hq');
  return {options:sel,W,H,GH,flags:points.map(p=>[p.x,p.y]),hq:[hq.x,hq.y],roadsGround:PX.WW1.ROADY,layoutPH:PX.WW1.PH,air:PXAW.airfields().map(f=>({x:f.x,y:f.y,box:f.box}))}});
 assert.deepEqual(r.options,['trenches']);assert.equal(r.H,2400);assert.equal(r.GH,1600);assert.ok(r.flags.every(p=>p[1]===800),'bandeiras na altura da arte (QG a ~40 u)');
 assert.ok(r.air.every(f=>f.box.y0>=r.GH-40&&f.box.y1<=r.H&&f.box.x0>=0&&f.box.x1<=r.W),'aeródromos dentro do mapa e na faixa aérea');
 assert.ok(r.air[0].box.x1<=1200&&r.air[1].box.x0>=1200,'cada campo do seu lado do rio');

 // ---- terreno do campo limpo ----
 r=await scenario('sitio',()=>{run(2);const afs=PXAW.airfields(),inb=(d,f)=>d.x>=f.box.x0&&d.x<=f.box.x1&&d.y>=f.box.y0&&d.y<=f.box.y1;
  return {ready:IronFront.airsite.state().ready,decorInside:decor.filter(d=>afs.some(f=>inb(d,f))).length,cratersInside:allCraters.filter(d=>afs.some(f=>inb(d,f))).length,cleaned:IronFront.airsite.state().stats.cleaned}});
 assert.ok(r.ready&&r.decorInside===0&&r.cratersInside===0,JSON.stringify(r));

 // ---- captura do aeródromo ----
 r=await scenario('captura',()=>{const af=PXAW.airfields()[1],s=IronFront.airsite;run(20);
  const foes=[];for(let i=0;i<8;i++)foes.push(mk(0,'rifle',af.x-150+(i%4)*22,af.y-60+Math.floor(i/4)*22));
  const parked0=PXAW.planes().filter(a=>a.team===1&&a.st==='park'&&!a.dead&&!a.gone).length;
  let t0=time;while(!s.overrun(1)&&time-t0<60)run(1);const o={capturedAfter:Math.round(time-t0),flag:af.flag,canLaunch:PXAIRB.canLaunch(1,'cap',{}),aaPosts:PXAIRB.aaPosts().filter(p=>p.team===1).length,parked:[parked0,PXAW.planes().filter(a=>a.team===1&&a.st==='park'&&!a.dead&&!a.gone).length]};
  for(const u of foes)u.hp=0;run(1);
  const mine=[];for(let i=0;i<8;i++)mine.push(mk(1,'rifle',af.x+100+(i%4)*22,af.y-80+Math.floor(i/4)*22));
  t0=time;while(s.overrun(1)&&time-t0<60)run(1);o.retakenAfter=Math.round(time-t0);o.flagBack=af.flag;o.canLaunchAgain=PXAIRB.canLaunch(1,'cap',{});return o});
 assert.ok(r.capturedAfter>=14&&r.capturedAfter<=24&&r.flag===0&&!r.canLaunch&&r.aaPosts===0&&r.parked[1]<r.parked[0]&&r.retakenAfter>=14&&r.flagBack===1&&r.canLaunchAgain,JSON.stringify(r));

 // ---- dano no solo ----
 r=await scenario('solo',()=>{run(20);const pk=()=>PXAW.planes().filter(a=>a.team===1&&a.st==='park'&&!a.dead&&!a.gone),n0=pk().length;
  const a=pk()[0];for(let i=0;i<3;i++){explode(a.x,a.y,80,180,0);run(.2)}const afterShell=pk().length;
  const b=pk()[0];for(let i=0;i<60;i++){bullets.push({x:b.x-60,y:b.y+(i%5-2)*8,vx:900,vy:0,t:.5,team:0,damage:20,friendlyFire:true,air:true});run(.02,.02)}
  return {before:n0,afterShell,afterStrafe:pk().length,stats:IronFront.airsite.state().stats.planesLost}});
 assert.ok(r.afterShell<r.before,JSON.stringify(r));

 // ---- infantaria contra avião baixo ----
 r=await scenario('fuzil-aviao',()=>{run(20);PXAW.dispatch(1,'cap',1500,800,{n:2});let f,L;for(let i=0;i<300&&!(L=(f=PXAW.flights().find(q=>q.team===1&&!q.done))&&f.lead&&f.lead())?.air;i++)run(1);if(!L||!L.air)return {noFlight:true};
  const px=L.x,py=L.y;for(let i=0;i<12;i++)mk(0,'rifle',px+((i%4)-2)*20,py+Math.floor(i/4)*20);const h0=IronFront.airsite.state().stats.riflesHits;for(let k=0;k<1500&&!L.dead&&!L.gone;k++){L.x=px;L.y=py;L.h=90;run(.1,.1)}return {hits:IronFront.airsite.state().stats.riflesHits-h0}});
 assert.ok(r.hits>0||r.noFlight,JSON.stringify(r));

 // ---- prontidão e tempo do pedido ao avião sobre o alvo ----
 const timing=async(alert)=>{await fresh();return page.evaluate(alert=>{PXAIRB.alertOn=[alert,false];if(alert){for(let i=0;i<400&&!PXAW.flights().some(q=>q.team===0&&q.alertFlight&&['out','work'].includes(q.phase));i++)run(1)}else{for(const q of PXAW.flights())if(q.team===0)q.done=true;run(130)}const tx=1500,ty=800,t0=time;const f=IronFrontAirCommand.request(0,'atk',tx,ty,{n:1,manual:true,reason:'teste'});let over=null;
  for(let i=0;i<30*140&&over===null;i++){update(1/30);const g=PXAW.flights().find(q=>q.team===0&&q.kind==='atk');if(g&&g.m.some(a=>a.air&&Math.hypot(a.x-tx,a.y-ty)<260))over=time-t0}return {fl:PXAW.flights().filter(q=>q.team===0).map(q=>q.kind+':'+q.phase),t:Math.round(time),req:!!f,rapid:!!(f&&f.rapid),over:over&&+over.toFixed(1)}},alert)};
 report.apoioAereo={semProntidao:await timing(false),comProntidao:await timing(true)};console.log('apoio aéreo'.padEnd(14),JSON.stringify(report.apoioAereo));
 assert.ok(report.apoioAereo.comProntidao.rapid&&report.apoioAereo.comProntidao.over<15&&report.apoioAereo.semProntidao.over<90,JSON.stringify(report.apoioAereo));

 // ---- IA: partida completa sem nada planejado na faixa aérea ----
 await fresh(true);r=await page.evaluate(()=>{aiEnabled=[true,true];const afs=PXAW.airfields(),inAF=(x,y)=>afs.some(f=>f&&f.box&&x>=f.box.x0&&x<=f.box.x1&&y>=f.box.y0&&y<=f.box.y1);const v={anchors:0,buildings:0,unitsOut:0,goals:0};
  for(let i=0;i<10*500;i++){update(.1);if(i%50===0){v.anchors=Math.max(v.anchors,fieldTrenches.filter(a=>a.y>GH&&!inAF(a.x,a.y)).length);v.buildings=Math.max(v.buildings,buildings.filter(b=>b.y>GH&&!inAF(b.x,b.y)).length);
   let o=0,g=0;for(const u of units){if(u.hp<=0||u.sap||u.cls==='mechanic'||u.cls==='medic')continue;if(u.siteGuard||u.gid&&PXORD.groupOf(u)?.via==='defesa do aeródromo')continue;if(u.y>GH+25&&!inAF(u.x,u.y))o++;if(u.order==='move'&&u.ty>GH+60&&PXORD.groupOf(u)==null)g++}v.unitsOut=Math.max(v.unitsOut,o);v.goals=Math.max(v.goals,g)}}
  return {v,t:Math.round(time),airsite:IronFront.airsite.state().stats,air:{sorties:PXAW.stats.sorties,landings:PXAW.stats.landings,crashes:PXAW.stats.landingCrashes}}});
 report.partida=r;console.log('partida'.padEnd(14),JSON.stringify(r).slice(0,420));
 assert.ok(r.v.anchors===0&&r.v.buildings===0&&r.v.unitsOut===0,JSON.stringify(r.v));
 report.errors=errors;fs.writeFileSync(path.join(out,'airground-report.json'),JSON.stringify(report,null,1));
 console.log('erros de página:',errors.length?errors:'nenhum');await browser.close();server.close();process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
