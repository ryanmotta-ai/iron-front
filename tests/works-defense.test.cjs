const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// works-defense.js (1.9.2): campo minado escondido, valo anticarro, ouriços e desminagem, mais a IA que planeja e reage.
// O mini-motor imita game.js (movimento reto, explode radial + estilhaços simplificados) e o steerAround da física (deslizar na borda).
// Os números medidos aqui são do mini-motor (rótulo "vm"); os do navegador com a física 1.1 completa ficam no README / relatório.
let seed = 11; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
Math.random = rand;
const rnd = (a, b) => a + rand() * (b - a), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
let serial = 0;
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity, performance, setTimeout: f => f(),
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null, sandbox: true,
  units: [], buildings: [], fieldTrenches: [], particles: [], shells: [], aiEnabled: [false, false], supplies: [999, 999], supportCooldown: [0, 0], location: { search: '' },
  weapon: 'rifle', ammo: 5, magazines: { rifle: 5 }, weapons: { rifle: { mag: 5 } }, missions: [], teamKills: [0, 0], toasts: [],
  observationRange: () => 700,
  PX: { Z: 0.5 },
  toast(s) { sb.toasts.push(s); },
};
sb.window = sb; vm.createContext(sb);
const ctxStub = () => new Proxy({ canvas: {} }, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
sb.document = { createElement: () => { const c = { width: 0, height: 0 }; c.getContext = () => { const g = ctxStub(); g.canvas = c; return g; }; return c; } };
/* ----- mini-motor ----- */
const SPEED = { rifle: 47, mg: 34, tank: 28, cavalry: 85 };
function mkUnit(type, team, x, y) {
  const u = { id: ++serial, type, team, x, y, hp: type === 'tank' ? 650 : 100, maxhp: type === 'tank' ? 650 : 100, order: 'hold', tx: x, ty: y, angle: 0 };
  if (type === 'tank') u.pv = { vx: 0, vy: 0, kx: 0, ky: 0, sp: 0, w: 0, hdg: 0, cT: -9, cnx: 0, cny: 0, ds: (u.id & 1) ? 1 : -1 };
  sb.units.push(u); return u;
}
sb.damage = (u, n, att) => { if (u.hp <= 0) return; u.hp -= n; if (u.hp <= 0 && (att === 0 || att === 1) && att !== u.team) sb.teamKills[att]++; };
let FRAGS = true;
sb.explode = (x, y, r, power = 100, team = 0) => {
  sb.booms = (sb.booms || 0) + 1; sb.lastBoom = { x, y, r, power };
  for (const u of sb.units) { const d = Math.hypot(u.x - x, u.y - y); if (d < r) sb.damage(u, power * 0.9 * (1 - d / r) * (u.type === 'tank' ? 0.6 : 1), team); }
  if (FRAGS && power > 0) { /* estilhaços do physics.js: 8–12, alcance 60–100, dano 10+0,06·potência, raio de acerto 5,5 */
    const n = 8 + ((rand() * 5) | 0), dmg = clamp(10 + power * 0.06, 11, 24);
    for (let i = 0; i < n; i++) { const a = rand() * 6.283, ca = Math.cos(a), sa = Math.sin(a), range = rnd(60, 100); let hit = null, ha = range;
      for (const u of sb.units) { if (u.hp <= 0) continue; const dx = u.x - x, dy = u.y - y, al = dx * ca + dy * sa; if (al < 2 || al >= ha) continue; if (Math.abs(dx * sa - dy * ca) > (u.type === 'tank' ? 22 : 5.5)) continue; hit = u; ha = al; }
      if (hit) sb.damage(hit, hit.type === 'tank' ? dmg * .04 : dmg * (1 - .25 * ha / range), team); } }
};
sb.update = dt => {
  sb.time += dt;
  for (const u of sb.units) {
    if (u.hp <= 0) continue; const ox = u.x, oy = u.y;
    if (u.order === 'move' || u.order === 'attack') {
      let dx = u.tx - u.x, dy = u.ty - u.y;
      if (u.pv && u.pv.path && sb.time <= u.pv.pathT) { /* followPath da física: segue os pontos do caminho */
        let p = u.pv.path[u.pv.pi]; while (p && Math.hypot(p[0] - u.x, p[1] - u.y) < 14) { u.pv.pi++; p = u.pv.path[u.pv.pi]; } if (p) { dx = p[0] - u.x; dy = p[1] - u.y; } else u.pv.path = null; }
      const L = Math.hypot(dx, dy);
      if (L > 2) {
        let vx = dx / L * SPEED[u.type], vy = dy / L * SPEED[u.type];
        if (u.type === 'tank' && u.pv && sb.time - u.pv.cT < .3) { /* steerAround da física: desliza pelo lado persistente */
          const n = u.pv, dn = vx * n.cnx + vy * n.cny;
          if (dn < -1) { const tx = -n.cny, ty = n.cnx, sp = Math.hypot(vx, vy); vx = tx * n.ds * sp * .95 + n.cnx * sp * .12; vy = ty * n.ds * sp * .95 + n.cny * sp * .12; } }
        if (u.type === 'tank' && u.pv) { u.pv.sp = Math.hypot(vx, vy); u.pv.hdg = Math.atan2(vy, vx); }
        u.x += vx * dt; u.y += vy * dt; u.moving = true; }
    } else u.moving = false;
    u._moved = Math.hypot(u.x - ox, u.y - oy);
  }
  sb.units = sb.units.filter(u => u.hp > 0 || u._keep);
};
sb.setup = () => { sb.units.length = 0; sb.time = 0; };
sb.icon = () => {};
sb.WW1A = { under() {}, over() {} };
/* ----- mock do sapper/fortify ----- */
const KIND = { trench: {} };
const SAPmock = {
  cfg: { KIND, MAXSEGS: 44 }, projects: [], segs: [],
  segment(pts, step = 30) { const out = []; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1) continue; const n = Math.max(1, Math.round(L / step)), len = L / n; for (let k = 0; k < n; k++) { const f = (k + .5) / n; out.push({ x: a[0] + dx * f, y: a[1] + dy * f, ax: dx / L, ay: dy / L, len }); } } return out; },
  addAnchor() {}, lineB() {}, cancel(p) { p.done = true; },
  project(team, kind, src, pts) { const k = KIND[kind], geo = k.line ? SAPmock.segment(pts, k.step || 30) : [{ x: pts[0][0], y: pts[0][1], ax: 0, ay: 1, len: 30 }];
    const p = { id: ++serial, team, kind, src, crew: [], done: false, segs: [], item: null, t0: sb.time }; for (const g of geo) { const s = { ...g, kind, team, stage: 0, work: 0, need: k.need, p }; p.segs.push(s); SAPmock.segs.push(s); } SAPmock.projects.push(p); return p; },
};
SAPmock._ = { segment: SAPmock.segment };
sb.PXSAP = SAPmock;
sb.PXFORT = { KINDS: ['trench'], SHORT: {}, SUB: {}, planExtra: [], isPrep: () => false };
sb.PXBAT = { batteries: [], missions: [], mission(team, x, y, count, spread, kind) { sb.missions.push({ team, x, y, count, spread, kind }); return true; } };
sb.PXW = { visible: () => true };
sb.newBuilding = (type, team, x, y) => ({ type, team, x, y });
const load = f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/' + f), 'utf8'), sb);
load('works.js'); load('works-defense.js');
const D = sb.PXDEF, K = sb.PXSAP.cfg.KIND, F = sb.PXFORT;
function reset() { sb.setup(); D.stats && Object.keys(D.stats).forEach(k => D.stats[k] = 0); SAPmock.projects.length = 0; SAPmock.segs.length = 0; sb.toasts.length = 0; sb.shells.length = 0; sb.missions.length = 0; sb.time = 0; sb.supplies = [999, 999]; sb.sandbox = true; sb.aiEnabled = [false, false]; sb.supportCooldown = [0, 0]; sb.fieldTrenches.length = 0; }
const mkSeg = (kind, team, x, y, ax = 0, ay = 1, len = 30) => { const p = { id: ++serial, item: {} }; return { kind, team, x, y, ax, ay, len, stage: 0, work: 0, need: K[kind].need, p }; };
const pio = (t = 0) => { for (let i = 0; i < 3; i++) { const u = mkUnit('rifle', t, 500, 500 + i * 10); u.sap = 1; } };
const step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) sb.update(dt); };

