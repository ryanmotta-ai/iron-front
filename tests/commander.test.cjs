const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// commander.js 1.0: patrulhas, ofensiva (concentrar → preparar → assaltar → guarnecer), memória de ameaças, aviação por demanda,
// ritmo de obras por facção, política de avisos, doutrinas e câmera do diretor. O PXORD, o comando aéreo e o jogo são simulados.
const dist = f => path.join(__dirname, '../dist', f);
const hyp = Math.hypot;
let seedState = 12345; const rand = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };
const toasts = [];
const sb = {
  console, Math: Object.assign(Object.create(Math), { random: rand }), Array, Object, Map, Set, JSON, String, Number, Infinity, RegExp, Date,
  location: { search: '' }, W: 2400, H: 2400, GH: 1600, time: 0, started: true, ended: false, playerTeam: 0, aiEnabled: [true, true], mode: 'commander',
  units: [], buildings: [], decor: [], fieldTrenches: [], points: [{ name: 'EUA', x: 260, y: 800, owner: 0, home: 0 }, { name: 'ALEMANHA', x: 2140, y: 800, owner: 1, home: 1 }], shells: [],
  supplies: [600, 600], sandbox: true, difficulty: 'normal', defs: { artillery: { cost: 160 } }, cam: { x: 1200, y: 800, z: 1 }, vw: 1000, vh: 600, mouse: { over: false, x: 0, y: 0 },
  ROLES: ['attack', 'defend'],
  update(dt) { sb.time += dt; }, setup() {}, hud() {}, toast(s) { toasts.push(s); },
  spend: () => true, performance: { now: () => sb._pn }, _pn: 1e6,
  document: { readyState: 'complete', getElementById: () => null, querySelector: () => null, addEventListener() {} },
};
sb.window = sb; sb.addEventListener = () => {};
vm.createContext(sb);

// --- PXORD simulado: grupos com os mesmos campos que o commander lê/escreve ---
let gid = 0, G = []; const air = [], arty = [];
sb.PXORD = {
  groups: () => G,
  free: t => sb.units.filter(u => u.team === t && u.hp > 0 && !u.gid && !u.sap && !(u.manualUntil > sb.time + 3)),
  advance(us, x, y, o = {}) { const g = { id: ++gid, team: us[0].team, kind: 'advance', units: us.slice(), state: 'approach', goal: { x, y }, n0: us.length, cd: {}, th: {}, via: o.via, ai: true, since: sb.time }; us.forEach(u => { u.gid = g.id; }); G.push(g); return g; },
  occupy(us, a, o = {}) { const g = { id: ++gid, team: us[0].team, kind: 'occupy', units: us.slice(), state: 'holding', goal: { x: a.x, y: a.y }, n0: us.length, cd: {}, th: {}, via: o.via, ai: true, anchor: a }; us.forEach(u => { u.gid = g.id; }); G.push(g); return g; },
  end(g) { G = G.filter(q => q !== g); g.units.forEach(u => { if (u.gid === g.id) u.gid = null; }); },
  retreat(g) { g.state = 'retreat'; }, hold(g) { g.state = 'holding'; }, decide(g, k) { g.decided = (g.decided || []).concat(k); return true; },
};
sb.IronFrontBrain = { lastPlans: [{ operation: { phase: 'prepare', sector: 2, since: 0, objective: { x: 2140, y: 800 } }, sectors: [] }, { operation: { phase: 'hold', sector: 2, since: 0 }, sectors: [] }], operations: { contacts: t => sb.contacts[t] || [] } };
sb.contacts = [[], []];
sb.IronFrontAirCommand = { request: (team, kind, x, y, o) => { air.push({ team, kind, x, y, o }); return { id: air.length }; } };
sb.PXAW = { on: true, planes: () => sb.planes || [] }; sb.planes = [];
sb.batteriesUp = true;
sb.PXBAT = { active: () => true, status: () => ({ operational: sb.batteriesUp ? 2 : 0 }), batteries: [], mission: (team, x, y, n, r, kind) => { arty.push({ team, x, y, n, kind }); return true; } };
sb.IronFrontEngineering = { tune: [{ cap: 4, gap: 12, urgent: 8, sap: false }, { cap: 4, gap: 12, urgent: 8, sap: false }] };
vm.runInContext(fs.readFileSync(dist('air-support-policy.js'), 'utf8'), sb);
const policyBase = JSON.parse(JSON.stringify(sb.IronFrontAirPolicy.cooldown)), clear0 = sb.IronFrontAirPolicy.clear;
const baseChoose = sb.IronFrontAirPolicy.choose;
vm.runInContext(fs.readFileSync(dist('commander.js'), 'utf8'), sb);
const S = sb.PXCMD, T = S._t;
assert.ok(S && S.on && T, 'módulo carregado');

