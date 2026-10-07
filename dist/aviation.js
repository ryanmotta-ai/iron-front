'use strict';
/* Iron Front 1.9 — apoio aéreo com papéis próprios (aviation.js). Carrega DEPOIS de soundscape.js.
   O jogo já tinha: caça de metralhamento (faixa de 500 px, fogo amigo), bombardeiro (só o jogador) e o avião de reconhecimento do
   frontline.js (revela a névoa e corrige a artilharia sobre o que vê). Este módulo acrescenta três papéis, cada um com função:
   Patrulha de caça .... (SPAD XIII / Fokker D.VII, ◈150) três passagens de 450 px/s pela altura escolhida durante ~30 s; derruba
                         aeronave inimiga a até 300 px (bombardeiro, caça, reconhecimento, observação, ataque ao solo): 55% por
                         segundo em contato. A IA lança uma patrulha quando vê aeronave inimiga no céu (recarga 80 s).
   Ataque ao solo ...... (Sopwith Camel / Halberstadt CL.II, ◈160) voa AO LONGO da trincheira inimiga mais ocupada perto do clique
                         (não atravessa como o caça): rajadas em quem está na vala (dano 16, supressão +.8 a até 45 px da rota) e
                         4 bombas de 25 kg nos ninhos de MG e bunkers da rota. Abate possível por MG inimiga embaixo (3%/s por MG).
                         A IA usa para abrir a trincheira que vai atacar (recarga 120 s).
   Observação de artilharia (Breguet 14 / DFW C.V, ◈130) orbita o ponto por 45 s com rádio: artilharia do seu lado a até 450 px
                         da órbita tem dispersão −65%; a cada 12 s o observador escolhe o melhor alvo que enxerga (ninho de MG,
                         bunker, peça inimiga, grupo de 5+) e pede uma salva corrigida à bateria (3 tiros). A IA lança quando
                         tem bateria e alvo (recarga 100 s).
   Bombardeiro leve .... a IA passa a usar o bombardeiro (já existente) sobre concentração de 14+ inimigos (recarga 150 s).
   ?aviacao=0 desliga · IronFront.aviation.state(). */
