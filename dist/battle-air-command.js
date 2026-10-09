(function(){
'use strict';
const A=window.PXAW,P=window.IronFrontAirPolicy,B=window.IronFrontBrain;if(!A||!P||!B)return;
let ledger=[[],[]],next=[{},{}],waiting=[],events=[],acks=[],seen=new Set(),timer=0,reportAt=0,stats;
const live=a=>a&&!a.dead&&!a.gone;
const enabled=()=>A.on;
const grounded=()=>{const w=window.PXW?.state;return !!(w&&((w.cur==='storm'&&w.I>.9)||w.fog>.7))};
function reserve(t){const n=units.filter(u=>u.team===t&&u.hp>0&&!u.down&&!u.sap&&!u.med).length;
 return aiEnabled[t]?Math.max(n<18?160:100,window.IronFrontEngineering?.state(t)?.reserve||0):40}
function spent(t){ledger[t]=ledger[t].filter(e=>time-e.time<120);return ledger[t].reduce((s,e)=>s+e.cost,0)}
function budget(t){return Math.max(180,(typeof incomeFor==='function'?incomeFor(t):12)*120*.32)}
function canPay(t,c,manual=false){return sandbox||supplies[t]>=c+(manual?0:reserve(t))&&(manual||spent(t)+c<=budget(t))}
function pay(t,c,kind,manual=false){if(!canPay(t,c,manual))return false;if(!sandbox){supplies[t]-=c;ledger[t].push({time,cost:c,kind});stats.spent[t]+=c}return true}
function say(team,name,text,kind,plane=null,delay=0,flight=null){events.push({team,name,text,kind,plane,flight,time:time+delay,expires:time+delay+8});events=events.slice(-32)}
function service(a){const q=P.service(a);waiting.push({a,...q,at:time,pilot:a.pilot?.name||a.T.name});stats.quotes++;
 say(a.team,a.pilot?.name||a.T.name,q.repair?'Voltei com danos. Preciso dos mecânicos antes de sair de novo.':'Pousei. Vamos reabastecer e recarregar.','pouso',a);
 if(q.repair)say(a.team,'Mecânico',`Reparo do ${a.T.name}: ◈ ${q.repair}. Serviço completo: ◈ ${q.cost}.`,'manutenção',a,2)}
function request(team,kind,x,y,options={}){
 if(!enabled()||!started||ended||!Number.isFinite(x)||!Number.isFinite(y)||(team!==0&&team!==1)||grounded()||window.PXFORT?.isPrep?.())return null;
 if(A.planes().filter(a=>a.team===team&&live(a)&&a.st!=='park').length>=8)return null;
 if((kind==='atk'||kind==='bmb')&&!P.clear(units.filter(u=>u.team===team&&u.hp>0&&!u.down),x,y)){stats.unsafe++;if(options.manual)toast('Aliados próximos da área de ataque. Escolha um alvo mais afastado.');return null}
 const c=P.cost[kind];if(c===undefined||!canPay(team,c,options.manual))return null;
 const f=A.dispatch(team,kind,x,y,{n:options.n||({cap:2,int:2,esc:2,atk:2,bmb:1}[kind]||1),pick:options.pick});if(!f)return null;
 pay(team,c,'missão-'+kind,options.manual);next[team][kind]=time+P.cooldown[kind];stats.missions[kind]=(stats.missions[kind]||0)+1;
 f.commanded=true;f.reason=options.reason||A.names[kind];
 const p=f.m[0],sector=B.lastPlans[team]?.sectors?.find(s=>s.id===B.lastPlans[team]?.operation?.sector)?.name||'setor marcado';
 say(team,'Comandante',`${p.pilot.name}, ${f.reason.toLowerCase()} — ${sector}.`,'ordem',p,0,f);
 acks.push({at:time+2,team,p,f,text:`Entendido. ${A.names[kind]} em formação; retornamos se o avião não aguentar.`});
 if((kind==='bmb'||kind==='rec')&&!options.manual&&canPay(team,P.cost.esc)){
  const escort=A.dispatch(team,'esc',x,y,{n:2});if(escort){pay(team,P.cost.esc,'escolta');stats.missions.esc=(stats.missions.esc||0)+1;escort.commanded=true;say(team,escort.m[0].pilot.name,'Vou com vocês. Cuidamos da cauda.','escolta',escort.m[0],4,escort)}
 }
 return f;
}
function recon(){for(const a of A.planes()){
 if(!live(a)||!a.air||a.h<150||a.h>1400||!['rec','cap'].includes(a.flight?.kind)||a.flight?.phase==='home')continue;
 const r=grounded()?140:320,contacts=units.filter(u=>u.team!==a.team&&u.hp>0&&!u.down&&Math.hypot(u.x-a.x,u.y-a.y)<r).map(u=>({id:u.id,team:u.team,type:u.type,x:u.x,y:u.y,hp:u.hp,maxhp:u.maxhp,at:time,source:a.id,confidence:.9,air:true}));
 B.operations?.receiveAirReport?.(a.team,contacts,time);if(contacts.length&&!a.reported){a.reported=true;stats.reports+=contacts.length;say(a.team,a.pilot?.name||a.T.name,`Contato confirmado: ${contacts.some(u=>u.type==='tank')?'blindados':'tropas'} no setor. Passando as posições ao comando.`,'contato',a)}
 }}
function update(dt){if(!enabled()||!started||ended||!(dt>0))return;
 for(let t=0;t<2;t++)A.setAuto(t,false);
 for(const q of waiting.slice().sort((a,b)=>a.cost-b.cost)){
  if(!live(q.a)||!q.a.serviceWaiting){waiting.splice(waiting.indexOf(q),1);continue}
  if(pay(q.a.team,q.cost,'manutenção')){if(A.completeService(q.a,q.seconds)){stats.repairs++;stats.repairSpent[q.a.team]+=sandbox?0:q.cost;say(q.a.team,'Mecânico',`${q.a.T.name} em serviço. Pronto em ${q.seconds} s${sandbox?'':` · ◈ ${q.cost}`}.`,'reparo',q.a)}waiting.splice(waiting.indexOf(q),1)}
 }
 for(const e of acks.slice())if(time>=e.at){acks.splice(acks.indexOf(e),1);if(live(e.p)&&!e.f.done)say(e.team,e.p.pilot?.name||e.p.T.name,e.text,'resposta',e.p,0,e.f)}
 for(const f of A.flights()){
  if(f.phase==='home'&&!seen.has(f.id)){seen.add(f.id);const p=f.m.find(live);if(p)say(f.team,p.pilot?.name||p.T.name,p.dmg>0||p.engHp<p.T.eng?'Estamos danificados. Voltando para a pista; cubram nossa retirada.':'Missão encerrada. Voltando para rearmar.','retorno',p)}
  if(['atk','bmb'].includes(f.kind)&&f.phase==='work'){
   const own=units.filter(u=>u.team===f.team&&u.hp>0&&!u.down);
   if(!P.clear(own,f.area.x,f.area.y,190)){f.phase='home';stats.aborted++;const p=f.m.find(live);say(f.team,p?.pilot?.name||'Piloto','Aliados entraram no alvo. Abortando o ataque.','abortar',p)}
  }
 }
 if(time>=reportAt){reportAt=time+2;recon()}
 timer-=dt;if(timer>0)return;timer=2;
 for(let t=0;t<2;t++){
  if(!aiEnabled[t])continue;const plan=B.lastPlans[t];if(!plan)continue;
  const own=units.filter(u=>u.team===t&&u.hp>0&&!u.down),flights=A.flights().filter(f=>f.team===t&&!f.done);
  if(A.planes().filter(a=>a.team===t&&live(a)&&a.st!=='park').length>=8)continue;
  const intruder=A.planes().find(a=>a.team!==t&&live(a)&&a.air&&a.x>0&&a.x<W&&(t?a.x>A.front():a.x<A.front())&&own.some(u=>Math.hypot(u.x-a.x,u.y-a.y)<650));
  const maneuver=plan.strategy?.active,reconPoint=maneuver?.kind==='flank'&&['recon','fix'].includes(maneuver.stage)?maneuver.flank:null;
  const available=Object.fromEntries(Object.keys(P.cost).map(k=>[k,A.available?.(t,k)??true]));
  const item=P.choose({team:t,time,own,contacts:B.operations?.contacts(t)||[],front:A.front(),width:W,y:plan.operation?.y||H/2,phase:plan.operation?.phase,reconPoint,available,next:next[t],flights,intruder,grounded:grounded(),preparing:window.PXFORT?.isPrep?.()});
  if(item)request(t,item.kind,item.x,item.y,item);
 }
}
function reset(){A.cfg.MAXAIR=8;ledger=[[],[]];next=[{cap:10,rec:32,atk:65,bmb:100},{cap:10,rec:32,atk:65,bmb:100}];waiting=[];events=[];acks=[];seen.clear();timer=0;reportAt=0;stats={spent:[0,0],repairSpent:[0,0],quotes:0,repairs:0,replacements:[0,0],missions:{},reports:0,unsafe:0,aborted:0};for(let t=0;t<2;t++)A.setAuto(t,false)}
const order0=A.order;A.order=(team,kind,x,y)=>enabled()?!!request(team,kind,x,y,{manual:true,reason:A.names[kind]}):order0(team,kind,x,y);
A.service=service;
A.authorizeReplacement=(t,s)=>{if(!enabled())return true;const c=P.replacement(A.types[s.tk]);if(!pay(t,c,'reposição'))return false;stats.replacements[t]++;say(t,'Aeródromo',`${A.types[s.tk].name} de reposição recebido · ◈ ${sandbox?'∞':c}.`,'reposição');return true};
A.authorizePilot=t=>!enabled()||pay(t,40,'piloto');
const setup0=window.setup;window.setup=function(...args){const r=setup0.apply(this,args);reset();return r};
const update0=window.update;window.update=function(dt){const r=update0.call(this,dt);update(dt);return r};
const place0=window.place;window.place=function(x,y){const k={cap:'cap',fighter:'atk',atk:'atk',bomber:'bmb',spot:'rec',recon:'rec'}[placement];if(!enabled()||!k)return place0.call(this,x,y);
 const f=request(playerTeam,k,x,y,{manual:true,reason:A.names[k]});if(!f){toast(grounded()?'Sem condições de voo.':PXFORT?.isPrep?.()?'Aviação aguarda o início do combate.':'Missão indisponível: confira aviões prontos, aliados e suprimentos.');return}
 if(!keys.Shift){placement=null;makeCards();$('placehint').textContent='Escolha uma unidade e posicione no campo'}hud();return f};
// Every existing support card uses the same aircraft inventory and pays only on a real takeoff order.
const labels={cap:['Patrulha de caça','2 caças · defesa do setor'],fighter:['Ataque ao solo','2 aviões · rasante e bombas'],atk:['Ataque ao solo','2 aviões · rasante e bombas'],bomber:['Bombardeio','1 bombardeiro · concentração inimiga'],spot:['Reconhecimento','Observador · informa posições'],recon:['Reconhecimento','Observador · informa posições']};
const card0=window.makeCards;window.makeCards=function(...args){if(enabled())for(const [k,[name,sub]] of Object.entries(labels))if(defs[k])Object.assign(defs[k],{cost:P.cost[{fighter:'atk',bomber:'bmb',spot:'rec',recon:'rec'}[k]||k],name,sub});return card0.apply(this,args)};
const command={request,reset,update,grounded,events:()=>events.filter(e=>e.time<=time&&e.expires>time),waiting:()=>waiting.map(q=>({id:q.a.id,team:q.a.team,name:q.a.T.name,cost:q.cost,repair:q.repair,seconds:q.seconds})),state:()=>({on:enabled(),...stats,waiting:command.waiting(),budget:[budget(0),budget(1)],recent:[spent(0),spent(1)],events:events.map(({plane,flight,...e})=>e)})};
command.onStation=(team,x,y)=>enabled()&&A.planes().some(a=>live(a)&&a.team===team&&a.air&&a.flight?.kind==='rec'&&a.flight?.phase!=='home'&&Math.hypot(a.x-x,a.y-y)<300);
window.IronFrontAirCommand=command;window.IronFront.airCommand=command;reset();
})();
