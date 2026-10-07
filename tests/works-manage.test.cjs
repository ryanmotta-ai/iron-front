const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// works-manage.js (1.9): melhoria, reparo, demolição, cancelamento, prioridade, fantasma e IA de gestão das obras. Carrega sappers.js + fortify.js +
// works.js + works-manage.js num mini-motor com o mesmo dano de explosão do game.js (b.hp -= power*2 nos prédios; damage() nas unidades) e MEDE:
// dano suportado antes×depois, custo, tempo (nesta VM BUILDX=1: no navegador o ui-fix.js multiplica por 1,7 na campanha e 7 no sandbox), reembolso, ms/update.
let seed = 11; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
let serial = 0;
const HP = { sandbag: 350, wire: 180, bunker: 1000, trench: 650 };
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity, URLSearchParams, Date, performance, setTimeout: f => f(), setInterval() {},
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, sandbox: false, playerTeam: 0, mode: 'commander', player: null, map: 'forest', tab: 'units', placement: null,
  soundOn: false, audio: null, keys: {}, screenShake: 0, maxUnits: 160, canvas: { style: {} }, cam: { x: 800, y: 800, z: .66 }, mouse: { x: 0, y: 0, wx: 0, wy: 0, over: true },
  units: [], buildings: [], shells: [], particles: [], bullets: [], planes: [], fieldTrenches: [], trenchGrid: new Map(), allCraters: [], points: [{ x: 1200, y: 800, progress: 0, owner: -1 }],
  supplies: [1500, 1500], aiEnabled: [false, false], aiDecisionTimer: [5, 5], supportCooldown: [0, 0], selected: new Set(), toasts: [], location: { search: '?preparo=0' },
  defs: { rifle: { rate: 1.5, hp: 100, cost: 80 }, mg: { rate: .22 }, sandbag: { cost: 50, hp: 350 }, wire: { cost: 40, hp: 180 }, bunker: { cost: 220, hp: 1000 }, trench: { cost: 90, hp: 650 }, artillery: { cost: 160 } },
  document: { querySelector: () => null, getElementById: () => null, createElement: () => ({ getContext: () => ({ fillRect() {}, clearRect() {} }), style: {}, append() {} }), body: null },
  PX: { Z: .5, WW1: { CLEAN: { forts: true }, PW: 1200, reinforceX: t => t ? 2184 : 216, layout: () => ({ gunsPlan: [] }) } },
  PXBAT: { addGun() { return null; }, removeGun() { return true; }, mission() { return true; } },
  rebuilds: 0, PHYS: { on: false, draw: () => false, rebuild() { sb.rebuilds++; } },
  toast(s) { sb.toasts.push(s); }, sound() {}, hud() {}, render() {}, makeCards() {}, icon() {}, choose() {}, place() {}, setup() {}, worldMouse() {}, grenade() {}, aiGrenade() {}, spend() { return true; },
  callFighter() {}, callBomber() {}, runCommander() {}, shoot() {}, observationRange: () => 760, incomeFor: () => 8,
  update(dt) {
    sb.time += dt; sb.units = sb.units.filter(u => u.hp > 0); sb.buildings = sb.buildings.filter(b => b.hp > 0);
    for (const u of sb.units) { if (u.order !== 'move') continue; const dx = u.tx - u.x, dy = u.ty - u.y, l = Math.hypot(dx, dy); if (l > 12) { const s = Math.min(l, 60 * dt); u.x += dx / l * s; u.y += dy / l * s; } else u.order = 'hold'; }
  },
  // mesmas fórmulas do game.js: explosão fere unidades por distância e prédios com power*2 em todo o raio; protectedBy = trincheira .35
  explode(x, y, r, power = 100, team = 0) { for (const u of sb.units) { const d = Math.hypot(u.x - x, u.y - y); if (d < r) sb.damage(u, power * (1 - d / r) * (u.type === 'tank' ? .6 : 1), team); } for (const b of sb.buildings) if (Math.hypot(b.x - x, b.y - y) < r) b.hp -= power * 2; },
  damage(u, n) { if (u.hp <= 0) return; u.hp -= n; sb.dmgSeen = n; },
  protectedBy(u) { let f = 1; for (const t of sb.fieldTrenches) if (Math.abs(t.x - u.x) < (t.hw || 52) && Math.abs(t.y - u.y) < (t.hh || 22)) f = .35; return f; },
  newUnit(type, team, x, y) { const u = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, manualUntil: 0, suppression: 0, angle: 0, cd: 0 }; sb.units.push(u); return u; },
  squad(type, team, x, y, n = 3) { for (let i = 0; i < n; i++) sb.newUnit(type, team, x + i * 6, y); },
  newBuilding(type, team, x, y) { const b = { id: ++serial, type, team, x, y, hp: HP[type] || 100, maxhp: HP[type] || 100 }; sb.buildings.push(b); return b; },
  finish() {},
};
sb.window = sb; sb.addEventListener = () => {};
vm.createContext(sb);
sb.IronFrontEngineering = { reset() {}, choose: c => c.projects.length, state: () => null }; // o gerente filtra seus serviços do choose() da engenharia
for (const f of ['sappers.js', 'fortify.js', 'works.js', 'works-manage.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
const SAP = sb.PXSAP, F = sb.PXFORT, M = sb.PXMANAGE, K = SAP.cfg.KIND;
const run = (sec, dt = 1 / 30) => { for (let t = 0; t < sec - 1e-9; t += dt) sb.update(dt); };
const runUntil = (fn, cap = 400) => { const t0 = sb.time; while (!fn() && sb.time - t0 < cap) sb.update(1 / 30); return +(sb.time - t0).toFixed(1); };
const pioneers = (x = 840, y = 800, n = 3, team = 0) => { const us = []; for (let i = 0; i < n; i++) { const u = sb.newUnit('rifle', team, x + i * 8, y); u.sap = 1; u.hp = u.maxhp = 1e6; us.push(u); } return us; };
const near = (x, y) => sb.units.filter(u => u.sap && u.team === 0).forEach((u, i) => { u.x = x - 25 + i * 8; u.y = y + 18; u.order = 'hold'; u.sapJob = null; u.sapFree = 0; });
const find = (x, y, kind) => M.works().find(r => (!kind || r.kind === kind) && Math.abs(r.x - x) < 24 && Math.abs(r.y - y) < 24);
const build = (kind, pts, team = 0) => { const p = SAP.project(team, kind, 'player', pts, { keep: true }); const t = runUntil(() => p.done, 600); assert.ok(p.done, 'obra ' + kind + ' terminou'); M.scan(); return { p, t }; };
sb.setup();
const crew = pioneers(840, 800, 3);
const out = {};

// ---------- 0. catálogo e integração ----------
assert.equal(sb.IronFrontEngineering.choose({ projects: [{ id: 1 }, { id: 2, mgr: {} }, { id: 3, mgr: {} }] }), 1, 'serviços de gestão não ocupam vagas da engenharia (choose recebe só as obras normais)');
assert.ok(K.mgupl && K.mgup && K.mgfix, 'kinds de serviço registrados');
assert.ok(!F.KINDS.includes('mgup') && !F.KINDS.includes('mgupl') && !F.KINDS.includes('mgfix'), 'serviços não viram cartão de construção');

// ---------- 1. três trincheiras (nível 0, 1, 2) ----------
const lines = [[[900, 400], [900, 460]], [[1000, 400], [1000, 460]], [[1100, 400], [1100, 460]]];
let t0 = build('trench', lines[0]).t; build('trench', lines[1]); build('trench', lines[2]);
out.buildTrench = t0;
let a = find(900, 415, 'trench'), b = find(1000, 415, 'trench'), c = find(1100, 415, 'trench');
assert.ok(a && b && c && a.max === 300 && a.lvl === 0, 'trecho de trincheira com integridade 300');
const nSegs = SAP.segs.filter(s => s.p.kind === 'trench').length;
assert.ok(nSegs >= 6, 'trincheiras de 2+ trechos');

// melhoria: nível 1 em B (linha toda), nível 2 em C (duas vezes). custo, tempo e a obra continua útil durante o serviço
const s0 = sb.supplies[0];
assert.equal(M.nextUpg(b).name, 'Trincheira revestida');
near(b.x, b.y); assert.ok(M.startUpg(b, 'run'), 'ordem de melhoria da linha aceita');
const cost1 = s0 - sb.supplies[0], upSegs = M.runsOf(b).reduce((n, r) => n + r.length, 0);
const job1 = SAP.projects.find(p => p.mgr && !p.done);
assert.ok(job1 && job1.kind === 'mgupl', 'melhoria é um projeto de engenheiros de campo em linha');
assert.ok(fieldTrenches().some(t => Math.abs(t.x - b.x) < 5 && Math.abs(t.y - b.y) < 5), 'âncora de cobertura continua ativa durante a melhoria');
const tUp1 = runUntil(() => job1.done, 300);
function fieldTrenches() { return sb.fieldTrenches; }
M.scan();
b = find(1000, 415, 'trench'); assert.equal(b.lvl, 1); assert.equal(b.max, 700);
out.lining = { cost: cost1, trechos: SAP.segs.filter(s => s._mg && s._mg.lvl === 1).length, seconds: tUp1 };
assert.ok(!SAP.segs.some(s => s.p.mgr), 'trechos do serviço saem de PXSAP.segs (sem cobertura fantasma)');
assert.ok(!SAP.projects.some(p => p.mgr), 'serviço concluído sai de PXSAP.projects');
// C: duas melhorias
M.startUpg(c, 'run'); runUntil(() => !SAP.projects.some(p => p.mgr), 300); M.scan(); c = find(1100, 415, 'trench');
assert.equal(c.lvl, 1); const sC = sb.supplies[0]; near(c.x, c.y); M.startUpg(c, 'run'); const cost2 = sC - sb.supplies[0]; const tUp2 = runUntil(() => !SAP.projects.some(p => p.mgr), 300); M.scan(); c = find(1100, 415, 'trench');
assert.equal(c.lvl, 2); assert.equal(c.max, 1600); assert.equal(M.nextUpg(c), null, 'nível máximo');
out.concrete = { cost: cost2, seconds: tUp2 };

// dano de explosão suportado: obus 75 mm (r70, power150) a 15 px do eixo do trecho central — quantos até desmoronar
function shellsToCollapse(r) { r.hp = r.max; let n = 0; const s = r.seg; while (!r.col && n < 60) { sb.explode(s.x + 15, s.y, 70, 150, 1); n++; } return n; }
const A1 = find(900, 415, 'trench'), B1 = find(1000, 415, 'trench'), C1 = find(1100, 415, 'trench');
const nA = shellsToCollapse(A1), nB = shellsToCollapse(B1), nC = shellsToCollapse(C1);
out.shells = { nivel0: nA, revestida: nB, concreto: nC };
assert.ok(nA === 2 && nB === 4 && nC >= 8, `obuses até desmoronar ${nA}/${nB}/${nC}`);
assert.ok(A1.col && B1.col && C1.col, 'os três desmoronaram');
assert.ok(!sb.fieldTrenches.includes(A1.seg.anchor) && A1.seg.anchor === null, 'trecho desmoronado perde a âncora de cobertura');
assert.equal(A1.seg.stage, 1, 'vira vala rasa'); assert.equal(S1(), true);
function S1() { return M.state().stats.collapses >= 3; }
// reparo do desmoronado: custo proporcional (50% × investido × 100% de dano) e a âncora volta
near(A1.x, A1.y); const sFix = sb.supplies[0], rA = find(900, 415, 'trench') || A1;
assert.equal(M.fixCost(A1), Math.round(A1.inv * .5), 'reparo de desabamento = 50% do investido');
assert.ok(M.startFix(A1), 'reparo ordenado'); const costFix = sFix - sb.supplies[0];
const tFix = runUntil(() => !SAP.projects.some(p => p.mgr), 200); M.scan();
assert.ok(!A1.col && A1.hp === A1.max && A1.seg.anchor && sb.fieldTrenches.includes(A1.seg.anchor), 'trecho reerguido com âncora');
out.fixCollapsed = { cost: costFix, seconds: tFix };
// B/C voltam para provar que a âncora reaparece com o parapeito do nível
M.startFix(B1); M.startFix(C1); runUntil(() => !SAP.projects.some(p => p.mgr), 300); M.scan();
assert.ok(B1.seg.anchor.pk === .94 && C1.seg.anchor.pk === .97, 'parapeito do nível volta (revestida .94, concreto .97)');

// protecção contra tiro e explosão para um fuzileiro dentro de cada trecho
const probe = (r) => { const u = sb.newUnit('rifle', 0, r.seg.x, r.seg.y); u.hp = u.maxhp = 1000; const f = sb.protectedBy(u); sb.explode(r.seg.x + 25, r.seg.y, 70, 150, 1); const lost = 1000 - u.hp; u.hp = 0; return { tiro: +f.toFixed(2), explosao: +lost.toFixed(1) }; };
M.scan();
const pa = probe(find(900, 415, 'trench')), pb = probe(find(1000, 415, 'trench')), pc = probe(find(1100, 415, 'trench'));
out.cover = { nivel0: pa, revestida: pb, concreto: pc };
assert.equal(pa.tiro, .35); assert.equal(pb.tiro, .24); assert.equal(pc.tiro, .15);
assert.ok(pb.explosao / pa.explosao > .6 && pb.explosao / pa.explosao < .7 && pc.explosao / pa.explosao > .38 && pc.explosao / pa.explosao < .42, 'dano de explosão ×.65 / ×.40');

// granada (gblast do game.js: r 48/65, power 120/180) NÃO abala a vala; obus e morteiro sim
{ M.scan(); const r = M.works().find(r => r.kind === 'trench' && !r.col && r.team === 0); r.hp = r.max; sb.gblast = true; for (let i = 0; i < 20; i++) sb.explode(r.seg.x + 5, r.seg.y, 48, 120, 1); sb.gblast = false;
  assert.equal(r.hp, r.max, '20 granadas não tiram integridade'); sb.explode(r.seg.x + 5, r.seg.y, 44, 95, 1); assert.ok(r.hp < r.max, 'morteiro (r44, p95) tira'); out.mortar = { dano: Math.round(r.max - r.hp) }; r.hp = r.max; }

// ---------- 2. bunker de madeira → casamata (mesmo prédio, só a diferença) ----------
const bk = sb.newBuilding('bunker', 0, 600, 1000); bk.kind = 'wood'; const garr = sb.newUnit('rifle', 0, 600, 1000); garr.bunkerOf = bk;
M.scan(); let rb = M.works().find(r => r.b === bk); assert.ok(rb && rb.kind === 'bunker' && rb.lvl === 0);
const up = M.nextUpg(rb); assert.equal(up.cost, K.pillbox.cost - K.bunker.cost, 'só a diferença (casamata − bunker)');
near(rb.x, rb.y); const sB = sb.supplies[0]; M.startUpg(rb, 'one'); const costB = sB - sb.supplies[0]; assert.equal(costB, 140);
bk.hp = 700; /* a obra continua útil e pode ser danificada durante o serviço */ const idB = bk.id; const tB = runUntil(() => !SAP.projects.some(p => p.mgr), 300); M.scan();
assert.ok(bk.kind === 'concrete' && bk.maxhp === 2400 && bk.id === idB && garr.bunkerOf === bk && Math.abs(bk.hp - 1680) < 1, 'mesmo prédio, guarnição preservada, vida proporcional (700/1000 → 1680/2400)');
const shellsB = (b, maxhp) => { b.hp = maxhp; let n = 0; while (b.hp > 0 && n < 99) { sb.explode(b.x, b.y, 70, 100, 1); n++; } return n; };
const bkWood = sb.newBuilding('bunker', 0, 700, 1100); bkWood.kind = 'wood';
out.bunker = { custo: costB, segundos: tB, obusesMadeira: shellsB(bkWood, 1000), obusesConcreto: shellsB(Object.assign(sb.newBuilding('bunker', 0, 700, 1200), { kind: 'concrete', maxhp: 2400 }), 2400) };
assert.ok(out.bunker.obusesMadeira === 5 && out.bunker.obusesConcreto === 12, 'power*2 por obus: 5 contra 12');
sb.buildings = sb.buildings.filter(x => x.hp > 0);

// ---------- 3. ninho blindado, saco duplo, abrigo reforçado ----------
build('nest', [[1300, 900]]); build('sandbag', [[1500, 900]]); build('dugout', [[1700, 900]]);
M.scan();
const nest = find(1300, 900, 'nest'), dug = find(1700, 900, 'dugout'), sbag = M.works().find(r => r.kind === 'sandbag' && Math.abs(r.x - 1500) < 24);
assert.ok(nest && dug && sbag, 'ninho, abrigo e saco de areia registrados');
assert.equal(nest.max, 600);
near(nest.x, nest.y); const sN = sb.supplies[0]; M.startUpg(nest, 'one'); const costN = sN - sb.supplies[0]; const tN = runUntil(() => !SAP.projects.some(p => p.mgr), 300); M.scan();
assert.ok(nest.lvl === 1 && nest.max === 1500 && nest.seg.anchor.pk === .97);
near(sbag.x, sbag.y); const sS = sb.supplies[0]; const hpS0 = sbag.b.hp; M.startUpg(sbag, 'one'); const costS = sS - sb.supplies[0]; const tS = runUntil(() => !SAP.projects.some(p => p.mgr), 300); M.scan();
assert.ok(sbag.b.dbl && sbag.b.maxhp === 700 && sbag.b.hp === hpS0 * 2);
near(dug.x, dug.y); const sD = sb.supplies[0]; M.startUpg(dug, 'one'); const costD = sD - sb.supplies[0]; const tD = runUntil(() => !SAP.projects.some(p => p.mgr), 300); M.scan();
assert.equal(dug.lvl, 1);
const un = sb.newUnit('rifle', 0, nest.seg.x, nest.seg.y); const unD = sb.newUnit('rifle', 0, dug.seg.x, dug.seg.y);
const dugF = sb.protectedBy(unD), nestF = sb.protectedBy(un);
assert.ok(dugF === .06 && nestF === .16, 'abrigo reforçado .06 (era .15 do fortify), ninho blindado .16 (era .35)');
// soterramento: 400 explosões no abrigo, cada uma tenta matar o ocupante com damage(9999) como o shelter.js; sem reforço morreria sempre
let saved = 0, N = 400; for (let i = 0; i < N; i++) { unD.hp = 100; sb.explode(dug.seg.x, dug.seg.y, 90, 100, 1); unD.hp = 100; sb.damage(unD, 9999, 1); if (unD.hp > 0) saved++; }
out.upgrades = { ninho: { custo: costN, s: tN, integridade: '600→1500', tiro: '.35→.16' }, sacoDuplo: { custo: costS, s: tS, vida: '350→700' }, abrigo: { custo: costD, s: tD, tiro: '.15→.06', soterramentoEvitado: +(saved / N).toFixed(2) } };
assert.ok(saved / N > .65 && saved / N < .85, 'soterramento evitado em ~75%: ' + saved / N);

// ---------- 4. demolição e reembolso ----------
M.scan();
let target = M.works().find(r => r.b === bk), refundBefore = sb.supplies[0];
assert.ok(M.demolish(target) && target.dm, 'desmonte iniciado');
const tDemo = runUntil(() => !sb.buildings.includes(bk), 20); const gained = sb.supplies[0] - refundBefore;
assert.equal(gained, Math.round(.4 * target.inv), 'devolve 40% do investido (200+140)');
assert.ok(tDemo >= 2.3 && tDemo <= 2.7, 'animação de desmonte 2,4 s: ' + tDemo);
out.demolish = { casamata: { investido: target.inv, reembolso: gained, seconds: tDemo } };
assert.ok(sb.particles.length > 0, 'poeira e tábuas no desmonte');
// trecho de trincheira demolido: âncora, seg e sacos somem; não há "brecha" para a IA reconstruir
const sgT = find(1100, 415, 'trench'), ancs = sb.fieldTrenches.length, segsN = SAP.segs.length; M.demolish(sgT); runUntil(() => sgT.seg.gone, 10); M.scan();
assert.ok(sb.fieldTrenches.length === ancs - 1 && sgT.seg.anchor === null, 'âncora removida'); assert.equal(SAP.segs.length, segsN - 1);
assert.ok(!sgT.seg.p.segs.includes(sgT.seg), 'o trecho sai do projeto (a engenharia não o conta como ativo)');
const wireB = sb.newBuilding('wire', 0, 1300, 1300); sb.update(.5); sb.update(.5); M.scan(); const wr = M.works().find(r => r.b === wireB); M.demolish(wr); run(4);
assert.ok(!SAP.breaches.some(x => Math.abs(x.x - 1300) < 5) && !SAP.projects.some(p => p.kind === 'repair'), 'arame demolido não vira brecha a reparar');
// sandbox: sem retorno
sb.sandbox = true; const bk2 = sb.newBuilding('bunker', 0, 650, 1300); bk2.kind = 'wood'; M.scan(); const sSb = sb.supplies[0]; M.demolish(M.works().find(r => r.b === bk2)); run(3); assert.equal(sb.supplies[0], sSb, 'sandbox: sem retorno'); sb.sandbox = false;

// ---------- 5. reparo proporcional ao dano (bunker 50%) ----------
const bk3 = sb.newBuilding('bunker', 0, 650, 1400); bk3.kind = 'wood'; bk3.hp = 500; M.scan(); const r3 = M.works().find(r => r.b === bk3);
const cost50 = M.fixCost(r3), need50 = M.fixNeed(r3), sF = sb.supplies[0]; assert.equal(cost50, Math.round(200 * .5 * .5)); near(r3.x, r3.y); M.startFix(r3); const tF = runUntil(() => !SAP.projects.some(p => p.mgr), 200);
assert.equal(bk3.hp, 1000); assert.equal(sF - sb.supplies[0], cost50);
bk3.hp = 900; M.scan(); const cost10 = M.fixCost(M.works().find(r => r.b === bk3)); assert.ok(cost10 < cost50 / 4, 'custo proporcional: 10% de dano custa ' + cost10 + ' contra ' + cost50);
out.fix = { bunker50: { custo: cost50, need: need50, s: tF }, bunker10: { custo: cost10 } };

// ---------- 6. cancelar projeto devolve o não gasto ----------
near(1500, 300); const pCan = SAP.project(0, 'trench', 'player', [[1500, 300], [1500, 420]], { keep: true }); sb.supplies[0] -= pCan.segs.length * 10; const sCx = sb.supplies[0];
run(20); const frac = M.progress(pCan), paid = M.paid(pCan); const got = M.cancel(pCan); const refunded = sb.supplies[0] - sCx;
assert.equal(refunded, Math.round(paid * (1 - frac))); assert.ok(refunded > 0 && refunded < paid && got === refunded, JSON.stringify({ refunded, paid, frac, got, crew: pCan.crew.length }));
out.cancel = { pago: paid, progresso: +(frac * 100).toFixed(0) + '%', devolvido: refunded };

// ---------- 7. prioridade: 2 projetos, 3 engenheiros de campo ----------
for (const u of sb.units.filter(u => u.sap)) { u.sapJob = null; }
near(400, 200); const pA = SAP.project(0, 'trench', 'player', [[400, 200], [400, 290]], { keep: true }), pB = SAP.project(0, 'trench', 'player', [[400, 1300], [400, 1390]], { keep: true });
run(8); const crewA = pA.crew.length, crewB0 = pB.crew.length;
assert.ok(crewA >= 2 && crewB0 === 0 || crewA >= 1, 'sem prioridade a primeira recebe a equipe (A=' + crewA + ' B=' + crewB0 + ')');
assert.equal(M.prioritize(pB), true); run(3);
assert.equal(pB.prio, 1); assert.ok(pB.crew.length === 3 && pA.crew.length === 0, 'a equipe inteira é puxada para B: B=' + pB.crew.length + ' A=' + pA.crew.length);
out.priority = { semPrioridade: { A: crewA, B: crewB0 }, comPrioridade: { A: pA.crew.length, B: pB.crew.length } };
assert.equal(M.prioritize(pB), 'off'); M.cancel(pA, true); M.cancel(pB, true);

// ---------- 8. fantasma / motivo de bloqueio ----------
sb.sandbox = false; sb.supplies[0] = 1500; sb.units = sb.units.filter(u => u.sap || u.team === 0);
const fence = x => M.reason('bunker', [[x, 800]]);
assert.ok(fence(500).ok, 'território próprio: ok');
assert.match(fence(2250).block, /Território inimigo/, 'território inimigo');
assert.match(M.reason('bunker', [[-100, 800]]).block, /Fora da área/);
sb.supplies[0] = 50; assert.match(fence(500).block, /Sem caixa: faltam ◈ 150/); sb.supplies[0] = 1500;
const e1 = sb.newUnit('rifle', 1, 560, 800), e2 = sb.newUnit('rifle', 1, 570, 805); assert.match(fence(500).block, /Sob fogo/); e1.hp = 0; e2.hp = 0; sb.units = sb.units.filter(u => u.hp > 0);
sb.shells.push({ x: 500, y: 800, t: 1.5, r: 70, team: 1, power: 150 }); assert.match(fence(500).block, /bombardeio/); assert.equal(SAP.canBuild(0, 500, 800), false, 'a ordem é recusada pelo mesmo motivo'); assert.match(SAP.buildMsg, /bombardeio/); sb.shells.length = 0;
const noP = sb.units.filter(u => u.sap); for (const u of noP) u.sap = 0; assert.match(fence(500).block, /Sem engenheiros de campo/); for (const u of noP) u.sap = 1;
assert.equal(M.reason('trench', [[500, 800], [500, 890]]).cost, 30, 'linha: 3 trechos × 10');
sb.sandbox = true; assert.equal(M.reason('bunker', [[500, 800]]).cost, 0); sb.sandbox = false;

// ---------- 9. IA: repara e melhora dentro da reserva de obras ----------
sb.aiEnabled = [false, true]; SAP.hold = true; F.on = false; for (const p of SAP.projects.slice()) if (p.team === 1 && !p.mgr) SAP.cancel(p); /* a IA de sapas e o plano do fortify.js não disputam os engenheiros de campo neste teste */ sb.time = 400; pioneers(1900, 800, 3, 1);
const bkAi = sb.newBuilding('bunker', 1, 1800, 400); bkAi.kind = 'wood'; bkAi.hp = 300; const occ = sb.newUnit('rifle', 1, 1800, 400); sb.units.push(...[1, 2, 3].map(i => sb.newUnit('rifle', 0, 1400, 400 + i * 30)));
M.scan(); sb.supplies[1] = 150; M.ai(1); assert.equal(SAP.projects.filter(p => p.mgr && !p.done).length, 0, 'sem caixa acima da reserva (200): não gasta');
sb.supplies[1] = 600; const s1 = sb.supplies[1]; M.ai(1); const jobAi = SAP.projects.find(p => p.mgr && !p.done && p.team === 1);
assert.ok(jobAi && jobAi.mgr.type === 'fix' && jobAi.mgr.ai, 'IA repara o bunker a 30%'); const aiFixCost = s1 - sb.supplies[1]; assert.equal(aiFixCost, Math.round(200 * .5 * .7));
runUntil(() => jobAi.done, 200); assert.equal(bkAi.hp, 1000);
// inimigos a 800 px: com 3+ por perto e guarnição, melhora para casamata, mas só com caixa ≥ custo + reserva + folga
for (let i = 0; i < 3; i++) sb.newUnit('rifle', 0, 1500 + i * 10, 420);
M.scan(); sb.supplies[1] = 140 + 200 + M.cfg.AI.spare - 1; M.ai(1); assert.equal(SAP.projects.filter(p => p.mgr && !p.done).length, 0, 'abaixo de custo+reserva+folga: não melhora');
sb.supplies[1] = 140 + 200 + M.cfg.AI.spare + 10; const s2 = sb.supplies[1]; M.ai(1); const jobUp = SAP.projects.find(p => p.mgr && !p.done && p.team === 1);
assert.ok(jobUp && jobUp.mgr.type === 'upg', 'IA melhora o bunker'); assert.equal(s2 - sb.supplies[1], 140); runUntil(() => jobUp.done, 300); M.scan();
assert.equal(bkAi.kind, 'concrete'); M.ai(1); assert.equal(SAP.projects.filter(p => p.mgr && !p.done).length, 0, 'cooldown de 30 s entre melhorias');
// orçamento: 20 min de IA com caixa baixa (e danos contínuos) nunca fica abaixo da reserva nem estoura
let minCash = Infinity; const tt0 = sb.time; seed = 5; const ai0 = { ...M.state().stats, aiSpent: [...M.state().stats.aiSpent] };
// 10 min com caixa justa (330: só cabe reparo) e 10 min com 700 (cabe melhoria); a cada 15 s o bunker leva 400 de dano; a renda repõe o caixa ao nível-alvo
for (const level of [330, 700]) for (let i = 0; i < 200; i++) { for (let f = 0; f < 90; f++) { sb.update(1 / 30); minCash = Math.min(minCash, sb.supplies[1]); } if (i % 5 === 0) bkAi.hp = Math.max(1, bkAi.hp - 400); if (!bkAi.kind) bkAi.kind = 'wood'; sb.supplies[1] = Math.max(sb.supplies[1], level); }
const ai1 = M.state().stats; out.ai = { simulado: Math.round(sb.time - tt0) + ' s', gasto: ai1.aiSpent[1] - ai0.aiSpent[1], melhorias: ai1.aiUpgrades - ai0.aiUpgrades, reparos: ai1.aiRepairs - ai0.aiRepairs, caixaMinimaDuranteTudo: Math.round(minCash) };
assert.ok(minCash >= 0, 'nunca negativo'); assert.ok(minCash >= 200, 'a reserva (200) foi respeitada: o caixa nunca caiu de ' + minCash);

// ---------- 10. custo de CPU ----------
sb.aiEnabled = [false, false]; sb.units = []; sb.buildings = []; sb.fieldTrenches.length = 0; sb.trenchGrid.clear(); SAP.segs.length = 0; SAP.projects.length = 0;
pioneers(500, 800, 6, 0);
for (let i = 0; i < 160; i++) sb.newUnit('rifle', i % 2, 400 + (i % 40) * 40, 200 + Math.floor(i / 40) * 300);
for (let i = 0; i < 24; i++) SAP.project(0, 'trench', 'player', [[700 + i * 14, 100 + (i % 2) * 20], [700 + i * 14, 340 + (i % 2) * 20]], { keep: true });
run(5); for (const sg of SAP.segs.slice()) while (sg.stage < sg.p.target) SAP._stage(sg); M.scan(); const ws = M.works().length;
const bench = (on, frames = 600) => { M.on = on; const t = process.hrtime.bigint(); for (let i = 0; i < frames; i++) sb.update(1 / 30); return Number(process.hrtime.bigint() - t) / 1e6 / frames; };
bench(true, 120); const msOn = bench(true), msOff = bench(false); M.on = true;
const ts = process.hrtime.bigint(); for (let i = 0; i < 200; i++) M.scan(); const msScan = Number(process.hrtime.bigint() - ts) / 1e6 / 200;
const tx = process.hrtime.bigint(); for (let i = 0; i < 200; i++) sb.explode(700 + (i % 20) * 14, 200, 70, 150, 1); const msBoom = Number(process.hrtime.bigint() - tx) / 1e6 / 200;
out.cpu = { obrasRegistradas: ws, segsEmCampo: SAP.segs.length, unidades: sb.units.length, msPorUpdateComGestao: +msOn.toFixed(3), msPorUpdateSem: +msOff.toFixed(3), sobrecustoMs: +(msOn - msOff).toFixed(3), msScan: +msScan.toFixed(3), msExplosaoComIntegridade: +msBoom.toFixed(3) };
assert.ok(msOn - msOff < 0.5, 'a camada custa < 0,5 ms por update: ' + (msOn - msOff));

// ---------- 11. ?gestao=0 e erros ----------
assert.equal(M.state().stats.errors, 0, 'sem erros'); assert.equal(SAP.stats.errors, 0);
// chave ?gestao=0 / PXMANAGE.on=false: nada de integridade, zonas ou bloqueio de ordem
{ const t0r = sb.PXMANAGE.on; M.on = false; pioneers(900, 1450, 3, 0); const q = build('trench', [[900, 1400], [900, 1460]]); const g = find(900, 1415, 'trench'); const hp0 = g.hp; sb.explode(g.seg.x, g.seg.y, 70, 150, 1);
  assert.equal(g.hp, hp0, 'com a chave desligada a explosão não abala a vala'); sb.shells.push({ x: 500, y: 800, t: 1.5, r: 70, team: 1 }); assert.equal(SAP.canBuild(0, 500, 800), true, 'ordem não é bloqueada'); sb.shells.length = 0; M.on = t0r; }
console.log(JSON.stringify(out, null, 1));
console.log('Gestão de obras 1.9: melhorias, reparo, demolição, cancelamento, prioridade, fantasma e IA OK');
