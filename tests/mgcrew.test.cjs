const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// mgcrew.js (1.9) num mini-motor: a carta de MG vira UMA arma servida por 3 homens (atirador, municiador, remuniciador).
// Mede o que muda na batalha: cadência com/sem municiador, tiro bloqueado em movimento, tempo de sucessão quando o
// atirador cai, troca de fita, corridas de água e de munição, fusão de sobras, parada para montar e ninho.
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function engine() {
  let serial = 0;
  const sb = {
    console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity,
    W: 2400, H: 1600, time: 0, started: true, ended: false, mode: 'commander', player: null, aiEnabled: [true, true],
    units: [], bullets: [], buildings: [], location: { search: '' },
    defs: { rifle: { hp: 100, speed: 47, range: 240, rate: 1.5, damage: 30 }, mg: { hp: 110, speed: 34, range: 330, rate: .22, damage: 13, count: 3 } },
    setup() {},
    newUnit(type, team, x, y) { const d = sb.defs[type]; const u = { id: ++serial, type, team, x, y, hp: d.hp, angle: team ? Math.PI : 0, cd: 0, order: 'hold', tx: x, ty: y, manualUntil: 0, suppression: 0 }; sb.units.push(u); return u; },
    squad(type, team, x, y) { for (let i = 0; i < 3; i++) sb.newUnit(type, team, x + i * 4, y + (i - 1) * 6); },
    shoot(u, target) { const a = Math.atan2(target.y - u.y, target.x - u.x); u.angle = a; u.cd = sb.defs[u.type].rate; sb.bullets.push({ x: u.x, y: u.y, t: sb.defs[u.type].range / 800, damage: sb.defs[u.type].damage, team: u.team, by: u }); },
    update(dt) {
      sb.time += dt; sb.units = sb.units.filter(u => u.hp > 0); sb.bullets = sb.bullets.filter(b => (b.t -= dt) > 0);
      for (const u of sb.units) { u.cd = Math.max(0, u.cd - dt); u.moving = false; if (u.down) continue;
        let tg = null, bd = sb.defs[u.type].range; for (const e of sb.units) if (e.team !== u.team && e.hp > 0) { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; tg = e; } }
        u.target = tg; if (tg && u.cd <= 0 && !u.noFire) sb.shoot(u, tg);
        if (u.order === 'move') { const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy); if (d > 12) { const s = Math.min(d, sb.defs[u.type].speed * dt); u.x += dx / d * s; u.y += dy / d * s; u.moving = true; } else u.order = 'hold'; } }
    },
  };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/mgcrew.js'), 'utf8'), sb);
  sb.run = (sec, dt = 1 / 30) => { for (let t = 0; t < sec - 1e-9; t += dt) sb.update(dt); };
  sb.dummy = (x, y) => { const e = sb.newUnit('rifle', 1, x, y); e.hp = 1e9; e.noFire = true; return e; };
  sb.setup();
  return sb;
}
const C = sb => sb.PXCREW.crews();
const shotsBy = (sb, us) => sb.bullets.filter(b => us.includes(b.by));

