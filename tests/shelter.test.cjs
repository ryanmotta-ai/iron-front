const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// shelter.js (1.9): sob barragem a infantaria vai à entrada do abrigo, desce progressivamente, fica protegida e fora da mira,
// sai quando a barragem acaba ou no alarme (corrida ao parapeito) e volta ao posto; o bunker só atira com guarnição.
// A/B: baixas de 8 homens numa trincheira com abrigo sob 60 s de barragem.
function engine(search = '') {
  let serial = 0, seed = 6;
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const seg = { kind: 'dugout', team: 0, x: 500, y: 800, stage: 2, anchor: { x: 500, y: 800 } };
  const sb = {
    console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity,
    W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null,
    units: [], buildings: [], fieldTrenches: [], trenchGrid: new Map(), particles: [], cam: { x: 0, y: 0 }, location: { search }, PX: { Z: .5 },
    PXSAP: { projects: [{ kind: 'dugout', segs: [seg] }] },
    document: { createElement: () => ({ getContext: () => ({}) }), querySelector: () => null },
    IronFrontBrain: { selectTarget(u, list, r, can) { return list.find(e => e.team !== u.team && e.hp > 0 && (!can || can(u, e))) || null; } },
    toasts: [], toast(s) { sb.toasts.push(s); }, setup() {}, protectedBy() { return .35; },
    damage(u, n) { if (u.hp <= 0) return; u.hp -= n; },
    explode(x, y, r, power) { for (const u of sb.units) { const d = Math.hypot(u.x - x, u.y - y); if (d < r) sb.damage(u, power * (1 - d / r)); } },
    update(dt) { sb.time += dt; sb.units = sb.units.filter(u => u.hp > 0);
      for (const u of sb.units) { u.cd = Math.max(0, (u.cd || 0) - dt); if (u.order === 'move') { const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy); if (d > 1) { const s = Math.min(d, 47 * dt); u.x += dx / d * s; u.y += dy / d * s; } } }
      for (const b of sb.buildings) { b.cd = Math.max(0, (b.cd || 0) - dt); if (b.cd <= 0) { b.cd = .2; b.shots = (b.shots || 0) + 1; } } },
  };
  sb.window = sb; sb.addEventListener = () => {};
  vm.createContext(sb);
  for (const f of ['life-kit.js', 'shelter.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
  sb.u = (team, x, y, type = 'rifle') => { const u = { id: ++serial, team, x, y, type, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, cd: 0, suppression: 0 }; sb.units.push(u); return u; };
  sb.run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };
  sb.setup(); return sb;
}

{
  const sb = engine(), S = sb.PXSHELTER; const men = [0, 1, 2].map(i => sb.u(0, 540, 780 + i * 20)), post = { x: men[0].x, y: men[0].y };
  sb.run(1.1); sb.explode(620, 800, 80, 150, 1); sb.run(1.6);
  assert.ok(men.every(u => u.sh), 'sob barragem, vão ao abrigo');
  let t = 0; while (men[0].sh.st !== 'down' && t < 5) { sb.run(.05); t += .05; }
  assert.equal(men[0].sh.st, 'down', `chegou à entrada em ${t.toFixed(1)} s e desce`);
  t = 0; while (!men.every(u => u.sh && u.sh.st === 'in') && t < 6) { sb.run(.1); t += .1; } assert.ok(men.every(u => u.sh.st === 'in'), 'os 3 dentro do abrigo');
  const e = sb.u(1, 900, 800); assert.equal(sb.IronFrontBrain.selectTarget(e, [men[0]], 9999), null, 'dentro do abrigo não é alvo');
  const hp0 = men[1].hp; sb.damage(men[1], 50); assert.ok(hp0 - men[1].hp <= 4, 'recebe só 8% do dano');
  e.x = 2000; for (let k = 0; k < 4; k++) { sb.explode(600, 860, 70, 120, 1); sb.run(1); } assert.equal(men[0].sh && men[0].sh.st, 'in', 'fica enquanto a barragem continua');
  sb.run(7.5); assert.ok(men.every(u => !u.sh || u.sh.st === 'up'), 'a barragem acabou: sobem');
  sb.run(5); assert.ok(Math.hypot(men[0].x - post.x, men[0].y - post.y) < 12, 'voltam ao posto na trincheira');
  // alarme
  sb.explode(620, 800, 80, 150, 1); sb.run(4); assert.ok(men.some(u => u.sh && u.sh.st === 'in'));
  e.x = 640; e.y = 800; sb.run(.6); assert.ok(S.stats.alarms >= 1 && men.every(u => !u.sh || u.sh.st !== 'in'), 'inimigo perto: corrida ao parapeito');
}
/* bunker */
{
  const sb = engine(), b = { type: 'bunker', team: 0, x: 900, y: 500, hp: 1000, cd: 0 }; sb.buildings.push(b);
  sb.run(5); const empty = b.shots || 0; const g = sb.u(0, 905, 502); sb.run(5); const crewed = (b.shots || 0) - empty;
  console.log(`  bunker 5 s vazio: ${empty} rajadas · 5 s com guarnição: ${crewed}`);
  assert.ok(empty === 0 && crewed >= 15, 'MG do bunker só com gente dentro');
}
/* A/B */
function barrage(search) { const sb = engine(search); const men = []; for (let i = 0; i < 8; i++) men.push(sb.u(0, 540 + (i % 2) * 12, 740 + i * 16));
  for (let s = 0; s < 60; s++) { sb.run(1); if (s % 2 === 0) sb.explode(540 + (Math.random() - .5) * 120, 800 + (Math.random() - .5) * 160, 75, 140, 1); }
  return men.filter(u => u.hp <= 0).length; }
const off = barrage('?abrigos=0'), on = barrage('');
console.log(`  60 s de barragem (30 obuses) sobre 8 homens: sem abrigo ${off} mortos · usando o abrigo ${on}`);
assert.ok(on < off, 'o abrigo salva vidas na barragem');
console.log('Abrigos 1.9: entrada, descida progressiva, proteção, saída ao fim da barragem, alarme, bunker com guarnição e A/B OK');
