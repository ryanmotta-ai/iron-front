const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Testes para dist/soldier-hud.js:
// 1. Atribuição correta de nome e patente aleatórios por facção (EUA e Alemanha)
// 2. Renderização de avatar procedural em pixel art (Brodie vs Stahlhelm, normal, ferido e caído)
// 3. Atualização correta da vida e cores da barra de HP do Battlefield (verde militar, âmbar e vermelho pulsante)
// 4. Troca correta de arma ativa entre slots 1, 2, 3, 4, G, X e atualização de munição / recarga
// 5. Atualização de status tático (Pronto, Apoiado, Suprimido, Carga de Baioneta, Em Agonia)
// 6. Kill switch via ?soldier_hud=0 e PXHUD.on = false

function setupSandbox(search = '') {
  const elements = new Map();

  function createMockElement(tag = 'div', id = '') {
    const classListSet = new Set();
    const attributes = new Map();
    const children = [];

    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      style: {},
      onclick: null,
      dataset: {},
      children,
      classList: {
        add(...cls) {
          cls.forEach(c => classListSet.add(c));
          el.className = Array.from(classListSet).join(' ');
        },
        remove(...cls) {
          cls.forEach(c => classListSet.delete(c));
          el.className = Array.from(classListSet).join(' ');
        },
        toggle(c, force) {
          const has = classListSet.has(c);
          const next = force !== undefined ? !!force : !has;
          if (next) classListSet.add(c);
          else classListSet.delete(c);
          el.className = Array.from(classListSet).join(' ');
          return next;
        },
        contains(c) {
          return classListSet.has(c);
        }
      },
      setAttribute(name, val) {
        attributes.set(name, String(val));
        if (name === 'id') {
          el.id = String(val);
        }
      },
      getAttribute(name) {
        return attributes.get(name) || null;
      },
      appendChild(child) {
        children.push(child);
        child.parentNode = el;
        return child;
      },
      addEventListener() {},
      removeEventListener() {},
      getContext() {
        return {
          save() {},
          restore() {},
          fillRect() {},
          strokeRect() {},
          clearRect() {},
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          imageSmoothingEnabled: false
        };
      }
    };

    let _id = id;
    Object.defineProperty(el, 'id', {
      get() { return _id; },
      set(val) {
        _id = val;
        if (val) elements.set(val, el);
      }
    });

    if (id) {
      elements.set(id, el);
    }

    return el;
  }

  const getOrCreate = (id, tag = 'div') => {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(tag, id));
    }
    return elements.get(id);
  };

  const fieldEl = getOrCreate('field');
  const bodyEl = createMockElement('body');

  const doc = {
    readyState: 'complete',
    body: bodyEl,
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => createMockElement(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };

  const playerObj = {
    id: 101,
    team: 0,
    type: 'rifle',
    hp: 100,
    maxhp: 100,
    angle: 0,
    gren: 2,
    suppression: 0,
    pinned: false,
    mounted: false,
    aiming: false,
    charging: false,
    isDowned: false,
    down: false
  };

  const sb = {
    console, Math, Array, Object, Map, Set, WeakMap, JSON, String, URLSearchParams,
    W: 2400, H: 1600, vw: 320, vh: 180, time: 0, started: true, ended: false,
    mode: 'soldier', playerTeam: 0, player: playerObj,
    weapon: 'rifle', ammo: 5, reload: 0, grenadeCooldown: 0,
    weapons: {
      rifle: { name: 'SPRINGFIELD M1903', mag: 5, reload: 2.4 },
      smg: { name: 'THOMPSON', mag: 20, reload: 2.3 },
      pistol: { name: 'COLT M1911', mag: 7, reload: 1.4 },
      shotgun: { name: 'WINCHESTER 1897', mag: 6, reload: 2.8 }
    },
    magazines: { rifle: 5, smg: 20, pistol: 7, shotgun: 6 },
    location: { search },
    document: doc,
    window: null,
    addEventListener: () => {},
    toasts: [],
    toast(s) { sb.toasts.push(s); },
    hud() {},
    changeWeapon(next) {
      if (sb.weapons[next]) {
        sb.magazines[sb.weapon] = sb.ammo;
        sb.weapon = next;
        sb.ammo = sb.magazines[next] !== undefined ? sb.magazines[next] : sb.weapons[next].mag;
        sb.reload = 0;
        sb.hud();
      }
    },
    grenade() {
      if (sb.player && sb.player.gren > 0 && sb.grenadeCooldown <= 0) {
        sb.player.gren--;
        sb.grenadeCooldown = 7;
        sb.hud();
      }
    },
    PXSC: {
      bayonetCharge: { active: false, cooldown: 0, exhausted: 0, hit: false },
      startBayonetCharge() {
        sb.PXSC.bayonetCharge.active = true;
        sb.player.charging = true;
        sb.hud();
        return true;
      },
      registerShotgun() {}
    }
  };

  sb.window = sb;

  // Carrega e executa soldier-hud.js
  const code = fs.readFileSync(path.join(__dirname, '../dist/soldier-hud.js'), 'utf8');
  vm.createContext(sb);
  vm.runInContext(code, sb);

  return { sb, elements, doc };
}

