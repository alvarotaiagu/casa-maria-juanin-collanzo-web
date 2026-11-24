/* Favicons, iconos e imagen para compartir de Casa María Juanín, desde la muesca de la escala y las iniciales.
   El logo original (195×84) no se puede vectorizar con fidelidad: no se usa aquí (va pequeño en el pie).
   Uso: node scripts/marca.mjs   (necesita antes img/fotos/ de scripts/fotos.mjs)
   Escribe marca/favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png e img/og.jpg (1200×630).
   Las letras de la imagen para compartir son de sistema (librsvg no carga Michroma): mayúsculas espaciadas, como un rótulo. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOCHE = '#121416', AMBAR = '#F2A93B', MARFIL = '#F1EEE7', NIEBLA = '#A9ADB1';

// el icono: el cristal oscuro, la escala (marcas finas abajo), la aguja ámbar con su muesca y «MJ» arriba (solo en los grandes)
function icono(t, radio, conLetras) {
  const marcas = [];
  for (let i = 1; i < 10; i++) {
    const x = (t * i) / 10, alto = i === 5 ? t * 0.2 : t * 0.11;
    marcas.push(`<line x1="${x}" x2="${x}" y1="${t * 0.86 - alto}" y2="${t * 0.86}" stroke="${MARFIL}" stroke-opacity="${i === 5 ? 0.7 : 0.4}" stroke-width="${Math.max(1, t * 0.018)}"/>`);
  }
  const xa = t * 0.62;
  const letras = conLetras ? `<text x="${t * 0.12}" y="${t * 0.42}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${t * 0.26}" letter-spacing="${t * 0.01}" fill="${MARFIL}">MJ</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}">
  <rect width="${t}" height="${t}" rx="${radio}" fill="${NOCHE}"/>
  <line x1="${t * 0.08}" x2="${t * 0.92}" y1="${t * 0.86}" y2="${t * 0.86}" stroke="${MARFIL}" stroke-opacity=".5" stroke-width="${Math.max(1, t * 0.02)}"/>
  ${marcas.join('\n  ')}
  ${letras}
  <rect x="${xa - t * 0.03}" y="${conLetras ? t * 0.5 : t * 0.14}" width="${t * 0.06}" height="${conLetras ? t * 0.38 : t * 0.74}" rx="${t * 0.015}" fill="${AMBAR}"/>
  <rect x="${xa - t * 0.075}" y="${t * 0.84}" width="${t * 0.15}" height="${t * 0.05}" fill="${AMBAR}"/>
</svg>`;
}
const png = async (svg, t) => sharp(Buffer.from(svg), { density: 288 }).resize(t, t, { kernel: 'lanczos3' }).png().toBuffer();
fs.mkdirSync(path.join(RAIZ, 'marca'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'marca/favicon.svg'), icono(64, 12, false));
fs.writeFileSync(path.join(RAIZ, 'marca/favicon-32.png'), await png(icono(128, 24, false), 32));
fs.writeFileSync(path.join(RAIZ, 'marca/apple-touch-icon.png'), await png(icono(180, 0, true), 180));
fs.writeFileSync(path.join(RAIZ, 'marca/icono-512.png'), await png(icono(512, 0, true), 512));

// og:image 1200×630: la noche, el nombre y la escala con la aguja; a la derecha, la fachada a su tamaño
const foto = await sharp(path.join(RAIZ, 'img/fotos/fachada-1024.jpg')).resize(470, 360, { fit: 'cover', position: 'centre' }).png().toBuffer();
const marcas = [];
for (let x = 60, i = 0; x <= 1140; x += 12, i++) marcas.push(`<line x1="${x}" x2="${x}" y1="${i % 5 === 0 ? 520 : 532}" y2="548" stroke="${MARFIL}" stroke-opacity="${i % 5 === 0 ? 0.55 : 0.28}" stroke-width="1.4"/>`);
const base = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><radialGradient id="g" cx="0.3" cy="1" r="0.7"><stop offset="0" stop-color="${AMBAR}" stop-opacity=".16"/><stop offset="1" stop-color="${AMBAR}" stop-opacity="0"/></radialGradient></defs>
  <rect width="1200" height="630" fill="${NOCHE}"/>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="60" y="120" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="46" letter-spacing="6" fill="${MARFIL}">CASA MARÍA JUANÍN</text>
  <text x="60" y="168" font-family="Consolas, monospace" font-size="20" letter-spacing="4" fill="${NIEBLA}">APARTAMENTOS · COLLANZO · ALTO ALLER</text>
  <text x="60" y="270" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${MARFIL}">Tres apartamentos en el antiguo</text>
  <text x="60" y="312" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${MARFIL}">ultramarinos de la familia</text>
  <line x1="60" x2="1140" y1="548" y2="548" stroke="${MARFIL}" stroke-opacity=".5" stroke-width="1.4"/>
  ${marcas.join('')}
  <rect x="268" y="470" width="4" height="86" fill="${AMBAR}"/>
  <rect x="260" y="546" width="20" height="6" fill="${AMBAR}"/>
  <text x="270" y="588" text-anchor="middle" font-family="Consolas, monospace" font-size="16" letter-spacing="3" fill="${AMBAR}">NIEVE</text>
  <text x="540" y="588" text-anchor="middle" font-family="Consolas, monospace" font-size="16" letter-spacing="3" fill="${NIEBLA}">RUTAS</text>
  <text x="790" y="588" text-anchor="middle" font-family="Consolas, monospace" font-size="16" letter-spacing="3" fill="${NIEBLA}">RÍO</text>
  <text x="1040" y="588" text-anchor="middle" font-family="Consolas, monospace" font-size="16" letter-spacing="3" fill="${NIEBLA}">BERREA</text>
  <rect x="668" y="58" width="474" height="364" rx="4" fill="none" stroke="${MARFIL}" stroke-opacity=".2"/>
</svg>`;
await sharp(Buffer.from(base)).composite([{ input: foto, left: 670, top: 60 }]).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log('marca/ (favicon, iconos) e img/og.jpg listos');
