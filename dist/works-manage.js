'use strict';
/* Iron Front 1.9 — gestão das obras (works-manage.js). Carrega DEPOIS de works.js (de preferência depois de shelter.js). Usa o sistema do sappers.js/fortify.js
   (PXSAP.project, estágios, pioneiros, âncoras) sem editar nenhum arquivo existente: tudo por wrap de window.* e por kinds novos.
   MELHORIAS (upgrade) — o pioneiro faz a melhoria como PROJETO (estágios, equipe, barra) e a obra continua útil durante o trabalho:
     trincheira/ligação/sapa → revestida (tábuas) → de concreto ..... protecção contra tiro .35→.24→.15, dano de explosão ×.65→×.40,
                                                                     parapeito .85→.94→.97 e INTEGRIDADE 300→700→1600 (ver abaixo)
     ninho de MG → ninho blindado (+90) ............................. tiro .16, explosão ×.45, integridade 600→1500
     bunker de madeira → casamata de concreto (só a diferença) ...... 1000→2400 de vida, o mesmo prédio (guarnição e arte intactas)
     saco de areia → muro de sacos duplo (+24) ...................... vida ×2 e parede mais grossa
     abrigo → abrigo reforçado (+50) ................................ tiro .06, explosão ×.5, soterramento evitado em 75% dos casos
   INTEGRIDADE: trincheiras de pioneiros (trecho de 30 px) e ninhos passam a ter vida. Explosão de r>=44 perto abala (potência×1,6×falloff);
     a 0 o trecho DESMORONA (perde a âncora de cobertura e volta a vala rasa) até ser reparado. É a única mudança de equilíbrio:
     ?gestao=0 desliga tudo.
   REPARO — qualquer obra com vida < máxima (ou desmoronada): custo = custo investido × 50% × fração de dano; pioneiros fazem.
   DEMOLIÇÃO — devolve 40% do investido (sandbox: 0), 2,4 s de desmonte com poeira e tábuas. Cancelar projeto devolve o não gasto.
   PAINEL (tecla O) — projetos ativos do seu lado com progresso, equipe, estágio e prioridade; PRIORIZAR / CANCELAR; REPARAR manda reparar tudo que está danificado.
     Prioridade: o projeto vira src 'player' e o gerente põe a equipe nele (pioneiros livres primeiro; se faltar, toma de projetos de prioridade menor).
   MENU — Ctrl+clique ou Alt+clique numa obra (ou projeto) própria no modo comandante: melhorar (este trecho / a linha), reparar, demolir (2 cliques),
     priorizar, cancelar. Não conflita com as ordens de tropa (clique esquerdo seleciona, direito move). Com o cursor sobre a obra: U melhora, X demole (2x).
   FANTASMA — a obra em posicionamento (cartão DEFESAS ou B) mostra a pegada verde/âmbar/vermelha e o motivo: fora da área, sem pioneiros, território
     inimigo, trégua (barreira), sob fogo (2 inimigos a < 120 px ou obus a caminho), limite de obras/trincheiras, sem caixa; âmbar = aviso (alagado, pioneiros longe).
     O mesmo motivo recusa a ordem (PXSAP.canBuild/buildMsg encadeados).
   OBRAS DO DIA — contador no painel e no resultado da operação.
   IA — a cada 6 s, só com pioneiro ocioso e caixa >= custo + reserva de obras (max(200, reserva da engenharia), como works.js; melhoria exige +200 de folga),
     no máximo 1 serviço por vez: repara o que está < 45% (ou desmoronado) e melhora ninho/bunker/trecho que leva fogo. Serviço sem equipe por 60 s é cancelado e devolvido.
   Ordem de carga: depois de shelter.js (o soterramento evitado do abrigo reforçado é feito no wrap de damage, independe da ordem; o resto também).
   ?gestao=0 desliga · IronFront.worksManage.state() · PXMANAGE.works() lista as obras prontas. */
