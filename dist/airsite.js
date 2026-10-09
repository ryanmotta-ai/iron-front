/* O aeródromo faz parte do campo de batalha (feedback "integração dos aviões com o campo de batalha").
   Cada lado tem o seu campo de aviação DENTRO do mapa (faixa aérea ao sul, y > IronFrontWorld.ground), ao alcance das tropas de terra:
   · SÍTIO ......... o terreno sob o campo é limpo (árvores, ruínas e crateras do cenário saem da área, ninguém usa uma árvore no meio da pista).
   · DANO NO SOLO .. explosões (obuses, bombas, granadas) e rajadas aéreas atingem os aviões estacionados, além das instalações (PXAIRB/PXSTRUCT).
   · GUARNIÇÃO ..... cada exército mantém um pequeno destacamento no campo (6 fuzileiros + 1 MG); se o campo é atacado, a IA manda reforços
                     e o jogador é avisado pelo oficial do aeródromo.
   · CAPTURA ....... 3+ soldados inimigos dentro do campo, com o dobro dos defensores, por 15 s tomam o aeródromo: sem decolagens, antiaérea muda,
                     aviões estacionados perdidos, bandeira trocada. Retomar vale o mesmo (defensores 2:1 por 15 s).
   · FOGO CONTRA AVIÕES ... fuzileiros e metralhadoras atiram em aviões baixos (<180 u) a até 240 px: a infantaria passa a incomodar quem rasa.
   · MINIMAPA ...... os dois aeródromos aparecem no minimapa (verde = nosso, vermelho/azul pela facção; piscando = sob ataque).
   Liga/desliga: ?campoaereo=0 · API: IronFront.airsite (state, overrun, box, inside). */
(function(){
'use strict';
if(typeof update!=='function'||!window.PXAW)return;
const A=window.PXAW,hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const S=window.PXSITE={on:!/[?&]campoaereo=0/.test(location.search),version:'1.0',cfg:{CAPTURE:15,MIN:3,RATIO:2,GARRISON:6,RIFLE_R:240,RIFLE_H:180,RIFLE_P:.0035,ALERT:30,REINF_EVERY:45},
 st:[{overrun:false,cap:0,back:0,alertAt:-99,reinfAt:-99,garrison:[],attacked:0},{overrun:false,cap:0,back:0,alertAt:-99,reinfAt:-99,garrison:[],attacked:0}],stats:{cleaned:0,planesLost:0,captures:0,retaken:0,riflesHits:0,reinforcements:0,errors:0},ready:false};
let errs=0,T_=0,rifleT=0,guardT=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('airsite.js:',e);if(errs>=12){S.on=false;console.error('airsite.js desligado após erros repetidos')}}
const live=u=>u&&u.hp>0&&!u.down&&!u.rs&&!u.carried&&!u.inBed;
const AF=()=>A.airfields?.()||[];
const C=()=>window.PXCOMM,O=()=>window.PXORD;
const inBox=(af,x,y,pad=0)=>{const B=af&&af.box;return !!B&&x>=B.x0-pad&&x<=B.x1+pad&&y>=B.y0-pad&&y<=B.y1+pad};
S.box=t=>AF()[t]?.box||null;
S.inside=(t,x,y,pad)=>inBox(AF()[t],x,y,pad);
S.overrun=t=>!!S.st[t].overrun;

/* ---------- sítio: limpa o cenário sob o campo ---------- */
function clean(){
 const afs=AF();if(!afs[0]||!afs[1]||!afs[0].compact)return false;
 const pad=30,inAny=(x,y)=>afs.some(f=>inBox(f,x,y,pad));
 let n=0;
 if(typeof decor!=='undefined'){const before=decor.length;decor=decor.filter(d=>!inAny(d.x,d.y));n+=before-decor.length}
 if(typeof allCraters!=='undefined'){const before=allCraters.length;allCraters=allCraters.filter(c=>!inAny(c.x,c.y));n+=before-allCraters.length}
 if(typeof indexTerrainCover==='function')indexTerrainCover();
 S.stats.cleaned=n;return true;
}

/* ---------- dano ao solo: aviões estacionados sob explosão e rajada ---------- */
function parked(){return A.planes().filter(a=>a.st==='park'&&!a.dead&&!a.gone)}
function killPlane(a,why){try{A._internals.down(a,null,why,'break');S.stats.planesLost++}catch(e){}}
const wrap=(n,fn)=>{const o=window[n];if(typeof o!=='function')return;window[n]=function(...a){return fn(o,...a)}};
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on||!S.ready||power<30)return;
 try{for(const a of parked()){const d=hyp(a.x-x,a.y-y),rad=r*.85+(a.T.span||100)*.35;if(d>=rad)continue;if(Math.random()<clamp(.9*(1-d/rad)+.1,.1,.85)*(power>=100?1:.6)){killPlane(a,'bomba');noteLoss(a.team,x,y)}}}catch(e){fail(e)}});
