/* Testes da camada de física (dist/physics.js).
   Carrega o arquivo de verdade num contexto `vm` com um mini-jogo de mentira (unidades, balas, obstáculos) e confere:
   separação, inércia, paredes, tiro varrido, trincheira, blindagem, cinemática de tanque, esmagamento, onda de choque,
   estilhaços, correnteza e as constantes do projeto. O navegador continua sendo a verificação final (render, terreno, clima). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'physics.js'), 'utf8');

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
function newBuilding(type,team,x,y){const b={id:++serial,type,team,x,y,hp:1000,maxhp:1000,cd:0};buildings.push(b);return b}
const SPEED={rifle:47,mg:34,cavalry:85,tank:28};
function update(dt){time+=dt;grid.clear();for(const u of units){const k=Math.floor(u.x/160)+','+Math.floor(u.y/160);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(u)}
 for(const u of units){u.cd=Math.max(0,u.cd-dt);u.moving=false;if(u.order!=='move')continue;const dx=u.tx-u.x,dy=u.ty-u.y,l=Math.hypot(dx,dy);
  if(l<=12){u.order='hold';continue}u.x+=dx/l*SPEED[u.type]*dt;u.y+=dy/l*SPEED[u.type]*dt;u.moving=true;u.angle=Math.atan2(dy,dx)}
 buildings=buildings.filter(b=>b.hp>0);units=units.filter(u=>u.hp>0)}
`;

function makeWorld() {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error }, setTimeout: () => 0, performance });
  ctx.window = ctx;
  ctx.location = { search: '' };
  ctx.document = { getElementById: () => null };
  ctx.PX = {
    Z: 0.5, ROADS: [185, 400, 610],
    riverX: y => (1190 + Math.sin(y * 2 / 160) * 70) / 2,
    riverHW: y => 14 + 3 * Math.sin(y * .09 + 1) + 1.5 * Math.sin(y * .23),
    disc() {}, ring() {}, pline() {}, dir8: () => 0, corpseSprite: () => ({ c: {}, ax: 0, ay: 0 })
  };
  ctx.PXW = { depth: (x, y) => ctx.__wet && ctx.__wet(x, y) || 0, mudAt: () => ctx.__mud || 0, state: { snow: false, I: 0, mud: 0 } };
  ctx.PXGAME = { base: { craters: [] }, tctx: null };
  ctx.IronFront = {};
  vm.runInContext(BOOT, ctx);
  vm.runInContext(src, ctx, { filename: 'physics.js' });
  const run = code => vm.runInContext(code, ctx);
  return { ctx, run };
}
const step = (run, n, dt = 1 / 30) => run(`for(let i=0;i<${n};i++)update(${dt})`);

/* ---------- constantes do projeto ---------- */
{
  const { run } = makeWorld();
  assert.equal(run('PHYS.cfg.G_PX'), 380, 'gravidade das granadas = 380 px/s²');
  assert.equal(run('PHYS.cfg.E_GREN'), 0.35, 'restituição das granadas = 0,35');
  assert.equal(run('PHYS.cfg.R.rifle'), 7); assert.equal(run('PHYS.cfg.R.tank'), 26);
  assert.equal(run('PHYS.state().errors'), 0);
}

/* ---------- 1.1 separação elástica ---------- */
{
  const { run } = makeWorld();
  run(`for(let i=0;i<14;i++)newUnit('rifle',0,500+(i%3)*.5,500+(i%2)*.5)`);
  step(run, 90);
  const minD = run(`(()=>{let m=1e9;for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++)m=Math.min(m,Math.hypot(units[i].x-units[j].x,units[i].y-units[j].y));return m})()`);
  assert.ok(minD > 12, `soldados empilhados devem se afastar até perto de 2R=14 (mín. ${minD.toFixed(1)})`);
  assert.equal(run('units.filter(u=>u.moving).length'), 0, 'ao se acomodar ninguém segue tremendo');
  // tanque empurra infantaria, infantaria quase não move o tanque
  const { run: r2 } = makeWorld();
  r2(`const t=newUnit('tank',0,800,800);const f=newUnit('rifle',1,810,800);PHYS.pv(t);PHYS.pv(f)`);
  step(r2, 30);
  const [dt_, df_] = [r2('Math.hypot(units[0].x-800,units[0].y-800)'), r2('Math.hypot(units[1].x-810,units[1].y-800)')];
  assert.ok(df_ > dt_ * 4, `o tanque (massa 16) cede bem menos que o soldado (${dt_.toFixed(1)} vs ${df_.toFixed(1)})`);
}

