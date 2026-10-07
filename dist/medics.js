'use strict';
/* Iron Front 1.6 — postos de socorro e padioleiros.
   Carrega DEPOIS de fortify.js (e antes do ui-art.js). Envolve setup / update / damage / protectedBy / explode e Brain.selectTarget;
   desenha em WW1A.under/over e PHYS.draw. Constrói-se pelo catálogo do fortify.js (aba DEFESAS) e a IA põe 2 postos no plano.
   Ferido grave .. parte dos ferimentos que matariam um infante (não as explosões que despedaçam) deixa o soldado caído, sangrando:
                   não anda, não atira, não é mais alvo; morre em 50–75 s se ninguém vier.
   Padioleiros ... cada posto tem 2 equipes de maca; vão ao ferido mais urgente (até 750 px, evitando onde o fogo é pesado), o colocam
                   na maca e voltam devagar; no posto, 10–16 s de tratamento: ~78% voltam à luta com 60% da vida.
                   Explosão perto mata a equipe (outra chega em 25 s); sob fogo de perto podem cair.
   Cada lado começa com um posto pronto na retaguarda (junto ao QG). ?socorro=0 desliga · PXMED.state(). */
(function(){
if(!window.PX)return;
const Z=PX.Z||.5,hyp=Math.hypot;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('medics.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
const face=t=>t?-1:1;
const CFG={WOUND:.55,OVERKILL:70,BLEED:[50,75],RANGE:750,HOT:2,GO:52,CARRY:34,LOAD:4.4,LAY:3.4,BEDS:3,TREAT:[10,16],SAVE:.78,HEAL:.6,RESPAWN:25,COST:120};
const S=window.PXMED={on:!/[?&]socorro=0/.test(location.search),version:'1.6',cfg:CFG,stats:{errors:0,wounded:0,rescued:0,saved:0,lost:0,bearersKilled:0}};
let POSTS=[],pid=0,errs=0,sayAt=0;
const Policy=window.IronFrontSupport;
function context(team,observer){const known=window.IronFrontBrain?.operations?.contacts(team)||[],seen=new Map(known.map(e=>[e.id,e]));
 const visibility=Math.min(350,typeof observationRange==='function'?observationRange():350);
 if(observer)for(const e of units){if(e.team===team||e.hp<=0||e.down||hyp(e.x-observer.x,e.y-observer.y)>visibility)continue;
  if(window.IronFrontBrain?.clearShot&&!IronFrontBrain.clearShot(observer,e,typeof decor==='undefined'?[]:decor,typeof buildings==='undefined'?[]:buildings))continue;seen.set(e.id,{id:e.id,type:e.type,team:e.team,x:e.x,y:e.y,hp:e.hp})}
 return {team,time,enemies:[...seen.values()],shells:typeof shells==='undefined'?[]:shells,buildings:typeof buildings==='undefined'?[]:buildings,trenches:fieldTrenches,depth:window.PXW?.depth,clear:window.IronFrontBrain?.clearShot?(a,b)=>IronFrontBrain.clearShot(a,b,typeof decor==='undefined'?[]:decor,typeof buildings==='undefined'?[]:buildings):null};
}
function reserved(p){return POSTS.reduce((n,home)=>n+home.crews.filter(c=>['go','load','carry','lay'].includes(c.st)&&(c.dest||home)===p).length,0)}
function capacity(p){return p.beds.length+reserved(p)<CFG.BEDS}
function crewContext(c,team){if(!c.ctx||time>=c.ctxUntil){c.ctx=context(team,c);c.ctxUntil=time+.7}return c.ctx}
function releaseClaim(c){if(c.u&&c.u.claimed===c){c.avoid={id:c.u.id,until:time+35};c.u.claimed=null;c.u.carried=false}c.u=null;c.st='idle';c.t=1;c.dest=null;c.route=null}
function fail(e){S.stats.errors++;if(++errs<=3)console.error('medics.js:',e);if(errs>=12){S.on=false;console.error('medics.js desligado após erros repetidos')}}
const eligible=u=>(u.type==='rifle'||u.type==='mg')&&!(u===player&&mode==='soldier')&&!(window.PXW&&PXW.depth&&PXW.depth(u.x,u.y)>=.55);
function enemiesNear(team,x,y,r){let n=0;for(const u of units)if(u.team!==team&&u.hp>0&&!u.down&&(u.x-x)**2+(u.y-y)**2<r*r)n++;return n}
function say(team,msg){if(team!==playerTeam||time-sayAt<6)return;sayAt=time;try{toast(msg)}catch{}}

/* ---------- postos ---------- */
function addPost(team,x,y,seg){const p={id:++pid,team,x,y,hp:400,seg,beds:[],crews:[0,1].map(i=>({i,st:'idle',x:x+(i?8:-8),y:y+12,u:null,t:0,dead:-99}))};POSTS.push(p);return p}
const bedPos=(p,i)=>({x:p.x+face(p.team)*-6+(i-1)*9,y:p.y+16});
function lose(u){u.down=false;u.inBed=0;u.carried=false;S.stats.lost++;damage(u,9999)}
function heal(u,p){u.down=false;u.inBed=0;u.carried=false;u.claimed=null;u.hp=Math.max(u.hp,u.maxhp*CFG.HEAL);u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=0;u.aiRole='';u.suppression=0;u.cohesion=Math.max(.5,u.cohesion??1);
 S.stats.saved++;say(p.team,`Posto de socorro: um soldado voltou à luta (${S.stats.saved} salvos).`)}

/* ---------- ferido grave ---------- */
function downTick(dt){for(const u of units){if(!u.down)continue;
 u.order='hold';u.tx=u.x;u.ty=u.y;u.target=null;u.cd=Math.max(u.cd||0,1);u.manualUntil=u.downStamp=time+1;u.suppression=0;u.pinned=false;u.moving=false;
 if(u.inBed){if(time>=u.inBed){const p=POSTS.find(q=>q.beds.includes(u));if(p)p.beds.splice(p.beds.indexOf(u),1);if(p&&Math.random()<CFG.SAVE)heal(u,p);else lose(u)}continue}
 if(!u.carried&&time>u.bleed)lose(u)}}
/* ---------- padioleiros ---------- */
function crewTick(dt){
 for(const p of POSTS){for(const c of p.crews){
  if(c.st==='dead'){if(time-c.dead>CFG.RESPAWN&&p.hp>0){c.st='idle';c.x=p.x;c.y=p.y+12}continue}
  const u=c.u;
  if(c.st==='idle'){c.t-=dt;if(c.t>0)continue;c.t=.5;let best=null,bs=Infinity;
   if(p.hp<=0||Policy&&!capacity(p))continue;
   const ctx=Policy?crewContext(c,p.team):null;
   for(const w of units){if(!w.down||w.team!==p.team||w.claimed||w.carried||w.inBed||c.avoid?.id===w.id&&c.avoid.until>time)continue;const d=hyp(w.x-p.x,w.y-p.y);if(d>CFG.RANGE)continue;
    if(enemiesNear(p.team,w.x,w.y,140)>=CFG.HOT)continue;const sc=Policy?-Policy.triage(ctx,c,w,CFG.GO,CFG.LOAD):d/CFG.GO+(w.bleed-time)*.4;if(sc<bs){bs=sc;best=w}}
   if(best){if(Policy)S.stats.triaged=(S.stats.triaged||0)+1;best.claimed=c;c.u=best;c.st='go';c.dest=p;c.started=time;c.progress=time;c.lastDistance=hyp(best.x-c.x,best.y-c.y)}else{const hx=p.x+(c.i?8:-8),hy=p.y+12;c.x+=(hx-c.x)*Math.min(1,dt*2);c.y+=(hy-c.y)*Math.min(1,dt*2)}continue}
  if(!u||u.hp<=0||!u.down){if(u)u.claimed=null;c.u=null;c.st=c.st==='carry'?'idle':'idle';continue}
  if(c.st==='go'){const actual=hyp(u.x-c.x,u.y-c.y);if(actual<(c.lastDistance??Infinity)-5){c.progress=time;c.lastDistance=actual}
   if(Policy&&(time-c.progress>12||time-c.started>35||Policy.risk(crewContext(c,p.team),u)>8)){releaseClaim(c);continue}
   const goal=Policy?Policy.route(crewContext(c,p.team),c,u):u,dx=goal.x-c.x,dy=goal.y-c.y,d=hyp(dx,dy),s=CFG.GO*dt;if(actual<=8){c.st='load';c.t=CFG.LOAD}else if(d>0){c.x+=dx/d*Math.min(d,s);c.y+=dy/d*Math.min(d,s)}}
  else if(c.st==='load'){c.t-=dt;if(c.t<=0){c.st='carry';u.carried=true;S.stats.rescued++}}
  else if(c.st==='carry'){let dest=c.dest||p;if(Policy&&(dest.hp<=0||dest.beds.length>=CFG.BEDS)){const alternate=POSTS.filter(q=>q.team===p.team&&q.hp>0&&q!==dest&&capacity(q)).sort((a,b)=>hyp(a.x-c.x,a.y-c.y)-hyp(b.x-c.x,b.y-c.y))[0];if(alternate)c.dest=dest=alternate}
   const free=dest.hp>0&&dest.beds.length<CFG.BEDS,b=S.bedPos(dest,dest.beds.length),tx=free?b.x:dest.x,ty=free?b.y:dest.y+22,actual=hyp(tx-c.x,ty-c.y),goal=Policy?Policy.route(crewContext(c,p.team),c,{x:tx,y:ty}):{x:tx,y:ty},dx=goal.x-c.x,dy=goal.y-c.y,d=hyp(dx,dy),s=CFG.CARRY*dt;
   if(actual<=4){if(free){c.st='lay';c.t=CFG.LAY;c.lay={dest,i:b.i,b:{x:b.x,y:b.y}};u.x=c.x;u.y=c.y-2}}
   else if(d>0){c.x+=dx/d*Math.min(d,s);c.y+=dy/d*Math.min(d,s)}
   if(u.carried){u.x=c.x;u.y=c.y-2}}
  else if(c.st==='lay'){c.t-=dt;const dest=c.lay&&c.lay.dest;u.x=c.x;u.y=c.y-2;                       // pousa o ferido no catre (medcare: o desenho mostra a maca descendo e a passagem para o catre)
   if(!dest||dest.hp<=0){c.st='carry';c.lay=null}
   else if(c.t<=0){if(dest.beds.length<CFG.BEDS){const b=c.lay.b||S.bedPos(dest,dest.beds.length);dest.beds.push(u);u.carried=false;u.claimed=null;u.inBed=time+rnd(...CFG.TREAT);u.x=b.x;u.y=b.y;c.u=null;c.st='idle';c.t=1;c.dest=null;c.lay=null}else{c.st='carry';c.lay=null}}}
  /* sob fogo de perto a equipe pode cair */
  if(c.st!=='idle'&&Math.random()<dt*.04*enemiesNear(p.team,c.x,c.y,160))killCrew(c)}}
 POSTS=POSTS.filter(p=>{if(p.hp>0)return true;for(const u of p.beds)lose(u);for(const c of p.crews)if(c.u){c.u.claimed=null;c.u.carried=false}return false})}
function killCrew(c){if(c.st==='dead')return;S.stats.bearersKilled++;if(c.u){c.u.claimed=null;c.u.carried=false}c.u=null;c.st='dead';c.dead=time;
 particles.push({x:c.x,y:c.y,vx:0,vy:0,t:.3,max:.3,color:'#be9b74',size:5})}

/* ======================================================================================
   LIGAÇÕES
   ====================================================================================== */
function reset(){POSTS=[];for(const key of Object.keys(S.stats))S.stats[key]=0;
 for(let t=0;t<2;t++){const x=t?W-300:300,y=800;addPost(t,x,y)}}
function tick(dt){if(!S.on||!started||ended)return;downTick(dt);crewTick(dt)}
wrap('setup',(orig,...a)=>{const r=orig(...a);try{reset()}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{orig(dt);try{tick(dt)}catch(e){fail(e)}});
wrap('damage',(orig,u,n,attacker)=>{
 if(!S.on||u.hp<=0)return orig(u,n,attacker);
 if(u.down){if(n<60&&Math.random()<.8)return;return orig(u,Math.max(n,u.hp+1),attacker)}     // rente ao chão: a maioria das balas passa por cima; explosão mata
 if(u.hp-n<=0&&eligible(u)&&n-u.hp<CFG.OVERKILL&&Math.random()<CFG.WOUND){
  const r=orig(u,u.hp-1,attacker);u.down=true;u.bleed=time+rnd(...CFG.BLEED);u.claimed=null;u.carried=false;u.inBed=0;S.stats.wounded++;
  try{selected.delete(u.id)}catch{}return r}
 return orig(u,n,attacker)});
wrap('protectedBy',(orig,u)=>{const f=orig(u);return S.on&&u.down?Math.min(f,.6):f});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on)return;try{
 for(const p of POSTS){const d=hyp(p.x-x,p.y-y);if(d<r+14)p.hp-=power*(1-d/(r+14))*1.3;for(const c of p.crews)if(c.st!=='dead'&&hyp(c.x-x,c.y-y)<r*.8)killCrew(c)}}catch(e){fail(e)}});
const Brain=window.IronFrontBrain;
if(Brain&&typeof Brain.selectTarget==='function'){const st=Brain.selectTarget;Brain.selectTarget=function(u,list,range,canHit){return st.call(this,u,list,range,(a,e)=>!(S.on&&e.down)&&(!canHit||canHit(a,e)))}}

/* ---------- catálogo (fortify.js) ---------- */
const mkc=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
function tent(g,o,st){/* barraca de lona com cruz vermelha; st<3 = em montagem */
 g.fillStyle='#4a4232';g.fillRect(o-9,o+3,18,1);
 if(st>=1){g.fillStyle='#6b5436';g.fillRect(o-8,o-4,1,8);g.fillRect(o+7,o-4,1,8);g.fillRect(o-8,o-5,16,1)}
 if(st>=2){g.fillStyle='#bdb595';g.fillRect(o-8,o-4,16,7);g.fillStyle='#a39c7f';g.fillRect(o-8,o+1,16,2);g.fillStyle='#d6cfb1';g.fillRect(o-7,o-4,14,1)}
 if(st>=3){g.fillStyle='#f2efe4';g.fillRect(o-2,o-3,5,5);g.fillStyle='#c0302a';g.fillRect(o,o-3,1,5);g.fillRect(o-2,o-1,5,1);g.fillStyle='#2a241b';g.fillRect(o+4,o-1,3,4)}}
const TENT=[null];
function tentSprite(){if(TENT[0])return TENT[0];const c=mkc(26,22),g=c.getContext('2d');tent(g,13,3);g.fillStyle='#6b5436';g.fillRect(19,1,1,11);g.fillStyle='#f2efe4';g.fillRect(20,1,5,4);g.fillStyle='#c0302a';g.fillRect(22,1,1,4);g.fillRect(20,2,5,1);return TENT[0]=c}
function aidSprite(s){const c=mkc(26,22),g=c.getContext('2d');if(s.stage>=3)return mkc(1,1);
 if(s.stage===0){g.fillStyle='#d9e0a6';for(let x=4;x<22;x+=2){g.fillRect(x,6,1,1);g.fillRect(x,16,1,1)}g.fillStyle='#bdb595';g.fillRect(5,9,Math.round(16*clamp(s.work/s.need[0],0,1)),4);return c}
 tent(g,13,s.stage);return c}
if(window.PXSAP&&window.PXFORT){const K=PXSAP.cfg.KIND;
 K.aid={need:[8,20,32],target:3,cost:CFG.COST,label:'Posto de socorro (padioleiros): clique',box:{hw:18,hh:14},sprite:aidSprite,
  onStage:(s,st)=>{if(st===2)PXSAP.addAnchor(s,{hw:16,hh:12,slots:2,pk:.6,line:'support'});if(st===3){addPost(s.team,s.x,s.y,s);const it=s.p.item;if(it){it.done=true;it.seg=s}}}};
 PXFORT.SHORT.aid='Socorro';PXFORT.SUB.aid='Padioleiros salvam feridos';
 PXFORT.planExtra.push((t,FX,fc)=>[{kind:'aid',pts:[[FX-fc*230,430]],pri:42},{kind:'aid',pts:[[FX-fc*230,1170]],pri:56}])}

/* ---------- desenho ---------- */
function drawUnder(c,ox,oy){if(!S.on||S.customDraw)return;const sp=tentSprite();
 for(const p of POSTS){const x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z);if(x<-20||y<-20||x>vw+20||y>vh+20)continue;c.drawImage(sp,x-13,y-11);
  for(let i=0;i<CFG.BEDS;i++){const b=bedPos(p,i),bx=ox+Math.round(b.x*Z),by=oy+Math.round(b.y*Z);rect(c,bx-3,by,7,2,'#6b5436');rect(c,bx-2,by,5,1,'#bdb595')}}}