let uid = 0;
const U = (team, type, x, y, extra = {}) => { const u = Object.assign({ id: ++uid, team, type, x, y, hp: type === 'tank' ? 650 : 100, maxhp: type === 'tank' ? 650 : 100, aiRole: 'reagrupamento', suppression: 0, underFire: 0, order: 'hold', tx: x, ty: y, manualUntil: 0, moving: false }, extra); sb.units.push(u); return u; };
const reset = () => { sb.units.length = 0; sb.fieldTrenches.length = 0; sb.shells.length = 0; G = []; air.length = 0; arty.length = 0; toasts.length = 0; sb.time = 0; sb.contacts = [[], []]; sb.planes = []; sb.aiEnabled = [true, true]; sb.playerTeam = 0; sb.sandbox = true; sb.supplies = [600, 600]; sb.ROLES = ['attack', 'defend']; sb.setup(); sb.update(0.1); sb.time = 0; toasts.length = 0; S.log.length = 0; S.team = [null, null]; };
const trenchLine = (team, x, ys) => ys.forEach(y => sb.fieldTrenches.push({ team, x, y, hp: 650, hw: 52, hh: 22 }));
const startTeams = () => { for (const t of [0, 1]) { S.team[t] = T.newTeam(t); S.team[t].doct = S.doctrines.relampago; } };

// 1) doutrinas: quem defende sorteia entre as doutrinas de defesa/guerrilha; os pacotes têm todos os campos
for (const d of Object.values(S.doctrines)) for (const k of ['name', 'tempo', 'patrols', 'push', 'air', 'arty', 'raid', 'build', 'say']) assert.ok(d[k] !== undefined, 'doutrina completa: ' + d.name);
sb.ROLES = ['attack', 'defend']; const picks = new Set(); for (let i = 0; i < 60; i++) picks.add(S.pickDoctrine(1).name); assert.ok(picks.has('Defesa elástica') && !picks.has('Relâmpago'), 'defensor não sorteia Relâmpago: ' + [...picks]);
const picksA = new Set(); for (let i = 0; i < 60; i++) picksA.add(S.pickDoctrine(0).name); assert.ok(picksA.has('Relâmpago') && !picksA.has('Defesa elástica'), 'atacante não sorteia Defesa elástica');

// 2) linha de ataque: a trincheira inimiga MAIS PRÓXIMA da nossa faixa (bug medido: pegava a mais funda), e que ainda não é nossa
reset(); startTeams();
trenchLine(1, 1500, [800]); trenchLine(1, 1750, [800]); trenchLine(1, 2000, [800]); trenchLine(0, 700, [800]); trenchLine(0, 950, [800]);
assert.equal(T.beltX(0, 800), 1500, 'EUA atacam a 1.ª trincheira alemã (a de menor x)');
assert.equal(T.beltX(1, 800), 950, 'Alemanha ataca a 1.ª trincheira americana (a de maior x)');
for (let i = 0; i < 3; i++) U(0, 'rifle', 1480 + i * 10, 800);
assert.equal(T.beltX(0, 800), 1750, 'trincheira já ocupada por 3 homens nossos deixa de ser alvo');
reset(); startTeams();

// 3) perigo e cobertura de informação: MG pesa o dobro; contatos longe da faixa não contam
const foes = [{ type: 'mg', x: 1500, y: 800 }, { type: 'rifle', x: 1520, y: 820 }, { type: 'rifle', x: 400, y: 100 }];
const rifleOnly = T.dangerAt([{ type: 'rifle', x: 1500, y: 800 }], 1500, 800), mgOnly = T.dangerAt([{ type: 'mg', x: 1500, y: 800 }], 1500, 800);
assert.ok(mgOnly > rifleOnly * 2.4, `MG (${mgOnly}) pesa mais que fuzileiro (${rifleOnly}) além da diferença de valor`);
assert.equal(T.coverageAt(foes, 1500, 800), 2, 'só os 2 contatos perto da faixa cobrem'); assert.equal(T.dangerAt([{ type: 'mg', x: 300, y: 100 }], 1500, 800), 0);

