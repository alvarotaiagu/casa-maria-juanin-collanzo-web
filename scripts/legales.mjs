/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común.
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   El titular no consta (no se pone nombre a la dueña): todo lo que falta va «por confirmar». Registro AT0510 de Turismo Asturias.
   Si se quita el módulo del puerto (Nieve), quitar también los párrafos de Open-Meteo y jsDelivr de «cookies» y «privacidad». */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEL = '<a href="tel:+34669750209">669 75 02 09</a>';

const TITULAR = `<dl>
  <dt>Titular</dt><dd><span class="aviso-corto">por confirmar</span></dd>
  <dt>NIF</dt><dd><span class="aviso-corto">por confirmar</span></dd>
  <dt>Nombre comercial</dt><dd>Apartamentos Casa María Juanín</dd>
  <dt>Dirección</dt><dd>Ctra. General 48 · 33680 Collanzo (Aller), Asturias</dd>
  <dt>Teléfonos</dt><dd>${TEL} · <a href="tel:+34985487417">985 487 417</a></dd>
  <dt>Correo</dt><dd><span class="aviso-corto">por confirmar</span></dd>
  <dt>Actividad</dt><dd>Apartamentos turísticos, categoría de 2 llaves</dd>
  <dt>Registro de turismo</dt><dd>AT0510</dd>
</dl>
<p class="aviso">PENDIENTE: confirmar el titular, su NIF y el correo de contacto (info@casamariajuanin.es depende de un dominio caducado). Esta web es una propuesta que todavía no ha encargado nadie.</p>`;

const OPEN_METEO = `<li><b>Open-Meteo</b>: el espesor y la cota de nieve de «El puerto, hoy» se piden a open-meteo.com desde tu navegador cuando llegas a esa sección. No usa cookies, pero recibe tu dirección IP en la petición.</li>
  <li><b>jsDelivr</b>: al acercarte a «El puerto, hoy», el relieve en 3D pide la librería Three.js (versión 0.160.0) a cdn.jsdelivr.net. No usa cookies, pero recibe tu dirección IP.</li>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre los Apartamentos Casa María Juanín, en Collanzo (Aller, Asturias). Los precios y las condiciones pueden cambiar: los que valen son los que se confirman al reservar.</p>
<p>Por ahora, la reserva de esta web es una demostración: la ocupación es de ejemplo, los precios son supuestos y no se envía, se guarda ni se cobra nada.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos, el logotipo y las fotografías son del titular o se usan con su permiso. Las letras Michroma, Radio Canada y B612 Mono se usan con su licencia libre (SIL Open Font License). Los tiempos y kilómetros por carretera se han calculado con OSRM (router.project-osrm.org) sobre datos de OpenStreetMap, © colaboradores de OpenStreetMap, con licencia ODbL (<a href="https://www.openstreetmap.org/copyright">openstreetmap.org/copyright</a>). El relieve y la ortofoto de «El puerto, hoy» son del Instituto Geográfico Nacional (CC BY 4.0, <a href="https://www.ign.es">ign.es</a>).</p>
<p class="aviso">PENDIENTE: confirmar que las fotos (de su web de 2011 y de su web de 2023) se pueden usar, y el permiso para citar las frases de las reseñas de Google.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (Google Maps, Google, Booking) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española. Para cualquier reclamación, llama al ${TEL}: buscaremos siempre una solución amistosa.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al reservar o al llamarnos: nombre, teléfono, correo, las fechas, cuántos venís y lo que quieras contarnos. Los usamos para gestionar tu reserva y atenderte.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<p>La reserva de esta web es, por ahora, una demostración: lo que escribas en ella no sale de tu navegador ni se guarda.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al reservar, la ejecución de la reserva y, para el registro de viajeros, una obligación legal. Los datos se conservan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo obligación legal (el registro de viajeros) y siempre con lo imprescindible.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos llamando al ${TEL}. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Servicios de fuera que ven tu dirección IP</h2>
<ul>
  <li><b>Google Fonts</b>, para las letras de la web.</li>
  <li><b>Google Maps</b>, solo si pulsas «Ver el mapa».</li>
  ${OPEN_METEO}
</ul>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>juanin-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>juanin-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web (Michroma, Radio Canada y B612 Mono) se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  ${OPEN_METEO}
</ul>
<h2>La escala y el puerto</h2>
<p>La escala de la portada y el relieve del puerto se dibujan en tu navegador con datos que van con esta misma web (OpenStreetMap, © colaboradores de OpenStreetMap, ODbL; Instituto Geográfico Nacional, CC BY 4.0): no instalan cookies.</p>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1 en el texto, foco visible, textos alternativos en las fotos, formularios con etiquetas y animaciones que se desactivan si tu sistema pide reducir el movimiento. La escala, el relieve y las animaciones son un adorno: la información está también en el texto. La web no reproduce ningún sonido.</p>
<h2>La casa</h2>
<p class="aviso">PENDIENTE: confirmar los accesos y si algún apartamento está adaptado (los tres están en plantas distintas).</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, llama al ${TEL}. Te responderemos y te daremos la información en un formato accesible.</p>`,
  },
};

const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Casa María Juanín</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=B612+Mono:wght@400;700&family=Michroma&family=Radio+Canada:wght@400;500;600&display=swap">
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;

const MARCA = `<a class="marca" href="./" aria-label="Casa María Juanín, a la portada"><span class="marca__nombre">Casa María Juanín</span><span class="marca__sub" aria-hidden="true">Apartamentos · Alto Aller</span></a>`;
const PIE = `<footer class="legal-pie sup-noche">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>`;

for (const [nombre, p] of Object.entries(paginas)) {
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), `${cabeza(p.titulo)}
<body>
<header class="legal-cab sup-noche">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal sup-marfil">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
${PIE}
</body>
</html>
`);
  console.log(`${nombre}.src.html`);
}

fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay sup-noche">
<style>
  .no-hay { min-height: 100svh; display: grid; place-items: center; padding: 24px; background: var(--noche); }
  .no { display: grid; gap: 22px; justify-items: start; max-width: 34em; }
  .no h1 { font: 400 clamp(1.8rem, 6vw, 3rem)/1.12 var(--fuente-titulo); letter-spacing: -.02em; }
  .no p { color: var(--niebla); }
  .no__escala { width: min(420px, 86vw); height: 40px; background: repeating-linear-gradient(90deg, rgba(241, 238, 231, .3) 0 1px, transparent 1px 12px) bottom / 100% 14px no-repeat; position: relative; }
  .no__escala::after { content: ""; position: absolute; left: 61%; bottom: 0; width: 2px; height: 40px; background: var(--ambar); box-shadow: 0 0 8px rgba(242, 169, 59, .6); }
  .no__acc { display: flex; flex-wrap: wrap; gap: 12px; }
</style>
  <main class="no">
    <div class="no__escala" aria-hidden="true"></div>
    <h1>Aquí no se sintoniza nada</h1>
    <p>La página que buscas no existe o ha cambiado de sitio. La casa sigue donde estaba: en la Ctra. General 48, en Collanzo.</p>
    <div class="no__acc"><a class="btn btn--luz" href="./#reservar">Ver fechas</a><a class="btn btn--hueco" href="./">Volver a la portada</a></div>
  </main>
</body>
</html>
`);
console.log('404.src.html');
