/* Shared rules for final objectives, available commands and bounded target searches. */
(function(root){
'use strict';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function objective(state,op){return (state.points||[]).find(p=>p.name===op.objective)||op.sector?.target||null}
function attackGoal(state,op,group){
 const target=objective(state,op),sector=op.sector,d=state.team?-1:1;
 if(!target)return {x:sector.x,y:sector.y};
 // Keep the chosen approach until crossing the enemy's forward line; then converge on the flag.
 const closing=d*(group.x-target.x)>-500||distance(group,target)<550;
 return closing||target.home===state.team?{x:target.x,y:target.y}:{x:sector.x,y:sector.y};
}
function commandable(u,team){return u.team===team&&u.hp>0&&!u.down&&!u.rs&&!u.carried&&!u.inBed}
function commandGroup(units,team,selected,controlledId){return units.filter(u=>commandable(u,team)&&u.id!==controlledId&&(selected.size?selected.has(u.id):!u.sap&&!u.sapJob&&u.cls!=='medic'&&u.cls!=='mechanic'))}
function shouldSearch(unit,time,range){const target=unit.target;return !!(target&&(target.hp<=0||target.down||distance(unit,target)>range))||!(unit.aimCheckAt>time)}
function baseStatus(point){
 const home=point.home??point.owner,sign=home===1?1:-1,hostile=Math.max(0,Math.min(1,(100-sign*point.progress)/200));
 return {hostile,kind:point.owner!==-1&&point.owner!==home?'lost':hostile>.025?'contested':'secure',label:point.owner!==-1&&point.owner!==home?'CAPTURADA':hostile>.025?'EM DISPUTA':'SEGURA'};
}
const api={objective,attackGoal,commandable,commandGroup,shouldSearch,baseStatus};root.IronFrontRefinement=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