// 4) memória: MG visto continua conhecido por 150 s, some se morrer; fuzileiro some junto com o contato
S.team[0].mem = new Map(); sb.contacts[0] = [{ id: 901, team: 1, type: 'mg', x: 1500, y: 800, hp: 100, at: 0 }, { id: 902, team: 1, type: 'rifle', x: 1510, y: 800, hp: 100, at: 0 }];
sb.time = 1; T.remember(0); sb.contacts[0] = []; sb.time = 100;
assert.deepEqual(T.known(0).map(e => e.type), ['mg'], 'só o MG fica na memória (fuzileiro anda)'); sb.time = 200; assert.equal(T.known(0).length, 0, 'memória expira em 150 s');
const mg = U(1, 'mg', 1500, 800, { id: 777 }); S.team[0].mem.set(777, { id: 777, type: 'mg', x: 1500, y: 800, hp: 100, at: 190 }); sb.time = 200; T.remember(0); assert.ok(T.known(0).length === 1); mg.hp = 0; T.remember(0); assert.equal(T.known(0).length, 0, 'MG morto sai da memória');

// 5) ofensiva completa: setup → assalto (blindados primeiro, infantaria 8 s depois, 2.ª onda) → sucesso → guarnição na trincheira tomada
reset(); startTeams(); sb.time = 30;
trenchLine(1, 1500, [600, 700, 800, 900, 1000]); trenchLine(1, 1750, [800]);
for (let i = 0; i < 40; i++) U(0, 'rifle', 700 + (i % 8) * 20, 650 + Math.floor(i / 8) * 55, { cls: i % 9 === 0 ? 'assault' : undefined });
U(0, 'tank', 650, 800); U(0, 'tank', 650, 860); U(0, 'rifle', 600, 800, { cls: 'marksman' }); U(0, 'rifle', 640, 800, { aiRole: 'guarda-objetivo' });
for (let i = 0; i < 12; i++) U(1, 'rifle', 1550 + (i % 4) * 10, 760 + i * 10);
sb.contacts[0] = [{ id: 5001, team: 1, type: 'rifle', x: 1550, y: 760, hp: 100, at: 29 }, { id: 5002, team: 1, type: 'rifle', x: 1560, y: 800, hp: 100, at: 29 }, { id: 5003, team: 1, type: 'rifle', x: 1570, y: 830, hp: 100, at: 29 }];
const pool = T.offPool(0); assert.ok(pool.length >= 40 && !pool.some(u => u.cls === 'marksman' || u.aiRole === 'guarda-objetivo'), 'pool: sem atirador de elite nem guarda do QG, com as classes de assalto: ' + pool.length);
T.offTick(0); const o0 = S.team[0].off;
assert.equal(o0.phase, 'idle', 'antes do fim do tempo de reconhecimento o comandante espera (battleClock=' + T.battleClock() + ')'); assert.ok(S.stats.offWaits >= 0);
sb.time = 400; sb.contacts[0].forEach(c => { c.at = 399; }); o0.coolUntil = 0; T.offTick(0);
assert.equal(o0.phase, 'setup', 'ofensiva lançada: ' + JSON.stringify(S.log.at(-1))); assert.ok(o0.groups.length >= 2 && o0.groups.every(e => e.g.via === 'ofensiva'));
assert.equal(o0.bx, 1500, 'ataca a 1.ª linha'); assert.ok(o0.n0 >= 30, 'concentra a tropa: ' + o0.n0);
const tankGroup = o0.groups.find(e => e.def.tank); assert.ok(tankGroup && tankGroup.g.units.length === 2, 'blindados em coluna própria');
assert.ok(o0.groups.some(e => e.def.name === 'centro') && o0.ids.size === o0.n0, 'ids de todos os participantes');
// reuniu: todos no ponto de partida → assalto; blindados saem já, infantaria do centro 8 s depois, 2.ª onda 13 s
for (const e of o0.groups) for (const u of e.g.units) { u.x = e.def.j.x; u.y = e.def.j.y; }
sb.time += 10; T.offTick(0); assert.equal(o0.phase, 'assault', 'assalto lançado');
const waiting = G.filter(g => g.state === 'waiting' || g.wait); assert.ok(waiting.length >= 1, 'há coluna esperando a saída (infantaria depois dos blindados)');
assert.ok(G.some(g => g.mission && g.mission.includes('blindados') && g.state !== 'waiting'), 'blindados partem primeiro');
assert.ok(G.every(g => g.rush === true), 'colunas do assalto não param para abrigo à toa (g.rush)');
assert.ok(arty.length >= 1, 'fumaça/artilharia no começo do assalto'); assert.ok(air.some(a => a.kind === 'atk' && a.team === 0), 'caças acompanham o assalto');
// sem bateria operacional o comandante não pede fogo (o PXBAT avisaria o jogador e devolveria o custo)
sb.batteriesUp = false; const nArty = arty.length; assert.equal(T.fireOn(0, 1500, 800, 'he'), false); assert.equal(arty.length, nArty); sb.batteriesUp = true; assert.equal(T.fireOn(0, 1500, 800, 'he'), true);
// sucesso: ≥ 45 % dos fuzileiros em cima do objetivo → "linha ocupada" e guarnição (PXORD.occupy)
const centre = o0.groups.find(e => e.def.name === 'centro');
let moved = 0; for (const u of sb.units) if (o0.ids.has(u.id) && u.type === 'rifle' && moved++ < 30) { u.x = centre.def.goal.x + (moved % 5) * 4; u.y = centre.def.goal.y; }
sb.time += 3; T.offTick(0);
assert.equal(o0.phase, o0.deep ? 'assault' : 'hold', 'chegou: ' + o0.phase);
if (o0.phase === 'assault') { sb.time += 31; T.offTick(0); }   // aprofundou (estrutura/bandeira conhecida): conclui depois de 30 s
assert.equal(o0.phase, 'hold', 'ofensiva concluída com sucesso'); assert.equal(S.stats.offWins, 1);
assert.ok(S.stats.garrisons >= 1 && G.some(g => g.kind === 'occupy' && g.mission === 'Guarnecer a linha tomada'), 'a linha tomada vira guarnição');
sb.time += 60; T.offTick(0); assert.equal(o0.phase, 'idle', 'a fase de segurar termina e a ofensiva volta a "idle"');
// a guarnição NÃO sai por relógio: continua na trincheira tomada enquanto tiver ≥ 40 % e < 300 s
const gar = S.team[0].garrisons; assert.ok(gar.length >= 1 && G.some(g => g.kind === 'occupy'), 'guarnição registrada'); sb.time += 100; T.garrisonTick(0); assert.ok(G.some(g => g.kind === 'occupy'), 'guarnição continua depois de 160 s');
const gg = gar[0].g; gg.units.slice(0, Math.ceil(gg.units.length * .7)).forEach(u => { u.hp = 0; }); T.garrisonTick(0); assert.ok(!G.includes(gg), 'guarnição reduzida a < 40 % é liberada'); assert.ok(S.stats.garrisonsReleased >= 1);
S.team[0].garrisons.forEach(e => { e.since = sb.time - 400; }); T.garrisonTick(0); assert.ok(!G.some(g => g.kind === 'occupy'), 'e depois do tempo máximo (300 s) todas saem');
assert.ok(o0.coolUntil > sb.time - 200, 'tem espera antes da próxima');

