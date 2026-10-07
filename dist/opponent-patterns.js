/* Opponent habits inferred from fresh reports, with bounded, fading memory. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function create(){return {time:null,tracks:new Map(),lanes:Array.from({length:5},()=>({episodes:0,last:-1000,ids:[],x:0,y:0,confidence:0})),note:'Aguardando movimentos observados'}}
function update(mem,state,contacts,sectors){
 const dt=mem.time===null?0:Math.max(0,state.time-mem.time),d=state.team?-1:1;mem.time=state.time;
 for(const lane of mem.lanes){lane.confidence*=Math.exp(-dt/150);if(state.time-lane.last>240){lane.episodes=0;lane.ids=[]}}
 const moving=Array.from({length:5},()=>[]);
 for(const e of contacts){
  if(state.time-e.at>=12||e.hp<=0)continue;
  const previous=mem.tracks.get(e.id);if(previous&&e.at<=previous.at)continue;
  const id=clamp(Math.floor(e.y/((state.height||1600)/5)),0,4),front=sectors[id]?.front;
  if(previous&&e.at-previous.at<=15&&d*(previous.x-e.x)>12&&Number.isFinite(front)&&d*(e.x-front)<450)moving[id].push(e);
  mem.tracks.set(e.id,{x:e.x,y:e.y,at:e.at});
 }
 for(let id=0;id<5;id++){
  const reports=moving[id];if(reports.length<2)continue;const lane=mem.lanes[id];
  const novel=reports.filter(e=>!lane.ids.includes(e.id)).length;
  if(state.time-lane.last>24&&(state.time-lane.last>45||novel>=Math.ceil(reports.length*.6))){lane.episodes=Math.min(6,lane.episodes+1);lane.confidence=Math.min(1,lane.confidence+.42);lane.ids=reports.map(e=>e.id).slice(0,64)}
  lane.last=state.time;lane.x=reports.reduce((n,e)=>n+e.x,0)/reports.length;lane.y=reports.reduce((n,e)=>n+e.y,0)/reports.length;
 }
 for(const [id,t] of mem.tracks)if(state.time-t.at>40)mem.tracks.delete(id);
 if(mem.tracks.size>240)for(const [id] of [...mem.tracks].sort((a,b)=>a[1].at-b[1].at).slice(0,mem.tracks.size-240))mem.tracks.delete(id);
 const habit=preferred(mem);mem.note=habit?`Ataques repetidos no ${sectors[habit.sector]?.name||'acesso observado'}: reposicionar cobertura`:'Aguardando movimentos observados';
 return snapshot(mem);
}
function preferred(mem){return mem.lanes.map((l,sector)=>({...l,sector})).filter(l=>l.episodes>=2&&l.confidence>.35).sort((a,b)=>b.confidence-a.confidence)[0]||null}
function snapshot(mem){return {note:mem.note,habit:preferred(mem),lanes:mem.lanes.map((l,sector)=>({sector,episodes:l.episodes,confidence:+l.confidence.toFixed(2),x:l.x,y:l.y}))}}
const api={create,update,preferred,snapshot};root.IronFrontOpponentPatterns=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