/* ---------- 1. catálogo e plano da IA ---------- */
for (const k of ['mines', 'ditch', 'hedgehog', 'demine']) assert.ok(K[k] && F.KINDS.includes(k) && F.SHORT[k] && F.SUB[k], 'catálogo: ' + k);
assert.ok(K.mines.line && K.ditch.line && K.hedgehog.line && !K.demine.line, 'linhas e ponto');
assert.deepEqual([K.mines.cost, K.ditch.cost, K.hedgehog.cost], [18, 14, 24], 'custos do enunciado');
assert.equal(F.planExtra.length, 2, 'works.js e works-defense.js registram planos');
const items = F.planExtra[1](0, 720, 1).concat(F.planExtra[1](1, 1680, -1));
const costOf = it => SAPmock.segment(it.pts, K[it.kind].step || 30).length * K[it.kind].cost;
const planCost = items.slice(0, items.length / 2).reduce((n, it) => n + costOf(it), 0);
const byKind = {}; for (const it of items.slice(0, items.length / 2)) byKind[it.kind] = (byKind[it.kind] || 0) + costOf(it);
console.log(`  plano da trégua por lado: ◈ ${planCost} (${JSON.stringify(byKind)}) de um orçamento de 4500`);
assert.ok(planCost > 250 && planCost <= 400, 'plano barato: ≤ ◈ 400'); assert.ok(items.every(i => i.pri >= 54 && i.pri <= 57), 'prioridade depois dos morteiros');

