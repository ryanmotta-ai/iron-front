const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// soldier-gear.js (1.9, Modo Soldado): fôlego, ferrolho, munição finita do jogador (reserva, depósito, saque), granada cozida,
// cone de visão, escolha do soldado na frente (B7) + seta, e as correções B4 (troca pela pistola pelo NOME) e B10 (sem Thompson).
// O mini-jogo declara weapon/ammo/reload/... com `let` (como o game.js): `window.weapon = x` NÃO os altera, como no jogo de verdade.
// Para provar que o teste enxerga o B4:  GEAR_TACTICS=versoes/soldier-tactics.js.antes-soldado node tests/soldier-gear.test.cjs  (deve falhar)
const dist = f => fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8');
const gameSrc = dist('game.js').replace(/\r/g, '');
const line = re => { const m = gameSrc.match(re); assert.ok(m, 'trecho do game.js não encontrado: ' + re); return m[0]; };
const fnLine = n => line(new RegExp(`^function ${n}\\(.*$`, 'm'));
const GAME_BITS = [line(/^const WN=.*$/m), line(/^const wdef=.*$/m), line(/^const weapons=.*$/m), ...['reloadGun', 'changeWeapon', 'throwGrenade', 'grenade'].map(fnLine)].join('\n');

/* contrato: o mini-jogo abaixo reproduz estes trechos do game.js; se mudarem, o teste avisa */
assert.ok(/mouse\.down&&u\.cd<=0&&!reload&&\(ammo>0\|\|u\.type==='tank'\)/.test(gameSrc), 'contrato: o tiro do jogador é gated por u.cd/reload/ammo');
assert.ok(/if\(u\.thr>0\)\{u\.thr-=dt;if\(u\.tg&&u\.thr<=\.28\)\{throwGrenade\(u,u\.tg\.x,u\.tg\.y,u===player\)/.test(gameSrc), 'contrato: a granada sai quando thr<=.28');
assert.ok(/u\.x=clamp\(u\.x\+dx\/n\*d\.speed\*1\.65\*dt,20,W-20\)/.test(gameSrc), 'contrato: velocidade base do jogador 1,65x');
assert.ok(/if\(reload\)\{reload=Math\.max\(0,reload-dt\);if\(!reload\)\{ammo=weapons\[weapon\]\.mag;magazines\[weapon\]=ammo/.test(gameSrc), 'contrato: a recarga enche o pente inteiro');

const PRELUDE = `
const W=2400,H=1600;
let mode='soldier',started=true,ended=false,time=0,playerTeam=0,player=null,units=[],bullets=[],shells=[],particles=[],buildings=[],fieldTrenches=[],corpses=[],
 weapon='rifle',ammo=5,reload=0,grenadeCooldown=0,keys={},mouse={down:false,wx:0,wy:0,x:0,y:0},cam={x:0,y:0,z:1},vw=320,vh=180,soundOn=false,audio=null,sandbox=false,
 magazines={rifle:5,smg:20,pistol:7,shotgun:6};
const toasts=[],sounds=[],blasts=[],shots=[],defs={rifle:{speed:47,rate:1.5,range:240,damage:30},mg:{speed:34},tank:{speed:28}};
function toast(s){toasts.push(s)}
function sound(k){sounds.push(k)}
${GAME_BITS}
weapons.shotgun={name:'WINCHESTER 1897',mag:6,reload:2.8,rate:.75,damage:16,range:180,spread:.16};
function shoot(u,target,manual=false){const a=Math.atan2(mouse.wy-u.y,mouse.wx-u.x),d=weapons[weapon];u.cd=d.rate;bullets.push({x:u.x,y:u.y,vx:Math.cos(a)*800,vy:Math.sin(a)*800,t:.45,team:u.team,damage:d.damage});shots.push(time)}
function damage(u,n){u.hp-=n}
let probe=null;const renderVis=[];
function render(){if(window.PXW&&probe)renderVis.push(window.PXW.visible(probe))}
function hud(){}
function setup(){}
function setMode(next){mode=next}
function explode(x,y,r,power=100,team=0){blasts.push({x,y,r,power,t:time});for(const u of units){const d=Math.hypot(u.x-x,u.y-y);if(d<r)u.hp-=power*(1-d/r)}}
function update(dt){time+=dt;grenadeCooldown=Math.max(0,grenadeCooldown-dt);units=units.filter(u=>u.hp>0);
 if(reload){reload=Math.max(0,reload-dt);if(!reload){ammo=weapons[weapon].mag;magazines[weapon]=ammo;sound('click')}}
 for(const u of units){u.cd=Math.max(0,u.cd-dt);if(u.thr>0){u.thr-=dt;if(u.tg&&u.thr<=.28){throwGrenade(u,u.tg.x,u.tg.y,u===player);u.tg=null}if(u.thr<0)u.thr=0}
  if(u===player&&mode==='soldier'){let dx=(keys.d||keys.ArrowRight?1:0)-(keys.a||keys.ArrowLeft?1:0),dy=(keys.s||keys.ArrowDown?1:0)-(keys.w||keys.ArrowUp?1:0),n=Math.hypot(dx,dy)||1;
   u.x=Math.max(20,Math.min(W-20,u.x+dx/n*defs.rifle.speed*1.65*dt));u.y=Math.max(20,Math.min(H-20,u.y+dy/n*defs.rifle.speed*1.65*dt));u.moving=!!(dx||dy);u.angle=Math.atan2(mouse.wy-u.y,mouse.wx-u.x);
   if(mouse.down&&u.cd<=0&&!reload&&(ammo>0||u.type==='tank')){shoot(u,null,true);if(u.type!=='tank'){ammo--;magazines[weapon]=ammo;if(!ammo)reloadGun()}}}}
 for(const s of shells){s.t-=dt;if(s.gren){if(s.gz>0){s.gvz-=340*dt;s.gx+=s.gvx*dt;s.gy+=s.gvy*dt;s.gz+=s.gvz*dt;if(s.gz<=0){s.gz=0;s.gvx=s.gvy=s.gvz=0}}s.x=s.gx;s.y=s.gy}
  if(s.t<=0)explode(s.x,s.y,s.r,s.power||180,s.team)}
 shells=shells.filter(s=>s.t>0);for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt}bullets=bullets.filter(b=>b.t>0)}
`;

function mkCanvas(log) {
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => { log && log.push([String(k), a]); }), set: (o, k, v) => { o[k] = v; return true; } });
  return { width: 0, height: 0, getContext: () => ctx };
}
function mk({ gear = true, tactics = false } = {}) {
  const listeners = [];
  const drawLog = [], made = [];
  const sb = {
    console, Math, Array, Object, Map, Set, JSON, String, Number, Infinity, performance,
    location: { search: '' }, localStorage: { getItem: () => null, setItem() {} },
    PX: { Z: 0.5 }, document: { querySelector: () => null, getElementById: () => ({ textContent: '', style: {} }), createElement: () => { const c = mkCanvas(drawLog); made.push(c); return c; } },
    addEventListener: (t, f, cap) => listeners.push({ t, f, cap }), AudioNode: class { connect() { return this; } }, URLSearchParams,
  };
  sb.window = sb; sb.drawLog = drawLog; sb.made = made;
  vm.createContext(sb);
  vm.runInContext(PRELUDE, sb);
  const run = s => vm.runInContext(s, sb);
  const WW = { over(c, ox, oy, dt) { WW.base++; }, base: 0 }; sb.WW1A = WW;
  if (tactics) {
    sb.canvas = mkCanvas(); sb.selected = new Set(); sb.map = 'trenches'; sb.tab = 'units'; sb.placement = null; sb.maxUnits = 160;
    sb.screenShake = 0; sb.allCraters = []; sb.points = []; sb.planes = []; sb.supplies = [600, 600]; sb.aiEnabled = [false, true]; sb.hud = () => {}; sb.render = () => {}; sb.setup = () => {};
    sb.protectedBy = () => 1;
    vm.runInContext(dist('life-kit.js'), sb);
    const tf = process.env.GEAR_TACTICS ? path.join(__dirname, '..', process.env.GEAR_TACTICS) : path.join(__dirname, '../dist/soldier-tactics.js');
    vm.runInContext(fs.readFileSync(tf, 'utf8'), sb);
  }
  if (gear) { vm.runInContext(dist('life-kit.js'), sb); vm.runInContext(dist('soldier-gear.js'), sb); }
  let n = 0;
  const unit = (type, team, x, y, o = {}) => { const u = { id: ++n, type, team, x, y, hp: 100, maxhp: 100, angle: 0, cd: 0, suppression: 0, gren: type === 'rifle' ? 2 : 0, ...o }; run('units').push(u); return u; };
  const key = (type, k, extra = {}) => { const ev = { key: k, repeat: false, stopped: false, preventDefault() {}, stopImmediatePropagation() { ev.stopped = true; }, ...extra };
    if (type === 'keydown') run(`keys[${JSON.stringify(k.length === 1 ? k.toLowerCase() : k)}]=true`); else run(`keys[${JSON.stringify(k.length === 1 ? k.toLowerCase() : k)}]=false`);
    for (const l of listeners.filter(l => l.t === type)) { l.f(ev); if (ev.stopped) break; } return ev; };
  const step = (sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) sb.update(dt); };
  const t = { sb, run, unit, key, step, WW, listeners };
  t.me = unit('rifle', 0, 500, 500); run('player=units[0]'); run('mouse.wx=900;mouse.wy=500');
  return t;
}
const g = r => r.run('PXGEAR');
const lastToast = r => r.run('toasts[toasts.length-1]');

