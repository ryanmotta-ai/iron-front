/* Comandante dinâmico 1.15 — a IA deixa de esperar e passa a forçar contato, combinar armas e construir à frente.
   Medido antes (sandbox, 80 %, 600 s): só 7–9 % da tropa a < 260 px de um inimigo, 38–59 % parada, engenheiros 2/3 ociosos,
   8 bombas e 38 rasantes em 420 s. Este módulo NÃO substitui o plano de operações (operations.js): ele o complementa por cima.
   · PATRULHAS DE SONDAGEM — grupos de 4–8 fuzileiros tirados dos ociosos/passivos vão ao terreno entre as linhas (PXORD.advance), forçam
     contato, revelam posições (que alimentam artilharia e aviação) e recuam sem se deixar dizimar; no fundo, sondam mais 1 salto se o inimigo é fraco.
   · PREPARAÇÃO DO ATAQUE — quando a operação entra em "avançar": aviação sobre a linha inimiga, salva de artilharia e um grupo de flanco.
   · RITMO — vigia progresso (contato, avanço, estruturas) e acelera o plano de operações quando a frente emperra.
   · DOUTRINA — cada comandante sorteia uma personalidade por partida (relâmpago, artilheiro, aviador, infiltrador, elástico), o que muda a partida.
   Liga/desliga: ?comandante=0 · API: IronFront.commander (state, metrics, log, doctrine). */
