/* Ordens de intenção com semi-IA tática (feedback #1, itens 1, 2, 3, 18 e 20).
   O jogador diz O QUE quer; o grupo descobre COMO. Seleciona tropas e dá clique direito num objetivo:
     · estrutura inimiga (posto médico, artilharia, QG, bunker, antiaérea…) → ASSALTO: aproxima por etapas, usa cobertura sob fogo,
       ataca com o que tem (fuzil, MG, granada, carga de demolição, canhão) e avisa se não tem armamento adequado;
     · trincheira → OCUPAR: distribui os homens pelos segmentos livres, depois segurar / abandonar / ir à próxima;
     · bandeira inimiga ou região do terreno → AVANÇAR: saltos curtos, abrigo (trincheira, cratera, destroço, tanque destruído) quando
       há supressão, metralhadora ou artilharia;
     · engenheiros + estrutura/obra aliada danificada → REPARAR (engineers.js).
   Quando a tropa trava, o sargento informa ("General, não conseguimos avançar. Fogo inimigo pesado.") e o painel oferece:
   esperar, continuar, recuar, artilharia, apoio aéreo ou mandar outro grupo flanquear. A IA usa as mesmas ordens (PXORD.assault).
   Cada grupo tem indicativo (Alpha, Bravo…), líder (se cai, o grupo perde eficiência) e relatos raros via PXCOMM.
   Liga/desliga: ?ordens=0 · API: IronFront.orders (assault, occupy, advance, retreat, decide, free, groups, groupOf, state). */
(function(){
'use strict';
if(typeof update!=='function'||typeof units==='undefined')return;
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const S=window.PXORD={on:!/[?&]ordens=0/.test(location.search),version:'1.0',cfg:{TICK:.3,STAGE:330,GATHER:80,STALL:14,AUTO:42,COVERR:140,HEAVY:1.0,LOSS:.4},stats:{groups:0,covers:0,stalls:0,decisions:0,done:0,noarms:0,blocked:0,errors:0},pings:[]};
let G=[],gid=0,errs=0,tickT=0,panelT=0,focus=null;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('orders.js:',e);if(errs>=12){S.on=false;console.error('orders.js desligado após erros repetidos')}}
const C=()=>window.PXCOMM,T=()=>window.PXSTRUCT;
const live=u=>u&&u.hp>0&&!u.down&&!u.rs&&!u.carried&&!u.inBed;
const combat=u=>live(u)&&!u.sap&&u.cls!=='medic'&&u.cls!=='mechanic';
const rear=team=>team?W-340:340;
S.groups=()=>G;S.groupOf=u=>u&&u.gid?G.find(g=>g.id===u.gid)||null:null;
S.free=team=>units.filter(u=>u.team===team&&combat(u)&&!u.gid&&!u.inBunk&&!(u===player&&mode==='soldier')&&!(u.manualUntil>time+3)&&!u.post&&!u.bunkerOf);
const centroid=us=>{let x=0,y=0;for(const u of us){x+=u.x;y+=u.y}return us.length?{x:x/us.length,y:y/us.length}:{x:0,y:0}};
const proxy=e=>({x:e.x,y:e.y,hp:1,type:'struct',team:e.team,down:false});

/* ---------- movimento ---------- */
function go(u,x,y){x=clamp(x,24,W-24);y=clamp(y,24,H-24);if(u.order!=='move'||hyp((u.tx||0)-x,(u.ty||0)-y)>14){u.order='move';u.tx=x;u.ty=y;if(u.pv)u.pv.path=null}u.manualUntil=u._ord=time+2.6;u.aiStepAt=0}
function halt(u){u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=u._ord=time+2.6;if(u.pv)u.pv.path=null}
const stamp=u=>{u.manualUntil=u._ord=time+2.6};
const facing=(team)=>team?-1:1;

/* ---------- cobertura ---------- */
const COVERQ={hulk:.5,trench:.35,sand:.55,tree:.78,crater:.6,ruin:.55,bunker:.3};
function coverSpots(u,from,r){
 const out=[],push=(x,y,k)=>{if(hyp(x-u.x,y-u.y)<=r)out.push({x,y,k,q:COVERQ[k]})};
 for(const a of fieldTrenches){if(a.team===1-u.team)continue;if(Math.abs(a.x-u.x)>r+60||Math.abs(a.y-u.y)>r+60)continue;push(a.x,a.y,'trench')}
 for(const b of buildings){if(b.hp<=0||b.team===1-u.team&&b.type!=='trench')continue;if(Math.abs(b.x-u.x)>r+40||Math.abs(b.y-u.y)>r+40)continue;
  if(b.type==='sandbag'||b.type==='trench'||b.type==='bunker')push(b.x,b.y,b.type==='sandbag'?'sand':b.type)}
 const cx=Math.floor(u.x/128),cy=Math.floor(u.y/128);
 for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const d of coverGrid.get(x+','+y)||[]){if(d.type==='tree'||d.type==='ruin'||d.type==='rock'||d.type==='wreck')push(d.x,d.y,d.type==='tree'?'tree':'ruin')}
 for(const c of allCraters)if(Math.abs(c.x-u.x)<r+c.r&&Math.abs(c.y-u.y)<r+c.r&&c.r>=18)push(c.x,c.y,'crater');
 const H_=window.PXCLEAN?.hulks;if(H_)for(const h of H_){if(h.t<=0||Math.abs(h.x-u.x)>r+30||Math.abs(h.y-u.y)>r+30)continue;
  const dx=h.x-from.x,dy=h.y-from.y,n=hyp(dx,dy)||1;push(h.x+dx/n*20,h.y+dy/n*20,'hulk')}
 return out;
}
function pickCover(u,g,from,r){
 const spots=coverSpots(u,from,r||S.cfg.COVERR);let best=null,bs=1e9;
 for(const s of spots){const used=g.spots.get(s.x+','+s.y)||0;if(used>=3)continue;
  const toward=g.goal?hyp(s.x-g.goal.x,s.y-g.goal.y):0,here=g.goal?hyp(u.x-g.goal.x,u.y-g.goal.y):0;
  const away=hyp(s.x-from.x,s.y-from.y)<hyp(u.x-from.x,u.y-from.y)-30;     // não recua para dentro do fogo: o abrigo não pode ser mais perto do inimigo
  const sc=s.q*120+hyp(s.x-u.x,s.y-u.y)*.6+(toward>here+60?60:0)+(away?45:0);
  if(sc<bs){bs=sc;best=s}}
 return best;
}

