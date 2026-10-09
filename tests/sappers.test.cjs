const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Carrega sappers.js com um ambiente mínimo (sem DOM/canvas) e testa geometria, ciclo de 3 estágios, integração com
// fieldTrenches/trenchGrid/sandbag, artilharia contra a obra, supressão, ordem manual, sapa em zigue-zague, reparo e morteiro.
let serial = 0;
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON,
  W: 2400, H: 1600, GH: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, sandbox: false, playerTeam: 0, mode: 'commander', player: null,
  map: 'forest', tab: 'units', placement: null, soundOn: false, maxUnits: 160,
  units: [], buildings: [], shells: [], particles: [], fieldTrenches: [], trenchGrid: new Map(), allCraters: [], points: [],
  supplies: [1000, 1000], aiEnabled: [false, false], supportCooldown: [0, 0], cam: { x: 0, y: 0 }, mouse: { x: 0, y: 0, wx: 0, wy: 0 },
  defs: { rifle: { hp: 100, count: 8 }, sandbag: { cost: 50, hp: 350 }, wire: { cost: 40, hp: 180 }, artillery: { cost: 160 } },
  location: { search: '' }, canvas: {}, document: { querySelector: () => null, getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) },
  PX: { Z: .5 },
  toasts: [], toast(s) { sb.toasts.push(s); }, sound() {}, worldMouse() {}, observationRange: () => 760, choose() {},
  makeCards() {}, icon() {}, setup() {}, explode() {}, render() {},
  update(dt) { // motor mínimo: avança o relógio e anda quem tem ordem de mover (como game.js: só se faltar > 12 px)
    sb.time += dt;
    for (const u of sb.units) { if (u.order !== 'move') continue; const dx = u.tx - u.x, dy = u.ty - u.y, l = Math.hypot(dx, dy);
      if (l > 12) { const s = Math.min(l, 47 * dt); u.x += dx / l * s; u.y += dy / l * s; if (l < 20) u.order = 'hold'; } else u.order = 'hold'; }
  },
  protectedBy(u) { let f = 1; for (const t of sb.fieldTrenches) if (Math.abs(t.x - u.x) < t.hw && Math.abs(t.y - u.y) < t.hh) f = .35; return f; },
  newUnit(type, team, x, y) { const u = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, manualUntil: 0, suppression: 0, angle: 0, target: null }; sb.units.push(u); return u; },
  squad(type, team, x, y) { for (let i = 0; i < 3; i++) sb.newUnit(type, team, x + i * 5, y); },
  newBuilding(type, team, x, y) { const b = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100 }; sb.buildings.push(b); return b; },
};
sb.window = sb; sb.addEventListener = () => {};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/sappers.js'), 'utf8'), sb);
const S = sb.PXSAP, G = S._;
const run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };

// 1. geometria
const segs = G.segment([[700, 400], [700, 490]]);
assert.equal(segs.length, 3, '90 px viram 3 trechos de 30');
assert.ok(Math.abs(segs[0].y - 415) < 1e-9 && segs.every(s => s.ax === 0 && s.ay === 1));
const zz = G.zigzag(724, 800, 1, 4, 1);
assert.equal(zz.length, 5);
for (let i = 1; i < zz.length; i++) assert.ok(zz[i][0] > zz[i - 1][0], 'a sapa sempre avança rumo ao inimigo');
assert.ok(Math.sign(zz[1][1] - zz[0][1]) === -Math.sign(zz[2][1] - zz[1][1]), 'as pernas alternam de lado (zigue-zague)');
assert.equal(G.gkey(300, 130), '2,1');
assert.equal(G.rate(3), 1); assert.ok(G.rate(1) < G.rate(2) && G.rate(2) < 1); assert.equal(G.rate(0), 0);
assert.equal(G.enemyNormal(0, 1, 1).map(v => Math.round(v) + 0).join(), [1, 0].join(), 'normal de trecho N-S aponta para o leste do lado 0');
assert.equal(G.enemyNormal(0, 1, -1).map(v => Math.round(v) + 0).join(), [-1, 0].join());

// 2. início: os 6 fuzileiros mais recuados de cada lado viram engenheiros de campo
for (let t = 0; t < 2; t++) for (let i = 0; i < 10; i++) sb.newUnit('rifle', t, t ? 1700 + i * 20 : 700 - i * 20, 400 + i * 3);
sb.fieldTrenches.push({ id: 'f0', type: 'trench', team: 0, x: 720, y: 400, hw: 16, hh: 16 }, { id: 'f1', type: 'trench', team: 1, x: 1680, y: 400, hw: 16, hh: 16 });
sb.setup();
const sap0 = sb.units.filter(u => u.team === 0 && u.sap), sap1 = sb.units.filter(u => u.team === 1 && u.sap);
assert.equal(sap0.length, 6); assert.equal(sap1.length, 6);
assert.ok(Math.max(...sap0.map(u => u.x)) < Math.min(...sb.units.filter(u => u.team === 0 && !u.sap).map(u => u.x)), 'lado 0: os mais recuados (menor x)');
assert.ok(Math.min(...sap1.map(u => u.x)) > Math.max(...sb.units.filter(u => u.team === 1 && !u.sap).map(u => u.x)), 'lado 1: os mais recuados (maior x)');
assert.equal(S.state().front.join(), "720,1680");
const nu = sb.newUnit('sapper', 0, 500, 500);
assert.equal(nu.type, 'rifle', 'engenheiro de campo comprado é fuzileiro (tabelas da física por tipo)'); assert.equal(nu.sap, 1);
sb.units.splice(sb.units.indexOf(nu), 1);

