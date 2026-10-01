/* Testes da camada "atrito da frente" (dist/frontline.js).
   Carrega o arquivo de verdade num contexto `vm` com um mini-jogo (unidades, tiros, explosões, artilharia de mentira) e confere:
   lama (velocidade, duds/abafamento, atolamento de tanque, UXO), calor e água da MG, emperramento por sujeira e
   o avião de observação (dispersão da artilharia, flak, MGs antiaéreas, queda). O navegador continua sendo a verificação final. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'frontline.js'), 'utf8');

const BOOT = `
Math.random=(()=>{let s=20260930;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}})();
const W=2400,H=1600;
let units=[],buildings=[],bullets=[],particles=[],shells=[],corpses=[],points=[],fieldTrenches=[],allCraters=[],player=null,mode='commander',
time=0,map='forest',playerTeam=0,soundOn=false,serial=0,grid=new Map(),started=true,ended=false,sandbox=false,tab='units',placement=null,
supplies=[1000,1000],aiEnabled=[false,false],teamKills=[0,0];
const cam={x:0,y:0,z:1},mouse={x:0,y:0,wx:0,wy:0,down:false},keys={},selected=new Set(),weapon='rifle';
const defs={rifle:{rate:1.5,range:240},mg:{rate:.22,range:330},tank:{rate:3.2,range:370},cavalry:{rate:1.1},bunker:{rate:.2,range:360},artillery:{cost:160}};
const log={toasts:[],explodes:[],missions:[]};
const $=()=>({textContent:''});function toast(s){log.toasts.push(s)}function sound(){}function hud(){}function makeCards(){}function icon(){}
function choose(t){placement=t}function place(){}function spend(type,team=0){const c=defs[type].cost;if(!sandbox&&supplies[team]<c)return false;if(!sandbox)supplies[team]-=c;return true}
function setup(){}
function findNearestCrater(x,y){for(const c of allCraters)if(Math.hypot(c.x-x,c.y-y)<c.r)return c;return null}
function damage(u,n){if(u.hp<=0)return;u.hp-=n}
function explode(x,y,r,power,team){log.explodes.push({x,y,r,power,team});for(const u of units){const d=Math.hypot(u.x-x,u.y-y);if(d<r)damage(u,power*(1-d/r))}}
function shoot(u,t,manual){u.cd=defs[u.type].rate;bullets.push({x:u.x,y:u.y,vx:1,vy:0,t:1,team:u.team,damage:10})}
function newUnit(type,team,x,y){const u={id:++serial,type,team,x,y,hp:100,maxhp:100,angle:team?Math.PI:0,cd:0,order:'hold',tx:x,ty:y,moving:false,suppression:0,target:null};units.push(u);return u}
function newBuilding(type,team,x,y){const b={id:++serial,type,team,x,y,hp:1000,maxhp:1000,cd:0};buildings.push(b);return b}
const SPEED={rifle:47,mg:34,cavalry:85,tank:28};
function update(dt){time+=dt;
 for(const u of units){u.cd=Math.max(0,u.cd-dt);u.moving=false;
  if(u.order==='move'){const dx=u.tx-u.x,dy=u.ty-u.y,l=Math.hypot(dx,dy);if(l>12){u.x+=dx/l*SPEED[u.type]*dt;u.y+=dy/l*SPEED[u.type]*dt;u.moving=true}}
  if(u.target&&u.target.hp>0&&u.cd<=0&&u.type!=='tank')shoot(u,u.target)}
 for(const b of buildings){if(b.type!=='bunker')continue;b.cd-=dt;const e=units.find(x=>x.team!==b.team&&Math.hypot(x.x-b.x,x.y-b.y)<360);if(e&&b.cd<=0){bullets.push({x:b.x,y:b.y,vx:1,vy:0,t:1,team:b.team,damage:15});b.cd=.2}}
 bullets=[];units=units.filter(u=>u.hp>0)}
`;

function makeWorld(seed = 20260930) {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error } });
  ctx.window = ctx;
  ctx.location = { search: '' };
  ctx.document = { querySelector: () => null, getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
  ctx.addEventListener = () => {};
  ctx.PX = { Z: 0.5 };
  ctx.__mud = 0;
  ctx.PXW = { mudAt: () => ctx.__mud, depth: () => 0, state: { snow: false, I: 0, fog: 0, cur: 'clear' }, windVec: () => ({ x: 0, y: 0, s: 0 }) };
  ctx.IronFrontBrain = { selectTarget: () => null };
  ctx.PXBAT = { mission: (team, x, y, count, spread) => { vm.runInContext(`log.missions.push({team:${team},x:${x},y:${y},spread:${spread}})`, ctx); return true; } };
  vm.runInContext(BOOT.replace('20260930', String(seed)), ctx);
  vm.runInContext(src, ctx, { filename: 'frontline.js' });
  const run = code => vm.runInContext(code, ctx);
  return { ctx, run };
}
const step = (run, n, dt = 1 / 30) => run(`for(let i=0;i<${n};i++)update(${dt})`);

/* ---------- constantes do projeto ---------- */
{
  const { run } = makeWorld();
  assert.equal(run('PXFL.cfg.MUD.DUD'), 0.2, '1 a cada 5 projéteis em lama saturada');
  assert.equal(run('PXFL.cfg.MUD.MUFFLE'), 0.25, 'raio letal abafado em 75%');
  assert.equal(run('PXFL.cfg.MG.WAT'), 4, 'camisa d\'água de 4 litros');
  assert.equal(run('PXFL.cfg.MG.SWAP'), 20, 'troca do cano: 20 s');
  assert.equal(run('PXFL.cfg.JAM.BASE'), 0.01); assert.equal(run('PXFL.cfg.JAM.MAX'), 0.18);
  assert.equal(run('PXFL.cfg.AIR.SPREAD'), 0.25, 'dispersão da artilharia −75%');
  assert.equal(run('PXFL.state().errors'), undefined);
  assert.equal(run('PXFL.stats.errors'), 0);
}