// 6) fracasso: perdas ≥ 50 % por ID (grupo que o PXORD encerra por chegada NÃO conta como baixa) → recua e a faixa ganha penalidade
reset(); startTeams(); sb.time = 400;
trenchLine(1, 1500, [600, 700, 800, 900]);
for (let i = 0; i < 36; i++) U(0, 'rifle', 700 + (i % 8) * 20, 700 + Math.floor(i / 8) * 40); for (let i = 0; i < 10; i++) U(1, 'rifle', 1550, 760 + i * 10);
sb.contacts[0] = [1, 2, 3].map(i => ({ id: 6000 + i, team: 1, type: 'rifle', x: 1550, y: 780 + i * 20, hp: 100, at: 399 }));
T.offTick(0); const o1 = S.team[0].off; assert.equal(o1.phase, 'setup');
for (const e of o1.groups) for (const u of e.g.units) { u.x = e.def.j.x; u.y = e.def.j.y; }
sb.time += 10; T.offTick(0); assert.equal(o1.phase, 'assault');
for (const g of G.slice()) if (g.via === 'ofensiva') { sb.PXORD.end(g); }                        // o PXORD encerra grupos (chegada/timeout)
sb.time += 3; T.offTick(0); assert.equal(o1.phase, 'assault', 'grupos encerrados não são baixas (alive por id=' + T.alive(o1) + '/' + o1.n0 + ')');
let killed = 0; for (const u of sb.units) if (o1.ids.has(u.id) && killed++ < Math.ceil(o1.n0 * .55)) u.hp = 0;
sb.time += 2; T.offTick(0); assert.equal(o1.phase, 'recover', 'perdas altas: recua'); assert.equal(S.stats.offFails, 1); assert.ok(o1.fail.some(v => v === 1), 'faixa penalizada'); assert.ok(o1.coolUntil >= sb.time + 40, 'espera maior depois de fracassar');
assert.ok(toasts.length > 0 && toasts.every(t => /^[A-ZÃ]+: /.test(t)), 'IA×IA mostra os avisos: ' + toasts.join(' | '));

