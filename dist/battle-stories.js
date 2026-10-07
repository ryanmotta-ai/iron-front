/* Conversations relay reports consumed by battle plans and confirm actual orders. */
(function(root){
'use strict';
const names=[['Reyes','Miller','Lewis','Baker','Turner','Harris','Morgan','Brooks'],['Weber','Keller','Otto','Fischer','Kraus','Vogel','Becker','Hoffmann']];
const firstNames=[['James','Thomas','Henry','Arthur','Samuel','George','William','Charles'],['Karl','Emil','Friedrich','Paul','Heinrich','Ernst','Walter','Hans']];
const lines={
 'reorganização-local':['Respira. Vamos nos recompor.','Fica perto. Vamos sair dessa.'],
 'retirada-coberta':['Recuem por grupos. Eu cubro.','Não corram sozinhos. Recuem juntos.'],
 'flanco-apoiado':['A cobertura chegou. Vamos pelo lado!','Eles estão ocupados com nossa MG. Vamos!'],
 'fixar-flanquear':['Temos cobertura. Vamos contornar a MG.'],
 'apoio-solicitado':['Cubram o avanço deles!','Mantenham o fogo. Eles estão atravessando.'],
 'assalto-brecha':['A passagem está aberta. Vamos juntos!'],
 'preparar-brecha':['Juntem o grupo antes de atravessar.'],
 'conter-acesso':['Vamos fechar esse acesso.'],
 'contra-ataque':['Vamos recuperar o terreno. Fiquem juntos.'],
 'recuperar-objetivo':['A posição ainda pode ser recuperada!'],
 'patrulha-retornando':['Há muitos deles. Vamos informar o comando.'],
 'reabastecimento':['Poucas granadas. Vamos ao depósito.'],
 'ocupar-trincheira':['Ocupem a vala e protejam os acessos.'],
 'explorar-brecha':['A reserva vai avançar. Protejam nosso flanco.'],
 'consolidação':['Segurem a posição. Ainda podem voltar.']
};
function create(){return {serial:0,nextAt:0,groups:{},history:[],owned:null,reported:[]}}
function identity(team,id){return firstNames[team?1:0][Math.floor(Math.abs(id)/8)%8]+' '+names[team?1:0][Math.abs(id)%8]}
function update(mem,state,groups,orders,reports=[]){
 const time=state.time,byId=new Map(state.units.filter(u=>u.team===state.team&&u.hp>0&&!u.down).map(u=>[u.id,u]));
 const active=new Set(groups.map(g=>g.id));for(const id of Object.keys(mem.groups))if(!active.has(+id))delete mem.groups[id];
 const candidates=[];
 for(const report of reports){
  if(time-report.at>12||report.at>time||mem.reported.includes(report.id))continue;
  const g=groups.find(g=>g.id===report.squad),speaker=g?.members.find(u=>u.id===g.source.mind?.leader&&byId.has(u.id)&&u.id!==state.controlledId&&!(u.manualUntil>time)&&orders.some(o=>o.id===u.id&&o.role===report.task));
  if(speaker)candidates.push({g,speaker,kind:'relato-tatico',text:report.text,priority:4,report});
 }
 const owned=new Set((state.points||[]).filter(p=>p.owner===state.team).map(p=>p.name));
 const gained=mem.owned?new Set([...owned].filter(n=>!mem.owned.has(n))):new Set();mem.owned=owned;
 for(const g of groups){
  const mind=g.source.mind;if(!mind)continue;
  const speaker=g.members.find(u=>u.id===mind.leader&&byId.has(u.id)&&u.id!==state.controlledId&&!(u.manualUntil>time));
  if(!speaker)continue;
  const actual=orders.filter(o=>g.ids.includes(o.id));
  if(!actual.length)continue;
  const observed={leader:mind.leader,losses:mind.losses||0,state:mind.state,task:g.source.task};
  const previous=mem.groups[g.id];mem.groups[g.id]=observed;
  const won=[...gained].some(n=>(state.points||[]).some(p=>p.name===n&&Math.hypot(p.x-g.x,p.y-g.y)<220));
  if(won){mind.victories=(mind.victories||0)+1;mind.experience=Math.min(1,(mind.experience||0)+.12);mind.morale=Math.min(.98,mind.morale+.07)}
  if(!previous)continue;
  let kind=null,text=null,priority=0;
  if(previous.leader!==observed.leader){kind='liderança';text='Eu assumo. Fiquem comigo.';priority=5}
  else if(observed.losses>previous.losses){kind='perdas';text='Perdemos companheiros. Mantenham o grupo unido.';priority=4}
  else if(won){kind='conquista';text='Conseguimos. Agora protejam os que chegaram.';priority=4}
  else if(observed.task!==previous.task&&lines[observed.task]&&actual.some(o=>o.role===observed.task)){kind=observed.task;const choices=lines[kind];text=choices[(g.id+mem.serial)%choices.length];priority=2}
  else if(previous.state==='reorganizando'&&observed.state==='confiante'){kind='recuperação';text='Obrigado por esperar. Estamos prontos de novo.';priority=3}
  if(kind&&time-(mind.lastStoryAt??-100)>22)candidates.push({g,speaker,kind,text,priority});
 }
 if(time<mem.nextAt||!candidates.length)return mem.history.filter(e=>time-e.time<16).map(e=>({...e}));
 candidates.sort((a,b)=>b.priority-a.priority||a.g.id-b.g.id);
 const c=candidates[0];c.g.source.mind.lastStoryAt=time;
 function emit(u,text,kind,at,g=c.g,task=g.source.task){mem.history.push({id:++mem.serial,time:at,expires:at+7,team:state.team,squad:g.id,speaker:u.id,name:identity(state.team,u.id),kind,text,task})}
 emit(c.speaker,c.text,c.kind,time);
 if(c.report){
  mem.reported.push(c.report.id);mem.reported=mem.reported.slice(-24);
  const other=groups.find(g=>g.id===c.report.answerSquad),reply=other?.members.find(u=>u.id===other.source.mind?.leader&&byId.has(u.id)&&u.id!==state.controlledId&&!(u.manualUntil>time)&&orders.some(o=>o.id===u.id&&o.role===c.report.answerTask));
  if(reply&&c.report.answer)emit(reply,c.report.answer,'resposta',time+2,other,c.report.answerTask);
 }
 // A reply only comes from a second participant executing the same real task nearby.
 if(['flanco-apoiado','assalto-brecha','retirada-coberta','ocupar-trincheira'].includes(c.kind)){
  const reply=c.g.members.find(u=>u.id!==c.speaker.id&&byId.has(u.id)&&u.id!==state.controlledId&&!(u.manualUntil>time)&&Math.hypot(u.x-c.speaker.x,u.y-c.speaker.y)<120&&orders.some(o=>o.id===u.id&&o.role===c.kind));
  if(reply)emit(reply,c.kind==='retirada-coberta'?'Estou com vocês. Indo para trás.':'Estou com você. Vamos juntos.', 'resposta',time+2.5);
 }
 mem.history=mem.history.slice(-24);mem.nextAt=time+9;
 return mem.history.filter(e=>time-e.time<16).map(e=>({...e}));
}
const api={create,update,identity};root.IronFrontStories=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