/* ---------- 1 · lama: infantaria a ~40% da velocidade ---------- */
{
  const speed = mud => {
    const { run, ctx } = makeWorld(); ctx.__mud = mud;
    run(`const u=newUnit('rifle',0,300,800);u.order='move';u.tx=2300;u.ty=800`);
    step(run, 90);
    return run('(units[0].x-300)/(time)');
  };
  const dry = speed(0), wet = speed(1), half = speed(.5);
  assert.ok(Math.abs(dry - 47) < 1, `chão seco: velocidade normal (${dry.toFixed(1)})`);
  assert.ok(wet / dry > 0.3 && wet / dry < 0.5, `lama saturada ≈40% (${(wet / dry * 100).toFixed(0)}%)`);
  assert.ok(half > wet && half < dry, 'lama parcial fica no meio');
}

/* ---------- 1 · lama: duds e abafamento ---------- */
{
  const count = mud => {
    const { run, ctx } = makeWorld(); ctx.__mud = mud;
    run('for(let i=0;i<2000;i++)explode(800+i%50,800,75,180,0)');
    const nExp = run('log.explodes.length'), small = run('log.explodes.filter(e=>e.r<30).length');
    return { nExp, small, duds: run('PXFL.stats.duds'), muffled: run('PXFL.stats.muffled'), uxo: run('PXFL.uxo().length'), minR: run('Math.min(...log.explodes.map(e=>e.r))') };
  };
  const dry = count(0), wet = count(1);
  assert.equal(dry.duds + dry.muffled, 0, 'em chão seco tudo detona');
  assert.ok(wet.duds / 2000 > 0.08 && wet.duds / 2000 < 0.12, `~10% duds (${wet.duds / 20}%)`);
  assert.ok(wet.muffled / 2000 > 0.08 && wet.muffled / 2000 < 0.12, `~10% abafadas (${wet.muffled / 20}%)`);
  assert.equal(wet.nExp, 2000 - wet.duds, 'dud não chama explode');
  assert.equal(wet.minR, 75 * 0.25, 'explosão abafada tem raio ×0,25');
  assert.equal(wet.uxo, 40, 'UXO limitado a 40 no chão');
  // explosão sem potência (destroço) nunca falha
  const { run, ctx } = makeWorld(); ctx.__mud = 1; run('for(let i=0;i<300;i++)explode(800,800,48,0,0)');
  assert.equal(run('PXFL.stats.duds+PXFL.stats.muffled'), 0, 'power 0 (carcaça de tanque) ignora a lama');
  // tanque esmaga o UXO e ele detona
  const w = makeWorld(); w.ctx.__mud = 1;
  w.run('PXFL.stats.duds=0;let i=0;while(PXFL.uxo().length<1&&i<200)explode(900,700,75,180,0),i++;const x=PXFL.uxo()[0];newUnit("tank",0,x.x+4,x.y);log.explodes.length=0');
  step(w.run, 2);
  assert.equal(w.run('PXFL.uxo().length'), 0, 'UXO some ao ser esmagado');
  assert.ok(w.run('log.explodes.length') >= 1, 'e detona sob o tanque');
}