// 7) política de avisos: quem comanda um lado só vê ALERTA de ataque inimigo (nunca os planos); o registro guarda tudo
reset(); startTeams(); sb.aiEnabled = [false, true]; sb.playerTeam = 0; sb.time = 500;
T.say(1, 'ofensiva no centro: 40 homens.'); assert.equal(toasts.length, 0, 'plano inimigo não vira aviso'); sb.time = 520; T.say(1, 'assalto lançado: 3 colunas ←.', { alert: true });
assert.equal(toasts.length, 1); assert.match(toasts[0], /^ALERTA: /); assert.equal(S.log.length, 2, 'registro completo'); sb.time = 540; T.say(0, 'algo do meu lado', { alert: true }); assert.equal(toasts.length, 1, 'meu lado (sem IA) não gera aviso');
assert.equal(T.strength(1), 1); sb.difficulty = 'hard'; assert.equal(T.strength(1), 1.3); sb.difficulty = 'easy'; assert.equal(T.strength(1), .75); assert.equal(T.strength(0), 1, 'dificuldade vale só para o adversário'); sb.aiEnabled = [true, true]; assert.equal(T.strength(1), 1, 'IA×IA: neutra'); sb.difficulty = 'normal';

// 8) patrulhas: saem dos passivos, miram terra de ninguém/contato fraco, recuam com 45 % de baixas ou 75 s, e não passam de 30 % do exército
reset(); startTeams(); sb.time = 100; S.team[0].mem = new Map();
trenchLine(1, 1500, [400, 800, 1200]);
for (let i = 0; i < 40; i++) U(0, 'rifle', 800 + (i % 8) * 15, 300 + i * 20); for (let i = 0; i < 20; i++) U(1, 'rifle', 1600, 300 + i * 40);
assert.ok(T.spawnPatrol(0), 'patrulha criada'); assert.equal(S.team[0].patrols.length, 1); const pg = S.team[0].patrols[0].g;
assert.ok(pg.units.length >= 4 && pg.units.length <= 8 && pg.via === 'patrulha'); assert.ok(pg.goal.x > 900 && pg.goal.x < 1500, 'mira a terra de ninguém antes da linha: ' + JSON.stringify(pg.goal));
for (let i = 0; i < 30; i++) T.spawnPatrol(0); assert.ok(S.team[0].patrols.reduce((n, p) => n + p.g.units.length, 0) <= 40 * 0.3 + 8, 'teto de 30 % do exército em patrulhas');
const p0 = S.team[0].patrols[0]; p0.g.units.slice(0, Math.ceil(p0.n0 * .55)).forEach(u => { u.hp = 0; }); T.patrolTick(0); assert.equal(p0.g.state, 'retreat', 'patrulha dizimada recua'); assert.ok(S.stats.retreats >= 1);
const p1 = S.team[0].patrols.find(p => p !== p0); sb.time += 80; T.patrolTick(0); assert.equal(p1.g.state, 'retreat', 'patrulha velha recolhe');
const keepers = U(0, 'rifle', 1200, 100, { gid: 99 }); assert.ok(!T.offPool(0).includes(keepers), 'quem já está em grupo não é recrutado');