/* ---------- 1.2 inércia: acelera, desliza ao parar, lama desliza mais ---------- */
{
  const { run, ctx } = makeWorld();
  run(`const u=newUnit('rifle',0,400,300);u.order='move';u.tx=900;u.ty=300;u.manualUntil=1e9`);
  const sp = [];
  for (let i = 0; i < 12; i++) { step(run, 1); sp.push(run('Math.hypot(units[0].pv.vx,units[0].pv.vy)')); }
  assert.ok(sp[0] < 25 && sp[11] > 44, `acelera em rampa (primeiro ${sp[0].toFixed(1)}, depois ${sp[11].toFixed(1)})`);
  const slide = meas => { run(`units[0].order='hold';units[0].tx=units[0].x;units[0].ty=units[0].y;globalThis.__x0=units[0].x`); step(run, 40); return run('units[0].x-__x0'); };
  const dry = slide();
  const w2 = makeWorld();
  w2.ctx.__mud = 1;
  w2.run(`const u=newUnit('rifle',0,400,300);u.order='move';u.tx=900;u.ty=300;u.manualUntil=1e9`); step(w2.run, 40);
  w2.run(`units[0].order='hold';units[0].tx=units[0].x;units[0].ty=units[0].y;globalThis.__x0=units[0].x`); step(w2.run, 60);
  const mud = w2.run('units[0].x-__x0');
  assert.ok(dry < 6, `na terra seca o deslize é curto (${dry.toFixed(1)} px)`);
  assert.ok(mud > dry * 2, `na lama o deslize é bem maior (${mud.toFixed(1)} vs ${dry.toFixed(1)} px)`);
}

/* ---------- 1.3 paredes rígidas: bunker sólido, deslize e contorno ---------- */
{
  const { run } = makeWorld();
  run(`newBuilding('bunker',0,1000,600);const w=newUnit('rifle',0,880,600);w.order='move';w.tx=1120;w.ty=600;w.manualUntil=1e9`);
  let inside = 0;
  for (let i = 0; i < 300; i++) { step(run, 1); if (run(`Math.abs(units[0].x-1000)<20&&Math.abs(units[0].y-600)<18`)) inside++; }
  assert.equal(inside, 0, 'a tropa nunca entra na caixa do bunker');
  assert.ok(run('units[0].x') > 1090, 'mas contorna o bunker e chega do outro lado');
}

/* ---------- 2.1 tiro varrido ---------- */
{
  const { run } = makeWorld();
  run(`newBuilding('sandbag',0,1000,700);update(.001)`);
  const through = team => run(`(()=>{let n=0;for(let i=0;i<60;i++){buildings[0].hp=1e6;bullets.length=0;const b={x:900,y:700+(i%9)-4,vx:900,vy:0,t:.5,team:${team},damage:30};bullets.push(b);for(let k=0;k<8;k++){const ox=b.x,oy=b.y;b.x+=b.vx*.04;b.t-=.04;if(b.t>0&&bulletObstacleHit(b,ox,oy,1,0))break}if(b.t>0)n++}return n})()`);
  assert.equal(through(1), 0, 'saco de areia barra 100% do tiro inimigo mesmo com dt grande (0,04)');
  assert.equal(through(0), 60, 'o dono atira por cima do próprio parapeito');
}

/* ---------- 2.1 trincheira: só protege quem está dentro, e só contra tiro que cruza o eixo ---------- */
{
  const { run } = makeWorld();
  // baía norte-sul em x=500: âncoras ao longo do eixo
  run(`for(let n=0;n<8;n++)fieldTrenches.push({id:'field-0-front-4-'+n,type:'trench',team:0,x:500,y:400+n*9,hp:Infinity,hw:16,hh:16,slots:1,line:'front'});PHYS.refresh();const v=newUnit('rifle',0,500,430);v.hp=v.maxhp=1e9`);
  const hit = (ang, cd) => run(`(()=>{const v=units[0];let hit=0;for(let i=0;i<200;i++){v.hp=v.maxhp=1e9;v.cd=${cd};bullets.length=0;grid.clear();grid.set(Math.floor(v.x/160)+','+Math.floor(v.y/160),[v]);
    const a=${ang},d=60,b={x:v.x-Math.cos(a)*d,y:v.y-Math.sin(a)*d,vx:Math.cos(a)*800,vy:Math.sin(a)*800,t:.3,team:1,damage:30};const hp0=v.hp;
    for(let k=0;k<6;k++){const ox=b.x,oy=b.y;b.x+=b.vx/60;b.y+=b.vy/60;if(bulletObstacleHit(b,ox,oy,Math.cos(a),Math.sin(a)))break;
      const dx=b.x-ox,dy=b.y-oy,l2=dx*dx+dy*dy,f=Math.max(0,Math.min(1,((v.x-ox)*dx+(v.y-oy)*dy)/l2));if(Math.hypot(v.x-ox-f*dx,v.y-oy-f*dy)<7){v.hp-=30;break}}
    if(v.hp<hp0)hit++}return hit/200})()`);
  assert.ok(hit(0, 0) < 0.2, 'tiro de frente (cruza o eixo) em quem está agachado quase sempre é barrado');
  assert.ok(hit(0, 99) > hit(0, 0) + 0.2, 'quem acabou de atirar está mais exposto');
  assert.ok(hit(Math.PI / 2, 0) > 0.95, 'enfilada (ao longo do eixo) passa pelo parapeito');
}

