'use strict';
/* Iron Front 1.9 — abrigos e bunkers ocupados de verdade (shelter.js). Carrega DEPOIS de works.js.
   Abrigo subterrâneo (obra "Abrigo" do fortify.js, até 4 homens):
     - sob barragem (explosão de obus/morteiro a < 220 px nos últimos 3 s) e sem inimigo a < 220 px, a infantaria perto (< 120 px)
       vai até a ENTRADA (lado de trás do abrigo), desce em 0,9 s — o corpo some degrau a degrau, de baixo para cima — e fica lá
       dentro: não é desenhada, não atira, não é alvo e recebe 8% do dano (só um acerto em cima da entrada desaba o abrigo:
       30% de chance de soterrar cada um);
     - sai quando a barragem acaba (6 s sem explosão forte perto) ou no alarme (inimigo a < 170 px: "corrida ao parapeito",
       sobe em 0,6 s) e volta ao lugar que ocupava na trincheira.
   Bunker com MG: a metralhadora do bunker só dispara com guarnição dentro (pelo menos 1 infante do lado a < 26 px). Os homens
     dentro assumem postos: metralhadora (seteira da frente), observação (periscópio) e fuzil (seteiras laterais).
   Jogador: E na entrada de um abrigo aliado desce/sobe.
   ?abrigos=0 desliga · IronFront.shelter.state(). */
