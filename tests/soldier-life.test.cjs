const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// soldier-life.js (1.9): água funda sem tiro, posturas de trincheira com proteção real, abaixar com explosão (reação e pausa),
// escalar o parapeito ao sair, grito de médico quando um companheiro cai, e o efeito medido: uma trincheira suprimida
// fica mais protegida mas para de atirar.
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function engine() {
  let serial = 0;
  const sb = {
    console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity,
    W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null,
    units: [], particles: [], buildings: [], fieldTrenches: [], trenchGrid: new Map(), cam: { x: 0, y: 0 }, mouse: { down: false },
    location: { search: '' }, PX: { Z: .5 }, water: [],
    PXW: { depth: (x, y) => { for (const w of sb.water) if (Math.abs(x - w.x) < w.hw) return w.d; return 0; }, mudAt: () => 0 },
    document: { createElement: () => ({ getContext: () => ({}) }), getElementById: () => null, querySelector: () => null },
    toasts: [], toast(s) { sb.toasts.push(s); }, setup() {}, explode() {},
    protectedBy(u) { return sb.fieldTrenches.some(t => Math.abs(t.x - u.x) < t.hw && Math.abs(t.y - u.y) < t.hh) ? .35 : 1; },
    damage(u, n) { if (u.hp <= 0) return; if (u.hp - n <= 0 && u.woundable) { u.hp = 1; u.down = true; return; } u.hp -= n; },
    update(dt) {
      sb.time += dt;
      for (const u of sb.units) { u.cd = Math.max(0, u.cd - dt); u.suppression = Math.max(0, u.suppression - dt * .18); u.moving = false;
        if (u.order === 'move' && !u.down) { const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy); if (d > 2) { const s = Math.min(d, 47 * dt); u.x += dx / d * s; u.y += dy / d * s; u.moving = true; } }
        if (u.target && u.cd <= 0 && !u.down) { u.cd = 1.5; u.shots = (u.shots || 0) + 1; } }
    },
  };
  sb.window = sb; sb.addEventListener = () => {};
  vm.createContext(sb);
  for (const f of ['life-kit.js', 'soldier-life.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
  sb.u = (team, x, y, extra = {}) => { const u = { id: ++serial, type: 'rifle', team, x, y, hp: 100, maxhp: 100, angle: 0, cd: 0, order: 'hold', tx: x, ty: y, suppression: 0, ...extra }; sb.units.push(u); return u; };
  sb.trench = (x, y, team = 0) => { const t = { x, y, hw: 16, hh: 16, team }; sb.fieldTrenches.push(t); const k = Math.floor(x / 128) + ',' + Math.floor(y / 128); if (!sb.trenchGrid.has(k)) sb.trenchGrid.set(k, []); sb.trenchGrid.get(k).push(t); return t; };
  sb.run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };
  return sb;
}

/* ---------- água ---------- */
{
  const sb = engine(); sb.water.push({ x: 600, hw: 40, d: .7 }, { x: 700, hw: 30, d: .35 });
  const deep = sb.u(0, 600, 500, { target: { x: 900, y: 500 } }), shallow = sb.u(0, 700, 500, { target: { x: 900, y: 500 } }), dry = sb.u(0, 800, 500, { target: { x: 900, y: 500 } });
  sb.run(10);
  console.log(`  10 s com alvo: água funda ${deep.shots || 0} tiros · rasa ${shallow.shots} · seco ${dry.shots}`);
  assert.equal(deep.shots || 0, 0, 'em água funda não atira'); assert.ok(shallow.shots >= 5 && dry.shots >= 5);
  assert.equal(deep.lf.water, 2); assert.equal(shallow.lf.water, 1);
  sb.mode = 'soldier'; sb.player = deep; sb.run(.5); assert.ok(sb.toasts.some(t => /Água funda/.test(t)), 'o jogador é avisado');
}

