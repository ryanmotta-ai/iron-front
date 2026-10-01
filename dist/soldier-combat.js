'use strict';
/* Iron Front — Expansão Modo Soldado: Combate Brutal & Gunplay Tático
   Carrega como módulo independente DEPOIS de game.js / assault.js.
   1. Mira Focada (ADS / Camera Lead) via RMB ou Shift
   2. Apoio de Arma em Coberturas (Weapon Mounting)
   3. Carga de Baioneta (Bayonet Charge) com áudio procedural e abate letal
   4. Winchester 1897 "Trench Gun" (Escopeta) com múltiplos pellets
   5. Estalo Sônico (Snap-Crack) para projéteis próximos
   6. Chave de desligamento via URL (?soldier_combat=0) ou PXSC.on = false
*/
(function(){
  const qs = typeof location !== 'undefined' ? location.search : '';
  const disabled = /[?&]soldier_combat=0/.test(qs);

  const SC = {
    on: !disabled,
    version: '1.0',
    rmbDown: false,
    lead: { x: 0, y: 0 },
    stats: {
      cracks: 0,
      bayonetKills: 0,
      shotgunShots: 0,
      charges: 0,
      errors: 0
    },
    bayonetCharge: {
      active: false,
      t: 0,
      cooldown: 0,
      exhausted: 0,
      hit: false
    }
  };

  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const wrap = (name, fn) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(...a) {
      return fn(orig, ...a);
    };
  };

  /* ---------- Áudio Procedural (Web Audio API) ---------- */
  const ac = () => {
    try {
      if (typeof soundOn !== 'undefined' && soundOn && typeof audio !== 'undefined' && audio) return audio;
    } catch {}
    return null;
  };

  const noiseBuf = (a, dur) => {
    try {
      const n = Math.ceil(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    } catch {
      return null;
    }
  };

  // Brado de batalha sintetizado proceduralmente (sawtooth com formant filter + ruído)
  function battleCry() {
    const a = ac();
    if (!a) return;
    try {
      const t = a.currentTime;
      const osc = a.createOscillator();
      const g = a.createGain();
      const flt = a.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.linearRampToValueAtTime(320, t + 0.35);
      osc.frequency.exponentialRampToValueAtTime(140, t + 1.3);

      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(650, t);
      flt.Q.value = 2.2;

      g.gain.setValueAtTime(0.01, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

      osc.connect(flt);
      flt.connect(g);
      g.connect(a.destination);
      osc.start(t);
      osc.stop(t + 1.3);

      const s = a.createBufferSource();
      const nFlt = a.createBiquadFilter();
      const nGain = a.createGain();
      const buf = noiseBuf(a, 0.8);
      if (buf) {
        s.buffer = buf;
        nFlt.type = 'bandpass';
        nFlt.frequency.value = 800;
        nFlt.Q.value = 1.6;
        nGain.gain.setValueAtTime(0.08, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        s.connect(nFlt);
        nFlt.connect(nGain);
        nGain.connect(a.destination);
        s.start(t);
      }
    } catch {}
  }

  // Estalo sônico crocante de perfuração de baioneta
  function crunchSound() {
    const a = ac();
    if (!a) return;
    try {
      const t = a.currentTime;
      const buf = noiseBuf(a, 0.16);
      if (!buf) return;
      const s = a.createBufferSource();
      const f = a.createBiquadFilter();
      const g = a.createGain();
      s.buffer = buf;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(550, t);
      f.frequency.exponentialRampToValueAtTime(120, t + 0.16);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      s.connect(f);
      f.connect(g);
      g.connect(a.destination);
      s.start(t);
    } catch {}
  }

  // Disparo encorpado de escopeta de trincheira
  function shotgunSound() {
    const a = ac();
    if (!a) return;
    try {
      const t = a.currentTime;
      const buf = noiseBuf(a, 0.38);
      if (!buf) return;
      const s = a.createBufferSource();
      const f = a.createBiquadFilter();
      const g = a.createGain();
      s.buffer = buf;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(950, t);
      f.frequency.exponentialRampToValueAtTime(120, t + 0.38);
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      s.connect(f);
      f.connect(g);
      g.connect(a.destination);
      s.start(t);
    } catch {}
  }

  // Estalo sônico (snap-crack) quando projétil inimigo corta o ar perto da cabeça
  function snapCrack() {
    const a = ac();
    if (!a) return;
    try {
      const t = a.currentTime;
      const buf = noiseBuf(a, 0.035);
      if (!buf) return;
      const s = a.createBufferSource();
      const f = a.createBiquadFilter();
      const g = a.createGain();
      s.buffer = buf;
      f.type = 'highpass';
      f.frequency.value = 2600;
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      s.connect(f);
      f.connect(g);
      g.connect(a.destination);
      s.start(t);
    } catch {}
  }

  /* ---------- Registro da Escopeta Winchester 1897 ---------- */
  function registerShotgun() {
    if (typeof weapons === 'undefined') return;
    if (!weapons.shotgun) {
      weapons.shotgun = {
        get name() {
          return (typeof playerTeam !== 'undefined' && playerTeam === 1) ? 'MAUSER FLIEGER' : 'WINCHESTER 1897';
        },
        mag: 6,
        reload: 2.8,
        rate: 0.75,
        damage: 16,
        range: 180,
        spread: 0.16,
        pellets: 6
      };
    }
    if (typeof magazines !== 'undefined') {
      if (magazines.shotgun === undefined) magazines.shotgun = 6;
    }
    if (typeof WN !== 'undefined' && Array.isArray(WN)) {
      if (WN[0] && !WN[0].shotgun) WN[0].shotgun = 'WINCHESTER 1897';
      if (WN[1] && !WN[1].shotgun) WN[1].shotgun = 'MAUSER FLIEGER';
    }
    if (typeof WM !== 'undefined' && Array.isArray(WM)) {
      if (WM[0] && WM[0].shotgun === undefined) WM[0].shotgun = 6;
      if (WM[1] && WM[1].shotgun === undefined) WM[1].shotgun = 6;
    }
    if (typeof WR !== 'undefined' && Array.isArray(WR)) {
      if (WR[0] && WR[0].shotgun === undefined) WR[0].shotgun = 2.8;
      if (WR[1] && WR[1].shotgun === undefined) WR[1].shotgun = 2.8;
    }
  }

  /* Disparo de escopeta com múltiplos pellets */
  function fireShotgunPellets(u, target, manual) {
    const w = weapons.shotgun;
    const baseA = manual
      ? Math.atan2(mouse.wy - u.y, mouse.wx - u.x)
      : (target ? Math.atan2(target.y - u.y, target.x - u.x) : (u.angle || 0));
    u.angle = baseA;
    u.cd = w.rate;
    const x = u.x + Math.cos(baseA) * 12, y = u.y + Math.sin(baseA) * 12;

    let effSpread = w.spread;
    if (u === player && player.aiming) effSpread *= 0.45;   // Redução de 55%
    if (u === player && player.mounted) effSpread *= 0.05;  // Redução a quase zero

    const count = w.pellets || 6;
    for (let i = 0; i < count; i++) {
      const a = baseA + rnd(-effSpread, effSpread);
      const spd = rnd(760, 840);
      bullets.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        t: w.range / spd,
        team: u.team,
        damage: w.damage,
        pellet: true
      });
    }

    if (typeof particles !== 'undefined') {
      particles.push({ x, y, vx: 0, vy: 0, t: 0.12, max: 0.12, color: '#ffeab0', size: 10 });
      for (let i = 0; i < 6; i++) {
        particles.push({
          x, y,
          vx: rnd(-35, 35) + Math.cos(baseA) * 60,
          vy: rnd(-35, 35) + Math.sin(baseA) * 60,
          t: rnd(0.1, 0.22),
          max: 0.22,
          color: '#ffb347',
          size: 3
        });
      }
    }

    if (u === player && typeof screenShake !== 'undefined') {
      screenShake = Math.max(screenShake, player.mounted ? 0.8 : 3.5);
    }
    shotgunSound();
    SC.stats.shotgunShots++;
  }

  /* ---------- Carga de Baioneta ---------- */
  function startBayonetCharge() {
    if (!SC.on) return false;
    if (typeof mode === 'undefined' || mode !== 'soldier') return false;
    if (typeof player === 'undefined' || !player || player.hp <= 0 || player.type === 'tank') return false;
    if (typeof weapon === 'undefined' || weapon !== 'rifle') return false;
    if (SC.bayonetCharge.active) return false;
    if (SC.bayonetCharge.cooldown > 0) {
      if (typeof toast === 'function') toast(`Carga em recuperação (${Math.ceil(SC.bayonetCharge.cooldown)}s).`);
      return false;
    }
    if (SC.bayonetCharge.exhausted > 0) {
      if (typeof toast === 'function') toast('Combatente exausto.');
      return false;
    }

    SC.bayonetCharge.active = true;
    SC.bayonetCharge.t = 2.2;
    SC.bayonetCharge.cooldown = 10;
    SC.bayonetCharge.exhausted = 0;
    SC.bayonetCharge.hit = false;
    player.charging = true;
    SC.stats.charges++;

    battleCry();
    if (typeof toast === 'function') toast('CARGA DE BAIONETA!');
    return true;
  }

  /* Cálculo de dispersão efetiva para testes e lógica */
  SC.getEffectiveSpread = (w) => {
    const gun = w || (typeof weapons !== 'undefined' && typeof weapon !== 'undefined' ? weapons[weapon] : null);
    if (!gun) return 0;
    let s = gun.spread;
    if (typeof player !== 'undefined' && player && player.aiming) s *= 0.45;
    if (typeof player !== 'undefined' && player && player.mounted) s *= 0.05;
    return s;
  };

  /* ---------- Desenho do Retículo Tático (ADS & Apoio) ---------- */
  function drawTacticalReticle(c) {
    if (!SC.on || typeof mode === 'undefined' || mode !== 'soldier' || typeof player === 'undefined' || !player || player.type === 'tank') return;
    if (typeof mouse === 'undefined' || typeof vw === 'undefined' || typeof vh === 'undefined') return;
    const mx = mouse.x, my = mouse.y;
    if (mx < 0 || mx > vw || my < 0 || my > vh) return;

    c.save();
    c.imageSmoothingEnabled = false;

    const isAiming = !!player.aiming;
    const isMounted = !!player.mounted;
    const isCharging = !!(SC.bayonetCharge && SC.bayonetCharge.active);

    const gap = isMounted ? 3 : (isAiming ? 6 : 14);
    const arm = isMounted ? 5 : (isAiming ? 7 : 8);
    const col = isCharging ? '#ff3b30' : (isMounted ? '#aed581' : (isAiming ? '#ffffff' : 'rgba(255, 255, 255, 0.75)'));

    // Ponto central de precisão
    c.fillStyle = col;
    c.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);

    // 4 traços táticos
    c.strokeStyle = col;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(Math.round(mx), Math.round(my) - gap);
    c.lineTo(Math.round(mx), Math.round(my) - gap - arm);
    c.moveTo(Math.round(mx), Math.round(my) + gap);
    c.lineTo(Math.round(mx), Math.round(my) + gap + arm);
    c.moveTo(Math.round(mx) - gap, Math.round(my));
    c.lineTo(Math.round(mx) - gap - arm, Math.round(my));
    c.moveTo(Math.round(mx) + gap, Math.round(my));
    c.lineTo(Math.round(mx) + gap + arm, Math.round(my));
    c.stroke();

    // Apoio montado: bipé/suporte de apoio desenhado logo abaixo
    if (isMounted) {
      c.strokeStyle = '#aed581';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(Math.round(mx) - 8, Math.round(my) + gap + 3);
      c.lineTo(Math.round(mx) - 5, Math.round(my) + gap + 7);
      c.lineTo(Math.round(mx) + 5, Math.round(my) + gap + 7);
      c.lineTo(Math.round(mx) + 8, Math.round(my) + gap + 3);
      c.stroke();
    }

    // Carga de baioneta: chevrons vermelhos agressivos de avanço
    if (isCharging) {
      c.strokeStyle = '#ff3b30';
      c.lineWidth = 2;
      const pulse = Math.sin((typeof time !== 'undefined' ? time : 0) * 20) * 2;
      c.beginPath();
      c.moveTo(Math.round(mx) - 12 - pulse, Math.round(my) - 8);
      c.lineTo(Math.round(mx) - 7 - pulse, Math.round(my));
      c.lineTo(Math.round(mx) - 12 - pulse, Math.round(my) + 8);
      c.moveTo(Math.round(mx) + 12 + pulse, Math.round(my) - 8);
      c.lineTo(Math.round(mx) + 7 + pulse, Math.round(my));
      c.lineTo(Math.round(mx) + 12 + pulse, Math.round(my) + 8);
      c.stroke();
    }

    c.restore();
  }

  /* ---------- Integração com o Jogo (Wraps) ---------- */

  // 1. Setup
  wrap('setup', (orig, ...a) => {
    const res = orig(...a);
    try {
      registerShotgun();
      SC.bayonetCharge.active = false;
      SC.bayonetCharge.t = 0;
      SC.bayonetCharge.cooldown = 0;
      SC.bayonetCharge.exhausted = 0;
      SC.bayonetCharge.hit = false;
    } catch {}
    return res;
  });

  // 2. Shoot: Shotgun pellets e controle de dispersão / recuo
  wrap('shoot', (orig, u, target, manual) => {
    if (!SC.on) return orig(u, target, manual);

    if (u === player && manual && u.type !== 'tank') {
      if (typeof weapon !== 'undefined' && weapon === 'shotgun') {
        fireShotgunPellets(u, target, manual);
        return;
      }

      const w = typeof weapons !== 'undefined' && typeof weapon !== 'undefined' ? weapons[weapon] : null;
      if (w) {
        const origSpread = w.spread;
        let factor = 1;
        if (player.aiming) factor *= 0.45;   // Redução de 55%
        if (player.mounted) factor *= 0.05;  // Redução a quase zero
        w.spread = origSpread * factor;
        try {
          const res = orig(u, target, manual);
          if (typeof screenShake !== 'undefined') {
            const recoil = player.mounted ? 0.2 : (player.aiming ? 0.8 : 1.6);
            screenShake = Math.max(screenShake, recoil);
          }
          return res;
        } finally {
          w.spread = origSpread;
        }
      }
    }

    return orig(u, target, manual);
  });

  // 3. Update: ADS Camera Lead, Apoio em Cobertura, Carga de Baioneta, Estalo Sônico
  wrap('update', (orig, dt) => {
    if (!SC.on) return orig(dt);

    const isSoldier = typeof mode !== 'undefined' && mode === 'soldier' && typeof player !== 'undefined' && player && player.type !== 'tank';

    if (isSoldier) {
      // Estado de Mira Focada (ADS)
      /* Shift parado = mira focada; Shift + andar = corrida (soldier-gear.js gasta fôlego). Em movimento, mire com o botão direito. */
      const movingKeys = typeof keys !== 'undefined' && !!(keys.w || keys.a || keys.s || keys.d || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
      const wantsAim = !!(SC.rmbDown || (typeof keys !== 'undefined' && (keys.Shift || keys.shift) && !(movingKeys && window.PXGEAR && PXGEAR.on)));
      player.aiming = wantsAim && player.hp > 0;

      // Estado de Apoio de Arma em Coberturas (Weapon Mounting)
      const prot = typeof protectedBy === 'function' ? protectedBy(player) : 1;
      player.mounted = prot < 0.75 && player.hp > 0;
    } else if (typeof player !== 'undefined' && player) {
      player.aiming = false;
      player.mounted = false;
    }

    const px0 = isSoldier ? player.x : 0;
    const py0 = isSoldier ? player.y : 0;

    orig(dt);

    if (!isSoldier || player.hp <= 0) {
      SC.bayonetCharge.active = false;
      SC.lead = { x: 0, y: 0 };
      return;
    }

    // Camera Lead dinâmico na direção do mouse
    if (player.aiming && typeof cam !== 'undefined' && typeof mouse !== 'undefined') {
      const angle = Math.atan2(mouse.wy - player.y, mouse.wx - player.x);
      const mDist = Math.hypot(mouse.wx - player.x, mouse.wy - player.y);
      const targetLead = Math.min(180, mDist > 10 ? mDist : 180);
      const leadX = Math.cos(angle) * targetLead;
      const leadY = Math.sin(angle) * targetLead;
      SC.lead = { x: leadX, y: leadY };

      const rate = Math.min(1, dt * 8);
      cam.x += leadX * rate;
      cam.y += leadY * rate;
    } else {
      SC.lead = { x: 0, y: 0 };
    }

    // Cooldown & Exaustão da Baioneta
    SC.bayonetCharge.cooldown = Math.max(0, SC.bayonetCharge.cooldown - dt);
    if (SC.bayonetCharge.exhausted > 0) {
      SC.bayonetCharge.exhausted = Math.max(0, SC.bayonetCharge.exhausted - dt);
    }

    const boundW = typeof W !== 'undefined' ? W : 2400;
    const boundH = typeof H !== 'undefined' ? H : 1600;
    const clampFn = typeof clamp === 'function' ? clamp : (v, a, b) => Math.max(a, Math.min(b, v));

    // Lógica da Carga de Baioneta
    if (SC.bayonetCharge.active) {
      if (typeof weapon === 'undefined' || weapon !== 'rifle' || player.hp <= 0) {
        SC.bayonetCharge.active = false;
        player.charging = false;
      } else {
        SC.bayonetCharge.t -= dt;
        player.charging = true;

        const baseSpd = (typeof defs !== 'undefined' && defs.rifle ? defs.rifle.speed : 47) * 1.65;
        const movedX = player.x - px0, movedY = player.y - py0;
        const movedDist = Math.hypot(movedX, movedY);

        if (movedDist > 0.001) {
          // Incrementa 0.6x para totalizar 1.6x da velocidade de corrida
          player.x = clampFn(player.x + movedX * 0.6, 20, boundW - 20);
          player.y = clampFn(player.y + movedY * 0.6, 20, boundH - 20);
        } else {
          // Propulsão frontal na direção da mira
          const sp = baseSpd * 1.6 * dt;
          player.x = clampFn(player.x + Math.cos(player.angle) * sp, 20, boundW - 20);
          player.y = clampFn(player.y + Math.sin(player.angle) * sp, 20, boundH - 20);
          player.moving = true;
        }

        // Detecção de colisão frontal (< 22 px) com infante inimigo
        let hitEnemy = null;
        if (typeof units !== 'undefined' && Array.isArray(units)) {
          for (const u of units) {
            if (u.team !== player.team && u.hp > 0 && u.type !== 'tank') {
              const d = Math.hypot(u.x - player.x, u.y - player.y);
              if (d < 22) {
                const angTo = Math.atan2(u.y - player.y, u.x - player.x);
                let diff = Math.abs(angTo - player.angle);
                while (diff > Math.PI) diff = Math.abs(diff - TAU);
                if (diff < 1.8) {
                  hitEnemy = u;
                  break;
                }
              }
            }
          }
        }

        if (hitEnemy) {
          SC.bayonetCharge.hit = true;
          SC.bayonetCharge.active = false;
          player.charging = false;
          SC.stats.bayonetKills++;

          if (typeof damage === 'function') {
            damage(hitEnemy, hitEnemy.hp + 200, player.team);
          } else {
            hitEnemy.hp = 0;
          }

          crunchSound();

          if (typeof particles !== 'undefined' && Array.isArray(particles)) {
            for (let i = 0; i < 24; i++) {
              particles.push({
                x: hitEnemy.x,
                y: hitEnemy.y,
                vx: Math.cos(player.angle + rnd(-0.8, 0.8)) * rnd(70, 200),
                vy: Math.sin(player.angle + rnd(-0.8, 0.8)) * rnd(70, 200),
                t: 0.45,
                max: 0.45,
                color: i % 2 === 0 ? '#b3171e' : '#5e0b11',
                size: 3 + Math.floor(Math.random() * 5)
              });
            }
          }

          if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 5);
          if (typeof toast === 'function') toast('PERFURAÇÃO DE BAIONETA! INIMIGO ELIMINADO');
        } else if (SC.bayonetCharge.t <= 0) {
          // Carga expirou sem atingir alvo: exaustão imediata por 1.4s
          SC.bayonetCharge.active = false;
          player.charging = false;
          SC.bayonetCharge.exhausted = 1.4;
          if (typeof toast === 'function') toast('Carga esgotada: combatente exausto.');
        }
      }
    }

    // Exaustão: velocidade reduzida a 0.6x
    if (SC.bayonetCharge.exhausted > 0 && !SC.bayonetCharge.active) {
      const movedX = player.x - px0, movedY = player.y - py0;
      if (Math.hypot(movedX, movedY) > 0.001) {
        player.x -= movedX * 0.4;
        player.y -= movedY * 0.4;
      }
    }

    // Estalo Sônico (Snap-Crack) para projéteis inimigos que passam perto da cabeça (< 28 px)
    if (typeof bullets !== 'undefined' && Array.isArray(bullets)) {
      for (const b of bullets) {
        if (b.team !== player.team && b.damage > 0 && !b._snapped) {
          const d = Math.hypot(b.x - player.x, b.y - player.y);
          if (d < 28) {
            b._snapped = true;
            SC.stats.cracks++;
            snapCrack();
            if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 1.8);
          }
        }
      }
    }
  });

  // 4. HUD: Exibe 'APOIADO', 'MIRA FOCADA', 'CARGA DE BAIONETA'
  wrap('hud', (orig) => {
    orig();
    try {
      if (!SC.on || typeof mode === 'undefined' || mode !== 'soldier' || typeof player === 'undefined' || !player) return;
      const el = typeof document !== 'undefined' ? document.getElementById('coverstatus') : null;
      if (!el) return;
      const bits = [];
      if (player.mounted) bits.push('APOIADO');
      if (player.aiming) bits.push('MIRA FOCADA');
      if (SC.bayonetCharge.active) bits.push('CARGA DE BAIONETA');
      else if (SC.bayonetCharge.exhausted > 0) bits.push(`EXAUSTO (${SC.bayonetCharge.exhausted.toFixed(1)}s)`);

      if (bits.length) {
        el.textContent = el.textContent ? el.textContent + ' · ' + bits.join(' · ') : bits.join(' · ');
      }
    } catch {}
  });

  // 5. Render: Desenho do retículo tático sobre a mira
  wrap('render', (orig, ...a) => {
    const res = orig(...a);
    try {
      if (typeof ctx !== 'undefined') drawTacticalReticle(ctx);
    } catch {}
    return res;
  });

  /* ---------- Eventos de Entrada (Mouse & Teclado) ---------- */
  if (typeof canvas !== 'undefined' && canvas && typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('pointerdown', e => {
      if (!SC.on) return;
      if (e.button === 2 && typeof mode !== 'undefined' && mode === 'soldier') {
        SC.rmbDown = true;
        e.preventDefault();
      }
    });
    canvas.addEventListener('contextmenu', e => {
      if (SC.on && typeof mode !== 'undefined' && mode === 'soldier') {
        e.preventDefault();
      }
    });
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pointerup', e => {
      if (e.button === 2) SC.rmbDown = false;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 2) SC.rmbDown = false;
    });
    window.addEventListener('blur', () => {
      SC.rmbDown = false;
    });

    window.addEventListener('keydown', e => {
      if (!SC.on || e.repeat) return;
      if (typeof document !== 'undefined' && document.querySelector && document.querySelector('dialog[open]')) return;
      if (typeof started !== 'undefined' && !started) return;
      if (typeof ended !== 'undefined' && ended) return;

      const k = e.key ? (e.key.length === 1 ? e.key.toLowerCase() : e.key) : '';

      if (typeof mode !== 'undefined' && mode === 'soldier' && typeof player !== 'undefined' && player && player.type !== 'tank') {
        // Tecla X: Carga de Baioneta
        if (k === 'x') {
          if (startBayonetCharge()) {
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          }
          return;
        }

        // Tecla 4: Equipa a Winchester 1897 Shotgun
        if (k === '4') {
          if (typeof changeWeapon === 'function') {
            registerShotgun();
            changeWeapon('shotgun');
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          }
          return;
        }
      }
    }, true);
  }

  // Hook para o botão de troca de arma na interface
  try {
    if (typeof document !== 'undefined') {
      const swapBtn = document.getElementById('weaponswap');
      if (swapBtn) {
        swapBtn.onclick = () => {
          if (typeof weapon === 'undefined') return;
          const cycle = { rifle: 'shotgun', shotgun: 'smg', smg: 'pistol', pistol: 'rifle' };
          if (typeof changeWeapon === 'function') changeWeapon(cycle[weapon] || 'rifle');
        };
      }
    }
  } catch {}

  /* Inicialização imediata de registro de armas */
  registerShotgun();

  /* Métodos de API & Teste */
  SC.startBayonetCharge = startBayonetCharge;
  SC.registerShotgun = registerShotgun;
  SC.state = () => ({
    on: SC.on,
    aiming: typeof player !== 'undefined' && player ? !!player.aiming : false,
    mounted: typeof player !== 'undefined' && player ? !!player.mounted : false,
    lead: { ...SC.lead },
    bayonet: { ...SC.bayonetCharge },
    stats: { ...SC.stats }
  });
  SC.reset = () => {
    SC.rmbDown = false;
    SC.lead = { x: 0, y: 0 };
    SC.bayonetCharge = {
      active: false,
      t: 0,
      cooldown: 0,
      exhausted: 0,
      hit: false
    };
  };

  // Exportação Global
  window.PXSC = SC;
  window.IronFrontSoldierCombat = SC;
  if (typeof window.IronFront === 'object' && window.IronFront !== null) {
    window.IronFront.soldierCombat = SC;
  }
})();
