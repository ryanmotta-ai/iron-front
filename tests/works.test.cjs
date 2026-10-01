const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// works.js (1.9): as 4 obras novas entram no catálogo do construtor; toca vira cobertura; depósito remunicia infantaria,
// granadas e artilharia e explode junto quando atingido; posto de observação revela a névoa e corrige a artilharia.
let seed = 8; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
let serial = 0;
const anchors = [];
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity, setTimeout: f => f(),
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null, sandbox: true,
  units: [], buildings: [], fieldTrenches: anchors, particles: [], aiEnabled: [false, false], supplies: [999, 999], location: { search: '' },
  weapon: 'rifle', ammo: 5, magazines: { rifle: 5 }, weapons: { rifle: { mag: 5 } }, missions: [], booms: [],
  document: { createElement: () => ({ getContext: () => ({ fillRect() {} }), width: 0, height: 0 }) },
  PXSAP: { cfg: { KIND: { trench: {} } }, addAnchor(s, o) { anchors.push({ x: s.x, y: s.y, team: s.team, hw: o.hw, hh: o.hh }); }, lineB() {}, project() { return {}; } },
  PXFORT: { KINDS: ['trench'], SHORT: {}, SUB: {}, planExtra: [], isPrep: () => false },
  PXBAT: { batteries: [{ team: 0, x: 600, y: 500, ammo: 10 }], mission(team, x, y, count, spread, kind) { sb.missions.push({ spread }); return true; } },
  PXW: { fow: { on: true, team: 0, cw: Math.ceil(2400 / 64), grid: new Uint8Array(Math.ceil(2400 / 64) * Math.ceil(1600 / 64)) } },
  toasts: [], toast(s) { sb.toasts.push(s); }, setup() {}, update(dt) { sb.time += dt; },
  explode(x, y, r, power) { sb.booms.push({ x, y, r, power }); }, newBuilding(type, team, x, y) { const b = { type, team, x, y }; sb.buildings.push(b); return b; },
};
sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/works.js'), 'utf8'), sb);
const S = sb.PXWORKS, K = sb.PXSAP.cfg.KIND;
assert.deepEqual(['foxhole', 'depot', 'op', 'chevaux'].filter(k => sb.PXFORT.KINDS.includes(k) && K[k]), ['foxhole', 'depot', 'op', 'chevaux'], 'as 4 obras entram no catálogo');
assert.equal(sb.PXFORT.planExtra.length, 1, 'a IA planeja depósitos e posto na trégua');
const seg = (kind, x, y) => ({ kind, team: 0, x, y, stage: 0, work: 0, need: K[kind].need, p: {} });
K.foxhole.onStage(seg('foxhole', 900, 800), 1); assert.equal(anchors.length, 1, 'toca vira cobertura');
const ds = seg('depot', 500, 520); K.depot.onStage(ds, 2); const op = seg('op', 900, 600); K.op.onStage(op, 2); K.chevaux.onStage(seg('chevaux', 700, 700), 1);
assert.ok(sb.buildings.some(b => b.type === 'wire' && b.chev), 'cavalo de frisa é um trecho de arame');
const r = { id: ++serial, type: 'rifle', team: 0, x: 560, y: 520, hp: 100, ammo: 1, gren: 0 }, g = { id: ++serial, type: 'rifle', cls: 'grenadier', team: 0, x: 520, y: 560, hp: 100, ammo: 5, gren: 3 };
sb.units.push(r, g);
for (let i = 0; i < 30 * 16; i++) sb.update(1 / 30);
console.log(`  16 s junto ao depósito: pente ${r.ammo}/5, granadas fuzileiro ${r.gren}, granadeiro ${g.gren}/6, peça de artilharia ${sb.PXBAT.batteries[0].ammo} projéteis (era 10)`);
assert.ok(r.ammo === 5 && r.gren === 2 && g.gren >= 6 && sb.PXBAT.batteries[0].ammo > 10, 'remunicia');
/* posto de observação */
const f = sb.PXW.fow, cell = (x, y) => f.grid[Math.floor(y / 64) * f.cw + Math.floor(x / 64)];
assert.equal(cell(1300, 600), 1, 'névoa revelada a 400 px do posto'); assert.equal(cell(1600, 600), 0, 'a 700 px não');
sb.PXBAT.mission(0, 1250, 650, 6, 100, 'he'); sb.PXBAT.mission(0, 2000, 650, 6, 100, 'he');
assert.ok(sb.missions[0].spread === 60 && sb.missions[1].spread === 100, 'artilharia corrigida perto do posto');
/* explosão secundária */
sb.explode(510, 520, 95, 260, 1);
assert.ok(S.stats.depotBlasts === 1 && sb.booms.some(b => b.r === 90), 'depósito atingido explode junto (raio 90)');
assert.ok(ds.wreck, 'fica em ruínas');
assert.equal(S.stats.errors, 0);
console.log('Obras 1.9: toca, depósito de munição, posto de observação e cavalo de frisa OK');
