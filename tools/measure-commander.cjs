/* Mede o que o comandante (commander.js) muda na batalha, em A/B contra "?comandante=0". Para cada semente × papéis (a0 = EUA atacam, a1 = Alemanha ataca):
     contato (fração da tropa a < 260 px de um inimigo) · parados (fração que não anda entre amostras de 5 s) · trocas de bandeira · obras concluídas ·
     aviação (saídas, bombas, rasantes, impactos no solo, abates) · ofensivas (lançadas/vencidas/fracassadas) · patrulhas · baixas
   Uso:  node tools/measure-commander.cjs [--seeds 3,5] [--roles a0,a1] [--scale 120] [--time 420] [--variants "comandante=0|"] [--out arquivo.json]
   --variants: consultas separadas por "|" (vazia = padrão). Ex.: --variants "comandante=0|apoioaereo=0&varredura=0|" compara três configurações.
   Serve só dist/; usa Edge/Playwright do runtime do Codex. As partidas são caóticas: compare MÉDIAS de ≥ 4 partidas (a aviação varia muito). */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
process.env.NODE_PATH = 'C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'; require('node:module').Module._initPaths();
const { chromium } = require('playwright'), root = path.resolve(__dirname, '../dist');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const seeds = arg('seeds', '3,5').split(',').map(Number), roles = arg('roles', 'a0,a1').split(','), scale = arg('scale', '120'), T = +arg('time', '420'), variants = arg('variants', 'comandante=0|').split('|'), outFile = arg('out', '');
const server = http.createServer((req, res) => {
  const f = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html'); res.setHeader('Cache-Control', 'no-store'); res.end(d); });
});
const run = ({ T, role, scale }) => {
  const rs = document.getElementById('rolesel'); document.getElementById('mapselect').value = 'trenches'; document.getElementById('gametype').value = 'sandbox'; document.getElementById('scale').value = scale;
  document.getElementById('blueai').value = 'on'; document.getElementById('redai').value = 'on'; if (rs) rs.value = role; setup(); PXFORT.endPrep?.();
  const A = PXAW, cs = [0, 0], still = [0, 0], cx = [[], []], done = [{}, {}], p90_0 = [null, null], reach = [0, 0], heldMax = [0, 0], med0 = [null, null], medEnd = [0, 0]; let n = 0, prev = new Map(), nextS = 0, flips = 0, lastOwn = points.map(p => p.owner).join(''); const seenP = new Set(), n0 = [0, 1].map(t => units.filter(u => u.team === t).length);
  while (time < T && !ended) {
    update(.1);
    if (time >= nextS) {
      nextS = time + 5; n++;
      for (const t of [0, 1]) {
        const us = units.filter(u => u.team === t && u.hp > 0 && !u.down && !u.sap && u.cls !== 'medic' && u.cls !== 'mechanic'), en = units.filter(u => u.team !== t && u.hp > 0 && !u.down); let c = 0, s = 0;
        for (const u of us) { for (const e of en) if (Math.abs(e.x - u.x) < 260 && Math.abs(e.y - u.y) < 260 && Math.hypot(e.x - u.x, e.y - u.y) < 260) { c++; break; } const p = prev.get(u); if (p && Math.hypot(u.x - p.x, u.y - p.y) < 2.5) s++; prev.set(u, { x: u.x, y: u.y }); }
        cs[t] += c / Math.max(1, us.length); still[t] += s / Math.max(1, us.length);
        const inf = us.filter(u => u.type === 'rifle' || u.type === 'mg'); cx[t].push(inf.reduce((a, u) => a + u.x, 0) / Math.max(1, inf.length));
        // "parada" de verdade: até onde a ponta (percentil 90 do avanço) chegou, quanto a mediana andou e quantas trincheiras inimigas estão em mãos (≥ 3 dos nossos em cima)
        const dd = t ? -1 : 1, xs = inf.map(u => dd * u.x).sort((a, b) => a - b); if (xs.length >= 5) { const p90 = xs[Math.floor(xs.length * .9)], med = xs[Math.floor(xs.length / 2)]; if (p90_0[t] === null && time >= 30) { p90_0[t] = p90; med0[t] = med; } if (p90_0[t] !== null) { reach[t] = Math.max(reach[t], p90 - p90_0[t]); medEnd[t] = med - med0[t]; } }
        let held = 0; for (const a of fieldTrenches) { if (a.team === t || a.hp <= 0) continue; let k = 0; for (const u of inf) if (u.type === 'rifle' && Math.abs(u.x - a.x) < 90 && Math.abs(u.y - a.y) < 60 && ++k >= 3) break; if (k >= 3) held++; } heldMax[t] = Math.max(heldMax[t], held);
        for (const pr of (PXSAP?.projects || []).filter(p => p.team === t)) if (pr.done && !seenP.has(pr)) { seenP.add(pr); done[t][pr.kind] = (done[t][pr.kind] || 0) + 1; }
      }
      const o = points.map(p => p.owner).join(''); if (o !== lastOwn) { flips++; lastOwn = o; } if (prev.size > 1200) prev = new Map();
    }
  }
  const st = A.stats, cmd = window.PXCMD?.state?.(), rng = a => a.length ? Math.round(Math.max(...a) - Math.min(...a)) : 0, vic = window.IronFront?.victory?.state?.();
  return {
    t: Math.round(time), ended, result: vic?.result || null, sup: vic?.superiority, alive: [0, 1].map(t => units.filter(u => u.team === t && u.hp > 0).length), start: n0,
    contact: cs.map(v => +(v / n).toFixed(3)), still: still.map(v => +(v / n).toFixed(3)), cxRange: [rng(cx[0]), rng(cx[1])], flips, reach: reach.map(Math.round), medShift: medEnd.map(Math.round), heldMax,
    works: done.map(d => Object.values(d).reduce((a, b) => a + b, 0)), air: { sorties: st.sorties, bombs: st.bombs, strafe: st.strafe, groundHits: st.groundHits, kills: st.kills, losses: st.losses, crashes: st.landingCrashes, missions: IronFrontAirCommand.state().missions, aborted: IronFrontAirCommand.state().aborted, unsafe: IronFrontAirCommand.state().unsafe },
    cmd: cmd && { stats: cmd.stats, doctrine: cmd.doctrine },
  };
};
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true }), all = [];
  for (const q of variants) for (const seed of seeds) for (const role of roles) {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } }), errors = [];
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/net::ERR|fonts.googleapis/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(s => { let a = s >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, seed);
    await page.goto(`http://127.0.0.1:${server.address().port}/?preparo=0${q ? '&' + q : ''}`);
    await page.locator('[data-go="sandbox"]').click(); await page.locator('#start').click();
    const t0 = Date.now(), r = await page.evaluate(run, { T, role, scale }); r.q = q || '(padrão)'; r.seed = seed; r.role = role; r.errors = errors.length; r.real = Math.round((Date.now() - t0) / 1000);
    all.push(r); console.log(`${r.q} s${seed} ${role} | contato ${r.contact} parados ${r.still} bandeiras ${r.flips} ponta ${r.reach} mediana ${r.medShift} trincheiras tomadas ${r.heldMax} obras ${r.works} saídas ${r.air.sorties} bombas ${r.air.bombs}/rasantes ${r.air.strafe} (missões atq ${r.air.missions.atk || 0}/bmb ${r.air.missions.bmb || 0}, abortadas ${r.air.aborted}, inseguras ${r.air.unsafe}) | ${r.cmd ? 'ofensivas ' + r.cmd.stats.offensives + ' (vit ' + r.cmd.stats.offWins + '/fal ' + r.cmd.stats.offFails + ') patrulhas ' + r.cmd.stats.patrols : 'sem comandante'} | vivos ${r.alive} | erros ${r.errors}`);
    await page.close();
  }
  const mean = (q, f) => { const rows = all.filter(r => r.q === q); return rows.length ? +(rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(3) : 0; };
  console.log('\nMÉDIAS por configuração:');
  for (const q of new Set(all.map(r => r.q))) console.log(`${q}: contato ${mean(q, r => (r.contact[0] + r.contact[1]) / 2)} · parados ${mean(q, r => (r.still[0] + r.still[1]) / 2)} · bandeiras ${mean(q, r => r.flips)} · ponta avançou ${mean(q, r => (r.reach[0] + r.reach[1]) / 2)} px · mediana ${mean(q, r => (r.medShift[0] + r.medShift[1]) / 2)} px · trincheiras tomadas (máx) ${mean(q, r => (r.heldMax[0] + r.heldMax[1]) / 2)} · obras ${mean(q, r => r.works[0] + r.works[1])} · saídas ${mean(q, r => r.air.sorties[0] + r.air.sorties[1])} · bombas+rasantes ${mean(q, r => r.air.bombs + r.air.strafe)} · baixas (vivos) ${mean(q, r => r.alive[0] + r.alive[1])} · fim por vitória ${all.filter(r => r.q === q && r.ended).length}/${all.filter(r => r.q === q).length}`);
  if (outFile) fs.writeFileSync(path.resolve(outFile), JSON.stringify(all, null, 1));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