(function(){
if(!window.PX||!window.IFK)return;
const K=IFK,Z=K.Z,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v,TAU=Math.PI*2;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('aviation.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={CAP:{v:450,passes:3,gap:6,r:300,kill:.55,cost:150,aiCd:80},ATK:{v:260,len:520,r:45,dmg:16,supp:.8,bombs:4,cost:160,aiCd:120,mgKill:.03},
 SPOT:{v:150,orbit:45,R:120,see:420,spread:.35,every:12,cost:130,aiCd:100,aaKill:.02},BOMB:{n:14,r:140,aiCd:150}};
const S=window.PXAIR={on:K.on&&!/[?&]aviacao=0/.test(location.search),version:'1.9',cfg:CFG,
 stats:{cap:0,capKills:0,atk:0,atkHits:0,atkBombs:0,spot:0,spotCorrected:0,spotCalls:0,aiBombers:0,lost:0,errors:0}};
let AIR=[],errs=0,aiCd=[{cap:0,atk:0,spot:0,bomb:0},{cap:0,atk:0,spot:0,bomb:0}],oxy=[0,0];
function fail(e){S.stats.errors++;if(++errs<=3)console.error('aviation.js:',e);if(errs>=12){S.on=false;console.error('aviation.js desligado após erros repetidos')}}
const NAMES={cap:['SPAD XIII','Fokker D.VII'],atk:['Sopwith Camel','Halberstadt CL.II'],spot:['Breguet 14','DFW C.V']};
defs.cap={name:'Patrulha de caça',sub:'Intercepta aeronaves inimigas',cost:CFG.CAP.cost};
defs.atk={name:'Ataque ao solo',sub:'Metralha a trincheira ao longo',cost:CFG.ATK.cost};
defs.spot={name:'Observação de artilharia',sub:'Corrige e pede fogo · 45 s',cost:CFG.SPOT.cost};
const enemyTeam=t=>1-t;
/* a IA só gasta com aviação se sobrar caixa acima da reserva de obras (não tira dinheiro da engenharia nem dos reforços) */
function aiSpend(type,t){if(sandbox)return spend(type,t,false);const res=Math.max(200,(window.IronFrontEngineering&&IronFrontEngineering.state&&IronFrontEngineering.state(t)?.reserve)||0);
 if(supplies[t]<(defs[type]?.cost||0)+res){S.stats.aiSaved=(S.stats.aiSaved||0)+1;return false}return spend(type,t,false)}
function note(team,m){if(team!==playerTeam)return;try{toast(m)}catch{}}
/* mesma regra do game.js (airAvailable): tempestade forte ou neblina deixam os aviões em solo */
const grounded=()=>{try{const wx=window.PXW&&PXW.state;return !!wx&&!((wx.cur!=='storm'||wx.I<=.9)&&wx.fog<=.7)}catch{return false}};

/* ---------- lançamento ---------- */
function launchCap(team,y){const dir=team?-1:1;const p={role:'cap',team,x:team?W+120:-120,y:clamp(y,80,H-80),hd:team?Math.PI:0,v:CFG.CAP.v,pass:1,wait:0,hp:1,cd:0};AIR.push(p);S.stats.cap++;return p}
function trenchLineNear(team,x,y){/* trincheira do inimigo de 'team' mais ocupada perto do ponto: devolve o eixo da rota */
 const foe=enemyTeam(team);let best=null,bs=-1;
 for(const t of fieldTrenches){if(t.team!==foe)continue;const d=hyp(t.x-x,t.y-y);if(d>360)continue;let n=0;for(const u of units)if(u.team===foe&&u.hp>0&&Math.abs(u.x-t.x)<40&&Math.abs(u.y-t.y)<60)n++;const s=n*3-d/60;if(s>bs){bs=s;best=t}}
 if(!best)return {x0:x,y0:y-CFG.ATK.len/2,x1:x,y1:y+CFG.ATK.len/2};
 /* trecho da linha: trechos da mesma equipe alinhados em y perto do melhor */
 let pts=fieldTrenches.filter(t=>t.team===foe&&Math.abs(t.x-best.x)<70&&Math.abs(t.y-best.y)<CFG.ATK.len/2).sort((a,b)=>a.y-b.y);if(pts.length<2)pts=[{x:best.x,y:best.y-200},{x:best.x,y:best.y+200}];
 const a=pts[0],b=pts[pts.length-1];return {x0:a.x,y0:a.y-60,x1:b.x,y1:b.y+60}}
function launchAtk(team,x,y){const L=trenchLineNear(team,x,y),dx=L.x1-L.x0,dy=L.y1-L.y0,d=hyp(dx,dy)||1,ux=dx/d,uy=dy/d;
 const p={role:'atk',team,x:L.x0-ux*700,y:L.y0-uy*700,hd:Math.atan2(uy,ux),v:CFG.ATK.v,L,ux,uy,cd:0,bombs:CFG.ATK.bombs,hp:1,done:false};AIR.push(p);S.stats.atk++;return p}
function launchSpot(team,x,y){const p={role:'spot',team,cx:clamp(x,140,W-140),cy:clamp(y,140,H-140),x:team?W+120:-120,y:clamp(y,80,H-80),hd:team?Math.PI:0,v:CFG.SPOT.v,phase:'in',t:0,ang:0,hp:1,next:0};AIR.push(p);S.stats.spot++;return p}
S.launch={cap:launchCap,atk:launchAtk,spot:launchSpot};

/* ---------- missões ---------- */
function down(p,by,why){if(p.dead)return;p.dead=true;if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.hd))return;S.stats.lost++;for(let i=0;i<14;i++)particles.push({x:p.x,y:p.y,vx:rnd(-60,60),vy:rnd(-60,30),t:rnd(.4,1.1),max:1.1,color:i%2?'#ff9b32':'#3d3a33',size:rnd(3,7)});
 shells.push({x:clamp(p.x+Math.cos(p.hd)*60,20,W-20),y:clamp(p.y+Math.sin(p.hd)*60+30,20,H-20),t:1.4,r:40,power:60,team:by});note(p.team,`Seu ${NAMES[p.role][p.team]} foi abatido${why?' ('+why+')':''}.`)}
