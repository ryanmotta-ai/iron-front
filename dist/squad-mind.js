(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const profiles=['equilibrado','prudente','impetuoso','protetor'];
const human=(u,time)=>u.manualUntil>time&&![u.pinStamp,u.sapStamp,u.postStamp,u.depStamp].includes(u.manualUntil);
function update(source,members,state){
 const time=state.time;let m=source.mind;
 if(!m)m=source.mind={time,morale:.8,fatigue:0,profile:profiles[source.id%4],leader:null,replaceAt:0,recoverUntil:0,health:{},intent:null,changes:0,blocked:0,lastPosition:null,note:'Esquadrão pronto',losses:0,experience:0,victories:0,scars:[]};
 const dt=Math.min(15,Math.max(0,time-m.time));m.time=time;
 const own=members.filter(u=>u.hp>0&&!u.down),eligible=own.filter(u=>!human(u,time)&&!u.rs&&u.cls!=='medic'&&u.id!==state.controlledId);
 const byId=new Map(own.map(u=>[u.id,u])),actual=new Map((state.units||own).map(u=>[u.id,u]));let loss=0,n=0;
 for(const [id,previous] of Object.entries(m.health)){const u=actual.get(+id);if(u&&(human(u,time)||u.rs||u.id===state.controlledId))continue;n++;loss+=1-(u&&u.hp>0&&!u.down?Math.min(1,u.hp/previous):0)}
 const lost=Object.keys(m.health).filter(id=>{const u=actual.get(+id);return !u||u.hp<=0||u.down}).length;
 if(lost){m.losses=(m.losses||0)+lost;if(m.lastPosition)m.scars=[...(m.scars||[]),{...m.lastPosition,at:time}].slice(-4)}
 m.scars=(m.scars||[]).filter(p=>time-p.at<180);m.experience=clamp((m.experience||0)+(own.some(u=>u.underFire>0)?dt/900:0),0,1);
 loss=n?loss/n:0;m.health=Object.fromEntries(own.map(u=>[u.id,u.hp]));
 const pressure=own.length?own.reduce((v,u)=>v+(u.suppression||0),0)/own.length:0;
 const cohesion=own.length?own.reduce((v,u)=>v+(u.cohesion??1),0)/own.length:0;
 const boosted=own.some(u=>u.moraleBonusUntil>time);
 if(m.leader!==null&&!eligible.some(u=>u.id===m.leader)){m.leader=null;m.replaceAt=time+3+(source.id%3);m.morale=Math.max(.3,m.morale-.08);m.note='Liderança em substituição'}
 if(m.leader===null&&time>=m.replaceAt){const candidate=eligible.slice().sort((a,b)=>b.hp/b.maxhp-a.hp/a.maxhp||a.id-b.id)[0];if(candidate){m.leader=candidate.id;m.note='Líder assumiu o esquadrão'}}
 const underFire=own.some(u=>u.underFire>0),rest=source.reserve||['retirada-coberta','reorganização-local','reserva-movel','reabastecimento'].includes(source.task);
 m.fatigue=clamp(m.fatigue+dt*(underFire&&!rest?.006:-.025),0,1);
 const target=clamp(.45+cohesion*.35-pressure*.12-m.fatigue*.08+(boosted?.15:0)+(m.leader!==null?.04:0)+(m.experience||0)*.04,.25,.95);
 m.morale=clamp(m.morale+(target-m.morale)*(1-Math.exp(-dt/(rest?16:26)))-loss*.42,.15,.98);
 const shaken=m.morale<.4&&pressure>.45||loss>.25&&pressure>.3;
 if(shaken&&time>=m.recoverUntil&&m.recoverUntil+25<time)m.recoverUntil=time+(10+(source.id%3)*2)*(1-(m.experience||0)*.2);
 if(boosted){m.recoverUntil=Math.min(m.recoverUntil,time);m.morale=Math.max(.65,m.morale)}
 m.state=time<m.recoverUntil?'reorganizando':m.morale<.45?'abalado':pressure>.55?'sob pressão':'confiante';
 const center=own.length?{x:own.reduce((v,u)=>v+u.x,0)/own.length,y:own.reduce((v,u)=>v+u.y,0)/own.length}:null;
 if(center&&m.lastPosition&&m.intent&&['avanço-alternado','fixar-flanquear','infiltração','reconhecimento','escolta','limpeza-trincheira','reabastecimento','flanco-apoiado','assalto-brecha','preparar-brecha','conter-acesso','apoio-solicitado'].includes(m.intent.task)&&pressure<.8&&dist(center,m.intent.goal)>80&&dt>0){m.blocked=dist(center,m.lastPosition)<7?m.blocked+dt:0}
 else m.blocked=0;m.lastPosition=center;
 return m;
}
function intent(source,task,goal,state,reason,emergency=false){
 const m=source.mind;if(!m)return {task,goal};const old=m.intent;
 if(!emergency&&old&&old.task===task&&dist(old.goal,goal)<45&&m.blocked<15)goal=old.goal;
 if(!old||old.task!==task||dist(old.goal,goal)>45){m.changes++;m.intent={task,goal:{...goal},since:state.time,until:state.time+12,owner:'esquadrao',reason};m.note=reason||task}
 if(m.blocked>=15&&!emergency){goal={x:goal.x,y:clamp(goal.y+(source.id%2?65:-65),25,(state.height||1600)-25)};m.blocked=0;m.note='Passagem travada: mudando acesso';m.intent={...m.intent,goal:{...goal}}}
 return {task,goal};
}
function maneuver(source,g,state,task,goal,enemies,support,front){
 const m=source.mind;if(!m)return {task,goal};const d=state.team?-1:1;
 const contact=enemies.filter(e=>state.time-e.at<12&&dist(e,g)<380).sort((a,b)=>(b.type==='mg'?2:0)-(a.type==='mg'?2:0)||dist(a,g)-dist(b,g))[0];
 if(state.time<m.recoverUntil&&g.kind==='infantry')return {task:'reorganização-local',goal:{x:front-d*100,y:g.y},reason:'Esquadrão abalado: recompondo sob cobertura',recover:true};
 if(task==='reconhecimento'&&contact&&enemies.filter(e=>dist(e,g)<250).length>g.members.length*1.4)return {task:'patrulha-retornando',goal:{x:front-d*35,y:g.y},reason:'Patrulha encontrou resistência superior'};
 if(['avanço-alternado','infiltração','explorar-brecha'].includes(task)&&contact&&m.profile==='protetor'&&g.members.some(u=>u.hp>0&&u.hp<u.maxhp*.35)&&m.morale<.6)return {task:'retirada-coberta',goal:{x:front-d*90,y:g.y},reason:'Líder protege o grupo desgastado: recuo coberto'};
 if(['avanço-alternado','infiltração'].includes(task)&&contact&&!support&&m.profile==='prudente'&&g.members.reduce((n,u)=>n+(u.suppression||0),0)/Math.max(1,g.members.length)>.55){
  const cover=(state.trenches||[]).filter(t=>t.team===state.team&&t.hp>0&&dist(t,g)<130).sort((a,b)=>dist(a,g)-dist(b,g))[0];
  if(cover)return {task:'infiltração',goal:{x:cover.x,y:cover.y},reason:'Líder prudente usa cobertura antes de continuar'};
 }
 if(['avanço-alternado','infiltração'].includes(task)&&m.scars?.some(p=>dist(p,goal)<110)&&!support&&m.profile!=='impetuoso')goal={x:goal.x,y:clamp(goal.y+(source.id%2?85:-85),30,(state.height||1600)-30)};
 if(['avanço-alternado','flanqueamento-coordenado','infiltração'].includes(task)&&contact?.type==='mg'&&support&&g.kind==='infantry'){
  const side=source.id%2?1:-1;
  if(!m.flank||m.flank.contact!==contact.id||state.time>m.flank.until)m.flank={contact:contact.id,x:contact.x,y:contact.y,until:state.time+24};
  const f=m.flank;if(Math.abs(g.y-(f.y+side*125))>45)return {task:'fixar-flanquear',goal:{x:f.x-d*110,y:clamp(f.y+side*125,30,(state.height||1600)-30)},reason:'MG observada: apoio fixa e infantaria flanqueia'};
 }
 if(['avanço-alternado','infiltração'].includes(task)&&contact){
  const trench=(state.trenches||[]).filter(t=>t.hp>0&&dist(t,contact)<85&&dist(g,t)<200&&d*(t.x-g.x)>-30).sort((a,b)=>dist(g,a)-dist(g,b))[0];
  if(trench)return {task:'limpeza-trincheira',goal:{x:trench.x,y:clamp(g.y+Math.sign(contact.y-g.y)*55,30,(state.height||1600)-30)},reason:'Contato na trincheira: avanço por trechos'};
 }
 return {task,goal,reason:task==='escolta'?'Escolta mantém distância do blindado':task==='retirada-coberta'?'Retirada protegida por equipe alternada':task};
}
function apply(unit,order,time,controlledId){
 if(unit.hp<=0||unit.down||unit.rs||unit.cls==='medic'||unit.id===controlledId||unit.manualUntil>time||unit.dodgeUntil>time||unit.sapJob)return false;
 const changed=unit.aiRole!==order.role||Math.hypot((unit.tx??unit.x)-order.tx,(unit.ty??unit.y)-order.ty)>24;
 if(changed){if(unit.pv&&Math.hypot((unit.tx??unit.x)-order.tx,(unit.ty??unit.y)-order.ty)>45)unit.pv.path=null;unit.tx=order.tx;unit.ty=order.ty}
 unit.order=Math.hypot(unit.x-unit.tx,unit.y-unit.ty)<16?'hold':'move';unit.aiRole=order.role;unit.aiSquad=order.squad;unit.aiSector=order.sector;unit.aiFormation=order.formation;unit.aiSlot=order.slot;
 unit.aiIntent={owner:'esquadrao',task:order.role,since:unit.aiIntent?.task===order.role?unit.aiIntent.since:time,until:time+12,reason:order.reason||order.role};
 unit.aiMorale=order.morale;unit.aiLeader=order.leader;unit.aiSquadState=order.state;return true;
}
function snapshot(s){const m=s.mind;return m?{id:s.id,kind:s.kind,leader:m.leader,profile:m.profile,morale:+m.morale.toFixed(2),fatigue:+m.fatigue.toFixed(2),experience:+(m.experience||0).toFixed(2),losses:m.losses||0,victories:m.victories||0,state:m.state,task:s.task,note:m.note,changes:m.changes,blocked:m.blocked,intent:m.intent?{...m.intent,goal:{...m.intent.goal}}:null}:null}
const api={update,intent,maneuver,apply,snapshot,human};root.IronFrontSquads=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