// 9) aviação por demanda: tropa nossa sob fogo + aglomerado inimigo à frente → ataque; bombardeio só com concentração; caça varre aeronave inimiga; base preservada para interceptação
reset(); startTeams(); sb.time = 300;
assert.ok(sb.IronFrontAirPolicy.cooldown.atk < policyBase.atk && sb.IronFrontAirPolicy.cooldown.bmb < policyBase.bmb && sb.IronFrontAirPolicy.cooldown.atk >= 20, 'missões mais frequentes');
assert.equal(sb.IronFrontAirPolicy.clear([{ team: 0, x: 1000, y: 800 }], 1000 + 200, 800), true, 'IA: a 200 px do alvo ainda é seguro (raio 175)'); assert.equal(sb.IronFrontAirPolicy.clear([{ team: 0, x: 1000, y: 800 }], 1000 + 150, 800), false);
sb.aiEnabled = [false, true]; assert.equal(sb.IronFrontAirPolicy.clear([{ team: 0, x: 1000, y: 800 }], 1000 + 200, 800), false, 'time do jogador (sem IA): margem original de 220 px'); sb.aiEnabled = [true, true];
assert.equal(clear0([{ x: 1000, y: 800 }], 1200, 800), false, 'a política original usava 220 px');
const own = [U(0, 'rifle', 1000, 800, { underFire: 2 }), U(0, 'rifle', 1010, 830, { underFire: 2 }), ...Array.from({ length: 14 }, (_, i) => U(0, 'rifle', 700, 400 + i * 30))];   // ≥ 12 homens: o original só opera com exército mínimo
const ctx = (extra = {}) => ({ team: 0, time: 300, own, contacts: [], front: 1200, width: 2400, y: 800, phase: 'advance', available: { cap: true, rec: true, atk: true, bmb: true, int: true, esc: true }, next: {}, flights: [], grounded: false, preparing: false, ...extra });
const hostile = [1, 2, 3, 4].map(i => ({ id: 7000 + i, team: 1, type: i < 2 ? 'mg' : 'rifle', x: 1320 + i * 8, y: 800 + i * 6, hp: 100, at: 299 }));
let it = sb.IronFrontAirPolicy.choose(ctx({ contacts: hostile })); assert.ok(it && it.kind === 'atk' && Math.abs(it.x - 1330) < 60, 'apoio aéreo por demanda: ' + JSON.stringify(it)); assert.match(it.reason, /Apoio aéreo/);
it = sb.IronFrontAirPolicy.choose(ctx({ contacts: [...hostile, ...hostile.map(h => ({ ...h, id: h.id + 50, x: h.x + 20 })), ...hostile.map(h => ({ ...h, id: h.id + 90, x: h.x + 30 }))] })); assert.equal(it.kind, 'bmb', 'concentração grande + fase de ataque: bombardeiro');
own.forEach(u => { u.underFire = 0; }); const none = sb.IronFrontAirPolicy.choose(ctx({ contacts: [hostile[3]] })); assert.ok(!none || none.kind !== 'atk' || none.reason !== 'Apoio aéreo: infantaria sob fogo pede socorro', 'sem tropa sob fogo, não é apoio por demanda');
own.forEach(u => { u.underFire = 2; });
sb.planes = [{ team: 1, air: true, dead: false, gone: false, x: 900, y: 300, T: { name: 'Gotha', bombs: 1, cls: 'b' } }];
it = sb.IronFrontAirPolicy.choose(ctx({ contacts: [] })); assert.ok(it && it.kind === 'int' && /Varredura/.test(it.reason), 'varredura de caça: ' + JSON.stringify(it)); sb.planes = [];
const intr = sb.IronFrontAirPolicy.choose(ctx({ intruder: { x: 1100, y: 700 }, contacts: [] })); assert.equal(intr.kind, 'int', 'interceptação do original preservada');
assert.equal(sb.IronFrontAirPolicy.choose(ctx({ grounded: true, contacts: hostile })), null, 'sem voo (tempestade): nada');

