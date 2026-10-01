/* Optional tactical view: allied intentions only, including on foggy maps. */
(function(){
'use strict';
const Brain=window.IronFrontBrain;if(!Brain?.operations)return;
let show=true,lastEvent=[0,0],lastToast=[-100,-100];
const setup0=window.setup;
window.setup=function(...args){Brain.operations.reset();lastEvent=[0,0];lastToast=[-100,-100];return setup0.apply(this,args)};
const panel=document.getElementById('aiPanel');
const toggle=document.createElement('button');toggle.textContent='TÁTICAS NO MAPA: ON';toggle.setAttribute('aria-pressed','true');
toggle.onclick=()=>{show=!show;toggle.textContent='TÁTICAS NO MAPA: '+(show?'ON':'OFF');toggle.setAttribute('aria-pressed',String(show))};
panel?.insertBefore(toggle,panel.querySelector('[data-close].primary'));
const lesson=document.createElement('p');lesson.id='aiLearning';panel?.insertBefore(lesson,toggle);
const status=document.createElement('div');status.id='tacticalStatus';status.setAttribute('aria-live','polite');document.getElementById('field')?.append(status);
const css=document.createElement('style');css.textContent='#tacticalStatus{position:absolute;left:50%;bottom:176px;transform:translateX(-50%);max-width:70vw;padding:6px 10px;background:#151c16dd;border:1px solid #74855b;color:#d9e5b5;font:12px Silkscreen,monospace;pointer-events:none;text-align:center}#tacticalStatus:empty{display:none}@media(max-width:700px){#tacticalStatus{bottom:190px;font-size:9px;max-width:85vw}}';document.head.append(css);
const hud0=window.hud;
window.hud=function(...args){const r=hud0.apply(this,args);const plan=Brain.lastPlans[playerTeam];
 const text=show&&started&&!ended&&aiEnabled[playerTeam]&&plan?plan.summary:'';if(status.textContent!==text)status.textContent=text;
 const learned=plan?.learning?`Aprendizado da sua facção: ${plan.learning.note}. Operações avaliadas: ${plan.learning.evaluated}.`:'';
 if(lesson.textContent!==learned)lesson.textContent=learned;
 if(plan&&aiEnabled[playerTeam]){const e=plan.events.at(-1);if(e&&e.id!==lastEvent[playerTeam]){lastEvent[playerTeam]=e.id;
  if(time-lastToast[playerTeam]>12&&['advance','withdraw','counter'].includes(plan.operation.phase)){lastToast[playerTeam]=time;toast(e.text)}}}
 return r};
const mini0=window.minimap;
window.minimap=function(...args){const r=mini0.apply(this,args),plan=Brain.lastPlans[playerTeam];if(!show||!plan||!aiEnabled[playerTeam])return r;
 const sx=mini.canvas.width/W,sy=mini.canvas.height/H;mini.save();mini.strokeStyle='#d8e6a1';mini.lineWidth=1;
 for(const s of plan.sectors){mini.globalAlpha=s.id===plan.operation.sector?1:.35;mini.beginPath();mini.moveTo(0,Math.round((s.y-160)*sy));mini.lineTo(mini.canvas.width,Math.round((s.y-160)*sy));mini.stroke()}
 mini.globalAlpha=.85;const op=plan.operation,x=op.x*sx,y=op.y*sy;mini.strokeRect(Math.round(x)-4,Math.round(y)-4,8,8);
 const drawn=new Set();for(const o of plan.orders){if(drawn.has(o.squad))continue;drawn.add(o.squad);const u=units.find(u=>u.id===o.id);if(!u)continue;
  mini.beginPath();mini.moveTo(Math.round(u.x*sx),Math.round(u.y*sy));mini.lineTo(Math.round(o.tx*sx),Math.round(o.ty*sy));mini.stroke()}
 mini.restore();return r};
window.IronFront.tactics={state:team=>Brain.operations.state(team??playerTeam),toggle:()=>toggle.onclick(),get visible(){return show}};
})();
