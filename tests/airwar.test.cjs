/* Testes da guerra aérea (dist/airwar.js) num contexto vm com um mini-jogo (sem desenho, sem anim-air).
   Mede desempenho por tipo (velocidade, subida, curva sustentada, mergulho), duelos (abates, tiros por abate, abates por trás
   e sem ser visto, ninguém batendo no chão por erro de pilotagem), o ciclo do aeródromo (decolagem, missão, pouso, rearme),
   ataque ao solo/bombardeio e a trégua sem tiro. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'dist', 'airwar.js'), 'utf8');

const BOOT = `
let __s=Number(globalThis.__seed||20261002);Math.random=()=>{__s=(Math.imul(__s,1664525)+1013904223)>>>0;return __s/4294967296};
const W=2400,H=2000;let units=[],buildings=[],bullets=[],shells=[],planes=[],particles=[],time=0,started=true,ended=false,playerTeam=0,sandbox=true,cam={x:1200,y:1000};
const toasts=[];function toast(m){toasts.push(m)}function sound(){}
function setup(){}function update(dt){time+=dt}
`;
function world(seed, search = '') {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error }, performance, __seed: seed });
  ctx.window = ctx; ctx.location = { search }; ctx.PX = { Z: .5 }; ctx.IronFront = {};
  vm.runInContext(BOOT, ctx);
  vm.runInContext(SRC, ctx, { filename: 'airwar.js' });
  const run = c => vm.runInContext(c, ctx);
  run('setup()');
  return { ctx, run };
}
const steps = (run, sec, dt = 1 / 30) => run(`for(let i=0;i<${Math.round(sec / dt)};i++)update(${dt})`);

/* ---------- 1. desempenho por tipo ---------- */
function perf(tk) {
  const { run } = world(1);
  run(`PXAW._internals.reset();var I=PXAW._internals,a;function fresh(){a=PXAW._spawn(0,'${tk}',0,1000,700,0,180,.9);a.mode='test';a.flight=null;a.fuel=1e9;a.pilot.skill=.99;return a}fresh();
  /* piloto de teste: substitui o comportamento */
  var T=a.T,dt=1/60,res={};
  function hold(D,n,thr,sec){a.thr=thr;for(let i=0;i<sec/dt;i++){a.D=D(a);a.nLim=n;a.gain=3.2;I.fly(a,dt);time+=dt}}
  /* velocidade máxima nivelada */
  a.h=300;hold(a=>[1,0,(300-a.h)/400],1.3,1,60);res.vmax=I.len3(a.V);
  /* subida: varre a rampa; razão = variação de energia específica (h + v²/2g) nos últimos 15 s, perto da velocidade de melhor subida */
  const E=()=>a.h+I.len3(a.V)**2/(2*PXAW.cfg.G);
  res.climb=0;for(let g=2;g<=24;g+=2){fresh();a.h=200;const gr=g*Math.PI/180;a.V=[T.VB*Math.cos(gr),0,T.VB*Math.sin(gr)];a.U=I.nrm([-Math.sin(gr),0,Math.cos(gr)]);let e0=0;
   for(let i=0;i<30/dt;i++){a.D=[Math.cos(gr),0,Math.sin(gr)];a.nLim=2;a.thr=1;a.gain=3.2;I.fly(a,dt);if(i===Math.round(15/dt))e0=E()}
   const v=I.len3(a.V),c=(E()-e0)/15;if(Math.abs(v/T.VB-1)<.2&&c>res.climb)res.climb=c}
  /* curva sustentada nivelada: o g é ajustado para manter a velocidade de melhor subida (Ps = 0) */
  fresh();a.h=700;a.V=[T.VB,0,0];a.U=[0,0,1];var turned=0,last=0,tt=0,nl=1.3;
  for(let i=0;i<30/dt;i++){const f=I.nrm(a.V),v=I.len3(a.V);nl=Math.max(1.05,Math.min(T.nmax,nl+(v-T.VB)*.03*dt*60*.05));a.D=I.nrm([-f[1],f[0],(700-a.h)/250]);a.nLim=nl;a.thr=1;a.gain=5;I.fly(a,dt);
   const h=Math.atan2(a.V[1],a.V[0]);let d=h-last;d=Math.atan2(Math.sin(d),Math.cos(d));last=h;if(i*dt>12){turned+=d;tt+=dt}}
  res.t360=tt/(Math.abs(turned)/(2*Math.PI));res.hTurnEnd=a.h;res.vTurn=I.len3(a.V);
  /* mergulho: 1500 u, 70° para baixo, velocidade máxima antes de 250 u */
  fresh();a.h=1500;a.V=[T.VB,0,0];a.U=[0,0,1];var vd=0;for(let i=0;i<30/dt&&a.h>250;i++){a.D=I.nrm([.34,0,-.94]);a.nLim=2.5;a.thr=1;I.fly(a,dt);vd=Math.max(vd,I.len3(a.V))}
  res.dive=vd;`);
  return run('res');
}
const P = {};
for (const tk of ['spad', 'fokker', 'camel', 'halb', 'dh4', 'gotha']) P[tk] = perf(tk);
for (const [tk, r] of Object.entries(P)) {
  assert.ok(Number.isFinite(r.vmax) && Number.isFinite(r.climb) && Number.isFinite(r.t360) && Number.isFinite(r.dive), `${tk}: números finitos`);
}
console.log('  desempenho (u/s, s):');
for (const [tk, r] of Object.entries(P)) console.log(`    ${tk.padEnd(7)} vmax ${r.vmax.toFixed(0)} · subida ${r.climb.toFixed(1)} · 360° sustentado ${r.t360.toFixed(1)} (a ${r.vTurn.toFixed(0)} u/s, h ${r.hTurnEnd.toFixed(0)}) · mergulho ${r.dive.toFixed(0)}`);
const T = (tk, k) => P[tk][k];
assert.ok(T('spad', 'vmax') > T('fokker', 'vmax') && T('fokker', 'vmax') > T('camel', 'vmax'), 'velocidade: SPAD > Fokker > Camel');
assert.ok(T('fokker', 'climb') > T('spad', 'climb') && T('fokker', 'climb') > T('camel', 'climb'), 'subida: o Fokker D.VII sobe melhor');
assert.ok(T('camel', 't360') < T('fokker', 't360') && T('fokker', 't360') < T('spad', 't360'), 'curva: Camel < Fokker < SPAD');
assert.ok(T('spad', 'dive') > T('fokker', 'dive') && T('spad', 'dive') > T('camel', 'dive'), 'mergulho: o SPAD mergulha mais rápido');
assert.ok(T('gotha', 't360') > T('fokker', 't360') * 1.8 && T('gotha', 'climb') < T('fokker', 'climb') * .5, 'o Gotha é pesado: curva e sobe muito pior');
for (const tk of ['spad', 'fokker', 'camel']) assert.ok(Math.abs(T(tk, 'vmax') / ({ spad: 250, fokker: 232, camel: 214 })[tk] - 1) < .06, `${tk}: vmax perto do nominal (${T(tk, 'vmax').toFixed(0)})`);