/* ---------- 2. minas: colocar, esconder, revelar ---------- */
reset();
const ms = mkSeg('mines', 0, 800, 600); K.mines.onStage(ms, 1);
assert.equal(D.state().mines[0], 3, '3 minas por trecho'); assert.ok(ms.p.item.done);
const drawn = pt => { sb.playerTeam = pt; let n = 0; const c = ctxStub(); c.drawImage = () => n++; D.draw.mines(c, 0, 0); return n; };
sb.vw = 2000; sb.vh = 2000;
assert.equal(drawn(0), 3, 'o dono vê as 3 minas'); assert.equal(drawn(1), 0, 'o inimigo não vê nada');
const sap = mkUnit('rifle', 1, 780, 610); sap.sap = 1; D.detect();
assert.equal(drawn(1), 3, 'pioneiro inimigo a menos de 48 px revela o campo todo'); sb.playerTeam = 0;
const bp = K.mines.sprite({ ...mkSeg('mines', 1, 0, 0), stage: 0 }); assert.equal(bp.width, 1, 'canteiro do inimigo não aparece para o jogador');
const bp0 = K.mines.sprite({ ...mkSeg('mines', 0, 0, 0), stage: 0 }); assert.ok(bp0.width > 1, 'canteiro do dono aparece');
assert.ok(K.mines.sprite({ stage: 1, work: 999, need: [6], team: 0, p: null }).width > 1, 'ícone do cartão usa a arte real');
for (const k of ['ditch', 'hedgehog', 'demine']) assert.ok(K[k].sprite({ stage: K[k].target, work: 999, need: K[k].need, team: 0, ax: 1, ay: 0, len: 36, p: null }).width > 1, 'ícone ' + k);

/* ---------- 3. minas contra infantaria: baixas por mina ---------- */
function infTrial(frags) {
  reset(); FRAGS = frags; D.stats.triggered = 0;
  const s = mkSeg('mines', 0, 900, 700); K.mines.onStage(s, 1);          // 3 minas num trecho de 30 px
  const cy = 700 + rnd(-30, 30); const squad = [];
  for (let i = 0; i < 8; i++) { const u = mkUnit('rifle', 1, 800 + rnd(-35, 35), cy + rnd(-35, 35)); u.order = 'move'; u.tx = 1050; u.ty = u.y; squad.push(u); }
  step(30 * 5, 1 / 30);
  return { trig: D.stats.triggered, dead: squad.filter(u => u.hp <= 0).length, hurt: squad.filter(u => u.hp > 0 && u.hp < 100).length, minesLeft: D.state().mines[0] };
}
for (const frags of [false, true]) {
  const N = 300; let trig = 0, dead = 0, squadsHit = 0, hurt = 0;
  for (let i = 0; i < N; i++) { const r = infTrial(frags); trig += r.trig; dead += r.dead; hurt += r.hurt; if (r.trig) squadsHit++; }
  console.log(`  vm ${frags ? 'radial + estilhaços' : 'só radial'}: esquadrão de 8 cruza um trecho de 3 minas: ${(squadsHit / N * 100).toFixed(0)}% pisam, ${(trig / Math.max(1, squadsHit)).toFixed(2)} minas/esquadrão que pisa, ${(dead / Math.max(1, trig)).toFixed(2)} mortos e ${(hurt / Math.max(1, trig)).toFixed(2)} feridos por mina detonada`);
  if (frags) { assert.ok(squadsHit / N > .6, 'a maioria dos esquadrões pisa'); assert.ok(dead / trig >= 0.5 && dead / trig <= 4, 'ordem de grandeza: 1–3 mortos por mina'); }
}
FRAGS = true;
/* explosão com a ordem de grandeza do jogo: r < 40 (sem cratera), potência entre morteiro (95) e granada (120–180) */
assert.ok(sb.lastBoom.r < 40 && sb.lastBoom.power >= 95 && sb.lastBoom.power <= 180, 'r e potência compatíveis: ' + JSON.stringify(sb.lastBoom));

