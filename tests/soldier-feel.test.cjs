const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// soldier-feel.js (1.9): quase-acerto (supressão, terra, marcador de direção, tranco), dispersão dos tiros do jogador sob fogo,
// operar a metralhadora aliada com E (fita, tripé, volta ao soldado) e a linha de dicas contextual.
let seed = 9; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hintEl = { textContent: '' };
let serial = 0;
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity,
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'soldier', player: null,
  units: [], particles: [], bullets: [], buildings: [], fieldTrenches: [], trenchGrid: new Map(), cam: { x: 0, y: 0 }, mouse: { down: false, wx: 0, wy: 0 }, keys: {},
  weapon: 'rifle', ammo: 5, reload: 0, magazines: { rifle: 5, smg: 20, pistol: 7 },
  weapons: { rifle: { name: 'SPRINGFIELD', mag: 5, reload: 2.4, rate: 1.7, damage: 30, range: 360, spread: .025 } },
  location: { search: '' }, PX: { Z: .5 }, localStorage: { getItem: () => null },
  document: { createElement: () => ({ getContext: () => ({}), textContent: '' }), head: { appendChild() {} }, getElementById: id => id === 'hint' ? hintEl : null, querySelector: () => null },
  toasts: [], toast(s) { sb.toasts.push(s); }, hud() {}, setup() {}, explode() {}, render() {}, setMode() {}, changeWeapon() { sb.changed = true; },
  shoot(u, t, manual) { const a = Math.atan2(sb.mouse.wy - u.y, sb.mouse.wx - u.x); u.cd = sb.weapons[sb.weapon].rate; sb.bullets.push({ x: u.x, y: u.y, vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, t: .4, team: u.team, damage: 30 }); },
  update(dt) {
    sb.time += dt; const p = sb.player;
    for (const u of sb.units) u.cd = Math.max(0, (u.cd || 0) - dt);
    if (p) { const dx = (sb.keys.d ? 1 : 0) - (sb.keys.a ? 1 : 0); p.x += dx * 77 * dt; p.moving = !!dx;
      if (sb.mouse.down && p.cd <= 0 && sb.ammo > 0) { sb.shoot(p, null, true); sb.ammo--; } }
    for (const b of sb.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  },
};
sb.window = sb; sb.addEventListener = () => {};
vm.createContext(sb);
for (const f of ['life-kit.js', 'soldier-feel.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
const F = sb.PXFEEL, unit = (type, team, x, y) => { const u = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100, angle: 0, cd: 0, suppression: 0 }; sb.units.push(u); return u; };
const me = unit('rifle', 0, 500, 500); sb.player = me;

/* quase-acerto */
sb.bullets.push({ x: 900, y: 512, vx: -800, vy: 0, t: 1, team: 1, damage: 30 });
for (let i = 0; i < 20; i++) sb.update(1 / 30);
assert.equal(F.stats.nearMiss, 1, 'bala a 12 px conta como quase-acerto');
assert.ok(me.suppression > .08, `supressão subiu para ${me.suppression.toFixed(2)}`);
assert.ok(F.state().threats === 1 && sb.particles.length >= 3, 'marcador de direção e terra levantada');
sb.bullets.push({ x: 900, y: 600, vx: -800, vy: 0, t: 1, team: 1, damage: 30 }); for (let i = 0; i < 20; i++) sb.update(1 / 30);
assert.equal(F.stats.nearMiss, 1, 'a 100 px não conta');

/* dispersão sob fogo */
const spreadOf = s => { const errs = []; for (let i = 0; i < 300; i++) { me.suppression = s; me.moving = false; sb.bullets.length = 0; sb.mouse.wx = 900; sb.mouse.wy = 500; sb.shoot(me, null, true); const b = sb.bullets[0]; errs.push(Math.abs(Math.atan2(b.vy, b.vx))); } return errs.reduce((a, b) => a + b, 0) / errs.length; };
const calm = spreadOf(0), under = spreadOf(1.6);
console.log(`  erro angular médio do jogador: calmo ${calm.toFixed(3)} rad · suprimido (1.6) ${under.toFixed(3)} rad`);
assert.ok(calm < .005 && under > .03, 'sob fogo a mira piora');
me.suppression = 0;

/* metralhadora */
const mg = unit('mg', 0, 520, 500);
assert.ok(F.keyE(), 'E perto da MG aliada');
assert.equal(sb.player, mg); assert.equal(sb.weapon, 'mg'); assert.equal(sb.ammo, 250);
sb.mouse.down = true; sb.keys.d = true; const x0 = mg.x; for (let i = 0; i < 60; i++) sb.update(1 / 30); sb.mouse.down = false; sb.keys.d = false;
console.log(`  2 s na MG: ${250 - sb.ammo} tiros, deslocamento ${(mg.x - x0).toFixed(1)} px`);
assert.ok(250 - sb.ammo >= 14 && mg.x === x0, 'atira em rajada e não anda com o tripé');
sb.changeWeapon('smg'); assert.ok(!sb.changed, 'não troca de arma na MG');
assert.ok(F.keyE()); assert.equal(sb.player, me); assert.equal(sb.weapon, 'rifle'); assert.ok(mg.belt < 250, 'devolve o soldado e guarda a fita');

/* dicas */
sb.update(.5); assert.ok(/E assumir a MG/.test(hintEl.textContent), `dica contextual: "${hintEl.textContent.slice(0, 40)}"`);
assert.equal(F.stats.errors, 0);
console.log('Sensação 1.9: quase-acerto, mira sob fogo, metralhadora operada pelo jogador e dica contextual OK');