/* ---------- trincheiras ---------- */
function chainOf(a){
 const team=a.team,out=[a],seen=new Set([a]);let i=0;
 while(i<out.length&&out.length<40){const c=out[i++];for(const o of fieldTrenches){if(seen.has(o)||o.team!==team||o.hp<=0)continue;if(Math.abs(o.x-c.x)<90&&Math.abs(o.y-c.y)<90&&hyp(o.x-c.x,o.y-c.y)<80){seen.add(o);out.push(o)}}}
 return out;
}
function slotsOf(chain){
 const out=[];for(const t of chain){let ax=t.ax,ay=t.ay;if(!Number.isFinite(ax)||!Number.isFinite(ay)||hyp(ax,ay)<.1){ax=(t.hw||0)>(t.hh||0)?1:0;ay=ax?0:1}
  const n=hyp(ax,ay);ax/=n;ay/=n;const len=t.len||Math.max(t.hw||15,t.hh||15)*2,k=Math.min(Math.max(1,t.slots||1)*2,Math.max(1,Math.floor((len-8)/16)+1));
  for(let i=0;i<k;i++){const o=(i-(k-1)/2)*16,p={x:t.x+ax*o,y:t.y+ay*o,anchor:t,who:null};if(!out.some(q=>hyp(q.x-p.x,q.y-p.y)<12))out.push(p)}}
 return out;
}
S.coverFor=(u,from,r)=>pickCover(u,{spots:new Map(),goal:null},from,r);
S.trenchAt=(x,y,team)=>{let best=null,bd=1e9;for(const a of fieldTrenches){if(team!==undefined&&a.team!==team&&a.team!==1-team)continue;
  if(Math.abs(x-a.x)<=(a.hw||18)+16&&Math.abs(y-a.y)<=(a.hh||14)+16){const d=hyp(x-a.x,y-a.y);if(d<bd){bd=d;best=a}}}return best};

/* ---------- criação ---------- */
function newGroup(team,kind,us,opts={}){
 us=us.filter(u=>live(u));if(!us.length)return null;
 for(const u of us){const old=S.groupOf(u);if(old)leave(old,u)}
 const g={id:++gid,team,kind,units:us.slice(),state:'approach',since:time,ai:!!opts.ai,byPlayer:!!opts.byPlayer,via:opts.via||'',spots:new Map(),n0:us.length,goal:null,ent:null,
  th:{heavy:false,supp:0,mg:0,tanks:0,arty:0,near:0},coverEnd:-99,coverAt:-99,progress:time,lastD:Infinity,leader:null,leaderless:0,msg:'',wait:false,cd:{}};
 for(const u of us){u.gid=g.id;u.chg=u.chg??(u.sap?2:0)}
 g.name=C()?.callsign(g.id-1)||('G'+g.id);G.push(g);S.stats.groups++;pickLeader(g);return g;
}
function leave(g,u){u.gid=null;g.units=g.units.filter(q=>q!==u);if(g.leader===u)g.leader=null}
function pickLeader(g){g.leader=g.units.filter(live).sort((a,b)=>a.id-b.id)[0]||null}
function end(g,why){for(const u of g.units){if(u.gid===g.id){u.gid=null;if(live(u)&&why!=='retreat'&&u.order==='move'&&hyp(u.tx-u.x,u.ty-u.y)>40){halt(u)}u.manualUntil=Math.min(u.manualUntil,time+.5)}}
 G=G.filter(q=>q!==g);if(focus===g)focus=null}
S.end=end;
S.assault=(us,ent,opts={})=>{const g=newGroup(us[0]?.team??playerTeam,'assault',us,opts);if(!g)return null;g.ent=ent;g.goal={x:ent.x,y:ent.y};g.mission=`Assalto: ${ent.name.toLowerCase()}`;
 g.wp=opts.waypoint||null;if(g.wp)g.state='flank';
 if(!g.ai)say(g,`${g.name}: atacando ${ent.name.toLowerCase()} em ${C()?.gridRef(ent.x,ent.y)||''}.`);
 estimateArms(g);return g};
S.advance=(us,x,y,opts={})=>{const g=newGroup(us[0]?.team??playerTeam,'advance',us,opts);if(!g)return null;g.goal={x,y};g.capture=!!opts.capture;g.mission=opts.capture?'Tomar a base':'Avançar';
 if(!g.ai)say(g,`${g.name}: ${opts.capture?'tomando a base':'avançando'} em ${C()?.gridRef(x,y)||''}.`);return g};
S.occupy=(us,anchor,opts={})=>{const g=newGroup(us[0]?.team??playerTeam,'occupy',us,opts);if(!g)return null;
 g.chain=chainOf(anchor);g.slots=slotsOf(g.chain);g.goal={x:anchor.x,y:anchor.y};g.mission='Ocupar trincheira';g.state='approach';assignSlots(g);
 if(!g.ai)say(g,`${g.name}: ocupando a trincheira em ${C()?.gridRef(anchor.x,anchor.y)||''}.`);return g};
