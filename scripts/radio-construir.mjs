/* Agente Radio · prepara los datos y el respaldo de la escala.
     node scripts/radio-construir.mjs            → los dos pasos
     node scripts/radio-construir.mjs --fecha=2026-08-10   → el respaldo marcando la emisora de esa fecha
   1. Minutos a las estaciones: si existe ref/raw/rutas.json (OSRM, agente Nieve), copia a data/emisoras.json
      los minutos de la casa a Fuentes de Invierno y a San Isidro (y quita «provisional»). Si no existe, deja
      los 15 minutos de Turismo Asturias marcados como provisionales.
   2. img/radio/respaldo.html: el respaldo del módulo, para meterlo en index.src.html con
        <div data-modulo="radio"><!--parte:img/radio/respaldo.html--></div>
      Es la escala estática (marcas, números, las cuatro emisoras y la aguja en la emisora del día en que se
      construye), la lectura de esa emisora y la foto de la fachada. Mismas clases que la escala montada, así
      que la rejilla de la portada no cambia al montar. Sin JS, la página se queda con esto. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_EMISORAS = path.join(RAIZ, 'data', 'emisoras.json');
const F_RUTAS = path.join(RAIZ, 'ref', 'raw', 'rutas.json');
const F_RESPALDO = path.join(RAIZ, 'img', 'radio', 'respaldo.html');

const D = JSON.parse(fs.readFileSync(F_EMISORAS, 'utf8'));

/* ---------- 1. minutos ---------- */
function minutosDe(destino) {
  if (!destino || typeof destino !== 'object') return null;
  const cand = [destino.desde_casa && destino.desde_casa.minutos, destino.minutos, destino.min, destino.duracion_min];
  const m = cand.find((x) => typeof x === 'number' && isFinite(x));
  return m == null ? null : Math.round(m);
}
function buscar(rutas, prueba) {
  const lista = Array.isArray(rutas.destinos) ? rutas.destinos.map((x) => [x.id || x.nombre, x])
    : Object.entries(rutas.destinos || rutas);
  const hallados = lista.filter(([k, x]) => x && typeof x === 'object' && prueba(String(k) + ' ' + String(x.nombre || '') + ' ' + String(x.tipo || '')));
  // si hay varias (el puerto y la estación de San Isidro), la que diga estación / esquí
  hallados.sort((a, b) => (/estaci|esqu|ski|pistas/i.test(JSON.stringify(b[1]).slice(0, 400)) ? 1 : 0) - (/estaci|esqu|ski|pistas/i.test(JSON.stringify(a[1]).slice(0, 400)) ? 1 : 0));
  return hallados.length ? hallados[0][1] : null;
}
const nieve = D.emisoras.find((e) => e.id === 'nieve');
if (fs.existsSync(F_RUTAS)) {
  const rutas = JSON.parse(fs.readFileSync(F_RUTAS, 'utf8'));
  const fuentes = buscar(rutas, (t) => /fuentes\s*de\s*invierno|fuentes/i.test(t));
  const isidro = buscar(rutas, (t) => /isidro/i.test(t));
  const mF = minutosDe(fuentes), mS = minutosDe(isidro);
  if (mF != null && mS != null) {
    nieve.dato.destinos = [
      { id: 'fuentes', nombre: 'Fuentes de Invierno', minutos: mF },
      { id: 'sanisidro', nombre: 'San Isidro', minutos: mS }
    ];
    nieve.dato.provisional = false;
    nieve.dato.fuente = (rutas.fuente || 'ref/raw/rutas.json') + (rutas.fecha ? ', ' + rutas.fecha : '');
    console.log(`  minutos de ref/raw/rutas.json: Fuentes de Invierno ${mF}, San Isidro ${mS}`);
  } else console.warn('  ref/raw/rutas.json existe, pero no encuentro los minutos a Fuentes de Invierno y San Isidro: se quedan los de antes');
} else {
  console.warn('  sin ref/raw/rutas.json: 15 minutos de Turismo Asturias, provisionales');
}
fs.writeFileSync(F_EMISORAS, JSON.stringify(D, null, 2) + '\n');

/* ---------- 2. el respaldo ---------- */
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}
function limite(t, y) {
  const mp = /^pascua(?:\s*([+-])\s*(\d+))?$/.exec(t);
  if (mp) { const p = pascua(y); if (mp[1]) p.setDate(p.getDate() + (mp[1] === '-' ? -1 : 1) * Number(mp[2])); return p; }
  const [mm, dd] = t.split('-').map(Number);
  return new Date(y, mm - 1, dd);
}
function deHoy(fecha) {
  for (const e of D.emisoras) {
    const y = fecha.getFullYear(), a = limite(e.meses.desde, y), b = limite(e.meses.hasta, y);
    if (a <= b ? fecha >= a && fecha <= b : fecha >= a || fecha <= b) return e;
  }
  return D.emisoras[0];
}
const arg = process.argv.find((a) => a.startsWith('--fecha='));
const hoyD = arg ? new Date(...arg.slice(8).split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0))) : new Date();
const hoy = deHoy(new Date(hoyD.getFullYear(), hoyD.getMonth(), hoyD.getDate()));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const frec = (p) => (D.escala.desde + p * (D.escala.hasta - D.escala.desde)).toFixed(1).replace('.', ',');

