const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// casualty.js (1.9) sobre medics.js num mini-motor: gravidade, rastejo, resgate físico por companheiro (ir → agarrar → arrastar
// devagar → entregar), interrupção por explosão/supressão, médico estabiliza, cadeia posto → ambulância → hospital com
// prioridade e estoque, desfechos, convalescença e o efeito medido do resgate na sobrevivência (A/B).
let seed0 = 3; Math.random = () => { seed0 = (seed0 * 1664525 + 1013904223) >>> 0; return seed0 / 4294967296; };
function engine(opts = {}) {
  let serial = 0;
  const sb = {
    console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity,
    W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null,
    units: [], particles: [], buildings: [], fieldTrenches: [], trenchGrid: new Map(), allCraters: [], tickets: [500, 500], corpses: [],
    cam: { x: 0, y: 0 }, selected: new Set(), location: { search: opts.search || '' }, keys: {},
    document: { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }) }), getElementById: () => null, querySelector: () => null },
    PX: { Z: .5 },
    IronFrontBrain: { selectTarget(u, list, r, can) { return list.find(e => e.team !== u.team && e.hp > 0 && (!can || can(u, e))) || null; } },
    toasts: [], toast(s) { sb.toasts.push(s); }, setup() {}, finish() {}, explode() {},
    protectedBy(u) { return sb.fieldTrenches.some(t => Math.abs(t.x - u.x) < t.hw && Math.abs(t.y - u.y) < t.hh) ? .35 : 1; },
    update(dt) {
      sb.time += dt; sb.units = sb.units.filter(u => u.hp > 0);
      for (const u of sb.units) {
        u.cd = Math.max(0, (u.cd || 0) - dt); u.suppression = Math.max(0, (u.suppression || 0) - dt * .18); u.moving = false;
        if (u.down || u.order !== 'move') continue;
        const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy); if (d < 2) continue;
        const s = Math.min(d, 47 * dt); u.x += dx / d * s; u.y += dy / d * s; u.moving = true;
      }
    },
    damage(u, n) { if (u.hp <= 0) return; u.hp -= n; if (u.hp <= 0) { sb.dead = (sb.dead || 0) + 1; sb.tickets[u.team]--; } },
  };
  sb.window = sb; sb.addEventListener = () => {};
  vm.createContext(sb);
  for (const f of ['medics.js', 'life-kit.js', 'casualty.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
  sb.unit = (type, team, x, y, extra = {}) => { const u = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, manualUntil: 0, cd: 0, cohesion: 1, suppression: 0, angle: 0, ...extra }; sb.units.push(u); return u; };
  sb.run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };
  sb.setup();
  return sb;
}

