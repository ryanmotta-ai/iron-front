/* Testes da marcha humana (dist/gait.js).
   Carrega physics.js + gait.js num contexto `vm` com o mesmo mini-jogo do physics.test.cjs (todo mundo anda reto a 47 u/s e
   para a 12 u do destino) e confere o que o gait.js promete: ritmo individual, partida escalonada, giro com inércia, trajeto
   vivo, deslize ao parar, tempo de marcha próximo do original e as exclusões (jogador, MG, fixado, esquiva, tanque). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = f => fs.readFileSync(path.join(__dirname, '..', 'dist', f), 'utf8');
const PHYS = dist('physics.js'), GAIT = dist('gait.js');

const BOOT = `
Math.random=(()=>{let s=20260930;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}})();
const W=2400,H=1600,TAU=Math.PI*2;
let units=[],buildings=[],bullets=[],particles=[],shells=[],corpses=[],planes=[],points=[],fieldTrenches=[],decor=[],allCraters=[],player=null,mode='commander',
time=0,map='forest',gblast=false,playerTeam=0,soundOn=false,audio=null,screenShake=0,vw=960,vh=540,serial=0,grid=new Map();
const cam={x:0,y:0,z:1},mouse={x:0,y:0,wx:0,wy:0,down:false},defs={rifle:{rate:1.5},mg:{rate:.22},tank:{rate:3.2},cavalry:{rate:1.1}};
const $=()=>null;
function toast(){}function sound(){}function indexTerrainCover(){}function hud(){}function setup(){}function aiGrenade(){}
function findNearestCrater(){return null}function nearest(){return null}function bulletObstacleHit(){return false}
function damage(u,n){if(u.hp<=0)return;u.hp-=n}
function explode(x,y,r,power){for(const u of units){const d=Math.hypot(u.x-x,u.y-y);if(d<r)damage(u,power*(1-d/r))}}
function shoot(u,t,manual){u.lastShot=time;u.angle=Math.atan2(t.y-u.y,t.x-u.x)}
function newUnit(type,team,x,y){const u={id:++serial,type,team,x,y,hp:100,maxhp:100,angle:team?Math.PI:0,cd:0,order:'hold',tx:x,ty:y,moving:false,suppression:0,dodgeUntil:0,aiRole:''};units.push(u);return u}
const SPEED={rifle:47,mg:34,cavalry:85,tank:28};
function update(dt){time+=dt;for(const u of units){u.cd=Math.max(0,u.cd-dt);u.moving=false;if(u.order!=='move')continue;const dx=u.tx-u.x,dy=u.ty-u.y,l=Math.hypot(dx,dy);
  if(l<=12){u.order='hold';continue}u.x+=dx/l*SPEED[u.type]*dt;u.y+=dy/l*SPEED[u.type]*dt;u.moving=true;if(!u.target)u.angle=Math.atan2(dy,dx)}
 units=units.filter(u=>u.hp>0)}
`;

function makeWorld(search = '') {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error }, setTimeout: () => 0, performance });
  ctx.window = ctx;
  ctx.location = { search };
  ctx.document = { getElementById: () => null };
  ctx.PX = {
    Z: 0.5, ROADS: [185, 400, 610],
    riverX: y => (1190 + Math.sin(y * 2 / 160) * 70) / 2,
    riverHW: y => 14 + 3 * Math.sin(y * .09 + 1) + 1.5 * Math.sin(y * .23),
    disc() {}, ring() {}, pline() {}, dir8: () => 0, corpseSprite: () => ({ c: {}, ax: 0, ay: 0 })
  };
  ctx.PXW = { depth: () => 0, mudAt: () => 0, state: { snow: false, I: 0, mud: 0 } };
  ctx.PXGAME = { base: { craters: [] }, tctx: null };
  ctx.IronFront = {};
  vm.runInContext(BOOT, ctx);
  vm.runInContext(PHYS, ctx, { filename: 'physics.js' });
  vm.runInContext(GAIT, ctx, { filename: 'gait.js' });
  const run = code => vm.runInContext(code, ctx);
  return { ctx, run };
}

/* esquadrão de n fuzileiros em coluna, mandados 400 u para leste; devolve o registro de cada quadro */
function march({ on = true, n = 8, dist: D = 400, secs = 14, setup = '' } = {}) {
  const { run } = makeWorld(on ? '' : '?marcha=0');
  run(`for(let i=0;i<${n};i++){const u=newUnit('rifle',0,300,400+i*26);u.angle=0}${setup}`);
  run(`for(const u of units){u.order='move';u.tx=u.x+${D};u.ty=u.y}`);
  const dt = 1 / 30, T = Math.round(secs / dt), rec = [];
  const prev = run('units.map(u=>[u.x,u.y])');
  for (let i = 0; i < T; i++) {
    run(`update(${dt})`);
    rec.push(run('units.map(u=>[u.x,u.y,u.order,u.moving?1:0,u.angle])'));
  }
  return { run, rec, prev, dt, n };
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) };

