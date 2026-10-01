'use strict';
/* Iron Front 1.9 — classes de infantaria com função própria (classes.js). Carrega DEPOIS de casualty.js.
   Toda classe é um fuzileiro (u.type==='rifle') com u.cls: medics.js, Brain, assault.js, sappers.js e casualty.js
   continuam funcionando. Pioneiros (u.sap) não recebem classe.
   Distribuição automática (vale para o exército inicial e para TODA compra de fuzileiros, inclusive da IA, sem tocar no ai.js):
   a cada 16 fuzileiros de um lado → 2 granadeiros, 1 médico, 1 atirador designado; a cada 48 → 1 observador de artilharia.
   Cartas novas (aba TROPAS): "Tropas de assalto" (6, ◈150) e "Seção de especialistas" (médico, granadeiro, atirador, observador; ◈140).
   A IA recebe 1 grupo de assalto por lado no início e converte 1 a cada 4 esquadrões de fuzileiros que compra.

   Médico ......... não combate (braçadeira da Cruz Vermelha): não atira e o inimigo não mira nele a mais de 60 px. O resgate,
                    os primeiros socorros e a estabilização estão no casualty.js (raio 300 px, sem limite de vagas).
   Granadeiro ..... bocal de granada de fuzil (VB / Gewehrgranate): 6 granadas, alcance 60–190 px (o fuzileiro joga até 135 e
                    só no alvo atual). Procura MG, bunker e grupos abrigados; granada sua no ninho: +120 de dano à obra (3 granadas derrubam um bunker de madeira) e
                    +60 à guarnição a até 34 px (estilhaço dentro do abrigo).
   Atirador ....... fuzil escolhido com luneta simples: alcance 340 px (o fuzileiro 240), dispersão de 0,09 → 0,025 rad e
                    cadência 1,4× mais lenta. Prioriza guarnição de MG, observador e granadeiro inimigos.
   Observador ..... binóculo: não avança na linha (dispara pouco). Artilharia do seu lado num alvo a até 520 px dele tem
                    dispersão −50% (soma com o avião de reconhecimento). Com a IA ligada, pede fogo (a cada 45 s por lado) sobre
                    MG ou grupo de 5+ inimigos que ele enxerga, longe de tropa amiga.
   Assalto ........ Stoßtrupp / trench raiders: 25% mais rápidos, supressão some 2× mais rápido (seguem sob fogo), 4 granadas de
                    mão jogadas em quem está abrigado a 50–130 px, golpe corpo a corpo (pá, porrete, baioneta) a < 20 px
                    (55 de dano, 1,1 s) e infiltração: o inimigo não os escolhe como alvo a mais de 200 px enquanto avançam.
   ?classes=0 desliga · IronFront.classes.state(). */
