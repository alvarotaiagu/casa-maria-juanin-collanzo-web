# Casa María Juanín · «Sintoniza el Alto Aller»

Propuesta de web para **Apartamentos Casa María Juanín** (Ctra. General 48, Collanzo, Aller). Tres apartamentos turísticos de 2 llaves (AT0510) en el antiguo ultramarinos de la familia. No tienen web: su dominio caducó y está a la venta (ver `PENDIENTES.md`).

Una sola página (`index.html`), más legales y 404. Solo castellano. En local: sin publicar y sin commits. `noindex, nofollow` en todas las páginas.

## El concepto
La casa guarda una **colección de radios antiguas**: la web toma de ahí su instrumento, **la escala de cristal de una radio de válvulas**, con su aguja y sus emisoras, vista como un instrumento de precisión de 2026 y no como atrezo. En la escala se sintonizan **las épocas del año en Collanzo**: la nieve, las rutas, el río y la berrea. Cristal oscuro, luz ámbar, cifras en mono, mucho aire.

- **Portada (Radio):** el titular («Tres apartamentos en el antiguo ultramarinos de la familia»), la fachada a su tamaño y la escala que se arrastra con inercia y engancha en cada emisora.
- **La casa (Web):** la historia en una frase, la ficha en cifras (3 apartamentos, 14 plazas, 2 llaves, AT0510) sobre un panel de cristal oscuro, lo común con iconos propios, las condiciones aparte y el trato (la reseña de los dulces y el pan casero).
- **Tres plantas, tres historias (Plantas):** se sube por la casa; cada planta, su apartamento y su galería por estancias.
- **El puerto, hoy (Nieve):** el relieve del Alto Aller con el cielo y la nieve de hoy. **Quitable.**
- **Reservar (Web):** el motor de demostración; el resumen es **una escala de 12 meses sintonizada**.
- **Opiniones (Web):** una franja con las notas de Google y Booking, fechadas, y las tres frases de la ficha de Google.
- **Cómo llegar (Web):** dirección, carreteras, tren y autobús, las distancias de OSRM y el mapa de Google a petición.
- **Pie (Web + Radio):** la escala pequeña que se completa con las cuatro emisoras encendidas, la marca de siempre y los legales.

### Letras (tres, de Google Fonts, ninguna en la cartera)
- **Michroma** para titulares: es la letra ancha de rótulo de instrumento (de la familia de las Eurostile/Microgramma de los diales de alta fidelidad). Aguanta tamaños grandes y se lee como una escala.
- **Radio Canada** para el texto: grotesca humanista, muy legible, y el nombre ya lo dice.
- **B612 Mono** para cifras, frecuencias, minutos y precios: la diseñó Airbus para las pantallas de cabina. Es literalmente una letra de instrumento.
Ninguna serif. Comprobado con `grep -rlI "family=<Nombre>"` en `*-web/*.html` y `*-web/css`: 0 webs.

