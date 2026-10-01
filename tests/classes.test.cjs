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
    throwGrenade(u, tx, ty, byPlayer) { const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy) || 1, rg = Math.min(d, byPlayer ? 180 : 135), fl = .38 + rg / 380, tt = byPlayer ? 1.55 : fl + .75; sb.shells.push({ x: u.x + dx / d * rg, y: u.y + dy / d * rg, t: tt, dur: tt, fl, r: byPlayer ? 65 : 48, power: byPlayer ? 180 : 120, team: u.team, gren: 1 }); },
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
  sb.squad('assault', 1, 500, 500); assert.ok(sb.units.slice(-6).every(u => u.cls === 'assault' && u.gren === 5), 'Stoßtruppen levam 5 Stielhandgranaten');
  sb.squad('assault', 0, 500, 500); assert.ok(sb.units.slice(-6).every(u => u.cls === 'assault' && u.gren === 4), 'Trench Raiders levam 4 Mk2');
  assert.equal(sb.PXCLS.nameOf({ team: 0, cls: 'medic' }), 'Corpsman'); assert.equal(sb.PXCLS.nameOf({ team: 1, cls: 'medic' }), 'Sanitäter');
}

/* ---------- médico ---------- */
{
  const sb = engine(); const med = sb.u(0, 500, 500, 'medic'), e = sb.u(1, 600, 500, null);
  assert.equal(sb.IronFrontBrain.selectTarget(e, sb.units, 400), null, 'médico a 100 px não é escolhido como alvo');
  med.x = 560; assert.equal(sb.IronFrontBrain.selectTarget(e, sb.units, 400), med, 'a 40 px, no corpo a corpo, sim');
  // por nação: o Sanitäter alemão é poupado de mais longe (75 px) que o Corpsman americano (55 px); o americano anda 6% mais
  const zone = (team, d) => { const sb2 = engine(); const m = sb2.u(team, 500, 500, 'medic'), en = sb2.u(1 - team, 500 + d, 500, null); return sb2.IronFrontBrain.selectTarget(en, [m], 400) === m; };
  assert.ok(!zone(0, 58) && zone(0, 52), 'Corpsman: zona de 55 px'); assert.ok(zone(1, 72) && !zone(1, 78) && !zone(0, 72), 'Sanitäter: zona de 75 px');
  const mv = team => { const sb2 = engine(); const m = sb2.u(team, 500, 500, 'medic'); m.order = 'move'; m.tx = 900; m.ty = 500; m.cd = 99; sb2.run(4); return (m.x - 500) / 4; };
  const vm0 = mv(0), vm1 = mv(1); console.log(`  médico andando: Corpsman ${vm0.toFixed(1)} px/s · Sanitäter ${vm1.toFixed(1)} px/s`); assert.ok(vm0 > vm1 * 1.04 && vm0 < vm1 * 1.08, 'Corpsman 6% mais rápido');
  sb.run(1); assert.ok(med.cd >= .6, 'médico não dispara');
}

