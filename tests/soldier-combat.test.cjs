const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Teste unitário para dist/soldier-combat.js
// Valida:
// 1. Registro e atributos da Winchester 1897 "Trench Gun" (equipe 0 e equipe 1)
// 2. Mira Focada (ADS / Camera Lead) via RMB ou Shift e redução de spread em 55%
// 3. Apoio de Arma em Coberturas (Weapon Mounting) quando protectedBy < 0.75 e estabilidade máxima
// 4. Carga de Baioneta: velocidade 1.6x, abate letal instantâneo frontal (< 22 px) e exaustão ao expirar (0.6x)
// 5. Disparo da escopeta disparando múltiplos projéteis (6 pellets)
// 6. Estalo sônico (snap-crack) e micro-tremor de susto sob balas próximas (< 28 px)
// 7. Chave de desligamento (kill switch)

let serial = 0;
class AudioNode { connect() { return this; } }

const coverStatusEl = { textContent: '' };
const crosshairEl = { style: {}, textContent: '' };

const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, URLSearchParams, AudioNode,
  W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false, sandbox: false, playerTeam: 0,
  mode: 'soldier', player: null, map: 'trenches', tab: 'units', placement: null,
  soundOn: false, audio: null, keys: {}, screenShake: 0,
  units: [], buildings: [], shells: [], particles: [], fieldTrenches: [], allCraters: [], points: [], selected: new Set(), bullets: [],
  supplies: [2000, 2000], aiEnabled: [false, false], cam: { x: 500, y: 500 }, mouse: { x: 160, y: 90, wx: 800, wy: 500 },
  defs: {
    rifle: { speed: 47, rate: 1.5, hp: 100 },
    mg: { speed: 34, rate: 0.22, hp: 110 },
    tank: { speed: 28, rate: 3.2, hp: 650 }
  },
  weapons: {
    rifle: { name: 'SPRINGFIELD M1903', mag: 5, reload: 2.4, rate: 1.7, damage: 30, range: 360, spread: 0.025 },
    smg: { name: 'BAR M1918', mag: 20, reload: 2.3, rate: 0.12, damage: 12, range: 190, spread: 0.13 },
    pistol: { name: 'COLT M1911', mag: 7, reload: 1.4, rate: 0.42, damage: 18, range: 230, spread: 0.065 }
  },
  magazines: { rifle: 5, smg: 20, pistol: 7 },
  ammo: 5, weapon: 'rifle', reload: 0,
  location: { search: '' },
  canvas: { style: {}, addEventListener: () => {} },
  document: {
    querySelector: () => null,
    getElementById: (id) => {
      if (id === 'coverstatus') return coverStatusEl;
      if (id === 'crosshair') return crosshairEl;
      return null;
    },
    createElement: () => ({
      getContext: () => ({
        save() {}, restore() {}, stroke() {}, beginPath() {}, moveTo() {}, lineTo() {}, fillRect() {}
      })
    })
  },
  toasts: [],
  toast(s) { sb.toasts.push(s); },
  sound() {},
  hud() {
    if (sb.mode === 'soldier' && sb.player) {
      const p = sb.protectedBy(sb.player);
      coverStatusEl.textContent = p < 1 ? 'COBERTURA ' + Math.round((1 - p) * 100) + '%' : 'SEM COBERTURA';
    }
  },
  render() {},
  setup() {},
  protectedBy(u) {
    let f = 1;
    for (const t of sb.fieldTrenches) {
      if (Math.abs(t.x - u.x) < (t.hw || 20) && Math.abs(t.y - u.y) < (t.hh || 20)) f = 0.35;
    }
    return f;
  },
  damage(u, n) {
    u.hp -= n;
  },
  changeWeapon(next) {
    if (sb.weapons[next]) {
      sb.magazines[sb.weapon] = sb.ammo;
      sb.weapon = next;
      sb.ammo = sb.magazines[next] !== undefined ? sb.magazines[next] : sb.weapons[next].mag;
    }
  },
  shoot(u, target, manual) {
    const d = manual && u.type !== 'tank' ? sb.weapons[sb.weapon] : sb.defs[u.type];
    const a = manual ? Math.atan2(sb.mouse.wy - u.y, sb.mouse.wx - u.x) : 0;
    u.angle = a;
    u.cd = d.rate;
    sb.bullets.push({
      x: u.x, y: u.y,
      vx: Math.cos(a) * 800, vy: Math.sin(a) * 800,
      t: (d.range || 200) / 800, team: u.team, damage: d.damage
    });
  },
  update(dt) {
    sb.time += dt;
    if (sb.player && sb.mode === 'soldier') {
      const u = sb.player;
      const d = sb.defs[u.type] || { speed: 47 };
      const dx = (sb.keys.d || sb.keys.ArrowRight ? 1 : 0) - (sb.keys.a || sb.keys.ArrowLeft ? 1 : 0);
      const dy = (sb.keys.s || sb.keys.ArrowDown ? 1 : 0) - (sb.keys.w || sb.keys.ArrowUp ? 1 : 0);
      const n = Math.hypot(dx, dy) || 1;
      u.x += (dx / n) * d.speed * 1.65 * dt;
      u.y += (dy / n) * d.speed * 1.65 * dt;
      u.moving = !!(dx || dy);
      u.angle = Math.atan2(sb.mouse.wy - u.y, sb.mouse.wx - u.x);
      sb.cam.x += (u.x - sb.cam.x) * Math.min(1, dt * 8);
      sb.cam.y += (u.y - sb.cam.y) * Math.min(1, dt * 8);
    }
    for (const b of sb.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.t -= dt;
    }
    sb.bullets = sb.bullets.filter(b => b.t > 0);
  }
};

