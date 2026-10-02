'use strict';
/* Iron Front 1.11 — marcha humana (gait.js). Carrega DEPOIS de physics.js (e antes do mgcrew.js). Só mexe em COMO o fuzileiro vai até
   onde o jogo mandou: o destino, a ordem, o tiro e a IA continuam os mesmos.
   Por que existe: o game.js põe todo mundo a 47 u/s, em linha reta, no mesmo quadro, e vira o corpo de uma vez — por mais bonito
   que seja o sprite, o conjunto parece uma fila de brinquedos. Aqui cada soldado ganha:
     - ritmo próprio ......... fator de velocidade fixo por id (±12 %, média 1,04) + oscilação lenta (cansaço, atenção) e passada
                               proporcional (u.gt.sl, lida pelo anim-infantry.js);
     - partida escalonada .... depois de parado, cada um demora 0,03–0,26 s para reagir à ordem (menos sob fogo, nada na retirada
                               e no assalto) — o esquadrão deixa de arrancar de uma vez;
     - giro com inércia ...... o rumo da marcha vira no máximo 6,5 rad/s parado e ~3,4 rad/s andando; enquanto o corpo não
                               alinha, a velocidade cai (até 32 %): quem recebe ordem para trás primeiro pivota, depois anda;
     - trajeto vivo .......... desvio lento e suave do rumo (período 6–11 s, ~5 u de lado) mais um balanço curto; some perto do
                               destino, então a chegada continua exata;
     - aceleração e parada ... a velocidade desejada é limitada em taxa (190 u/s² para cima, 210 para baixo) e, quando a ordem
                               acaba, o soldado ainda desliza meio segundo em vez de travar; antes do destino ele já alivia o passo (60 % a 20 u);
     - relevo ................ subida (borda de cratera, talude) custa até 15 %, descida devolve até 8 %.
   Não mexe em: jogador no Modo Soldado, tanques, cavalaria, guarnição de MG, pioneiros cavando/deitados/fugindo de obus, feridos,
   fixados pelo fogo, quem se esquiva de granada (atraso aqui mata gente), quem está em trincheira e o assalto à baioneta.
   Pioneiros e a tropa da trégua (u.sap) a caminho da obra andam como os demais.
   Ligação: 1 linha em physics.js (stepFoot) chama PHYS.gait(u,pv,dt,vdx,vdy,vdm) com a velocidade desejada final e lê PHYS.gv.
   Um wrap de update guarda o rumo do quadro anterior (o game.js já terá virado o corpo para o destino quando o gancho rodar).
   ?marcha=0 desliga · PXGAIT.state() · PXGAIT.cfg (valores ajustáveis) */