function assignSlots(g){
 for(const s of g.slots)s.who=null;const us=g.units.filter(live).sort((a,b)=>a.id-b.id),taken=new Set();
 const pairs=[];for(const u of us)for(const s of g.slots)pairs.push({u,s,d:hyp(u.x-s.x,u.y-s.y)});pairs.sort((a,b)=>a.d-b.d);const done=new Set();
 for(const p of pairs){if(done.has(p.u)||taken.has(p.s))continue;done.add(p.u);taken.add(p.s);p.s.who=p.u;p.u.slot=p.s}
 let extra=0;for(const u of us)if(!done.has(u)){const a=g.chain[0];u.slot={x:a.x+(extra%2?18:-18)*(1+Math.floor(extra/2)),y:a.y+(g.team?-26:26),extra:1};extra++}
}
S.retreat=(g)=>{if(!g)return;g.state='retreat';g.since=time;g.msg='Recuando';g.mission=g.mission}
S.hold=(g)=>{if(!g)return;g.state='holding';g.since=time}
function say(g,text,kind='info'){if(g.team===playerTeam&&C()&&!g.ai)C().say(g.team,C().nameFor(g.team,g.id),text,kind,g.leader,{immediate:true})}
function report(g,key,text,opts={}){if(g.ai||g.team!==playerTeam||!C())return false;return C().report(g.team,g.leader||g.units[0],key,text,Object.assign({scope:g.id,x:g.leader?.x,y:g.leader?.y,speaker:C().nameFor(g.team,g.id)},opts))}

/* ---------- armamento e capacidade ---------- */
function estimateArms(g){
 const e=g.ent;if(!e||!T())return;const able=g.units.filter(u=>live(u)&&T().canHurt(e,u));
 g.noArms=!able.length;
 if(g.noArms){S.stats.noarms++;report(g,'noarms',`General, não possuímos armamento adequado para destruir ${e.name.toLowerCase()}.`,{kind:'alert',cd:5,force:true});g.state='stalled';g.wait=true;g.stallAt=time;g.msg='Sem armamento adequado'}
 else{g.eta=T().estimate(e,able);if(g.eta>420)report(g,'slow',`General, vai demorar: ${e.name.toLowerCase()} resiste ao nosso armamento.`,{kind:'info',cd:60})}
}

/* ---------- ameaça ---------- */
function threat(g){
 const us=g.units.filter(live);if(!us.length)return g.th;const c=centroid(us);let mg=0,tanks=0,near=0,mgs=null;
 for(const e of units){if(e.team===g.team||e.hp<=0||e.down)continue;const d=hyp(e.x-c.x,e.y-c.y);
  if(e.type==='mg'&&d<430){mg++;mgs=mgs||e}else if(e.type==='tank'&&d<480)tanks++;else if(d<220)near++}
 for(const b of buildings)if(b.team!==g.team&&b.type==='bunker'&&b.hp>0&&hyp(b.x-c.x,b.y-c.y)<390){mg++;mgs=mgs||b}
 let arty=0;for(const s of shells){if(s.team===g.team||s.gren||s.t>3||s.r<55)continue;if(hyp(s.x-c.x,s.y-c.y)<170)arty++}
 let supp=0,under=0;for(const u of us){supp+=Math.min(2,u.suppression||0);if(u.underFire>0)under++}supp/=us.length;under/=us.length;
 const heavy=(supp>S.cfg.HEAVY||under>.45&&(mg>0||arty>0)||arty>=3||supp>.7&&mg>0&&tanks>0)&&!(g.rush&&supp<1.6);   // g.rush (comandante.js): assalto em marcha só procura abrigo se estiver realmente preso
 return g.th={heavy,supp,under,mg,tanks,arty,near,c,mgs};
}

/* ---------- decisões do jogador ---------- */
const DEC={
 wait(g){g.state='cover';g.wait=true;g.coverAt=time;g.msg='Esperando';return true},
 push(g){g.wait=false;g.state=g.kind==='occupy'?'approach':(g.wp&&g.state==='flank'?'flank':'approach');g.coverEnd=time;g.since=time;g.progress=time;g.msg='';g.stalledOnce=false;return true},
 retreat(g){g.wait=false;S.retreat(g);return true},
 arty(g){const t=g.th&&g.th.mgs||g.ent||g.goal;if(!t)return false;return callArty(g.team,t.x,t.y)},
 air(g){const t=g.th&&g.th.mgs||g.ent||g.goal;if(!t)return false;return callAir(g.team,t.x,t.y)},
 flank(g){return sendFlank(g)},
 hold(g){g.state='holding';g.wait=false;g.msg='Segurando';return true},
 abandon(g){g.state='retreat';g.msg='Abandonando a trincheira';return true},
 next(g){return nextTrench(g)}};
S.decide=(g,kind)=>{if(!g||!DEC[kind])return false;S.stats.decisions++;const ok=DEC[kind](g);if(g.team===playerTeam&&!g.ai&&C()&&ok!==false){const label={wait:'esperando em cobertura',push:'continuando o avanço',retreat:'recuando',arty:'pedindo artilharia',air:'pedindo apoio aéreo',flank:'flanqueando',hold:'segurando a posição',abandon:'abandonando a posição',next:'avançando para a próxima trincheira'}[kind];C().say(g.team,C().nameFor(g.team,g.id),`${g.name}: entendido, ${label}.`,'ok',g.leader,{immediate:true})}
 return ok};
function callArty(team,x,y){
 if(typeof spend==='function'&&!spend('artillery',team,team===playerTeam))return false;
 if(!(window.PXBAT&&PXBAT.mission(team,x,y,6,95)))for(let i=0;i<6;i++)shells.push({x:x+rnd(-95,95),y:y+rnd(-95,95),t:3+i*.4,r:75,team});
 if(team===playerTeam)toast(`Artilharia a caminho de ${C()?.gridRef(x,y)||'alvo'}. Afaste aliados.`);return true}
function callAir(team,x,y){
 if(window.PXAW?.on){if(!PXAW.available(team,'atk')){if(team===playerTeam)toast('Sem aviões prontos para apoio aéreo.');return false}
  const AC_=window.IronFrontAirCommand;
  if(AC_&&AC_.request){const f=AC_.request(team,'atk',x,y,{n:1,manual:team===playerTeam,reason:'Apoio aéreo ao grupo em combate'});if(f&&team===playerTeam)toast(`Apoio aéreo a caminho de ${C()?.gridRef(x,y)||'alvo'}${f.rapid?' (patrulha desviada)':''}.`);return !!f}
  if(typeof spend==='function'&&!spend('fighter',team,team===playerTeam))return false;
  const ok=PXAW.order(team,'atk',x,y);if(ok&&team===playerTeam)toast(`Apoio aéreo a caminho de ${C()?.gridRef(x,y)||'alvo'}.`);return ok}
 if(typeof spend==='function'&&!spend('fighter',team,team===playerTeam))return false;callFighter(team,x,y);return true}