sb.window = sb;
sb.addEventListener = () => {};

vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/soldier-combat.js'), 'utf8'), sb);

const SC = sb.PXSC;
assert.ok(SC, 'PXSC exportado no escopo global');
assert.ok(sb.IronFrontSoldierCombat === SC, 'IronFrontSoldierCombat exportado');
assert.equal(SC.on, true, 'módulo ativado por padrão');

const unit = (type, team, x, y, extra = {}) => {
  const u = { id: ++serial, type, team, x, y, hp: 100, maxhp: 100, order: 'hold', tx: x, ty: y, angle: 0, cd: 0, ...extra };
  sb.units.push(u);
  return u;
};

// -------------------------------------------------------------
// 1. Arsenal de Trincheira: Winchester 1897 "Trench Gun"
// -------------------------------------------------------------
assert.ok(sb.weapons.shotgun, 'arma escopeta registrada em weapons.shotgun');
assert.equal(sb.weapons.shotgun.name, 'WINCHESTER 1897', 'nome equipe 0: WINCHESTER 1897');
assert.equal(sb.weapons.shotgun.mag, 6, 'capacidade de 6 cartuchos');
assert.equal(sb.weapons.shotgun.reload, 2.8, 'tempo de recarga 2.8s');
assert.equal(sb.weapons.shotgun.rate, 0.75, 'cadência 0.75s');
assert.equal(sb.weapons.shotgun.damage, 16, 'dano por pellet: 16');
assert.equal(sb.weapons.shotgun.range, 180, 'alcance: 180 px');
assert.equal(sb.weapons.shotgun.spread, 0.16, 'dispersão: 0.16');
assert.equal(sb.weapons.shotgun.pellets, 6, '6 projéteis (pellets) por disparo');
assert.equal(sb.magazines.shotgun, 6, 'pente de escopeta inicializado com 6');

// Testa variação de nome para facção alemã (playerTeam = 1)
sb.playerTeam = 1;
assert.equal(sb.weapons.shotgun.name, 'MAUSER FLIEGER', 'nome equipe 1: MAUSER FLIEGER');
sb.playerTeam = 0;

// -------------------------------------------------------------
// 2. Mira Focada (ADS / Camera Lead) & Redução de Dispersão
// -------------------------------------------------------------
sb.player = unit('rifle', 0, 500, 500);
sb.mode = 'soldier';
sb.weapon = 'rifle';
sb.cam = { x: 500, y: 500 };
sb.mouse = { wx: 800, wy: 500, x: 200, y: 100 }; // visada para a direita (ângulo 0)

// Sem mira focada: spread normal
assert.equal(SC.getEffectiveSpread(), 0.025, 'spread padrão do fuzil');
sb.update(0.1);
assert.equal(sb.player.aiming, false, 'mira inativa sem Shift ou RMB');