/* ---------- 4. tanque: esteira rompida ---------- */
function tankTrial() {
  reset(); const s = mkSeg('mines', 0, 900, 700); K.mines.onStage(s, 1);
  const t = mkUnit('tank', 1, 840, 700 + rnd(-8, 8)); t.order = 'move'; t.tx = 1200; t.ty = t.y; const hp0 = t.hp;
  let tTrig = -1, tFree = -1, hpFree = 0;
  for (let i = 0; i < 30 * 40; i++) { const px = t.x, py = t.y; step(1); if (tTrig < 0 && D.stats.tanksImmob) tTrig = sb.time; if (tTrig >= 0 && tFree < 0 && sb.time > tTrig + .3 && Math.hypot(t.x - px, t.y - py) > 0.05) { tFree = sb.time; hpFree = t.hp; } }
  return { imm: tFree > 0 ? tFree - tTrig : NaN, dmg: hp0 - hpFree, trig: tTrig > 0, mines: D.stats.tanksImmob };
}
{ const N = 60, r = []; for (let i = 0; i < N; i++) r.push(tankTrial()); const ok = r.filter(x => x.trig);
  const imm = ok.reduce((n, x) => n + x.imm, 0) / ok.length, dmg = ok.reduce((n, x) => n + x.dmg, 0) / ok.length;
  console.log(`  vm tanque: ${ok.length}/${N} pisaram na mina; imobilizado ${imm.toFixed(1)} s (${Math.min(...ok.map(x => x.imm)).toFixed(1)}–${Math.max(...ok.map(x => x.imm)).toFixed(1)}); dano ${dmg.toFixed(0)} de 650 na 1ª mina; ao sair ainda pisa em ${(ok.reduce((n, x) => n + x.mines, 0) / ok.length).toFixed(1)} das 3 do trecho`);
  assert.ok(ok.length / N > .9, 'tanque pisa'); assert.ok(imm > 9 && imm < 12.5, 'imobiliza ~10 s'); assert.ok(dmg > 30 && dmg < 140, 'dano moderado'); }

/* ---------- 5. valo anticarro ---------- */
function ditchTrial(type, team = 1) {
  reset(); for (let k = 0; k < 4; k++) { const s = mkSeg('ditch', 0, 1000, 600 + k * 36, 1, 0, 36); s.ax = 0; s.ay = 1; K.ditch.onStage(s, 1); K.ditch.onStage(s, 2); }
  const u = mkUnit(type, team, 940, 600 + 60 + rnd(-30, 30)); u.order = 'move'; u.tx = 1200; u.ty = u.y; let tin = 0, din = 0, tEnter = -1, tLeave = -1;
  for (let i = 0; i < 30 * 80; i++) { const px = u.x, py = u.y; step(1); const inside = Math.abs(u.x - 1000) <= 13; if (inside) { tin += 1 / 30; din += Math.hypot(u.x - px, u.y - py); } if (tEnter < 0 && D.stats.bogged) tEnter = sb.time; if (tEnter > 0 && tLeave < 0 && u.x > 1015) tLeave = sb.time; }
  return { v: din / tin, nominal: SPEED[type], stuck: tLeave - tEnter, beached: D.stats.beached > 0, bogged: D.stats.bogged };
}
{ const N = 200, r = []; for (let i = 0; i < N; i++) r.push(ditchTrial('tank')); const be = r.filter(x => x.beached), sl = r.filter(x => !x.beached);
  const vs = sl.reduce((n, x) => n + x.v, 0) / sl.length / 28, tS = sl.reduce((n, x) => n + x.stuck, 0) / sl.length, tB = be.reduce((n, x) => n + x.stuck, 0) / be.length;
  console.log(`  vm valo: ${r.filter(x => x.bogged).length}/${N} tanques atolam; ×${vs.toFixed(2)} da velocidade dentro do valo (${tS.toFixed(1)} s para atravessar 26 px); encalhados ${(be.length / N * 100).toFixed(0)}% (${tB.toFixed(1)} s)`);
  assert.ok(r.every(x => x.bogged >= 1), 'todo tanque inimigo que entra atola'); console.log('    (entradas por tanque:', JSON.stringify(r.reduce((m, x) => (m[x.bogged] = (m[x.bogged] || 0) + 1, m), {})), ')'); assert.ok(vs > .1 && vs < .2, '×~0,15'); assert.ok(be.length / N > .25 && be.length / N < .45, '~35% encalham'); assert.ok(tB > 6.5 && tB < 10.5, 'encalhado ~8 s'); }
{ const r = []; for (let i = 0; i < 30; i++) r.push(ditchTrial('rifle')); const v = r.reduce((n, x) => n + x.v, 0) / r.length / 47;
  console.log(`  vm valo: infantaria inimiga ×${v.toFixed(2)}`); assert.ok(v > .65 && v < .75, 'infantaria ×0,7'); }
{ const own = ditchTrial('tank', 0); assert.equal(own.bogged, 0, 'tanque do próprio dono atravessa o valo sem atolar'); assert.ok(own.v > 25, 'e na velocidade cheia'); }