function sendFlank(g){
 const c=g.th?.c||centroid(g.units),t=g.ent||g.goal;if(!t)return false;
 const pool=S.free(g.team).filter(u=>hyp(u.x-c.x,u.y-c.y)<900).sort((a,b)=>hyp(a.x-c.x,a.y-c.y)-hyp(b.x-c.x,b.y-c.y)).slice(0,10);
 if(pool.length<4){if(g.team===playerTeam)toast('Nenhum grupo disponível para flanquear.');return false}
 const side=c.y<GH/2?1:-1,wp={x:clamp((c.x+t.x)/2,60,W-60),y:clamp(t.y+side*(300+rnd(0,80)),60,GH-60)};
 const n=g.ent?S.assault(pool,g.ent,{waypoint:wp,via:'flanco',byPlayer:g.byPlayer,ai:g.ai}):S.advance(pool,t.x,t.y,{via:'flanco',byPlayer:g.byPlayer,ai:g.ai});
 if(n&&n.kind==='advance'){n.wp=wp;n.state='flank'}return !!n}
function nextTrench(g){
 const d=facing(g.team),c=centroid(g.units),cur=g.chain||[];let best=null,bd=1e9;
 for(const a of fieldTrenches){if(a.team!==g.team||cur.includes(a)||a.hp<=0)continue;const fwd=d*(a.x-c.x);if(fwd<40||fwd>700)continue;const dd=hyp(a.x-c.x,a.y-c.y);if(dd<bd){bd=dd;best=a}}
 if(!best){if(g.team===playerTeam)toast('Não há trincheira à frente.');return false}
 g.chain=chainOf(best);g.slots=slotsOf(g.chain);g.goal={x:best.x,y:best.y};g.state='approach';g.since=time;assignSlots(g);g.mission='Ocupar trincheira';return true}

/* ---------- máquina de estados ---------- */
function standoff(u){return u.sap?20:u.type==='tank'?250:u.type==='mg'?190:u.gren>0?105:150}
function formation(g,i,c,dirx,diry,spread=24){const per=Math.ceil(Math.sqrt(g.units.length*1.6)),row=Math.floor(i/per),col=i%per,side=(col-(per-1)/2)*spread;return {x:c.x-dirx*row*20-diry*side,y:c.y-diry*row*20+dirx*side}}
function enterCover(g){
 g.state='cover';g.coverAt=time;g.wait=false;g.spots=new Map();S.stats.covers++;
 const from=g.th.mgs||g.th.c||g.goal||g.units[0];let hulk=false;
 for(const u of g.units){if(!live(u))continue;const s=pickCover(u,g,from);if(s){u.cover=s;g.spots.set(s.x+','+s.y,(g.spots.get(s.x+','+s.y)||0)+1);if(s.k==='hulk')hulk=true}else u.cover=null}
 g.hulk=hulk;
 report(g,'hold',hulk?'General, fogo inimigo pesado! Usando um tanque destruído como cobertura.':'General, fogo inimigo pesado! Procurando cobertura.',{kind:'warn',cd:25});
}
function tickCover(g){
 for(const u of g.units){if(!live(u))continue;const s=u.cover;if(s&&hyp(u.x-s.x,u.y-s.y)>7)go(u,s.x,s.y);else halt(u)}
 const th=g.th,t=time-g.coverAt;
 if(g.wait||g.state==='stalled'){S.autoDecide(g);return}
 if(t>=6&&!th.heavy&&th.supp<.55){g.state='approach';g.coverEnd=time;g.msg='';g.since=time;g.progress=time;return}
 if(t>=S.cfg.STALL&&!g.stalledOnce){g.stalledOnce=true;stall(g,'Fogo inimigo pesado')}
}
function stall(g,why){
 g.state='stalled';g.msg=why;g.wait=true;S.stats.stalls++;g.stallAt=time;
 if(g.noArms)return;
 report(g,'stuck',`General, não conseguimos avançar. ${why}.`,{kind:'alert',cd:30,force:true});
 if(g.team===playerTeam&&!g.ai)focus=g;
}
/* quem decide quando o jogador não responde: IA, enlace cortado (autonomia) ou espera longa */
S.autoDecide=g=>{
 const since=time-(g.stallAt??g.coverAt);
 if(!(g.ai||C()?.autonomous(g.team)||since>S.cfg.AUTO))return false;
 if(g.noArms){S.retreat(g);return true}
 const loss=1-g.units.filter(live).length/Math.max(1,g.n0);
 if(loss>S.cfg.LOSS){S.retreat(g);return true}
 if(!g.th.heavy&&since>12||since>S.cfg.AUTO*1.6){DEC.push(g);return true}
 if(g.ai&&!g.airCalled&&since>5&&(g.th.mgs||g.th.tanks)&&window.PXAW?.on){g.airCalled=true;if(DEC.air(g)){g.msg='Apoio aéreo pedido';return true}}
 if(g.ai&&since>10){DEC.flank(g)||DEC.push(g);return true}
 return false;
};