(function(){
if(!window.PXSAP||!window.PXFORT||!PXSAP.cfg||!PXSAP.cfg.KIND)return;
const SAP=PXSAP,F=PXFORT,K=SAP.cfg.KIND,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const Zs=()=>(window.PX&&PX.Z)||.5;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('works-manage.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={
 REFUND:.4,                       // demolição devolve 40% do investido
 DEMO_T:2.4,                      // s de desmonte
 FIX_K:.5,                        // reparo custa 50% do investido × fração de dano
 INTEG_K:1.6, BLAST_R:44,         // só explosão de r>=44 (morteiro, obus, bomba) abala as valas
 SCAN:.5,
 HP:{trench:300,comm:300,sap:300,foxhole:160,nest:600,mortar:260,op:250},
 LINE:[{id:'lined',name:'Trincheira revestida',cost:14,need:12,hp:700,bul:.24,bl:.65,pk:.94},
       {id:'concrete',name:'Trincheira de concreto',cost:26,need:22,hp:1600,bul:.15,bl:.4,pk:.97}],
 NEST:{id:'armor',name:'Ninho blindado',cost:90,need:24,hp:1500,bul:.16,bl:.45,pk:.97},
 CONC:{id:'concrete',name:'Casamata de concreto',need:40,hp:2400,pk:.95},                         // custo = casamata − bunker
 SAND:{id:'double',name:'Muro de sacos duplo',cost:24,need:6},
 DUG:{id:'reinf',name:'Abrigo reforçado',cost:50,need:16,bul:.06,bl:.5,save:.75},
 AI:{start:150,every:6,upgEvery:30,maxFix:1,maxUpg:1,spare:200,fixBelow:.45,hot:140,heatTau:60,idleAge:60},
 FIRE_R:120,FIRE_N:2              // fantasma/ordem: 2 inimigos a < 120 px ou obus a caminho = "sob fogo"
};
const S=window.PXMANAGE={on:!/[?&]gestao=0/.test(location.search),version:'1.0',cfg:CFG,
 stats:{upgrades:0,repairs:0,demolished:0,cancelled:0,collapses:0,refunded:0,spent:0,aiUpgrades:0,aiRepairs:0,aiSpent:[0,0],caveSaved:0,errors:0}};
S.day={built:0,upgraded:0,repaired:0,demolished:0,collapsed:0};
let WL=[],AG=[],ZN=[],DM=[],SITES=[],errs=0,scanT=0,aiT=[3,5],lastUpg=[-99,-99],prioN=0,blast=0,bx=0,by=0,bt=-1,toastAt=0,pendKey=null,pendT=0,mod=false;
const LIVE=new Set();
function fail(e){S.stats.errors++;if(++errs<=3)console.error('works-manage.js:',e);if(errs>=12){S.on=false;console.error('works-manage.js desligado após erros repetidos')}}
const say=(msg,force)=>{if(!force&&time-toastAt<1.2)return;toastAt=time;try{toast(msg)}catch{}};
function pay(team,n){if(sandbox||!n)return true;if(supplies[team]<n)return false;supplies[team]-=n;S.stats.spent+=n;return true}
function give(team,n){if(sandbox||!n)return;supplies[team]+=n;S.stats.refunded+=n}
const face=t=>t?-1:1;
const sappersOf=t=>{let n=0;for(const u of units)if(u.sap&&u.team===t&&u.hp>0)n++;return n};
const mkc=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const EMPTY=mkc(1,1),nop=()=>EMPTY;

/* ---------- kinds novos (só no catálogo do sappers: não viram cartão) ---------- */
Object.assign(K,{
 mgupl:{need:[12],target:1,cost:0,line:1,noAnchor:1,label:'Melhoria de linha',sprite:nop,onStage:s=>jobStage(s)},
 mgup:{need:[12],target:1,cost:0,box:{hw:16,hh:14},label:'Melhoria',sprite:nop,onStage:s=>jobStage(s)},
 mgfix:{need:[8],target:1,cost:0,box:{hw:16,hh:14},label:'Reparo',sprite:nop,onStage:s=>jobStage(s)}});
const MGK=new Set(['mgupl','mgup','mgfix']);

/* ======================================================================================
   REGISTRO DAS OBRAS PRONTAS (cada seg/prédio guarda o seu registro em ._mg)
   ====================================================================================== */
const ANCH=new Set(['trench','comm','sap','foxhole','nest']),LINEK=new Set(['trench','comm','sap']);
const NAMES={trench:'Trincheira de tiro',comm:'Trincheira de comunicação',sap:'Sapa',foxhole:'Toca individual',nest:'Ninho de MG',dugout:'Abrigo subterrâneo',mortar:'Poço de morteiro',
 bunker:'Bunker de madeira',sandbag:'Sacos de areia',wire:'Arame farpado',trenchb:'Trincheira',depot:'Depósito de munição',op:'Posto de observação',aa:'Antiaérea',gunf:'Canhão 75 mm',gunh:'Obuseiro 155 mm'};
const LVN={trench:['Trincheira revestida','Trincheira de concreto'],comm:['Ligação revestida','Ligação de concreto'],sap:['Sapa revestida','Sapa de concreto'],nest:['Ninho blindado'],bunker:['Casamata de concreto'],sandbag:['Muro de sacos duplo'],dugout:['Abrigo reforçado']};
const nameOf=r=>r.lvl&&LVN[r.kind]?LVN[r.kind][r.lvl-1]:NAMES[r.kind]||r.kind;
const baseInv=(kind,o)=>{if(kind==='bunker')return o.kind==='concrete'?K.pillbox.cost:K.bunker.cost;if(kind==='trenchb')return(defs.trench&&defs.trench.cost)||0;return(K[kind]&&K[kind].cost)||(defs[kind]&&defs[kind].cost)||0};
function recOf(o,kind){let r=o._mg;if(!r){r=o._mg={kind,lvl:o._lv||0,inv:baseInv(kind,o),hp:0,max:0,col:0,dm:0,pend:null,acc:0,accT:0,team:o.team};
  if(ANCH.has(kind)){r.max=(r.lvl&&lvOf({kind,lvl:r.lvl}))?lvOf({kind,lvl:r.lvl}).hp:CFG.HP[kind];r.hp=r.max}}return r}
const lvOf=r=>{if(!r.lvl)return null;if(r.kind==='nest')return CFG.NEST;if(r.kind==='dugout')return CFG.DUG;if(LINEK.has(r.kind))return CFG.LINE[r.lvl-1]||null;return null};
const dmgOf=r=>r.col?1:r.max?clamp(1-r.hp/r.max,0,1):0;
const fixable=r=>!!r&&(r.col||(r.max>0&&r.hp<r.max*.995))&&!r.pend&&!r.dm&&!r.wreck;
const fixCost=r=>Math.max(1,Math.round(r.inv*CFG.FIX_K*dmgOf(r)));
const fixNeed=r=>Math.round(4+14*dmgOf(r));
const fixed=(o,x,y,w,h)=>{o.x=x;o.y=y;o.hw=w;o.hh=h};
function scan(){
 const segs=SAP.segs,posts=SAP.posts||[],pw=window.PXWORKS,dep=pw&&pw.depots?pw.depots():[],ops=pw&&pw.ops?pw.ops():[],aas=F.aa||[],guns=F.guns||[];
 const out=[],ag=[];
 for(const s of segs){const p=s.p;if(!p||p.mgr||s.gone)continue;const kd=p.kind;if(!K[kd])continue;const col=s._mg&&s._mg.col;if(s.stage<p.target&&!col)continue;
  let r=null;
  if(ANCH.has(kd)){r=recOf(s,kd);r.seg=s;fixed(r,s.x,s.y,s.hw,s.hh);if(!r.col)ag.push(r)}
  else if(kd==='dugout'){r=recOf(s,kd);r.seg=s;r.hp=r.max=0;fixed(r,s.x,s.y,16,13)}
  else if(kd==='mortar'){const m=posts.find(q=>Math.abs(q.x-s.x)<2&&Math.abs(q.y-s.y)<2);if(!m)continue;r=recOf(s,kd);r.seg=s;r.ref=m;r.hp=m.hp;r.max=CFG.HP.mortar;fixed(r,s.x,s.y,14,14)}
  else if(kd==='depot'){const d=dep.find(q=>q.s===s);if(!d)continue;r=recOf(s,kd);r.seg=s;r.ref=d;r.hp=d.hp;r.max=pw.cfg.DEPOT.hp;r.wreck=!!d.boom;fixed(r,s.x,s.y,14,11)}
  else if(kd==='op'){const o=ops.find(q=>q.s===s);if(!o)continue;r=recOf(s,kd);r.seg=s;r.ref=o;r.hp=o.hp;r.max=CFG.HP.op;fixed(r,s.x,s.y,10,9)}
  else if(kd==='aa'){const a=aas.find(q=>q.s===s);if(!a)continue;r=recOf(s,kd);r.seg=s;r.ref=a;r.hp=a.hp;r.max=F.cfg.AA.hpPost;fixed(r,s.x,s.y,16,16)}
  else if(kd==='gunf'||kd==='gunh'){const g=guns.find(q=>q.s===s);if(!g||g.gone)continue;r=recOf(s,kd);r.seg=s;r.ref=g;r.hp=g.hp;r.max=F.cfg.GUNHP;fixed(r,s.x,s.y,22,18)}
  if(r){r.team=s.team;if(r.pend&&r.pend.done)r.pend=null;out.push(r)}}
 for(const b of buildings){if(b.hp<=0||b.dying)continue;const t=b.type;if(t!=='bunker'&&t!=='sandbag'&&t!=='wire'&&t!=='trench')continue;
  const kd=t==='trench'?'trenchb':t,r=recOf(b,kd);r.b=b;r.team=b.team;r.hp=b.hp;r.max=b.maxhp||b.hp;r.lvl=t==='bunker'?(b.kind==='concrete'?1:0):t==='sandbag'?(b.dbl?1:0):0;
  fixed(r,b.x,b.y,b.bw||(t==='bunker'?24:t==='trench'?52:t==='wire'?26:30),b.bh||(t==='bunker'?22:t==='trench'?22:10));if(r.pend&&r.pend.done)r.pend=null;out.push(r)}
 WL=out;AG=ag;buildZones()}
function buildZones(){const z=[];for(const r of WL){if(!r.lvl||r.col||r.dm)continue;const L=lvOf(r);if(!L||L.bul==null)continue;z.push({team:r.team,x:r.x,y:r.y,hw:r.hw,hh:r.hh,bul:L.bul,bl:L.bl,kind:r.kind})}ZN=z}
function zoneAt(u){let best=null;for(const z of ZN){if(z.team===u.team&&Math.abs(z.x-u.x)<z.hw&&Math.abs(z.y-u.y)<z.hh&&(!best||z.bul<best.bul))best=z}return best}

/* ---------- integridade: explosão abala as valas; a 0 o trecho desmorona ---------- */
function distSeg(x,y,s,line){if(!line||!s.len||!(s.ax||s.ay))return hyp(x-s.x,y-s.y);const hl=s.len/2,t=clamp((x-s.x)*s.ax+(y-s.y)*s.ay,-hl,hl);return hyp(x-s.x-s.ax*t,y-s.y-s.ay*t)}
function integrity(x,y,r,power){const R=r+12;
 for(const g of AG){if(g.col||Math.abs(g.x-x)>R+16||Math.abs(g.y-y)>R+16)continue;const d=distSeg(x,y,g.seg,LINEK.has(g.kind));if(d>=R)continue;
  const dmg=power*(1-d/R)*CFG.INTEG_K;g.hp-=dmg;g.acc=heat(g)+dmg;g.accT=time;if(g.hp<=0)collapse(g)}}
const heat=r=>r.acc?r.acc*Math.exp(-(time-r.accT)/CFG.AI.heatTau):0;
function dropAnchor(a){if(!a)return;const i=fieldTrenches.indexOf(a);if(i>=0)fieldTrenches.splice(i,1);
 const l=trenchGrid.get(Math.floor(a.x/128)+','+Math.floor(a.y/128));if(l){const j=l.indexOf(a);if(j>=0)l.splice(j,1)}
 try{if(window.PHYS&&typeof PHYS.rebuild==='function')PHYS.rebuild()}catch{}}
function dirt(x,y,n,col){for(let i=0;i<n&&particles.length<900;i++)particles.push({x:x+rnd(-8,8),y:y+rnd(-6,6),vx:rnd(-40,40),vy:rnd(-60,-10),t:rnd(.4,1),max:1,color:col||(i%3?'#6b5a40':'#b2a280'),size:rnd(2,5)})}
function collapse(r){const s=r.seg;if(!s||r.col)return;r.col=1;r.hp=0;S.stats.collapses++;S.day.collapsed++;
 const a=s.anchor;if(a){r.ap={hw:a.hw,hh:a.hh,slots:a.slots,line:a.line,pk:a.pk};dropAnchor(a);s.anchor=null}
 const tg=s.p.target;s.stage=tg<=1?0:1;s.work=s.stage?s.need[s.stage-1]:0;s.sk='';dirt(s.x,s.y,14);
 if(s.team===playerTeam)say(r.kind==='nest'?'Ninho de MG desabou sob bombardeio.':'Trecho de trincheira desmoronou sob bombardeio.');
 if(typeof window.sound==='function'&&hyp(s.x-cam.x,s.y-cam.y)<500)try{sound('boom')}catch{}
 buildZones()}
function rebuildAnchor(r){const s=r.seg,ap=r.ap||{},L=lvOf(r);s.stage=s.p.target;s.sk='';r.col=0;
 SAP.addAnchor(s,{hw:ap.hw,hh:ap.hh,slots:ap.slots,line:ap.line,pk:L?L.pk:ap.pk})}

/* ======================================================================================
   MELHORIA / REPARO / DEMOLIÇÃO / CANCELAMENTO
   ====================================================================================== */
function nextUpg(r){
 if(r.col||r.dm)return null;
 if(LINEK.has(r.kind))return CFG.LINE[r.lvl]||null;
 if(r.kind==='nest')return r.lvl?null:CFG.NEST;
 if(r.kind==='bunker')return r.lvl?null:{...CFG.CONC,cost:Math.max(1,K.pillbox.cost-K.bunker.cost)};
 if(r.kind==='sandbag')return r.lvl?null:CFG.SAND;
 if(r.kind==='dugout')return r.lvl?null:CFG.DUG;
 return null}
const lineLike=r=>LINEK.has(r.kind);
/* trechos da mesma obra, vizinhos e no mesmo nível, em ordem: cada corrida contígua vira um serviço */
function runsOf(r){const p=r.seg.p,list=p.segs.filter(g=>g._mg&&!g.gone&&g._mg.kind===r.kind&&g._mg.lvl===r.lvl&&!g._mg.col&&!g._mg.pend&&!g._mg.dm&&g.stage>=p.target),runs=[];let cur=[];
 for(const g of list){const prev=cur[cur.length-1];if(prev&&hyp(prev.x-g.x,prev.y-g.y)>g.len*1.6){runs.push(cur);cur=[]}cur.push(g)}if(cur.length)runs.push(cur);
 return runs.map(a=>a.map(g=>g._mg))}
function chain(run){const g0=run[0].seg,pts=[[g0.x-g0.ax*g0.len/2,g0.y-g0.ay*g0.len/2]];for(const r of run){const g=r.seg;pts.push([g.x+g.ax*g.len/2,g.y+g.ay*g.len/2])}return pts}
const liveJobs=t=>{let n=0;for(const p of SAP.projects)if(p.mgr&&!p.done&&p.team===t)n++;return n};
const playerLive=t=>{let n=0;for(const p of SAP.projects)if(!p.done&&p.team===t&&p.src==='player')n++;return n};
function mkJob(team,type,kind,pts,targets,o){const ai=!!o.ai,p=SAP.project(team,kind,ai?'gestao':'player',pts,{keep:true,line:'sap'});if(!p)return null;
 p.mgr={type,ai,up:o.up||null,name:o.name,label:(type==='upg'?'Melhoria: ':'Reparo: ')+o.name,paid:o.paid,targets:targets.map(rec=>({rec,done:0})),finished:0};p.prio=0;
 for(const s of p.segs)s.need=[o.need];for(const r of targets)r.pend=p;return p}
function startUpg(r,scope,ai){const team=r.team,up=nextUpg(r),out=m=>{if(!ai&&team===playerTeam)say(m,true);return null};
 if(!up)return out('Esta obra já está no nível máximo.');if(r.pend)return out('Já há um serviço em andamento nesta obra.');
 if(!sappersOf(team))return out('Sem pioneiros. Compre um esquadrão de Pioneiros (5).');
 if(!ai&&playerLive(team)>=SAP.cfg.MAXPROJ.player)return out(`Pioneiros ocupados: até ${SAP.cfg.MAXPROJ.player} obras ao mesmo tempo.`);
 let runs=[[r]];if(scope==='run'&&lineLike(r)){runs=runsOf(r);if(!runs.length)runs=[[r]]}
 if(ai){runs=[runs.find(a=>a.includes(r))||[r]];if(runs[0].length>4){const i=runs[0].indexOf(r);runs[0]=runs[0].slice(clamp(i-1,0,runs[0].length-4),clamp(i-1,0,runs[0].length-4)+4)}}
 const total=runs.reduce((n,a)=>n+a.length,0),cost=sandbox?0:total*up.cost;
 if(!sandbox&&supplies[team]<cost)return out(`Suprimentos insuficientes: ◈ ${cost} para ${up.name.toLowerCase()}.`);
 pay(team,cost);if(ai)S.stats.aiSpent[team]+=cost;let ok=0;
 for(const run of runs){const per=run.length*up.cost,p=lineLike(r)?mkJob(team,'upg','mgupl',chain(run),run,{up,name:up.name,paid:per,need:up.need,ai}):mkJob(team,'upg','mgup',[[r.x,r.y]],run,{up,name:up.name,paid:per,need:up.need,ai});
  if(p)ok++;else{give(team,per);if(ai)S.stats.aiSpent[team]-=per}}
 if(!ok)return out('Não foi possível iniciar a melhoria.');
 if(ai)for(const p of SAP.projects)if(p.mgr&&p.mgr.ai&&!p.done)claim(p,false);
 if(!ai){sound('click');say(`Pioneiros a caminho: ${up.name.toLowerCase()}${total>1?` (${total} trechos)`:''} · ◈ ${sandbox?'∞':cost}.`,true)}return true}
function startFix(r,ai){const team=r.team,out=m=>{if(!ai&&team===playerTeam)say(m,true);return null};
 if(!fixable(r))return out('Nada a reparar nesta obra.');if(!sappersOf(team))return out('Sem pioneiros. Compre um esquadrão de Pioneiros (5).');
 if(!ai&&playerLive(team)>=SAP.cfg.MAXPROJ.player)return out(`Pioneiros ocupados: até ${SAP.cfg.MAXPROJ.player} obras ao mesmo tempo.`);
 const cost=sandbox?0:fixCost(r);if(!sandbox&&supplies[team]<cost)return out(`Suprimentos insuficientes: ◈ ${cost} para o reparo.`);
 const p=mkJob(team,'fix','mgfix',[[r.x,r.y]],[r],{name:nameOf(r),paid:cost,need:fixNeed(r),ai});if(!p)return out('Não foi possível iniciar o reparo.');
 pay(team,cost);if(ai)S.stats.aiSpent[team]+=cost;if(ai)claim(p,false);if(!ai){sound('click');say(`Pioneiros a caminho: reparar ${nameOf(r).toLowerCase()} · ◈ ${sandbox?'∞':cost}.`,true)}return true}
function applyLvl(r,up){const o=r.seg||r.b;r.pend=null;
 if(ANCH.has(r.kind)){r.lvl++;o._lv=r.lvl;const L=lvOf(r),old=r.max||L.hp;r.max=L.hp;r.hp=r.col?0:clamp(r.hp/old,0,1)*L.hp;r.inv+=up.cost;if(o.anchor){o.anchor.pk=L.pk;o.anchor.lvl=r.lvl}else if(r.col&&r.ap)r.ap.pk=L.pk}
 else if(r.kind==='bunker'){const b=r.b,f=b.maxhp?b.hp/b.maxhp:1;b.kind='concrete';b.maxhp=CFG.CONC.hp;b.hp=Math.max(1,f*b.maxhp);r.lvl=1;r.inv+=up.cost;
  const sg=SAP.segs.find(g=>g.b===b);if(sg&&sg.anchor)sg.anchor.pk=CFG.CONC.pk}
 else if(r.kind==='sandbag'){const b=r.b;b.dbl=1;b.maxhp*=2;b.hp*=2;r.lvl=1;r.inv+=up.cost;if(b.vert){try{SAP.lineB(b,b.ax??0,b.ay??1,b.len||32,14);if(window.PHYS&&PHYS.rebuild)PHYS.rebuild()}catch{}}}
 else if(r.kind==='dugout'){r.lvl=1;o._lv=1;r.inv+=up.cost}
 buildZones()}
function applyFix(r){r.pend=null;
 if(ANCH.has(r.kind)){if(r.col)rebuildAnchor(r);r.hp=r.max}
 else if(r.b)r.b.hp=r.b.maxhp;else if(r.ref)r.ref.hp=r.max;
 buildZones()}
function jobStage(s){const p=s.p,m=p.mgr;if(!m||m.finished)return;
 if(m.type==='fix'){m.targets[0].done=1;applyFix(m.targets[0].rec);return complete(p)}
 let best=null,bd=1e9;for(const t of m.targets){if(t.done)continue;const d=hyp(t.rec.x-s.x,t.rec.y-s.y);if(d<bd){bd=d;best=t}}
 if(best&&(bd<44||m.targets.length===1)){best.done=1;applyLvl(best.rec,m.up)}
 if(p.segs.every(g=>g.stage>=p.target))complete(p)}
function complete(p){const m=p.mgr;if(m.finished)return;m.finished=1;
 for(const t of m.targets)if(!t.done){t.done=1;if(m.type==='upg')applyLvl(t.rec,m.up);else applyFix(t.rec)}
 if(m.type==='upg'){S.stats.upgrades++;S.day.upgraded++;if(m.ai)S.stats.aiUpgrades++}else{S.stats.repairs++;S.day.repaired++;if(m.ai)S.stats.aiRepairs++}
 for(const t of m.targets)t.rec.pend=null;
 if(p.team===playerTeam&&!m.ai)say(m.type==='upg'?`Melhoria concluída: ${m.up.name}.`:`Reparo concluído: ${m.name}.`,true);
 SAP.cancel(p)}
/* progresso e refundo de qualquer projeto (trabalho acumulado ÷ necessário, por trecho) */
function progressOf(p){if(!p.segs.length)return 1;let a=0;for(const s of p.segs)a+=s.stage>=p.target?1:clamp(s.work/(s.need[p.target-1]||1),0,1);return a/p.segs.length}
function paidOf(p){if(p.mgr)return p.mgr.paid||0;if(p.kind==='repair')return 0;const k=K[p.kind];return k?(k.line?p.segs.length*(k.cost||0):(k.cost||0)):0}
function cancelProj(p,quiet){if(!p||p.done)return false;const paid=paidOf(p),fr=progressOf(p),refund=sandbox?0:Math.round(paid*(1-fr));
 if(p.mgr){p.mgr.finished=1;for(const t of p.mgr.targets)t.rec.pend=null}
 SAP.cancel(p);give(p.team,refund);S.stats.cancelled++;
 if(!quiet&&p.team===playerTeam)say(refund?`Obra cancelada: ◈ ${refund} devolvidos.`:'Obra cancelada.',true);return refund}
function demolish(r,quiet){if(!r||r.dm||r.pend)return false;const sp=r.seg||r.b||r.ref;if(!sp)return false;
 const refund=sandbox?0:Math.round(r.inv*CFG.REFUND);r.dm=1;DM.push({r,t:0,T:CFG.DEMO_T,x:r.x,y:r.y,hw:r.hw,hh:r.hh,team:r.team,refund,tick:0});buildZones();
 if(!quiet&&r.team===playerTeam){sound('click');say(`Desmontando ${nameOf(r).toLowerCase()}${refund?` · +◈ ${refund}`:''}…`,true)}return true}
function removeSeg(s){const p=s.p,segs=SAP.segs,i=segs.indexOf(s);if(i>=0)segs.splice(i,1);const j=p.segs.indexOf(s);if(j>=0){p.segs.splice(j,1);if(j<p.cur)p.cur--}
 s.gone=1;if(p.item)p.item.requeued=true}
function killNear(type,team,x,y,rad){let best=null,bd=rad*rad;for(const b of buildings){if(b.type!==type||b.team!==team||b.hp<=0)continue;const d=(b.x-x)**2+(b.y-y)**2;if(d<bd){bd=d;best=b}}if(best){best.hp=0;SITES.push({type,team,x:best.x,y:best.y,t:time})}}
function finishDemo(d){d.done=true;const r=d.r,s=r.seg,k=r.kind;
 try{
  if(ANCH.has(k)){const a=s.anchor;if(a)dropAnchor(a);s.anchor=null;
   if(s.bags){const fc=face(s.team),[nx,ny]=SAP._.enemyNormal(s.ax,s.ay,fc);if(k==='trench')killNear('sandbag',s.team,s.x+nx*12,s.y+ny*12,14);else if(k==='nest')killNear('sandbag',s.team,s.x+fc*20,s.y,14)}
   for(const u of units)if(u.post&&u.post.s===s)u.post=null;removeSeg(s)}
  else if(k==='bunker'||k==='sandbag'||k==='wire'||k==='trenchb'){const b=r.b;b.hp=0;b.dying=1;if(k==='sandbag'||k==='wire')SITES.push({type:b.type,team:b.team,x:b.x,y:b.y,t:time});
   if(k==='bunker'){const sg=SAP.segs.find(g=>g.b===b);if(sg){if(sg.anchor){dropAnchor(sg.anchor);sg.anchor=null}removeSeg(sg)}for(const u of units)if(u.bunkerOf===b)u.bunkerOf=null}}
  else if(k==='mortar'){r.ref.hp=0;removeSeg(s)}
  else if(k==='depot'||k==='aa'){r.ref.hp=0;removeSeg(s)}
  else if(k==='op'){r.ref.hp=0;if(s.anchor){dropAnchor(s.anchor);s.anchor=null}removeSeg(s)}
  else if(k==='gunf'||k==='gunh'){const g=r.ref;g.gone=true;g.hp=0;try{window.PXBAT&&PXBAT.removeGun&&PXBAT.removeGun(g.b)}catch{}removeSeg(s)}
  else if(k==='dugout'){if(s.anchor){dropAnchor(s.anchor);s.anchor=null}removeSeg(s);s.x=s.y=-9999}
  else if(k==='foxhole'){if(s.anchor){dropAnchor(s.anchor);s.anchor=null}removeSeg(s)}
  try{SAP.refreshFront()}catch{}try{window.PXAS&&PXAS.refresh&&PXAS.refresh()}catch{}
 }catch(e){fail(e)}
 dirt(d.x,d.y,22);give(d.team,d.refund);S.stats.demolished++;S.day.demolished++;
 if(d.team===playerTeam)say(d.refund?`Demolição concluída: ${nameOf(r).toLowerCase()} · +◈ ${d.refund} reciclados.`:`Demolição concluída: ${nameOf(r).toLowerCase()}.`,true);
 scan()}
function demoTick(dt){if(!DM.length)return;
 for(const d of DM){d.t+=dt;d.tick-=dt;if(d.tick<=0){d.tick=.07;const n=2+((Math.random()*2)|0);for(let i=0;i<n&&particles.length<900;i++)particles.push({x:d.x+rnd(-d.hw,d.hw)*.8,y:d.y+rnd(-d.hh,d.hh)*.8,vx:rnd(-34,34),vy:rnd(-50,-12),t:rnd(.4,.9),max:.9,color:i%3===0?'#6b4a2c':i%3===1?'#b2a280':'#8a8a7a',size:rnd(2,4)});
   if(typeof window.sound==='function'&&Math.random()<.25&&hyp(d.x-cam.x,d.y-cam.y)<420)try{sound('click')}catch{}}
  if(d.t>=d.T)finishDemo(d)}
 DM=DM.filter(d=>!d.done)}
/* a obra demolida some do arame/sacos: o "reparo de brechas" do sappers.js não pode reconstruí-la */
function cleanSites(){if(!SITES.length)return;const br=SAP.breaches;
 for(let i=br.length-1;i>=0;i--){const b=br[i];if(SITES.some(s=>s.type===b.type&&s.team===b.team&&hyp(s.x-b.x,s.y-b.y)<4))br.splice(i,1)}
 SITES=SITES.filter(s=>time-s.t<4)}

/* ---------- prioridade ----------
   A ordem do assign() do sappers.js vem de IronFrontSupport.workScore (ou de src/t0) e não aceita prioridade explícita: o gerente
   põe a equipe por conta própria. Projeto priorizado vira src 'player' e recebe primeiro os pioneiros livres mais próximos e, se faltar,
   toma de projetos de prioridade menor (quem já está trabalhando custa +300 px de "distância", para preferir os ociosos). */
const crewFree=u=>u.sap&&u.hp>0&&!u.down&&!u.rs&&u.cls!=='medic'&&!u.sapJob&&(u.sapFree||0)<=time&&!(u.manualUntil>time&&u.manualUntil!==u.sapStamp);
function claim(p,steal){const s=p.segs[Math.min(p.cur,p.segs.length-1)];if(!s||p.done||time<(p.pauseUntil||0))return;const want=p.kind==='repair'?2:(SAP.cfg.CREW||3);let need=want-p.crew.length;if(need<=0)return;
 const cand=[];for(const u of units)if(u.sap&&u.team===p.team&&u.hp>0&&crewFree(u))cand.push({u,q:null,d:hyp(u.x-s.x,u.y-s.y)});
 if(steal)for(const q of SAP.projects){if(q===p||q.done||q.team!==p.team||(q.prio||0)>=p.prio)continue;for(const id of q.crew){const u=units.find(x=>x.id===id);if(u)cand.push({u,q,d:hyp(u.x-s.x,u.y-s.y)+300})}}
 cand.sort((a,b)=>a.d-b.d);
 for(const c of cand){if(need<=0)break;if(c.d>1800)break;const u=c.u;
  if(c.q){const i=c.q.crew.indexOf(u.id);if(i>=0)c.q.crew.splice(i,1);u.sapState='';if(u.manualUntil===u.sapStamp)u.manualUntil=0}
  u.sapJob=p.id;u.sapHp=u.hp;p.crew.push(u.id);need--}}
function enforcePrio(){const P=SAP.projects;
 for(const p of P){if(p.done)continue;if((p.prio||0)>0)continue;if(p.mgr&&p.mgr.ai&&!p.mgr.finished&&p.crew.length<(SAP.cfg.CREW||3))claim(p,false)}   // serviço da IA: pega os ociosos antes da engenharia
 let any=false;for(const p of P)if(!p.done&&(p.prio||0)>0){any=true;break}if(!any)return;
 const tops=P.filter(p=>!p.done&&(p.prio||0)>0).sort((a,b)=>(b.prio||0)-(a.prio||0));
 for(const p of tops)claim(p,true)}
function prioritize(p){if(!p||p.done)return false;
 if(p.prio>0){p.prio=0;return 'off'}
 p.prio=++prioN;if(p.src!=='player'){p.src0=p.src;p.src='player'}enforcePrio();return true}

/* ======================================================================================
   IA: reparos e melhorias dentro da reserva de obras
   ====================================================================================== */
const enemiesNear=(t,x,y,r)=>{let n=0;for(const u of units)if(u.team!==t&&u.hp>0&&!u.down&&(u.x-x)**2+(u.y-y)**2<r*r)n++;return n};
const shellsNear=(t,x,y,r)=>{for(const sh of shells)if(sh.team!==t&&sh.kind!=='smoke'&&hyp(sh.x-x,sh.y-y)<(sh.r||65)+r)return true;return false};
const occupants=(t,r)=>{let n=0;for(const u of units)if(u.team===t&&u.hp>0&&!u.sap&&Math.abs(u.x-r.x)<r.hw+10&&Math.abs(u.y-r.y)<r.hh+10)n++;return n};
function aiManage(t){
 if(!aiEnabled[t]||(F.isPrep&&F.isPrep())||time<CFG.AI.start||sappersOf(t)<2)return;
 let nFix=0,nUpg=0;for(const p of SAP.projects)if(p.mgr&&!p.done&&p.team===t){if(p.mgr.type==='fix')nFix++;else nUpg++}
 if(nFix>=CFG.AI.maxFix&&nUpg>=CFG.AI.maxUpg)return;
 if(!units.some(u=>u.team===t&&crewFree(u)))return;                 // só com pioneiro ocioso: não concorre com as obras novas da engenharia
 const E=window.IronFrontEngineering,reserve=Math.max(200,(E&&E.state&&E.state(t)&&E.state(t).reserve)||0),cash=sandbox?Infinity:supplies[t];
 let fix=null,fs=0,upg=null,us=0;
 if(nFix<CFG.AI.maxFix)for(const r of WL){if(r.team!==t||!fixable(r)||r.kind==='wire'||r.kind==='sandbag')continue;const dmg=dmgOf(r);if(dmg<1-CFG.AI.fixBelow)continue;
  if(enemiesNear(t,r.x,r.y,200)||shellsNear(t,r.x,r.y,70))continue;const c=fixCost(r);if(cash<c+reserve)continue;
  const sc=dmg*10+Math.min(4,occupants(t,r))+(r.kind==='bunker'||r.kind==='nest'?3:0)+(r.col?2:0);if(sc>fs){fs=sc;fix=r}}
 if(nUpg<CFG.AI.maxUpg&&time-lastUpg[t]>=CFG.AI.upgEvery)for(const r of WL){if(r.team!==t||r.pend||dmgOf(r)>.5)continue;const up=nextUpg(r);if(!up)continue;   // obra muito danificada é reparada antes de ser melhorada
  const c=up.cost*(lineLike(r)?2:1);if(cash<c+reserve+CFG.AI.spare)continue;
  if(enemiesNear(t,r.x,r.y,220)||shellsNear(t,r.x,r.y,70))continue;let sc=0;
  if(r.kind==='bunker'){const near=enemiesNear(t,r.x,r.y,650);if(occupants(t,r)>=1&&(near>=3||dmgOf(r)>.25))sc=5+near*.2+dmgOf(r)*6}
  else if(r.kind==='nest'){const near=enemiesNear(t,r.x,r.y,600);if(near>=3||heat(r)>CFG.AI.hot)sc=4+near*.2+heat(r)/60}
  else if(lineLike(r)){const h=heat(r);if(h>CFG.AI.hot&&occupants(t,r)>=1)sc=3+h/80}
  if(sc>us){us=sc;upg=r}}
 /* uma ordem por rodada: a melhoria tem a vez quando já passou a folga de 30 s e há candidato; senão, o reparo */
 if(upg&&startUpg(upg,'run',true)){lastUpg[t]=time;return}
 if(fix)startFix(fix,true)}

/* ======================================================================================
   FANTASMA DE POSICIONAMENTO + ordens bloqueadas com o mesmo motivo
   ====================================================================================== */
function friendly(x,y){if(sandbox)return true;if(playerTeam?x>W-850:x<850)return true;if(points.some(p=>p.owner===playerTeam&&hyp(p.x-x,p.y-y)<240))return true;return units.some(u=>u.team===playerTeam&&u.hp>0&&hyp(u.x-x,u.y-y)<260)}
function underFire(x,y){let n=0;for(const u of units)if(u.team!==playerTeam&&u.hp>0&&!u.down&&(u.x-x)**2+(u.y-y)**2<CFG.FIRE_R**2&&++n>=CFG.FIRE_N)return 'Sob fogo: inimigos a menos de '+CFG.FIRE_R+' px';
 for(const sh of shells)if(sh.team!==playerTeam&&sh.kind!=='smoke'&&(sh.t||0)>.2&&hyp(sh.x-x,sh.y-y)<(sh.r||65)+40)return 'Sob fogo: bombardeio a caminho';return null}
const cb0=SAP.canBuild,bm0=Object.getOwnPropertyDescriptor(SAP,'buildMsg');
let lastMsg=null;
const bm0v=()=>bm0?(bm0.get?bm0.get.call(SAP):bm0.value):null;
SAP.canBuild=function(team,x,y){if(S.on&&team===playerTeam){const m=underFire(x,y);if(m){lastMsg={m,at:Date.now()};return false}}return cb0?cb0.call(SAP,team,x,y):true};
Object.defineProperty(SAP,'buildMsg',{get(){return lastMsg&&Date.now()-lastMsg.at<80?lastMsg.m:bm0v()},configurable:true});
function reasonFor(kind,pts){const k=K[kind],team=playerTeam,line=!!k.line,n=line&&pts.length>1?SAP._.segment(pts,k.step||SAP.cfg.SEG).length:1,cost=sandbox?0:n*(k.cost||0);let block=null,warn=null;
 if(pts.some(q=>q[0]<20||q[0]>W-20||q[1]<20||q[1]>H-20))block='Fora da área do mapa';
 else if(!sappersOf(team))block='Sem pioneiros: compre um esquadrão (5)';
 else if(!pts.every(q=>friendly(q[0],q[1])))block='Território inimigo: só perto de tropas ou terreno aliado';
 else if(cb0&&!pts.every(q=>cb0.call(SAP,team,q[0],q[1])))block=bm0v()||'Trégua: construa só do seu lado da barreira';
 else{for(const q of pts){const m=underFire(q[0],q[1]);if(m){block=m;break}}}
 if(!block&&line&&!k.noAnchor&&(()=>{let a=0;for(const s of SAP.segs)if(s.team===team&&s.anchor)a++;return a})()+n>SAP.cfg.MAXSEGS)block='Limite de trincheiras de campo atingido';
 if(!block&&playerLive(team)>=SAP.cfg.MAXPROJ.player)block=`Pioneiros ocupados: até ${SAP.cfg.MAXPROJ.player} obras`;
 if(!block&&!sandbox&&supplies[team]<cost)block=`Sem caixa: faltam ◈ ${Math.ceil(cost-supplies[team])}`;
 if(!block){if(window.PXW&&PXW.depth&&pts.some(q=>PXW.depth(q[0],q[1])>=.12))warn='Terreno alagado';
  else{let near=Infinity;for(const u of units)if(u.sap&&u.team===team&&u.hp>0){const d=hyp(u.x-pts[0][0],u.y-pts[0][1]);if(d<near)near=d}if(near>1500)warn='Pioneiros longe (>1500 px): vão demorar'}}
 return{ok:!block,block,warn,cost,n}}
let GH={k:'',t:0,r:null};
function ghostDraw(c,ox,oy){const ui=SAP.ui;
 if(!(ui&&ui.mode&&mode==='commander'&&mouse.over&&!placement&&started&&!ended)){tip(null);return}
 const kind=ui.mode,k=K[kind];if(!k){tip(null);return}const Z=Zs();
 const q={x:clamp(mouse.wx,-50,W+50),y:clamp(mouse.wy,-50,H+50)};let pts,segs=null;
 if(k.line){const a=ui.drag;if(a){let dx=q.x-a.x,dy=q.y-a.y,L=hyp(dx,dy),f=L>360?360/L:1;const b={x:a.x+dx*f,y:a.y+dy*f};pts=[[a.x,a.y],[b.x,b.y]];segs=SAP._.segment(pts,k.step||SAP.cfg.SEG)}else pts=[[q.x,q.y]]}else pts=[[q.x,q.y]];
 const key=kind+'|'+(pts[0][0]|0)+'|'+(pts[0][1]|0)+'|'+(pts[1]?(pts[1][0]|0)+','+(pts[1][1]|0):'');const now=Date.now();
 if(GH.k!==key||now-GH.t>200){GH={k:key,t:now,r:reasonFor(kind,pts)}}const r=GH.r;
 const col=r.block?'#ff6a55':r.warn?'#ffb84a':'#9be36b';
 c.save();c.setLineDash([2,2]);c.lineWidth=1;c.strokeStyle=col;c.fillStyle=r.block?'rgba(255,90,70,.22)':r.warn?'rgba(255,184,74,.2)':'rgba(120,230,90,.2)';
 if(segs){for(const g of segs){const x=ox+g.x*Z,y=oy+g.y*Z,L=g.len*Z,w=SAP.cfg.HALFW*Z;c.save();c.translate(x,y);c.rotate(Math.atan2(g.ay,g.ax));c.fillRect(-L/2,-w,L,w*2);c.strokeRect(-L/2,-w,L,w*2);c.restore()}}
 else{const b=k.line?{hw:SAP.cfg.SEG/2,hh:SAP.cfg.HALFW}:(k.box||{hw:20,hh:18}),x=ox+pts[0][0]*Z,y=oy+pts[0][1]*Z;c.fillRect(x-b.hw*Z,y-b.hh*Z,b.hw*Z*2,b.hh*Z*2);c.strokeRect(x-b.hw*Z,y-b.hh*Z,b.hw*Z*2,b.hh*Z*2)}
 c.restore();
 const nm=(F.SHORT&&F.SHORT[kind])||kind;tip(r.block?`✕ ${nm}: ${r.block}`:r.warn?`⚠ ${nm}: ${r.warn} · ◈ ${sandbox?'∞':r.cost}`:`✓ ${nm} · ◈ ${sandbox?'∞':r.cost}${r.n>1?' ('+r.n+' trechos)':''}`,r.block?'bad':r.warn?'warn':'ok')}

/* ======================================================================================
   INTERFACE: painel (O), menu (Ctrl/Alt+clique), dica
   ====================================================================================== */
const CSS=`#wm-panel{position:fixed;right:10px;top:92px;width:236px;max-height:46vh;display:none;flex-direction:column;z-index:41;background:rgba(20,23,18,.95);border:2px solid #c5db91;color:#e8e4c8;font:10px Silkscreen,monospace;letter-spacing:.3px;box-shadow:0 4px 0 rgba(0,0,0,.35)}
#wm-panel.on{display:flex}#wm-panel header{display:flex;gap:8px;align-items:center;padding:5px 8px;background:#2a3324;border-bottom:1px solid #849371}#wm-panel header b{flex:1;color:#c5db91}#wm-panel header span{color:#a9b595}
#wm-panel button,#wm-menu button{font:inherit;letter-spacing:inherit;background:#2a3324;color:#e8e4c8;border:1px solid #849371;padding:2px 6px;cursor:pointer}#wm-panel button:hover,#wm-menu button:hover:not(:disabled){background:#3a4830}
#wm-list{overflow-y:auto;overflow-x:hidden;padding:4px 6px;display:flex;flex-direction:column;gap:5px}.wm-row{border:1px solid #3c4733;background:rgba(10,12,8,.55);padding:4px 5px}.wm-row.top{border-color:#c9a24a}
.wm-top{display:flex;gap:6px;align-items:baseline}.wm-top b{flex:1;font-weight:400;color:#f0ecd0;text-transform:uppercase}.wm-st{color:#a9b595;font-size:9px;margin-top:1px}.wm-pr{color:#ffd27a}
.wm-bar{height:5px;background:#141712;margin:3px 0;border:1px solid #3b4431}.wm-bar i{display:block;height:100%;background:#a8d0dc}.wm-row.red .wm-bar i{background:#e0a080}
.wm-in{color:#a9b595;font-size:9px}.wm-bot{display:flex;gap:4px;margin-top:3px}.wm-bot button{flex:1;font-size:9px;padding:2px 3px}.wm-bot button.hot{background:#4a3a1c;color:#ffe9a6;border-color:#c9a24a}
#wm-panel footer{padding:4px 8px;border-top:1px solid #343b2f;color:#929b87;font-size:9px;line-height:1.4}#wm-empty{padding:8px;color:#929b87}
#wm-menu{position:fixed;display:none;z-index:60;min-width:220px;background:rgba(20,23,18,.97);border:2px solid #c5db91;color:#e8e4c8;font:11px Silkscreen,monospace;letter-spacing:.4px;padding:6px;flex-direction:column;gap:4px}#wm-menu.on{display:flex}
#wm-menu h4{margin:0;font:inherit;color:#c5db91}#wm-menu small{color:#a9b595;font-size:10px}#wm-menu button{text-align:left}#wm-menu button:disabled{opacity:.45;cursor:default}#wm-menu button.danger{border-color:#c0503a;color:#ffb4a0}
#wm-tip{position:fixed;display:none;z-index:45;pointer-events:none;padding:3px 6px;background:rgba(20,23,18,.92);border:1px solid #c5db91;color:#e8e4c8;font:11px Silkscreen,monospace;letter-spacing:.3px;white-space:nowrap}
#wm-tip.bad{border-color:#ff6a55;color:#ffc4b8}#wm-tip.warn{border-color:#ffb84a;color:#ffe2a8}#wm-tip.ok{border-color:#9be36b}`;
let UIok=false,panel=null,menu=null,tipEl=null,sigP='',confirmDemo=null;
const $=id=>document.getElementById(id);
function ensureUI(){if(UIok)return true;if(typeof document==='undefined'||!document.body||!document.body.append)return false;
 try{const st=document.createElement('style');st.textContent=CSS;document.head.append(st);
  panel=document.createElement('div');panel.id='wm-panel';panel.innerHTML='<header><b>OBRAS</b><span id="wm-sum"></span><button data-act="fixall" title="Reparar todas as obras danificadas">REPARAR</button><button data-act="close">×</button></header><div id="wm-list"></div><footer id="wm-foot"></footer>';
  menu=document.createElement('div');menu.id='wm-menu';tipEl=document.createElement('div');tipEl.id='wm-tip';document.body.append(panel,menu,tipEl);
  panel.addEventListener('click',onPanelClick);menu.addEventListener('click',onMenuClick);
  document.addEventListener('pointerdown',e=>{if(menu.classList.contains('on')&&!menu.contains(e.target))closeMenu()},true);UIok=true}catch(e){fail(e)}return UIok}
function tip(txt,cls){if(!UIok)return;if(!txt){if(tipEl.style.display!=='none')tipEl.style.display='none';return}
 const cv=document.getElementById('game')||document.querySelector('canvas'),r=cv?cv.getBoundingClientRect():{left:0,top:0,width:vw,height:vh};
 const x=r.left+mouse.x*r.width/vw+16,y=r.top+mouse.y*r.height/vh+18;if(tipEl.textContent!==txt)tipEl.textContent=txt;tipEl.className=cls||'';tipEl.style.display='block';tipEl.style.left=Math.min(x,innerWidth-tipEl.offsetWidth-6)+'px';tipEl.style.top=Math.min(y,innerHeight-30)+'px'}
const SH=k=>(F.SHORT&&F.SHORT[k])||NAMES[k]||k;
function rowInfo(p){const m=p.mgr,cs=p.segs[Math.min(p.cur,p.segs.length-1)],n=p.segs.length,fr=progressOf(p),want=p.kind==='repair'?2:(SAP.cfg.CREW||3);
 const lab=m?m.label:(K[p.kind]&&K[p.kind].label?K[p.kind].label.split(':')[0].split('(')[0].trim():SH(p.kind));
 const st=m?(m.type==='upg'?'melhoria':'reparo'):cs?`estágio ${Math.min(cs.stage+1,p.target)}/${p.target}`:'';
 return{lab,st:st+(n>1&&!m?` · trecho ${Math.min(p.cur+1,n)}/${n}`:n>1?` · ${n} trechos`:''),fr,crew:p.crew.length,want,prio:p.prio||0}}
function panelUpdate(){if(!ensureUI()||!panel.classList.contains('on'))return;
 const list=SAP.projects.filter(p=>!p.done&&p.team===playerTeam).sort((a,b)=>(b.prio||0)-(a.prio||0)),L=$('wm-list');if(!L)return;
 const sig=list.map(p=>p.id+':'+(p.prio||0)).join(',');
 if(sig!==sigP){sigP=sig;L.textContent='';if(!list.length){const e=document.createElement('div');e.id='wm-empty';e.textContent='Nenhuma obra em andamento.';L.append(e)}
  for(const p of list){const d=document.createElement('div');d.className='wm-row';d.dataset.id=p.id;d.innerHTML='<div class="wm-top"><b></b><span class="wm-pr"></span></div><div class="wm-st"></div><div class="wm-bar"><i></i></div><div class="wm-in"></div><div class="wm-bot"><button data-act="prio">PRIORIZAR</button><button data-act="cancel">CANCELAR</button></div>';L.append(d)}}
 for(const p of list){const d=L.querySelector(`.wm-row[data-id="${p.id}"]`);if(!d)continue;const i=rowInfo(p);d.classList.toggle('top',i.prio>0);d.classList.toggle('red',!!playerTeam);
  const set=(s,t)=>{const e=d.querySelector(s);if(e&&e.textContent!==t)e.textContent=t};set('.wm-top b',i.lab);set('.wm-st',i.st);set('.wm-pr',i.prio>0?'★':'');
  d.querySelector('.wm-bar i').style.width=Math.round(i.fr*100)+'%';set('.wm-in',`equipe ${i.crew}/${i.want} · ${Math.round(i.fr*100)}%${i.crew?'':' · aguardando'}`);
  const pb=d.querySelector('[data-act=prio]');pb.classList.toggle('hot',i.prio>0);set('[data-act=prio]',i.prio>0?'★ PRIORIDADE':'PRIORIZAR')}
 const dd=S.day,sum=$('wm-sum');if(sum)sum.textContent=list.length+' ativa'+(list.length===1?'':'s');
 const f=$('wm-foot');if(f){const t=`Hoje: ${dd.built} obras · ${dd.upgraded} melhorias · ${dd.repaired} reparos · ${dd.demolished} demolições${dd.collapsed?` · ${dd.collapsed} desabaram`:''}<br>Ctrl/Alt+clique numa obra: menu · U melhora · X demole · O fecha`;if(f.innerHTML!==t)f.innerHTML=t}}
function onPanelClick(e){const b=e.target.closest('button');if(!b)return;e.stopPropagation();const act=b.dataset.act;
 if(act==='close'){togglePanel(false);return}
 if(act==='fixall'){fixAll();return}
 const row=b.closest('.wm-row');if(!row)return;const p=SAP.projects.find(q=>String(q.id)===row.dataset.id);if(!p)return;
 if(act==='prio'){const r=prioritize(p);say(r==='off'?'Prioridade retirada.':'Prioridade alta: os pioneiros vão para lá primeiro.',true);sigP='';panelUpdate()}
 else if(act==='cancel'){cancelProj(p);sigP='';panelUpdate()}}
function fixAll(){let n=0;const list=WL.filter(r=>r.team===playerTeam&&fixable(r)).sort((a,b)=>dmgOf(b)-dmgOf(a));
 for(const r of list){if(playerLive(playerTeam)>=SAP.cfg.MAXPROJ.player)break;if(startFix(r,false))n++;else if(!sandbox&&supplies[playerTeam]<fixCost(r))break}
 say(n?`${n} reparo${n>1?'s':''} em andamento.`:'Nada a reparar.',true);sigP=''}
function togglePanel(on){if(!ensureUI())return;const v=on===undefined?!panel.classList.contains('on'):on;panel.classList.toggle('on',v);if(v){sigP='';panelUpdate()}}
function closeMenu(){if(menu)menu.classList.remove('on');confirmDemo=null}
const money=n=>sandbox?'∞':String(n);
function openMenu(cx,cy,hit){if(!ensureUI())return;menu.textContent='';const add=(t,act,dis,cls,title)=>{const b=document.createElement('button');b.textContent=t;b.dataset.act=act;if(dis){b.disabled=true;b.title=dis}if(cls)b.className=cls;if(title)b.title=title;menu.append(b);return b};
 const h=document.createElement('h4');menu._hit=hit;
 if(hit.proj){const p=hit.proj,i=rowInfo(p);h.textContent=i.lab;menu.append(h);const s=document.createElement('small');s.textContent=`${i.st} · ${Math.round(i.fr*100)}% · equipe ${i.crew}/${i.want}`;menu.append(s);
  add(p.prio>0?'★ RETIRAR PRIORIDADE':'PRIORIZAR','prio');const ref=sandbox?0:Math.round(paidOf(p)*(1-progressOf(p)));add(`CANCELAR${ref?' · +◈ '+ref:''}`,'cancel',null,'danger')}
 else{const r=hit.rec;h.textContent=nameOf(r);menu.append(h);const s=document.createElement('small');
  s.textContent=r.max?(r.col?'DESMORONOU — precisa de reparo':`Integridade ${Math.round(r.hp)}/${Math.round(r.max)}`):'Em bom estado';menu.append(s);
  const up=nextUpg(r),team=r.team;
  if(up){const runs=lineLike(r)?runsOf(r):[[r]],tot=runs.reduce((n,a)=>n+a.length,0)||1,c1=up.cost,cN=up.cost*tot;
   const why=r.pend?'Serviço em andamento':!sandbox&&supplies[team]<c1?'Sem caixa':!sappersOf(team)?'Sem pioneiros':null;
   add(`MELHORAR: ${up.name} · ◈ ${money(c1)}${lineLike(r)?' (este trecho)':''}`,'upg1',why);
   if(lineLike(r)&&tot>1)add(`MELHORAR A LINHA (${tot} trechos) · ◈ ${money(cN)}`,'upgN',why||(!sandbox&&supplies[team]<cN?'Sem caixa':null))}
  else add(r.col?'Nada a melhorar (desmoronado)':'Nível máximo','none','Sem melhorias disponíveis');
  if(fixable(r)){const c=fixCost(r);add(`REPARAR · ◈ ${money(c)}`,'fix',!sandbox&&supplies[team]<c?'Sem caixa':null)}
  const rf=sandbox?0:Math.round(r.inv*CFG.REFUND);add(`DEMOLIR · +◈ ${money(rf)}`,'demo',r.dm?'Em desmonte':r.pend?'Serviço em andamento':null,'danger')}
 const cv=document.getElementById('game')||document.querySelector('canvas'),W0=innerWidth,H0=innerHeight;menu.classList.add('on');menu.style.left=Math.min(cx+8,W0-menu.offsetWidth-6)+'px';menu.style.top=Math.min(cy+8,H0-menu.offsetHeight-6)+'px'}
function onMenuClick(e){const b=e.target.closest('button');if(!b||b.disabled)return;e.stopPropagation();const hit=menu._hit,act=b.dataset.act;if(!hit)return;
 if(act==='demo'){if(confirmDemo!==hit.rec){confirmDemo=hit.rec;b.textContent='CONFIRMAR DEMOLIÇÃO';return}demolish(hit.rec);closeMenu();return}
 if(act==='prio'){const r=prioritize(hit.proj);say(r==='off'?'Prioridade retirada.':'Prioridade alta: os pioneiros vão para lá primeiro.',true);closeMenu()}
 else if(act==='cancel'){cancelProj(hit.proj);closeMenu()}
 else if(act==='upg1'){startUpg(hit.rec,'one');closeMenu()}else if(act==='upgN'){startUpg(hit.rec,'run');closeMenu()}
 else if(act==='fix'){startFix(hit.rec);closeMenu()}else closeMenu()}
/* o que há sob o cursor: projeto em andamento (prioridade) ou obra pronta */
function pickAt(x,y,team){const R=26;                                                   // o render em pixel não usa cam.z: 1 px do mundo = 1 px da tela
 for(const p of SAP.projects){if(p.done||p.team!==team||p.mgr&&p.src!=='player')continue;for(const s of p.segs){if(s.stage>=p.target)continue;if(Math.abs(s.x-x)<Math.max(s.hw,16)+4&&Math.abs(s.y-y)<Math.max(s.hh,14)+4)return{proj:p}}}
 let best=null,bd=1e9;for(const r of WL){if(r.team!==team||r.dm)continue;const dx=Math.abs(r.x-x),dy=Math.abs(r.y-y);if(dx<=r.hw+6&&dy<=r.hh+6){const d=dx/(r.hw+6)+dy/(r.hh+6);if(d<bd){bd=d;best=r}}}
 if(best)return{rec:best};let b2=null,d2=R*R;for(const r of WL){if(r.team!==team||r.dm)continue;const d=(r.x-x)**2+(r.y-y)**2;if(d<d2){d2=d;b2=r}}return b2?{rec:b2}:null}
window.addEventListener('pointerdown',e=>{if(!S.on||e.button!==0||!(e.ctrlKey||e.altKey)||!started||ended||mode!=='commander'||placement||SAP.ui.mode)return;const cv=document.getElementById('game')||document.querySelector('canvas');if(e.target!==cv)return;
 const r=cv.getBoundingClientRect();mouse.x=(e.clientX-r.left)*vw/r.width;mouse.y=(e.clientY-r.top)*vh/r.height;worldMouse();
 const hit=pickAt(mouse.wx,mouse.wy,playerTeam);if(!hit)return;e.stopImmediatePropagation();e.preventDefault();openMenu(e.clientX,e.clientY,hit)},true);
window.addEventListener('keydown',e=>{mod=e.ctrlKey||e.altKey;if(!S.on||e.repeat||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||!started||ended)return;
 const t=e.target&&e.target.tagName;if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT')return;const k=(e.key||'').toLowerCase();
 if(k==='o'){togglePanel();e.preventDefault();return}
 if(mode!=='commander'||placement||SAP.ui.mode)return;
 if((k==='u'||k==='x')&&mouse.over){const hit=pickAt(mouse.wx,mouse.wy,playerTeam);if(!hit||!hit.rec)return;e.preventDefault();
  if(k==='u')startUpg(hit.rec,'run');
  else if(confirmDemo===hit.rec&&time-pendT<3){confirmDemo=null;demolish(hit.rec)}else{confirmDemo=hit.rec;pendT=time;say(`Demolir ${nameOf(hit.rec).toLowerCase()}? Pressione X de novo (+◈ ${money(Math.round(hit.rec.inv*CFG.REFUND))}).`,true)}}},true);
window.addEventListener('keyup',e=>{mod=e.ctrlKey||e.altKey});
window.addEventListener('pointermove',e=>{mod=e.ctrlKey||e.altKey},true);

/* ======================================================================================
   LIGAÇÕES COM O JOGO
   ====================================================================================== */
function reset(){WL=[];AG=[];ZN=[];DM=[];SITES=[];scanT=0;aiT=[3,5];lastUpg=[-99,-99];prioN=0;prT=0;LIVE.clear();
 S.day={built:0,upgraded:0,repaired:0,demolished:0,collapsed:0};closeMenu();sigP='';GH={k:'',t:0,r:null}}
let prT=0;
function maintain(dt){if((prT-=dt)<=0){prT=.4;enforcePrio()}
 /* limpeza dos serviços terminados/cancelados: tira os trechos do serviço de SEGS (cobertura fantasma, contagem de segmentos) e do P */
 const P=SAP.projects,segs=SAP.segs;let dirty=false;
 for(const p of P)if(p.mgr&&p.done)dirty=true;
 if(dirty){for(let i=segs.length-1;i>=0;i--)if(segs[i].p.mgr&&segs[i].p.done){segs[i].gone=1;segs.splice(i,1)}
  for(let i=P.length-1;i>=0;i--)if(P[i].mgr&&P[i].done)P.splice(i,1)}
 /* serviço parado há 4 min sem progresso (sem pioneiros): cancela e devolve */
 for(const p of P){const m=p.mgr;if(m&&!p.done&&!m.finished&&time-p.t0>(m.ai?CFG.AI.idleAge:240)&&progressOf(p)<.05)cancelProj(p,true)}
 /* alvo morto: cancela e devolve */
 for(const p of P){const m=p.mgr;if(!m||p.done||m.finished)continue;
  const alive=m.targets.some(t=>!t.done&&(t.rec.b?t.rec.b.hp>0&&!t.rec.dm:!t.rec.seg||(!t.rec.seg.gone&&!t.rec.dm)));if(!alive)cancelProj(p,true)}
 /* obras do dia: conta os projetos prontos mesmo que o sappers já tenha podado o P */
 for(const p of P){if(p.mgr||p.done||p.team!==playerTeam||LIVE.has(p))continue;LIVE.add(p)}
 for(const p of LIVE)if(p.done){LIVE.delete(p);if(!p.mgr&&p.segs.length&&p.segs.every(g=>g.stage>=p.target))S.day.built++}
 demoTick(dt);cleanSites()}
wrap('setup',(orig,...a)=>{reset();return orig(...a)});
wrap('update',(orig,dt)=>{if(!S.on||!started||ended||!(dt>0))return orig(dt);
 orig(dt);
 try{if((scanT-=dt)<=0){scanT=CFG.SCAN;scan()}maintain(dt);
  for(let t=0;t<2;t++){if((aiT[t]-=dt)<=0){aiT[t]=CFG.AI.every;aiManage(t)}}}catch(e){fail(e)}});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{if(!S.on)return orig(x,y,r,power,team);bx=x;by=y;bt=time;blast++;
 try{orig(x,y,r,power,team)}finally{blast--}
 try{if(r>=CFG.BLAST_R&&power>0&&AG.length&&!(typeof gblast!=='undefined'&&gblast))integrity(x,y,r,power)}catch(e){fail(e)}});   // granada (gblast, r 48/65) não abala a vala
wrap('damage',(orig,u,n,att)=>{if(S.on&&ZN.length&&u&&u.hp>0&&u.type!=='tank'){
  if(blast>0&&n>0&&n<9000){const z=zoneAt(u);if(z)n*=z.bl}
  else if(n>=9000&&bt===time&&hyp(u.x-bx,u.y-by)<45){const z=zoneAt(u);if(z&&z.kind==='dugout'&&Math.random()<CFG.DUG.save){u.suppression=2;S.stats.caveSaved++;return}}}
 return orig(u,n,att)});
wrap('protectedBy',(orig,u)=>{const f=orig(u);if(!S.on||!ZN.length||f>=1||u.type==='tank')return f;const z=zoneAt(u);return z&&z.bul<f?z.bul:f});
wrap('finish',(orig,win)=>{orig(win);try{if(!S.on)return;const d=S.day,el=document.getElementById('resulttext');if(!el||!(d.built+d.upgraded+d.repaired+d.demolished+d.collapsed))return;
 el.textContent+=` Obras: ${d.built} construídas · ${d.upgraded} melhoradas · ${d.repaired} reparadas · ${d.demolished} demolidas${d.collapsed?` · ${d.collapsed} desabaram sob fogo`:''}.`}catch(e){fail(e)}});

/* ---------- desenho: revestimento, blindagem, canteiros de melhoria, desmonte, fantasma, dica de mira ---------- */
const SPR=new Map();
function lining(r){const s=r.seg,k=s.id+'|'+r.lvl;let c=SPR.get(k);if(c)return c;const Z=Zs(),L=Math.ceil(s.len*Z)+4,sz=L+12,o=sz>>1;c=mkc(sz,sz);const g=c.getContext('2d'),ax=s.ax,ay=s.ay,nx=-ay,ny=ax;
 const col=r.lvl===1?['#6b5034','#86683f','#3b2a1c']:['#8d9082','#b9bbad','#5e6258'];
 for(let t=-L/2;t<=L/2;t++)for(const w of[-3.5,3.5]){const x=Math.round(o+ax*t+nx*w),y=Math.round(o+ay*t+ny*w);g.fillStyle=((Math.round(t)%3)===0)?col[2]:(w<0?col[1]:col[0]);g.fillRect(x,y,1,1)}
 if(r.lvl===2)for(let t=-L/2+2;t<=L/2;t+=5){g.fillStyle='#4c5048';g.fillRect(Math.round(o+ax*t-nx*3.5),Math.round(o+ay*t-ny*3.5),1,1)}
 SPR.set(k,c);if(SPR.size>400)SPR.delete(SPR.keys().next().value);return c}
function drawUnder(c,ox,oy){const Z=Zs(),m=30;
 for(const r of WL){if(!r.lvl&&!r.col)continue;const x=ox+Math.round(r.x*Z),y=oy+Math.round(r.y*Z);if(x<-m||y<-m||x>vw+m||y>vh+m)continue;
  if(r.col){c.fillStyle='rgba(30,22,14,.55)';c.fillRect(x-4,y-2,8,4);continue}
  if(lineLike(r)&&r.seg){const sp=lining(r);c.drawImage(sp,x-(sp.width>>1),y-(sp.height>>1))}
  else if(r.kind==='nest'){c.fillStyle='#5d646b';for(let i=0;i<12;i++){const a=i/12*6.283;c.fillRect(x+Math.round(Math.cos(a)*9),y+Math.round(Math.sin(a)*7),2,1)}c.fillStyle='#aab1b6';for(let i=0;i<4;i++)c.fillRect(x+Math.round(Math.cos(i*1.57+.8)*9),y+Math.round(Math.sin(i*1.57+.8)*7),1,1)}
  else if(r.kind==='dugout'){c.fillStyle='#553c25';c.fillRect(x-8,y-6,16,2);c.fillStyle='#8a6d45';c.fillRect(x-8,y-6,16,1);c.fillStyle='#b5a57c';c.fillRect(x-7,y+5,4,2);c.fillRect(x+3,y+5,4,2)}
  else if(r.kind==='sandbag'&&r.b){const b=r.b,fc=face(b.team),ax=b.vert?(b.ax??0):1,ay=b.vert?(b.ay??1):0,L=((b.vert?b.len:60)||32)*Z,[nx,ny]=SAP._.enemyNormal(ax,ay,fc);
   for(let t=-L/2;t<=L/2;t+=3){const px=x+Math.round(ax*t+nx*3),py=y+Math.round(ay*t+ny*3);c.fillStyle='#8f8060';c.fillRect(px-1,py-1,3,2);c.fillStyle='#c4b78e';c.fillRect(px-1,py-1,3,1)}}}
 /* canteiro de melhoria/reparo: fita nos cantos do alvo (a barra de progresso é do sappers.js) */
 for(const p of SAP.projects){if(!p.mgr||p.done)continue;for(const s of p.segs){const x=ox+Math.round(s.x*Z),y=oy+Math.round(s.y*Z);if(x<-m||y<-m||x>vw+m||y>vh+m)continue;
  const hw=Math.round((s.hw||12)*Z),hh=Math.round((s.hh||10)*Z);c.fillStyle=p.mgr.type==='upg'?'#d9e0a6':'#e8b87a';
  for(const [dx,dy] of[[-1,-1],[1,-1],[-1,1],[1,1]]){c.fillRect(x+dx*hw,y+dy*hh-1,1,3);c.fillRect(x+dx*hw-(dx>0?1:0),y+dy*hh,2,1)}
  for(let i=-hw+2;i<hw-1;i+=3){c.fillRect(x+i,y-hh,1,1);c.fillRect(x+i,y+hh,1,1)}}}}
function drawOver(c,ox,oy){const Z=Zs();if(!UIok)ensureUI();
 for(const d of DM){const x=ox+Math.round(d.x*Z),y=oy+Math.round(d.y*Z)-12,f=clamp(d.t/d.T,0,1);if(x<-20||y<-20||x>vw+20||y>vh+20)continue;
  c.fillStyle='#141712';c.fillRect(x-8,y-1,17,4);c.fillStyle='#3b4431';c.fillRect(x-7,y,15,2);c.fillStyle='#e8b87a';c.fillRect(x-7,y,Math.max(1,Math.round(15*f)),2)}
 if(mod&&mode==='commander'&&mouse.over&&!placement&&!SAP.ui.mode&&started&&!ended){const hit=pickAt(mouse.wx,mouse.wy,playerTeam);
  if(hit){const o=hit.rec||hit.proj.segs[hit.proj.cur]||hit.proj.segs[0],hw=Math.round(((hit.rec?hit.rec.hw:o.hw)||12)*Z)+2,hh=Math.round(((hit.rec?hit.rec.hh:o.hh)||10)*Z)+2,x=ox+Math.round(o.x*Z),y=oy+Math.round(o.y*Z);
   c.fillStyle='#e8d58c';for(const [dx,dy] of[[-1,-1],[1,-1],[-1,1],[1,1]]){c.fillRect(x+dx*hw-(dx>0?2:0),y+dy*hh-(dy>0?1:0),3,1);c.fillRect(x+dx*hw-(dx>0?0:0),y+dy*hh-(dy>0?2:0),1,3)}
   const txt=hit.rec?`${nameOf(hit.rec)}${hit.rec.max?` · ${Math.round(hit.rec.hp)}/${Math.round(hit.rec.max)}`:''} · clique: menu`:`${rowInfo(hit.proj).lab} · clique: menu`;tip(txt,'')}else tip(null)}
 else ghostDraw(c,ox,oy)}
if(window.WW1A){const u0=WW1A.under,o0=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){u0.call(this,c,ox,oy,dt);if(!S.on)return;try{drawUnder(c,ox,oy)}catch(e){fail(e)}};
 WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on){tip(null);return}try{drawOver(c,ox,oy)}catch(e){fail(e)}}}