/* ---------- 6. ouriços ---------- */
function hedgeTrial(n, yOff, type = 'tank') {
  reset(); const cy = 800;
  for (let k = 0; k < n; k++) { const s = mkSeg('hedgehog', 0, 1000, cy - (n - 1) * 14 + k * 28, 0, 1, 28); K.hedgehog.onStage(s, 1); K.hedgehog.onStage(s, 2); }
  const u = mkUnit(type, 1, 900, cy + yOff); u.order = 'move'; u.tx = 1150; u.ty = u.y; let tCross = -1;
  for (let i = 0; i < 30 * 120; i++) { step(1); if (tCross < 0 && u.x > 1040) { tCross = sb.time; break; } }
  return tCross;
}
{ console.log('  vm ouriços (tanque cruzando 140 px; a física real desliza pela borda — o mini-motor imita o steerAround):');
  for (const n of [0, 1, 3, 5, 8]) { const N = 40; let ok = 0, tt = 0; for (let i = 0; i < N; i++) { const t = hedgeTrial(n, rnd(-n * 5, n * 5)); if (t > 0) { ok++; tt += t; } }
    console.log(`     ${n} peça(s): ${(ok / N * 100).toFixed(0)}% passam em 120 s, ${ok ? (tt / ok).toFixed(1) : '—'} s em média (livre: ${(140 / 28).toFixed(1)} s)`);
    if (n === 0) assert.equal(ok, N); }
  /* nunca entra na caixa: distância mínima do centro do tanque até a peça durante a travessia */
  { reset(); for (let k = 0; k < 5; k++) { const s = mkSeg('hedgehog', 0, 1000, 760 + k * 28, 0, 1, 28); K.hedgehog.onStage(s, 2); }
    const t = mkUnit('tank', 1, 900, 800); t.order = 'move'; t.tx = 1150; t.ty = 800; let minD = 1e9;
    for (let i = 0; i < 30 * 40; i++) { step(1); for (const h of D.hedges) { const dx = Math.max(Math.abs(t.x - h.x) - 13, 0), dy = Math.max(Math.abs(t.y - h.y) - 13, 0); minD = Math.min(minD, Math.hypot(dx, dy)); } }
    console.log(`  vm ouriços: menor distância do centro do tanque à peça: ${minD.toFixed(1)} px (raio do tanque 24)`); assert.ok(minD > 20, 'não atravessa a peça'); assert.ok(D.stats.detours >= 1 && t.x > 1100, 'planeja o desvio pela ponta e segue (desvios: ' + D.stats.detours + ', toques: ' + D.stats.tankBlocks + ')'); }
  /* o desvio respeita os sólidos da física: com uma ruína junto da ponta norte (o caso que travou 5 de 10 tanques no navegador), vai pelo sul */
  { const wallSet = () => { reset(); for (let k = 0; k < 5; k++) { const s = mkSeg('hedgehog', 0, 1000, 744 + k * 28, 0, 1, 28); K.hedgehog.onStage(s, 2); } };
    sb.PHYS = { on: true, statics: () => [{ k: 'ruin', x: 1040, y: 692, mx0: 1021, my0: 683, mx1: 1059, my1: 701 }] };
    let south = 0, N = 12; for (let i = 0; i < N; i++) { wallSet(); const t = mkUnit('tank', 1, 1100, 770 + rnd(-8, 8)); t.order = 'move'; t.tx = 900; t.ty = t.y; step(1); if (t.pv.path && t.pv.path[0][1] > 800) south++; }
    console.log(`  vm ouriços + ruína na ponta norte: ${south}/${N} tanques planejam o desvio pelo lado livre (sul)`); assert.equal(south, N, 'não escolhe o lado com a ruína');
    sb.PHYS = { on: true, statics: () => [] };
    /* quebra-travamento: 4 s sem sair do lugar com o desvio em curso proíbe o lado e replaneja pelo outro */
    wallSet(); const t = mkUnit('tank', 1, 1100, 790); t.order = 'move'; t.tx = 900; t.ty = 790; step(1); const side0 = t.pv.path[0][1] > 790 ? 'sul' : 'norte'; const p0 = t.pv.path.map(q => q.slice());
    for (let i = 0; i < 30 * 5; i++) { const x = t.x, y = t.y; step(1); t.x = x; t.y = y; } /* tanque preso: a posição não evolui */
    const side1 = t.pv.path[0][1] > 790 ? 'sul' : 'norte'; console.log(`  vm quebra-travamento: preso 5 s ${side0} → replaneja pelo ${side1} (quebras: ${D.stats.detourBreaks})`);
    assert.ok(D.stats.detourBreaks >= 1 && side0 !== side1, 'inverte o lado do desvio quando trava');
    delete sb.PHYS; }
  let ok = 0; for (let i = 0; i < 20; i++) { reset(); for (let k = 0; k < 5; k++) { const s = mkSeg('hedgehog', 0, 1000, 760 + k * 28, 0, 1, 28); K.hedgehog.onStage(s, 2); } const f = mkUnit('rifle', 1, 940, 800 + rnd(-40, 40)); f.order = 'move'; f.tx = 1100; f.ty = f.y; step(30 * 6); if (f.x > 1040) ok++; }
  console.log(`  vm ouriços: infantaria passa ${ok}/20 por uma fila de 5 peças em 6 s`); assert.equal(ok, 20);
  reset(); const s = mkSeg('hedgehog', 0, 1000, 800, 0, 1, 28); K.hedgehog.onStage(s, 2); const pass = mkUnit('tank', 0, 940, 800); pass.order = 'move'; pass.tx = 1100; pass.ty = 800; step(30 * 8); assert.ok(pass.x > 1040, 'tanque do dono passa pelos próprios ouriços');
  /* sem barrar tiro: o jogo nem enxerga a peça (não é building nem decor) */
  assert.equal(sb.buildings.length, 0, 'ouriço não é um building (não bloqueia tiro nem dá cobertura)');
  /* vida alta: tiros de tanque (r55, potência 180) até cair */
  reset(); const hs = mkSeg('hedgehog', 0, 1000, 800, 0, 1, 28); K.hedgehog.onStage(hs, 2); let shots = 0; while (D.state().hedgehogs[0] && shots < 60) { sb.explode(1000 + rnd(-6, 6), 800 + rnd(-6, 6), 55, 180, 1); step(1); shots++; }
  console.log(`  vm ouriço: ${shots} tiros de tanque no centro para destruir (1400 de vida)`); assert.ok(shots >= 8 && shots <= 20 && hs.wreck, 'destruído por 8–20 tiros e vira ruína'); }