/* ---------- 1. ritmo individual, partida escalonada, trajeto vivo, tempo de marcha ---------- */
{
  const A = march({ on: true }), B = march({ on: false });
  const arrive = M => Array.from({ length: M.n }, (_, i) => { const k = M.rec.findIndex(f => f[i][2] !== 'move'); return k < 0 ? Infinity : (k + 1) * M.dt });
  const first = M => Array.from({ length: M.n }, (_, i) => { const k = M.rec.findIndex(f => Math.hypot(f[i][0] - M.prev[i][0], f[i][1] - M.prev[i][1]) > 2); return k < 0 ? Infinity : (k + 1) * M.dt });
  const cruise = M => Array.from({ length: M.n }, (_, i) => { const a = M.rec.findIndex(f => f[i][0] - M.prev[i][0] > 120), b = M.rec.findIndex(f => f[i][0] - M.prev[i][0] > 300); return (M.rec[b][i][0] - M.rec[a][i][0]) / ((b - a) * M.dt) });
  const ta = arrive(A), tb = arrive(B), fa = first(A), fb = first(B), ca = cruise(A), cb = cruise(B);
  assert.ok(sd(cb) < .05 && mean(fb) < .2 && sd(fb) < .02, `sem a marcha humana todos partem juntos e andam iguais (v sd ${sd(cb).toFixed(3)}, partida ${mean(fb).toFixed(2)}±${sd(fb).toFixed(3)})`);
  assert.ok(sd(ca) > 1.1, `velocidades de cruzeiro diferem de soldado para soldado (sd ${sd(ca).toFixed(2)} u/s)`);
  assert.ok(Math.min(...ca) > 40 && Math.max(...ca) < 58, `e continuam numa faixa humana (${Math.min(...ca).toFixed(1)}–${Math.max(...ca).toFixed(1)} u/s)`);
  assert.ok(Math.max(...fa) - Math.min(...fa) > .12 && Math.max(...fa) < 1, `partida escalonada (${Math.min(...fa).toFixed(2)}–${Math.max(...fa).toFixed(2)} s)`);
  const dev = Math.abs(mean(ta) / mean(tb) - 1);
  assert.ok(dev < .05, `400 u levam o mesmo tempo ±5 % (gait ${mean(ta).toFixed(2)} s · original ${mean(tb).toFixed(2)} s · ${(dev * 100).toFixed(1)} %)`);
  // trajeto: desvio lateral do esquadrão (RMS, depois de tirar a linha reta) > 0 com a marcha, 0 sem ela
  const lat = M => mean(Array.from({ length: M.n }, (_, i) => { const ys = M.rec.filter(f => f[i][0] - M.prev[i][0] > 60 && f[i][0] - M.prev[i][0] < 330).map(f => f[i][1] - M.prev[i][1]); return sd(ys) }));
  assert.ok(lat(B) < .05 && lat(A) > .8 && lat(A) < 9, `trajeto vivo: desvio lateral ${lat(A).toFixed(2)} u (original ${lat(B).toFixed(2)})`);
  // chegada exata: ninguém passa de 25 u do destino e todos param
  const last = A.rec[A.rec.length - 1];
  for (let i = 0; i < A.n; i++) assert.ok(Math.hypot(last[i][0] - (A.prev[i][0] + 400), last[i][1] - A.prev[i][1]) < 25, `soldado ${i} chega perto do destino`);
  assert.equal(last.filter(f => f[3]).length, 0, 'todos parados no fim');
  assert.equal(A.run('PXGAIT.stats.errors'), 0);
  assert.ok(A.run('units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.angle))'), 'sem NaN');
  console.log(`  ritmo ${mean(ca).toFixed(1)}±${sd(ca).toFixed(2)} u/s (original ${mean(cb).toFixed(1)}) · partida ${mean(fa).toFixed(2)} s ±${sd(fa).toFixed(2)} (original ${mean(fb).toFixed(2)}) · desvio lateral ${lat(A).toFixed(2)} u · 400 u em ${mean(ta).toFixed(2)} s (original ${mean(tb).toFixed(2)})`);
}