(function(){
if(!window.IFK||!window.PXSAP)return;
const K=IFK,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('shelter.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={CAP:4,SEEK:120,DANGER:220,WINDOW:3,CALM:6,ALARM:170,DOWN:.9,UP:.9,UPFAST:.6,DMG:.08,CAVE:.3,CAVER:22,HEAVY:50,BUNKER_R:26};
const S=window.PXSHELTER={on:K.on&&!/[?&]abrigos=0/.test(location.search),version:'1.9',cfg:CFG,stats:{entered:0,exited:0,alarms:0,buried:0,absorbed:0,silentBunker:0,errors:0}};
let SH=[],BL=[],errs=0,scanT=0,listT=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('shelter.js:',e);if(errs>=12){S.on=false;console.error('shelter.js desligado após erros repetidos')}}
const face=t=>t?-1:1;
const inf=u=>(u.type==='rifle'||u.type==='mg')&&u.hp>0&&!u.down;
const soldierP=u=>u===player&&mode==='soldier';
function enemiesNear(team,x,y,r){const r2=r*r;for(const e of units)if(e.team!==team&&e.hp>0&&!e.down&&(e.x-x)**2+(e.y-y)**2<r2)return true;return false}
function rebuild(){const seen=new Set();for(const p of PXSAP.projects||[]){if(p.kind!=='dugout')continue;for(const s of p.segs){if(s.stage<2||!s.anchor)continue;seen.add(s);
  if(!SH.some(h=>h.s===s))SH.push({s,team:s.team,x:s.x,y:s.y,ex:s.x-face(s.team)*16,ey:s.y+5,occ:[],calmAt:time})}}
 SH=SH.filter(h=>{if(seen.has(h.s))return true;for(const u of h.occ)leave(u,true);return false})}
const heavyNear=(x,y,r,win)=>BL.some(b=>time-b.t<win&&hyp(b.x-x,b.y-y)<r);

/* ---------- máquina de estados ---------- */
function enter(u,h){u.sh={st:'go',h,t:0,px:u.x,py:u.y,t0:time};h.occ.push(u);K.shout(u,'arty',1.2)}
function leave(u,now){const z=u.sh;if(!z)return;const h=z.h;h.occ=h.occ.filter(o=>o!==u);if(now||z.st==='go'){u.sh=null;u.manualUntil=0;return}
 z.st='up';z.t=enemiesNear(u.team,h.x,h.y,CFG.ALARM)?CFG.UPFAST:CFG.UP;z.T=z.t;u.x=h.ex;u.y=h.ey}
function unitTick(u,dt){const z=u.sh,h=z.h;u.manualUntil=time+1;u.target=null;
 if(z.st==='go'){u.order='move';u.tx=h.ex;u.ty=h.ey;u.cd=Math.max(u.cd||0,.3);
  if(hyp(u.x-h.ex,u.y-h.ey)<7){z.st='down';z.t=CFG.DOWN;z.T=CFG.DOWN;u.order='hold';u.tx=u.x;u.ty=u.y}else if(time-z.t0>12){h.occ=h.occ.filter(o=>o!==u);u.sh=null;u.manualUntil=0}return}
 u.order='hold';u.tx=u.x;u.ty=u.y;u.cd=Math.max(u.cd||0,.5);
 if(z.st==='down'){z.t-=dt;u.x+=(h.x-u.x)*Math.min(1,dt*1.5);u.y+=(h.y-u.y)*Math.min(1,dt*1.5);if(z.t<=0){z.st='in';S.stats.entered++}return}
 if(z.st==='in'){u.x=h.x;u.y=h.y;u.suppression=Math.max(0,(u.suppression||0)-dt*.5);
  const alarm=enemiesNear(u.team,h.x,h.y,CFG.ALARM),calm=!heavyNear(h.x,h.y,300,CFG.CALM);
  if(alarm||calm&&!soldierP(u)){if(alarm){S.stats.alarms++;K.shout(u,'move',1.2)}leave(u,false)}return}
 if(z.st==='up'){z.t-=dt;if(z.t<=0){u.sh=null;S.stats.exited++;u.order='move';u.tx=z.px;u.ty=z.py;u.manualUntil=time+4}}}
function scan(){for(const u of units){if(!inf(u)||u.sh||soldierP(u)||u.rs||u.sapJob||u.post||u.pinned)continue;
  if(!heavyNear(u.x,u.y,CFG.DANGER,CFG.WINDOW)||enemiesNear(u.team,u.x,u.y,CFG.DANGER))continue;
  let best=null,bd=CFG.SEEK;for(const h of SH){if(h.team!==u.team||h.occ.length>=CFG.CAP)continue;const d=hyp(h.x-u.x,h.y-u.y);if(d<bd){bd=d;best=h}}
  if(best&&Math.random()<.6)enter(u,best)}}
/* bunker: sem guarnição a MG cala; com guarnição, cada homem assume um posto */
function bunkers(){for(const b of buildings){if(b.type!=='bunker'||b.hp<=0)continue;const f=face(b.team),crew=[];
  for(const u of units)if(u.team===b.team&&inf(u)&&!u.sh&&Math.abs(u.x-b.x)<CFG.BUNKER_R+4&&Math.abs(u.y-b.y)<CFG.BUNKER_R)crew.push(u);
  b.crew=crew.length;
  /* guarnição: o bunker chama até 2 infantes ociosos a até 260 px (como o ninho chama as MGs); ordem manual do jogador libera */
  const gar=units.filter(u=>u.bunkerOf===b&&u.hp>0&&!u.down);
  for(const u of gar){if(u.order==='move'&&u.manualUntil>time+3&&hyp(u.tx-b.x,u.ty-b.y)>40){u.bunkerOf=null;continue}
   if(!crew.includes(u)){u.order='move';u.tx=b.x-f*6;u.ty=b.y;u.manualUntil=time+2}else{u.order='hold';u.manualUntil=time+2}}
  if(gar.length<2&&time>=(b.callT||0)){b.callT=time+2;let best=null,bd=260;for(const u of units){if(u.team!==b.team||!inf(u)||u.sh||u.rs||u.sapJob||u.post||u.bunkerOf&&u.bunkerOf.hp>0&&buildings.includes(u.bunkerOf)||soldierP(u)||u.manualUntil>time||u.order==='attack'&&u.target)continue;const d=hyp(u.x-b.x,u.y-b.y);if(d<bd){bd=d;best=u}}
   if(best){best.bunkerOf=b;best.order='move';best.tx=b.x-f*6;best.ty=b.y;best.manualUntil=time+2;S.stats.manned=(S.stats.manned||0)+1}}
  if(!crew.length){b.cd=Math.max(b.cd||0,.5);S.stats.silentBunker+=1/30;continue}
  crew.sort((a,c)=>a.id-c.id);crew.forEach((u,i)=>{const post=i===0?{x:b.x+f*10,y:b.y,k:'mg'}:i===1?{x:b.x-f*4,y:b.y-9,k:'obs'}:{x:b.x+f*4,y:b.y+(i%2?10:-10)*(i>3?1.4:1),k:'rifle'};u.bpost=post.k;
   if(!soldierP(u)&&u.order==='hold'&&!(u.manualUntil>time)&&hyp(u.x-post.x,u.y-post.y)>3){u.x+=(post.x-u.x)*.1;u.y+=(post.y-u.y)*.1}})}}

/* ---------- ligações ---------- */
wrap('setup',(orig,...a)=>{SH=[];BL=[];return orig(...a)});
wrap('update',(orig,dt)=>{if(!S.on||!started||ended||!(dt>0))return orig(dt);
 try{bunkers()}catch(e){fail(e)}
 orig(dt);
 try{if((listT-=dt)<=0){listT=1;rebuild()}BL=BL.filter(b=>time-b.t<CFG.CALM+1);
  for(const u of units)if(u.sh)unitTick(u,dt);
  if((scanT-=dt)<=0){scanT=.5;scan()}}catch(e){fail(e)}});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on||r<CFG.HEAVY)return;try{BL.push({x,y,t:time});
 if(r>=80)for(const h of SH){if(hyp(h.x-x,h.y-y)>CFG.CAVER)continue;for(const u of h.occ.slice())if(u.sh&&u.sh.st==='in'&&Math.random()<CFG.CAVE){S.stats.buried++;leave(u,true);damage(u,9999,team)}}}catch(e){fail(e)}});
