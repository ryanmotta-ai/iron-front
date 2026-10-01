'use strict';
/* Iron Front 1.9 — Modo Soldado: corpo e equipamento (soldier-gear.js).
   Carrega DEPOIS de soldier-feel.js (e de classes.js). Só age com mode==='soldier'. Nada daqui altera a IA.
   1  Fôlego .......... Shift + andar = corrida (x1,38, o fuzileiro leva 5 s até zerar; a arma fica baixada, sem tiro). Parado recupera
                        16/s, andando 7/s, deitado x1,5, ferido x0,6, de máscara x0,55. Chegou a zero = EXAUSTO até 28: anda a x0,82 e
                        não corre. Abaixo de 60 de fôlego a respiração pesa: a mira abre até +0,06 rad, o ferrolho demora até +40% e a
                        tela escurece nas bordas. Shift parado continua sendo a mira focada (botão direito mira em movimento).
   2  Ferrolho ........ fuzil de ferrolho (Springfield M1903 / Gewehr 98): depois do tiro o ferrolho precisa ser manobrado (EUA 1,2 s,
                        Alemanha 1,3 s; apoiado x0,85, andando x1,1, sem fôlego até x1,4). Substitui o intervalo fixo de 1,7 s de antes.
                        Mostra "FERROLHO" e solta o estojo no meio do ciclo. Trocar de arma não zera o ciclo.
   3  Munição finita .. SÓ do jogador: reserva em cartuchos por arma (fuzil 30, BAR/MP18 60, pistola 21, escopeta 18). Recarregar tira da
                        reserva (o fuzil recarrega mais rápido com o pente quase cheio). Reabastece no depósito de munição (works.js, a
                        140 px, gasta 1 do estoque) e saqueando corpos (E: +1/+2 pentes). A economia da IA não muda.
   4  Granada cozida .. segure G: o pavio queima (barra sobre a cabeça); solte para arremessar. Até 0,35 s é o arremesso rápido de
                        sempre (pavio de 1,55 s depois do lance); depois disso cada segundo segurado sai do pavio e a granada explode no ar
                        se o pavio acabar antes de ela cair. Passou de ~1,6 s: explode na sua mão.
   5  Cone de visão ... fora de um cone de ~124° (mira focada 80°, correndo 92°) a tela escurece e inimigos a mais de 160 m fora do cone
                        não são vistos. Tecla C liga/desliga (a escolha fica salva). IronFront.gear.vision({on,hide}).
   6  Frente (B7/U13)  setMode('soldier') e o renascimento escolhem um fuzileiro na linha de contato (perto do inimigo, não em corpo a
                        corpo, no setor da operação se houver); uma seta na borda da tela mostra onde a frente está.
   ?soldado=0 desliga o módulo · ?cone=0 só o cone · IronFront.gear.state() */