/* ---------- 2. giro com inércia ---------- */
{
  const { run } = makeWorld();
  run(`const u=newUnit('rifle',0,600,600);u.order='move';u.tx=1000;u.ty=600`);
  const dt = 1 / 30; for (let i = 0; i < 90; i++) run(`update(${dt})`);          // 3 s andando para leste
  run(`units[0].tx=units[0].x;units[0].ty=units[0].y+300`);                            // vira 90° para o sul
  let prev = run('[units[0].x,units[0].y]'), prevH = null, peak = 0, minV = 1e9, v0 = null, vMid = [];
  for (let i = 0; i < 40; i++) {
    run(`update(${dt})`);
    const [x, y] = run('[units[0].x,units[0].y]'), dx = x - prev[0], dy = y - prev[1], v = Math.hypot(dx, dy) / dt, h = Math.atan2(dy, dx);
    if (prevH != null && v > 8) { let d = h - prevH; d = Math.atan2(Math.sin(d), Math.cos(d)); peak = Math.max(peak, Math.abs(d) / dt) }
    if (i > 2) minV = Math.min(minV, v);
    prev = [x, y]; prevH = h;
  }
  assert.ok(peak < 4.2, `o rumo da marcha gira no máximo ~3,4 rad/s (pico ${peak.toFixed(2)})`);
  assert.ok(minV < 44 && minV > 12, `cai a velocidade enquanto o corpo alinha (mín. ${minV.toFixed(1)} u/s)`);
  // o original vira de uma vez
  const { run: r0 } = makeWorld('?marcha=0');
  r0(`const u=newUnit('rifle',0,600,600);u.order='move';u.tx=1000;u.ty=600`);
  for (let i = 0; i < 90; i++) r0(`update(${dt})`);
  r0(`units[0].tx=units[0].x;units[0].ty=units[0].y+300`);
  let p0 = r0('[units[0].x,units[0].y]'), h0 = null, peak0 = 0;
  for (let i = 0; i < 40; i++) { r0(`update(${dt})`); const [x, y] = r0('[units[0].x,units[0].y]'), dx = x - p0[0], dy = y - p0[1], h = Math.atan2(dy, dx); if (h0 != null && Math.hypot(dx, dy) / dt > 8) { let d = h - h0; d = Math.atan2(Math.sin(d), Math.cos(d)); peak0 = Math.max(peak0, Math.abs(d) / dt) } p0 = [x, y]; h0 = h }
  assert.ok(peak0 > 6, `(controle) sem a marcha o rumo vira de uma vez: ${peak0.toFixed(1)} rad/s`);
  console.log(`  giro de 90°: pico ${peak.toFixed(2)} rad/s (original ${peak0.toFixed(1)}) · velocidade mínima na curva ${minV.toFixed(1)} u/s`);
}

/* ---------- 3. pivô: ordem para trás faz o corpo girar antes de andar ---------- */
{
  const { run } = makeWorld();
  run(`const u=newUnit('rifle',0,1000,800);u.angle=0;u.order='hold'`);
  const dt = 1 / 30; for (let i = 0; i < 40; i++) run(`update(${dt})`);                 // parado olhando para leste há 1,3 s
  run(`units[0].order='move';units[0].tx=700;units[0].ty=800`);                        // ordem para oeste (180°)
  let travel = 0, t180 = null, prevAng = 0;
  for (let i = 0; i < 40; i++) { const x0 = run('units[0].x'); run(`update(${dt})`); travel += Math.abs(run('units[0].x') - x0); const a = run('units[0].angle'); if (t180 == null && Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < .3) t180 = (i + 1) * dt }
  assert.ok(t180 != null && t180 > .3 && t180 < 1.2, `o corpo leva ${t180 && t180.toFixed(2)} s para virar 180° (0,3–1,2 s)`);
  assert.ok(run('units[0].angle') != null);
  console.log(`  meia-volta: corpo alinhado em ${t180.toFixed(2)} s`);
}

/* ---------- 4. deslize ao parar ---------- */
{
  const { run } = makeWorld();
  run(`const u=newUnit('rifle',0,500,500);u.order='move';u.tx=900;u.ty=500`);
  const dt = 1 / 30; for (let i = 0; i < 150; i++) run(`update(${dt})`);
  // ordem cancelada em pleno passo
  run(`units[0].order='hold'`);
  const xs = [run('units[0].x')]; for (let i = 0; i < 30; i++) { run(`update(${dt})`); xs.push(run('units[0].x')) }
  const slide = xs[xs.length - 1] - xs[0], stopT = xs.findIndex((x, i) => i > 0 && x - xs[i - 1] < .1) * dt;
  assert.ok(slide > 3 && slide < 20, `desliza ${slide.toFixed(1)} u até parar (3–20)`);
  assert.ok(stopT > .12 && stopT < .8, `para em ${stopT.toFixed(2)} s`);
  console.log(`  parada em pleno passo: desliza ${slide.toFixed(1)} u em ${stopT.toFixed(2)} s`);
}

