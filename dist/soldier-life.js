'use strict';
/* Iron Front 1.9 — vida e estados contextuais da infantaria (soldier-life.js). Carrega DEPOIS de casualty.js e ANTES de classes.js
   (as marcas de classe são desenhadas por cima das poses daqui).
   Água ........... funda (PXW.depth ≥ .55): arma erguida acima da cabeça, sem tiro (nem IA nem jogador); rasa (.25–.55): atira,
                    passo mais pesado (o weather.js já freia). Terra → rasa → funda → terra é contínuo: o recorte do sprite e a
                    linha d'água do pixel.js seguem a profundidade a cada quadro.
   Trincheira ..... quem está num trecho de trincheira (campo ou obra) e parado assume uma postura com efeito real:
                      abrigado (só o capacete aparece) ... supressão > .9, recarregando ou logo após uma explosão:
                                                           proteção .18 (era .35), não atira;
                      observando (capacete e ombros) ... inimigo perto sem alvo, ou o jogador sem atirar: proteção .28;
                      mirando / disparando ............. tem alvo: sobe no degrau de tiro, proteção normal;
                      encostado (descanso) ............. sem inimigo por perto: encosta na parede, microanimações.
                    Andando dentro da trincheira: corre abaixado. Saindo da trincheira: 0,5 s escalando o parapeito (anda a 40%).
   Explosão perto . quem está entre o raio letal e 2,4× o raio abaixa depois de 0,1–0,35 s de reação: 0,6–1,3 s sem andar
                    (20%) e sem atirar; ganha supressão; um deles grita ("GET DOWN!" / "DECKUNG!", "INCOMING!" para obus).
   Gritos ......... companheiro cai → alguém perto chama o médico; supressão subindo rápido em campo aberto → "MG!".
   Microanimações . parado e longe do inimigo: ajeita o capacete, limpa o fuzil, olha em volta, fuma encostado na trincheira;
                    na lama funda, às vezes tropeça (0,7 s parado).
   ?vida=0 desliga (junto com o life-kit) · IronFront.life.state(). */
