(function(){
'use strict';
const Brain=window.IronFrontBrain;if(!Brain)return;
let visible=true;
const lead=document.querySelector('.sbpanel .lead');if(lead)lead.textContent+=` Frente ${H>1600?'ampliada':'clássica'}: ${W} × ${H}, com espaço para flancos ao norte e ao sul.`;
const panel=document.getElementById('aiPanel'),button=document.createElement('button');
button.textContent='CONVERSAS: ON';button.setAttribute('aria-pressed','true');
button.onclick=()=>{visible=!visible;button.textContent='CONVERSAS: '+(visible?'ON':'OFF');button.setAttribute('aria-pressed',String(visible))};panel?.append(button);
const feed=document.createElement('div');feed.id='battleDialogue';feed.setAttribute('aria-live','polite');document.getElementById('field')?.append(feed);
const css=document.createElement('style');css.textContent='#battleDialogue{position:absolute;left:12px;bottom:260px;max-width:min(420px,70vw);padding:7px 10px;color:#e8e2cb;background:#182018df;border-left:2px solid #b4bd87;font:12px monospace;pointer-events:none;white-space:pre-line}#battleDialogue:empty{display:none}@media(max-width:700px){#battleDialogue{bottom:300px;max-width:65vw;font-size:11px}}';document.head.append(css);
function active(){if(!visible||!started||ended||!aiEnabled[playerTeam]||window.IronFrontHuman?.on===false)return [];
 const own=new Map(units.filter(u=>u.team===playerTeam&&u.hp>0&&!u.down).map(u=>[u.id,u]));
 return (Brain.lastPlans[playerTeam]?.dialogue||[]).filter(e=>e.time<=time&&e.expires>time&&own.has(e.speaker)&&(e.kind!=='resposta'||Brain.lastPlans[playerTeam]?.orders.some(o=>o.id===e.speaker&&o.role===e.task))).map(e=>({...e,u:own.get(e.speaker)}));
}
const hud0=window.hud;window.hud=function(...args){const r=hud0.apply(this,args),events=active();const text=events.slice(-2).map(e=>e.name+': '+e.text).join('\n');if(feed.textContent!==text)feed.textContent=text;return r};
if(window.WW1A){const draw0=WW1A.over;WW1A.over=function(c,ox,oy,...args){const r=draw0?.call(this,c,ox,oy,...args);if(!window.IFK?.on)return r;
 c.save();let occupied=[];
 for(const e of active().slice(-3)){const text=e.text.toUpperCase(),w=IFK.textW(text),x=ox+Math.round(e.u.x*.5)-(w>>1),y=oy+Math.round(e.u.y*.5)-31;
  if(x+w<0||y<0||x>vw||y>vh||occupied.some(p=>Math.abs(p.y-y)<12&&Math.abs(p.x-x)<w))continue;
  occupied.push({x,y});c.fillStyle='#182018e8';c.fillRect(x-3,y-3,w+6,11);IFK.text(c,text,x,y,'#ece6c8');
 }c.restore();return r}}
window.IronFront.dialogue={toggle:()=>button.onclick(),get visible(){return visible},events:()=>active().map(({u,...e})=>e)};
})();
