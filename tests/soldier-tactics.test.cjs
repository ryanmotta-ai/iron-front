const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Testes para soldier-tactics.js:
// 1. Apito NCO (tecla T): aliados próximos saem de supressão, recebem bônus moral (+30% vel, imunidade a pinning) e ordem de avanço.
// 2. Comandos contextuais (tecla F): Fogo de supressão (MG/bunker inimigo), Guarnecer posição (trincheira aliada) e Avançar (espaço aberto).
// 3. Sobrevivência: Estado Caído (Downed): ferimento fatal não mata de imediato, rasteja a 11 px/s, pistola de emergência e socorro.
// 4. Auto-bandagem (tecla H): recuperação de +35 HP após 2.2s parado (máx 2 usos, 30s cd).
// 5. Saque de cadáveres (tecla E): recupera munição (+1 pente) e granadas (+1 até 2).
// 6. Chave de desligamento (PXST.on = false).

let serial = 0;
class AudioNode { connect() { return this; } }

const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, URLSearchParams, AudioNode,
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, sandbox: false, playerTeam: 0, mode: 'soldier', player: null,
  map: 'trenches', tab: 'units', placement: null, soundOn: false, audio: null, keys: {}, screenShake: 0, maxUnits: 160,
  units: [], buildings: [], shells: [], particles: [], bullets: [], planes: [], fieldTrenches: [], corpses: [], allCraters: [], points: [{ x: 1200, y: 800, progress: 0, owner: 1 }],
  supplies: [600, 600], aiEnabled: [false, true], cam: { x: 500, y: 500, z: 1 }, mouse: { x: 160, y: 90, wx: 500, wy: 500 }, selected: new Set(),
  defs: {
    rifle: { rate: 1.5, speed: 47, mag: 5, range: 450, hp: 100 },
    mg: { rate: 0.22, speed: 40, range: 500, hp: 100 },
    tank: { rate: 2, speed: 25, range: 600, hp: 600 }
  },
  weapons: {
    rifle: { name: 'Springfield M1903', mag: 5, reload: 2.2 },
    smg: { name: 'BAR M1918', mag: 30, reload: 2.5 },
    pistol: { name: 'Colt M1911', mag: 7, reload: 1.5 }
  },
  magazines: { rifle: 5, smg: 30, pistol: 7 },
  weapon: 'rifle', ammo: 5, reload: 0,
  location: { search: '' },
  canvas: {
    width: 320, height: 180,
    style: {},
    getContext: () => ({
      fillRect() {}, clearRect() {}, drawImage() {}, save() {}, restore() {},
      stroke() {}, beginPath() {}, arc() {}, fill() {}, fillText() {},
      createRadialGradient: () => ({ addColorStop() {} })
    })
  },
  document: {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => ({ id, textContent: '', style: {} }),
    createElement: () => ({ getContext: () => ({ fillRect() {}, clearRect() {} }), style: {}, append() {} })
  },
  PX: { Z: 0.5 },
  toasts: [],
  toast(s) { sb.toasts.push(s); },
  sound() {}, hud() {}, render() {}, setup() {},
  damage(u, n, attacker) {
    if (u.hp <= 0) return;
    u.hp -= n;
    if (u.hp <= 0) {
      sb.units = sb.units.filter(x => x !== u);
    }
  },
  shoot(u, target) {
    sb.shots = (sb.shots || 0) + 1;
  },
  update(dt) {
    sb.time += dt;
    // Movimento do jogador no modo soldado
    if (sb.player && sb.mode === 'soldier' && sb.player.hp > 0) {
      let dx = (sb.keys.d ? 1 : 0) - (sb.keys.a ? 1 : 0);
      let dy = (sb.keys.s ? 1 : 0) - (sb.keys.w ? 1 : 0);
      let n = Math.hypot(dx, dy) || 1;
      if (dx || dy) {
        sb.player.x += (dx / n) * sb.defs.rifle.speed * 1.65 * dt;
        sb.player.y += (dy / n) * sb.defs.rifle.speed * 1.65 * dt;
        sb.player.moving = true;
      } else {
        sb.player.moving = false;
      }
    }
    // Movimento de unidades aliadas e queda natural de supressão
    for (const u of sb.units) {
      u.suppression = Math.max(0, (u.suppression || 0) - dt * 0.18);
      if (u.order !== 'move') continue;
      const dx = u.tx - u.x, dy = u.ty - u.y, l = Math.hypot(dx, dy);
      if (l > 12) {
        const s = Math.min(l, (sb.defs[u.type]?.speed || 47) * dt);
        u.x += (dx / l) * s;
        u.y += (dy / l) * s;
      } else {
        u.order = 'hold';
      }
    }
  },
  protectedBy(u) {
    let f = 1;
    for (const t of sb.fieldTrenches) {
      if (Math.abs(t.x - u.x) < t.hw && Math.abs(t.y - u.y) < t.hh) f = 0.35;
    }
    return f;
  }
};