/* ---------------------------------------------------------------- B10: sem Thompson */
{
  const r = mk({ gear: false });
  assert.equal(r.run('WN[0].smg'), 'BAR M1918'); assert.equal(r.run('weapons.smg.name'), 'BAR M1918');
  assert.equal(r.run('WM[0].smg'), 20, 'o BAR M1918 usa pente de 20 como o antigo slot de SMG americana');
  for (const f of ['game.js', 'soldier-hud.js', 'soldier-combat.js', 'soldier-tactics.js', 'soldier-feel.js', 'soldier-gear.js']) assert.ok(!/thompson/i.test(dist(f)), `sem "Thompson" em ${f}`);
  console.log('  B10: slot 2 dos EUA = ' + r.run('weapons.smg.name') + ' (pente ' + r.run('weapons.smg.mag') + '), Alemanha = MP 18; nenhum "Thompson" restante nos arquivos do Modo Soldado');
}

/* ---------------------------------------------------------------- B4: troca para a pistola do caído pelo NOME */
{
  const r = mk({ tactics: true, gear: false }); const T = r.sb.PXST;
  r.run('ammo=3;magazines.rifle=5'); T.triggerDowned(r.me);
  assert.equal(r.run('weapon'), 'pistol', 'weapon (let do game.js) virou pistola');
  assert.equal(r.run('ammo'), 7, 'ammo (let) = pente da pistola'); assert.equal(r.run('magazines.rifle'), 3, 'o pente do fuzil foi guardado');
  // atira de verdade com a pistola (gate do game.js usa `ammo`)
  r.run('mouse.down=true;shots.length=0'); r.me.cd = 0; r.step(.1); r.run('mouse.down=false'); assert.ok(r.run('shots.length') >= 1); assert.equal(r.run('ammo'), 6);
  // revive: volta ao fuzil com o pente de antes
  console.log('  B4: caído → weapon=' + 'pistol' + ', ammo 7, pente do fuzil guardado (3); atirou com a pistola (ammo 7→6)');
  // saque sem o gear: também pelo nome
  const r2 = mk({ tactics: true, gear: false }); r2.run('ammo=0;magazines.rifle=0;corpses.push({x:505,y:500,looted:false})'); assert.ok(r2.sb.PXST.scavenge()); assert.equal(r2.run('ammo'), 5, 'saque sem o gear enche o pente (let) como antes');
}