function bearer(c,x,y,step){rect(c,x-1,y-3,3,4,'#6f7448');rect(c,x-1,y-5,3,2,'#ceb38b');rect(c,x-1,y-2,3,1,'#f2efe4');rect(c,x,y-2,1,1,'#c0302a');rect(c,x-1,y+1,1,1+step,'#303b32');rect(c,x+1,y+1,1,2-step,'#303b32')}
function drawOver(c,ox,oy){if(!S.on||S.customDraw)return;
 for(const p of POSTS)for(const k of p.crews){if(k.st==='dead')continue;const x=ox+Math.round(k.x*Z),y=oy+Math.round(k.y*Z);if(x<-10||y<-10||x>vw+10||y>vh+10)continue;
  const mv=k.st==='go'||k.st==='carry',step=mv?((time*8+k.i)|0)%2:0;
  if(k.st==='carry'||k.st==='load'){rect(c,x-5,y-1,11,1,'#6b5436');rect(c,x-4,y-2,9,1,'#bdb595')}
  bearer(c,x-5,y,step);bearer(c,x+5,y,1-step)}
 for(const u of units){if(!u.down||u.inBed)continue;if(u.team!==playerTeam&&window.PXW&&PXW.visible&&!PXW.visible(u))continue;
  const x=ox+Math.round(u.x*Z),y=oy+Math.round(u.y*Z);if(x<-6||y<-12||x>vw+6||y>vh+6)continue;
  if(u.team===playerTeam&&!u.carried&&((time*2)|0)%2){rect(c,x-1,y-9,3,1,'#f2efe4');rect(c,x,y-10,1,3,'#f2efe4');if(u.claimed){rect(c,x-1,y-9,3,1,'#c0302a');rect(c,x,y-10,1,3,'#c0302a')}}}}