function stepAssault(g){
 const e=g.ent,us=g.units.filter(live);
 if(!e||e.destroyed){finish(g);return}
 if(!us.length)return;
 // IA: não insiste com um grupo dizimado (menos de 45 %): recolhe
 if(g.ai&&g.state!=='retreat'&&us.length<Math.max(3,g.n0*.45)){S.retreat(g);return}
 const c=centroid(us),dist=hyp(c.x-e.x,c.y-e.y),dx=e.x-c.x,dy=e.y-c.y,n=hyp(dx,dy)||1,ux=dx/n,uy=dy/n;
 if(g.state==='flank'){const wp=g.wp;if(!wp||hyp(c.x-wp.x,c.y-wp.y)<70||time-g.since>45){g.state='approach';g.since=time;g.wp=null}
  else{us.forEach((u,i)=>{const p=formation(g,i,wp,1,0,22);go(u,p.x,p.y)});return}}
 if(g.state==='stalled'||g.state==='cover'){tickCover(g);return}
 if(g.state==='waiting'){return}
 if(g.th.heavy&&time-g.coverEnd>9&&dist>110){enterCover(g);return}
 if(g.state==='approach'){
  // etapa: reúne o grupo a ~330 px antes do assalto final
  if(dist>S.cfg.STAGE+60&&!g.staged){const sp={x:e.x-ux*S.cfg.STAGE,y:e.y-uy*S.cfg.STAGE};const near=us.filter(u=>hyp(u.x-sp.x,u.y-sp.y)<S.cfg.GATHER+30).length;
   us.forEach((u,i)=>{const p=formation(g,i,sp,ux,uy,24);go(u,p.x,p.y)});
   if(near>=us.length*.7||time-g.since>40+dist/40){g.staged=true;g.since=time}
   return}
  g.staged=true;let inPos=0;
  us.forEach((u,i)=>{const so=standoff(u),d=hyp(u.x-e.x,u.y-e.y);
   if(u.sap){if((u.chg||0)>0&&!(g.sapHold&&time<g.sapHold)){const edge=Math.max(18,e.w*.42);go(u,e.x-ux*edge,e.y-uy*edge)}else go(u,e.x-ux*220,e.y-uy*220)}
   else if(d>so+25){const p=formation(g,i,{x:e.x-ux*so,y:e.y-uy*so},ux,uy,26);go(u,p.x,p.y)}
   else{inPos++;halt(u)}});
  if(inPos>=Math.max(1,us.filter(u=>!u.sap).length*.5)||dist<so0(us)+30){g.state='attack';g.since=time}
  progressCheck(g,dist);
 }else if(g.state==='attack'){
  us.forEach(u=>{const so=standoff(u),d=hyp(u.x-e.x,u.y-e.y);if(u.sap)return stepSapper(g,u,e,ux,uy);if(d>so+55){go(u,e.x-ux*so,e.y-uy*so)}else halt(u)});
  if(time-g.since>150&&e.hp>e.max*.9&&!g.noteSlow){g.noteSlow=true;report(g,'slow',`General, ${e.name.toLowerCase()} resiste. Precisamos de explosivos ou artilharia.`,{kind:'warn',cd:60})}
 }else if(g.state==='retreat')stepRetreat(g);
}
const so0=us=>us.reduce((m,u)=>Math.max(m,standoff(u)),0);
function stepSapper(g,u,e,ux,uy){
 if(u.fleeUntil>time){go(u,e.x-ux*120,e.y-uy*120);return}
 if((u.chg||0)>0){const edge=Math.max(16,e.w*.38);const d=hyp(u.x-e.x,u.y-e.y);
  if(d>edge+14)go(u,e.x-ux*edge,e.y-uy*edge);else{halt(u);if(time>=(u.chgT||0)&&T()){T().charge(e,u.team,7);u.chg--;u.chgT=time+12;u.fleeUntil=time+8;if(!g.ai)report(g,'charge','Carga colocada! Afastem-se!',{kind:'info',cd:12,gap:2})}}}
 else go(u,e.x-ux*200,e.y-uy*200)}