sb.window = sb;
sb.addEventListener = () => {};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/soldier-tactics.js'), 'utf8'), sb);

const S = sb.PXST;
assert.ok(S, 'Módulo PXST registrado no contexto');
assert.ok(sb.IronFrontSoldierTactics, 'IronFrontSoldierTactics registrado');

const run = (sec, dt = 0.05) => {
  for (let t = 0; t < sec; t += dt) sb.update(dt);
};

const newUnit = (type, team, x, y, extra = {}) => {
  const u = {
    id: ++serial, type, team, x, y, hp: 100, maxhp: 100,
    order: 'hold', tx: x, ty: y, manualUntil: 0, suppression: 0,
    pinned: false, angle: 0, cd: 0, ...extra
  };
  sb.units.push(u);
  return u;
};

// =========================================================================
// 1. APITO PESSOAL DO SOLDADO / NCO (TECLA T)
// =========================================================================
const me = newUnit('rifle', 0, 500, 500, { gren: 2 });
sb.player = me;
me.angle = 0; // Apontando para Leste (X+)

// Aliado 1: próximo (a 90 px, dentro dos 260 px) com supressão e pinned
const allyClose = newUnit('rifle', 0, 590, 500, { order: 'hold', suppression: 1.8, pinned: true });
// Aliado 2: distante (a 350 px, fora dos 260 px) com supressão e pinned
const allyFar = newUnit('rifle', 0, 850, 500, { order: 'hold', suppression: 1.6, pinned: true });

sb.toasts = [];
sb.keys.t = true;
run(0.1);
sb.keys.t = false;

assert.equal(allyClose.suppression, 0, 'Aliado próximo sai de supressão imediatamente');
assert.equal(allyClose.pinned, false, 'Aliado próximo não está mais deitado/pinned');
assert.ok(allyClose.moraleBonusUntil > sb.time, 'Aliado próximo recebeu bônus de moral por 6s');
assert.equal(allyClose.order, 'move', 'Aliado próximo mudou de hold para move');
assert.ok(allyClose.tx > allyClose.x || allyClose.tx === 1200, 'Avança na direção apontada ou objetivo');

assert.equal(allyFar.pinned, true, 'Aliado longe (>260 px) não foi afetado pelo apito');
assert.ok(allyFar.suppression > 0, 'Aliado longe continua sob supressão');

assert.ok(sb.toasts.some(t => t.includes('Ao meu sinal! Pelotão ao ataque!')), 'Toast de ordem do apito emitido');
assert.ok(S.whistleCd > 20, 'Apito entra em cooldown de 25s');

// Teste de imunidade a pinning e bônus de velocidade durante moral
const initialX = allyClose.x;
run(1.0);
const movedDist = allyClose.x - initialX;
// 47 px/s * 1.30 = ~61 px/s
assert.ok(movedDist > 55, `Aliado com bônus moral anda +30% mais rápido (andou ${movedDist.toFixed(1)} px)`);
allyClose.suppression = 1.9;
run(0.1);
assert.equal(allyClose.pinned, false, 'Imunidade a pinning ativa durante bônus moral');

// Recarga do apito
run(25);
assert.equal(S.whistleCd, 0, 'Apito pronto novamente após 25s');

