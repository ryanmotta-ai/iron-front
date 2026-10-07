const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// medcare (1.11) — o que mudou na SIMULAÇÃO do socorro (o desenho é verificado em tools/verify-medcare.cjs):
// pouso no catre pelos padioleiros, pouso pelo resgatador, arraste que não emperra perto do destino, alta visível (o curado só volta ao jogo
// depois da cena, na posição de saída que o medcare-hosp.js informa), ferido e resgatador não se empurram (physics.js) e catres reservados.
let seed0 = 11; Math.random = () => { seed0 = (seed0 * 1664525 + 1013904223) >>> 0; return seed0 / 4294967296; };
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
        if (u.down || u.order !== 'move' || u.frozen) continue;
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

/* ---------- 1. padioleiros: a carga e o pouso levam tempo, e o ferido vai ao catre que a simulação reservou ---------- */
{
  const sb = engine(), M = sb.PXMED; M.cfg.WOUND = 1;
  const hosp = M.posts[0];
  const w = sb.unit('rifle', 0, hosp.x + 120, hosp.y + 60); sb.damage(w, 120); sb.run(.1); w.cz.sev = 'serious'; w.cz.callT = 1e9;
  const seen = []; let t = 0; const t0 = sb.time;
  while (!hosp.beds.includes(w) && t < 60) { sb.run(.05); t += .05; const c = hosp.crews.find(k => k.u === w); if (c && seen[seen.length - 1] !== c.st) seen.push(c.st); }
  assert.deepEqual(seen.filter((s, i) => ['go', 'load', 'carry', 'lay'].includes(s) && seen.indexOf(s) === i), ['go', 'load', 'carry', 'lay'], `estados da equipe: ${seen.join(' → ')}`);
  assert.ok(M.cfg.LOAD >= 4 && M.cfg.LAY >= 3, 'carregar e pousar levam alguns segundos');
  const b = M.bedPos(hosp, 0); assert.ok(Math.hypot(w.x - b.x, w.y - b.y) < 80, 'no leito da própria equipe');
}

/* ---------- 2. resgatador pousa o ferido no catre (estado 'lay') e só então se solta ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  const hosp = M.posts[0], w = sb.unit('rifle', 0, hosp.x + 150, hosp.y + 60), r = sb.unit('rifle', 0, hosp.x + 162, hosp.y + 64);
  sb.damage(w, 120); sb.run(.1); w.cz.sev = 'serious'; w.cz.callT = 1e9;
  C.start(r, w); const states = []; let t = 0;
  while (r.rs && t < 60 || t === 0) { sb.run(.05); t += .05; if (r.rs && states[states.length - 1] !== r.rs.st) states.push(r.rs.st); if (!r.rs) break; }
  assert.ok(states.includes('lay'), `passou por 'lay': ${states.join(' → ')}`);
  assert.ok(w.cz.lay && w.cz.lay.to, 'o ferido guarda de onde veio e para onde vai (o desenho interpola)');
  assert.ok(hosp.beds.includes(w) && w.inBed, 'ficou no catre');
  assert.ok(Math.abs(w.cz.lay.t0 - (sb.time - 2.2 - .05)) < 3, 'o pouso dura CFG.LAYB');
}

/* ---------- 3. arraste que não emperra: perto do destino sem avançar, entrega em CFG.STALL; longe e travado, desiste ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  const hosp = M.posts[0], w = sb.unit('rifle', 0, hosp.x + 160, hosp.y), r = sb.unit('rifle', 0, hosp.x + 172, hosp.y + 4);
  sb.damage(w, 120); sb.run(.1); w.cz.sev = 'serious'; w.cz.callT = 1e9; C.start(r, w);
  let t = 0; while ((!r.rs || r.rs.st !== 'drag') && t < 10) { sb.run(.05); t += .05 }
  assert.equal(r.rs.st, 'drag');
  r.frozen = true; r.x = hosp.x + 40; r.y = hosp.y + 16; w.x = r.x + 8; w.y = r.y;               // a 40 px do posto: empacou
  const tf = sb.time; t = 0; while (r.rs && r.rs.st === 'drag' && t < 10) { sb.run(.05); t += .05 }
  assert.ok(r.rs ? r.rs.st === 'lay' : hosp.beds.includes(w), `entregou ao empacar (${t.toFixed(1)} s)`);
  assert.ok(t >= C.cfg.STALL - .2 && t < C.cfg.STALL + 1.5, `esperou ≈ ${C.cfg.STALL} s antes de entregar (${t.toFixed(2)})`);
  /* longe e travado: abandona */
  const sb2 = engine(), M2 = sb2.PXMED, C2 = sb2.PXCAS; M2.cfg.WOUND = 1; M2.cfg.RANGE = 0;
  const h2 = M2.posts[0], w2 = sb2.unit('rifle', 0, h2.x + 300, h2.y), r2 = sb2.unit('rifle', 0, h2.x + 312, h2.y + 4);
  sb2.damage(w2, 120); sb2.run(.1); w2.cz.sev = 'serious'; w2.cz.callT = 1e9; C2.start(r2, w2);
  t = 0; while ((!r2.rs || r2.rs.st !== 'drag') && t < 10) { sb2.run(.05); t += .05 }
  r2.frozen = true; t = 0; while (r2.rs && t < 30) { sb2.run(.05); t += .05 }
  assert.ok(!r2.rs && C2.why['abandonou' ] === undefined && Object.keys(C2.why).some(k => /arraste bloqueado/.test(k)), 'longe do destino e sem andar: larga o ferido (arraste bloqueado)');
}