function progressCheck(g,dist){
 if(dist<g.lastD-14){g.lastD=dist;g.progress=time}
 else if(time-g.progress>16&&g.state==='approach'){g.progress=time;S.stats.blocked++;
  // não sai do lugar: contorna lateralmente; 2ª falha: desiste e informa
  g.blocked=(g.blocked||0)+1;
  if(g.blocked===1){const side=g.id%2?1:-1;for(const u of g.units)if(live(u)&&u.pv)u.pv.ds=side}
  else if(g.blocked===2){const c=centroid(g.units),side=(c.y<GH/2?1:-1)*140;g.wp={x:c.x,y:clamp(c.y+side,60,GH-60)};g.state='flank';g.since=time}
  else{report(g,'blocked','General, o caminho está bloqueado. Não conseguimos chegar ao objetivo.',{kind:'alert',cd:30,force:true});g.msg='Caminho bloqueado';stall(g,'Caminho bloqueado');}}
}
function stepRetreat(g){
 const us=g.units.filter(live),d=facing(g.team),rx=rear(g.team);
 us.forEach((u,i)=>go(u,rx+(i%5-2)*18,clamp((g.goal?.y??u.y)+(Math.floor(i/5)-1)*20,60,H-60)));
 const c=centroid(us);if(Math.abs(c.x-rx)<90||time-g.since>40)end(g,'retreat');
}
function stepAdvance(g){
 const us=g.units.filter(live);if(!us.length)return;const c=centroid(us),goal=g.goal,dist=hyp(c.x-goal.x,c.y-goal.y);
 if(g.state==='flank'){const wp=g.wp;if(!wp||hyp(c.x-wp.x,c.y-wp.y)<70||time-g.since>45){g.state='approach';g.since=time;g.wp=null}else{us.forEach((u,i)=>{const p=formation(g,i,wp,1,0,22);go(u,p.x,p.y)});return}}
 if(g.state==='stalled'||g.state==='cover'){tickCover(g);return}
 if(g.state==='retreat'){stepRetreat(g);return}
 if(g.state==='holding'||g.state==='arrived'){us.forEach(halt);return}
 if(g.th.heavy&&time-g.coverEnd>9&&dist>90){enterCover(g);return}
 const dx=goal.x-c.x,dy=goal.y-c.y,n=hyp(dx,dy)||1,ux=dx/n,uy=dy/n,step=Math.min(n,170),wp={x:c.x+ux*step,y:c.y+uy*step};
 us.forEach((u,i)=>{const p=formation(g,i,wp,ux,uy,24);go(u,p.x,p.y)});
 if(dist<g.units.length*3+55){g.state=g.capture?'arrived':'arrived';g.mission=g.capture?'Base ocupada':'Posição alcançada';us.forEach(halt);report(g,'captured',g.capture?'General, estamos na base inimiga!':'General, chegamos à posição.',{kind:'ok',cd:20,force:true});g.doneAt=time}
 progressCheck(g,dist);
}
function stepOccupy(g){
 const us=g.units.filter(live);if(!us.length)return;
 if(g.state==='retreat'){stepRetreat(g);return}
 if(g.th.heavy&&g.state==='approach'&&time-g.coverEnd>9){const c=centroid(us);if(hyp(c.x-g.goal.x,c.y-g.goal.y)>140){enterCover(g);return}}
 if(g.state==='cover'||g.state==='stalled'){tickCover(g);return}
 let seated=0;for(const u of us){const s=u.slot;if(!s){assignSlots(g);continue}
  const d=hyp(u.x-s.x,u.y-s.y);
  if(d>14){go(u,s.x,s.y)}else{halt(u);if(d>2){u.x+=(s.x-u.x)*.4;u.y+=(s.y-u.y)*.4}seated++;u.angle=Math.atan2(0,facing(g.team))}}
 if(seated>=us.length&&g.state!=='holding'){g.state='holding';g.mission='Segurando a trincheira';report(g,'captured','General, posição ocupada. Seguramos a trincheira.',{kind:'ok',cd:20,force:true})}
 else if(g.state==='holding'&&seated<us.length*.6)g.state='approach';
}
function finish(g,why='done'){
 S.stats.done++;
 if(g.kind==='assault'&&g.ent&&g.ent.destroyed)report(g,'done',`General, ${g.ent.name.toLowerCase()} ${T().ge(g.ent,'destruído','destruída')}. Objetivo cumprido.`,{kind:'ok',cd:5,force:true});
 for(const u of g.units)if(live(u))halt(u);
 g.state='done';g.doneAt=time;
}
function stepGroup(g){
 g.units=g.units.filter(u=>u&&u.hp>0);
 for(const u of g.units.slice()){
  if(!live(u)&&u.hp>0){if(u.down||u.rs||u.carried||u.inBed){leave(g,u)}}
  else if(u.manualUntil>time+3.3&&u._ord!==u.manualUntil&&u.gid===g.id)leave(g,u)}   // o jogador deu outra ordem a este homem
 if(!g.units.length){end(g,'empty');return}
 if(g.leader&&!live(g.leader)){leaderDown(g)}
 if(!g.leader)pickLeader(g);
 if(g.state==='done'){if(time-g.doneAt>5)end(g,'done');return}
 if(g.state==='arrived'&&time-(g.doneAt??time)>6){end(g,'done');return}
 for(const u of g.units)if(g.state!=='retreat')stamp(u);
 threat(g);
 if(g.kind==='assault')stepAssault(g);else if(g.kind==='advance')stepAdvance(g);else if(g.kind==='occupy')stepOccupy(g);
 watch(g);
}
function leaderDown(g){
 g.leader=null;const who=C()?.nameFor(g.team,g.id);
 for(const u of g.units)u.cohesion=Math.max(0,(u.cohesion??1)-.14);
 g.leaderless=time+12;pickLeader(g);
 report(g,'leader','General, perdemos o sargento! O grupo está desorganizado.',{kind:'alert',cd:25,force:true,speaker:C()?.nameFor(g.team,g.id+3)});
}
/* relatos contextuais (raros): munição, tanque, artilharia, apoio, linha quebrando, reforços */
function watch(g){
 if(g.ai||g.team!==playerTeam||!C())return;if((g.wT||0)>time)return;g.wT=time+1.2;
 const us=g.units.filter(live);if(!us.length)return;
 const frac=us.length/Math.max(1,g.n0);
 if(g.th.tanks>0)report(g,'tank','General, tanque inimigo avistado!',{kind:'alert',cd:50,x:g.th.c?.x,y:g.th.c?.y});
 if(g.th.arty>=2)report(g,'arty','General, artilharia inimiga!',{kind:'alert',cd:40});
 if(g.th.mgs&&g.state!=='cover')report(g,'mg',`General, metralhadora inimiga em ${C().gridRef(g.th.mgs.x,g.th.mgs.y)}.`,{kind:'warn',cd:50,x:g.th.mgs.x,y:g.th.mgs.y});
 const dry=us.filter(u=>u.type==='rifle'&&u.ammo===0).length;if(dry>=us.length*.5&&us.length>=3)report(g,'ammo','General, estamos ficando sem munição!',{kind:'warn',cd:60});
 if(frac<.6&&g.n0>=5)report(g,'support','General, precisamos de apoio!',{kind:'warn',cd:45});
 if(frac<.4&&g.n0>=6)report(g,'line','General, a linha está quebrando!',{kind:'alert',cd:60});
 if(frac<.3&&g.n0>=6&&!g.ai)report(g,'reinf','General, precisamos de reforços!',{kind:'alert',cd:70});
}

/* ---------- fogo contra estruturas (por quadro) ---------- */
function fireTick(dt){
 const rf=window.weapons?.rifle||{reload:2.4,mag:5};
 for(const g of G){if(g.kind!=='assault'||!g.ent||g.ent.destroyed||!(g.state==='attack'||g.state==='approach'))continue;
  const e=g.ent;
  for(const u of g.units){if(!live(u)||u.sap||u.type==='cavalry'||(u===player&&mode==='soldier'))continue;
   const d=hyp(u.x-e.x,u.y-e.y)-e.w*.25;if(d>(defs[u.type]?.range||240)*.92)continue;
   if(u.suppression>1||u.cd>0||u.rl>0||u.thr>0)continue;
   const tg=u.target;if(tg&&tg.hp>0&&!tg.down&&tg.team!==u.team&&hyp(u.x-tg.x,u.y-tg.y)<210)continue;   // combate contra soldados tem prioridade
   if(u.type==='tank'){if(T()?.canHurt(e,u)){shoot(u,proxy(e))}continue}
   if(u.gren>0&&d>45&&d<125&&(u.gcd||0)<=0&&T()?.MAT[e.mat]?.expl>=.5){u.gren--;u.gcd=rnd(7,12);u.thr=.55;u.tg={x:e.x+rnd(-12,12),y:e.y+rnd(-10,10)};u.cd=Math.max(u.cd,.7);continue}
   if(T()?.canHurt(e,u)){shoot(u,proxy(e));if(u.type==='rifle'){if(u.ammo===undefined){u.ammo=rf.mag;u.rl=0}if(--u.ammo<=0)u.rl=rf.reload}}}
  for(const u of g.units)if(u.gcd>0)u.gcd-=dt;
 }
}