/* ---------- 2.2 blindagem: > 45° ricocheteia, frente absorve ---------- */
{
  const { run } = makeWorld();
  run(`const t=newUnit('tank',0,1200,800);t.hp=t.maxhp=1e9;t.angle=0;PHYS.pv(t).hdg=0;update(.001)`);
  const fire = (sx, sy, ang) => run(`(()=>{let rico=0,abs=0;for(let i=0;i<40;i++){const b={x:${sx},y:${sy}+(i%5)-2,vx:Math.cos(${ang})*800,vy:Math.sin(${ang})*800,t:.5,team:1,damage:30};bullets.push(b);
    for(let k=0;k<12;k++){const ox=b.x,oy=b.y;b.x+=b.vx/60;b.y+=b.vy/60;b.t-=1/60;if(b.t<=0)break;const l=Math.hypot(b.vx,b.vy);bulletObstacleHit(b,ox,oy,b.vx/l,b.vy/l)}
    if(b.ricochet)rico++;else abs++;bullets.length=0}return{rico,abs}})()`);
  const head = fire(1100, 800, 0);
  assert.equal(head.rico, 0, 'tiro perpendicular à chapa não ricocheteia'); assert.equal(head.abs, 40);
  const graze = fire(1140, 830, Math.atan2(-14, 60));
  assert.ok(graze.rico > 20, `tiro rasante no flanco ricocheteia (${graze.rico}/40)`);
}

/* ---------- 3.1 cinemática de lagartas ---------- */
{
  const turn = team => { const { run } = makeWorld(); run(`const t=newUnit('tank',${team},1000,800);t.hp=t.maxhp=1e9;t.angle=0;PHYS.pv(t).hdg=0;t.order='move';t.tx=1000;t.ty=1300;t.manualUntil=1e9`);
    for (let i = 0; i < 400; i++) { step(run, 1); if (Math.abs(run('units[0].pv.hdg') - Math.PI / 2) < 0.1) return i / 30; } return null; };
  const ft = turn(0), a7 = turn(1);
  assert.ok(ft > 1.8 && ft < 4.5, `o FT leva alguns segundos para virar 90° (${ft})`);
  assert.ok(a7 > ft, `o A7V é mais pesado que o FT (${a7} > ${ft})`);
  const { run } = makeWorld();
  run(`const t=newUnit('tank',0,1000,800);t.hp=t.maxhp=1e9;t.angle=0;PHYS.pv(t).hdg=0;t.order='move';t.tx=1000;t.ty=1300;t.manualUntil=1e9`);
  let maxW = 0; for (let i = 0; i < 120; i++) { step(run, 1); maxW = Math.max(maxW, Math.abs(run('units[0].pv.w'))); }
  assert.ok(maxW <= 0.63, `velocidade angular limitada (${maxW.toFixed(2)} rad/s)`);
}

/* ---------- 3.2 esmagamento: só estruturas inimigas ---------- */
{
  const { run } = makeWorld();
  run(`const t=newUnit('tank',0,1000,800);t.hp=t.maxhp=1e9;t.angle=0;PHYS.pv(t).hdg=0;t.order='move';t.tx=1500;t.ty=800;t.manualUntil=1e9;
    globalThis.B={ew:newBuilding('wire',1,1100,800),es:newBuilding('sandbag',1,1200,800),os:newBuilding('sandbag',0,1300,800),ow:newBuilding('wire',0,1400,800)}`);
  step(run, 30 * 40);
  assert.ok(run('B.ew.hp<=0'), 'arame inimigo amassado'); assert.ok(run('B.es.hp<=0'), 'sacos de areia inimigos esmagados');
  assert.ok(run('B.os.hp>0&&B.ow.hp>0'), 'estruturas do próprio time ficam de pé');
}