(function(){
if(!window.IFK)return;
const K=IFK,Z=K.Z,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('classes.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={MEDIC_SAFE:60,GREN:{n:6,min:60,max:190,cd:6,bld:120,crew:60,r:34},MARK:{range:340,spread:.025,slow:1.4},
 OBS:{see:520,spread:.5,cd:45,cluster:5,clusterR:160,safe:90},ASLT:{speed:1.25,supp:2,gren:4,min:50,max:130,cd:4,melee:20,hit:55,mcd:1.1,hide:200},
 PATTERN:{3:'grenadier',11:'grenadier',6:'medic',13:'marksman'},OBS_EVERY:48};
const S=window.PXCLS={on:!/[?&]classes=0/.test(location.search)&&K.on,version:'1.9',cfg:CFG,
 stats:{grenRifle:0,grenBonus:0,markLong:0,markHits:0,obsCorrected:0,obsCalls:0,melee:0,meleeKills:0,aslGren:0,errors:0}};
const NAME={medic:'Médico',grenadier:'Granadeiro',marksman:'Atirador designado',observer:'Observador de artilharia',assault:'Tropa de assalto'};
S.NAME=NAME;
let errs=0,seq=[0,0],buys=[0,0],spec=0,obsCd=[0,0],TRACK=[],slow=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('classes.js:',e);if(errs>=12){S.on=false;console.error('classes.js desligado após erros repetidos')}}
const isAI=u=>!(u===player&&mode==='soldier');
const live=u=>u&&u.hp>0&&!u.down;
const visibleTo=(team,e)=>!(window.PXW&&PXW.visible&&team===playerTeam)||PXW.visible(e);
function give(u,cls){if(!u||u.type!=='rifle'||u.sap&&!u.sapTmp)return u;u.cls=cls;
 if(cls==='grenadier')u.gren=CFG.GREN.n;if(cls==='assault')u.gren=CFG.ASLT.gren;if(cls==='medic'){u.gren=0}u.ccd=rnd(0,2);return u}
S.give=give;

/* ---------- distribuição ---------- */
defs.assault={name:'Tropas de assalto',sub:'6 · granadas, investida, infiltração',cost:150,count:6,hp:100,speed:47,range:220,rate:1.5,damage:30};
defs.specialists={name:'Especialistas',sub:'Médico · granadeiro · atirador · observador',cost:140,count:4,hp:100,speed:47,range:240,rate:1.5,damage:30};
const SPEC=['medic','grenadier','marksman','observer'];
wrap('newUnit',(orig,type,team,x,y)=>{
 if(type==='assault')return give(orig('rifle',team,x,y),'assault');
 if(type==='specialists')return give(orig('rifle',team,x,y),SPEC[spec++%4]);
 const u=orig(type,team,x,y);if(!S.on||type!=='rifle')return u;
 const k=++seq[team];if(k%CFG.OBS_EVERY===21)return give(u,'observer');const c=CFG.PATTERN[k%16];return c?give(u,c):u});
wrap('squad',(orig,type,team,x,y,count)=>{const before=units.length;const r=orig(type,team,x,y,count);
 try{if(S.on&&type==='rifle'&&started&&aiEnabled[team]&&++buys[team]%4===0){for(const u of units.slice(before,before+6))if(u.team===team&&!u.sap)give(u,'assault')}}catch(e){fail(e)}return r});
function seedAssault(){/* 1 grupo de assalto por lado: os 6 fuzileiros sem classe mais à frente */
 for(let t=0;t<2;t++){const f=t?-1:1,cand=units.filter(u=>u.team===t&&u.type==='rifle'&&!u.cls&&(!u.sap||u.sapTmp)).sort((a,b)=>(b.x-a.x)*f);for(const u of cand.slice(0,6))give(u,'assault')}}

/* ---------- médico: não combatente ---------- */
const Brain=window.IronFrontBrain;
if(Brain&&typeof Brain.selectTarget==='function'){const st=Brain.selectTarget;Brain.selectTarget=function(u,list,range,canHit){
 if(!S.on)return st.call(this,u,list,range,canHit);
 return st.call(this,u,list,range,(a,e)=>{if(e.cls==='medic'&&isAI(e)&&hyp(a.x-e.x,a.y-e.y)>CFG.MEDIC_SAFE)return false;
  if(e.cls==='assault'&&e.moving&&hyp(a.x-e.x,a.y-e.y)>CFG.ASLT.hide)return false;return !canHit||canHit(a,e)})}}

/* ---------- granada de fuzil e granada de assalto ---------- */
function pickGrenTarget(u,min,max,pref){let best=null,bs=0;const t=u.team;
 for(const e of units){if(e.team===t||!live(e)||e.type==='tank')continue;const d=hyp(e.x-u.x,e.y-u.y);if(d<min||d>max||!visibleTo(t,e))continue;
  let s=0;if(pref==='nest'){s=e.type==='mg'?3:0;try{if(protectedBy(e)<.5)s+=1.2}catch{}}else{try{if(protectedBy(e)<.6)s=2}catch{}}
  if(!s)continue;let near=0;for(const o of units)if(o.team!==t&&live(o)&&(o.x-e.x)**2+(o.y-e.y)**2<45*45)near++;s+=near*.4;
  for(const o of units)if(o.team===t&&o!==u&&(o.x-e.x)**2+(o.y-e.y)**2<55*55){s=0;break}       // não joga em cima de amigo
  if(s>bs){bs=s;best={x:e.x,y:e.y}}}
 if(pref==='nest')for(const b of buildings){if(b.team===t||b.type!=='bunker'&&b.type!=='pillbox')continue;const d=hyp(b.x-u.x,b.y-u.y);if(d<min||d>max)continue;if(3.5>bs){bs=3.5;best={x:b.x,y:b.y}}}
 return best}
function rifleGrenade(u,tg){u.gren--;u.ccd=CFG.GREN.cd;const n=shells.length;throwGrenade(u,tg.x,tg.y,true);
 const sh=shells[n];if(sh){sh.r=48;sh.power=130;sh.byCls='grenadier';TRACK.push({sh,x:sh.x,y:sh.y,team:u.team})}S.stats.grenRifle++;u.angle=Math.atan2(tg.y-u.y,tg.x-u.x)}
function handGrenade(u,tg){u.gren--;u.ccd=CFG.ASLT.cd;u.thr=.55;u.tg={x:tg.x,y:tg.y};S.stats.aslGren++;if(Math.random()<.5)K.shout(u,'grenade',1)}
function trackTick(){for(let i=TRACK.length-1;i>=0;i--){const k=TRACK[i];if(shells.includes(k.sh)){k.x=k.sh.x;k.y=k.sh.y;continue}TRACK.splice(i,1);
  let hit=false;for(const b of buildings){if(b.team===k.team||(b.type!=='bunker'&&b.type!=='pillbox'))continue;if(hyp(b.x-k.x,b.y-k.y)<CFG.GREN.r+12){b.hp-=CFG.GREN.bld;hit=true}}
  for(const e of units){if(e.team===k.team||!live(e)||e.type!=='mg')continue;if(hyp(e.x-k.x,e.y-k.y)<CFG.GREN.r){damage(e,CFG.GREN.crew,k.team);hit=true}}
  if(hit)S.stats.grenBonus++}}

/* ---------- atirador designado ---------- */
function markTarget(u){let best=null,bs=0;const R=sightRange(CFG.MARK.range);
 for(const e of units){if(e.team===u.team||!live(e)||e.type==='tank')continue;const d=hyp(e.x-u.x,e.y-u.y);if(d>R||!visibleTo(u.team,e))continue;
  const s=(e.type==='mg'?3:e.cls==='observer'?2.5:e.cls==='grenadier'||e.cls==='marksman'?2:1)*(1-d/R*.5);if(s>bs){bs=s;best=e}}return best}
function aimBullet(u,target,n0,range){for(let i=bullets.length-1;i>=n0;i--){const b=bullets[i];if(b.team!==u.team)continue;
 const a=Math.atan2(target.y-u.y,target.x-u.x)+rnd(-CFG.MARK.spread,CFG.MARK.spread),sp=hyp(b.vx,b.vy)||800;b.vx=Math.cos(a)*sp;b.vy=Math.sin(a)*sp;b.t=range/sp;b.mark=1;return b}return null}
wrap('shoot',(orig,u,target,manual=false)=>{
 if(!S.on||manual||!u||u.cls!=='marksman'||!target)return orig(u,target,manual);
 const n0=bullets.length;const r=orig(u,target,manual);try{aimBullet(u,target,n0,CFG.MARK.range);u.cd*=CFG.MARK.slow}catch(e){fail(e)}return r});

/* ---------- observador ---------- */
function observerOf(team,x,y){for(const u of units){if(u.team!==team||u.cls!=='observer'||!live(u))continue;if(hyp(u.x-x,u.y-y)>CFG.OBS.see)continue;
  if(window.PXBAT&&PXBAT.smokeBlocks&&PXBAT.smokeBlocks(u,{x,y}))continue;return u}return null}
S.observerOf=observerOf;
if(window.PXBAT&&PXBAT.mission){const o=PXBAT.mission;PXBAT.mission=function(team,x,y,count,spread,kind,cb,strict){
 if(S.on&&kind!=='smoke'){const ob=observerOf(team,x,y);if(ob){spread*=CFG.OBS.spread;S.stats.obsCorrected++;ob.obsT=time+6;
   if(team===playerTeam)note('obs','Observador de artilharia corrigindo o tiro: dispersão −50%.')}}
 return o.call(this,team,x,y,count,spread,kind,cb,strict)}}
let noteAt={};function note(k,m){if(time-(noteAt[k]||-99)<20)return;noteAt[k]=time;try{toast(m)}catch{}}
function observerCall(u){const t=u.team;if(!aiEnabled[t]||time<obsCd[t]||!window.PXBAT||!PXBAT.mission)return;
 let best=null,bs=0;
 for(const e of units){if(e.team===t||!live(e))continue;const d=hyp(e.x-u.x,e.y-u.y);if(d>CFG.OBS.see||d<120)continue;
  let n=0;for(const o of units)if(o.team!==t&&live(o)&&(o.x-e.x)**2+(o.y-e.y)**2<CFG.OBS.clusterR**2)n++;
  const s=e.type==='mg'?CFG.OBS.cluster+1:n;if(s<CFG.OBS.cluster)continue;
  let safe=true;for(const o of units)if(o.team===t&&(o.x-e.x)**2+(o.y-e.y)**2<CFG.OBS.safe**2){safe=false;break}if(!safe)continue;
  if(s>bs){bs=s;best=e}}
 if(!best)return;obsCd[t]=time+CFG.OBS.cd;
 const ok=PXBAT.mission(t,best.x,best.y,4,70,'he');if(ok!==false){S.stats.obsCalls++;u.obsT=time+8;K.shout(u,'target',1.4)}}

/* ---------- assalto: corpo a corpo ---------- */
function melee(u){const near=typeof nearest==='function'?nearest(u,CFG.ASLT.melee):null;if(typeof nearest==='function'&&!near)return false;   // grade espacial do jogo: só testa quem já está a < 20 px
 for(const e of near?[near]:units){if(e.team===u.team||!live(e)||e.type==='tank'||e.type==='cavalry')continue;if((e.x-u.x)**2+(e.y-u.y)**2>CFG.ASLT.melee**2)continue;
  u.mcd2=CFG.ASLT.mcd;u.angle=Math.atan2(e.y-u.y,e.x-u.x);u.lunge2=time+.25;const hp0=e.hp;damage(e,CFG.ASLT.hit*rnd(.8,1.2),u.team);S.stats.melee++;if(e.hp<=0&&hp0>0||e.down)S.stats.meleeKills++;
  particles.push({x:e.x,y:e.y-2,vx:0,vy:0,t:.15,max:.15,color:'#e9d6a5',size:6});return true}return false}

/* ---------- tique ---------- */
const PRE=[];
function tick(dt){slow-=dt;const heavy=slow<=0;if(heavy)slow=.25;
 trackTick();
 for(const u of units){if(!u.cls)continue;if(u.sap){if(!u.sapTmp)delete u.cls;continue}if(!live(u)||!isAI(u))continue;   // pioneiro de verdade perde a classe; o da trégua (sapTmp) só pausa
  u.ccd=(u.ccd||0)-dt;
  switch(u.cls){
  case 'medic':u.cd=Math.max(u.cd||0,.6);break;
  case 'observer':if(heavy&&Math.random()<.25)observerCall(u);
   if(u.target&&u.cd<=0&&Math.random()<.6)u.cd=1.2;break;                        // dispara pouco: está olhando
  case 'grenadier':if(heavy&&u.ccd<=0&&u.gren>0&&!(u.thr>0)&&(u.suppression||0)<1.2&&!u.rs){const tg=pickGrenTarget(u,CFG.GREN.min,CFG.GREN.max,'nest');if(tg)rifleGrenade(u,tg)}break;
  case 'marksman':if(heavy&&u.cd<=0&&!u.rs&&(u.suppression||0)<1&&!(u.rl>0)){const tg=markTarget(u);if(tg&&hyp(tg.x-u.x,tg.y-u.y)>sightRange(defs.rifle.range)*.95&&(!Brain||!Brain.safeShot||Brain.safeShot(u,tg,units,decor,buildings))){
    const n0=bullets.length;shoot(u,tg);if(bullets.length>n0)S.stats.markLong++;if(u.ammo!==undefined&&--u.ammo<=0)u.rl=2.4}}break;
  case 'assault':u.suppression=Math.max(0,(u.suppression||0)-dt*.18*(CFG.ASLT.supp-1));if(u.pinned&&u.suppression<1)u.pinned=false;
   u.mcd2=(u.mcd2||0)-dt;if(u.mcd2<=0&&!u.rs)melee(u);
   if(heavy&&u.ccd<=0&&u.gren>0&&!(u.thr>0)&&!u.rs){const tg=pickGrenTarget(u,CFG.ASLT.min,CFG.ASLT.max,'cover');if(tg)handGrenade(u,tg)}break}}}
wrap('setup',(orig,...a)=>{seq=[0,0];buys=[0,0];spec=0;obsCd=[0,0];TRACK=[];const r=orig(...a);try{if(S.on)seedAssault()}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{if(!S.on||!started||ended)return orig(dt);
 PRE.length=0;for(const u of units)if(u.cls==='assault'&&isAI(u)&&!u.down&&!u.rs){u._kx=u.x;u._ky=u.y;PRE.push(u)}
 orig(dt);
 try{for(const u of PRE){if(u.hp<=0)continue;const dx=u.x-u._kx,dy=u.y-u._ky;if(dx*dx+dy*dy<400*dt*dt*400){u.x=clamp(u._kx+dx*CFG.ASLT.speed,15,W-15);u.y=clamp(u._ky+dy*CFG.ASLT.speed,15,H-15)}}
  tick(dt)}catch(e){fail(e)}});

/* ---------- cartas ---------- */
const NAT={assault:['Trench Raiders','Stoßtrupp']};
wrap('makeCards',orig=>{orig();try{if(!S.on||tab!=='units')return;
 for(const [type,key] of [['assault','7'],['specialists','8']]){const d=defs[type],b=document.createElement('button');b.className='card'+(placement===type?' active':'');
  b.innerHTML=`<canvas width="48" height="48"></canvas><b>${type==='assault'?NAT.assault[playerTeam]:d.name}</b><small>${d.sub}</small><span class="cost">◈ ${sandbox?'∞':d.cost}</span><kbd>${key}</kbd>`;
  b.onclick=()=>choose(type);document.getElementById('cards').append(b);icon(type,b.querySelector('canvas').getContext('2d'))}}catch(e){fail(e)}});
wrap('icon',(orig,type,c)=>{if(type!=='assault'&&type!=='specialists')return orig(type,c);orig('rifle',c);const k=c.canvas.width/48,p=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x*k),Math.round(y*k),Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k)))};
 if(type==='assault'){for(const [x,y] of [[33,30],[37,33],[33,36]]){p(x,y,4,4,'#1a2017');p(x+1,y+1,2,2,'#5d6a4a');p(x+1,y-2,1,2,'#8a6a44')}}
 else{p(32,30,9,9,'#1a2017');p(33,31,7,7,'#f2efe4');p(36,32,1,5,'#c0302a');p(34,34,5,1,'#c0302a')}});

