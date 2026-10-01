'use strict';
/* Iron Front 1.9 — sensação do Modo Soldado (soldier-feel.js). Carrega DEPOIS de classes.js. Só age com mode==='soldier'.
   Supressão sentida, sem barra:
     - quase-acerto: bala inimiga que passa a < 32 px do jogador levanta terra ao lado dele, dá um tranco na câmera, deixa um
       marcador na borda da tela apontando de onde veio o fogo e soma supressão (+.18 por bala, teto 2);
     - mira: a dispersão dos SEUS tiros cresce com a supressão (+.05 rad por ponto) e com o movimento (+.02);
     - câmera: tremor próprio (o ui-fix.js zera o screenShake do jogo), proporcional à supressão e às explosões perto;
       respeita a opção "Tremor de tela" do menu;
     - explosão perto: tranco forte e chuva de terra.
   Interação contextual (E), em ordem: arrastar/socorrer ferido (casualty.js) → assumir a metralhadora aliada a < 26 px
     (fita de 250, recarga 6,5 s, não anda com o tripé; E de novo devolve o seu soldado) → canhão (battery.js) → tanque (game.js).
   Dica de controles: a linha de atalhos do modo soldado sai de baixo do painel do soldado e passa a dizer o que o E fará agora.
   ?sensacao=0 desliga · IronFront.feel.state(). */