(function(){
const K=window.IFK||null;
const Z=(K&&K.Z)||(window.PX&&PX.Z)||.5,hyp=Math.hypot,PI=Math.PI,TAU=PI*2;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('soldier-gear.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const qs=(typeof location!=='undefined'&&location.search)||'';

const CFG={
 ST:{MAX:100,SPRINT:1.38,DRAIN:20,REG_STILL:16,REG_WALK:7,DELAY:.7,TIRED:.82,EXIT:28,BREATH_AT:60,AIM:.06,BOLT_B:.4,LOWHP:.35,LOWK:.6,MASKK:.55,PRONEK:1.5,LOWER:.3},
 BOLT:{T:[1.2,1.3],MOUNT:.85,MOVE:1.1},
 KIT:{rifle:{start:30,cap:42,loot:10},smg:{start:60,cap:80,loot:20},pistol:{start:21,cap:28,loot:7},shotgun:{start:18,cap:24,loot:6}},
 REL:{MIN:.4},
 GR:{PIN:.35,FUSE:1.55,WIND:.27,MIN:.04},
 CONE:{HALF:62,AIM:40,RUN:46,EXH:50,DARK:.6,STEP:3,S:5,HIDE_D:160,HIDE_K:1.55,EASE:140},
 DEPOT_EVERY:2.5,FRONT_EVERY:1.2};
const G=window.PXGEAR={on:!/[?&]soldado=0/.test(qs),version:'1.9',cfg:CFG,finite:true,bolt:true,cook:true,
 stats:{sprintS:0,exhaustions:0,bolts:0,reloads:0,loots:0,depotRefills:0,cooks:0,cookedMax:0,handBlasts:0,airbursts:0,errors:0,picks:0,coneDraws:0}};
let errs=0;function fail(e){G.stats.errors++;if(++errs<=3)console.error('soldier-gear.js:',e);if(errs>=12){G.on=false;console.error('soldier-gear.js desligado após erros repetidos')}}
const st={s:CFG.ST.MAX,exh:false,delay:0,sprinting:false,breath:0,moved:false,x:0,y:0,p:null};
let plan=null,prevReload=0,bolt={t:0,T:1,half:true},cook=null,pending=null,front=null,frontT=0,depT=0,breathT=0,noAmmoT=-9,last=null;
const say=s=>{try{if(typeof toast==='function')toast(s)}catch{}};
const snd=k=>{try{if(typeof sound==='function')sound(k)}catch{}};
const active=()=>G.on&&typeof mode!=='undefined'&&mode==='soldier'&&!!player&&player.hp>0;
const asl=()=>window.PXAS&&PXAS.player;
const moveKeys=()=>!!(keys.w||keys.a||keys.s||keys.d||keys.ArrowUp||keys.ArrowDown||keys.ArrowLeft||keys.ArrowRight);

/* ====================================================================================================================
   MUNIÇÃO FINITA (reserva por arma na unidade do jogador: u.kitG)
   ==================================================================================================================== */
const KIT=CFG.KIT;
const kitOf=u=>u&&u.type==='rifle'?(u.kitG||(u.kitG={res:{rifle:KIT.rifle.start,smg:KIT.smg.start,pistol:KIT.pistol.start,shotgun:KIT.shotgun.start}})):null;
const fin=()=>G.on&&G.finite&&typeof mode!=='undefined'&&mode==='soldier'&&!!player&&player.type==='rifle'&&!!KIT[weapon];
wrap('reloadGun',orig=>{
 if(!fin())return orig();
 const w=weapons[weapon],k=kitOf(player);
 if(reload||ammo>=w.mag)return orig();
 if(!(k.res[weapon]>0)){if(time-noAmmoT>1.5){noAmmoT=time;say('Sem munição para a '+w.name+'. Saqueie um corpo (E), vá a um depósito ou troque de arma (1-4).')}return}
 const r0=reload,miss=w.mag-ammo;orig();
 if(reload>0&&!r0){const take=Math.min(miss,k.res[weapon]);k.res[weapon]-=take;plan={u:player,w:weapon,take,target:ammo+take};
  if(weapon==='rifle'||weapon==='shotgun')reload=+(w.reload*(CFG.REL.MIN+(1-CFG.REL.MIN)*miss/w.mag)).toFixed(3)}});
function planCheckPre(){if(!plan)return;
 if(reload<=0||plan.u!==player||plan.w!==weapon){const k=plan.u&&plan.u.kitG;if(k)k.res[plan.w]=Math.min(KIT[plan.w].cap,k.res[plan.w]+plan.take);plan=null}}   // recarga interrompida: devolve os cartuchos
function planDone(){if(plan&&plan.u===player&&plan.w===weapon&&reload===0&&prevReload>0){ammo=Math.min(weapons[weapon].mag,plan.target);magazines[weapon]=ammo;plan=null;G.stats.reloads++}}
/* saque (E em corpo): +1 ou +2 pentes na reserva da arma em mãos. Chamado por soldier-tactics.js */
G.loot=function(){const p=player;const k=kitOf(p);let w=weapon;if(!k||!KIT[w])w='rifle';
 if(!k){if(typeof ammo!=='undefined'&&weapons[weapon]){ammo=weapons[weapon].mag;magazines[weapon]=ammo;reload=0}return false}
 const add=Math.min(KIT[w].loot,KIT[w].cap-k.res[w]);k.res[w]+=Math.max(0,add);G.stats.loots++;
 say(add>0?`Munição saqueada: +${add} cartuchos (${weapons[w].name}) · reserva ${k.res[w]}.`:`Reserva da ${weapons[w].name} cheia (${k.res[w]}).`);return true};
G.reserveOf=w=>{if(!G.on||!G.finite||typeof player==='undefined'||!player||player.type!=='rifle'||!KIT[w])return '';const k=kitOf(player);return k?' +'+k.res[w]:''};
function depot(){const W=window.PXWORKS;if(!W||!W.on||typeof W.depots!=='function'||!fin())return;const k=kitOf(player),r=(W.cfg&&W.cfg.DEPOT&&W.cfg.DEPOT.r)||140;
 for(const d of W.depots()){if(d.team!==player.team||!(d.stock>0)||!(d.hp>0)||hyp(d.x-player.x,d.y-player.y)>r)continue;
  let add=0;for(const w in KIT){const need=KIT[w].start-k.res[w];if(need>0){k.res[w]+=need;add+=need}}
  if(add>0){d.stock--;G.stats.depotRefills++;say(`Depósito: reserva reabastecida (+${add} cartuchos).`);return}}}

/* ====================================================================================================================
   FERROLHO
   ==================================================================================================================== */
const breathOf=()=>st.breath;
function boltTime(u){let t=CFG.BOLT.T[playerTeam?1:0];if(u.mounted)t*=CFG.BOLT.MOUNT;if(st.moved||u.moving)t*=CFG.BOLT.MOVE;return t*(1+CFG.ST.BOLT_B*breathOf())}
wrap('shoot',(orig,u,target,manual=false)=>{
 if(!G.on||!manual||u!==player||typeof mode==='undefined'||mode!=='soldier'||u.type==='tank'||u.type==='mg')return orig(u,target,manual);
 const n0=bullets.length,wp=weapon,r=orig(u,target,manual);
 try{if(bullets.length>n0){
   const b=breathOf(),ex=CFG.ST.AIM*b;
   if(ex>0)for(let i=n0;i<bullets.length;i++){const q=bullets[i];if(q.team!==u.team)continue;const sp=hyp(q.vx,q.vy),a=Math.atan2(q.vy,q.vx)+rnd(-ex,ex);q.vx=Math.cos(a)*sp;q.vy=Math.sin(a)*sp}
   if(wp==='rifle'&&G.bolt){const T=boltTime(u);u.cd=T;bolt={t:T,T,half:false};G.stats.bolts++}}}catch(e){fail(e)}
 return r});
wrap('changeWeapon',(orig,next)=>{const w0=weapon,r=orig(next);
 try{if(G.on&&G.bolt&&typeof weapon!=='undefined'&&weapon!==w0&&weapon==='rifle'&&bolt.t>0&&player)player.cd=Math.max(player.cd||0,bolt.t)}catch(e){fail(e)}return r});
function boltTick(dt){if(bolt.t<=0)return;bolt.t=Math.max(0,bolt.t-dt);
 if(!bolt.half&&bolt.t<=bolt.T*.55){bolt.half=true;snd('bolt');const p=player;if(p)particles.push({x:p.x,y:p.y-3,vx:rnd(-30,-8)*(Math.cos(p.angle||0)>0?-1:1),vy:rnd(-40,-18),t:.45,max:.45,color:'#c9a24a',size:3})}
 if(bolt.t<=0)snd('click')}

/* ====================================================================================================================
   FÔLEGO
   ==================================================================================================================== */
function canSprint(){const p=player;if(!p||typeof mode==='undefined'||mode!=='soldier'||p.type!=='rifle'||p.hp<=0||p.down||p.isDowned)return false;
 if(st.exh||st.s<=0||!(keys.Shift||keys.shift)||!moveKeys())return false;
 if(window.PXSC&&(PXSC.rmbDown||(PXSC.bayonetCharge&&PXSC.bayonetCharge.active)))return false;
 const a=asl();if(a&&a.prone)return false;if(cook)return false;
 if(window.PXCAS&&PXCAS.playerBusy&&PXCAS.playerBusy())return false;
 if(p.lf&&p.lf.water===2)return false;return true}
function stPre(dt){const p=player;st.sprinting=canSprint();st.p=p;if(p){st.x=p.x;st.y=p.y}
 if(st.sprinting)p.cd=Math.max(p.cd||0,CFG.ST.LOWER)}                      // correndo a arma fica baixada: não atira
function stPost(dt){const p=player,S=CFG.ST;
 if(!active()||p.type!=='rifle'||st.p!==p){st.sprinting=false;st.moved=false;st.s=Math.min(S.MAX,st.s+S.REG_STILL*dt);if(st.exh&&st.s>=S.EXIT)st.exh=false;st.breath=clamp((S.BREATH_AT-st.s)/S.BREATH_AT,0,1);return}
 let dx=p.x-st.x,dy=p.y-st.y;const lim=(200*dt)**2;st.moved=dx*dx+dy*dy>1e-4&&dx*dx+dy*dy<lim;
 let k=1;if(st.moved&&!p.down&&!p.isDowned){if(st.sprinting)k=S.SPRINT;else if(st.exh)k=S.TIRED}
 if(k!==1){p.x=clamp(st.x+dx*k,20,W-20);p.y=clamp(st.y+dy*k,20,H-20)}
 if(!st.moved)st.sprinting=false;
 const a=asl(),prone=!!(a&&a.prone),charge=!!(window.PXSC&&PXSC.bayonetCharge&&PXSC.bayonetCharge.active);
 let d=0;if(st.sprinting)d=S.DRAIN*(p.mask?1.3:1);if(charge)d=Math.max(d,S.DRAIN*1.2);
 if(window.PXCAS&&PXCAS.playerBusy&&PXCAS.playerBusy())d=Math.max(d,6);
 if(d>0){st.s=Math.max(0,st.s-d*dt);st.delay=S.DELAY;if(st.sprinting)G.stats.sprintS+=dt}
 else{st.delay=Math.max(0,st.delay-dt);if(st.delay<=0){let r=st.moved?S.REG_WALK:S.REG_STILL;if(prone)r*=S.PRONEK;if(p.hp/(p.maxhp||100)<S.LOWHP)r*=S.LOWK;if(p.mask)r*=S.MASKK;st.s=Math.min(S.MAX,st.s+r*dt)}}
 if(st.s<=0&&!st.exh){st.exh=true;G.stats.exhaustions++;say('Sem fôlego! Recupere antes de correr de novo.')}else if(st.exh&&st.s>=S.EXIT)st.exh=false;
 st.breath=clamp((S.BREATH_AT-st.s)/S.BREATH_AT,0,1);
 /* respiração pesada (som): ofegar enquanto o fôlego está baixo */
 if(st.breath>.3&&(breathT-=dt)<=0){breathT=1.5-st.breath*.7;breathe(st.breath)}}
function breathe(b){try{if(typeof soundOn==='undefined'||!soundOn||typeof audio==='undefined'||!audio)return;const a=audio,now=a.currentTime,len=Math.ceil(a.sampleRate*.38),buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);
 for(let i=0;i<len;i++){const t=i/len;d[i]=(Math.random()*2-1)*Math.sin(t*PI)*(t<.4?t/.4:(1-t)/.6)}
 const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=buf;f.type='bandpass';f.frequency.value=900;f.Q.value=.7;g.gain.value=.05+.07*b;s.connect(f);f.connect(g);g.connect(a.destination);s.start(now)}catch{}}

/* ====================================================================================================================
   GRANADA COZIDA (G)
   ==================================================================================================================== */
const truce=()=>!!(window.PXFORT&&PXFORT.isPrep&&PXFORT.isPrep());
function canCook(){return G.on&&G.cook&&typeof mode!=='undefined'&&mode==='soldier'&&!!player&&player.hp>0&&player.type==='rifle'&&!player.down&&!player.isDowned&&(player.gren|0)>0&&
 grenadeCooldown<=0&&!(player.thr>0)&&!cook&&!truce()&&!(window.PXBAT&&typeof PXBAT.manning==='function'&&PXBAT.manning())}
function startCook(){if(!canCook())return false;cook={t:0,p:player};return true}
function releaseCook(){if(!cook)return false;const c=cook;cook=null;if(!active()||c.p!==player||player.isDowned||player.down)return false;
 const g0=player.gren|0;window.grenade();                       // passa por fortify.js (trégua) e pelas regras do game.js
 if((player.gren|0)===g0)return false;
 pending={cook:c.t,at:time};G.stats.cooks++;G.stats.cookedMax=Math.max(G.stats.cookedMax,+c.t.toFixed(2));return true}
function cookTick(dt){if(pending&&time-pending.at>1.2)pending=null;if(!cook)return;
 if(!active()||cook.p!==player||player.isDowned||player.down||truce()){cook=null;return}
 cook.t+=dt;
 if(Math.random()<dt*22)particles.push({x:player.x+rnd(-2,2),y:player.y-8,vx:rnd(-25,25),vy:rnd(-45,-15),t:rnd(.15,.3),max:.3,color:cook.t>CFG.GR.PIN+CFG.GR.FUSE-.7?'#ff5a3c':'#ffd27a',size:2});
 if(cook.t>=CFG.GR.PIN+CFG.GR.FUSE-CFG.GR.WIND){cook=null;blowInHand()}}
function blowInHand(){const p=player;if(!p||!(p.gren>0))return;p.gren--;grenadeCooldown=7;const n=shells.length;throwGrenade(p,p.x,p.y,true);
 if(shells.length>n){const sh=shells[shells.length-1];sh.t=CFG.GR.MIN;sh.dur=CFG.GR.MIN}
 G.stats.handBlasts++;say('A granada explodiu na sua mão!')}
/* o pavio que sobra depois do lance: 1,55 s menos o que passou do pino (0,35 s de folga); lance + 0,27 s de braço também queimam */
wrap('throwGrenade',(orig,u,tx,ty,byPlayer)=>{const n=shells.length,r=orig(u,tx,ty,byPlayer);
 try{if(pending&&u===player&&typeof mode!=='undefined'&&mode==='soldier'&&shells.length>n){const sh=shells[shells.length-1],held=pending.cook+Math.max(0,time-pending.at),rem=Math.max(CFG.GR.MIN,CFG.GR.FUSE-Math.max(0,held-CFG.GR.PIN));
   sh.t=rem;sh.dur=rem;if(rem<sh.fl)G.stats.airbursts++;last={held:+held.toFixed(3),rem:+rem.toFixed(3),fl:+sh.fl.toFixed(3)};pending=null}}catch(e){fail(e)}
 return r});
window.addEventListener('keydown',e=>{if(!G.on||e.repeat)return;if(document.querySelector('dialog[open]'))return;if(typeof started!=='undefined'&&(!started||ended))return;
 const k=(e.key||'').toLowerCase();
 try{if(k==='g'){if(startCook()){e.preventDefault();e.stopImmediatePropagation()}}
 else if(k==='c'&&typeof mode!=='undefined'&&mode==='soldier'){V.toggle()}}catch(err){fail(err)}},true);
window.addEventListener('keyup',e=>{if((e.key||'').toLowerCase()==='g'){try{releaseCook()}catch(err){fail(err)}}},true);
window.addEventListener('blur',()=>{cook=null});

/* ====================================================================================================================
   FRENTE: escolha do soldado (B7) e seta na borda (U13)
   ==================================================================================================================== */
function rank(t){const cs=[],en=[];for(const u of units){if(u.hp<=0)continue;if(u.team!==t)en.push(u);
  else if(u.type==='rifle'&&!u.down&&!u.isDowned&&!u.inBed&&!u.carried&&u!==player)cs.push(u)}
 if(!cs.length)return[];
 const plan=window.IronFrontBrain&&IronFrontBrain.lastPlans&&IronFrontBrain.lastPlans[t],opY=plan&&plan.operation?plan.operation.y:null;
 return cs.map(u=>{let dE=1e18;for(const e of en){const d=(e.x-u.x)**2+(e.y-u.y)**2;if(d<dE)dE=d}dE=Math.sqrt(dE);
  const prog=t?W-u.x:u.x;let s=dE<900?(dE<80?300:0)+dE:900+(W-prog)*.3;       // contato: o mais perto do inimigo (sem corpo a corpo); sem contato: o mais avançado
  if(opY!=null)s+=Math.abs(u.y-opY)*.25;if(K&&K.inTrench&&K.inTrench(u))s-=30;return{u,s}}).sort((a,b)=>a.s-b.s)}
G.pick=function(){if(!G.on)return null;try{const r=rank(playerTeam);if(r.length)G.stats.picks++;return r.length?r[0].u:null}catch(e){fail(e);return null}};
G.frontInfo=function(){const r=rank(playerTeam);if(!r.length)return null;const top=r.slice(0,Math.min(6,r.length));let x=0,y=0;for(const q of top){x+=q.u.x;y+=q.u.y}return{x:x/top.length,y:y/top.length,n:top.length,contact:r[0].s<900}};
function frontTick(dt){if((frontT-=dt)>0)return;frontT=CFG.FRONT_EVERY;const f=G.frontInfo();if(!f){front=null;return}
 front=front?{x:front.x+(f.x-front.x)*.5,y:front.y+(f.y-front.y)*.5,contact:f.contact}:f}
function drawFront(c,ox,oy){if(!front||!active()||player.type==='tank')return;
 const d=hyp(front.x-player.x,front.y-player.y);if(d<180)return;
 const fx=ox+Math.round(front.x*Z),fy=oy+Math.round(front.y*Z);if(fx>14&&fy>14&&fx<vw-14&&fy<vh-14)return;      // já está na tela
 const px=ox+Math.round(player.x*Z),py=oy+Math.round(player.y*Z),a=Math.atan2(fy-py,fx-px),ca=Math.cos(a),sa=Math.sin(a),m=12;
 const kx=ca>0?(vw-m-px)/ca:ca<0?(m-px)/ca:1e9,ky=sa>0?(vh-m-py)/sa:sa<0?(m-py)/sa:1e9,k=Math.max(0,Math.min(kx,ky)),x=Math.round(px+ca*k),y=Math.round(py+sa*k);
 const pulse=.75+.25*Math.sin(time*5);c.save();c.globalAlpha=pulse;c.translate(x,y);c.rotate(a);
 c.fillStyle='#14160f';c.beginPath();c.moveTo(9,0);c.lineTo(-5,-6);c.lineTo(-2,0);c.lineTo(-5,6);c.closePath();c.fill();
 c.fillStyle=front.contact?'#e8d27a':'#bcd2d8';c.beginPath();c.moveTo(7,0);c.lineTo(-3,-4);c.lineTo(-1,0);c.lineTo(-3,4);c.closePath();c.fill();c.restore();
 const t=`FRENTE ${Math.round(d)}M`,w=K&&K.textW?K.textW(t):t.length*4;let tx=clamp(x-(w>>1)-ca*14,3,vw-w-3),ty=clamp(y-3-sa*12,3,vh-9);
 if(K&&K.text){c.globalAlpha=.95;c.fillStyle='rgba(18,20,14,.7)';c.fillRect(tx-2,ty-2,w+4,9);K.text(c,t,tx,ty,front.contact?'#e8d27a':'#bcd2d8')}c.globalAlpha=1}

/* ====================================================================================================================
   CONE DE VISÃO
   ==================================================================================================================== */
const CN=CFG.CONE;
const V=G.vision={on:!/[?&]cone=0/.test(qs),hide:true,half:CN.HALF,ang:0,masks:new Map(),prof:false,ms:0,n:0,
 toggle(){V.on=!V.on;try{localStorage.setItem('ironfront.gear.cone',V.on?'1':'0')}catch{}say(V.on?'Cone de visão LIGADO (C).':'Cone de visão desligado (C).');return V.on},
 set(o){if(!o)return V.on;if('on' in o)V.on=!!o.on;if('hide' in o)V.hide=!!o.hide;return V.on}};
try{const s=localStorage.getItem('ironfront.gear.cone');if(s==='0')V.on=false;else if(s==='1'&&!/[?&]cone=0/.test(qs))V.on=true}catch{}
function maskFor(q,R){const key=q+':'+R;let m=V.masks.get(key);if(m)return m;
 if(typeof document==='undefined')return null;const s=CN.S,size=Math.ceil(2*R/s);m=document.createElement('canvas');m.width=m.height=size;const g=m.getContext&&m.getContext('2d');if(!g||!g.fillRect)return null;
 const cx=size/2,cy=size/2,half=q*PI/180;g.globalCompositeOperation='source-over';g.fillStyle='rgba(5,8,4,'+CN.DARK+')';g.fillRect(0,0,size,size);
 g.globalCompositeOperation='destination-out';g.fillStyle='rgba(0,0,0,.38)';
 for(const [hm,rad] of [[1.55,560],[1.32,500],[1.12,450],[.95,410],[.78,370]]){g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,rad/s,-half*hm,half*hm);g.closePath();g.fill()}
 for(const rad of [78,60,44]){g.beginPath();g.arc(cx,cy,rad/s,0,TAU);g.fill()}
 g.globalCompositeOperation='source-over';m.__s=s;
 if(V.masks.size>24)V.masks.delete(V.masks.keys().next().value);V.masks.set(key,m);return m}
function coneTarget(){const p=player;if(p.aiming)return CN.AIM;if(st.sprinting)return CN.RUN;if(st.exh)return CN.EXH;return CN.HALF}
function coneState(dt){if(!active()||player.type==='tank')return;const t=coneTarget();V.half+=clamp(t-V.half,-CN.EASE*dt,CN.EASE*dt);
 let da=(player.angle||0)-V.ang;da=Math.atan2(Math.sin(da),Math.cos(da));V.ang+=da*Math.min(1,dt*18)}
function drawCone(c,ox,oy){if(!V.on||!active()||player.type==='tank')return;
 const t0=V.prof&&typeof performance!=='undefined'?performance.now():0;
 const px=ox+Math.round(player.x*Z),py=oy+Math.round(player.y*Z),R=Math.ceil(hyp(vw,vh))+16,q=Math.round(V.half/CN.STEP)*CN.STEP,m=maskFor(q,R);if(!m)return;
 const w=m.width*m.__s;c.save();c.imageSmoothingEnabled=true;c.translate(px,py);c.rotate(V.ang);c.drawImage(m,-w/2,-w/2,w,w);c.restore();G.stats.coneDraws++;
 if(t0){V.ms+=performance.now()-t0;V.n++}}
/* inimigos fora do cone (além de 160 m) não são vistos: só durante o render, para não mexer na decisão da IA */
function hidden(u){if(u.team===player.team||u===player)return false;const dx=u.x-player.x,dy=u.y-player.y,d=hyp(dx,dy);if(d<CN.HIDE_D)return false;
 let da=Math.atan2(dy,dx)-V.ang;da=Math.abs(Math.atan2(Math.sin(da),Math.cos(da)));return da>V.half*PI/180*CN.HIDE_K}
wrap('render',(orig,...a)=>{if(!G.on||!V.on||!V.hide||typeof mode==='undefined'||mode!=='soldier'||!player||player.hp<=0||player.type==='tank'||!window.PXW||typeof PXW.visible!=='function')return orig(...a);
 const v0=PXW.visible;PXW.visible=function(u){return v0(u)&&!hidden(u)};try{return orig(...a)}finally{PXW.visible=v0}});

/* ====================================================================================================================
   DESENHO (barras, ferrolho, pavio, borda de respiração)
   ==================================================================================================================== */
const txt=(c,t,x,y,col)=>{if(K&&K.text)K.text(c,t,x,y,col,'#14160f')};
function drawHud(c,ox,oy){if(!active())return;const px=ox+Math.round(player.x*Z),py=oy+Math.round(player.y*Z);
 /* fôlego: barra pequena sob os pés, só quando falta ar */
 if(player.type==='rifle'&&(st.s<CFG.ST.MAX-.5||st.sprinting)){const f=st.s/CFG.ST.MAX,w=18,x=px-9,y=py+11;c.fillStyle='#14160f';c.fillRect(x-1,y-1,w+2,4);c.fillStyle='#3b4431';c.fillRect(x,y,w,2);
  c.fillStyle=st.exh?'#e0705a':f>.6?'#b8d68b':f>.3?'#e3c463':'#e0705a';c.fillRect(x,y,Math.max(1,Math.round(w*f)),2);if(st.exh&&((time*4)|0)%2===0)txt(c,'EXAUSTO',px-13,y+5,'#f2d6c8')}
 /* ferrolho */
 if(bolt.t>.05&&weapon==='rifle'&&player.type==='rifle'){const f=1-bolt.t/bolt.T,w=18,x=px-9,y=py+(st.s<CFG.ST.MAX-.5?17:11);c.fillStyle='#14160f';c.fillRect(x-1,y-1,w+2,3);c.fillStyle='#4a4430';c.fillRect(x,y,w,1);c.fillStyle='#d9c27a';c.fillRect(x,y,Math.round(w*f),1);
  if(bolt.t>.25)txt(c,'FERROLHO',px-15,y+3,'#d9c27a')}
 /* granada cozida: pavio sobre a cabeça, alvo do lance e aviso de explosão no ar */
 if(cook){const rem=CFG.GR.FUSE-Math.max(0,cook.t+CFG.GR.WIND-CFG.GR.PIN),f=clamp(rem/CFG.GR.FUSE,0,1),w=20,x=px-10,y=py-34,hot=rem<.7;
  c.fillStyle='#14160f';c.fillRect(x-1,y-1,w+2,5);c.fillStyle='#3b3a2a';c.fillRect(x,y,w,3);c.fillStyle=hot?'#e0705a':'#e3c463';c.fillRect(x,y,Math.round(w*f),3);
  if(((time*14)|0)%2===0){c.fillStyle='#fff3c2';c.fillRect(x+Math.round(w*f),y-1,1,5)}
  const dx=mouse.wx-player.x,dy=mouse.wy-player.y,d=hyp(dx,dy)||1,rg=Math.min(d,180),fl=.38+rg/380,tx=ox+Math.round((player.x+dx/d*rg)*Z),ty=oy+Math.round((player.y+dy/d*rg)*Z),air=Math.max(CFG.GR.MIN,rem)<fl;
  c.globalAlpha=.8;c.strokeStyle=air?'#e0705a':'#efe9c8';c.lineWidth=1;c.beginPath();c.arc(tx,ty,Math.round(65*Z),0,TAU);c.stroke();c.globalAlpha=1;
  txt(c,(rem>0?rem.toFixed(1):'0.0')+(air?' AR':''),px-8,y-7,hot?'#f2b0a0':'#efe9c8')}
 /* respiração pesada: bordas escuras que pulsam */
 const b=st.breath;if(b>.2&&player.type==='rifle'){const a=Math.min(.38,b*.4)*(.7+.3*Math.sin(time*9));c.fillStyle='#0b0d08';for(const [t,k] of [[5,1],[10,.55],[16,.3]]){c.globalAlpha=a*k;c.fillRect(0,0,vw,t);c.fillRect(0,vh-t,vw,t);c.fillRect(0,t,t,vh-2*t);c.fillRect(vw-t,t,t,vh-2*t)}c.globalAlpha=1}
 drawFront(c,ox,oy)}
if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){if(G.on){try{drawCone(c,ox,oy)}catch(e){fail(e)}}o0.call(this,c,ox,oy,dt);if(!G.on)return;try{drawHud(c,ox,oy)}catch(e){fail(e)}}}

