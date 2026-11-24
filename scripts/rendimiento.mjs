/* LCP y peso en un móvil de gama media (412×915, DPR 2,625, 4G lento, CPU ×4). El LCP tiene que ser el titular.
   Uso: node scripts/rendimiento.mjs   (puerto 8952; 3 pasadas; sin WebGL: --disable-3d-apis y ?sin-webgl).
   Las letras de Google se sirven vacías (se mide con las de sistema: lo que ve quien aún no las tiene). */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(8952, r));
const b = await chromium.launch({ args: ['--disable-3d-apis'] });
const lcps = [];
try {
  for (let n = 1; n <= 3; n++) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/open-meteo\.com/, (r) => r.abort());
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      try { localStorage.setItem('juanin-cookies', 'si'); } catch (e) {}
      window.__lcp = null; window.__long = [];
      new PerformanceObserver((l) => { const e = l.getEntries().pop(); window.__lcp = { t: e.startTime, que: e.url || (e.element && (e.element.id || e.element.tagName)) }; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
    });
    let bytes = 0, reqs = 0;
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; reqs++; });
    await page.goto('http://localhost:8952/index.html?sin-webgl', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({ lcp: window.__lcp, long: window.__long }));
    lcps.push(r.lcp ? r.lcp.t : Infinity);
    console.log(`pasada ${n}: LCP ${Math.round(r.lcp?.t ?? -1)} ms (${r.lcp?.que}) · ${reqs} peticiones, ${(bytes / 1024).toFixed(0)} KB · tareas largas ${JSON.stringify(r.long)}`);
    await ctx.close();
  }
} finally { await b.close(); srv.close(); }
const med = lcps.slice().sort((a, b) => a - b)[1];
console.log(`LCP mediano: ${Math.round(med)} ms ${med <= 2500 ? '(≤ 2,5 s: bien)' : '(MÁS de 2,5 s)'}`);
process.exitCode = med <= 2500 ? 0 : 1;
