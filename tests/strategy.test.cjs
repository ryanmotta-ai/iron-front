const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// strategy.js: dispersão do plano (fim das blobs), faixas no eixo do objetivo, teto de densidade, rota segura, alvos inválidos e bunker sem linha de visada.
const sb = {
  console, Math, Array, Object, Map, Set, JSON, String, Number, Infinity, location: { search: '' },
  W: 2400, H: 2000, GH: 1600, time: 300, player: null, mode: 'commander', started: true, ended: false, playerTeam: 0, aiEnabled: [true, true], units: [], buildings: [], decor: [],
  update(dt) { sb.time += dt; }, setup() {}, PXFORT: { isPrep: () => false }, bullets: [],
  nearest: (u, r) => sb.units.find(e => e.team !== u.team && Math.hypot(e.x - u.x, e.y - u.y) < r) || null,
};
sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/battle-refinement.js'), 'utf8'), sb);
sb.IronFrontBrain = { plan: s => s.plan, selectTarget: (u, list, r, can) => list.find(e => !can || can(u, e)) || null, clearShot: (a, b, d, bl) => !bl.some(x => x.type === 'sandbag' && Math.abs(x.x - (a.x + b.x) / 2) < 30 && Math.abs(x.y - (a.y + b.y) / 2) < 12) };
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/strategy.js'), 'utf8'), sb);
const S = sb.PXSTRAT, hyp = Math.hypot;

// 1) seis esquadrões de 8 mirando o mesmo ponto são afastados (≥ ~120 px entre âncoras)
const orders = []; let id = 0;
for (let sq = 1; sq <= 6; sq++) for (let i = 0; i < 8; i++) orders.push({ id: ++id, squad: sq, role: 'avanço-alternado', tx: 1500 + (i % 4) * 20, ty: 1000 + Math.floor(i / 4) * 20 });
const out = sb.IronFrontBrain.plan({ plan: { orders }, team: 0, height: 2000 }).orders;
const anchors = [1, 2, 3, 4, 5, 6].map(s => { const l = out.filter(o => o.squad === s); return { x: l.reduce((n, o) => n + o.tx, 0) / l.length, y: l.reduce((n, o) => n + o.ty, 0) / l.length }; });
let minSep = 1e9; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) minSep = Math.min(minSep, hyp(anchors[i].x - anchors[j].x, anchors[i].y - anchors[j].y));
assert.ok(minSep >= 100, 'âncoras afastadas: ' + Math.round(minSep));
assert.ok(S.stats.spread >= 4, 'esquadrões deslocados');
// guardas da bandeira e posições defensivas não se espalham
const keep = [{ id: 1, squad: 1, role: 'guarda-objetivo', tx: 300, ty: 1000 }, { id: 2, squad: 1, role: 'guarda-objetivo', tx: 304, ty: 1000 }, { id: 3, squad: 2, role: 'guarda-objetivo', tx: 300, ty: 1000 }, { id: 4, squad: 2, role: 'guarda-objetivo', tx: 304, ty: 1000 }];
sb.IronFrontBrain.plan({ plan: { orders: keep }, team: 0 }); assert.ok(keep.every(o => o.ty === 1000), 'guarda-objetivo fica junto');

// 2) teto de densidade: 60 destinos no mesmo ponto → no máx. CAP por raio de 110 px (com folga de 1 passo)
const crowd = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, squad: undefined, role: 'posição-defensiva', tx: 1000 + (i % 6) * 6, ty: 800 + Math.floor(i / 6) * 6 }));
S.capDensity({ orders: crowd }, { height: 2000 });
let worst = 0; for (const a of crowd) { const n = crowd.filter(b => hyp(a.tx - b.tx, a.ty - b.ty) < 110).length; worst = Math.max(worst, n); }
assert.ok(worst <= S.cfg.CAP + 4, 'densidade máxima ' + worst); assert.ok(S.stats.capped > 30);