/* ---------- 1. ferido: gravidade e rastejo até a cobertura ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;   // sem padioleiros: isola o comportamento
  sb.fieldTrenches.push({ x: 640, y: 800, hw: 16, hh: 16, team: 0 });
  const w = sb.unit('rifle', 0, 700, 800); sb.damage(w, 120); sb.run(.1);
  assert.ok(w.down && w.cz, 'caiu e ganhou ficha de ferimento');
  w.cz.sev = 'light'; w.cz.ko = Infinity; w.cz.crawl = null; const x0 = w.x; sb.run(4);
  assert.ok(w.x < x0 - 20, `ferido leve rasteja para a trincheira (andou ${(x0 - w.x).toFixed(1)} px em 4 s)`);
  sb.run(6); assert.ok(w.cz.cover, 'chegou à cobertura');
  const b0 = w.bleed; sb.run(10); const slowed = (w.bleed - b0);
  assert.ok(slowed > 4.5, `abrigado, o relógio de sangramento corre mais devagar (+${slowed.toFixed(1)} s em 10 s)`);
  const k = sb.unit('rifle', 0, 1000, 600); sb.damage(k, 120); sb.run(.1); k.cz.sev = 'critical'; k.cz.ko = sb.time; sb.run(1);
  assert.equal(k.cz.st, 'ko', 'crítico perde a consciência e não rasteja');
}

/* ---------- 2. resgate por companheiro: ir → agarrar → arrastar devagar → entregar ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  sb.fieldTrenches.push({ x: 520, y: 800, hw: 16, hh: 16, team: 0 });
  const w = sb.unit('rifle', 0, 700, 800), r = sb.unit('rifle', 0, 740, 830);
  sb.damage(w, 120); sb.run(.1); w.cz.sev = 'serious';
  let t = 0; while (!r.rs && t < 5) { sb.run(.25); t += .25; }
  assert.ok(r.rs, `companheiro decide ajudar em ${t.toFixed(2)} s`);
  t = 0; while (r.rs && r.rs.st === 'go' && t < 10) { sb.run(.05); t += .05; }
  assert.equal(r.rs.st, 'grab', 'chegou e ajoelhou para agarrar');
  sb.run(1.2); assert.equal(r.rs.st, 'drag', 'agarrou e começou a arrastar');
  const p0 = { x: r.x, y: r.y }; sb.run(2); const v = Math.hypot(r.x - p0.x, r.y - p0.y) / 2;
  assert.ok(v > 14 && v < 24, `arrasta a ${v.toFixed(1)} px/s (40% de 47)`);
  assert.ok(Math.hypot(w.x - r.x, w.y - r.y) < 9 && Math.abs(r.angle - Math.atan2(w.y - r.y, w.x - r.x)) < 1e-6, 'o ferido vem atrás e o resgatador olha para ele');
  t = 0; while (r.rs && t < 30) { sb.run(.1); t += .1; }
  assert.ok(!r.rs && w.cz.cover && C.stats.buddyDone === 1, `entregue abrigado na trincheira após ${t.toFixed(1)} s de arraste`);
  assert.ok(w.down && !w.claimed, 'fica para os padioleiros');
}

/* ---------- 3. perigo: supressão impede, explosão interrompe ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  const w = sb.unit('rifle', 0, 700, 800), r = sb.unit('rifle', 0, 740, 800, { suppression: 2 });
  sb.damage(w, 120); for (let i = 0; i < 40; i++) { r.suppression = 2; sb.run(.25); }
  assert.ok(!r.rs, 'sob supressão máxima ninguém se arrisca');
  r.suppression = 0; let t = 0; while ((!r.rs || r.rs.st !== 'drag') && t < 15) { sb.run(.1); t += .1; }
  assert.equal(r.rs && r.rs.st, 'drag');
  const R0 = Math.random; Math.random = () => 0; sb.explode(r.x + 20, r.y, 40, 100, 1); Math.random = R0;
  assert.ok(!r.rs && C.stats.aborted === 1 && w.down && w.cz.dropT > sb.time, 'explosão perto: larga o ferido e se joga no chão');
  assert.ok(r.suppression >= 1.6, 'quem largou fica suprimido');
}
Math.random = (() => { let s = 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

/* ---------- 4. médico: primeiros socorros ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  const a = sb.unit('rifle', 0, 700, 800), med = sb.unit('rifle', 0, 900, 800, { cls: 'medic' });
  sb.damage(a, 120); sb.run(.1); a.cz.sev = 'light'; a.cz.crawl = { x: a.x, y: a.y }; a.cz.cover = true;
  let t = 0; while (a.down && t < 30) { sb.run(.1); t += .1; }
  assert.ok(!a.down && Math.abs(a.hp - 35) < 1e-9 && C.stats.medicAid === 1, `médico a 200 px trata o leve no campo: volta com 35% em ${t.toFixed(1)} s`);
  const g = sb.unit('rifle', 0, 1000, 820); sb.damage(g, 120); sb.run(.1); g.cz.sev = 'serious'; g.cz.cover = true; const b0 = g.bleed;
  t = 0; while (!g.cz.stab && t < 30) { sb.run(.1); t += .1; }
  assert.ok(g.cz.stab && g.down && g.bleed - b0 > 85, 'grave fica estabilizado (+90 s) esperando a maca');
}

/* ---------- 5. cadeia médica: posto avançado → ambulância → hospital ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  const fwd = M.addPost(0, 900, 800, { stage: 3 });
  const put = (p, sev) => { const u = sb.unit('rifle', 0, p.x + 900, p.y + 500); sb.damage(u, 120); sb.run(.06); u.cz.sev = sev; u.inBed = sb.time + 99; p.beds.push(u); return u; };
  C.cfg.OUT_POST.serious = [0, 0];                                  // força a transferência
  const s1 = put(fwd, 'serious'); sb.run(.1);
  assert.equal(s1.cz.st, 'bed'); assert.ok(s1.inBed > sb.time + 1e5, 'o leito passa a ser controlado pelo casualty.js');
  sb.run(10); assert.equal(s1.cz.st, 'transit'); assert.ok(!sb.units.includes(s1), 'de ambulância: sai do campo');
  let tt = 0; while (s1.cz && s1.cz.st === 'transit' && tt < 30) { sb.run(.1); tt += .1; }
  console.log(`  ambulância: ${tt.toFixed(1)} s até o hospital`); const W0 = [...C.wards.values()][0];
  assert.ok(W0 && (W0.surg.includes(s1) || W0.queue.includes(s1)), 'chegou à enfermaria do hospital de campanha');
  // prioridade: crítico passa à frente
  const h = M.posts.find(p => p.team === 0 && !p.seg);
  const l1 = put(h, 'light'), l2 = put(h, 'light'), c1 = put(h, 'critical'); sb.run(8);
  const queueOrder = [...W0.surg, ...W0.queue].map(u => u.cz.sev);
  assert.equal(W0.surg.length, 2, '2 cirurgiões em paralelo');
  assert.ok(W0.surg.includes(c1) || queueOrder[2] === 'critical', `prioridade de triagem: ${queueOrder.join(',')}`);
  sb.run(60);
  const st = C.stats, done = st.hospReturn + st.incapacitated + st.evacuated + st.died;
  assert.ok(done >= 4, `desfechos no hospital (${st.hospReturn} voltaram, ${st.incapacitated} incapacitados, ${st.evacuated} evacuados, ${st.died} mortos)`);
  // estoque: sem kits, cirurgia mais lenta e marcada
  W0.stock = 0; const sx = put(h, 'serious'); sb.run(8);
  assert.ok(sx.cz.low && sx.cz.until - sb.time > 10, 'sem estoque: cirurgia 1,6× mais lenta');
  // convalescença
  const t0 = sb.tickets[0]; C.cfg.CONVAL_P = 1; const ev = sb.unit('rifle', 0, 0, 0); ev.cz = { hid: true, st: 'ward' }; C.hidden.push(ev);
  sb.run(.1); assert.ok(C.state().conval >= 0);
}

/* ---------- 6. A/B: o resgate muda a sobrevivência ---------- */
function ab(on, medics) {
  const sb = engine({ search: on ? '' : '?feridos=0' }), M = sb.PXMED; M.cfg.WOUND = 1;
  for (let i = 0; i < 6; i++) sb.fieldTrenches.push({ x: 560, y: 300 + i * 200, hw: 16, hh: 16, team: 0 });
  const ws = [];
  for (let i = 0; i < 30; i++) {
    const x = 760 + (i % 5) * 60, y = 260 + Math.floor(i / 5) * 200;
    const w = sb.unit('rifle', 0, x, y); ws.push(w);
    sb.unit('rifle', 0, x + 30, y + 20, medics && i % 6 === 0 ? { cls: 'medic' } : {});
  }
  sb.unit('rifle', 1, 1500, 800);
  for (const w of ws) sb.damage(w, 120);
  sb.run(150, .1);
  const dead = ws.filter(w => w.hp <= 0).length;
  return { dead, alive: ws.length - dead };
}
const off = ab(false, false), on = ab(true, false), med = ab(true, true);
console.log(`  A/B 30 feridos a 200–460 px do hospital, 150 s: sem casualty ${off.dead} mortos · com resgate ${on.dead} · com resgate + 5 médicos ${med.dead}`);
assert.ok(on.dead < off.dead, 'resgate por companheiros reduz mortes');
assert.ok(med.dead <= on.dead, 'médicos reduzem ainda mais');

console.log('Feridos 1.9: gravidade, rastejo, resgate físico, interrupção por perigo, médico, posto → ambulância → hospital, prioridade, estoque e A/B de sobrevivência OK');