/* ---------------------------------------------------------------- fôlego */
{
  const r = mk(), G = g(r);
  // andar (base) não gasta e não muda de velocidade
  r.key('keydown', 'd'); const x0 = r.me.x; r.step(2); const walk = (r.me.x - x0) / 2; r.key('keyup', 'd');
  assert.ok(Math.abs(walk - 47 * 1.65) < .5 && G.st.s === 100, `andar: ${walk.toFixed(1)} px/s, fôlego ${G.st.s}`);
  // sprint
  r.me.x = 500; r.key('keydown', 'Shift'); r.key('keydown', 'd'); const x1 = r.me.x; let secs = 0;
  while (!G.st.exh && secs < 20) { r.step(1 / 30); secs += 1 / 30; }
  const run = (r.me.x - x1) / secs;
  console.log(`  fôlego: andar ${walk.toFixed(1)} px/s · correr ${run.toFixed(1)} px/s (x${(run / walk).toFixed(2)}) · ${secs.toFixed(2)} s de corrida até EXAUSTO`);
  assert.ok(secs > 4.7 && secs < 5.4, 'cerca de 5 s de corrida');
  assert.ok(run / walk > 1.3 && run / walk < 1.4);
  // exausto: anda mais devagar e não corre
  const x2 = r.me.x; r.step(1); const tired = (r.me.x - x2) / 1;
  assert.ok(G.st.exh && tired < walk && tired > walk * .7, `exausto andando a ${tired.toFixed(1)} px/s`);
  r.key('keyup', 'd'); r.key('keyup', 'Shift');
  // recuperação parado (a partir do zero, logo depois de correr)
  G.st.s = 0; G.st.exh = true; G.st.delay = 0.7;
  let tr = 0; while (G.st.exh && tr < 30) { r.step(1 / 30); tr += 1 / 30; }
  let tf = tr; while (G.st.s < 99.5 && tf < 30) { r.step(1 / 30); tf += 1 / 30; }
  console.log(`  recuperação parado: sai do EXAUSTO em ${tr.toFixed(2)} s, fôlego cheio em ${tf.toFixed(2)} s`);
  assert.ok(tr > 2 && tr < 3 && tf > 6.4 && tf < 7.6);
  // andando recupera mais devagar
  G.st.s = 10; G.st.delay = 0; r.key('keydown', 'd'); r.step(3); r.key('keyup', 'd'); const walkRec = (G.st.s - 10) / 3;
  assert.ok(walkRec > 6 && walkRec < 8, `andando recupera ${walkRec.toFixed(1)}/s`);
  // respiração pesada afeta a mira (erro angular) e o ferrolho
  const err = s => { r.me.x = 500; r.me.y = 500; const e = []; for (let i = 0; i < 400; i++) { G.st.s = s; G.st.breath = Math.max(0, Math.min(1, (60 - s) / 60)); r.run('bullets.length=0'); r.me.cd = 0; r.run('mouse.wx=900;mouse.wy=500'); r.sb.shoot(r.me, null, true); const b = r.run('bullets')[0]; e.push(Math.atan2(b.vy, b.vx)); } const m = e.reduce((a, b) => a + b) / e.length; return Math.sqrt(e.reduce((a, b) => a + (b - m) ** 2, 0) / e.length); };
  const sd0 = err(100), sd1 = err(30), sd2 = err(0);
  console.log(`  mira: desvio angular do tiro com fôlego 100 / 30 / 0 = ${sd0.toFixed(4)} / ${sd1.toFixed(4)} / ${sd2.toFixed(4)} rad`);
  assert.ok(sd0 < .002 && sd1 > .015 && sd2 > .028);
  // correndo a arma fica baixada
  G.st.s = 100; G.st.exh = false; r.run('bullets.length=0;shots.length=0'); r.me.cd = 0; r.key('keydown', 'Shift'); r.key('keydown', 'd'); r.run('mouse.down=true'); r.step(1); const shotsRun = r.run('shots.length');
  r.key('keyup', 'Shift'); r.key('keyup', 'd'); r.step(.6); r.run('mouse.down=false');
  assert.equal(shotsRun, 0, 'correndo não atira'); assert.ok(r.run('shots.length') >= 1, 'solta o Shift e atira');
  // mira focada: Shift sem andar continua valendo (soldier-combat.js); o gear só tira o Shift quando há movimento
  assert.ok(/movingKeys && window\.PXGEAR && PXGEAR\.on/.test(dist('soldier-combat.js')));
}