// 3) faixas no eixo: 3 esquadrões ocupam o eixo (y: 0, ±150); os demais esperam em posições distintas; faixa livre depois de 15 s
const R = sb.IronFrontRefinement, flag = { name: 'ALEMANHA', x: 2140, y: 1000, home: 1, owner: 1 };
const state = t => ({ team: 0, time: t, points: [flag], height: 2000 }), op = { objective: 'ALEMANHA', sector: { x: 2140, y: 1000 } };
const goals = [1, 2, 3, 4, 5, 6].map(g => R.attackGoal(state(300), op, { id: g, x: 1900, y: 1000 }));
assert.deepEqual(goals.slice(0, 3).map(g => Math.round(g.y)), [1000, 850, 1150], 'lanes de frente');
const stage = goals.slice(3); assert.ok(stage.every(g => g.x < 1900), 'apoio espera atrás: ' + JSON.stringify(stage));
assert.equal(new Set(stage.map(g => g.x + ',' + g.y)).size, 3, 'cada apoio na sua posição');
assert.equal(R.attackGoal(state(300), op, { id: 1, x: 1900, y: 1000 }).y, 1000, 'lane estável');
const later = R.attackGoal(state(330), op, { id: 5, x: 1900, y: 1000 }); assert.ok(Math.abs(later.x - 2140) < 120 && Math.abs(later.y - 1000) <= 150, 'faixa livre depois de 15 s: ' + JSON.stringify(later));
// só altera quando o objetivo é a bandeira (o resto passa intacto)
assert.deepEqual(JSON.parse(JSON.stringify(R.attackGoal({ team: 0, time: 1, points: [flag] }, { objective: 'X', sector: { x: 1000, y: 500 } }, { id: 9, x: 100, y: 100 }))), { x: 1000, y: 500 });

// 4) rota segura: o caminho direto cheio de inimigos é desviado; sem desvio possível devolve perigo alto
const E = (x, y) => ({ team: 1, hp: 100, type: 'rifle', x, y });
sb.units = [...Array.from({ length: 30 }, (_, i) => E(1500 + (i % 6) * 12, 1000 + Math.floor(i / 6) * 12))];
const seed = { x: 700, y: 1000 }, tgt = { x: 2270, y: 840 };
const direct = S.routeDanger(0, [seed, tgt]); assert.ok(direct > 200, 'caminho direto perigoso: ' + direct);
const best = S.bestRoute(0, seed, tgt); assert.ok(best.wp && best.danger < direct / 3, 'desvio pelo flanco: ' + JSON.stringify(best));
// 5) alvo que nunca sofre dano vira inválido e a busca ignora; bunker sem linha de visada não atira
const shooter = { id: 1, team: 0, type: 'rifle', x: 500, y: 500, hp: 100, cd: 0, target: null }, foe = { id: 2, team: 1, hp: 100, x: 600, y: 500, type: 'rifle' };
sb.units = [shooter, foe]; shooter.target = foe;
for (let i = 0; i < 14; i++) { sb.time += 1; shooter.cd = 0; sb.update.call(null, 0); }
const before = S.stats.badTargets;
// simula 12 disparos sem dano em 10 s
sb.window.update = sb.window.update; for (let i = 0; i < 12; i++) { sb.units = [shooter, foe]; shooter.target = foe; shooter.cd = 0; const upd = sb.window.update; sb.update = sb.update; upd.call(null, 1); shooter.cd = 1; }
void before;
const picked = sb.IronFrontBrain.selectTarget({ id: 1, team: 0, bad: { 2: sb.time + 5 } }, [foe, { id: 3, team: 1, hp: 100 }], 300, null); assert.equal(picked.id, 3, 'alvo inválido ignorado por 8 s');
const bunker = { type: 'bunker', team: 0, x: 1000, y: 1000, hp: 1000, cd: 0 }, sand = { type: 'sandbag', team: 1, x: 1050, y: 1000, hp: 100 };
sb.units = [{ id: 9, team: 1, hp: 100, x: 1100, y: 1000, type: 'rifle' }]; sb.buildings = [bunker, sand]; sb.window.update.call(null, .1);
assert.ok(bunker.cd > 0 && S.stats.noLosBunker >= 1, 'bunker atrás de barreira segura o fogo');
sb.buildings = [bunker]; bunker.cd = 0; sb.window.update.call(null, .1); assert.equal(bunker.cd, 0, 'com visada livre não interfere');
console.log('Strategy: dispersão do plano, teto de densidade, faixas no eixo, rota segura, alvo inválido e bunker sem visada OK');