/* ---------- 4. alta visível: o curado só volta ao jogo depois da cena, na saída informada pelo medcare-hosp ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  C.exitFor = (u, where, p) => ({ x: 777, y: 888, angle: 0 });
  const fwd = M.addPost(0, 900, 800, { stage: 3 }); C.cfg.OUT_POST.light = [1, 0];
  const u = sb.unit('rifle', 0, fwd.x, fwd.y + 40); sb.damage(u, 120); sb.run(.06); u.cz.sev = 'light'; u.inBed = sb.time + 99; fwd.beds.push(u);
  let t = 0, trec = null; while (u.down && t < 60) { sb.run(.05); t += .05; if (u.cz && u.cz.st === 'recover' && trec == null) trec = t; }
  assert.ok(trec != null, 'entrou em recuperação'); assert.ok(!u.down, 'voltou ao jogo');
  const dur = t - trec; assert.ok(Math.abs(dur - C.cfg.REC.post) < .3, `ficou ${dur.toFixed(2)} s em recuperação (REC.post = ${C.cfg.REC.post})`);
  assert.ok(Math.hypot(u.x - 777, u.y - 888) < 2 && u.angle === 0, 'reapareceu exatamente na saída da cena');
  assert.ok(!fwd.beds.includes(u) && C.stats.recovered === 1, 'liberou o catre');
  // enquanto se recupera não é alvo nem é recolhido de novo
  const v = sb.unit('rifle', 0, fwd.x, fwd.y + 40); sb.damage(v, 120); sb.run(.06); v.cz.sev = 'light'; v.inBed = sb.time + 99; fwd.beds.push(v); sb.run(C.cfg.POST_T[1] + 1);
  assert.equal(v.cz.st, 'recover'); sb.units.push(sb.unit('rifle', 0, v.x + 30, v.y)); sb.run(2);
  assert.ok(v.down && v.inBed, 'continua deitado (intocável) até acabar a cena');
}

/* ---------- 5. alta no campo (leve curado pelo médico): senta, levanta, pega o fuzil — REC.field ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  const a = sb.unit('rifle', 0, 700, 800), med = sb.unit('rifle', 0, 760, 800, { cls: 'medic' });
  sb.damage(a, 120); sb.run(.1); a.cz.sev = 'light'; a.cz.cover = true; a.cz.crawl = { x: a.x, y: a.y };
  let t = 0, trec = null; while (a.down && t < 40) { sb.run(.05); t += .05; if (a.cz && a.cz.st === 'recover' && trec == null) trec = t; }
  assert.ok(trec != null && !a.down, 'o leve passou pela cena de campo e voltou');
  assert.ok(Math.abs((t - trec) - C.cfg.REC.field) < .3, `cena de campo de ${(t - trec).toFixed(2)} s`);
  assert.ok(Math.abs(a.hp - 35) < 1e-9, 'volta com 35% da vida como antes');
}

/* ---------- 6. hospital: a cirurgia termina → recuperação visível antes de voltar ao jogo ---------- */
{
  const sb = engine(), M = sb.PXMED, C = sb.PXCAS; M.cfg.WOUND = 1; M.cfg.RANGE = 0;
  C.cfg.OUT_HOSP.serious = [1, 0, 0, 0]; C.exitFor = (u, where, p) => ({ x: 555, y: 666, angle: Math.PI });
  const h = M.posts.find(p => p.team === 0 && !p.seg), u = sb.unit('rifle', 0, h.x, h.y + 40); sb.damage(u, 120); sb.run(.06); u.cz.sev = 'serious'; u.inBed = sb.time + 99; h.beds.push(u);
  let t = 0, trec = null, back = null; while (t < 120 && back == null) { sb.run(.05); t += .05; if (u.cz && u.cz.st === 'recover' && trec == null) trec = t; if (!u.down && trec != null && u.cz == null) back = t }
  assert.ok(trec != null && back != null, 'passou pela cirurgia e pela recuperação');
  assert.ok(Math.abs(back - trec - C.cfg.REC.hosp) < .3, `recuperação no hospital: ${(back - trec).toFixed(2)} s (REC.hosp = ${C.cfg.REC.hosp})`);
  assert.ok(sb.units.includes(u) && Math.hypot(u.x - 555, u.y - 666) < 1, 'saiu da enfermaria já no ponto de saída');
  assert.ok(C.state().hidden.every(x => x.id !== u.id), 'nada fica escondido depois');
}

/* ---------- 7. leitos: o catre reservado por quem está pousando não é entregue a outro ---------- */
{
  const src = fs.readFileSync(path.join(__dirname, '../dist/art-medics.js'), 'utf8');
  assert.ok(/M\.bedPos=\(p,i\)=>/.test(src) && /c\.st==='lay'&&c\.lay&&c\.lay\.dest===p/.test(src), 'art-medics.js reserva o catre de quem está pousando');
  const ph = fs.readFileSync(path.join(__dirname, '../dist/physics.js'), 'utf8');
  assert.ok(/v\.down&&v\.cz&&v\.cz\.res===u\|\|u\.down&&u\.cz&&u\.cz\.res===v\)continue/.test(ph), 'physics.js: ferido e resgatador não se empurram');
  assert.ok(/u\.down\?6:/.test(ph), 'physics.js: ferido pesa 6× (passantes mal o movem)');
}
console.log('Medcare 1.11: carga/pouso dos padioleiros, pouso pelo resgatador, arraste que não emperra, alta visível (campo, posto, hospital) e catres reservados OK');