/* ---------------------------------------------------------------- ferrolho: tiros/s antes × depois */
{
  const rate = ({ gear, sec = 60, mod }) => {
    const r = mk({ gear }); if (mod) mod(r); r.run('mouse.down=true;magazines.rifle=5'); r.run('shots.length=0');
    for (let i = 0; i < sec * 30; i++) { r.sb.update(1 / 30); if (gear && r.me.kitG) r.me.kitG.res.rifle = 99; }   // sem limite de reserva: mede só a cadência
    const s = r.run('shots'); const gaps = []; for (let i = 1; i < s.length; i++) gaps.push(s[i] - s[i - 1]);
    return { n: s.length, perS: s.length / sec, firstGaps: gaps.slice(0, 3), r };
  };
  const antes = rate({ gear: false }), depois = rate({ gear: true });
  // intervalo puro entre dois tiros do mesmo pente (sem recarga no meio)
  const gap = o => { const r = mk(o); r.run('mouse.down=true'); r.run('shots.length=0'); r.step(8); const s = r.run('shots'); return s.slice(1, 4).map((v, i) => +(v - s[i]).toFixed(2)); };
  console.log(`  ferrolho: antes ${antes.perS.toFixed(2)} tiros/s (${antes.n} em 60 s, intervalo ${gap({ gear: false })[0]} s) · depois ${depois.perS.toFixed(2)} tiros/s (${depois.n} em 60 s, intervalo ${gap({ gear: true })[0]} s), contando as recargas do pente de 5`);
  assert.ok(Math.abs(gap({ gear: false })[0] - 1.7) < .05 && Math.abs(gap({ gear: true })[0] - 1.2) < .06, 'ciclo EUA 1,2 s (antes 1,7 s)');
  const rg = mk(); rg.run('playerTeam=1'); rg.run('mouse.down=true'); rg.run('shots.length=0'); rg.step(8); const sg = rg.run('shots'); assert.ok(Math.abs(sg[2] - sg[1] - 1.3) < .06, 'Gewehr 98: 1,3 s');
  // sem fôlego o ferrolho demora mais
  const rb = mk(); rb.run('mouse.down=true;shots.length=0'); for (let i = 0; i < 240; i++) { Object.assign(g(rb).st, { s: 0, exh: true, delay: 1 }); rb.sb.update(1 / 30); } rb.run('mouse.down=false'); const sb2 = rb.run('shots');
  const slow = +(sb2[2] - sb2[1]).toFixed(2); console.log(`  ferrolho sem fôlego (EXAUSTO): intervalo ${slow} s (x${(slow / 1.2).toFixed(2)})`); assert.ok(slow > 1.6 && slow < 1.8);
  // o estado de ferrolho aparece e trocar de arma não zera o ciclo
  const rc = mk(); rc.run('mouse.down=true'); rc.step(.1); rc.run('mouse.down=false'); assert.ok(g(rc).state().bolt.t > .9);
  rc.sb.changeWeapon('pistol'); rc.sb.changeWeapon('rifle'); assert.ok(rc.me.cd > .8, 'o ciclo continua depois de trocar de arma e voltar');
  rc.step(.8); assert.ok(rc.run('sounds').includes('bolt'), 'toca o som do ferrolho no meio do ciclo');
  // IA: armas e economia da IA não mudam
  assert.equal(rc.run('weapons.rifle.mag'), 5); assert.equal(rc.run('weapons.rifle.reload'), 2.4); assert.equal(rc.run('weapons.rifle.rate'), 1.7);
}