setInterval(()=>{try{if(!S.on)return;if(document.querySelector&&document.querySelector('dialog[open]'))closeMenu();if(UIok&&document.body.dataset.screen==='title'){panel.classList.remove('on');closeMenu()}panelUpdate();if(!(mode==='commander'&&started&&!ended&&mouse.over)&&UIok)tip(null)}catch(e){fail(e)}},250);

/* serviços de gestão não ocupam as vagas da engenharia: o choose() do engineering.js limita as obras simultâneas pelo nº de projetos não terminados do
   time (e pelo nº de trechos); sem este filtro cada reparo/melhoria da IA tirava uma vaga das obras novas (medido no verify-battle) */
{const E=window.IronFrontEngineering;if(E&&typeof E.choose==='function'&&!E._mgw){const c0=E.choose;E.choose=function(c){if(S.on&&c&&Array.isArray(c.projects)&&c.projects.some(p=>p.mgr))c={...c,projects:c.projects.filter(p=>!p.mgr)};return c0.call(this,c)};E._mgw=1}}

/* ---------- API ---------- */
S.state=()=>({on:S.on,works:WL.length,mine:WL.filter(r=>r.team===playerTeam).length,zones:ZN.length,anchors:AG.length,jobs:SAP.projects.filter(p=>p.mgr&&!p.done).map(p=>({id:p.id,team:p.team,type:p.mgr.type,name:p.mgr.name,prio:p.prio||0,crew:p.crew.length,segs:p.segs.length,progress:+progressOf(p).toFixed(2)})),
 demolishing:DM.length,day:{...S.day},stats:{...S.stats,aiSpent:[...S.stats.aiSpent]}});
Object.assign(S,{scan,works:()=>WL,zones:()=>ZN,pick:pickAt,rec:recOf,nextUpg,runsOf,startUpg,startFix,demolish,cancel:cancelProj,prioritize,progress:progressOf,paid:paidOf,integrity,collapse,reason:reasonFor,ai:aiManage,fixCost,fixNeed,fixAll,
 panel:togglePanel,maintain,reset,heat,names:{nameOf}});
if(window.IronFront)window.IronFront.worksManage=S;
})();