if(window.WW1A){const under=WW1A.under,over=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){under.call(this,c,ox,oy,dt);try{drawUnder(c,ox,oy)}catch(e){fail(e)}};
 WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);try{drawOver(c,ox,oy)}catch(e){fail(e)}}}
/* caído: deitado (sprite girado 90°), mais escuro; na maca vai por cima da maca */
const ROT=new WeakMap();
function rot(src){let r=ROT.get(src);if(r)return r;r=mkc(src.height,src.width);const g=r.getContext('2d');g.translate(src.height,0);g.rotate(Math.PI/2);g.drawImage(src,0,0);ROT.set(src,r);return r}
if(!window.PHYS)window.PHYS={on:false,draw:()=>false};
{const orig=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){if(!S.on||!u.down)return orig.call(PHYS,c,u,sp,sx,sy,vis,bob);
 try{const r=rot(sp.c);c.drawImage(r,sx-(r.width>>1),sy-(r.height>>1)+(u.carried?0:4));c.globalAlpha=.25;c.fillStyle='#000';c.fillRect(sx-6,sy+1,12,3);c.globalAlpha=1;return true}catch(e){fail(e);return orig.call(PHYS,c,u,sp,sx,sy,vis,bob)}}}

S.state=()=>({on:S.on,posts:POSTS.map(p=>({team:p.team,hp:Math.round(p.hp),beds:p.beds.length,incoming:reserved(p),crews:p.crews.map(c=>c.st).join('/')})),down:[0,1].map(t=>units.filter(u=>u.team===t&&u.down).length),stats:{...S.stats}});
S.addPost=addPost;S.bedPos=bedPos;S.customDraw=false;              // art-medics.js assume o desenho de postos, macas e feridos
S.reset=reset;S.tick=tick;
S.context=context;S.capacity=capacity;
Object.defineProperty(S,'posts',{get:()=>POSTS});
if(window.IronFront)window.IronFront.medics=S;
})();