(function(){
if(!window.IFK)return;
const K=IFK,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('soldier-life.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={DEEP:.55,WET:.25,PROT:{low:.18,peek:.28},DUCK:[.6,1.3],REACT:[.08,.35],DUCKR:2.4,DUCKMOVE:.2,CLIMB:.5,CLIMBMOVE:.4,
 SUPP_LOW:.9,IDLE:[8,22],TRIP:.004,TRIPT:.7,CHK:.3};
const S=window.PXLIFE={on:K.on&&!/[?&]vida_tropa=0/.test(location.search),version:'1.9',cfg:CFG,
 stats:{deepNoFire:0,ducks:0,climbs:0,trips:0,idles:0,shouts:0,lowTime:0,peekTime:0,aimTime:0,runTime:0,errors:0}};
let errs=0,mgShout=[-99,-99],sayDeep=-99;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('soldier-life.js:',e);if(errs>=12){S.on=false;console.error('soldier-life.js desligado após erros repetidos')}}
const inf=u=>(u.type==='rifle'||u.type==='mg')&&u.hp>0&&!u.down;
const lf=u=>u.lf||(u.lf={chk:time+(u.id%10)*.03,tr:null,pose:'',prot:null,duckAt:0,duck:0,climb:0,trip:0,idleAt:time+rnd(...CFG.IDLE),idle:'',idleT:0,water:0,sup0:0,last:-9});
const depth=u=>window.PXW&&PXW.depth?PXW.depth(u.x,u.y):0;
const soldierP=u=>u===player&&mode==='soldier';
const busy=u=>u.down||u.rs||u.pinned||(u.sapState&&u.sapState!=='walk')||(u.pv&&u.pv.stun>0)||u.thr>0;

/* ---------- decisão por unidade ---------- */
function think(u,dt){const L=lf(u);
 /* trecho de trincheira (checado a cada 0,3 s, defasado por id) */
 if(time>=L.chk){L.chk=time+CFG.CHK;const was=L.tr;L.tr=K.trenchOf(u);if(L.tr)L.trx=u.x;
  /* saiu da trincheira para a frente (rumo ao inimigo), em combate: escala o parapeito */
  if(was&&!L.tr&&u.moving&&!soldierP(u)&&!u.sap&&(u.x-L.trx)*(u.team?-1:1)>3){L.climb=time+CFG.CLIMB;S.stats.climbs++}}
 /* água */
 const d=depth(u);L.water=d>=CFG.DEEP?2:d>=CFG.WET?1:0;
 if(L.water===2){u.cd=Math.max(u.cd||0,.3);S.stats.deepNoFire+=dt;if(soldierP(u)&&time-sayDeep>12){sayDeep=time;try{toast('Água funda: fuzil erguido acima da cabeça — sem tiro até dar pé.')}catch{}}
  if(!soldierP(u)&&Math.random()<dt*.05)K.shout(u,'water',1.2)}
 /* reação à explosão */
 if(L.duckAt&&time>=L.duckAt){L.duckAt=0;L.duck=time+rnd(...CFG.DUCK);S.stats.ducks++}
 const ducking=L.duck>time;if(ducking)u.cd=Math.max(u.cd||0,.25);
 /* tropeço na lama */
 if(u.moving&&!soldierP(u)&&L.water===0&&window.PXW&&PXW.mudAt&&Math.random()<dt*CFG.TRIP&&PXW.mudAt(u.x,u.y)>.6){L.trip=time+CFG.TRIPT;S.stats.trips++;particles.push({x:u.x,y:u.y+4,vx:0,vy:-6,t:.4,max:.4,color:'#5a4a33',size:5})}
 /* supressão subindo rápido em campo aberto: "MG!" */
 const sp=u.suppression||0;if(!L.tr&&sp-L.sup0>.45&&time-mgShout[u.team]>7){mgShout[u.team]=time;if(K.shout(u,'mg',1.2))S.stats.shouts++}if(time-(L.supT||0)>1){L.sup0=sp;L.supT=time}
 /* postura na trincheira */
 L.pose='';L.prot=null;
 if(L.water)return;
 if(L.tr&&!busy(u)){
  if(u.moving)L.pose='run';
  else if(soldierP(u)){const firing=mouse.down||u.aiming||time-(L.last||-9)<.8;L.pose=firing?'aim':'peek';if(!firing)L.prot=CFG.PROT.peek}
  else if(ducking||u.rl>0||sp>CFG.SUPP_LOW){L.pose='low';L.prot=CFG.PROT.low;u.cd=Math.max(u.cd||0,.3)}
  else if(u.target)L.pose='aim';
  else if(u.underFire>0||sp>.2)L.pose='peek',L.prot=CFG.PROT.peek;
  else L.pose='rest';
  if(L.pose!=='rest')S.stats[L.pose+'Time']+=dt}
 /* microanimações: parado, sem inimigo por perto */
 if(!u.moving&&!u.target&&sp<.1&&!(u.underFire>0)&&!busy(u)&&!soldierP(u)){
  if(!L.idle&&time>=L.idleAt){const opts=L.pose==='rest'?['helmet','wipe','look','smoke']:['helmet','wipe','look'];L.idle=opts[(Math.random()*opts.length)|0];L.idleT=time;L.idleUntil=time+(L.idle==='smoke'?4:L.idle==='look'?2.2:1.4);S.stats.idles++}
  if(L.idle&&time>=L.idleUntil){L.idle='';L.idleAt=time+rnd(...CFG.IDLE)}
  if(L.idle==='look')u.angle=(u.team?Math.PI:0)+Math.sin((time-L.idleT)*2.6)*.7;
  if(L.idle==='smoke'&&Math.random()<dt*1.2)particles.push({x:u.x+3,y:u.y-6,vx:rnd(-2,2),vy:-7,t:1.2,max:1.2,color:'#c9c7b8',size:2})}
 else if(L.idle){L.idle='';L.idleAt=time+rnd(...CFG.IDLE)}}

/* ---------- ligações ---------- */
const PRE=[];
wrap('update',(orig,dt)=>{if(!S.on||!started||ended)return orig(dt);
 PRE.length=0;for(const u of units){const L=u.lf;if(inf(u)&&(!L||L.water)&&depth(u)>=CFG.DEEP)u.cd=Math.max(u.cd||0,.3);   // água funda: trava o tiro já neste quadro
  if(!L||!inf(u)||soldierP(u))continue;const f=L.duck>time?CFG.DUCKMOVE:L.trip>time?0:L.climb>time?CFG.CLIMBMOVE:1;if(f<1){u._lx=u.x;u._ly=u.y;u._lf=f;PRE.push(u)}}
 orig(dt);
 try{for(const u of PRE){if(u.hp<=0)continue;u.x=u._lx+(u.x-u._lx)*u._lf;u.y=u._ly+(u.y-u._ly)*u._lf}
  for(const u of units)if(inf(u))think(u,dt);
  if(player&&mode==='soldier'&&mouse.down&&player.lf)player.lf.last=time}catch(e){fail(e)}});
wrap('protectedBy',(orig,u)=>{const f=orig(u);if(!S.on||!u.lf||u.lf.prot==null||!u.lf.tr)return f;return Math.min(f,u.lf.prot)});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on||r<20)return;try{
 let caller=null,cd=Infinity;const R=r*CFG.DUCKR;
 for(const u of units){if(!inf(u)||soldierP(u))continue;const d=hyp(u.x-x,u.y-y);if(d<r*.6||d>R)continue;const L=lf(u);
  if(L.duck<time&&!L.duckAt)L.duckAt=time+rnd(...CFG.REACT);u.suppression=Math.min(2,(u.suppression||0)+.25*(1-d/R));
  const dc=hyp(u.x-cam.x,u.y-cam.y);if(dc<cd){cd=dc;caller=u}}
 if(caller&&K.shout(caller,r>=60?'arty':'down',1.3))S.stats.shouts++}catch(e){fail(e)}});