/* ---------- desenho: o que identifica cada classe no campo ---------- */
function mark(c,u,sp,sx,sy){const dy=(K.poseU===u?K.poseDy:0),x=sx,y=sy+dy;
 switch(u.cls){
 case 'medic':c.fillStyle='#f2efe4';c.fillRect(x-4,y-2,2,2);c.fillStyle='#c0302a';c.fillRect(x-4,y-2,1,1);break;      // braçadeira da Cruz Vermelha
 case 'grenadier':c.fillStyle='#3d3a2a';c.fillRect(x-3,y+1,2,2);c.fillRect(x+1,y+1,2,2);c.fillStyle='#6d6a4a';c.fillRect(x-3,y+1,1,1);c.fillRect(x+1,y+1,1,1);break; // bolsas
 case 'marksman':if(((time*1.3+u.id)%5)<.15){c.fillStyle='#fff6d0';c.fillRect(x+Math.round(Math.cos(u.angle)*5),y-2+Math.round(Math.sin(u.angle)*5),1,1)}break; // reflexo da luneta
 case 'observer':if(u.obsT>time||u.target){const a=u.angle||0,bx=x+Math.round(Math.cos(a)*3),by=y-5+Math.round(Math.sin(a)*2);c.fillStyle='#1c1d17';c.fillRect(bx-1,by,3,2);c.fillStyle='#8f9a86';c.fillRect(bx-1,by,1,1);c.fillRect(bx+1,by,1,1)}
  else{c.fillStyle='#b9a77a';c.fillRect(x+2,y,2,2)}break;                                                                  // binóculo erguido / caixa de mapa
 case 'assault':c.fillStyle='#2b2a20';c.fillRect(x-4,y+1,2,3);c.fillRect(x+2,y+1,2,3);c.fillStyle='#5b5a44';c.fillRect(x-4,y+1,2,1);c.fillRect(x+2,y+1,2,1);   // sacos de granadas
  if(u.lunge2>time){c.fillStyle='#d9d5b7';c.fillRect(x+Math.round(Math.cos(u.angle)*7),y-1+Math.round(Math.sin(u.angle)*7),2,1)}break}}
if(window.PHYS){const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){
 const r=d0.call(PHYS,c,u,sp,sx,sy,vis,bob);if(!S.on||!u.cls||u.down||u.type!=='rifle')return r;
 try{if(!r){K.plain(c,sp,sx,sy,vis,bob);if(vis>sp.ay)mark(c,u,sp,sx,sy+bob)}else if(K.poseU===u)mark(c,u,sp,sx,sy+bob);K.poseU=null;return true}catch(e){fail(e);return r}}}

S.state=()=>{const n={};for(const u of units)if(u.cls)n[u.team+':'+u.cls]=(n[u.team+':'+u.cls]||0)+1;return {on:S.on,count:n,stats:{...S.stats},obsCd:[...obsCd]}};
S.tick=tick;S.pickGrenTarget=pickGrenTarget;S.markTarget=markTarget;S.melee=melee;S.observerCall=observerCall;
if(window.IronFront)window.IronFront.classes=S;
})();
