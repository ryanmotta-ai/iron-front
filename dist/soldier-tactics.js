'use strict';
/* Iron Front — Liderança de Esquadrão, Sobrevivência & Táticas do Modo Soldado.
   Carrega como um módulo independente de Iron Front (no padrão de assault.js, medics.js, frontline.js).
   Envolve setup / update / render / hud / damage / protectedBy.
   Adiciona:
   1. Apito Pessoal de NCO (Tecla T): cancela supressão, bônus de moral (+30% vel, imunidade a pinning) e avanço.
   2. Pings Contextuais de Esquadrão (Tecla F): Fogo de Supressão, Guarnecer Posição, Avançar para cá.
   3. Sobrevivência / Estado Caído (Downed): jogador entra em agonia, sangra por 25s, rasteja a 11 px/s, atira com pistola e pode ser socorrido.
   4. Auto-Bandagem de Emergência (Tecla H): 2.2s parado para estancar ferimentos e recuperar +35 HP (2 por vida, cd 30s).
   5. Saque de Cadáveres (Tecla E): recupera munição (+1 pente) e granadas (+1 até 2) de corpos a < 24 px.
   Desliga com ?soldier_tactics=0 na URL ou PXST.on = false. */
(function(){
if (typeof window === 'undefined') return;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;

const wrap = (name, fn) => {
  const orig = window[name];
  if (typeof orig !== 'function') {
    return;
  }
  window[name] = function(...a) {
    return fn(orig, ...a);
  };
};

const CFG = {
  WHISTLE_CD: 25,
  WHISTLE_RADIUS: 260,
  MORALE_DUR: 6,
  MORALE_SPEED_BOOST: 0.30,
  PING_DUR: 3,
  DOWNED_BLEED: 25,
  CRAWL_SPEED: 11,
  REVIVE_HP: 0.50,
  OVERKILL_MAX: 60,
  BANDAGE_TIME: 2.2,
  BANDAGE_HEAL: 35,
  BANDAGE_CD: 30,
  BANDAGE_MAX_USES: 2,
  LOOT_RADIUS: 24
};

const S = window.PXST = {
  on: !/[?&]soldier_tactics=0/.test(typeof location !== 'undefined' ? location.search : ''),
  version: '1.0',
  cfg: CFG,
  stats: {
    errors: 0,
    whistles: 0,
    pings: 0,
    downedCount: 0,
    revivedCount: 0,
    bandagesApplied: 0,
    corpsesLooted: 0
  }
};

let whistleCd = 0;
let pings = [];
let bandageProgress = 0;
let bandageStartPos = null;
let lastKeys = {};
let errs = 0;

function fail(e) {
  S.stats.errors++;
  if (++errs <= 3) console.error('soldier-tactics.js:', e);
  if (errs >= 12) {
    S.on = false;
    console.error('soldier-tactics.js desligado após erros repetidos');
  }
}

/* ---------- Áudio Sintetizado ---------- */
const getAudio = () => {
  try {
    return (typeof soundOn !== 'undefined' && soundOn && typeof audio !== 'undefined' && audio) ? audio : null;
  } catch {
    return null;
  }
};

function whistleAudio() {
  const a = getAudio();
  if (!a) return;
  try {
    const t = a.currentTime;
    const o = a.createOscillator(), l = a.createOscillator(), lg = a.createGain(), g = a.createGain();
    o.type = 'sine';
    o.frequency.value = 2600;
    l.frequency.value = 25;
    lg.gain.value = 220;
    l.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.03);
    g.gain.setValueAtTime(0.06, t + 0.38);
    g.gain.linearRampToValueAtTime(0, t + 0.44);
    g.gain.linearRampToValueAtTime(0.06, t + 0.52);
    g.gain.setValueAtTime(0.06, t + 1.0);
    g.gain.linearRampToValueAtTime(0, t + 1.12);
    o.connect(g);
    g.connect(a.destination);
    o.start(t); l.start(t);
    o.stop(t + 1.15); l.stop(t + 1.15);
  } catch {}
}

function bandageAudio() {
  const a = getAudio();
  if (!a) return;
  try {
    const dur = 0.45, n = Math.ceil(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.4);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf;
    f.type = 'bandpass';
    f.frequency.value = 850;
    f.Q.value = 1.8;
    g.gain.setValueAtTime(0.07, a.currentTime);
    g.gain.linearRampToValueAtTime(0, a.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(); src.stop(a.currentTime + dur);
  } catch {}
}

function pingAudio() {
  const a = getAudio();
  if (!a) return;
  try {
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(950, t);
    o.frequency.exponentialRampToValueAtTime(320, t + 0.14);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + 0.14);
  } catch {}
}

/* ======================================================================================
   1. APITO PESSOAL DO SOLDADO / NCO (TECLA T)
   ====================================================================================== */
function blowWhistle() {
  if (!S.on) return false;
  if (typeof mode === 'undefined' || mode !== 'soldier') return false;
  if (typeof player === 'undefined' || !player || player.hp <= 0 || player.isDowned) return false;
  if (whistleCd > 0) {
    if (typeof toast === 'function') toast(`Apito em recarga (${Math.ceil(whistleCd)}s)`);
    return false;
  }

  whistleCd = CFG.WHISTLE_CD;
  S.stats.whistles++;
  whistleAudio();
  if (typeof sound === 'function') sound('click');

  const now = typeof time !== 'undefined' ? time : 0;
  const list = typeof units !== 'undefined' ? units : [];
  let affected = 0;

  // Direção apontada pelo jogador
  let aimAngle = player.angle;
  if (aimAngle === undefined && typeof mouse !== 'undefined' && mouse.wx !== undefined) {
    aimAngle = Math.atan2(mouse.wy - player.y, mouse.wx - player.x);
  }
  if (aimAngle === undefined) aimAngle = 0;

  for (const u of list) {
    if (u === player || u.team !== player.team || u.hp <= 0 || u.down || u.isDowned) continue;
    const d = hyp(u.x - player.x, u.y - player.y);
    if (d <= CFG.WHISTLE_RADIUS) {
      affected++;
      // 1. Sai de supressão / deitado imediatamente
      u.suppression = 0;
      u.pinned = false;
      u.crawlTo = null;
      if (u.pinSave) {
        if (u.pinSave.order) u.order = u.pinSave.order;
        u.pinSave = null;
      }
      if (window.PXAS && typeof PXAS.unpin === 'function') {
        try { PXAS.unpin(u); } catch {}
      }

      // 2. Bônus moral por 6s (+30% vel, imunidade a pinning)
      u.moraleBonusUntil = now + CFG.MORALE_DUR;
      u.moraleBonus = CFG.MORALE_DUR;

      // 3. Se estiver em 'hold', muda para 'move' em direção ao vetor ou objetivo mais próximo
      if (u.order === 'hold') {
        u.order = 'move';
        u.manualUntil = now + 15;
        let bestPoint = null, minPD = Infinity;
        if (typeof points !== 'undefined' && Array.isArray(points)) {
          for (const p of points) {
            if (p.owner !== player.team) {
              const pd = hyp(p.x - u.x, p.y - u.y);
              if (pd < minPD) { minPD = pd; bestPoint = p; }
            }
          }
        }
        if (bestPoint) {
          u.tx = bestPoint.x + Math.sin(u.id * 1.5) * 35;
          u.ty = bestPoint.y + Math.cos(u.id * 1.5) * 35;
        } else {
          u.tx = u.x + Math.cos(aimAngle) * 320;
          u.ty = u.y + Math.sin(aimAngle) * 320;
        }
      }
    }
  }

  if (typeof toast === 'function') {
    toast('Ao meu sinal! Pelotão ao ataque!');
  }
  return true;
}

/* ======================================================================================
   2. COMANDOS CONTEXTUAIS DE ESQUADRÃO (PING / TECLA F)
   ====================================================================================== */
function contextPing(mx, my) {
  if (!S.on) return false;
  if (typeof mode === 'undefined' || mode !== 'soldier') return false;
  if (typeof player === 'undefined' || !player || player.hp <= 0 || player.isDowned) return false;

  if (mx === undefined || my === undefined) {
    if (typeof mouse !== 'undefined' && mouse.wx !== undefined) {
      mx = mouse.wx;
      my = mouse.wy;
    } else if (typeof cam !== 'undefined') {
      mx = cam.x;
      my = cam.y;
    } else {
      mx = player.x;
      my = player.y;
    }
  }

  const now = typeof time !== 'undefined' ? time : 0;
  const list = typeof units !== 'undefined' ? units : [];
  const bList = typeof buildings !== 'undefined' ? buildings : [];
  const tList = typeof fieldTrenches !== 'undefined' ? fieldTrenches : [];

  let kind = 'advance';
  let targetEntity = null;

  // A. Perto de MG ou bunker inimigo (< 45 px): FOGO DE SUPRESSÃO!
  const enemyMG = list.find(u => u.team !== player.team && u.hp > 0 && !u.down && (u.type === 'mg' || u.type === 'nest') && hyp(u.x - mx, u.y - my) < 45);
  const enemyBunker = bList.find(b => b.team !== player.team && b.hp > 0 && (b.type === 'bunker' || b.type === 'nest' || b.type === 'pillbox' || b.type === 'mg') && hyp(b.x - mx, b.y - my) < 45);

  if (enemyMG || enemyBunker) {
    kind = 'suppression';
    targetEntity = enemyMG || enemyBunker;
  } else {
    // B. Em trincheira ou saco de areia aliado: GUARNECER POSIÇÃO!
    const inTrench = tList.find(t => (t.team === undefined || t.team === player.team) && Math.abs(t.x - mx) < (t.hw || 45) && Math.abs(t.y - my) < (t.hh || 25));
    const inBag = bList.find(b => b.team === player.team && (b.type === 'sandbag' || b.type === 'trench' || b.type === 'bunker') && Math.abs(b.x - mx) < (b.hw || 45) && Math.abs(b.y - my) < (b.hh || 25));
    if (inTrench || inBag) {
      kind = 'garrison';
      targetEntity = inTrench || inBag;
    } else {
      // C. Chão neutro / aberto: AVANÇAR PARA CÁ!
      kind = 'advance';
    }
  }

  // Candidatos aliados (3 a 4 infantes mais próximos)
  const friendly = list.filter(u => u.team === player.team && u !== player && u.hp > 0 && !u.down && !u.isDowned && (u.type === 'rifle' || u.type === 'mg'))
    .sort((a, b) => hyp(a.x - mx, a.y - my) - hyp(b.x - mx, b.y - my))
    .slice(0, 4);

  if (kind === 'suppression') {
    for (const u of friendly) {
      u.target = targetEntity;
      u.suppressTarget = targetEntity;
      u.suppressUntil = now + 7;
      u.manualUntil = now + 7;
    }
    if (typeof toast === 'function') toast('FOGO DE SUPRESSÃO!');
  } else if (kind === 'garrison') {
    friendly.forEach((u, i) => {
      u.order = 'move';
      u.tx = mx + (i - 1.5) * 8;
      u.ty = my + (i % 2 === 0 ? -4 : 4);
      u.manualUntil = now + 15;
      u.garrisonPos = { x: mx, y: my };
    });
    if (typeof toast === 'function') toast('GUARNECER POSIÇÃO!');
  } else {
    friendly.forEach((u, i) => {
      u.order = 'move';
      u.tx = mx + (i - 1.5) * 12;
      u.ty = my + (i % 2 === 0 ? -6 : 6);
      u.manualUntil = now + 20;
    });
    if (typeof toast === 'function') toast('AVANÇAR PARA cá');
  }

  // Feedback sonoro e marcador visual temporário de 3 segundos
  pingAudio();
  if (typeof sound === 'function') sound('click');
  pings.push({
    x: mx,
    y: my,
    kind,
    t: CFG.PING_DUR,
    maxT: CFG.PING_DUR,
    label: kind === 'suppression' ? 'FOGO DE SUPRESSÃO' : kind === 'garrison' ? 'GUARNECER' : 'AVANÇAR'
  });
  S.stats.pings++;
  return true;
}

/* ======================================================================================
   3. SOBREVIVÊNCIA: ESTADO CAÍDO (DOWNED / AGONIA)
   ====================================================================================== */
function triggerDowned(u) {
  u.hp = 1;
  u.isDowned = true;
  u.down = true;
  u.bleedTimer = CFG.DOWNED_BLEED;
  u.savedWeapon = typeof weapon !== 'undefined' ? weapon : 'rifle';
  if (typeof weapon !== 'undefined') {
    window.weapon = 'pistol';
  }
  if (typeof weapons !== 'undefined' && weapons.pistol) {
    if (typeof ammo !== 'undefined') window.ammo = weapons.pistol.mag;
    if (typeof magazines !== 'undefined') magazines.pistol = weapons.pistol.mag;
  }
  if (typeof reload !== 'undefined') window.reload = 0;
  S.stats.downedCount++;
  if (typeof toast === 'function') {
    toast('FERIDO EM AGONIA! Rasteje até um abrigo e aperte [E] por socorro.');
  }
}

function callForHelp() {
  if (!S.on) return false;
  if (typeof player === 'undefined' || !player || !player.isDowned) return false;

  if (typeof toast === 'function') toast('SOCORRO! MÉDICO!');
  pingAudio();

  // Alerta padioleiros de medics.js
  let alertedMedic = false;
  if (window.PXMED && Array.isArray(PXMED.posts)) {
    for (const p of PXMED.posts) {
      if (p.team === player.team && p.hp > 0 && Array.isArray(p.crews)) {
        const c = p.crews.find(k => k.st === 'idle');
        if (c && !player.claimed) {
          player.claimed = c;
          c.u = player;
          c.st = 'go';
          alertedMedic = true;
          if (typeof toast === 'function') toast('Padioleiros alertados a caminho!');
          break;
        }
      }
    }
  }

  // Alerta também infantes aliados próximos para socorrer
  const list = typeof units !== 'undefined' ? units : [];
  const nearby = list.filter(u => u.team === player.team && u !== player && u.hp > 0 && !u.down && !u.isDowned)
    .sort((a, b) => hyp(a.x - player.x, a.y - player.y) - hyp(b.x - player.x, b.y - player.y))[0];
  if (nearby && hyp(nearby.x - player.x, nearby.y - player.y) < 280) {
    nearby.order = 'move';
    nearby.tx = player.x;
    nearby.ty = player.y;
    nearby.manualUntil = (typeof time !== 'undefined' ? time : 0) + 12;
    nearby.rescuer = true;
  }
  return true;
}

function revivePlayer(source) {
  if (typeof player === 'undefined' || !player || !player.isDowned) return false;
  player.isDowned = false;
  player.down = false;
  player.hp = Math.round((player.maxhp || 100) * CFG.REVIVE_HP);
  player.bleedTimer = 0;
  if (player.claimed) {
    if (player.claimed.u === player) {
      player.claimed.u = null;
      player.claimed.st = 'idle';
    }
    player.claimed = null;
  }
  player.carried = false;
  if (player.savedWeapon && typeof window.changeWeapon === 'function') {
    try { window.changeWeapon(player.savedWeapon); } catch {}
  } else if (player.savedWeapon && typeof weapon !== 'undefined') {
    window.weapon = player.savedWeapon;
  }
  S.stats.revivedCount++;
  if (typeof toast === 'function') {
    toast('Socorrido a tempo! De volta ao combate (+50% HP)!');
  }
  return true;
}

/* ======================================================================================
   4. AUTO-BANDAGEM DE EMERGÊNCIA (TECLA H)
   ====================================================================================== */
function checkBandage(dt) {
  if (typeof mode === 'undefined' || mode !== 'soldier') {
    bandageProgress = 0;
    return;
  }
  if (typeof player === 'undefined' || !player || player.hp <= 0 || player.isDowned) {
    bandageProgress = 0;
    return;
  }

  player.bandagesLeft = player.bandagesLeft ?? CFG.BANDAGE_MAX_USES;
  player.bandageCd = player.bandageCd ?? 0;

  if (player.bandageCd > 0) {
    player.bandageCd = Math.max(0, player.bandageCd - dt);
  }

  const isHoldingH = typeof keys !== 'undefined' && (keys.h || keys.H);

  if (!isHoldingH) {
    bandageProgress = 0;
    bandageStartPos = null;
    return;
  }

  // Condições para aplicar
  if (player.hp >= (player.maxhp || 100)) {
    bandageProgress = 0;
    return;
  }
  if (player.bandagesLeft <= 0) {
    bandageProgress = 0;
    return;
  }
  if (player.bandageCd > 0) {
    bandageProgress = 0;
    return;
  }

  // Inicializa posição de referência
  if (!bandageStartPos) {
    bandageStartPos = { x: player.x, y: player.y };
  }

  // Precisa ficar parado
  const moved = hyp(player.x - bandageStartPos.x, player.y - bandageStartPos.y) > 2;
  if (moved) {
    bandageProgress = 0;
    bandageStartPos = { x: player.x, y: player.y };
    return;
  }

  bandageProgress += dt;
  if (bandageProgress >= CFG.BANDAGE_TIME) {
    bandageProgress = 0;
    bandageStartPos = null;
    player.hp = Math.min(player.maxhp || 100, player.hp + CFG.BANDAGE_HEAL);
    player.bandagesLeft--;
    player.bandageCd = CFG.BANDAGE_CD;
    bandageAudio();
    S.stats.bandagesApplied++;
    if (typeof toast === 'function') {
      toast('Curativo de campo aplicado (+35 HP)');
    }
  }
}

/* ======================================================================================
   5. SAQUE DE CADÁVERES (SCAVENGING - TECLA E)
   ====================================================================================== */
function scavengeCorpse() {
  if (!S.on) return false;
  if (typeof mode === 'undefined' || mode !== 'soldier') return false;
  if (typeof player === 'undefined' || !player || player.hp <= 0 || player.isDowned) return false;

  const cList = typeof corpses !== 'undefined' ? corpses : [];
  const corpse = cList.find(c => !c.looted && hyp(c.x - player.x, c.y - player.y) <= CFG.LOOT_RADIUS);

  if (!corpse) return false;

  corpse.looted = true;

  // Munição para a arma atual (+1 pente)
  if (typeof weapons !== 'undefined' && typeof weapon !== 'undefined' && weapons[weapon]) {
    if (typeof ammo !== 'undefined') window.ammo = weapons[weapon].mag;
    if (typeof magazines !== 'undefined') magazines[weapon] = weapons[weapon].mag;
  } else if (typeof ammo !== 'undefined') {
    window.ammo = (window.ammo || 0) + 10;
  }
  if (typeof reload !== 'undefined') window.reload = 0;

  // Recupera granadas se tiver menos de 2
  player.gren = Math.min(2, (player.gren || 0) + 1);

  if (typeof sound === 'function') sound('mag');
  S.stats.corpsesLooted++;
  if (typeof toast === 'function') {
    toast('Munição e suprimentos saqueados.');
  }
  return true;
}

/* ======================================================================================
   HOOKS & WRAPS DO MOTOR DE JOGO
   ====================================================================================== */
function setupHook() {
  whistleCd = 0;
  pings = [];
  bandageProgress = 0;
  bandageStartPos = null;
  lastKeys = {};
  if (typeof player !== 'undefined' && player) {
    player.isDowned = false;
    player.down = false;
    player.bleedTimer = 0;
    player.bandagesLeft = CFG.BANDAGE_MAX_USES;
    player.bandageCd = 0;
  }
}

function updateHook(dt) {
  if (!S.on) return;
  const now = typeof time !== 'undefined' ? time : 0;

  // Atualiza cooldown de apito
  if (whistleCd > 0) whistleCd = Math.max(0, whistleCd - dt);

  // Atualiza pings visuais
  for (const p of pings) p.t -= dt;
  pings = pings.filter(p => p.t > 0);

  // Atualiza auto-bandagem
  checkBandage(dt);

  const list = typeof units !== 'undefined' ? units : [];

  // Atualiza bônus de moral em aliados (+30% velocidade e imunidade a pinning)
  for (const u of list) {
    if (u.moraleBonusUntil && u.moraleBonusUntil > now) {
      u.suppression = 0;
      u.pinned = false;
      if (u.order === 'move') {
        const dx = u.tx - u.x, dy = u.ty - u.y, l = hyp(dx, dy);
        if (l > 12) {
          const speed = (typeof defs !== 'undefined' && defs[u.type]?.speed ? defs[u.type].speed : 47) * CFG.MORALE_SPEED_BOOST * dt;
          u.x += (dx / l) * Math.min(l, speed);
          u.y += (dy / l) * Math.min(l, speed);
        }
      }
    }

    // Se estiver sob ordem de supressão de ping
    if (u.suppressUntil && u.suppressUntil > now && u.suppressTarget) {
      if (u.suppressTarget.hp > 0) {
        u.target = u.suppressTarget;
        u.angle = Math.atan2(u.suppressTarget.y - u.y, u.suppressTarget.x - u.x);
        if (u.cd <= 0 && typeof shoot === 'function') {
          try { shoot(u, u.suppressTarget); } catch {}
        }
      } else {
        u.suppressTarget = null;
      }
    }
  }

  // Atualiza jogador no estado caído
  if (typeof player !== 'undefined' && player && player.isDowned) {
    player.down = true;
    player.suppression = 0;
    player.pinned = false;
    player.bleedTimer -= dt;

    if (player.bleedTimer <= 0) {
      player.isDowned = false;
      player.down = false;
      if (typeof damage === 'function') {
        damage(player, 9999);
      } else {
        player.hp = 0;
      }
      if (typeof toast === 'function') toast('Você sucumbiu aos ferimentos.');
      return;
    }

    // Verifica se algum socorrista alcançou o jogador
    if (player.claimed && player.claimed.st) {
      const c = player.claimed;
      if (hyp(c.x - player.x, c.y - player.y) < 22 || c.st === 'load' || c.st === 'carry') {
        revivePlayer(c);
      }
    }
    const rescuer = list.find(u => u.team === player.team && u !== player && u.hp > 0 && !u.down && hyp(u.x - player.x, u.y - player.y) < 20);
    if (rescuer) {
      revivePlayer(rescuer);
    }
  }

  // Teclado por edge-detection (caso o ambiente execute sem event listener DOM)
  if (typeof keys !== 'undefined') {
    if (keys.t || keys.T) {
      if (!lastKeys.t) {
        blowWhistle();
      }
      keys.t = false;
      keys.T = false;
    } else {
      lastKeys.t = false;
    }

    if (keys.f || keys.F) {
      if (!lastKeys.f) {
        contextPing();
      }
      keys.f = false;
      keys.F = false;
    } else {
      lastKeys.f = false;
    }

    if (keys.e || keys.E) {
      if (!lastKeys.e) {
        if (typeof player !== 'undefined' && player) {
          if (player.isDowned) {
            callForHelp();
          } else {
            scavengeCorpse();
          }
        }
      }
      keys.e = false;
      keys.E = false;
    } else {
      lastKeys.e = false;
    }
  }
}

/* Wrapping das funções principais */
wrap('setup', (orig, ...a) => {
  const r = orig(...a);
  try { setupHook(); } catch (e) { fail(e); }
  return r;
});

wrap('update', (orig, dt) => {
  // Salva coordenadas do jogador caído para desacelerar até 11 px/s
  let oldX = 0, oldY = 0, isDown = false;
  if (typeof player !== 'undefined' && player && player.isDowned) {
    oldX = player.x;
    oldY = player.y;
    isDown = true;
  }

  orig(dt);

  try {
    if (isDown && typeof player !== 'undefined' && player && player.isDowned) {
      // Reverte a velocidade padrão de corrida e aplica o rastejo de 11 px/s
      player.x = oldX;
      player.y = oldY;
      let kx = 0, ky = 0;
      if (typeof keys !== 'undefined') {
        kx = (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0);
        ky = (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);
      }
      const len = hyp(kx, ky);
      const W_BOUND = typeof W !== 'undefined' ? W : 2400;
      const H_BOUND = typeof H !== 'undefined' ? H : 1600;
      if (len > 0) {
        player.x = clamp(oldX + (kx / len) * CFG.CRAWL_SPEED * dt, 20, W_BOUND - 20);
        player.y = clamp(oldY + (ky / len) * CFG.CRAWL_SPEED * dt, 20, H_BOUND - 20);
        player.moving = true;
      }
      if (typeof cam !== 'undefined') {
        cam.x += (player.x - cam.x) * Math.min(1, dt * 8);
        cam.y += (player.y - cam.y) * Math.min(1, dt * 8);
      }
    }
    updateHook(dt);
  } catch (e) {
    fail(e);
  }
});

wrap('damage', (orig, u, n, attacker, ...rest) => {
  if (!S.on) return orig(u, n, attacker, ...rest);

  if (typeof player !== 'undefined' && u === player && typeof mode !== 'undefined' && mode === 'soldier' && u.type !== 'tank') {
    // Se já estiver caído, balas raspam; grande explosão mata
    if (u.isDowned) {
      if (n >= 40) {
        u.isDowned = false;
        u.down = false;
        return orig(u, n, attacker, ...rest);
      }
      return;
    }

    // Se o dano for fatal
    if (u.hp - n <= 0) {
      const overdamage = n - u.hp;
      if (overdamage > CFG.OVERKILL_MAX) {
        // Despedaçamento explosivo: morte direta
        u.isDowned = false;
        u.down = false;
        return orig(u, n, attacker, ...rest);
      }
      // Sobrevivência: entra no estado caído
      triggerDowned(u);
      return;
    }
  }
  return orig(u, n, attacker, ...rest);
});

wrap('protectedBy', (orig, u) => {
  const f = orig(u);
  if (!S.on) return f;
  if (u.isDowned || (typeof player !== 'undefined' && u === player && u.isDowned)) {
    return Math.min(f, 0.45);
  }
  return f;
});

/* Visuals: HUD e Render */
wrap('hud', (orig, ...a) => {
  const r = orig(...a);
  if (!S.on) return r;
  try {
    if (typeof mode !== 'undefined' && mode === 'soldier' && typeof player !== 'undefined' && player) {
      if (player.isDowned) {
        const h = document.getElementById('health');
        if (h) h.textContent = `CAÍDO (${Math.ceil(player.bleedTimer)}s)`;
        const hb = document.getElementById('hpbar');
        if (hb) {
          hb.style.width = `${Math.max(0, (player.bleedTimer / CFG.DOWNED_BLEED) * 100)}%`;
          hb.style.background = '#e63946';
        }
        const cs = document.getElementById('coverstatus');
        if (cs) cs.textContent = 'EM AGONIA · RASTEJANDO [E] SOCORRO';
        const w = document.getElementById('weapon');
        if (w) w.textContent = 'PISTOLA DE BOLSO (EMERGÊNCIA)';
      }
    }
  } catch {}
  return r;
});

wrap('render', (orig, ...a) => {
  const r = orig(...a);
  if (!S.on) return r;
  try {
    if (typeof canvas === 'undefined' || !canvas) return r;
    const ctx = canvas.getContext('2d');
    if (!ctx) return r;

    const VW = typeof vw !== 'undefined' ? vw : canvas.width;
    const VH = typeof vh !== 'undefined' ? vh : canvas.height;
    const CAM_X = typeof cam !== 'undefined' ? cam.x : 0;
    const CAM_Y = typeof cam !== 'undefined' ? cam.y : 0;
    const CAM_Z = typeof cam !== 'undefined' ? cam.z : 1;

    // 1. Desenho dos marcadores de Ping no chão
    for (const p of pings) {
      const sx = (p.x - CAM_X) * CAM_Z + VW / 2;
      const sy = (p.y - CAM_Y) * CAM_Z + VH / 2;
      if (sx < -40 || sy < -40 || sx > VW + 40 || sy > VH + 40) continue;

      ctx.save();
      const col = p.kind === 'suppression' ? '#ff3b30' : p.kind === 'garrison' ? '#007aff' : '#ffcc00';
      const progress = 1 - (p.t / p.maxT);
      const radius = 8 + progress * 14;

      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, sx, sy - radius - 2);
      ctx.restore();
    }

    // 2. Vinheta e efeito visual de Agonia / Estado Caído
    if (typeof mode !== 'undefined' && mode === 'soldier' && typeof player !== 'undefined' && player && player.isDowned) {
      ctx.save();
      const pulse = 0.28 + 0.18 * Math.sin((typeof time !== 'undefined' ? time : 0) * 7);
      const grad = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.25, VW / 2, VH / 2, Math.max(VW, VH) * 0.7);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.65, `rgba(140, 15, 15, ${pulse * 0.5})`);
      grad.addColorStop(1, `rgba(220, 10, 10, ${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VW, VH);

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#ff4444';
      ctx.textAlign = 'center';
      ctx.fillText(`EM AGONIA - SANGRAMENTO: ${Math.ceil(player.bleedTimer)}s - [E] PEDIR SOCORRO`, VW / 2, VH - 26);
      ctx.restore();
    }

    // 3. Barra de progresso de bandagem
    if (bandageProgress > 0 && typeof player !== 'undefined' && player && !player.isDowned) {
      const psx = (player.x - CAM_X) * CAM_Z + VW / 2;
      const psy = (player.y - CAM_Y) * CAM_Z + VH / 2 - 18;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(psx - 14, psy - 3, 28, 6);
      ctx.fillStyle = '#4cd964';
      const pct = clamp(bandageProgress / CFG.BANDAGE_TIME, 0, 1);
      ctx.fillRect(psx - 13, psy - 2, Math.round(26 * pct), 4);
      ctx.restore();
    }

    // 4. Indicador de saque em corpos próximos (< 24 px)
    if (typeof mode !== 'undefined' && mode === 'soldier' && typeof player !== 'undefined' && player && !player.isDowned) {
      const cList = typeof corpses !== 'undefined' ? corpses : [];
      const nearCorpse = cList.find(c => !c.looted && hyp(c.x - player.x, c.y - player.y) <= CFG.LOOT_RADIUS);
      if (nearCorpse) {
        const csx = (nearCorpse.x - CAM_X) * CAM_Z + VW / 2;
        const csy = (nearCorpse.y - CAM_Y) * CAM_Z + VH / 2 - 10;
        ctx.save();
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#e5e5ea';
        ctx.textAlign = 'center';
        ctx.fillText('[E] SAQUEAR', csx, csy);
        ctx.restore();
      }
    }
  } catch {}
  return r;
});

/* Event Listeners de Teclado no Navegador */
function handleKeyDown(e) {
  if (!S.on) return;
  if (typeof document !== 'undefined' && document.querySelector && document.querySelector('dialog[open]')) return;
  if (typeof mode === 'undefined' || mode !== 'soldier') return;
  if (typeof player === 'undefined' || !player) return;

  const k = (e.key || '').toLowerCase();

  if (k === 't') {
    if (blowWhistle()) {
      if (e.preventDefault) e.preventDefault();
    }
  } else if (k === 'f') {
    if (contextPing()) {
      if (e.preventDefault) e.preventDefault();
    }
  } else if (k === 'e') {
    if (player.isDowned) {
      callForHelp();
      if (e.preventDefault) e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    } else {
      if (scavengeCorpse()) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    }
  }
}

if (typeof window.addEventListener === 'function') {
  try {
    window.addEventListener('keydown', handleKeyDown, true);
  } catch {}
}

/* API Pública e Estado */
S.blowWhistle = blowWhistle;
S.contextPing = contextPing;
S.scavenge = scavengeCorpse;
S.callForHelp = callForHelp;
S.revive = revivePlayer;
S.triggerDowned = triggerDowned;
S.checkBandage = checkBandage;
Object.defineProperty(S, 'whistleCd', { get: () => whistleCd, set: v => { whistleCd = v; } });
Object.defineProperty(S, 'pings', { get: () => pings });
Object.defineProperty(S, 'bandageProgress', { get: () => bandageProgress });

S.state = () => ({
  on: S.on,
  whistleCd: Math.round(whistleCd),
  downed: typeof player !== 'undefined' && player ? !!player.isDowned : false,
  bleedTimer: typeof player !== 'undefined' && player && player.isDowned ? Math.round(player.bleedTimer) : 0,
  bandagesLeft: typeof player !== 'undefined' && player ? (player.bandagesLeft ?? CFG.BANDAGE_MAX_USES) : 0,
  pingsCount: pings.length,
  stats: { ...S.stats }
});

window.IronFrontSoldierTactics = S;
if (window.IronFront) window.IronFront.soldierTactics = S;
})();