/* companheiro caiu: alguém perto chama o médico */
wrap('damage',(orig,u,n,attacker)=>{const was=u&&u.down;const r=orig(u,n,attacker);if(!S.on||!u||was||!u.down)return r;try{
 let best=null,bd=70*70;for(const o of units){if(o===u||o.team!==u.team||!inf(o))continue;const d=(o.x-u.x)**2+(o.y-u.y)**2;if(d<bd){bd=d;best=o}}
 if(best&&Math.random()<.6&&K.shout(best,'medic',1.4))S.stats.shouts++}catch(e){fail(e)}return r});

/* ---------- desenho ---------- */
function rifleUp(c,u,sx,sy){/* fuzil atravessado acima do capacete, mãos segurando */
 const y=sy-11+(((time*3+u.id)|0)%2),wood='#6b4a2c',steel='#3c403a';c.fillStyle=wood;c.fillRect(sx-5,y,7,1);c.fillStyle=steel;c.fillRect(sx+2,y,3,1);
 c.fillStyle='#dcb690';c.fillRect(sx-3,y+1,1,1);c.fillRect(sx+1,y+1,1,1)}
if(window.PHYS){const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){
 const L=u.lf;if(!S.on||!L||u.down||u.rs||!inf(u)||(soldierP(u)&&window.PXCAS&&PXCAS.playerBusy&&PXCAS.playerBusy()))return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
 try{
  if(L.water===2&&!busy(u)){K.pose(c,sp,sx,sy,vis,bob,{u});rifleUp(c,u,sx,sy+bob);return true}
  if(busy(u)||L.water)return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
  const t=time;
  if(L.trip>t||L.climb>t)return K.pose(c,sp,sx,sy,vis,bob,{crouch:1,u,dy:L.climb>t?-1:0});
  if(L.duck>t)return K.pose(c,sp,sx,sy,vis,bob,L.tr?{low:2,u}:{crouch:1,u});
  switch(L.pose){
  case 'low':return K.pose(c,sp,sx,sy,vis,bob,{low:2,u});
  case 'peek':return K.pose(c,sp,sx,sy,vis,bob,{low:1,u});
  case 'rest':{const dx=u.team?1:-1,hel=L.idle==='helmet'&&((t-L.idleT)%1.4)<.5?-1:0;K.pose(c,sp,sx,sy,vis,bob,{low:1,u,dx});
   if(hel){c.fillStyle='#dcb690';c.fillRect(sx+dx-1,sy-6,1,1)}if(L.idle==='smoke'&&((t*3)|0)%3){c.fillStyle='#ff9a3a';c.fillRect(sx+dx+2,sy-4,1,1)}return true}
  case 'run':return K.pose(c,sp,sx,sy,vis,bob,{crouch:1,u,dy:((t*8+u.id)|0)%2?0:-1});
  case 'aim':return K.pose(c,sp,sx,sy,vis,bob,{cut:4,u});
  }
  if(L.idle==='helmet'&&((t-L.idleT)%1.4)<.5){K.plain(c,sp,sx,sy,vis,bob);K.poseU=u;K.poseDy=0;c.fillStyle='#dcb690';c.fillRect(sx-1,sy-6,1,1);return true}
  if(L.idle==='wipe'&&((t*4)|0)%2){K.plain(c,sp,sx,sy,vis,bob);K.poseU=u;K.poseDy=0;c.fillStyle='#e8e2c0';c.fillRect(sx+Math.round(Math.cos(u.angle)*5),sy-1+Math.round(Math.sin(u.angle)*5),1,1);return true}
 }catch(e){fail(e)}
 return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}

S.state=()=>{const n={};for(const u of units)if(u.lf&&inf(u)){const k=u.lf.water===2?'água funda':u.lf.water===1?'água rasa':u.lf.pose||(u.lf.duck>time?'abaixado':'-');n[k]=(n[k]||0)+1}return {on:S.on,poses:n,stats:{...S.stats}}};
S.think=think;
if(window.IronFront)window.IronFront.life=S;
})();
