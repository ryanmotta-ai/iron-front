/* Verificação do aeródromo no navegador (Playwright + Edge): sobe o jogo, dispara patrulhas, confere o que o jogador vê — piloto a pé → pré-voo → sobe na
   cabine, mecânico na hélice, hélice parada × girando, calços, decolagem um de cada vez com poeira e marcas no chão, pouso — e grava as imagens em
   tests/artifacts/airfield-*.png (tira de embarque, hélice por rpm, decolagem, visão geral dos dois campos) + airfield-report.json.
   Uso: node tools/verify-airfield.cjs */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
process.env.NODE_PATH = 'C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'; require('node:module').Module._initPaths();
const { chromium } = require('playwright'), root = path.resolve(__dirname, '../dist'), OUT = path.resolve(__dirname, '../tests/artifacts');
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { const f = path.resolve(root, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0])); if (!f.startsWith(root + path.sep)) { res.writeHead(403); return res.end() } fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end() } res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html'); res.end(d) }) });
const BOOTJS = `(()=>{setup();running=false;PXW.setKind('clear');PXW.setRain(0);aiEnabled=[false,false];tickets=[99999,99999];window.finish=function(){};while(time<9){ended=false;update(1/30)}})()`;
async function open(browser, errors, query = '') {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errors.push(m.text()) });
  await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0${query}`); await page.locator('[data-go="sandbox"]').click(); await page.locator('#start').click();
  await page.evaluate(BOOTJS); return page;
}
/* monta uma folha de contato a partir de PNGs (ampliação inteira, sem suavizar) */
async function sheet(browser, files, cols, zoom, out) {
  const page = await browser.newPage(); const imgs = files.map(f => fs.readFileSync(f).toString('base64'));
  const url = await page.evaluate(async ({ imgs, cols, zoom }) => {
    const L = await Promise.all(imgs.map(b => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b })));
    const w = L[0].width * zoom, h = L[0].height * zoom, rows = Math.ceil(L.length / cols), c = document.createElement('canvas'); c.width = w * cols; c.height = h * rows;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    L.forEach((im, i) => g.drawImage(im, (i % cols) * w, Math.floor(i / cols) * h, w, h)); return c.toDataURL('image/png');
  }, { imgs, cols, zoom });
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); await page.close();
}
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true }), errors = [], report = {}, tmp = [];
  try {
    const page = await open(browser, errors);
    report.flags = await page.evaluate(() => ({ life: PXAFL.on, art: PXAFA.on, air: PXAW.on, view: PXAWV.on, anim: IronFront.animAir.on }));
    assert.ok(report.flags.life && report.flags.art && report.flags.air && report.flags.view, 'módulos do aeródromo ligados');
    /* --- 1. embarque: tira de quadros de um avião, do piloto a pé à cabine, e a partida --- */
    await page.evaluate(() => { window.__fl = PXAW.dispatch(0, 'cap', 1000, 900); window.__pl = window.__fl.m[0] });
    const acts = new Set(), gps = new Set(), shots = [];
    for (let i = 0; i < 26; i++) {
      const r = await page.evaluate((i) => { const T = i * .7; const t1 = window.__t1 = window.__t1 ?? time; while (time < t1 + T) { ended = false; update(1 / 30) } const a = window.__pl; cam.x = a.x - 6; cam.y = a.y + 22; hud(); for (let k = 0; k < 2; k++) render();
        return { act: a.pilot.act, gp: a.gp, st: a.st, rpm: a.rpm, eng: a.eng, people: PXAFL.state().drawn } }, i);
      acts.add(r.act); gps.add(r.st + '/' + r.gp);
      if (i % 2 === 0 && shots.length < 12) { const f = path.join(OUT, `_tmp_board_${i}.png`); await page.screenshot({ path: f, clip: { x: 680 - 80, y: 450 - 60, width: 160, height: 120 } }); shots.push(f); tmp.push(f) }
    }
    report.boarding = { acts: [...acts], phases: [...gps] };
    for (const a of ['walk', 'inspect', 'climb', 'seat']) assert.ok(acts.has(a), `piloto: ${a}`);
    for (const p of ['start/crew', 'start/prime', 'start/swing', 'start/warm']) assert.ok(gps.has(p), `fase ${p}`);
    await sheet(browser, shots, 4, 3, path.join(OUT, 'airfield-boarding.png'));
    /* --- 2. a hélice por rpm: parada, puxão, arranque, lenta, plena --- */
    const rp = [0, .05, .1, .16, .25, .4, .7, 1], pr = [];
    for (const [i, r] of rp.entries()) {
      await page.evaluate(r => { const a = window.__pp || PXAW.planes().find(p => p.team === 0 && p.T.key === 'spad' && p.st === 'park'); window.__pp = a; a.st = 'lineup'; a.gp = 'runup'; a.gt = 1e9; a.eng = 'run'; a.rpm = r; a.engOn = r > .04; cam.x = a.x + 3; cam.y = a.y + 26; hud(); for (let k = 0; k < 2; k++) render() }, r);
      const f = path.join(OUT, `_tmp_prop_${i}.png`); await page.screenshot({ path: f, clip: { x: 680 - 30, y: 450 - 22, width: 60, height: 44 } }); pr.push(f); tmp.push(f);
    }
    await sheet(browser, pr, 8, 4, path.join(OUT, 'airfield-props.png'));
    const same = await page.evaluate(() => { const a = window.__pp; a.st = 'park'; a.gp = ''; a.eng = 'off'; a.rpm = 0; a.engOn = false; a.pilot && (a.pilot.act = 'idle'); const c = document.getElementById('game'), g = c.getContext('2d'); cam.x = a.x + 3; cam.y = a.y + 26;
      const grab = () => { update(.001); for (let k = 0; k < 2; k++) render(); const w = c.width / 2, h = c.height / 2, d = g.getImageData(w - 24, h - 14, 48, 28).data; let s = 0; for (let i = 0; i < d.length; i += 7) s = (s * 31 + d[i]) | 0; return s };
      const A = grab(), B = grab(), C = grab(); return A === B && B === C });
    report.staticProp = same; assert.ok(same, 'hélice parada: dois quadros seguidos idênticos');
    /* --- 3. decolagem: um de cada vez, poeira, marcas no chão --- */
    await page.close();
    const p2 = await open(browser, errors);
    const t = await p2.evaluate(() => {
      window.__fl = PXAW.dispatch(0, 'cap', 1000, 900); window.__fl2 = PXAW.dispatch(0, 'atk', 1000, 900); let g = 0;
      while (!window.__fl.m.some(m => m.st === 'roll') && g++ < 20000) { ended = false; update(1 / 30) }
      const a = window.__fl.m.find(m => m.st === 'roll'); window.__pl = a; const af = PXAW.airfields()[0], F = PXAWV.airfieldCanvas()[0], rear = F.c, x0 = F.x;
      const sample = () => { const g2 = rear.getContext('2d'), X = Math.floor((af.x - af.half + 140 - x0) * PX.Z), Y = Math.floor((af.y - F.y) * PX.Z) - 12, d = g2.getImageData(X, Y, 120, 24).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] * 3 + d[i + 2]; return s };
      window.__s0 = sample(); window.__sample = sample; return { t: time, st: a.st };
    });
    const strip = [], maxRoll = [];
    let dust = 0;
    for (let i = 0; i < 14; i++) {
      const r = await p2.evaluate((i) => { const t1 = window.__t2 = window.__t2 ?? time; while (time < t1 + i * .5) { ended = false; update(1 / 30) } const a = window.__pl; cam.x = a.x + (a.air ? 40 : -60); cam.y = a.y - a.h * .4; hud(); for (let k = 0; k < 2; k++) render();
        return { st: a.st, h: a.h, gv: a.gv, rpm: a.rpm, onStrip: PXAW.planes().filter(p => p.team === 0 && (p.st === 'roll' || p.st === 'lineup')).length, puffs: IronFront.animAir.state().puffs } }, i);
      maxRoll.push(r.onStrip); dust = Math.max(dust, r.puffs);
      const f = path.join(OUT, `_tmp_to_${i}.png`); await p2.screenshot({ path: f, clip: { x: 680 - 150, y: 450 - 70, width: 300, height: 140 } }); strip.push(f); tmp.push(f);
    }
    report.takeoff = { maxOnStrip: Math.max(...maxRoll), dustPuffs: dust, tracksChanged: await p2.evaluate(() => window.__sample() !== window.__s0) };
    assert.equal(report.takeoff.maxOnStrip, 1, 'um avião de cada vez na faixa'); assert.ok(dust > 3, 'poeira levantada'); assert.ok(report.takeoff.tracksChanged, 'marcas de roda gravadas no chão');
    await sheet(browser, strip.slice(0, 12), 3, 2, path.join(OUT, 'airfield-takeoff.png'));
    /* --- 4. visão geral dos dois campos com tráfego --- */
    for (const team of [0, 1]) {
      await p2.evaluate(team => { const x = team ? 1400 : 1000; PXAW.dispatch(team, 'cap', x, 900); PXAW.dispatch(team, 'rec', x, 900); let g = 0; const t0 = time; while (time < t0 + 40) { ended = false; update(1 / 30) } const af = PXAW.airfields()[team]; cam.x = af.x + (team ? 300 : -300); cam.y = af.y - 230; hud(); for (let k = 0; k < 3; k++) render() }, team);
      await p2.screenshot({ path: path.join(OUT, `airfield-field-${team ? 'de' : 'us'}.png`) });
    }
    /* --- 5. longa execução com os dois lados e a IA de comando: sem erros --- */
    report.soak = await p2.evaluate(() => { aiEnabled = [true, true]; const t0 = time; let n = 0, mx = 0; while (time < t0 + 240) { ended = false; update(1 / 30); if (((time * 30) | 0) % 6 === 0) { const a = performance.now(); render(); mx = Math.max(mx, performance.now() - a); n++ } } return { renders: n, maxMs: +mx.toFixed(1), air: PXAW.state().stats.sorties, errors: [PXAW.stats.errors, PXAWV.state().errors, PXAFL.state().errors], landings: PXAW.stats.landings, starts: PXAW.stats.starts } });
    assert.deepEqual(report.soak.errors, [0, 0, 0], 'sem erros nos módulos aéreos'); assert.ok(report.soak.landings >= 2, 'houve pousos');
    /* --- 5b. queda no aeródromo (fora do mapa): agora é animada, com mancha de fogo e carcaça, e sem explodir tropas na borda do mapa --- */
    report.crash = await p2.evaluate(() => { const af = PXAW.airfields()[0], a = PXAW._spawn(0, 'spad', af.x + 100, af.y - 100, 260, 0, 200, .8), troops = units.filter(u => u.hp > 0).length; PXAW._internals.down(a, null, 'tiro', 'spin');
      let wrecks = 0, crashes = 0, g = 0; while (g++ < 30 * 14) { ended = false; update(1 / 30); if (g % 6 === 0) { cam.x = af.x + 200; cam.y = af.y - 60; render() } const st = IronFront.animAir.state(); crashes = Math.max(crashes, st.crashes.length); wrecks = Math.max(wrecks, st.wrecks.length) }
      return { crashes, wrecks, troopsBefore: troops, troopsAfter: units.filter(u => u.hp > 0).length, errors: [PXAW.stats.errors, PXAFL.state().errors, PXAWV.state().errors] } });
    assert.ok(report.crash.crashes >= 1 && report.crash.wrecks >= 1, 'a queda no aeródromo é animada e deixa a carcaça'); assert.deepEqual(report.crash.errors, [0, 0, 0]);
    await p2.close();
    /* --- 6. chave de desligar: sem a vida do aeródromo o jogo ainda roda e desenha --- */
    const p3 = await open(browser, errors, '&aerodromo=0');
    report.off = await p3.evaluate(() => { const t0 = time; PXAW.dispatch(0, 'cap', 1000, 900); while (time < t0 + 30) { ended = false; update(1 / 30) } const af = PXAW.airfields()[0]; cam.x = af.x; cam.y = af.y - 300; hud(); for (let k = 0; k < 2; k++) render(); return { life: PXAFL.on, art: PXAFA.on } });
    assert.equal(report.off.life, false); await p3.close();
    report.errors = errors; assert.deepEqual(errors, [], 'sem erros no console');
    fs.writeFileSync(path.join(OUT, 'airfield-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    console.log('Aeródromo no navegador OK: embarque, hélice, decolagem 1 por vez com poeira e marcas, visão dos dois campos, 240 s de combate sem erros');
  } finally { for (const f of tmp) try { fs.unlinkSync(f) } catch { } await browser.close(); server.close() }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1 });
