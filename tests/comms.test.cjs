const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// comms.js: enlace do centro de comunicações (atraso, autonomia), relatos raros e com filtro, propostas do oficial e execução pela cadeia de comando.
const el = () => { const e = { style: {}, children: [], parent: null, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, append(...c) { for (const x of c) { if (x && typeof x === 'object') x.parent = e; e.children.push(x); } }, replaceChildren(...c) { e.children = c; }, remove() { if (e.parent) e.parent.children = e.parent.children.filter(x => x !== e); }, appendChild(c) { e.append(c); }, get firstChild() { return e.children[0]; }, get lastChild() { return e.children[e.children.length - 1]; }, querySelector: () => null, innerHTML: '', textContent: '' }; return e; };
const comms = { destroyed: false, eff: 1 };
const struct = {
  list: [{ team: 0, kind: 'hq', x: 132, y: 840 }, Object.defineProperties({ team: 0, kind: 'comms', x: 140, y: 748 }, { destroyed: { get: () => comms.destroyed }, eff: { get: () => comms.eff } }),
    { id: 7, team: 1, kind: 'gun', name: 'Posição de artilharia', x: 1500, y: 900, value: 90, known: [true, true], destroyed: false, mat: 'steel', hp: 520, max: 520, ref: {} }],
  gridRef: (x, y) => String.fromCharCode(65 + Math.floor(x / 200)) + (Math.floor(y / 250) + 1), known: (e, t) => !!e.known[t], listen(f) { struct.f = f; }, ge: (e, m, f) => (e.kind === 'gun' ? f : m), estimate: () => 60,
};
const assaults = [];
const sb = {
  console, Math, Array, Object, Map, Set, JSON, String, Number, Infinity, setTimeout: () => 0, location: { search: '' },
  time: 100, started: true, ended: false, playerTeam: 0, mode: 'commander', aiEnabled: [false, true], buildings: [], toasts: [], cam: { x: 0, y: 0 },
  units: [], toast(s) { sb.toasts.push(s); }, setup() {}, update(dt) { sb.time += dt; }, setMode() {},
  document: { createElement: () => el(), createTextNode: t => ({ t }), head: { append() {} }, body: { append() {} }, getElementById: () => null, querySelector: () => null },
  PXFORT: { isPrep: () => false }, PXSTRUCT: struct, PXORD: { free: t => sb.units.filter(u => u.team === t && !u.gid), assault(us, ent, o) { assaults.push({ n: us.length, ent, o }); return { id: 1 }; } },
  PXSTRAT: { bestRoute: () => ({ danger: 0, wp: null }) }, IFK: { shout(u, t) { sb.shouts.push(t); return true; } }, shouts: [],
};
sb.window = sb; vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/comms.js'), 'utf8'), sb);
const C = sb.PXCOMM;
for (let i = 0; i < 40; i++) sb.units.push({ id: i + 1, team: 0, type: 'rifle', x: 900 + i * 4, y: 900, hp: 100, maxhp: 100 });
for (let i = 0; i < 12; i++) sb.units.push({ id: 100 + i, team: 1, type: 'rifle', x: 1500 + i * 5, y: 900, hp: 100, maxhp: 100 });

// enlace: centro inteiro = atraso curto; danificado = maior; destruído = mensageiro 14 s e autonomia
const d1 = C.delay(0, 1400, 900); assert.ok(d1 > .25 && d1 < 1.6, 'atraso com centro inteiro: ' + d1);
comms.eff = .6; const d2 = C.delay(0, 1400, 900); assert.ok(d2 > d1 * 1.4, 'danificado: ' + d2); assert.equal(C.autonomous(0), false);
comms.eff = .3; assert.equal(C.autonomous(0), true, 'q<0.5 ⇒ unidades mais autônomas');
comms.destroyed = true; assert.equal(C.delay(0, 1400, 900), 14); assert.equal(C.link(0).destroyed, true);
let ran = 0; C.send(0, 1400, 900, 'ordem', () => ran++); assert.equal(ran, 0, 'ordem em trânsito'); assert.ok(sb.toasts.some(t => /mensageiro/.test(t)));
for (let i = 0; i < 20; i++) sb.update(1); assert.equal(ran, 1, 'chega depois do atraso');
comms.destroyed = false; comms.eff = 1;
let r0 = 0; C.send(0, 300, 840, 'ordem', () => r0++); assert.equal(r0, 1, 'perto do QG e enlace bom: imediato');

// relatos: intervalo global, repetição por tipo e só para a equipe do jogador
const u = sb.units[0]; sb.time = 500;
assert.equal(C.report(0, u, 'stuck', 'General, não conseguimos avançar.'), true);
assert.equal(C.report(0, u, 'tank', 'Tanque!'), false, 'intervalo global de 6 s');
sb.time += 7; assert.equal(C.report(0, u, 'stuck', 'de novo'), false, 'mesmo tipo em cooldown de 45 s');
assert.equal(C.report(0, u, 'tank', 'Tanque!'), true);
assert.equal(C.report(1, sb.units[41], 'stuck', 'x'), false, 'relatos só para a equipe do jogador');
assert.ok(sb.shouts.includes('NAO AVANCAMOS!') && sb.shouts.includes('TANQUE INIMIGO!'), 'balão sobre a unidade: ' + sb.shouts);
assert.equal(C.log.filter(e => e.team === 0).length, 2);
// comunicações destruídas atrasam o relato do campo
comms.destroyed = true; sb.time += 20; assert.equal(C.report(0, u, 'ammo', 'Sem munição!'), true); const n0 = C.log.length; assert.equal(C.log.length, n0, 'adiado'); for (let i = 0; i < 10; i++) sb.update(1); assert.ok(C.log.length > n0, 'chegou depois'); comms.destroyed = false;

// proposta do oficial: alvo conhecido, forças, risco, probabilidade; aceitar executa o assalto pela cadeia de comando
sb.time = 700; const p = C.propose(); assert.ok(p, 'proposta'); assert.ok(/Destruir posição de artilharia inimiga em/.test(p.title), p.title);
assert.ok(p.lines.some(l => /Forças necessárias: \d+ homens/.test(l)) && p.lines.some(l => /Risco: (baixo|moderado|alto)/.test(l)) && p.lines.some(l => /Probabilidade estimada: \d+ %/.test(l)));
assert.equal(C.propose(), null, 'só uma proposta por vez');
assert.equal(C.accept(), true); for (let i = 0; i < 5; i++) sb.update(1);
assert.equal(assaults.length, 1); assert.ok(assaults[0].n >= 8 && assaults[0].ent.kind === 'gun'); assert.equal(C.proposal, null);
sb.time += 100; const p2 = C.propose(); assert.ok(p2); assert.equal(C.decline(), true); assert.equal(C.proposal, null);
// sem estruturas conhecidas não há proposta
struct.list[2].known = [false, false]; sb.time += 200; assert.equal(C.propose(), null);
// estrutura avistada vira relato do oficial
struct.f({ type: 'spotted', by: 0, e: Object.assign({}, struct.list[2], { x: 1500, y: 900 }) });
assert.ok(C.log.some(e => /Reconhecimento identificou posição de artilharia inimiga em H4/.test(e.text)), C.log.map(e => e.text).join('|'));
console.log('Comms: atraso do enlace, autonomia, relatos filtrados, propostas e cadeia de comando OK');
