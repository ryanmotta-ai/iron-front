/* Testes estáticos da camada de interface (ui.js, ui-fix.js, ui-fix.css, ui.css, ui-art.js, soldier-hud.css).
   Sem navegador: lê os arquivos, avalia só o necessário em `vm` e confere números do Guia de Campo contra o código-fonte do jogo.
   As medições de geometria (720p, sobreposições, fontes) ficam em tools/ui-geometry.cjs (Playwright). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = f => fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8');
const ui = D('ui.js'), fix = D('ui-fix.js'), fixcss = D('ui-fix.css'), uicss = D('ui.css'), art = D('ui-art.js'), hudcss = D('soldier-hud.css');
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };

/* ---------- U15: nomes da campanha ---------- */
const OPS = vm.runInNewContext(ui.match(/const OPS=(\[[\s\S]*?\]);\nconst CH=/)[1]);
const MAPN = vm.runInNewContext('('+ui.match(/MAPN=(\{[^}]*\})/)[1]+')');
const WX = vm.runInNewContext('('+ui.match(/WX=(\{[^}]*\})/)[1]+')');
ok('operações: 6, ids c1..c6 preservados (o save depende deles)', () => {
  assert.equal(JSON.stringify(OPS.map(o => o.id)), JSON.stringify(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']));
});
ok('U15: nomes únicos e nenhum igual ao nome de um mapa', () => {
  const names = OPS.map(o => norm(o.name));
  assert.equal(new Set(names).size, names.length, 'nomes repetidos: ' + names);
  const maps = Object.values(MAPN).map(norm);
  for (const o of OPS) assert.ok(!maps.includes(norm(o.name)), `"${o.name}" repete o nome de um mapa`);
});
ok('todo clima de operação tem rótulo (antes "overcast" aparecia como undefined)', () => {
  for (const o of OPS) assert.ok(WX[o.wx], `${o.id}: clima ${o.wx} sem rótulo`);
});

/* ---------- U2: botões de clima só no sandbox ---------- */
ok('U2: #wxbar escondido fora do sandbox e ui.js marca body[data-run]', () => {
  assert.match(fixcss, /body:not\(\[data-run=sandbox\]\) #wxbar\{display:none\}/);
  assert.match(ui, /body\.dataset\.run=\(run&&run\.kind\)\|\|'sandbox'/);
  assert.match(fix, /id='toplefts'/);
});

/* ---------- U9: renda curta ---------- */
ok('U9: shortIncome converte "+12 por segundo" em "+12/s"', () => {
  const src = fix.match(/IFX\.shortIncome=(s=>[^\n]*?);\n/)[1];
  const f = vm.runInNewContext('(' + src + ')');
  assert.equal(f('+12 por segundo'), '+12/s');
  assert.equal(f('Sandbox · suprimentos ilimitados'), 'Sandbox · suprimentos ilimitados');
});

/* ---------- U14: bandeira do lado do jogador ---------- */
ok('U14: pausa usa flagIconURL(playerTeam) e ui-art exporta a função', () => {
  assert.match(art, /function flagIconURL\(team\)/);
  assert.match(art, /K\.flagPx\(team\?1:0/);
  assert.match(art, /text,textW,icon,iconURL,flagIconURL,ICONS/);
  assert.match(ui, /A\.flagIconURL\(typeof playerTeam!=='undefined'\?playerTeam:0\)/);
});

/* ---------- H: não alterna o QG em modo soldado nem em repetição de tecla ---------- */
ok('H só abre o painel do QG no modo comandante e sem repetição', () => {
  assert.match(ui, /e\.key==='h'\|\|e\.key==='H'\)&&!e\.repeat&&!dlgOpen\(\)&&mode==='commander'/);
});

/* ---------- U10: cartões ---------- */
ok('U10: ícone do Socorro (aid) e atalhos Shift+dígito por e.code', () => {
  assert.match(fix, /if\(type!=='aid'\)return icon0\.apply/);
  assert.match(fix, /\/\^Digit\(\[1-9\]\)\$\//);
  assert.match(fixcss, /#cards\{flex-wrap:wrap;overflow:visible;[^}]*max-width:none!important/);
});

/* ---------- U12: Guia de Campo ---------- */
const guide = fix.slice(fix.indexOf('IFX.guideHTML=['), fix.indexOf(".join('')", fix.indexOf('IFX.guideHTML=[')));
ok('U12: o guia cita todas as teclas novas', () => {
  for (const k of ['X', 'Z', 'Q', 'T', 'F', 'H', 'V', 'M', 'B', 'P', 'E', 'SHIFT+V', '4', '⇧1'])
    assert.ok(guide.includes('<kbd>' + k + '</kbd>') || guide.includes("'" + k + "'"), 'faltou a tecla ' + k);
  for (const w of ['socorro', 'ferido', 'MG', 'abrigo', 'baioneta', 'apito', 'curativo', 'máscara', 'Winchester', 'Cruz Vermelha', 'Especialistas'.toLowerCase()])
    assert.ok(guide.toLowerCase().includes(w.toLowerCase()), 'faltou o tema ' + w);
});
ok('U12: números do guia batem com o código do jogo', () => {
  const tac = D('soldier-tactics.js'), asl = D('assault.js'), fort = D('fortify.js'), feel = D('soldier-feel.js'), cmb = D('soldier-combat.js');
  const num = (src, re) => +src.match(re)[1];
  assert.equal(num(tac, /WHISTLE_CD:\s*(\d+)/), 25); assert.match(guide, /25 s de recarga/);
  assert.equal(num(tac, /WHISTLE_RADIUS:\s*(\d+)/), 260); assert.match(guide, /a até 260 px/);
  assert.equal(num(tac, /MORALE_DUR:\s*(\d+)/), 6); assert.match(guide, /por 6 s/);
  assert.equal(num(tac, /MORALE_SPEED_BOOST:\s*([\d.]+)/), .30); assert.match(guide, /\+30% de velocidade/);
  assert.equal(num(tac, /BANDAGE_TIME:\s*([\d.]+)/), 2.2); assert.match(guide, /em 2,2 s/);
  assert.equal(num(tac, /BANDAGE_HEAL:\s*(\d+)/), 35); assert.match(guide, /\+35 de vida/);
  assert.equal(num(tac, /BANDAGE_MAX_USES:\s*(\d+)/), 2); assert.match(guide, /São 2 curativos/);
  assert.equal(num(tac, /BANDAGE_CD:\s*(\d+)/), 30); assert.match(guide, /30 s entre eles/);
  assert.equal(num(asl, /OTT:\{cd:(\d+)/), 90); assert.match(guide, /Recarga de 90 s/);
  assert.match(fort, /PREP:qs\.has\('preparo'\)[^\n]*:300/); assert.match(guide, /300 s de trégua/);
  assert.equal(num(feel, /BELT:(\d+)/), 250); assert.match(guide, /fita de 250 tiros/);
  assert.equal(num(feel, /MG_RELOAD:([\d.]+)/), 6.5); assert.match(guide, /recarga de 6,5 s/);
  assert.equal(num(feel, /MG_R:(\d+)/), 26); assert.match(guide, /a até 26 px de uma MG/);
  assert.match(cmb, /bayonetCharge\.t = 2\.2/); assert.match(cmb, /bayonetCharge\.cooldown = 10/); assert.match(guide, /2,2 s de corrida e 10 s de recarga/);
  assert.match(asl, /MELEE:\{[^}]*cd:\[\.8/); assert.match(guide, /0,8 s entre golpes/);
});
ok('U12: nomes das armas do guia vêm de WN (game.js) e o fuzileiro comum leva 2 granadas', () => {
  const game = D('game.js'), WN = vm.runInNewContext('(' + game.match(/const WN=(\[[\s\S]*?\]),WM=/)[1] + ')');
  for (const side of WN) for (const k of ['rifle', 'smg', 'pistol']) assert.ok(norm(guide).includes(norm(side[k])), `o guia não cita ${side[k]}`);
  assert.match(game, /gren:type==='rifle'\?2:0/); assert.match(guide, /leva 2/);
});
ok('U12: o texto de teclas do sandbox é atualizado e não menciona só "E tanque/canhão"', () => {
  assert.match(fix, /IFX\.keysLine='[^']*Z deitar · X baioneta · E interagir/);
});

/* ---------- U16: pisos de legibilidade ---------- */
ok('U16: nenhuma fonte Silkscreen abaixo de 0,75rem em ui.css/ui-fix.css', () => {
  for (const [name, css] of [['ui.css', uicss], ['ui-fix.css', fixcss]])
    for (const m of css.matchAll(/font:400 ([\d.]+)rem var\(--fs\)/g)) assert.ok(+m[1] >= .75, `${name}: ${m[0]}`);
});
ok('U16: HUD do soldado sem texto abaixo de 8,5 px', () => {
  for (const m of hudcss.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(+m[1] >= 8.5, m[0]);
});

/* ---------- U1: campanha cabe em 720p ---------- */
ok('U1: barra de INICIAR sticky e miniaturas com altura em função da tela', () => {
  assert.match(fixcss, /\.opinfo\{position:sticky;bottom:0/);
  assert.match(fixcss, /max-height:940px\) and \(min-width:751px\)/);
  assert.match(fixcss, /\.op canvas\{aspect-ratio:auto;height:clamp\(/);
});

console.log(`\nui.test.cjs: ${n} grupos de verificações passaram.`);