wrap('damage',(orig,u,n,attacker)=>{if(S.on&&u&&u.sh&&u.sh.st==='in'&&n<9000){S.stats.absorbed+=n*(1-CFG.DMG);return orig(u,n*CFG.DMG,attacker)}return orig(u,n,attacker)});
wrap('protectedBy',(orig,u)=>{const f=orig(u);return S.on&&u.sh&&(u.sh.st==='in'||u.sh.st==='down')?Math.min(f,.05):f});
const Brain=window.IronFrontBrain;
if(Brain&&typeof Brain.selectTarget==='function'){const st=Brain.selectTarget;Brain.selectTarget=function(u,list,range,canHit){return st.call(this,u,list,range,(a,e)=>!(S.on&&e.sh&&e.sh.st==='in')&&(!canHit||canHit(a,e)))}}
/* jogador: E na entrada */
function playerKey(){if(!S.on||mode!=='soldier'||!player||player.down||player.type!=='rifle')return false;
 if(player.sh){if(player.sh.st==='in'){leave(player,false);toast('Você sai do abrigo.')}return true}
 const h=SH.find(h=>h.team===player.team&&hyp(h.ex-player.x,h.ey-player.y)<22&&h.occ.length<CFG.CAP);if(!h)return false;
 enter(player,h);player.sh.st='down';player.sh.t=player.sh.T=CFG.DOWN;toast('Descendo ao abrigo · E sobe de volta.');return true}
K.ePri.push(()=>S.on&&mode==='soldier'&&player&&player.type==='rifle'&&(!!player.sh||SH.some(h=>h.team===player.team&&hyp(h.ex-player.x,h.ey-player.y)<22)));
window.addEventListener('keydown',e=>{if((e.key||'').toLowerCase()!=='e'||e.repeat||document.querySelector('dialog[open]'))return;try{if(playerKey()){e.preventDefault();e.stopImmediatePropagation()}}catch(err){fail(err)}},true);
/* o jogador dentro do abrigo não anda nem atira; o tique dele é o mesmo dos outros, mas a saída é pela tecla */
wrap('update',(orig,dt)=>{const p=player,inside=S.on&&p&&p.sh&&mode==='soldier';const keep=inside?{x:p.x,y:p.y}:null;orig(dt);
 if(inside&&p.sh&&p.sh.st!=='up'){p.x=keep.x;p.y=keep.y;p.cd=Math.max(p.cd||0,.3)}});

/* ---------- desenho: descer/subir degrau a degrau; dentro, nada ---------- */
if(window.PHYS){const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){const z=u.sh;
 if(!S.on||!z||z.st==='go')return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
 try{if(z.st==='in')return true;const k=clamp(z.t/z.T,0,1),f=z.st==='down'?1-k:k,cut=Math.round(f*14);
  c.globalAlpha=1-f*.5;K.pose(c,sp,sx,sy,vis,bob,{cut:cut+2,dy:Math.round(f*6),u});c.globalAlpha=1;return true}catch(e){fail(e);return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}}
function drawOver(c,ox,oy){const Z=K.Z;for(const h of SH){const n=h.occ.filter(u=>u.sh&&u.sh.st==='in').length;if(!n||h.team!==playerTeam)continue;const x=ox+Math.round(h.x*Z),y=oy+Math.round(h.y*Z)-12;if(x<-10||y<-10||x>vw+10||y>vh+10)continue;
  for(let i=0;i<n;i++){c.fillStyle='#14160f';c.fillRect(x-6+i*4,y,3,3);c.fillStyle='#c9cf9a';c.fillRect(x-5+i*4,y+1,1,1)}}
 if(mode==='soldier'&&player&&!player.sh){const h=SH.find(h=>h.team===player.team&&hyp(h.ex-player.x,h.ey-player.y)<30);if(h){const t='[E] ABRIGO',x=ox+Math.round(h.ex*Z)-(K.textW(t)>>1),y=oy+Math.round(h.ey*Z)+8;c.fillStyle='rgba(18,20,14,.75)';c.fillRect(x-2,y-2,K.textW(t)+4,9);K.text(c,t,x,y,'#e9e3b4')}}}
if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on)return;try{drawOver(c,ox,oy)}catch(e){fail(e)}}}

S.state=()=>({on:S.on,shelters:SH.map(h=>({team:h.team,occ:h.occ.length,in:h.occ.filter(u=>u.sh&&u.sh.st==='in').length})),bunkers:buildings.filter(b=>b.type==='bunker').map(b=>({team:b.team,crew:b.crew||0})),stats:{...S.stats}});
S.rebuild=rebuild;S.scan=scan;S.shelters=()=>SH;S.blasts=()=>BL;
if(window.IronFront)window.IronFront.shelter=S;
})();
