const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Carrega sappers.js + fortify.js num mini-motor e testa a preparação (trégua, barreira, orçamento, todos cavando),
// o plano de defesa da IA (espelhado e por prioridade), estruturas novas (abrigo, bunker, antiaérea, peça) e o fim da trégua.
let serial = 0;
const guns = [];
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, URLSearchParams,
  W: 2400, H: 1600, GH: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, sandbox: false, playerTeam: 0, mode: 'commander', player: null,
  map: 'trenches', tab: 'units', placement: null, soundOn: false, audio: null, keys: {}, screenShake: 0, maxUnits: 160,
  units: [], buildings: [], shells: [], particles: [], bullets: [], planes: [], fieldTrenches: [], trenchGrid: new Map(), allCraters: [], points: [{ x: 1200, y: 800, progress: 0, owner: -1 }],
  supplies: [600, 600], aiEnabled: [false, true], aiDecisionTimer: [5, 5], supportCooldown: [0, 0], cam: { x: 0, y: 0 }, mouse: { x: 0, y: 0, wx: 0, wy: 0 }, selected: new Set(),
  defs: { rifle: { rate: 1.5, hp: 100 }, mg: { rate: .22 }, sandbag: { cost: 50 }, wire: { cost: 40 }, artillery: { cost: 160 } },
  location: { search: '' }, canvas: { style: {} },
  document: { querySelector: () => null, getElementById: () => null, createElement: () => ({ getContext: () => ({ fillRect() {}, clearRect() {} }), style: {}, append() {} }), body: { dataset: {}, append() {} } },
  PX: { Z: .5, WW1: { CLEAN: { forts: false }, PW: 1200, reinforceX: t => t ? 2184 : 216, layout: () => ({ gunsPlan: [{ k: 'f', x: 160, y: 300 }, { k: 'h', x: 120, y: 500 }] }) } },
  PXBAT: { addGun(team, x, y, k) { const b = { team, x, y, k }; guns.push(b); return b; }, removeGun() { return true; }, mission() { return true; } },
  toasts: [], toast(s) { sb.toasts.push(s); }, sound() {}, hud() {}, render() {}, makeCards() {}, icon() {}, choose() {}, place() {}, setup() {}, worldMouse() {},
  explode() {}, aiGrenade() { sb.gren = true; }, grenade() {}, spend() { return true; }, callFighter() {}, callBomber() {}, observationRange: () => 760, incomeFor: () => 8,
  shoot(u) { sb.shots = (sb.shots || 0) + 1; },
  runCommander(t) { sb.cmd = (sb.cmd || 0) + 1; },
  update(dt) {
    sb.time += dt;
    for (const u of sb.units) { if (u.order !== 'move') continue; const dx = u.tx - u.x, dy = u.ty - u.y, l = Math.hypot(dx, dy); if (l > 12) { const s = Math.min(l, 60 * dt); u.x += dx / l * s; u.y += dy / l * s; } else u.order = 'hold'; }
    sb.points[0].progress += 5 * dt; sb.runCommander(1); for (const u of sb.units) sb.shoot(u);
    sb.inc = (sb.inc || 0) + dt; if (sb.inc >= 1) { sb.inc--; for (let t = 0; t < 2; t++) sb.supplies[t] = Math.min(2400, sb.supplies[t] + 8); }
  },
  protectedBy(u) { let f = 1; for (const t of sb.fieldTrenches) if (Math.abs(t.x - u.x) < t.hw && Math.abs(t.y - u.y) < t.hh) f = .35; return f; },
  damage(u, n) { u.hp -= n; },
  newUnit(type, team, x, y) { const u = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, manualUntil: 0, suppression: 0, angle: 0, cd: 0 }; sb.units.push(u); return u; },
  squad(type, team, x, y, n = 3) { for (let i = 0; i < n; i++) sb.newUnit(type, team, x + i * 6, y); },
  newBuilding(type, team, x, y) { const b = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100 }; sb.buildings.push(b); return b; },
};
sb.window = sb; sb.addEventListener = () => {};
vm.createContext(sb);
for (const f of ['sappers.js', 'fortify.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
const F = sb.PXFORT, SAP = sb.PXSAP;
const run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };

// exércitos na área de reunião
for (let t = 0; t < 2; t++) { for (let i = 0; i < 30; i++) sb.newUnit('rifle', t, t ? 1900 - (i % 6) * 30 : 500 + (i % 6) * 30, 200 + i * 40); sb.newUnit('mg', t, t ? 1950 : 450, 800); }
sb.setup();
let st = F.state();
assert.ok(st.active && st.prep === 300, 'trégua de 300 s');
assert.equal(sb.supplies.join(), '4500,4500', 'orçamento da preparação');
assert.ok(sb.units.filter(u => u.type === 'rifle').every(u => u.sap), 'toda a infantaria ajuda a cavar');

// 1. plano: espelhado, prioridades (primeira linha antes da artilharia), tudo do próprio lado
const p0 = F.plan(0), p1 = F.plan(1);
assert.equal(p0.length, p1.length);
assert.ok(p0.findIndex(i => i.kind === 'trench') < p0.findIndex(i => i.kind === 'gunf'), 'primeiro a trincheira, depois a artilharia');
assert.ok(p0.every(i => i.pts.every(([x]) => x < 1130)) && p1.every(i => i.pts.every(([x]) => x > 1270)), 'cada plano do seu lado da barreira');
for (const k of ['trench', 'nest', 'wire', 'gunf', 'gunh', 'dugout', 'bunker', 'pillbox', 'mortar', 'aa', 'comm']) assert.ok(p0.some(i => i.kind === k), 'plano tem ' + k);

// 2. trégua: sem tiro, sem granada, sem comando da IA, sem captura, barreira no centro
sb.shots = 0; sb.cmd = 0; const tank = sb.newUnit('tank', 0, 1100, 800); tank.order = 'move'; tank.tx = 1600;
run(3);
assert.equal(sb.shots, 0, 'ninguém atira na trégua');
assert.equal(sb.cmd, 0, 'comando da IA parado');
assert.ok(tank.x <= 1130, 'barreira segura o avanço');
assert.equal(sb.points[0].progress, 0, 'objetivos congelados');
assert.ok(SAP.canBuild(0, 1000, 500) && !SAP.canBuild(0, 1300, 500), 'só se constrói do próprio lado');

// 3. a IA (lado 1) constrói em paralelo; o teto de 2400 da renda não apaga o orçamento
run(60);
st = F.state();
assert.ok(st.forts >= 4, `obras em paralelo (${st.forts})`);
assert.ok(sb.supplies[0] > 4500, 'o orçamento do jogador continua (renda por cima)');
assert.ok(st.anchors[1] > 0, 'trechos de trincheira da IA prontos');

// 4. estruturas novas do jogador: abrigo protege muito, antiaérea e peça entram no jogo
SAP.cfg.MAXPROJ.player = 40;
const dug = SAP.order('dugout', [[600, 300]]), aa = SAP.order('aa', [[420, 400]]), gun = SAP.order('gunf', [[380, 600]]), bk = SAP.order('bunker', [[700, 1000]]);
assert.ok(dug && aa && gun && bk);
run(110);
st = F.state();
assert.ok(st.dugouts >= 1 && sb.protectedBy({ type: 'rifle', x: 600, y: 300 }) <= .15, 'abrigo: 85% menos dano');
assert.ok(st.aa >= 1, 'antiaérea montada');
assert.ok(guns.some(g => g.team === 0 && g.k === 'f'), 'canhão vira bateria tripulada (PXBAT.addGun)');
assert.ok(sb.buildings.some(b => b.type === 'bunker' && b.team === 0), 'bunker com MG');

// 5. antiaérea derruba avião inimigo depois da trégua
F.endPrep();
assert.ok(!F.phase.on && !SAP.hold, 'fim da trégua');
assert.ok(sb.units.filter(u => u.sapTmp).length === 0 && sb.units.filter(u => u.type === 'rifle' && u.sap).length === 12, 'infantaria volta a ser infantaria (ficam os 6 engenheiros de campo de cada lado)');
assert.equal(sb.aiDecisionTimer.join(), '0,0', 'comando da IA assume na hora');
const plane = { kind: 'fighter', team: 1, x: 430, y: 380, delay: 0 }; sb.planes.push(plane);
for (let i = 0; i < 400 && !plane.downed; i++) { plane.x = 430; sb.update(.05); }
assert.ok(plane.downed, 'avião abatido pela antiaérea');

assert.equal(F.stats.errors, 0); assert.equal(SAP.stats.errors, 0);
console.log('Fortificação 1.5: trégua de 300 s (sem tiro, barreira, orçamento), plano espelhado por prioridade, IA construindo, abrigo, antiaérea, canhão tripulado, bunker e fim da trégua OK');