### Paleta
`--noche #121416` (el cristal), `--ambar #F2A93B` (la luz: solo luces, cifras grandes y texto sobre noche), `--ambar-texto` (su derivado con `color-mix`, ≥ 4,5:1 sobre marfil), `--marfil #F1EEE7`, `--tinta #1B1D1F`, `--galeria #24508A` (el azul de la galería acristalada, medido en la foto: #204781 en sombra) y `--teja #9A5545` (las bandas de ladrillo, medidas: #945F54 al sol), solo en detalles.

## Cómo se trabaja
```
python -I -X utf8 scripts/fotos-verticales.py   # la fachada con las verticales enderezadas (solo si cambia)
node scripts/fotos.mjs                           # fotos: AVIF, WebP y JPG; nunca amplía (lista en scripts/fotos-lista.json)
node scripts/marca.mjs                           # favicons, iconos e img/og.jpg
node scripts/legales.mjs                         # legales y 404 (*.src.html)
node construir.mjs                               # partes, generados desde los datos, <picture> y ?v=huella
node verificar.mjs                               # la prueba (puerto 8951), una vez al terminar cada tanda
node scripts/rendimiento.mjs                     # LCP en móvil de gama media (puerto 8952)
node ../plantillas-negocios-web/scripts/repeticion.mjs casa-maria-juanin-collanzo-web
```
- Se edita **siempre** el `*.src.html` o la parte (`partes/`); el `.html` se genera.
- **Una sola fuente de datos:** `data/apartamentos.json` (Web) alimenta las fichas del respaldo, la tabla de la sobria, Plantas y la reserva. `ref/raw/rutas.json` (Nieve, OSRM) da los minutos y kilómetros; `construir.mjs` los escribe en la página. **La portada dice «a veinte minutos»** porque OSRM da 21 min a Fuentes de Invierno y 20 a San Isidro: la ficha dice 15, manda OSRM.
- Arquitectura de `../a-palleira-pesoz-web/` (construir, versionar, verificar, fotos, legales, marca, rendimiento, el contrato de módulos con respaldo).
- **Contrato con los módulos:** `window.Juanin.<mod>.montar(el, { movimiento, densidad })`; el HTML de `el` es el respaldo. `main.js` monta la portada al cargar y el resto al acercarse. Si falta un fichero, `construir.mjs` quita su etiqueta. `Juanin.reservar(id?)`, `juanin:apartamento` (Plantas) y `juanin:emisora` (Radio).
- **Plantas** pasa a rejilla de tres también con `prefers-reduced-motion`, no solo en la sobria. Su contorno de foco se cambia por el subrayado de la web (regla en `estilos.css`, bajo `[data-modulo="plantas"]`, salvo en su visor).
- **Radio** pone la rejilla de la portada (texto, escala, lectura y foto); la web, el relleno, el alto y la letra. Su respaldo es img/radio/respaldo.html, que genera scripts/radio-construir.mjs (lo lanza construir.mjs) desde data/emisoras.json: **la emisora de hoy sale solo de ahí**. Relevo con la cabecera: con html.radio-en-cabecera se enciende la escala de la cabecera, su aguja arranca en --radio-x y toma el color de --radio-luz. El subrayado del foco no se pinta sobre las escalas de Radio (llevan el suyo).
- **LCP:** medido con scripts/rendimiento.mjs en móvil de gama media: 1,84 s, y el elemento es el titular (#portada-tit). En móvil la fachada se queda en 240 px para que no le quite el LCP.

## La reserva (DEMOSTRACIÓN)
`js/reserva.js`. Eliges apartamento (o «el que esté libre» según las personas), personas y noches. Calendario de 12 meses **por apartamento**, con noches ocupadas de ejemplo (semilla fija). Si no caben, lo dice y propone el que sí. Localizador `JUANIN-AAMMDD-X` (X = P, C o S). No envía ni guarda nada.

**Supuestos** (marcados en la página, junto al motor):
- 85 € la noche por apartamento en baja y 115 € en alta; Nochevieja 150 €; cama supletoria 12 € la noche desde la 5.ª persona. Sale de su tarifa de 2021, dentro de la horquilla oficial de 70 a 150 €.
- Temporada alta = la de la nieve: del 26 de noviembre a fin de Semana Santa (Domingo de Resurrección incluido).
- Mínimo 2 noches.
- El de 4 plazas es El Salao; La Panera y El Capitán, de 4 a 5.

## Mando de densidades (solo con `?revision`)
`index.html?revision` enseña el mando «Versión»: **Sintonía** (la cargada: la aguja con inercia, las emisoras con su luz y su capa, las plantas que suben y el puerto en 3D) y **Sobria** (la escala quieta en la emisora de hoy, las plantas en rejilla, el puerto en 2D y, además, la tabla **«Los tres, de un vistazo»**). Sin `?revision` no se ve ni se aplica.

### Receta de borrado (el mando nunca viaja al cliente)
1. `partes/cabeza.html`: borrar el bloque `// MANDO DE MAQUETA` (el `try { … }` que lee `?revision`).
2. `partes/pie.html`: borrar de `<!-- MANDO DE MAQUETA` a `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: borrar el bloque `13. MANDO DE MAQUETA` hasta `/* fin del MANDO DE MAQUETA */`.
4. Si se queda la cargada, borrar también la sección `#vistazo` de `index.src.html`.
5. `node construir.mjs`.
`node scripts/probar-borrado-mando.mjs` comprueba la receta sobre copias en memoria (lo pasa `verificar.mjs`).

### Quitar el puerto (módulo quitable)
Borrar la sección `<section id="puerto">` de `index.src.html` y las líneas de `css/nieve.css` y `js/nieve.js` de `partes/`; los enlaces «El puerto» se quitan solos. Quitar Open-Meteo, jsDelivr e IGN de `scripts/legales.mjs` y relanzarlo. `verificar.mjs` prueba la página sin esa sección.

## Comprobado
`node construir.mjs && node verificar.mjs` (sin capturas, sin pintar WebGL, una prueba a la vez) mira, entre otras cosas: noindex y charset, ids únicos, fotos sin ampliar, los textos de DATOS (teléfonos, AT0510, notas fechadas, las tres frases tal cual, sin nombre para la dueña, sin cifras de radios, sin fechas de berrea ni de esquí, sin rayas), las distancias de OSRM, el contrato de módulos, las tres letras, sin serif, sin cursor propio, sin marquesina ni pila sticky, el foco con muesca, el contraste medido en el navegador, las densidades y el mando, el motor (tarifas, temporadas, aforo, «el que esté libre», mínimo de noches, localizador), las cookies en cuatro pasos, el mapa a petición, el visor por nombre, el móvil a 360/375/390/768 sin scroll lateral, el menú con blur, la barra del móvil que no rehace nada, recargar a media página, los respaldos sin los JS de los módulos, la página sin el puerto, los legales y el movimiento una vez.

## Qué mirar en Chrome
Ábrela con `index.html?revision` (para ver el mando) y sin él.
1. **Portada:** que el titular en Michroma no quede demasiado largo (3 líneas en escritorio); la fachada en su marco sin verse blanda; arrastrar la aguja y que enganche en cada emisora; la luz que cambia.
2. **Cabecera:** al bajar, el cristal oscuro y la **aguja finísima** que recorre la cabecera con el scroll (abajo, en ámbar). Que no moleste sobre las secciones claras.
3. **La casa:** la frase larga de la historia (¿se lee bien de un tirón?), el panel oscuro de cifras en ámbar, los ocho iconos (dibujados a mano, mismo trazo) y la cita con el pan.
4. **Tres plantas:** subir por la casa; las fotos de 2011 a su tamaño.
5. **El puerto:** el 3D en tu Chrome (aquí no se pinta) y el rótulo de la nieve de hoy.
6. **Reservar:** la escala de 12 meses del resumen: el tramo de tus noches encendido y la banda azul de la nieve. Probar 5 personas en El Salao.
7. **Móvil:** el menú con blur, el foco con muesca al tabular (subrayado ámbar bajo cada enlace), y la sobria con la tabla.
