/* Operations coordinate squads; individual reactions remain in ai.js/game.js.
   Only observed enemies enter the short-lived intelligence map. */
(function(root){
'use strict';
const Brain=root.IronFrontBrain||(typeof require==='function'?require('./ai.js'):null);
if(!Brain)return;
const Learning=root.IronFrontLearning||(typeof require==='function'?require('./learning.js'):null);
const Formation=root.IronFrontFormations||(typeof require==='function'?require('./formations.js'):null);
const Squads=root.IronFrontSquads||(typeof require==='function'?require('./squad-mind.js'):null);
const Intelligence=root.IronFrontIntelligence||(typeof require==='function'?require('./intelligence.js'):null);
const legacy=Brain.plan, memories=[null,null], dir=[1,-1], home=[350,2050];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=u=>u.hp>0&&!u.down;
const power=u=>u.cls==='medic'?0:u.type==='tank'?5:u.type==='mg'?2.5:u.type==='cavalry'?1.2:1;
const available=(u,state)=>alive(u)&&u.cls!=='medic'&&!u.rs&&u.manualUntil<=state.time&&!u.pinned&&!u.sapJob&&u.id!==state.controlledId;
const effective=(u,state)=>available(u,state)?power(u)*u.hp/u.maxhp*Math.max(.65,1-(u.suppression||0)*.18):0;
function cohortRetention(op,state){
 if(!op.cohort?.length)return 1;const own=new Map(state.units.filter(u=>u.team===state.team).map(u=>[u.id,u]));let n=0,sum=0;
 for(const before of op.cohort){const u=own.get(before.id);if(u&&(u.id===state.controlledId||u.manualUntil>state.time&&![u.pinStamp,u.sapStamp,u.postStamp,u.depStamp].includes(u.manualUntil)))continue;
  n++;sum+=u&&alive(u)?Math.min(1,u.hp/before.hp):0}
 return n?sum/n:1;
}
const phases={recon:'Reconhecendo acesso',muster:'Reunindo força',prepare:'Preparando fogo e passagem',advance:'Avançando por cobertura',consolidate:'Consolidando conquista',withdraw:'Reorganizando ataque',hold:'Defendendo acessos',counter:'Fechando brecha'};
const attackPace={recon:5,prepare:6,musterTimeout:45,prepareTimeout:28,recover:12,secure:10};
function reset(team){if(team===undefined)memories.fill(null);else memories[team]=null}
function memory(team,time){
 let m=memories[team];
 if(!m||time<m.time)m=memories[team]={time,seen:new Map(),pending:new Map(),owned:new Set(),squads:[],next:1,fail:[0,0,0,0,0],operation:null,events:[],serial:0,learning:Learning.create()};
 const dt=Math.max(0,time-m.time);m.time=time;
 for(let i=0;i<5;i++)m.fail[i]=Math.max(0,m.fail[i]-dt/240);
 return m;
}
function observe(state,m){
 const own=state.units.filter(u=>u.team===state.team&&alive(u));
 if(Intelligence&&state.humanAI!==false){const enemies=Intelligence.observe(state,own,m.seen,m.pending,state.clearSight);return {own,enemies}}
 const range=state.visibilityRange;
 for(const u of state.units){
  if(u.team===state.team)continue;
  const visible=!Number.isFinite(range)||own.some(f=>distance(f,u)<=range);
  if(!visible)continue;
  if(!alive(u)){m.seen.delete(u.id);continue}
  m.seen.set(u.id,{id:u.id,team:u.team,type:u.type,x:u.x,y:u.y,hp:u.hp,maxhp:u.maxhp,at:state.time,suppression:u.suppression||0});
 }
 for(const [id,e] of m.seen)if(state.time-e.at>35)m.seen.delete(id);
 return {own,enemies:[...m.seen.values()]};
}
function squads(state,m,own){
 const free=own.filter(u=>!u.sap&&!u.sapJob&&!u.rs&&u.cls!=='medic'&&['rifle','mg','tank','cavalry'].includes(u.type));
 const byId=new Map(free.map(u=>[u.id,u])),used=new Set();
 for(const s of m.squads){s.ids=s.ids.filter(id=>byId.has(id));for(const id of s.ids)used.add(id)}
 m.squads=m.squads.filter(s=>s.ids.length);
 for(const u of free.filter(u=>!used.has(u.id)).sort((a,b)=>a.y-b.y||a.id-b.id)){
  const kind=u.type==='tank'?'armor':u.type==='cavalry'?'scout':u.type==='mg'?'fire':'infantry';
  let best=null,bd=Infinity;
  for(const s of m.squads){if(s.kind!==kind||s.ids.length>=(kind==='armor'?1:kind==='fire'?3:8))continue;
   const anchor=byId.get(s.ids[0]),d=anchor?distance(anchor,u):Infinity;if(d<bd&&d<240){bd=d;best=s}}
  if(!best){best={id:m.next++,kind,ids:[],task:'',sector:clamp(Math.floor(u.y/320),0,4)};m.squads.push(best)}
  best.ids.push(u.id);
 }
 return m.squads.map(s=>{
  const members=s.ids.map(id=>byId.get(id)),n=members.length;
  const mind=Squads&&state.humanAI!==false?Squads.update(s,members,state):null;
  return {...s,source:s,members,x:members.reduce((v,u)=>v+u.x,0)/n,y:members.reduce((v,u)=>v+u.y,0)/n,
   strength:members.reduce((v,u)=>v+power(u)*u.hp/u.maxhp,0)*(mind?1-mind.fatigue*.08:1),pressure:members.reduce((v,u)=>v+(u.suppression||0),0)/n};
 });
}
function sectors(state,own,enemies,m){
 return Array.from({length:5},(_,i)=>{
  const y=160+i*320,points=state.points||[],target=points.filter(p=>p.owner!==state.team).sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y))[0];
  const friendly=points.filter(p=>p.owner===state.team).sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y))[0];
  const trenches=(state.trenches||[]).filter(t=>t.team===state.team&&t.hp>0&&Math.abs(t.y-y)<220&&t.line!=='comm');
  const front=trenches.length?trenches.reduce((v,t)=>dir[state.team]*(t.x-v)>0?t.x:v,trenches[0].x):home[state.team]+dir[state.team]*420;
  const x=target?.x??friendly?.x??1200;
  const local=enemies.filter(e=>Math.abs(e.y-y)<240),known=local.filter(e=>state.time-e.at<12);
  const threat=local.reduce((v,e)=>v+power(e)*(state.time-e.at<12?1:.45),0);
  const force=own.filter(u=>Math.abs(u.y-y)<200).reduce((v,u)=>v+power(u)*u.hp/u.maxhp,0);
  const invasion=known.filter(e=>dir[state.team]*(e.x-front)<60);
  return {id:i,name:['extremo norte','norte','centro','sul','extremo sul'][i],x,y,front,target,friendly,threat,force,
   invasion:invasion.reduce((v,e)=>v+power(e),0),contact:invasion[0]||null,
   score:(target?10:0)+Math.min(force,20)*.12-threat*.65-m.fail[i]*5-Math.abs(x-home[state.team])/900-(i===0||i===4?1:0)
    +Math.min(1,m.learning.sectors[i].successes*.2)-Learning.risk(m.learning,x,y)*.6};
 });
}
function event(m,op,state){
 const label=phases[op.phase]+' · '+op.sector.name;
 if(m.events.at(-1)?.text===label)return;
 m.events.push({id:++m.serial,time:state.time,text:label});if(m.events.length>8)m.events.shift();
}
function transition(m,op,phase,state){
 if(phase==='withdraw')Learning.finish(m.learning,op,state,false);
 if(phase==='recon')op.failureReason=null;
 if(phase==='recon'||phase==='prepare')op.style=Learning.select(m.learning,op.sector.id,state,[...m.seen.values()]);
 if(phase==='hold'&&Brain.getRoles()[state.team]==='defend')op.style.label='Defesa adaptativa';
 op.phase=phase;op.since=state.time;event(m,op,state);
}
function operation(state,m,ss,groups,own){
 const role=Brain.getRoles()[state.team],defender=role==='defend';
 let op=m.operation;
 const threatened=ss.filter(s=>s.invasion>0).sort((a,b)=>b.invasion-a.invasion)[0];
 if(!op){const sector=defender?(threatened||ss[2]):ss.filter(s=>s.target).sort((a,b)=>b.score-a.score)[0]||ss[2];
  op=m.operation={phase:defender?'hold':'recon',since:state.time,sector,objective:sector.target?.name,start:own.length,peak:own.length,lastProgress:state.time,best:Infinity,smokeAt:-Infinity,smokeUntil:0,smokeReady:false,counterUntil:0,
   style:Learning.select(m.learning,sector.id,state,[...m.seen.values()])};event(m,op,state)}
 if(defender&&op.phase==='hold')op.style.label='Defesa adaptativa';
 op.sector=ss[op.sector.id];
 if(defender){
  if(op.phase==='hold'&&!threatened&&state.time>=(op.counterReady||0)){
   const lost=(state.points||[]).filter(p=>m.owned.has(p.name)&&p.owner!==state.team&&dir[state.team]*(p.x-1200)<0).sort((a,b)=>Math.abs(a.x-home[state.team])-Math.abs(b.x-home[state.team]))[0];
   if(lost){const sector=ss.slice().sort((a,b)=>Math.abs(a.y-lost.y)-Math.abs(b.y-lost.y))[0],near=groups.filter(g=>Math.abs(g.y-lost.y)<300),force=near.reduce((n,g)=>n+g.members.reduce((v,u)=>v+effective(u,state),0),0);
    const threat=[...m.seen.values()].filter(e=>state.time-e.at<12&&distance(e,lost)<260).reduce((n,e)=>n+power(e),0);
    if(Math.abs(lost.x-sector.front)<320&&force>=Math.max(6,threat*1.3)){op.sector=sector;op.objective=lost.name;op.recapture=true;op.counterUntil=state.time+30;op.style={name:'balanced',label:'Recuperando posição próxima'};transition(m,op,'counter',state);op.pendingTrial='counter'}
   }
  }
  if(threatened&&op.phase!=='counter'){op.sector=threatened;
   const local=groups.filter(g=>Math.abs(g.y-threatened.y)<400),force=local.reduce((v,g)=>v+g.members.reduce((n,u)=>n+effective(u,state),0),0);
   const tired=threatened.contact&&threatened.contact.suppression>.8;
   const experience=m.learning.sectors[threatened.id].styles.balanced;
   const required=(tired?1.05:1.45)+(experience.trials&&experience.reward<0?.25:0);
   if(state.time>=(op.counterReady||0)&&force>threatened.invasion*required&&force>=6){op.counterUntil=state.time+35;op.style={name:'balanced',label:'Contra-ataque local'};transition(m,op,'counter',state);
    op.pendingTrial='counter'}}
  const recovered=op.recapture&&state.points.find(p=>p.name===op.objective)?.owner===state.team;
  if(op.phase==='counter'&&(state.time>op.counterUntil||(op.recapture?recovered:!op.sector.invasion)||op.sector.force<op.sector.invasion*.8)){
   Learning.finish(m.learning,op,state,op.recapture?recovered:!op.sector.invasion);op.recapture=false;op.counterReady=state.time+12;transition(m,op,'hold',state)}
  return op;
 }
 const s=op.sector,age=state.time-op.since;
 const assault=groups.filter(g=>g.kind==='infantry'||g.kind==='armor'),local=assault.filter(g=>Math.abs(g.y-s.y)<350);
 const ready=local.filter(g=>g.members.some(u=>available(u,state)));
 const force=ready.reduce((v,g)=>v+g.members.reduce((n,u)=>n+effective(u,state),0),0),pressure=local.length?local.reduce((v,g)=>v+g.pressure,0)/local.length:0;
 op.smokeReady=!!state.smokeCover;
 op.peak=Math.max(op.peak,own.length);
 const forward=op.phase==='advance'||op.phase==='consolidate'?own.filter(u=>op.fighting?.includes(u.id)):local.flatMap(g=>g.members);
 const d=forward.length?forward.reduce((v,u)=>v+Math.hypot(u.x-s.x,u.y-s.y),0)/forward.length:Infinity;
 if(d<op.best-35){op.best=d;op.lastProgress=state.time}
 const captured=op.objective&&state.points.find(p=>p.name===op.objective)?.owner===state.team;
 if(captured&&['advance','consolidate'].includes(op.phase))Learning.finish(m.learning,op,state,true);
 const close=own.filter(u=>Math.abs(u.y-s.y)<240&&Math.abs(u.x-s.x)<170).length;
 if(op.phase==='advance'&&(captured||close>=Math.max(3,s.threat*1.4)&&d<150))transition(m,op,'consolidate',state);
 else if(op.phase==='advance'&&(cohortRetention(op,state)<.65||pressure>1.3||state.time-op.lastProgress>55)){
  op.failureReason=cohortRetention(op,state)<.65?'perdas':pressure>1.3?'supressao':'pouco-progresso';
  m.fail[s.id]+=1;transition(m,op,'withdraw',state);
 }else if(op.phase==='recon'&&age>=attackPace.recon)transition(m,op,'muster',state);
 else if(op.phase==='muster'&&force>=Math.max(4,s.threat*(1.1+(op.style.caution||0)*.25))&&local.some(g=>Math.abs(g.x-s.front)<230)&&pressure<.75)transition(m,op,'prepare',state);
 else if(op.phase==='muster'&&age>attackPace.musterTimeout){m.fail[s.id]+=.4;transition(m,op,'withdraw',state)}
 else if(op.phase==='prepare'&&age>=attackPace.prepare&&pressure<.9&&force>=Math.max(4,s.threat*(.95+(op.style.caution||0)*.25))){
  const support=groups.some(g=>g.kind==='fire'&&Math.abs(g.y-s.y)<380&&Math.abs(g.x-s.front)<300);
  if(s.threat<4||support||op.smokeReady){op.start=own.length;op.fighting=ready.flatMap(g=>g.ids);op.best=d;op.lastProgress=state.time;transition(m,op,'advance',state);op.pendingTrial='attack'}
  else if(age>attackPace.prepareTimeout){m.fail[s.id]+=.4;transition(m,op,'withdraw',state)}
 }else if(op.phase==='prepare'&&age>attackPace.prepareTimeout){m.fail[s.id]+=.4;transition(m,op,'withdraw',state)}
 else if(op.phase==='consolidate'&&age>75&&!captured){m.fail[s.id]+=1;transition(m,op,'withdraw',state)}
 else if(op.phase==='consolidate'&&age>attackPace.secure&&captured||op.phase==='withdraw'&&age>attackPace.recover){
  const next=ss.filter(s=>s.target).sort((a,b)=>b.score-a.score)[0];
  if(next){op.sector=next;op.objective=next.target?.name;op.best=Infinity;op.start=own.length;op.smokeReady=false;op.smokeUntil=0;transition(m,op,'recon',state)}
  else transition(m,op,'hold',state);
 }else if(op.phase==='hold'&&ss.some(s=>s.target)){op.sector=ss.filter(s=>s.target).sort((a,b)=>b.score-a.score)[0];op.objective=op.sector.target?.name;transition(m,op,'recon',state)}
 return op;
}
function riskAt(state,enemies,x,y,type){
 let risk=0;
 for(const e of enemies){const d=Math.hypot(x-e.x,y-e.y);if(d>380)continue;
  risk+=Math.max(0,1-d/(e.type==='mg'?360:260))*(e.type==='mg'?6:e.type==='tank'?4:1)*(state.time-e.at<12?1:.4)}
 for(const b of state.buildings||[]){if(b.hp<=0)continue;const d=Math.hypot(x-b.x,y-b.y);
  if(b.type==='wire'&&b.team!==state.team&&d<65)risk+=type==='tank'?1:6;
  if(b.team===state.team&&b.type!=='wire'&&d<55)risk-=.7}
 for(const s of state.shells||[])if(s.t>0&&s.t<5&&s.kind!=='smoke'&&Math.hypot(x-s.x,y-s.y)<(s.r||65)+40)risk+=12;
 for(const u of state.units)if(u.team===state.team&&alive(u)&&Math.hypot(x-u.x,y-u.y)<35)risk+=.12;
 for(const t of state.trenches||[])if(t.hp>0&&t.team===state.team&&Math.abs(x-t.x)<(t.hw||45)&&Math.abs(y-t.y)<(t.hh||22)){risk-=1;break}
 if(state.terrainRisk)risk+=Math.max(0,state.terrainRisk(x,y,type)||0);
 if(state.learnedRisk)risk+=state.learnedRisk(x,y);
 return Math.max(0,risk);
}
function route(state,enemies,start,goal,type){
 const d=distance(start,goal);if(d<55)return goal;
 const reach=Math.min(d,190),dx=(goal.x-start.x)/d,dy=(goal.y-start.y)/d;
 let best=null,score=Infinity;
 for(const offset of [0,-70,70,-140,140]){
  const p={x:clamp(start.x+dx*reach-dy*offset,25,2375),y:clamp(start.y+dy*reach+dx*offset,25,1575)};
  let cost=distance(p,goal)*.025+Math.abs(offset)*.012;
  for(const t of [.33,.66,1])cost+=riskAt(state,enemies,start.x+(p.x-start.x)*t,start.y+(p.y-start.y)*t,type);
  if(cost<score){score=cost;best=p}
 }
 return best;
}
function position(state,s,unit,line,used){
 const d=dir[state.team],wanted=s.front-d*(line==='rear'?180:line==='support'?95:0);
 let best=null,score=Infinity;
 for(const slot of state.formationSlots){const t=slot.trench;
  if(line==='rear'&&d*(t.x-s.front)>-100)continue;
  const p=slot;if(used.has(p.key))continue;
   const cost=Math.abs(p.y-s.y)*1.4+Math.abs(p.x-wanted)*1.2+distance(unit,p)*.15-(unit.aiSlot===p.key?35:0);
   if(cost<score){score=cost;best=p}
 }
 if(best&&Math.abs(best.y-s.y)<300){used.add(best.key);return best}
 const prefix=`overflow:${s.id}:${line}:`,index=[...used].filter(k=>k.startsWith(prefix)).length;used.add(prefix+index);
 return {x:wanted-d*Math.floor(index/13)*24,y:clamp(s.y+(index%13-6)*24,30,1570)};
}
function orders(state,m,op,ss,groups,enemies,legacyOrders){
 const result=[],used=new Set(),d=dir[state.team],byId=new Map(legacyOrders.map(o=>[o.id,o]));
 state.formationSlots=Formation.slots(state.trenches||[],state.team);
 for(const u of state.units.filter(u=>u.team===state.team&&alive(u)&&(u.manualUntil>state.time||u.pinned||u.id===state.controlledId)))for(const p of state.formationSlots)if(distance(u,p)<18)used.add(p.key);
 const defender=Brain.getRoles()[state.team]==='defend';
 const emergencies=new Set(['recuo','retirada-trincheira','fixado','reorganização','socorro']);
 const infantry=groups.filter(g=>g.kind==='infantry'),caution=op.style?.caution||0,reserveCount=Math.max(1,Math.floor(infantry.length*((defender?.22:.16)+caution*.2)));
 const reserves=infantry.filter(g=>g.source.reserve).slice(0,reserveCount);
 for(const g of infantry.slice().sort((a,b)=>d*(a.x-b.x)))if(reserves.length<reserveCount&&!reserves.includes(g))reserves.push(g);
 const reserve=new Set(reserves.map(g=>g.id));for(const g of infantry)g.source.reserve=reserve.has(g.id);
 const secondary=ss.filter(s=>s.id!==op.sector.id&&s.target).sort((a,b)=>b.score-a.score)[0]||op.sector;
 const anticipated=ss.filter(s=>m.learning.sectors[s.id].exposure>=20).sort((a,b)=>m.learning.sectors[b.id].pressure-m.learning.sectors[a.id].pressure)[0];
 for(const g of groups){
  let s=op.sector,task='assalto';
  const breach=ss.filter(s=>s.invasion>0).sort((a,b)=>b.invasion-a.invasion)[0];
  if(defender){s=ss[clamp(Math.floor(g.y/320),0,4)];task=g.kind==='fire'?'fogo-cruzado':'posição-defensiva';
   if(reserve.has(g.id)){task='reserva-movel';s=breach||(anticipated&&m.learning.sectors[anticipated.id].pressure>2?anticipated:s)}
   if(g.kind==='fire'&&anticipated&&g.id%3===0&&Math.abs(g.y-anticipated.y)<650&&m.learning.sectors[anticipated.id].pressure>4)s=anticipated;
   if(op.phase==='counter'&&Math.abs(g.y-op.sector.y)<420&&(reserve.has(g.id)||g.kind==='armor'||op.recapture&&g.kind==='infantry'&&g.id%3===0)){s=op.sector;task=op.recapture?'recuperar-objetivo':'contra-ataque'}
   else if(s.invasion>s.force*1.25&&s.invasion>=4)task='retirada-coberta';
   if(task==='posição-defensiva'&&g.kind==='infantry'&&g.id%3===0&&s.friendly&&Math.abs(s.friendly.y-s.y)<240&&Math.abs(s.friendly.x-s.front)<350)task='guarda-objetivo';
  }else if(reserve.has(g.id)&&infantry.length>1){task=breach?'reforço-defensivo':'reserva-movel';if(breach)s=breach}
  else if(g.kind==='scout'){s=secondary;task='reconhecimento'}
  else if(g.kind==='fire')task='base-de-fogo';
  else if(g.id%4===0&&infantry.length>=4){s=secondary;task='pressão-secundária'}
  else if(op.phase==='recon'||op.phase==='muster')task='reagrupamento';
  else if(op.phase==='prepare')task=g.kind==='armor'?'abrindo-passagem':'base-de-assalto';
  else if(op.phase==='withdraw')task='retirada-coberta';
  else if(op.phase==='consolidate')task='consolidação';
  else if(op.phase==='hold')task='posição-defensiva';
  else task=g.kind==='armor'?'ruptura':'avanço-alternado';
  const armor=groups.filter(a=>a.kind==='armor'&&(a.members[0].atr?.bog||0)<=state.time&&Math.abs(a.y-s.y)<300).sort((a,b)=>distance(g,a)-distance(g,b))[0];
  if(task==='avanço-alternado'&&armor&&g.id%3===0&&distance(g,armor)<300)task='escolta';
  g.source.task=task;g.source.sector=s.id;
  let goal={x:s.x,y:s.y};
  if(task==='guarda-objetivo')goal={x:s.friendly.x-d*35,y:s.friendly.y+(g.id%5-2)*26};
  if(task==='recuperar-objetivo'){const point=state.points.find(p=>p.name===op.objective);if(point)goal={x:point.x,y:point.y+(g.id%3-1)*24}}
  if(task==='reserva-movel'||task==='retirada-coberta')goal={x:s.front-d*180,y:s.y};
  else if(task==='reforço-defensivo')goal={x:s.front-d*40,y:s.y};
  else if(task==='reagrupamento'||task==='base-de-assalto')goal={x:s.front-d*45,y:s.y};
  else if(task==='base-de-fogo'||task==='pressão-secundária'){
   const forward=op.phase==='advance'?Math.max(0,...infantry.filter(a=>!reserve.has(a.id)&&Math.abs(a.y-s.y)<300).map(a=>d*(a.x-s.front)-85)):0;
   goal={x:s.front+d*Math.min(Math.max(110,forward),Math.max(0,d*(s.x-s.front)-200)),y:s.y+(g.id%2?90:-90)};
  }
  else if(task==='reconhecimento')goal={x:s.front+d*150,y:s.y};
  else if(task==='abrindo-passagem')goal={x:s.front+d*150,y:s.y};
  else if(task==='contra-ataque')goal={x:clamp(s.contact?.x??s.front,Math.min(home[state.team],s.front),Math.max(home[state.team],s.front)),y:s.contact?.y??s.y};
  else if(task==='escolta')goal={x:armor.x-d*55,y:armor.y+(g.id%2?45:-45)};
  else if(task==='consolidação'){const captured=state.points.find(p=>p.name===op.objective);goal=captured?{x:captured.x-d*25,y:captured.y}:goal}
  if(task==='avanço-alternado'||task==='ruptura')goal.y=clamp(goal.y+(g.id%3-1)*85,35,1565);
  if(task==='avanço-alternado'&&op.style.name==='flank'){
   const side=g.id%2?1:-1,flankY=clamp(s.y+side*210,40,1560);
   if(Math.abs(g.y-flankY)>65&&Math.abs(g.x-s.x)>130){goal.x=s.x-d*175;goal.y=flankY;task='flanqueamento-coordenado'}
  }
  if(task==='avanço-alternado'&&op.style.name==='armor'&&armor){goal={x:armor.x-d*65,y:armor.y+(g.id%2?50:-50)};task='escolta'}
  if(task==='avanço-alternado'&&op.style.name==='infiltrate'){
   const cover=(state.trenches||[]).filter(t=>t.hp>0&&d*(t.x-g.x)>30&&distance(t,goal)<distance(g,goal)&&distance(t,g)<220).sort((a,b)=>distance(g,a)-distance(g,b))[0];
   if(cover)goal={x:cover.x,y:cover.y};task='infiltração';
  }
  g.source.task=task;
  let reason=task;
  if(Squads&&state.humanAI!==false){
   const support=groups.some(a=>a.kind==='fire'&&distance(a,g)<420&&a.pressure<.9);
   const tactical=Squads.maneuver(g.source,g,state,task,goal,enemies,support,s.front);task=tactical.task;goal=tactical.goal;reason=tactical.reason||task;
   const supplies=(state.supplyPosts||[]).filter(p=>p.team===state.team&&p.stock>0&&distance(p,g)<260&&!enemies.some(e=>state.time-e.at<12&&distance(e,p)<200));
   if(!tactical.recover&&!['retirada-coberta','reforço-defensivo','guarnição','reorganização-local'].includes(task)&&g.kind==='infantry'&&g.id%4===0&&g.members.filter(u=>u.gren===0).length>=Math.max(2,g.members.length*.6)&&supplies.length&&g.pressure<.6){task='reabastecimento';const post=supplies.sort((a,b)=>distance(g,a)-distance(g,b))[0];goal={x:post.x,y:post.y};reason='Repondo granadas e reorganizando equipe'}
   const stable=Squads.intent(g.source,task,goal,state,reason,['retirada-coberta','reorganização-local','reforço-defensivo'].includes(task));task=stable.task;goal=stable.goal;
   g.source.task=task;
  }
  // Separate squad rendezvous and lanes before arranging individual members.
  if(['reagrupamento','base-de-assalto','consolidação','base-de-fogo','pressão-secundária'].includes(task)){
   goal.y=clamp(goal.y+(g.id%5-2)*42,35,1565);goal.x-=d*(Math.floor(g.id/5)%3)*28;
  }else if(['avanço-alternado','flanqueamento-coordenado','infiltração','reconhecimento'].includes(task))goal.y=clamp(goal.y+(Math.floor(g.id/3)%3-1)*24,35,1565);
  const contact=s.threat>=2||enemies.some(e=>state.time-e.at<12&&distance(e,g)<380);
  const reaction=g.source.mind?.profile==='prudente'?1:g.source.mind?.profile==='impetuoso'?-1:0;
  const bounding=contact&&['avanço-alternado','flanqueamento-coordenado','infiltração','fixar-flanquear','limpeza-trincheira'].includes(task)&&Math.floor((state.time-op.since+reaction)/(op.style.name==='infiltrate'?9:6))%3===g.id%3;
  const anchor=route(state,enemies,g,goal,g.members[0].type);
  const narrow=state.terrainRisk&&[-35,35].some(offset=>state.terrainRisk(anchor.x,anchor.y+offset,g.members[0].type)>3);
  const preferred=g.pressure>.35?'dispersed':g.kind==='fire'||task==='escolta'?'line':'wedge';
  const formation=Formation.select(g.source.formationLearning||(g.source.formationLearning={}),g.members.filter(u=>u.id!==state.controlledId),state.time,goal,preferred,narrow);
  const slots=g.source.memberSlots||(g.source.memberSlots={});
  for(const id of Object.keys(slots))if(!g.members.some(u=>String(u.id)===id))delete slots[id];
  for(const member of g.members)if(slots[member.id]===undefined){let next=0;while(Object.values(slots).includes(next))next++;slots[member.id]=next}
  for(let i=0;i<g.members.length;i++){
   const u=g.members[i],old=byId.get(u.id);
   if(u.manualUntil>state.time||u.dodgeUntil>state.time||u.pinned||u.id===state.controlledId)continue;
   if(old&&emergencies.has(old.role)){result.push({...old,squad:g.id,sector:s.id});continue}
   let p=anchor,role=task;
   if(task==='posição-defensiva'||task==='fogo-cruzado'||task==='reserva-movel'||task==='retirada-coberta'||task==='reorganização-local'||task==='reforço-defensivo')p=position(state,s,u,['reserva-movel','retirada-coberta','reorganização-local'].includes(task)?'rear':g.kind==='fire'?'front':'support',used);
   else if(task==='patrulha-retornando')p=Formation.point(anchor,g,slots[u.id],g.members.length,'column');
   else if(bounding){p={x:u.x,y:u.y};role='cobrindo-avanco'}
   else if(distance(u,g)>150){p=route(state,enemies,u,g,u.type);role='reunindo-esquadrao'}
   else p=Formation.point(anchor,g,slots[u.id],Math.max(...Object.values(slots))+1,formation);
   if(task==='contra-ataque')p={...p,x:clamp(p.x,Math.min(home[state.team],s.front),Math.max(home[state.team],s.front))};
   if(g.kind==='armor'&&(u.atr?.bog>state.time||u.pv?.stun>0)){p={x:u.x,y:u.y};role='blindado-imobilizado'}
   if(task==='retirada-coberta'&&contact&&i%3===Math.floor(state.time/4)%3&&(u.suppression||0)<.9){p={x:u.x,y:u.y};role='cobrindo-retirada'}
   result.push({id:u.id,tx:clamp(p.x,20,2380),ty:clamp(p.y,20,1580),role,squad:g.id,sector:s.id,formation:p.key?'trench':formation,slot:p.key||null,reason,morale:g.source.mind?.morale,leader:g.source.mind?.leader===u.id,state:g.source.mind?.state});
  }
 }
 return result;
}
function plan(state){
 state={...state,supplies:Math.max(0,state.supplies-(state.infrastructureReserve||0))};
 const m=memory(state.team,state.time||0),intel=observe(state,m);
 for(const p of state.points||[])if(p.owner===state.team)m.owned.add(p.name);
 Learning.update(state,intel.own,intel.enemies,m.learning);
 state={...state,learnedRisk:(x,y)=>Learning.risk(m.learning,x,y)};
 const groups=squads(state,m,intel.own),ss=sectors(state,intel.own,intel.enemies,m);
 const observed={...state,units:[...intel.own,...intel.enemies.filter(e=>state.time-e.at<12)]};
 const base=legacy({...observed,reactionsOnly:true,supportReady:false}),op=operation(state,m,ss,groups,intel.own);
 const coordinated=orders(state,m,op,ss,groups,intel.enemies,base.orders);
 if(op.pendingTrial){
  const participating=new Set(op.pendingTrial==='counter'?['contra-ataque','recuperar-objetivo']:['avanço-alternado','flanqueamento-coordenado','infiltração','fixar-flanquear','limpeza-trincheira','cobrindo-avanco','escolta','ruptura','base-de-fogo']);
  const ids=coordinated.filter(o=>o.sector===op.sector.id&&participating.has(o.role)).map(o=>o.id);
  op.fighting=coordinated.filter(o=>o.sector===op.sector.id&&participating.has(o.role)&&o.role!=='base-de-fogo').map(o=>o.id);
  const fighters=new Set(op.fighting);op.cohort=intel.own.filter(u=>fighters.has(u.id)).map(u=>({id:u.id,hp:u.hp}));
  const participants=intel.own.filter(u=>fighters.has(u.id));op.best=participants.length?participants.reduce((n,u)=>n+Math.hypot(u.x-op.sector.x,u.y-op.sector.y),0)/participants.length:Infinity;
  Learning.begin(m.learning,op,{...state,knownEnemies:intel.enemies},ids,op.pendingTrial);op.pendingTrial=null;
 }
 const priority=intel.enemies.filter(e=>state.time-e.at<12&&Math.abs(e.y-op.sector.y)<330&&(e.type==='mg'||e.type==='tank')).sort((a,b)=>(b.type==='mg'?3:2)-(a.type==='mg'?3:2))[0];
 let support=state.supportReady?Brain.supportPlan({...observed,orders:coordinated,priorityTarget:priority?.id}):null;
 if(op.phase==='prepare'&&state.supportReady&&state.smokeAvailable&&state.time-op.smokeAt>24&&state.supplies>=(state.defs.artillery?.cost||160)+80){
  support={type:'artillery',kind:'smoke',x:op.sector.front+dir[state.team]*150,y:op.sector.y,operation:true};
 }
 const assault=op.phase==='advance'&&state.time-op.since<9?{sector:op.sector.id,y:op.sector.y,x:op.sector.x,ids:coordinated.filter(o=>o.role==='avanço-alternado').map(o=>o.id)}:null;
 let purchase=base.purchase;
 // Do not fill every small vacancy with MG teams until riflemen disappear.
 if(purchase==='mg'&&intel.own.filter(u=>u.type==='mg').length>=Math.max(3,Math.ceil(intel.own.length*(Brain.getRoles()[state.team]==='defend'?.22:.14))))purchase=null;
 if(purchase==='cavalry'&&intel.own.filter(u=>u.type==='cavalry').length>=Math.max(5,Math.ceil(intel.own.length*.08)))purchase=null;
 const occupied=state.units.filter(u=>u.team===state.team&&u.hp>0).length;
 const room=state.maxUnits-occupied,counts=type=>intel.own.filter(u=>u.type===type).length;
 const canBuy=type=>state.defs[type]&&room>=state.defs[type].count&&state.supplies>=state.defs[type].cost+80;
 const infantryShort=counts('rifle')<Math.max(8,Math.ceil(intel.own.filter(u=>!u.sap).length*.5));
 if(infantryShort&&canBuy('rifle'))purchase='rifle';
 else if(m.learning.sectors[op.sector.id].mg>1&&counts('tank')<Math.min(2,state.maxUnits>=120?2:1)&&canBuy('tank'))purchase='tank';
 else if(m.learning.sectors[op.sector.id].tanks>1&&counts('tank')<(state.maxUnits>=120?3:2)&&canBuy('tank'))purchase='tank';
 else if(!purchase&&canBuy('rifle'))purchase='rifle';
 if(purchase&&room<state.defs[purchase].count)purchase=null;
 let available=state.supplies;
 const reinforce=base.reinforce&&available>=(state.defs.reinforce?.cost||0);if(reinforce)available-=state.defs.reinforce?.cost||0;
 if(support){const cost=state.defs[support.type]?.cost||0;if(cost>available)support=null;else available-=cost}
 if(purchase&&state.defs[purchase].cost>available)purchase=null;
 return {...base,reinforce,defense:state.managedConstruction?null:base.defense,purchase,summary:phases[op.phase]+' · '+op.sector.name+' · '+op.style.label,orders:coordinated,support,assault,
  learning:Learning.snapshot(m.learning),squadMind:m.squads.map(Squads.snapshot).filter(Boolean),intelligence:Intelligence.snapshot(m.seen,state.time),operation:{phase:op.phase,sector:op.sector.id,x:op.sector.x,y:op.sector.y,since:op.since,style:op.style.name},
  sectors:ss.map(s=>({id:s.id,name:s.name,x:s.x,y:s.y,front:s.front,threat:s.threat,force:s.force,invasion:s.invasion})),events:m.events.map(e=>({...e}))};
}
function supportResult(team,success){const m=memories[team],op=m?.operation;if(!op)return;op.smokeAt=m.time;op.smokeUntil=success?m.time+30:0}
function state(team){const m=memories[team];if(!m)return null;return {phase:m.operation?.phase,sector:m.operation?.sector.id,style:m.operation?.style.name,learning:Learning.snapshot(m.learning),fail:[...m.fail],known:m.seen.size,squads:m.squads.map(s=>({...s,ids:[...s.ids]})),events:m.events.map(e=>({...e}))}}
Brain.plan=plan;Brain.lastPlans=[null,null];Brain.operations={reset:team=>{reset(team);if(team===undefined)Brain.lastPlans.fill(null);else Brain.lastPlans[team]=null},state,supportResult,riskAt,route,contacts:team=>[...(memories[team]?.seen.values()||[])].filter(e=>(memories[team]?.time||0)-e.at<12).map(e=>({...e}))};
if(typeof module!=='undefined'&&module.exports)module.exports=Brain;
})(typeof window!=='undefined'?window:globalThis);
