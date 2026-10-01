const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Carrega assault.js com um mini-motor (sem DOM/canvas/áudio) e testa supressão (deitar, rastejar até a cratera, levantar),
// proteção deitado/cratera, Over the Top (onda escalonada até a linha inimiga), gás (nuvem, alarme, máscara, dano, vento),
// concussão do jogador, corpo a corpo, granada que entra no abrigo e bandeira de setor.
let serial = 0;
class AudioNode { connect() { return this; } }
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, AudioNode,
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, sandbox: false, playerTeam: 0, mode: 'commander', player: null,
  map: 'forest', tab: 'units', placement: null, soundOn: false, audio: null, keys: {}, screenShake: 0,
  units: [], buildings: [], shells: [], particles: [], fieldTrenches: [], allCraters: [], points: [], selected: new Set(),
  supplies: [2000, 2000], aiEnabled: [false, false], cam: { x: 0, y: 0 }, mouse: { x: 0, y: 0, wx: 0, wy: 0 },
  defs: { rifle: { rate: 1.5 }, mg: { rate: .22 }, artillery: { cost: 160 } },
  location: { search: '' }, canvas: { style: {} }, document: { querySelector: () => null, getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) },
  PX: { Z: .5 }, PXW: { windVec: () => ({ x: 20, y: 0, s: .3 }), depth: () => 0 },
  toasts: [], toast(s) { sb.toasts.push(s); }, sound() {}, hud() {}, render() {}, makeCards() {}, icon() {}, choose() {}, place() {}, setup() {}, spend() { return true; },
  explode(x, y, r, power) { for (const u of sb.units) { const d = Math.hypot(u.x - x, u.y - y); if (d < r) sb.damage(u, power * (1 - d / r)); } },
  shoot() { sb.shots = (sb.shots || 0) + 1; },
  update(dt) { // motor mínimo: relógio, supressão cai, anda quem tem ordem de mover (47 px/s, só se faltar > 12 px)
    sb.time += dt;
    for (const u of sb.units) { u.suppression = Math.max(0, (u.suppression || 0) - dt * .18); if (u.order !== 'move') continue; const dx = u.tx - u.x, dy = u.ty - u.y, l = Math.hypot(dx, dy);
      if (l > 12) { const s = Math.min(l, 47 * dt); u.x += dx / l * s; u.y += dy / l * s; } else u.order = 'hold'; }
    for (const s of sb.shells) s.t -= dt;
    for (const s of sb.shells) if (s.t <= 0) sb.explode(s.x, s.y, s.r, s.power || 120);
    sb.shells = sb.shells.filter(s => s.t > 0);
  },
  protectedBy(u) { let f = 1; for (const t of sb.fieldTrenches) if (Math.abs(t.x - u.x) < t.hw && Math.abs(t.y - u.y) < t.hh) f = .35; return f; },
  damage(u, n) { u.hp -= n; },
  nearest(u, r) { let b = null, bd = r * r; for (const e of sb.units) { if (e.team === u.team || e.hp <= 0) continue; const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2; if (d < bd) { bd = d; b = e; } } return b; },
};
sb.window = sb; sb.addEventListener = () => {};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/assault.js'), 'utf8'), sb);
const S = sb.PXAS;
const run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };
const unit = (type, team, x, y, extra = {}) => { const u = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, manualUntil: 0, suppression: 0, angle: 0, cd: 0, ...extra }; sb.units.push(u); return u; };

// trincheiras dos dois lados (mapa sem WW1: colunas em 720 e 1680)
for (let t = 0; t < 2; t++) for (let y = 100; y < 1500; y += 60) sb.fieldTrenches.push({ id: `f${t}${y}`, type: 'trench', team: t, x: t ? 1680 : 720, y, hw: 16, hh: 16 });
sb.setup();
assert.equal(S.state().front.join(), '720,1680');
assert.ok(S.sectors.length >= 12, 'setores da primeira linha montados');

// 1. supressão: deita, rasteja devagar até a cratera, fica mais protegido, levanta quando o fogo cai
sb.allCraters.push({ x: 1000, y: 800, r: 30 });
const a = unit('rifle', 0, 1060, 800, { order: 'move', tx: 1500, ty: 800 });
a.suppression = 1.6; run(.1);
assert.ok(a.pinned, 'suprimido em campo aberto: deitado');
assert.ok(a.crawlTo && Math.hypot(a.crawlTo.x - 1000, a.crawlTo.y - 800) < 12, 'procura a cratera mais próxima');
const x0 = a.x; a.suppression = 2; run(1);
assert.ok(x0 - a.x > 8 && x0 - a.x < 15, 'rasteja a ~13 px/s (não corre)');
assert.equal(sb.protectedBy(a), .6, 'deitado: 40% menos dano');
a.suppression = 2; run(4);
assert.ok(sb.protectedBy(a) <= .45, 'na cratera: 55% menos dano');
a.suppression = 0; run(.1);
assert.ok(!a.pinned && a.order === 'move' && a.tx === 1500, 'fogo caiu: levanta e retoma a ordem');
const t0 = unit('rifle', 0, 720, 340); t0.suppression = 2; run(.1);
assert.ok(!t0.pinned, 'dentro da trincheira não precisa se jogar na lama');
sb.units.length = 0;