/* ---------- 7. obus detona minas (fila, sem recursão) ---------- */
reset(); { const s = mkSeg('mines', 0, 800, 600); K.mines.onStage(s, 1); const k0 = sb.booms || 0;
  sb.explode(800, 600, 65, 180, 1); assert.equal(D.state().pending, 3, 'as 3 minas entram na fila'); assert.equal(D.state().mines[0], 3, 'ainda não explodiram no mesmo instante');
  step(1); assert.equal(D.state().mines[0], 0, 'detonam no quadro seguinte'); assert.ok((sb.booms || 0) - k0 >= 4, 'cada uma explode de verdade'); assert.equal(D.stats.chain, 3);
  const s2 = mkSeg('mines', 0, 1200, 600); K.mines.onStage(s2, 1); sb.explode(1200, 600, 48, 0, 1); assert.equal(D.state().pending, 0, 'potência 0 (carcaça) é ignorada');
  sb.explode(1200, 600, 30, 125, 1); assert.equal(D.state().pending, 0, 'a explosão de uma mina (r<40) não encadeia'); sb.explode(1300, 600, 65, 180, 1); assert.equal(D.state().pending, 0, 'longe não detona'); }

/* ---------- 8. desminagem ---------- */
reset(); { let acc = 0, n = 0; const T = 400;
  for (let i = 0; i < T; i++) { reset(); const s = mkSeg('mines', 1, 900, 700); K.mines.onStage(s, 1); const d = mkSeg('demine', 0, 900, 700); K.demine.onStage(d, 1); acc += D.stats.accidents; n += 3; }
  console.log(`  vm desminagem: ${acc} explosões em ${n} minas (${(acc / n * 100).toFixed(1)}%)`); assert.ok(acc / n > .06 && acc / n < .14, '~10% explodem nos pioneiros');
  reset(); const s = mkSeg('mines', 1, 900, 700); K.mines.onStage(s, 1); const far = mkSeg('demine', 0, 900, 900); K.demine.onStage(far, 1); assert.equal(D.state().mines[1], 3, 'varredura longe não acha nada'); assert.ok(sb.toasts.some(t => /nenhuma mina/.test(t)));
  /* imunidade da equipe e o risco de explodir nos pioneiros */
  reset(); const s3 = mkSeg('mines', 1, 900, 700); K.mines.onStage(s3, 1); const p = mkUnit('rifle', 0, 900, 700); p.sap = 1;
  const pr = SAPmock.project(0, 'demine', 'player', [[900, 700]]); pr.crew.push(p.id); D.demClock(); step(2); assert.equal(D.state().mines[1], 3, 'equipe de desminagem não pisa'); pr.done = true; D.demClock(); step(2); assert.equal(D.state().mines[1], 2, 'fora da equipe, pisa');
  /* IA: só desmina o que foi revelado a ela e perto das suas tropas; nunca na trégua */
  reset(); sb.aiEnabled = [true, false]; const m = mkSeg('mines', 1, 900, 700); K.mines.onStage(m, 1); mkUnit('rifle', 0, 800, 700); sb.time = 100; D.aiDemine(0); assert.equal(SAPmock.projects.length, 0, 'campo escondido: a IA não sabe');
  D.minesList.forEach(x => x.rev[0] = true); F.isPrep = () => true; D.aiTick(); assert.equal(SAPmock.projects.length, 0, 'na trégua não desmina'); F.isPrep = () => false; sb.time = 100; D.aiDemine(0);
  assert.equal(SAPmock.projects.length, 1); assert.equal(SAPmock.projects[0].kind, 'demine'); assert.equal(SAPmock.projects[0].src, 'ai'); D.aiDemine(0); assert.equal(SAPmock.projects.length, 1, 'um projeto por vez'); }

