/* Testes do aeródromo (dist/airwar.js, parte do solo) num contexto vm com um mini-jogo. Cobre o que o jogador vê: layout em escala, a partida de cada avião
   (piloto a pé → pré-voo → sobe na cabine → puxões e giro da hélice → motor pega → aquecimento → calços → táxi em fila), UM avião de cada vez na faixa
   (alinha, prova o motor, corre, levanta voo, só então o próximo), hélice parada = rpm 0, motor só depois do assento ocupado, pouso e volta à vaga com o piloto
   descendo e indo ao relatório, e as duas direções de vento nos dois campos. */
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
function world(seed, wind = 0) {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error }, performance, __seed: seed });
  ctx.window = ctx; ctx.location = { search: '' }; ctx.PX = { Z: .5 }; ctx.IronFront = {};
  if (wind) ctx.PXW = { windVec: () => ({ x: wind, y: 0, s: .3 }) };
  vm.runInContext(BOOT, ctx);
  vm.runInContext(SRC, ctx, { filename: 'airwar.js' });
  const run = c => vm.runInContext(c, ctx);
  run('setup()');
  run('PXAW._internals.reset();PXAW.setAuto(0,false);PXAW.setAuto(1,false)');
  return { ctx, run };
}
const steps = (run, sec, dt = 1 / 30) => run(`for(let i=0;i<${Math.round(sec / dt)};i++)update(${dt})`);

/* ---------- 1. layout: vagas em escala, caminhos que chegam ao ponto de espera e de volta à vaga ---------- */
for (const wind of [0, 25, -25]) {
  const { run } = world(3, wind);
  const r = run(`(()=>{const I=PXAW._internals,out=[];for(const t of[0,1]){const af=PXAW.airfields()[t];
    const sl=af.slots.map(s=>({x:s.x,y:s.y,tk:s.tk,row:s.row,span:PXAW.types[s.tk].span,len:PXAW.types[s.tk].len}));let overlap=0,outside=0;
    for(let i=0;i<sl.length;i++){const a=sl[i];if(Math.abs(a.x-af.x)>af.bayMax+60||a.y-af.y<-900||a.y-af.y>-100)outside++;for(let j=i+1;j<sl.length;j++){const b=sl[j];if(Math.abs(a.x-b.x)<(a.span+b.span)/2+8&&Math.abs(a.y-b.y)<(a.len+b.len)/2+8)overlap++}}
    const plane=PXAW.planes().find(p=>p.team===t);const po=I.outPath(plane),pl=I.lineupPath({...plane,x:po[po.length-1][0],y:po[po.length-1][1]}),pi=I.inPath({...plane,x:af.x-af.dir*(af.half-120),y:af.y,hd:af.dir>0?0:Math.PI});
    const len=P=>P.reduce((s,q,i)=>i?s+Math.hypot(q[0]-P[i-1][0],q[1]-P[i-1][1]):0,0),end=p=>p[p.length-1];
    out.push({team:t,dir:af.dir,half:af.half,n:sl.length,overlap,outside,outLen:Math.round(len(po)),inLen:Math.round(len(pi)),
     outEnd:end(po).map(Math.round),slot:[plane.slot.x,plane.slot.y].map(Math.round),inEnd:end(pi).map(Math.round),lineEnd:end(pl).map(Math.round),start:Math.round(af.x-af.dir*af.half),
     maxTurn:(()=>{let m=0;for(const P of[po,pl,pi]){for(let i=2;i<P.length;i++){const a=[P[i-1][0]-P[i-2][0],P[i-1][1]-P[i-2][1]],b=[P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]];if(Math.hypot(...a)<.5||Math.hypot(...b)<.5)continue;const d=Math.abs(Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]));if(d>m)m=d}}return m})()})}return out})()`);
  for (const f of r) {
    assert.equal(f.overlap, 0, `vagas sem sobreposição (time ${f.team}, vento ${wind}: ${f.overlap})`);
    assert.equal(f.outside, 0, `vagas dentro do campo (time ${f.team})`);
    assert.ok(f.outLen > 200 && f.outLen < 1500, `táxi de saída plausível (${f.outLen} u)`);
    assert.ok(f.inLen > 200 && f.inLen < 1900, `táxi de volta plausível (${f.inLen} u)`);
    assert.ok(f.maxTurn < .75, `curvas suaves: nenhuma quina maior que 43° entre trechos (${(f.maxTurn * 57.3).toFixed(0)}°)`);
    assert.deepEqual(f.inEnd, f.slot, 'o táxi de volta termina na própria vaga');
    assert.ok(Math.abs(f.lineEnd[1] - 1000) < 2 && Math.abs(f.lineEnd[0] - f.start) <= 60, `alinha sobre a faixa perto da cabeceira (${f.lineEnd})`);
  }
}
console.log('  layout: vagas em escala sem sobreposição, táxi com arcos, ponto de espera e alinhamento na cabeceira, nos dois campos e com vento dos dois lados');