function capTick(p,dt){if(p.wait>0){p.wait-=dt;if(p.wait<=0){p.x=p.team?W+120:-120;p.y=clamp(p.y+rnd(-160,160),80,H-80)}return}
 /* perseguição: vira na direção da aeronave inimiga mais perto (até 600 px), 2 rad/s; sem alvo volta ao rumo da passagem */
 let tg=null,td=600;const seen=q=>{const d=hyp(q.x-p.x,q.y-p.y);if(d<td){td=d;tg=q}};
 for(const q of planes)if(q.team!==p.team&&!q.downed&&!(q.delay>0))seen(q);
 if(window.PXFL&&PXFL.planes)for(const q of PXFL.planes())if(q.team!==p.team&&q.hp>0)seen(q);
 for(const q of AIR)if(q!==p&&q.team!==p.team&&!q.dead&&!(q.wait>0))seen(q);
 if(tg&&td<450){/* engajado: cola na cauda do alvo (60 px atrás) e atira */const tv=tg.v||260,tdir=tg.hd!=null?tg.hd:(tg.team?Math.PI:0),bx=tg.x-Math.cos(tdir)*60,by=tg.y-Math.sin(tdir)*60,dx=bx-p.x,dy=by-p.y,d=hyp(dx,dy)||1,s=Math.min(d,(p.v+tv)*.6*dt);
  p.hd=Math.atan2(tg.y-p.y,tg.x-p.x);p.x+=dx/d*s;p.y=clamp(p.y+dy/d*s,40,H-40)}
 else{const want=tg?Math.atan2(tg.y-p.y,tg.x-p.x):(p.team?Math.PI:0);let da=((want-p.hd)%TAU+Math.PI*3)%TAU-Math.PI;p.hd+=clamp(da,-2.5*dt,2.5*dt);
  p.x+=Math.cos(p.hd)*p.v*dt;p.y=clamp(p.y+Math.sin(p.hd)*p.v*dt,40,H-40)}
 /* caça contra aeronave: as do jogo (planes), as de reconhecimento (frontline) e as deste módulo */
 const tryKill=(q,kill)=>{if(hyp(q.x-p.x,q.y-p.y)>CFG.CAP.r)return;p.cd-=dt;if(Math.random()<dt*CFG.CAP.kill){kill();S.stats.capKills++;note(p.team,'Patrulha de caça: aeronave inimiga abatida.');note(1-p.team,'Caça inimigo derrubou um avião seu.')}
  if(p.cd<=0){p.cd=.08;bullets.push({x:p.x,y:p.y,vx:(q.x-p.x)*4,vy:(q.y-p.y)*4,t:.18,team:p.team,damage:0,air:true})}};
 for(const q of planes)if(q.team!==p.team&&!q.downed&&!(q.delay>0))tryKill(q,()=>{q.downed=true;if(!Number.isFinite(q.x)||!Number.isFinite(q.y))return;if(q.kind==='bomber'){const dir=q.team?-1:1;for(let i=shells.length-1;i>=0;i--){const b=shells[i].bomb;if(b&&b.team===q.team&&Math.abs(b.ry-q.y)<30&&(b.rx-q.x)*dir>0)shells.splice(i,1)}}   /* bombas ainda não largadas caem com o avião */
  for(let i=0;i<14;i++)particles.push({x:q.x,y:q.y,vx:rnd(-60,60),vy:rnd(-60,30),t:rnd(.4,1.1),max:1.1,color:i%2?'#ff9b32':'#3d3a33',size:rnd(3,7)});shells.push({x:clamp(q.x,20,W-20),y:clamp(q.y+30,20,H-20),t:1.4,r:40,power:60,team:p.team});q.x=q.team?-999:W+999;q.delay=0});
 if(window.PXFL&&PXFL.planes)for(const q of PXFL.planes())if(q.team!==p.team&&q.hp>0)tryKill(q,()=>{try{PXFL.hitPlane?PXFL.hitPlane(q,99):q.hp=0}catch{q.hp=0}});
 for(const q of AIR)if(q!==p&&q.team!==p.team&&!q.dead)tryKill(q,()=>down(q,p.team,'caça inimigo'));
 if(p.x<-140||p.x>W+140){if(++p.pass>CFG.CAP.passes)p.gone=true;else{p.wait=CFG.CAP.gap;p.hd=p.team?Math.PI:0}}}
