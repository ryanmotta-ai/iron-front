const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),Policy=require('../dist/support-policy.js');
function engine(){let id=0;const s={console,Math,Map,Set,WeakMap,Array,Object,JSON,Number,String,Infinity,W:2400,H:1600,vw:320,vh:180,time:0,started:true,ended:false,sandbox:false,mode:'commander',player:null,playerTeam:0,
 units:[],buildings:[],shells:[],particles:[],fieldTrenches:[],allCraters:[],trenchGrid:new Map(),tickets:[500,500],supplies:[2000,2000],aiEnabled:[false,false],supportCooldown:[0,0],selected:new Set(),cam:{x:0,y:0},soundOn:false,tab:'units',placement:null,maxUnits:160,map:'forest',keys:{},mouse:{},location:{search:''},PX:{Z:.5},
 defs:{rifle:{hp:100,count:8,cost:80},sandbag:{hp:350,cost:50},wire:{hp:180,cost:40},artillery:{cost:160}},
 document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}})}),getElementById:()=>null,querySelector:()=>null},addEventListener(){},toast(){},sound(){},setup(){},finish(){},explode(){},makeCards(){},icon(){},render(){},choose(){},worldMouse(){},observationRange:()=>700,
 protectedBy(u){return s.fieldTrenches.some(t=>t.team===u.team&&Math.abs(t.x-u.x)<20&&Math.abs(t.y-u.y)<20)?.35:1},damage(u,n){u.hp-=n},
 update(dt){s.time+=dt;for(const u of s.units){if(u.down||u.order!=='move')continue;const d=Math.hypot(u.tx-u.x,u.ty-u.y);if(d>12){const f=Math.min(1,47*dt/d);u.x+=(u.tx-u.x)*f;u.y+=(u.ty-u.y)*f}}},
 newUnit(type,team,x,y){const u={id:++id,type,team,x,y,hp:100,maxhp:100,tx:x,ty:y,order:'hold',manualUntil:0,suppression:0,cohesion:1,gren:2,cd:0};s.units.push(u);return u},
 squad(type,team,x,y){for(let i=0;i<3;i++)s.newUnit(type,team,x+i*5,y)},newBuilding(type,team,x,y){const b={id:++id,type,team,x,y,hp:100};s.buildings.push(b);return b}};
 s.window=s;vm.createContext(s);for(const name of ['support-policy.js','sappers.js','medics.js','life-kit.js','casualty.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',name),'utf8'),s);
 s.PXMED.reset();s.wound=(x,y,sev='serious',remaining=70)=>{const u=s.newUnit('rifle',0,x,y);u.down=true;u.hp=1;u.claimed=null;u.bleed=s.time+remaining;s.PXCAS.initWound(u);u.cz.sev=sev;u.cz.ko=Infinity;u.bleed=s.time+remaining;return u};return s;
}
// Risk-aware geometry and clinical feasibility.
let state={team:0,time:0,enemies:[],shells:[{x:800,y:800,t:1,r:40}],buildings:[],trenches:[]};
const waypoint=Policy.route(state,{x:700,y:800},{x:1000,y:800});assert.ok(Math.abs(waypoint.y-800)>=55,'não marcha no centro de impacto iminente');
assert.equal(Policy.triage(state,{x:100,y:100},{x:700,y:800,hp:1,down:true,bleed:5,cz:{sev:'critical'}}),-Infinity,'não compromete socorrista com chegada impossível');
// Actual medic dispatch prioritizes a reachable critical casualty over a nearby light wound.
let s=engine();s.PXMED.cfg.RANGE=0;const medic=s.newUnit('rifle',0,700,800);medic.cls='medic';const light=s.wound(740,800,'light',100),critical=s.wound(790,800,'critical',35);s.PXCAS.tick(.5);assert.equal(medic.rs.w.id,critical.id);
// Human takeover is atomic and retains the exact new destination.
medic.manualUntil=30;medic.order='move';medic.tx=300;medic.ty=300;s.PXCAS.tick(.1);assert.equal(medic.rs,null);assert.equal(medic.tx,300);assert.equal(medic.manualUntil,30);assert.equal(critical.cz.res,null);
// Idle doctors keep a safe support position instead of inheriting a charge order.
s=engine();s.PXMED.cfg.RANGE=0;const doctor=s.newUnit('rifle',0,700,800);doctor.cls='medic';doctor.order='attack';doctor.tx=1700;s.newUnit('rifle',0,850,800);s.PXCAS.tick(.5);assert.equal(doctor.aiRole,'apoio-medico');assert.ok(doctor.tx<850);
// No duplicate dispatch or more incoming stretchers than the remaining beds.
s=engine();const post=s.PXMED.posts[0];post.beds=[{id:-1},{id:-2}];const w1=s.wound(500,800,'critical',60),w2=s.wound(510,800,'light',90);s.PXMED.tick(.1);assert.equal(post.crews.filter(c=>c.st==='go').length,1);assert.equal(w1.claimed,post.crews[0]);assert.equal(w2.claimed,null);
// A full post is not chosen for an infantry drag; destroyed destinations are replaced.
s=engine();const rescuer=s.newUnit('rifle',0,650,800);rescuer.cls='medic';const w=s.wound(660,800);const full=s.PXMED.addPost(0,640,800);full.beds=[{}, {}, {}];const alternate=s.PXMED.addPost(0,600,800);assert.equal(s.PXCAS.chooseDest(rescuer,w).post,alternate);
const crew=full.crews[0];crew.st='carry';crew.u=w;crew.dest=full;crew.x=600;crew.y=816;w.claimed=crew;w.carried=true;s.PXMED.tick(.5);s.PXMED.tick(.5);assert.ok(alternate.beds.includes(w),'maca entrega em posto alternativo quando o original está cheio');
// Builders exclude casualties and medical/rescue roles and obey human preemption.
s=engine();const a=s.newUnit('rifle',0,700,500),b=s.newUnit('rifle',0,705,500),c=s.newUnit('rifle',0,710,500);for(const u of [a,b,c])u.sap=1;
const auto=s.PXSAP.project(0,'trench','fort',[[720,480],[720,520]],{keep:true});s.PXSAP.tick(.5);assert.equal(auto.crew.length,3);
const manual=s.PXSAP.project(0,'trench','player',[[730,500],[730,530]]);s.PXSAP.tick(.5);assert.equal(manual.crew.length,2);assert.equal(auto.crew.length,1,'obra automática conserva um trabalhador');
b.down=true;s.PXSAP.tick(.5);assert.ok(![...auto.crew,...manual.crew].includes(b.id));
// Imminent impacts pause the work and free workers without discarding paid partial structures.
s.shells=[{x:730,y:515,r:80,t:1,team:1}];s.PXSAP.tick(.5);assert.equal(manual.crew.length,0);assert.ok(manual.pauseUntil>s.time);assert.equal(manual.done,false);
// Stalled movement releases the worker and avoids repeating the same failed route immediately.
s=engine();const worker=s.newUnit('rifle',0,300,500);worker.sap=1;const p=s.PXSAP.project(0,'trench','player',[[700,500],[700,530]]);for(let i=0;i<45;i++){s.time+=.5;s.PXSAP.tick(.5)}assert.ok(worker.sapAvoid?.id===p.id);assert.equal(worker.sapJob,null);
assert.equal(s.PXSAP.stats.errors,0);assert.equal(s.PXCAS.stats.errors,0);
console.log('Support AI: triagem, chegada viável, rotas, prioridade humana, vagas, médicos em apoio, equipes, pausa sob fogo e bloqueios OK');
