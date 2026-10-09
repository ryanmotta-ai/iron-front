/* Online engineering policy: observed threats, affordable works and measured use. */
(function(root){
'use strict';
const Layouts=root.IronFrontLayouts||(typeof require==='function'?require('./engineering-layouts.js'):null);
let sessionSeed;
/* ritmo de obras: simultâneas por frente (cap), intervalo entre projetos (gap) e em emergência (urgent); o comandante.js ajusta por doutrina */
const tune=[{cap:4,gap:12,urgent:8,sap:false},{cap:4,gap:12,urgent:8,sap:false}];   // por facção
const memories=[null,null],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function memory(t,time){let m=memories[t];if(!m||time<m.time)m=memories[t]={time,reserve:0,next:0,spent:0,evaluated:0,history:[],works:[],scores:{},danger:[],layout:Layouts.select(sessionSeed===undefined?undefined:(sessionSeed^Math.imul(t+1,2654435761))>>>0),stage:'posição',note:'Avaliando necessidade de cobertura'};m.time=time;return m}
function reset(seed){memories.fill(null);sessionSeed=seed}
function layout(team,time=0){return {...memory(team,time).layout,weights:{...memory(team,time).layout.weights}}}
function assess(c,m){
 for(const w of m.works){if(w.evaluated)continue;const p=w.project;
  const complete=p.segs?.every(s=>s.stage>=(p.target||s.need.length));
  if(complete&&!w.ready)w.ready=c.time;
  if(w.ready){const usable=p.segs.filter(s=>(!s.b||s.b.hp>0)&&(!c.usable||c.usable(s)));
   w.use+=Math.min(5,Math.max(0,c.time-w.last))*c.own.filter(u=>!u.sap&&usable.some(s=>distance(u,s)<85)).length;
   if(c.time-w.ready<55&&usable.length) {w.last=c.time;continue}
   const reward=usable.length?Math.min(1,w.use/120): -1;
   record(m,w,reward,c.time);if(!usable.length)m.danger.push({x:w.x,y:w.y,at:c.time});
  }else if(c.time-w.at>110||p.done&&!complete){record(m,w,-.7,c.time)}
 }
 m.danger=m.danger.filter(d=>c.time-d.at<240);m.works=m.works.filter(w=>!w.evaluated||c.time-w.at<180);
}
function record(m,w,reward,time){w.evaluated=true;m.evaluated++;const s=m.scores[w.kind]||(m.scores[w.kind]={n:0,value:0});s.n++;s.value+=(reward-s.value)/Math.min(6,s.n);m.history.push({kind:w.kind,reward,time,cost:w.cost});if(m.history.length>20)m.history.shift();m.note=reward>0?'Cobertura usada: reforçando investimentos úteis':'Obra pouco útil: mudando posição e prioridade'}
function choose(c){
 const m=memory(c.team,c.time);assess(c,m);
 const combat=c.own.filter(u=>!u.sap&&u.cls!=='medic'&&!u.down).length;
 m.reserve=c.workers&&combat>=18?80:0;
 const capacity=Math.min(tune[c.team].cap,Math.max(1,Math.floor(c.workers/3))),service=c.serviceDemand;
 // Leave a crew for telephone logistics or maintenance when either has real work waiting.
 const limit=service&&capacity>1?capacity-1:capacity;
 if(c.time<m.next||!c.workers||c.projects.filter(p=>!p.done&&!p.aiDeferred).length>=limit)return null;
 const anchors=c.anchorCount??c.projects.reduce((n,p)=>n+p.segs.filter(s=>s.anchor||!p.done&&['trench','comm'].includes(p.kind)).length,0);
 if(service&&capacity===1&&c.time%30>=20){m.note='Liberando equipe para logística e manutenção';return null}
 const d=c.team?-1:1,plan=c.plan,op=plan?.operation,profile=m.layout;
 const woundedTotal=(c.wounded||c.own).filter(u=>(u.team===undefined||u.team===c.team)&&(u.down||u.hp/u.maxhp<.65)).length;
 m.stage=woundedTotal>=5?'socorro':op?.phase==='withdraw'?'recuo':plan?.sectors?.some(s=>s.threat>=4)?'reforço':op&&['advance','consolidate'].includes(op.phase)?'consolidação':'posição';
 const sectors=plan?.sectors||[{id:2,y:(c.height||1600)/2,front:c.team?1630:770,force:c.own.length,threat:0}];
 const candidates=[];
 for(const s of sectors){
  const force=c.own.filter(u=>Math.abs(u.y-s.y)<200&&!u.sap&&u.cls!=='medic'&&!u.down),advance=op?.sector===s.id&&['advance','consolidate'].includes(op.phase);
  let front=s.front;
  if(advance&&force.length>=4){const xs=force.map(u=>u.x).sort((a,b)=>d*(a-b));front=xs[Math.floor(xs.length*.55)]-d*70}
  else if(m.stage==='recuo'&&force.length>=4){const xs=force.map(u=>u.x).sort((a,b)=>d*(a-b));front=xs[Math.floor(xs.length*.5)]+d*25}
  const cover=force.filter(u=>c.assets.some(a=>['trench','foxhole','sandbag','nest','bunker','pillbox'].includes(a.kind)&&distance(a,u)<80)).length;
  const uncovered=force.length-cover,stress=force.filter(u=>(u.cohesion??1)<.65||(u.suppression||0)>.7).length;
  const wounded=(c.wounded||c.own).filter(u=>(u.team===undefined||u.team===c.team)&&Math.abs(u.y-s.y)<200&&(u.down||u.hp/u.maxhp<.65)).length;
  const ammoShort=force.filter(u=>u.type==='rifle'&&(u.gren===0||u.ammo===0&&!u.rl)).length;
  const choices=[['nest',55,3],['mortar',190,1.5],['comm',105,1.5]];
  if(uncovered>=2)choices.push(['trench',15,6]);
  if(uncovered>=2&&(force.length<8||advance))choices.push(['foxhole',20,force.length<8?8:5]);
  if(uncovered>=2&&force.length<=5)choices.push(['sandbag',30,6]);
  if(stress>=2||m.stage==='recuo'||s.threat>=3)choices.push(['dugout',125,3+Math.min(4,stress*.5)]);
  if(wounded>=2)choices.push(['aid',110,1]);
  if(ammoShort>=3)choices.push(['depot',100,5+Math.min(7,ammoShort*.6)]);
  if(stress>=3)choices.push(['kitchen',95,7+Math.min(6,stress*.7)]);
  if(force.some(u=>u.cls==='marksman'))choices.push(['sniper',55,5]);
  if(force.length>=4&&op?.sector===s.id&&(c.artillery||['recon','prepare','advance','consolidate'].includes(op.phase)||s.threat>=3))choices.push(['op',40,6]);
  // sapas: quem ataca avança a vala junto com a tropa (a linha nova nasce ~95 px à frente da mais adiantada, só onde há gente nossa e o trecho é seguro)
  if(tune[c.team].sap&&force.length>=5&&op&&op.phase!=='hold'&&['posição','consolidação'].includes(m.stage))choices.push(['trench',-95,3.4]);
  if(s.threat>=4)choices.push(['bunker',80,4]);
  if(s.threat>=3&&['hold','withdraw','counter'].includes(op?.phase))choices.push(['wire',-60,4]);
  if(s.threat>=6)choices.push(['pillbox',95,5]);
  if(m.stage==='recuo'&&s.threat>=2)choices.push(['chevaux',-45,5]);
  if(c.airThreat)choices.push(['aa',240,6]);
  if(c.artillery&&op?.sector===s.id&&s.threat>=3)choices.push(['gunf',300,3]);
  if(c.artillery&&op?.sector===s.id&&s.threat>=6&&c.assets.some(a=>a.kind==='gunf'&&distance(a,{x:front,y:s.y})<600))choices.push(['gunh',320,5]);
  for(const [kind,back,priority] of choices){
   if(!c.catalog[kind]||force.length<2)continue;
   if(['trench','comm'].includes(kind)&&anchors>=(c.maxSegments||200))continue;
   for(const site of Layouts.sites(profile,kind,s,front,back,c)){
   const {x,y,pts}=site;
   if(['trench','comm'].includes(kind)&&anchors+Layouts.samples(pts,c.catalog[kind].step||30).length-1>(c.maxSegments||200))continue;
   const radius=kind==='foxhole'?65:kind==='sandbag'||kind==='chevaux'?120:kind==='trench'?110:kind==='nest'||kind==='sniper'?260:['mortar','gunf','gunh'].includes(kind)?480:kind==='aid'&&wounded>=5?160:360;
   if(c.assets.some(a=>a.kind===kind&&distance(a,{x,y})<radius)||c.projects.some(p=>!p.done&&p.kind===kind&&p.segs.some(a=>distance(a,{x,y})<radius)))continue;
   const it={kind,pts,line:kind==='comm'?'comm':'adaptive',pri:0,layout:profile.id,stage:m.stage};
   if(!Layouts.safe(pts,c)||!force.some(u=>distance(u,{x,y})<350))continue;
   const score=priority+Math.min(4,force.length/4)+(s.threat||0)*.15+(advance?2:0)+(kind==='trench'?(force.length-cover)*.25:0)+(kind==='aid'?Math.min(12,wounded*1.4):0)+(m.scores[kind]?.value||0)*2-m.danger.filter(a=>distance(a,{x,y})<200).length*5+(profile.weights[kind]||0)+(m.stage==='socorro'&&kind==='aid'?3:0)+(m.stage==='consolidação'&&['trench','comm','depot'].includes(kind)?1:0)+(m.stage==='recuo'&&['dugout','trench'].includes(kind)?1.5:0)-(m.works.slice(-2).length===2&&m.works.slice(-2).every(w=>w.kind===kind)?1.5:0)-distance({x,y},{x:front,y:s.y})*.001;
   candidates.push({...it,x,y,score,cost:c.cost(it)});
   }
  }
 }
 candidates.sort((a,b)=>b.score-a.score||a.cost-b.cost);
 const troopReserve=combat<18?260:140;
 const recent=m.works.filter(w=>c.time-w.at<60).reduce((n,w)=>n+w.cost,0);
 const budget=Math.min(c.cash-troopReserve,100+(c.income||8)*60*.45-recent);
 const best=candidates.find(i=>i.cost<=budget);
 if(!best){m.reserve=Math.min(180,candidates[0]?.cost||0);m.note=candidates.length?'Guardando suprimentos para a próxima obra':'Sem nova obra necessária em local seguro';return null}
 m.reserve=best.cost;return best;
}
function committed(team,it,project,time){const m=memory(team,time);m.spent+=it.cost;m.next=time+(it.stage==='reforço'||it.stage==='socorro'?tune[team].urgent:tune[team].gap);m.reserve=80;m.works.push({project,kind:it.kind,x:it.x,y:it.y,cost:it.cost,at:time,last:time,use:0,evaluated:false});const names={depot:'depósito de munição',trench:'trincheira',comm:'ligação protegida',nest:'ninho de metralhadora',dugout:'abrigo',aid:'posto médico',mortar:'posição de morteiro',bunker:'bunker',pillbox:'casamata',aa:'antiaérea',gunf:'canhão',gunh:'obuseiro',kitchen:'cozinha de campanha',sniper:'posto de atirador',op:'posto de observação',foxhole:'toca individual',sandbag:'sacos de areia',chevaux:'cavalo de frisa'};m.note='Construindo '+(names[it.kind]||it.kind)+' · '+m.layout.name+' · '+(it.stage||m.stage)}
function state(team){const m=memories[team];if(!m)return null;return {layout:{id:m.layout.id,name:m.layout.name,seed:m.layout.seed},stage:m.stage,reserve:m.reserve,spent:m.spent,evaluated:m.evaluated,note:m.note,history:m.history.map(x=>({...x})),scores:JSON.parse(JSON.stringify(m.scores))}}
const api={choose,committed,state,reset,layout,tune};root.IronFrontEngineering=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
