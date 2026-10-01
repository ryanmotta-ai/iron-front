/* Bounded online learning from allied losses, observed contacts and mission outcomes.
   No enemy positions are read from outside the commander's observation map. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const styles={balanced:'Avanço combinado',flank:'Flanqueamento',armor:'Ruptura blindada',infiltrate:'Infiltração cautelosa'};
const manual=(u,time)=>u.manualUntil>time&&![u.pinStamp,u.sapStamp,u.postStamp,u.depStamp].includes(u.manualUntil);
const sector=y=>clamp(Math.floor(y/320),0,4),key=(x,y)=>`${Math.floor(x/80)},${Math.floor(y/80)}`;
function create(){return {time:null,own:new Map(),heat:new Map(),sectors:Array.from({length:5},()=>({pressure:0,mg:0,tanks:0,exposure:0,losses:0,successes:0,attempts:0,styles:Object.fromEntries(Object.keys(styles).map(s=>[s,{trials:0,reward:0}]))})),trial:null,note:'Reconhecimento em andamento',history:[]}}
function update(state,own,enemies,l){
 const dt=l.time===null?1:Math.max(0,state.time-l.time);if(!dt)return;
 l.time=state.time;
 const current=new Map(state.units.filter(u=>u.team===state.team).map(u=>[u.id,u]));
 for(const [id,prev] of l.own){
  const u=current.get(id),disabled=!u||u.hp<=0||u.down;
  const damage=prev.active?(disabled?prev.hp:Math.max(0,prev.hp-u.hp)):0;
  if(damage>0){
   const x=u?.x??prev.x,y=u?.y??prev.y,k=key(x,y),s=l.sectors[sector(y)];
   const h=l.heat.get(k)||{x:Math.floor(x/80)*80+40,y:Math.floor(y/80)*80+40,value:0,at:state.time};
   h.value=clamp(h.value+damage/100,0,8);h.at=state.time;l.heat.set(k,h);s.losses+=damage/100;
  }
 }
 const alpha=1-Math.exp(-Math.min(dt,15)/35);
 for(let i=0;i<5;i++){
  const observed=enemies.filter(e=>state.time-e.at<12&&sector(e.y)===i),s=l.sectors[i];
  const pressure=observed.reduce((v,e)=>v+(e.type==='tank'?5:e.type==='mg'?2.5:1),0);
  s.pressure+=(pressure-s.pressure)*alpha;s.mg+=(observed.filter(e=>e.type==='mg').length-s.mg)*alpha;
  s.tanks+=(observed.filter(e=>e.type==='tank').length-s.tanks)*alpha;
  if(observed.length)s.exposure+=Math.min(dt,15);
 }
 for(const [k,h] of l.heat){h.value*=Math.exp(-Math.min(dt,120)/180);if(h.value<.08||state.time-h.at>300)l.heat.delete(k)}
 // Fixed spatial grid: memory cannot grow with the duration of a battle.
 l.own=new Map(own.map(u=>[u.id,{hp:u.hp,x:u.x,y:u.y,active:u.hp>0&&!u.down}]));
}
function select(l,id,state,enemies){
 const s=l.sectors[id],near=enemies.filter(e=>sector(e.y)===id&&state.time-e.at<12);
 const mg=near.filter(e=>e.type==='mg').length,tanks=state.units.filter(u=>u.team===state.team&&u.hp>0&&!u.down&&u.type==='tank'&&(u.atr?.bog||0)<=state.time).length;
 const prior={balanced:.25,flank:mg>=2?.55:.1,armor:mg>=2?.6:.05,infiltrate:state.visibilityRange<400?.4:.05};
 let best='balanced',score=-Infinity;
 for(const name of Object.keys(styles)){
  if(name==='armor'&&!tanks)continue;
  const a=s.styles[name],explore=.38*Math.sqrt(Math.log(s.attempts+2)/(a.trials+1));
  const value=a.reward+explore+prior[name]/(a.trials+1);
  if(value>score){score=value;best=name}
 }
 return {name:best,label:styles[best],caution:clamp(s.losses/(s.exposure/8+8),0,.5)};
}
function begin(l,op,state,ids,kind='attack'){
 const members=state.units.filter(u=>ids.includes(u.id)&&u.team===state.team&&u.hp>0&&!u.down&&!manual(u,state.time)&&u.id!==state.controlledId);
 l.trial={kind,sector:op.sector.id,style:op.style?.name||'balanced',at:state.time,startDistance:op.best,
  members:members.map(u=>({id:u.id,hp:u.hp,maxhp:u.maxhp||u.hp})),objective:op.objective};
}
function finish(l,op,state,success){
 const trial=l.trial;if(!trial)return;
 const byId=new Map(state.units.filter(u=>u.team===state.team).map(u=>[u.id,u]));
 // New recruits do not hide casualties; commands taken over by the player are excluded.
 let start=0,remaining=0;
 for(const before of trial.members){const u=byId.get(before.id);if(u&&(manual(u,state.time)||u.id===state.controlledId))continue;
  start+=before.hp;remaining+=u&&u.hp>0&&!u.down?Math.min(before.hp,u.hp):0}
 if(!start){l.trial=null;return}
 const loss=clamp(1-remaining/start,0,1),progress=Number.isFinite(trial.startDistance)&&Number.isFinite(op.best)?clamp((trial.startDistance-op.best)/Math.max(100,trial.startDistance),0,1):0;
 const reward=clamp((success?1:-.55)+progress*.25-loss*1.25,-1,1),s=l.sectors[trial.sector],a=s.styles[trial.style];
 a.trials++;a.reward+=(reward-a.reward)/Math.min(a.trials,6);s.attempts++;if(success)s.successes++;
 const where=['extremo norte','norte','centro','sul','extremo sul'][trial.sector];
 l.note=success?`${styles[trial.style]} funcionou no ${where}${loss>.3?', mas custou muitas baixas':''}`:
  loss>.25?`Muitas baixas no ${where}: mudar acesso e reforçar apoio`:`Pouco progresso no ${where}: testar outra manobra`;
 l.history.push({time:state.time,sector:trial.sector,style:trial.style,kind:trial.kind,success,loss,reward});
 if(l.history.length>20)l.history.shift();l.trial=null;
}
function risk(l,x,y){
 const gx=Math.floor(x/80),gy=Math.floor(y/80);let v=0;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const h=l.heat.get(`${gx+dx},${gy+dy}`);if(h)v+=h.value*Math.max(0,1-Math.hypot(x-h.x,y-h.y)/140);
 }
 return Math.min(8,v);
}
function snapshot(l){return {note:l.note,evaluated:l.sectors.reduce((n,s)=>n+s.attempts,0),dangerCells:l.heat.size,history:l.history.map(h=>({...h})),sectors:l.sectors.map(s=>({...s,styles:Object.fromEntries(Object.entries(s.styles).map(([k,v])=>[k,{...v}]))}))}}
const api={create,update,select,begin,finish,risk,snapshot,styles};root.IronFrontLearning=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
