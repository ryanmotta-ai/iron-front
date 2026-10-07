/* Battle interface follows actual capture, fleet readiness and available troops. */
(function(){
'use strict';
const R=window.IronFrontRefinement,box=document.getElementById('objectives');if(!R||!box)return;
let warned=false;
const style=document.createElement('style');style.textContent=`
#objectives .objective{position:relative;border:0;cursor:pointer;overflow:hidden}
#objectives .objective:focus-visible{outline:2px solid #f0e3a0;outline-offset:3px}
.objective .capture-progress{position:absolute;bottom:0;left:0;height:3px;background:#efc378;pointer-events:none}
.objective.contested{color:#ffe4a0;box-shadow:inset 0 0 0 1px #edb46a}
.objective.lost{color:#ffcab1;box-shadow:inset 0 0 0 1px #ec8e6b}
.card.unavailable .cost{color:#e4997e!important}.card.unavailable canvas{opacity:.6}
#tacticalStatus{bottom:calc(var(--hbh,140px) + 40px);max-width:min(80vw,900px);font-size:11px}
#battleDialogue{bottom:calc(var(--hbh,140px) + 94px)}
#airRadio{bottom:calc(var(--hbh,140px) + 168px);max-width:min(460px,70vw);padding:6px 8px;background:#182018dd}
@media(max-width:700px){#tacticalStatus{bottom:calc(var(--hbh,140px) + 42px);font-size:9px}#battleDialogue{bottom:calc(var(--hbh,140px) + 100px)}#airRadio{bottom:calc(var(--hbh,140px) + 190px)}}
`;document.head.append(style);
function objectives(){
 if(box.children.length!==points.length||[...box.children].some((b,i)=>b.dataset.point!==String(i))){
  box.replaceChildren();points.forEach((p,index)=>{const b=document.createElement('button');b.type='button';b.dataset.point=index;
   const name=document.createElement('span'),bar=document.createElement('span');name.className='base-name';bar.className='capture-progress';b.append(name,bar);
   b.onclick=()=>{const point=points[index];if(!point)return;if(mode==='soldier')setMode('commander',false);window.PXAWV?.camOff?.();cam.x=point.x;cam.y=point.y};box.append(b)});
 }
 points.forEach((p,index)=>{const b=box.children[index],status=R.baseStatus(p),label=p.name+(status.kind==='secure'?'':' !'),title=`Base ${p.name}: ${status.label}${status.kind!=='secure'?` · ${p.home===playerTeam?'avanço inimigo':'nosso avanço'} ${Math.round(status.hostile*100)}%`:''}. Clique para ir até a base.`;
  b.className='objective '+(p.owner===0?'b':p.owner===1?'r':'')+' '+status.kind;
  if(b.firstChild.textContent!==label)b.firstChild.textContent=label;if(b.title!==title){b.title=title;b.setAttribute('aria-label',title)}
  b.lastChild.style.width=status.kind==='secure'?'0':`${Math.round(status.hostile*100)}%`;
 });
}
function cards(){
 const occupancy=units.filter(u=>u.team===playerTeam&&u.hp>0).length;
 for(const card of document.querySelectorAll('#cards .card[data-kind]')){
  const kind=card.dataset.kind,def=defs[kind],cost=card.dataset.cost!==undefined?+card.dataset.cost:def?.cost;
  let reason='';
  if(def?.count&&occupancy+def.count>maxUnits)reason='Sem espaço para o grupo inteiro';
  else if(!sandbox&&Number.isFinite(cost)&&supplies[playerTeam]<cost)reason=`Faltam ${Math.ceil(cost-supplies[playerTeam])} suprimentos`;
  const mission={cap:'cap',fighter:'atk',atk:'atk',bomber:'bmb',spot:'rec',recon:'rec'}[kind];
  if(!reason&&mission&&window.PXAW?.on){if(window.PXFORT?.isPrep?.())reason='Disponível após a preparação';else if(window.IronFrontAirCommand?.grounded())reason='Clima impede a decolagem';else if(!PXAW.available(playerTeam,mission))reason='Aguarde aviões e pilotos prontos'}
  card.classList.toggle('unavailable',!!reason);
  if(card.dataset.unavailableReason!==reason){card.dataset.unavailableReason=reason;const text=card.querySelector('b')?.textContent||kind,sub=card.querySelector('small')?.textContent||'';card.title=text+' · '+(reason||sub);card.setAttribute('aria-label',card.title)}
 }
}
const hud0=window.hud;window.hud=function(...args){
 const r=hud0.apply(this,args);objectives();cards();
 const own=units.filter(u=>u.team===playerTeam&&u.hp>0),combat=own.filter(u=>R.commandable(u,playerTeam)&&!u.sap&&u.cls!=='medic').length,wounded=own.filter(u=>u.down).length;
 document.getElementById('unitcount').title=`${combat} combatentes disponíveis · ${own.filter(u=>u.sap&&!u.down).length} engenheiros de campo · ${own.filter(u=>u.cls==='medic'&&!u.down).length} médicos · ${wounded} em tratamento. Feridos vivos ocupam vagas.`;
 for(const id of selected)if(!units.some(u=>u.id===id&&R.commandable(u,playerTeam)))selected.delete(id);
 const home=points.find(p=>p.home===playerTeam),danger=home&&R.baseStatus(home).hostile>.1;
 if(started&&!ended&&danger&&!warned){warned=true;toast('Sua base está em disputa. Clique na bandeira para conferir a defesa.')}else if(!danger)warned=false;
 return r;
};
canvas.addEventListener('pointercancel',()=>{mouse.down=false;drag=null});
const setup0=window.setup;window.setup=function(...args){warned=false;keys={};drag=null;mouse.down=false;return setup0.apply(this,args)};
window.IronFrontPolish={objectives,cards};objectives();
})();
