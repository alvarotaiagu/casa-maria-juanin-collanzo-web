// Distancias y minutos por carretera desde la casa con OSRM (servidor público de demostración, perfil de coche).
// Escribe ref/raw/rutas.json (lo usan Web y Radio) y la traza de la ruta a las estaciones en ref/raw/ruta-puerto.json.
// Los minutos son de OSRM, SIN tráfico, nieve ni cadenas: son orientativos. Mandan sobre lo que dicen las fichas.
// Uso: node scripts/nieve-rutas.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UA } from './nieve-lib.mjs';
const R = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = { nombre: 'Casa María Juanín, Ctra. General 48, Collanzo', lat: 43.1231988, lon: -5.5630593, fuente: 'ref/DATOS-CASA-MARIA-JUANIN.md (GPS)' };
// Cada destino lleva el objeto de OpenStreetMap del que sale la coordenada (consultado el 2026-11-24).
const DESTINOS = [
  { id: 'fuentes-de-invierno', nombre: 'Fuentes de Invierno', lat: 43.0626331, lon: -5.3925745, osm: 'node/893547339', tipo: 'Restaurante «Fuentes de Invierno», en el acceso a la estación (OSM)' },
  { id: 'san-isidro', nombre: 'Estación de San Isidro', lat: 43.0633900, lon: -5.3753800, osm: 'way/178704717', tipo: 'Aparcamiento de San Isidro-Saliencias (OSM); la estación de León está a ambos lados del puerto' },
  { id: 'puerto-san-isidro', nombre: 'Puerto de San Isidro (1.521 m)', lat: 43.0654, lon: -5.38623, osm: 'node/4416677341', tipo: 'Collado, natural=saddle (OSM, ele=1521, fuente IGN)' },
  { id: 'oviedo', nombre: 'Oviedo', lat: 43.3618625, lon: -5.8483581, osm: 'node/493395619', tipo: 'Centro de la ciudad, place=city (OSM)' },
  { id: 'gijon', nombre: 'Gijón', lat: 43.5449422, lon: -5.66275, osm: 'node/529391484', tipo: 'Centro de la ciudad, place=city (OSM)' },
  { id: 'mieres', nombre: 'Mieres', lat: 43.2487955, lon: -5.7725728, osm: 'node/12493991036', tipo: 'Ayuntamiento de Mieres del Camín (OSM)' },
  { id: 'leon', nombre: 'León', lat: 42.5989995, lon: -5.5682413, osm: 'node/31432063', tipo: 'Centro de la ciudad, place=city (OSM)' },
  { id: 'aeropuerto', nombre: 'Aeropuerto de Asturias', lat: 43.559341, lon: -6.0322795, osm: 'way/321569262', tipo: 'Terminal, aeroway=terminal (OSM)' },
];
const ESPEJOS = ['https://router.project-osrm.org'];
const haversine = (a, b, c, d) => { const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r * Math.cos((a + c) / 2 * r); return Math.hypot(x, y) * 6371000; };
async function ruta(d, completa) {
  const url = `${ESPEJOS[0]}/route/v1/driving/${ORIGEN.lon},${ORIGEN.lat};${d.lon},${d.lat}?overview=${completa ? 'full&geometries=geojson' : 'false'}&steps=false`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      const j = await r.json();
      if (j.code === 'Ok') return j;
    } catch (e) { /* reintenta */ }
    await new Promise((s) => setTimeout(s, 1500));
  }
  throw new Error('OSRM no responde para ' + d.id);
}
const salida = { fuente: 'OSRM (router.project-osrm.org, perfil de coche) sobre datos de OpenStreetMap (ODbL)', fecha: '2026-11-24', aviso: 'Minutos de conducción sin tráfico, nieve ni cadenas. Orientativos.', origen: ORIGEN, destinos: {} };
let traza = null;
for (const d of DESTINOS) {
  const j = await ruta(d, d.id === 'fuentes-de-invierno');
  const rt = j.routes[0], wp = j.waypoints[1];
  const ajuste = Math.round(haversine(d.lat, d.lon, wp.location[1], wp.location[0]));
  salida.destinos[d.id] = { nombre: d.nombre, lat: d.lat, lon: d.lon, osm: d.osm, tipo: d.tipo, km: Math.round(rt.distance / 100) / 10, min: Math.round(rt.duration / 60), segundos: Math.round(rt.duration), via: j.waypoints[1].name || null, ajusteAlViarioM: ajuste };
  if (d.id === 'fuentes-de-invierno') traza = rt.geometry;
  console.log(d.id.padEnd(20), String(salida.destinos[d.id].km).padStart(6), 'km', String(salida.destinos[d.id].min).padStart(4), 'min', ' ajuste', ajuste, 'm', wp.name || '');
  await new Promise((s) => setTimeout(s, 600));
}
mkdirSync(join(R, 'ref/raw'), { recursive: true });
writeFileSync(join(R, 'ref/raw/rutas.json'), JSON.stringify(salida, null, 1));
writeFileSync(join(R, 'ref/raw/ruta-puerto.json'), JSON.stringify({ fuente: salida.fuente, fecha: salida.fecha, de: 'casa', a: 'fuentes-de-invierno', geometria: traza }));
console.log('escrito ref/raw/rutas.json');