// 3. ordem do jogador: trincheira de ligação em 3 estágios
const before = sb.supplies[0];
const p = S.order('trench', [[640, 500], [640, 590]]);
assert.ok(p); assert.equal(p.segs.length, 3); assert.equal(sb.supplies[0], before - 30);
run(1);
assert.equal(p.crew.length, 3, '3 sapadores designados');
run(12);
const s0 = p.segs[0];
assert.ok(p.crew.every(id => sb.units.find(u => u.id === id).sapState === 'dig'), 'chegaram e estão cavando');
run(12);
assert.ok(s0.stage >= 1, 'estágio 1 (vala rasa) em ~10 s de obra');
const probe = { type: 'rifle', x: s0.x, y: s0.y, team: 0 };
if (s0.stage === 1) assert.equal(sb.protectedBy(probe), .7, 'vala rasa: 30% de redução');
run(18);
assert.ok(s0.stage >= 2 && s0.anchor, 'estágio 2 registra a trincheira');
assert.ok(sb.fieldTrenches.includes(s0.anchor) && s0.anchor.line === 'sap' && s0.anchor.slots === 1);
assert.ok(sb.trenchGrid.get(G.gkey(s0.anchor.x, s0.anchor.y)).includes(s0.anchor), 'inserida no trenchGrid');
assert.equal(sb.protectedBy(probe), .35, 'dentro da trincheira funcional: proteção de trincheira do motor');
run(18);
assert.equal(s0.stage, 3);
const bag = sb.buildings.find(b => b.type === 'sandbag' && b.team === 0);
assert.ok(bag && bag.x > s0.x, 'parapeito de sacos no lado do inimigo (leste)');

// 4. artilharia na obra atrasa o estágio atual, mas não desfaz o que já foi cavado
const s1 = p.segs[p.cur];
const w0 = s1.work;
sb.explode(s1.x, s1.y, 75, 180, 1);
assert.ok(s1.work <= w0);
assert.ok(s1.work >= (s1.stage ? s1.need[s1.stage - 1] : 0));

// 5. alvejado: interrompe a obra e deita (mais protegido)
const digger = sb.units.find(u => u.id === p.crew[0]);
digger.suppression = 1.5;
const w1 = s1.work; run(.2);
assert.equal(digger.sapState, 'prone');
assert.ok(sb.protectedBy(digger) < sb.protectedBy({ type: 'rifle', x: -500, y: -500 }), 'deitado recebe menos dano');
digger.suppression = 0;
assert.ok(s1.work - w1 < .2 * S.cfg.WORKX * 1.01, 'quem está deitado não cava (os outros dois rendem no máximo 1 equipe)');

// 6. ordem manual do jogador libera o sapador por 25 s
digger.manualUntil = sb.time + 25; run(.6);
assert.ok(!p.crew.includes(digger.id)); assert.equal(digger.sapJob, null);
run(90);
assert.ok(p.done, 'obra concluída'); assert.ok(sb.toasts.some(t => /Trincheira de ligação concluída/.test(t)));
assert.ok(sb.units.filter(u => u.team === 0 && u.sap).every(u => !u.sapJob), 'engenheiros de campo liberados');

// 7. IA: sapa em zigue-zague a partir da trincheira da frente
sb.aiEnabled[1] = true; sb.time = Math.max(sb.time, 45);
S.aiTick(1);
const sap = S.projects.find(q => q.team === 1 && q.kind === 'sap' && !q.done);
assert.ok(sap && sap.extend && sap.target === 2, 'sapa planejada (estágio-alvo: trincheira funcional)');
assert.ok(sap.segs.every((g, i, a) => i === 0 || g.x <= a[i - 1].x + 1e-9), 'lado 1 avança para oeste');
const nSeg = sap.segs.length;
run(260);
assert.ok(sap.legs > 2 && sap.segs.length > nSeg, 'a sapa se estende perna a perna');

// 8. reparo de brecha: arame destruído é reinstalado pelos engenheiros de campo
sb.aiEnabled[1] = false;
for (const q of S.projects) if (!q.done && q.team === 1) S.cancel(q);
const wire = sb.newBuilding('wire', 1, 1640, 700);
run(1); sb.buildings.splice(sb.buildings.indexOf(wire), 1); run(1);
assert.ok(S.breaches.some(r => r.type === 'wire' && r.team === 1), 'brecha registrada');
run(9); sb.aiEnabled[1] = true; S.aiTick(1);
const rep = S.projects.find(q => q.kind === 'repair' && !q.done);
assert.ok(rep, 'IA manda reparar a brecha');
run(40);
assert.ok(rep.done && sb.buildings.some(b => b.type === 'wire' && b.team === 1 && Math.abs(b.x - 1640) < 1), 'arame reinstalado');

// 9. posto de morteiro guarnecido dispara contra inimigos a 160–620 px
sb.aiEnabled[1] = false;
const m = S.order('mortar', [[600, 900]]);
assert.ok(m);
run(80);
assert.equal(S.posts.length, 1, 'posto de morteiro construído');
const enemy = sb.newUnit('rifle', 1, 1000, 900);
const post = S.posts[0]; sb.newUnit('rifle', 0, post.x + 5, post.y);
const n0 = sb.shells.length; run(8);
assert.ok(sb.shells.length > n0 && sb.shells.some(s => s.team === 0 && Math.abs(s.x - enemy.x) < 40), 'morteiro dispara no inimigo');

assert.equal(S.stats.errors, 0);
console.log('Sapadores 1.2: geometria, 3 estágios, trincheira no grid, parapeito, artilharia na obra, supressão, ordem manual, sapa em zigue-zague, reparo e morteiro OK');
