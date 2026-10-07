/* Comunicações, relatos e cadeia de comando (feedback #1, itens 15, 16 e 20).
   · Centro de comunicações (estrutura "comms" do PXSTRUCT) liga HQ → oficiais → pelotões. Com ele inteiro as ordens de intenção chegam
     em segundos; danificado, mais devagar; destruído, só por mensageiro (≈14 s) e as tropas passam a agir de forma mais autônoma.
   · Oficial de comunicações: interpreta o campo e propõe operações ("Destruir posto médico inimigo · 32 homens · risco alto · 58 %"),
     com ACEITAR/RECUSAR. Aceitar leva a ordem pela cadeia de comando aos grupos de campo (PXORD).
   · Relatos: sargentos e oficiais avisam, raramente e só quando relevante (fogo pesado, presos, munição, tanque, artilharia, posição
     capturada, linha quebrando, reforços). Cada relato sai em balão sobre a unidade (IFK.shout) e na coluna de relatos de campo.
   Liga/desliga: ?comunicacoes=0 · API: IronFront.comms (say, report, link, delay, send, propose, accept, decline, log, state). */
(function(){
'use strict';
if(typeof update!=='function'||typeof toast!=='function')return;
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const S=window.PXCOMM={on:!/[?&]comunicacoes=0/.test(location.search),version:'1.0',log:[],queue:[],proposal:null,stats:{reports:0,proposals:0,accepted:0,declined:0,delayed:0,errors:0},cd:{},last:[-99,-99],propAt:0,errors:0};
function fail(e){S.stats.errors++;if(++S.errors<=3)console.error('comms.js:',e);if(S.errors>=12){S.on=false;console.error('comms.js desligado após erros repetidos')}}
const NAMES=[['Sgt. Walker','Sgt. Reyes','Cpl. Bennett','Sgt. Harlan','Ten. Cooper','Sgt. Doyle','Cpl. Rhodes','Sgt. Mercer'],['Sgt. Müller','Uffz. Weber','Fw. Schmidt','Lt. Becker','Sgt. Hartmann','Uffz. Keller','Fw. Brandt','Lt. Vogel']];
const ALPHA=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet','Kilo','Lima'];
S.nameFor=(team,seed)=>NAMES[team][Math.abs(seed|0)%NAMES[team].length];
S.callsign=id=>ALPHA[Math.abs(id|0)%ALPHA.length];
const gridRef=(x,y)=>window.PXSTRUCT?.gridRef?PXSTRUCT.gridRef(x,y):String.fromCharCode(65+clamp(Math.floor(x/200),0,11))+(clamp(Math.floor(y/250),0,7)+1);
S.gridRef=gridRef;

/* ---------- enlace: qualidade e atraso da cadeia de comando ---------- */
function commsEnt(team){return window.PXSTRUCT?.list?.find(e=>e.team===team&&e.kind==='comms')||null}
S.link=team=>{const e=commsEnt(team);if(!e)return {ok:true,q:1,destroyed:false,name:'sem centro de comunicações (rádio de campanha)'};
 return {ok:!e.destroyed,q:e.destroyed?0:e.eff,destroyed:e.destroyed,ent:e}};
S.delay=(team,x,y)=>{const l=S.link(team),hq=window.PXSTRUCT?.list?.find(e=>e.team===team&&e.kind==='hq'),d=hq&&x!==undefined?hyp(hq.x-x,hq.y-y):600;
 const base=.25+Math.min(d,2400)/2500;if(l.destroyed)return 14;if(l.q<.5)return base*3;if(l.q<.9)return base*1.6;return base};
S.autonomous=team=>S.link(team).q<.5;
/* enfileira uma execução depois do atraso do enlace; devolve o atraso */
S.send=(team,x,y,label,fn)=>{const d=S.delay(team,x,y);if(d<=.8){fn();return 0}
 S.queue.push({team,t:time+d,fn,label});S.stats.delayed++;
 if(team===playerTeam&&d>3)toast(S.link(team).destroyed?`Sem centro de comunicações: ordem por mensageiro, chega em ~${Math.round(d)} s.`:`Ordem em trânsito pela cadeia de comando (~${Math.round(d)} s).`);return d};

/* ---------- relatos ---------- */
const SHORT={hold:'ESTAMOS PRESOS!',stuck:'NAO AVANCAMOS!',support:'PRECISAMOS DE APOIO!',captured:'POSICAO CAPTURADA!',tank:'TANQUE INIMIGO!',ammo:'SEM MUNICAO!',arty:'ARTILHARIA INIMIGA!',line:'A LINHA ESTA QUEBRANDO!',reinf:'PRECISAMOS DE REFORCOS!',cover:'ABRIGANDO!',blocked:'CAMINHO BLOQUEADO!',noarms:'SEM ARMAS PARA ISSO!',leader:'SARGENTO CAIU!',done:'OBJETIVO CUMPRIDO!',mg:'METRALHADORA!',retreat:'RECUANDO!'};
function mark(x,y,label){return gridRef(x,y)}
/* say: linha do rádio. kind: info|warn|alert|ok. unit (opcional) recebe o balão. */
S.say=(team,speaker,text,kind='info',unit=null,opts={})=>{
 if(!S.on)return false;
 const entry={id:S.log.length+1,team,t:time,speaker,text,kind,unit:unit&&unit.id,short:opts.short,x:unit?.x??opts.x,y:unit?.y??opts.y,ref:opts.ref||null};
 const delay=S.link(team).destroyed&&!opts.immediate?8:0;
 if(delay){S.queue.push({team,t:time+delay,fn:()=>push(entry),label:'relato'});return true}
 push(entry);return true};
function push(entry){
 S.log.push(entry);if(S.log.length>60)S.log.shift();S.stats.reports++;
 if(entry.team===playerTeam)showLine(entry);
 if(entry.unit&&entry.team===playerTeam&&window.IFK?.shout){const u=units.find(q=>q.id===entry.unit);if(u&&entry.short)try{IFK.shout(u,entry.short,2.8,entry.kind==='alert'?'#f0c8a8':undefined)}catch(e){}}
}
/* report: com filtro de relevância — intervalo global por equipe, repetição por tipo e só para a equipe do jogador */
S.report=(team,u,key,text,opts={})=>{
 if(!S.on||team!==playerTeam||started!==true||ended)return false;
 if(window.PXFORT?.isPrep?.())return false;
 const cd=opts.cd??45,gap=opts.gap??6;
 if(time-S.last[team]<gap&&!opts.force)return false;
 const k=key+(opts.scope??'');if((S.cd[k]||-99)>time-cd)return false;
 S.cd[k]=time;S.last[team]=time;
 const who=opts.speaker||S.nameFor(team,u?u.aiSquad??u.id:0);
 return S.say(team,who,text,opts.kind||'warn',u,{short:SHORT[key]||opts.short,x:opts.x,y:opts.y,ref:opts.ref});
};

/* ---------- interface ---------- */
let dock=null,feed=null,card=null;
function ui(){
 if(dock||typeof document==='undefined')return;
 const style=document.createElement('style');style.textContent=`
#commsDock{position:absolute;left:.6rem;top:14.4rem;display:flex;flex-direction:column;gap:.35rem;width:min(330px,44vw);pointer-events:none;z-index:5;font:11px 'IBM Plex Mono',monospace}
#fieldReports{display:flex;flex-direction:column;gap:2px}
#fieldReports .rep{background:rgba(10,13,8,.82);color:#e7eadb;padding:.22rem .45rem;box-shadow:0 0 0 2px #000;border-left:3px solid #7a8a5a;animation:repIn .25s steps(4);pointer-events:auto;cursor:pointer}
#fieldReports .rep.warn{border-left-color:#d4b04a}#fieldReports .rep.alert{border-left-color:#d2603e}#fieldReports .rep.ok{border-left-color:#8fb25a}
#fieldReports .rep b{color:#c5db91}#fieldReports .rep small{color:#929b87;margin-left:.3rem}
#fieldReports .rep.old{opacity:.0;transition:opacity 1.2s}
#opsProposal{position:absolute;left:50%;transform:translateX(-50%);top:14.3rem;width:min(380px,62vw);z-index:6;background:rgba(14,18,10,.92);color:#e7eadb;padding:.45rem .55rem;box-shadow:0 0 0 2px #000;border-left:3px solid #c5db91;pointer-events:auto;display:none}
#opsProposal h4{margin:0 0 .2rem;font:700 10px 'IBM Plex Mono',monospace;color:#c5db91;letter-spacing:.06em}
#opsProposal p{margin:.12rem 0}#opsProposal .btns{display:flex;gap:.4rem;margin-top:.35rem}
#opsProposal button{font:700 11px 'IBM Plex Mono',monospace;padding:.25rem .6rem;background:#2a3322;color:#e7eadb;border:0;box-shadow:0 0 0 2px #000;cursor:pointer}
#opsProposal button.ok{background:#4d6a2d}#opsProposal button:hover{filter:brightness(1.2)}
@keyframes repIn{from{transform:translateX(-10px);opacity:0}to{transform:none;opacity:1}}
@media(max-width:700px){#commsDock{top:15.5rem;width:60vw;font-size:10px}#opsProposal{top:16.5rem;font-size:10px}}`;
 document.head.append(style);
 dock=document.createElement('div');dock.id='commsDock';
 card=document.createElement('div');card.id='opsProposal';card.setAttribute('role','group');card.setAttribute('aria-label','Proposta do oficial de comunicações');
 feed=document.createElement('div');feed.id='fieldReports';feed.setAttribute('aria-live','polite');
 dock.append(feed);document.body.append(dock,card);
}
function showLine(entry){
 ui();if(!feed)return;
 const d=document.createElement('div');d.className='rep '+entry.kind;
 const b=document.createElement('b');b.textContent=entry.speaker+': ';d.append(b,document.createTextNode(entry.text));
 if(entry.x!==undefined){const s=document.createElement('small');s.textContent='['+gridRef(entry.x,entry.y)+']';d.append(s);
  d.title='Clique para ir até o local';d.onclick=()=>{window.PXAWV?.camOff?.();cam.x=entry.x;cam.y=entry.y;if(mode==='soldier')setMode('commander',false)}}
 feed.append(d);while(feed.children.length>4)feed.firstChild.remove();
 setTimeout(()=>{d.classList.add('old');setTimeout(()=>d.remove(),1300)},9000);
}
function paintProposal(){
 ui();if(!card)return;const p=S.proposal;
 if(!p){if(card.style.display!=='none'){card.style.display='none';card.replaceChildren()}return}
 const html=`${p.title}|${p.lines.join('|')}|${Math.ceil(p.expires-time)>0}`;
 if(card._h!==html){card._h=html;card.replaceChildren();
  const h=document.createElement('h4');h.textContent='OFICIAL DE COMUNICAÇÕES · OPERAÇÃO PROPOSTA';card.append(h);
  const t=document.createElement('p'),tb=document.createElement('b');tb.textContent=p.title;t.append(tb);card.append(t);
  for(const l of p.lines){const q=document.createElement('p');q.textContent=l;card.append(q)}
  const row=document.createElement('div');row.className='btns';
  const ok=document.createElement('button');ok.className='ok';ok.textContent='ACEITAR';ok.onclick=()=>S.accept();
  const no=document.createElement('button');no.textContent='RECUSAR';no.onclick=()=>S.decline();row.append(ok,no);card.append(row)}
 card.style.display='block';
}

/* ---------- propostas do oficial ---------- */
const VAL={rifle:10,mg:26,tank:70,cavalry:24};
function defendersAround(x,y,team,r=340){let v=0,n=0;for(const e of units)if(e.team!==team&&e.hp>0&&!e.down&&hyp(e.x-x,e.y-y)<r){v+=VAL[e.type]||10;n++}
 for(const b of buildings)if(b.team!==team&&b.type==='bunker'&&b.hp>0&&hyp(b.x-x,b.y-y)<r)v+=45;
 for(const e of window.PXSTRUCT?.list||[])if(e.team!==team&&!e.destroyed&&(e.kind==='aa'||e.kind==='gun')&&hyp(e.x-x,e.y-y)<r)v+=20;return {v,n}}
function pool(team,x,y){const free=window.PXORD?.free?.(team)||units.filter(u=>u.team===team&&u.hp>0&&!u.down&&!u.sap&&u.cls!=='medic'&&!u.rs);return free.sort((a,b)=>hyp(a.x-x,a.y-y)-hyp(b.x-x,b.y-y))}
function estimate(team,target){
 const def=defendersAround(target.x,target.y,team),need=clamp(Math.ceil(def.n*1.6+8),16,40),avail=pool(team,target.x,target.y);
 const send=avail.slice(0,need),a=send.reduce((n,u)=>n+(VAL[u.type]||10)*clamp(u.hp/(u.maxhp||100),0,1),0),
  ratio=def.v>0?a/def.v:3;let p=clamp(.5+.45*Math.tanh((ratio-1.15)*1.2),.06,.93);
 // o caminho conta: uma estrutura atrás das linhas inimigas só é alcançável contornando-as
 let wp=null,danger=0;const st=window.PXSTRAT;if(st&&send.length){const r=st.bestRoute(team,send[0],target);wp=r.wp;danger=r.danger;p*=clamp(1-danger/Math.max(40,a*1.1),.12,1)}
 if(window.PXSTRUCT?.estimate&&target.ref){const sec=window.PXSTRUCT.estimate(target,send);if(sec>240)p*=.55;else if(sec>120)p*=.8}
 return {need,have:send.length,units:send,p,wp,danger,risk:p>.72?'baixo':p>.45?'moderado':'alto'};
}
function pickTarget(team){
 const T=window.PXSTRUCT;if(!T)return null;let best=null,bs=-1e9;const own=T.list.find(e=>e.team===team&&e.kind==='hq');
 for(const e of T.list){if(e.team===team||e.destroyed||!T.known(e,team)||e.legacy&&e.kind==='wdepot'&&e.value<40)continue;
  const from=own?hyp(e.x-own.x,e.y-own.y):1200,def=defendersAround(e.x,e.y,team).v;
  const seed=pool(team,e.x,e.y)[0],route=seed&&window.PXSTRAT?window.PXSTRAT.bestRoute(team,seed,e).danger:0;
  const sc=e.value*1.6-from*.02-def*.6-route*.9+(e.kind==='gun'?25:0);if(sc>bs){bs=sc;best=e}}
 return best;
}
S.propose=force=>{
 const team=playerTeam;if(S.proposal||!S.on)return null;
 const l=S.link(team);if(l.destroyed)return null;
 const t=pickTarget(team);if(!t)return null;
 const est=estimate(team,t);if(est.have<8)return null;
 const grid=gridRef(t.x,t.y);
 S.proposal={team,target:t,units:est.units,wp:est.wp,expires:time+50,
  title:`Destruir ${t.name.toLowerCase()} ${PXSTRUCT.ge(t,'inimigo','inimiga')} em ${grid}`,
  lines:[`Forças necessárias: ${est.need} homens (disponíveis: ${est.have}).`,`Risco: ${est.risk}${est.wp?' · avanço pelo flanco':''}.`,`Probabilidade estimada: ${Math.round(est.p*100)} %.`]};
 S.stats.proposals++;paintProposal();
 S.say(team,'Oficial de Comunicações',`General, recomendo atacar ${t.name.toLowerCase()} ${PXSTRUCT.ge(t,'inimigo','inimiga')} em ${grid}. Probabilidade ${Math.round(est.p*100)} %.`,'info',null,{x:t.x,y:t.y,immediate:true});
 return S.proposal;
};
S.accept=()=>{const p=S.proposal;if(!p)return false;S.proposal=null;S.propAt=time+rnd(45,70);paintProposal();S.stats.accepted++;
 const team=p.team,units_=p.units.filter(u=>u.hp>0&&!u.down);
 if(!units_.length||p.target.destroyed){toast('A operação perdeu o objetivo.');return false}
 S.send(team,p.target.x,p.target.y,'operação',()=>{
  if(window.PXORD?.assault){window.PXORD.assault(units_,p.target,{via:'comando',byPlayer:true,waypoint:p.wp});toast(`Operação aceita: ${units_.length} homens contra ${p.target.name.toLowerCase()}.`)}});
 return true};
S.decline=()=>{if(!S.proposal)return false;S.proposal=null;S.stats.declined++;S.propAt=time+30;paintProposal();return true};

/* ---------- inteligência: estruturas inimigas avistadas ---------- */
function onStructEvent(ev){
 if(!S.on||started!==true)return;
 if(ev.type==='spotted'&&ev.by===playerTeam&&ev.e.team!==playerTeam&&!['hq','hospital','comms'].includes(ev.e.kind)){
  S.say(playerTeam,'Oficial de Comunicações',`Reconhecimento identificou ${ev.e.name.toLowerCase()} ${PXSTRUCT.ge(ev.e,'inimigo','inimiga')} em ${gridRef(ev.e.x,ev.e.y)}.`,'info',null,{x:ev.e.x,y:ev.e.y,ref:ev.e.id})}
 if(ev.type==='destroyed'&&ev.e.kind==='comms'){S.say(ev.e.team,'Oficial de Comunicações',ev.e.team===playerTeam?'General, o centro de comunicações caiu! As ordens vão demorar a chegar.':'Centro de comunicações inimigo destruído.','alert',null,{x:ev.e.x,y:ev.e.y,immediate:true})}
 if(ev.type==='captured'&&ev.e.team===playerTeam)S.report(playerTeam,null,'captured','General, capturamos uma posição de artilharia inimiga.',{kind:'ok',cd:10,speaker:'Sgt. de campo'});
}
let listening=false;
function listen(){if(listening||!window.PXSTRUCT)return;listening=true;PXSTRUCT.listen(onStructEvent)}

/* ---------- tick ---------- */
function tick(dt){
 listen();
 for(let i=S.queue.length-1;i>=0;i--){const q=S.queue[i];if(time>=q.t){S.queue.splice(i,1);try{q.fn()}catch(e){fail(e)}}}
 if(S.proposal&&(time>S.proposal.expires||S.proposal.target.destroyed)){S.proposal=null;S.propAt=time+25}
 if(!S.proposal&&time>=S.propAt&&mode==='commander'&&!window.PXFORT?.isPrep?.()&&time>60&&!aiEnabled[playerTeam]&&!document.querySelector('dialog[open]')){
  S.propAt=time+rnd(45,70);S.propose()}
 if(typeof document!=='undefined')paintProposal();
}
const update0=window.update;
window.update=function(dt){const r=update0.apply(this,arguments);if(S.on&&started&&!ended&&dt>0)try{tick(dt)}catch(e){fail(e)}return r};
const setup0=window.setup;
window.setup=function(){const r=setup0.apply(this,arguments);S.log.length=0;S.queue.length=0;S.proposal=null;S.cd={};S.last=[-99,-99];S.propAt=90;if(feed)feed.replaceChildren();paintProposal();return r};

S.state=()=>({on:S.on,link:[0,1].map(t=>{const l=S.link(t);return {ok:l.ok,q:+l.q.toFixed(2)}}),delay:S.delay(playerTeam),proposal:S.proposal&&{title:S.proposal.title,lines:S.proposal.lines},log:S.log.slice(-8).map(e=>`${e.speaker}: ${e.text}`),stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.comms=S;
})();
