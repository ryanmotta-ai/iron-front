'use strict';
/* Iron Front 1.9 — metralhadora pesada como arma coletiva (mgcrew.js). Carrega por último (depois de heavyfx.js e das
   camadas anim-*): o wrap de shoot e o de PHYS.draw daqui precisam ser os mais externos.
   Antes, a carta "Metralhadora · Equipe · 3 soldados" punha em campo 3 homens, cada um com a sua MG nos braços.
   Agora os 3 formam UMA guarnição em volta de UMA arma (todos continuam type 'mg', então custo, contagem da IA, poder
   nas operações e antiaérea não mudam):
   - atirador: só ele dispara a MG. Não atira andando: depois de parar, 1 s para montar o tripé. Com alvo à vista
     durante um deslocamento da IA, a guarnição para e monta (no máximo a cada 8 s);
   - municiador: ajoelhado do lado esquerdo da arma, com a caixa. Com ele, a fita de 250 troca em 3 s e a cadência é a
     de uma arma servida (0,13 s ≈ 460 tpm, como a MG 08 e a M1917); sozinho, o atirador troca a fita em 8 s e alimenta a arma pior (0,30 s);
   - remuniciador: atrás, de fuzil. Faz as corridas: água para o cano (a corrida abstrata do frontline.js vira um homem
     de verdade, que pode ser morto no caminho) e caixas de munição quando acabam;
   - municiador e remuniciador atiram de fuzil (30 de dano, alcance 250, 1,6 s);
   - sucessão: se o atirador cai, o municiador (ou o remuniciador) vai até a arma e assume depois de 1,4 s — a arma
     fica muda nesse intervalo; o calor e a água do cano passam para o novo atirador;
   - cano travado (frontline.js): com guarnição a troca leva metade dos 20 s; sozinho, 1,4×;
   - sobras de guarnições diferentes se juntam; reforços e feridos que voltam entram na guarnição mais próxima;
   - se um auxiliar é postado num ninho (fortify.js) e chega lá, ele passa a ser o atirador e a guarnição vai junto;
   - Modo Soldado: E numa MG sem municiador faz o jogador municiá-la (conta como municiador enquanto estiver a até 30 px;
     atirar larga a fita); com a guarnição completa, o E continua assumindo a arma (soldier-feel.js).
   Desenho: em movimento, os auxiliares andam de fuzil (com a caixa na mão); parados, ajoelham ao lado da arma
   (gancho de 1 linha no heavyfx.js). ?guarnicao=0 desliga; IronFront.mgcrew.state() mostra contagens. */