const NAC = ['EUA', 'Alemanha'];
/* ---------- granadeiro: ninho de MG e bunker (os dois lados) ---------- */
for (const t of [0, 1]) {
  const trial = cls => { const sb = engine(); const g = sb.u(t, 500, 500, cls); const crew = [0, 1, 2].map(i => { const m = sb.u(1 - t, 660, 495 + i * 5, null, 'mg'); m.cover = true; return m; });
    const bunker = { type: 'bunker', team: 1 - t, x: 680, y: 560, hp: 1000, maxhp: 1000 }; sb.buildings.push(bunker);
    sb.run(40); return { crewHp: crew.reduce((s, m) => s + Math.max(0, m.hp), 0), bunker: Math.max(0, bunker.hp), thrown: sb.PXCLS.stats.grenRifle, bonus: sb.PXCLS.stats.grenBonus }; };
  const plain = trial(null), gren = trial('grenadier');
  console.log(`  [${NAC[t]}] ninho de MG a 160 px, 40 s: fuzileiro → guarnição ${plain.crewHp} HP · granadeiro → ${gren.crewHp.toFixed(0)} HP, ${gren.thrown} granadas de fuzil, ${gren.bonus} acertos no ninho`);
  assert.equal(plain.crewHp, 330, 'o fuzileiro comum não alcança o ninho a 160 px');
  assert.ok(gren.crewHp < 330 * .4 && gren.thrown >= 1 && gren.bonus >= 1, 'o granadeiro limpa o ninho');
  const sbB = engine(); sbB.u(t, 500, 500, 'grenadier'); const bk = { type: 'bunker', team: 1 - t, x: 665, y: 500, hp: 1000, maxhp: 1000 }; sbB.buildings.push(bk); sbB.run(60);
  console.log(`  [${NAC[t]}] bunker de madeira (1000) a 165 px: granadeiro deixa ${Math.max(0, bk.hp).toFixed(0)} HP com ${sbB.PXCLS.stats.grenRifle} granadas de fuzil`);
  assert.ok(bk.hp <= 0 && sbB.PXCLS.stats.grenRifle >= 3, 'granadas de fuzil derrubam o bunker');
}
{ // janela de alcance da granada de fuzil por nação: EUA 55–180 px, Alemanha 60–170 px
  const win = (t, d) => { const sb = engine(); sb.u(t, 500, 500, 'grenadier'); const e = sb.u(1 - t, 500 + d, 500, null); e.cover = true; sb.run(4); return sb.PXCLS.stats.grenRifle > 0; };
  assert.ok(win(0, 178) && !win(0, 186) && win(0, 57) && !win(0, 52), 'VB: 55–180 px');
  assert.ok(win(1, 168) && !win(1, 176) && win(1, 62) && !win(1, 57), 'Gewehrgranate: 60–170 px');
}

/* ---------- granada de mão por nação: pavio, raio e dano (área × dano ∝ power·r²) ---------- */
{
  const hand = (t, cls) => { const sb = engine(); const u = sb.u(t, 500, 500, cls); sb.throwGrenade(u, 600, 500, false); const sh = sb.shells[0];
    const fuse = sh.t - sh.fl, r = sh.r, power = sh.power, x = sh.x, y = sh.y, tagged = sh.natH || null; sb.shells.length = 0;
    const tgt = []; for (let gx = -70; gx <= 70; gx += 4) for (let gy = -70; gy <= 70; gy += 4) { const e = sb.u(1 - t, x + gx, y + gy + 40, null); e.hp = e.maxhp = 1e6; tgt.push(e); }
    sb.explode(x, y + 40, r, power, t); const dmg = tgt.reduce((s, e) => s + (1e6 - e.hp), 0);
    return { fuse, r, power, dmg, lethal: r * (1 - 100 / power), tagged }; };
  const base = hand(0, null), us = hand(0, 'assault'), de = hand(1, 'assault'), usG = hand(0, 'grenadier');
  const row = (n, h) => `${n}: pavio ${h.fuse.toFixed(2)} s · raio ${h.r} · dano de centro ${h.power} · letal (≥100 HP) até ${h.lethal.toFixed(0)} px · área×dano ${(h.dmg / base.dmg * 100).toFixed(0)}% do genérico`;
  console.log('  ' + row('genérico (fuzileiro)', base)); console.log('  ' + row('EUA Mk2', us)); console.log('  ' + row('Alemanha Stielhandgranate', de));
  assert.equal(base.fuse.toFixed(2), '0.75'); assert.equal(base.tagged, null, 'fuzileiro sem classe não muda');
  assert.ok(us.fuse > base.fuse * 1.3 && de.fuse < base.fuse * .8, 'Mk2 pavio longo, Stielhandgranate curto');
  assert.ok(us.r < base.r && de.r > base.r, 'Mk2 raio menor, Stielhandgranate raio maior');
  assert.ok(us.dmg / base.dmg > .8 && us.dmg / base.dmg < 1.05 && de.dmg / base.dmg > .9 && de.dmg / base.dmg < 1.1, 'área×dano dentro de ±15% do genérico');
  assert.equal(usG.tagged, 'Mk2', 'o granadeiro também joga a granada da sua nação');
  assert.ok(us.lethal > de.lethal, 'Mk2 letal até mais longe do centro (mais punch)');
}