/* ---------- formação e quem atira o quê ---------- */
{
  const sb = engine(); sb.squad('mg', 0, 1000, 800); sb.run(.6);
  assert.equal(C(sb).length, 1, 'uma guarnição para os 3');
  const c = C(sb)[0]; assert.ok(c.gun && c.ld && c.br, 'atirador, municiador e remuniciador');
  sb.dummy(1200, 800); const all = [];
  for (let t = 0; t < 60; t += 1 / 30) { sb.update(1 / 30); for (const b of sb.bullets) if (!b._seen) { b._seen = 1; all.push(b); } }
  const gun = all.filter(b => b.by === c.gun), aux = all.filter(b => b.by === c.ld || b.by === c.br);
  console.log(`  1 min com alvo: arma ${gun.length} tiros (dano ${gun[0].damage}) · auxiliares ${aux.length} tiros de fuzil (dano ${aux[0] && aux[0].damage})`);
  assert.ok(gun.length > 180 && gun.every(b => b.damage === 13), 'só o atirador dispara a MG');
  assert.ok(aux.length > 40 && aux.every(b => b.damage === 30), 'os auxiliares atiram de fuzil');
  assert.ok(sb.PXCREW.state().stats.beltChanges >= 1, 'trocou a fita');
  var crewRpm = gun.length;
}
/* ---------- sozinho: cadência pior e troca de fita lenta ---------- */
{
  const sb = engine(); const g = sb.newUnit('mg', 0, 1000, 800); sb.run(.6); C(sb)[0].belt = 120; sb.dummy(1200, 800); const all = [];  // meia fita: força uma troca no minuto
  for (let t = 0; t < 60; t += 1 / 30) { sb.update(1 / 30); for (const b of sb.bullets) if (!b._seen && b.by === g) { b._seen = 1; all.push(b); } }
  console.log(`  1 min, atirador sozinho: ${all.length} tiros (com guarnição: ${crewRpm}) · trocas sozinho ${sb.PXCREW.state().stats.soloChanges}`);
  assert.ok(all.length < crewRpm * .75, 'sem municiador a arma rende bem menos');
  assert.ok(sb.PXCREW.state().stats.soloChanges >= 1);
}
/* ---------- não atira andando; monta 1 s depois de parar ---------- */
{
  const sb = engine(); sb.squad('mg', 0, 1000, 800); sb.run(.6); sb.aiEnabled[0] = false; const c = C(sb)[0];
  c.gun.order = 'move'; c.gun.tx = 1000; c.gun.ty = 1400; sb.dummy(1250, 800);
  sb.update(1 / 30); for (const b of sb.bullets) b._m = 1;   // no 1º quadro o tiro sai antes do passo (ordem do update do jogo)
  let fired = 0; for (let t = 0; t < 4; t += 1 / 30) { sb.update(1 / 30); fired += shotsBy(sb, [c.gun]).filter(b => !b._m && (b._m = 1)).length; }
  assert.equal(fired, 0, 'arma em movimento não dispara');
  c.gun.order = 'hold'; c.gun.tx = c.gun.x; c.gun.ty = c.gun.y; const t0 = sb.time; let first = null;
  for (let t = 0; t < 3; t += 1 / 30) { sb.update(1 / 30); if (first === null && shotsBy(sb, [c.gun]).some(b => !b._m)) first = sb.time - t0; }
  console.log(`  primeiro tiro ${first.toFixed(2)} s depois de parar (bloqueados em movimento: ${sb.PXCREW.state().stats.blockedMove})`);
  assert.ok(first >= .95 && first < 1.4, 'monta o tripé antes de atirar');
}
/* ---------- a IA para e monta quando tem alvo durante um deslocamento ---------- */
{
  const sb = engine(); sb.squad('mg', 0, 1000, 800); sb.run(.6); const c = C(sb)[0];
  c.gun.order = 'move'; c.gun.tx = 1000; c.gun.ty = 1500; sb.dummy(1200, 900); sb.run(.2);
  assert.equal(c.gun.order, 'hold', 'parou para montar');
  assert.equal(sb.PXCREW.state().stats.halts, 1);
}
/* ---------- sucessão: o atirador cai, o municiador vai até a arma e assume ---------- */
{
  const sb = engine(); sb.squad('mg', 0, 1000, 800); sb.run(.6); const c = C(sb)[0], ld = c.ld; sb.run(3);
  sb.dummy(1250, 800); sb.run(2); const gx = c.gun.x, gy = c.gun.y; c.gun.hp = 0; const t0 = sb.time; let back = null;
  for (let t = 0; t < 8; t += 1 / 30) { sb.update(1 / 30); if (back === null && sb.bullets.some(b => b.by === ld && b.damage === 13)) back = sb.time - t0; }
  console.log(`  atirador morto: municiador assume e a arma volta a atirar em ${back.toFixed(2)} s (a ${Math.hypot(ld.x - gx, ld.y - gy).toFixed(0)} px do ponto da arma)`);
  assert.ok(back > 1.4 && back < 4, 'a arma fica muda e volta com o novo atirador');
  assert.equal(c.gun, ld); assert.equal(sb.PXCREW.state().stats.promotions, 1);
}
/* ---------- munição: o remuniciador busca caixas na retaguarda ---------- */
{
  const sb = engine(); sb.squad('mg', 0, 1000, 800); sb.run(.6); const c = C(sb)[0], br = c.br; c.boxes = 0; c.belt = 0;
  sb.dummy(1250, 800); let far = 0; for (let t = 0; t < 25; t += 1 / 30) { sb.update(1 / 30); far = Math.max(far, 1000 - br.x); }
  console.log(`  caixas acabaram: remuniciador foi ${far.toFixed(0)} px para trás e voltou com ${sb.PXCREW.state().stats.ammoRuns * 2} caixas`);
  assert.ok(far > 150, 'correu para a retaguarda'); assert.equal(sb.PXCREW.state().stats.ammoRuns, 1);
}
/* ---------- água do cano: a corrida abstrata vira um homem ---------- */
{
  const sb = engine(); const st = new Map();
  sb.PXFL = { on: true, cfg: { MG: { AMB: 15, WAT: 4, SWAP: 20 } }, st: u => { if (!st.has(u)) st.set(u, { T: 15, wat: 4 }); return st.get(u); } };
  sb.squad('mg', 0, 1000, 800); sb.run(.6); const c = C(sb)[0], a = sb.PXFL.st(c.gun);
  a.wat = .8; a.run = { t0: sb.time, dur: 20, ox: c.gun.x, oy: c.gun.y, bx: 860, by: 800 }; const run = a.run;
  sb.run(.1); assert.equal(c.errand && c.errand.kind, 'water'); assert.ok(run.dur > 1e5, 'a corrida abstrata espera o homem');
  let t = 0; while (c.errand && t < 30) { sb.update(1 / 30); t += 1 / 30; }
  console.log(`  água: o remuniciador foi e voltou em ${t.toFixed(1)} s (corrida abstrata sorteada: 20 s)`);
  assert.equal(run.dur, 0, 'completa a corrida do frontline.js'); assert.equal(sb.PXCREW.state().stats.water, 1);
  /* cano travado: com guarnição, metade do tempo */
  a.seized = true; a.swapUntil = sb.time + 20; sb.run(.1);
  assert.ok(Math.abs(a.swapUntil - sb.time - 10) < .3, 'troca de cano em ~10 s com guarnição');
}
/* ---------- sobras se juntam; reforço entra na guarnição incompleta ---------- */
{
  const sb = engine(); const a = sb.newUnit('mg', 0, 1000, 800); sb.run(.6); const b = sb.newUnit('mg', 0, 1040, 820); sb.run(.6);
  assert.equal(C(sb).length, 1, 'MG sozinha perto de outra guarnição incompleta entra nela');
  const c = C(sb)[0]; assert.equal(c.gun, a); assert.equal(c.ld, b);
  const sb2 = engine(); const g1 = sb2.newUnit('mg', 0, 1000, 800), g2 = sb2.newUnit('mg', 0, 1300, 800); sb2.run(.6);
  assert.equal(C(sb2).length, 2); g2.x = 1050; sb2.run(.6);
  assert.equal(C(sb2).length, 1, 'duas armas sozinhas lado a lado viram uma guarnição'); assert.equal(sb2.PXCREW.state().stats.merges, 1);
}
/* ---------- ninho: auxiliar postado vira o atirador quando chega ---------- */
{
  const sb = engine(); sb.squad('mg', 0, 1000, 800); sb.run(.6); const c = C(sb)[0], ld = c.ld, old = c.gun;
  ld.post = { x: ld.x, y: ld.y }; sb.run(.1);
  assert.equal(c.gun, ld, 'quem chegou ao ninho assume a arma'); assert.equal(old.mgr, 'ld');
}
/* ---------- Modo Soldado: o jogador municia uma MG sozinha ---------- */
{
  const sb = engine(); const g = sb.newUnit('mg', 0, 1000, 800); sb.run(.6); sb.dummy(1200, 800);
  const me = sb.newUnit('rifle', 0, 1000, 815); me.noFire = true; sb.player = me; sb.mode = 'soldier'; sb.run(.6);
  assert.equal(C(sb).length, 1, 'o fuzileiro do jogador não entra na guarnição sozinho');
  const count = sec => { const n0 = sb.PXCREW.state().stats.gunShots; sb.run(sec); return sb.PXCREW.state().stats.gunShots - n0; };
  const solo = count(10);
  assert.equal(sb.PXCREW.feedLabel(g), 'E municiar a MG'); assert.ok(sb.PXCREW.feed(g)); assert.ok(sb.PXCREW.feeding());
  const fed = count(10);
  me.x = 1080; sb.run(.1); assert.ok(!sb.PXCREW.feeding(), 'longe da arma para de municiar');
  console.log(`  jogador municiando: ${fed} tiros em 10 s (atirador sozinho: ${solo})`);
  assert.ok(fed > solo * 1.8, 'o jogador municiando dá cadência cheia');
  me.x = 1000; sb.PXCREW.feed(g); sb.shoot(me, { x: 1200, y: 800 }, true); assert.ok(!sb.PXCREW.feeding(), 'atirar larga a fita');
  const sb2 = engine(); sb2.squad('mg', 0, 1000, 800); sb2.run(.6); assert.equal(sb2.PXCREW.feedable(C(sb2)[0].gun), false, 'guarnição completa: E assume a arma');
}
/* ---------- desligado: comportamento antigo (3 MGs) ---------- */
{
  const sb = engine(); sb.PXCREW.on = false; sb.squad('mg', 0, 1000, 800); sb.dummy(1200, 800); sb.run(5);
  const n = new Set(sb.bullets.filter(b => b.damage === 13).map(b => b.by.id)).size;
  assert.equal(n, 3, 'com ?guarnicao=0 cada homem atira a própria MG');
}
assert.equal(engine().PXCREW.state().stats.errors, 0);
console.log('Guarnição de MG 1.9: arma coletiva, cadência com/sem municiador, montagem, sucessão, fita, água, munição, fusão e ninho OK');
