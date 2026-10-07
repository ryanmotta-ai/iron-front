/* Shared bounded decisions for medical and engineering services, without resource creation. */
(function(root){
'use strict';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function risk(s,p){let v=0;
 for(const e of s.enemies||[]){const d=dist(e,p),reach=e.type==='mg'?300:200;if(d<reach)v+=(e.type==='tank'?5:e.type==='mg'?4:2)*(1-d/reach)}
 for(const sh of s.shells||[])if(sh.t>0&&sh.t<4&&sh.kind!=='smoke'&&dist(sh,p)<(sh.r||65)+35)v+=12;
 for(const b of s.buildings||[])if(b.hp>0&&dist(b,p)<45){if(b.type==='wire')v+=6;else if(b.team===s.team)v-=.5}
 for(const t of s.trenches||[])if(t.hp>0&&t.team===s.team&&dist(t,p)<55){v-=.8;break}
 if(s.depth)v+=Math.max(0,s.depth(p.x,p.y)||0)*8;
 return Math.max(0,v);
}
function route(s,start,goal){const length=dist(start,goal);if(length<25)return {...goal};const reach=Math.min(length,110),dx=(goal.x-start.x)/length,dy=(goal.y-start.y)/length;let best=null,score=Infinity;
 for(const off of [0,-55,55,-110,110]){const p={x:clamp(start.x+dx*reach-dy*off,20,(s.width||root.IronFrontWorld?.width||2400)-20),y:clamp(start.y+dy*reach+dx*off,20,(s.height||root.IronFrontWorld?.height||1600)-20)};
  const cost=dist(p,goal)*.035+Math.abs(off)*.014+risk(s,p)+risk(s,{x:(start.x+p.x)/2,y:(start.y+p.y)/2})*.7+(s.clear&&!s.clear(start,p)?12:0);
  if(cost<score){score=cost;best=p}}
 return best;
}
function triage(s,rescuer,w,speed=47,aid=4.5){const d=dist(rescuer,w),remaining=(w.bleed??s.time+60)-s.time,arrival=d/speed+aid;
 if(remaining<arrival+1||w.hp<=0||!w.down)return -Infinity;
 const danger=risk(s,w),severity={critical:3,serious:2,light:1}[w.cz?.sev]||2;
 if(danger>=8)return -Infinity;
 return severity*4+Math.min(8,35/Math.max(3,remaining-arrival))-d*.025-danger*2-(w.cz?.stab?8:0);
}
function workScore(s,p,seg){const remaining=Math.max(0,(seg.need[p.target-1]||0)-seg.work),progress=seg.stage/Math.max(1,p.target),waiting=Math.min(6,(s.time-p.t0)/25);
 return (p.src==='player'?80:0)+(p.kind==='repair'?5:0)+progress*7+waiting+(p.kind==='aid'?s.wounded*.4:p.kind==='depot'?s.ammoShort*.25:0)-risk(s,seg)*4-remaining*.015;
}
const api={risk,route,triage,workScore,dist};root.IronFrontSupport=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