/* ---------- atirador designado (os dois lados) ---------- */
{
  const hitFrac = (team, cls, dist) => { const sb = engine(); const m = sb.u(team, 500, 500, cls), t = sb.u(1 - team, 500 + dist, 500, null); t.type = 'mg';
    let hits = 0, shots = 0; for (let i = 0; i < 600; i++) { m.cd = 0; m.rl = 0; sb.bullets.length = 0; m.suppression = 0;
      sb.PXCLS.tick(.3);
      if (!sb.bullets.length && dist <= 240) sb.shoot(m, t);
      for (const b of sb.bullets) { shots++; const reach = b.t * Math.hypot(b.vx, b.vy); if (reach < dist - 2) continue; const ang = Math.atan2(b.vy, b.vx); if (Math.abs(Math.tan(ang) * dist) < 3.5) hits++; } }
    return { hits, shots, p: shots ? hits / shots : 0 }; };
  const cad = (team, cls) => { const sb = engine(); sb.u(team, 500, 500, cls); const t = sb.u(1 - team, 800, 500, null); t.type = 'mg'; t.hp = t.maxhp = 1e9; sb.run(120); return sb.bullets.length / 120; };
  const R = {};
  for (const t of [0, 1]) R[t] = { r230: hitFrac(t, null, 230), m230: hitFrac(t, 'marksman', 230), m300: hitFrac(t, 'marksman', 300), m335: hitFrac(t, 'marksman', 335), m345: hitFrac(t, 'marksman', 345), m355: hitFrac(t, 'marksman', 355), rate: cad(t, 'marksman') };
  for (const t of [0, 1]) { const r = R[t]; console.log(`  [${NAC[t]}] alvo de 7 px: a 230 px fuzileiro ${(r.r230.p * 100).toFixed(0)}% · atirador ${(r.m230.p * 100).toFixed(0)}% | atirador a 300 px ${(r.m300.p * 100).toFixed(0)}% · 335 px ${r.m335.shots ? (r.m335.p * 100).toFixed(0) + '%' : 'sem tiro'} · 345 px ${r.m345.shots ? (r.m345.p * 100).toFixed(0) + '%' : 'sem tiro'} · 355 px ${r.m355.shots ? 'atira' : 'sem tiro'} | cadência ${(r.rate * 60).toFixed(1)} tiros/min`); }
  assert.ok(R[0].m300.p > .3 && R[1].m300.p > .3 && R[0].m230.p > R[0].r230.p * 2 && R[1].m230.p > R[1].r230.p * 2, 'os dois atiradores alcançam e acertam mais que o fuzileiro');
  assert.ok(R[0].m345.shots > 0 && R[0].m355.shots === 0, 'Springfield + Warner & Swasey: alcança 350 px, não 355');
  assert.ok(R[1].m300.shots > 0 && R[1].m345.shots === 0, 'Gewehr 98 + ZF: alcance 330 px (345 px já não)');
  assert.ok(R[0].m300.p > R[1].m300.p, 'Springfield mais preciso que o Gewehr 98 a 300 px');
  assert.ok(R[1].rate > R[0].rate * 1.1, 'Gewehr 98: ferrolho mais rápido (cadência maior)');
}

