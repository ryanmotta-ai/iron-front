/* Bunkers com guarnição real (feedback #1, item 17).
   Um bunker só dispara com soldados dentro (shelter.js já cala o bunker sem guarnição). Aqui os 2 homens que o guarnecem passam a
   ficar FISICAMENTE dentro dele: somem do campo (não são vistos nem andam), continuam na contagem de população e deixam de atirar
   por conta própria — quem atira é a metralhadora do bunker.
   · Bunker destruído → cada ocupante: 35 % morre, 30 % sai ferido (caído, esperando maqueiro), 35 % sobrevive e sai com 60 % da vida.
   · Guarnição abandona (ordem de movimento): o homem reaparece na porta e o bunker se cala.
   · Bunker com um só ocupante dispara em ritmo reduzido? Não: o shelter.js já distribui os postos; aqui o limite é 2 homens.
   Liga/desliga: ?guarnicaobunker=0 · API: IronFront.bunkers (state). */
(function(){
'use strict';
if(typeof update!=='function'||typeof units==='undefined')return;
const hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a);
const S=window.PXBUNK={on:!/[?&]guarnicaobunker=0/.test(location.search),version:'1.0',cfg:{R:26,CAP:2,SETTLE:1.6},occ:new Map(),stats:{inside:0,killed:0,wounded:0,survived:0,released:0,errors:0}};
let errs=0,T_=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('bunkers.js:',e);if(errs>=12){S.on=false;console.error('bunkers.js desligado após erros repetidos')}}
const live=u=>u&&u.hp>0&&!u.down&&!u.rs&&!u.carried&&!u.inBed;
const inf=u=>u.type==='rifle'||u.type==='mg';
const SLOT=[{x:-5,y:-3},{x:5,y:3}];

function release(u,b,why){
 u.inBunk=null;u.manualUntil=Math.min(u.manualUntil||0,time+.3);S.stats.released++;
 if(b){const f=b.team?-1:1;u.x=b.x-f*(30+rnd(0,6));u.y=b.y+rnd(-14,14)}
}
function destroyed(b,list){
 let k=0,w=0,s=0;
 for(const u of list){if(u.hp<=0||!u.inBunk)continue;const r=Math.random();u.inBunk=null;
  const f=b.team?-1:1;u.x=b.x-f*(32+rnd(0,8));u.y=b.y+rnd(-16,16);
  if(r<.35){k++;damage(u,9999,1-b.team)}
  else if(r<.65){w++;u.hp=Math.min(u.hp,u.maxhp*.25);if(typeof PXMED!=='undefined'&&PXMED.on){u.down=true;u.bleed=time+rnd(50,75)}u.manualUntil=time+2}
  else{s++;u.hp=Math.max(1,u.hp*.6);u.suppression=1.2;u.manualUntil=time}}
 S.stats.killed+=k;S.stats.wounded+=w;S.stats.survived+=s;
 if(b.team===playerTeam&&(k+w+s)>0)toast(`Bunker destruído: guarnição ${k} morta(s), ${w} ferida(s), ${s} sobrevivente(s).`);
}
function tick(dt){
 const alive=new Set();
 for(const b of buildings){if(b.type!=='bunker'||b.hp<=0)continue;alive.add(b);
  let list=S.occ.get(b);if(!list){list=[];S.occ.set(b,list)}
  for(let i=list.length-1;i>=0;i--){const u=list[i];
   if(!live(u)||hyp(u.x-b.x,u.y-b.y)>S.cfg.R+8||u.manualUntil>time+3&&u.order==='move'&&hyp((u.tx||0)-b.x,(u.ty||0)-b.y)>50){if(u.inBunk===b)release(u,b,'saiu');list.splice(i,1)}}
  if(list.length<S.cfg.CAP){
   for(const u of units){if(list.length>=S.cfg.CAP)break;
    if(u.team!==b.team||!inf(u)||!live(u)||u.inBunk||u.gid||u.sh||Math.abs(u.x-b.x)>S.cfg.R||Math.abs(u.y-b.y)>S.cfg.R||u===player)continue;
    if(u.order!=='hold'||u.moving){u._bkT=0;continue}
    u._bkT=(u._bkT||0)+dt*2;
    if(u._bkT>=S.cfg.SETTLE){u.inBunk=b;u._bkT=0;list.push(u);S.stats.inside++}}}
  list.forEach((u,i)=>{const f=b.team?-1:1,s=SLOT[i%2];u.x=b.x+s.x*f;u.y=b.y+s.y;u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=Math.max(u.manualUntil||0,time+1.5)});
  b.inside=list.length;
 }
 for(const [b,list] of S.occ)if(!alive.has(b)){destroyed(b,list);S.occ.delete(b)}
}
/* os de dentro não atiram por conta própria: o bunker é a arma */
const update0=window.update;
window.update=function(dt){
 const r=update0.apply(this,arguments);
 if(!S.on||!started||ended||!(dt>0))return r;
 try{for(const list of S.occ.values())for(const u of list)if(u.hp>0){u.cd=Math.max(u.cd||0,.4);u.moving=false}
  if((T_-=dt)<=0){T_=.5;tick(.5)}}catch(e){fail(e)}
 return r;
};
const setup0=window.setup;
window.setup=function(){S.occ=new Map();return setup0.apply(this,arguments)};
if(window.PHYS){const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){if(S.on&&u.inBunk)return true;return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}
S.state=()=>({on:S.on,bunkers:[...S.occ].map(([b,l])=>({team:b.team,x:Math.round(b.x),y:Math.round(b.y),inside:l.length,hp:Math.round(b.hp)})),stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.bunkers=S;
})();
