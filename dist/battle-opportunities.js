/* Local openings require observation, real participants and a bounded commitment. */
(function(root){
'use strict';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const free=(u,s)=>u.hp>0&&!u.down&&!u.rs&&!u.pinned&&!u.sapJob&&u.id!==s.controlledId&&!(u.manualUntil>s.time)&&!(u.dodgeUntil>s.time);
function choose(g,state,enemies,task,goal){
 const src=g.source,m=src.mind,d=state.team?-1:1,time=state.time;
 if(!m)return {task,goal};
 const protectedTask=['retirada-coberta','reorganização-local','reabastecimento','reforço-defensivo','recuperar-objetivo','conter-acesso'].includes(task);
 if(protectedTask||g.pressure>.85||g.members.filter(u=>free(u,state)&&u.hp>u.maxhp*.4).length<3){src.occupation=null;return {task,goal}}
 let mission=src.occupation;
 if(mission){
  const t=(state.trenches||[]).find(t=>t.id===mission.id&&t.hp>0);
  if(!t||time>mission.until||g.members.reduce((n,u)=>n+u.hp,0)<mission.health*.65){src.occupation=null;src.occupationReady=time+20}
  else return {task:'ocupar-trincheira',goal:{x:t.x,y:t.y},reason:'Ocupando trecho observado para proteger o avanço'};
 }
 if(g.kind!=='infantry'||!['avanço-alternado','infiltração','consolidação','explorar-brecha'].includes(task)||time<(src.occupationReady||0))return {task,goal};
 const fresh=enemies.filter(e=>time-e.at<12);
 const t=(state.trenches||[]).filter(t=>t.team!==state.team&&t.hp>0&&t.line!=='comm'&&dist(t,g)<260&&d*(t.x-g.x)>-25&&
  g.members.some(u=>dist(u,t)<Math.min(350,state.visibilityRange||350)&&(!state.clearSight||state.clearSight(u,t)))&&
  fresh.filter(e=>dist(e,t)<140).length<Math.max(2,g.members.length*.5)&&
  !(state.shells||[]).some(s=>s.t>0&&s.t<5&&s.kind!=='smoke'&&dist(s,t)<(s.r||65)+50))
  .sort((a,b)=>dist(a,g)-dist(b,g))[0];
 if(!t)return {task,goal};
 src.occupation={id:t.id,until:time+24,health:g.members.reduce((n,u)=>n+u.hp,0)};
 return {task:'ocupar-trincheira',goal:{x:t.x,y:t.y},reason:'Trecho observado e acessível: ocupar a trincheira'};
}
function reserve(groups,state,enemies,op,sectors,defender){
 const eligible=groups.filter(g=>g.kind==='infantry'&&g.source.reserve),time=state.time;
 const current=eligible.find(g=>g.source.exploit);
 if(current){const m=current.source.exploit,health=current.members.reduce((n,u)=>n+u.hp,0);
  if(!defender&&op.phase==='advance'&&time<m.until&&health>=m.health*.7&&current.pressure<.8)return {id:current.id,sector:m.sector};
  current.source.exploit=null;current.source.exploitReady=time+30;
 }
 // Keep at least one reserve untouched; a scout or advancing group must see the opening.
 if(defender||op.phase!=='advance'||time-op.since<6||eligible.length<2)return null;
 const d=state.team?-1:1;
 if(!groups.some(g=>!g.source.reserve&&g.kind==='infantry'&&d*(g.x-op.sector.front)>120&&Math.abs(g.y-op.sector.y)<260))return null;
 const openings=sectors.filter(s=>s.id!==op.sector.id&&s.target&&Math.abs(s.id-op.sector.id)===1&&
  s.threat<3&&groups.some(g=>!g.source.reserve&&dist(g,s)<320&&g.members.some(u=>dist(u,s)<Math.min(350,state.visibilityRange||350)&&(!state.clearSight||state.clearSight(u,s))))&&
  !enemies.some(e=>time-e.at<12&&dist(e,s)<200&&e.type==='tank')).sort((a,b)=>b.score-a.score);
 const s=openings[0];if(!s)return null;
 const g=eligible.filter(g=>time>=(g.source.exploitReady||0)&&g.members.filter(u=>free(u,state)).length>=4&&g.pressure<.5&&!(g.source.mind?.recoverUntil>time)&&dist(g,s)<600).sort((a,b)=>dist(a,s)-dist(b,s))[0];
 if(!g)return null;g.source.exploit={sector:s.id,until:time+24,health:g.members.reduce((n,u)=>n+u.hp,0)};
 return {id:g.id,sector:s.id};
}
const api={choose,reserve};root.IronFrontOpportunities=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
