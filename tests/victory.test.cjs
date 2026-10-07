const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const B = require('../dist/base-objectives.js');

// victory.js: superioridade militar (5 frentes), QG capturado com contagem, exército incapacitado, território mínimo,
// armistício por impasse e o sandbox deixando de ser infinito.
function make({ sandbox = true } = {}) {
  const sb = {
    console, Math, Array, Object, Map, Set, JSON, String, Number, Infinity, URLSearchParams,
    W: 2400, H: 1600, time: 100, started: true, ended: false, playerTeam: 0, sandbox, units: [], buildings: [],
    points: B.create(2400, 1600), supplies: [600, 600], tickets: [500, 500], teamKills: [0, 0], location: { search: '' },
    toasts: [], finished: [], toast(s) { sb.toasts.push(s); },
    setup() { sb.time = 0; sb.ended = false; }, update(dt) { sb.time += dt; }, hud() {},
    finish(win) { sb.ended = true; sb.finished.push(win); },
    document: { createElement: () => ({ style: {}, setAttribute() {}, append() {} }), head: { append() {} }, body: { append() {} }, getElementById: () => null },
  };
  sb.window = sb; sb.IronFrontBases = Object.assign({}, B);
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/victory.js'), 'utf8'), sb);
  return sb;
}
let id = 0;
const add = (sb, team, n, x, y, extra = {}) => { for (let i = 0; i < n; i++) sb.units.push({ id: ++id, team, type: 'rifle', x: x + (i % 8) * 6, y: y + Math.floor(i / 8) * 6, hp: 100, maxhp: 100, cohesion: 1, suppression: 0, ...extra }); };
const run = (sb, secs, dt = .5) => { for (let t = 0; t < secs && !sb.ended; t += dt) sb.update(dt); };

// 1) simetria: exércitos iguais => 50 % × 50 %, nenhum "placar" arbitrário
let sb = make(); add(sb, 0, 40, 500, 800); add(sb, 1, 40, 1900, 800);
run(sb, 10); let st = sb.PXWIN.state();
assert.ok(Math.abs(st.superiority[0] - 50) < 1 && Math.abs(st.superiority[1] - 50) < 1, 'forças iguais ⇒ equilíbrio: ' + st.superiority);
assert.equal(st.labels.join(), 'EQUILIBRADO,EQUILIBRADO');
assert.equal(sb.IronFrontBases.winner(sb.points), null, 'o fim imediato por duas bandeiras passa para o módulo');

// 2) superioridade sobe com força: 3×1 vira DOMINANTE/VANTAGEM e a soma é 100
sb = make(); add(sb, 0, 60, 500, 800); add(sb, 1, 20, 1900, 800); run(sb, 10); st = sb.PXWIN.state();
assert.ok(st.superiority[0] > 56 && Math.abs(st.superiority[0] + st.superiority[1] - 100) < .01, 'soma 100: ' + st.superiority);
assert.ok(['VANTAGEM', 'DOMINANTE'].includes(st.labels[0]) && ['SOB PRESSÃO', 'EM COLAPSO'].includes(st.labels[1]), st.labels.join());

// 3) QG capturado: condição crítica de 75 s; se a bandeira volta, a crise some
sb = make(); add(sb, 0, 30, 500, 800); add(sb, 1, 30, 1900, 800); run(sb, 5);
sb.points[0].owner = 1; sb.points[0].progress = 100; run(sb, 10);
st = sb.PXWIN.state(); assert.ok(st.crisis[0] > 55 && st.crisis[0] <= 66 && st.crisis[1] === null, 'contagem do QG: ' + st.crisis);
assert.ok(sb.toasts.some(t => /QG foi tomado/.test(t)), 'aviso ao jogador');
sb.points[0].owner = 0; sb.points[0].progress = -100; run(sb, 1); assert.equal(sb.PXWIN.state().crisis[0], null, 'bandeira retomada encerra a crise'); assert.equal(sb.ended, false);
sb.points[0].owner = 1; sb.points[0].progress = 100; run(sb, 80);
assert.equal(sb.ended, true, 'sandbox também termina quando o QG não é retomado'); assert.equal(sb.finished.join(), 'false', 'o jogador (EUA) perdeu');
assert.equal(sb.PXWIN.state().result.why, 'hq'); assert.equal(sb.PXWIN.state().result.winner, 1);

// 4) exército incapacitado: perde quase tudo depois de ter tido força e não consegue reagir
sb = make(); add(sb, 0, 60, 500, 800); add(sb, 1, 60, 1900, 800); run(sb, 30);
for (const u of sb.units) if (u.team === 0) u.hp = 0; sb.units = sb.units.filter(u => u.hp > 0); add(sb, 0, 2, 500, 800);
run(sb, 120); assert.ok(sb.ended && sb.PXWIN.state().result.loser === 0, 'colapso: ' + JSON.stringify(sb.PXWIN.state().result));
assert.ok(['army', 'capacity', 'territory'].includes(sb.PXWIN.state().result.why));

// 5) vitória do jogador é reportada como win=true (alemães colapsam)
sb = make(); add(sb, 0, 60, 500, 800); add(sb, 1, 60, 1900, 800); run(sb, 30);
for (const u of sb.units) if (u.team === 1) u.hp = 0; sb.units = sb.units.filter(u => u.hp > 0); add(sb, 1, 2, 1900, 800);
run(sb, 120); assert.equal(sb.finished.join(), 'true'); assert.equal(sb.PXWIN.state().result.winner, 0);

// 6) o território muda de dono com presença: dominar a faixa central a vira
sb = make(); add(sb, 0, 30, 1250, 800); add(sb, 0, 20, 500, 800); add(sb, 1, 50, 2000, 800); run(sb, 80); st = sb.PXWIN.state();
assert.ok(st.sectors[3] < 0, 'faixa 3 (antes alemã) passou aos EUA: ' + st.sectors); assert.ok(st.parts[0].terr > .5, 'território aliado ' + st.parts[0].terr);

// 7) impasse: tempo esgotado decide por superioridade; empate se a diferença é pequena
sb = make(); sb.PXWIN.cfg.timeLimit = 60; add(sb, 0, 40, 500, 800); add(sb, 1, 40, 1900, 800); run(sb, 70);
assert.ok(sb.ended && sb.PXWIN.state().result.loser === null && sb.PXWIN.state().result.why === 'stalemate', 'empate técnico em impasse');
sb = make(); sb.PXWIN.cfg.timeLimit = 60; add(sb, 0, 40, 500, 800); add(sb, 1, 52, 1900, 800); run(sb, 70);
assert.ok(sb.ended && sb.PXWIN.state().result.loser === 0 && sb.PXWIN.state().result.why === 'stalemate', 'a maior superioridade vence no armistício');

// 8) desligado por PXWIN.on=false: nada acaba (sandbox infinito para ferramentas de medição)
sb = make(); sb.PXWIN.on = false; add(sb, 0, 60, 500, 800); sb.points[0].owner = 1; run(sb, 200); assert.equal(sb.ended, false);
// 9) trégua: nada termina enquanto a preparação vale
sb = make(); sb.PXFORT = { isPrep: () => true }; add(sb, 0, 30, 500, 800); sb.points[0].owner = 1; run(sb, 200); assert.equal(sb.ended, false, 'sem fim durante a trégua');
console.log('Victory: 5 frentes somam 100 %, QG com contagem, colapso por exército, território, armistício e sandbox encerrável OK');
