(function(root){
'use strict';
function slots(trenches,team){
 const out=[];
 for(const t of trenches){if(t.team!==team||t.hp<=0)continue;
  let ax=t.ax,ay=t.ay;if(!Number.isFinite(ax)||!Number.isFinite(ay)||Math.hypot(ax,ay)<.1){ax=(t.hw||0)>(t.hh||0)?1:0;ay=ax?0:1}
  const norm=Math.hypot(ax,ay);ax/=norm;ay/=norm;
  const length=t.len||Math.max(t.hw||15,t.hh||15)*2;
  const n=Math.min(t.slots||1,Math.max(1,Math.floor((length-8)/18)+1));
  for(let i=0;i<n;i++){const offset=(i-(n-1)/2)*18,p={x:t.x+ax*offset,y:t.y+ay*offset,key:`${t.id??`${t.x},${t.y}`}:${i}`,trench:t};
   if(!out.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<15))out.push(p)}
 }
 return out;
}
function point(anchor,start,index,count,mode='wedge'){
 let dx=anchor.x-start.x,dy=anchor.y-start.y,n=Math.hypot(dx,dy);if(n<1){dx=1;dy=0;n=1}dx/=n;dy/=n;
 let forward=0,side=0;
 if(mode==='column'){forward=-index*24;side=(index%2?1:-1)*9}
 else if(mode==='line'){side=(index-(count-1)/2)*26}
 else if(mode==='dispersed'){forward=-Math.floor(index/3)*30;side=(index%3-1)*42}
 else {const rank=Math.ceil(index/2);forward=-rank*24;side=index===0?0:(index%2?1:-1)*rank*24}
 return {x:anchor.x+dx*forward-dy*side,y:anchor.y+dy*forward+dx*side};
}
function select(memory,members,time,goal,preferred,narrow){
 const stats=memory.stats||(memory.stats={}),trial=memory.trial;
 if(trial&&time-trial.at>=24){
  let loss=0,progress=0,count=0;const own=new Map(members.map(u=>[u.id,u]));
  for(const old of trial.members){const u=own.get(old.id);if(u&&u.manualUntil>time&&![u.pinStamp,u.sapStamp,u.postStamp,u.depStamp].includes(u.manualUntil))continue;count++;loss+=1-(u&&u.hp>0&&!u.down?Math.min(1,u.hp/old.hp):0);progress+=u&&!u.down?(old.distance-Math.hypot(u.x-trial.goal.x,u.y-trial.goal.y))/180:0}
  if(count){const reward=Math.max(-1,Math.min(1,progress/count-loss/count*2)),s=stats[trial.mode]||(stats[trial.mode]={n:0,value:0});s.n++;s.value+=(reward-s.value)/Math.min(s.n,6)}
  memory.trial=null;
 }
 if(narrow){memory.trial=null;return 'column'}
 if(memory.trial)return memory.trial.mode;
 const modes=['wedge','line','dispersed'],total=Object.values(stats).reduce((n,s)=>n+s.n,0);
 const score=mode=>(stats[mode]?.value||0)+(mode===preferred?.25:0)+.22*Math.sqrt(Math.log(total+2)/((stats[mode]?.n||0)+1));
 modes.sort((a,b)=>score(b)-score(a));const mode=modes[0];
 memory.trial={at:time,mode,goal:{...goal},members:members.filter(u=>!u.pinned&&!(u.manualUntil>time)).map(u=>({id:u.id,hp:u.hp,distance:Math.hypot(u.x-goal.x,u.y-goal.y)}))};return mode;
}
const api={slots,point,select};root.IronFrontFormations=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