(function(){
if(!window.PHYS||!window.PX)return;
const PH=window.PHYS,TAU=Math.PI*2,hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const angDiff=(a,b)=>{let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;else if(d<-Math.PI)d+=TAU;return d};
const sstep=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const h01=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
const CFG={
 MEAN:1.04,SPREAD:.26,SF:[.92,1.12],DRIFT:[.03,.02], // fator de velocidade por id: MEAN + n·SPREAD (n ≈ N(0,.17)) preso em SF; oscilação lenta ±5 %. MEAN>1 paga a partida e a chegada mais lentas: 400 u levam o mesmo tempo ±3 %
 DELAY:[.03,.26],CALM:.6,FIRE:.1,                 // atraso de partida (s); só vale se ficou parado > CALM s; sob fogo ≤ FIRE
 PIVOT:6.5,TURN:3.4,RUNK:1.35,RUNV:66,                    // taxa de giro do rumo da marcha (rad/s): parado → andando; corrida × RUNK
 SLOWT:[.45,2.2],SLOWK:.68,                       // velocidade perdida enquanto o rumo não alinha: erro (rad) → até SLOWK
 AMAX:190,BMAX:210,COAST:.5,                      // aceleração / desaceleração máximas da velocidade desejada (u/s²); tempo de deslize ao parar (s)
 ARR:[20,42,.6],                                  // perto do destino: abaixo de 42 u aliviar até 60 % em 20 u (o jogo dá a ordem por cumprida a 20 u)
 WOB1:[.07,.04,6,5],WOB2:[.025,2.2,1.4],WOBF:[26,90], // desvio lento: amp (rad), período; balanço curto; some entre 26 e 90 u do destino
 SLOPE:[.8,.85,1.08]};                            // custo do aclive; piso e teto do fator
const S=window.PXGAIT={on:!/[?&]marcha=0/.test(location.search),version:'1.11',cfg:CFG,
 stats:{units:0,delays:0,delaySum:0,turnLimited:0,coasts:0,skipped:0,errors:0}};
let errs=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('gait.js:',e);if(errs>=12&&S.on){S.on=false;console.error('gait.js desligado após erros repetidos')}}

/* ---------- estado por soldado (u.gt) ---------- */
function G(u){let g=u.gt;if(g)return g;const i=(u.id|0)+1,n=(h01(i,1)+h01(i,2)+h01(i,3))/3-.5;
 const sf=clamp(CFG.MEAN+n*CFG.SPREAD,CFG.SF[0],CFG.SF[1]);
 g=u.gt={sf,sl:clamp(1+(sf-1)*1.2+(h01(i,4)-.5)*.1,.88,1.14),     // sl: passada relativa (anim-infantry.js)
  p0:h01(i,5)*TAU,p1:h01(i,6)*TAU,w1:h01(i,7)*TAU,w2:h01(i,8)*TAU,T1:CFG.WOB1[2]+CFG.WOB1[3]*h01(i,9),T2:CFG.WOB2[1]+CFG.WOB2[2]*h01(i,10),
  A1:CFG.WOB1[0]+CFG.WOB1[1]*h01(i,11),n:0,idle:true,idleAt:-9,lastIntent:-9,go:0,h:u.angle||0,fa:u.angle||0,run:0,delay:0,acc:0};S.stats.units++;return g}
/* quem a marcha humana não toca (a lista espelha os estados em que outros módulos já mandam no passo) */
function eligible(u){if(u.type!=='rifle'||u.hp<=0)return false;
 if(u===player&&mode==='soldier')return false;
 if(u.down||u.rs||u.sh||u.mgc||u.lunge||u.lunge2>time||u.pinned||u.dodgeUntil>time||(u.pv&&u.pv.stun>0))return false;
 /* pioneiro (e todo fuzileiro na trégua): só a caminhada da obra; cavando, deitado, lutando ou fugindo de obus é do sappers.js */
 if(u.sap&&((u.sapState&&u.sapState!=='walk')||u.sapProne>time||u.sapEvade>time))return false;
 const L=u.lf;if(L&&(L.tr||L.climb>time||L.trip>time||L.duck>time))return false;
 return true}

/* ---------- gancho chamado por physics.js (stepFoot) ---------- */
PH.gv={x:0,y:0};
PH.gait=function(u,pv,dt,vdx,vdy,vdm){
 if(!S.on||!(dt>0))return false;
 let g=u.gt;if(!g&&u.type!=='rifle')return false;
 if(!eligible(u)){if(g){g.idle=true;g.go=0}S.stats.skipped++;return false}
 g=G(u);
 const t=time,intent=vdm>4,spC=hyp(pv.vx,pv.vy);
 if(!intent){
  /* ordem acabou: ainda desliza em vez de travar (só logo depois de ter andado de verdade) */
  if(!g.idle&&t-g.lastIntent<CFG.COAST&&spC>8){const v=Math.max(0,spC-CFG.BMAX*dt);PH.gv.x=Math.cos(g.h)*v;PH.gv.y=Math.sin(g.h)*v;S.stats.coasts++;return true}
  if(!g.idle){g.idle=true;g.idleAt=t}g.fa=u.angle||0;return false}
 const retreat=u.order==='retreat',assault=u.aiRole==='assalto',run=retreat||assault||spC>CFG.RUNV;g.run+=((run?1:0)-g.run)*Math.min(1,dt*4);
 const tdx=u.tx-u.x,tdy=u.ty-u.y,len=hyp(tdx,tdy),going=u.order==='move'||u.order==='attack'||u.order==='retreat';
 /* partida: pivô a partir do rumo anterior e reação individual */
 if(g.idle){g.idle=false;const rested=t-g.idleAt>CFG.CALM&&spC<10;           // reação só de quem estava parado de verdade (quem voltou de uma inelegibilidade curta já anda)
 
  g.h=spC>15?Math.atan2(pv.vy,pv.vx):(g.pfa!=null?g.pfa:g.fa);                 // g.pfa: rumo do quadro anterior (wrap de update)
  let d=0;if(rested&&!retreat&&!assault){const k=h01((u.id|0)+7,++g.n);d=lerp(CFG.DELAY[0],CFG.DELAY[1],k);if((u.suppression||0)>.5||u.underFire>0)d=Math.min(d,CFG.FIRE)}
  g.go=t+d;g.delay=d;if(d>0){S.stats.delays++;S.stats.delaySum+=d}}
 g.lastIntent=t;
 /* rumo desejado = rumo do jogo + desvio vivo (some perto do destino) */
 let hd=Math.atan2(vdy,vdx);
 const kf=going?sstep(CFG.WOBF[0],CFG.WOBF[1],len):1;
 if(kf>0)hd+=kf*(g.A1*Math.sin(t*TAU/g.T1+g.w1)+CFG.WOB2[0]*Math.sin(t*TAU/g.T2+g.w2));
 /* giro com inércia: o rumo da marcha não vira de uma vez, e a velocidade cai enquanto o corpo não alinha */
 const w=lerp(CFG.PIVOT,CFG.TURN,clamp(spC/40,0,1))*(1+(CFG.RUNK-1)*g.run);
 const err=angDiff(hd,g.h);g.h+=clamp(err,-w*dt,w*dt);
 const e2=Math.abs(angDiff(hd,g.h)),fs=1-CFG.SLOWK*sstep(CFG.SLOWT[0],CFG.SLOWT[1],e2);if(e2>.45)S.stats.turnLimited++;
 /* ritmo próprio + relevo + alívio na chegada */
 let m=g.sf*(1+CFG.DRIFT[0]*Math.sin(t*.55+g.p0)+CFG.DRIFT[1]*Math.sin(t*1.7+g.p1));
 if(PH.gradAt){const gr=PH.gradAt(u.x,u.y),ga=gr.x*Math.cos(g.h)+gr.y*Math.sin(g.h);m*=clamp(1-CFG.SLOPE[0]*ga,CFG.SLOPE[1],CFG.SLOPE[2])}
 if(u.order==='move')m*=CFG.ARR[2]+(1-CFG.ARR[2])*sstep(CFG.ARR[0],CFG.ARR[1],len);
 let v=vdm*m*fs;
 if(t<g.go)v=0;                                                              // ainda reagindo à ordem
 v=clamp(v,spC-CFG.BMAX*dt,spC+CFG.AMAX*dt);if(v<0)v=0;                      // aceleração / frenagem limitadas
 g.acc=(v-spC)/dt;
 PH.gv.x=Math.cos(g.h)*v;PH.gv.y=Math.sin(g.h)*v;
 if(!u.target)u.angle=g.h;                                                   // sem alvo o corpo olha para onde anda (o game.js só vira ao destino)
 return true};

/* rumo do quadro anterior: o game.js vira o corpo para o destino antes do gancho rodar, e o pivô precisa do rumo de antes */
{const orig=window.update;if(typeof orig==='function')window.update=function(dt){
 if(S.on&&typeof units!=='undefined')try{for(let i=0;i<units.length;i++){const u=units[i],g=u.gt;if(g)g.pfa=u.angle||0}}catch(e){fail(e)}
 return orig.call(this,dt)}}

S.state=()=>{const s=S.stats,n=typeof units!=='undefined'?units.filter(u=>u.gt):[];return{on:S.on,units:n.length,delayMean:s.delays?+(s.delaySum/s.delays).toFixed(3):0,stats:{...s}}};
S.G=G;S.eligible=eligible;
if(window.IronFront)window.IronFront.gait=S;
})();