/* ---------------------------------------------------------------- munição finita do jogador */
{
  const r = mk(), G = g(r);
  assert.equal(G.reserveOf('rifle'), ' +30'); assert.equal(r.me.kitG.res.smg, 60);
  // dispara os 5, recarrega sozinho, a reserva cai 5
  r.run('mouse.down=true;shots.length=0'); let guard = 0; while (r.run('ammo') > 0 && guard++ < 900) r.step(1 / 30);
  r.run('mouse.down=false'); assert.equal(r.run('ammo'), 0); assert.ok(r.run('reload') > 2.3 && r.run('reload') <= 2.4, 'recarga cheia do fuzil 2,4 s');
  r.step(2.5); assert.equal(r.run('ammo'), 5); assert.equal(r.me.kitG.res.rifle, 25, 'a recarga tirou 5 cartuchos da reserva');
  // pente quase cheio: recarga mais rápida e só pega o que falta
  r.run('ammo=3;magazines.rifle=3'); r.sb.reloadGun(); const rel = r.run('reload'); assert.ok(Math.abs(rel - 2.4 * (.4 + .6 * 2 / 5)) < .01, `recarga de 2 cartuchos em ${rel.toFixed(2)} s`);
  assert.equal(r.me.kitG.res.rifle, 23); r.step(rel + .1); assert.equal(r.run('ammo'), 5);
  // recarga cancelada (troca de arma) devolve os cartuchos
  r.run('ammo=1;magazines.rifle=1'); r.sb.reloadGun(); assert.equal(r.me.kitG.res.rifle, 19); r.sb.changeWeapon('pistol'); r.step(.1); assert.equal(r.me.kitG.res.rifle, 23, 'cancelou: reserva devolvida');
  r.sb.changeWeapon('rifle'); assert.equal(r.run('ammo'), 1);
  // pistola e BAR têm reservas próprias
  r.sb.changeWeapon('smg'); r.run('ammo=0;magazines.smg=0'); r.sb.reloadGun(); r.step(2.5); assert.equal(r.run('ammo'), 20); assert.equal(r.me.kitG.res.smg, 40);
  // acabou a reserva
  r.sb.changeWeapon('rifle'); r.me.kitG.res.rifle = 0; r.run('ammo=0;magazines.rifle=0'); r.run('toasts.length=0'); r.sb.reloadGun(); assert.equal(r.run('reload'), 0, 'sem reserva não recarrega');
  assert.ok(/Sem munição/.test(lastToast(r)));
  r.run('mouse.down=true;shots.length=0'); r.step(2); r.run('mouse.down=false'); assert.equal(r.run('shots.length'), 0, 'sem munição não atira');
  // saque de corpo (via soldier-tactics.js): reserva +10
  const rt = mk({ tactics: true }); const T = rt.sb.PXST; rt.run('corpses.push({x:rt.x||500,y:500,looted:false})'.replace('rt.x||500', '505'));
  rt.me.kitG = undefined; rt.me.gren = 0; const before = rt.sb.PXGEAR.kitOf(rt.me).res.rifle; rt.run('ammo=1'); const ok = T.scavenge();
  assert.ok(ok); assert.equal(rt.me.kitG.res.rifle, before + 10, 'saque: +10 cartuchos (2 pentes de fuzil)'); assert.equal(rt.run('ammo'), 1, 'o saque não enche o pente na mão'); assert.equal(rt.me.gren, 1);
  // depósito de munição (works.js): repõe a reserva e gasta 1 do estoque
  const rd = mk(); const dep = { team: 0, x: 540, y: 500, hp: 300, stock: 80 }; rd.sb.PXWORKS = { on: true, cfg: { DEPOT: { r: 140 } }, depots: () => [dep] };
  rd.me.kitG = undefined; rd.sb.PXGEAR.kitOf(rd.me).res.rifle = 4; rd.sb.PXGEAR.kitOf(rd.me).res.smg = 10; rd.step(3);
  assert.equal(rd.me.kitG.res.rifle, 30); assert.equal(rd.me.kitG.res.smg, 60); assert.equal(dep.stock, 79, 'um estoque por visita'); rd.step(6); assert.equal(dep.stock, 79, 'cheio: não gasta mais');
  const far = mk(); const dep2 = { team: 0, x: 900, y: 500, hp: 300, stock: 80 }; far.sb.PXWORKS = { on: true, depots: () => [dep2] }; far.sb.PXGEAR.kitOf(far.me).res.rifle = 4; far.step(4); assert.equal(far.me.kitG.res.rifle, 4, 'longe do depósito não repõe');
  // IA e MG não usam a reserva do jogador
  const ai = rd.unit('rifle', 1, 1500, 500); ai.ammo = 5; rd.step(1); assert.equal(ai.kitG, undefined); assert.equal(ai.ammo, 5);
  console.log(`  munição: reserva inicial fuzil 30/BAR 60/pistola 21/escopeta 18 · recarga completa 2,4 s, de 2 cartuchos ${rel.toFixed(2)} s · saque +10 · depósito repõe tudo (estoque 80→79)`);
}