(function(){
if(!window.IFK)return;
const K=IFK,Z=K.Z,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('soldier-feel.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={NEAR:32,SUPP:.18,AIM_S:.05,AIM_MOVE:.02,KICK:2.2,THREAT:1.4,MG_R:26,BELT:250,MG_RELOAD:6.5};
const S=window.PXFEEL={on:K.on&&!/[?&]sensacao=0/.test(location.search),version:'1.9',cfg:CFG,stats:{nearMiss:0,kicks:0,mgMounts:0,mgShots:0,spreadAdded:0,errors:0}};
let errs=0,shake=0,threats=[],MG=null,hintT=0,lastHint='';
function fail(e){S.stats.errors++;if(++errs<=3)console.error('soldier-feel.js:',e);if(errs>=12){S.on=false;console.error('soldier-feel.js desligado após erros repetidos')}}
const active=()=>S.on&&mode==='soldier'&&player&&player.hp>0;
function shakeOn(){try{const s=JSON.parse(localStorage.getItem('ironfront.save.v1')||'{}');return !(s.opts&&+s.opts.shake===0)}catch{return true}}

/* ---------- metralhadora do jogador ---------- */
if(typeof weapons!=='undefined'&&!weapons.mg)weapons.mg={get name(){return playerTeam===1?'MG 08':'M1917 BROWNING'},mag:CFG.BELT,reload:CFG.MG_RELOAD,rate:.11,damage:13,range:330,spread:.045};
function nearMG(){let best=null,bd=CFG.MG_R*CFG.MG_R;for(const u of units){if(u===player||u.team!==player.team||u.type!=='mg'||u.hp<=0||u.down)continue;const d=(u.x-player.x)**2+(u.y-player.y)**2;if(d<bd){bd=d;best=u}}return best}
function mount(m){magazines[weapon]=ammo;MG={prev:player,prevWeapon:weapon,m,x:m.x,y:m.y};player=m;weapon='mg';ammo=m.belt??CFG.BELT;reload=0;m.cd=0;S.stats.mgMounts++;
 try{toast(`${weapons.mg.name} sob seu controle · fita de ${CFG.BELT} · E devolve o seu soldado`)}catch{}try{hud()}catch{}}
function dismount(msg){if(!MG)return;const m=MG.m;m.belt=ammo;const back=MG.prev&&MG.prev.hp>0&&!MG.prev.down?MG.prev:null;
 weapon=MG.prevWeapon in weapons&&MG.prevWeapon!=='mg'?MG.prevWeapon:'rifle';if(back)player=back;ammo=magazines[weapon]??weapons[weapon].mag;reload=0;MG=null;
 if(msg)try{toast(msg)}catch{}try{hud()}catch{}}
function keyE(){if(!active())return false;
 if(MG){dismount('Você deixou a metralhadora.');return true}
 if(player.type!=='rifle'||player.down||player.isDowned)return false;
 const m=nearMG();if(m){mount(m);return true}return false}
K.ePri.push(()=>active()&&(!!MG||player.type==='rifle'&&!player.down&&!!nearMG()));
window.addEventListener('keydown',e=>{if((e.key||'').toLowerCase()!=='e'||e.repeat)return;if(document.querySelector('dialog[open]'))return;
 try{if(keyE()){e.preventDefault();e.stopImmediatePropagation()}}catch(err){fail(err)}},true);
wrap('changeWeapon',(orig,next)=>{if(MG&&S.on){try{toast('Na metralhadora: E para sair antes de trocar de arma.')}catch{}return}return orig(next)});
wrap('setMode',(orig,next,...a)=>{if(MG&&next!=='soldier')dismount();return orig(next,...a)});

/* ---------- quase-acertos ---------- */
function nearMiss(dt){const P=player;for(const b of bullets){if(b.team===P.team||b._nm||!b.damage)continue;
  const px=b.x-b.vx*dt,py=b.y-b.vy*dt,dx=b.x-px,dy=b.y-py,L2=dx*dx+dy*dy||1,t=clamp(((P.x-px)*dx+(P.y-py)*dy)/L2,0,1),cx=px+dx*t,cy=py+dy*t,d=hyp(P.x-cx,P.y-cy);
  if(d>CFG.NEAR)continue;b._nm=1;S.stats.nearMiss++;P.suppression=Math.min(2,(P.suppression||0)+CFG.SUPP*(1-d/CFG.NEAR*.5));
  const sp=hyp(b.vx,b.vy)||1,ux=b.vx/sp,uy=b.vy/sp,k=rnd(8,26);
  for(let i=0;i<3;i++)particles.push({x:cx+ux*k+rnd(-3,3),y:cy+uy*k+rnd(-3,3),vx:rnd(-12,12),vy:rnd(-30,-10),t:rnd(.3,.6),max:.6,color:i?'#7d6a4b':'#a8946a',size:rnd(2,4)});
  threats.push({a:Math.atan2(-uy,-ux),t:time});if(threats.length>8)threats.shift();kick(CFG.KICK*(1-d/CFG.NEAR*.6))}}
function kick(v){if(!shakeOn())return;shake=Math.min(9,shake+v);S.stats.kicks++}

/* ---------- ligações ---------- */
wrap('update',(orig,dt)=>{if(!S.on||!started||ended)return orig(dt);
 const lock=MG&&player===MG.m?{x:player.x,y:player.y}:null;
 orig(dt);
 try{if(MG&&(MG.m.hp<=0||MG.m.down||mode!=='soldier')){dismount('A metralhadora foi atingida.')}
  if(lock&&MG&&player===MG.m){player.x=lock.x;player.y=lock.y}          // tripé: não anda
  if(active()){nearMiss(dt);const s=player.suppression||0;if(s>.5&&shakeOn())shake=Math.max(shake,(s-.5)*1.2);if(MG&&mouse.down)shake=Math.max(shake,.6)}
  shake=Math.max(0,shake-dt*14);threats=threats.filter(t=>time-t.t<CFG.THREAT);
  if((hintT-=dt)<=0){hintT=.4;hintLine()}}catch(e){fail(e)}});
wrap('shoot',(orig,u,target,manual=false)=>{if(!S.on||!manual||u!==player||mode!=='soldier'||u.type==='tank')return orig(u,target,manual);
 const n0=bullets.length,r=orig(u,target,manual);
 try{const s=Math.min(2,u.suppression||0),extra=CFG.AIM_S*s+(u.moving?CFG.AIM_MOVE:0);if(MG)S.stats.mgShots++;
  if(extra>0)for(let i=n0;i<bullets.length;i++){const b=bullets[i];if(b.team!==u.team)continue;const sp=hyp(b.vx,b.vy),a=Math.atan2(b.vy,b.vx)+rnd(-extra,extra);b.vx=Math.cos(a)*sp;b.vy=Math.sin(a)*sp;S.stats.spreadAdded++}
  if(MG)kick(.35)}catch(e){fail(e)}return r});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);try{if(!active())return;const d=hyp(player.x-x,player.y-y);if(d>r*3.2)return;
 kick(Math.min(9,r/9*(1-d/(r*3.2))*2));for(let i=0;i<Math.round(8*(1-d/(r*3.2)));i++)particles.push({x:player.x+rnd(-40,40),y:player.y+rnd(-40,40),vx:0,vy:rnd(10,30),t:rnd(.4,.9),max:.9,color:'#5e4f37',size:rnd(2,3)})}catch(e){fail(e)}});
