// Trae de OpenStreetMap (Overpass, ODbL) lo que hay en el puerto: estaciones, remontes, pistas,
// el collado de San Isidro y la carretera. Guarda la respuesta cruda en ref/raw/osm-puerto.json.
// Uso: node scripts/nieve-osm.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const R = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'web-research-script/1.0';
const ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const bbox = '43.00,-5.62,43.16,-5.30';
const consulta = `[out:json][timeout:60];(
  nwr["landuse"="winter_sports"](${bbox});
  nwr["aerialway"](${bbox});
  way["piste:type"](${bbox});
  nwr["name"~"Fuentes de Invierno|San Isidro",i]["tourism"](${bbox});
  nwr["name"~"Fuentes de Invierno|San Isidro",i]["amenity"](${bbox});
  nwr["mountain_pass"="yes"](${bbox});
  nwr["natural"="saddle"]["name"~"San Isidro",i](${bbox});
  nwr["name"~"Coḷḷanzo|Collanzo"]["place"](${bbox});
  way["ref"~"^(AS-253|AS-112|LE-331|LE-332)$"](${bbox});
  way["highway"]["name"~"Puerto de San Isidro",i](${bbox});
);out center tags;`;
let ultimo = '';
for (const url of ESPEJOS) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(consulta), signal: AbortSignal.timeout(70000) });
    const t = await r.text();
    if (!r.ok || !t.startsWith('{')) { ultimo = url + ' ' + r.status; console.error('fallo', ultimo); continue; }
    const d = JSON.parse(t);
    mkdirSync(join(R, 'ref/raw'), { recursive: true });
    writeFileSync(join(R, 'ref/raw/osm-puerto.json'), JSON.stringify({ fuente: 'OpenStreetMap vía Overpass (ODbL)', espejo: url, fecha: new Date().toISOString(), bbox, elementos: d.elements }, null, 1));
    console.log('ok', url, d.elements.length, 'elementos');
    process.exit(0);
  } catch (e) { ultimo = url + ' ' + e.message; console.error('fallo', ultimo); }
}
console.error('todos los espejos fallan:', ultimo); process.exit(1);