/* ---------- 5. exclusões: quem a marcha humana não toca anda exatamente como no original ---------- */
{
  const same = (cfg, label) => {
    const run1 = o => { const { run } = makeWorld(o ? '' : '?marcha=0'); run(`const u=newUnit('${cfg.type || 'rifle'}',0,300,400);${cfg.setup || ''};u.order='move';u.tx=700;u.ty=400`); const out = []; for (let i = 0; i < 120; i++) { run('update(1/30)'); out.push(run('units[0].x')) } return out };
    const a = run1(true), b = run1(false);
    for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-6, `${label}: posição igual à do original no quadro ${i} (${a[i]} × ${b[i]})`);
  };
  same({ type: 'tank' }, 'tanque'); same({ type: 'cavalry' }, 'cavalaria');
  same({ setup: 'u.mgc=1' }, 'guarnição de MG'); same({ setup: 'u.pinned=1' }, 'fixado pelo fogo'); same({ setup: 'u.dodgeUntil=99' }, 'esquivando');
  same({ setup: "u.sap=1;u.sapState='dig'" }, 'pioneiro cavando'); same({ setup: "u.sap=1;u.sapState='walk';u.sapEvade=99" }, 'pioneiro fugindo de obus'); same({ setup: 'u.sap=1;u.sapProne=99' }, 'pioneiro deitado'); same({ setup: 'u.down=1' }, 'ferido'); same({ setup: 'u.lunge=1' }, 'baioneta');
  same({ setup: 'player=u;mode=\'soldier\'' }, 'jogador no Modo Soldado');
  same({ setup: 'u.lf={tr:{}}' }, 'em trincheira');
  const { run } = makeWorld(); run(`const u=newUnit('rifle',0,300,400);u.order='move';u.tx=700;u.ty=400`); run('update(1/30)');
  assert.ok(run('!!units[0].gt'), 'o fuzileiro comum recebe u.gt');
  const { run: rs } = makeWorld(); rs(`const u=newUnit('rifle',0,300,400);u.sap=1;u.sapTmp=1;u.sapState='walk';u.order='move';u.tx=700;u.ty=400`); rs('update(1/30)');
  assert.ok(rs('!!units[0].gt'), 'pioneiro a caminho da obra (e a tropa da trégua) recebe u.gt');
  console.log('  exclusões: tanque, cavalaria, MG, fixado, esquiva, pioneiro cavando/deitado/fugindo, ferido, baioneta, jogador e trincheira andam como no original');
}

/* ---------- 5b. quem volta de uma inelegibilidade curta (trincheira, esquiva, fixado, obus) não ganha atraso de reação ---------- */
{
  for (const [label, on, off] of [['saída de trincheira', 'units[0].lf={tr:{}}', 'units[0].lf=null'], ['fim de esquiva', 'units[0].dodgeUntil=time+.4', 'units[0].dodgeUntil=0'], ['soltura do fogo', 'units[0].pinned=1', 'units[0].pinned=0']]) {
    const { run } = makeWorld();
    run(`const u=newUnit('rifle',0,300,400);u.order='move';u.tx=1200;u.ty=400`);
    const dt = 1 / 30; for (let i = 0; i < 150; i++) run(`update(${dt})`);          // 5 s andando
    run(on); for (let i = 0; i < 12; i++) run(`update(${dt})`); run(off);              // 0,4 s fora da marcha humana
    let minV = 1e9, prev = run('units[0].x');
    for (let i = 0; i < 45; i++) { run(`update(${dt})`); const x = run('units[0].x'); minV = Math.min(minV, (x - prev) / dt); prev = x }
    assert.ok(minV > 35, `${label}: quem já anda não pára de novo para reagir (mín. ${minV.toFixed(1)} u/s)`);
  }
  console.log('  inelegibilidade curta (trincheira, esquiva, fixado): sem tranco na volta');
}

/* ---------- 6. retirada e assalto não esperam ---------- */
{
  const { run } = makeWorld();
  run(`const u=newUnit('rifle',0,300,400);u.order='retreat';u.tx=700;u.ty=400;u.aiRole=''`);
  // mini-jogo só anda em 'move': mesmo assim o hook deve zerar o atraso para retirada
  run(`units[0].order='move';units[0].aiRole='assalto'`);
  const dt = 1 / 30; let t0 = null; for (let i = 0; i < 30; i++) { run(`update(${dt})`); if (t0 == null && run('units[0].x') - 300 > 2) t0 = (i + 1) * dt }
  assert.ok(t0 != null && t0 < .45, `assalto parte sem atraso de reação (${t0 && t0.toFixed(2)} s)`);
  console.log(`  assalto parte em ${t0.toFixed(2)} s`);
}

/* ---------- 7. desligar ---------- */
{
  const { run } = makeWorld('?marcha=0');
  assert.equal(run('PXGAIT.on'), false);
  assert.equal(run('PXGAIT.state().on'), false);
}
console.log('Marcha 1.11: ritmo individual, partida escalonada, giro com inércia, pivô, trajeto vivo, deslize ao parar, tempo de marcha e exclusões OK');