/* ---------- 2. a partida de cada avião (pessoas, hélice, motor) e um de cada vez na faixa ---------- */
{
  const { run } = world(7);
  const f = run(`PXAW.order(0,'cap',1000,900);steps=0;1`);
  /* observa a cada quadro */
  const seen = { crewSeatedBeforeEngine: true, pullsBeforeSeat: 0, maxOnStrip: 0, rpmWhileParked: 0, chocksOff: true, lineupWhileBusy: 0, kinds: new Set() };
  const wheels = [];                       // instantes de decolagem
  const startT = {};                       // id → tempos das fases
  const seq = {};
  for (let i = 0; i < 150 * 30; i++) {
    run('update(1/30)');
    const s = run(`(()=>{const A=PXAW._internals.AC().filter(a=>a.team===0),af=PXAW.airfields()[0];
      return {t:time,planes:A.map(a=>({id:a.id,st:a.st,gp:a.gp,eng:a.eng,engOn:a.engOn,rpm:a.rpm,air:a.air,h:a.h,x:a.x,gv:a.gv||0,chocks:a.chocks,
        seated:a.pilot?a.pilot.act:null,pplane:a.pilot&&a.pilot.plane===a,pacts:a.seats.map(o=>o.act)})),
       roll:A.filter(a=>a.st==='roll').length,lineup:A.filter(a=>a.st==='lineup').length}})()`);
    seen.maxOnStrip = Math.max(seen.maxOnStrip, s.planes.filter(a => a.st === 'roll' || a.st === 'lineup').length);
    for (const a of s.planes) {
      const q = seq[a.id] = seq[a.id] || { phases: [], lastSt: null };
      const key = a.st + '/' + a.gp;
      if (q.phases[q.phases.length - 1] !== key) q.phases.push(key);
      if (a.eng === 'run' && a.st === 'start' && !(a.seated === 'seat' && a.pplane)) seen.crewSeatedBeforeEngine = false;
      if (a.engOn && a.eng !== 'run' && !a.air) seen.engOnWithoutEngine = (seen.engOnWithoutEngine || 0) + 1;
      if (a.st === 'park' && a.gp !== 'out' && a.rpm > 0.15) seen.rpmWhileParked++;
      if (q.lastSt === 'roll' && a.air) wheels.push({ id: a.id, t: s.t });
      if (a.st === 'taxi' && a.chocks) seen.chocksOff = false;
      q.lastSt = a.st;
    }
  }
  assert.ok(seen.crewSeatedBeforeEngine, 'o motor só pega com o piloto sentado e a hélice puxada');
  assert.ok(!seen.engOnWithoutEngine, `sem fumaça nem som de motor durante os puxões (${seen.engOnWithoutEngine || 0} quadros com engOn sem o motor ligado)`);
  assert.equal(seen.rpmWhileParked, 0, 'avião parado com o motor cortado tem hélice parada (rpm baixo)');
  assert.ok(seen.chocksOff, 'os calços saem antes de taxiar');
  assert.equal(seen.maxOnStrip, 1, `um avião de cada vez alinhado ou em corrida (${seen.maxOnStrip})`);
  assert.ok(wheels.length >= 3, `os três da patrulha decolaram (${wheels.length})`);
  for (let i = 1; i < wheels.length; i++) assert.ok(wheels[i].t - wheels[i - 1].t >= 7, `espaço entre decolagens ≥ 7 s (${(wheels[i].t - wheels[i - 1].t).toFixed(1)} s)`);
  const first = wheels[0].t - 0;
  assert.ok(first > 25 && first < 80, `a 1ª decolagem sai entre 25 e 80 s depois da ordem (${first.toFixed(0)} s)`);
  const order = ['start/crew', 'start/prime', 'start/swing', 'start/warm', 'start/chocks', 'taxi/', 'hold/', 'lineup/', 'lineup/runup', 'roll/', 'air/'];
  for (const id of Object.keys(seq)) {
    const p = seq[id].phases;
    if (!p.includes('roll/')) continue;
    let last = -1;
    for (const k of p) { const i = order.indexOf(k); if (i < 0) continue; assert.ok(i >= last, `fases na ordem (#${id}: ${p.join(' → ')})`); last = i }
    assert.ok(p.includes('start/prime') && p.includes('start/swing') && p.includes('start/warm') && p.includes('start/chocks'), `puxões, giro, aquecimento e calços (#${id})`);
  }
  console.log(`  partida: ${wheels.length} decolagens sequenciais (1ª em ${first.toFixed(0)} s, intervalos ${wheels.slice(1).map((w, i) => (w.t - wheels[i].t).toFixed(0)).join('/')} s), 1 na faixa por vez, calços fora, motor só com o piloto sentado`);
}