/* ---------- 1 · lama: tanque atola na cratera encharcada ---------- */
{
  const { run, ctx } = makeWorld(); ctx.__mud = 1;
  run(`allCraters.push({x:900,y:800,r:150});const t=newUnit('tank',0,760,800);t.hp=1e9;t.order='move';t.tx=1400;t.ty=800`);
  let bogAt = null, stuck = null, freeAt = null;
  for (let i = 0; i < 30 * 50; i++) {
    run('update(1/30)');
    const b = run('units[0].atr.bog>time');
    if (b && bogAt === null) { bogAt = run('time'); stuck = run('units[0].x'); }
    if (b) assert.equal(run('units[0].x'), stuck, 'tanque atolado não sai do lugar');
    if (!b && bogAt !== null && freeAt === null) freeAt = run('time');
    if (freeAt !== null) break;
  }
  assert.ok(bogAt !== null && bogAt < 15, `tanque atola dentro da cratera encharcada (aos ${bogAt}s)`);
  assert.ok(freeAt - bogAt >= 8 && freeAt - bogAt <= 13.5, `fica preso de 8 a 13 s (${(freeAt - bogAt).toFixed(1)}s)`);
  // chão seco: nunca atola
  const d = makeWorld(); d.ctx.__mud = 0;
  d.run(`allCraters.push({x:900,y:800,r:150});const t=newUnit('tank',0,760,800);t.hp=1e9;t.order='move';t.tx=1400;t.ty=800`);
  step(d.run, 30 * 30);
  assert.equal(d.run('PXFL.stats.bogs'), 0, 'sem lama o tanque passa');
  assert.ok(d.run('units[0].x') > 1100);
}

/* ---------- 2 · metralhadora: calor, vapor, água, travamento e troca do cano ---------- */
{
  const { run } = makeWorld();
  run(`const g=newUnit('mg',0,700,800);const e=newUnit('rifle',1,900,800);e.hp=1e9;g.hp=1e9;g.target=e;PXFL.cfg.JAM.BASE=0;PXFL.cfg.JAM.MAX=0;
       fieldTrenches.push({team:0,x:500,y:800,hw:16,hh:16})`);
  let steam = null, runAt = null, refilled = null;
  for (let i = 0; i < 30 * 160; i++) {
    run('update(1/30)');
    const a = run('units[0].atr');
    if (steam === null && a.steam) steam = run('time');
    if (runAt === null && a.run) runAt = run('time');
    if (runAt !== null && refilled === null && !a.run) refilled = run('time');
    if (refilled !== null) break;
  }
  assert.ok(steam > 20 && steam < 60, `a água ferve depois de tiro sustentado (${steam.toFixed(0)} s)`);
  assert.ok(runAt > steam, 'o municiador só sai quando a água baixa');
  assert.ok(refilled - runAt >= 6 && refilled - runAt <= 38, `ida e volta à trincheira leva de 6 a 38 s (${(refilled - runAt).toFixed(1)}s)`);
  assert.equal(run('units[0].atr.wat'), 4, 'camisa cheia de novo');
  assert.ok(run('units[0].atr.T') <= 40, 'água nova resfria o cano');
  step(run, 2);
  assert.equal(run('PXFL.state().steam'), 0, 'depois de resfriar não há mais vapor');

  // sem água: trava, 20 s, volta com 2,2 L
  const w = makeWorld();
  w.run(`const g=newUnit('mg',0,700,800);const e=newUnit('rifle',1,900,800);e.hp=1e9;g.hp=1e9;g.target=e;PXFL.cfg.JAM.BASE=0;PXFL.cfg.JAM.MAX=0;
         const a=PXFL.st(g);a.wat=.05;a.T=100`);
  step(w.run, 30 * 5);
  assert.equal(w.run('units[0].atr.seized'), true, 'sem água o cano dilata e trava');
  const shotsBefore = w.run('PXFL.stats.seizures');
  const fired = () => w.run('units[0].cd');
  const t0 = w.run('time'); let back = null;
  for (let i = 0; i < 30 * 40; i++) { w.run('update(1/30)'); if (!w.run('units[0].atr.seized')) { back = w.run('time'); break } }
  assert.ok(back - t0 <= 20 && back - t0 >= 14, `troca do cano em até 20 s (${(back - t0).toFixed(1)}s)`);
  assert.equal(w.run('units[0].atr.wat'), 2.2); assert.equal(shotsBefore, 1);
  // durante a troca: +50% de dano
  const d = makeWorld();
  d.run(`const g=newUnit('mg',0,700,800);const a=PXFL.st(g);a.seized=true;a.swapUntil=time+20;const f=newUnit('rifle',0,800,800);PXFL.st(f);damage(g,10);damage(f,10)`);
  assert.equal(d.run('units[0].hp'), 85, 'cano em troca leva 50% a mais de dano');
  assert.equal(d.run('units[1].hp'), 90);
  // casamata: bunker esquenta e fuma
  const b = makeWorld();
  b.run(`const k=newBuilding('bunker',0,700,800);const e=newUnit('rifle',1,900,800);e.hp=1e9`);
  step(b.run, 30 * 60);
  assert.ok(b.run('buildings[0].atr.T') > 90, 'bunker também esquenta atirando');
}

