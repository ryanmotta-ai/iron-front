'use strict';
/* Iron Front — Interface de Soldado no Estilo Battlefield (Battlefield 1)
   Módulo independente carregado DEPOIS de game.js, soldier-combat.js e soldier-tactics.js.
   1. Identidade do Soldado (Avatar Pixel Art + Nome & Patente de época por facção)
   2. Barra de Vida no Estilo Battlefield (Cores dinâmicas, marcações militares, badge tático)
   3. HUD de Armamento Completo (Slots 1, 2, 3, 4, G, X com destaque ativo e clique com mouse)
   4. Kill switch via ?soldier_hud=0 ou PXHUD.on = false
*/
(function(){
  if (typeof window === 'undefined') return;

  const qs = typeof location !== 'undefined' ? location.search : '';
  const disabled = /[?&]soldier_hud=0/.test(qs);

  let _on = !disabled;
  const HUD = {
    version: '1.0',
    stats: {
      renders: 0,
      slotClicks: 0,
      identitiesAssigned: 0,
      errors: 0
    }
  };

  Object.defineProperty(HUD, 'on', {
    get() { return _on; },
    set(val) {
      _on = !!val;
      if (!_on) {
        const d = ensureDom();
        if (d && d.root) {
          d.root.hidden = true;
          if (d.root.style) d.root.style.display = 'none';
        }
      } else {
        updateHud();
      }
    }
  });

  /* ---------- Tabelas de Nomes e Patentes de Época ---------- */
  const RANKS = [
    // Time 0: Estados Unidos
    ['Pvt.', 'Pfc.', 'Cpl.', 'Sgt.'],
    // Time 1: Império Alemão
    ['Schütze', 'Gefr.', 'Uffz.', 'Fw.']
  ];

  const SURNAMES = [
    // Time 0: Estados Unidos
    ['Miller', 'Hayes', 'Baker', "O'Connor", 'Walker', 'Sullivan', 'Turner', 'Cooper', 'Bennett', 'Campbell', 'Kelly', 'Evans', 'Murphy', 'Wright'],
    // Time 1: Império Alemão
    ['Schmidt', 'Müller', 'Weber', 'Becker', 'Hoffmann', 'Wagner', 'Fischer', 'Schulz', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz']
  ];

  const WEAPON_NAMES = [
    // Time 0: Estados Unidos
    {
      1: 'SPRINGFIELD M1903',
      2: 'THOMPSON',
      3: 'COLT M1911',
      4: 'WINCHESTER 1897',
      G: 'MK II',
      X: 'BAIONETA CALADA'
    },
    // Time 1: Império Alemão
    {
      1: 'GEWEHR 98',
      2: 'MP 18',
      3: 'LUGER P08',
      4: 'MAUSER FLIEGER',
      G: 'STIELHANDGRANATE',
      X: 'BAIONETA CALADA'
    }
  ];

  const SLOT_TO_WEAPON = {
    '1': 'rifle',
    '2': 'smg',
    '3': 'pistol',
    '4': 'shotgun'
  };

  const WEAPON_TO_SLOT = {
    'rifle': '1',
    'smg': '2',
    'pistol': '3',
    'shotgun': '4'
  };

  /* ---------- Cores Oficiais da Barra de Vida ---------- */
  const COLOR_GREEN = '#2ed573'; // Verde militar / Ciano tático (> 60%)
  const COLOR_AMBER = '#ffa502'; // Âmbar / Amarelo de alerta (30% a 60%)
  const COLOR_RED = '#ff4757';   // Vermelho sangue pulsante (< 30%)

  function getHpColor(ratio) {
    if (ratio > 0.6) return COLOR_GREEN;
    if (ratio >= 0.3) return COLOR_AMBER;
    return COLOR_RED;
  }

  /* ---------- Atribuição de Identidade do Soldado ---------- */
  function assignSoldierIdentity(soldier) {
    if (!soldier) return;
    const team = soldier.team === 1 ? 1 : 0;

    if (!soldier.soldierSeed || typeof soldier.soldierSeed !== 'number') {
      soldier.soldierSeed = Math.floor(Math.random() * 900000) + 100000;
    }

    const rankList = RANKS[team];
    const nameList = SURNAMES[team];

    if (!soldier.soldierRank) {
      const rIdx = (soldier.soldierSeed >>> 3) % rankList.length;
      soldier.soldierRank = rankList[rIdx];
    }

    if (!soldier.soldierName) {
      const nIdx = (soldier.soldierSeed >>> 7) % nameList.length;
      soldier.soldierName = nameList[nIdx];
    }

    HUD.stats.identitiesAssigned++;
  }

  /* ---------- Renderização do Avatar em Pixel Art (Canvas 48x48) ---------- */
  function renderAvatar(canvas, soldier) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width || 48;
    const h = canvas.height || 48;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const seed = (soldier && soldier.soldierSeed) ? soldier.soldierSeed : 123456;
    const team = soldier && soldier.team === 1 ? 1 : 0;
    const hp = soldier && typeof soldier.hp === 'number' ? soldier.hp : 100;
    const maxhp = soldier && soldier.maxhp ? soldier.maxhp : 100;
    const ratio = Math.max(0, hp / maxhp);
    const isDowned = !!(soldier && (soldier.isDowned || soldier.down || hp <= 0));
    const isWounded = !isDowned && ratio < 0.4;

    // Fundo escuro de abrigo de trincheira
    ctx.fillStyle = '#101612';
    ctx.fillRect(0, 0, w, h);

    // Textura sutil de vigas de madeira do bunker
    ctx.fillStyle = '#17201a';
    ctx.fillRect(2, 2, 8, 44);
    ctx.fillRect(38, 2, 8, 44);
    ctx.fillStyle = '#1e2820';
    ctx.fillRect(4, 2, 4, 44);

    // Paletas de tom de pele
    const skinTones = [
      { base: '#d8ab8c', dark: '#b7886c', light: '#e8c4a9' },
      { base: '#caa082', dark: '#a97f64', light: '#dbc0a7' },
      { base: '#e0be9f', dark: '#c29d80', light: '#edd0b7' },
      { base: '#be9275', dark: '#9f7358', light: '#d4ad94' }
    ];
    let skin = skinTones[seed % skinTones.length];
    if (isDowned) {
      // Tom pálido e cadavérico se em agonia
      skin = { base: '#b0a89c', dark: '#8f887d', light: '#c8c2b8' };
    }

    const px = (x, y, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    };
    const rect = (x, y, rw, rh, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, rw, rh);
    };

    // Fardamento / Ombros (y: 38 a 47)
    const uniColor = team === 0 ? '#4e5a3c' : '#475354';
    const uniShadow = team === 0 ? '#38422b' : '#343d3e';
    const uniHighlight = team === 0 ? '#63734e' : '#5b6a6b';

    rect(8, 38, 32, 10, uniColor);
    rect(6, 41, 36, 7, uniColor);
    rect(10, 44, 28, 4, uniShadow);
    rect(14, 38, 20, 2, uniHighlight);

    // Colarinho / Gravata / Insígnias
    if (team === 0) {
      // EUA: Colarinho cáqui e gravata militar de campanha
      rect(22, 38, 4, 8, '#2c3520');
      rect(23, 39, 2, 6, '#6b5c3e');
    } else {
      // Alemanha: Colarinho alto com Litzen (vermelho/branco)
      rect(20, 37, 8, 3, '#323c3d');
      rect(21, 38, 2, 2, '#c0392b');
      rect(25, 38, 2, 2, '#c0392b');
    }

    // Pescoço (y: 32 a 37)
    rect(20, 32, 8, 6, skin.dark);
    rect(21, 33, 6, 5, skin.base);

    // Rosto (y: 19 a 33)
    rect(17, 19, 14, 13, skin.base);
    rect(18, 18, 12, 1, skin.base);
    rect(19, 32, 10, 2, skin.dark); // Sombra da mandíbula
    rect(20, 33, 8, 1, skin.base); // Queixo
    rect(21, 34, 6, 1, skin.dark);

    // Orelhas
    rect(15, 23, 2, 5, skin.dark);
    rect(16, 24, 1, 3, skin.base);
    rect(31, 23, 2, 5, skin.dark);
    rect(31, 24, 1, 3, skin.base);

    // Nariz (y: 25 a 28)
    rect(23, 25, 2, 4, skin.dark);
    rect(22, 28, 4, 1, skin.dark);
    rect(23, 26, 1, 2, skin.light);

    // Olhos e Sobrancelhas (y: 21 a 25)
    if (isDowned) {
      // Olhos caídos / agonizantes
      rect(18, 24, 4, 1, '#3b2520');
      rect(26, 24, 4, 1, '#3b2520');
      rect(18, 25, 4, 1, skin.dark);
      rect(26, 25, 4, 1, skin.dark);
    } else {
      // Olhos determinados de combatente
      rect(18, 23, 4, 2, '#e0e5d8');
      rect(26, 23, 4, 2, '#e0e5d8');
      const eyeCol = (seed % 2 === 0) ? '#2c3e50' : '#4a3728';
      rect(20, 23, 2, 2, eyeCol);
      rect(27, 23, 2, 2, eyeCol);

      // Sobrancelhas
      rect(17, 21, 5, 1, '#3d3024');
      rect(26, 21, 5, 1, '#3d3024');
      if (isWounded) {
        // Expressão de dor / cenho franzido
        rect(21, 22, 2, 1, '#3d3024');
        rect(25, 22, 2, 1, '#3d3024');
      }
    }

    // Boca (y: 30 a 31)
    if (isDowned) {
      rect(22, 30, 4, 2, '#381616');
    } else if (isWounded) {
      rect(22, 30, 4, 1, '#542d25');
    } else {
      rect(22, 30, 4, 1, '#663b30');
    }

    // Barba rala / Sujeira da trincheira
    if (seed % 3 !== 0) {
      const stubbleCol = '#665345';
      px(19, 31, stubbleCol);
      px(21, 32, stubbleCol);
      px(26, 32, stubbleCol);
      px(28, 31, stubbleCol);
      px(24, 33, stubbleCol);
    }

    // Marcas de lama da terra de ninguém
    const mudCol = '#382b1d';
    px(18 + (seed % 4), 28, mudCol);
    px(28 - (seed % 3), 29, mudCol);
    px(19, 20 + (seed % 3), mudCol);

    // Capacete de Época
    const tilt = isDowned ? 2 : 0;

    if (team === 0) {
      // EUA: Brodie Helmet ("Doughboy")
      const hCol = '#556242';
      const hDark = '#38422a';
      const hLight = '#6e7f57';

      // Cúpula abaulada rasa
      rect(16 + tilt, 10, 16, 2, hLight);
      rect(14 + tilt, 12, 20, 4, hCol);
      rect(13 + tilt, 16, 22, 3, hDark);

      // Aba circular larga característica
      rect(9 + tilt, 19, 30, 2, hLight);
      rect(8 + tilt, 20, 32, 1, hDark);

      // Jugular de couro
      if (!isDowned) {
        rect(16 + tilt, 21, 1, 8, '#4a3625');
        rect(31 + tilt, 21, 1, 8, '#4a3625');
        rect(17 + tilt, 29, 14, 1, '#4a3625');
      }
    } else {
      // Alemanha: Stahlhelm M1916
      const hCol = '#4e5b5c';
      const hDark = '#363f40';
      const hLight = '#667778';

      // Cúpula profunda
      rect(17 + tilt, 8, 14, 3, hLight);
      rect(15 + tilt, 11, 18, 5, hCol);
      rect(14 + tilt, 16, 20, 3, hDark);

      // Parafusos de ventilação / chifres (Stirnpanzer lugs) nas laterais
      rect(13 + tilt, 14, 2, 2, '#232b2c');
      rect(33 + tilt, 14, 2, 2, '#232b2c');

      // Guarda-pescoço alargado e aba frontal
      rect(13 + tilt, 18, 22, 2, hCol);
      rect(12 + tilt, 20, 5, 3, hDark);
      rect(31 + tilt, 20, 5, 3, hDark);
      rect(16 + tilt, 19, 16, 1, hLight);
    }

    // Ferimentos e Sangue
    if (isWounded) {
      rect(20, 22, 2, 5, '#99141a');
      rect(21, 26, 1, 3, '#c0392b');
      px(20, 29, '#780f14');
    } else if (isDowned) {
      rect(18, 20, 8, 3, '#d8d4c9'); // Faixa de atadura ensanguentada
      rect(21, 21, 3, 2, '#99141a');
      rect(27, 24, 2, 7, '#99141a');
      rect(28, 31, 2, 4, '#780f14');
      px(22, 33, '#99141a');
      px(23, 34, '#99141a');
    }

    // Borda do canvas
    ctx.strokeStyle = '#2b382d';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    ctx.restore();
    HUD.stats.renders++;
  }

  /* ---------- Determinação de Status Tático ---------- */
  function getStatus(p) {
    if (!p) return 'INATIVO';
    if (p.isDowned || p.down || p.hp <= 0) {
      return 'EM AGONIA';
    }
    if (p.charging || (window.PXSC && PXSC.bayonetCharge && PXSC.bayonetCharge.active)) {
      return 'CARGA DE BAIONETA';
    }
    if ((p.suppression || 0) > 0.4 || p.pinned) {
      return 'SUPRIMIDO';
    }
    if (p.mounted) {
      return 'APOIADO';
    }
    if (p.aiming) {
      return 'MIRA FOCADA';
    }
    if (typeof reload !== 'undefined' && reload > 0) {
      return 'RECARREGANDO';
    }
    return 'PRONTO';
  }

  function getStatusClass(status) {
    switch (status) {
      case 'EM AGONIA': return 'bf-status-agony';
      case 'CARGA DE BAIONETA': return 'bf-status-charge';
      case 'SUPRIMIDO': return 'bf-status-suppressed';
      case 'APOIADO': return 'bf-status-mounted';
      case 'MIRA FOCADA': return 'bf-status-aiming';
      case 'RECARREGANDO': return 'bf-status-reloading';
      default: return 'bf-status-ready';
    }
  }

  /* ---------- Troca de Armas / Execução de Slot ---------- */
  function equipSlot(slotKey) {
    if (!HUD.on) return false;
    HUD.stats.slotClicks++;

    if (typeof mode === 'undefined' || mode !== 'soldier') return false;
    if (typeof player === 'undefined' || !player || player.hp <= 0 || player.type === 'tank') return false;

    const key = String(slotKey).toUpperCase();

    if (key === '1') {
      if (typeof window.changeWeapon === 'function') window.changeWeapon('rifle');
      return true;
    }
    if (key === '2') {
      if (typeof window.changeWeapon === 'function') window.changeWeapon('smg');
      return true;
    }
    if (key === '3') {
      if (typeof window.changeWeapon === 'function') window.changeWeapon('pistol');
      return true;
    }
    if (key === '4') {
      if (window.PXSC && typeof PXSC.registerShotgun === 'function') {
        PXSC.registerShotgun();
      }
      if (typeof window.changeWeapon === 'function') window.changeWeapon('shotgun');
      return true;
    }
    if (key === 'G') {
      if (typeof window.grenade === 'function') {
        window.grenade();
        return true;
      }
      return false;
    }
    if (key === 'X') {
      if (window.PXSC && typeof PXSC.startBayonetCharge === 'function') {
        return PXSC.startBayonetCharge();
      }
      return false;
    }
    return false;
  }

  /* ---------- Construção e Cache do DOM do HUD ---------- */
  let dom = null;

  function ensureDom() {
    if (typeof document === 'undefined') return null;
    if (dom && dom.root) return dom;

    let root = document.getElementById('soldier-hud');
    if (!root) {
      const create = (tag, id, cls) => {
        const el = document.createElement(tag);
        if (id) el.id = id;
        if (cls) el.className = cls;
        return el;
      };

      root = create('div', 'soldier-hud', 'bf-soldier-hud');
      root.hidden = true;

      // Card de Identidade do Soldado
      const card = create('div', '', 'bf-soldier-card');
      const avatarBox = create('div', '', 'bf-avatar-box');
      const avatarCanvas = create('canvas', 'soldier-avatar', 'bf-avatar-canvas');
      avatarCanvas.width = 48;
      avatarCanvas.height = 48;
      const factionTag = create('div', 'soldier-faction-tag', 'bf-faction-tag');
      factionTag.textContent = 'EUA';
      avatarBox.appendChild(avatarCanvas);
      avatarBox.appendChild(factionTag);

      const meta = create('div', '', 'bf-soldier-meta');
      const identity = create('div', '', 'bf-soldier-identity');
      const rank = create('span', 'soldier-rank', 'bf-rank');
      rank.textContent = 'Pvt.';
      const name = create('span', 'soldier-name', 'bf-name');
      name.textContent = 'Soldado';
      identity.appendChild(rank);
      identity.appendChild(name);

      const statusBadge = create('div', 'soldier-status-badge', 'bf-status-badge bf-status-ready');
      statusBadge.textContent = 'PRONTO';
      meta.appendChild(identity);
      meta.appendChild(statusBadge);

      card.appendChild(avatarBox);
      card.appendChild(meta);
      root.appendChild(card);

      // Seção de HP
      const hpSection = create('div', '', 'bf-hp-section');
      const hpHeader = create('div', '', 'bf-hp-header');
      const hpLabel = create('span', '', 'bf-hp-label');
      hpLabel.textContent = 'COND. VITAL';
      const hpNumbers = create('div', '', 'bf-hp-numbers');
      const hpVal = create('b', 'soldier-hp-value', 'bf-hp-val');
      hpVal.textContent = '100 HP';
      hpNumbers.appendChild(hpVal);
      hpHeader.appendChild(hpLabel);
      hpHeader.appendChild(hpNumbers);

      const hpTrack = create('div', '', 'bf-hp-track');
      const hpBar = create('div', 'soldier-hp-bar', 'bf-hp-bar');
      hpBar.style.width = '100%';
      hpBar.style.background = COLOR_GREEN;
      hpBar.style.backgroundColor = COLOR_GREEN;

      const hpTicks = create('div', '', 'bf-hp-ticks');
      for (let i = 0; i < 4; i++) {
        hpTicks.appendChild(create('span', '', 'bf-tick'));
      }
      hpTrack.appendChild(hpBar);
      hpTrack.appendChild(hpTicks);

      hpSection.appendChild(hpHeader);
      hpSection.appendChild(hpTrack);
      root.appendChild(hpSection);

      // Slots de Armas
      const slotsGrid = create('div', 'soldier-weapon-slots', 'bf-weapon-slots');
      const slotKeys = ['1', '2', '3', '4', 'G', 'X'];
      slotKeys.forEach(k => {
        const btn = create('button', `bf-slot-${k.toLowerCase()}`, `bf-slot${k === '1' ? ' active' : ''}`);
        btn.type = 'button';
        btn.setAttribute('data-slot', k);
        btn.setAttribute('aria-selected', k === '1' ? 'true' : 'false');

        const keySpan = create('span', '', 'bf-slot-key');
        keySpan.textContent = k;
        const nameSpan = create('span', `bf-slot-name-${k.toLowerCase()}`, 'bf-slot-name');
        const ammoSpan = create('span', `bf-slot-ammo-${k.toLowerCase()}`, 'bf-slot-ammo');

        btn.appendChild(keySpan);
        btn.appendChild(nameSpan);
        btn.appendChild(ammoSpan);
        slotsGrid.appendChild(btn);
      });
      root.appendChild(slotsGrid);

      const parent = document.getElementById('field') || document.body;
      if (parent && typeof parent.appendChild === 'function') {
        parent.appendChild(root);
      }
    }

    const byId = id => document.getElementById(id);

    dom = {
      root,
      avatar: byId('soldier-avatar'),
      factionTag: byId('soldier-faction-tag'),
      rank: byId('soldier-rank'),
      name: byId('soldier-name'),
      statusBadge: byId('soldier-status-badge'),
      hpVal: byId('soldier-hp-value'),
      hpBar: byId('soldier-hp-bar'),
      slots: {
        '1': byId('bf-slot-1'),
        '2': byId('bf-slot-2'),
        '3': byId('bf-slot-3'),
        '4': byId('bf-slot-4'),
        'G': byId('bf-slot-g'),
        'X': byId('bf-slot-x')
      },
      slotNames: {
        '1': byId('bf-slot-name-1'),
        '2': byId('bf-slot-name-2'),
        '3': byId('bf-slot-name-3'),
        '4': byId('bf-slot-name-4'),
        'G': byId('bf-slot-name-g'),
        'X': byId('bf-slot-name-x')
      },
      slotAmmos: {
        '1': byId('bf-slot-ammo-1'),
        '2': byId('bf-slot-ammo-2'),
        '3': byId('bf-slot-ammo-3'),
        '4': byId('bf-slot-ammo-4'),
        'G': byId('bf-slot-ammo-g'),
        'X': byId('bf-slot-ammo-x')
      }
    };

    // Associa eventos de clique nos slots
    ['1', '2', '3', '4', 'G', 'X'].forEach(key => {
      const btn = dom.slots[key];
      if (btn) {
        btn.onclick = (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          equipSlot(key);
          updateHud();
        };
      }
    });

    return dom;
  }

  /* ---------- Atualização Completa da Interface (HUD Update) ---------- */
  let lastAvatarSeed = null;
  let lastAvatarHpState = null;

  function updateHud() {
    if (!HUD.on) {
      if (dom && dom.root) {
        dom.root.hidden = true;
        if (dom.root.style) dom.root.style.display = 'none';
      }
      return;
    }

    const isSoldier = typeof mode !== 'undefined' && mode === 'soldier';
    const p = typeof player !== 'undefined' ? player : null;

    const d = ensureDom();
    if (!d || !d.root) return;

    if (!isSoldier || !p) {
      d.root.hidden = true;
      if (d.root.style) d.root.style.display = 'none';
      return;
    }

    // Exibe o painel do HUD de soldado
    d.root.hidden = false;
    if (d.root.style) d.root.style.display = 'flex';

    // 1. Identidade do Soldado
    assignSoldierIdentity(p);

    const team = p.team === 1 ? 1 : 0;
    if (d.factionTag) {
      d.factionTag.textContent = team === 1 ? 'IMPÉRIO ALEMÃO' : 'EUA';
    }
    if (d.rank) {
      d.rank.textContent = p.soldierRank || (team === 1 ? 'Schütze' : 'Pvt.');
    }
    if (d.name) {
      d.name.textContent = p.soldierName || 'Soldado';
    }

    // Renderiza Avatar apenas quando muda o soldado ou o estado de saúde
    const curHp = typeof p.hp === 'number' ? Math.max(0, p.hp) : 100;
    const curMaxHp = p.maxhp || 100;
    const hpRatio = Math.max(0, Math.min(1, curHp / curMaxHp));
    const isDowned = !!(p.isDowned || p.down || curHp <= 0);
    const hpState = isDowned ? 'downed' : (hpRatio < 0.4 ? 'wounded' : 'normal');

    if (lastAvatarSeed !== p.soldierSeed || lastAvatarHpState !== hpState) {
      if (d.avatar) renderAvatar(d.avatar, p);
      lastAvatarSeed = p.soldierSeed;
      lastAvatarHpState = hpState;
    }

    // 2. Barra de Vida Battlefield
    const hpColor = getHpColor(hpRatio);
    if (d.hpVal) {
      if (isDowned) {
        const timer = p.bleedTimer !== undefined ? Math.ceil(p.bleedTimer) : 25;
        d.hpVal.textContent = `CAÍDO (${timer}s)`;
      } else {
        d.hpVal.textContent = `${Math.ceil(curHp)} HP`;
      }
    }

    if (d.hpBar) {
      const pct = Math.round(hpRatio * 100);
      d.hpBar.style.width = `${pct}%`;
      d.hpBar.style.background = hpColor;
      d.hpBar.style.backgroundColor = hpColor;

      if (hpRatio < 0.3) {
        d.hpBar.classList.add('low-hp-pulse');
      } else {
        d.hpBar.classList.remove('low-hp-pulse');
      }
    }

    // Status Tático
    const statusText = getStatus(p);
    if (d.statusBadge) {
      d.statusBadge.textContent = statusText;
      d.statusBadge.className = `bf-status-badge ${getStatusClass(statusText)}`;
    }

    // 3. Slots de Armamento Completo
    const activeWep = typeof weapon !== 'undefined' ? weapon : 'rifle';
    const isCharging = !!(p.charging || (window.PXSC && PXSC.bayonetCharge && PXSC.bayonetCharge.active));
    const activeSlotKey = isCharging ? 'X' : (WEAPON_TO_SLOT[activeWep] || '1');

    const wepNames = WEAPON_NAMES[team];

    // Atualiza nomes e armas em cada slot
    ['1', '2', '3', '4', 'G', 'X'].forEach(key => {
      const slotBtn = d.slots[key];
      const nameEl = d.slotNames[key];
      const ammoEl = d.slotAmmos[key];

      if (!slotBtn) return;

      const isActive = key === activeSlotKey;
      if (isActive) {
        slotBtn.classList.add('active');
        slotBtn.setAttribute('aria-selected', 'true');
      } else {
        slotBtn.classList.remove('active');
        slotBtn.setAttribute('aria-selected', 'false');
      }

      if (nameEl) {
        nameEl.textContent = wepNames[key] || '';
      }

      if (ammoEl) {
        if (key === 'G') {
          const gCount = p.gren !== undefined ? p.gren : 2;
          const gCd = typeof grenadeCooldown !== 'undefined' ? grenadeCooldown : 0;
          ammoEl.textContent = gCd > 0 ? `${Math.ceil(gCd)}s` : `${gCount} / 2`;
          slotBtn.classList.toggle('reloading', gCd > 0);
        } else if (key === 'X') {
          if (isCharging) {
            ammoEl.textContent = 'INVESTIDA!';
            slotBtn.classList.add('active');
          } else if (window.PXSC && PXSC.bayonetCharge && PXSC.bayonetCharge.exhausted > 0) {
            ammoEl.textContent = 'EXAUSTO';
            slotBtn.classList.remove('active');
          } else if (window.PXSC && PXSC.bayonetCharge && PXSC.bayonetCharge.cooldown > 0) {
            ammoEl.textContent = `${Math.ceil(PXSC.bayonetCharge.cooldown)}s`;
            slotBtn.classList.remove('active');
          } else {
            ammoEl.textContent = 'PRONTA';
          }
        } else {
          // Slots 1 a 4 (Armas de fogo)
          const slotWepId = SLOT_TO_WEAPON[key];
          const wepDef = typeof weapons !== 'undefined' && weapons[slotWepId] ? weapons[slotWepId] : null;
          const maxMag = wepDef ? wepDef.mag : (key === '1' ? 5 : (key === '2' ? 20 : (key === '3' ? 7 : 6)));

          if (isActive) {
            const isReloading = typeof reload !== 'undefined' && reload > 0;
            if (isReloading) {
              ammoEl.textContent = 'RECARREGANDO...';
              slotBtn.classList.add('reloading');
            } else {
              const liveAmmo = typeof ammo !== 'undefined' ? ammo : maxMag;
              ammoEl.textContent = `${liveAmmo} / ${maxMag}`;
              slotBtn.classList.remove('reloading');
            }
          } else {
            slotBtn.classList.remove('reloading');
            const magVal = (typeof magazines !== 'undefined' && magazines[slotWepId] !== undefined)
              ? magazines[slotWepId]
              : maxMag;
            ammoEl.textContent = `${magVal} / ${maxMag}`;
          }
        }
      }
    });
  }

  /* ---------- Interceptadores (Wraps) para sincronização ---------- */
  const wrap = (name, fn) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(...a) {
      return fn(orig, ...a);
    };
  };

  wrap('hud', (orig) => {
    orig();
    try {
      updateHud();
    } catch (e) {
      HUD.stats.errors++;
    }
  });

  wrap('setMode', (orig, ...a) => {
    const res = orig(...a);
    try {
      if (HUD.on) updateHud();
    } catch (e) {}
    return res;
  });

  wrap('changeWeapon', (orig, ...a) => {
    const res = orig(...a);
    try {
      if (HUD.on) updateHud();
    } catch (e) {}
    return res;
  });

  wrap('setup', (orig, ...a) => {
    const res = orig(...a);
    try {
      lastAvatarSeed = null;
      lastAvatarHpState = null;
      if (HUD.on) updateHud();
    } catch (e) {}
    return res;
  });

  /* ---------- Eventos de Teclado (1, 2, 3, 4, G, X) ---------- */
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', (e) => {
      if (!HUD.on || e.repeat) return;
      if (typeof document !== 'undefined' && document.querySelector && document.querySelector('dialog[open]')) return;
      if (typeof started !== 'undefined' && !started) return;
      if (typeof ended !== 'undefined' && ended) return;
      if (typeof mode === 'undefined' || mode !== 'soldier') return;

      const k = e.key ? (e.key.length === 1 ? e.key.toLowerCase() : e.key) : '';
      if (['1', '2', '3', '4', 'g', 'x'].includes(k)) {
        setTimeout(() => {
          if (HUD.on) updateHud();
        }, 10);
      }
    }, true);
  }

  /* ---------- Inicialização Imediata ---------- */
  try {
    if (typeof document !== 'undefined' && document.readyState !== 'loading') {
      ensureDom();
    } else if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', ensureDom);
    }
  } catch (e) {}

  /* ---------- Métodos de API & Teste ---------- */
  HUD.assignSoldierIdentity = assignSoldierIdentity;
  HUD.renderAvatar = renderAvatar;
  HUD.getHpColor = getHpColor;
  HUD.getStatus = getStatus;
  HUD.equipSlot = equipSlot;
  HUD.update = updateHud;
  HUD.getDom = () => dom;
  HUD.ranks = RANKS;
  HUD.surnames = SURNAMES;
  HUD.colors = {
    green: COLOR_GREEN,
    amber: COLOR_AMBER,
    red: COLOR_RED
  };

  HUD.state = () => ({
    on: HUD.on,
    activeSlot: typeof weapon !== 'undefined' ? (WEAPON_TO_SLOT[weapon] || '1') : '1',
    status: typeof player !== 'undefined' && player ? getStatus(player) : 'INATIVO',
    stats: { ...HUD.stats }
  });

  HUD.reset = () => {
    lastAvatarSeed = null;
    lastAvatarHpState = null;
  };

  // Exportação Global
  window.PXHUD = HUD;
  window.IronFrontSoldierHUD = HUD;
  if (typeof window.IronFront === 'object' && window.IronFront !== null) {
    window.IronFront.soldierHUD = HUD;
  }
})();