/* ---------- 2. duelos: 2×2 SPAD × Fokker com pilotos iguais, várias sementes ---------- */
const D = { kills: [0, 0], runs: 0, firstKill: [], rounds: 0, killsTotal: 0, behind: 0, unseen: 0, ground: 0, nan: 0, eng: 0 };
for (let seed = 1; seed <= 12; seed++) {
  const { run } = world(seed);
  run(`PXAW._internals.reset();PXAW.setAuto(0,false);PXAW.setAuto(1,false);
   for(let i=0;i<2;i++){PXAW._spawn(0,'spad',700,900+i*80,900,0,200,.6);PXAW._spawn(1,'fokker',1900,900+i*80,900,Math.PI,190,.6)}`);
  let first = null;
  for (let t = 0; t < 120; t += 1) {
    steps(run, 1);
    const k = run('PXAW.stats.killsTotal');
    if (k > 0 && first == null) first = t + 1;
  }
  const st = run('PXAW.stats');
  D.kills[0] += st.kills[0]; D.kills[1] += st.kills[1]; D.rounds += st.rounds; D.killsTotal += st.killsTotal; D.behind += st.killsBehind; D.unseen += st.killsUnseen; D.eng += st.engageTime;
  D.ground += run(`PXAW.log.filter(e=>e.cause==='chão'&&e.by==='?').length`);
  D.nan += run(`PXAW._internals.AC().filter(a=>!Number.isFinite(a.x+a.y+a.h+a.V[0]+a.V[1]+a.V[2])).length`);
  if (first != null) D.firstKill.push(first);
  D.runs++;
}
const rpk = D.rounds / Math.max(1, D.killsTotal);
console.log(`  2×2 SPAD × Fokker (pilotos 0,6, ${D.runs} combates de 120 s): abates EUA ${D.kills[0]} × ${D.kills[1]} Alemanha · 1º abate em ${(D.firstKill.reduce((a, b) => a + b, 0) / Math.max(1, D.firstKill.length)).toFixed(0)} s · ${rpk.toFixed(0)} tiros por abate · ${(100 * D.behind / Math.max(1, D.killsTotal)).toFixed(0)} % por trás · ${(100 * D.unseen / Math.max(1, D.killsTotal)).toFixed(0)} % sem ser visto · ${D.ground} no chão por erro`);
assert.equal(D.nan, 0, 'sem NaN');
assert.ok(D.killsTotal >= D.runs * .7, `os duelos produzem abates (${D.killsTotal} em ${D.runs} combates de 2 min)`);
assert.ok(D.firstKill.length >= D.runs * .55, `a maioria dos combates tem abate em 2 min (${D.firstKill.length}/${D.runs})`);
assert.ok(D.ground <= D.runs * .5, `pouca gente bate no chão sem ter sido atingida (${D.ground})`);
assert.ok(rpk > 40 && rpk < 2500, `tiros por abate numa faixa de 1918 (${rpk.toFixed(0)}; 12 combates: a variação entre sementes é de ±15)`);

