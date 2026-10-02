(function(root){
'use strict';
function create(width=2400,height=1600){const inset=Math.min(260,width*.15);return [
 {x:inset,y:height/2,name:'EUA',home:0,progress:-100,owner:0},
 {x:width-inset,y:height/2,name:'ALEMANHA',home:1,progress:100,owner:1}
]}
function isBaseBattle(points){return points.length===2&&[0,1].every(team=>points.some(p=>p.home===team))}
function capture(points,units,dt){const events=[];
 for(const p of points){const counts=[0,0];for(const u of units)if(u.hp>0&&!u.down&&!u.rs&&u.cls!=='medic'&&!u.sap&&Math.hypot(u.x-p.x,u.y-p.y)<115)counts[u.team]+=u.type==='tank'?3:1;
  const balance=Math.max(-8,Math.min(8,counts[1]-counts[0]));if(balance)p.progress=Math.max(-100,Math.min(100,p.progress+balance*dt*5));
  const previous=p.owner;if(p.progress<=-95)p.owner=0;else if(p.progress>=95)p.owner=1;else if(Math.abs(p.progress)<15)p.owner=-1;
  if(previous!==p.owner&&p.owner!==-1)events.push({name:p.name,team:p.owner});
 }return events;
}
function winner(points){if(!isBaseBattle(points))return null;
 // Both bases changing hands together leaves the battle open until a side recovers its own.
 for(const team of [0,1])if(points.every(p=>p.owner===team))return team;return null;
}
function drain(points,team){return isBaseBattle(points)?points.filter(p=>p.home!==team&&p.owner===team).length:points.filter(p=>p.owner===team).length}
const api={create,isBaseBattle,capture,winner,drain};root.IronFrontBases=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