// 2. Over the Top: sinalizador, apitos e onda escalonada até a linha inimiga
const squad = []; for (let i = 0; i < 10; i++) squad.push(unit('rifle', 0, 720, 400 + i * 20));
const mg = unit('mg', 0, 720, 700);
assert.equal(S.overTop(0), 10, 'só fuzileiros saem (a MG fica cobrindo)');
assert.ok(squad.every(u => u.order === 'hold'), 'ainda subindo as escadas');
run(4);
assert.ok(squad.every(u => u.order === 'move' && u.tx > 1600 && u.aiRole === 'assalto'), 'todos avançam em onda para a linha inimiga');
assert.ok(Math.max(...squad.map(u => Math.abs(u.ty - u.y))) < 30, 'em linha (cada um na sua faixa), não num funil');
assert.equal(mg.order, 'hold');
assert.equal(S.overTop(0), 0, 'recarga entre ondas');
sb.units.length = 0; S.reset();

// 3. gás: nuvem, alarme, máscara (alguns falham), dano, vento
const vict = []; for (let i = 0; i < 12; i++) vict.push(unit('rifle', 1, 1200 + (i % 4) * 10, 800 + Math.floor(i / 4) * 10));
S.launchGas(0, 1215, 810);
run(3.5);
assert.ok(S.puffs.length >= 15, 'as granadas abrem a nuvem');
assert.ok(sb.toasts.length === 0 || !sb.toasts.some(t => /GÁS!/.test(t)), 'alarme é do lado atingido (lado 1 é IA aqui)');
run(4);
const masked = vict.filter(u => u.mask).length;
assert.ok(masked >= 6, `a maioria põe a máscara (${masked}/12)`);
const hurt = vict.filter(u => u.hp < 100).length;
assert.ok(hurt >= 6, 'quem respirou o gás se feriu');
assert.ok(vict.some(u => u.cough > sb.time - 2), 'tossem');
const px0 = S.puffs.reduce((n, p) => n + p.x, 0) / S.puffs.length; run(5);
assert.ok(S.puffs.reduce((n, p) => n + p.x, 0) / S.puffs.length > px0 + 4, 'a nuvem vai com o vento (leste)');
const m1 = unit('rifle', 1, 1215, 810, { mask: 1 }), n1 = unit('rifle', 1, 1216, 811, { maskAt: 1e9 });
run(2);
assert.ok(100 - m1.hp < (100 - n1.hp) * .3, 'máscara corta quase todo o dano');
sb.units.length = 0; S.reset();

// 4. concussão do jogador
const me = unit('rifle', 0, 500, 500); sb.player = me; sb.mode = 'soldier';
sb.explode(530, 500, 60, 180);
assert.ok(S.state().conc > 2, 'explosão a 30 px: atordoado por alguns segundos');
run(8); assert.equal(S.state().conc, 0);
sb.mode = 'commander'; sb.player = null; sb.units.length = 0;

// 5. corpo a corpo
const k1 = unit('rifle', 0, 900, 900), k2 = unit('rifle', 1, 910, 900);
run(1.5);
assert.ok(k1.hp < 100 && k2.hp < 100 && S.stats.melee >= 2, 'a menos de 16 px: faca e pá');
sb.units.length = 0;

// 6. granada que rola para dentro do abrigo (bunker) mata a guarnição e arrasa o bunker
const bk = { id: ++serial, type: 'bunker', team: 1, x: 1500, y: 700, hp: 1000, maxhp: 1000 }; sb.buildings.push(bk);
const crew = [unit('mg', 1, 1500, 712), unit('mg', 1, 1505, 716)];
sb.shells.push({ gren: 1, team: 0, x: 1480, y: 712, gx: 1480, gy: 712, gz: 0, gvx: 40, gvy: 0, t: 1.2, r: 48, power: 120 });
for (let i = 0; i < 30; i++) { const s = sb.shells[0]; if (s && !s.inside) { s.gx += s.gvx * .04; s.gy += s.gvy * .04; s.x = s.gx; s.y = s.gy; } sb.update(.04); }
assert.ok(crew.every(u => u.hp <= 0), 'explosão confinada: guarnição fora de combate');
assert.ok(bk.hp <= 400, 'bunker muito danificado');
sb.units.length = 0;

// 7. bandeira de setor
const sec = S.sectors.find(s => s.team === 1);
const anc = sec.anchors[0];
unit('rifle', 0, anc.x, anc.y); unit('rifle', 0, anc.x + 2, anc.y + 3);
run(1.2);
assert.equal(sec.holder, 1, 'passar não basta: precisa ocupar');
run(3);
assert.equal(sec.holder, 0, 'setor inimigo tomado');
assert.ok(sb.toasts.some(t => /Bandeira hasteada/.test(t)));

// O comandante coordena a onda: o módulo de assalto não prende soldados em ordens automáticas.
sb.units=[];sb.buildings=[];sb.shells=[];sb.time+=250;sb.aiEnabled[0]=true;
sb.IronFrontBrain={operations:{},getRoles:()=>['attack','defend']};
const coordinated=Array.from({length:8},(_,i)=>unit('rifle',0,720,400+i*18));
coordinated[0].manualUntil=sb.time+25;
const ids=coordinated.slice(0,5).map(u=>u.id);
assert.equal(S.overTop(0,{ai:true,ids,target:{x:1200,y:450},coordinated:true}),4);
assert.ok(coordinated.slice(1,5).every(u=>u.aiStepAt>sb.time),'saída escalonada espera os apitos');
run(4);
assert.ok(coordinated.every(u=>!u.wave),'assalto automático não cria bloqueio por manualUntil');
assert.ok(coordinated.slice(1).every(u=>u.manualUntil===0));
sb.time+=250;const waves=S.stats.waves;S.aiTick(0);assert.equal(S.stats.waves,waves,'não existe segunda IA disparando ondas por fora');
assert.equal(S.stats.errors, 0);
console.log('Assalto 1.4: supressão e rastejo, cobertura deitado/cratera, Over the Top, gás (máscara, vento), concussão, corpo a corpo, granada no abrigo e bandeira de setor OK');
