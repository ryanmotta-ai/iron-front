/* Vitória e derrota reais (feedback #1, itens 10 e 11).
   O placar de reforços (500 — 500) deixa de ser a medida da guerra. Aqui cada facção recebe uma SUPERIORIDADE MILITAR (0–100 %)
   calculada de cinco frentes — território, força, suprimentos, moral e infraestrutura — e a partida passa a ter fim por causas
   militares claras, no sandbox também:
     · QG capturado → condição crítica (contagem para retomar a bandeira-QG; sem retomada, colapso);
     · exército incapacitado, território mínimo perdido, capacidade de combate abaixo do limite, rendição por moral;
     · colapso logístico (quando a camada de estruturas informa a integridade dos depósitos/QG).
   Liga/desliga: ?vitoria=0 ou PXWIN.on=false (o sandbox volta a ser infinito). API: IronFront.victory (state, evaluate, tick). */
(function(){
'use strict';
if(typeof window==='undefined'||typeof update!=='function'||typeof finish!=='function')return;
const qs=new URLSearchParams(location.search||'');
const S=window.PXWIN={on:qs.get('vitoria')!=='0',errors:0,stats:{ticks:0,flips:0,crisis:0},
 /* ajustes: pesos da superioridade e limiares de derrota (segundos sustentados) */
 cfg:{N:6,hqSeconds:75,warmup:25,rate:.04,timeLimit:900,drawGap:3,
  w:{terr:.30,str:.30,log:.15,mor:.10,inf:.15},
  terrMin:.22,terrHold:30,strFrac:.10,strHold:40,supMin:.18,supHold:60,morMin:.30,morHold:25,logMin:.12,logHold:45},
 sec:[],crit:[null,null],hold:[{},{}],peak:[0,0],sup:[50,50],parts:[{},{}],result:null,acc:0,last:0,fight:0};
if(qs.get('armisticio')==='0')S.cfg.timeLimit=Infinity;
const C=S.cfg,VAL={rifle:10,mg:26,tank:70,cavalry:24},PRES={rifle:1,mg:2.5,tank:4,cavalry:2};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),NAME=['Aliada','Alemã'],TEAMN=['EUA','ALEMANHA'];
function fail(e){S.errors++;if(S.errors>=12){S.on=false;console.warn('victory.js desligado:',e)}}
const live=u=>u.hp>0&&!u.down&&!u.rs&&!u.carried&&!u.inBed;

function reset(){
 S.sec=Array.from({length:C.N},(_,i)=>({v:i<C.N/2?-1:1}));
 S.crit=[null,null];S.hold=[{},{}];S.peak=[0,0];S.sup=[50,50];S.parts=[{},{}];S.result=null;S.acc=0;S.last=0;S.fight=0;S.stats.ticks=0;S.stats.flips=0;S.stats.crisis=0;
}
const secOf=x=>clamp(Math.floor(x/(W/C.N)),0,C.N-1);
const flagSector=p=>secOf(p.x);
/* controle territorial: faixas verticais do mapa (o campo corre de uma retaguarda à outra); cada faixa muda de dono com a
   superioridade de presença nela; a faixa da bandeira segue o progresso real da bandeira. */
function sectors(dt){
 const pres=Array.from({length:C.N},()=>[0,0]);
 for(const u of units){if(!live(u)||u.cls==='medic')continue;pres[secOf(u.x)][u.team]+=u.sap?.3:PRES[u.type]||1}
 for(const b of buildings)if(b.type==='bunker'&&b.hp>0&&(b.team===0||b.team===1))pres[secOf(b.x)][b.team]+=3;
 for(let i=0;i<C.N;i++){const s=S.sec[i],a=pres[i][0],b=pres[i][1],before=s.v;
  s.v=clamp(s.v+C.rate*dt*(b-a)/(a+b+4),-1,1);
  if(Math.sign(before)!==Math.sign(s.v)&&before!==0)S.stats.flips++}
 for(const p of points){const s=S.sec[flagSector(p)];if(s)s.v=clamp(p.progress/100,-1,1)}
}
function territory(){
 const t=[0,0];let tw=0;
 S.sec.forEach((s,i)=>{const home=points.some(p=>flagSector(p)===i),w=home?2:1;tw+=w;t[1]+=w*(s.v+1)/2;t[0]+=w*(1-(s.v+1)/2)});
 return [t[0]/tw,t[1]/tw];
}
function strength(team){let v=0;for(const u of units)if(u.team===team&&live(u)&&u.cls!=='medic'&&!u.sap)v+=(VAL[u.type]||10)*clamp(u.hp/(u.maxhp||100),0,1);return v}
function morale(team){let n=0,c=0,s=0;for(const u of units)if(u.team===team&&live(u)&&u.cls!=='medic'&&!u.sap){n++;c+=u.cohesion??1;s+=Math.min(2,u.suppression||0)/2}
 if(!n)return 0;let m=c/n*(1-.3*s/n);const h=points.find(p=>p.home===team);if(h&&h.owner===1-team)m*=.75;return clamp(m,0,1)}
function income(team){return 8+points.filter(p=>p.owner===team).length*4}
function logistics(team){
 const money=sandbox?1:clamp(supplies[team]/500,0,1),infra=window.PXSTRUCT?.logistics?.(team)??1;
 return (.5*income(team)/16+.5*money)*(.4+.6*infra);
}
function infrastructure(team){return window.PXSTRUCT?.integrity?.(team)??1}
const share=(a,b)=>a+b>0?a/(a+b):.5;

/* recalcula as cinco frentes e a superioridade */
function evaluate(){
 const terr=territory(),str=[strength(0),strength(1)],mor=[morale(0),morale(1)],log=[logistics(0),logistics(1)],inf=[infrastructure(0),infrastructure(1)],w=C.w;
 for(let t=0;t<2;t++){const o=1-t,p={terr:terr[t],str:share(str[t],str[o]),mor:share(mor[t],mor[o]),log:share(log[t],log[o]),inf:share(inf[t],inf[o])};
  p.sup=100*(w.terr*p.terr+w.str*p.str+w.log*p.log+w.mor*p.mor+w.inf*p.inf);p.raw={str:str[t],mor:mor[t],log:log[t],inf:inf[t]};
  S.parts[t]=p;S.sup[t]=p.sup;S.peak[t]=Math.max(S.peak[t],str[t])}
 return S.sup;
}
const label=sup=>sup>=66?'DOMINANTE':sup>=56?'VANTAGEM':sup>44?'EQUILIBRADO':sup>30?'SOB PRESSÃO':'EM COLAPSO';
S.label=label;

const WHY={hq:'o quartel-general caiu',stalemate:'o tempo de operação acabou e a superioridade inimiga decidiu',territory:'o território mínimo foi perdido',army:'o exército foi incapacitado',capacity:'a capacidade de combate ficou abaixo do limite',surrender:'a moral ruiu e as tropas se renderam',logistics:'a linha logística entrou em colapso',reinforcements:'os reforços se esgotaram'};
function sustained(team,key,cond,secs,dt){const h=S.hold[team];if(cond){h[key]=(h[key]||0)+dt;return h[key]>=secs}h[key]=0;return false}
function say(team,txt){if(typeof toast==='function')toast(txt)}

/* verifica as condições de derrota de uma facção; devolve a causa ou null */
function defeat(team,dt){
 const o=1-team,p=S.parts[team],h=points.find(q=>q.home===team);
 if(h){const c=S.crit[team];
  const gone=!!window.PXSTRUCT?.hqDown?.(team);            // o prédio do QG foi destruído: sem volta
  if(gone||h.owner===o){if(!c){S.crit[team]={left:gone?40:C.hqSeconds,warned:{},perm:gone};S.stats.crisis++;say(team,gone?`O quartel-general ${TEAMN[team]} foi destruído! Colapso em 40 s.`:team===playerTeam?`Nosso QG foi tomado! ${C.hqSeconds} s para retomar a bandeira.`:`QG ${TEAMN[team]} tomado. Mantenha a posição por ${C.hqSeconds} s.`)}
   else{if(gone&&!c.perm){c.perm=true;c.left=Math.min(c.left,40)}c.left-=dt;for(const k of [60,30,10])if(c.left<=k&&!c.warned[k]){c.warned[k]=1;say(team,`QG ${TEAMN[team]}: condição crítica, ${k} s.`)}if(c.left<=0)return 'hq'}}
  else if(h.owner===team&&c&&!c.perm){S.crit[team]=null;say(team,`QG ${TEAMN[team]} retomado. Linha restabelecida.`)}}
 if(sustained(team,'terr',p.terr<C.terrMin,C.terrHold,dt))return 'territory';
 if(sustained(team,'army',S.peak[team]>=60&&p.raw.str<S.peak[team]*C.strFrac&&p.raw.str<S.parts[o].raw.str,C.strHold,dt))return 'army';
 if(sustained(team,'cap',p.sup<C.supMin*100,C.supHold,dt))return 'capacity';
 if(sustained(team,'mor',p.raw.mor<C.morMin&&p.sup<35,C.morHold,dt))return 'surrender';
 if(window.PXSTRUCT?.logistics&&sustained(team,'log',p.raw.log<C.logMin,C.logHold,dt))return 'logistics';
 if(!sandbox&&tickets[team]<=0)return 'reinforcements';
 return null;
}

function conclude(loser,why){
 if(S.result||ended)return;
 if(loser===null){S.result={loser:null,winner:null,why,at:time,sup:S.sup.slice()};finish(false);
  try{const t=document.getElementById('resulttitle'),x=document.getElementById('resulttext');if(t)t.textContent='Impasse.';
   if(x)x.textContent=`Tempo de operação esgotado sem vencedor claro: ${Math.round(S.sup[0])} % × ${Math.round(S.sup[1])} % de superioridade. ${Math.floor(time/60)}min de batalha.`}catch(e){}return}
 const win=loser!==playerTeam,winner=1-loser;
 S.result={loser,winner,why,at:time,sup:S.sup.slice()};
 finish(win);
 try{const t=document.getElementById('resulttitle'),x=document.getElementById('resulttext'),n=document.getElementById('resultnote');
  if(t)t.textContent=win?`Vitória ${winner?'alemã':'aliada'}.`:`Derrota ${loser?'alemã':'aliada'}.`;
  if(x)x.textContent=`${why==='stalemate'?`Armistício: ${WHY[why]} — a linha ${NAME[loser]} cedeu.`:`A linha ${NAME[loser]} entrou em colapso: ${WHY[why]}.`} ${Math.floor(time/60)}min ${Math.floor(time%60)}s de batalha · ${teamKills[playerTeam]} baixas inimigas · superioridade final ${Math.round(S.sup[winner])} % × ${Math.round(S.sup[loser])} %.`;
  if(n&&!n.textContent)n.textContent=''}catch(e){}
}

function tick(dt){
 if(!S.on||!started||ended||S.result)return;
 try{
  if(window.PXFORT?.isPrep?.()){evaluate();return}
  S.stats.ticks++;S.fight+=dt;sectors(dt);evaluate();
  if(time<C.warmup)return;
  const lose=[0,1].map(t=>defeat(t,dt));
  if(lose[0]&&lose[1])conclude(S.sup[0]<S.sup[1]?0:1,S.sup[0]<S.sup[1]?lose[0]:lose[1]);
  else if(lose[0])conclude(0,lose[0]);else if(lose[1])conclude(1,lose[1]);
  else if(sandbox&&S.fight>=C.timeLimit&&!S.crit.some(Boolean)){const gap=S.sup[0]-S.sup[1];if(Math.abs(gap)<C.drawGap)conclude(null,'stalemate');else conclude(gap<0?0:1,'stalemate')}
 }catch(e){fail(e)}
}

/* gancho de tempo: avalia a cada ~0,5 s de jogo; zera ao reiniciar */
const update0=window.update;
window.update=function(dt){
 if(time<S.last-1)reset();
 const r=update0.apply(this,arguments);
 S.acc+=dt;if(S.acc>=.5){const step=S.acc;S.acc=0;S.last=time;tick(step)}
 return r;
};
const setup0=window.setup;
window.setup=function(){const r=setup0.apply(this,arguments);reset();return r};
/* o fim imediato por "dono das duas bandeiras" do game.js passa a ser decidido aqui, com a contagem do QG */
if(window.IronFrontBases&&!IronFrontBases._winner0){IronFrontBases._winner0=IronFrontBases.winner;IronFrontBases.winner=function(pts){return S.on?null:IronFrontBases._winner0(pts)}}

/* ---- interface: superioridade no topo + painel de frentes ---- */
let panel=null,alertBox=null;
function ui(){
 const style=document.createElement('style');style.textContent=`
#warStatus{position:absolute;top:8.7rem;left:50%;transform:translateX(-50%);display:grid;grid-template-columns:auto auto;gap:.15rem .9rem;background:rgba(10,13,8,.78);padding:.3rem .6rem;font:11px 'IBM Plex Mono',monospace;color:#e7eadb;box-shadow:0 0 0 2px #000;pointer-events:auto;cursor:default;z-index:5}
#warStatus .row{display:contents}#warStatus b.n{letter-spacing:.04em}#warStatus .blue b.n{color:var(--blue,#7fb9c8)}#warStatus .red b.n{color:var(--red,#d88370)}
#warStatus .lbl{font-weight:700}#warStatus .m{display:inline-block;margin-left:.5rem;color:#929b87}#warStatus .m i{font-style:normal;color:#e7eadb}
#warAlert{position:absolute;top:11.6rem;left:50%;transform:translateX(-50%);background:rgba(120,30,20,.88);color:#fff;padding:.3rem .8rem;font:700 12px 'IBM Plex Mono',monospace;box-shadow:0 0 0 2px #000;z-index:6;display:none}
@media(max-width:700px){#warStatus{top:9.4rem;font-size:9px}#warAlert{top:13.2rem}}`;
 document.head.append(style);
 panel=document.createElement('div');panel.id='warStatus';panel.setAttribute('aria-live','off');
 alertBox=document.createElement('div');alertBox.id='warAlert';alertBox.setAttribute('role','alert');
 document.body.append(panel,alertBox);
}
function paint(){
 if(!panel)ui();
 panel.style.display=started?'':'none';
 const e=document.getElementById.bind(document),own=playerTeam,cls=['blue','red'];
 const pc=n=>Math.round(n*100);
 const rows=[0,1].map(t=>{const p=S.parts[t];return `<div class="row ${cls[t]}"><span><b class="n">${TEAMN[t]}</b> <span class="lbl">${label(S.sup[t])}</span> ${Math.round(S.sup[t])}%</span><span class="m">Terr. <i>${pc(p.terr||0)}</i> · Força <i>${pc(p.str||0)}</i> · Supr. <i>${pc(p.log||0)}</i> · Moral <i>${pc(p.mor||0)}</i> · Infra <i>${pc(p.inf||0)}</i>${sandbox?'':` · Reforços <i>${Math.ceil(tickets[t])}</i>`}</span></div>`}).join('');
 if(panel._h!==rows){panel._h=rows;panel.innerHTML=rows}
 panel.title='Superioridade militar: território, força, suprimentos, moral e infraestrutura de cada exército. Perder o QG, o território ou o exército encerra a guerra.'+(sandbox?'':` Reforços: EUA ${Math.ceil(tickets[0])} · Alemanha ${Math.ceil(tickets[1])}.`);
 const b=e('blueTickets'),r=e('redTickets');if(b)b.textContent=Math.round(S.sup[0])+'%';if(r)r.textContent=Math.round(S.sup[1])+'%';
 const bb=e('blubar'),rb=e('redbar');if(bb)bb.style.width=S.sup[0]+'%';if(rb)rb.style.width=S.sup[1]+'%';
 let msg='';for(const t of [own,1-own]){const c=S.crit[t];if(c)msg=t===own?`QG EM PERIGO — ${Math.ceil(c.left)} s para retomar`:`QG INIMIGO CAPTURADO — resista ${Math.ceil(c.left)} s`}
 const left=C.timeLimit-S.fight;if(!msg&&started&&sandbox&&left<=180&&left>0)msg=`ARMISTÍCIO EM ${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')} — decide a superioridade`;
 if(alertBox){alertBox.style.display=msg&&started&&!ended?'block':'none';if(alertBox.textContent!==msg)alertBox.textContent=msg}
}
const hud0=window.hud;
window.hud=function(){const r=hud0.apply(this,arguments);if(S.on){try{paint()}catch(e){fail(e)}}return r};

S.reset=reset;S.tick=tick;S.evaluate=evaluate;S.conclude=conclude;S.WHY=WHY;
S.state=()=>({on:S.on,superiority:S.sup.map(v=>Math.round(v*10)/10),labels:S.sup.map(label),parts:S.parts,sectors:S.sec.map(s=>Math.round(s.v*100)/100),crisis:S.crit.map(c=>c&&Math.ceil(c.left)),result:S.result,peak:S.peak.map(Math.round),fight:Math.round(S.fight)});
window.IronFront=window.IronFront||{};window.IronFront.victory=S;
reset();
})();