/* ---------- 3. a hélice: rpm 0 parado, puxões curtos, partida sobe, corrida a pleno ---------- */
{
  const { run } = world(5);
  run(`PXAW.dispatch(0,'cap',1000,900)`);
  steps(run, 9);
  run(`PXAW.dispatch(0,'cap',1000,900)`);
  const marks = { pulses: 0, maxPull: 0, idle: 0, full: 0, stillAtZero: true };
  let pl = null, prev = 0;
  for (let i = 0; i < 90 * 30; i++) {
    run('update(1/30)');
    const a = run(`(()=>{const a=PXAW._internals.AC().find(a=>a.team===0&&a.flight);return a?{id:a.id,st:a.st,gp:a.gp,rpm:a.rpm,eng:a.eng,y:a.y}:null})()`);
    if (!a) continue;
    pl = pl || a.id; if (a.id !== pl) continue;
    if (a.st === 'start' && (a.gp === 'prime' || a.gp === 'swing')) { if (a.rpm > .06 && prev <= .06) marks.pulses++; marks.maxPull = Math.max(marks.maxPull, a.rpm) }
    if (a.st === 'start' && a.gp === 'warm' && a.rpm > .3) marks.idle = Math.max(marks.idle, a.rpm);
    if (a.st === 'roll') marks.full = Math.max(marks.full, a.rpm);
    if (a.st === 'start' && a.gp === 'crew' && a.rpm !== 0) marks.stillAtZero = false;
    prev = a.rpm;
  }
  assert.ok(marks.stillAtZero, 'enquanto o piloto embarca a hélice está parada (rpm 0)');
  assert.ok(marks.pulses >= 2, `puxões à mão giram a hélice em pulsos curtos (${marks.pulses})`);
  assert.ok(marks.maxPull < .2, `puxão à mão não passa de giro lento (${marks.maxPull.toFixed(2)})`);
  assert.ok(marks.idle > .3 && marks.idle < .6, `marcha lenta depois que o motor pega (${marks.idle.toFixed(2)})`);
  assert.ok(marks.full > .9, `rpm pleno na corrida (${marks.full.toFixed(2)})`);
  console.log(`  hélice: parada no embarque, ${marks.pulses} puxões (até ${marks.maxPull.toFixed(2)}), marcha lenta ${marks.idle.toFixed(2)}, pleno ${marks.full.toFixed(2)} na corrida`);
}

