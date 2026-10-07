/* Verificação em navegador (Edge/Playwright) dos sistemas de guerra do feedback #1: estruturas destrutíveis, ordens de intenção
   (cobertura, parada, relatos, decisões, falta de armamento), engenheiros/mecânicos, limpeza do campo, bunker com guarnição, aeródromo,
   AIR OPERATIONS, comunicações e fim de partida por QG destruído. Cada cenário recria a partida (setup) com o campo limpo.
   node tools/verify-war-systems.cjs  → imprime os números e grava tests/artifacts/war-systems-report.json */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tests/artifacts');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.setHeader('Cache-Control','no-store');res.end(d)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[],report={};
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR|fonts.googleapis/.test(m.text()))errors.push(m.text())});
 await page.addInitScript(()=>{let a=7;Math.random=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}});
 await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0`);await page.locator('[data-go="sandbox"]').click();await page.locator('#start').click();
 const fresh=()=>page.evaluate(()=>{document.getElementById('blueai').value='off';document.getElementById('redai').value='off';setup();PXFORT.endPrep?.();units=[];PXORD.groups().slice().forEach(g=>PXORD.end(g));
  window.mk=(t,type,x,y)=>{const u=newUnit(type,t,x,y);u.cls=undefined;u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=0;return u};window.run=(s,dt=.1)=>{for(let i=0;i<s/dt;i++)update(dt)};});
 const scenario=async(name,fn)=>{await fresh();const r=await page.evaluate(fn);report[name]=r;console.log(name.padEnd(14),JSON.stringify(r).slice(0,420));return r};

 // ---- estruturas ----
 let r=await scenario('estruturas',()=>{const S=PXSTRUCT,hq=S.list.find(e=>e.team===1&&e.kind==='hq'),med=S.list.find(e=>e.team===1&&e.kind==='medpost'),o={};
  for(let i=0;i<200;i++)bullets.push({x:hq.x-40,y:hq.y+(i%5-2)*6,vx:800,vy:0,t:1,team:0,damage:30});for(let i=0;i<200;i++)bullets.push({x:med.x-40,y:med.y+(i%5-2)*6,vx:800,vy:0,t:1,team:0,damage:30});run(.5,.01);
  o.rifleVsBrick=Math.round(hq.max-hq.hp);o.rifleVsCanvasDestroyed=med.destroyed;
  let n=0;while(!hq.destroyed&&n<30){explode(hq.x,hq.y,55,180,0);run(.3);n++}o.shellsToKillHQ=n;o.integrity=[S.integrity(0),S.integrity(1)].map(v=>+v.toFixed(2));return o});
 assert.ok(r.rifleVsBrick<300&&r.rifleVsCanvasDestroyed&&r.shellsToKillHQ>=5&&r.shellsToKillHQ<=12,JSON.stringify(r));

 // ---- HQ destruído encerra a guerra mesmo no sandbox ----
 r=await scenario('hq-colapso',()=>{units=[];mk(0,'rifle',500,900);mk(1,'rifle',2000,900);const hq=PXSTRUCT.list.find(e=>e.team===1&&e.kind==='hq');run(30);explode(hq.x,hq.y,60,3000,0);run(1);const o={crisis:IronFront.victory.state().crisis};run(60);o.ended=ended;o.result=IronFront.victory.state().result;return o});
 assert.ok(r.ended&&r.result.why==='hq'&&r.result.winner===0,JSON.stringify(r));

 // ---- ordem de assalto sob fogo: cobertura, parada, relato, decisão ----
 r=await scenario('assalto-fogo',()=>{PXWIN.on=false;PXBAT.addGun(1,2150,760,'f');run(.5);const tgt=PXSTRUCT.list.find(e=>e.team===1&&e.kind==='gun');
  PXORD.cfg.STALL=3;for(let i=0;i<4;i++)mk(1,'mg',tgt.x-60,tgt.y-40+i*28);for(let i=0;i<4;i++)mk(1,'rifle',tgt.x-70+(i%4)*14,tgt.y+60);
  const us=[];for(let i=0;i<18;i++)us.push(mk(0,'rifle',1500+(i%6)*18,800+Math.floor(i/6)*18));selected.clear();us.forEach(u=>selected.add(u.id));
  const g=PXORD.assault(us,tgt,{byPlayer:true}),o={states:[]};let t0=time,seen=new Set();
  for(let i=0;i<30*120;i++){update(.1);if(!seen.has(g.state)){seen.add(g.state);o.states.push([Math.round(time-t0),g.state])}if(g.state==='stalled'&&!o.panel){o.panel=document.getElementById('intentPanel').innerText.replace(/\n/g,' | ');o.decision=PXORD.decide(g,'arty');o.stalledReports=IronFront.comms.state().log.filter(l=>/não conseguimos avançar|metralhadora/.test(l)).length}}
  o.reports=IronFront.comms.state().log.length;o.alive=us.filter(u=>u.hp>0).length;return o});
 assert.ok(r.states.some(s=>s[1]==='cover')&&r.states.some(s=>s[1]==='stalled')&&/ESPERAR/.test(r.panel)&&r.decision&&r.stalledReports>=1,JSON.stringify(r));

 // ---- sem armamento adequado ----
 r=await scenario('sem-armas',()=>{PXWIN.on=false;const hq=PXSTRUCT.list.find(e=>e.team===1&&e.kind==='hq');const us=[];for(let i=0;i<6;i++){const u=mk(0,'rifle',1500+i*10,900);u.gren=0;us.push(u)}
  const g=PXORD.assault(us,hq,{byPlayer:true});run(2);return {noArms:g.noArms,state:g.state,dbg:[g.stallAt,g.coverAt,time,PXCOMM.autonomous(0),PXCOMM.link(0).q],report:IronFront.comms.state().log.filter(l=>/armamento adequado/.test(l)).length}});
 assert.ok(r.noArms&&r.state==='stalled'&&r.report===1,JSON.stringify(r));

 // ---- avanço chega e o grupo se desfaz (as unidades voltam a ficar livres) ----
 r=await scenario('avanco',()=>{PXWIN.on=false;const us=[];for(let i=0;i<8;i++)us.push(mk(0,'rifle',900+(i%4)*14,900+Math.floor(i/4)*14));const g=PXORD.advance(us,1100,900,{byPlayer:true});let arrived=null;for(let i=0;i<30*120;i++){update(.1);if(g.state==='arrived'&&arrived===null)arrived=time}
  return {arrivedAt:arrived&&Math.round(arrived),groups:PXORD.state().groups.length,free:PXORD.free(0).length}});
 assert.ok(r.arrivedAt>0&&r.groups===0&&r.free===8,JSON.stringify(r));

 // ---- engenheiros e mecânicos ----
 r=await scenario('engenheiros',()=>{PXWIN.on=false;const E=PXENG,o={};const c=PXSTRUCT.list.find(e=>e.team===0&&e.kind==='comms');c.ref.hp=c.max*.3;run(.3);
  const eng=[0,1,2].map(i=>{const u=newUnit('sapper',0,c.x+150+i*10,c.y);u.manualUntil=0;return u});E.repair(eng,c,{byPlayer:true});run(25);o.repaired=Math.round(c.hp)>=c.max*.99;
  c.ref.hp=0;run(1);E.repair(eng,c,{byPlayer:true});run(40);o.rebuilt=!c.destroyed&&c.hp>0;
  const mech=[newUnit('mechanic',0,1000,1000),newUnit('mechanic',0,1010,1000)];const tk=mk(0,'tank',1050,1000);tk.hp=300;tk.trk=1;tk.mot=1;E.repairVehicle(mech,tk,{byPlayer:true});run(80);o.tank={hp:Math.round(tk.hp),trk:tk.trk,mot:tk.mot};
  const sp=t=>{const u=mk(0,'tank',500,500);u.trk=t;const x0=u.x;for(let i=0;i<150;i++){u.manualUntil=time+99;u.order='move';u.tx=1100;u.ty=500;update(.1)}const d=u.x-x0;u.hp=0;run(.3);return Math.round(d)};o.speed={ok:sp(0),trackBroken:sp(1)};
  const t2=mk(0,'tank',1300,1000);explode(1300,1000,40,3000,1);run(.3);o.hulks=PXCLEAN.hulks.length;const hk=PXCLEAN.hulkAt(1300,1000,0,60);if(hk){hk.rec=true;E.recover([newUnit('mechanic',0,1320,1000)],hk,{byPlayer:true});run(40);o.recovered=E.state().stats.recovered}
  return o});
 assert.ok(r.repaired&&r.rebuilt&&r.tank.hp>=299&&!r.tank.trk&&!r.tank.mot&&r.speed.trackBroken<r.speed.ok*.5&&r.hulks>=1&&r.recovered===1,JSON.stringify(r));

 // ---- limpeza gradual ----
 r=await scenario('limpeza',()=>{PXWIN.on=false;for(let i=0;i<80;i++){const u=mk(i%2,'rifle',900+(i%20)*12,900+Math.floor(i/20)*12);damage(u,9999,1-(i%2))}
  const dry=IronFront.blood.layers.dry,alpha=()=>{const d=dry.getContext('2d').getImageData(0,0,dry.width,dry.height).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return s};
  const tk=mk(0,'tank',1300,1000);explode(1300,1000,40,3000,1);run(.3);const o={start:{corpses:corpses.length,hulks:PXCLEAN.hulks.length},blood0:alpha()};run(70);o.t70={corpses:corpses.length,smears:PXCLEAN.smears.length};run(110);o.t180={corpses:corpses.length,smears:PXCLEAN.smears.length,hulks:PXCLEAN.hulks.length};
  run(300);o.bloodKept=+(alpha()/Math.max(1,o.blood0)).toFixed(2);o.t480={hulks:PXCLEAN.hulks.length};return o});
 assert.ok(r.start.corpses===80&&r.t70.corpses===0&&r.t70.smears>=70&&r.t180.smears===0&&r.t180.hulks===1&&r.bloodKept<.75,JSON.stringify(r));

 // ---- bunker: guarnição dentro, bunker sem linha de visada, destruição ----
 r=await scenario('bunker',()=>{PXWIN.on=false;const b=newBuilding('bunker',0,1000,1000),crew=[mk(0,'rifle',1005,1000),mk(0,'rifle',1000,1006),mk(0,'rifle',996,1000)];const foe=mk(1,'rifle',1200,1000);run(8);
  const o={inside:crew.filter(u=>u.inBunk).length,pop:units.filter(u=>u.team===0).length};
  const b2=newBuilding('bunker',0,1500,600);newBuilding('sandbag',1,1560,600);mk(0,'rifle',1500,603);mk(1,'rifle',1620,600);run(5);o.noLos=IronFront.strategy.state().stats.noLosBunker;
  b.hp=0;run(1);o.bunkerGone=!buildings.includes(b);o.crewAfter=crew.map(u=>u.hp>0?(u.down?'ferido':u.inBunk?'dentro':'vivo'):'morto');return o});
 assert.ok(r.inside===2&&r.noLos>0&&r.bunkerGone&&!r.crewAfter.includes('dentro'),JSON.stringify(r));

 // ---- aeródromo e AIR OPERATIONS ----
 r=await scenario('aerodromo',()=>{PXWIN.on=false;const A=PXAW,B=PXAIRB,o={};run(20);const f=A.dispatch(0,'cap',1200,900);run(70);const fl=A.flights().filter(x=>x.team===0);o.flights=fl.length;hud();o.panel=document.getElementById('airOps').style.display;
  if(fl[0]){B.sel=fl[0];o.retask=B.retask(fl[0],'atk',1500,800);o.kind=fl[0].kind}
  const rw=B.fac[1].find(p=>p.kind==='runway');for(let i=0;i<14;i++)B.bomb(0,3500+(i-7)*60,1000,115,78);run(.5);o.runwayHp=Math.round(rw.hp);o.canLaunch=B.canLaunch(1,'cap',{});
  const hg=B.fac[1].find(p=>p.kind==='hangar');const parked=()=>A.planes().filter(a=>a.team===1&&a.st==='park'&&!a.dead&&!a.gone).length;const p0=parked();for(let i=0;i<4;i++)B.bomb(0,hg.x,hg.y,115,78);run(.5);o.hangarLost=hg.hp<=0;o.planes=[p0,parked()];o.aaPosts=B.aaPosts().length;
  run(200);o.runwayRecovered=Math.round(rw.hp)>0;return o});
 assert.ok(r.flights>=1&&r.panel==='block'&&r.retask&&r.kind==='atk'&&r.runwayHp<=0&&r.canLaunch===false&&r.hangarLost&&r.planes[1]<r.planes[0]&&r.aaPosts>=2&&r.runwayRecovered,JSON.stringify(r));

 // ---- comunicações: centro destruído atrasa ordens e proposta do oficial ----
 r=await scenario('comunicacoes',()=>{PXWIN.on=false;const o={};for(let i=0;i<24;i++)mk(0,'rifle',900+(i%8)*14,900+Math.floor(i/8)*14);for(let i=0;i<8;i++)mk(1,'rifle',2000+i*10,900);run(95);const p=IronFront.comms.propose(true);o.proposal=!!p;if(p)o.lines=p.lines;
  const c=PXSTRUCT.list.find(e=>e.team===0&&e.kind==='comms');o.delayOk=+IronFront.comms.delay(0,1400,900).toFixed(2);explode(c.x,c.y,60,3000,1);run(1);o.destroyed=c.destroyed;o.delayDown=IronFront.comms.delay(0,1400,900);o.autonomous=IronFront.comms.autonomous(0);return o});
 assert.ok(r.proposal&&r.destroyed&&r.delayDown===14&&r.autonomous&&r.delayOk<1.6,JSON.stringify(r));

 // ---- IA: incursões contra infraestrutura ----
 await fresh();await page.evaluate(()=>{PXWIN.on=false;aiEnabled=[true,true]});
 r=await page.evaluate(()=>{const o={};for(let i=0;i<10*420;i++)update(.1);const st=IronFront.strategy.state();o.stats=st.stats;o.structs=IronFront.structures.state().destroyed;o.groups=PXORD.state().stats;return o});report.ia=r;console.log('ia'.padEnd(14),JSON.stringify(r).slice(0,420));
 assert.ok(r.stats.raids>=1,JSON.stringify(r.stats));
 report.errors=errors;fs.writeFileSync(path.join(out,'war-systems-report.json'),JSON.stringify(report,null,1));
 console.log('erros de página:',errors.length?errors:'nenhum');await browser.close();server.close();process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
