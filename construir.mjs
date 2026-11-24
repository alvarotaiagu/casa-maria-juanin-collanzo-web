/* Genera las páginas a partir de sus fuentes *.src.html (la arquitectura de A Palleira):
   0. Lanza scripts/radio-construir.mjs (Radio): data/emisoras.json con los minutos de OSRM e img/radio/respaldo.html.
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo (si no existe, un comentario y la web sigue).
   2. <!--gen:...--> → lo que sale de los datos, para que haya UNA sola fuente:
        plantas-respaldo  las tres fichas de los apartamentos (data/apartamentos.json)
        vistazo           la tabla «Los tres, de un vistazo» de la sobria (data/apartamentos.json)
        puerto-minutos    los minutos a las dos estaciones (ref/raw/rutas.json, de Nieve con OSRM)
        distancias        las distancias de «Cómo llegar» (ref/raw/rutas.json)
      y la frase de la portada «a … minutos de Fuentes de Invierno y San Isidro» se ajusta a OSRM (manda OSRM).
      Sin rutas.json, sin cifras: no se inventa ninguna.
   3. <img data-foto="nombre" ...> → <picture> con AVIF, WebP y JPG en todos los anchos de img/fotos/fotos.json.
   4. Los <link> y <script> de CSS/JS propios que aún no existen (los módulos de otros agentes) se quitan con un aviso.
   5. Ejecuta versionar.mjs para poner ?v=<huella> a CSS y JS.
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
// Radio: los minutos de data/emisoras.json (de OSRM) y el respaldo de la escala (img/radio/respaldo.html), antes de las partes
if (fs.existsSync(path.join(RAIZ, 'scripts/radio-construir.mjs'))) execFileSync(process.execPath, [path.join(RAIZ, 'scripts/radio-construir.mjs')], { stdio: 'inherit' });
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
const FOTOS = new Map(leerJson('img/fotos/fotos.json').map((f) => [f.nombre, f]));
const DATOS = leerJson('data/apartamentos.json');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}

/* ---------- rutas de OSRM (Nieve): ref/raw/rutas.json ---------- */
const RUTAS = (() => {
  const f = path.join(RAIZ, 'ref/raw/rutas.json');
  if (!fs.existsSync(f)) { console.warn('  (sin ref/raw/rutas.json: sin minutos ni distancias)'); return null; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  let d = j.destinos || j.rutas || {};
  if (Array.isArray(d)) d = Object.fromEntries(d.map((x) => [x.id || x.clave || x.nombre, x]));
  const norm = {};
  for (const [k, x] of Object.entries(d)) {
    const km = x.km ?? x.distancia_km ?? (x.metros != null ? x.metros / 1000 : null);
    const min = x.min ?? x.minutos ?? (x.segundos != null ? Math.round(x.segundos / 60) : null);
    if (km != null && min != null) norm[k] = { nombre: x.nombre || k, km, min };
  }
  return { destinos: norm, fecha: j.fecha || '', fuente: j.fuente || 'OSRM sobre OpenStreetMap', aviso: j.aviso || '' };
})();
const num = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const tiempo = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');
const fechaLarga = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]} de ${y}`; };
const ruta = (k) => (RUTAS && RUTAS.destinos[k]) || null;
const FUENTE_RUTAS = () => `Tiempos y kilómetros por carretera desde la casa: OSRM sobre datos de OpenStreetMap (© colaboradores de OpenStreetMap), ${fechaLarga(RUTAS.fecha)}. Sin tráfico, nieve ni cadenas: orientativos.`;

const GEN = {
  'plantas-respaldo': () => DATOS.apartamentos.map((a) => {
    const foto = a.fotos[0];
    const sup = a.plazas.supuesto ? ' <span class="sup">por confirmar</span>' : '';
    return `<article class="planta-ficha" id="ficha-${a.id}" aria-labelledby="ficha-${a.id}-t">
          <img data-foto="${foto.nombre}" alt="${esc(foto.alt)}" sizes="(max-width: 899px) 92vw, 30vw">
          <p class="planta-ficha__planta">${a.planta_texto}</p>
          <h3 id="ficha-${a.id}-t">${esc(a.nombre)}</h3>
          <p class="planta-ficha__historia">${esc(a.historia)}</p>
          <dl>
            <dt>Plazas</dt><dd><span data-plazas="${a.plazas.max}">${esc(a.plazas.texto)}</span>${sup}</dd>
            <dt>Dormir</dt><dd>${esc(a.dormitorios.texto)}</dd>
            <dt>Baño</dt><dd>${esc(a.bano)}</dd>
            <dt>Lo suyo</dt><dd>${esc(a.lo_suyo)}</dd>
          </dl>
          <button type="button" class="btn btn--tinta" data-reservar="${a.id}">Reservar este</button>
        </article>`;
  }).join('\n        '),
  vistazo: () => {
    const t = DATOS.tarifas;
    const filas = DATOS.apartamentos.map((a) => `<tr><th scope="row">${esc(a.nombre)}</th><td>${a.planta_texto}</td><td>${esc(a.plazas.texto)}${a.plazas.supuesto ? ' <span class="sup">supuesto</span>' : ''}</td><td>${esc(a.dormitorios.texto)}</td><td>${esc(a.bano)}</td><td class="mono">${t.baja} € · ${t.alta} € en nieve <span class="sup">supuesto</span></td></tr>`).join('\n            ');
    return `<thead><tr><th scope="col">Apartamento</th><th scope="col">Planta</th><th scope="col">Plazas</th><th scope="col">Dormitorios</th><th scope="col">Baño</th><th scope="col">Precio orientativo por noche</th></tr></thead>
          <tbody>
            ${filas}
          </tbody>`;
  },
  'puerto-minutos': () => {
    const f = ruta('fuentes-de-invierno'), s = ruta('san-isidro');
    if (!f || !s) return '';
    return `<ul class="minutos">
            <li><b>${f.min}<small>min</small></b><span>a Fuentes de Invierno · ${num(f.km)} km</span></li>
            <li><b>${s.min}<small>min</small></b><span>a la estación de San Isidro · ${num(s.km)} km</span></li>
          </ul>
          <p class="puerto__fuente mono">${FUENTE_RUTAS()}</p>`;
  },
  distancias: () => {
    if (!RUTAS) return '';
    const orden = [['fuentes-de-invierno', 'Fuentes de Invierno'], ['san-isidro', 'Estación de San Isidro'], ['mieres', 'Mieres'], ['oviedo', 'Oviedo'], ['gijon', 'Gijón'], ['aeropuerto', 'Aeropuerto de Asturias'], ['leon', 'León']];
    const li = orden.map(([k, n]) => { const r = ruta(k); return r ? `<li><b>${n}</b><span>${tiempo(r.min)} · ${num(r.km)} km</span></li>` : ''; }).filter(Boolean);
    return `<ul class="distancias">${li.join('')}</ul>
          <p class="distancias__fuente mono">${FUENTE_RUTAS()}</p>`;
  },
};

// «a quince minutos» es lo que dice la casa; manda OSRM: se redondea a cinco y se escribe con letra
function frasePortada(html) {
  const f = ruta('fuentes-de-invierno'), s = ruta('san-isidro');
  if (!f || !s) return html;
  const m = Math.round(Math.max(f.min, s.min) / 5) * 5;
  const letra = { 10: 'diez', 15: 'quince', 20: 'veinte', 25: 'veinticinco', 30: 'treinta' }[m];
  if (!letra) return html;
  return html.replace(/a quince minutos de Fuentes de Invierno y San Isidro/g, `a ${letra} minutos de Fuentes de Invierno y San Isidro`);
}

const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, r) => {
  const f = path.join(RAIZ, r);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + r + ')'); return `<!-- sin ${r} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + r);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});
const generados = (html) => html.replace(/<!--gen:([a-z-]+)-->/g, (m, k) => { if (!GEN[k]) throw new Error('Generador desconocido: ' + k); return GEN[k](); });

const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  html = frasePortada(generados(html));
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
