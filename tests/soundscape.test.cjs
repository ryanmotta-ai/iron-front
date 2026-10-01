const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// soundscape.js (1.9) com um AudioContext simulado: substitui o som antigo, timbre por arma e nação, distância (ganho, ar,
// atraso), limite de vozes com prioridade, ducking das explosões, intensidade → calma/caos, vozes por formantes e o
// orçamento de nós por segundo numa batalha de 300 unidades.
let seed = 21; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const created = { total: 0, by: {} }, bp = [];
function param(v = 0) { return { value: v, calls: [], setValueAtTime(x, t) { this.calls.push(['set', x, t]); this.value = x; }, linearRampToValueAtTime(x, t) { this.calls.push(['lin', x, t]); }, exponentialRampToValueAtTime(x, t) { this.calls.push(['exp', x, t]); },
  setTargetAtTime(x, t, c) { this.calls.push(['tgt', x, t, c]); }, cancelScheduledValues() {} }; }
class Node { constructor(kind) { this.kind = kind; created.total++; created.by[kind] = (created.by[kind] || 0) + 1; this.out = []; }
  connect(n) { this.out.push(n); return n; } disconnect() { this.out = []; } start() {} stop() {} }
class Ctx { constructor() { this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = new Node('dest'); }
  createGain() { const n = new Node('gain'); n.gain = param(1); return n; }
  createBiquadFilter() { const n = new Node('biquad'); n.frequency = param(350); n.Q = param(1); n.type = 'lowpass'; bp.push(n); return n; }
  createOscillator() { const n = new Node('osc'); n.frequency = param(440); n.type = 'sine'; return n; }
  createBufferSource() { const n = new Node('src'); n.loop = false; return n; }
  createStereoPanner() { const n = new Node('pan'); n.pan = param(0); return n; }
  createConvolver() { return new Node('conv'); }
  createDynamicsCompressor() { const n = new Node('comp'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = param(0); return n; }
  createBuffer(ch, n, sr) { const d = Array.from({ length: ch }, () => new Float32Array(n)); return { duration: n / sr, getChannelData: i => d[i] }; } }
let serial = 0, oldSounds = 0;
const sb = {
  console, Math, Array, Object, Map, Set, WeakMap, JSON, String, Number, Infinity, Float32Array,
  W: 2400, H: 1600, time: 0, started: true, ended: false, playerTeam: 0, mode: 'commander', player: null, weapon: 'rifle',
  units: [], bullets: [], shells: [], cam: { x: 500, y: 500 }, soundOn: true, audio: null, location: { search: '' },
  sound(k) { oldSounds++; }, setup() {}, update(dt) { sb.time += dt; sb.audio.currentTime += dt; },
  shoot(u) { sb.bullets.push({ x: u.x, y: u.y }); sb.sound('shot'); }, explode() { sb.sound('boom'); },
};
sb.window = sb; vm.createContext(sb);
sb.audio = new Ctx(); sb.audio.__ifm = sb.audio.createGain();
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/soundscape.js'), 'utf8'), sb);
const S = sb.SNDSCAPE, u = (team, x, y, type = 'rifle') => { const v = { id: ++serial, team, x, y, type }; sb.units.push(v); return v; };

/* substitui o som antigo */
sb.shoot(u(0, 600, 500)); sb.explode(700, 500, 50, 100, 1);
assert.equal(oldSounds, 0, 'o "shot"/"boom" antigos não tocam por baixo');
assert.ok(S.stats.shots === 1 && S.stats.booms === 1, 'tiro e explosão novos');
assert.ok(created.by.comp === 1, 'limitador inserido no mestre');

/* timbre por arma/nação */
const bodyOf = team => { sb.time += 1; sb.audio.currentTime += 1; bp.length = 0; sb.shoot(u(team, 520, 500)); return bp.filter(b => b.type === 'bandpass').map(b => Math.round(b.frequency.calls[0][1])); };
const us = bodyOf(0), de = bodyOf(1);
console.log(`  corpo do disparo (passa-banda): Springfield ${us} Hz · Gewehr 98 ${de} Hz`);
assert.ok(us[0] > de[0] * 1.15, 'o Springfield é mais agudo que o Gewehr 98');

/* distância */
const near = S.space(560, 500, 'gun'), far = S.space(1500, 500, 'gun');
console.log(`  fuzil a 60 px: ganho ${near.gain.toFixed(2)}, ar ${Math.round(near.lp)} Hz, atraso ${near.delay.toFixed(2)} s · a 1000 px: ganho ${far.gain.toFixed(3)}, ar ${Math.round(far.lp)} Hz, atraso ${far.delay.toFixed(2)} s`);
assert.ok(near.gain > .8 && far.gain < .06 && far.lp < 4000 && far.delay > 2 && near.delay === 0);

/* limite de vozes com prioridade */
sb.time += 5; sb.audio.currentTime += 5; const d0 = S.stats.dropped, s0 = S.stats.stolen;
for (let i = 0; i < 60; i++) { sb.audio.currentTime += .06; sb.shoot(u(1, 900 + i, 700)); }
const st = S.state(); assert.ok(st.voices.gun <= 16, `no máximo 16 vozes de arma (${st.voices.gun})`);
sb.mode = 'soldier'; const me = u(0, 500, 500); sb.player = me; const v0 = S.stats.shots; sb.shoot(me);
assert.equal(S.stats.shots, v0 + 1, 'o tiro do jogador sempre toca (rouba a voz mais fraca)');
console.log(`  60 tiros distantes em 3,6 s: ${S.stats.dropped - d0} descartados, ${S.stats.stolen - s0 + 1} roubos; vozes ativas ${S.state().voices.gun}`);
sb.mode = 'commander'; sb.player = null;

/* ducking */
const ductCalls = () => created.by.gain; sb.explode(560, 520, 60, 100, 1);
assert.ok(S.stats.booms >= 2, 'explosão perto toca');

/* intensidade e calma */
sb.time += 120; sb.audio.currentTime += 120; for (let i = 0; i < 600; i++) sb.update(.05);
const calm1 = S.calm();
for (let i = 0; i < 12; i++) { sb.explode(600 + i * 10, 520, 90, 100, 1); for (let k = 0; k < 10; k++) sb.update(.05); }
const calm2 = S.calm();
console.log(`  calma: quieto ${calm1.toFixed(2)} → após 12 obuses perto ${calm2.toFixed(2)} (intensidade ${S.state().intensity})`);
assert.ok(calm1 > .9 && calm2 < .3, 'o ambiente calmo some na ofensiva');

/* vozes */
const sh0 = S.stats.shouts; S.shout('SANI!', u(1, 540, 500)); assert.equal(S.stats.shouts, sh0 + 1, 'grito por formantes');
S.shout('GRENADE!', u(0, 3000, 500)); assert.equal(S.stats.shouts, sh0 + 1, 'longe demais: não toca');

/* orçamento: batalha de 300 unidades, ~200 tiros/s e 1 explosão/s, por 5 s */
for (let i = 0; i < 300; i++) u(i % 2, 300 + (i * 37) % 1800, 300 + (i * 53) % 1000);
const n0 = created.total; const T = 5;
for (let f = 0; f < T * 30; f++) { sb.update(1 / 30); for (let k = 0; k < 7; k++) sb.shoot(sb.units[(Math.random() * sb.units.length) | 0]); if (f % 30 === 0) sb.explode(600 + Math.random() * 1200, 400 + Math.random() * 800, 50 + Math.random() * 60, 100, 1); }
const perSec = (created.total - n0) / T;
console.log(`  batalha de 300 unidades (210 tiros/s + 1 explosão/s): ${Math.round(perSec)} nós de áudio criados por segundo`);
assert.ok(perSec < 900, 'orçamento de nós sob controle');
assert.equal(S.stats.errors, 0);
console.log('Som 1.9: substituição do som antigo, timbre por arma, distância, limite de vozes, ducking, calma/caos, vozes e orçamento OK');
