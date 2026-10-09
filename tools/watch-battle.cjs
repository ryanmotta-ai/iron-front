/* "Filma" uma batalha IA×IA: simula em passos e salva um quadro PNG a cada N segundos de jogo, com a câmera no ponto mais quente
   (onde há mais gente em combate), para ver COMO a partida parece a quem assiste. Uso:
     node tools/watch-battle.cjs [--seed 3] [--role a0|a1|both|auto] [--scale 80] [--query "preparo=0"] [--every 15] [--frames 20] [--out pasta]
                                [--zoom 0.9] [--viewport 1360x900] [--director]   (--director: usa a câmera do diretor do comandante em vez do ponto quente fixo)
   Escreve out/frame-000.png … e out/frames.json (hora, ponto da câmera, contato, ofensivas do comandante). Serve só dist/. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
process.env.NODE_PATH = 'C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'; require('node:module').Module._initPaths();
const { chromium } = require('playwright'), root = path.resolve(__dirname, '../dist');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const director = process.argv.includes('--director'), seed = +arg('seed', '3'), role = arg('role', 'a0'), scale = arg('scale', '80'), query = arg('query', 'preparo=0'), every = +arg('every', '15'), frames = +arg('frames', '20');
const out = path.resolve(arg('out', path.join(__dirname, '../tests/artifacts/watch'))), zoom = +arg('zoom', '0.9'), vp = arg('viewport', '1360x900').split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const f = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html'); res.setHeader('Cache-Control', 'no-store'); res.end(d); });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true }), page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } }), errors = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/net::ERR|fonts.googleapis/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(s => { let a = s >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, seed);
  await page.goto(`http://127.0.0.1:${server.address().port}/?${query}`);
  await page.locator('[data-go="sandbox"]').click(); await page.locator('#start').click();
  await page.evaluate(({ scale, role }) => {
    document.getElementById('mapselect').value = 'trenches'; document.getElementById('gametype').value = 'sandbox'; document.getElementById('scale').value = scale;
    document.getElementById('blueai').value = 'on'; document.getElementById('redai').value = 'on';
    const rs = document.getElementById('rolesel'); if (rs) rs.value = role; setup(); PXFORT.endPrep?.();
  }, { scale, role });
  const index = [];
  for (let k = 0; k < frames; k++) {
    const info = await page.evaluate(({ every, zoom, director }) => {
      const stop = time + every; while (time < stop && !ended) update(.1);
      // ponto quente: centro de massa dos soldados que têm inimigo a < 200 px (ponderado); sem combate, o meio entre os exércitos
      const live = units.filter(u => u.hp > 0 && !u.down && !u.sap && u.type !== 'cavalry'); let sx = 0, sy = 0, n = 0;
      for (const u of live) { for (const e of live) if (e.team !== u.team && Math.abs(e.x - u.x) < 200 && Math.abs(e.y - u.y) < 200 && Math.hypot(e.x - u.x, e.y - u.y) < 200) { sx += u.x; sy += u.y; n++; break; } }
      const hot = n >= 4 ? { x: sx / n, y: sy / n, n } : { x: W / 2, y: GH / 2, n };
      if (!director) { cam.x = hot.x; cam.y = Math.min(hot.y, GH - 200); cam.z = zoom; } else { const C = window.PXCMD.cam; C.mode = 'on'; C.lastUser = -1e9; }
      const c = window.PXCMD?.state?.();
      return { t: Math.round(time), cam: { x: Math.round(cam.x), y: Math.round(cam.y), shot: window.PXCMD?.cam?.label, cuts: window.PXCMD?.cam?.cuts }, hot: { x: Math.round(hot.x), y: Math.round(hot.y), n: hot.n }, sup: window.IronFront?.victory?.state?.().superiority, ended, alive: [0, 1].map(t => units.filter(u => u.team === t && u.hp > 0).length), cmd: c && { doctrine: c.doctrine, stats: c.stats, off: window.PXCMD.team.map(t => t && t.off && t.off.phase), log: window.PXCMD.log.slice(-3).map(l => l.t + ' ' + l.team + ' ' + l.text) } };
    }, { every, zoom, director });
    await page.waitForTimeout(350);
    const file = path.join(out, `frame-${String(k).padStart(3, '0')}.png`);
    await page.screenshot({ path: file }); info.file = path.basename(file); index.push(info);
    process.stdout.write(`\r${k + 1}/${frames} t=${info.t}s hot=${info.hot.x},${info.hot.y} (${info.hot.n})   `);
    if (info.ended) break;
  }
  console.log(); fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify({ seed, role, query, errors, index }, null, 1));
  console.log('quadros em', out, errors.length ? 'ERROS: ' + errors.slice(0, 3).join(' | ') : 'sem erros');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