/* ---------- 2 · vapor denuncia a MG para o inimigo ---------- */
{
  const { run, ctx } = makeWorld();
  run(`const g=newUnit('mg',0,1000,800);const a=PXFL.st(g);a.T=100;a.wat=3;const r=newUnit('rifle',1,1180,800);g.hp=1e9`);
  step(run, 3);
  assert.equal(run('PXFL.state().steam'), 1, 'MG fervendo entra na lista de vapor');
  const t = run('IronFrontBrain.selectTarget(units[1],units,240,null)');
  assert.ok(t && t.type === 'mg', 'fuzileiro inimigo escolhe a MG que está fumegando');
  run('units[0].atr.T=30');
  step(run, 2);
  assert.equal(run('IronFrontBrain.selectTarget(units[1],units,240,null)'), null, 'MG fria não é entregue pelo vapor');
}

/* ---------- 3 · emperramento por sujeira ---------- */
{
  const { run } = makeWorld();
  run('const u=newUnit("rifle",0,500,500);const m=newUnit("mg",0,520,500);PXFL.st(u);PXFL.st(m)');
  assert.ok(Math.abs(run('PXFL.jamP(units[0].atr,units[0])') - 0.01) < 1e-9, 'limpo: 1%');
  run('units[0].atr.dirt=1;units[1].atr.dirt=1');
  assert.ok(Math.abs(run('PXFL.jamP(units[0].atr,units[0])') - 0.18) < 1e-9, 'sujo: 18%');
  assert.ok(run('PXFL.jamP(units[1].atr,units[1])') < 0.03, 'MG (4,5 tiros/s) usa a mesma taxa por segundo: chance por tiro ≈ ×0,15');
  // frequência medida
  const jams = dirt => {
    const w = makeWorld(); w.run(`const u=newUnit('rifle',0,500,500);const a=PXFL.st(u);a.dirt=${dirt};const e=newUnit('rifle',1,640,500);e.hp=1e9;u.hp=1e9;u.target=e;globalThis.__n=0`);
    for (let i = 0; i < 30 * 4000; i++) { w.run('units[0].atr.dirt=' + dirt); w.run('update(1/30)'); }
    return w.run('PXFL.stats.jams');
  };
  // fuzileiro tenta atirar a cada 1,5 s (2,5 s quando emperra): ~2660 tentativas em 4000 s limpo, ~2300 sujo
  const j0 = jams(0), j1 = jams(1);
  assert.ok(j0 > 10 && j0 < 50, `sem sujeira ~1% dos tiros emperram (${j0})`);
  assert.ok(j1 > 350 && j1 < 480, `com sujeira máxima ~18% das tentativas (${j1} em ~2300)`);
  // desengasgar: 2–3 s de arma travada e imóvel, dano maior
  const w = makeWorld();
  w.run(`const u=newUnit('rifle',0,500,500);const a=PXFL.st(u);a.dirt=1;const e=newUnit('rifle',1,640,500);e.hp=1e9;u.hp=1e9;u.target=e;PXFL.startJam(u,a);u.order='move';u.tx=900;u.ty=500`);
  const x0 = w.run('units[0].x'); step(w.run, 15);
  assert.equal(w.run('units[0].x'), x0, 'desengasgando: soldado parado');
  assert.ok(w.run('units[0].atr.clearUntil-time') > 0, 'janela de 2–3 s');
  assert.ok(w.run('units[0].atr.clearUntil-(time-15/30)') <= 3.001);
  w.run('damage(units[0],10,1)');
  assert.equal(w.run('units[0].hp'), 1e9 - 12.5, 'vulnerável: +25% de dano');
  step(w.run, 30 * 4);
  assert.ok(w.run('units[0].x') > x0, 'depois de desemperrar volta a andar');
  // explosão a menos de 30 px suja a arma
  const s = makeWorld();
  s.run('const u=newUnit("rifle",0,500,500);PXFL.st(u);const f=newUnit("rifle",0,600,500);PXFL.st(f);explode(510,500,60,60,1)');
  assert.ok(s.run('units[0].atr.dirt') >= 0.6, 'explosão de terra a <30 px contamina a arma');
  assert.equal(s.run('units[1].atr.dirt'), 0, 'longe da explosão nada muda');
}

