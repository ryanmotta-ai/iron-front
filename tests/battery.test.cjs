const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Carrega battery.js com um ambiente mínimo (sem DOM/canvas) e testa balística, missões, baixas,
// shrapnel x cobertura, cortina de fumaça, operação manual, reembolso, reposição de guarnição e logística.
const guns = [{ x: 170, y: 90, k: 'f' }, { x: 148, y: 238, k: 'h' }];
const dmg = [];
const sb = {
  console, Math, Array, Object, Map, Set,
  map: 'trenches', time: 0, shells: [], bullets: [], units: [], cam: { x: 0, y: 0 }, playerTeam: 0, started: false, soundOn: false, audio: null,
  vw: 320, vh: 180, W: 2400, H: 1600, mode: 'commander', player: null, keys: {}, mouse: { down: false }, sandbox: false,
  supplies: [500, 500], defs: { artillery: { cost: 320 } }, aiEnabled: [false, false], screenShake: 0,
  toast() {}, sound() {}, damage(u, n) { dmg.push([u, n]); }, protectedBy: u => u.cover ?? 1, explode() {},
  document: { querySelector: () => null }, PXW: { windVec: () => ({ x: 0, y: 0 }) },
  PX: { Z: .5, WW1: { PW: 1200, layout: () => ({ guns }) }, disc() {}, pline() {} },
};
sb.window = sb; sb.addEventListener = () => {};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/battery.js'), 'utf8'), sb);
const B = sb.PXBAT;
const run = (secs) => { for (let i = 0; i < 60 * secs; i++) { sb.time += 1 / 60; B.tick(1 / 60); } };
const team = t => B.batteries.filter(b => b.team === t);

assert.equal(B.batteries.length, 4, '2 peças × 2 lados');
assert.equal(team(1)[0].cx, 1200 - 172, 'lado Central é o espelho');
assert.ok(Math.abs(B.flightTime(400) - 1.8) < .05 && Math.abs(B.flightTime(1800) - 4.2) < .05, 'voo 1,8 s a 400 e 4,2 s a 1800');
assert.ok(B.flightTime(1000, true) > B.flightTime(1000, false), 'obuseiro voa em arco mais longo');
assert.deepEqual([4, 3, 2, 1, 0].map(B.crewRate), [1, .7, .4, .2, 0]);

// missão HE: cada tiro vira projétil físico com tempo de voo coerente
assert.equal(B.mission(0, 930, 400, 6, 50), true);
run(45);
const mine = sb.shells.filter(s => s.bat);
assert.equal(mine.length, 6);
assert.ok(mine.every(s => s.team === 0 && s.kind === 'he' && s.t > 1 && s.t < 6));
sb.shells.length = 0;

// shrapnel: no descampado machuca, na trincheira quase não (não abre cratera: detonate devolve true)
dmg.length = 0;
const open = { x: 100, y: 100, team: 1, type: 'rifle', hp: 100, cover: 1 }, trench = { x: 102, y: 100, team: 1, type: 'rifle', hp: 100, cover: .3 };
sb.units = [open, trench];
assert.equal(B.detonate({ kind: 'shrap', x: 100, y: 100, r: 80, power: 120, team: 0 }), true);
const dOpen = dmg.filter(d => d[0] === open).reduce((n, d) => n + d[1], 0), dTr = dmg.filter(d => d[0] === trench).reduce((n, d) => n + d[1], 0);
assert.ok(dOpen > 40 && dTr < dOpen * .2, `shrapnel: aberto ${dOpen.toFixed(0)} x trincheira ${dTr.toFixed(0)}`);
assert.equal(B.detonate({ kind: 'he' }), false, 'HE cai no explode padrão');

// fumaça: a cortina cega o tiro que a atravessa, não o que passa longe
const a = { x: 0, y: 500 }, b = { x: 400, y: 500 };
assert.equal(B.smokeBlocks(a, b), false, 'sem fumaça');
B.detonate({ kind: 'smoke', x: 200, y: 500, r: 58, team: 0 });
run(3);
assert.equal(B.smokeBlocks(a, b), true, 'cortina no caminho');
assert.equal(B.smokeBlocks({ x: 0, y: 900 }, { x: 400, y: 900 }), false, 'tiro longe da cortina');

// baixas e depósito
const b0 = team(0)[0];
B.blast(b0.cx * 2, b0.cy * 2, 200, 1000);
assert.ok(b0.crew.every(c => !c.alive), 'explosão forte elimina a guarnição');