/* ---------------------------------------------------------------- granada cozida */
{
  const trial = hold => { const r = mk(); r.run('mouse.wx=680;mouse.wy=500'); r.run('units[0].gren=2');
    const ev = r.key('keydown', 'g'); assert.ok(ev.stopped, 'o gear assume o G'); r.step(hold); r.key('keyup', 'g'); r.run('blasts.length=0'); let t = 0;
    while (!r.run('blasts.length') && t < 4) { r.step(1 / 60, 1 / 60); t += 1 / 60; }
    return { r, G: g(r), t, blast: r.run('blasts[0]'), life: r.me.hp }; };
  const tap = trial(.05), c07 = trial(.7), c10 = trial(1.0), c13 = trial(1.3);
  const info = x => `pavio ${x.G.state().lastThrow ? x.G.state().lastThrow.rem + ' s' : '—'}, explode ${x.blast ? Math.hypot(x.blast.x - 500, x.blast.y - 500).toFixed(0) + ' px' : '—'} após ${x.t.toFixed(2)} s do lance`;
  console.log(`  granada: toque ${info(tap)} · segurou 0,7 s: ${info(c07)} · 1,0 s: ${info(c10)} · 1,3 s: ${info(c13)}`);
  assert.ok(Math.abs(tap.G.state().lastThrow.rem - 1.55) < .1, 'o toque rápido mantém o pavio de 1,55 s de antes');
  assert.ok(c07.G.state().lastThrow.rem < tap.G.state().lastThrow.rem - .5);
  assert.ok(c13.G.state().lastThrow.rem < .4 && c13.G.state().lastThrow.rem < c13.G.state().lastThrow.fl, 'cozida demais: pavio curtíssimo');
  // explosão no ar: a granada ainda não chegou ao alvo (range 180) quando o pavio acaba
  const dTap = Math.hypot(tap.blast.x - 500, tap.blast.y - 500), d10 = Math.hypot(c10.blast.x - 500, c10.blast.y - 500);
  assert.ok(dTap > 150 && d10 < dTap - 30, `cozinhar 1,0 s detona no ar a ${d10.toFixed(0)} px (toque: ${dTap.toFixed(0)} px)`);
  assert.ok(g(c10.r).stats.airbursts >= 1);
  // passou do tempo: explode na mão
  const h = mk(); h.run('units[0].gren=2'); h.key('keydown', 'g'); h.run('blasts.length=0'); h.step(2); assert.equal(g(h).stats.handBlasts, 1); assert.equal(h.run('blasts.length'), 1);
  assert.ok(Math.hypot(h.run('blasts[0].x') - 500, h.run('blasts[0].y') - 500) < 8, 'explodiu em cima do jogador'); assert.ok(h.me.hp <= 0, 'letal'); assert.equal(g(h).state().cook, null);
  // sem granada / em cooldown / trégua: o G cai para o game.js normal
  const s0 = mk(); s0.run('units[0].gren=0'); assert.ok(!s0.key('keydown', 'g').stopped);
  const s1 = mk(); s1.run('grenadeCooldown=3'); assert.ok(!s1.key('keydown', 'g').stopped);
  const s2 = mk(); s2.sb.PXFORT = { isPrep: () => true }; assert.ok(!s2.key('keydown', 'g').stopped);
  assert.equal(c07.G.state().stats.cooks, 1);
  assert.equal(c07.r.run('grenadeCooldown') > 0, true);
}

