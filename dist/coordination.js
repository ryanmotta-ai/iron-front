/* Bounded, observable joint maneuvers. Never creates troops, ammunition or hidden contacts. */
(function(root){
'use strict';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const manual=(u,t)=>u.manualUntil>t&&![u.pinStamp,u.sapStamp,u.postStamp,u.depStamp].includes(u.manualUntil);
const free=(u,s)=>u.hp>0&&!u.down&&!u.rs&&!u.sapJob&&!u.pinned&&u.cls!=='medic'&&!manual(u,s.time)&&u.id!==s.controlledId&&!(u.dodgeUntil>s.time);
const ready=(g,s)=>g.members.filter(u=>free(u,s)).length>=Math.max(1,Math.ceil(g.members.length*.6))&&g.pressure<1&&!(g.source?.mind?.recoverUntil>s.time);
const protectedTask=g=>['guarda-objetivo','recuperar-objetivo','retirada-coberta','reorganização-local','reabastecimento'].includes(g.source?.task);
function create(){return {next:1,missions:[],history:[],scores:{},cooldown:0,note:'Aguardando oportunidade de ação conjunta',requests:[]}}
function health(m,s){const own=new Map(s.units.filter(u=>u.team===s.team).map(u=>[u.id,u]));let start=0,left=0;
 for(const p of m.cohort){const u=own.get(p.id);if(u&&(manual(u,s.time)||u.id===s.controlledId||u.rs))continue;start+=p.hp;left+=u&&u.hp>0&&!u.down?Math.min(p.hp,u.hp):0}return start?left/start:1;
}
function finish(mem,m,s,success,reason,cancelled=false){
 const loss=1-health(m,s),reward=clamp((success?1:-.35)-loss*1.2,-1,1),key=m.kind+'/'+m.context;
 if(!cancelled){const learned=mem.scores[key]||(mem.scores[key]={attempts:0,value:0});learned.attempts++;learned.value+=(reward-learned.value)/Math.min(6,learned.attempts)}
 mem.history.push({id:m.id,kind:m.kind,success,cancelled,reason,loss:+loss.toFixed(3),reward:cancelled?null:+reward.toFixed(3),time:s.time});mem.history=mem.history.slice(-16);
 mem.missions=mem.missions.filter(a=>a!==m);mem.cooldown=s.time+6;mem.note=reason;
}
function add(mem,s,kind,participants,target,contact){
 const context=s.visibilityRange<400?'neblina':'visivel',m={id:mem.next++,kind,context,at:s.time,until:s.time+(kind==='brecha'?34:kind==='conter'?24:22),phase:kind==='brecha'?'reunir':'executar',target:{x:target.x,y:target.y},contact:contact?.id,participants:participants.map(g=>g.id),
 cohort:participants.flatMap(g=>g.members.filter(u=>free(u,s)).map(u=>({id:u.id,hp:u.hp}))),startX:participants[0].x,startY:participants[0].y};
 mem.missions.push(m);return m;
}
function update(mem,s,groups,enemies,op,defender){
 const d=s.team?-1:1,active=new Map(groups.map(g=>[g.id,g])),fresh=enemies.filter(e=>s.time-e.at<12);
 const own=new Map(s.units.filter(u=>u.team===s.team).map(u=>[u.id,u]));
 mem.requests=[];
 for(const m of [...mem.missions]){
  const participants=m.participants.map(id=>active.get(id)),loss=1-health(m,s);
  if(m.cohort.some(p=>{const u=own.get(p.id);return u&&(manual(u,s.time)||u.id===s.controlledId||u.rs)})||defender&&op.phase!=='hold'||!defender&&op.phase!=='advance'){
   finish(mem,m,s,false,'Missão liberada para ordem humana, socorro ou contra-ataque',true);continue;
  }
  if(participants.some(g=>g&&protectedTask(g))){finish(mem,m,s,false,'Prioridade local assumiu a equipe: liberar apoio',true);continue}
  if(participants.some(g=>!g||!ready(g,s))||loss>.3||(!defender&&op.phase==='withdraw')){finish(mem,m,s,false,'Manobra interrompida: preservar homens e retomar a missão');continue}
  const assault=participants[0];
  if(m.kind==='brecha'){
   const blocked=(s.buildings||[]).some(b=>b.hp>0&&b.type==='wire'&&b.team!==s.team&&distance(b,m.target)<50);
   if(blocked){finish(mem,m,s,false,'Brecha fechada: buscar outro acesso');continue}
   if(m.phase==='reunir'&&(distance(assault,m.target)<170||s.time-m.at>=8))m.phase='executar';
   if(d*(assault.x-m.target.x)>65){finish(mem,m,s,true,'Brecha atravessada: apoio acompanha a conquista');continue}
  }else if(m.kind==='conter'){
   const pressure=fresh.filter(e=>distance(e,m.target)<260);
   if(pressure.length&&pressure.every(e=>e.suppression>.8)&&distance(assault,m.target)<90&&s.time-m.at>=6){finish(mem,m,s,true,'Contenção eficaz: acesso protegido e pressão reduzida');continue}
   if(!fresh.some(e=>distance(e,m.target)<260)&&s.time-m.at>=8){finish(mem,m,s,false,'Contato perdido: reserva retorna à defesa',true);continue}
  }else{
   const contact=fresh.find(e=>e.id===m.contact),goal={x:m.target.x-d*80,y:clamp(m.target.y+(assault.id%2?130:-130),30,(s.height||1600)-30)};
   if(contact&&(contact.suppression>.8||distance(assault,goal)<65&&distance({x:m.startX,y:m.startY},goal)>100)){finish(mem,m,s,true,'Apoio eficaz: ameaça suprimida ou flanco alcançado');continue}
   if(!contact&&s.time-m.at>=8){finish(mem,m,s,false,'Contato perdido: encerrar apoio e reconhecer novamente',true);continue}
  }
  if(s.time>=m.until)finish(mem,m,s,false,'Prazo da manobra encerrado: retomar plano principal');
 }
 const assigned=new Set(mem.missions.flatMap(m=>m.participants));
 const candidates=groups.filter(g=>!assigned.has(g.id)&&ready(g,s)&&!protectedTask(g));
 if(s.time>=mem.cooldown&&mem.missions.length<2){
  const infantryCount=groups.filter(g=>g.kind==='infantry').length;
  const combat=candidates.filter(g=>g.kind==='infantry'&&(!g.source?.reserve||infantryCount===1)&&g.members.length>=3);
  const fire=candidates.filter(g=>g.kind==='fire'&&g.pressure<.8);
  if(defender&&op.phase==='hold'){
   const opening=fresh.filter(e=>d*(e.x-op.sector.front)<80).sort((a,b)=>distance(a,op.sector)-distance(b,op.sector))[0];
   // Commit one infantry group; the remaining garrisons keep their own sectors.
   if(opening&&!mem.missions.some(m=>m.kind==='conter')){
    const reserve=candidates.filter(g=>g.kind==='infantry'&&distance(g,opening)<480).sort((a,b)=>Number(!!b.source?.reserve)-Number(!!a.source?.reserve)||distance(a,opening)-distance(b,opening))[0];
    const threat=fresh.filter(e=>distance(e,opening)<220).reduce((n,e)=>n+(e.type==='tank'?5:e.type==='mg'?2.5:1),0);
    const context=s.visibilityRange<400?'neblina':'visivel',experience=mem.scores['conter/'+context];
    if(reserve&&reserve.strength>=threat*(.8+Math.max(0,-(experience?.value||0))*.2)){add(mem,s,'conter',[reserve],{x:op.sector.front-d*65,y:opening.y},opening);mem.note='Reserva contendo acesso ameaçado sem abandonar as guarnições'}
   }
  }else if(op.phase==='advance'){
   const breaches=(s.breaches||[]).filter(b=>b.team!==s.team&&s.time-b.t<180&&Math.abs(b.y-op.sector.y)<340&&d*(b.x-op.sector.x)<120&&
    !(s.buildings||[]).some(o=>o.hp>0&&o.type==='wire'&&o.team!==s.team&&distance(o,b)<50)&&
    !(s.shells||[]).some(o=>o.t>0&&o.t<5&&o.kind!=='smoke'&&distance(o,b)<(o.r||65)+50)&&
    combat.some(g=>distance(g,b)<320&&d*(b.x-g.x)>-40)&&
    groups.some(g=>g.members.some(u=>free(u,s)&&distance(u,b)<Math.min(550,s.visibilityRange??550)&&(!s.clearSight||s.clearSight(u,b)))));
   const breach=breaches.sort((a,b)=>distance(a,op.sector)-distance(b,op.sector))[0];
   if(breach&&!mem.missions.some(m=>m.kind==='brecha')){
    const assault=combat.slice().sort((a,b)=>distance(a,breach)-distance(b,breach))[0],cover=fire.filter(g=>distance(g,breach)<420).sort((a,b)=>distance(a,breach)-distance(b,breach))[0];
    const context=s.visibilityRange<400?'neblina':'visivel',experience=mem.scores['brecha/'+context];
    if(assault&&cover&&assault.strength>=3+Math.max(0,-(experience?.value||0))*2){add(mem,s,'brecha',[assault,cover],breach);assigned.add(assault.id);assigned.add(cover.id);mem.note='Passagem aberta: reunir assalto e cobertura'}
   }
   for(const g of combat){if(assigned.has(g.id)||mem.missions.length>=2)continue;
    const contact=fresh.filter(e=>e.type==='mg'&&distance(e,g)<330).sort((a,b)=>distance(a,g)-distance(b,g))[0];if(!contact)continue;
    mem.requests.push({squad:g.id,contact:contact.id,x:contact.x,y:contact.y,at:s.time});
    const cover=fire.filter(a=>!assigned.has(a.id)&&distance(a,g)<420).sort((a,b)=>distance(a,contact)-distance(b,contact))[0];
    const context=s.visibilityRange<400?'neblina':'visivel',experience=mem.scores['apoio/'+context];
    // Poor outcomes raise the minimum strength, rather than stopping all future attacks.
    if(cover&&g.strength>=3+Math.max(0,-(experience?.value||0))*2){add(mem,s,'apoio',[g,cover],contact,contact);assigned.add(g.id);assigned.add(cover.id);mem.note='Pedido atendido: MG fixa ameaça, infantaria busca o flanco'}
   }
  }
 }
 const orders=new Map();
 for(const m of mem.missions){for(let i=0;i<m.participants.length;i++){
  const g=active.get(m.participants[i]);if(!g)continue;let task,goal,reason;
  if(m.kind==='conter'){task='conter-acesso';goal=m.target;reason='Reserva protege acesso sob pressão'}
  else if(i>0){task='apoio-solicitado';goal={x:m.target.x-d*150,y:clamp(m.target.y+(g.id%2?55:-55),30,(s.height||1600)-30)};reason='Cobertura atribuída ao pedido de outro esquadrão'}
  else if(m.kind==='brecha'){task=m.phase==='reunir'?'preparar-brecha':'assalto-brecha';goal={x:m.target.x+d*(m.phase==='reunir'?-65:110),y:m.target.y};reason=m.phase==='reunir'?'Assalto reúne antes da passagem':'Atravessar brecha com apoio e ocupar o outro lado'}
  else{task='flanco-apoiado';goal={x:m.target.x-d*80,y:clamp(m.target.y+(g.id%2?130:-130),30,(s.height||1600)-30)};reason='Apoio cobre a ameaça enquanto a equipe contorna'}
  orders.set(g.id,{task,goal:{...goal},reason,mission:m.id});
 }}
 return orders;
}
function snapshot(mem){return {note:mem.note,requests:mem.requests.map(r=>({...r})),missions:mem.missions.map(m=>({id:m.id,kind:m.kind,phase:m.phase,target:{...m.target},participants:[...m.participants],until:m.until})),history:mem.history.map(h=>({...h})),scores:JSON.parse(JSON.stringify(mem.scores))}}
function cancel(mem,s){for(const m of [...mem.missions])finish(mem,m,s,false,'Coordenação desligada: retornar ao plano principal',true);mem.requests=[]}
const api={create,update,snapshot,cancel};root.IronFrontCoordination=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
