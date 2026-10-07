const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// structures.js: retaguarda destrutível (QG, comunicações, combustível, hospital) + adaptadores (depósito/peça/posto/bunker),
// resistência por material, estados, fogo, carga de demolição, captura de peça abandonada, reparo/reconstrução e integridade.
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity, performance: { now: () => 0 }, location: { search: '' },
  W: 2400, H: 2000, vw: 680, vh: 450, time: 100, started: true, ended: false, playerTeam: 0, map: 'forest', sandbox: true,
  units: [], buildings: [], bullets: [], particles: [], shells: [], cam: { x: 0, y: 0, z: 1 }, booms: [], toasts: [],
  points: [{ x: 260, y: 1000, home: 0, owner: 0, progress: -100 }, { x: 2140, y: 1000, home: 1, owner: 1, progress: 100 }],
  toast(s) { sb.toasts.push(s); }, setup() {}, update(dt) { sb.time += dt; },
  explode(x, y, r, power, team) { sb.booms.push({ x, y, r, power, team }); },
  PXBAT: { batteries: [], depots: [], removeGun(b) { const i = sb.PXBAT.batteries.indexOf(b); if (i >= 0) sb.PXBAT.batteries.splice(i, 1); return true; } },
  PXMED: { posts: [{ team: 1, x: 2100, y: 800, hp: 400 }] }, PXFORT: { guns: [], aa: [] },
};
sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/structures.js'), 'utf8'), sb);
const S = sb.PXSTRUCT;
sb.setup(); sb.update(.3);
const ent = (team, kind) => S.list.find(e => e.team === team && e.kind === kind);

// 1) a retaguarda de cada lado existe (fora da arte baked, relativa à bandeira) e o posto médico legado entra no registro
for (const t of [0, 1]) for (const k of ['hq', 'comms', 'fuel', 'hospital']) assert.ok(ent(t, k), `${k} do lado ${t}`);
assert.ok(ent(1, 'medpost') && ent(1, 'medpost').legacy, 'posto médico legado como adaptador');
assert.ok(ent(0, 'hq').x < 260 && ent(1, 'hq').x > 2140, 'QG fica atrás da bandeira de cada lado');
assert.equal(S.gridRef(2268, 840), 'L4');

// 2) material: balas de fuzil quase nada no QG (tijolo), muito no posto médico (lona)
const hq = ent(1, 'hq'), med = ent(1, 'medpost');
for (let i = 0; i < 200; i++) sb.bullets.push({ x: hq.x - 30, y: hq.y, vx: 800, vy: 0, t: 1, team: 0, damage: 30 });
for (let i = 0; i < 100; i++) sb.bullets.push({ x: med.x - 20, y: med.y, vx: 800, vy: 0, t: 1, team: 0, damage: 30 });
sb.update(.05);
assert.ok(hq.max - hq.hp > 100 && hq.max - hq.hp < 250, 'fuzis contra concreto/tijolo: dano mínimo ' + (hq.max - hq.hp));
assert.equal(sb.bullets.filter(b => b.t > 0).length, 0, 'balas absorvidas');
assert.ok(med.destroyed && sb.toasts.some(t => /Posto médico inimigo destruído!/.test(t)), 'lona cede a balas e concordância de gênero');
// balas amigas atravessam
const own = ent(0, 'hq'); sb.bullets.push({ x: own.x - 30, y: own.y, vx: 800, vy: 0, t: 1, team: 0, damage: 30 }); sb.update(.05); assert.equal(own.hp, own.max, 'fogo amigo não fere');

// 3) explosões: 6 obuses derrubam o QG; estados passam por danificado/crítico
const states = new Set();
for (let i = 0; i < 8 && !hq.destroyed; i++) { sb.explode(hq.x, hq.y, 55, 180, 0); sb.update(.3); states.add(hq.state); }
assert.ok(hq.destroyed && states.has(1) || states.has(2), 'passa por estados intermediários: ' + [...states]);
assert.equal(S.hqDown(1), true);
assert.ok(S.integrity(1) < S.integrity(0), 'integridade cai: ' + S.integrity(1).toFixed(2));
assert.ok(S.logistics(1) < 1);

