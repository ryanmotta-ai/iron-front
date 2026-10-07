/* Limpeza gradual do campo de batalha (feedback #1, item 14).
   Nada some "de repente": cada coisa passa por fade, degradação ou simplificação antes de sair.
   · Sangue ......... a camada seca do blood.js perde ~3 % a cada 5 s (meia-vida ≈ 2 min); a chuva continua lavando como antes.
   · Corpos ......... ficam ~60 s (35 s com mais de 240 unidades) e viram uma mancha escura simplificada que esmaece em 40 s; limite de
                      corpos vivos cai com a carga (400 → 160 com muitas unidades). Corpos boiando na água seguem a regra antiga.
   · Carcaças de tanque ficam muito mais tempo — servem de COBERTURA (protectedBy ×0,5) e, se recuperáveis, de objetivo para os
                      engenheiros mecânicos: 1º estágio completo (≈5 min), 2º simplificado (≈10 min), depois fade; só somem se estiverem
                      longe da câmera e sem ninguém por perto. Máximo de 24.
   Liga/desliga: ?limpeza=0 · API: IronFront.cleanup (hulks, hulkAt, smears, state). */
(function(){
'use strict';
if(typeof update!=='function'||typeof corpses==='undefined')return;
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v;
const S=window.PXCLEAN={on:!/[?&]limpeza=0/.test(location.search),version:'1.0',cfg:{CORPSE:60,CORPSE_BUSY:35,BUSY:240,SMEAR:40,BLOOD_EVERY:5,BLOOD_A:.06,HULK1:300,HULK2:600,HULK_END:75,MAXH:24,CAPSEARCH:900},hulks:[],smears:[],stats:{corpsesAged:0,hulks:0,hulksGone:0,bloodFades:0,errors:0}};
let errs=0,bloodT=0,scanT=0,smearT=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('cleanup.js:',e);if(errs>=12){S.on=false;console.error('cleanup.js desligado após erros repetidos')}}
const live=u=>u.hp>0;

S.hulkAt=(x,y,team,r=30)=>{let best=null,bd=r;for(const h of S.hulks){if(h.t<=0||(team!==undefined&&h.team!==team))continue;const d=hyp(h.x-x,h.y-y);if(d<bd){bd=d;best=h}}return best};

/* ---------- varredura: carcaças novas e corpos velhos ---------- */
function hulkScan(){
 for(const u of units){if(u.type!=='tank'||u.hp>0||u._hk)continue;u._hk=1;
  S.hulks.push({x:u.x,y:u.y,team:u.team,angle:u.angle||0,born:time,t:1e9,age:0,rec:Math.random()<.45&&u.hp>-260,seed:u.id*7,id:u.id});S.stats.hulks++;
  if(S.hulks.length>S.cfg.MAXH){const old=S.hulks.reduce((a,b)=>a.born<b.born?a:b);old.fading=Math.min(old.fading||S.cfg.HULK_END,S.cfg.HULK_END-2);old.age=Math.max(old.age,S.cfg.HULK2)}}
}
function scan(dt){
 const busy=units.length>S.cfg.BUSY,lim=busy?S.cfg.CORPSE_BUSY:S.cfg.CORPSE;
 if(corpses.length>(busy?160:400))while(corpses.length>(busy?140:380)){const c=corpses.shift();smear(c)}
 for(let i=corpses.length-1;i>=0;i--){const c=corpses[i];if(c.fl||c.born==null)continue;if(time-c.born>lim){corpses.splice(i,1);smear(c);S.stats.corpsesAged++}}
}
function smear(c){if(S.smears.length>=260)S.smears.shift();S.smears.push({x:c.x+(c.sx||0)*.4,y:c.y+(c.sy||0)*.4,team:c.team,t:0,seed:((c.id||0)*13+c.team)|0})}

function tick(dt){
 for(const h of S.hulks){h.age=time-h.born;
  if(h.age>S.cfg.HULK2&&!h.fading){const cam_=hyp(h.x-cam.x,h.y-cam.y);let near=false;for(const u of units)if(u.hp>0&&Math.abs(u.x-h.x)<170&&Math.abs(u.y-h.y)<170){near=true;break}
   if(cam_>S.cfg.CAPSEARCH&&!near)h.fading=S.cfg.HULK_END}
  if(h.fading!==undefined){h.fading-=dt;if(h.fading<=0)h.t=0}
  if(h.age>S.cfg.HULK2+1500&&!h.fading)h.fading=S.cfg.HULK_END}
 const before=S.hulks.length;S.hulks=S.hulks.filter(h=>h.t>0);S.stats.hulksGone+=before-S.hulks.length;
 for(const m of S.smears)m.t+=dt;S.smears=S.smears.filter(m=>m.t<S.cfg.SMEAR+30);
 bloodT-=dt;if(bloodT<=0){bloodT=S.cfg.BLOOD_EVERY;fadeBlood()}
}
function fadeBlood(){
 try{const L=window.IronFront?.blood?.layers;const dry=L&&L.dry;if(!dry)return;const g=dry.getContext('2d');
  g.globalCompositeOperation='destination-out';g.globalAlpha=S.cfg.BLOOD_A;g.fillStyle='#000';g.fillRect(0,0,dry.width,dry.height);g.globalCompositeOperation='source-over';g.globalAlpha=1;S.stats.bloodFades++}catch(e){}
}

/* ---------- cobertura: a carcaça protege ---------- */
const wrap=(n,fn)=>{const o=window[n];if(typeof o!=='function')return;window[n]=function(...a){return fn(o,...a)}};
wrap('protectedBy',(orig,u)=>{const f=orig(u);if(!S.on||u.type==='tank'||!S.hulks.length||f<=.5)return f;
 for(const h of S.hulks)if(h.t>0&&Math.abs(h.x-u.x)<26&&Math.abs(h.y-u.y)<20)return Math.min(f,.5);return f});

/* ---------- desenho: carcaça (estágios) e manchas ---------- */
function drawHulk(c,ox,oy,h){
 const Z=(window.PX&&PX.Z)||.5,x=ox+Math.round(h.x*Z),y=oy+Math.round(h.y*Z);
 if(x<-40||y<-40||x>vw+40||y>vh+40||h.age<55)return;
 const stage=h.age>S.cfg.HULK2?2:h.age>S.cfg.HULK1?1:0,fade=h.fading!==undefined?clamp(h.fading/S.cfg.HULK_END,0,1):1,horiz=Math.abs(Math.cos(h.angle))>=.5,w=horiz?22:14,hh=horiz?14:22;
 c.globalAlpha=fade;
 if(stage<2){c.fillStyle='#0f100c';c.fillRect(x-(w>>1)-1,y-(hh>>1)-1,w+2,hh+2);
  c.fillStyle=stage?'#2a2823':'#33302a';c.fillRect(x-(w>>1),y-(hh>>1),w,hh);
  c.fillStyle='#1b1a16';if(horiz){c.fillRect(x-(w>>1),y-(hh>>1),w,3);c.fillRect(x-(w>>1),y+(hh>>1)-3,w,3)}else{c.fillRect(x-(w>>1),y-(hh>>1),3,hh);c.fillRect(x+(w>>1)-3,y-(hh>>1),3,hh)}
  c.fillStyle=stage?'#3a362e':'#4a4438';c.fillRect(x-4,y-4,8,8);c.fillStyle='#14130f';c.fillRect(x-2,y-2,4,4);
  c.fillStyle='#4a4438';c.fillRect(horiz?x+(h.seed%2?5:-11):x-1,horiz?y-1:y+(h.seed%2?5:-11),horiz?7:2,horiz?2:7);
  if(!stage){c.fillStyle='#6a3a1d';c.fillRect(x-6+(h.seed%5),y-5,3,2);c.fillRect(x+2,y+2,3,2)}}
 else{c.fillStyle='#24211c';c.fillRect(x-7,y-5,14,10);c.fillStyle='#3a342a';c.fillRect(x-4,y-3,8,6);c.fillStyle='#5a3e26';c.fillRect(x-6+(h.seed%4),y+2,4,2)}
 c.globalAlpha=1;
}
function drawSmear(c,ox,oy,m){
 const Z=(window.PX&&PX.Z)||.5,x=ox+Math.round(m.x*Z),y=oy+Math.round(m.y*Z);if(x<-10||y<-10||x>vw+10||y>vh+10)return;
 const a=clamp(1-(m.t-S.cfg.SMEAR*0)/(S.cfg.SMEAR+30),0,1)*(m.t>S.cfg.SMEAR?clamp(1-(m.t-S.cfg.SMEAR)/30,0,1):1)*.75;if(a<=.02)return;
 c.globalAlpha=a;c.fillStyle=m.team?'#2c2d2a':'#2c2f24';c.fillRect(x-2,y-1,5,3);c.fillStyle='#1c1b17';c.fillRect(x-1,y,3,1);c.globalAlpha=1;
}
if(window.WW1A){const under=WW1A.under;WW1A.under=function(c,ox,oy,dt){under.call(this,c,ox,oy,dt);if(!S.on||!started)return;try{for(const m of S.smears)drawSmear(c,ox,oy,m);for(const h of S.hulks)drawHulk(c,ox,oy,h)}catch(e){fail(e)}}}

const update0=window.update;
window.update=function(dt){if(S.on&&started&&!ended){try{hulkScan()}catch(e){fail(e)}}
 const r=update0.apply(this,arguments);if(!S.on||!started||ended||!(dt>0))return r;
 try{hulkScan();scanT-=dt;if(scanT<=0){scanT=.5;scan(dt)}tick(dt)}catch(e){fail(e)}return r};
const setup0=window.setup;
window.setup=function(){S.hulks=[];S.smears=[];bloodT=S.cfg.BLOOD_EVERY;return setup0.apply(this,arguments)};
S.state=()=>({on:S.on,hulks:S.hulks.map(h=>({x:Math.round(h.x),y:Math.round(h.y),team:h.team,age:Math.round(h.age),rec:h.rec,fading:h.fading})),smears:S.smears.length,corpses:corpses.length,stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.cleanup=S;
})();