function atkTick(p,dt){p.x+=p.ux*p.v*dt;p.y+=p.uy*p.v*dt;const L=p.L,dx=L.x1-L.x0,dy=L.y1-L.y0,len=hyp(dx,dy)||1,s=((p.x-L.x0)*dx+(p.y-L.y0)*dy)/len;
 const over=s>-40&&s<len+40;
 if(over){p.cd-=dt;if(p.cd<=0){p.cd=.07;/* rajada à frente, varrendo a vala */const ax=p.x+p.ux*70+rnd(-14,14),ay=p.y+p.uy*70+rnd(-14,14);
   bullets.push({x:p.x,y:p.y,vx:(ax-p.x)/.12,vy:(ay-p.y)/.12,t:.12,team:p.team,damage:0,air:true,tr:true});
   for(const u of units){if(u.team===p.team||u.hp<=0||u.down)continue;const d=hyp(u.x-ax,u.y-ay);if(d<CFG.ATK.r){u.suppression=Math.min(2,(u.suppression||0)+CFG.ATK.supp*.25);if(Math.random()<.18){damage(u,CFG.ATK.dmg,p.team);S.stats.atkHits++}}}}
  if(p.bombs>0)for(const b of buildings){if(b.team===p.team||b._atk===p||!(b.type==='bunker'||b.type==='pillbox'))continue;if(hyp(b.x-p.x,b.y-p.y)<50){b._atk=p;p.bombs--;S.stats.atkBombs++;shells.push({x:b.x+rnd(-8,8),y:b.y+rnd(-8,8),t:.9,r:40,power:90,team:p.team})}}
  if(p.bombs>0)for(const u of units){if(u.team===p.team||u.type!=='mg'||u.hp<=0||u._atk===p)continue;if(hyp(u.x-p.x,u.y-p.y)<45){u._atk=p;p.bombs--;S.stats.atkBombs++;shells.push({x:u.x+rnd(-6,6),y:u.y+rnd(-6,6),t:.9,r:40,power:90,team:p.team});break}}
  /* MG inimiga embaixo pode derrubar */
  let mgs=0;for(const u of units)if(u.team!==p.team&&u.type==='mg'&&u.hp>0&&!u.down&&hyp(u.x-p.x,u.y-p.y)<220)mgs++;if(Math.random()<dt*CFG.ATK.mgKill*mgs)down(p,1-p.team,'fogo antiaéreo')}
 if(s>len+900)p.gone=true}
function spotTarget(p){let best=null,bs=0;const foe=1-p.team;
 for(const u of units){if(u.team!==foe||u.hp<=0||u.down)continue;const d=hyp(u.x-p.cx,u.y-p.cy);if(d>CFG.SPOT.see)continue;let s=u.type==='mg'?6:0;
  if(!s){let n=0;for(const o of units)if(o.team===foe&&o.hp>0&&(o.x-u.x)**2+(o.y-u.y)**2<120*120)n++;if(n>=5)s=n}
  if(s){for(const o of units)if(o.team===p.team&&(o.x-u.x)**2+(o.y-u.y)**2<90*90){s=0;break}}if(s>bs){bs=s;best={x:u.x,y:u.y}}}
 for(const b of buildings)if(b.team===foe&&(b.type==='bunker'||b.type==='pillbox')&&hyp(b.x-p.cx,b.y-p.cy)<CFG.SPOT.see&&7>bs){bs=7;best={x:b.x,y:b.y}}
 return best}