function strafeTick(){
 if(typeof bullets==='undefined'||!bullets.length)return;const pk=parked();if(!pk.length)return;
 for(const b of bullets){if(!(b.damage>0)||b.t<=0||!b.air)continue;
  for(const a of pk){if(a.team===b.team||a.dead||a.gone)continue;const hw=(a.T.span||100)/2,hh=(a.T.len||70)/2;if(Math.abs(b.x-a.x)>hw||Math.abs(b.y-a.y)>hh)continue;
   b.t=-1;if(Math.random()<.35){try{A._internals.hit(a,null,[0,0,1])}catch(e){}if(a.dmg>.5&&Math.random()<.2){killPlane(a,'metralhamento');noteLoss(a.team,a.x,a.y)}}break}}
}
function noteLoss(team,x,y){
 const c=C();if(c&&team===playerTeam)c.report(team,null,'airfield','General, estamos perdendo aviões no campo!',{kind:'alert',cd:25,speaker:'Oficial do aeródromo',x,y,short:'PERDEMOS AVIOES!'});
}

/* ---------- fuzileiros e MG contra aviões baixos ---------- */
function rifleFire(dt){
 const pl=A.planes().filter(a=>a.air&&!a.dead&&!a.gone&&a.h<S.cfg.RIFLE_H);if(!pl.length)return;
 for(const a of pl){let n=0;for(const u of units){if(u.team===a.team||!live(u)||(u.type!=='rifle'&&u.type!=='mg'))continue;if(Math.abs(u.x-a.x)>S.cfg.RIFLE_R||Math.abs(u.y-a.y)>S.cfg.RIFLE_R)continue;if(hyp(u.x-a.x,u.y-a.y)>S.cfg.RIFLE_R)continue;n+=u.type==='mg'?2.5:1;if(n>14)break}
  if(n&&Math.random()<1-Math.pow(1-S.cfg.RIFLE_P*(1-a.h/S.cfg.RIFLE_H),Math.min(n,14)*dt*2)){S.stats.riflesHits++;try{A._internals.hit(a,null,[0,0,1])}catch(e){}}}
}