/* ---------- interface do jogador ---------- */
let panel=null;
function ui(){
 if(panel||typeof document==='undefined')return;
 const st=document.createElement('style');st.textContent=`
#intentPanel{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--hbh,140px) + 54px);background:rgba(10,13,8,.9);color:#e7eadb;padding:.35rem .5rem;box-shadow:0 0 0 2px #000;font:11px 'IBM Plex Mono',monospace;display:none;z-index:6;max-width:94vw;pointer-events:auto}
#intentPanel .hd{display:flex;gap:.6rem;align-items:baseline;margin-bottom:.25rem}#intentPanel .hd b{color:#c5db91}#intentPanel .hd span{color:#929b87}
#intentPanel .hd .st{color:#e7eadb}#intentPanel.alert{box-shadow:0 0 0 2px #d2603e}
#intentPanel .row{display:flex;flex-wrap:wrap;gap:.3rem}
#intentPanel button{font:700 10px 'IBM Plex Mono',monospace;padding:.25rem .5rem;background:#2a3322;color:#e7eadb;border:0;box-shadow:0 0 0 2px #000;cursor:pointer}
#intentPanel button:hover{filter:brightness(1.25)}#intentPanel button.hot{background:#6a5a22}
#intentPanel button.off{opacity:.45}`;
 document.head.append(st);panel=document.createElement('div');panel.id='intentPanel';panel.setAttribute('role','group');panel.setAttribute('aria-label','Ordens do grupo');document.body.append(panel);
}
const LABEL={approach:'AVANÇANDO',attack:'ATACANDO',cover:'EM COBERTURA',stalled:'PARADO',retreat:'RECUANDO',holding:'SEGURANDO',arrived:'NO OBJETIVO',flank:'FLANQUEANDO',done:'CONCLUÍDO',waiting:'ESPERANDO'};
function panelGroup(){
 if(focus&&!G.includes(focus))focus=null;
 for(const id of selected){const u=units.find(q=>q.id===id);const g=u&&S.groupOf(u);if(g&&g.team===playerTeam)return g}
 return focus&&focus.team===playerTeam?focus:null;
}
function paintPanel(){
 ui();if(!panel)return;const g=started&&!ended&&mode==='commander'?panelGroup():null;
 if(!g){if(panel.style.display!=='none')panel.style.display='none';return}
 const hot=g.state==='stalled'||g.state==='cover',noArms=g.noArms;
 const btn=(k,label,show=true,on=true)=>show?`<button data-k="${k}" class="${hot&&['wait','push','retreat','arty','air','flank'].includes(k)?'hot':''}${on?'':' off'}">${label}</button>`:'';
 let rows='';
 if(g.kind==='occupy')rows=btn('hold','SEGURAR POSIÇÃO')+btn('abandon','ABANDONAR')+btn('next','PRÓXIMA TRINCHEIRA')+btn('arty','ARTILHARIA')+btn('air','APOIO AÉREO');
 else rows=btn('wait','ESPERAR')+btn('push','CONTINUAR',true,!noArms)+btn('retreat','RECUAR')+btn('arty','ARTILHARIA')+btn('air','APOIO AÉREO')+btn('flank','FLANQUEAR');
 const html=`<div class="hd"><b>${g.name.toUpperCase()}</b><span>${g.mission||''}</span><span class="st">${LABEL[g.state]||g.state}${g.msg?' · '+g.msg:''} · ${g.units.filter(live).length}/${g.n0}</span></div><div class="row">${rows}</div>`;
 if(panel._h!==html){panel._h=html;panel.innerHTML=html;for(const b of panel.querySelectorAll('button'))b.onclick=ev=>{ev.stopPropagation();const cur=panelGroup();if(cur)S.decide(cur,b.dataset.k)}}
 panel.classList.toggle('alert',hot);panel.style.display='block';
}
/* indicadores de ordem no mapa (ping) e marcação do grupo selecionado */
S.ping=(x,y,col='#c5db91')=>{S.pings.push({x,y,t:0,col});if(S.pings.length>6)S.pings.shift()};
if(window.WW1A){const over=WW1A.over;WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);if(!S.on||!started)return;
 try{const Z=(window.PX&&PX.Z)||.5;
  for(const p of S.pings){p.t+=dt||.03;const r=3+Math.round(p.t*14),x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z);if(p.t>1.2)continue;c.strokeStyle=p.col;c.lineWidth=1;c.globalAlpha=Math.max(0,1-p.t/1.2);c.strokeRect(x-r,y-r,r*2,r*2);c.globalAlpha=1}
  S.pings=S.pings.filter(p=>p.t<=1.2);
  const g=panelGroup();if(g&&g.goal){const x=ox+Math.round(g.goal.x*Z),y=oy+Math.round(g.goal.y*Z);c.fillStyle='#c5db91';c.fillRect(x-1,y-6,3,12);c.fillRect(x-6,y-1,12,3)}
  if(g)for(const u of g.units){if(!live(u))continue;const x=ox+Math.round(u.x*Z),y=oy+Math.round(u.y*Z);c.fillStyle=g.state==='cover'||g.state==='stalled'?'#d4b04a':'#c5db91';c.fillRect(x-1,y-8,3,1)}
 }catch(e){fail(e)}}}