/* ---------- 9. IA: reação na guerra e orçamento ---------- */
reset(); pio(); { sb.aiEnabled = [true, false]; sb.sandbox = false; sb.supplies = [999, 999]; sb.time = 100;
  for (const y of [700, 720, 740]) sb.fieldTrenches.push({ team: 0, x: 720, y, line: 'front' });
  const tk = mkUnit('tank', 1, 1250, 700);
  D.aiReact(0); const p = SAPmock.projects.find(p => p.kind === 'ditch'); assert.ok(p && p.src === 'ai', 'tanque a ~500 px da linha: a IA abre um valo à frente'); const cost = 3 * 14; assert.equal(sb.supplies[0], 999 - cost, 'paga 3 trechos × ◈14');
  const px = p.segs[0].x; assert.ok(px > 760 && px < 820, 'à frente da linha: x=' + px.toFixed(0));
  D.aiReact(0); assert.equal(SAPmock.projects.length, 1, 'cooldown de 25 s');
  sb.time += 30; SAPmock.projects[0].done = true; for (const sg of SAPmock.projects[0].segs) D.addDitch(sg); mkUnit('tank', 1, 1300, 720); D.aiReact(0); assert.ok(SAPmock.projects.some(p => p.kind === 'hedgehog'), 'com 2+ tanques acrescenta ouriços');
  /* caixa abaixo da reserva: não gasta */
  reset(); pio(); sb.aiEnabled = [true, false]; sb.sandbox = false; sb.supplies = [230, 999]; sb.time = 100; sb.fieldTrenches.push({ team: 0, x: 720, y: 700, line: 'front' }); mkUnit('tank', 1, 1250, 700); D.aiReact(0); assert.equal(SAPmock.projects.length, 0, 'sem caixa acima da reserva de obras (200) não constrói'); assert.equal(sb.supplies[0], 230);
  /* teto por facção, mesmo no sandbox */
  reset(); pio(); sb.aiEnabled = [true, false]; sb.sandbox = true; sb.time = 100; sb.fieldTrenches.push({ team: 0, x: 720, y: 700, line: 'front' });
  for (let i = 0; i < 20; i++) D.addDitch(mkSeg('ditch', 0, 600 + i * 40, 100, 1, 0, 36)); mkUnit('tank', 1, 1250, 700); D.aiReact(0); assert.equal(SAPmock.projects.length, 0, 'teto de 14 trechos de valo');
  /* minas contra massa de infantaria a pé */
  reset(); pio(); sb.aiEnabled = [true, false]; sb.sandbox = true; sb.time = 100; sb.fieldTrenches.push({ team: 0, x: 720, y: 700, line: 'front' }); for (let i = 0; i < 8; i++) mkUnit('rifle', 1, 1050 + rnd(-30, 30), 700 + rnd(-60, 60));
  D.aiReact(0); const mp = SAPmock.projects.find(p => p.kind === 'mines'); assert.ok(mp, 'grupo de 8 a pé: campo minado'); assert.ok(mp.segs[0].x > 770 && mp.segs[0].x < 840, 'à frente da linha');
  /* sem 3 pioneiros livres a IA não encomenda a obra (ela ficaria parada ocupando uma vaga da engenharia) */
  reset(); sb.aiEnabled = [true, false]; sb.sandbox = true; sb.time = 100; sb.fieldTrenches.push({ team: 0, x: 720, y: 700, line: 'front' }); mkUnit('tank', 1, 1250, 700); for (let i = 0; i < 2; i++) { const u = mkUnit('rifle', 0, 500, 500 + i * 10); u.sap = 1; }
  D.aiReact(0); assert.equal(SAPmock.projects.length, 0, 'só 2 pioneiros livres: não encomenda');
  /* obra que ninguém pegou em 30 s é cancelada e devolvida */
  reset(); pio(); sb.aiEnabled = [true, false]; sb.sandbox = false; sb.supplies = [999, 999]; sb.time = 100; sb.fieldTrenches.push({ team: 0, x: 720, y: 700, line: 'front' }); for (let i = 0; i < 8; i++) mkUnit('rifle', 1, 1050 + rnd(-30, 30), 700 + rnd(-60, 60));
  D.aiReact(0); assert.equal(SAPmock.projects.length, 1); assert.equal(sb.supplies[0], 999 - 36, 'campo minado de 2 trechos custa ◈36');
  sb.time = 120; D.aiTick(); assert.equal(SAPmock.projects.filter(p => !p.done && p.kind === 'mines').length, 1, 'ainda dentro dos 30 s');
  sb.time = 135; SAPmock.projects.forEach(p => { if (p.kind === 'mines') p.t0 = 100; }); D.aiTick(); assert.equal(D.stats.aiCancel, 1, 'sem equipe em 30 s: cancela'); assert.ok(sb.supplies[0] >= 999 - 36 + 36 - 42, 'e devolve o custo (gasta no máximo a próxima reação)');
  /* artilharia contra tanque imobilizado à vista */
  reset(); pio(); sb.aiEnabled = [true, false]; sb.sandbox = true; sb.time = 100; const tt = mkUnit('tank', 1, 1100, 700); mkUnit('rifle', 0, 800, 700); tt.wdf = { imm: sb.time + 8, immT0: sb.time, bog: 0, cool: 0 };
  D.aiHunt(0); assert.equal(sb.missions.length, 1, 'tanque imobilizado à vista vira alvo'); assert.equal(sb.missions[0].team, 0); D.aiHunt(0); assert.equal(sb.missions.length, 1, 'uma salva por 35 s');
  reset(); pio(); sb.aiEnabled = [true, false]; sb.time = 100; const t2 = mkUnit('tank', 1, 1100, 700); mkUnit('rifle', 0, 1100, 650); t2.wdf = { imm: sb.time + 8, immT0: sb.time, bog: 0, cool: 0 }; D.aiHunt(0); assert.equal(sb.missions.length, 0, 'sem fogo amigo (aliado a menos de 110 px)'); }

