(function(root){
'use strict';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function observe(state,own,seen,pending,canSee){
 for(const u of state.units){if(u.team===state.team)continue;
  let observer=null,distance=Infinity;
  for(const f of own){const d=dist(f,u);if(d>=(state.visibilityRange??Infinity)||d>=distance)continue;if(canSee&&!canSee(f,u))continue;observer=f;distance=d}
  if(!observer)continue;if(u.hp<=0||u.down){seen.delete(u.id);pending.delete(u.id);continue}
  const old=seen.get(u.id),delay=distance>480?2:0,report={id:u.id,team:u.team,type:u.type,x:u.x,y:u.y,hp:u.hp,maxhp:u.maxhp,at:state.time,suppression:u.suppression||0,source:observer.id,confidence:1};
  if(delay){if(!pending.has(u.id))pending.set(u.id,{...report,deliver:state.time+delay})}else{seen.set(u.id,report);pending.delete(u.id)}
 }
 for(const [id,e] of pending){if(state.time-e.at>8){pending.delete(id);continue}if(state.time>=e.deliver){seen.set(id,{...e});pending.delete(id)}}
 for(const [id,e] of seen){const age=state.time-e.at;e.confidence=Math.max(.15,1-age/40);e.status=age<8?'observado':'ultima-posicao';if(age>35)seen.delete(id)}
 return [...seen.values()];
}
function snapshot(seen,time){return [...seen.values()].map(e=>({id:e.id,type:e.type,x:e.x,y:e.y,age:+(time-e.at).toFixed(1),confidence:e.confidence??1,status:e.status||'observado',source:e.source}))}
const api={observe,snapshot};root.IronFrontIntelligence=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
