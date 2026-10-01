const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// aviation.js (1.9): patrulha de caça derruba bombardeiro (e as bombas ainda não largadas caem com ele), ataque ao solo
// voa ao longo da trincheira e suprime quem está nela, observação de artilharia corrige e pede fogo, e a IA usa cada papel.
let seed = 4; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function engine() {
  let serial = 0;
  const sb = {
    console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity,
    W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null, sandbox: true,
    units: [], particles: [], bullets: [], shells: [], buildings: [], planes: [], fieldTrenches: [], trenchGrid: new Map(), cam: { x: 0, y: 0 },
    aiEnabled: [false, false], placement: null, keys: {}, tab: 'support', location: { search: '' }, missions: [],
    defs: { bomber: { cost: 240 } }, supplies: [9999, 9999],
    PX: { Z: .5, planeSprite: () => ({ c: {}, sh: {} }), rotSprite: c => c },
    PXBAT: { mission(team, x, y, count, spread, kind) { sb.missions.push({ team, x, y, count, spread, kind }); return true; } },
    document: { createElement: () => ({ getContext: () => ({}) }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    toasts: [], toast(s) { sb.toasts.push(s); }, setup() {}, place() {}, makeCards() {}, icon() {}, sound() {},
    spend(type, team) { return true; }, damage(u, n) { u.hp -= n; },
    callBomber(team, x, y) { sb.bombers = (sb.bombers || 0) + 1; },
    update(dt) { sb.time += dt; for (const p of sb.planes) { if (p.delay > 0) { p.delay -= dt; continue; } p.x += (p.team ? -1 : 1) * (p.v || 430) * dt; } sb.planes = sb.planes.filter(p => p.team ? p.x > -300 : p.x < sb.W + 300); },
  };
  sb.window = sb; sb.addEventListener = () => {};
  vm.createContext(sb);
  for (const f of ['life-kit.js', 'aviation.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
  sb.u = (team, x, y, type = 'rifle') => { const u = { id: ++serial, team, x, y, type, hp: 100, maxhp: 100, suppression: 0 }; sb.units.push(u); return u; };
  sb.run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };
  sb.setup();
  return sb;
}

/* ---------- patrulha de caça ---------- */
{
  const sb = engine(), A = sb.PXAIR;
  const bomber = { kind: 'bomber', team: 1, x: 1900, y: 700, v: 150, delay: 0 }; sb.planes.push(bomber);
  sb.shells.push({ x: 300, y: 700, t: 12, r: 85, team: 1, bomb: { rx: 400, ry: 700, fall: 1.25, team: 1 } });
  A.launch.cap(0, 700); let t = 0; while (!bomber.downed && t < 12) { sb.run(.1); t += .1; }
  console.log(`  patrulha de caça: bombardeiro abatido em ${t.toFixed(1)} s · bombas ainda no porão canceladas: ${sb.shells.some(s => s.bomb) ? 'não' : 'sim'}`);
  assert.ok(bomber.downed && A.stats.capKills === 1, 'o caça derruba o bombardeiro inimigo');
  assert.ok(!sb.shells.some(s => s.bomb), 'as bombas não largadas caem com o avião');
  const sb2 = engine(); sb2.aiEnabled = [true, false]; sb2.planes.push({ kind: 'fighter', team: 1, x: 1800, y: 500, v: 430, tx: 900 }); sb2.run(1.2);
  assert.ok(sb2.PXAIR.air().some(p => p.role === 'cap' && p.team === 0), 'a IA lança patrulha quando há aeronave inimiga');
}

/* ---------- ataque ao solo ao longo da trincheira ---------- */
{
  const sb = engine(), A = sb.PXAIR;
  for (let y = 500; y <= 900; y += 40) sb.fieldTrenches.push({ x: 1500, y, hw: 16, hh: 16, team: 1 });
  const occ = []; for (let y = 520; y <= 880; y += 40) occ.push(sb.u(1, 1500 + (y % 3), y));
  const mg = sb.u(1, 1505, 700, 'mg'), off = sb.u(1, 1650, 700);
  const p = A.launch.atk(0, 1480, 700);
  console.log(`  rota do ataque ao solo: rumo ${(p.hd * 180 / Math.PI).toFixed(0)}° (90° = ao longo da trincheira N–S)`);
  assert.ok(Math.abs(Math.abs(p.hd) - Math.PI / 2) < .2, 'voa ao longo da trincheira, não a atravessa');
  sb.run(8);
  const sup = occ.reduce((a, u) => a + u.suppression, 0) / occ.length;
  console.log(`  supressão média na vala: ${sup.toFixed(2)} · fora da rota (150 px): ${off.suppression.toFixed(2)} · bombas no ninho: ${A.stats.atkBombs}`);
  assert.ok(sup > .5 && off.suppression === 0, 'suprime quem está na trincheira da rota');
  assert.ok(A.stats.atkBombs >= 1 && sb.shells.length >= 1, 'bomba no ninho de MG');
}

/* ---------- observação de artilharia ---------- */
{
  const sb = engine(), A = sb.PXAIR; const p = A.launch.spot(0, 1400, 800);
  sb.run(15); assert.equal(p.phase, 'orbit', 'chegou e orbita');
  sb.PXBAT.mission(0, 1450, 820, 6, 100, 'he'); sb.PXBAT.mission(0, 400, 300, 6, 100, 'he');
  const [inside, outside] = sb.missions.slice(-2);
  assert.ok(inside.spread < 40 && outside.spread === 100, `dispersão sob o observador: ${inside.spread.toFixed(0)} (fora: ${outside.spread})`);
  sb.u(1, 1420, 790, 'mg'); const n0 = sb.missions.length; sb.run(13);
  const call = sb.missions.slice(n0).find(m => m.count === 3);
  assert.ok(call && Math.abs(call.x - 1420) < 5, 'pede salva corrigida sobre o ninho de MG que enxerga');
  console.log(`  observação: salva pedida sobre a MG com dispersão ${call.spread.toFixed(0)} px (sem o avião: 60)`);
  sb.run(40); assert.ok(!A.air().includes(p), 'vai embora depois de 45 s');
}

/* ---------- IA: bombardeiro leve sobre concentração ---------- */
{
  const sb = engine(); sb.aiEnabled = [true, false]; for (let i = 0; i < 16; i++) sb.u(1, 1600 + (i % 4) * 25, 800 + Math.floor(i / 4) * 25);
  sb.time = 100; sb.run(15); assert.ok(sb.bombers >= 1, 'a IA chama o bombardeiro sobre 14+ inimigos');
}
/* ---------- clima e caixa: tempestade deixa em solo; em conquista a IA não gasta a reserva de obras ---------- */
{
  const sb = engine(); sb.aiEnabled = [true, false]; sb.PXW = { state: { cur: 'storm', I: 1, fog: 0 } };
  sb.planes.push({ kind: 'fighter', team: 1, x: 1800, y: 500, v: 430, tx: 900 }); sb.run(2);
  assert.ok(!sb.PXAIR.air().length, 'tempestade forte: nenhum avião decola');
  const sb2 = engine(); sb2.aiEnabled = [true, false]; sb2.sandbox = false; sb2.supplies = [250, 250]; let spent = 0; sb2.spend = (type, t) => { spent++; return true; };
  sb2.planes.push({ kind: 'fighter', team: 1, x: 1800, y: 500, v: 430, tx: 900 }); sb2.run(2);
  assert.equal(spent, 0, 'com 250 de caixa (custo 150 + reserva 200) a IA guarda o dinheiro das obras');
  sb2.supplies = [500, 500]; sb2.planes.push({ kind: 'fighter', team: 1, x: 1800, y: 500, v: 430, tx: 900 }); sb2.run(2); assert.ok(spent >= 1, 'com caixa sobrando, lança a patrulha');
}
/* ---------- regressão: passo grande (dt = 0,1 s, como o verify-battle) não pode gerar NaN na chegada da órbita ---------- */
{
  const sb = engine(), A = sb.PXAIR; for (let k = 0; k < 20; k++) A.launch.spot(0, 300 + k * 97, 200 + k * 61);
  for (let i = 0; i < 300; i++) { if (i % 20 === 0) A.launch.cap(1, 200 + (i * 7) % 1200); sb.update(.1); }
  assert.ok(A.air().every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), 'coordenadas sempre finitas com dt grande');
  assert.ok(sb.shells.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)), 'nenhum projétil em NaN');
}
console.log('Aviação 1.9: patrulha de caça, ataque ao solo ao longo da trincheira, observação de artilharia e uso pela IA OK');