/* ---------- captura, defesa e guarnição ---------- */
function count(t){const af=AF()[t],own=[0,0];if(!af)return own;for(const u of units){if(!live(u)||u.sap||u.cls==='medic'||u.cls==='mechanic'||u.type==='cavalry')continue;if(!inBox(af,u.x,u.y))continue;own[u.team]+=u.type==='tank'?3:u.type==='mg'?1.5:1}return own}
function say(t,txt,kind='alert',x,y){const c=C();if(c)c.say(t,'Oficial do aeródromo',txt,kind,null,{immediate:true,x,y})}
function siteTick(dt){
 for(const t of [0,1]){const af=AF()[t],st=S.st[t];if(!af)continue;const c=count(t),foe=c[1-t],own=c[t],owner=af.flag===undefined?t:af.flag;
  const attacked=T().list.some(e=>e.team===t&&e.ref&&['runway','hangar','afuel','amdump','tower','aaa'].includes(e.kind)&&e.lastHit&&time-e.lastHit<8);
  st.attacked=foe>0||attacked?time:st.attacked;
  if(!st.overrun){
   if(foe>=S.cfg.MIN&&foe>=own*S.cfg.RATIO){st.cap+=dt;if(st.cap>=S.cfg.CAPTURE)overrun(t,af)}else st.cap=Math.max(0,st.cap-dt*1.5);
   if((foe>0||attacked)&&time-st.alertAt>S.cfg.ALERT){st.alertAt=time;say(t,t===playerTeam?'General, o nosso aeródromo está sob ataque!':'Aeródromo inimigo sob ataque.',t===playerTeam?'alert':'info',af.x,af.y-200)}
   if((foe>0||attacked)&&aiEnabled[t]&&time-st.reinfAt>S.cfg.REINF_EVERY)reinforce(t,af,st)}
  else{if(own>=S.cfg.MIN&&own>=foe*S.cfg.RATIO){st.back+=dt;if(st.back>=S.cfg.CAPTURE)retake(t,af)}else st.back=Math.max(0,st.back-dt*1.5)}
 }
}
const T=()=>window.PXSTRUCT;
function overrun(t,af){
 const st=S.st[t];st.overrun=true;st.cap=0;st.back=0;af.flag=1-t;S.stats.captures++;
 for(const a of parked())if(a.team===t&&Math.random()<.75)killPlane(a,'capturado');
 say(t,t===playerTeam?'General, perdemos o aeródromo! Sem decolagens até retomá-lo.':'O aeródromo inimigo foi tomado!','alert',af.x,af.y-200);
 try{toast(t===playerTeam?'Aeródromo aliado tomado pelo inimigo!':'Aeródromo inimigo capturado!')}catch(e){}
}
function retake(t,af){const st=S.st[t];st.overrun=false;st.back=0;af.flag=t;S.stats.retaken++;say(t,t===playerTeam?'Aeródromo retomado. As decolagens podem recomeçar.':'O inimigo retomou o aeródromo.','ok',af.x,af.y-200);try{toast(t===playerTeam?'Aeródromo aliado retomado!':'O inimigo retomou o aeródromo.')}catch(e){}}
function reinforce(t,af,st){
 const o=O();if(!o)return;st.reinfAt=time;
 const free=o.free(t).filter(u=>!u.siteGuard).sort((a,b)=>hyp(a.x-af.x,a.y-af.y)-hyp(b.x-af.x,b.y-af.y)).slice(0,10);if(free.length<4)return;
 o.advance(free,af.x,af.y-260,{ai:true,via:'defesa do aeródromo'});S.stats.reinforcements++;
}
/* guarnição: 6 fuzileiros + 1 MG por lado; ficam no campo, sob a mesma regra de ordem externa dos grupos */
function pickGarrison(t){
 const af=AF()[t];if(!af)return;const st=S.st[t];
 st.garrison=st.garrison.filter(u=>live(u)&&u.siteGuard===t);
 const need=S.cfg.GARRISON+1-st.garrison.length;if(need<=0)return;
 const pool=units.filter(u=>u.team===t&&live(u)&&!u.sap&&u.cls!=='medic'&&u.cls!=='mechanic'&&!u.siteGuard&&!u.gid&&!u.inBunk&&!u.post&&(u.type==='rifle'||u.type==='mg')).sort((a,b)=>hyp(a.x-af.x,a.y-af.y)-hyp(b.x-af.x,b.y-af.y));
 let mg=st.garrison.filter(u=>u.type==='mg').length;
 for(const u of pool){if(st.garrison.length>=S.cfg.GARRISON+1)break;if(u.type==='mg'){if(mg>=1)continue;mg++}else if(st.garrison.filter(g=>g.type==='rifle').length>=S.cfg.GARRISON)continue;u.siteGuard=t;st.garrison.push(u)}
}
function guardTick(){
 for(const t of [0,1]){const af=AF()[t],st=S.st[t];if(!af)continue;pickGarrison(t);
  st.garrison.forEach((u,i)=>{
   if(u.manualUntil>time+3.3&&u._ord!==u.manualUntil){u.siteGuard=null;return}                       // ordem direta do jogador: libera
   const side=i%2?1:-1,px=af.x+side*(120+Math.floor(i/2)*110),py=af.y+(i%3-1)*-70-110;                // junto à pista e aos hangares
   const home={x:clamp(px,af.box.x0+40,af.box.x1-40),y:clamp(py,af.box.y0+80,af.box.y1-40)};
   if(hyp(u.x-home.x,u.y-home.y)>30&&!(u.target&&u.target.hp>0&&hyp(u.x-u.target.x,u.y-u.target.y)<260)){u.order='move';u.tx=home.x;u.ty=home.y}else if(u.order==='move'&&hyp(u.x-home.x,u.y-home.y)<=30){u.order='hold';u.tx=u.x;u.ty=u.y}
   u.manualUntil=u._ord=time+3.2});
 }
}