(function(){
if(typeof units==='undefined'||typeof defs==='undefined'||!defs.mg)return;
const CFG={JOIN:110,MERGE:70,SETUP:1.0,MOVE_V:6,RATE:.13,RATE_SOLO:.3,BELT:250,CHANGE:3,CHANGE_SOLO:8,BOXES:6,RESUP:2,SOLO_RESUP:45,
 TAKE:1.4,FEED_R:30,HALT:5,HALT_CD:8,RIFLE_RATE:1.6,RIFLE_DMG:30,RIFLE_RANGE:250,SWAP_CREW:.5,SWAP_SOLO:1.4,FILL:2.5,FETCH:3,REAR:190};
const S=window.PXCREW={on:!/[?&]guarnicao=0/.test(location.search),version:'1.9',cfg:CFG,
 stats:{crews:0,joins:0,merges:0,promotions:0,beltChanges:0,soloChanges:0,blockedMove:0,halts:0,gunShots:0,crewShots:0,water:0,waterLost:0,ammoRuns:0,soloResup:0,swaps:0,posted:0,feeds:0,feedLost:0,errors:0}};
const hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a);
let CR=[],seq=0,errs=0,joinT=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('mgcrew.js:',e);if(errs>=12){S.on=false;release();console.error('mgcrew.js desligado após erros repetidos')}}
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('mgcrew.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const ok=u=>!!u&&u.hp>0&&!u.down&&!u.evac;
const soldierMe=u=>typeof mode!=='undefined'&&mode==='soldier'&&u===player;
const busy=u=>!!(u.post||u.sh||u.rs||u.sap||u.sapJob||u.pinned||u.lunge||soldierMe(u));
/* jogador municiando (E numa MG sem municiador, via soldier-feel.js): conta como municiador enquanto estiver ao lado */
const feeding=C=>!!C.feeder&&C.feeder===player&&soldierMe(player)&&ok(player)&&!!C.gun&&hyp(player.x-C.gun.x,player.y-C.gun.y)<CFG.FEED_R;
const hasLd=C=>ok(C.ld)||feeding(C);
const heatOf=u=>{try{return window.PXFL&&PXFL.on&&PXFL.st?PXFL.st(u):null}catch{return null}};
const G=()=>(window.PXFL&&PXFL.cfg&&PXFL.cfg.MG)||{AMB:15,WAT:4,SWAP:20};
function release(){for(const C of CR)for(const u of members(C))if(u){u.mgc=null;u.mgr=null}CR=[]}
function members(C){return[C.gun,C.ld,C.br,C.take&&C.take.u].filter((u,i,a)=>u&&a.indexOf(u)===i)}
function size(C){return members(C).length}
function found(u){const C={id:++seq,team:u.team,gun:u,ld:null,br:null,take:null,belt:CFG.BELT,boxes:CFG.BOXES,chg:0,gx:u.x,gy:u.y,lx:u.x,ly:u.y,lastMove:-9,haltCd:0,errand:null,solo:0};
 u.mgc=C;u.mgr='gun';CR.push(C);S.stats.crews++;return C}
function join(C,u){if(!C.ld){C.ld=u;u.mgr='ld'}else{C.br=u;u.mgr='br'}u.mgc=C;S.stats.joins++}
function copyHeat(from,to){const a=heatOf(from),b=heatOf(to);if(!a||!b)return;for(const k of['T','wat','seized','swapUntil'])b[k]=a[k];b.run=null;if(a.run&&a.run._mc){a.run=null}}
function coolAux(u){const a=heatOf(u);if(!a)return;const g=G();a.T=g.AMB;a.wat=g.WAT;a.seized=false;a.swapUntil=0;a.run=null}
/* ---------- recrutamento: toda MG sem guarnição entra na mais próxima incompleta ou funda uma ---------- */
function recruit(){
 for(const u of units){if(u.type!=='mg'||!ok(u)||u.mgc)continue;
  let best=null,bd=CFG.JOIN;for(const C of CR){if(C.team!==u.team||!C.gun||C.take||size(C)>=3)continue;const d=hyp(C.gun.x-u.x,C.gun.y-u.y);if(d<bd){bd=d;best=C}}
  if(best)join(best,u);else found(u)}
 /* sobras: duas armas sozinhas lado a lado viram uma guarnição (a que não está postada vira municiador) */
 for(const A of CR){if(A.dead||!A.gun||A.ld||A.br||A.take)continue;
  for(const B of CR){if(B===A||B.dead||B.team!==A.team||!B.gun||B.ld||B.br||B.take||B.gun.post||soldierMe(B.gun))continue;
   if(hyp(A.gun.x-B.gun.x,A.gun.y-B.gun.y)>CFG.MERGE)continue;
   const u=B.gun;B.dead=true;B.gun=null;join(A,u);A.boxes=Math.min(CFG.BOXES,A.boxes+B.boxes);S.stats.merges++;break}}
 CR=CR.filter(C=>!C.dead)}
/* ---------- manutenção por quadro ---------- */
function slot(C,u){const g=C.gun||(C.take&&{x:C.gx,y:C.gy,angle:C.ga||0});if(!g)return null;
 if(C.moving&&C.gun){/* em coluna atrás da arma, no sentido do deslocamento */
  const dx=C.gun.tx-C.gun.x,dy=C.gun.ty-C.gun.y,d=hyp(dx,dy)||1,back=u===C.ld?16:30,side=u===C.ld?-5:6;
  return{x:g.x-dx/d*back-dy/d*side,y:g.y-dy/d*back+dx/d*side}}
 const a=g.angle||0,ca=Math.cos(a),sa=Math.sin(a);
 if(u===C.ld)return{x:g.x+sa*15-ca*3,y:g.y-ca*15-sa*3};            // lado esquerdo da arma, junto da caixa
 return{x:g.x-ca*26-sa*11,y:g.y-sa*26+ca*11}}                          // atrás e à direita
function steer(u,p,tol=10){if(!p)return;const d=hyp(p.x-u.x,p.y-u.y);u.tx=p.x;u.ty=p.y;if(d>tol){u.order='move';if(u.pv)u.pv.path=null}else if(u.order==='move'||u.order==='attack')u.order='hold';u.target=u.target&&u.target.hp>0?u.target:null}
function rearPoint(C){const g=C.gun||{x:C.gx,y:C.gy},dir=C.team?1:-1;
 let best=null,bd=1e9;try{for(const b of buildings){if(b.team!==C.team||!/depot|ammo/.test(b.type||''))continue;const d=hyp(b.x-g.x,b.y-g.y);if(d<bd&&d<600){bd=d;best=b}}}catch{}
 return best?{x:best.x,y:best.y}:{x:Math.max(30,Math.min(W-30,g.x+dir*CFG.REAR)),y:g.y+rnd(-25,25)}}
function runner(C){return[C.br,C.ld].find(u=>ok(u)&&!busy(u))||null}
function errands(C,dt){const gun=C.gun;
 const a=gun&&heatOf(gun);
 /* água: a corrida abstrata do frontline.js passa a ser um homem da guarnição */
 if(a&&a.run&&!a.run._mc&&!C.errand){const r=runner(C);if(r){C.errand={u:r,kind:'water',ph:'out',x:a.run.bx,y:a.run.by,run:a.run,dur:a.run.dur};
   a.run._mc=1;a.run.dur=1e6;a.run.ox=a.run.bx=-9999;a.run.oy=a.run.by=-9999}}
 /* munição: caixas no fim */
 if(gun&&C.boxes<=0&&C.belt<=0&&!C.errand){const r=runner(C);if(r){const p=rearPoint(C);C.errand={u:r,kind:'ammo',ph:'out',x:p.x,y:p.y}}
  else if((C.solo+=dt)>=CFG.SOLO_RESUP){C.solo=0;C.boxes++;S.stats.soloResup++}}
 const E=C.errand;if(!E)return;
 if(!ok(E.u)||E.u.mgc!==C){/* morreu ou caiu no caminho: a água volta a ser a corrida abstrata, mais longa */
  if(E.kind==='water'&&E.run&&a&&a.run===E.run){E.run.t0=time;E.run.dur=E.dur*1.3;E.run.ox=gun.x;E.run.oy=gun.y;const p=rearPoint(C);E.run.bx=p.x;E.run.by=p.y;E.run._mc=0}
  if(E.kind==='water')S.stats.waterLost++;C.errand=null;return}
 const u=E.u;
 if(E.ph==='out'){steer(u,E,8);if(hyp(E.x-u.x,E.y-u.y)<14){E.ph='fill';E.t=time}}
 else if(E.ph==='fill'){u.tx=u.x;u.ty=u.y;u.order='hold';if(time-E.t>=(E.kind==='water'?CFG.FILL:CFG.FETCH))E.ph='back'}
 else{const p=gun?slot(C,u):{x:C.gx,y:C.gy};steer(u,p,8);if(p&&hyp(p.x-u.x,p.y-u.y)<20){
  if(E.kind==='water'){const b=gun&&heatOf(gun);if(b&&b.run===E.run){b.run.dur=0;b.run.t0=time-1}S.stats.water++}
  else{C.boxes+=CFG.RESUP;S.stats.ammoRuns++}C.errand=null}}}
function promote(C){const cand=[C.ld,C.br].find(u=>ok(u)&&!soldierMe(u))||[C.ld,C.br].find(ok);if(!cand){C.dead=true;return}
 if(C.ld===cand)C.ld=null;if(C.br===cand)C.br=null;C.take={u:cand,t0:time,at:0,from:C.prev};cand.mgr='take';C.belt=Math.max(0,C.belt)}
function tick(dt){
 if((joinT-=dt)<=0){joinT=.5;recruit()}
 for(const C of CR){
  /* baixas */
  for(const k of['ld','br'])if(C[k]&&(!ok(C[k])||C[k].type!=='mg')){C[k].mgc=null;C[k].mgr=null;C[k]=null}
  if(C.take&&!ok(C.take.u)){const u=C.take.u;u.mgc=null;u.mgr=null;C.take=null}
  if(C.gun&&(!ok(C.gun)||C.gun.type!=='mg')){const g=C.gun;C.prev=g;C.gx=g.x;C.gy=g.y;C.ga=g.angle;g.mgc=null;g.mgr=null;C.gun=null;if(C.errand&&C.errand.kind==='water')C.errand=null}
  if(!C.gun&&!C.take)promote(C);
  if(C.dead)continue;
  /* alguém vai até a arma largada e assume */
  if(C.take){const T=C.take,u=T.u;if(!soldierMe(u))steer(u,{x:C.gx,y:C.gy},6);
   if(hyp(u.x-C.gx,u.y-C.gy)<9||soldierMe(u)){if(!T.at)T.at=time;if(time-T.at>=CFG.TAKE){C.gun=u;u.mgr='gun';C.take=null;C.lastMove=time-CFG.SETUP*.5;
     if(T.from)copyHeat(T.from,u);S.stats.promotions++}}
   continue}
  const gun=C.gun;
  /* movimento da arma: só atira montada */
  const v=hyp(gun.x-C.lx,gun.y-C.ly)/Math.max(dt,1e-3);C.lx=gun.x;C.ly=gun.y;C.moving=v>CFG.MOVE_V;if(C.moving)C.lastMove=time;C.gx=gun.x;C.gy=gun.y;C.ga=gun.angle;
  /* com alvo à vista num deslocamento da IA, para e monta */
  if(!soldierMe(gun)&&aiEnabled[gun.team]&&!(gun.manualUntil>time)&&!(gun.dodgeUntil>time)&&gun.order==='move'&&gun.aiRole!=='evasão'&&!busy(gun)&&time>C.haltCd&&
   gun.target&&gun.target.hp>0&&hyp(gun.target.x-gun.x,gun.target.y-gun.y)<(defs.mg.range||330)){gun.order='hold';gun.tx=gun.x;gun.ty=gun.y;C.haltCd=time+CFG.HALT_CD;C.haltUntil=time+CFG.HALT;S.stats.halts++}
  /* auxiliar postado num ninho: quando chega, vira o atirador */
  for(const k of['ld','br']){const u=C[k];if(!u||!u.post||gun.post||soldierMe(gun)||soldierMe(u))continue;if(hyp(u.x-u.post.x,u.y-u.post.y)>20)continue;
   C.gun=u;u.mgr='gun';C[k]=gun;gun.mgr=k;copyHeat(gun,u);coolAux(gun);S.stats.posted++;break}
  /* cano travado: a troca depende de quem está lá */
  const a=heatOf(C.gun);if(a){if(a.seized&&!a._mcSw){a._mcSw=1;a.swapUntil=time+G().SWAP*(hasLd(C)?CFG.SWAP_CREW:CFG.SWAP_SOLO);S.stats.swaps++}else if(!a.seized)a._mcSw=0}
  /* ordem manual dada só a um auxiliar vale para a arma inteira */
  for(const k of['ld','br']){const u=C[k];if(!u||!(u.manualUntil>time)||u._mcFwd===u.manualUntil||soldierMe(C.gun))continue;u._mcFwd=u.manualUntil;
   if(!(C.gun.manualUntil>=u.manualUntil-.05)){C.gun.order=u.order;C.gun.tx=u.tx;C.gun.ty=u.ty;C.gun.manualUntil=u.manualUntil;C.gun.target=null}}
  if(C.feeder&&!feeding(C)){if(C.feeder===player&&soldierMe(player)&&ok(player)){S.stats.feedLost++;try{toast('Longe da arma: você parou de municiar.')}catch{}}C.feeder=null}
  errands(C,dt);
  for(const k of['ld','br']){const u=C[k];if(!u)continue;coolAux(u);if(busy(u)||(C.errand&&C.errand.u===u))continue;steer(u,slot(C,u))}}
 CR=CR.filter(C=>{if(!C.dead)return true;for(const u of members(C)){u.mgc=null;u.mgr=null}return false})}
wrap('setup',(orig,...a)=>{CR=[];seq=0;joinT=0;return orig(...a)});
wrap('update',(orig,dt)=>{const r=orig(dt);if(S.on&&started&&!ended)try{tick(dt)}catch(e){fail(e)}return r});
/* ---------- tiro ---------- */
wrap('shoot',(orig,u,target,manual)=>{
 if(S.on&&manual&&u===player)for(const C of CR)if(C.feeder===player){C.feeder=null;try{toast('Você largou a fita para atirar.')}catch{}}
 if(!S.on||!u||u.type!=='mg'||!u.mgc||manual)return orig(u,target,manual);
 try{const C=u.mgc;
  if(u.mgr==='gun'){
   if(time-C.lastMove<CFG.SETUP){u.cd=Math.max(u.cd,.15);S.stats.blockedMove++;return}
   if(C.chg>time){u.cd=Math.max(u.cd,C.chg-time);return}
   if(C.belt<=0){if(C.boxes>0){C.boxes--;C.belt=CFG.BELT;const solo=!hasLd(C);C.chg=time+(solo?CFG.CHANGE_SOLO:CFG.CHANGE);S.stats[solo?'soloChanges':'beltChanges']++;u.cd=C.chg-time}else u.cd=.5;return}
   const n=bullets.length,r=orig(u,target,manual);
   if(bullets.length>n){C.belt--;S.stats.gunShots++;u.cd*=(hasLd(C)?CFG.RATE:CFG.RATE_SOLO)/(defs.mg.rate||.22)}
   return r}
  if(u.mgr==='take'||(C.errand&&C.errand.u===u&&C.errand.ph!=='fill')){u.cd=Math.max(u.cd,.4);return}
  if(!target||hyp(target.x-u.x,target.y-u.y)>CFG.RIFLE_RANGE){u.cd=Math.max(u.cd,.4);return}
  const n=bullets.length,r=orig(u,target,manual);
  if(bullets.length>n){const b=bullets[bullets.length-1];b.damage=CFG.RIFLE_DMG;b.t=CFG.RIFLE_RANGE/800;u.cd=CFG.RIFLE_RATE*rnd(.85,1.2);S.stats.crewShots++}
  return r}catch(e){fail(e);return orig(u,target,manual)}});
/* ---------- desenho ---------- */
const aux=u=>u.mgr==='ld'||u.mgr==='br'||u.mgr==='take';
function rifleSprite(u,a,moving){try{return PX.infantrySprite(u.team,'rifle',PX.dir16(a),moving?PX.FRAMES[Math.floor(time*8+u.id)%4]:0,'rifle',null,null,false)}catch{return null}}
function tin(c,x,y,team,lift){const yy=y-lift;c.fillStyle='rgba(15,18,10,.35)';c.fillRect(x-2,y+2,5,1);
 c.fillStyle=team?'#6e7468':'#566040';c.fillRect(x-2,yy-1,5,3);c.fillStyle=team?'#98a094':'#7d8b5e';c.fillRect(x-2,yy-1,5,1);c.fillStyle='#b69a4a';c.fillRect(x,yy,1,1)}
/* parado: chamado pelo heavyfx.js (dentro da cadeia) — ajoelhado de fuzil, caixa ao lado; o municiador ergue a caixa na troca de fita */
S.drawStill=function(c,u,sp,sx,sy,vis,bob,d0){const C=u.mgc,g=C&&(C.gun||null),face=g&&u.mgr!=='br'?Math.atan2(g.y-u.y,g.x-u.x):(u.target&&u.target.hp>0?u.angle:(g?g.angle:u.angle))||0;
 const r2=rifleSprite(u,face,false)||sp,deep=window.PXW&&PXW.depth&&PXW.depth(u.x,u.y)>=.25;
 u.type='rifle';let r;try{r=d0.call(PHYS,c,u,r2,sx,sy,vis,bob)}finally{u.type='mg'}
 if(!r){if(deep||!window.IFK)c.drawImage(r2.c,0,0,r2.c.width,vis,sx-r2.ax,sy-r2.ay+bob,r2.c.width,vis);else IFK.pose(c,r2,sx,sy,vis,bob,{crouch:1,u})}
 if(!deep){const side=Math.cos(face)>=0?-1:1;
  if(u.mgr==='ld')tin(c,sx+side*4,sy+3+bob,u.team,C&&C.chg>time?(((time*6)|0)%2)+1:0);
  else if(u.mgr==='br'){tin(c,sx+side*5,sy+4+bob,u.team,0);if(C&&C.boxes>2)tin(c,sx+side*5,sy+1+bob,u.team,0)}}
 return true};
if(window.PHYS){const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){
 if(!S.on||u.type!=='mg'||!aux(u))return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
 if(!u.moving){if(window.PXHFX&&PXHFX.on&&PXHFX.crewHook)return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);   // o heavyfx chama drawStill de dentro da cadeia
  try{return S.drawStill(c,u,sp,sx,sy,vis,bob,d0)}catch(e){u.type='mg';fail(e);return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}
 /* andando: fuzil na mão (a camada de animação desenha a marcha de fuzileiro) e a caixa de munição pendurada */
 try{const r2=rifleSprite(u,u.angle||0,true)||sp;u.type='rifle';let r;try{r=d0.call(PHYS,c,u,r2,sx,sy,vis,bob)}finally{u.type='mg'}
  if(!r)c.drawImage(r2.c,0,0,r2.c.width,vis,sx-r2.ax,sy-r2.ay+bob,r2.c.width,vis);
  if(!(window.PXW&&PXW.depth&&PXW.depth(u.x,u.y)>=.25)){const side=Math.cos(u.angle||0)>=0?-1:1;tin(c,sx+side*5,sy+2+bob+(((time*8+u.id)|0)%2),u.team,0)}
  return true}catch(e){u.type='mg';fail(e);return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}}
const gunName=()=>{try{return weapons.mg?weapons.mg.name:'MG'}catch{return 'MG'}};
S.feedable=m=>!!(S.on&&m&&m.mgc&&m.mgr==='gun'&&!m.mgc.take&&(m.mgc.feeder===player||!ok(m.mgc.ld)));
S.feed=m=>{if(!S.feedable(m))return false;const C=m.mgc;if(C.feeder===player){C.feeder=null;try{toast('Você parou de municiar.')}catch{}return true}
 C.feeder=player;S.stats.feeds++;try{toast(`Municiando a ${gunName()}: cadência cheia e troca de fita em ${CFG.CHANGE} s. Fique ao lado da arma · E para parar.`)}catch{}return true};
S.feedLabel=m=>!S.feedable(m)?'':m.mgc.feeder===player?'E parar de municiar':'E municiar a MG';
S.feeding=()=>CR.some(feeding);
S.crews=()=>CR;
S.state=()=>({on:S.on,crews:CR.length,full:CR.filter(C=>size(C)>=3).length,solo:CR.filter(C=>size(C)===1).length,
 list:CR.map(C=>({id:C.id,team:C.team,gun:C.gun&&C.gun.id,ld:C.ld&&C.ld.id,br:C.br&&C.br.id,take:C.take&&C.take.u.id,belt:C.belt,boxes:C.boxes,errand:C.errand&&C.errand.kind})),stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.mgcrew=S;
})();