(function(){
'use strict';
if(typeof update!=='function'||typeof units==='undefined')return;
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const S=window.PXCMD={on:!/[?&]comandante=0/.test(location.search),version:'1.0',
 cfg:{TICK:1,THINK:2,PATROL_MIN:4,PATROL_MAX:8,PATROL_SHARE:.3,PATROL_LIFE:75,PATROL_LOSS:.45,PATROL_GAP:[7,13],RANGE_ATK:1300,RANGE_DEF:700,
  PUSH_COOL:40,PUSH_FLANK:8,SAMPLE:5,TOAST_GAP:9,LOG:40,MEM:150},
 stats:{patrols:0,deeper:0,retreats:0,pushes:0,flanks:0,pushAir:0,pushArty:0,offensives:0,offWaits:0,offWins:0,offFails:0,errors:0},
 team:[null,null],log:[],m:{contact:[0,0],still:[0,0],n:0,mov:[0,0]}};
let errs=0,tickT=0,sampleT=0,toastAt=-99;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('commander.js:',e);if(errs>=12){S.on=false;console.error('commander.js desligado após erros repetidos')}}
const flag=n=>new RegExp('[?&]'+n+'=0').test(location.search);   // ?patrulhas=0 · ?ofensiva=0 · ?apoioaereo=0 · ?varredura=0 · ?ritmoaereo=0 · ?obras=0 · ?camera=0 desligam cada parte (para medir)
const O=()=>window.PXORD,B=()=>window.IronFrontBrain,AC=()=>window.IronFrontAirCommand,P=()=>window.IronFrontAirPolicy;
const live=u=>u&&u.hp>0&&!u.down&&!u.rs&&!u.carried&&!u.inBed;
const combat=u=>live(u)&&!u.sap&&u.cls!=='medic'&&u.cls!=='mechanic';
const NAME=['EUA','ALEMANHA'],VAL={rifle:10,mg:26,tank:70,cavalry:24,bunker:40};
const centroid=us=>{let x=0,y=0;for(const u of us){x+=u.x;y+=u.y}return us.length?{x:x/us.length,y:y/us.length}:{x:0,y:0}};
const ground=()=>typeof GH==='number'?GH:1600;

/* ---------- doutrinas: pacotes de parâmetros, sorteados por comandante a cada partida ---------- */
const DOCT={
 relampago:{name:'Relâmpago',tempo:1.5,patrols:1.2,push:1.25,air:1,arty:1,raid:1.3,build:1,say:'avançar rápido, sem dar tempo ao inimigo'},
 artilheiro:{name:'Artilheiro',tempo:1,patrols:.8,push:1,air:1,arty:1.8,raid:1,build:1.2,say:'abrir a linha com fogo pesado antes de a infantaria entrar'},
 aviador:{name:'Aviador',tempo:1.1,patrols:.9,push:1,air:1.9,arty:.9,raid:1,build:1,say:'dominar o céu e castigar por cima'},
 infiltrador:{name:'Infiltrador',tempo:1.15,patrols:1.7,push:1.1,air:1,arty:.9,raid:1.7,build:.9,say:'sondar, flanquear e atacar onde o inimigo está fraco'},
 elastico:{name:'Defesa elástica',tempo:.9,patrols:1.3,push:.8,air:1.2,arty:1.2,raid:1.1,build:1.7,say:'segurar, desgastar com contra-ataques e fortificar'}};
const doctOf=t=>S.team[t]?.doct||DOCT.relampago;
function newTeam(t){return {doct:null,patrols:[],nextPatrol:time+rnd(10,20),probed:[],lastPush:-1,pushAt:-99,flankAt:-99,off:fresh(),mem:new Map()}}
function pickDoctrine(t){const keys=Object.keys(DOCT);const roles=window.ROLES||[];
 // quem defende tende à defesa elástica; quem ataca, a uma das outras (sorteio simples por partida)
 const pool=roles[t]==='defend'?['elastico','infiltrador','artilheiro','aviador']:['relampago','artilheiro','aviador','infiltrador'];
 return DOCT[pool[Math.floor(Math.random()*pool.length)]]||DOCT[keys[0]]}

/* registro de decisões (S.log, painel IA). Aviso na tela: quem assiste IA×IA vê tudo; quem comanda um lado só vê alertas de ataque inimigo (nunca os planos do adversário) */
function say(team,text,opts={}){
 S.log.push({t:Math.round(time),team,text});if(S.log.length>S.cfg.LOG)S.log.shift();
 if(opts.quiet||typeof toast!=='function')return;
 if(time-toastAt<S.cfg.TOAST_GAP)return;
 const spectating=!!aiEnabled[playerTeam];
 if(!spectating&&!(team!==playerTeam&&opts.alert))return;
 toastAt=time;toast(opts.alert&&!spectating?`ALERTA: ${text}`:`${NAME[team]}: ${text}`)}
/* dificuldade (só vale para o adversário de quem comanda um lado): recruta ataca mais devagar, general mais depressa */
const strength=team=>aiEnabled[playerTeam]||team===playerTeam?1:(typeof difficulty==='string'&&difficulty==='hard'?1.3:difficulty==='easy'?.75:1);

/* tempo de combate: conta a partir do fim da trégua de preparação (a IA constrói e reconhece antes de atacar) */
let battleAt=null,prepSeen=false;
function battleClock(){return battleAt===null?0:time-battleAt}
function battleTrack(){const prep=!!window.PXFORT?.isPrep?.();if(prep)prepSeen=true;if(battleAt===null&&!prep)battleAt=time}
/* ---------- conhecimento do campo ---------- */
function known(team){try{
 const fresh=(B()?.operations?.contacts(team)||[]).filter(e=>e.hp>0&&time-e.at<25),t=S.team[team];if(!t||!t.mem)return fresh;
 const ids=new Set(fresh.map(e=>e.id)),out=fresh.slice();
 for(const [id,e] of t.mem){if(ids.has(id)||time-e.at>S.cfg.MEM)continue;out.push(e)}
 return out}catch(e){return []}}
/* lembra as ameaças que não saem do lugar (MG, bunker): o contato some quando o campo some da vista, a trincheira continua lá */
function remember(team){
 const t=S.team[team];if(!t.mem)t.mem=new Map();
 try{for(const e of (B()?.operations?.contacts(team)||[]))if(e.hp>0&&e.type==='mg')t.mem.set(e.id,{id:e.id,team:e.team,type:e.type,x:e.x,y:e.y,hp:e.hp,at:time,mem:true})}catch(e){}
 const T=window.PXSTRUCT;if(T)for(const e of T.list)if(e.team!==team&&!e.destroyed&&e.kind==='bunker'&&T.known(e,team))t.mem.set('b'+e.id,{id:'b'+e.id,team:e.team,type:'bunker',x:e.x,y:e.y,hp:e.hp||1,at:time,mem:true});
 for(const [id,e] of t.mem){if(time-e.at>S.cfg.MEM){t.mem.delete(id);continue}const u=typeof id==='number'?units.find(q=>q.id===id):null;if(u&&(u.hp<=0||u.down))t.mem.delete(id)}}
function foeValue(foes,x,y,r){let v=0;for(const e of foes)if(Math.abs(e.x-x)<r&&Math.abs(e.y-y)<r&&hyp(e.x-x,e.y-y)<r)v+=VAL[e.type]||10;return v}

/* ---------- métricas (o que o usuário enxerga: contato e movimento) ---------- */
let prevPos=new Map();
function sample(){
 const m=S.m;m.n++;
 for(const t of [0,1]){
  const us=units.filter(u=>u.team===t&&combat(u)),foes=units.filter(u=>u.team!==t&&u.hp>0&&!u.down);
  let c=0,still=0;
  for(const u of us){
   for(const e of foes)if(Math.abs(e.x-u.x)<260&&Math.abs(e.y-u.y)<260&&hyp(e.x-u.x,e.y-u.y)<260){c++;break}
   const p=prevPos.get(u);if(p&&hyp(u.x-p.x,u.y-p.y)<2.5)still++;prevPos.set(u,{x:u.x,y:u.y});
  }
  m.contact[t]+=c/Math.max(1,us.length);m.still[t]+=still/Math.max(1,us.length);
 }
 if(prevPos.size>900)prevPos=new Map();
}
S.metrics=()=>{const n=Math.max(1,S.m.n);return {samples:S.m.n,contact:S.m.contact.map(v=>+(v/n).toFixed(3)),still:S.m.still.map(v=>+(v/n).toFixed(3))}};

/* ---------- 1) patrulhas de sondagem ---------- */
const PASSIVE=new Set(['reagrupamento','posição-defensiva','guarda-objetivo','reserva-movel','defesa','base-de-assalto','fogo-cruzado','reunindo-esquadrao','','-',undefined]);
function patrolPool(team){
 const o=O();if(!o)return [];
 const free=o.free(team).filter(u=>u.type==='rifle'&&!u.mgc&&u.cls!=='marksman'&&u.hp>u.maxhp*.7&&!(u.suppression>.4)&&!(u.underFire>0)&&!(u.target&&u.target.hp>0)&&!u.sh&&!u.inBunk&&PASSIVE.has(u.aiRole));
 return free;
}
function probeGoal(team,seed,range){
 const d=team?-1:1,foes=known(team),cands=[],t=S.team[team];
 for(const a of fieldTrenches)if(a.team!==team&&a.hp>0)cands.push({x:a.x,y:a.y,k:'trench'});
 for(const e of foes)cands.push({x:e.x,y:e.y,k:'contact',type:e.type});
 let best=null,bs=-1e9;
 for(const c of cands){
  const ahead=d*(c.x-seed.x);if(ahead<120||ahead>range)continue;
  const gx=clamp(c.x-d*(200+rnd(0,70)),60,W-60),gy=clamp(c.y+rnd(-70,70),60,ground()-60);
  const str=foeValue(foes,c.x,c.y,260);
  if(str>140)continue;
  if(t.patrols.some(p=>hyp(p.goal.x-gx,p.goal.y-gy)<230))continue;
  const recent=t.probed.filter(p=>time-p.t<55&&hyp(p.x-gx,p.y-gy)<260).length;
  const sc=100-ahead*.05-str*.55+(c.k==='contact'?(c.type==='mg'?-10:14):0)-recent*45+(coverageAt(foes,c.x,c.y)<2?18:0)+rnd(0,16);   // prefere sondar onde ainda não se sabe nada
  if(sc>bs){bs=sc;best={x:gx,y:gy,k:c.k}}
 }
 if(!best){ // sem referência conhecida: um ponto da terra de ninguém, em uma faixa ainda não sondada
  const mid=W/2+d*rnd(-80,300),gy=clamp(rnd(160,ground()-160),60,ground()-60);
  if(!t.patrols.some(p=>hyp(p.goal.x-mid,p.goal.y-gy)<260))best={x:mid,y:gy,k:'terra'}}
 return best;
}
function spawnPatrol(team){
 const t=S.team[team],o=O();if(!o)return false;
 const doct=doctOf(team),own=units.filter(u=>u.team===team&&combat(u)).length;
 const max=clamp(Math.round(own/20*doct.patrols),2,6),active=t.patrols.reduce((n,p)=>n+p.g.units.length,0);
 if(t.patrols.length>=max||active>own*S.cfg.PATROL_SHARE)return false;
 const pool=patrolPool(team);if(pool.length<S.cfg.PATROL_MIN)return false;
 // semente: o ocioso mais adiantado, para que a patrulha parta da frente e não da retaguarda
 const d=team?-1:1,seed=pool.reduce((a,b)=>d*b.x>d*a.x?b:a);
 const squad=pool.filter(u=>hyp(u.x-seed.x,u.y-seed.y)<330).sort((a,b)=>hyp(a.x-seed.x,a.y-seed.y)-hyp(b.x-seed.x,b.y-seed.y)).slice(0,clamp(Math.round(own/12),S.cfg.PATROL_MIN,S.cfg.PATROL_MAX));
 if(squad.length<S.cfg.PATROL_MIN)return false;
 const role=window.ROLES?.[team],range=role==='defend'?S.cfg.RANGE_DEF:S.cfg.RANGE_ATK,c=centroid(squad);
 const goal=probeGoal(team,c,range);if(!goal)return false;
 const g=o.advance(squad,goal.x,goal.y,{ai:true,via:'patrulha'});if(!g)return false;
 g.mission='Patrulha de sondagem';
 t.patrols.push({g,t0:time,n0:squad.length,goal,stage:0});t.probed.push({x:goal.x,y:goal.y,t:time});if(t.probed.length>14)t.probed.shift();
 S.stats.patrols++;return true;
}
function patrolTick(team){
 const t=S.team[team],o=O();if(!o)return;const groups=o.groups();
 for(const p of t.patrols.slice()){
  const g=p.g;
  if(!groups.includes(g)||g.state==='done'){t.patrols.splice(t.patrols.indexOf(p),1);continue}
  const us=g.units.filter(live),frac=us.length/Math.max(1,p.n0);
  if(g.state==='retreat')continue;
  if(frac<1-S.cfg.PATROL_LOSS||time-p.t0>S.cfg.PATROL_LIFE||us.length<2){o.retreat(g);S.stats.retreats++;continue}
  if(g.state==='arrived'&&p.stage===0&&frac>=.8){
   // chegou sem sofrer: o inimigo aqui é fraco? sonda um salto mais fundo (uma vez)
   const d=team?-1:1,c=centroid(us),str=foeValue(known(team),c.x+d*200,c.y,260);
   if(str<=VAL.rifle*us.length*.9){p.stage=1;const gx=clamp(c.x+d*190,60,W-60);p.goal={x:gx,y:c.y,k:'fundo'};g.goal={x:gx,y:c.y};g.state='approach';g.since=time;g.doneAt=undefined;g.progress=time;g.lastD=Infinity;S.stats.deeper++}
  }
 }
 if(time>=t.nextPatrol){const doct=doctOf(team);t.nextPatrol=time+rnd(...S.cfg.PATROL_GAP)/doct.patrols/Math.max(.7,doct.tempo)/strength(team);spawnPatrol(team)}
}

/* ---------- 2) preparação do ataque: quando a operação entra em "avançar" ---------- */
function launchPush(team,op){
 const t=S.team[team],doct=doctOf(team),obj=op.objective||op,foes=known(team);
 if(!obj||!Number.isFinite(obj.x))return;
 const near=foes.filter(e=>hyp(e.x-obj.x,e.y-obj.y)<420||Math.abs(e.y-obj.y)<200&&(team?e.x<obj.x+420:e.x>obj.x-420)&&hyp(e.x-obj.x,e.y-obj.y)<700);
 let cx=obj.x,cy=obj.y,w=0;if(near.length){cx=cy=0;for(const e of near){const v=VAL[e.type]||10;cx+=e.x*v;cy+=e.y*v;w+=v}cx/=w;cy/=w}
 S.stats.pushes++;t.pushAt=time;let did=[];
 // (a) aviação sobre a linha que vai ser atacada
 if(near.length>=3&&AC()?.request&&window.PXAW?.on&&Math.random()<Math.min(1,.55*doct.air)){
  const kind=w>=110&&Math.random()<.6?'bmb':'atk';
  const f=AC().request(team,kind,cx,cy,{n:kind==='bmb'?1:2,reason:'Preparar a ofensiva: castigar a linha inimiga'});
  if(f){S.stats.pushAir++;did.push(kind==='bmb'?'bombardeio':'ataque aéreo')}}
 // (b) salva de artilharia (se o jogo tem artilharia e dinheiro)
 if(near.length>=3&&Math.random()<Math.min(1,.5*doct.arty)&&fireOn(team,cx,cy,'he')){S.stats.pushArty++;did.push('artilharia')}   // fireOn: bateria operacional + reserva de caixa em conquista
 // (c) grupo de flanco, partindo dos livres que estão mais perto da frente
 if(time-t.flankAt>S.cfg.PUSH_COOL&&O()){
  const d=team?-1:1,pool=O().free(team).filter(u=>(u.type==='rifle'||u.type==='mg')&&u.cls!=='marksman'&&u.hp>u.maxhp*.6&&PASSIVE.has(u.aiRole));
  if(pool.length>=S.cfg.PUSH_FLANK){
   const seed=pool.reduce((a,b)=>d*b.x>d*a.x?b:a),us=pool.filter(u=>hyp(u.x-seed.x,u.y-seed.y)<420).sort((a,b)=>hyp(a.x-seed.x,a.y-seed.y)-hyp(b.x-seed.x,b.y-seed.y)).slice(0,12);
   if(us.length>=S.cfg.PUSH_FLANK){
    const c=centroid(us),sideN=foeValue(foes,obj.x,obj.y-380,300),sideS=foeValue(foes,obj.x,obj.y+380,300),side=sideN<=sideS?-1:1;
    const wp={x:clamp((c.x+obj.x)/2,60,W-60),y:clamp(obj.y+side*(330+rnd(0,70)),60,ground()-60)};
    const g=O().advance(us,clamp(obj.x-d*140,60,W-60),clamp(obj.y+side*150,60,ground()-60),{ai:true,via:'flanco'});
    if(g){g.wp=wp;g.state='flank';g.mission='Flanco da ofensiva';t.flankAt=time;S.stats.flanks++;did.push('flanco '+(side<0?'norte':'sul'))}}}}
 if(did.length)say(team,`ofensiva em ${op.sector!==undefined&&B()?.lastPlans?.[team]?.sectors?.[op.sector]?.name||'setor'}: ${did.join(' + ')}.`);
}
function pushTick(team){
 const t=S.team[team],plan=B()?.lastPlans?.[team],op=plan?.operation;if(!op)return;
 if(op.phase==='advance'&&t.lastPush!==op.since){t.lastPush=op.since;if(time-t.pushAt>S.cfg.PUSH_COOL*.5)launchPush(team,op)}
}

/* ---------- 3) OFENSIVA: concentrar, preparar com fogo, assaltar em colunas e consolidar ----------
   Medido: em "avançar" só 15–25 de ~60 homens atacavam, o resto parava (reserva móvel, pressão secundária, guarda, agrupamento) e o
   spreadPlan espalhava os esquadrões por ~1500 px; a ponta de lança perdia 35 % e recuava em ~50 s (5 de 5 ciclos).
   Aqui o comandante escolhe UMA faixa (a mais fraca que ele conhece, perto de onde a tropa já está), reúne ~70 % dos livres num ponto de partida,
   prepara com artilharia/fumaça/aviação, e lança 3 colunas (centro com blindados e MG; flancos por waypoints) em ondas defasadas. Cada coluna
   é um grupo do PXORD (cobertura, paradas e decisões da IA já prontas). Termina em consolidação (segura 25 s), ou recua se perde > 45 %. */
const OFF_CFG={COOL_OK:22,COOL_FAIL:45,SETUP:30,MAX:210,MIN_FREE:16,MAXN:60,KEEP:.1,LOSS:.5,BELT:520,WAVE2:13,HOLD:40,GARRISON:300,GARRISON_MIN:.4,LANES:5,INTEL_WAIT:70,INTEL_MAX:130,COVER:3,RATIO:1.5,BARRAGE:9,BARRAGE_N:5,RUSH:true,TANK_LAG:8};
S.cfg.OFF=OFF_CFG;
const fresh=()=>({phase:'idle',since:0,lane:2,groups:[],n0:0,coolUntil:0,fail:[0,0,0,0,0],win:[0,0,0,0,0],limited:false,count:0,tl:[]});
const LANE_YS=[200,360,520,680,840,1000,1160,1320];   // a faixa de baixo (y > 1400) é a entrada do aeródromo: não é frente de infantaria
const bucket=y=>clamp(Math.floor(y/(ground()/OFF_CFG.LANES)),0,OFF_CFG.LANES-1);
function heldByUs(team,a){let n=0;for(const u of units)if(u.team===team&&u.hp>0&&!u.down&&Math.abs(u.x-a.x)<90&&Math.abs(u.y-a.y)<60)if(++n>=3)return true;return false}
function beltX(team,y){ // x da trincheira inimiga mais próxima da nossa faixa que ainda não é nossa (a linha que vamos atacar)
 const d=team?-1:1;let best=null,bd=1e9;
 for(const a of fieldTrenches){if(a.team===team||a.hp<=0||Math.abs(a.y-y)>260||heldByUs(team,a))continue;const k=d*a.x;if(k<bd){bd=k;best=a}}
 return best?best.x:(team?W*.30:W*.70)}
/* perigo de uma faixa: inimigos conhecidos perto da linha de ataque; MG e bunker valem o dobro (são eles que fazem a carnificina) */
function dangerAt(foes,bx,y){let v=0;for(const e of foes){if(Math.abs(e.y-y)>380||Math.abs(e.x-bx)>430)continue;const dd=hyp(e.x-bx,e.y-y);if(dd>430)continue;
 v+=(VAL[e.type]||10)*(e.type==='mg'||e.type==='bunker'?2:1)*(1-dd/750)}return v}
/* quantos contatos (vistos agora ou lembrados) cobrem a linha daquela faixa: sem informação, atacar é apostar às cegas */
function coverageAt(foes,bx,y){let n=0;for(const e of foes)if(Math.abs(e.y-y)<420&&Math.abs(e.x-bx)<650)n++;return n}
S.coverageAt=coverageAt;
function pickLane(team,pool,foes){
 const o=S.team[team].off,op=B()?.lastPlans?.[team]?.operation;let best=null;
 const ys=pool.map(u=>u.y).sort((a,b)=>a-b),mid=ys[Math.floor(ys.length/2)];   // onde a tropa livre está: a faixa escolhida tem de ficar perto dela
 for(const y of LANE_YS){
  if(Math.abs(y-mid)>520)continue;
  const bx=beltX(team,y),near=pool.filter(u=>Math.abs(u.y-y)<520).length,dng=dangerAt(foes,bx,y),b=bucket(y),cov=coverageAt(foes,bx,y);
  const score=near*4-dng*1.1-o.fail[b]*55+o.win[b]*10+(op&&op.sector===b?18:0)+(cov>=OFF_CFG.COVER?25:-30)+rnd(0,14);
  if(!best||score>best.score)best={y,bx,near,dng,b,cov,score}}
 return best}
function offPool(team){
 const o=O();if(!o)return [];
 return o.free(team).filter(u=>(u.type==='rifle'||u.type==='mg'||u.type==='tank')&&u.cls!=='marksman'&&u.hp>u.maxhp*.55&&!(u.suppression>.5)&&u.aiRole!=='guarda-objetivo'&&!u.sh&&!u.mgc&&!(u.type==='tank'&&(u.atr?.bog>time||u.pv?.stun>0)));
}
function canOffend(team){
 const role=window.ROLES?.[team],o=S.team[team].off;
 if(role==='defend'){ // o defensor só contra-ataca quando o inimigo acabou de falhar ou está em desvantagem
  const foe=B()?.lastPlans?.[1-team]?.operation,sup=window.IronFront?.victory?.state?.().superiority;
  const mine=sup?sup[team]:50;
  if(!((foe&&foe.phase==='withdraw'&&time-foe.since<40)||mine>=58))return false;
  o.limited=true}
 else o.limited=false;
 return true}
function startOffensive(team){
 const t=S.team[team],o=t.off,doct=doctOf(team);
 const pool=offPool(team);if(pool.length<OFF_CFG.MIN_FREE){o.coolUntil=time+6;return false}
 const foes=known(team),best=pickLane(team,pool,foes);
 if(!best)return false;
 // só ataca com informação (ou depois de dar tempo às patrulhas e à aviação) e com superioridade local sobre o que conhece
 const ours=pool.reduce((n,u)=>n+(VAL[u.type]||10),0),mem=t.mem?t.mem.size:0;
 const bt=battleClock();
 if(bt<OFF_CFG.INTEL_WAIT||best.cov<OFF_CFG.COVER&&bt<OFF_CFG.INTEL_MAX){o.coolUntil=time+6;S.stats.offWaits++;
  // sem informação: manda o reconhecimento aéreo olhar a faixa escolhida (1 pedido por minuto)
  if(bt>=15&&time>=(o.reconAt||0)&&AC()?.request&&window.PXAW?.on){o.reconAt=time+60;if(AC().request(team,'rec',clamp(best.bx,100,W-100),best.y,{reason:'Reconhecer a faixa escolhida antes da ofensiva'}))S.stats.reconAsked=(S.stats.reconAsked||0)+1}
  return false}
 if(ours<Math.max(160,best.dng*OFF_CFG.RATIO)){o.coolUntil=time+8;S.stats.offWaits++;return false}
 const d=team?-1:1,bx=best.bx,jx=clamp(bx-d*OFF_CFG.BELT,80,W-80),jy=clamp(best.y,120,ground()-120);
 // quem vai: os mais próximos do ponto de partida; o resto (os mais afastados) fica de reserva
 const sorted=pool.slice().sort((a,b)=>hyp(a.x-jx,a.y-jy)-hyp(b.x-jx,b.y-jy));
 // os blindados (poucos e decisivos) entram sempre que estão ao alcance, mesmo se a infantaria mais perto já encheu a lista
 const tk=sorted.filter(u=>u.type==='tank'&&hyp(u.x-jx,u.y-jy)<1100).slice(0,3);if(tk.length){const rest=sorted.filter(u=>!tk.includes(u));sorted.length=0;sorted.push(...tk,...rest)}
 const all=units.filter(u=>u.team===team&&combat(u)).length,reserve=Math.max(3,Math.ceil(all*OFF_CFG.KEEP*(doct.push>1?.8:1)));
 const n=Math.min(OFF_CFG.MAXN,o.limited?Math.round(pool.length*.5):pool.length-reserve,sorted.length);
 if(n<OFF_CFG.MIN_FREE*.8)return false;
 const pick=sorted.slice(0,n),tanks=pick.filter(u=>u.type==='tank'),mgs=pick.filter(u=>u.type==='mg'),rifles=pick.filter(u=>u.type==='rifle');
 const flankShare=doct.name==='Infiltrador'?.4:.2;
 // um flanco só existe se o lado dele não for muito mais perigoso que o centro
 const dN=dangerAt(foes,bx,jy-250),dS=dangerAt(foes,bx,jy+250),okN=dN<=best.dng*1.8+50,okS=dS<=best.dng*1.8+50;
 const nf=Math.max(3,Math.round(rifles.length*flankShare));
 const ry=rifles.slice().sort((a,b)=>a.y-b.y);let north=okN?ry.slice(0,nf):[],south=okS?ry.slice(ry.length-nf):[];
 const mid=ry.filter(u=>!north.includes(u)&&!south.includes(u));
 const centre=[...mid,...mgs],defs=[
  {name:'blindados',us:tanks,j:{x:jx+d*70,y:jy},wp:null,goal:{x:clamp(bx+d*60,60,W-60),y:jy},side:0,tank:true},
  {name:'centro',us:centre,j:{x:jx,y:jy},wp:null,goal:{x:clamp(bx+d*60,60,W-60),y:jy},side:0},
  {name:'flanco norte',us:north,j:{x:jx-d*40,y:clamp(jy-250,80,ground()-80)},wp:{x:clamp((jx+bx)/2,60,W-60),y:clamp(jy-320,60,ground()-60)},goal:{x:clamp(bx+d*40,60,W-60),y:clamp(jy-170,60,ground()-60)},side:-1},
  {name:'flanco sul',us:south,j:{x:jx-d*40,y:clamp(jy+250,80,ground()-80)},wp:{x:clamp((jx+bx)/2,60,W-60),y:clamp(jy+320,60,ground()-60)},goal:{x:clamp(bx+d*40,60,W-60),y:clamp(jy+170,60,ground()-60)},side:1}];
 o.groups=[];o.n0=0;
 for(const df of defs){if(df.us.length<(df.tank?1:3))continue;
  const g=O().advance(df.us,df.j.x,df.j.y,{ai:true,via:'ofensiva'});if(!g)continue;g.mission='Ofensiva: '+df.name;
  o.groups.push({g,def:df,n0:df.us.length,stage:0,ids:df.us.map(u=>u.id)});o.n0+=df.us.length}
 if(!o.groups.length)return false;
 Object.assign(o,{phase:'setup',since:time,lane:best.b,bx,jx,jy,count:o.count+1,tl:[],prepped:false,deep:false,danger:Math.round(best.dng),ids:new Set(pick.map(u=>u.id))});
 const nm=['extremo norte','norte','centro','sul','extremo sul'][best.b];
 S.stats.offensives++;
 say(team,`${o.limited?'contra-ataque':'ofensiva'} no ${nm}: ${o.n0} homens em ${o.groups.length} colunas${tanks.length?`, ${tanks.length} blindado${tanks.length>1?'s':''}`:''} (perigo conhecido ${o.danger}).`);
 return true;
}
/* há bateria com guarnição e munição? (sem isso o PXBAT avisa "nenhuma bateria operacional" ao jogador e devolve o custo: a IA não deve pedir) */
function artyReady(team){const B=window.PXBAT;if(!B||!B.active||!B.active())return true;      // sem baterias no mapa: salva abstrata do jogo antigo
 try{return typeof B.status==='function'?B.status(team).operational>0:B.batteries.some(b=>b.team===team&&b.ammo>0&&b.crew&&b.crew.some(c=>c.alive))}catch(e){return false}}
function fireOn(team,x,y,kind){ // artilharia (ou salva simples): a conta vai para o caixa da facção
 if(!artyReady(team))return false;
 if(!sandbox&&supplies[team]<(defs.artillery?.cost||160)+(kind==='smoke'?200:300))return false;   // em conquista o dinheiro também repõe a tropa: a preparação de fogo não esvazia o caixa
 if(typeof spend!=='function'||!spend('artillery',team,false))return false;
 try{
  if(window.PXBAT?.active?.()){if(PXBAT.mission(team,x,y,kind==='smoke'?5:7,kind==='smoke'?75:85,kind==='smoke'?'smoke':'auto',false,kind==='smoke'))return true}
  if(kind==='smoke')return false;
  for(let i=0;i<6;i++)shells.push({x:x+rnd(-85,85),y:y+rnd(-85,85),t:2.7+i*.3,r:65,team});return true
 }catch(e){return false}}
function prepFire(team,o,stage){
 const doct=doctOf(team),foes=known(team),y=o.jy,near=foes.filter(e=>Math.abs(e.y-y)<260&&Math.abs(e.x-o.bx)<300);
 let cx=o.bx,cy=y;if(near.length){let w=0;cx=cy=0;for(const e of near){const v=VAL[e.type]||10;cx+=e.x*v;cy+=e.y*v;w+=v}cx/=w;cy/=w}
 const did=[];
 if(stage==='setup'){
  if(Math.random()<Math.min(1,.8*doct.arty)&&fireOn(team,cx,cy,'he')){S.stats.pushArty++;did.push('artilharia')}
  if(AC()?.request&&window.PXAW?.on&&Math.random()<Math.min(1,.75*doct.air)&&near.length>=2){
   const kind=near.length>=6&&Math.random()<.5?'bmb':'atk',f=AC().request(team,kind,cx,cy,{n:kind==='bmb'?1:2,reason:'Preparar a ofensiva: castigar a linha inimiga'});
   if(f){S.stats.pushAir++;did.push(kind==='bmb'?'bombardeio':'caças')}}
 }else if(stage==='assault'){
  const d=team?-1:1;
  if(AC()?.request&&window.PXAW?.on&&Math.random()<Math.min(1,.8*doct.air)){const f=AC().request(team,'atk',cx,cy,{n:2,reason:'Acompanhar o assalto: metralhar a linha'});if(f){S.stats.pushAir++;did.push('caças')}}
  if(fireOn(team,o.bx+d*10,y,'smoke'))did.push('fumaça');
  if(Math.random()<Math.min(1,.7*doct.arty)&&fireOn(team,cx,cy,'he')){S.stats.pushArty++;did.push('barragem')}
 }
 if(did.length)say(team,`preparação (${did.join(', ')}).`,{quiet:true});
}
function assaultStart(team,o){
 const d=team?-1:1,hasTanks=o.groups.some(e=>e.def.tank&&e.g&&e.g.units.some(live));o.phase='assault';o.since=time;
 prepFire(team,o,'assault');
 for(const e of o.groups){
  const old=e.g,us=old?old.units.filter(live):[];if(!us.length)continue;
  O().end(old,'cmd');
  // 2.ª onda: metade dos fuzileiros do centro sai ~13 s depois
  const rf=us.filter(u=>u.type==='rifle'),second=e.def.side===0&&!e.def.tank?rf.slice(0,Math.floor(rf.length/2)):[];
  const first=us.filter(u=>!second.includes(u));
  const mk=(list,delay,tag)=>{if(!list.length)return null;
   const g=O().advance(list,e.def.goal.x,e.def.goal.y,{ai:true,via:'ofensiva',capture:false});if(!g)return null;
   g.mission='Ofensiva: '+e.def.name+(tag?' ('+tag+')':'');g.rush=OFF_CFG.RUSH;
   if(delay>0){g.state='waiting';g.wait=true;o.tl.push({at:time+delay,g,fn:'release'})}
   else if(e.def.wp){g.wp=e.def.wp;g.state='flank'}
   return g};
  // os blindados (28 px/s) saem antes da infantaria (47 px/s): a diferença na travessia de ~520 px é ~8 s
  const g1=mk(first,e.def.tank||!hasTanks?0:OFF_CFG.TANK_LAG,'');e.g=g1;
  if(second.length){const g2=mk(second,OFF_CFG.WAVE2,'2.ª onda');if(g2)e.second=g2}
 }
 say(team,`assalto lançado: ${o.groups.length} colunas para o ${d>0?'leste':'oeste'}.`,{alert:true});
}
function alive(o){let n=0;if(o.ids)for(const u of units)if(o.ids.has(u.id)&&u.hp>0)n++;return n}   // por id: o PXORD encerra grupos que chegam, e isso não é baixa
/* linha tomada = linha guarnecida: o grupo passa a ocupar os assentos da trincheira inimiga (cobertura de trincheira vale para quem está dentro) */
function garrison(team,o){
 let seated=0;const T_=S.team[team];if(!T_.garrisons)T_.garrisons=[];
 for(const e of o.groups)for(const g of [e.g,e.second]){
  if(!g||!O().groups().includes(g))continue;const us=g.units.filter(live);if(us.length<2){O().hold(g);continue}const c=centroid(us);
  let tr=null,bd=1e9;for(const a of fieldTrenches){if(a.team===team||a.hp<=0)continue;const dd=hyp(a.x-c.x,a.y-c.y);if(dd<bd){bd=dd;tr=a}}
  if(!tr||bd>260){O().hold(g);continue}                               // longe de qualquer trincheira: só segura
  O().end(g,'cmd');const og=O().occupy(us,tr,{ai:true,via:'ofensiva'});
  if(og){og.mission='Guarnecer a linha tomada';T_.garrisons.push({g:og,n0:us.length,since:time,x:tr.x,y:tr.y});seated+=us.length}}
 return seated}
/* a guarnição NÃO é liberada por relógio (voltaria para as linhas de trás e o terreno ganho se perderia): fica até cair abaixo de 40 % ou passar de GARRISON s;
   no máximo 35 % do exército guarnecendo (o excedente mais antigo é liberado) */
function garrisonTick(team){
 const T_=S.team[team];if(!T_.garrisons||!T_.garrisons.length||!O())return;const groups=O().groups();
 const all=units.filter(u=>u.team===team&&combat(u)).length;
 T_.garrisons=T_.garrisons.filter(e=>{
  if(!groups.includes(e.g))return false;
  const n=e.g.units.filter(live).length;
  if(n<Math.max(2,e.n0*OFF_CFG.GARRISON_MIN)||time-e.since>OFF_CFG.GARRISON){O().end(e.g,'done');S.stats.garrisonsReleased=(S.stats.garrisonsReleased||0)+1;return false}
  return true});
 let held=T_.garrisons.reduce((n,e)=>n+e.g.units.filter(live).length,0);
 while(T_.garrisons.length>1&&held>all*.35){const e=T_.garrisons.shift();held-=e.g.units.filter(live).length;O().end(e.g,'done');S.stats.garrisonsReleased=(S.stats.garrisonsReleased||0)+1}}
function endOffensive(team,why,ok){
 const o=S.team[team].off;
 if(ok&&garrison(team,o)){S.stats.garrisons=(S.stats.garrisons||0)+1}
 else for(const e of o.groups)for(const g of [e.g,e.second])if(g&&O().groups().includes(g)){if(ok)O().hold(g);else O().retreat(g)}
 o.releaseAt=time+(ok?OFF_CFG.HOLD:8);o.phase=ok?'hold':'recover';o.since=time;o.why=why;
 if(ok){o.win[o.lane]++;o.fail[o.lane]=Math.max(0,o.fail[o.lane]-1);S.stats.offWins++}else{o.fail[o.lane]++;S.stats.offFails++}
 o.coolUntil=time+((ok?OFF_CFG.COOL_OK:OFF_CFG.COOL_FAIL)/strength(team)+OFF_CFG.HOLD*(ok?1:0));   // sucesso: espera o fim da fase de segurar (40 s) + 22 s
 say(team,ok?`ofensiva concluída: ${why}.`:`ofensiva interrompida: ${why}.`)}
/* barragem rolante: fogo sobre a linha enquanto as colunas se aproximam; ao chegarem perto, o fogo salta para trás da linha (nunca sobre os nossos) */
function barrage(team,o,age,cc){
 if(age>40||time<(o.barrageAt||0))return;o.barrageAt=time+OFF_CFG.BARRAGE;
 const d=team?-1:1,near=d*(o.bx-cc.x),x=near>260?o.bx:o.bx+d*(near>100?170:230);
 if(fireOn(team,clamp(x,60,W-60),o.jy+rnd(-60,60),'he'))S.stats.barrages=(S.stats.barrages||0)+1}
function offTick(team){
 const o=S.team[team].off,groups=O()?.groups();if(!groups)return;
 if(o.phase==='idle'){
  if(time<o.coolUntil||battleClock()<25||window.PXFORT?.isPrep?.())return;
  if(!canOffend(team))return;
  startOffensive(team);return}
 if(o.phase==='hold'||o.phase==='recover'){
  if(time>=o.releaseAt){for(const e of o.groups)for(const g of [e.g,e.second])if(g&&groups.includes(g))O().end(g,'done');o.groups=[];o.phase='idle'}
  return}
 // grupos que o PXORD já encerrou
 for(const e of o.groups){if(e.g&&!groups.includes(e.g))e.g=e.second&&groups.includes(e.second)?e.second:null;if(e.second&&!groups.includes(e.second))e.second=null}
 const n=alive(o),age=time-o.since;
 for(const a of o.tl.slice()){if(time>=a.at){o.tl.splice(o.tl.indexOf(a),1);if(a.fn==='release'&&groups.includes(a.g)){a.g.wait=false;a.g.state='approach';a.g.since=time;a.g.progress=time;a.g.lastD=Infinity}}}
 if(o.phase==='setup'){
  // reunidos (≥ 65 % a menos de 170 px do ponto de partida) ou tempo esgotado
  let at=0,tot=0;for(const e of o.groups)if(e.g)for(const u of e.g.units.filter(live)){tot++;if(hyp(u.x-e.def.j.x,u.y-e.def.j.y)<170)at++}
  if(!o.prepped&&age>5){prepFire(team,o,'setup');o.prepped=true}
  if(tot===0||age>OFF_CFG.SETUP||(at/tot>=.65&&age>8)){
   if(tot<5){endOffensive(team,'tropa insuficiente no ponto de partida',false);return}
   assaultStart(team,o)}
  else for(const e of o.groups)if(e.g&&e.g.state==='arrived')O().hold(e.g);
  return}
 if(o.phase==='assault'){
  const frac=n/Math.max(1,o.n0);
  if(frac<1-OFF_CFG.LOSS){endOffensive(team,`perdas altas (${Math.round((1-frac)*100)} %)`,false);return}
  if(age>OFF_CFG.MAX){endOffensive(team,'tempo esgotado',false);return}
  // objetivo atingido: a coluna do centro chegou, ou a bandeira inimiga foi tomada
  for(const e of o.groups)for(const g of [e.g,e.second])if(g&&groups.includes(g)&&g.state==='arrived')O().hold(g);   // chegou à linha: fica nela (o PXORD encerraria o grupo em 6 s)
  const centre=o.groups.find(e=>e.def.name==='centro')||o.groups[0],flag=points.find(p=>p.owner===team&&p.home===1-team);
  const cu=centre&&centre.g?centre.g.units.filter(live):[],cc=centroid(cu);
  const gx=centre.def.goal.x,gy=centre.def.goal.y,onGoal=units.filter(u=>o.ids&&o.ids.has(u.id)&&u.hp>0&&u.type==='rifle'&&hyp(u.x-gx,u.y-gy)<150).length,rifles=units.filter(u=>o.ids&&o.ids.has(u.id)&&u.hp>0&&u.type==='rifle').length;
  const reached=!o.deep&&rifles>=3&&onGoal>=rifles*.45;
  barrage(team,o,age,cc);
  if(flag||reached){
   // aprofunda uma vez, quando a coluna chegou ilesa e há algo a tomar
   if(!o.deep&&!flag&&frac>=.7&&!o.limited){o.deep=true;o.deepAt=time;
    const tgt=deepTarget(team,o);
    if(tgt){for(const e of o.groups){const g=e.g;if(g&&groups.includes(g)){g.goal={x:tgt.x,y:clamp(tgt.y+e.def.side*90,60,ground()-60)};g.state='approach';g.since=time;g.progress=time;g.lastD=Infinity;g.doneAt=undefined;g.wp=null;g.mission='Ofensiva: '+tgt.what}}
     say(team,`avançando sobre ${tgt.what}.`);return}}
   endOffensive(team,flag?'bandeira inimiga tomada':'linha inimiga ocupada',true);return}
  if(o.deep&&time-o.deepAt>30&&!flag){endOffensive(team,'objetivo em profundidade alcançado',true);return}
  // fogo vivo: coluna parada sob fogo pesado ganha uma salva na MG que a prende e, se há blindado inimigo, apoio aéreo
  for(const e of o.groups){const g=e.g;if(!g||!groups.includes(g))continue;
   if(g.state==='stalled'&&!g.cd.cmdArty&&g.th&&g.th.mgs){g.cd.cmdArty=time;if(O().decide(g,'arty'))S.stats.pushArty++}
   if(g.state==='stalled'&&!g.cd.cmdAir&&g.th&&g.th.tanks&&AC()){g.cd.cmdAir=time;O().decide(g,'air')}}
 }
}
/* o que vem depois da primeira linha: estrutura inimiga conhecida (valor alto) ou a bandeira */
function deepTarget(team,o){
 const d=team?-1:1,T=window.PXSTRUCT;let best=null,bs=-1e9;
 if(T)for(const e of T.list){if(e.team===team||e.destroyed||!T.known(e,team))continue;const ahead=d*(e.x-o.bx);if(ahead<0||ahead>650||Math.abs(e.y-o.jy)>420||e.y>ground()-40)continue;
  const sc=e.value-ahead*.05-Math.abs(e.y-o.jy)*.05;if(sc>bs){bs=sc;best={x:e.x,y:e.y,what:e.name.toLowerCase()}}}
 const fl=points.find(p=>p.owner!==team);if(fl&&Math.abs(fl.y-o.jy)<520&&(!best||bs<30))best={x:fl.x,y:fl.y,what:'a bandeira inimiga'};
 return best}

/* ---------- 4) aviação a serviço da batalha ----------
   Medido (600 s): 7 bombardeios deram 3 bombas, 4 ataques ao solo 0 rasantes, 0 abates em 9 perdas; a política só atacava aglomerados confirmados (≥ 5/9),
   com cooldowns de 100–160 s e uma missão por tipo. Aqui: tempo de missão ~metade, apoio aéreo por DEMANDA (tropa nossa sob fogo com inimigo conhecido à frente,
   MG e blindado pesam mais), limiares menores e varredura de caça contra aeronave inimiga em qualquer ponto. A segurança (P.clear: aliados fora da área) continua valendo. */
const off_=flag;
const AIR_CFG={SCALE:off_('ritmoaereo')?1:.55,ATK_MIN:3.5,BMB_MIN:8,CAS_R:430,CLEAR:175,SWEEP:!off_('varredura'),CAS:!off_('apoioaereo')};
S.cfg.AIR=AIR_CFG;
let cool0=null;
function airClusters(s){ // aglomerados de contatos (conhecidos + MG/bunker lembrados), células de 180 px; MG e blindado pesam mais
 const cells=new Map(),mem=S.team[s.team]?.mem,list=[...(s.contacts||[])];if(mem)for(const e of mem.values())if(time-e.at<S.cfg.MEM)list.push(e);
 for(const e of list){if(e.hp<=0||s.time-(e.at||s.time)>(e.mem?S.cfg.MEM:12))continue;const k=Math.floor(e.x/180)+','+Math.floor(e.y/180),w=e.type==='tank'?4:(e.type==='mg'||e.type==='bunker')?3:1;
  let c=cells.get(k);if(!c)cells.set(k,c={x:0,y:0,n:0,count:0,mg:0});c.x+=e.x*w;c.y+=e.y*w;c.n+=w;c.count++;if(e.type==='mg'||e.type==='bunker')c.mg++}
 return [...cells.values()].map(c=>({...c,x:c.x/c.n,y:c.y/c.n}))}
function hookAir(){
 const Pol=P();if(!S.on||!Pol||!Pol.choose||Pol._choose0)return;
 if(!cool0)cool0={...Pol.cooldown};
 // o apoio aéreo só serve se puder chegar perto de quem está lutando: raio livre de aliados de 220 → 175 px (a checagem na hora do ataque continua em 190)
 if(Pol.clear&&!Pol._clear0){Pol._clear0=Pol.clear;Pol.clear=function(own,x,y,r){if(r===undefined){const t=own&&own[0]?own[0].team:undefined;r=t!==undefined&&S.team[t]&&aiEnabled[t]?AIR_CFG.CLEAR:220}return Pol._clear0.call(this,own,x,y,r)}}   // só a IA ganha a margem menor; ordem manual do jogador segue com 220
 Pol._choose0=Pol.choose;
 Pol.choose=function(s){
  const base=Pol._choose0.call(this,s);
  try{
   if(!S.on||!S.team[s.team]||s.grounded||s.preparing)return base;
   if(base&&(base.kind==='int'||base.kind==='esc'))return base;
   const doct=doctOf(s.team),ready=k=>s.available?.[k]!==false&&s.time>=(s.next[k]||0)&&!s.flights.some(f=>f.kind===k&&f.phase!=='home'&&!f.done);
   const d=s.team?-1:1,hurt=(s.own||[]).filter(u=>u.underFire>0&&!u.sap),cl=airClusters(s);
   // 1) apoio aéreo por demanda: aglomerado inimigo à frente de gente nossa sob fogo
   if(AIR_CFG.CAS&&hurt.length>=2&&(ready('atk')||ready('bmb'))){
    let best=null,bs=0;
    for(const c of cl){const near=hurt.filter(u=>hyp(u.x-c.x,u.y-c.y)<AIR_CFG.CAS_R&&d*(c.x-u.x)>-40).length;if(!near)continue;
     const sc=c.n+near*1.2+c.mg*1.5;if(sc>bs&&P().clear((s.own||[]).filter(u=>u.hp>0&&!u.down),c.x,c.y)){bs=sc;best=c}}
    if(best&&bs>=AIR_CFG.ATK_MIN/doct.air){
     if(best.n>=AIR_CFG.BMB_MIN/doct.air&&ready('bmb')&&['prepare','advance','counter','consolidate'].includes(s.phase))return {kind:'bmb',x:best.x,y:best.y,n:1,reason:'Apoio de fogo: concentração inimiga prendendo a nossa infantaria'};
     if(ready('atk')){S.stats.cas=(S.stats.cas||0)+1;return {kind:'atk',x:best.x,y:best.y,n:2,reason:'Apoio aéreo: infantaria sob fogo pede socorro'}}}}
   // 2) varredura de caça: aeronave inimiga no ar, em qualquer ponto
   if(AIR_CFG.SWEEP&&ready('int')&&window.PXAW){
    const foe=PXAW.planes().filter(a=>a.team!==s.team&&a.air&&!a.dead&&!a.gone&&(a.T?.bombs||a.T?.recon||a.T?.cls==='b'||a.T?.cls==='r'));
    if(foe.length){const t=foe[0];return {kind:'int',x:t.x,y:t.y,reason:'Varredura: caçar o '+(t.T?.name||'aparelho')+' inimigo antes que cumpra a missão'}}}
   // 3) aglomerado grande conhecido, mesmo sem a nossa tropa sob fogo
   if(!base){const g=cl.filter(c=>c.n>=AIR_CFG.ATK_MIN/doct.air+1&&P().clear((s.own||[]).filter(u=>u.hp>0&&!u.down),c.x,c.y)).sort((a,b)=>b.n-a.n)[0];
    if(g&&ready('atk'))return {kind:'atk',x:g.x,y:g.y,n:2,reason:'Neutralizem a posição inimiga marcada'}}
  }catch(e){fail(e)}
  return base;
 };
 // missões mais frequentes (o aeródromo e o teto de aviões continuam limitando)
 for(const k of Object.keys(cool0))Pol.cooldown[k]=Math.max(20,Math.round(cool0[k]*AIR_CFG.SCALE));
}

/* ---------- 5) obras: mais frentes de trabalho ao mesmo tempo e menos espera entre projetos ----------
   Medido: engenheiros 2/3 ociosos (3 de 9 ocupados): o gargalo era o limite de 4 obras simultâneas e os 12 s entre projetos (engineering.js), não o dinheiro. */
const BUILD_DEF={cap:4,gap:12,urgent:8,sap:false};
function buildTick(team){
 const E=window.IronFrontEngineering;if(!E||!E.tune||!E.tune[team])return;
 const f=doctOf(team).build,tn=E.tune[team];
 tn.cap=clamp(Math.round(3+2*f),4,6);tn.gap=Math.max(4,Math.round(12/(f*1.4)));tn.urgent=Math.max(3,Math.round(tn.gap*.6));tn.sap=true;
}
function buildReset(){const E=window.IronFrontEngineering;if(E&&E.tune)for(const t of [0,1])Object.assign(E.tune[t],BUILD_DEF)}

/* ---------- painel IA: o que cada comandante decidiu ---------- */
let statusBox=null,statusText='';
function phaseLabel(o){return {idle:'em preparação',setup:'reunindo a tropa',assault:'em assalto',hold:'guarnecendo a linha',recover:'recompondo'}[o.phase]||o.phase}
function statusLines(){
 const out=[];
 for(const t of [0,1]){const T=S.team[t];if(!T||!T.doct){out.push(`${NAME[t]}: ${aiEnabled[t]?'sem decisões ainda':'comando manual'}`);continue}
  const o=T.off,E=window.IronFrontEngineering?.tune?.[t];
  out.push(`${NAME[t]} · «${T.doct.name}» · ${o.limited&&o.phase!=='idle'?'contra-ataque':'ofensiva'} ${phaseLabel(o)}${o.phase==='assault'||o.phase==='setup'?` (${alive(o)} homens)`:''} · ${T.patrols.length} patrulha${T.patrols.length===1?'':'s'}${T.garrisons&&T.garrisons.length?` · ${T.garrisons.reduce((n,e)=>n+e.g.units.filter(live).length,0)} guarnecendo a linha tomada`:''}${E?` · obras: até ${E.cap} ao mesmo tempo`:''}`)}
 const rec=S.log.slice(-4).map(l=>`${l.t}s ${NAME[l.team]}: ${l.text}`);
 return out.concat(rec.length?['—',...rec]:[]);
}
function paintStatus(){
 if(!statusBox){const panel=document.getElementById('aiPanel');if(!panel)return;
  statusBox=document.createElement('div');statusBox.id='commanderStatus';statusBox.setAttribute('aria-live','off');
  statusBox.style.cssText='margin:.5rem 0;padding:.4rem .5rem;border-left:2px solid #74855b;font:11px/1.5 monospace;color:#d9e5b5;white-space:pre-line';
  const close=panel.querySelector('[data-close].primary');if(close)panel.insertBefore(statusBox,close);else panel.append(statusBox)}
 const p=document.getElementById('aiPanel');if(p&&p.open===false)return;
 const text=statusLines().join('\n');if(text!==statusText){statusText=text;statusBox.textContent=text}
}

/* ---------- 6) câmera do diretor: quem assiste IA×IA vê o melhor da batalha, sem mexer em nada ----------
   Automática quando os dois lados são IA (e o jogador está parado há alguns segundos); K alterna AUTO → DESLIGADA → LIGADA (mesmo comandando um lado).
   Escolhe o "plano" mais interessante: assalto em andamento, maior aglomerado em combate ou duelo aéreo sobre a frente; mantém cada plano ≥ 7 s (sem vai-e-vem). */
const CAM={mode:'auto',shot:null,until:0,lastUser:-99,x:null,y:null,label:'',cuts:0};
S.cam=CAM;
const CAMCFG={HOLD:7,PAN:2.1,IDLE:6,STICK:1.35};
function camBlocked(){
 if(!started||ended||typeof mode==='undefined'||mode!=='commander')return true;
 if(window.PXAWV?.state?.().cam?.on)return true;                       // a câmera aérea (L) tem prioridade
 if(document.querySelector('dialog[open]'))return true;
 return false}
function camActive(){
 if(flag('camera')||CAM.mode==='off'||camBlocked())return false;
 if(typeof mouse!=='undefined'&&mouse.over&&(mouse.x<12||mouse.x>vw-12||mouse.y<12||mouse.y>vh-12))CAM.lastUser=performance.now();   // rolagem pela borda também é o jogador mexendo
 const idle=performance.now()-CAM.lastUser>CAMCFG.IDLE*1000;
 return CAM.mode==='on'?idle:aiEnabled[0]&&aiEnabled[1]&&idle}
function hotSpots(){
 const live_=units.filter(u=>u.hp>0&&!u.down&&!u.sap&&u.cls!=='medic'),cells=new Map();
 for(const u of live_){let hot=false;for(const e of live_)if(e.team!==u.team&&Math.abs(e.x-u.x)<170&&Math.abs(e.y-u.y)<170&&hyp(e.x-u.x,e.y-u.y)<170){hot=true;break}
  if(!hot)continue;const k=Math.floor(u.x/260)+','+Math.floor(u.y/260);let c=cells.get(k);if(!c)cells.set(k,c={x:0,y:0,n:0,w:0});c.x+=u.x;c.y+=u.y;c.n++;c.w+=u.type==='tank'?4:u.type==='mg'?2:1}
 return [...cells.values()].filter(c=>c.n>=3).map(c=>({x:c.x/c.n,y:c.y/c.n,w:c.w,n:c.n,kind:'combate',label:`combate · ${c.n} em contato`}))}
function pickShot(){
 const cand=hotSpots();
 for(const t of [0,1]){const o=S.team[t]?.off;if(!o||o.phase!=='assault')continue;
  const us=units.filter(u=>o.ids&&o.ids.has(u.id)&&u.hp>0);if(us.length<4)continue;const c=centroid(us);
  cand.push({x:c.x,y:c.y,w:us.length*1.6,n:us.length,kind:'ofensiva',label:`${NAME[t]} · assalto, ${us.length} homens`})}
 if(window.PXAW?.on){const duel=PXAW.planes().filter(a=>a.air&&!a.dead&&!a.gone&&a.mode==='fight');
  if(duel.length>=2){const c=centroid(duel);cand.push({x:c.x,y:Math.min(c.y,GH+200),w:7+duel.length*2,n:duel.length,kind:'ar',label:'duelo aéreo'})}}
 if(!cand.length)return {x:W/2,y:GH*.5,w:0,n:0,kind:'frente',label:'a frente'};
 // histerese: o plano atual (mesmo tipo, perto) leva um bônus, para a câmera não saltar entre dois focos parecidos
 for(const c of cand)if(CAM.shot&&c.kind===CAM.shot.kind&&hyp(c.x-CAM.shot.x,c.y-CAM.shot.y)<420)c.w*=CAMCFG.STICK;
 return cand.sort((a,b)=>b.w-a.w)[0]}
function camTick(dt){
 if(!camActive()){CAM.x=null;return}
 if(time>=CAM.until||!CAM.shot){const s=pickShot();if(!CAM.shot||s.kind!==CAM.shot.kind||hyp(s.x-CAM.shot.x,s.y-CAM.shot.y)>260)CAM.cuts++;CAM.shot=s;CAM.until=time+CAMCFG.HOLD;CAM.label=s.label}
 else if(time>=(CAM.follow||0)){ // durante o plano, ele segue o aglomerado (que anda)
  CAM.follow=time+.6;const s=CAM.shot;const near=hotSpots().filter(c=>hyp(c.x-s.x,c.y-s.y)<360).sort((a,b)=>b.w-a.w)[0];if(near&&s.kind==='combate'){s.x=near.x;s.y=near.y}}
 if(CAM.x==null){CAM.x=cam.x;CAM.y=cam.y}
 const f=Math.min(1,dt*CAMCFG.PAN);CAM.x+=(CAM.shot.x-CAM.x)*f;CAM.y+=(CAM.shot.y-CAM.y)*f;
 cam.x=CAM.x;cam.y=CAM.y;
}
let camLabelEl=null;
function camPaint(){
 if(!camLabelEl){const f=document.getElementById('field');if(!f)return;camLabelEl=document.createElement('div');camLabelEl.id='directorCam';
  camLabelEl.style.cssText='position:absolute;left:50%;top:184px;transform:translateX(-50%);padding:3px 10px;background:#151c16cc;border:1px solid #74855b;color:#d9e5b5;font:11px Silkscreen,monospace;pointer-events:none;z-index:5;display:none;white-space:nowrap';f.append(camLabelEl)}
 const on=camActive()&&CAM.shot,txt=on?`CÂMERA DO DIRETOR · ${CAM.label.toUpperCase()}   [K]`:'';
 if(on&&!CAM.hinted){CAM.hinted=true;if(typeof toast==='function')toast('Câmera do diretor: segue o melhor da batalha. K liga/desliga; mexer na câmera a interrompe por alguns segundos.')}
 if(on){if(camLabelEl.style.display!=='block')camLabelEl.style.display='block';if(camLabelEl.textContent!==txt)camLabelEl.textContent=txt}else if(camLabelEl.style.display!=='none')camLabelEl.style.display='none'}
function camSetMode(m){CAM.mode=m;CAM.shot=null;CAM.x=null;if(typeof toast==='function')toast(`Câmera do diretor: ${m==='auto'?'automática (quando os dois lados são IA)':m==='on'?'LIGADA':'desligada'}.`);const b=document.getElementById('directorBtn');if(b)b.textContent='CÂMERA DO DIRETOR: '+{auto:'AUTO',on:'LIGADA',off:'DESLIGADA'}[m]}
const camNext=()=>camSetMode(CAM.mode==='auto'?'off':CAM.mode==='off'?'on':'auto');
function camInstall(){
 if(!S.on||flag('camera'))return;
 const touch=()=>{CAM.lastUser=performance.now()};
 window.addEventListener('keydown',e=>{const k=(e.key||'').toLowerCase();if(document.querySelector('dialog[open]'))return;const tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.tagName==='SELECT'))return;
  if(k==='k'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&started){e.preventDefault();camNext();return}
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))touch()});
 window.addEventListener('pointerdown',e=>{if(e.target&&e.target.id==='game'||e.target&&e.target.id==='minimap')touch()},true);
 window.addEventListener('wheel',touch,{passive:true});
 const panel=document.getElementById('aiPanel');
 if(panel&&!document.getElementById('directorBtn')){const b=document.createElement('button');b.id='directorBtn';b.textContent='CÂMERA DO DIRETOR: AUTO';b.onclick=camNext;const close=panel.querySelector('[data-close].primary');if(close)panel.insertBefore(b,close);else panel.append(b)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',camInstall);else camInstall();

/* ---------- ligações ---------- */
function think(){
 for(const team of [0,1]){
  if(!aiEnabled[team]){continue}
  if(!S.team[team])S.team[team]=newTeam(team);
  const t=S.team[team];if(!t.doct){t.doct=pickDoctrine(team);say(team,`doutrina «${t.doct.name}»: ${t.doct.say}.`,{quiet:false})}
  try{remember(team);garrisonTick(team);if(!flag('patrulhas'))patrolTick(team);if(!flag('ofensiva')){pushTick(team);offTick(team)}if(!flag('obras'))buildTick(team)}catch(e){fail(e)}
 }
}
const hud0=window.hud;if(typeof hud0==='function')window.hud=function(...a){const r=hud0.apply(this,a);if(S.on&&started)try{paintStatus();camPaint()}catch(e){fail(e)}return r};
const update0=window.update;
window.update=function(dt){
 const r=update0.apply(this,arguments);
 if(!S.on||!started||ended||!(dt>0))return r;
 try{
  battleTrack();
  if(window.PXFORT?.isPrep?.())return r;
  camTick(dt);
  if((sampleT-=dt)<=0){sampleT=S.cfg.SAMPLE;sample()}
  if((tickT-=dt)<=0){tickT=S.cfg.THINK;think()}
 }catch(e){fail(e)}
 return r;
};
const setup0=window.setup;
window.setup=function(){const r=setup0.apply(this,arguments);buildReset();battleAt=null;prepSeen=false;S.team=[null,null];S.log.length=0;S.m={contact:[0,0],still:[0,0],n:0,mov:[0,0]};prevPos=new Map();tickT=sampleT=0;toastAt=-99;
 for(const k of Object.keys(S.stats))S.stats[k]=0;return r};
S.state=()=>({on:S.on,stats:{...S.stats},doctrine:S.team.map(t=>t&&t.doct&&t.doct.name),patrols:S.team.map(t=>t?t.patrols.length:0),metrics:S.metrics()});
hookAir();S.doctrines=DOCT;S.pickDoctrine=pickDoctrine;S.probeGoal=probeGoal;
/* ganchos de teste (tests/commander.test.cjs) */
S._t={garrisonTick,artyReady,known,remember,dangerAt,coverageAt,beltX,pickLane,offPool,startOffensive,offTick,endOffensive,garrison,alive,patrolTick,spawnPatrol,pickShot,camTick,hotSpots,say,buildTick,airClusters,heldByUs,think,sample,deepTarget,fireOn,battleClock,strength,newTeam,statusLines};
window.IronFront=window.IronFront||{};window.IronFront.commander=S;
})();