/* ---------- 4 · avião de observação: dispersão da artilharia e setor ---------- */
{
  const { run } = makeWorld();
  run('PXBAT.mission(0,1200,800,6,95)');
  assert.equal(run('log.missions[0].spread'), 95, 'sem observador: dispersão normal');
  run('const p=PXFL.launch(0,1200,800);p.st="orbit";p.x=1150;p.y=780');
  run('PXBAT.mission(0,1200,800,6,95)');
  assert.equal(run('log.missions[1].spread'), 95 * 0.25, 'com observador no setor: −75%');
  run('PXBAT.mission(0,1200,1400,6,95)');
  assert.equal(run('log.missions[2].spread'), 95, 'alvo fora do setor não melhora');
  run('PXBAT.mission(1,1200,800,6,95)');
  assert.equal(run('log.missions[3].spread'), 95, 'artilharia inimiga não ganha o observador');
  run('PXFL.planes()[0].st="down"');
  run('PXBAT.mission(0,1200,800,6,95)');
  assert.equal(run('log.missions[4].spread'), 95, 'avião abatido: acaba o benefício');
}

/* ---------- 4 · voo: entra, orbita 55 s, sai ---------- */
{
  const { run } = makeWorld();
  run('PXFL.launch(0,1200,800)');
  let inAt = null, orbAt = null, outAt = null, endAt = null, maxDev = 0;
  for (let i = 0; i < 30 * 120; i++) {
    run('update(1/30)');
    const p = run('PXFL.planes()[0]'); if (!p) { endAt = run('time'); break; }
    if (p.st === 'orbit' && orbAt === null) orbAt = run('time');
    if (p.st === 'orbit') maxDev = Math.max(maxDev, Math.hypot((p.x - 1200) / 300, (p.y - 800) / 190));
    if (p.st === 'out' && outAt === null) outAt = run('time');
  }
  assert.ok(orbAt > 5 && orbAt < 15, `chega ao setor em ~9 s (${orbAt.toFixed(1)})`);
  assert.ok(Math.abs((outAt - orbAt) - 55) < 1, `orbita por 55 s (${(outAt - orbAt).toFixed(1)})`);
  assert.ok(maxDev < 1.03, 'fica sobre a elipse do setor');
  assert.ok(endAt > outAt && endAt - outAt < 20, 'sai pelo lado do próprio exército');
}

