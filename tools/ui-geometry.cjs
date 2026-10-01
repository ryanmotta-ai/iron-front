/* Medição de geometria da UI (Playwright). Uso: NODE_PATH=<pasta com playwright> node tools/ui-geometry.cjs [LxA ...]
   Sobe um servidor estático de dist/ na porta 8796 (ou use URL=http://127.0.0.1:PORTA/index.html para um já existente).
   Para cada tamanho: o último botão do menu cabe acima do rodapé, o INICIAR da campanha fica dentro da tela sem rolagem,
   e nenhum par de painéis do HUD se sobrepõe em cada aba do comandante. Sai com código 1 se algo falhar. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../dist'), mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['1280x720', '1366x768', '1920x1080']).map(s => s.split('x').map(Number));
(async () => {
  let srv = null, url = process.env.URL;
  if (!url) {
    srv = http.createServer((q, r) => { const f = path.resolve(root, '.' + (q.url.split('?')[0] === '/' ? '/index.html' : decodeURIComponent(q.url.split('?')[0])));
      if (!f.startsWith(root)) { r.writeHead(403); return r.end() } fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end() } r.setHeader('Content-Type', mime[path.extname(f)] || 'application/octet-stream'); r.end(d) }) });
    await new Promise(r => srv.listen(8796, '127.0.0.1', r)); url = 'http://127.0.0.1:8796/index.html';
  }
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let bad = 0;
  const fail = m => { bad++; console.log('  FALHA ' + m) };
  try {
    for (const [w, h] of sizes) {
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      await p.goto(url); await p.waitForFunction(() => window.IFUI, null, { timeout: 30000 }); await p.waitForTimeout(600);
      const t = await p.evaluate(() => ({ last: Math.max(...[...document.querySelectorAll('#mainmenu .mbtn')].map(e => e.getBoundingClientRect().bottom)), foot: document.getElementById('titlefoot').getBoundingClientRect().top }));
      console.log(`${w}x${h} menu: último botão ${Math.round(t.last)} / rodapé ${Math.round(t.foot)}`); if (t.last > t.foot + 4) fail('menu principal invade o rodapé');
      await p.evaluate(() => IFUI.go('campaign')); await p.waitForTimeout(500);
      const c = await p.evaluate(() => { const v = document.getElementById('v-campaign'), g = document.getElementById('op-go').getBoundingClientRect(); return { go: g.bottom, view: v.getBoundingClientRect().bottom, sh: v.scrollHeight, ch: v.clientHeight } });
      console.log(`  campanha: INICIAR ${Math.round(c.go)} / vista ${Math.round(c.view)} (rolagem ${c.sh}/${c.ch})`); if (c.go > Math.min(h, c.view)) fail('INICIAR fora da tela');
      await p.evaluate(() => { document.querySelector('#opgrid .op').click(); document.getElementById('op-go').click() }); await p.waitForTimeout(1500);
      for (const tab of ['units', 'build', 'support']) {
        await p.evaluate(t => document.querySelector('[data-tab=' + t + ']').click(), tab); await p.waitForTimeout(400);
        const ov = await p.evaluate(() => {
          const S = ['#topbar .tb-left', '#topbar .tb-center', '#topbar .tb-right', '#objectives', '.fieldtop', '#wxpill', '#wxbar', '#orders', '#supply', '#hotbar', '#mapbox', '#hintline', '#toast', '#prepbanner', '#tacticalStatus'];
          const els = []; for (const s of S) { const e = document.querySelector(s); if (!e) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || +cs.opacity === 0 || (e.id === 'toast' && !e.classList.contains('show'))) continue; const r = e.getBoundingClientRect(); if (r.width > 2 && r.height > 2) els.push([s, r]) }
          const o = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i][1], b = els[j][1]; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) o.push(els[i][0] + ' x ' + els[j][0]) } return o });
        console.log(`  batalha/${tab}: ${ov.length ? ov.join('; ') : 'sem sobreposição'}`); if (ov.length) fail('sobreposição na aba ' + tab);
      }
      await p.close();
    }
  } finally { await browser.close(); if (srv) srv.close() }
  console.log(bad ? `\n${bad} falha(s)` : '\nGeometria da UI ok'); process.exit(bad ? 1 : 0);
})();
