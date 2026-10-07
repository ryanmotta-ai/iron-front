/* Match paid reinforcements to missing capabilities, with bounded specialist strength. */
(function(root){
'use strict';
function choose(state,operation,fallback){
 const own=state.units.filter(u=>u.team===state.team&&u.hp>0),ready=own.filter(u=>!u.down);
 const combat=ready.filter(u=>!u.sap&&u.cls!=='medic'),room=state.maxUnits-own.length;
 const can=kind=>state.defs[kind]&&room>=state.defs[kind].count&&state.supplies>=state.defs[kind].cost+80;
 if(combat.length<8&&can('rifle'))return 'rifle';
 const workers=ready.filter(u=>u.sap&&u.cls!=='medic'&&!u.rs&&u.hp/u.maxhp>.35).length;
 const desiredWorkers=(state.constructionProjects||0)>=3&&combat.length>=40?9:6;
 if(state.sappersOn&&state.time>25&&workers<desiredWorkers&&can('sapper'))return 'sapper';
 const classes=cls=>ready.filter(u=>!u.sap&&u.cls===cls).length;
 const wounded=own.filter(u=>u.down||u.hp/u.maxhp<.65).length;
 const needMedic=classes('medic')<Math.min(3,Math.max(1,Math.ceil(combat.length/48)))&&wounded>=2;
 const needObserver=state.artilleryAvailable&&!classes('observer');
 if(state.classesOn&&combat.length>=12&&(needMedic||needObserver)&&can('specialists'))return 'specialists';
 if(state.classesOn&&combat.length>=20&&['prepare','advance'].includes(operation?.phase)&&classes('assault')<6&&can('assault'))return 'assault';
 return fallback;
}
const api={choose};root.IronFrontArmyNeeds=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