// 10) obras: ritmo por facção conforme a doutrina (mais frentes de trabalho, menos espera), padrão restaurado no setup
reset(); startTeams(); S.team[0].doct = S.doctrines.elastico; S.team[1].doct = S.doctrines.infiltrador;
T.buildTick(0); T.buildTick(1); const tn = sb.IronFrontEngineering.tune;
assert.ok(tn[0].cap > 4 && tn[0].cap <= 6 && tn[0].gap < 12 && tn[0].urgent < tn[0].gap, 'elástico constrói mais: ' + JSON.stringify(tn[0])); assert.ok(tn[0].gap <= tn[1].gap && tn[0].cap >= tn[1].cap, 'elástico ≥ infiltrador'); assert.ok(tn[0].sap && tn[1].sap, 'sapas (vala avança com a tropa) ligadas pelo comandante');
sb.setup(); assert.deepEqual(tn[0], { cap: 4, gap: 12, urgent: 8, sap: false }, 'setup restaura o ritmo padrão (e desliga as sapas)');

// 11) câmera do diretor: assalto vence aglomerado; histerese; bloqueios (caixa de diálogo, câmera aérea, modo soldado, entrada do jogador)
reset(); startTeams(); S.cam.mode = 'auto'; S.cam.shot = null; sb.time = 300;
for (let i = 0; i < 8; i++) { U(0, 'rifle', 1300 + i * 5, 500); U(1, 'rifle', 1340 + i * 5, 500); }             // briga em (1320,500)
const shotA = T.pickShot(); assert.equal(shotA.kind, 'combate'); assert.ok(Math.abs(shotA.x - 1320) < 60);
S.team[0].off = Object.assign(T.newTeam(0).off, { phase: 'assault', ids: new Set() }); const asl = []; for (let i = 0; i < 20; i++) { const u = U(0, 'rifle', 900 + i * 6, 1100); asl.push(u); S.team[0].off.ids.add(u.id); }
const shotB = T.pickShot(); assert.equal(shotB.kind, 'ofensiva', 'assalto em andamento é o plano mais interessante'); assert.match(shotB.label, /EUA/);
S.cam.shot = shotB; asl.forEach(u => { u.hp = 0; }); // sem assalto: volta para a briga
assert.equal(T.pickShot().kind, 'combate');
sb._pn = 1e6; S.cam.lastUser = sb._pn - 100;            // jogador mexeu agora: o diretor espera
sb.update(0.1); assert.equal(sb.cam.x, 1200, 'jogador mexendo: câmera não é tocada');
S.cam.lastUser = sb._pn - 10000; S.cam.shot = null; for (let i = 0; i < 60; i++) { sb.time += 0.1; T.camTick(0.1); } assert.ok(Math.abs(sb.cam.x - 1320) < 80 && Math.abs(sb.cam.y - 500) < 80, 'câmera chega à briga: ' + sb.cam.x + ',' + sb.cam.y);
sb.aiEnabled = [false, true]; assert.equal(S.cam.shot && true, true); const camBefore = sb.cam.x; sb.cam.x = 50; sb.time += 20; T.camTick(.1); assert.equal(sb.cam.x, 50, 'um lado com jogador: diretor desligado no modo automático'); sb.aiEnabled = [true, true];
S.cam.mode = 'off'; sb.cam.x = 60; T.camTick(.1); assert.equal(sb.cam.x, 60); S.cam.mode = 'auto'; sb.mode = 'soldier'; T.camTick(.1); assert.equal(sb.cam.x, 60, 'modo soldado: não mexe'); sb.mode = 'commander';

// 12) painel da IA e robustez: linhas por facção, sem erro com times vazios; update embrulhado não explode sem mundo
reset(); startTeams(); const lines = T.statusLines(); assert.ok(lines.length >= 2 && /EUA/.test(lines[0]) && /ALEMANHA/.test(lines[1]), lines.join(' / '));
assert.equal(S.stats.errors, 0, 'nenhum erro interno'); for (let i = 0; i < 40; i++) { sb.time += 2; sb.update(2); }
assert.equal(S.stats.errors, 0, 'update repetido sem erros');
console.log('commander.test: ok');