/* ====================================================================================================================
   LIGAÇÕES
   ==================================================================================================================== */
wrap('update',(orig,dt)=>{if(!G.on||typeof started==='undefined'||!started||ended||!(dt>0))return orig(dt);
 try{planCheckPre();prevReload=reload;stPre(dt)}catch(e){fail(e)}
 orig(dt);
 try{planDone();stPost(dt);boltTick(dt);cookTick(dt);coneState(dt);if(active()){frontTick(dt);if((depT-=dt)<=0){depT=CFG.DEPOT_EVERY;depot()}}}catch(e){fail(e)}});
wrap('setup',(orig,...a)=>{plan=null;cook=null;pending=null;front=null;frontT=0;depT=0;bolt={t:0,T:1,half:true};st.s=CFG.ST.MAX;st.exh=false;st.sprinting=false;st.delay=0;st.breath=0;return orig(...a)});
wrap('setMode',(orig,next,...a)=>{if(next!=='soldier')cook=null;return orig(next,...a)});

G.state=()=>({on:G.on,stamina:+st.s.toFixed(1),exhausted:st.exh,sprinting:st.sprinting,breath:+st.breath.toFixed(2),bolt:{t:+bolt.t.toFixed(2),T:+bolt.T.toFixed(2)},
 kit:player&&player.kitG?{...player.kitG.res}:null,cook:cook?+cook.t.toFixed(2):null,lastThrow:last,front:front?{x:front.x|0,y:front.y|0,contact:front.contact}:null,
 vision:{on:V.on,hide:V.hide,half:+V.half.toFixed(1),avgMs:V.n?+(V.ms/V.n).toFixed(3):null},stats:{...G.stats}});
G.st=st;G.kitOf=kitOf;G.startCook=startCook;G.releaseCook=releaseCook;G.depot=depot;G.hidden=hidden;G.drawCone=drawCone;G.drawHud=drawHud;G.boltTime=boltTime;
if(window.IronFront)window.IronFront.gear=G;
})();