function spotTick(p,dt){if(p.phase==='in'){const dx=p.cx-p.x,dy=p.cy-CFG.SPOT.R-p.y,d=hyp(dx,dy),step=(p.v*2)*dt;
  /* chegou (ou chega neste passo): entra em órbita — com dt grande o passo passa do limiar, e d=0 daria 0/0 */
  if(d<=Math.max(8,step)){p.x=p.cx;p.y=p.cy-CFG.SPOT.R;p.phase='orbit';p.t=0;p.ang=-Math.PI/2;p.next=time+2;return}
  p.hd=Math.atan2(dy,dx);p.x+=dx/d*step;p.y+=dy/d*step;return}
 if(p.phase==='orbit'){p.t+=dt;p.ang+=dt*p.v/CFG.SPOT.R;const nx=p.cx+Math.cos(p.ang)*CFG.SPOT.R,ny=p.cy+Math.sin(p.ang)*CFG.SPOT.R*.75;p.hd=Math.atan2(ny-p.y,nx-p.x);p.x=nx;p.y=ny;
  if(time>=p.next){p.next=time+CFG.SPOT.every;const tg=spotTarget(p);if(tg&&window.PXBAT&&PXBAT.mission){const ok=PXBAT.mission(p.team,tg.x,tg.y,3,60,'he');if(ok!==false){S.stats.spotCalls++;note(p.team,'Avião de observação pediu fogo corrigido sobre um alvo.')}}}
  let aa=0;for(const u of units)if(u.team!==p.team&&u.type==='mg'&&u.hp>0&&!u.down&&hyp(u.x-p.x,u.y-p.y)<260)aa++;if(Math.random()<dt*CFG.SPOT.aaKill*aa)down(p,1-p.team,'fogo antiaéreo');
  if(p.t>CFG.SPOT.orbit){p.phase='out';p.hd=p.team?0:Math.PI}return}
 p.x+=Math.cos(p.hd)*p.v*2*dt;p.y+=Math.sin(p.hd)*p.v*2*dt;if(p.x<-200||p.x>W+200)p.gone=true}
function spotterOver(team,x,y){for(const p of AIR)if(p.role==='spot'&&!p.dead&&p.team===team&&p.phase==='orbit'&&hyp(p.cx-x,p.cy-y)<CFG.SPOT.see+30)return p;return null}
S.spotterOver=spotterOver;
if(window.PXBAT&&PXBAT.mission){const o=PXBAT.mission;PXBAT.mission=function(team,x,y,count,spread,kind,cb,strict){
 if(S.on&&kind!=='smoke'&&spotterOver(team,x,y)){spread*=CFG.SPOT.spread;S.stats.spotCorrected++}return o.call(this,team,x,y,count,spread,kind,cb,strict)}}