sb.units = [me];
sb.toasts = [];

// =========================================================================
// 2. COMANDOS CONTEXTUAIS DE ESQUADRÃO (PING / TECLA F)
// =========================================================================
const s1 = newUnit('rifle', 0, 480, 520);
const s2 = newUnit('rifle', 0, 520, 520);
const s3 = newUnit('rifle', 0, 500, 530);

// A. Alvo: Metralhadora inimiga (< 45 px) -> Fogo de Supressão
const enemyMG = newUnit('mg', 1, 700, 500);
sb.mouse.wx = 705; sb.mouse.wy = 502;
sb.keys.f = true; run(0.1); sb.keys.f = false;

assert.equal(s1.target, enemyMG, 'Infante aliado direciona mira para a metralhadora marcada');
assert.ok(s1.suppressUntil > sb.time, 'Ordem de supressão ativa por 7 segundos');
assert.ok(sb.toasts.some(t => t.includes('FOGO DE SUPRESSÃO!')), 'Toast FOGO DE SUPRESSÃO! emitido');
assert.ok(S.pings.some(p => p.kind === 'suppression'), 'Marcador tático de ping criado');

// B. Posição: Trincheira aliada -> Guarnecer Posição
sb.toasts = [];
sb.fieldTrenches.push({ id: 'tr1', type: 'trench', team: 0, x: 450, y: 600, hw: 30, hh: 20 });
sb.mouse.wx = 452; sb.mouse.wy = 598;
sb.keys.f = true; run(0.1); sb.keys.f = false;

assert.equal(s1.order, 'move', 'Soldado corre para a posição defensiva');
assert.ok(Math.hypot(s1.tx - 452, s1.ty - 598) < 25, 'Destino é a trincheira marcada');
assert.ok(sb.toasts.some(t => t.includes('GUARNECER POSIÇÃO!')), 'Toast GUARNECER POSIÇÃO! emitido');

// C. Espaço neutro -> Avançar para cá
sb.toasts = [];
sb.mouse.wx = 800; sb.mouse.wy = 750;
sb.keys.f = true; run(0.1); sb.keys.f = false;

assert.equal(s2.order, 'move');
assert.ok(Math.hypot(s2.tx - 800, s2.ty - 750) < 30, 'Destino é o ponto aberto');
assert.ok(sb.toasts.some(t => t.includes('AVANÇAR PARA cá')), 'Toast AVANÇAR PARA cá emitido');

// Limpa pings após 3s
run(3.5);
assert.equal(S.pings.length, 0, 'Pings removidos após expirar temporizador');

sb.units = [me];
sb.toasts = [];

// =========================================================================
// 3. SOBREVIVÊNCIA: ESTADO CAÍDO (DOWNED / AGONIA)
// =========================================================================
me.hp = 100;
me.x = 500;
me.y = 500;
sb.weapon = 'rifle';

// Dano fatal comum (overdamage = 110 - 100 = 10 <= 60): entra em estado caído
sb.damage(me, 110);

assert.ok(me.isDowned, 'Jogador não morreu instantaneamente: isDowned = true');
assert.equal(me.hp, 1, 'HP mantido em 1 para permitir rastejo e respiração');
assert.equal(me.bleedTimer, 25, 'Temporizador de sangramento iniciado em 25s');
assert.equal(sb.weapon, 'pistol', 'Pistola de bolso sacada para defesa de emergência');
assert.ok(sb.toasts.some(t => t.includes('FERIDO EM AGONIA!')), 'Aviso de agonia exibido');

// Rastejar lentamente (11 px/s)
sb.keys.d = true; // mover para a direita
run(1.0);
sb.keys.d = false;

const crawlDist = me.x - 500;
assert.ok(crawlDist >= 10 && crawlDist <= 12, `Rastejou a ~11 px/s (andou ${crawlDist.toFixed(1)} px em 1s)`);
assert.ok(me.bleedTimer < 25, 'Temporizador de sangramento decrescendo');

// Disparos com pistola de bolso permitidos
sb.shots = 0;
sb.shoot(me, null);
assert.equal(sb.shots, 1, 'Pistola pode disparar em emergência');