/* ---------- observador (os dois lados) ---------- */
{
  const sb = engine(); sb.u(0, 500, 500, 'observer'); sb.PXBAT.mission(0, 900, 500, 4, 80, 'he');
  sb.PXBAT.mission(0, 1500, 500, 4, 80, 'he');
  assert.equal(sb.missions[0].spread, 36, 'observador americano: dispersão −55%');
  assert.equal(sb.missions[1].spread, 80, 'fora da vista dele: sem correção');
  for (let i = 0; i < 6; i++) sb.u(1, 880 + i * 8, 520, null);
  sb.run(3); const call = sb.missions.find(m => m.count === 4 && Math.abs(m.spread - 70 * .45) < .01);
  assert.ok(call && Math.abs(call.x - 900) < 40, 'o observador pede fogo sobre o grupo inimigo (já corrigido)');
  const n = sb.missions.length; sb.run(10); assert.equal(sb.missions.length, n, 'espera 50 s entre pedidos');
  const sbD = engine(); sbD.u(1, 1800, 500, 'observer'); sbD.PXBAT.mission(1, 1800 - 530, 500, 4, 80, 'he'); sbD.PXBAT.mission(1, 1800 - 570, 500, 4, 80, 'he');
  assert.equal(sbD.missions[0].spread, 40, 'Beobachter: dispersão −50%, vê a 530 px'); assert.equal(sbD.missions[1].spread, 80, 'mas não a 570 px');
  const sbU = engine(); sbU.u(0, 500, 500, 'observer'); sbU.PXBAT.mission(0, 1030, 500, 4, 80, 'he'); sbU.PXBAT.mission(0, 1015, 500, 4, 80, 'he'); assert.equal(sbU.missions[0].spread, 80, 'BC americano não vê a 530 px'); assert.equal(sbU.missions[1].spread, 80, 'nem a 515 px');
  const calls = t => { const s2 = engine(); const ox = t ? 1900 : 500, sg = t ? -1 : 1; s2.u(t, ox, 500, 'observer'); for (let i = 0; i < 6; i++) s2.u(1 - t, ox + sg * (380 + i * 8), 520, null); s2.run(300); return s2.PXCLS.stats.obsCalls; };
  const cu = calls(0), cd = calls(1); console.log(`  observador: dispersão EUA −55% (vê 500 px, pede a cada 50 s) · Alemanha −50% (vê 560 px, pede a cada 42 s); pedidos em 300 s: EUA ${cu} · Alemanha ${cd}`);
  assert.ok(cd > cu, 'o Beobachter pede fogo com mais frequência');
}

/* ---------- tropa de assalto (os dois lados) ---------- */
const aslRun = t => { const sb = engine(); const a = sb.u(t, 500, 500, 'assault'), r = sb.u(t, 500, 600, null);
  for (const u of [a, r]) { u.order = 'move'; u.tx = u.x + 400; u.ty = u.y; }
  sb.run(4); return { va: (a.x - 500) / 4, vr: (r.x - 500) / 4 }; };