/* ---------- minimapa ---------- */
wrap('minimap',(orig,...a)=>{const r=orig(...a);if(!S.on||!S.ready||typeof mini==='undefined')return r;
 try{const cw=mini.canvas.width,sx=cw/W,sy=mini.canvas.height/H,blink=Math.floor(performance.now()/350)%2;
  for(const t of [0,1]){const af=AF()[t];if(!af)continue;const st=S.st[t],x=af.x*sx,y=af.y*sy,hw=af.half*sx;
   mini.fillStyle=st.overrun?'#d9c35a':t?'#c9705e':'#6bb0c4';mini.fillRect(Math.round(x-hw),Math.round(y)-1,Math.max(3,Math.round(hw*2)),2);
   if(time-st.attacked<6&&blink){mini.strokeStyle='#ffd24a';mini.strokeRect(Math.round(af.box.x0*sx),Math.round(af.box.y0*sy),Math.round((af.box.x1-af.box.x0)*sx),Math.round((af.box.y1-af.box.y0)*sy))}
   mini.fillStyle='#e8e4c8';mini.fillRect(Math.round(x)-1,Math.round(af.box.y0*sy)+1,3,2)}}catch(e){fail(e)}return r});

/* ---------- ligações ---------- */
const update0=window.update;
window.update=function(dt){
 const r=update0.apply(this,arguments);
 if(!S.on||!started||ended||!(dt>0))return r;
 try{
  if(!S.ready&&AF()[0]&&AF()[1]){S.ready=clean()}
  if(!S.ready)return r;
  strafeTick();
  if((rifleT-=dt)<=0){rifleT=.5;rifleFire(.5)}
  if((T_-=dt)<=0){T_=.5;siteTick(.5);for(const a of A.planes()){const t=a.team;if(S.st[t].overrun&&(a.st==='rollout'||a.st==='taxiin')&&!a.dead&&!a.gone){killPlane(a,'capturado')}}}
  if((guardT-=dt)<=0&&!window.PXFORT?.isPrep?.()){guardT=2;guardTick()}
 }catch(e){fail(e)}
 return r;
};
const setup0=window.setup;
window.setup=function(){S.ready=false;for(const s of S.st){s.overrun=false;s.cap=0;s.back=0;s.alertAt=-99;s.reinfAt=-99;s.garrison=[];s.attacked=0}return setup0.apply(this,arguments)};
S.state=()=>({on:S.on,ready:S.ready,st:S.st.map(s=>({overrun:s.overrun,cap:+s.cap.toFixed(1),back:+s.back.toFixed(1),garrison:s.garrison.length})),stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.airsite=S;
})();