/* clique direito: resolve o que há sob o cursor */
function worldPoint(ev,canvas){const r=canvas.getBoundingClientRect();mouse.x=(ev.clientX-r.left)*vw/r.width;mouse.y=(ev.clientY-r.top)*vh/r.height;worldMouse();return {x:mouse.wx,y:mouse.wy}}
function selectedUnits(){return [...selected].map(id=>units.find(u=>u.id===id)).filter(u=>u&&live(u)&&u.team===playerTeam)}
function resolve(p,sel){
 const team=playerTeam,eng=sel.filter(u=>u.sap||u.cls==='mechanic'),fight=sel.filter(u=>!u.sap&&u.cls!=='medic'&&u.cls!=='mechanic'),T_=T();
 // 1) estrutura inimiga → assalto (engenheiros vão junto, para as cargas)
 const foe=T_?.at(p.x,p.y,1-team,10);
 if(foe&&!foe.destroyed&&!(foe.bld&&foe.hp<=0)){const us=fight.concat(eng);if(!us.length)return null;return {kind:'assault',units:us,ent:foe}}
 // 2) engenheiros sobre estrutura aliada danificada (ou destruída reconstruível) → reparar
 if(eng.length&&window.PXENG){const own=T_?.at(p.x,p.y,team,12);if(own&&(own.hp<own.max*.995||own.destroyed&&own.rebuild))return {kind:'repair',units:eng,ent:own};
  const veh=units.find(t=>t.team===team&&t.type==='tank'&&t.hp>0&&hyp(t.x-p.x,t.y-p.y)<34&&(t.hp<t.maxhp||t.trk||t.mot));if(veh)return {kind:'repairVehicle',units:eng,veh};
  const hk=window.PXCLEAN?.hulkAt?.(p.x,p.y,team,34);if(hk&&hk.rec&&eng.some(u=>u.cls==='mechanic'))return {kind:'recover',units:eng.filter(u=>u.cls==='mechanic'),hulk:hk};
  const b=buildings.find(q=>q.team===team&&q.hp>0&&q.type!=='wire'&&Math.abs(q.x-p.x)<30&&Math.abs(q.y-p.y)<24);if(b)return {kind:'repairBuilding',units:eng,b}}
 if(!fight.length)return null;
 // 3) bandeira inimiga → tomar a base
 const flag=points.find(q=>q.owner!==team&&hyp(q.x-p.x,q.y-p.y)<80);if(flag)return {kind:'advance',units:fight,x:flag.x,y:flag.y,capture:true};
 // 4) trincheira → ocupar
 const tr=S.trenchAt(p.x,p.y,team);if(tr)return {kind:'occupy',units:fight,anchor:tr};
 // 5) região do terreno rumo ao inimigo → avanço cuidadoso; para trás/lateral, deslocamento normal
 const c=centroid(fight),d=facing(team);if(d*(p.x-c.x)>60||hyp(p.x-c.x,p.y-c.y)>260&&d*(p.x-c.x)>-30)return {kind:'advance',units:fight,x:p.x,y:p.y};
 return null;
}
function run(res,p){
 const team=playerTeam,cx=res.ent?res.ent.x:res.anchor?res.anchor.x:res.x??p.x,cy=res.ent?res.ent.y:res.anchor?res.anchor.y:res.y??p.y;
 const exec=()=>{
  const us=res.units.filter(live);if(!us.length)return;
  if(res.kind==='assault')S.assault(us,res.ent,{byPlayer:true});
  else if(res.kind==='occupy')S.occupy(us,res.anchor,{byPlayer:true});
  else if(res.kind==='advance')S.advance(us,res.x,res.y,{byPlayer:true,capture:res.capture});
  else if(res.kind==='repair')window.PXENG?.repair(us,res.ent,{byPlayer:true});
  else if(res.kind==='repairVehicle')window.PXENG?.repairVehicle(us,res.veh,{byPlayer:true});
  else if(res.kind==='recover')window.PXENG?.recover(us,res.hulk,{byPlayer:true});
  else if(res.kind==='repairBuilding')window.PXENG?.repairBuilding(us,res.b,{byPlayer:true});
 };
 S.ping(cx,cy,res.kind==='assault'?'#d2603e':'#c5db91');
 if(C()&&['assault','occupy','advance'].includes(res.kind))C().send(team,cx,cy,'ordem',exec);else exec();
 sound&&sound('click');
}
S.click=(ev,canvas)=>{const p=worldPoint(ev,canvas),sel=selectedUnits();if(!sel.length)return false;const res=resolve(p,sel);if(!res)return false;run(res,p);return true};
function install(){
 const canvas=document.getElementById('game');if(!canvas)return;
 window.addEventListener('pointerdown',ev=>{
  if(!S.on||ev.button!==2||ev.target!==canvas||!started||ended||mode!=='commander'||placement)return;
  if(ev.ctrlKey||ev.altKey||ev.shiftKey||ev.metaKey)return;
  try{if(S.click(ev,canvas)){ev.stopImmediatePropagation();ev.preventDefault()}}catch(e){fail(e)}},true);
}

/* ---------- ligações ---------- */
const update0=window.update;
window.update=function(dt){
 const r=update0.apply(this,arguments);
 if(!S.on||!started||ended||!(dt>0))return r;
 try{
  if(window.PXFORT?.isPrep?.())return r;
  fireTick(dt);
  tickT-=dt;if(tickT<=0){tickT=S.cfg.TICK;for(const g of G.slice())stepGroup(g)}
  panelT-=dt;if(panelT<=0){panelT=.4;paintPanel()}
 }catch(e){fail(e)}
 return r;
};
const setup0=window.setup;
window.setup=function(){G=[];gid=0;focus=null;S.pings=[];const r=setup0.apply(this,arguments);for(const u of units)u.gid=null;return r};
S.state=()=>({on:S.on,groups:G.map(g=>({id:g.id,name:g.name,team:g.team,kind:g.kind,state:g.state,n:g.units.filter(live).length,n0:g.n0,mission:g.mission,msg:g.msg,ent:g.ent&&g.ent.name,ai:g.ai})),stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.orders=S;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