/* ---------------------------------------------------------------- cone de visão */
{
  const r = mk(), G = g(r), V = G.vision; r.me.angle = 0; r.step(.1);
  const c = new Proxy({ _calls: [] }, { get: (o, k) => (k in o ? o[k] : (...a) => o._calls.push([k, a])), set: (o, k, v) => { o[k] = v; return true; } });
  const made0 = r.sb.made.length; G.drawCone(c, 0, 0); G.drawCone(c, 0, 0); G.drawCone(c, 0, 0);
  const di = c._calls.filter(x => x[0] === 'drawImage'), rot = c._calls.filter(x => x[0] === 'rotate');
  assert.equal(di.length, 3, 'um drawImage por quadro'); assert.equal(rot.length, 3); assert.equal(r.sb.made.length - made0, 1, 'a máscara é montada uma vez e reaproveitada');
  // inimigos fora do cone (> 160 m) somem; dentro ou perto não
  const ahead = r.unit('rifle', 1, 800, 500), behind = r.unit('rifle', 1, 200, 500), side = r.unit('rifle', 1, 500 + 300 * Math.cos(2.3), 500 + 300 * Math.sin(2.3)), nearBehind = r.unit('rifle', 1, 420, 500), friend = r.unit('rifle', 0, 200, 500);
  assert.equal(G.hidden(ahead), false); assert.equal(G.hidden(behind), true); assert.equal(G.hidden(side), true); assert.equal(G.hidden(nearBehind), false, 'a menos de 160 m vê'); assert.equal(G.hidden(friend), false, 'aliado sempre visível');
  const diag = r.unit('rifle', 1, 500 + 300 * Math.cos(.9), 500 + 300 * Math.sin(.9)); // 52° do eixo: dentro do cone de 62°
  assert.equal(G.hidden(diag), false);
  // a mira focada estreita o cone
  const flank = r.unit('rifle', 1, 500 + 300 * Math.cos(1.3), 500 + 300 * Math.sin(1.3)); assert.equal(G.hidden(flank), false, 'a 74° ainda vê com o cone normal');
  r.me.aiming = true; r.step(1); assert.ok(V.half < 45 && V.half >= 40, `mira focada: semi-ângulo ${V.half.toFixed(0)}°`); assert.equal(G.hidden(flank), true, 'fora do cone estreito');
  r.me.aiming = false; r.step(1); assert.ok(V.half > 60);
  V.set({ on: false }); const n0 = c._calls.length; G.drawCone(c, 0, 0); assert.equal(c._calls.length, n0, 'desligado: não desenha');
  // render: só esconde durante o render (a IA e a minimapa seguem usando o PXW.visible original)
  r.sb.PXW = { visible: () => true }; const vis0 = r.sb.PXW.visible; r.run('probe=units.find(u=>u.team===1&&u.x===200)'); V.set({ on: true, hide: true }); r.me.aiming = false; r.step(1);
  r.sb.render(); assert.equal(r.run('renderVis[0]'), false, 'dentro do render o inimigo atrás do jogador não é visto'); assert.equal(r.sb.PXW.visible, vis0, 'PXW.visible original restaurado'); assert.equal(r.sb.PXW.visible(behind), true, 'fora do render a visibilidade é a de sempre');
  V.set({ hide: false }); r.sb.render(); assert.equal(r.run('renderVis[1]'), true);
  console.log(`  cone: máscara reaproveitada (1 montagem p/ 3 quadros), semi-ângulo normal ${CFGHALF(r)}° (124° de campo) · mira focada 40° (80°)`);
}
function CFGHALF(r) { return g(r).cfg.CONE.HALF; }