/* ---------- 4.1 / 4.2 onda de choque e estilhaços ---------- */
{
  const { run } = makeWorld();
  run(`for(const d of[12,30,50,80,120]){const u=newUnit('rifle',1,1000+d,800);u.hp=u.maxhp=1e6}corpses.push({x:1020,y:800,team:1,t:90,angle:0});update(.001)`);
  run('gblast=true;explode(1000,800,65,180,0);gblast=false');
  const st = run('units.map(u=>+(u.pv?u.pv.stun:0).toFixed(2))');
  assert.ok(st[0] >= 0.6 && st[0] <= 1.3, `quem está colado na explosão fica atordoado de 0,6 a 1,2 s (${st[0]})`);
  assert.equal(st[4], 0, 'longe do raio ninguém cai');
  step(run, 30);
  assert.ok(run('corpses[0].x-1020') > 15, 'o cadáver é arremessado');
  assert.ok(run('units[0].x-1012') > 10, 'quem sobrevive é empurrado para longe');
  // estilhaços: um muro de sacos corta os acertos
  const blast = wall => { const w = makeWorld(); w.run(`${wall ? "newBuilding('sandbag',1,1038,800);newBuilding('sandbag',1,1038,778);newBuilding('sandbag',1,1038,822);" : ''}update(.001);
    globalThis.T=[];for(let k=0;k<12;k++){const a=k/12*Math.PI*2;const u=newUnit('rifle',1,1000+Math.cos(a)*70,800+Math.sin(a)*70);u.hp=u.maxhp=1e6;T.push(u)}`);
    let hits = 0; for (let n = 0; n < 30; n++) { w.run('for(const u of T)u.hp=u.maxhp;gblast=true;explode(1000,800,30,120,0);gblast=false'); hits += w.run('T.filter(u=>u.hp<u.maxhp).length'); } return hits / 30; };
  const open = blast(false), walled = blast(true);
  assert.ok(open > 1.5, `estilhaços alcançam a 70 px em campo aberto (${open.toFixed(2)} por explosão)`);
  assert.ok(walled < open * 0.85, `sacos de areia protegem (${walled.toFixed(2)} < ${open.toFixed(2)})`);
}

/* ---------- 5 correnteza ---------- */
{
  const { run, ctx } = makeWorld();
  ctx.__wet = (x, y) => Math.abs(x - ctx.PX.riverX(y * 0.5) * 2) < 40 ? 0.72 : 0;
  const cx = y => ctx.PX.riverX(y * 0.5) * 2;
  const f = run(`PHYS.flowAt(${cx(500)},500)`), out = run(`PHYS.flowAt(${cx(500) + 400},500)`);
  assert.ok(f.y > 10, `o rio corre para o sul (${f.y.toFixed(1)} px/s)`); assert.equal(out.y, 0);
  run(`PHYS.addFloater('wood',${cx(300)},300,0)`);
  step(run, 10 * 10, 0.1);
  assert.ok(run('PHYS.floaters()[0].y') > 450, 'a madeira é levada rio abaixo');
}

/* ---------- som: os quatro sons novos chegam a tocar (o código real engole exceções, então conta as chamadas) ---------- */
{
  const { run, ctx } = makeWorld();
  const calls = { osc: 0, buf: 0, start: 0, filt: 0 };
  const node = () => ({ connect() {}, start() { calls.start++; }, stop() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: '' });
  ctx.audio = { currentTime: 0, sampleRate: 8000, destination: {}, createGain: node, createOscillator: () => { calls.osc++; return node(); }, createBufferSource: () => { calls.buf++; return node(); }, createBiquadFilter: () => { calls.filt++; return node(); }, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }) };
  run('soundOn=true;audio=globalThis.audio');
  for (const k of ['thud', 'crunch', 'splash', 'clank']) run(`sound('${k}')`);
  assert.equal(calls.osc, 2, "'clank' usa dois osciladores");
  assert.equal(calls.buf, 3, "'thud', 'crunch' e 'splash' usam ruído filtrado");
  assert.equal(calls.start, 5); assert.equal(calls.filt, 3);
}

console.log('Física 1.1: separação, inércia, paredes, tiro varrido, trincheira, blindagem, lagartas, esmagamento, onda de choque, estilhaços, correnteza e som OK');