// Grito de socorro (tecla E enquanto caído)
sb.toasts = [];
sb.keys.e = true; run(0.1); sb.keys.e = false;
assert.ok(sb.toasts.some(t => t.includes('SOCORRO! MÉDICO!')), 'Grito por socorro emitido com E');

// Padioleiro ou aliado chega para prestar socorro (< 20 px)
const rescuer = newUnit('rifle', 0, me.x + 10, me.y + 5);
run(0.1);

assert.equal(me.isDowned, false, 'Jogador socorrido e levantado: isDowned = false');
assert.equal(me.hp, 50, 'Jogador levantou com 50% de HP');
assert.ok(sb.toasts.some(t => t.includes('Socorrido a tempo!')), 'Toast de reanimação exibido');

// Teste de despedaçamento explosivo (> 60 overdamage)
me.hp = 15;
sb.damage(me, 100); // 100 - 15 = 85 de overdamage (> 60)
assert.ok(me.hp <= 0, 'Dano explosivo maciço mata na hora');
assert.equal(me.isDowned, false, 'Não entra em agonia se foi despedaçado');

// =========================================================================
// 4. AUTO-BANDAGEM DE EMERGÊNCIA (TECLA H)
// =========================================================================
me.hp = 40;
me.maxhp = 100;
me.isDowned = false;
me.bandagesLeft = 2;
me.bandageCd = 0;
sb.units = [me];
sb.toasts = [];

// Aplicação de bandagem: segurar H parado por 2.2 segundos
sb.keys.h = true;
run(2.3);
sb.keys.h = false;

assert.equal(me.hp, 75, 'Curativo aplicado: recuperou +35 HP (40 + 35 = 75)');
assert.equal(me.bandagesLeft, 1, 'Consumiu 1 atadura (resta 1)');
assert.ok(me.bandageCd > 28, 'Entrou em cooldown de 30s');
assert.ok(sb.toasts.some(t => t.includes('Curativo de campo aplicado (+35 HP)')), 'Toast de bandagem exibido');

// Tentativa de bandagem em movimento é cancelada
me.hp = 50;
me.bandageCd = 0;
sb.keys.h = true;
sb.keys.d = true; // andando
run(1.5);
assert.equal(me.hp, 50, 'Não cura se o soldado estiver se movendo');
assert.equal(S.bandageProgress, 0, 'Progresso de bandagem reiniciado ao andar');
sb.keys.h = false;
sb.keys.d = false;

// =========================================================================
// 5. SAQUE DE CADÁVERES (SCAVENGING - TECLA E)
// =========================================================================
sb.corpses = [{ x: me.x + 12, y: me.y + 8, team: 1, looted: false }]; // a ~14 px (< 24 px)
sb.ammo = 1;
me.gren = 0;
sb.toasts = [];

sb.keys.e = true; run(0.1); sb.keys.e = false;

assert.equal(sb.corpses[0].looted, true, 'Cadáver marcado como saqueado');
assert.equal(sb.ammo, 5, 'Munição recarregada com pente saqueado');
assert.equal(me.gren, 1, 'Granada saqueada (+1)');
assert.ok(sb.toasts.some(t => t.includes('Munição e suprimentos saqueados.')), 'Toast de saque exibido');

// Não pode saquear o mesmo cadáver duas vezes
sb.ammo = 2;
sb.keys.e = true; run(0.1); sb.keys.e = false;
assert.equal(sb.ammo, 2, 'Não permite saque infinito no mesmo cadáver');

// =========================================================================
// 6. CHAVE DE DESLIGAMENTO
// =========================================================================
S.on = false;
me.hp = 100;
sb.damage(me, 120);
assert.ok(me.hp <= 0 && !me.isDowned, 'Com PXST.on = false módulo fica inativo');

assert.equal(S.stats.errors, 0, 'Zero erros na execução');
console.log('soldier-tactics.test.cjs: Apito NCO, Pings contextuais, Estado Downed, Auto-bandagem e Saque de cadáveres OK (100% de sucesso)');