// 4) combustível: pega fogo e queima
const fuel = ent(1, 'fuel'); sb.explode(fuel.x, fuel.y, 70, 150, 0); sb.update(.3);
assert.ok(fuel.hp < fuel.max, 'explosão fere o combustível');

// 5) carga de demolição (6 s) fere o hospital de lona
const hos = ent(1, 'hospital'), h0 = hos.hp; S.charge(hos, 0, 3); for (let i = 0; i < 20; i++) sb.update(.3);
assert.ok(hos.hp < h0 - 300, 'carga de demolição: ' + (h0 - hos.hp));

// 6) reparo e reconstrução (comunicações pode ser reconstruído; QG não)
const comms = ent(0, 'comms'); comms.ref.hp = comms.max * .3; sb.update(.3);
assert.equal(comms.state, 2, 'crítico'); assert.ok(S.repair(comms, 500) > 0); sb.update(.3); assert.equal(comms.state, 0);
comms.ref.hp = 0; sb.update(.3); assert.ok(comms.destroyed); assert.equal(S.rebuild(comms), true); sb.update(.3);
assert.equal(comms.destroyed, false); assert.ok(comms.hp > 0 && comms.hp < comms.max);
assert.equal(S.rebuild(hq), false, 'o QG destruído não se reconstrói');

// 7) peça de artilharia: sem tripulação fica abandonada; 2 inimigos por 7 s a capturam
const crew = Array.from({ length: 4 }, () => ({ alive: true, hp: 100 }));
const gun = { team: 1, cx: 1100, cy: 400, crew, ammo: 12, hot: -99 }; sb.PXBAT.batteries.push(gun); sb.update(.3);
const ge = ent(1, 'gun'); assert.ok(ge && ge.hp === 520 && ge.gun === gun, 'peça do battery.js ganha HP');
crew.forEach(c => c.alive = false);
for (let i = 0; i < 2; i++) sb.units.push({ id: 90 + i, team: 0, x: 2200 + i * 5, y: 800, hp: 100, type: 'rifle' });
for (let i = 0; i < 30; i++) sb.update(.3);
assert.equal(gun.team, 0, 'capturada'); assert.equal(S.stats.captured, 1); assert.ok(crew.filter(c => c.alive).length === 2);
assert.ok(sb.toasts.some(t => /capturada/.test(t)));
// peça destruída sai do battery.js
gun.hp = 0; sb.update(.3); assert.equal(sb.PXBAT.batteries.includes(gun), false);

// 8) conhecimento: estruturas ocultas só são "conhecidas" depois de avistadas
const dep = { team: 1, x: 1200, y: 150, hp: 450, max: 450, dead: false }; sb.PXBAT.depots.push(dep); sb.update(.3);
const de = ent(1, 'depot'); assert.equal(de.known[0], false);
sb.units.push({ id: 300, team: 0, x: 2200, y: 400, hp: 100, type: 'rifle' }); for (let i = 0; i < 3; i++) sb.update(.3); assert.equal(de.known[0], true, 'avistada por tropa perto');
// estimativa de tempo
assert.ok(S.estimate(ent(1, 'comms'), [{ type: 'rifle', gren: 2 }]) < Infinity && S.estimate(ent(1, 'hospital'), [{ type: 'tank' }]) < 60);
assert.equal(S.canHurt(ent(1, 'hq'), { type: 'rifle', gren: 0 }), false, 'fuzil sem granada não fere concreto/tijolo'); assert.equal(S.canHurt(ent(1, 'hq'), { type: 'rifle', sap: 1 }), true);
console.log('Structures: retaguarda, materiais, estados, fogo, demolição, reparo, reconstrução, captura de peça e integridade OK');