for (const t of [0, 1]) {
  const sb = engine(); const a = sb.u(t, 500, 500, 'assault'), r = sb.u(t, 500, 600, null);
  for (const u of [a, r]) { u.order = 'move'; u.tx = u.x + 400; u.ty = u.y; }
  sb.run(4); const va = (a.x - 500) / 4, vr = (r.x - 500) / 4;
  console.log(`  [${NAC[t]}] velocidade: assalto ${va.toFixed(1)} px/s · fuzileiro ${vr.toFixed(1)} px/s (${(va / vr).toFixed(2)}×)`);
  assert.ok(va > vr * (t ? 1.27 : 1.2), 'assalto mais rápido');
  a.suppression = r.suppression = 1.6; sb.run(3); console.log(`  [${NAC[t]}] supressão 1,6 depois de 3 s: assalto ${a.suppression.toFixed(2)} · fuzileiro ${r.suppression.toFixed(2)}`);
  assert.ok(a.suppression < r.suppression - .4, `supressão some mais rápido (${a.suppression.toFixed(2)} × ${r.suppression.toFixed(2)})`);
  const e = sb.u(1 - t, a.x + 260, a.y, null); a.moving = true; assert.equal(sb.IronFrontBrain.selectTarget(e, [a], 400), null, 'infiltração: avançando a 260 px não é escolhido');
  const v = sb.u(1 - t, a.x + 12, a.y, null); a.order = 'hold'; sb.run(2.5);
  assert.ok(v.hp <= 0 && sb.PXCLS.stats.meleeKills >= 1, 'corpo a corpo a < 20 px');
  const sb2 = engine(); sb2.u(t, 500, 500, 'assault'); const tg = sb2.u(1 - t, 600, 500, null); tg.cover = true; sb2.run(3);
  assert.ok(sb2.PXCLS.stats.aslGren >= 1, 'granada de mão em quem está abrigado'); assert.ok(sb2.PXCLS.stats['hand' + (t ? 'DE' : 'US')] >= 1, 'com o perfil da sua nação');
}
{ const u = aslRun(0), d = aslRun(1); assert.ok(d.va > u.va * 1.04, `Stoßtrupp (${d.va.toFixed(1)}) mais rápido que Trench Raider (${u.va.toFixed(1)})`); }
{ // furtividade: Stoßtrupp avançando some da mira além de 160 px; Trench Raider além de 190 px
  const sel = (t, d) => { const sb = engine(); const a = sb.u(t, 500, 500, 'assault'); a.moving = true; const e = sb.u(1 - t, 500 + d, 500, null); return sb.IronFrontBrain.selectTarget(e, [a], 400) === a; };
  console.log('  infiltração a 175 px: Raider é escolhido? ' + sel(0, 175) + ' · Stoßtrupp? ' + sel(1, 175) + ' (somem além de 190 / 160 px)');
  assert.ok(sel(0, 175) && !sel(1, 175) && sel(1, 150) && !sel(0, 200));
}
{ // arma de curta distância: dano por segundo contra alvo de 7 px, por faixa de distância (mini-motor: fuzileiro 30 de dano a cada 1,5 s)
  const dps = (t, cls, d) => { const sb = engine(); const u = sb.u(t, 500, 500, cls), e = sb.u(1 - t, 500 + d, 500, null); e.hp = e.maxhp = 1e9; let dmg = 0, tm = 0;
    for (let i = 0; i < 1500; i++) { u.cd = 0; sb.bullets.length = 0; sb.shoot(u, e); tm += u.cd;
      for (const b of sb.bullets) { const reach = b.t * Math.hypot(b.vx, b.vy); if (reach < d - 2) continue; const ang = Math.atan2(b.vy, b.vx); if (Math.abs(Math.tan(ang) * d) < 3.5) dmg += b.damage; } }
    return dmg / tm; };
  const D = [30, 50, 90, 130], T = {}; for (const [k, t, c] of [['fuz', 0, null], ['raider', 0, 'assault'], ['stoss', 1, 'assault']]) T[k] = D.map(d => dps(t, c, d));
  console.log('  dano/s a ' + D.join(' / ') + ' px → fuzileiro ' + T.fuz.map(v => v.toFixed(1)).join(' / ') + ' · Raider (M1897) ' + T.raider.map(v => v.toFixed(1)).join(' / ') + ' · Stoßtrupp (MP18) ' + T.stoss.map(v => v.toFixed(1)).join(' / '));
  assert.ok(T.raider[0] > T.fuz[0] * 1.5 && T.raider[1] > T.fuz[1] * 1.1, 'espingarda de trincheira muito melhor a 30–50 px');
  assert.ok(Math.abs(T.raider[3] / T.fuz[3] - 1) < .12, 'fora de 90 px o Raider usa o fuzil comum');
  assert.ok(T.stoss[1] > T.fuz[1] * 1.1 && T.stoss[2] > T.fuz[2] * 1.1 && T.stoss[1] < T.fuz[1] * 1.8, 'MP18: melhor que o fuzil até 120 px, sem exagero');
  assert.ok(Math.abs(T.stoss[3] / T.fuz[3] - 1) < .12, 'fora de 120 px o Stoßtrupp usa o fuzil comum');
  assert.ok(T.raider[2] < T.raider[0] * .6, 'espingarda perde força com a distância');
}
assert.equal(engine().PXCLS.stats.errors, 0);
console.log('Classes 1.9: distribuição, médico não combatente, granadeiro × ninho, atirador designado, observador e tropa de assalto OK');