/* ---------- 4 · flak, MG antiaérea e queda ---------- */
{
  // canhões inimigos derrubam o biplano que orbita em cima deles
  let downs = 0;
  for (let k = 0; k < 6; k++) {
    const { run } = makeWorld(1000 + k * 7919);
    run('PXFL.launch(0,1800,800)');
    for (let i = 0; i < 30 * 75; i++) { run('update(1/30)'); if (run('PXFL.planes().length===0')) break; }
    if (run('PXFL.stats.downed') > 0) downs++;
    assert.ok(run('PXFL.stats.flakShots') > 0, 'canhões antiaéreos abrem fogo');
  }
  assert.ok(downs >= 2 && downs <= 6, `orbitar sobre o flak inimigo costuma custar o avião (${downs}/6)`);
  // no meio do campo o avião sobrevive
  let alive = 0;
  for (let k = 0; k < 4; k++) {
    const { run } = makeWorld(5000 + k * 104729);
    run('PXFL.launch(0,1200,800)');
    for (let i = 0; i < 30 * 75; i++) { run('update(1/30)'); if (run('PXFL.planes().length===0')) break; }
    if (run('PXFL.stats.downed') === 0) alive++;
  }
  assert.equal(alive, 4, 'sobre a terra de ninguém o flak não alcança');
  // queda: estaca a cratera com explosão e deixa destroços
  const w = makeWorld();
  w.run('const p=PXFL.launch(0,1200,800);p.st="orbit";p.x=1200;p.y=800;newUnit("rifle",1,1200,800);PXFL.hitPlane(p,100,1,true);log.explodes.length=0');
  assert.equal(w.run('PXFL.planes()[0].st'), 'down');
  assert.ok(w.run('log.toasts.some(t=>/abatido/.test(t))'), 'avisa a queda');
  step(w.run, 30 * 4);
  assert.equal(w.run('PXFL.planes().length'), 0, 'avião caído sai da lista');
  assert.ok(w.run('log.explodes.some(e=>e.r===44&&e.power===70)'), 'cai explodindo no chão');
  // MGs apontadas para o céu derrubam o avião a pouca distância
  let shot = 0;
  for (let k = 0; k < 5; k++) {
    const m = makeWorld(9000 + k * 1299709);
    m.run('for(let i=0;i<4;i++)newUnit("mg",1,1250+i*8,800);const p=PXFL.launch(0,1200,800);p.st="orbit";p.x=1200;p.y=800;p.cx=1200;p.cy=800');
    for (let i = 0; i < 30 * 50; i++) { m.run('update(1/30)'); if (m.run('PXFL.planes().length===0')) break; }
    if (m.run('PXFL.stats.downed') > 0) shot++;
  }
  assert.ok(shot >= 2, `4 MGs inimigas derrubam o observador que passa perto (${shot}/5)`);
}

/* ---------- 4 · carta de Reconhecimento e chamada pelo jogador ---------- */
{
  const { run } = makeWorld();
  assert.ok(run('defs.recon&&defs.recon.cost===120'), 'defs.recon registrado');
  run('placement="recon"');
  const before = run('supplies[0]');
  run('place(1200,800)');
  assert.equal(run('supplies[0]'), before - 120, 'custa 120');
  assert.equal(run('PXFL.planes().length'), 1);
  assert.equal(run('placement'), null, 'consome o modo de posicionamento');
  run('supplies[0]=50;placement="recon";place(1200,800)');
  assert.equal(run('PXFL.planes().length'), 1, 'sem suprimento não decola');
  run('PXW.state.fog=.9;choose("recon")');
  assert.ok(run('log.toasts.some(t=>/Sem condições de voo/.test(t))'), 'neblina densa: aviões ficam em solo');
}

/* ---------- 4 · IA chama observador e desliga com ?frente=0 ---------- */
{
  const { run } = makeWorld();
  run('aiEnabled=[false,true];points.push({x:1200,y:800,owner:-1},{x:1000,y:800,owner:0});PXFL.reset()');
  step(run, 30 * 100);
  assert.ok(run('PXFL.stats.launched') >= 1, 'a IA manda o seu observador');
  const off = makeWorld();
  off.ctx.PXFL.on = false; off.run('const u=newUnit("rifle",0,300,800);u.order="move";u.tx=2300;u.ty=800'); off.ctx.__mud = 1;
  step(off.run, 90);
  assert.ok(Math.abs(off.run('(units[0].x-300)/time') - 47) < 1, 'PXFL.on=false devolve o jogo ao normal (sem lama extra)');
}

console.log('Frente 1.3: lama (velocidade, duds, abafamento, UXO, atolamento), calor/água da MG, vapor, emperramento e reconhecimento aéreo com flak OK');
