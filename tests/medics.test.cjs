const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// medics.js num mini-motor: ferimento grave (cai em vez de morrer), não é alvo, padioleiros buscam, tratamento salva, sangra até morrer sem socorro.
let serial = 0;
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON,
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null,
  units: [], particles: [], selected: new Set(), location: { search: '' },
  document: { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }) }) }, PX: { Z: .5 },
  IronFrontBrain: { selectTarget(u, list, r, can) { return list.find(e => e.team !== u.team && e.hp > 0 && (!can || can(u, e))) || null; } },
  toasts: [], toast(s) { sb.toasts.push(s); }, setup() {}, explode() {}, protectedBy() { return 1; },
  update(dt) { sb.time += dt; sb.units = sb.units.filter(u => u.hp > 0); },
  damage(u, n) { if (u.hp <= 0) return; u.hp -= n; if (u.hp <= 0) sb.dead = (sb.dead || 0) + 1; },
};
sb.window = sb; sb.addEventListener = () => {};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/medics.js'), 'utf8'), sb);
const M = sb.PXMED; M.cfg.WOUND = 1;
const run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };
const unit = (type, team, x, y) => { const u = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, manualUntil: 0, cd: 0 }; sb.units.push(u); return u; };
sb.setup();
assert.equal(M.posts.length, 2, 'um posto pronto por lado');
const w = unit('rifle', 0, 600, 800), enemy = unit('rifle', 1, 1800, 300);
sb.damage(w, 120);
assert.ok(w.down && w.hp === 1, 'ferimento grave: cai em vez de morrer');
assert.equal(sb.IronFrontBrain.selectTarget(enemy, sb.units, 9999), null, 'caído não é mais alvo');
run(1); assert.ok(w.claimed, 'padioleiros a caminho');
M.cfg.SAVE = 1; run(45);
assert.ok(!w.down && w.hp >= 60, 'tratado no posto e de volta à luta');
assert.equal(M.stats.saved, 1);
const far = unit('rifle', 0, 1150, 1500); sb.damage(far, 110);
assert.ok(far.down); M.cfg.RANGE = 10; run(80);
assert.ok(far.hp <= 0 && M.stats.lost === 1, 'sem socorro, sangra até morrer');
const boom = unit('rifle', 0, 500, 500); sb.damage(boom, 400);
assert.ok(boom.hp <= 0 && !boom.down, 'explosão que despedaça mata na hora');
assert.equal(M.stats.errors, 0);
console.log('Socorro 1.6: ferido grave, fora da mira, padioleiros, tratamento, sangramento e morte por explosão OK');
