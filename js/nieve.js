/* ------------------------------------------------------------------
   Casa María Juanín · nieve.js · «El puerto, hoy»
   El Alto Aller (de Collanzo al puerto de San Isidro y Fuentes de Invierno) con el relieve MDT05 y la ortofoto PNOA del IGN
   (CC BY 4.0), el sol y la luna en su posición real de ahora y la nieve de hoy según Open-Meteo, dicha como lo que es:
   una estimación de un modelo, nunca el parte de la estación. Si no hay dato, no se inventa.

   Contrato:  window.Juanin.nieve.montar(el, { movimiento, densidad, base, ahora }) → { destruir() }
     - el HTML de `el` es el respaldo: se queda si algo falla y se restituye al destruir.
     - densidad 'sobria', ?sin-webgl o sin WebGL: solo el plano 2D (el mismo hueco). Con ahorro de datos, el 3D solo al pedirlo.
   Además expone, para las pruebas: Juanin.nieve.sol(fecha), luna(fecha), interpretar(respuesta) y rotulo(estado).
   Sin dependencias: Three.js se pide con import() solo cuando hace falta (fijado en 0.160.0); sin importmap.
   Selectores todos bajo [data-modulo="nieve"]; sin globales salvo window.Juanin.nieve.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var J = (window.Juanin = window.Juanin || {});
  var SCRIPT = document.currentScript && document.currentScript.src;
  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
  var RAD = Math.PI / 180, EX = 1.6;                           // el relieve se exagera ×1,6 (y se dice en el pie)
  var CASA = { lat: 43.1231988, lon: -5.5630593 };
  var UMBRAL_NIEVE = 0.01;                                     // m: 1 cm; por debajo, «no hay nieve»

  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (a, b, x) { var t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var hexA = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); };
  var mezcla = function (a, b, t) { var A = hexA(a), B = hexA(b); return '#' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0'); }).join(''); };
  var miles = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var coma = function (n, d) { return n.toFixed(d).replace('.', ','); };
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* =============== el cielo de ahora: sol y luna (fórmulas de SunCalc, V. Agafonkin) =============== */
  var J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  var dias = function (f) { return f.valueOf() / 864e5 - 0.5 + J1970 - J2000; };
  var ar = function (l, b) { return Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)); };
  var de = function (l, b) { return Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)); };
  var sideral = function (d) { return RAD * (280.16 + 360.9856235 * d) - RAD * (-CASA.lon); };
  function altAz(H, dec) {                                      // altura y rumbo (desde el norte, hacia el este), grados
    var phi = RAD * CASA.lat;
    return {
      alt: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD,
      az: (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360
    };
  }
  function solCoords(d) {
    var M = RAD * (357.5291 + 0.98560028 * d);
    var L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
    return { dec: de(L, 0), ra: ar(L, 0) };
  }
  function lunaCoords(d) {
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
    return { ra: ar(l, b), dec: de(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }
  function sol(fecha) { var d = dias(fecha), c = solCoords(d); return altAz(sideral(d) - c.ra, c.dec); }
  function luna(fecha) {
    var d = dias(fecha), m = lunaCoords(d), s = solCoords(d), p = altAz(sideral(d) - m.ra, m.dec);
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
    var ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    var paralaje = Math.asin(6378.14 / m.dist) / RAD;           // la Luna está tan cerca que se nota: hasta ~1° de altura
    return { alt: p.alt - paralaje * Math.cos(p.alt * RAD), az: p.az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  }
  var RUMBOS = ['norte', 'nornoreste', 'noreste', 'esnoreste', 'este', 'essureste', 'sureste', 'sursureste', 'sur', 'sursuroeste', 'suroeste', 'oessuroeste', 'oeste', 'oesnoroeste', 'noroeste', 'nornoroeste'];
  var rumbo = function (az) { return RUMBOS[Math.round(az / 22.5) % 16]; };

  // colores del cielo (arriba, medio, horizonte) según la altura del sol: noche azul, alba y atardecer dorados, día claro
  var PARADAS = [
    { a: -14, c: ['#04060c', '#080d1a', '#101828'] },
    { a: -7, c: ['#0b1428', '#1d2548', '#4a3b55'] },
    { a: -1.5, c: ['#1a2a52', '#7a5a68', '#e08a55'] },
    { a: 5, c: ['#2f5c92', '#8fb0d0', '#f2cba0'] },
    { a: 25, c: ['#3a72ae', '#8fb9dc', '#d6e4ef'] }
  ];
  function coloresCielo(alt) {
    if (alt <= PARADAS[0].a) return PARADAS[0].c;
    for (var i = 1; i < PARADAS.length; i++) {
      if (alt <= PARADAS[i].a) { var t = (alt - PARADAS[i - 1].a) / (PARADAS[i].a - PARADAS[i - 1].a); return PARADAS[i].c.map(function (c, k) { return mezcla(PARADAS[i - 1].c[k], c, t); }); }
    }
    return PARADAS[PARADAS.length - 1].c;
  }

  // la Luna con su fase, dibujada en un canvas (waxing: ilumina la derecha en el hemisferio norte)
  function dibujarLuna(g, lado, luz, fase) {
    var r = lado * 0.4, k = Math.cos(2 * Math.PI * fase);
    g.save(); g.clearRect(0, 0, lado, lado); g.translate(lado / 2, lado / 2);
    g.fillStyle = 'rgba(60,72,96,.55)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    if (fase > 0.5) g.scale(-1, 1);                              // menguante: ilumina la izquierda
    g.fillStyle = '#f1ead6'; g.shadowColor = 'rgba(241,234,214,.55)'; g.shadowBlur = lado * 0.1;
    g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    g.ellipse(0, 0, Math.max(0.001, Math.abs(k) * r), r, 0, Math.PI / 2, k > 0 ? -Math.PI / 2 : Math.PI * 1.5, k > 0);
    g.closePath(); g.fill(); g.restore();
  }

  /* =============== el tiempo: Open-Meteo, sin clave =============== */
  // Cada estación es un punto del modelo meteorológico, no un sensor de la estación.
  function urlTiempo(lugares) {
    var P = [lugares.fuentes, lugares.sanisidro];
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + P.map(function (p) { return p.lat.toFixed(4); }).join(',') +
      '&longitude=' + P.map(function (p) { return p.lon.toFixed(4); }).join(',') +
      '&current=temperature_2m,snow_depth,snowfall,freezing_level_height,snowfall_height&timezone=Europe%2FMadrid';
  }
  var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };
  // respuesta de Open-Meteo → estado listo para pintar; null si no hay dato utilizable
  function interpretar(resp) {
    var lista = Array.isArray(resp) ? resp : [resp];
    var nombres = ['Fuentes de Invierno', 'San Isidro'], ids = ['fuentes', 'sanisidro'], out = [];
    for (var i = 0; i < lista.length && i < 2; i++) {
      var c = lista[i] && lista[i].current;
      if (!c || num(c.snow_depth) === null) continue;
      var prof = c.snow_depth, cotaNieve = num(c.snowfall_height), iso = num(c.freezing_level_height), elev = num(lista[i].elevation);
      out.push({
        id: ids[i], nombre: nombres[i], hora: String(c.time || '').slice(11, 16), prof: prof, cm: Math.round(prof * 100), hay: prof >= UMBRAL_NIEVE,
        nevando: (num(c.snowfall) || 0) > 0, temp: num(c.temperature_2m), isocero: iso, cotaNieve: cotaNieve, elev: elev,
        // la cota del modelo: la de la nevada si está nevando; si no, el isocero (0 °C)
        cota: cotaNieve !== null ? cotaNieve : iso
      });
    }
    if (!out.length) return null;
    var p = out.filter(function (e) { return e.hay; })[0] || out[0];
    // dónde se pinta la nieve: por encima de la cota del modelo, sin pasar del punto donde el modelo dice que hay nieve
    var cotaPintada = null;
    if (p.hay) { var tope = p.elev !== null ? p.elev : Infinity; cotaPintada = p.cota !== null ? Math.min(p.cota, tope) : (isFinite(tope) ? tope : null); }
    return { estaciones: out, principal: p, hay: p.hay && cotaPintada !== null, cotaPintada: cotaPintada, espesor: p.prof };
  }
  // el rótulo del módulo, según el estado (la regla de oro: nunca un dato inventado)
  function rotulo(est) {
    if (!est) return { cls: 'sin-dato', txt: 'Sin dato de nieve ahora' };
    var p = est.principal;
    if (!est.hay) {
      var c = p.cota !== null ? ' · cota del modelo: ' + miles(p.cota) + ' m' : '';
      return { cls: 'nada', txt: 'Hoy no hay nieve en el puerto' + c + ' · Open-Meteo, ' + p.hora };
    }
    return { cls: 'ok', txt: 'Nieve estimada hoy en ' + p.nombre + ': ' + p.cm + ' cm · Open-Meteo, ' + p.hora };
  }

  /* =============== datos del terreno (IGN) =============== */
  var CACHE = {};
  function baseDe(op) {
    if (op && op.base) return op.base;
    if (SCRIPT) { try { return new URL('../img/nieve/', SCRIPT).href; } catch (e) { /* sigue */ } }
    return 'img/nieve/';
  }
  function imagen(url) {
    return new Promise(function (ok, mal) { var im = new Image(); im.decoding = 'async'; im.onload = function () { ok(im); }; im.onerror = function () { mal(new Error('imagen ' + url)); }; im.src = url; });
  }
  function jsonDe(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function cargarTerreno(base, movil) {
    var k = base + (movil ? 'm' : 'd');
    if (CACHE[k]) return CACHE[k];
    var n = movil ? 280 : 420, o = movil ? 1024 : 2048;
    var p = Promise.all([
      jsonDe(base + 'terreno.json'),
      fetch(base + 'alturas-' + n + '.bin').then(function (r) { if (!r.ok) throw new Error('alturas ' + r.status); return r.arrayBuffer(); }),
      imagen(base + 'orto-' + o + '.jpg'),
      jsonDe(base + 'pistas.json').catch(function () { return { remontes: [], pistas: [] }; })
    ]).then(function (a) { return { T: a[0], h: new Uint16Array(a[1]), foto: a[2], pistas: a[3], n: n }; });
    CACHE[k] = p; p.catch(function () { delete CACHE[k]; });
    return p;
  }

  /* =============== el mapa: relieve + foto + nieve (+ sombreado para el plano) =============== */
  var RND = (function () { var a = new Float32Array(64 * 64), s = 12345; for (var i = 0; i < a.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; a[i] = s / 4294967296; } return a; })();
  function vn(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi, u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    var x0 = xi & 63, x1 = (xi + 1) & 63, y0 = (yi & 63) << 6, y1 = ((yi + 1) & 63) << 6;
    var a = RND[y0 | x0], b = RND[y0 | x1], c = RND[y1 | x0], d = RND[y1 | x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  var ruido = function (x, y) { return 0.6 * vn(x / 260, y / 260) + 0.4 * vn(x / 70 + 11.3, y / 70 + 7.1); };

  function crearMapa(D) {
    var T = D.T, h = D.h, foto = D.foto, rej = T.rejillas[D.n], cw = rej[0], ch = rej[1];
    var gh = new Float32Array(cw * ch), gx = new Float32Array(cw * ch), gz = new Float32Array(cw * ch);
    var i, j;
    for (i = 0; i < gh.length; i++) gh[i] = h[i] / 10;
    var dx = T.ancho / (cw - 1), dz = T.alto / (ch - 1);
    for (j = 0; j < ch; j++) for (i = 0; i < cw; i++) {
      var i0 = Math.max(0, i - 1), i1 = Math.min(cw - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(ch - 1, j + 1);
      gx[j * cw + i] = (gh[j * cw + i1] - gh[j * cw + i0]) / ((i1 - i0) * dx);
      gz[j * cw + i] = (gh[j1 * cw + i] - gh[j0 * cw + i]) / ((j1 - j0) * dz);
    }
    var W = foto.naturalWidth, H = foto.naturalHeight;
    var c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
    var g0 = c0.getContext('2d', { willReadFrequently: true }); g0.drawImage(foto, 0, 0);
    var base = g0.getImageData(0, 0, W, H).data;
    var mx = T.ancho / W, mz = T.alto / H;

    // altura (m) en un punto del mundo (x al este, z al sur, metros desde el centro)
    function alturaEn(x, z) {
      var fx = lim((x / T.ancho + 0.5) * (cw - 1), 0, cw - 1.001), fz = lim((z / T.alto + 0.5) * (ch - 1), 0, ch - 1.001);
      var ii = fx | 0, jj = fz | 0, tx = fx - ii, tz = fz - jj, a = jj * cw + ii;
      return gh[a] * (1 - tx) * (1 - tz) + gh[a + 1] * tx * (1 - tz) + gh[a + cw] * (1 - tx) * tz + gh[a + cw + 1] * tx * tz;
    }
    /* pinta la foto con la nieve y, si hay `luz`, el sombreado del sol (o de la luna) y la hora del día.
       nieve: { cota, f } (f: 0..1, el espesor)  ·  luz: { alt, az, dia, lunaAlt, lunaAz, lunaLuz }  ·  destino: canvas */
    async function pintar(nieve, luz, destino) {
      var cv = destino || document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d'), im = g.createImageData(W, H), out = im.data;
      var Lx = 0, Ly = 0, Lz = 0, tinte = [1, 1, 1], fuerza = 1;
      if (luz) {
        var L = luz.alt > -2 ? { alt: Math.max(luz.alt, 6), az: luz.az } : (luz.lunaAlt > 0 ? { alt: Math.max(luz.lunaAlt, 15), az: luz.lunaAz } : { alt: 35, az: 315 });
        Lx = Math.sin(L.az * RAD) * Math.cos(L.alt * RAD); Ly = Math.sin(L.alt * RAD); Lz = -Math.cos(L.az * RAD) * Math.cos(L.alt * RAD);
        var d = luz.dia, lu = luz.lunaAlt > 0 ? luz.lunaLuz : 0;
        var noche = [0.28 + 0.16 * lu, 0.35 + 0.17 * lu, 0.55 + 0.17 * lu];
        tinte = [lerp(noche[0], 1, d), lerp(noche[1], 1, d), lerp(noche[2], 1, d)];
        if (luz.alt > -2 && luz.alt < 8) { var dor = 1 - (luz.alt + 2) / 10; tinte[0] *= 1 + 0.12 * dor; tinte[2] *= 1 - 0.14 * dor; }
        fuerza = 0.15 + 0.85 * d;
      }
      var cota = nieve ? nieve.cota : 0, f = nieve ? nieve.f : 0;
      for (var y = 0; y < H; y++) {
        var fy = y / (H - 1) * (ch - 1), jj = Math.min(ch - 2, fy | 0), ty = fy - jj;
        for (var x = 0; x < W; x++) {
          var fx = x / (W - 1) * (cw - 1), ii = Math.min(cw - 2, fx | 0), tx = fx - ii, p = (y * W + x) * 4;
          var a = jj * cw + ii, b = a + 1, c = a + cw, e = c + 1;
          var w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
          var r = base[p], gg = base[p + 1], bl = base[p + 2];
          var gxv = 0, gzv = 0, hh = 0;
          if (nieve || luz) {
            hh = gh[a] * w00 + gh[b] * w10 + gh[c] * w01 + gh[e] * w11;
            gxv = gx[a] * w00 + gx[b] * w10 + gx[c] * w01 + gx[e] * w11;
            gzv = gz[a] * w00 + gz[b] * w10 + gz[c] * w01 + gz[e] * w11;
          }
          if (nieve) {
            var s = suave(cota - 50, cota + 130, hh);
            if (s > 0) {
              var sl = Math.sqrt(gxv * gxv + gzv * gzv), hold = 1 - 0.65 * suave(0.8, 1.7, sl);
              var v = s * hold * (0.4 + f) - ruido(x * mx, y * mz) * (1 - f) * 0.9 + f * 0.15 - 0.05;
              var am = suave(0, 0.18, v) * 0.95;
              if (am > 0) { r += (238 - r) * am; gg += (243 - gg) * am; bl += (250 - bl) * am; }
            }
          }
          if (luz) {
            var nl = (-gxv * Lx + Ly - gzv * Lz) / Math.sqrt(1 + gxv * gxv + gzv * gzv);
            var m = lim(1 + 1.3 * (nl - Ly), 0.5, 1.45); m = 1 + (m - 1) * fuerza;
            r *= m * tinte[0]; gg *= m * tinte[1]; bl *= m * tinte[2];
          }
          out[p] = r; out[p + 1] = gg; out[p + 2] = bl; out[p + 3] = 255;
        }
        if ((y & 127) === 127) await tick();
      }
      g.putImageData(im, 0, 0);
      return cv;
    }
    return { pintar: pintar, alturaEn: alturaEn, W: W, H: H, ratio: T.ancho / T.alto };
  }

  /* =============== el estado del cielo para una fecha =============== */
  function cieloDe(fecha) {
    var s = sol(fecha), l = luna(fecha);
    return { fecha: fecha, sol: s, luna: l, dia: lim((s.alt + 4) / 14, 0, 1), noche: lim((-s.alt - 2) / 10, 0, 1) };
  }
  function textoCielo(c, etiqueta) {
    var s = c.sol, l = c.luna, ts, tl;
    if (s.alt > 0.5) ts = 'Sol a ' + Math.round(s.alt) + '° sobre el horizonte, al ' + rumbo(s.az);
    else if (s.alt > -0.9) ts = 'El sol está en el horizonte, al ' + rumbo(s.az);
    else ts = 'Sol a ' + Math.round(-s.alt) + '° bajo el horizonte';
    if (l.alt > 0) tl = 'luna a ' + Math.round(l.alt) + '° al ' + rumbo(l.az) + ', ' + Math.round(l.luz * 100) + ' % iluminada';
    else tl = 'luna bajo el horizonte (' + Math.round(l.luz * 100) + ' % iluminada)';
    return etiqueta + ': ' + ts + '; ' + tl + '.';
  }
  var hhmm = function (f) { return String(f.getHours()).padStart(2, '0') + ':' + String(f.getMinutes()).padStart(2, '0'); };

  /* =============== la maqueta en 3D (Three.js, se pide solo si hace falta) =============== */
  async function crear3D(C) {
    var THREE = await import(THREE_URL);
    var D = C.D, T = D.T, rej = T.rejillas[D.n], cw = rej[0], ch = rej[1], movil = C.movil, cv = C.cv3d, caja = C.escena;
    var renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !movil, powerPreference: 'high-performance' });
    var pr = Math.min(window.devicePixelRatio || 1, movil ? 1.25 : 1.5);
    renderer.setPixelRatio(pr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    var sombras = !movil && !/[?&]sin-sombras/.test(location.search);
    renderer.shadowMap.enabled = sombras;
    if (sombras) { renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; }
    var escena = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(36, 1.5, 100, 140000);
    var yDe = function (hm) { return (hm - T.min) * EX; };

    // relieve: fila 0 = norte (z negativa), columna 0 = oeste
    var geo = new THREE.PlaneGeometry(T.ancho, T.alto, cw - 1, ch - 1);
    geo.rotateX(-Math.PI / 2);
    var P = geo.attributes.position;
    for (var i = 0; i < P.count; i++) P.setY(i, yDe(D.h[i] / 10));
    geo.computeVertexNormals();
    var texCv = document.createElement('canvas');
    var tex = new THREE.CanvasTexture(texCv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    var suelo = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
    suelo.castShadow = suelo.receiveShadow = true;
    escena.add(suelo);

    // faldón de maqueta: el borde baja hasta una base oscura
    var fal = [], BASE = -260;
    var borde = function (idx) { idx.forEach(function (ix, n) {
      if (!n) return; var a = idx[n - 1], b = ix;
      var ax = P.getX(a), az = P.getZ(a), ay = P.getY(a), bx = P.getX(b), bz = P.getZ(b), by = P.getY(b);
      fal.push(ax, ay, az, bx, by, bz, bx, BASE, bz, ax, ay, az, bx, BASE, bz, ax, BASE, az);
    }); };
    var fila = function (r) { return Array.from({ length: cw }, function (_, c) { return r * cw + c; }); };
    var col = function (c) { return Array.from({ length: ch }, function (_, r) { return r * cw + c; }); };
    borde(fila(0)); borde(fila(ch - 1).reverse()); borde(col(0).reverse()); borde(col(cw - 1));
    var gf = new THREE.BufferGeometry(); gf.setAttribute('position', new THREE.Float32BufferAttribute(fal, 3)); gf.computeVertexNormals();
    escena.add(new THREE.Mesh(gf, new THREE.MeshLambertMaterial({ color: 0x1a1d20, side: THREE.DoubleSide })));

    // líneas: carretera (ámbar), remontes y pistas (blancas, tenues), pegadas al relieve
    var linea = function (pts, color, op) {
      var v = [];
      for (var k = 1; k < pts.length; k++) {
        var a = pts[k - 1], b = pts[k], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 120));
        for (var q = 0; q < n; q++) {
          var t0 = q / n, t1 = (q + 1) / n, x0 = lerp(a[0], b[0], t0), z0 = lerp(a[1], b[1], t0), x1 = lerp(a[0], b[0], t1), z1 = lerp(a[1], b[1], t1);
          v.push(x0, yDe(C.mapa.alturaEn(x0, z0)) + 22, z0, x1, yDe(C.mapa.alturaEn(x1, z1)) + 22, z1);
        }
      }
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: op, depthWrite: false }));
    };
    if (T.carretera) escena.add(linea(T.carretera.map(function (p) { return [p[0], p[1]]; }), 0xf2a93b, 0.75));
    (D.pistas.remontes || []).forEach(function (r) { escena.add(linea(r.p, 0xf1eee7, 0.7)); });
    (D.pistas.pistas || []).forEach(function (r) { escena.add(linea(r.p, 0xf1eee7, 0.16)); });

    // cielo: cúpula con degradado que sigue a la cámara, estrellas, sol y luna en su sitio
    var cielo = new THREE.Mesh(new THREE.SphereGeometry(40000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false,
      uniforms: { cA: { value: new THREE.Color() }, cM: { value: new THREE.Color() }, cB: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 cA; uniform vec3 cM; uniform vec3 cB; varying vec3 vP;\n' +
        'void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(cM, cA, smoothstep(0.12, 0.85, h)) : mix(cB, cM, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0);\n' +
        '#include <colorspace_fragment>\n}'
    }));
    cielo.renderOrder = -2; cielo.frustumCulled = false; escena.add(cielo);
    escena.fog = new THREE.Fog(0x8aa0b8, 18000, 70000);
    var nE = 600, eP = new Float32Array(nE * 3);
    for (var s = 0; s < nE; s++) { var a = s * 137.508 * RAD, hh = Math.asin(((s * 0.618) % 1) * 0.92 + 0.05); eP.set([Math.cos(hh) * Math.sin(a) * 34000, Math.sin(hh) * 34000, -Math.cos(hh) * Math.cos(a) * 34000], s * 3); }
    var eG = new THREE.BufferGeometry(); eG.setAttribute('position', new THREE.BufferAttribute(eP, 3));
    var estrellas = new THREE.Points(eG, new THREE.PointsMaterial({ color: 0xf3eee4, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    estrellas.frustumCulled = false; estrellas.renderOrder = -1; escena.add(estrellas);
    var lienzoTex = function (lado, fn) { var c = document.createElement('canvas'); c.width = c.height = lado; fn(c.getContext('2d'), lado); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    var solSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lienzoTex(128, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,244,214,1)'); r.addColorStop(0.2, 'rgba(255,220,150,1)'); r.addColorStop(0.34, 'rgba(255,200,120,.4)'); r.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); }), fog: false, depthWrite: false, transparent: true }));
    solSp.scale.set(3800, 3800, 1); solSp.renderOrder = -1; escena.add(solSp);
    var lunaMat = new THREE.SpriteMaterial({ fog: false, depthWrite: false, transparent: true }), lunaSp = new THREE.Sprite(lunaMat), lunaClave = '';
    lunaSp.scale.set(1900, 1900, 1); lunaSp.renderOrder = -1; escena.add(lunaSp);

    // luces: sol (con sombras en escritorio), luna y un cielo de relleno
    var luzSol = new THREE.DirectionalLight(0xffffff, 3), luzLuna = new THREE.DirectionalLight(0x9fb4d8, 0), hemi = new THREE.HemisphereLight(0xdfe8f0, 0x3a3328, 1.4);
    luzSol.castShadow = sombras;
    if (sombras) {
      luzSol.shadow.mapSize.set(2048, 2048);
      Object.assign(luzSol.shadow.camera, { left: -13500, right: 13500, top: 13500, bottom: -13500, near: 100, far: 65000 });
      luzSol.shadow.camera.updateProjectionMatrix();
      luzSol.shadow.bias = -0.0008; luzSol.shadow.normalBias = 45;
    }
    escena.add(luzSol, luzSol.target, luzLuna, luzLuna.target, hemi);
    var centro = new THREE.Vector3(0, yDe(1100), 0);
    luzSol.target.position.copy(centro); luzLuna.target.position.copy(centro);

    // la cámara en órbita
    var lug = T.lugares, objetivo = function (k, extra) { var l = lug[k]; return { tx: l.xz[0], ty: yDe(l.h) + (extra || 0), tz: l.xz[1] }; };
    var ajusteDist = function (d) { var asp = cam.aspect || 1.5, tf = Math.tan(cam.fov * RAD / 2); return Math.max(d, 24500 / (2 * asp * tf) * 0.9); };
    var VISTAS = {
      general: function () { return { tx: 0, ty: yDe(1000), tz: 0, dist: ajusteDist(19000), az: -0.45, pol: 1.06 }; },
      casa: function () { var o = objetivo('casa', 150); o.dist = movil ? 5200 : 4300; o.az = -0.35; o.pol = 1.12; return o; },
      puerto: function () { return { tx: 6200, ty: yDe(1750), tz: 2900, dist: movil ? 9200 : 7200, az: -0.7, pol: 1.16 }; },
      cielo: function () {
        var c = C.cielo(), A = c.sol.alt > -2 ? c.sol.az : (c.luna.alt > 0 ? c.luna.az : 100);
        return { tx: 0, ty: yDe(900), tz: 0, dist: ajusteDist(15500), az: -A * RAD, pol: 1.5 };
      }
    };
    var cam0 = VISTAS.general(), baseAz = cam0.az, vol = null, pend = false, visible = true, sucio = true, arr = null, dedo = false, vistaActual = 'general';
    var situar = function () {
      cam.position.set(cam0.tx + cam0.dist * Math.sin(cam0.pol) * Math.sin(cam0.az), cam0.ty + cam0.dist * Math.cos(cam0.pol), cam0.tz + cam0.dist * Math.sin(cam0.pol) * Math.cos(cam0.az));
      cam.lookAt(cam0.tx, cam0.ty, cam0.tz);
    };

    // rótulos: los pines HTML van a la altura de su lugar
    var vv = new THREE.Vector3();
    var colocar = function () {
      var w = caja.clientWidth, h = caja.clientHeight;
      C.pines.forEach(function (p) {
        var l = lug[p.k]; vv.set(l.xz[0], yDe(l.h) + 40, l.xz[1]).project(cam);
        if (vv.z > 1 || Math.abs(vv.x) > 1.05 || Math.abs(vv.y) > 1.05) { p.e.style.display = 'none'; return; }
        p.e.style.display = ''; p.e.style.transform = 'translate(' + ((vv.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - vv.y) / 2 * h).toFixed(1) + 'px)';
      });
    };

    // calidad adaptativa: si los fotogramas van lentos mientras se mueve, baja la resolución y quita sombras
    var muestras = [], tPrev = 0, fpsEl = C.fps;
    var vigilar = function (t) {
      if (tPrev && t - tPrev < 300) {
        muestras.push(t - tPrev);
        if (muestras.length >= 24) {
          var m = muestras.reduce(function (a, b) { return a + b; }, 0) / muestras.length; muestras.length = 0;
          if (fpsEl) fpsEl.textContent = Math.round(1000 / m) + ' fps · DPR ' + pr.toFixed(2) + (renderer.shadowMap.enabled ? ' · sombras' : '');
          if (m > 45) {
            if (pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); medir(); }
            else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; luzSol.castShadow = false; suelo.material.needsUpdate = true; }
          }
        }
      }
      tPrev = t;
    };
    var render = function (t) {
      pend = false;
      if (!visible || C.modo() !== '3d') return;
      if (vol) {
        var u = Math.min(1, (performance.now() - vol.t0) / vol.dur), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        ['tx', 'ty', 'tz', 'dist', 'az', 'pol'].forEach(function (k) { cam0[k] = lerp(vol.de[k], vol.a[k], e); });
        if (u < 1) pedir(); else { vol = null; tPrev = 0; }
      }
      situar();
      cielo.position.copy(cam.position); estrellas.position.copy(cam.position);
      var dS = C.dirSol, dL = C.dirLuna;
      solSp.position.copy(cam.position).addScaledVector(dS, 36000); lunaSp.position.copy(cam.position).addScaledVector(dL, 36000);
      if (sombras && sucio) { renderer.shadowMap.needsUpdate = true; }
      sucio = false;
      renderer.render(escena, cam);
      colocar();
      if (arr || vol) { vigilar(t || performance.now()); pedir(); } else tPrev = 0;
    };
    var pedir = function () { if (!pend) { pend = true; requestAnimationFrame(render); } };
    var medir = function () {
      var w = caja.clientWidth, h = caja.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      if (!arr && !vol && vistaActual === 'general') cam0 = Object.assign(cam0, VISTAS.general());
      pedir();
    };
    var volarA = function (a, dur) { vol = { t0: performance.now(), dur: C.movimiento ? dur : 1, de: Object.assign({}, cam0), a: a }; baseAz = a.az; tPrev = 0; pedir(); };
    var vista = function (k) { vistaActual = k; volarA(VISTAS[k](), 1500); };

    // gestos: ratón siempre; dedo solo con «Mover el puerto»
    var abajo = function (e) {
      if (e.pointerType !== 'mouse' && !dedo) return;
      arr = { x: e.clientX, y: e.clientY, az: cam0.az, pol: cam0.pol, id: e.pointerId }; vol = null; vistaActual = '';
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* sin captura */ }
      cv.classList.add('arrastrando'); pedir();
    };
    var mueve = function (e) {
      if (!arr || e.pointerId !== arr.id) return;
      cam0.az = lim(arr.az - (e.clientX - arr.x) / 260, baseAz - 1.3, baseAz + 1.3);
      cam0.pol = lim(arr.pol - (e.clientY - arr.y) / 420, 0.72, 1.52);
      pedir();
    };
    var suelta = function () { arr = null; cv.classList.remove('arrastrando'); };
    cv.addEventListener('pointerdown', abajo); cv.addEventListener('pointermove', mueve); cv.addEventListener('pointerup', suelta); cv.addEventListener('pointercancel', suelta);
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { sucio = true; pedir(); } });
    io.observe(caja);
    var ro = new ResizeObserver(medir); ro.observe(caja);

    // la luz de una fecha: sol, luna, cielo, estrellas
    function luz(c) {
      var s = c.sol, l = c.luna, dia = c.dia, noche = c.noche, col = coloresCielo(s.alt);
      var dir = function (az, alt) { return new THREE.Vector3(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD)); };
      var dS = dir(s.az, s.alt), dL = dir(l.az, l.alt);
      C.dirSol = dS; C.dirLuna = dL;
      cielo.material.uniforms.cA.value.set(col[0]); cielo.material.uniforms.cM.value.set(col[1]); cielo.material.uniforms.cB.value.set(col[2]);
      escena.fog.color.set(mezcla(col[2], col[1], 0.25));
      var dorado = lim(1 - s.alt / 20, 0, 1) * lim((s.alt + 3) / 6, 0, 1);
      luzSol.position.copy(centro).addScaledVector(dS, 30000);
      luzSol.intensity = 3.3 * lim((s.alt + 1) / 10, 0, 1);
      luzSol.color.set(mezcla('#fff3df', '#ff9a52', dorado));
      luzLuna.position.copy(centro).addScaledVector(dL, 30000);
      luzLuna.intensity = l.alt > 0 ? (0.35 + 1.5 * l.luz) * lim(l.alt / 8, 0, 1) * noche : 0;
      hemi.intensity = lerp(2.2, 1.5, dia);
      hemi.color.set(mezcla('#8aa0dc', '#e6edf4', dia)); hemi.groundColor.set(mezcla('#171b26', '#3a3328', dia));
      solSp.visible = s.alt > -3;
      lunaSp.visible = l.alt > -2 && l.luz > 0.03;
      if (lunaSp.visible) {
        var clave = l.luz.toFixed(2) + '|' + l.fase.toFixed(2);
        if (clave !== lunaClave) { lunaClave = clave; if (lunaMat.map) lunaMat.map.dispose(); lunaMat.map = lienzoTex(128, function (g, lado) { dibujarLuna(g, lado, l.luz, l.fase); }); lunaMat.needsUpdate = true; }
      }
      estrellas.material.opacity = noche * noche;
      sucio = true; pedir();
      return { luzSol: luzSol.intensity, luzLuna: luzLuna.intensity, estrellas: estrellas.material.opacity };
    }
    // la foto con la nieve ya pintada
    function textura(canvas) { if (tex.image !== canvas) tex.image = canvas; tex.needsUpdate = true; pedir(); }
    var mover = function (si) { dedo = si; cv.style.touchAction = si ? 'none' : 'pan-y'; if (!si) suelta(); };
    cv.style.touchAction = 'pan-y';
    medir();
    return {
      luz: luz, textura: textura, vista: vista, mover: mover, pedir: pedir, medir: medir,
      estado: function () { return { cam: Object.assign({}, cam0), pr: pr, sombras: renderer.shadowMap.enabled }; },
      destruir: function () {
        io.disconnect(); ro.disconnect(); cv.removeEventListener('pointerdown', abajo); cv.removeEventListener('pointermove', mueve); cv.removeEventListener('pointerup', suelta); cv.removeEventListener('pointercancel', suelta);
        try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* ya está */ }
      }
    };
  }

  /* =============== el módulo =============== */
  var PINES = [
    { k: 'casa', t: 'Casa María Juanín', cls: 'casa', l: 'r' },
    { k: 'fuentes', t: 'Fuentes de Invierno', cls: '', l: 'l' },
    { k: 'sanisidro', t: 'San Isidro', cls: '', l: 'ld' },
    { k: 'puerto', t: 'Puerto · 1.521 m', cls: 'menor', l: 'u' }
  ];

  function plantilla(movilTactil) {
    return '<div class="nv" data-modo="plano" data-nieve="espera" data-3d="no">' +
      '<div class="nv-barra">' +
      '<p class="nv-frase"></p>' +
      '<div class="nv-modos" role="group" aria-label="Cómo ver el puerto" hidden>' +
      '<button type="button" class="nv-b" data-act="plano" aria-pressed="true">Plano</button>' +
      '<button type="button" class="nv-b" data-act="3d" aria-pressed="false">Relieve 3D</button>' +
      '</div></div>' +
      '<div class="nv-escena" role="group" aria-label="Maqueta del Alto Aller, de Collanzo al puerto de San Isidro, con la nieve estimada de hoy">' +
      '<canvas class="nv-2d" aria-hidden="true"></canvas>' +
      '<canvas class="nv-3d" aria-hidden="true" hidden></canvas>' +
      '<div class="nv-pines" aria-hidden="true">' + PINES.map(function (p) {
        return '<span class="nv-pin ' + p.cls + '" style="display:none" data-k="' + p.k + '" data-l="' + p.l + '"><i class="nv-pin__punto"></i><b class="nv-pin__txt">' + esc(p.t) + '</b></span>';
      }).join('') + '</div>' +
      '<p class="nv-carga" role="status">Cargando el relieve del Alto Aller…</p>' +
      '<p class="nv-fps" hidden></p>' +
      '</div>' +
      '<div class="nv-ctl" hidden>' +
      '<div class="nv-vistas" role="group" aria-label="Puntos de vista" hidden>' +
      ['general:Vista general', 'casa:La casa', 'puerto:El puerto', 'cielo:El cielo'].map(function (s) { var a = s.split(':'); return '<button type="button" class="nv-b nv-b--v" data-vista="' + a[0] + '">' + a[1] + '</button>'; }).join('') +
      '</div>' +
      '<div class="nv-mando" hidden><button type="button" class="nv-b nv-mover" aria-pressed="false">Mover el puerto</button><p class="nv-ayuda" hidden>Arrastra para girar la maqueta. Pulsa «Soltar el puerto» para seguir bajando.</p></div>' +
      '</div>' +
      '<div class="nv-panel">' +
      '<div class="nv-col nv-nieve"><p class="nv-eti">La nieve de hoy</p><p class="nv-hoy" aria-live="polite">Pidiendo el dato…</p>' +
      '<p class="nv-aviso">Es una estimación de un modelo meteorológico para ese punto, no el parte de la estación.</p></div>' +
      '<div class="nv-col nv-tabla"><p class="nv-eti">Dos puntos del modelo</p><dl class="nv-filas"></dl></div>' +
      '<div class="nv-col nv-cielo"><p class="nv-eti">El cielo</p><div class="nv-cielo__fila"><canvas class="nv-luna" width="88" height="88" aria-hidden="true"></canvas><p class="nv-cielo__txt"></p></div>' +
      '<div class="nv-hora" role="group" aria-label="Hora del cielo"><button type="button" class="nv-b nv-b--h" data-hora="ahora" aria-pressed="true">Ahora</button><button type="button" class="nv-b nv-b--h" data-hora="mediodia" aria-pressed="false">A las 12:30</button></div></div>' +
      '</div>' +
      '<p class="nv-llegar"></p>' +
      '<p class="nv-credito">Relieve (MDT05) y ortofoto (PNOA): © <a href="https://www.ign.es" target="_blank" rel="noopener">Instituto Geográfico Nacional</a>, CC BY 4.0. Nieve: modelo de <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>. Remontes, pistas y carreteras: © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL). Relieve exagerado ×1,6.</p>' +
      '</div>';
  }

  function montar(el, op) {
    op = op || {};
    if (el.__nieve) return el.__nieve;
    var movimiento = op.movimiento !== false, sobria = op.densidad === 'sobria';
    var q = location.search, sinGL = /[?&]sin-webgl/.test(q), verFps = /[?&]fps/.test(q);
    var conn = navigator.connection || {}, ahorro = !!conn.saveData;
    var tactil = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    var movil = tactil || Math.min(screen.width || 9999, window.innerWidth) < 700;
    var base = baseDe(op), ahoraFn = function () { return op.ahora ? new Date(op.ahora) : new Date(); };
    var respaldo = Array.prototype.slice.call(el.childNodes);
    var raiz = document.createElement('div'); raiz.innerHTML = plantilla(); raiz = raiz.firstChild;
    el.replaceChildren(raiz); el.dataset.montado = '1';

    var $ = function (s) { return raiz.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(raiz.querySelectorAll(s)); };
    var escena = $('.nv-escena'), cv2 = $('.nv-2d'), cv3 = $('.nv-3d'), carga = $('.nv-carga');
    var pines = $$('.nv-pin').map(function (e) { return { e: e, k: e.dataset.k }; });
    var S = { modo: 'plano', hora: 'ahora', D: null, mapa: null, est: undefined, ctl: null, destruido: false, c3: false, compuesto2D: null, listo: false, gl: !sinGL && !sobria };
    var cielo = function () { return cieloDe(S.hora === 'ahora' ? ahoraFn() : (function () { var f = ahoraFn(); f.setHours(12, 30, 0, 0); return f; })()); };
    var fps = $('.nv-fps'); if (verFps) fps.hidden = false;
    var objetoNieve = function () { return S.est && S.est.hay ? { cota: S.est.cotaPintada, f: lim(S.est.espesor / 0.5, 0.02, 1) } : null; };

    /* ---- el texto del módulo ---- */
    function pintarTexto() {
      var T = S.D && S.D.T, c = cielo(), r = rotulo(S.est === undefined ? undefined : S.est);
      raiz.dataset.nieve = S.est === undefined ? 'espera' : r.cls;
      var hoy = $('.nv-hoy');
      hoy.textContent = S.est === undefined ? 'Pidiendo el dato…' : r.txt;
      var filas = $('.nv-filas');
      if (S.est) {
        filas.innerHTML = S.est.estaciones.map(function (e) {
          var cota = e.cotaNieve !== null ? 'cota de nieve ' + miles(e.cotaNieve) + ' m' : (e.isocero !== null ? 'isocero ' + miles(e.isocero) + ' m' : 'sin cota');
          return '<div class="nv-fila"><dt>' + esc(e.nombre) + '</dt><dd><span class="nv-cifra">' + (e.hay ? e.cm + ' cm' : 'sin nieve') + '</span><span>' + cota + '</span>' + (e.temp !== null ? '<span>' + coma(e.temp, 1) + ' °C</span>' : '') + '</dd></div>';
        }).join('');
        if (S.est.hay) filas.insertAdjacentHTML('beforeend', '<div class="nv-fila nv-fila--nota"><dt>Pintada</dt><dd><span>por encima de ' + miles(S.est.cotaPintada) + ' m</span></dd></div>');
      } else filas.innerHTML = '<div class="nv-fila nv-fila--nota"><dt>Dato</dt><dd><span>' + (S.est === undefined ? 'pidiéndolo…' : 'no disponible ahora') + '</span></dd></div>';
      $('.nv-cielo__txt').textContent = textoCielo(c, S.hora === 'ahora' ? 'Ahora, ' + hhmm(c.fecha) : 'A las 12:30 de hoy');
      dibujarLuna($('.nv-luna').getContext('2d'), 88, c.luna.luz, c.luna.fase);
      if (T && T.rutas) {
        var f = T.rutas.fuentes, s = T.rutas.sanisidro;
        $('.nv-frase').textContent = 'Así está hoy el puerto de San Isidro, a unos ' + Math.round((f.min + s.min) / 10) * 5 + ' minutos de la casa.';
        $('.nv-llegar').innerHTML = 'Por carretera desde la casa: <b class="nv-cifra">Fuentes de Invierno ' + f.min + ' min · ' + coma(f.km, 1) + ' km</b> · <b class="nv-cifra">San Isidro ' + s.min + ' min · ' + coma(s.km, 1) + ' km</b>. Cálculo de OSRM sin tráfico, nieve ni cadenas.';
      }
    }

    /* ---- el plano 2D ---- */
    var tr = { ox: 0, oy: 0, mw: 1, mh: 1, w: 0, h: 0 };
    function uv(x, z) { var T = S.D.T; return [(x / T.ancho + 0.5), (z / T.alto + 0.5)]; }
    function dibujar2D() {
      if (!S.compuesto2D) return;
      var w = escena.clientWidth, h = escena.clientHeight; if (!w || !h) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5), cw = Math.round(w * dpr), chh = Math.round(h * dpr);
      if (cv2.width !== cw || cv2.height !== chh) { cv2.width = cw; cv2.height = chh; }
      var g = cv2.getContext('2d'), R = S.mapa.ratio, mw = Math.max(w, h * R), mh = mw / R;
      tr = { ox: (w - mw) / 2, oy: (h - mh) / 2, mw: mw, mh: mh, w: w, h: h };
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      g.drawImage(S.compuesto2D, tr.ox, tr.oy, mw, mh);
      var P = S.D.pistas, T = S.D.T, pt = function (a) { var u = uv(a[0], a[1]); return [tr.ox + u[0] * mw, tr.oy + u[1] * mh]; };
      var trazo = function (pts, color, ancho, dash) { g.beginPath(); pts.forEach(function (a, i) { var p = pt(a); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.strokeStyle = color; g.lineWidth = ancho; g.setLineDash(dash || []); g.lineJoin = 'round'; g.stroke(); };
      (P.pistas || []).forEach(function (r) { trazo(r.p, 'rgba(241,238,231,.22)', 1); });
      (P.remontes || []).forEach(function (r) { trazo(r.p, 'rgba(241,238,231,.85)', 1.3); });
      if (T.carretera) trazo(T.carretera, 'rgba(242,169,59,.8)', 1.6);
      colocar2D(); S.dibujado = true;
    }
    function colocar2D() {
      pines.forEach(function (p) { var l = S.D.T.lugares[p.k], u = uv(l.xz[0], l.xz[1]); p.e.style.display = ''; p.e.style.transform = 'translate(' + (tr.ox + u[0] * tr.mw).toFixed(1) + 'px,' + (tr.oy + u[1] * tr.mh).toFixed(1) + 'px)'; });
    }
    var generacion = 0;
    async function recomponer() {
      if (!S.mapa) return;
      var mi = ++generacion, c = cielo();
      var luzObj = { alt: c.sol.alt, az: c.sol.az, dia: c.dia, lunaAlt: c.luna.alt, lunaAz: c.luna.az, lunaLuz: c.luna.luz };
      S.compuesto2D = await S.mapa.pintar(objetoNieve(), luzObj, S.compuesto2D);
      if (S.destruido || mi !== generacion) return;
      dibujar2D();
      if (S.ctl) { // la textura del 3D lleva la nieve pero no el sombreado: la pone Three.js
        S.tex3D = await S.mapa.pintar(objetoNieve(), null, S.tex3D);
        if (S.destruido || mi !== generacion) return;
        S.ctl.textura(S.tex3D); S.ctl.luz(c);
      }
    }
    var ro2 = new ResizeObserver(function () { var w = escena.clientWidth, h = escena.clientHeight; if (w === tr.w && h === tr.h) return; if (S.modo === 'plano') dibujar2D(); });
    ro2.observe(escena);

    /* ---- los modos ---- */
    function ponerModo(m) {
      S.modo = m; raiz.dataset.modo = m;
      cv2.hidden = m === '3d'; cv3.hidden = m !== '3d';
      $$('.nv-modos .nv-b').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.act === m)); });
      $('.nv-ctl').hidden = !(m === '3d' && S.ctl); $('.nv-vistas').hidden = false; $('.nv-mando').hidden = !(tactil || movil);
      if (m === '3d' && S.ctl) { S.ctl.medir(); S.ctl.luz(cielo()); S.ctl.pedir(); } else { if (S.ctl) S.ctl.mover(false); resetMover(); dibujar2D(); }
    }
    var movBtn = $('.nv-mover'), ayuda = $('.nv-ayuda');
    function resetMover() { movBtn.setAttribute('aria-pressed', 'false'); movBtn.textContent = 'Mover el puerto'; ayuda.hidden = true; }
    movBtn.addEventListener('click', function () {
      var si = movBtn.getAttribute('aria-pressed') !== 'true';
      movBtn.setAttribute('aria-pressed', String(si)); movBtn.textContent = si ? 'Soltar el puerto' : 'Mover el puerto'; ayuda.hidden = !si;
      if (S.ctl) S.ctl.mover(si);
    });
    async function activar3D() {
      if (S.c3 || !S.listo) return; S.c3 = true; raiz.dataset['3d'] = 'cargando';
      try {
        var C = { D: S.D, mapa: S.mapa, movil: movil, cv3d: cv3, escena: escena, pines: pines, fps: verFps ? fps : null, movimiento: movimiento, modo: function () { return S.modo; }, cielo: cielo, dirSol: null, dirLuna: null };
        // el cielo debe existir antes de crear: lo pone luz()
        S.ctl = await crear3D(C);
        if (S.destruido) { S.ctl.destruir(); return; }
        raiz.dataset['3d'] = 'si';
        S.tex3D = await S.mapa.pintar(objetoNieve(), null, S.tex3D);
        S.ctl.textura(S.tex3D); S.ctl.luz(cielo());
        if (S.pidio3D || !ahorro) ponerModo('3d');
      } catch (e) {
        S.ctl = null; raiz.dataset['3d'] = 'no'; $('.nv-modos').hidden = true;
        if (window.console) console.warn('[nieve] sin 3D, queda el plano:', e && e.message);
      }
    }
    $$('.nv-modos .nv-b').forEach(function (b) { b.addEventListener('click', function () {
      if (b.dataset.act === '3d') { S.pidio3D = true; if (!S.ctl) { activar3D(); return; } }
      ponerModo(b.dataset.act);
    }); });
    $$('.nv-b--v').forEach(function (b) { b.addEventListener('click', function () { if (S.ctl) S.ctl.vista(b.dataset.vista); }); });
    $$('.nv-b--h').forEach(function (b) { b.addEventListener('click', function () {
      S.hora = b.dataset.hora; $$('.nv-b--h').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      pintarTexto(); recomponer();
    }); });
    // al salir de pantalla, suelta el gesto del dedo (el scroll vuelve a ser del usuario)
    var ioSuelta = new IntersectionObserver(function (es) { if (!es[0].isIntersecting && movBtn.getAttribute('aria-pressed') === 'true') { resetMover(); if (S.ctl) S.ctl.mover(false); } });
    ioSuelta.observe(escena);

    /* ---- los datos: terreno y tiempo, en paralelo ---- */
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null, temporizador = ctrl && setTimeout(function () { ctrl.abort(); }, 9000);
    var pTerreno = cargarTerreno(base, movil || ahorro);
    var pTiempo = pTerreno.then(function (D) {
      return fetch(urlTiempo({ fuentes: { lat: D.T.lugares.fuentes.lat, lon: D.T.lugares.fuentes.lon }, sanisidro: { lat: D.T.lugares.sanisidro.lat, lon: D.T.lugares.sanisidro.lon } }), ctrl ? { signal: ctrl.signal } : {})
        .then(function (r) { if (!r.ok) throw new Error('Open-Meteo ' + r.status); return r.json(); })
        .then(interpretar);
    });
    // Open-Meteo necesita las coordenadas de los dos puntos: salen del terreno.json (lat/lon de cada lugar)
    pTerreno.then(function (D) {
      if (S.destruido) return;
      S.D = D; S.mapa = crearMapa(D); S.listo = true;
      var espera = new Promise(function (ok) { setTimeout(ok, 4500, 'tarde'); });
      return Promise.race([pTiempo.then(function (e) { return { e: e }; }, function () { return { e: null }; }), espera]).then(function (r) {
        S.est = r && r !== 'tarde' ? r.e : null;
        carga.hidden = true;
        pintarTexto();
        return recomponer().then(function () {
          if (S.destruido) return;
          // por si el dato llega tarde: se vuelve a pintar
          if (r === 'tarde') pTiempo.then(function (e) { S.est = e; pintarTexto(); recomponer(); }, function () { S.est = null; pintarTexto(); });
          // ¿hay 3D? Solo si se puede y se quiere
          if (S.gl && 'WebGLRenderingContext' in window) {
            $('.nv-modos').hidden = false;
            if (!ahorro) activar3D();
          }
        });
      });
    }).catch(function (e) {
      // el terreno no llega: se devuelve el respaldo tal cual
      if (window.console) console.warn('[nieve] se queda el respaldo:', e && e.message);
      destruir();
    });
    pTiempo.then(function () { clearTimeout(temporizador); }, function () { clearTimeout(temporizador); });

    function destruir() {
      if (S.destruido) return; S.destruido = true; generacion++;
      ro2.disconnect(); ioSuelta.disconnect(); if (S.ctl) S.ctl.destruir();
      if (ctrl) { try { ctrl.abort(); } catch (e) { /* ya */ } }
      el.replaceChildren.apply(el, respaldo); delete el.dataset.montado; delete el.__nieve;
    }
    el.__nieve = {
      destruir: destruir,
      estado: function () { return { modo: S.modo, est: S.est, listo: S.listo, dibujado: !!S.dibujado, tres: !!S.ctl, nieve: objetoNieve(), cam: S.ctl && S.ctl.estado() }; }
    };
    return el.__nieve;
  }

  J.nieve = { montar: montar, sol: sol, luna: luna, interpretar: interpretar, rotulo: rotulo, urlTiempo: urlTiempo, coloresCielo: coloresCielo, version: '1.0' };
})();
