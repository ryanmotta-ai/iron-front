/* Staged maneuvers use actual arrivals, observed pressure and original participants. */
(function(root){
'use strict';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const names={recon:'Reconhecer acesso lateral',fix:'Estabelecer cobertura',flank:'Contornar posição',commit:'Avançar sob cobertura',setup:'Preparar emboscada',lure:'Recuar e observar perseguição',spring:'Fechar a emboscada'};
const human=(u,s)=>u.manualUntil>s.time&&![u.pinStamp,u.sapStamp,u.postStamp,u.depStamp].includes(u.manualUntil);
const free=(u,s)=>u.hp>0&&!u.down&&!u.pinned&&!u.rs&&!u.sap&&!u.sapJob&&u.cls!=='medic'&&!human(u,s)&&u.id!==s.controlledId&&!(u.dodgeUntil>s.time);
const protectedTasks=['guarda-objetivo','recuperar-objetivo','retirada-coberta','reorganização-local','reabastecimento','recuperação-logística'];
const ready=(g,s)=>g.members.length>=3&&g.members.filter(u=>free(u,s)).length>=g.members.length*.75&&g.pressure<.7&&!(g.source.mind?.recoverUntil>s.time)&&!protectedTasks.includes(g.source.task);
function create(){return {next:1,active:null,cooldown:0,history:[],reports:[],note:'Manobras aguardam reconhecimento e apoio'}}
function health(m,s){const own=new Map(s.units.filter(u=>u.team===s.team).map(u=>[u.id,u]));return m.cohort.reduce((n,p)=>{const u=own.get(p.id);return n+(u&&u.hp>0&&!u.down?Math.min(p.hp,u.hp):0)},0)/Math.max(1,m.cohort.reduce((n,p)=>n+p.hp,0))}
function finish(mem,s,success,reason,cancelled=false){const m=mem.active;if(!m)return;mem.history.push({id:m.id,kind:m.kind,stage:m.stage,time:s.time,success,cancelled,reason,retained:+health(m,s).toFixed(2)});mem.history=mem.history.slice(-12);mem.active=null;mem.cooldown=s.time+35;mem.note=reason}
function report(mem,m,s,squad,task,text,answerSquad,answerTask,answer){mem.reports.push({id:`${m.id}:${m.stage}`,at:s.time,squad,task,text,answerSquad,answerTask,answer});mem.reports=mem.reports.slice(-12)}
function stage(mem,m,s,value){m.stage=value;m.since=s.time;mem.note=names[value]}
function begin(mem,s,kind,participants,target,side){
 const d=s.team?-1:1,m={id:mem.next++,kind,stage:kind==='ambush'?'setup':'recon',at:s.time,since:s.time,participants:participants.map(g=>g.id),contact:target.id,target:{x:target.x,y:target.y},side,
  flank:{x:target.x-d*75,y:side},scout:{x:target.x-d*210,y:side},cover:{x:target.x-d*210,y:clamp(target.y+(side>target.y?-65:65),35,(s.height||1600)-35)},
  bait:{x:participants[0].x-d*140,y:participants[0].y},origins:participants.map(g=>({x:g.x,y:g.y})),cohort:participants.flatMap(g=>g.members.filter(u=>free(u,s)).map(u=>({id:u.id,hp:u.hp})))};
 mem.active=m;mem.note=names[m.stage];
 if(kind==='ambush')report(mem,m,s,participants[0].id,'isca-em-posicao','Estão voltando pelo mesmo acesso.',participants[2].id,'preparar-emboscada','Preparem a cobertura. Só recuem quando ela estiver pronta.');
 else report(mem,m,s,participants[0].id,'sondar-flanco','MG bloqueando a passagem. Vou reconhecer o lado.',participants[2].id,'fixar-posicao','Recebido. Nossa equipe vai estabelecer cobertura.');
 return m;
}
function safe(s,enemies,p){return !(s.shells||[]).some(o=>o.t>0&&o.t<5&&o.kind!=='smoke'&&dist(o,p)<(o.r||65)+50)&&!(s.terrainRisk?.(p.x,p.y,'rifle')>3)&&!enemies.some(e=>e.type==='mg'&&dist(e,p)<130)}
function update(mem,s,groups,enemies,op,defender,patterns,excluded=new Set()){
 const d=s.team?-1:1,fresh=enemies.filter(e=>s.time-e.at<12&&e.hp>0),active=new Map(groups.map(g=>[g.id,g]));
 let m=mem.active;
 if(m){
  const own=new Map(s.units.filter(u=>u.team===s.team).map(u=>[u.id,u])),gs=m.participants.map(id=>active.get(id));
  const taken=m.cohort.some(p=>{const u=own.get(p.id);return u&&(human(u,s)||u.rs||u.id===s.controlledId||u.sapJob)});
  const allowed=defender?op.phase==='hold':['prepare','advance'].includes(op.phase);
  if(taken||!allowed||m.participants.some(id=>excluded.has(id))||gs.some(g=>g&&protectedTasks.includes(g.source.task)))finish(mem,s,false,'Manobra liberada para a prioridade local',true);
  else if(gs.some(g=>!g||g.pressure>1||g.source.mind?.recoverUntil>s.time)||health(m,s)<.72)finish(mem,s,false,'Perdas ou supressão: interromper manobra e preservar o grupo');
  else if(s.time-m.at>100||s.time-m.since>(m.stage==='commit'?24:m.stage==='lure'?18:25))finish(mem,s,false,'Etapa sem resultado: retomar plano e procurar outro acesso');
  else{
   const [flanker,assault,cover]=gs,contact=fresh.find(e=>e.id===m.contact);
   if(m.kind==='ambush'){
    if(m.stage==='setup'&&dist(cover,m.cover)<95&&dist(assault,m.scout)<100){stage(mem,m,s,'lure');report(mem,m,s,cover.id,'emboscada-cobertura','Cobertura pronta. Recuem por aqui.',flanker.id,'recuo-isca','Recebido. Vamos recuar juntos.');}
    else if(m.stage==='lure'&&dist(flanker,m.bait)<90&&fresh.filter(e=>e.type==='rifle'||e.type==='cavalry').some(e=>dist(e,m.bait)<150&&d*(e.x-m.bait.x)>-40)&&dist(cover,m.cover)<120){stage(mem,m,s,'spring');report(mem,m,s,cover.id,'emboscada-cobertura','Entraram no acesso. Abram fogo!',assault.id,'fechar-emboscada','Vamos fechar o lado.');}
    else if(m.stage==='spring'&&s.time-m.since>=6&&fresh.some(e=>dist(e,m.bait)<220&&e.suppression>.8))finish(mem,s,true,'Emboscada conteve o avanço observado');
   }else if(contact&&dist(contact,m.target)>160)finish(mem,s,false,'Posição inimiga mudou: reconhecer o novo acesso',true);
   else if(!contact&&s.time-m.since>8)finish(mem,s,false,'Contato perdido: reconhecer novamente',true);
   else if(m.stage==='recon'&&dist(flanker,m.scout)<85&&safe(s,fresh,m.flank)&&flanker.members.some(u=>free(u,s)&&dist(u,m.flank)<(s.visibilityRange??550)&&(!s.clearSight||s.clearSight(u,m.flank)))){stage(mem,m,s,'fix');report(mem,m,s,flanker.id,'aguardar-flanco','Acesso lateral observado. Vou aguardar a cobertura.',cover.id,'fixar-posicao','Recebido. Estabelecendo a base de fogo.');}
   else if(m.stage==='fix'&&dist(cover,m.cover)<95&&s.time-m.since>=2&&(contact?.suppression>.5||s.smokeCover)){stage(mem,m,s,'flank');report(mem,m,s,cover.id,'fixar-posicao','Eles baixaram a cabeça. Avancem pelo lado!',flanker.id,'manobra-flanco','Indo pelo acesso reconhecido.');}
   else if(m.stage==='flank'&&op.phase==='advance'&&dist(flanker,m.flank)<85&&safe(s,fresh,m.flank)){stage(mem,m,s,'commit');report(mem,m,s,flanker.id,'assalto-coordenado','Chegamos ao flanco. O grupo principal pode avançar!',assault.id,'assalto-coordenado','Recebido. Avançando com cobertura.');}
   else if(m.stage==='commit'&&d*(flanker.x-m.target.x)>55&&d*(assault.x-m.target.x)>-35)finish(mem,s,true,'Flanco alcançado e assalto avançou sob cobertura');
  }
  m=mem.active;
 }
 if(!m&&s.time>=mem.cooldown&&(defender?op.phase==='hold':['prepare','advance'].includes(op.phase))){
  const candidates=groups.filter(g=>!excluded.has(g.id)&&!g.source.reserve&&ready(g,s));
  const infantry=candidates.filter(g=>g.kind==='infantry'),fires=candidates.filter(g=>g.kind==='fire');
  const habit=patterns?.habit;
  const target=defender&&habit?fresh.filter(e=>Math.abs(e.y-habit.y)<200&&d*(e.x-op.sector.front)>-120&&d*(e.x-op.sector.front)<400).sort((a,b)=>dist(a,habit)-dist(b,habit))[0]:!defender?fresh.filter(e=>e.type==='mg'&&Math.abs(e.y-op.sector.y)<350).sort((a,b)=>dist(a,op.sector)-dist(b,op.sector))[0]:null;
  if(target&&infantry.length>=2){
   const cover=fires.filter(g=>dist(g,target)<450).sort((a,b)=>dist(a,target)-dist(b,target))[0];
   const nearby=infantry.filter(g=>dist(g,target)<550).sort((a,b)=>dist(a,target)-dist(b,target));
   const threat=fresh.filter(e=>dist(e,target)<240).reduce((n,e)=>n+(e.type==='tank'?5:e.type==='mg'?2.5:1),0);
   if(cover&&nearby.length>=2&&nearby[0].strength+nearby[1].strength+cover.strength>=threat*.9){
    const choices=[-1,1].map(sign=>clamp(target.y+sign*190,45,(s.height||1600)-45)).map(y=>({y,point:{x:target.x-d*75,y}})).filter(p=>safe(s,fresh,p.point));
    choices.sort((a,b)=>dist(nearby[0],a.point)-dist(nearby[0],b.point));
    if(choices.length){
     m=begin(mem,s,defender?'ambush':'flank',[nearby[0],nearby[1],cover],target,choices[0].y);
     if(defender){m.cover={x:nearby[0].x-d*170,y:clamp(nearby[0].y+80,35,(s.height||1600)-35)};m.scout={x:m.bait.x-d*30,y:clamp(m.bait.y-110,35,(s.height||1600)-35)};}
    }
   }
  }
 }
 const orders=new Map();
 if(m){
  const set=(i,task,goal)=>orders.set(m.participants[i],{task,goal:{...goal},reason:`${m.kind==='ambush'?'Emboscada':'Manobra combinada'} · ${names[m.stage]}`,mission:`plano-${m.id}`});
  if(m.kind==='ambush'){
   set(0,m.stage==='setup'?'isca-em-posicao':m.stage==='lure'?'recuo-isca':'fechar-emboscada',m.stage==='setup'?m.origins[0]:m.stage==='lure'?m.bait:m.target);
   set(1,m.stage==='spring'?'fechar-emboscada':'preparar-emboscada',m.stage==='spring'?m.target:m.scout);
   set(2,m.stage==='setup'?'preparar-emboscada':'emboscada-cobertura',m.cover);
  }else{
   set(0,m.stage==='recon'?'sondar-flanco':m.stage==='fix'?'aguardar-flanco':m.stage==='flank'?'manobra-flanco':'assalto-coordenado',m.stage==='recon'||m.stage==='fix'?m.scout:m.stage==='flank'?m.flank:{x:m.target.x+d*100,y:m.side});
   set(1,m.stage==='commit'?'assalto-coordenado':'aguardar-apoio',m.stage==='commit'?{x:m.target.x+d*80,y:m.target.y}:m.origins[1]);
   set(2,'fixar-posicao',m.cover);
  }
 }
 return orders;
}
function snapshot(mem){const m=mem.active;return {note:mem.note,active:m?{id:m.id,kind:m.kind,stage:m.stage,label:names[m.stage],since:m.since,participants:[...m.participants],target:{...m.target},flank:{...m.flank}}:null,history:mem.history.map(h=>({...h}))}}
const api={create,update,snapshot,cancel:(mem,s)=>finish(mem,s,false,'Coordenação desligada',true)};root.IronFrontBattlePlans=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