// Ativa ADS via tecla Shift
sb.keys.Shift = true;
sb.update(0.1);
assert.equal(sb.player.aiming, true, 'mira focada ativada via Shift');
assert.ok(sb.cam.x > 500, 'câmera avança dinamicamente na direção do mouse (offset positivo em x)');
assert.ok(sb.cam.x <= 500 + 180, 'câmera respeita o limite máximo de 180 px');

// Redução de 55% de spread (0.025 * 0.45 = 0.01125)
const adsSpread = SC.getEffectiveSpread();
assert.ok(Math.abs(adsSpread - (0.025 * 0.45)) < 1e-5, `spread reduzido em 55%: esperado ~0.01125, obtido ${adsSpread}`);

// Desativa ADS via tecla Shift
sb.keys.Shift = false;
sb.update(0.1);
assert.equal(sb.player.aiming, false, 'mira focada desativada');

// Ativa ADS via Botão Direito do Mouse (RMB)
SC.rmbDown = true;
sb.update(0.1);
assert.equal(sb.player.aiming, true, 'mira focada ativada via RMB');
SC.rmbDown = false;
sb.update(0.1);
assert.equal(sb.player.aiming, false, 'mira focada desativada ao soltar RMB');

// -------------------------------------------------------------
// 3. Apoio de Arma em Coberturas (Weapon Mounting)
// -------------------------------------------------------------
// Campo aberto: protectedBy >= 0.75 -> não apoiado
assert.ok(sb.protectedBy(sb.player) >= 0.75, 'em campo aberto');
sb.update(0.1);
assert.equal(sb.player.mounted, false, 'arma não montada em campo aberto');

// Entra em cobertura de trincheira (< 0.75)
sb.fieldTrenches.push({ x: 500, y: 500, hw: 30, hh: 30 });
assert.ok(sb.protectedBy(sb.player) < 0.75, 'jogador sob cobertura de trincheira');
sb.update(0.1);
assert.equal(sb.player.mounted, true, 'arma entra em estado montado (player.mounted = true)');

// Valida HUD 'APOIADO'
sb.hud();
assert.ok(/APOIADO/.test(coverStatusEl.textContent), `HUD exibe status APOIADO: ${coverStatusEl.textContent}`);

// Valida estabilidade máxima: spread quase zero (redução de 95%)
const mountedSpread = SC.getEffectiveSpread();
assert.ok(mountedSpread < 0.003, `spread montado quase zero: ${mountedSpread}`);

// Sai da cobertura
sb.fieldTrenches.length = 0;
sb.update(0.1);
assert.equal(sb.player.mounted, false, 'arma desmontada ao sair da cobertura');

// -------------------------------------------------------------
// 4. Carga de Baioneta (Bayonet Charge)
// -------------------------------------------------------------
// Teste A: Não pode iniciar com arma que não seja fuzil
sb.weapon = 'smg';
assert.equal(SC.startBayonetCharge(), false, 'não inicia carga com SMG');
sb.weapon = 'rifle';

// Teste B: Início da carga e velocidade 1.6x
SC.reset();
assert.equal(SC.startBayonetCharge(), true, 'carga de baioneta iniciada com fuzil');
assert.equal(SC.bayonetCharge.active, true, 'carga ativa');
assert.equal(sb.player.charging, true, 'jogador em estado de carga');

// Mede velocidade durante a carga
sb.player.x = 500;
sb.player.y = 500;
sb.keys.d = true; // corre para a direita
sb.update(0.1);
const chargeDist = sb.player.x - 500;
sb.keys.d = false;

// Velocidade normal de corrida seria defs.rifle.speed * 1.65 * 0.1 = 47 * 1.65 * 0.1 = 7.755
// Com carga 1.6x, a distância percorrida deve ser ~12.4 px
const normalDist = 47 * 1.65 * 0.1;
assert.ok(chargeDist > normalDist * 1.45 && chargeDist < normalDist * 1.75, `velocidade em carga ~1.6x da normal (${chargeDist.toFixed(2)} vs ${normalDist.toFixed(2)})`);

// Teste C: Colisão frontal (< 22 px) com infante inimigo -> abate instantâneo letal
const enemy = unit('rifle', 1, sb.player.x + 14, sb.player.y); // 14 px à frente
sb.mouse = { wx: sb.player.x + 100, wy: sb.player.y }; // mirando em direção ao inimigo
sb.update(0.05);

