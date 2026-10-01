const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// classes.js (1.9) num mini-motor: distribuição automática, médico não combatente, granada de fuzil contra ninho/bunker,
// atirador designado (alcance e dispersão), observador (correção de tiro e pedido de fogo) e tropa de assalto
// (velocidade, supressão, infiltração, corpo a corpo). Cada classe com um número medido contra o fuzileiro comum.
let seed = 11; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function engine() {
  let serial = 0;
  const sb = {
    console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity,
    W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null,
    units: [], particles: [], buildings: [], bullets: [], shells: [], decor: [], fieldTrenches: [], trenchGrid: new Map(), allCraters: [],
    tickets: [500, 500], aiEnabled: [true, true], cam: { x: 0, y: 0 }, selected: new Set(), location: { search: '' }, tab: 'units',
    document: { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }) }), getElementById: () => null, querySelector: () => null },
    PX: { Z: .5 }, missions: [],
    defs: { rifle: { hp: 100, speed: 47, range: 240, rate: 1.5, damage: 30, count: 8 }, mg: { hp: 110, speed: 34, range: 330, rate: .22, damage: 13, count: 3 } },
    PXBAT: { mission(team, x, y, count, spread, kind) { sb.missions.push({ team, x, y, count, spread, kind }); return true; }, smokeBlocks: () => false },
    IronFrontBrain: { selectTarget(u, list, r, can) { let b = null, bd = r * r; for (const e of list) { if (e.team === u.team || e.hp <= 0) continue; const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2; if (d < bd && (!can || can(u, e))) { bd = d; b = e; } } return b; } },
    toasts: [], toast(s) { sb.toasts.push(s); }, setup() {}, finish() {}, makeCards() {}, icon() {},
    sightRange: r => r, protectedBy(u) { return u.cover ? .35 : 1; },
    newUnit(type, team, x, y) { const d = sb.defs[type]; const u = { id: ++serial, type, team, x, y, hp: d.hp, maxhp: d.hp, angle: 0, cd: 0, order: 'hold', tx: x, ty: y, suppression: 0, cohesion: 1, gren: type === 'rifle' ? 2 : 0, manualUntil: 0 }; sb.units.push(u); return u; },
    squad(type, team, x, y, count = sb.defs[type].count) { for (let i = 0; i < count; i++) sb.newUnit(type, team, x + i * 3, y); },
    shoot(u, target) { const a = Math.atan2(target.y - u.y, target.x - u.x) + (Math.random() * 2 - 1) * .09; u.cd = sb.defs[u.type].rate; sb.bullets.push({ x: u.x, y: u.y, vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, t: sb.defs[u.type].range / 800, team: u.team, damage: 30 }); },
    throwGrenade(u, tx, ty, byPlayer) { const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy) || 1, rg = Math.min(d, byPlayer ? 180 : 135); sb.shells.push({ x: u.x + dx / d * rg, y: u.y + dy / d * rg, t: 1, r: byPlayer ? 65 : 48, power: byPlayer ? 180 : 120, team: u.team, gren: 1 }); },
    explode(x, y, r, power, team) { for (const u of sb.units) { const d = Math.hypot(u.x - x, u.y - y); if (d < r) sb.damage(u, power * (1 - d / r), team); } for (const b of sb.buildings) if (Math.hypot(b.x - x, b.y - y) < r) b.hp -= power * 2; },
    damage(u, n) { if (u.hp <= 0) return; u.hp -= n; },
    update(dt) {
      sb.time += dt; sb.units = sb.units.filter(u => u.hp > 0); sb.buildings = sb.buildings.filter(b => b.hp > 0);
      for (const u of sb.units) { u.cd = Math.max(0, u.cd - dt); u.suppression = Math.max(0, u.suppression - dt * .18); u.moving = false;
        if (u.thr > 0) { u.thr -= dt; if (u.tg && u.thr <= .28) { sb.throwGrenade(u, u.tg.x, u.tg.y, false); u.tg = null; } }
        if (u.order === 'move') { const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy); if (d > 2) { const s = Math.min(d, 47 * dt); u.x += dx / d * s; u.y += dy / d * s; u.moving = true; } } }
      for (const s of sb.shells.slice()) { s.t -= dt; if (s.t <= 0) { sb.shells.splice(sb.shells.indexOf(s), 1); sb.explode(s.x, s.y, s.r, s.power, s.team); } }
    },
  };
  sb.window = sb; sb.addEventListener = () => {};
  vm.createContext(sb);
  for (const f of ['life-kit.js', 'classes.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), sb);
  sb.run = (sec, dt = .05) => { for (let t = 0; t < sec; t += dt) sb.update(dt); };
  sb.u = (team, x, y, cls, type = 'rifle') => { const u = sb.newUnit(type, team, x, y); if (cls !== undefined) { delete u.cls; if (cls) sb.PXCLS.give(u, cls); else u.gren = 2; } return u; };
  sb.setup();
  return sb;
}

/* ---------- distribuição ---------- */
{
  const sb = engine(); for (let i = 0; i < 160; i++) sb.newUnit('rifle', i % 2, 100, 100 + i);
  const n = sb.PXCLS.state().count;
  console.log(`  160 fuzileiros → ${JSON.stringify(n)}`);
  assert.equal(n['0:grenadier'], 10); assert.equal(n['0:medic'], 5); assert.equal(n['0:marksman'], 5); assert.ok(n['0:observer'] >= 1);
  sb.squad('specialists', 0, 500, 500); const sp = sb.units.slice(-4).map(u => u.cls).join(',');
  assert.equal(sp, 'medic,grenadier,marksman,observer', 'seção de especialistas');
  sb.squad('assault', 1, 500, 500); assert.ok(sb.units.slice(-6).every(u => u.cls === 'assault' && u.gren === 4), 'tropas de assalto');
}

/* ---------- médico ---------- */
{
  const sb = engine(); const med = sb.u(0, 500, 500, 'medic'), e = sb.u(1, 600, 500, null);
  assert.equal(sb.IronFrontBrain.selectTarget(e, sb.units, 400), null, 'médico a 100 px não é escolhido como alvo');
  med.x = 560; assert.equal(sb.IronFrontBrain.selectTarget(e, sb.units, 400), med, 'a 40 px, no corpo a corpo, sim');
  sb.run(1); assert.ok(med.cd >= .6, 'médico não dispara');
}

/* ---------- granadeiro: ninho de MG e bunker ---------- */
{
  const trial = cls => { const sb = engine(); const g = sb.u(0, 500, 500, cls); const crew = [0, 1, 2].map(i => { const m = sb.u(1, 670, 495 + i * 5, null, 'mg'); m.cover = true; return m; });
    const bunker = { type: 'bunker', team: 1, x: 690, y: 560, hp: 1000, maxhp: 1000 }; sb.buildings.push(bunker);
    sb.run(40); return { crewHp: crew.reduce((s, m) => s + Math.max(0, m.hp), 0), bunker: Math.max(0, bunker.hp), thrown: sb.PXCLS.stats.grenRifle, bonus: sb.PXCLS.stats.grenBonus }; };
  const plain = trial(null), gren = trial('grenadier');
  console.log(`  ninho de MG a 170 px, 40 s: fuzileiro → guarnição ${plain.crewHp} HP · granadeiro → guarnição ${gren.crewHp.toFixed(0)} HP, ${gren.thrown} granadas de fuzil, ${gren.bonus} acertos no ninho`);
  assert.equal(plain.crewHp, 330, 'o fuzileiro comum não alcança o ninho a 170 px');
  assert.ok(gren.crewHp < 330 * .4 && gren.thrown >= 1 && gren.bonus >= 1, 'o granadeiro limpa o ninho');
  const sbB = engine(); const gB = sbB.u(0, 500, 500, 'grenadier'); const bk = { type: 'bunker', team: 1, x: 680, y: 500, hp: 1000, maxhp: 1000 }; sbB.buildings.push(bk); sbB.run(40);
  console.log(`  bunker de madeira (1000) a 180 px, 40 s: granadeiro deixa ${Math.max(0, bk.hp).toFixed(0)} HP com ${sbB.PXCLS.stats.grenRifle} granadas (o fuzileiro não alcança)`);
  assert.ok(bk.hp <= 0 && sbB.PXCLS.stats.grenRifle >= 3, 'granadas de fuzil derrubam o bunker');
}

/* ---------- atirador designado ---------- */
{
  const hitFrac = (cls, dist) => { const sb = engine(); const m = sb.u(0, 500, 500, cls), t = sb.u(1, 500 + dist, 500, null); t.type = 'mg';
    let hits = 0, shots = 0; for (let i = 0; i < 400; i++) { m.cd = 0; m.rl = 0; sb.bullets.length = 0; m.suppression = 0;
      sb.PXCLS.tick(.3);
      if (!sb.bullets.length && dist <= 240) sb.shoot(m, t);
      for (const b of sb.bullets) { shots++; const reach = b.t * Math.hypot(b.vx, b.vy); if (reach < dist - 2) continue; const ang = Math.atan2(b.vy, b.vx); if (Math.abs(Math.tan(ang) * dist) < 3.5) hits++; } }
    return { hits, shots, p: shots ? hits / shots : 0 }; };
  const r240 = hitFrac(null, 230), m240 = hitFrac('marksman', 230), r300 = hitFrac(null, 300), m300 = hitFrac('marksman', 300);
  console.log(`  acerto num alvo de 7 px: a 230 px fuzileiro ${(r240.p * 100).toFixed(0)}% · atirador ${(m240.p * 100).toFixed(0)}% | a 300 px fuzileiro ${r300.shots} tiros · atirador ${(m300.p * 100).toFixed(0)}%`);
  assert.equal(r300.shots, 0, 'o fuzileiro não engaja a 300 px');
  assert.ok(m300.p > .3 && m240.p > r240.p * 2, 'o atirador alcança e acerta mais');
}

/* ---------- observador ---------- */
{
  const sb = engine(); sb.u(0, 500, 500, 'observer'); sb.PXBAT.mission(0, 900, 500, 4, 80, 'he');
  sb.PXBAT.mission(0, 1500, 500, 4, 80, 'he');
  assert.equal(sb.missions[0].spread, 40, 'alvo visto pelo observador: dispersão −50%');
  assert.equal(sb.missions[1].spread, 80, 'fora da vista dele: sem correção');
  for (let i = 0; i < 6; i++) sb.u(1, 880 + i * 8, 520, null);
  sb.run(3); const call = sb.missions.find(m => m.count === 4 && m.spread === 35);
  assert.ok(call && Math.abs(call.x - 900) < 40, 'o observador pede fogo sobre o grupo inimigo (já corrigido)');
  const n = sb.missions.length; sb.run(10); assert.equal(sb.missions.length, n, 'espera 45 s entre pedidos');
}

/* ---------- tropa de assalto ---------- */
{
  const sb = engine(); const a = sb.u(0, 500, 500, 'assault'), r = sb.u(0, 500, 600, null);
  for (const u of [a, r]) { u.order = 'move'; u.tx = u.x + 400; u.ty = u.y; }
  sb.run(4); const va = (a.x - 500) / 4, vr = (r.x - 500) / 4;
  console.log(`  velocidade: assalto ${va.toFixed(1)} px/s · fuzileiro ${vr.toFixed(1)} px/s`);
  assert.ok(va > vr * 1.2, 'assalto 25% mais rápido');
  a.suppression = r.suppression = 1.6; sb.run(3); assert.ok(a.suppression < r.suppression - .4, `supressão some 2× mais rápido (${a.suppression.toFixed(2)} × ${r.suppression.toFixed(2)})`);
  const e = sb.u(1, a.x + 260, a.y, null); a.moving = true; assert.equal(sb.IronFrontBrain.selectTarget(e, [a], 400), null, 'infiltração: avançando a 260 px não é escolhido');
  const v = sb.u(1, a.x + 12, a.y, null); a.order = 'hold'; sb.run(2.5);
  assert.ok(v.hp <= 0 && sb.PXCLS.stats.meleeKills >= 1, 'corpo a corpo a < 20 px');
  const sb2 = engine(); const a2 = sb2.u(0, 500, 500, 'assault'); const tg = sb2.u(1, 600, 500, null); tg.cover = true; sb2.run(3);
  assert.ok(sb2.PXCLS.stats.aslGren >= 1, 'granada de mão em quem está abrigado');
}
assert.equal(engine().PXCLS.stats.errors, 0);
console.log('Classes 1.9: distribuição, médico não combatente, granadeiro × ninho, atirador designado, observador e tropa de assalto OK');
