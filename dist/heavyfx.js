'use strict';
/* Iron Front 1.9 — projétil de morteiro em voo (heavyfx.js). Carrega DEPOIS de shelter.js.
   O poço de morteiro do sappers.js disparava sem projétil visível (só uma partícula de 0,25 s na boca do tubo). Agora:
   - fumaça de boca subindo do tubo e anel de poeira no disparo;
   - a bomba sobe e desce num arco alto (apogeu = 45% da distância, até 160 px) até o ponto de impacto, com rastro curto e
     sombra no chão que encolhe/cresce com a altura — dá para ver de onde vem o fogo e para onde vai;
   - perto do ouvinte (< 520 px), assobio de chegada no último 0,9 s (soundscape.js).
   O som do disparo ("tum" do tubo) é trocado no soundscape.js. ?vida=0 desliga junto com o kit. */
(function(){
if(!window.IFK||!window.PXSAP)return;
const K=IFK,Z=K.Z,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a);
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('heavyfx.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const S=window.PXHFX={on:K.on,version:'1.9',stats:{flights:0,whistles:0,errors:0}};
let FL=[],errs=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('heavyfx.js:',e);if(errs>=12){S.on=false;console.error('heavyfx.js desligado após erros repetidos')}}
function listener(){return mode==='soldier'&&player?player:cam}
wrap('setup',(orig,...a)=>{FL=[];return orig(...a)});
wrap('update',(orig,dt)=>{if(!S.on||!started||ended)return orig(dt);for(const s of shells)s._hf=1;orig(dt);try{   /* o jogo refiltra o array: marca o que já existia */
 /* disparo deste quadro: poço com m.fl recém-marcado e projétil novo do mesmo lado */
 const fresh=shells.filter(s=>!s._hf&&!s.gren&&!s.bomb&&s.kind!=='smoke');
 if(fresh.length)for(const m of PXSAP.posts){if(!(m.fl>.16))continue;const s=fresh.find(s=>s.team===m.team&&!FL.some(f=>f.s===s));if(!s)continue;
  FL.push({s,ox:m.x,oy:m.y-4,T:s.t,wh:false});S.stats.flights++;
  for(let i=0;i<6;i++)particles.push({x:m.x+rnd(-3,3),y:m.y-6,vx:rnd(-6,6),vy:rnd(-26,-12),t:rnd(.6,1.2),max:1.2,color:i%2?'#c9c7b8':'#a9a798',size:rnd(3,5)});
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;particles.push({x:m.x+Math.cos(a)*6,y:m.y+Math.sin(a)*3,vx:Math.cos(a)*26,vy:Math.sin(a)*12,t:.35,max:.35,color:'#8d7b5a',size:3})}}
 for(const f of FL){if(!shells.includes(f.s)){f.done=true;continue}const L=listener();
  if(!f.wh&&f.s.t<.9&&hyp(f.s.x-L.x,f.s.y-L.y)<520){f.wh=true;S.stats.whistles++;try{window.SNDSCAPE&&SNDSCAPE.whistle&&SNDSCAPE.whistle(f.s.x,f.s.y,Math.max(.3,f.s.t))}catch{}}}
 FL=FL.filter(f=>!f.done)}catch(e){fail(e)}});
function draw(c,ox,oy){for(const f of FL){const s=f.s,p=Math.min(1,Math.max(0,1-s.t/f.T)),d=hyp(s.x-f.ox,s.y-f.oy),apex=Math.min(160,d*.45),h=Math.sin(p*Math.PI)*apex;
  const gx=f.ox+(s.x-f.ox)*p,gy=f.oy+(s.y-f.oy)*p,x=ox+Math.round(gx*Z),y=oy+Math.round((gy-h)*Z);if(x<-10||y<-20||x>vw+10||y>vh+10)continue;
  /* sombra no chão: menor e mais fraca no alto */const sz=h>80?1:2;c.globalAlpha=.25+.35*(1-h/Math.max(1,apex));c.fillStyle='#14160f';c.fillRect(ox+Math.round(gx*Z)-1,oy+Math.round(gy*Z),sz+1,1);c.globalAlpha=1;
  /* rastro e bomba */const p2=Math.max(0,p-.04),h2=Math.sin(p2*Math.PI)*apex,tx=ox+Math.round((f.ox+(s.x-f.ox)*p2)*Z),ty=oy+Math.round((f.oy+(s.y-f.oy)*p2-h2)*Z);
  c.fillStyle='rgba(200,198,184,.55)';c.fillRect(tx,ty,1,1);c.fillStyle='#22241c';c.fillRect(x-1,y-1,2,2);c.fillStyle='#6f756b';c.fillRect(x-1,y-1,1,1)}}
if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on)return;try{draw(c,ox,oy)}catch(e){fail(e)}}}
S.state=()=>({on:S.on,flying:FL.length,stats:{...S.stats}});S.flights=()=>FL;
if(window.IronFront)window.IronFront.heavyfx=S;
})();