/* ---------- 3. ás × novato ---------- */
{
  let ace = 0, nov = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const { run } = world(100 + seed);
    run(`PXAW._internals.reset();PXAW.setAuto(0,false);PXAW.setAuto(1,false);PXAW._spawn(0,'spad',800,1000,900,0,200,.95);PXAW._spawn(1,'fokker',1700,1000,900,Math.PI,190,.25)`);
    steps(run, 120);
    const st = run('PXAW.stats'); ace += st.kills[0]; nov += st.kills[1];
  }
  assert.ok(ace >= nov * 2 && ace >= 6, `o ás vence o novato mesmo num avião que curva pior (${ace} × ${nov})`);
  console.log(`  ás (SPAD, 0,95) × novato (Fokker, 0,25), 24 combates de 120 s: ${ace} × ${nov}`);
}

/* ---------- 4. aeródromo: decolagem, patrulha, regresso, pouso, rearme ---------- */
{
  const { run } = world(7);
  run(`PXAW._internals.reset();PXAW.setAuto(0,false);PXAW.setAuto(1,false);PXAW.order(0,'cap',1000,900)`);
  let sawRoll = false, sawAir = 0, maxH = 0;
  for (let t = 0; t < 300; t++) {
    steps(run, 1);
    const s = run(`(()=>{const A=PXAW._internals.AC().filter(a=>a.team===0);return{roll:A.some(a=>a.st==='roll'),air:A.filter(a=>a.st==='air').length,h:Math.max(0,...A.map(a=>a.h))}})()`);
    sawRoll = sawRoll || s.roll; sawAir = Math.max(sawAir, s.air); maxH = Math.max(maxH, s.h);
  }
  const st = run('PXAW.stats');
  assert.ok(sawRoll, 'houve corrida de decolagem');
  assert.ok(sawAir >= 2, `a patrulha subiu (${sawAir} no ar)`);
  assert.ok(maxH > 700, `chegou à altitude de patrulha (${maxH.toFixed(0)} u)`);
  assert.ok(st.landings >= 2, `pousaram de volta (${st.landings} pousos, ${st.goArounds} arremetidas, ${st.landingCrashes} acidentes)`);
  const parked = run(`PXAW._internals.AC().filter(a=>a.team===0&&a.st==='park'&&a.T.cls==='f').length`);
  assert.ok(parked >= 7, `voltaram ao estacionamento e rearmam (${parked} caças parados)`);
  console.log(`  patrulha de 3 SPAD: decolagem, ${maxH.toFixed(0)} u, ${st.landings} pousos, ${st.goArounds} arremetidas, ${st.landingCrashes} acidentes em 300 s`);
}

/* ---------- 5. quartel-general automático, ataque ao solo e bombardeio ---------- */
{
  const { run } = world(11);
  run(`for(let i=0;i<40;i++){units.push({id:1000+i,team:1,type:i%5?'rifle':'mg',x:1500+(i%8)*30,y:900+Math.floor(i/8)*30,hp:100});units.push({id:2000+i,team:0,type:'rifle',x:800+(i%8)*30,y:900+Math.floor(i/8)*30,hp:100})}
   PXAW._internals.reset();PXAW._internals.setFront(1150)`);
  steps(run, 420, 1 / 20);        // a partida real (pilotos a pé, motor, táxi em fila e um avião por vez na faixa) leva ~1 min até a 1ª decolagem
  const st = run('PXAW.stats');
  const shellsBomb = run('shells.length');
  assert.ok(st.sorties[0] > 4 && st.sorties[1] > 4, `os dois quartéis-generais lançam missões sozinhos (${st.sorties})`);
  assert.ok(st.bombs > 0 || st.strafe > 0, `houve ataque ao solo/bombardeio (${st.bombs} bombas, ${st.strafe} rajadas)`);
  assert.equal(st.errors, 0);
  console.log(`  QG automático 420 s: saídas ${st.sorties} · missões ${JSON.stringify(st.missions)} · abates ${st.kills} · bombas ${st.bombs} · rajadas ${st.strafe} · pousos ${st.landings} · forçados ${st.forced}`);
}

/* ---------- 6. trégua: sem tiro ---------- */
{
  const { run } = world(3);
  run(`window.PXFORT={isPrep:()=>true};PXAW._internals.reset();PXAW.setAuto(0,false);PXAW.setAuto(1,false);
   PXAW._spawn(0,'spad',900,1000,900,0,200,.8);PXAW._spawn(1,'fokker',1300,1000,900,Math.PI,190,.8)`);
  steps(run, 40);
  assert.equal(run('PXAW.stats.rounds'), 0, 'na trégua ninguém atira');
}
/* ---------- 7. desligar ---------- */
{ const { run } = world(1, '?guerraaerea=0'); assert.equal(run('PXAW.on'), false); }
console.log('Guerra aérea 1.12: desempenho por tipo, duelos, ás × novato, ciclo do aeródromo, QG automático, ataque ao solo e trégua OK');