/* ---------- 10. desligar e desempenho ---------- */
{ reset(); sb.PXDEF.on = false; const s = mkSeg('mines', 0, 800, 600); K.mines.onStage(s, 1); const u = mkUnit('rifle', 1, 790, 600); u.order = 'move'; u.tx = 900; u.ty = 600; step(60); assert.equal(D.stats.triggered, 0, 'desligado: sem efeito'); sb.PXDEF.on = true; }
reset(); sb.sandbox = true; sb.vw = 320; sb.vh = 180;
for (let i = 0; i < 160; i++) { const u = mkUnit(i % 12 === 0 ? 'tank' : 'rifle', i & 1, 700 + rnd(0, 1000), 100 + rnd(0, 1400)); u.order = 'move'; u.tx = u.x + rnd(-200, 200); u.ty = u.y; }
for (let i = 0; i < 30; i++) K.mines.onStage(mkSeg('mines', i & 1, 600 + rnd(0, 1200), 100 + rnd(0, 1400)), 1);
for (let i = 0; i < 40; i++) { const s = mkSeg('ditch', i & 1, 600 + rnd(0, 1200), 100 + rnd(0, 1400), 1, 0, 36); K.ditch.onStage(s, 2); }
for (let i = 0; i < 24; i++) K.hedgehog.onStage(mkSeg('hedgehog', i & 1, 600 + rnd(0, 1200), 100 + rnd(0, 1400)), 2);
{ for (const u of sb.units) { u.x = clamp(u.x, 50, 2300); }
  const T = 600; D.rebuild(); D.post(1 / 30); const t0 = performance.now(); for (let i = 0; i < T; i++) { for (const u of sb.units) { u._wx = u.x; u._wy = u.y; } D.post(1 / 30); } const ms = (performance.now() - t0) / T;
  console.log(`  custo de post(): ${ms.toFixed(3)} ms por quadro (160 unidades, ${D.minesList.length} minas, ${D.ditches.length} trechos de valo, ${D.hedges.length} ouriços)`); assert.ok(ms < 1.5, 'barato (no vm cada acesso a global custa caro; o navegador mede menos)'); }
assert.equal(D.stats.errors, 0); assert.equal(sb.PXWORKS.stats.errors, 0);
console.log('Obras defensivas 1.9.2: minas escondidas, valo anticarro, ouriços e desminagem OK');
