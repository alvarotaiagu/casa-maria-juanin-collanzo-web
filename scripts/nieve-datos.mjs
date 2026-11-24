// Reúne en ref/raw/nieve.json todo lo que la escena del puerto necesita de OpenStreetMap y de Open-Meteo:
//  - lugares (casa, Collanzo, las dos estaciones, el puerto) con su objeto OSM,
//  - remontes y pistas (geometría simplificada) y la carretera de la casa al puerto (traza de OSRM),
//  - una muestra de Open-Meteo con su fecha (la web vuelve a pedirla en vivo; esto es solo la referencia).
// Antes: node scripts/nieve-osm.mjs y node scripts/nieve-rutas.mjs. Uso: node scripts/nieve-datos.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UA, overpass } from './nieve-lib.mjs';
const R = join(dirname(fileURLToPath(import.meta.url)), '..');
const osm = JSON.parse(readFileSync(join(R, 'ref/raw/osm-puerto.json'), 'utf8'));
const rutas = JSON.parse(readFileSync(join(R, 'ref/raw/rutas.json'), 'utf8'));
const traza = JSON.parse(readFileSync(join(R, 'ref/raw/ruta-puerto.json'), 'utf8')).geometria.coordinates;
const por = (tipo, id) => osm.elementos.find((e) => e.type === tipo && e.id === id);
const centro = (e) => e.center ? [e.center.lat, e.center.lon] : [e.lat, e.lon];
// --- coteja nombre y tipo de lo que se usa (memoria feedback_termino_osm_emparejado_malo) ---
const reg = por('way', 13424356), collanzo = por('node', 2371382777), puerto = por('node', 4416677341);
if (!(reg?.tags.landuse === 'winter_sports' && /Fuentes de Invierno/.test(reg.tags.name))) throw new Error('Fuentes de Invierno: no coincide');
if (!(collanzo?.tags.place === 'hamlet' && /Co[lḷ]+anzo/.test(collanzo.tags.name))) throw new Error('Collanzo: no coincide');
if (!(puerto?.tags.natural === 'saddle' && puerto.tags.ele === '1521')) throw new Error('Puerto: no coincide');
const sectores = [194973300, 178706604, 808834228].map((id) => por('way', id));
if (sectores.some((s) => !s || s.tags.landuse !== 'winter_sports' || !/San Isidro/.test(s.tags.name))) throw new Error('San Isidro: sectores no coinciden');
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sanIsidro = [media(sectores.map((s) => s.center.lat)), media(sectores.map((s) => s.center.lon))];
const fuentes = centro(reg);
const lugares = {
  casa: { nombre: 'Casa María Juanín', lat: rutas.origen.lat, lon: rutas.origen.lon, osm: 'GPS de ref/DATOS-CASA-MARIA-JUANIN.md' },
  collanzo: { nombre: 'Collanzo', lat: centro(collanzo)[0], lon: centro(collanzo)[1], osm: 'node/2371382777' },
  fuentes: { nombre: 'Fuentes de Invierno', lat: fuentes[0], lon: fuentes[1], osm: 'way/13424356', nota: 'Centro de la estación (landuse=winter_sports, OSM)' },
  sanisidro: { nombre: 'San Isidro', lat: sanIsidro[0], lon: sanIsidro[1], osm: 'way/194973300+178706604+808834228', nota: 'Media de los centros de sus tres sectores (Saliencias, Cebolledo-Requejines y Riopinos), operados por la Diputación de León' },
  puerto: { nombre: 'Puerto de San Isidro', lat: centro(puerto)[0], lon: centro(puerto)[1], osm: 'node/4416677341', ele: 1521 },
};
// --- remontes y pistas con geometría ---
const q = `[out:json][timeout:60];(way["aerialway"~"^(chair_lift|platter|magic_carpet|gondola|drag_lift|t-bar|j-bar)$"](43.025,-5.43,43.075,-5.36);way["piste:type"="downhill"](43.025,-5.43,43.075,-5.36););out geom tags;`;
const g = await overpass(q);
const dp = (pts, eps) => {            // Douglas-Peucker en grados × metros aproximados
  if (pts.length < 3) return pts;
  const k = [111320 * Math.cos(43.05 * Math.PI / 180), 110950], d2 = (p, a, b) => {
    const [x, y] = [(p[0] - a[0]) * k[0], (p[1] - a[1]) * k[1]], [dx, dy] = [(b[0] - a[0]) * k[0], (b[1] - a[1]) * k[1]], l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, (x * dx + y * dy) / l)) : 0; return Math.hypot(x - t * dx, y - t * dy);
  };
  let m = 0, im = 0; for (let i = 1; i < pts.length - 1; i++) { const d = d2(pts[i], pts[0], pts[pts.length - 1]); if (d > m) { m = d; im = i; } }
  return m > eps ? [...dp(pts.slice(0, im + 1), eps).slice(0, -1), ...dp(pts.slice(im), eps)] : [pts[0], pts[pts.length - 1]];
};
const r5 = (p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
const remontes = [], pistas = [];
for (const e of g.elementos) {
  const pts = dp((e.geometry || []).map((p) => [p.lon, p.lat]), 6).map(r5);
  if (pts.length < 2) continue;
  if (e.tags.aerialway) remontes.push({ id: e.id, nombre: e.tags.name || null, tipo: e.tags.aerialway, pts });
  else pistas.push({ id: e.id, nombre: e.tags.name || e.tags['piste:name'] || null, dificultad: e.tags['piste:difficulty'] || null, pts });
}
const carretera = dp(traza.map((p) => [p[0], p[1]]), 12).map(r5);
// --- una muestra de Open-Meteo, con su fecha ---
const om = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${fuentes[0].toFixed(4)},${sanIsidro[0].toFixed(4)}&longitude=${fuentes[1].toFixed(4)},${sanIsidro[1].toFixed(4)}&current=temperature_2m,snow_depth,snowfall,freezing_level_height,snowfall_height&timezone=Europe%2FMadrid`, { headers: { 'User-Agent': UA } }).then((r) => r.json());
const salida = {
  fuente: 'OpenStreetMap (ODbL) vía Overpass y OSRM; Open-Meteo (CC BY 4.0) para la muestra del tiempo',
  fecha: new Date().toISOString(), espejoOverpass: osm.espejo,
  lugares, carretera, remontes, pistas,
  openMeteoMuestra: { nota: 'Muestra al ejecutar este script. La web la pide de nuevo en cada visita.', datos: om },
};
writeFileSync(join(R, 'ref/raw/nieve.json'), JSON.stringify(salida));
console.log('lugares', Object.keys(lugares), '| remontes', remontes.length, '| pistas', pistas.length, '| carretera', carretera.length, 'pts');
console.log(JSON.stringify(om).slice(0, 700));