assert.ok(enemy.hp <= 0, 'inimigo abatido instantaneamente pelo golpe de baioneta');
assert.equal(SC.bayonetCharge.hit, true, 'golpe letal de baioneta registrado');
assert.equal(SC.bayonetCharge.active, false, 'carga finalizada com sucesso no impacto');
assert.equal(SC.bayonetCharge.exhausted, 0, 'acerto letal não causa exaustão');
assert.ok(SC.stats.bayonetKills >= 1, 'estatística de baixas com baioneta incrementada');

// Teste D: Carga sem alvo -> esgota tempo de 2.2s -> exaustão por 1.4s (velocidade 0.6x)
SC.reset();
SC.bayonetCharge.cooldown = 0;
assert.equal(SC.startBayonetCharge(), true, 'segunda carga iniciada');
// Avança 2.3 segundos no tempo sem atingir ninguém
for (let t = 0; t < 2.3; t += 0.1) {
  sb.update(0.1);
}
assert.equal(SC.bayonetCharge.active, false, 'carga expirada após o tempo');
assert.ok(SC.bayonetCharge.exhausted > 0, 'jogador entra em estado exausto após carga falha');

// Mede velocidade enquanto exausto (deve ser ~0.6x da velocidade normal)
sb.player.x = 500;
sb.keys.d = true;
sb.update(0.1);
sb.keys.d = false;
const exhaustedDist = sb.player.x - 500;
assert.ok(exhaustedDist < normalDist * 0.8 && exhaustedDist > normalDist * 0.45, `velocidade em exaustão ~0.6x (${exhaustedDist.toFixed(2)} vs ${normalDist.toFixed(2)})`);

// Espera a exaustão terminar (1.4s)
for (let t = 0; t < 1.5; t += 0.1) {
  sb.update(0.1);
}
assert.equal(SC.bayonetCharge.exhausted, 0, 'exaustão recuperada após o tempo');

// Teste E: Não permite carregar novamente enquanto em cooldown
assert.ok(SC.bayonetCharge.cooldown > 0, 'ainda em cooldown de 10s');
assert.equal(SC.startBayonetCharge(), false, 'bloqueado pelo cooldown');

// -------------------------------------------------------------
// 5. Disparo da Winchester 1897 (Múltiplos Pellets)
// -------------------------------------------------------------
sb.changeWeapon('shotgun');
assert.equal(sb.weapon, 'shotgun', 'escopeta equipada');
sb.bullets.length = 0;
sb.player.x = 500;
sb.player.y = 500;
sb.mouse = { wx: 700, wy: 500, x: 200, y: 100 };

sb.shoot(sb.player, null, true);

// Deve ter disparado 6 projéteis (pellets)
assert.equal(sb.bullets.length, 6, 'escopeta disparou exatamente 6 pellets');
assert.ok(sb.bullets.every(b => b.pellet === true), 'todos os projéteis marcados como pellets');
assert.ok(sb.bullets.every(b => b.damage === 16), 'dano de cada pellet é 16');
assert.ok(sb.bullets.every(b => b.team === 0), 'pellets pertencem ao time do jogador');
assert.ok(SC.stats.shotgunShots >= 1, 'estatística de disparos de escopeta incrementada');

// -------------------------------------------------------------
// 6. Estalo Sônico (Snap-Crack)
// -------------------------------------------------------------
const cracks0 = SC.stats.cracks;
sb.screenShake = 0;
// Bala inimiga passando a 15 px da cabeça do jogador (< 28 px)
sb.bullets.push({
  x: sb.player.x + 10,
  y: sb.player.y + 10,
  vx: 800,
  vy: 0,
  t: 1.0,
  team: 1, // time inimigo
  damage: 30
});

sb.update(0.02);

assert.ok(SC.stats.cracks > cracks0, 'estalo sônico detectado para projétil inimigo próximo');
assert.ok(sb.screenShake > 0, 'micro-tremor de susto aplicado à câmera');

// -------------------------------------------------------------
// 7. Chave de Desligamento (Robustez & Kill Switch)
// -------------------------------------------------------------
SC.on = false;
sb.keys.Shift = true;
sb.update(0.1);
assert.equal(sb.player.aiming, false, 'módulo desligado com SC.on = false');
SC.on = true;

console.log('Todos os testes do módulo soldier-combat.js passaram com 100% de sucesso!');