// =========================================================================
// TESTE 1: Atribuição correta de nome e patente aleatórios por facção
// =========================================================================
console.log('--- Teste 1: Atribuição de Identidade do Soldado ---');
{
  const { sb } = setupSandbox();
  const HUD = sb.PXHUD;
  assert.ok(HUD, 'Módulo PXHUD deve ser exportado');
  assert.equal(typeof HUD.assignSoldierIdentity, 'function', 'assignSoldierIdentity deve ser uma função');

  const US_RANKS = ['Pvt.', 'Pfc.', 'Cpl.', 'Sgt.'];
  const US_NAMES = ['Miller', 'Hayes', 'Baker', "O'Connor", 'Walker', 'Sullivan', 'Turner', 'Cooper', 'Bennett', 'Campbell', 'Kelly', 'Evans', 'Murphy', 'Wright'];
  const DE_RANKS = ['Schütze', 'Gefr.', 'Uffz.', 'Fw.'];
  const DE_NAMES = ['Schmidt', 'Müller', 'Weber', 'Becker', 'Hoffmann', 'Wagner', 'Fischer', 'Schulz', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz'];

  // Soldado Americano (Time 0)
  const usSoldier = { id: 1, team: 0, hp: 100 };
  HUD.assignSoldierIdentity(usSoldier);

  assert.ok(typeof usSoldier.soldierSeed === 'number' && usSoldier.soldierSeed > 0, 'Soldado deve receber soldierSeed numérico');
  assert.ok(US_RANKS.includes(usSoldier.soldierRank), `Patente americana válida esperada. Recebeu: ${usSoldier.soldierRank}`);
  assert.ok(US_NAMES.includes(usSoldier.soldierName), `Sobrenome americano válido esperado. Recebeu: ${usSoldier.soldierName}`);

  // Soldado Alemão (Time 1)
  const deSoldier = { id: 2, team: 1, hp: 100 };
  HUD.assignSoldierIdentity(deSoldier);

  assert.ok(typeof deSoldier.soldierSeed === 'number' && deSoldier.soldierSeed > 0, 'Soldado alemão deve receber soldierSeed');
  assert.ok(DE_RANKS.includes(deSoldier.soldierRank), `Patente alemã válida esperada. Recebeu: ${deSoldier.soldierRank}`);
  assert.ok(DE_NAMES.includes(deSoldier.soldierName), `Sobrenome alemão válido esperado. Recebeu: ${deSoldier.soldierName}`);

  // Preservação de atributos preexistentes
  const veteran = { id: 3, team: 0, hp: 100, soldierRank: 'Sgt.', soldierName: 'Miller', soldierSeed: 99999 };
  HUD.assignSoldierIdentity(veteran);
  assert.equal(veteran.soldierRank, 'Sgt.', 'Não deve sobrescrever patente existente');
  assert.equal(veteran.soldierName, 'Miller', 'Não deve sobrescrever nome existente');
  assert.equal(veteran.soldierSeed, 99999, 'Não deve sobrescrever seed existente');

  // Amostragem de diversidade
  const generatedNames = new Set();
  for (let i = 0; i < 40; i++) {
    const s = { id: 100 + i, team: i % 2, hp: 100 };
    HUD.assignSoldierIdentity(s);
    generatedNames.add(s.soldierName);
  }
  assert.ok(generatedNames.size >= 5, `Deve haver variedade nos nomes gerados (obtidos ${generatedNames.size})`);

  console.log('✓ Atribuição de nome, patente e seed por facção OK');
}

// =========================================================================
// TESTE 2: Renderização de avatar em pixel art (Canvas)
// =========================================================================
console.log('--- Teste 2: Renderização de Avatar Procedural ---');
{
  const { sb } = setupSandbox();
  const HUD = sb.PXHUD;

  let fillRectCalls = 0;
  let strokeRectCalls = 0;
  const mockCanvas = {
    width: 48,
    height: 48,
    getContext() {
      return {
        save() {},
        restore() {},
        fillRect() { fillRectCalls++; },
        strokeRect() { strokeRectCalls++; },
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        imageSmoothingEnabled: false
      };
    }
  };

  const usNormal = { id: 1, team: 0, hp: 100, maxhp: 100, soldierSeed: 12345 };
  HUD.renderAvatar(mockCanvas, usNormal);
  assert.ok(fillRectCalls > 20, 'Desenho de soldado americano normal deve renderizar múltiplos pixels');

  const rectsBefore = fillRectCalls;
  const deWounded = { id: 2, team: 1, hp: 30, maxhp: 100, soldierSeed: 54321 };
  HUD.renderAvatar(mockCanvas, deWounded);
  assert.ok(fillRectCalls > rectsBefore, 'Desenho de soldado ferido deve renderizar camadas de sangue/ferimentos');

  const deDowned = { id: 3, team: 1, hp: 0, maxhp: 100, isDowned: true, soldierSeed: 54321 };
  HUD.renderAvatar(mockCanvas, deDowned);
  assert.ok(fillRectCalls > rectsBefore + 20, 'Desenho de soldado em agonia deve renderizar atadura e expressões de dor');

  console.log('✓ Renderização procedural em pixel art de soldados normais, feridos e caídos OK');
}

// =========================================================================
// TESTE 3: Barra de vida no estilo Battlefield e cores dinâmicas
// =========================================================================
console.log('--- Teste 3: Barra de Vida Battlefield & Cores Dinâmicas ---');
{
  const { sb, elements } = setupSandbox();
  const HUD = sb.PXHUD;

  // 1. HP > 60% -> Verde militar / Ciano tático (#2ed573)
  assert.equal(HUD.getHpColor(1.0), '#2ed573', '100% HP deve ser verde militar/ciano');
  assert.equal(HUD.getHpColor(0.75), '#2ed573', '75% HP deve ser verde militar/ciano');
  assert.equal(HUD.getHpColor(0.61), '#2ed573', '61% HP deve ser verde militar/ciano');

  // 2. 30% <= HP <= 60% -> Âmbar / Amarelo de alerta (#ffa502)
  assert.equal(HUD.getHpColor(0.60), '#ffa502', '60% HP deve ser âmbar/alerta');
  assert.equal(HUD.getHpColor(0.45), '#ffa502', '45% HP deve ser âmbar/alerta');
  assert.equal(HUD.getHpColor(0.30), '#ffa502', '30% HP deve ser âmbar/alerta');

  // 3. HP < 30% -> Vermelho sangue pulsante (#ff4757)
  assert.equal(HUD.getHpColor(0.29), '#ff4757', '29% HP deve ser vermelho');
  assert.equal(HUD.getHpColor(0.15), '#ff4757', '15% HP deve ser vermelho');
  assert.equal(HUD.getHpColor(0.0), '#ff4757', '0% HP deve ser vermelho');

  // Verifica integração visual no DOM via hud()
  sb.player.hp = 100;
  sb.hud();

  const hpValEl = elements.get('soldier-hp-value');
  const hpBarEl = elements.get('soldier-hp-bar');

  assert.ok(hpValEl, 'Elemento #soldier-hp-value deve existir no DOM');
  assert.ok(hpBarEl, 'Elemento #soldier-hp-bar deve existir no DOM');
  assert.equal(hpValEl.textContent, '100 HP', 'Valor numérico de HP inicial deve ser 100 HP');
  assert.equal(hpBarEl.style.width, '100%', 'Barra de HP inicial deve estar em 100%');
  assert.equal(hpBarEl.style.background, '#2ed573', 'Barra deve estar verde militar');
  assert.equal(hpBarEl.classList.contains('low-hp-pulse'), false, 'Não deve pulsar com vida cheia');

  // Dano: reduz para 45 HP (faixa de alerta)
  sb.player.hp = 45;
  sb.hud();
  assert.equal(hpValEl.textContent, '45 HP', 'Valor numérico atualizado para 45 HP');
  assert.equal(hpBarEl.style.width, '45%', 'Barra deve estar em 45%');
  assert.equal(hpBarEl.style.background, '#ffa502', 'Barra deve estar em cor âmbar');
  assert.equal(hpBarEl.classList.contains('low-hp-pulse'), false, 'Não deve pulsar em alerta');

  // Dano crítico: reduz para 20 HP (< 30%)
  sb.player.hp = 20;
  sb.hud();
  assert.equal(hpValEl.textContent, '20 HP', 'Valor numérico atualizado para 20 HP');
  assert.equal(hpBarEl.style.width, '20%', 'Barra deve estar em 20%');
  assert.equal(hpBarEl.style.background, '#ff4757', 'Barra deve estar em vermelho sangue');
  assert.equal(hpBarEl.classList.contains('low-hp-pulse'), true, 'Deve ativar animação pulsante sob HP crítico');

  // Estado caído (Downed)
  sb.player.isDowned = true;
  sb.player.bleedTimer = 22.4;
  sb.hud();
  assert.ok(/CAÍDO \(23s\)/.test(hpValEl.textContent), `Texto de agonia deve exibir temporizador: ${hpValEl.textContent}`);

  console.log('✓ Barra de vida Battlefield, cores dinâmicas e aviso de agonia OK');
}

// =========================================================================
// TESTE 4: HUD de Armamento Completo (Slots 1, 2, 3, 4, G, X)
// =========================================================================
console.log('--- Teste 4: Arsenal Completo, Slots & Munição ---');
{
  const { sb, elements } = setupSandbox();
  const HUD = sb.PXHUD;

  sb.player.hp = 100;
  sb.player.isDowned = false;
  sb.weapon = 'rifle';
  sb.ammo = 5;
  sb.hud();

  const slot1 = elements.get('bf-slot-1');
  const slot2 = elements.get('bf-slot-2');
  const slot3 = elements.get('bf-slot-3');
  const slot4 = elements.get('bf-slot-4');
  const slotG = elements.get('bf-slot-g');
  const slotX = elements.get('bf-slot-x');

  const ammo1 = elements.get('bf-slot-ammo-1');
  const ammo2 = elements.get('bf-slot-ammo-2');
  const ammo3 = elements.get('bf-slot-ammo-3');
  const ammo4 = elements.get('bf-slot-ammo-4');
  const ammoG = elements.get('bf-slot-ammo-g');
  const ammoX = elements.get('bf-slot-ammo-x');

  // Slot 1 (Fuzil) ativo inicialmente
  assert.equal(slot1.classList.contains('active'), true, 'Slot 1 deve estar ativo para rifle');
  assert.equal(slot2.classList.contains('active'), false, 'Slot 2 inativo');
  assert.equal(slot3.classList.contains('active'), false, 'Slot 3 inativo');
  assert.equal(slot4.classList.contains('active'), false, 'Slot 4 inativo');
  assert.equal(ammo1.textContent, '5 / 5', 'Munição do fuzil deve exibir 5 / 5');

  // Troca para Slot 2 (SMG) via clique de mouse
  slot2.onclick();
  assert.equal(sb.weapon, 'smg', 'Clique no Slot 2 deve equipar smg');
  assert.equal(slot1.classList.contains('active'), false, 'Slot 1 não deve estar ativo');
  assert.equal(slot2.classList.contains('active'), true, 'Slot 2 deve estar ativo para smg');
  assert.equal(ammo2.textContent, '20 / 20', 'Munição da Thompson/MP18 deve exibir 20 / 20');

  // Troca para Slot 3 (Pistola) via equipSlot
  HUD.equipSlot('3');
  assert.equal(sb.weapon, 'pistol', 'equipSlot 3 deve equipar pistola');
  assert.equal(slot3.classList.contains('active'), true, 'Slot 3 deve estar ativo');
  assert.equal(ammo3.textContent, '7 / 7', 'Munição da pistola deve exibir 7 / 7');

  // Troca para Slot 4 (Escopeta) via clique
  slot4.onclick();
  assert.equal(sb.weapon, 'shotgun', 'Clique no Slot 4 deve equipar escopeta Winchester 1897');
  assert.equal(slot4.classList.contains('active'), true, 'Slot 4 deve estar ativo');
  assert.equal(ammo4.textContent, '6 / 6', 'Munição da escopeta deve exibir 6 / 6');

  // Disparo e recarga
  sb.ammo = 2;
  sb.hud();
  assert.equal(ammo4.textContent, '2 / 6', 'Deve refletir gasto de munição (2 / 6)');

  sb.reload = 1.8;
  sb.hud();
  assert.equal(ammo4.textContent, 'RECARREGANDO...', 'Deve exibir aviso de recarga quando reload > 0');
  assert.equal(slot4.classList.contains('reloading'), true, 'Slot deve ter classe reloading');

  sb.reload = 0;
  sb.ammo = 6;
  sb.hud();
  assert.equal(ammo4.textContent, '6 / 6', 'Munição restaurada após recarga');

  // Slot G (Granada)
  assert.equal(ammoG.textContent, '2 / 2', 'Contagem inicial de granadas');
  slotG.onclick();
  assert.equal(sb.player.gren, 1, 'Lançar granada deve consumir 1');
  assert.equal(ammoG.textContent, '7s', 'Granada em cooldown deve exibir tempo restante');

  // Slot X (Baioneta)
  assert.equal(ammoX.textContent, 'PRONTA', 'Baioneta deve estar pronta');
  slotX.onclick();
  assert.equal(sb.PXSC.bayonetCharge.active, true, 'Clique no Slot X inicia carga de baioneta');
  assert.equal(ammoX.textContent, 'INVESTIDA!', 'Status de baioneta deve mudar para INVESTIDA!');
  assert.equal(slotX.classList.contains('active'), true, 'Slot X deve ficar destacado durante a carga');

  console.log('✓ Troca entre slots 1, 2, 3, 4, G, X, clique de mouse e munição OK');
}

// =========================================================================
// TESTE 5: Atualização de Status Tático
// =========================================================================
console.log('--- Teste 5: Status Tático Militar ---');
{
  const { sb, elements } = setupSandbox();
  const HUD = sb.PXHUD;

  const badge = elements.get('soldier-status-badge');
  assert.ok(badge, 'Badge de status tático deve existir');

  // 1. Pronto (Normal)
  sb.hud();
  assert.equal(badge.textContent, 'PRONTO', 'Status padrão deve ser PRONTO');
  assert.ok(badge.className.includes('bf-status-ready'));

  // 2. Apoiado em Cobertura (Weapon Mounting)
  sb.player.mounted = true;
  sb.hud();
  assert.equal(badge.textContent, 'APOIADO', 'Status deve atualizar para APOIADO');
  assert.ok(badge.className.includes('bf-status-mounted'));

  // 3. Suprimido (Sob Fogo Pesado)
  sb.player.mounted = false;
  sb.player.suppression = 0.9;
  sb.hud();
  assert.equal(badge.textContent, 'SUPRIMIDO', 'Status deve atualizar para SUPRIMIDO');
  assert.ok(badge.className.includes('bf-status-suppressed'));

  // 4. Carga de Baioneta
  sb.player.suppression = 0;
  sb.player.charging = true;
  sb.hud();
  assert.equal(badge.textContent, 'CARGA DE BAIONETA', 'Status deve atualizar para CARGA DE BAIONETA');
  assert.ok(badge.className.includes('bf-status-charge'));

  // 5. Em Agonia / Downed
  sb.player.charging = false;
  sb.player.isDowned = true;
  sb.hud();
  assert.equal(badge.textContent, 'EM AGONIA', 'Status deve atualizar para EM AGONIA');
  assert.ok(badge.className.includes('bf-status-agony'));

  console.log('✓ Atualização de status tático (Pronto, Apoiado, Suprimido, Carga, Em Agonia) OK');
}

// =========================================================================
// TESTE 6: Chave de Desligamento (Kill Switch)
// =========================================================================
console.log('--- Teste 6: Kill Switch via ?soldier_hud=0 e PXHUD.on = false ---');
{
  // 1. Desligamento dinâmico via flag PXHUD.on = false
  const { sb, elements } = setupSandbox();
  const HUD = sb.PXHUD;
  assert.equal(HUD.on, true, 'HUD deve iniciar ligado por padrão');

  const root = elements.get('soldier-hud');
  sb.hud();
  assert.equal(root.hidden, false, 'HUD deve estar visível no modo soldado');

  HUD.on = false;
  sb.hud();
  assert.equal(root.hidden, true, 'HUD deve ficar oculto quando HUD.on = false');
  assert.equal(HUD.equipSlot('1'), false, 'equipSlot deve retornar false quando desativado');

  // 2. Desligamento via parâmetro de URL (?soldier_hud=0)
  const disabledBox = setupSandbox('?soldier_hud=0');
  const disabledHUD = disabledBox.sb.PXHUD;
  assert.equal(disabledHUD.on, false, 'PXHUD.on deve ser falso quando inicializado com ?soldier_hud=0');

  disabledBox.sb.hud();
  const disabledRoot = disabledBox.elements.get('soldier-hud');
  assert.equal(disabledRoot.hidden, true, 'HUD com ?soldier_hud=0 deve permanecer oculto');

  console.log('✓ Kill switch dinâmico e via URL OK');
}

console.log('\n============================================================');
console.log('Todos os testes de soldier-hud.test.cjs passaram com 100% de sucesso!');
console.log('============================================================\n');