/* ---------- IA ---------- */
function aiTick(){if(window.PXAW?.on)return;for(let t=0;t<2;t++){if(!aiEnabled[t])continue;const C=aiCd[t],foe=1-t;
 const foeAir=planes.some(q=>q.team===foe&&!q.downed)||AIR.some(q=>q.team===foe&&!q.dead)||(window.PXFL&&PXFL.planes&&PXFL.planes().some(q=>q.team===foe&&q.hp>0));
 if(foeAir&&time>C.cap&&!AIR.some(q=>q.role==='cap'&&q.team===t)&&!grounded()&&aiSpend('cap',t)){C.cap=time+CFG.CAP.aiCd;const q=AIR.find(q=>q.team===foe)||planes.find(q=>q.team===foe)||{y:H/2};launchCap(t,q.y)}
 /* trincheira inimiga mais cheia perto da própria frente → ataque ao solo */
 if(time>C.atk&&!grounded()){let best=null,bn=5;for(const tr of fieldTrenches){if(tr.team!==foe)continue;let n=0,near=false;for(const u of units){if(u.hp<=0)continue;if(u.team===foe&&Math.abs(u.x-tr.x)<40&&Math.abs(u.y-tr.y)<60)n++;else if(u.team===t&&!near&&hyp(u.x-tr.x,u.y-tr.y)<420)near=true}if(near&&n>bn){bn=n;best=tr}}
  if(best&&aiSpend('atk',t)){C.atk=time+CFG.ATK.aiCd;launchAtk(t,best.x,best.y)}else C.atk=time+15}
 if(time>C.spot&&!grounded()&&window.PXBAT&&PXBAT.mission){const f=units.filter(u=>u.team===t);if(f.length){let fx=0;for(const u of f)fx+=u.x;fx/=f.length;const probe={role:'spot',team:t,cx:fx+(t?-380:380),cy:H/2};let tg=null;
   for(const y of [400,800,1200]){probe.cy=y;tg=spotTarget(probe);if(tg)break}
   if(tg&&aiSpend('spot',t)){C.spot=time+CFG.SPOT.aiCd;launchSpot(t,tg.x,tg.y)}else C.spot=time+20}}
 if(time>C.bomb&&!grounded()&&typeof callBomber==='function'){let best=null,bn=CFG.BOMB.n-1;for(const u of units){if(u.team!==foe||u.hp<=0||Math.random()>.15)continue;let n=0;for(const o of units)if(o.team===foe&&o.hp>0&&(o.x-u.x)**2+(o.y-u.y)**2<CFG.BOMB.r**2)n++;
   if(n>bn){let safe=true;for(const o of units)if(o.team===t&&(o.x-u.x)**2+(o.y-u.y)**2<160*160){safe=false;break}if(safe){bn=n;best=u}}}
  if(best&&aiSpend('bomber',t)){C.bomb=time+CFG.BOMB.aiCd;callBomber(t,best.x,best.y);S.stats.aiBombers++}else C.bomb=time+12}}}

/* ---------- ligações ---------- */
let aiT=0;
function tick(dt){for(const p of AIR){if(p.dead)continue;if(p.role==='cap')capTick(p,dt);else if(p.role==='atk')atkTick(p,dt);else spotTick(p,dt)}
 AIR=AIR.filter(p=>!p.gone&&!p.dead&&Number.isFinite(p.x)&&Number.isFinite(p.y));   /* nunca deixar coordenada inválida virar projétil */if((aiT-=dt)<=0){aiT=1;aiTick()}}
wrap('setup',(orig,...a)=>{AIR=[];aiCd=[{cap:0,atk:60,spot:40,bomb:90},{cap:0,atk:60,spot:40,bomb:90}];return orig(...a)});
wrap('update',(orig,dt)=>{orig(dt);if(!S.on||!started||ended||!(dt>0))return;try{if(window.PXFORT&&PXFORT.isPrep&&PXFORT.isPrep()){AIR.length=0;return}tick(dt)}catch(e){fail(e)}});
wrap('place',(orig,x,y)=>{const t=placement;if(!S.on||!(t==='cap'||t==='atk'||t==='spot'))return orig(x,y);
 if(grounded()){toast('Sem condições de voo: os aviões ficam em solo.');return}if(!spend(t))return;
 if(t==='cap'){launchCap(playerTeam,y);toast(`${NAMES.cap[playerTeam]}: patrulha de caça em 3 passagens nesta altura (~30 s).`)}
 else if(t==='atk'){launchAtk(playerTeam,x,y);toast(`${NAMES.atk[playerTeam]}: ataque ao longo da trincheira inimiga mais ocupada perto do ponto.`)}
 else{launchSpot(playerTeam,x,y);toast(`${NAMES.spot[playerTeam]}: observação por 45 s · artilharia ali com dispersão −65% e pedidos de fogo.`)}
 try{sound('click')}catch{}if(!keys.Shift){placement=null;makeCards();const h=document.getElementById('placehint');if(h)h.textContent='Escolha uma unidade e posicione no campo'}});