/* ---------- 4. decolagem: corrida, subida, sem acidente; pouso e volta à vaga; pessoas ---------- */
for (const [wind, seed] of [[0, 3], [25, 5], [-25, 9]]) {
  const { run } = world(seed, wind);
  run(`PXAW.order(0,'cap',1000,900);PXAW.order(1,'cap',1400,900)`);
  const roll = {}, td = {};
  const crashIds = new Set(); let overrun = 0, climbed = 0, debrief = 0, backHome = 0, noSeat = 0;
  for (let i = 0; i < 360 * 30; i++) {
    run('update(1/30)');
    if (i % 3) continue;
    const s = run(`PXAW._internals.AC().filter(a=>a.flight||a.gp==='out'||a.st==='rollout').map(a=>({id:a.id,team:a.team,st:a.st,gp:a.gp,x:a.x,y:a.y,h:a.h,gv:a.gv||0,dead:a.dead,cause:a.cause,pil:a.pilot&&{act:a.pilot.act,x:a.pilot.x,y:a.pilot.y},sx:a.slot.x,sy:a.slot.y,dir:PXAW.airfields()[a.team].dir,afx:PXAW.airfields()[a.team].x,half:PXAW.airfields()[a.team].half,t:time}))`);
    for (const a of s) {
      if (a.dead && a.cause === 'pouso') crashIds.add(a.team + '/' + a.id);
      if (a.st === 'roll') { roll[a.id] = roll[a.id] || { t0: a.t, x0: a.x }; roll[a.id].t1 = a.t; roll[a.id].x1 = a.x }
      if (a.st === 'rollout') { td[a.id] = td[a.id] || a.x; if (Math.abs(a.x - a.afx) > a.half + 40) overrun++ }
      if (a.pil && a.pil.act === 'climbout') climbed++;
      if (a.pil && a.pil.act === 'debrief') debrief++;
      if (a.st === 'park' && a.gp === 'out' && a.pil && a.pil.act === 'idle' && Math.hypot(a.pil.x - a.sx, a.pil.y - a.sy) < 40) backHome++;
    }
  }
  const rs = Object.values(roll);
  assert.ok(rs.length >= 4, `decolagens dos dois campos (${rs.length}, vento ${wind})`);
  for (const r of rs) { const d = r.t1 - r.t0; assert.ok(d > 3.5 && d < 9, `corrida de decolagem de 4 a 9 s (${d.toFixed(1)} s)`); assert.ok(Math.abs(r.x1 - r.x0) > 200 && Math.abs(r.x1 - r.x0) < 560, `corrida cabe na pista (${Math.abs(r.x1 - r.x0).toFixed(0)} u)`) }
  assert.ok(crashIds.size <= 1, `quase nenhum acidente no pouso (${crashIds.size} em ${run('PXAW.stats.landings')} pousos)`);
  assert.equal(overrun, 0, 'o pouso rola dentro da faixa');
  assert.ok(climbed > 0 && debrief > 0, `o piloto desce (${climbed}) e vai ao relatório (${debrief})`);
  assert.equal(run('PXAW.stats.errors'), 0);
  console.log(`  vento ${wind}: ${rs.length} decolagens (corridas ${rs.map(r => (r.t1 - r.t0).toFixed(1)).join('/')} s), ${run('PXAW.stats.landings')} pousos, piloto desce/relata/volta à vaga (${climbed}/${debrief}/${backHome} quadros)`);
}

/* ---------- 5. interceptação: pilotos correm, tudo mais rápido que numa patrulha comum ---------- */
{
  const norm = world(7), hur = world(7);
  norm.run(`PXAW.dispatch(0,'cap',1000,900)`); hur.run(`PXAW.dispatch(0,'cap',1000,900)`);
  steps(norm.run, 9); steps(hur.run, 9);
  norm.run(`PXAW.dispatch(0,'cap',1000,900)`);
  hur.run(`(()=>{const f=PXAW.dispatch(0,'int',1000,900);return !!f})()`);
  let tn = null, th = null;
  for (let i = 0; i < 120 * 30 && (tn == null || th == null); i++) {
    if (tn == null) { steps(norm.run, 1 / 30); if (norm.run(`PXAW._internals.AC().some(a=>a.team===0&&a.st==='air'&&a.flight&&a.flight.kind==='cap')`)) tn = norm.run('time') }
    if (th == null) { steps(hur.run, 1 / 30); if (hur.run(`PXAW._internals.AC().some(a=>a.team===0&&a.st==='air'&&a.flight&&a.flight.kind==='int')`)) th = hur.run('time') }
  }
  assert.ok(tn != null && th != null, 'os dois voos decolam');
  assert.ok(th < tn - 3, `interceptação sai mais rápido que patrulha (${(th - 9).toFixed(0)} s × ${(tn - 9).toFixed(0)} s)`);
  console.log(`  interceptação: 1ª decolagem ${(th - 9).toFixed(0)} s depois da ordem (patrulha: ${(tn - 9).toFixed(0)} s)`);
}
console.log('Aeródromo 1.13: layout, partida, hélice, um de cada vez na faixa, decolagem, pouso, pessoas e interceptação OK');
