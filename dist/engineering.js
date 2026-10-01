/* Online engineering policy: observed threats, affordable works and measured use. */
(function(root){
'use strict';
const memories=[null,null],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function memory(t,time){let m=memories[t];if(!m||time<m.time)m=memories[t]={time,reserve:0,next:0,spent:0,evaluated:0,history:[],works:[],scores:{},danger:[],note:'Avaliando necessidade de cobertura'};m.time=time;return m}
function reset(){memories.fill(null)}
function assess(c,m){
 for(const w of m.works){if(w.evaluated)continue;const p=w.project;
  const complete=p.segs?.every(s=>s.stage>=s.need.length);
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
 const m=memory(c.team,c.time);assess(c,m);m.reserve=0;
 if(c.time<m.next||!c.workers||c.projects.reduce((n,p)=>n+p.segs.length,0)>=(c.maxSegments||200)||c.projects.filter(p=>!p.done).length>=Math.min(4,Math.max(1,Math.floor(c.workers/3))))return null;
 const d=c.team?-1:1,plan=c.plan,op=plan?.operation;
 const sectors=plan?.sectors||[{id:2,y:800,front:c.team?1630:770,force:c.own.length,threat:0}];
 const candidates=[];
 for(const s of sectors){
  const force=c.own.filter(u=>Math.abs(u.y-s.y)<200&&!u.sap),advance=op?.sector===s.id&&['advance','consolidate'].includes(op.phase);
  let front=s.front;
  if(advance&&force.length>=4){const xs=force.map(u=>u.x).sort((a,b)=>d*(a-b));front=xs[Math.floor(xs.length*.55)]-d*70}
  const choices=[['trench',15,6],['nest',55,3],['dugout',125,2],['mortar',190,1.5],['aid',170,1],['comm',105,1.5]];
  if(s.threat>=4)choices.push(['bunker',80,4]);
  if(c.airThreat)choices.push(['aa',240,6]);
  if(c.artillery&&op?.sector===s.id&&s.threat>=3)choices.push(['gunf',300,3]);
  for(const [kind,back,priority] of choices){
   if(!c.catalog[kind]||force.length<2)continue;
   const x=Math.max(80,Math.min(2320,front-d*back)),y=Math.max(80,Math.min(1520,s.y+(s.id%2?35:-35)));
   const radius=kind==='trench'?110:kind==='nest'?260:kind==='mortar'||kind==='gunf'?480:360;
   if(c.assets.some(a=>a.kind===kind&&distance(a,{x,y})<radius)||c.projects.some(p=>!p.done&&p.kind===kind&&p.segs.some(a=>distance(a,{x,y})<radius)))continue;
   const pts=kind==='trench'?[[x,y-42],[x,y+42]]:kind==='comm'?[[x,y],[x-d*65,y+25]]:[[x,y]],it={kind,pts,line:kind==='comm'?'comm':'adaptive',pri:0};
   if(pts.some(([px,py])=>!c.dry(px,py)||c.enemies.some(e=>distance(e,{x:px,y:py})<240)||c.shells.some(e=>distance(e,{x:px,y:py})<(e.r||65)+60)))continue;
   const cover=force.filter(u=>c.assets.some(a=>a.kind==='trench'&&distance(a,u)<80)).length;
   const wounded=force.filter(u=>u.hp/u.maxhp<.65).length;
   const score=priority+Math.min(4,force.length/4)+(s.threat||0)*.15+(advance?2:0)+(kind==='trench'?(force.length-cover)*.25:0)+(kind==='aid'?wounded*.8:0)+(m.scores[kind]?.value||0)*2-m.danger.filter(a=>distance(a,{x,y})<200).length*5;
   candidates.push({...it,x,y,score,cost:c.cost(it)});
  }
 }
 candidates.sort((a,b)=>b.score-a.score||a.cost-b.cost);
 const troopReserve=c.own.filter(u=>!u.sap).length<18?260:140;
 const recent=m.works.filter(w=>c.time-w.at<60).reduce((n,w)=>n+w.cost,0);
 const budget=Math.min(c.cash-troopReserve,100+(c.income||8)*60*.45-recent);
 const best=candidates.find(i=>i.cost<=budget);
 if(!best){m.reserve=Math.min(180,candidates[0]?.cost||0);m.note='Guardando suprimentos para a próxima obra';return null}
 m.reserve=best.cost;return best;
}
function committed(team,it,project,time){const m=memory(team,time);m.spent+=it.cost;m.next=time+12;m.reserve=0;m.works.push({project,kind:it.kind,x:it.x,y:it.y,cost:it.cost,at:time,last:time,use:0,evaluated:false});const names={trench:'trincheira',comm:'ligação protegida',nest:'ninho de metralhadora',dugout:'abrigo',aid:'posto médico',mortar:'posição de morteiro',bunker:'bunker',aa:'antiaérea',gunf:'canhão'};m.note='Construindo '+(names[it.kind]||it.kind)+' conforme a frente'}
function state(team){const m=memories[team];if(!m)return null;return {reserve:m.reserve,spent:m.spent,evaluated:m.evaluated,note:m.note,history:m.history.map(x=>({...x})),scores:JSON.parse(JSON.stringify(m.scores))}}
const api={choose,committed,state,reset};root.IronFrontEngineering=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
