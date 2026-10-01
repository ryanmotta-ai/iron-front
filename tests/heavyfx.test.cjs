const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// heavyfx.js (1.9): o disparo do poço de morteiro passa a ter bomba em voo (arco até o impacto), fumaça de boca e assobio
// de chegada perto do ouvinte.
const post = { team: 0, x: 600, y: 800, fl: 0, cd: 0 }, whistles = [];
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity,
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, mode: 'soldier', player: { x: 1000, y: 800 }, cam: { x: 0, y: 0 },
  shells: [], particles: [], location: { search: '' }, PX: { Z: .5 }, PXSAP: { posts: [post] },
  SNDSCAPE: { whistle(x, y, d) { whistles.push(d); } },
  document: { createElement: () => ({ getContext: () => ({}) }) }, setup() {},
  update(dt) { sb.time += dt; post.fl = Math.max(0, post.fl - dt); sb.shells = sb.shells.filter(s => (s.t -= dt) > 0);
    if (sb.fire) { sb.fire = false; post.fl = .18; sb.shells.push({ x: 1000, y: 810, t: 2.2, r: 50, team: 0 }); } },
};
sb.window = sb; vm.createContext(sb);
for (const f of ['life-kit.js', 'heavyfx.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
const F = sb.PXHFX;
sb.shells.push({ x: 200, y: 200, t: 5, r: 40, team: 1 }); sb.update(1 / 30);      // projétil que não é do morteiro
sb.fire = true; const p0 = sb.particles.length; sb.update(1 / 30);
assert.equal(F.stats.flights, 1, 'só o projétil do poço vira voo');
assert.ok(sb.particles.length - p0 >= 10, 'fumaça de boca e anel de poeira');
const prog = []; for (let i = 0; i < 70; i++) { sb.update(1 / 30); const f = F.flights()[0]; if (f && i % 15 === 0) prog.push(+(1 - f.s.t / f.T).toFixed(2)); }
console.log(`  progresso do arco: ${prog.join(' → ')} · assobio de chegada: ${whistles.length ? whistles[0].toFixed(2) + ' s' : 'não'}`);
assert.ok(prog.length >= 3 && prog.every((v, i) => !i || v > prog[i - 1]), 'a bomba avança no arco');
assert.equal(whistles.length, 1, 'assobia no fim do voo, perto do jogador');
sb.update(.5); assert.equal(F.flights().length, 0, 'o voo termina no impacto');
assert.equal(F.stats.errors, 0);
console.log('Morteiro 1.9: bomba em voo, fumaça de boca e assobio de chegada OK');