/* ---------------------------------------------------------------- B7/U13: soldado na frente + seta */
{
  const r = mk(), G = g(r);
  // time 0 em x<1200; inimigos à frente. A "lista" começa pelo soldado da retaguarda (o que o game.js antigo escolhia)
  r.run('units.length=0');
  const rear = r.unit('rifle', 0, 200, 800), mid = r.unit('rifle', 0, 600, 800), melee = r.unit('rifle', 0, 1190, 800), front = r.unit('rifle', 0, 1040, 780), medic = r.unit('rifle', 0, 1020, 790, { down: true });
  r.unit('rifle', 1, 1200, 800); r.unit('rifle', 1, 1500, 700);
  r.run('player=null'); const pick = G.pick();
  assert.equal(pick, front, 'escolhe o fuzileiro da linha de contato (não o primeiro da lista, não o ferido, não o corpo a corpo)'); assert.notEqual(pick, rear);
  // sem contato: o mais avançado
  r.run('units.length=0'); const a = r.unit('rifle', 0, 200, 800), b = r.unit('rifle', 0, 900, 800); r.unit('rifle', 1, 2300, 800); assert.equal(G.pick(), b);
  // lado alemão
  r.run('units.length=0;playerTeam=1'); const e1 = r.unit('rifle', 1, 2200, 800), e2 = r.unit('rifle', 1, 1500, 800); r.unit('rifle', 0, 1300, 800); assert.equal(G.pick(), e2);
  // game.js usa o gancho no setMode e no renascimento
  assert.equal((gameSrc.match(/PXGEAR&&PXGEAR\.pick&&PXGEAR\.pick\(\)/g) || []).length, 2, 'game.js: setMode e renascimento escolhem pelo PXGEAR.pick');
  // seta na borda quando a frente está fora da tela
  r.run('units.length=0;playerTeam=0'); const me = r.unit('rifle', 0, 200, 800); r.run('player=units[0]'); r.unit('rifle', 0, 1040, 780); r.unit('rifle', 1, 1200, 800);
  r.step(1.5); const f = G.state().front; assert.ok(f && f.contact && f.x > 900, 'frente calculada: ' + JSON.stringify(f));
  const c = new Proxy({ _calls: [] }, { get: (o, k) => (k in o ? o[k] : (...a) => o._calls.push([k, a])), set: (o, k, v) => { o[k] = v; return true; } });
  r.run('vw=320;vh=180'); G.drawHud(c, 0, 0);   // jogador a 200,800 → tela (100,400) fora de 320×180? usa ox/oy para centrar
  c._calls.length = 0; G.drawHud(c, 60 - 100, 90 - 400);   // jogador no centro da tela, frente (≈840 px de distância) fora dela
  assert.ok(c._calls.some(x => x[0] === 'fill') && c._calls.some(x => x[0] === 'rotate'), 'desenhou a seta');
  const label = c._calls.filter(x => x[0] === 'fillRect').length; assert.ok(label > 10, 'rótulo FRENTE nnnM');
  console.log(`  frente: escolheu o fuzileiro a ${Math.hypot(pick.x - 1200, pick.y - 800).toFixed(0)} m do inimigo (a retaguarda estava a ${Math.hypot(rear.x - 1200, rear.y - 800).toFixed(0)} m) · frente em (${f.x}, ${f.y}) · seta desenhada`);
}


/* ---------------------------------------------------------------- chave de desligar (?soldado=0 / PXGEAR.on=false) */
{
  const r = mk(); g(r).on = false; r.run('mouse.down=true;shots.length=0'); r.step(8); const s = r.run('shots'); assert.ok(Math.abs(s[2] - s[1] - 1.7) < .05, 'desligado: cadência antiga de 1,7 s');
  assert.equal(r.sb.PXGEAR.pick(), null, 'desligado: o game.js cai no primeiro fuzileiro'); assert.equal(r.sb.PXGEAR.reserveOf('rifle'), '');
  r.run('mouse.down=false'); r.run('ammo=0;magazines.rifle=0'); r.sb.reloadGun(); assert.ok(r.run('reload') > 0, 'desligado: recarrega sem reserva'); r.run('keys.Shift=true;keys.d=true'); const x0 = r.me.x; r.step(1); assert.ok(Math.abs(r.me.x - x0 - 47 * 1.65) < 1, 'desligado: sem corrida');
  const off = mk(); off.sb.location.search = '?soldado=0'; vm.runInContext(dist('soldier-gear.js'), off.sb); assert.equal(off.sb.PXGEAR.on, false, '?soldado=0');
  console.log('  ?soldado=0 / PXGEAR.on=false: cadência 1,7 s, recarga sem reserva, sem corrida e sem escolha de frente (comportamento antigo)');
}

console.log('Equipamento 1.9: fôlego, ferrolho, munição finita, granada cozida, cone, frente, B4 e B10 OK');
