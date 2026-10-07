const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// works-logistics.js (1.9.3): passadiço de tábuas, linha telefônica de campanha, cozinha e posto de franco-atirador.
// O motor aqui é um mini-jogo em vm: a lama é um vetor de células de 16 px lido por um "clima" que imita o weather.js
// (speedOf: infantaria ×(1−0,2·lama), tanque ×(1−0,3·lama), água rasa por faixas) e o works.js REAL é carregado antes
// para provar que o corretor de artilharia do posto de observação continua composto com a linha telefônica.
function engine(search = '', opt = {}) {
  let serial = 0, seed = 11;
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const W = 2400, H = 1600, GW = Math.ceil(W / 16), anchors = [], KIND = { trench: {} };
  const seg = (a, b, step) => { const out = [], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1) return out; const n = Math.max(1, Math.round(L / step)), ax = dx / L, ay = dy / L; for (let k = 0; k < n; k++) { const f = (k + .5) / n; out.push({ x: a[0] + dx * f, y: a[1] + dy * f, ax, ay, len: L / n }); } return out; };
  const segment = (pts, step = 30) => { const out = []; for (let i = 1; i < pts.length; i++) out.push(...seg(pts[i - 1], pts[i], step)); return out; };
  const sb = {
    console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity, Int16Array, Int32Array, Float32Array, Uint8Array, setTimeout: f => f(), performance,
    W, H, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null, sandbox: opt.sandbox ?? true,
    units: [], buildings: [], fieldTrenches: anchors, particles: [], bullets: [], shells: [], decor: [], aiEnabled: [false, false], supplies: [999, 999], location: { search },
    weapon: 'rifle', ammo: 5, magazines: { rifle: 5 }, weapons: { rifle: { mag: 5 } }, missions: [], booms: [], cam: { x: 0, y: 0 },
    defs: { rifle: { speed: 47 }, tank: { speed: 28 }, mg: { speed: 34 } },
    document: { createElement: () => ({ getContext: () => ({ fillRect() {} }), width: 0, height: 0 }), getElementById: () => null },
    PX: { Z: .5, WW1: { PW: 1200, ROADY: [185, 400, 610], layout: () => ({ gunsPlan: [{ x: 170, y: 90 }, { x: 148, y: 238 }, { x: 176, y: 328 }, { x: 152, y: 472 }, { x: 180, y: 574 }, { x: 150, y: 716 }] }) } },
    PXSAP: { cfg: { KIND, MAXSEGS: 44 }, projects: [], segs: [], _: { segment }, addAnchor(s, o) { anchors.push({ x: s.x, y: s.y, team: s.team }); }, lineB() {},
      project(team, kind, src, pts, o) { const k = KIND[kind], geo = k.line ? segment(pts, k.step || 30) : [{ x: pts[0][0], y: pts[0][1], ax: 0, ay: 1, len: 30 }], p = { team, kind, src, pts, keep: o && o.keep, segs: [], crew: [], done: false, target: k.target };
        for (const g of geo) p.segs.push({ p, team, kind, x: g.x, y: g.y, ax: g.ax, ay: g.ay, len: g.len, need: k.need, stage: 0, work: 0 }); sb.PXSAP.projects.push(p); sb.projectCalls.push({ team, kind, src, pts, n: geo.length }); return p; },
      cancel(p) { p.done = true; } },
    PXFORT: { KINDS: ['trench'], SHORT: {}, SUB: {}, planExtra: [], isPrep: () => !!sb.prep },
    projectCalls: [],
    PXBAT: { active: () => true, batteries: [], mission(team, x, y, count, spread, kind) { sb.missions.push({ team, x, y, spread, kind, t: sb.time }); return true; } },
    PXW: { state: { I: 0, mud: 0, snow: false }, mudGrid: new Float32Array(GW * Math.ceil(H / 16)), depthVal: 0, depth() { return sb.PXW.depthVal; }, visible: () => true, windVec: () => ({ x: 10, y: 0 }) },
    PXCLS: { on: true, cfg: { NAT: [{ mark: { range: 350 } }, { mark: { range: 330 } }] }, observerOf(team, x, y) { return sb.units.find(u => u.team === team && u.cls === 'observer' && u.hp > 0 && Math.hypot(u.x - x, u.y - y) < 500) || null; } },
    PXAIR: { on: true, spotterOver: () => sb.plane || null },
    PXGEAR: { on: true, st: { s: 40 }, cfg: { ST: { MAX: 100 } } },
    IronFrontBrain: { safeShot: () => true, lastPlans: [null, null] },
    toasts: [], toast(s) { sb.toasts.push(s); }, setup() { sb.time = 0; }, sightRange: r => r,
    newBuilding(type, team, x, y) { const b = { type, team, x, y }; sb.buildings.push(b); return b; },
    place(x, y) { sb.PXBAT.mission(0, x, y, 6, 95); }, runCommander(team) { sb.PXBAT.mission(team, 1500, 800, 5, 75, 'auto'); },
    damage(u, n) { if (u.hp > 0) u.hp -= n; }, shoot(u, t) { const a = Math.atan2(t.y - u.y, t.x - u.x); sb.bullets.push({ team: u.team, x: u.x, y: u.y, vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, t: 240 / 800, damage: 30 }); u.cd = 1.4; sb.shots.push(Math.hypot(t.x - u.x, t.y - u.y)); },
    shots: [],
    explode(x, y, r, power) { sb.booms.push({ x, y, r, power }); },
    // "clima": imita weather.js (speedOf + lama) e a inércia do game.js; lê a lama pelo vetor, como o weather.js faz
    update(dt) {
      sb.time += dt;
      for (const u of sb.units) {
        if (u.hp <= 0) continue; u.cd = Math.max(0, (u.cd || 0) - dt);
        if (u.order === 'move') {
          const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy); if (d < 1) continue;
          const sp = sb.defs[u.type].speed * dt, tank = u.type === 'tank', m = sb.PXW.mudGrid[Math.floor(u.y / 16) * GW + Math.floor(u.x / 16)], dep = sb.PXW.depthVal;
          const df = tank ? (dep < .12 ? 1 : dep < .25 ? .85 : dep < .55 ? .55 : dep < .78 ? .3 : .12) : (dep < .12 ? 1 : dep < .25 ? .92 : dep < .55 ? .72 : .45);
          const f = df * (1 - .12 * Math.min(1, sb.PXW.state.I)) * (1 - (tank ? .3 : .2) * m), s = Math.min(d, sp * f);
          u.x += dx / d * s; u.y += dy / d * s; u.moving = true;
        } else u.moving = false;
      }
    },
  };
  sb.window = sb; sb.addEventListener = () => {}; sb.PXFORT.planExtra.length = 0;
  vm.createContext(sb);
  for (const f of ['works.js', 'works-logistics.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
  sb.u = (team, x, y, type = 'rifle', extra = {}) => { const u = { id: ++serial, team, x, y, type, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, cd: 0, suppression: 0, cohesion: 1, ammo: 5, gren: 0, ...extra }; sb.units.push(u); return u; };
  sb.run = (sec, dt = 1 / 30) => { for (let t = 0; t < sec - 1e-9; t += dt) sb.update(dt); };
  sb.K = KIND; sb.anchors = anchors; sb.setup(); return sb;
}
const lineSegs = (sb, kind, team, pts, last = true) => {      // fabrica trechos prontos como o sappers.js faria (onStage do último estágio)
  const k = sb.K[kind], geo = sb.PXSAP._.segment(pts, k.step), p = { team, kind, segs: [], done: true };
  geo.forEach(g => p.segs.push({ p, team, kind, x: g.x, y: g.y, ax: g.ax, ay: g.ay, len: g.len, need: k.need, stage: 1, work: 0 })); sb.PXSAP.segs.push(...p.segs); const n0 = sb.PXSAP.segs.length; p.segs.forEach(s => k.onStage(s, 1)); assert.equal(n0 - sb.PXSAP.segs.length, p.segs.length, 'trecho pronto sai de PXSAP.segs (não conta contra o limite da engenharia)'); return p.segs;
};
const approx = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} ± ${tol}`);

/* ---------- 0. catálogo e desligamento ---------- */
{
  const sb = engine(), S = sb.PXLOGI;
  for (const k of ['plank', 'phone', 'kitchen', 'sniper']) assert.ok(sb.K[k] && sb.PXFORT.KINDS.includes(k) && sb.PXFORT.SHORT[k] && sb.PXFORT.SUB[k], 'obra no catálogo: ' + k);
  assert.ok(sb.K.phonefix && !sb.PXFORT.KINDS.includes('phonefix'), 'o reparo não vira carta');
  assert.equal(sb.PXFORT.planExtra.length, 2, 'works.js + works-logistics.js entram no plano da IA');
  assert.ok(sb.K.plank.line && sb.K.phone.line && sb.K.plank.step === 32 && sb.K.phone.step === 40 && sb.K.plank.cost === 8 && sb.K.phone.cost === 5, 'linhas de 32 e 40 px, ◈8 e ◈5');
  assert.ok(sb.K.kitchen.cost === 70 && sb.K.kitchen.need.length === 2 && sb.K.sniper.cost === 60 && sb.K.sniper.need.length === 2, 'cozinha ◈70 e atirador ◈60, 2 estágios');
  for (const k of ['plank', 'phone', 'kitchen', 'sniper']) { const c = sb.K[k].sprite({ stage: sb.K[k].target, work: 999, need: sb.K[k].need, len: 30, ax: 0, ay: 1, team: 0, kind: k, p: {} }); assert.ok(c.width > 1, 'ícone real (não vazio) para a carta: ' + k); }
  const off = engine('?logistica=0'); assert.ok(!off.K.plank && !off.K.phone && !off.K.kitchen && !off.K.sniper && off.PXFORT.planExtra.length === 1 && off.PXLOGI.on === false, '?logistica=0: nada entra no catálogo');
  const item = sb.PXFORT.planExtra[1](0, 720, 1), kinds = item.map(i => i.kind).sort();
  assert.deepEqual([...kinds], ['kitchen', 'phone', 'phone', 'sniper', 'sniper'], 'plano da trégua: cozinha, 2 postos de atirador e 2 linhas');
  const ph = item.find(i => i.kind === 'phone'); assert.deepEqual([...ph.pts[0]], [132, 840], 'a 1ª linha parte do QG');
  const t1 = sb.PXFORT.planExtra[1](1, 1680, -1); assert.deepEqual([...t1.find(i => i.kind === 'phone').pts[0]], [2268, 840], 'lado 1 espelhado'); assert.ok(t1.find(i => i.kind === 'kitchen').pts[0][0] > 1680, 'cozinha da Alemanha atrás da linha');
}

/* ---------- 1. passadiço: velocidade na lama com e sem ---------- */
{
  const sb = engine(), S = sb.PXLOGI; sb.PXW.mudGrid.fill(1); sb.PXW.state.mud = 1;
  lineSegs(sb, 'plank', 0, [[400, 800], [624, 800]]);   // 7 trechos de 32 px
  assert.equal(S.planks().length, 7, '7 trechos de tábuas'); assert.equal(sb.PXSAP.segs.length, 0, 'nenhum trecho pronto ficou em PXSAP.segs');
  const rifleOn = sb.u(0, 400, 800, 'rifle', { order: 'move', tx: 1200, ty: 800 }), rifleOff = sb.u(0, 400, 900, 'rifle', { order: 'move', tx: 1200, ty: 900 });
  const tankOn = sb.u(0, 400, 790, 'tank', { order: 'move', tx: 1200, ty: 790 }), tankOff = sb.u(0, 400, 1000, 'tank', { order: 'move', tx: 1200, ty: 1000 });
  sb.run(3); const v = u => +((u.x - 400) / 3).toFixed(1);
  console.log(`  lama 100% (3 s, 7 trechos = 224 px): infantaria ${v(rifleOff)} px/s sem passadiço × ${v(rifleOn)} px/s sobre ele (base 47); tanque ${v(tankOff)} × ${v(tankOn)} px/s (base 28)`);
  approx(v(rifleOff), 47 * .8, .8, 'infantaria na lama'); approx(v(rifleOn), 47, .8, 'infantaria no passadiço'); approx(v(tankOff), 28 * .7, .5, 'tanque na lama'); approx(v(tankOn), 28, .5, 'tanque no passadiço');
  approx(sb.PXW.mudGrid[Math.floor(800 / 16) * 150 + Math.floor(500 / 16)], 1, .01, 'a lama sob as tábuas volta ao valor (só a secagem emulada de 0,0008/s)');
  assert.ok(sb.PXW.mudGrid[Math.floor(900 / 16) * 150 + Math.floor(500 / 16)] === 1, 'fora do passadiço ninguém foi tocado');
  /* chuva: a lama sobe durante o quadro e some do vetor só para quem pisa */
  sb.PXW.mudGrid.fill(.5); sb.PXW.state.I = 1; const k = Math.floor(800 / 16) * 150 + Math.floor(500 / 16); sb.run(.2); assert.equal(sb.PXW.mudGrid[k], .5, 'chuva sem simulação no quadro: mesma lama');
  /* água rasa (fator .72) → .86 sobre o passadiço */
  sb.PXW.state.I = 0; sb.PXW.state.mud = 0; sb.PXW.flood = .3; sb.PXW.mudGrid.fill(0); sb.PXW.depthVal = .4; const a = sb.u(0, 420, 800, 'rifle', { order: 'move', tx: 620, ty: 800 }), b = sb.u(0, 420, 960, 'rifle', { order: 'move', tx: 620, ty: 960 });
  sb.run(2); const wa = (a.x - 420) / 2, wb = (b.x - 420) / 2;
  console.log(`  água rasa (prof. .4, 2 s): infantaria ${wb.toFixed(1)} px/s fora × ${wa.toFixed(1)} px/s no passadiço (fator .72 → ~.86)`);
  assert.ok(wa / wb > 1.12 && wa / wb < 1.25, 'metade da lentidão da água rasa'); sb.PXW.depthVal = 0; sb.PXW.flood = 0;
  /* granada destrói tábuas */
  sb.explode(520, 800, 40, 150, 1); assert.ok(S.planks().filter(p => !p.dead).length < 7 && S.stats.plankBroken > 0, 'explosão quebra tábuas');
  assert.equal(S.stats.errors, 0);
}

/* ---------- 2. telefone: corte, reparo e pedidos de fogo ---------- */
{
  const sb = engine(), S = sb.PXLOGI, W0 = sb.PXWORKS;
  sb.PXBAT.batteries.push({ team: 0, cx: 172, cy: 472, crew: [{ alive: true }] });         // peça em (344, 944)
  const segs = lineSegs(sb, 'phone', 0, [[132, 840], [344, 944]]);
  assert.ok(segs.length >= 5, `QG→bateria em ${segs.length} trechos de ~40 px (◈${segs.length * 5})`);
  let N = S.net(0); assert.ok(N.hq, 'cadeia QG–bateria intacta: ligada'); assert.ok(S.phones().every(r => r.st === 'ok'), 'trechos em estado ok (lâmpada verde)');
  /* posto de observação (works.js) a 360 px da peça, sem linha */
  const opSeg = { kind: 'op', team: 0, x: 700, y: 840, stage: 0, work: 0, need: sb.K.op.need, p: {} }; sb.K.op.onStage(opSeg, 2);
  assert.equal(S.net(0).T.filter(q => q.k === 'op').length, 1, 'posto de observação vira terminal'); assert.ok(!S.state().phone[0].ops[0], 'posto isolado: sem linha');
  const calls = () => sb.missions.length;
  /* a) pedido do comando (carta do jogador) perto do posto: não atrasa, e o corretor do works.js (×0,6) continua valendo */
  sb.missions.length = 0; sb.place(900, 840); assert.ok(calls() === 1 && Math.abs(sb.missions[0].spread - 57) < .01, `carta do jogador: direta, dispersão 95→${sb.missions[0].spread} (×0,6 do posto)`);
  /* b) observador de classe com o posto também perto do alvo, sem linha → adia 12 s */
  sb.missions.length = 0; const obs = sb.u(0, 1000, 840, 'rifle', { cls: 'observer' });
  assert.equal(sb.PXBAT.mission(0, 1000, 800, 4, 70, 'he'), true); assert.equal(calls(), 0, 'sem linha: nada sai agora'); assert.equal(S.pending().length, 1);
  sb.run(11.5); assert.equal(calls(), 0, 'ainda esperando o corredor'); sb.run(.8);
  assert.ok(calls() === 1, 'saiu ao fim de 12 s'); approx(sb.missions[0].t, 12, .1, 'instante do tiro');
  console.log(`  sem linha: pedido de observador em t=0 sai em t=${sb.missions[0].t.toFixed(1)} s, dispersão 70 → ${sb.missions[0].spread.toFixed(1)} (observador não corrige aqui; posto ×0,6, linha ×1,2)`);
  approx(sb.missions[0].spread, 70 * 1.2 * .6, .01, 'dispersão do pedido atrasado: ×1,2 e posto ×0,6 (corretor do works.js composto)');
  assert.ok(sb.PXWORKS.stats.opCorrected >= 2, 'opCorrected do works.js seguiu contando');
  /* c) mesmo observador longe do posto e longe da linha → também espera; ligado ao QG→bateria por segmento perto → rápido */
  sb.missions.length = 0; obs.x = 1500; obs.y = 300; sb.PXBAT.mission(0, 1500, 300, 4, 70, 'he'); assert.equal(calls(), 0, 'observador longe de qualquer linha: espera');
  sb.run(12.2); assert.equal(calls(), 1);
  sb.missions.length = 0; obs.x = 250; obs.y = 880; sb.PXBAT.mission(0, 300, 880, 4, 70, 'he'); assert.equal(calls(), 1, 'observador a < 150 px de trecho ligado: pedido na hora'); approx(sb.missions[0].spread, 70 * .6, .01, 'com linha: só o corretor ×0,6 do posto (sem o ×1,2 da demora)');
  /* d) avião de reconhecimento: depende do QG–bateria */
  sb.units.length = 0; sb.plane = { team: 0 }; sb.missions.length = 0; sb.PXBAT.mission(0, 1600, 500, 3, 60, 'he'); assert.equal(calls(), 1, 'avião com QG ligado: direto');
  /* e) sem ninguém observando: intocado; fumaça: intocada */
  sb.plane = null; sb.missions.length = 0; sb.PXBAT.mission(0, 1700, 500, 3, 60, 'he'); sb.PXBAT.mission(0, 700, 840, 3, 60, 'smoke'); assert.ok(calls() === 2 && sb.missions[0].spread === 60 && sb.missions[1].spread === 60, 'sem observador e fumaça passam direto');
  /* corte */
  sb.toasts.length = 0; const mid = segs[2]; sb.explode(mid.x, mid.y, 50, 120, 1);
  const cuts = S.phones().filter(r => r.cut).length; assert.ok(cuts >= 1 && S.stats.cuts === cuts, `explosão cortou ${cuts} trecho(s)`);
  assert.ok(!S.net(0).hq, 'QG–bateria cortada: sem linha'); assert.ok(sb.toasts.some(t => /cortada/.test(t)), 'toast de linha cortada');
  sb.missions.length = 0; sb.plane = { team: 0 }; sb.PXBAT.mission(0, 1600, 500, 3, 60, 'he'); assert.equal(calls(), 0, 'cortada: o aviso do avião atrasa'); S.pending().length = 0;
  sb.explode(mid.x, mid.y, 30, 40, 1); /* explosão fraca (power<60) não corta nada de novo */
  /* reparo pela IA/jogador: ordem de projeto e emenda */
  sb.aiEnabled[0] = true; sb.projectCalls.length = 0; sb.supplies[0] = 999; const hadSandbox = sb.sandbox;
  assert.equal(S.repairs(0), true); const fix = sb.projectCalls.find(c => c.kind === 'phonefix'); assert.ok(fix, 'repair cria projeto phonefix no trecho cortado');
  const p = sb.PXSAP.projects.find(x => x.kind === 'phonefix'); const fs0 = p.segs[0]; sb.K.phonefix.onStage(fs0, 1);
  assert.equal(S.phones().filter(r => r.cut).length, cuts - 1, 'reparo religa um trecho'); S.recompute();
  for (const r of S.phones()) if (r.cut) sb.K.phonefix.onStage({ p: { fixRec: r }, stage: 1 }, 1);
  assert.ok(S.net(0).hq, 'tudo emendado: QG–bateria ligada de novo'); assert.ok(sb.toasts.some(t => /emendada/.test(t)));
  assert.equal(S.stats.errors, 0);
  console.log(`  linha: ${segs.length} trechos, cortes ${S.stats.cuts}, reparos ${S.stats.repairs}; pedidos: ${S.stats.fast} rápidos, ${S.stats.slow} adiados`);
}

/* ---------- 3. posto de observação da IA pede fogo sozinho (depende da linha) ---------- */
{
  const sb = engine(), S = sb.PXLOGI; sb.aiEnabled[0] = true;
  sb.PXBAT.batteries.push({ team: 0, cx: 172, cy: 472, crew: [{ alive: true }] });
  const opSeg = { kind: 'op', team: 0, x: 700, y: 944, stage: 0, work: 0, need: sb.K.op.need, p: {} }; sb.K.op.onStage(opSeg, 2);
  for (let i = 0; i < 4; i++) sb.u(1, 1050 + i * 12, 940 + i * 8);      // 4 inimigos juntos a 350 px
  sb.run(3); assert.equal(sb.missions.length, 0, 'posto isolado: o pedido ainda está a caminho (corredor)'); assert.equal(S.pending().length, 1);
  sb.run(11); assert.equal(sb.missions.length, 1, 'e sai depois de 12 s'); assert.equal(sb.missions[0].kind, 'he');
  console.log(`  posto da IA sem linha: pediu fogo em t≈1 e a salva saiu em t=${sb.missions[0].t.toFixed(1)} s (dispersão ${sb.missions[0].spread.toFixed(1)})`);
  /* com linha: sai na hora e respeita o intervalo de 40 s */
  const sb2 = engine(), S2 = sb2.PXLOGI; sb2.aiEnabled[0] = true; sb2.PXBAT.batteries.push({ team: 0, cx: 172, cy: 472, crew: [{ alive: true }] });
  const o2 = { kind: 'op', team: 0, x: 700, y: 944, stage: 0, work: 0, need: sb2.K.op.need, p: {} }; sb2.K.op.onStage(o2, 2); lineSegs(sb2, 'phone', 0, [[344, 944], [700, 944]]);
  for (let i = 0; i < 4; i++) sb2.u(1, 1050 + i * 12, 940 + i * 8);
  sb2.run(2); assert.equal(sb2.missions.length, 1, 'com linha: pedido imediato'); assert.ok(sb2.missions[0].t < 2); approx(sb2.missions[0].spread, 65 * .6, .01, 'corretor do posto composto');
  sb2.run(30); assert.equal(sb2.missions.length, 1, 'intervalo de 40 s entre pedidos do mesmo posto'); sb2.run(12); assert.equal(sb2.missions.length, 2);
  assert.equal(S2.stats.errors + S.stats.errors, 0);
}

/* ---------- 4. cozinha ---------- */
{
  const sb = engine(), S = sb.PXLOGI; const s = { kind: 'kitchen', team: 0, x: 500, y: 800, stage: 0, work: 0, need: sb.K.kitchen.need, p: {} }; sb.K.kitchen.onStage(s, 2);
  const near = sb.u(0, 540, 800, 'rifle', { cohesion: .3, suppression: 1.6 }), far = sb.u(0, 700, 800, 'rifle', { cohesion: .3, suppression: 1.6 }), foe = sb.u(1, 520, 800, 'rifle', { cohesion: .3, suppression: 1.6 });
  const lw = sb.u(0, 520, 830, 'rifle', { down: true, hp: 30, bleed: 60, cz: { sev: 'light', st: 'down' } }), sv = sb.u(0, 480, 830, 'rifle', { down: true, hp: 30, bleed: 60, cz: { sev: 'serious', st: 'down' } });
  sb.player = near; sb.mode = 'soldier';
  // o jogo recompõe cohesion/supressão por conta própria (decai .18/s); aqui o motor não, então a diferença é só da cozinha
  sb.run(10);
  const dsup = 1.6 - near.suppression, dcoh = near.cohesion - .3;
  console.log(`  cozinha, 10 s a 40 px: coesão +${dcoh.toFixed(2)} (base do jogo: +0,26/10 s), supressão −${dsup.toFixed(2)} (base do jogo: −1,8/10 s); fôlego do jogador 40→${sb.PXGEAR.st.s.toFixed(0)}; distante ${far.cohesion.toFixed(2)}/${far.suppression.toFixed(2)}`);
  approx(dcoh, .2, .015, 'coesão extra de 0,02/s'); approx(dsup, 1.2, .08, 'supressão extra de 0,12/s (passos de 0,5 s)'); assert.equal(far.cohesion, .3); assert.equal(far.suppression, 1.6); assert.equal(foe.cohesion, .3, 'inimigo não come');
  approx(sb.PXGEAR.st.s, 80, 3, 'fôlego +4/s'); sb.PXGEAR.st.s = 98; sb.run(2); assert.equal(sb.PXGEAR.st.s, 100, 'fôlego não passa de MAX');
  assert.ok(lw.down && lw.bleed > 60 + 5 && lw.bleed < 60 + 7, `ferido leve sangra à metade: prazo +${(lw.bleed - 60).toFixed(1)} s em 12 s`); sb.run(14);
  assert.ok(!lw.down && lw.hp >= 40 && lw.order === 'hold', 'ferido leve volta à luta em ~25 s com ≥40% da vida'); assert.ok(sv.down, 'ferido grave não é curado pela cozinha');
  assert.equal(S.stats.healed, 1);
  /* limite de atendidos por vez */
  for (let i = 0; i < 30; i++) sb.u(0, 500 + (i % 5) * 6, 780 + Math.floor(i / 5) * 4, 'rifle', { cohesion: .3 });
  sb.run(5); const fed = sb.units.filter(u => u.team === 0 && u.hp > 0 && !u.down && u.cohesion > .3 && u !== near).length; assert.ok(fed <= 16, `no máximo 16 atendidos por vez (${fed})`);
  /* destruição */
  sb.explode(500, 800, 90, 200, 1); assert.ok(!s.wreck, 'um tiro de 200 não basta (260 de vida)'); sb.explode(500, 800, 90, 200, 1); assert.ok(s.wreck, 'dois tiros destroem a cozinha');
  const c0 = near.cohesion; sb.units.forEach(u => { if (u.team === 0) u.cohesion = .3; }); sb.run(2); assert.equal(near.cohesion, .3, 'cozinha destruída não ajuda mais');
  assert.equal(S.stats.errors, 0);
}

/* ---------- 5. posto de franco-atirador ---------- */
{
  const sb = engine(), S = sb.PXLOGI; const s = { kind: 'sniper', team: 0, x: 600, y: 800, stage: 0, work: 0, need: sb.K.sniper.need, p: {} }; sb.K.sniper.onStage(s, 2);
  const m1 = sb.u(0, 760, 820, 'rifle', { cls: 'marksman' }), busy = sb.u(0, 650, 800, 'rifle', { cls: 'marksman', order: 'move', tx: 900, ty: 800, target: {} }), plain = sb.u(0, 620, 800, 'rifle');
  sb.run(2.7);
  assert.ok(S.snipers()[0].res != null, 'a IA reservou um atirador'); assert.equal(S.snipers()[0].res, m1.id, 'o ocioso, não o que está ocupado nem o fuzileiro comum'); assert.equal(plain.lgPost, undefined);
  sb.run(8); assert.ok(Math.hypot(m1.x - 600, m1.y - 800) <= 6 && S.snipers()[0].occ === m1, 'chegou ao posto e ocupa'); assert.ok(m1.manualUntil > sb.time, 'AI geral não o tira de lá');
  /* dano: −55% enquanto dentro */
  const hp0 = m1.hp; sb.damage(m1, 40, 1); approx(hp0 - m1.hp, 18, .01, 'dano de 40 → 18 dentro do posto'); const hp1 = busy.hp; sb.damage(busy, 40, 1); assert.equal(hp1 - busy.hp, 40, 'fora do posto: dano cheio');
  /* alcance: inimigo a 420 px (> 350 do atirador, < 455 do posto) */
  const foe = sb.u(1, 1020, 800, 'rifle'); busy.hp = 0; m1.cd = 0; sb.shots.length = 0; sb.bullets.length = 0; sb.run(1);
  assert.ok(sb.shots.length >= 1 && sb.shots[0] > 400, `atirou em alvo a ${sb.shots[0] | 0} px (alcance normal 350)`);
  const b = sb.bullets.find(x => x.xlong); assert.ok(b && b.t >= 455 / 800 - 1e-6, `projétil vive ${(b.t * 800) | 0} px (≥455)`);
  console.log(`  atirador no posto: alvo a ${sb.shots[0] | 0} px (fora do alcance de 350 sem posto), projétil com ${(b.t * 800) | 0} px de voo, dano 40→18`);
  /* sem posto: não atira além de 350 */
  const sb2 = engine(); const m2 = sb2.u(0, 600, 800, 'rifle', { cls: 'marksman' }); sb2.u(1, 1020, 800, 'rifle'); sb2.run(1); assert.equal(sb2.shots.length, 0, 'sem posto, o motor deste teste não atira além de 350');
  /* não guarnece na trégua */
  const sb3 = engine(); sb3.prep = true; const s3 = { kind: 'sniper', team: 0, x: 600, y: 800, stage: 0, work: 0, need: sb3.K.sniper.need, p: {} }; sb3.K.sniper.onStage(s3, 2); sb3.u(0, 700, 800, 'rifle', { cls: 'marksman' }); sb3.run(3); assert.equal(sb3.PXLOGI.snipers()[0].res, null, 'trégua: ninguém é puxado para o posto');
  /* destruição */
  sb.explode(600, 800, 80, 600, 1); assert.ok(s.wreck, 'posto destruído'); sb.run(1.2); assert.equal(m1._lgIn, null, 'atirador perde a blindagem'); sb.damage(m1, 40, 1);
  assert.equal(S.stats.errors, 0);
}

/* ---------- 6. IA em guerra: linhas, passadiço, cozinha, posto — só com caixa acima da reserva ---------- */
{
  const sb = engine('', { sandbox: false }), S = sb.PXLOGI; sb.aiEnabled[0] = true; sb.supplies[0] = 900; sb.time = 100;
  sb.PXBAT.batteries.push({ team: 0, cx: 172, cy: 472, crew: [{ alive: true }] });
  for (let i = 0; i < 4; i++) sb.u(0, 300 + i * 10, 800, 'rifle', { sap: 1 });
  sb.aiPlan = S.aiPlan; sb.projectCalls.length = 0; S.aiPlan(0);
  let c = sb.projectCalls[0]; assert.ok(c && c.kind === 'phone' && c.pts[0][0] === 132 && c.pts[0][1] === 840, 'IA liga o QG à bateria primeiro'); assert.equal(sb.supplies[0], 900 - c.n * 5, 'cobra ◈5 por trecho');
  const p1 = sb.PXSAP.projects[0]; assert.equal(p1.keep, true, 'obra com keep: ninguém a cancela por ociosidade');
  sb.projectCalls.length = 0; S.aiPlan(0); assert.equal(sb.projectCalls.length, 0, 'uma obra de logística por vez');
  p1.done = true; lineSegs(sb, 'phone', 0, [[132, 840], [344, 944]]);       // a obra termina: a linha QG–bateria passa a existir
  /* chuva e lama: passadiço no eixo de uma estrada, a partir da retaguarda */
  sb.projectCalls.length = 0; S.aiPlan(0); assert.equal(sb.projectCalls.length, 0, 'tempo seco, linha pronta: nada a construir ainda (cozinha/posto esperam tropa estressada/atirador)');
  sb.PXW.state.I = .7; S.aiPlan(0); c = sb.projectCalls.find(x => x.kind === 'plank');
  assert.ok(c, 'chovendo: a IA estende o passadiço'); assert.ok([370, 800, 1220].includes(c.pts[0][1]), 'ao longo de uma das estradas (y=' + c.pts[0][1] + ')'); assert.equal(c.pts[0][0], 340, 'a partir de x=340 (retaguarda)'); console.log(`  IA, chuva: passadiço em y=${c.pts[0][1]} de x=${c.pts[0][0]} a ${c.pts[1][0]} (${c.n} trechos, ◈${c.n * 8})`);
  sb.PXSAP.projects.forEach(p => p.done = true);
  /* reserva: sem caixa acima da reserva de obras, nada */
  sb.PXW.state.I = 0; sb.supplies[0] = 230; sb.projectCalls.length = 0; sb.units.filter(u => u.team === 0 && !u.sap).forEach(u => u.hp = 0);
  for (let i = 0; i < 6; i++) sb.u(0, 400 + i * 4, 800, 'rifle', { suppression: 1.4 }); S.aiPlan(0); assert.equal(sb.projectCalls.length, 0, '◈230 < ◈70 + reserva 200: guarda o dinheiro');
  sb.supplies[0] = 900; S.aiPlan(0); c = sb.projectCalls[0]; assert.ok(c && c.kind === 'kitchen', 'com caixa e tropa estressada: cozinha'); assert.ok(c.pts[0][0] === 430, 'longe da frente (x=430)'); assert.equal(sb.supplies[0], 830);
  sb.PXSAP.projects.forEach(p => p.done = true); sb.projectCalls.length = 0;
  sb.K.kitchen.onStage({ kind: 'kitchen', team: 0, x: 430, y: 800, stage: 0, work: 0, need: sb.K.kitchen.need, p: {} }, 2); sb.units.forEach(u => { u.suppression = 0; });
  sb.u(0, 700, 800, 'rifle', { cls: 'marksman' }); sb.anchors.push({ x: 720, y: 790, team: 0, line: 'front' }); sb.anchors.push({ x: 720, y: 850, team: 0, line: 'front' }); sb.fieldTrenches.forEach(a => a.line = 'front');
  S.aiPlan(0); c = sb.projectCalls[0]; assert.ok(c && c.kind === 'sniper', 'atirador ocioso e frente construída: posto de franco-atirador'); assert.ok(c.pts[0][0] < 720 && c.pts[0][0] > 680, 'logo atrás da trincheira');
  assert.equal(S.stats.errors, 0);
}

/* ---------- 6b. reparo barato não espera a reserva; jogador também tem engenheiros de campo que emendam; sem bateria não há o que cobrar ---------- */
{
  const sb = engine('', { sandbox: false }), S = sb.PXLOGI; sb.supplies[0] = 100; sb.time = 100;
  sb.PXBAT.batteries.push({ team: 0, cx: 172, cy: 472, crew: [{ alive: true }] });
  const segs = lineSegs(sb, 'phone', 0, [[132, 840], [344, 944]]); for (let i = 0; i < 4; i++) sb.u(0, 300 + i * 10, 800, 'rifle', { sap: 1 });
  S.cutRec(S.phones()[2], true); sb.projectCalls.length = 0;
  sb.aiEnabled[0] = false; sb.run(22);
  const fix = sb.projectCalls.find(c => c.kind === 'phonefix'); assert.ok(fix, 'time do jogador (IA desligada) manda emendar o fio cortado'); assert.equal(sb.supplies[0], 98, '◈2 mesmo com caixa (100) abaixo da reserva (200)');
  {/* teto de obras vivas da engenharia (min(4, engenheiros de campo/3)): a logística não toma a vaga de quem constrói trincheira */
   const sb3 = engine('', { sandbox: false }), S3 = sb3.PXLOGI; sb3.aiEnabled[0] = true; sb3.supplies[0] = 900; sb3.time = 100; sb3.PXBAT.batteries.push({ team: 0, cx: 172, cy: 472, crew: [{ alive: true }] });
   for (let i = 0; i < 4; i++) sb3.u(0, 300 + i * 10, 800, 'rifle', { sap: 1 }); const foreign = { team: 0, kind: 'trench', src: 'fort', segs: [], crew: [], done: false }; sb3.PXSAP.projects.push(foreign);
   S3.aiPlan(0); assert.equal(sb3.projectCalls.length, 0, '1 vaga (4 engenheiros de campo) ocupada por uma trincheira: a IA não abre obra de linha'); foreign.done = true; S3.aiPlan(0); assert.equal(sb3.projectCalls[0].kind, 'phone', 'vaga livre: abre a linha');}
  const sb2 = engine(); sb2.u(0, 1000, 840, 'rifle', { cls: 'observer' });                  // nenhum canhão do lado: o battery.js decide, nada de adiar
  sb2.PXBAT.mission(0, 1000, 800, 4, 70, 'he'); assert.equal(sb2.missions.length, 1, 'sem bateria operacional: passa direto'); assert.equal(sb2.PXLOGI.pending().length, 0);
  assert.equal(S.stats.errors + sb2.PXLOGI.stats.errors, 0);
}

/* ---------- 7. custo de CPU ---------- */
{
  const run = (wet) => {
    const sb = engine(); const S = sb.PXLOGI; sb.PXW.mudGrid.fill(wet ? .6 : 0); sb.PXW.state.I = wet ? .5 : 0; sb.PXW.state.mud = wet ? .6 : 0; sb.PXW.flood = wet ? .1 : 0;
    for (const y of [370, 800, 1220]) lineSegs(sb, 'plank', 0, [[340, y], [1000, y]]);          // ~60 trechos
    sb.PXBAT.batteries.push({ team: 0, cx: 172, cy: 472, crew: [{ alive: true }] }, { team: 0, cx: 150, cy: 716, crew: [{ alive: true }] });
    for (const [a, b] of [[[132, 840], [344, 944]], [[700, 800], [344, 944]], [[700, 800], [1100, 900]]]) lineSegs(sb, 'phone', 0, [a, b]);
    for (let i = 0; i < 80; i++) { sb.u(0, 350 + (i * 9) % 600, 360 + (i * 37) % 900, i % 9 === 0 ? 'tank' : 'rifle', { order: 'move', tx: 1500, ty: 800 }); sb.u(1, 2000 - (i * 9) % 600, 360 + (i * 41) % 900, 'rifle'); }
    sb.units.slice(0, 6).forEach((u, i) => { if (i < 4) u.cls = i < 2 ? 'marksman' : 'observer'; });
    sb.K.kitchen.onStage({ kind: 'kitchen', team: 0, x: 430, y: 800, stage: 0, work: 0, need: sb.K.kitchen.need, p: {} }, 2); sb.K.sniper.onStage({ kind: 'sniper', team: 0, x: 600, y: 800, stage: 0, work: 0, need: sb.K.sniper.need, p: {} }, 2);
    const planks = S.planks().length, phs = S.phones().length; sb.run(5); S.perf.n = 0; S.perf.sum = 0; S.perf.max = 0;
    for (let i = 0; i < 3000; i++) sb.update(1 / 30);
    const st = S.state(); console.log(`  CPU ${wet ? 'com chuva/lama/enchente' : 'tempo seco'}, ${planks} trechos de passadiço, ${phs} de telefone, ${sb.units.length} unidades: ${st.perf.avgMs} ms/update (máx ${st.perf.maxMs} ms) — só o módulo, fora o jogo`);
    assert.ok(st.perf.avgMs < 10, 'custo médio desprezível (no vm cada acesso a global é ~10x mais caro que no navegador)'); assert.equal(S.stats.errors, 0); return st.perf.avgMs;
  };
  run(false); run(true);
}
console.log('Logística 1.9.3: passadiço, telefone (corte, reparo, pedido adiado), cozinha e posto de franco-atirador OK');