/* ---------- trincheira: posturas e proteção ---------- */
{
  const sb = engine(); sb.trench(500, 500);
  const a = sb.u(0, 500, 500, { target: { x: 900, y: 500 } }); sb.run(.5);
  assert.equal(a.lf.pose, 'aim'); assert.equal(sb.protectedBy(a), .35, 'mirando: proteção normal');
  a.suppression = 1.4; sb.run(.4);
  assert.equal(a.lf.pose, 'low'); assert.equal(sb.protectedBy(a), .18, 'suprimido: abaixado, proteção .18');
  const shots0 = a.shots; for (let i = 0; i < 40; i++) { a.suppression = 1.4; sb.run(.25); }
  assert.equal(a.shots, shots0, 'abaixado não atira');
  a.target = null; a.suppression = 0; a.underFire = 1; sb.run(.4); assert.equal(a.lf.pose, 'peek'); assert.equal(sb.protectedBy(a), .28);
  a.underFire = 0; sb.run(.4); assert.equal(a.lf.pose, 'rest');
  // A/B: 6 defensores sob uma MG que mantém supressão 1.2 por 20 s
  const ab = on => { const s2 = engine(); if (!on) s2.PXLIFE.on = false; for (let i = 0; i < 6; i++) s2.trench(500, 400 + i * 40);
    const d = []; for (let i = 0; i < 6; i++) d.push(s2.u(0, 500, 400 + i * 40, { target: { x: 900, y: 500 } }));
    let exp = 0; for (let k = 0; k < 400; k++) { for (const u of d) u.suppression = 1.2; s2.run(.05); for (const u of d) exp += s2.protectedBy(u) * .05; }
    return { shots: d.reduce((n, u) => n + (u.shots || 0), 0), exposure: exp / 6 / 20 }; };
  const off = ab(false), on = ab(true);
  console.log(`  trincheira sob MG (supressão 1.2, 20 s): sem posturas ${off.shots} tiros, exposição ${off.exposure.toFixed(2)} · com posturas ${on.shots} tiros, exposição ${on.exposure.toFixed(2)}`);
  assert.ok(on.exposure < off.exposure * .6 && on.shots < off.shots * .2, 'suprimir uma trincheira a cala, e quem se abriga sofre menos');
}

/* ---------- explosão: reação e pausa ---------- */
{
  const sb = engine(); const m = sb.u(0, 500, 500, { order: 'move', tx: 900, ty: 500 }), far = sb.u(0, 500, 900, { order: 'move', tx: 900, ty: 900 });
  sb.run(.2); sb.explode(560, 500, 40, 100, 1); const sup = m.suppression;
  assert.ok(m.lf.duckAt > sb.time && m.lf.duckAt - sb.time <= .35, 'reage em 0,1–0,35 s');
  const x0 = m.x, f0 = far.x; sb.run(1); const moved = m.x - x0, movedFar = far.x - f0;
  console.log(`  1 s após explosão a 60 px: andou ${moved.toFixed(1)} px (longe da explosão: ${movedFar.toFixed(1)} px)`);
  assert.ok(moved < movedFar * .6 && sup > 0, 'abaixa, quase para e fica suprimido');
  assert.ok(sb.IFK.shouts.some(s => s.txt === 'GET DOWN!'), 'alguém grita "GET DOWN!"');
}

/* ---------- escalar o parapeito e chamar o médico ---------- */
{
  const sb = engine(); sb.trench(500, 500); const c = sb.u(0, 500, 500, { order: 'move', tx: 700, ty: 500 }); sb.run(.6);
  let climbed = false; for (let i = 0; i < 40; i++) { sb.run(.05); if (c.lf.climb > sb.time) climbed = true; }
  assert.ok(climbed && sb.PXLIFE.stats.climbs === 1, 'sai da trincheira escalando');
  const sb2 = engine(); const w = sb2.u(1, 500, 500, { woundable: true }), buddy = sb2.u(1, 530, 500);
  sb2.damage(w, 200); assert.ok(w.down);
  assert.ok(sb2.IFK.shouts.some(s => s.u === buddy && s.txt === 'SANI!'), 'o companheiro alemão grita "SANI!"');
}
console.log('Vida 1.9: água funda sem tiro, posturas de trincheira, reação a explosão, escalar o parapeito e grito de médico OK');
