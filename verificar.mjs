/* Verificación de la web de Casa María Juanín (Playwright, UN solo navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs            (puerto 8951; todo)
        node verificar.mjs 3 4        (solo esos bloques, para depurar)
   Sin capturas: lo que hay que mirar a ojo va en el README («Qué mirar en Chrome»). El WebGL del puerto NO se pinta:
   el navegador arranca con --disable-3d-apis y la página se abre con ?sin-webgl. Todo con movimiento reducido salvo
   el bloque de movimiento, que va una vez y al final. Las letras de Google y Open-Meteo no se piden (se sirven vacías
   o se cortan): la prueba no depende de la red. Los módulos de los otros agentes se prueban solo si ya están. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8951;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream', '.tif': 'image/tiff' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'juanin-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const HAY = { radio: existe('js/radio.js'), plantas: existe('js/plantas.js'), nieve: existe('js/nieve.js') };
const DATOS = JSON.parse(leer('data/apartamentos.json'));
const RUTAS = existe('ref/raw/rutas.json') ? JSON.parse(leer('ref/raw/rutas.json')) : null;
const html = leer('index.html');
const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

/* ================= 1. archivos (sin navegador) ================= */
if (toca(1)) {
  console.log('\n1. Archivos');
  console.log('  (módulos presentes: ' + Object.entries(HAY).map(([k, v]) => k + (v ? ' sí' : ' no')).join(', ') + ')');
  for (const f of fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'))) {
    const s = leer(f);
    comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(s), `${f}: charset lo primero y noindex, nofollow justo detrás`);
    const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
    comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
    comprobar(!/<!--parte:|<!--gen:/.test(s) && !/<!-- sin partes\//.test(s), `${f}: todas las partes y los generados, dentro`);
    comprobar(!/[ÃÂ][\u0080-\u00BF]|\uFFFD/.test(s), `${f}: sin caracteres rotos`);
  }
  comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'marca/logo-original.png'].every(existe), 'están .nojekyll, 404, manifest, og, favicons y el logo de siempre');

  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href)="([^"]+)"/g)) for (const parte of (m[1] === 'srcset' ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);

  /* fotos */
  const lista = JSON.parse(leer('scripts/fotos-lista.json'));
  const fotosJson = JSON.parse(leer('img/fotos/fotos.json'));
  const pedidas = ['fachada', 'monte', 'pan', 'porche', ...DATOS.apartamentos.flatMap((a) => a.fotos.map((f) => f.nombre))];
  comprobar(pedidas.every((n) => fotosJson.some((f) => f.nombre === n)), `están las ${pedidas.length} fotos que piden los agentes por nombre (fotos.json y apartamentos.json)`, pedidas.filter((n) => !fotosJson.some((f) => f.nombre === n)));
  const faltanF = [];
  for (const f of fotosJson) for (const w of f.anchos) for (const e of ['avif', 'webp', 'jpg']) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanF.push(`${f.nombre}-${w}.${e}`);
  comprobar(faltanF.length === 0, 'cada foto existe en todos sus anchos y en AVIF, WebP y JPG', faltanF.slice(0, 5));
  const ampliadas = fotosJson.filter((f) => { const l = lista.find((x) => x.nombre === f.nombre); return !l || f.anchos.some((w) => w > (l.maxAncho || 1e9)); }).map((f) => f.nombre);
  comprobar(ampliadas.length === 0, 'ninguna foto pasa de su ancho máximo (nunca se amplía)', ampliadas);
  comprobar(fotosJson.filter((f) => /wb2011/.test(f.origen)).every((f) => f.ancho <= 800) && fotosJson.find((f) => f.nombre === 'fachada').ancho <= 1024, 'las de 2011 no pasan de 800 px y la fachada de 1024');
  comprobar(lista.every((f) => !/img-20221014|wb2009|Panera\.jpg/.test(f.ruta)), 'no se usan el folleto, las miniaturas de 2009 ni la miniatura Panera.jpg');
  comprobar(/fotos-verticales|fachada-recta/.test(lista.find((f) => f.nombre === 'fachada').ruta) && existe('scripts/fuentes/fachada-recta.png'), 'la fachada lleva las verticales enderezadas (scripts/fotos-verticales.py)');
  const portadaHtml = html.match(/<section id="portada"[\s\S]*?<\/section>/)[0];
  comprobar(!/fetchpriority="high"/.test(portadaHtml), 'el LCP es el titular: ninguna foto de la portada con fetchpriority="high"');
  comprobar(/<h1 id="portada-tit"[^>]*>Tres apartamentos en el antiguo ultramarinos de la familia<\/h1>/.test(html), 'el titular de la portada, en texto plano (no espera a ningún JS)');

  /* textos: solo lo que dice DATOS */
  comprobar(/669 75 02 09/.test(texto) && /985 487 417/.test(texto) && /tel:\+34669750209/.test(html) && /tel:\+34985487417/.test(html) && !/616 ?857 ?044/.test(html), 'teléfonos: 669 75 02 09 (principal) y 985 487 417 (fijo); el 616 no sale (a PENDIENTES)');
  comprobar(/AT0510/.test(texto) && /2 llaves/.test(texto) && /Ctra\. General 48/.test(texto) && /33680 Collanzo/.test(texto), 'pie y contacto: AT0510, 2 llaves, Ctra. General 48 y 33680 Collanzo');
  comprobar(/4,9/.test(texto) && /56 reseñas/.test(texto) && /9,6/.test(texto) && /66 comentarios/.test(texto) && /a 24 de noviembre de 2026/.test(texto), 'opiniones: Google 4,9 (56) y Booking 9,6 (66), fechadas');
  const frases = ['La propietaria muy atenta, hasta te recibe con unos dulces.', 'Lugar encantador y la dueña muy amable, muy agradecida por el trato recibido.', 'Excelente atención por parte de los propietarios, muy atentos en todo momento.'];
  comprobar(frases.every((f) => texto.includes(f)), 'las tres frases de la ficha de Google, tal cual');
  comprobar(/Reseña en Google/.test(texto), 'la frase del trato, citada como reseña de Google');
  comprobar(!/Juan Pérez|nuestro restaurante|Mar[ií]a Juan[ií]n,? la dueña|la dueña,? Mar/i.test(texto), 'ni el testimonio de relleno de Webador ni nombre para la dueña');
  comprobar(!/\b\d+\s+radios|radios (de|marca) [A-Z]|Philips|Telefunken|Grundig|Braun/.test(texto), 'sin inventar cuántas radios hay ni de qué marcas');
  comprobar(!/berrea[^.]{0,40}\b(septiembre|octubre)\b|\b(septiembre|octubre)\b[^.]{0,40}berrea|temporada de esqu[ií][^.]{0,30}\b(diciembre|enero|abril)\b/i.test(texto), 'sin fechas de la berrea ni de la temporada de esquí');
  comprobar(/finales del siglo XIX/.test(texto) && /La Panera/.test(texto) && /2006/.test(texto) && /colección de radios antiguas/.test(texto), 'la historia de DATOS: ultramarinos del XIX, La Panera, 2006 y las radios');
  comprobar(/Entrada/.test(texto) && /14:00/.test(texto) && /12:00/.test(texto) && /Todo el año/.test(texto) && /Mascotas bajo petición/.test(texto), 'las condiciones: 14:00, 12:00, todo el año y mascotas bajo petición');
  comprobar(['Guardaesquís y calientabotas', 'Jardín con barbacoa y porche', 'Rincón de lectura', 'Lavandería y plancha', 'Cuna y calientabiberones', 'Wifi', 'Calefacción individual', 'Mascotas bajo petición'].every((s) => texto.includes(s)) && (html.match(/<ul class="comun">[\s\S]*?<\/ul>/)[0].match(/<svg/g) || []).length === 8, 'lo común: los ocho, cada uno con su icono propio');
  comprobar(/A-66/.test(texto) && /salida 97/.test(texto) && /AS-112/.test(texto) && /AS-253/.test(texto) && /Feve/.test(texto) && /Alsa/.test(texto), 'cómo llegar: A-66 (salida 97), AS-112, AS-253, Feve y Alsa');
  if (RUTAS) {
    const d = RUTAS.destinos;
    const enTexto = (k) => texto.includes(`${d[k].min} min · ${String(Math.round(d[k].km * 10) / 10).replace('.', ',')} km`) || texto.includes(`${Math.floor(d[k].min / 60)} h ${String(d[k].min % 60).padStart(2, '0')} min · ${String(Math.round(d[k].km * 10) / 10).replace('.', ',')} km`);
    const claves = ['fuentes-de-invierno', 'san-isidro', 'oviedo', 'gijon', 'mieres', 'leon', 'aeropuerto'].filter((k) => d[k]);
    comprobar(claves.length === 7 && claves.every(enTexto), 'las siete distancias de «Cómo llegar», tal cual en rutas.json (OSRM)', claves.filter((k) => !enTexto(k)));
    const maxMin = Math.max(d['fuentes-de-invierno'].min, d['san-isidro'].min);
    comprobar(maxMin <= 17 ? /a quince minutos de Fuentes/.test(texto) : !/a quince minutos/.test(texto), `la portada dice los minutos que da OSRM (${d['fuentes-de-invierno'].min} y ${d['san-isidro'].min}), no los «15» de la ficha`);
    comprobar(/OSRM/.test(texto) && /colaboradores de OpenStreetMap/.test(texto), 'las distancias citan OSRM y OpenStreetMap');
  } else nota('sin ref/raw/rutas.json todavía (Nieve): sin distancias');
  comprobar(!/[—–]/.test(texto), 'ni una raya (— ni –) en el texto visible');
  comprobar(!/\b(1|una)( sola| única)? reseña\b|clientes satisfechos|cientos de/i.test(texto), 'sin recuentos raros ni prueba social inventada');
  comprobar(!/sin permanencia|\b(galego|benvidos|reserva xa)\b/i.test(texto), 'solo castellano y nada de «sin condiciones»');
  comprobar(!/<audio|new Audio|AudioContext/.test(html + leer('js/main.js') + (HAY.radio ? leer('js/radio.js') : '')), 'sin sonido');

  /* contrato web ↔ módulos */
  const sitios = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/data-modulo="([^"]+)"/g)].map((m) => m[1]);
  comprobar(JSON.stringify(sitios) === JSON.stringify(['radio', 'plantas', 'nieve', 'radio-pie']), 'los huecos de los módulos, en su orden: radio, plantas, nieve, radio-pie', sitios);
  comprobar(/<section id="portada"[^>]*>\s*<div data-modulo="radio">[\s\S]*?<\/div>\s*<div class="portada-texto">/.test(html.replace(/<div class="radio-respaldo">[\s\S]*?<\/svg>\s*<p[^>]*>[\s\S]*?<\/p>\s*<\/div>\s*<\/div>/, '</div>')) || /<section id="portada"[^>]*>\s*<div data-modulo="radio">/.test(html), 'portada: <div data-modulo="radio"> y después .portada-texto');
  comprobar(/<section id="apartamentos"[^>]*aria-labelledby="t-apartamentos"[\s\S]*?<h2 id="t-apartamentos"[\s\S]*?data-modulo="plantas"/.test(html) && /<section id="puerto"[^>]*aria-labelledby="t-puerto"[\s\S]*?<h2 id="t-puerto"[\s\S]*?data-modulo="nieve"/.test(html) && /<footer[^>]*>[\s\S]*data-modulo="radio-pie" aria-hidden="true"/.test(html), 'apartamentos, puerto y pie con sus titulares y sus huecos');
  const orden = ['js/radio.js', 'js/plantas.js', 'js/nieve.js', 'js/reserva.js', 'js/main.js'].filter(existe);
  const pos = orden.map((s) => html.indexOf(`src="${s}`));
  comprobar(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])) && orden.every((s) => new RegExp(`<script src="${s}[^"]*" defer>`).test(html)), 'los scripts, con defer y los módulos antes de main.js', orden);
  comprobar(['radio', 'plantas', 'nieve'].filter((m) => existe(`css/${m}.css`)).every((m) => new RegExp(`<head>[\\s\\S]*href="css/${m}\\.css[\\s\\S]*</head>`).test(html)), 'los CSS de los módulos que existen, en el <head>');
  const fichas = (html.match(/<article class="planta-ficha"/g) || []).length;
  comprobar(fichas === 3 && DATOS.apartamentos.every((a) => html.includes(`id="ficha-${a.id}"`) && html.includes(`data-reservar="${a.id}"`)), 'respaldo de Plantas: las tres fichas de apartamentos.json con «Reservar este»');
  comprobar((html.match(/<table class="vistazo__tabla">[\s\S]*?<\/table>/)[0].match(/<tr>/g) || []).length === 4, 'la tabla de la sobria: cabecera y tres filas');
  const fuentesGoogle = (html.match(/fonts\.googleapis\.com\/css2\?([^"]+)/) || [, ''])[1].split('&').filter((x) => x.startsWith('family=')).map((x) => x.slice(7).split(':')[0]);
  comprobar(JSON.stringify(fuentesGoogle) === JSON.stringify(['B612+Mono', 'Michroma', 'Radio+Canada']) && /display=swap/.test(html), 'tres letras de Google y ninguna más (B612 Mono, Michroma, Radio Canada), con display=swap', fuentesGoogle);

  /* CSS y JS: lo que no se negocia */
  const css = leer('css/estilos.css');
  const todoCss = ['estilos', 'radio', 'plantas', 'nieve'].filter((m) => existe(`css/${m}.css`)).map((m) => leer(`css/${m}.css`)).join('\n');
  comprobar(/\.cookies:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css), 'cookies: display solo en :not([hidden])');
  comprobar(/\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css), 'mando: display solo en :not([hidden])');
  comprobar(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css), '[hidden] siempre oculta');
  comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css) && /\.menu-movil\s*\{[^}]*backdrop-filter:\s*blur/.test(css), 'menú móvil: 100dvh, nunca inset:0, y con blur');
  comprobar(!/\ddvh/.test(css.replace(/\.menu-movil\s*\{[^}]*\}/, '')), 'fuera del menú fijo, ningún dvh');
  comprobar(!/cursor:\s*none/.test(todoCss), 'sin cursor propio');
  comprobar(!/marquee/i.test(todoCss + html) && !/li\s*\{[^}]*position:\s*sticky/.test(css), 'ni marquesina ni pila sticky de tarjetas');
  comprobar(!/font-family:[^;]*\bserif\b(?![^;]*sans-serif)|['"](Georgia|Times|Fraunces|Instrument Serif)['"]/.test(todoCss.replace(/sans-serif/g, '')), 'ninguna serif');
  comprobar(!/data-partir|letra-a-letra|\.letra\b/.test(html + css), 'sin titulares partidos letra a letra');
  comprobar(/\.foco-marca::before/.test(css) && /id="foco-marca"/.test(html), 'foco con forma propia: subrayado de 2 px con muesca');
  const mainJs = leer('js/main.js');
  comprobar(/raiz\.classList\.add\('con-movimiento'\)/.test(mainJs) && /const motion = !quieto;/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
  comprobar(/if \(esBarra\(\)\) return;/.test(mainJs), 'el resize de la barra del móvil no rehace nada');
  comprobar(/history\.scrollRestoration = 'manual'/.test(leer('partes/cabeza.html')) && /scrollTo\(0, 0\)/.test(mainJs), 'recargar a media página: scrollRestoration manual y vuelta arriba');
  comprobar(!/cdn\.|jsdelivr|cdnjs|unpkg/.test(html), 'ninguna librería externa en la página (las de los módulos, si las hay, las cargan ellos)');
  let borrado = '';
  try { borrado = execFileSync(process.execPath, [path.join(RAIZ, 'scripts/probar-borrado-mando.mjs')], { encoding: 'utf8' }); } catch (e) { borrado = String(e.stdout || e.message); }
  comprobar(/funciona/.test(borrado), 'la receta de borrado del mando (README) funciona', borrado.trim());
}

/* ================= navegador: uno solo, sin WebGL ================= */
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'], ignoreDefaultArgs: ['--hide-scrollbars'] });
const errores = [];
async function contexto(op = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route(/open-meteo\.com|google\.com\/maps|booking\.com/, (r) => r.abort());
  return ctx;
}
async function pagina(ctx, url = PAG, cookies = true) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(`${url}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|open-meteo/i.test(m.text())) errores.push(`${url}: ${m.text()}`); });
  if (cookies) await p.addInitScript(sinCookies);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.Juanin && window.Juanin.web && window.Juanin.motor);
  return p;
}
// baja por la página con la rueda (los módulos se montan al acercarse) y vuelve arriba
async function recorrer(p, paso = 700) {
  const alto = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < alto; y += paso) { await p.mouse.wheel(0, paso); await p.waitForTimeout(40); }
  await p.waitForTimeout(250);
}

try {
  /* ================= 2. escritorio: cabecera, módulos, motor, cookies, visor, foco y contraste ================= */
  if (toca(2)) {
    console.log('\n2. Escritorio (1280×800, movimiento reducido)');
    const ctx = await contexto();
    const p = await pagina(ctx);
    comprobar(await p.evaluate(() => !document.getElementById('cab').classList.contains('sc')), 'cabecera transparente sobre la portada');
    const tit = await p.evaluate(() => { const h = document.getElementById('portada-tit'); const r = h.getBoundingClientRect(); return { op: getComputedStyle(h).opacity, top: r.top, bottom: r.bottom, vis: r.bottom < innerHeight }; });
    comprobar(tit.op === '1' && tit.vis, 'el titular se ve entero en la primera pantalla', tit);
    const acc = await p.evaluate(() => { const r = document.querySelector('.portada__acc').getBoundingClientRect(); return r.bottom <= innerHeight; });
    comprobar(acc, 'los botones de la portada, sin bajar');
    if (HAY.radio) comprobar(await p.evaluate(() => document.querySelector('[data-modulo="radio"]').dataset.montado === '1'), 'Radio montado en la portada');
    const ag0 = await p.evaluate(() => document.getElementById('cab-aguja').style.transform);
    await p.mouse.wheel(0, 2400); await p.waitForTimeout(250);
    const cab = await p.evaluate(() => ({ sc: document.getElementById('cab').classList.contains('sc'), ag: document.getElementById('cab-aguja').style.transform, s: getComputedStyle(document.documentElement).getPropertyValue('--sintonia') }));
    comprobar(cab.sc && cab.ag !== ag0 && parseFloat(cab.s) > 0, 'al bajar: la cabecera toma fondo y su aguja avanza (--sintonia)', cab);
    await recorrer(p);
    const mont = await p.evaluate(() => ['plantas', 'nieve', 'radio-pie'].map((m) => { const el = document.querySelector(`[data-modulo="${m}"]`); return [m, el ? el.dataset.montado || '' : 'falta']; }));
    nota('módulos montados: ' + JSON.stringify(mont));
    if (HAY.plantas) comprobar(mont.find((x) => x[0] === 'plantas')[1] === '1', 'Plantas montado al acercarse');
    if (HAY.nieve) comprobar(mont.find((x) => x[0] === 'nieve')[1] === '1', 'Nieve montado al acercarse (sin WebGL)');
    if (HAY.radio) {
      await p.evaluate(() => document.getElementById('pie').scrollIntoView());
      const pie = await p.waitForFunction(() => document.querySelector('[data-modulo="radio-pie"]').dataset.completo === '1', null, { timeout: 4000 }).then(() => true).catch(() => false);
      comprobar(pie, 'el pie: la escala pequeña con las cuatro emisoras encendidas (§5 bis)');
    }
    const enl = await p.evaluate(() => { const s = document.getElementById('llegar'); scrollTo(0, s.offsetTop - 20); return true; });
    await p.waitForTimeout(150);
    comprobar(await p.evaluate(() => [...document.querySelectorAll('.cab__nav a')].map((a) => a.getAttribute('href')).join(' ')) === '#casa #apartamentos #puerto #reservar', 'la cabecera: La casa, Apartamentos, El puerto y Reservar');

    /* reservar */
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(100);
    await p.evaluate(() => document.dispatchEvent(new CustomEvent('juanin:apartamento', { detail: { id: 'capitan' } })));
    await p.waitForTimeout(200);
    const tras = await p.evaluate(() => ({ apt: Juanin.motor.estado.apartamento, top: document.getElementById('reservar').getBoundingClientRect().top, pressed: document.querySelector('.aptos [data-apt="capitan"]').getAttribute('aria-pressed') }));
    comprobar(tras.apt === 'capitan' && tras.pressed === 'true' && Math.abs(tras.top) < 140, '«juanin:apartamento» preselecciona El Capitán y baja a Reservar', tras);
    await p.evaluate(() => Juanin.reservar('salao'));
    comprobar(await p.evaluate(() => Juanin.motor.estado.apartamento) === 'salao', 'Juanin.reservar(\'salao\') preselecciona El Salao');
    // aforo: 5 personas en El Salao (de 4, supuesto) → lo dice y propone los otros
    await p.evaluate(() => Juanin.motor.personas(5));
    const aforo = await p.evaluate(() => { const a = document.querySelector('.motor__aforo'); return a ? { txt: a.textContent, b: [...a.querySelectorAll('button')].map((b) => b.dataset.apt) } : null; });
    comprobar(aforo && /para 4 personas/.test(aforo.txt) && aforo.b.join() === 'panera,capitan', 'si no caben: «El Salao es para 4» y propone La Panera y El Capitán', aforo);
    await p.click('.motor__aforo [data-apt="panera"]');
    comprobar(await p.evaluate(() => Juanin.motor.estado.apartamento === 'panera' && !document.querySelector('.motor__aforo')), 'al cambiar a La Panera, el aviso se va');
    // tarifas y temporada (supuestos)
    const tar = await p.evaluate(() => { const M = window.__motor; return { a: M.esAlta('2026-11-25'), b: M.esAlta('2026-11-26'), c: M.pascua(2027), d: M.esAlta('2027-03-28'), e: M.esAlta('2027-03-29'), nv: M.precioNoche('2026-12-31'), baja: M.precioNoche('2027-06-10'), alta: M.precioNoche('2027-01-10'), T: M.T }; });
    comprobar(!tar.a && tar.b && tar.c === '2027-03-28' && tar.d && !tar.e && tar.nv === 150 && tar.baja === 85 && tar.alta === 115, 'temporada alta del 26 de noviembre a fin de Semana Santa; 85 €, 115 € y Nochevieja 150 € (supuestos)', tar);
    comprobar(tar.T.baja === DATOS.tarifas.baja && tar.T.alta === DATOS.tarifas.alta && tar.T.supletoria === DATOS.tarifas.supletoria, 'el motor lee las tarifas de data/apartamentos.json (una sola fuente)');
    comprobar(tar.T.baja >= 70 && tar.T.nochevieja <= 150, 'los precios, dentro de la horquilla oficial de 70 a 150 €');
    // ocupación determinista y distinta por apartamento
    const huella = () => p.evaluate(() => ['panera', 'capitan', 'salao'].map((id) => [...window.__motor.ocupDe(id)].sort().join(',').length + ':' + [...window.__motor.ocupDe(id)].sort().slice(0, 4).join(',')));
    const h1 = await huella();
    await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.Juanin && window.Juanin.motor);
    const h2 = await huella();
    comprobar(JSON.stringify(h1) === JSON.stringify(h2) && new Set(h1).size === 3, 'noches ocupadas de ejemplo: siempre las mismas y distintas en cada apartamento');
    // una estancia: La Panera, 5 personas, 3 noches libres en temporada alta
    const est = await p.evaluate(() => {
      const M = window.__motor; Juanin.motor.apartamento('panera'); Juanin.motor.personas(5);
      const libre = (k) => !M.ocupDe('panera').has(k);
      const sum = (k, n) => { const d = new Date(k); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
      for (let k = M.hoy; k < M.limite; k = sum(k, 1)) {
        if (M.esAlta(k) && k.slice(5) !== '12-31' && [0, 1, 2].every((i) => libre(sum(k, i)) && M.esAlta(sum(k, i)) && sum(k, i).slice(5) !== '12-31')) { const ok = Juanin.motor.fechas(k, sum(k, 3)); return { k, ok }; }
      }
      return null;
    });
    const tot = await p.evaluate(() => ({ t: document.querySelector('[data-total]') && document.querySelector('[data-total]').textContent, tramo: !!document.querySelector('.anio .tramo'), seguir: document.querySelector('[data-acc="seguir"]').getAttribute('aria-disabled') }));
    comprobar(est && est.ok && /^381\s?€$/.test(tot.t.replace(/\u00a0/g, ' ')) && tot.tramo && tot.seguir === 'false', 'La Panera, 5 personas, 3 noches de nieve: 3 × 115 + 3 × 12 de supletoria = 381 €, con el tramo encendido en la escala del año', { est, tot });
    await p.click('[data-acc="seguir"]');
    await p.fill('#m-nombre', 'Prueba'); await p.fill('#m-correo', 'prueba@example.com'); await p.fill('#m-tel', '600000000'); await p.check('#m-ok');
    await p.click('#motor-form [type="submit"]');
    const loc = await p.evaluate(() => document.getElementById('motor-loc') && document.getElementById('motor-loc').textContent);
    comprobar(new RegExp('^JUANIN-' + est.k.slice(2).replace(/-/g, '') + '-P$').test(loc || ''), 'localizador JUANIN-AAMMDD-P', loc);
    comprobar(await p.evaluate(() => /no se ha enviado ni guardado nada/.test(document.getElementById('motor').textContent) && /no se envía ni se guarda nada/i.test(document.querySelector('.demo').textContent)), 'marcado como demostración: no se envía ni se guarda nada');
    comprobar(await p.evaluate(() => /669 75 02 09/.test(document.getElementById('real-tit').parentElement.textContent) && /985 487 417/.test(document.getElementById('real-tit').parentElement.textContent)), '«Reserva real»: los dos teléfonos');
    // «el que esté libre»: con 5 personas solo La Panera o El Capitán
    const libre = await p.evaluate(() => {
      const M = window.__motor; Juanin.motor.apartamento('libre'); Juanin.motor.personas(5);
      const sum = (k, n) => { const d = new Date(k); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
      for (let k = sum(M.hoy, 20); k < M.limite; k = sum(k, 1)) { const a = M.aptoPara(k, sum(k, 2)); if (a) { Juanin.motor.fechas(k, sum(k, 2)); return a.id; } }
      return null;
    });
    comprobar(libre === 'panera' || libre === 'capitan', '«El que esté libre» con 5 personas asigna La Panera o El Capitán', libre);
    // mínimo de noches con clics de verdad
    await p.evaluate(() => { Juanin.motor.borrar(); Juanin.motor.apartamento('salao'); Juanin.motor.personas(2); });
    const dias = await p.$$eval('.motor__meses .dia:not([aria-disabled="true"])', (b) => b.map((x) => x.dataset.k));
    let par = null;
    for (let i = 0; i < dias.length - 1; i++) { const a = new Date(dias[i]), b = new Date(dias[i + 1]); if ((b - a) / 864e5 === 1) { par = [dias[i], dias[i + 1]]; break; } }
    await p.click(`[data-k="${par[0]}"]`); await p.click(`[data-k="${par[1]}"]`);
    comprobar(/mínima es de 2 noches/.test(await p.textContent('#motor')), 'una sola noche: «La estancia mínima es de 2 noches»');
    // los meses de la escala mueven el calendario
    const mesB = await p.$$eval('.anio__meses button', (b) => b.map((x) => x.dataset.mes));
    await p.click(`.anio__meses [data-mes="${mesB[5]}"]`);
    comprobar(await p.evaluate((m) => document.querySelector(`.anio__meses [data-mes="${m}"]`).getAttribute('aria-current') === 'true' && Juanin.motor.estado.paso === 'fechas', mesB[5]), 'la escala del año: pulsar un mes lleva el calendario a ese mes');

    /* cookies (los cuatro pasos) */
    const pc = await pagina(ctx, PAG, false);
    await pc.evaluate((k) => localStorage.removeItem(k), LLAVE); await pc.reload({ waitUntil: 'load' });
    comprobar(await pc.isVisible('#cookies'), 'cookies: contexto limpio → se ve el aviso');
    await pc.click('#ck-si');
    comprobar(!(await pc.isVisible('#cookies')) && (await pc.evaluate((k) => localStorage.getItem(k), LLAVE)) === 'si', 'cookies: «Entendido» lo cierra y guarda la marca');
    await pc.reload({ waitUntil: 'load' });
    comprobar(!(await pc.isVisible('#cookies')), 'cookies: al recargar ya no sale');
    await pc.evaluate((k) => localStorage.removeItem(k), LLAVE); await pc.reload({ waitUntil: 'load' });
    comprobar(await pc.isVisible('#cookies'), 'cookies: borrando la marca vuelve a salir');
    await pc.close();

    /* mapa a petición */
    comprobar(await p.evaluate(() => !document.querySelector('#mapa iframe')), 'el mapa de Google no se carga solo');
    await p.click('#mapa-btn');
    comprobar(await p.evaluate(() => { const f = document.querySelector('#mapa iframe'); return !!f && /output=embed/.test(f.src) && /Collanzo/.test(decodeURIComponent(f.src)); }), 'al pulsar «Ver el mapa»: el iframe de Google con la casa');

    /* visor por nombre */
    await p.evaluate(() => Juanin.visor.abrir(['panera-salon', 'salao-cocina', 'capitan-ventana'], 'salao-cocina'));
    comprobar(await p.evaluate(() => document.getElementById('visor').open && document.getElementById('visor-img').dataset.nombre === 'salao-cocina'), 'visor: se abre por NOMBRE (salao-cocina)');
    await p.keyboard.press('Escape');

    /* foco con forma propia */
    await p.evaluate(() => scrollTo(0, 0));
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    await p.waitForTimeout(60);
    const foco = await p.evaluate(() => { const m = document.getElementById('foco-marca'), el = document.activeElement, r = el.getBoundingClientRect(), q = m.getBoundingClientRect(); return { vis: m.classList.contains('es-visible'), w: Math.round(q.width), ew: Math.round(r.width), h: Math.round(q.height), debajo: q.top >= r.bottom, bg: getComputedStyle(m).backgroundColor, antes: getComputedStyle(m, '::before').height }; });
    comprobar(foco.vis && foco.h === 2 && foco.debajo && Math.abs(foco.w - Math.max(16, foco.ew)) <= 1 && foco.antes === '8px', 'foco: subrayado de 2 px bajo el elemento, de su ancho, con la muesca', foco);

    /* contraste (WCAG 2; el alfa se compone sobre el fondo) */
    await p.evaluate(() => scrollTo(0, 900)); await p.waitForTimeout(200);   // la cabecera se mide con su cristal (al bajar)
    const contrastes = await p.evaluate(() => {
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const cv = document.createElement('canvas').getContext('2d');
      const rgba = (s) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = s; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
      const sobre = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3]));
      const fondo = (el) => { const capas = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { capas.push(c); if (c[3] >= 1) break; } } let r = [241, 238, 231]; for (let i = capas.length - 1; i >= 0; i--) r = sobre(capas[i], r); return r; };
      const ratio = (el, colorProp = 'color') => { const f = fondo(el); const t = sobre(rgba(getComputedStyle(el)[colorProp]), f); const a = lum(t), b = lum(f); return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100; };
      const casos = [
        ['.portada__baj', 4.5], ['.portada__tit', 4.5], ['.casa__historia', 4.5], ['.ficha__cifras dt', 4.5], ['.ficha__cifras small', 4.5], ['.ficha__cifras .cifra', 3], ['.comun span', 4.5], ['.ficha__cond dt', 4.5], ['.trato__pie', 4.5], ['.sec-cab__txt', 4.5],
        ['.planta-ficha__historia', 4.5], ['.planta-ficha dt', 4.5], ['.planta-ficha h3', 4.5], ['.demo', 4.5], ['.saber__lista', 4.5], ['.sup', 4.5], ['.enlace', 4.5], ['.motor__eti', 4.5], ['.dsem', 4.5], ['.dia.pasado', 4.5], ['.dia.ocupado', 4.5], ['.dia:not(.pasado):not(.ocupado)', 4.5], ['.sintonia__apt', 4.5], ['.fechas small', 4.5], ['.sintonia .motor__fino', 4.5], ['.desglose .nada', 4.5],
        ['.btn--luz', 4.5], ['.btn--tinta', 4.5], ['.notas i', 4.5], ['.notas .cifra', 3], ['.frases', 4.5], ['.opiniones__fuente', 4.5], ['.distancias__fuente', 4.5], ['.llegar__vias dd', 4.5], ['.map-consent p', 4.5], ['.pie__h', 4.5], ['.pie__legal a', 4.5], ['.pie__lema', 4.5], ['.pie__logo figcaption', 4.5], ['.marca__sub', 4.5], ['.puerto__fuente', 4.5],
      ];
      const r = [];
      for (const [s, min] of casos) { const el = document.querySelector(s); if (!el) continue; r.push([s, ratio(el), min]); }   // si la pieza no está (la cambió un módulo), no se mide
      // la marca del foco sobre marfil: ≥ 3:1 (no texto)
      const m = document.getElementById('foco-marca'); m.style.setProperty('--foco', getComputedStyle(document.querySelector('.sup-marfil')).getPropertyValue('--foco'));
      const fm = lum(rgba(getComputedStyle(m).backgroundColor)), fb = lum([241, 238, 231]);
      r.push(['foco sobre marfil', Math.round(((Math.max(fm, fb) + 0.05) / (Math.min(fm, fb) + 0.05)) * 100) / 100, 3]);
      return r;
    });
    const malos = contrastes.filter(([, v, min]) => v < min);
    comprobar(malos.length === 0, `contraste medido en ${contrastes.length} sitios (texto ≥ 4,5:1; cifras grandes y foco ≥ 3:1)`, malos);
    nota('contrastes: ' + contrastes.map(([s, v]) => `${s} ${v}`).join(' · '));
    const ambarMarfil = await p.evaluate(() => { const malos = []; document.querySelectorAll('.sup-marfil *').forEach((el) => { if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return; if (el.closest('.sup-noche, [data-modulo]')) return; const c = getComputedStyle(el).color; if (c === 'rgb(242, 169, 59)') malos.push(el.className || el.tagName); }); return malos; });
    comprobar(ambarMarfil.length === 0, 'el ámbar puro nunca es texto sobre marfil', ambarMarfil.slice(0, 5));
    await ctx.close();
  }

  /* ================= 3. densidades: sin ?revision no hay mando; la sobria añade la tabla ================= */
  if (toca(3)) {
    console.log('\n3. Densidades y mando');
    const ctx = await contexto();
    const p = await pagina(ctx);
    comprobar(await p.evaluate(() => { const m = document.getElementById('mando'); return m.hidden && getComputedStyle(m).display === 'none' && getComputedStyle(document.getElementById('vistazo')).display === 'none'; }), 'sin ?revision: el mando oculto (display:none) y sin la tabla');
    const ps = await pagina(ctx, BASE + 'index.html?sin-webgl&revision&densidad=sobria');
    const s = await ps.evaluate(() => ({ mando: !document.getElementById('mando').hidden, sobria: document.documentElement.classList.contains('densidad-sobria'), tabla: getComputedStyle(document.getElementById('vistazo')).display !== 'none', filas: [...document.querySelectorAll('.vistazo__tabla tbody tr')].map((tr) => tr.textContent.replace(/\s+/g, ' ').trim()) }));
    comprobar(s.mando && s.sobria && s.tabla && s.filas.length === 3, 'con ?revision&densidad=sobria: el mando, la sobria y «Los tres, de un vistazo»', s);
    comprobar(DATOS.apartamentos.every((a, i) => s.filas[i].includes(a.nombre) && s.filas[i].includes(a.plazas.texto) && s.filas[i].includes(a.planta_texto)) && s.filas.every((f) => /supuesto/.test(f) && /85 €/.test(f)), 'la tabla: planta, plazas, dormitorios, baño y precio supuesto, de apartamentos.json');
    await ps.click('#mando [data-densidad="sintonia"]');
    comprobar(await ps.evaluate(() => !document.documentElement.classList.contains('densidad-sobria') && getComputedStyle(document.getElementById('vistazo')).display === 'none' && !/densidad=/.test(location.search)), 'el mando vuelve a «Sintonía» en vivo');
    await ps.click('#mando [data-densidad="sobria"]');
    if (HAY.radio) comprobar(await ps.evaluate(() => document.querySelector('[data-modulo="radio"]').dataset.montado === '1'), 'al cambiar de densidad, Radio se vuelve a montar');
    await ctx.close();
  }

  /* ================= 4. móvil: sin scroll lateral, portada sin pisarse, menú, barra del móvil ================= */
  if (toca(4)) {
    console.log('\n4. Móvil');
    for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
      const ctx = await contexto({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      const p = await pagina(ctx);
      await recorrer(p, 600);
      const r = await p.evaluate(() => {
        const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
        const anchos = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.vistazo__marco, dialog, .menu-movil'); }).slice(0, 4).map((e) => e.className || e.tagName);
        const t = document.querySelector('.portada-texto').getBoundingClientRect(), m = document.querySelector('[data-modulo="radio"] .radio-escala, [data-modulo="radio"] .radio-respaldo__escala').getBoundingClientRect();
        return { sw, cw, anchos, pisa: t.bottom > m.top + 1 && t.top < m.bottom - 1, t: [Math.round(t.top), Math.round(t.bottom)], m: [Math.round(m.top), Math.round(m.bottom)] };
      });
      comprobar(r.sw <= r.cw && r.anchos.length === 0, `${w}×${h}: sin scroll lateral`, r);
      if (w < 900) comprobar(!r.pisa, `${w}×${h}: el texto de la portada no pisa la escala`, r);
      await ctx.close();
    }
    const ctx = await contexto({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await pagina(ctx);
    await p.mouse.wheel(0, 1200); await p.waitForTimeout(200);
    await p.tap('#menu-btn');
    const menu = await p.evaluate(() => { const m = document.getElementById('menu-movil'), r = m.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top), ih: innerHeight, vis: getComputedStyle(m).visibility, blur: getComputedStyle(m).backdropFilter }; });
    comprobar(menu.vis === 'visible' && menu.top === 0 && Math.abs(menu.h - menu.ih) <= 1 && /blur/.test(menu.blur), 'menú móvil con la cabecera ya fija: toda la pantalla y con blur', menu);
    await p.tap('.menu-movil a[href="#reservar"]'); await p.waitForTimeout(300);
    comprobar(await p.evaluate(() => !document.body.classList.contains('menu') && Math.abs(document.getElementById('reservar').getBoundingClientRect().top) < 140), 'un enlace del menú cierra el menú y lleva a su sección');
    const toques = await p.evaluate(() => ['#menu-btn', '.aptos button', '.pers button', '.motor__nav', '.anio__meses button'].map((s) => { const e = document.querySelector(s); if (!e || !e.offsetParent && s !== '#ck-si') return [s, 'no visible']; const r = e.getBoundingClientRect(); return [s, Math.round(r.width), Math.round(r.height)]; }).filter((x) => x[1] !== 'no visible' && (x[0] === '.anio__meses button' ? x[1] < 24 || x[2] < 32 : x[1] < 44 || x[2] < 44)));
    comprobar(toques.length === 0, 'zonas táctiles: 44 px (los meses de la escala, contiguos: 24 × 32, WCAG 2.5.8)', toques);
    // la barra del móvil: cambiar el alto no rehace nada ni mueve la página
    await p.addStyleTag({ content: ':root { --svh-fijo: 844px; } .portada { min-height: 0 !important; }' });
    await p.evaluate(() => { window.__res = 0; document.addEventListener('juanin:resize', () => window.__res++); scrollTo(0, document.getElementById('apartamentos').offsetTop); });
    await p.waitForTimeout(150);
    const antes = await p.evaluate(() => [document.getElementById('reservar').getBoundingClientRect().top, scrollY]);
    for (let i = 0; i < 6; i++) { await p.setViewportSize({ width: 390, height: i % 2 ? 844 : 900 }); await p.waitForTimeout(260); }
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
    const despues = await p.evaluate(() => [document.getElementById('reservar').getBoundingClientRect().top, scrollY, window.__res]);
    comprobar(despues[2] === 0 && Math.abs(despues[0] - antes[0]) <= 1, 'la barra del móvil (6 cambios de alto): ningún «juanin:resize» y nada se mueve', { antes, despues });
    await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(400);
    comprobar(await p.evaluate(() => window.__res) > 0, 'al girar el móvil sí se rehace');
    await ctx.close();
  }

  /* ================= 5. recargar a media página, respaldos, quitable y legales ================= */
  if (toca(5)) {
    console.log('\n5. Recarga, respaldos, puerto quitable y legales');
    const ctx = await contexto();
    const p = await pagina(ctx);
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(40); }
    comprobar(await p.evaluate(() => scrollY) > 1500, 'bajado más de 1500 px con la rueda');
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
    comprobar(await p.evaluate(() => scrollY) === 0, 'recargar a media página vuelve arriba (checklist 12)');
    await p.close();

    // sin el JS de los módulos: se quedan los respaldos
    const ctx2 = await contexto();
    await ctx2.route(/\/js\/(radio|plantas|nieve)\.js/, (r) => r.abort());
    const q = await pagina(ctx2);
    await recorrer(q);
    const resp = await q.evaluate(() => ({
      escala: !!document.querySelector('[data-modulo="radio"] .radio-escala') && document.querySelectorAll('[data-modulo="radio"] .radio-emisora').length === 4 && !!document.querySelector('[data-modulo="radio"] .radio-emisora.es-hoy'),
      foto: !!document.querySelector('[data-modulo="radio"] .radio-foto img'),
      fichas: [...document.querySelectorAll('.planta-ficha')].map((a) => [a.id, a.querySelector('[data-plazas]').dataset.plazas]),
      puerto: !!document.querySelector('.puerto-respaldo img') && /Fuentes de Invierno/.test(document.querySelector('.puerto-respaldo').textContent),
    }));
    comprobar(resp.escala && resp.foto, 'sin radio.js: el respaldo de Radio, la escala quieta con sus cuatro emisoras, la de hoy marcada, y la fachada', resp);
    comprobar(JSON.stringify(resp.fichas) === JSON.stringify(DATOS.apartamentos.map((a) => ['ficha-' + a.id, String(a.plazas.max)])), 'sin plantas.js: las tres fichas con las plazas de apartamentos.json', resp.fichas);
    comprobar(resp.puerto, 'sin nieve.js: la foto del monte y los minutos a las estaciones');
    await q.click('#ficha-salao [data-reservar]'); await q.waitForTimeout(150);
    comprobar(await q.evaluate(() => Juanin.motor.estado.apartamento === 'salao'), '«Reservar este» del respaldo preselecciona su apartamento');
    await ctx2.close();

    // el puerto es quitable: sin la sección, nada más cambia
    const ctx3 = await contexto();
    await ctx3.route(/\/index\.html(\?.*)?$/, async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace(/<section id="puerto"[\s\S]*?<\/section>/, '').replace(/[ \t]*<(link|script)[^>]*nieve\.(css|js)[^>]*>(<\/script>)?\n?/g, '') }); });
    const n = errores.length;
    const sp = await pagina(ctx3);
    await recorrer(sp);
    const sin = await sp.evaluate(() => ({ nav: [...document.querySelectorAll('.cab__nav a, .menu-movil a')].some((a) => a.getAttribute('href') === '#puerto'), secs: ['portada', 'casa', 'apartamentos', 'reservar', 'opiniones', 'llegar'].every((id) => document.getElementById(id)) }));
    comprobar(!sin.nav && sin.secs && errores.length === n, 'sin el módulo del puerto: se van sus enlaces, el resto igual y sin errores', sin);
    await ctx3.close();

    // legales y 404
    const ctx4 = await contexto();
    for (const f of ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', '404']) {
      const lp = await ctx4.newPage();
      lp.on('pageerror', (e) => errores.push(`${f}: ${e.message}`));
      await lp.goto(BASE + f + '.html');
      const t = await lp.evaluate(() => ({ h1: document.querySelector('h1').textContent, sw: document.documentElement.scrollWidth <= innerWidth + 1, txt: document.body.textContent }));
      comprobar(t.h1 && t.sw, `${f}.html se abre, con titular y sin scroll lateral`);
      if (f === 'cookies') comprobar(/Google Fonts/.test(t.txt) && /Google Maps/.test(t.txt) && /Open-Meteo/.test(t.txt) && /jsDelivr/.test(t.txt) && /juanin-cookies/.test(t.txt), 'cookies.html cita Google Fonts, el mapa de Google, Open-Meteo, jsDelivr y la marca juanin-cookies');
      if (f === 'aviso-legal') comprobar(/AT0510/.test(t.txt) && /por confirmar/.test(t.txt) && !/mailto:info@/.test(await lp.content()), 'aviso legal: AT0510, titular por confirmar y sin el correo del dominio caducado');
      await lp.close();
    }
    await ctx4.close();
  }

  /* ================= 6. movimiento (una sola vez, al final) ================= */
  if (toca(6)) {
    console.log('\n6. Movimiento (una vez)');
    const ctx = await contexto({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', isMobile: true, hasTouch: true });
    const p = await pagina(ctx);
    comprobar(await p.evaluate(() => document.documentElement.classList.contains('con-movimiento')), 'con movimiento: html.con-movimiento');
    for (let pasada = 0; pasada < 2; pasada++) {
      const n = await p.evaluate(() => document.querySelectorAll('[data-revela]').length);
      for (let i = 0; i < n; i++) { await p.evaluate((i) => document.querySelectorAll('[data-revela]')[i].scrollIntoView({ block: 'center' }), i); await p.waitForTimeout(120); }
    }
    const sinVer = await p.evaluate(() => [...document.querySelectorAll('[data-revela]')].filter((h) => !h.classList.contains('es-visto')).map((h) => h.id || h.className));
    comprobar(sinVer.length === 0, 'todos los titulares que suben al entrar llegan a verse (checklist 13, en móvil)', sinVer);
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log('\nErrores de la página: ' + (errores.length ? '\n  ' + [...new Set(errores)].join('\n  ') : 'ninguno'));
if (errores.length) fallos.push('errores en la consola');
console.log(`\n${nOk} bien, ${fallos.length} mal${fallos.length ? ':\n - ' + fallos.join('\n - ') : ''}`);
process.exitCode = fallos.length ? 1 : 0;