/* tremor de câmera próprio (o ui-fix.js zera o screenShake do jogo) */
wrap('render',(orig,...a)=>{if(!S.on||shake<=.05||mode!=='soldier')return orig(...a);const ox=cam.x,oy=cam.y;cam.x+=rnd(-shake,shake);cam.y+=rnd(-shake,shake);try{return orig(...a)}finally{cam.x=ox;cam.y=oy}});

/* ---------- desenho: de onde vem o fogo ---------- */
function drawThreats(c,ox,oy){if(!active()||!threats.length)return;const px=ox+Math.round(player.x*Z),py=oy+Math.round(player.y*Z);
 for(const t of threats){const age=(time-t.t)/CFG.THREAT;if(age>=1)continue;const ca=Math.cos(t.a),sa=Math.sin(t.a);
  /* da posição do jogador até a borda da tela, na direção do atirador */
  const kx=ca>0?(vw-6-px)/ca:ca<0?(6-px)/ca:1e9,ky=sa>0?(vh-6-py)/sa:sa<0?(6-py)/sa:1e9,k=Math.min(kx,ky),x=Math.round(px+ca*k),y=Math.round(py+sa*k);
  c.globalAlpha=(1-age)*.9;c.fillStyle='#f0d68a';for(let i=0;i<4;i++){const bx=Math.round(x-ca*i*2),by=Math.round(y-sa*i*2),w=4-i;c.fillRect(bx-(w>>1),by-(w>>1),w,w)}
  c.fillStyle='#8a2a1c';c.fillRect(x-1,y-1,2,2);c.globalAlpha=1}
 if(MG&&player===MG.m){const t=`${weapons.mg.name} · ${ammo}/${CFG.BELT}`;K.text(c,t,px-(K.textW(t)>>1),py+10,'#efe9c8','#14160f')}}
if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on)return;try{drawThreats(c,ox,oy)}catch(e){fail(e)}}}

/* ---------- linha de dicas: fora do painel do soldado e dizendo o que o E faz agora ---------- */
try{const st=document.createElement('style');st.textContent='body[data-mode=soldier] #hintline{left:26.5rem;transform:none;max-width:calc(100vw - 26.5rem - var(--mmw,10rem) - 2rem)}';document.head.appendChild(st)}catch{}
function eAction(){if(!player)return '';const C=window.PXCAS;
 if(MG&&player===MG.m)return 'E sair da MG';
 if(C&&C.playerBusy&&C.playerBusy())return 'E soltar o ferido';
 if(player.type==='rifle'){for(const w of units)if(w!==player&&w.down&&w.team===player.team&&!w.inBed&&(w.x-player.x)**2+(w.y-player.y)**2<30*30)return player.cls==='medic'?'E socorrer':'E arrastar o ferido';
  if(nearMG())return 'E assumir a MG'}
 if(units.some(u=>u!==player&&u.team===player.team&&u.type===(player.type==='tank'?'rifle':'tank')&&hyp(u.x-player.x,u.y-player.y)<100))return player.type==='tank'?'E sair do tanque':'E tanque';
 return 'E canhão/saquear'}
function hintLine(){if(mode!=='soldier'||!player)return;const el=document.getElementById('hint');if(!el)return;
 const deep=player.lf&&player.lf.water===2,s=player.suppression||0;
 const parts=[deep?'ÁGUA FUNDA: sem tiro':s>1?'SOB FOGO: abaixe-se (Z) ou procure cobertura':'',eAction(),'WASD mover','SHIFT correr','R recarregar','G granada (segure p/ cozinhar)','C cone de visão','Z deitar','X baioneta','T apito','F ordem','H curativo'].filter(Boolean);
 const t=parts.join(' · ');if(t!==lastHint){lastHint=t;el.textContent=t}}

S.state=()=>({on:S.on,mg:MG?{belt:ammo,x:MG.x|0,y:MG.y|0}:null,shake:+shake.toFixed(2),threats:threats.length,stats:{...S.stats}});
S.mount=mount;S.dismount=dismount;S.keyE=keyE;S.nearMiss=nearMiss;S.hintLine=hintLine;
if(window.IronFront)window.IronFront.feel=S;
})();