function marcas(clase) {
  const { desde, hasta, paso, medio, mayor } = D.escala;
  const n = Math.round((hasta - desde) / paso), pm = Math.round(medio / paso), pM = Math.round(mayor / paso);
  const alt = [16, 28, 42];
  let s = `<svg class="${clase}" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">`;
  for (let i = 0; i <= n; i++) {
    const t = i % pM === 0 ? 2 : i % pm === 0 ? 1 : 0, x = ((i / n) * 1000).toFixed(2);
    s += `<line x1="${x}" x2="${x}" y1="0" y2="${alt[t]}" class="m${t}" vector-effect="non-scaling-stroke"/>`;
  }
  return s + '</svg>';
}
function numeros() {
  const n = Math.round((D.escala.hasta - D.escala.desde) / D.escala.mayor);
  let s = '<div class="radio-numeros" aria-hidden="true">';
  for (let i = 0; i <= n; i++) s += `<span${i % 2 ? ' class="radio-num-impar"' : ''} style="left:${((i / n) * 100).toFixed(3)}%">${D.escala.desde + i * D.escala.mayor}</span>`;
  return s + '</div>';
}
function cifras(e) {
  const dt = e.dato;
  if (!dt) return '';
  if (dt.tipo === 'minutos') {
    const mins = dt.destinos.map((x) => x.minutos);
    const nota = dt.provisional ? 'en coche, según Turismo Asturias' : 'en coche';
    if (mins.every((m) => m === mins[0])) {
      return `<p class="radio-cifra"><span class="radio-cifra-num">${mins[0]}</span><span class="radio-cifra-ud"> min</span></p>`
        + `<p class="radio-cifra-nota">a ${esc(dt.destinos.map((x) => x.nombre).join(' y '))}, ${nota}</p>`;
    }
    return '<dl class="radio-cifra-filas">' + dt.destinos.map((x) => `<div><dt>${esc(x.nombre)}</dt><dd><span class="radio-cifra-num">${x.minutos}</span><span class="radio-cifra-ud"> min</span></dd></div>`).join('')
      + `</dl><p class="radio-cifra-nota">${nota.charAt(0).toUpperCase() + nota.slice(1)}</p>`;
  }
  return `<p class="radio-cifra radio-cifra-palabra">${esc(dt.valor)}</p>` + (dt.nota ? `<p class="radio-cifra-nota">${esc(dt.nota)}</p>` : '');
}
const foto = D.casa.foto;
const TAM = '(min-width: 1024px) 300px, (min-width: 700px) 34vw, calc(100vw - 32px)';
const srcset = (ext) => foto.anchos.map((w) => `img/fotos/${foto.nombre}-${w}.${ext} ${w}w`).join(', ');
const html = `<!-- Respaldo de la escala (lo genera scripts/radio-construir.mjs; no se edita a mano).
     Emisora marcada: ${hoy.nombre} (la del día en que se construyó). radio.js lo sustituye al montar y reaprovecha la foto. -->
<div class="radio-escala">
  <div class="radio-cristal">
    <div class="radio-pista">
      ${marcas('radio-marcas')}
      ${numeros()}
      <ul class="radio-emisoras" aria-label="Las épocas del año en Collanzo" style="list-style:none;margin:0;padding:0">
${D.emisoras.map((e) => `        <li class="radio-emisora${e.id === hoy.id ? ' es-hoy' : ''}" style="left:${(e.posicion * 100).toFixed(2)}%"><span class="radio-lampara" aria-hidden="true"></span><span class="radio-nombre-em">${esc(e.nombre)}</span><span class="radio-frec" aria-hidden="true">${frec(e.posicion)}</span></li>`).join('\n')}
      </ul>
      <span class="radio-aguja" aria-hidden="true" style="left:${(hoy.posicion * 100).toFixed(2)}%"></span>
    </div>
  </div>
</div>
<div class="radio-lectura">
  <p class="radio-rotulo"><span class="radio-rotulo-txt">Cuatro épocas en Collanzo</span></p>
  <div class="radio-sintonia">
    <p class="radio-nombre">${esc(hoy.nombre)}</p>
    <p class="radio-texto">${esc(hoy.texto)}</p>
    <div class="radio-cifras">${cifras(hoy)}</div>
  </div>
</div>
<figure class="radio-foto">
  <div class="radio-marco">
    <picture>
      <source type="image/avif" srcset="${srcset('avif')}" sizes="${TAM}">
      <source type="image/webp" srcset="${srcset('webp')}" sizes="${TAM}">
      <img src="img/fotos/${foto.nombre}-800.jpg" srcset="${srcset('jpg')}" sizes="${TAM}" width="${foto.ancho}" height="${foto.alto}" alt="${esc(foto.alt)}" decoding="async">
    </picture>
  </div>
  <figcaption class="radio-pie-foto">${esc(foto.pie)}</figcaption>
</figure>
`;
fs.mkdirSync(path.dirname(F_RESPALDO), { recursive: true });
fs.writeFileSync(F_RESPALDO, html);
console.log(`  img/radio/respaldo.html: emisora marcada ${hoy.nombre} (${hoyD.toISOString().slice(0, 10)})`);
