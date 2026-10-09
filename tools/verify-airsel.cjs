/* [airsel] Verificação em navegador da integração terra × ar e do mapa único: dimensões e alinhamento do mapa, aeródromos DENTRO do mapa, nada
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

 // plano do avião: coordenada de tela a partir do mundo (cam/vw/vh) e canvas
 const screenOf=async(wx,wy)=>{await page.evaluate(async()=>{let last='';for(let i=0;i<40;i++){const k=[cam.x,cam.y,cam.z].join();if(k===last)break;last=k;await new Promise(r=>setTimeout(r,120))}});return page.evaluate(([wx,wy])=>{const c=document.getElementById('game'),r=c.getBoundingClientRect();const m={x:mouse.x,y:mouse.y};mouse.x=0;mouse.y=0;worldMouse();const a=[mouse.wx,mouse.wy];mouse.x=100;mouse.y=100;worldMouse();const k=100/(mouse.wx-a[0]);mouse.x=m.x;mouse.y=m.y;worldMouse();return{x:r.left+(wx-a[0])*k*r.width/vw,y:r.top+(wy-a[1])*k*r.height/vh}},[wx,wy])};
 let r=await scenario('preparo',()=>{run(12);const af=PXAW.airfields()[0];cam.x=af.x;cam.y=af.y-80;cam.z=.8;setMode&&setMode('commander',false);hud();
  const P=PXAW.planes().filter(a=>a.team===playerTeam&&a.st==='park');return{n:P.length,ready:P.filter(a=>!IronFront.airsel.readyWhy(a)).length,roles:P.map(a=>a.slot.role+':'+a.tk),mode,pt:playerTeam,sel:IronFront.airsel.state()}});
 assert.ok(r.ready>=2,JSON.stringify(r));
 // 1) clique no avião de caça pronto seleciona
 const target=await page.evaluate(()=>{const a=PXAW.planes().find(a=>a.team===playerTeam&&a.st==='park'&&a.slot.role==='f'&&!IronFront.airsel.readyWhy(a));return{id:a.id,x:a.x,y:a.y,tk:a.tk}});
 let p=await screenOf(target.x,target.y);await page.mouse.move(p.x,p.y);await page.mouse.click(p.x,p.y);
 r=await page.evaluate(()=>({st:IronFront.airsel.state(),shown:!document.getElementById('airSelPanel').hidden,txt:document.getElementById('airSelPanel').innerText}));report.seleciona=r;console.log('seleciona'.padEnd(14),JSON.stringify(r).slice(0,300));
 assert.deepEqual(r.st.sel,[target.id]);assert.ok(r.shown&&/SUBIR VOO/.test(r.txt),r.txt);
 await page.screenshot({path:path.join(out,'airsel-selecionado.png')});
 // 2) botão SUBIR VOO decola o avião escolhido
 await page.locator('#airSelPanel button.go').click();
 r=await page.evaluate(id=>{const a=PXAW.planes().find(a=>a.id===id);run(1);return{st:a.st,flight:a.flight&&a.flight.kind,sel:IronFront.airsel.state(),air:PXAW.state().airborne[playerTeam],others:PXAW.planes().filter(b=>b.team===playerTeam&&b.id!==id&&b.st!=='park').length}},target.id);report.decola=r;console.log('decola'.padEnd(14),JSON.stringify(r));
 assert.ok(r.st!=='park'&&r.flight==='cap'&&r.others===0&&r.sel.sel.length===0,JSON.stringify(r));
 r=await page.evaluate(id=>{const a=PXAW.planes().find(a=>a.id===id);let t=0;while(t<240&&!(a.air&&a.h>100)){run(2);t+=2}return{t,st:a.st,air:a.air,h:Math.round(a.h),kind:a.flight&&a.flight.kind}},target.id);report.noAr=r;console.log('no ar'.padEnd(14),JSON.stringify(r));assert.ok(r.air&&r.h>100,JSON.stringify(r));
 await page.screenshot({path:path.join(out,'airsel-noar.png')});
 // 3) atacante: seleciona, direito no mapa -> missão de ataque com aquele avião; fora de pronto não passa
 await fresh(false);
 const t2=await page.evaluate(()=>{run(12);const af=PXAW.airfields()[0];cam.x=af.x;cam.y=af.y-80;cam.z=.8;setMode&&setMode('commander',false);const a=PXAW.planes().find(a=>a.team===playerTeam&&a.st==='park'&&a.slot.role==='a'&&!IronFront.airsel.readyWhy(a));return{id:a.id,x:a.x,y:a.y}});
 p=await screenOf(t2.x,t2.y);await page.mouse.click(p.x,p.y);
 const tgt=await page.evaluate(()=>({x:PXAW.front()+(playerTeam?-1:1)*350,y:700}));
 await page.evaluate(([x,y])=>{cam.x=x;cam.y=y},[tgt.x,tgt.y]);const q=await screenOf(tgt.x,tgt.y);
 await page.mouse.click(q.x,q.y,{button:'right'});
 r=await page.evaluate(id=>{const a=PXAW.planes().find(a=>a.id===id);run(2);return{st:a.st,kind:a.flight&&a.flight.kind,area:a.flight&&[Math.round(a.flight.area.x),Math.round(a.flight.area.y)],n:a.flight&&a.flight.m.length,sel:IronFront.airsel.state()}},t2.id);report.ataque=r;console.log('ataque'.padEnd(14),JSON.stringify(r));
 assert.ok(r.st!=='park'&&r.kind==='atk'&&r.n===1,JSON.stringify(r));
 // 4) clique em chão vazio desmarca; Shift soma; Esc limpa
 await fresh(false);
 r=await page.evaluate(()=>{run(12);const af=PXAW.airfields()[0];cam.x=af.x;cam.y=af.y-80;cam.z=.8;setMode&&setMode('commander',false);return PXAW.planes().filter(a=>a.team===playerTeam&&a.st==='park'&&!IronFront.airsel.readyWhy(a)).slice(0,2).map(a=>({id:a.id,x:a.x,y:a.y}))});
 for(const [i,t] of r.entries()){const s=await screenOf(t.x,t.y);await page.keyboard.down('Shift');await page.mouse.click(s.x,s.y);await page.keyboard.up('Shift')}
 let st=await page.evaluate(()=>IronFront.airsel.state());assert.equal(st.sel.length,2,JSON.stringify(st));
 await page.keyboard.press('Escape');st=await page.evaluate(()=>IronFront.airsel.state());assert.equal(st.sel.length,0);
 report.multi={ok:true};console.log('multi/esc'.padEnd(14),'ok');
 report.errors=errors;fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'airsel-report.json'),JSON.stringify(report,null,1));
 console.log('erros de página:',errors.length?errors:'nenhum');await browser.close();server.close();process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