wrap('makeCards',orig=>{orig();try{if(!S.on||tab!=='support')return;
 for(const [type,key] of [['cap','7'],['atk','8'],['spot','9']]){if(window.PXAW?.on&&type!=='cap')continue;const d=defs[type],b=document.createElement('button');b.className='card'+(placement===type?' active':'');b.dataset.kind=type;
  b.innerHTML=`<canvas width="48" height="48"></canvas><b>${NAMES[type][playerTeam]}</b><small>${d.sub}</small><span class="cost">◈ ${sandbox?'∞':d.cost}</span><kbd>${key}</kbd>`;
  b.onclick=()=>choose(type);document.getElementById('cards').append(b);icon(type,b.querySelector('canvas').getContext('2d'))}}catch(e){fail(e)}});
wrap('icon',(orig,type,c)=>{if(type!=='cap'&&type!=='atk'&&type!=='spot')return orig(type,c);c.clearRect(0,0,48,48);try{const sp=PX.planeSprite('fighter',playerTeam,false),r=PX.rotSprite(sp.c,type==='atk'?.5:type==='spot'?-.25:-.5);c.drawImage(r,24-r.width/2,24-r.height/2);
  if(type==='atk'){c.fillStyle='#1a2017';c.fillRect(30,34,4,6);c.fillRect(36,30,4,6)}if(type==='spot'){c.fillStyle='#e9e3b4';c.fillRect(6,8,1,10);c.fillRect(4,10,5,1)}}catch{}});
/* teclas 7–9 nas abas que têm cartas com esses atalhos (as cartas 1–4 já têm atalho no game.js) */
window.addEventListener('keydown',e=>{if(!/^[789]$/.test(e.key)||e.repeat||document.querySelector('dialog[open]')||typeof mode==='undefined'||mode!=='commander')return;
 const b=[...document.querySelectorAll('#cards .card')].find(b=>(b.querySelector('kbd')||{}).textContent===e.key);if(b){e.stopImmediatePropagation();b.click()}});

/* ---------- desenho ---------- */
const ROT=new Map();
function spriteFor(p){const kind='fighter',d=((Math.round((p.hd-(p.team?Math.PI:0))/TAU*16)%16)+16)%16,prop=((time*18)|0)%2,k=`${p.team}${d}${prop}`;let r=ROT.get(k);
 if(!r){const sp=PX.planeSprite(kind,p.team,!!prop);r={c:d?PX.rotSprite(sp.c,d*TAU/16):sp.c,sh:d?PX.rotSprite(sp.sh,d*TAU/16):sp.sh};ROT.set(k,r)}return r}
function draw(c,ox,oy){for(const p of AIR){if(p.dead||p.wait>0)continue;const x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z);if(x<-60||y<-60||x>vw+60||y>vh+60)continue;
  const r=spriteFor(p);c.drawImage(r.sh,x-(r.sh.width>>1)+14,y-(r.sh.height>>1)+22);c.drawImage(r.c,x-(r.c.width>>1),y-(r.c.height>>1));
  if(p.role==='spot'){/* antena de rádio arrastada e o círculo do setor observado (só o seu lado) */c.fillStyle='#d9d5b7';c.fillRect(x-Math.round(Math.cos(p.hd)*9),y-Math.round(Math.sin(p.hd)*9)+2,1,1);
   if(p.team===playerTeam&&p.phase==='orbit'){c.globalAlpha=.35;const R=Math.round(CFG.SPOT.see*Z),cx=ox+Math.round(p.cx*Z),cy=oy+Math.round(p.cy*Z);c.fillStyle=playerTeam?'#e29a87':'#aed6d4';for(let k=0;k<48;k++){const a=k/48*TAU+time*.2;if(k%2)c.fillRect(cx+Math.round(Math.cos(a)*R),cy+Math.round(Math.sin(a)*R*.75),2,1)}c.globalAlpha=1}}}}
if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on)return;try{draw(c,ox,oy)}catch(e){fail(e)}}}

S.state=()=>({on:S.on,air:AIR.map(p=>({role:p.role,team:p.team,x:p.x|0,y:p.y|0,phase:p.phase||'',bombs:p.bombs})),stats:{...S.stats},cd:aiCd.map(c=>({...c}))});
S.tick=tick;S.spotTarget=spotTarget;S.air=()=>AIR;
if(window.IronFront)window.IronFront.aviation=S;
})();