// reembolso quando nenhuma bateria do lado pode atirar
for (const b of team(0)) for (const c of b.crew) c.alive = false;
sb.supplies[0] = 100;
assert.equal(B.mission(0, 900, 400, 4, 30), true);
assert.equal(sb.supplies[0], 420, 'custo do cartão devolvido');
assert.equal(B.mission(0, 900, 400, 4, 30, 'he', true), true);
assert.equal(sb.supplies[0], 420, 'contra-bateria não é reembolsada (não custou nada)');

// reposição: fuzileiro parado junto à peça assume o posto
const b1 = team(0)[1], rf = { x: b1.cx * 2 - 20, y: b1.cy * 2 + 10, team: 0, type: 'rifle', hp: 100, moving: false };
sb.units = [rf];
run(3.2);
assert.equal(rf.hp, 0, 'fuzileiro absorvido');
assert.equal(b1.crew.filter(c => c.alive).length, 1, 'posto reocupado');
const passer = { x: b1.cx * 2 - 20, y: b1.cy * 2 + 10, team: 0, type: 'rifle', hp: 100 };
sb.units = [passer];
for (let i = 0; i < 60 * 4; i++) { passer.x += 1.2; sb.time += 1 / 60; B.tick(1 / 60); }   // andando não é absorvido
assert.equal(passer.hp, 100, 'quem só passa não vira artilheiro');

// metralhamento atinge servidor descoberto
const b2 = team(1)[0]; sb.units = []; const c2 = b2.crew[0];
sb.bullets.push({ x: c2.x * 2, y: c2.y * 2, vx: 0, vy: 0, t: 1, team: 0, damage: 200 });
run(.1);
assert.equal(c2.alive, false, 'bala inimiga mata servidor a descoberto');

// logística: sem depósito o bonde não sai
const dep = B.depots[1]; dep.hp = 10; B.hitDepot(dep.x * 2, dep.y * 2, 90, 300);
assert.equal(dep.dead, true);
team(1)[1].ammo = 1; run(6);
assert.equal(B.wagons[1].st, 'idle', 'sem depósito, sem bonde');
const d0 = B.depots[0]; assert.equal(d0.dead, false);
team(0)[1].crew[0].alive = true; team(0)[1].ammo = 1; run(40);
assert.ok(team(0)[1].ammo > 1, 'com depósito, o bonde repõe projéteis');

// operação manual: assumir a peça, carregar e disparar escolhendo o momento
const m = team(0)[1];
for (const c of m.crew) { c.alive = true; c.hp = 100; } m.ammo = 10; m.queue.length = 0; m.ph = null; m.cool = 0; m.tgt = null;
const u = { x: m.cx * 2 - 10, y: m.cy * 2 + 10, hp: 100, type: 'rifle', team: 0 };
sb.player = u; sb.mode = 'soldier'; sb.units = [u];
assert.equal(B.take(u), true);
assert.equal(B.manning(), true);
for (let i = 0; i < 60 * 8; i++) { sb.time += 1 / 60; B.tick(1 / 60); B.manTick(1 / 60, u); }
assert.equal(m.ph, 2, 'peça pronta e com cordel esticado, esperando o jogador');
const before = sb.shells.length;
sb.mouse.down = true; B.manTick(1 / 60, u); sb.mouse.down = false;
for (let i = 0; i < 60; i++) { sb.time += 1 / 60; B.tick(1 / 60); B.manTick(1 / 60, u); }
assert.equal(sb.shells.length, before + 1, 'disparo manual gera projétil');
assert.equal(B.key('1'), true);
B.release();
assert.equal(B.manning(), false);
// A cortina coordenada nunca se transforma em explosivos por falta de fumaça.
sb.mode='commander';sb.player=null;
for(const b of team(0)){b.queue=[];b.ph=null;b.tgt=null;b.ammo=10;b.sp.smoke=0;b.shelter=0;for(const c of b.crew)c.alive=true}
assert.equal(B.mission(0,1200,500,5,50,'smoke',false,true),false);
assert.ok(team(0).every(b=>b.queue.length===0));
team(0)[0].sp.smoke=3;team(0)[1].sp.smoke=2;
assert.equal(B.mission(0,1200,500,5,50,'smoke',false,true),true);
assert.equal(team(0).reduce((n,b)=>n+b.queue.length,0),5);
assert.ok(team(0).every(b=>b.queue.every(j=>j.kind==='smoke')));
assert.equal(B.mission(0,1200,500,1,50,'smoke',false,true),false,'munição já reservada não pode ser prometida de novo');
console.log('battery.test ok');
