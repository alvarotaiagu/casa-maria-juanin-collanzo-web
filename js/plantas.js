/* Plantas · «Tres plantas, tres historias» (Casa María Juanín)
   Contrato: window.Juanin.plantas.montar(el, { movimiento, densidad, raiz, datos })
   - El HTML de `el` es el respaldo (lo escribe la web) y se queda si el JS o el JSON fallan.
   - Lee data/apartamentos.json (una sola fuente) y, si existe, img/fotos/fotos.json (tamaños de las fotos).
   - Lanza `juanin:apartamento` (detail = { id }) al pulsar «Reservar este».
   - Sin globales salvo window.Juanin.plantas.
   Modos: «sube» (alzado fijo con la aguja que sube de planta con el scroll) y «rejilla»
   (movimiento:false, densidad 'sobria' o prefers-reduced-motion: tres fichas en rejilla, sin movimiento). */
(function () {
  'use strict';

  var J = (window.Juanin = window.Juanin || {});
  var NS = 'http://www.w3.org/2000/svg';
  var NOMBRE_ESTANCIA = { salon: 'Salón', cocina: 'Cocina', dormitorio: 'Dormitorios', bano: 'Baño', vista: 'Desde la ventana', detalle: 'Detalle' };
  var ORDEN_ESTANCIA = { salon: 0, cocina: 1, dormitorio: 2, bano: 3 };

  /* ------------------------------------------------------------------ utilidades */
  function el(tag, attrs, hijos) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (hijos || []).forEach(function (h) { if (h) n.appendChild(h); });
    return n;
  }
  function sv(tag, attrs, hijos) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    (hijos || []).forEach(function (h) { if (h) n.appendChild(h); });
    return n;
  }
  function pedirJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
  function px(v) { return parseFloat(v) || 0; }

  /* ------------------------------------------------------------------ datos */
  function normalizar(a, meta, dir) {
    var pl = a.plazas;
    var plazas, supuesto = false;
    if (pl && typeof pl === 'object') {
      plazas = pl.fijas && pl.max && pl.fijas !== pl.max ? pl.fijas + '-' + pl.max : String(pl.max || pl.fijas || '');
      if (!plazas && pl.texto) plazas = (String(pl.texto).match(/\d+(?:\s*(?:a|-)\s*\d+)?/) || [''])[0].replace(/\s*a\s*/, '-');
      supuesto = !!pl.supuesto;
    } else plazas = String(pl == null ? '' : pl);
    var d = a.dormitorios;
    var dormN = d && typeof d === 'object' ? d.numero : d;
    var dormE = d && typeof d === 'object' && d.texto ? String(d.texto).replace(/^\d+\s*/, '') : 'dormitorios';
    var n = a.planta;
    var fotos = (a.fotos || []).map(function (f) {
      var m = (meta && meta[f.nombre]) || {};
      return {
        nombre: f.nombre, estancia: f.estancia || 'fotos', texto: f.estancia_texto || f.estancia || '', alt: f.alt || '',
        w: m.ancho || 800, h: m.alto || 600, anchos: m.anchos || [480, 800], dir: dir
      };
    });
    var grupos = [], mapa = {};
    fotos.forEach(function (f) {
      var g = mapa[f.estancia];
      if (!g) { g = mapa[f.estancia] = { id: f.estancia, textos: [], fotos: [] }; grupos.push(g); }
      g.fotos.push(f);
      if (g.textos.indexOf(f.texto) < 0) g.textos.push(f.texto);
    });
    grupos.forEach(function (g, i) { g._i = i; g.nombre = g.textos.length === 1 && g.textos[0] ? g.textos[0] : (NOMBRE_ESTANCIA[g.id] || g.textos[0] || g.id); g.distintos = g.textos.length > 1; });
    grupos.sort(function (x, y) {
      var rx = x.id in ORDEN_ESTANCIA ? ORDEN_ESTANCIA[x.id] : 9, ry = y.id in ORDEN_ESTANCIA ? ORDEN_ESTANCIA[y.id] : 9;
      return rx - ry || x._i - y._i;
    });
    return {
      id: a.id, nombre: a.nombre, planta: n, plantaTexto: a.planta_texto || (n + '.ª planta'), historia: a.historia || '',
      plazas: plazas, supuesto: supuesto, dormN: dormN, dormE: dormE, bano: a.bano || '', calefaccion: a.calefaccion || '',
      suyo: a.lo_suyo || (a.notas && a.notas[0]) || '', grupos: grupos,
      serie: grupos.reduce(function (t, g) { return t.concat(g.fotos); }, [])
    };
  }

  /* ------------------------------------------------------------------ imágenes (nunca más anchas que su original) */
  function ruta(f, ancho, fmt) { return f.dir + f.nombre + '-' + ancho + '.' + fmt; }
  function srcset(f, fmt) { return f.anchos.map(function (a) { return ruta(f, a, fmt) + ' ' + a + 'w'; }).join(', '); }
  function imagen(f, sizes, id) {
    var mayor = Math.max.apply(null, f.anchos);
    var pic = el('picture', null, [
      el('source', { type: 'image/avif', srcset: srcset(f, 'avif'), sizes: sizes }),
      el('source', { type: 'image/webp', srcset: srcset(f, 'webp'), sizes: sizes }),
      el('img', { id: id, src: ruta(f, mayor, 'jpg'), srcset: srcset(f, 'jpg'), sizes: sizes, alt: f.alt, width: f.w, height: f.h, decoding: 'async', loading: id ? null : 'lazy', 'data-foto': f.nombre })
    ]);
    return pic;
  }

  /* ------------------------------------------------------------------ alzado (corte de arquitecto, a línea) */
  var SUELO = 450, PISO = 110, X0 = 150, X1 = 610, GX0 = 30, GX1 = 150, TECHO = 120;
  function alzado() {
    var s = sv('svg', { class: 'pl-alzado', viewBox: '0 0 730 510', role: 'img', focusable: 'false', 'aria-label': 'Alzado de la casa: tres plantas y la galería acristalada' });
    var g = function (cls, hijos, extra) { var a = { class: cls }; if (extra) for (var k in extra) a[k] = extra[k]; return sv('g', a, hijos); };
    var ln = function (x1, y1, x2, y2, cls) { return sv('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: cls || '' }); };
    var rc = function (x, y, w, h, cls) { return sv('rect', { x: x, y: y, width: w, height: h, class: cls || '' }); };
    var tx = function (x, y, t, cls, extra) { var a = { x: x, y: y, class: cls || '' }; if (extra) for (var k in extra) a[k] = extra[k]; var n = sv('text', a); n.textContent = t; return n; };
    var i, j;

    /* franjas de planta (resaltado y zona de pulsación) */
    var hl = [], hit = [];
    for (i = 0; i < 3; i++) {
      var top = SUELO - (i + 1) * PISO;
      hl.push(rc(GX0 - 4, top, X1 - GX0 + 4, PISO, 'pl-a-hl'));
      hit.push(sv('rect', { x: GX0 - 4, y: top, width: X1 - GX0 + 40, height: PISO, class: 'pl-a-hit', 'data-i': i, 'aria-hidden': 'true' }));
    }
    s.appendChild(g('pl-a-franjas', hl));

    /* tejado a cuatro aguas: tejas */
    var tejado = [sv('path', { class: 'pl-a-l', d: 'M128 112 L196 54 L564 54 L632 112 Z' })];
    for (i = 1; i < 5; i++) {
      var y = 54 + i * 11.6, k = (y - 54) / 58, xa = 196 - 68 * k, xb = 564 + 68 * k;
      tejado.push(ln(xa.toFixed(1), y.toFixed(1), xb.toFixed(1), y.toFixed(1), 'pl-a-fino'));
    }
    tejado.push(rc(128, 112, 504, 8, 'pl-a-l'));
    s.appendChild(g('pl-a-tejado', tejado));

    /* muro y forjados */
    var muro = [rc(X0, TECHO, X1 - X0, SUELO - TECHO, 'pl-a-l pl-a-muro'), ln(X0, 230, X1, 230, 'pl-a-fino'), ln(X0, 340, X1, 340, 'pl-a-fino')];
    /* franja de ladrillo de la planta baja (detalle en teja) */
    muro.push(rc(X0, 398, X1 - X0, SUELO - 398, 'pl-a-ladrillo'));
    for (i = 1; i < 6; i++) muro.push(ln(X0, 398 + i * 8.7, X1, 398 + i * 8.7, 'pl-a-ladrillo-hilada'));
    s.appendChild(g('pl-a-muro-g', muro));

    /* ventanas y puerta: cinco huecos por planta en la misma rejilla */
    var huecos = [], cx = [235, 320, 405, 490, 575];
    for (i = 0; i < 3; i++) {
      var base = SUELO - i * PISO;
      for (j = 0; j < 5; j++) {
        if (i === 0 && j === 0) {
          huecos.push(rc(215, base - 78, 40, 78, 'pl-a-l pl-a-hueco'), ln(215, base - 60, 255, base - 60, 'pl-a-fino'), ln(235, base - 60, 235, base, 'pl-a-fino'));
          continue;
        }
        var wx = cx[j] - 18, wy = base - 80;
        if (i < 2) huecos.push(rc(wx - 5, wy - 6, 46, 62, 'pl-a-dintel'));
        huecos.push(rc(wx, wy, 36, 52, 'pl-a-l pl-a-hueco'), ln(cx[j], wy, cx[j], wy + 52, 'pl-a-fino'), ln(wx, wy + 17, wx + 36, wy + 17, 'pl-a-fino'), rc(wx - 4, wy + 52, 44, 3, 'pl-a-l pl-a-hueco'));
      }
    }
    s.appendChild(g('pl-a-huecos', huecos));

    /* galería acristalada (azul) con su zócalo de piedra */
    var gal = [rc(GX0 + 4, TECHO, GX1 - GX0 - 8, 290, 'pl-a-vidrio'), rc(GX0 - 4, 108, GX1 - GX0 + 8, 12, 'pl-a-gl'), ln(90, TECHO, 90, 410, 'pl-a-gl pl-a-gl-fino'),
      ln(GX0 + 4, 230, GX1 - 4, 230, 'pl-a-gl pl-a-gl-fino'), ln(GX0 + 4, 340, GX1 - 4, 340, 'pl-a-gl pl-a-gl-fino'),
      ln(GX0 + 4, 175, GX1 - 4, 175, 'pl-a-gl-hilo'), ln(GX0 + 4, 285, GX1 - 4, 285, 'pl-a-gl-hilo'), ln(GX0 + 4, 375, GX1 - 4, 375, 'pl-a-gl-hilo'),
      rc(GX0 + 4, 410, GX1 - GX0 - 8, 40, 'pl-a-l'), ln(GX0 + 4, 423, GX1 - 4, 423, 'pl-a-fino'), ln(GX0 + 4, 436, GX1 - 4, 436, 'pl-a-fino'),
      ln(62, 410, 62, 423, 'pl-a-fino'), ln(112, 423, 112, 436, 'pl-a-fino'), ln(80, 436, 80, 450, 'pl-a-fino')];
    s.appendChild(g('pl-a-galeria', gal));
    s.appendChild(tx(GX0, 94, 'galería', 'pl-a-rotulo pl-a-rotulo--gal'));

    /* suelo */
    s.appendChild(g('pl-a-suelo', [ln(10, SUELO, 640, SUELO, 'pl-a-l'), ln(10, SUELO + 5, 640, SUELO + 5, 'pl-a-fino')]));

    /* cotas: niveles a la derecha, ancho debajo */
    var cotas = [ln(664, TECHO, 664, SUELO, 'pl-a-cota')];
    [TECHO, 230, 340, SUELO].forEach(function (yy) {
      cotas.push(ln(654, yy + 5, 674, yy - 5, 'pl-a-cota'));
      cotas.push(ln(X1 + 8, yy, 676, yy, 'pl-a-fino pl-a-ext'));
    });
    var nums = [];
    for (i = 0; i < 3; i++) nums.push(tx(686, SUELO - i * PISO - PISO / 2 + 5, (i + 1) + '.ª', 'pl-a-nivel', { 'data-i': i }));
    s.appendChild(g('pl-a-cotas', cotas.concat(nums)));
    s.appendChild(g('pl-a-ancho', [ln(GX0, 478, X1, 478, 'pl-a-cota'), ln(GX0 - 5, 483, GX0 + 5, 473, 'pl-a-cota'), ln(X1 - 5, 483, X1 + 5, 473, 'pl-a-cota'),
      tx((GX0 + X1) / 2, 500, 'Ctra. General 48, Collanzo', 'pl-a-rotulo', { 'text-anchor': 'middle' })]));

    /* aguja: línea de corte con muescas, sube de planta */
    var aguja = g('pl-a-aguja', [
      ln(24, 0, 662, 0, 'pl-a-corte'),
      sv('path', { class: 'pl-a-muesca', d: 'M8 -6 L22 0 L8 6 Z' }),
      sv('path', { class: 'pl-a-muesca', d: 'M678 -6 L664 0 L678 6 Z' })
    ]);
    s.appendChild(aguja);
    s.appendChild(g('pl-a-zonas', hit));

    var titulo = sv('title'); titulo.textContent = 'Alzado de la casa: tres plantas y la galería acristalada';
    s.insertBefore(titulo, s.firstChild);

    return {
      svg: s, franjas: hl, niveles: nums,
      /* p: 0 = 1.ª planta, 2 = 3.ª planta (decimales: entre plantas) */
      poner: function (p) { aguja.setAttribute('transform', 'translate(0 ' + (SUELO - PISO / 2 - p * PISO).toFixed(2) + ')'); },
      activa: function (i) {
        hl.forEach(function (r, k) { r.classList.toggle('is-activa', k === i); });
        nums.forEach(function (r, k) { r.classList.toggle('is-activa', k === i); });
      }
    };
  }

  /* ------------------------------------------------------------------ visor (se abre por NOMBRE de la foto) */
  function crearVisor() {
    var dlg = el('dialog', { class: 'pl-visor', 'aria-label': 'Visor de fotos' });
    var cerrar = el('button', { type: 'button', class: 'pl-visor-cerrar', 'aria-label': 'Cerrar el visor' }, [el('span', { 'aria-hidden': 'true', text: '×' })]);
    var marco = el('div', { class: 'pl-visor-marco' });
    var ant = el('button', { type: 'button', class: 'pl-visor-nav pl-visor-ant', 'aria-label': 'Foto anterior' }, [el('span', { 'aria-hidden': 'true', text: '‹' })]);
    var sig = el('button', { type: 'button', class: 'pl-visor-nav pl-visor-sig', 'aria-label': 'Foto siguiente' }, [el('span', { 'aria-hidden': 'true', text: '›' })]);
    var pie = el('p', { class: 'pl-visor-pie' });
    var cuenta = el('span', { class: 'pl-visor-cuenta' });
    var cap = el('span', { class: 'pl-visor-cap' });
    pie.appendChild(cap); pie.appendChild(cuenta);
    dlg.appendChild(cerrar); dlg.appendChild(marco); dlg.appendChild(ant); dlg.appendChild(pie); dlg.appendChild(sig);

    var serie = [], idx = 0, titulo = '', origen = null;
    function mostrar() {
      var f = serie[idx];
      marco.textContent = '';
      var pic = imagen(f, '(min-width: 900px) 800px, 100vw', 'pl-visor-img');
      marco.appendChild(pic);
      cap.textContent = titulo + ' · ' + (f.texto || '') ;
      cuenta.textContent = (idx + 1) + ' de ' + serie.length;
      dlg.setAttribute('aria-label', 'Fotos de ' + titulo);
      /* adelanta las vecinas */
      [1, -1].forEach(function (d) { var v = serie[(idx + d + serie.length) % serie.length]; if (v) { var i = new Image(); i.src = ruta(v, Math.max.apply(null, v.anchos), 'jpg'); } });
    }
    function ir(d) { idx = (idx + d + serie.length) % serie.length; mostrar(); }
    cerrar.addEventListener('click', function () { dlg.close(); });
    ant.addEventListener('click', function () { ir(-1); });
    sig.addEventListener('click', function () { ir(1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === marco) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); ir(1); }
    });
    dlg.addEventListener('close', function () { marco.textContent = ''; if (origen && origen.isConnected) origen.focus({ preventScroll: true }); origen = null; });
    /* deslizar con el dedo */
    var x0 = null, y0 = 0;
    marco.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; });
    marco.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(dx < 0 ? 1 : -1);
    });
    marco.addEventListener('pointercancel', function () { x0 = null; });

    return {
      nodo: dlg,
      abrir: function (ap, nombre, desde) {
        serie = ap.serie; titulo = ap.nombre; origen = desde || null;
        idx = 0;
        for (var i = 0; i < serie.length; i++) if (serie[i].nombre === nombre) { idx = i; break; }
        mostrar();
        if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
        cerrar.focus({ preventScroll: true });
      },
      cerrar: function () { if (dlg.open) dlg.close(); }
    };
  }

  /* ------------------------------------------------------------------ una ficha */
  function ficha(ap, ctx) {
    var pre = 'pl-' + ap.id;
    var cifras = el('ul', { class: 'pl-cifras', 'aria-label': 'Cifras de ' + ap.nombre }, [
      el('li', { class: 'pl-cifra', 'data-k': 'plazas' }, [
        el('span', { class: 'pl-cifra-v', text: ap.plazas }), el('span', { class: 'pl-cifra-e', text: 'personas' }),
        ap.supuesto ? el('span', { class: 'pl-cifra-n', text: 'por confirmar' }) : null
      ]),
      el('li', { class: 'pl-cifra', 'data-k': 'dormitorios' }, [el('span', { class: 'pl-cifra-v', text: String(ap.dormN) }), el('span', { class: 'pl-cifra-e', text: ap.dormE })]),
      el('li', { class: 'pl-cifra pl-cifra--txt', 'data-k': 'bano', text: ap.bano }),
      el('li', { class: 'pl-cifra pl-cifra--txt', 'data-k': 'calefaccion', text: ap.calefaccion })
    ]);

    var reservar = el('a', { class: 'pl-reservar', href: '#reservar', 'data-id': ap.id, 'aria-label': 'Reservar este apartamento: ' + ap.nombre }, [el('span', { text: 'Reservar este' })]);
    reservar.addEventListener('click', function (e) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('juanin:apartamento', { detail: { id: ap.id } }));
      /* si la reserva no se ha movido sola, baja a ella */
      if (!(J.reservar && typeof J.reservar === 'function')) {
        var r = document.getElementById('reservar');
        if (r) r.scrollIntoView({ behavior: ctx.mov ? 'smooth' : 'auto', block: 'start' });
      }
    });

    /* galería por estancias */
    var chips = [], filas = [];
    ap.grupos.forEach(function (g) {
      var fid = pre + '-' + g.id;
      var chip = el('button', { type: 'button', class: 'pl-chip', 'data-est': g.id }, [el('span', { text: g.nombre }), el('span', { class: 'pl-chip-n', text: String(g.fotos.length) })]);
      var fotos = g.fotos.map(function (f) {
        var b = el('button', { type: 'button', class: 'pl-foto', 'data-foto': f.nombre, 'aria-haspopup': 'dialog', 'aria-label': 'Ampliar foto: ' + f.alt });
        b.style.setProperty('--w', f.w);
        var pic = imagen(f, '(min-width: 1100px) 400px, (min-width: 600px) 45vw, 92vw', null);
        pic.querySelector('img').setAttribute('alt', '');
        b.appendChild(pic);
        return el('figure', { class: 'pl-fig' }, [b, g.distintos ? el('figcaption', { class: 'pl-pie', text: f.texto }) : null]);
      });
      var lado = null;
      if (g.fotos.length === 1) lado = el('p', { class: 'pl-pie pl-pie--lado', text: g.fotos[0].alt });
      var fila = el('section', { class: 'pl-fila', id: fid, 'data-est': g.id, 'aria-labelledby': fid + '-t' }, [
        el('h4', { class: 'pl-fila-t', id: fid + '-t', text: g.nombre }),
        el('div', { class: 'pl-fotos', 'data-n': Math.min(g.fotos.length, 4) }, fotos.concat(lado ? [lado] : []))
      ]);
      chip.addEventListener('click', function () {
        fila.scrollIntoView({ behavior: ctx.mov ? 'smooth' : 'auto', block: 'start' });
        marcarEstancia(g.id);
      });
      chips.push(chip); filas.push(fila);
    });
    function marcarEstancia(id) {
      chips.forEach(function (c) { var on = c.getAttribute('data-est') === id; c.classList.toggle('is-activa', on); if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    }
    marcarEstancia(ap.grupos[0] && ap.grupos[0].id);

    var galeria = el('div', { class: 'pl-galeria' }, [
      el('nav', { class: 'pl-est', 'aria-label': 'Estancias de ' + ap.nombre }, chips),
      el('div', { class: 'pl-filas' }, filas)
    ]);
    galeria.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.pl-foto') : null;
      if (b) ctx.visor.abrir(ap, b.getAttribute('data-foto'), b);
    });

    var titulo = el('h3', { class: 'pl-nombre', id: pre + '-t', tabindex: '-1', text: ap.nombre });
    var art = el('article', { class: 'pl-ap', id: pre, 'data-id': ap.id, 'data-planta': ap.planta, 'aria-labelledby': pre + '-t' }, [
      el('header', { class: 'pl-cab' }, [el('p', { class: 'pl-planta', text: ap.plantaTexto }), titulo]),
      el('div', { class: 'pl-datos' }, [
        el('div', { class: 'pl-relato' }, [
          ap.historia ? el('div', { class: 'pl-bloque' }, [el('p', { class: 'pl-etq', text: 'Por qué se llama así' }), el('p', { class: 'pl-historia', text: ap.historia })]) : null,
          ap.suyo ? el('div', { class: 'pl-bloque' }, [el('p', { class: 'pl-etq', text: 'Lo suyo' }), el('p', { class: 'pl-suyo', text: ap.suyo })]) : null
        ]),
        el('div', { class: 'pl-ficha' }, [cifras, reservar])
      ]),
      galeria
    ]);
    return { art: art, titulo: titulo, filas: filas, marcarEstancia: marcarEstancia };
  }

  /* ------------------------------------------------------------------ montar */
  function montar(el0, opciones) {
    opciones = opciones || {};
    var vivo = true, limpiezas = [];
    var original = Array.prototype.slice.call(el0.childNodes);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opciones.densidad === 'sobria';
    var mov = opciones.movimiento !== false && !reduce;
    var rejilla = sobria || !mov;
    var raiz = opciones.raiz || '';
    var dirFotos = raiz + (opciones.dirFotos || 'img/fotos/');

    var pDatos = opciones.datos ? Promise.resolve(opciones.datos) : pedirJSON(raiz + 'data/apartamentos.json');
    var pMeta = pedirJSON(dirFotos + 'fotos.json').then(function (lista) {
      var m = {}; (lista || []).forEach(function (x) { m[x.nombre] = x; }); return m;
    }).catch(function () { return {}; });

    Promise.all([pDatos, pMeta]).then(function (r) {
      if (!vivo) return;
      construir(r[0], r[1]);
    }).catch(function () { /* se queda el respaldo escrito por la web */ });

    function construir(datos, meta) {
      var aps = (datos.apartamentos || []).map(function (a) { return normalizar(a, meta, dirFotos); });
      aps.sort(function (a, b) { return a.planta - b.planta; });
      if (!aps.length) return;

      var ctx = { mov: mov, visor: crearVisor() };
      var alz = alzado();
      var fichas = aps.map(function (ap) { return ficha(ap, ctx); });

      /* índice: alzado + una botonera por planta (3.ª arriba en pantalla, el orden del DOM es 1.ª, 2.ª, 3.ª) */
      var botones = aps.map(function (ap, i) {
        return el('li', null, [el('button', { type: 'button', class: 'pl-planta-btn', 'data-i': i, 'aria-label': 'Ir a la ' + ap.plantaTexto + ': ' + ap.nombre }, [
          el('span', { class: 'pl-planta-n', text: ap.planta + '.ª' }), el('span', { class: 'pl-planta-nom', text: ap.nombre })
        ])]);
      });
      var indice = el('div', { class: 'pl-indice' }, [
        el('div', { class: 'pl-alzado-caja' }, [alz.svg]),
        el('nav', { class: 'pl-plantas', 'aria-label': 'Plantas de la casa' }, [el('ol', null, botones)])
      ]);
      var lista = el('div', { class: 'pl-lista' }, fichas.map(function (f) { return f.art; }));
      var escena = el('div', { class: 'pl-escena' }, [indice, lista]);
      var raizMod = el('div', { class: 'pl-raiz' }, [escena, ctx.visor.nodo]);

      el0.dataset.modo = rejilla ? 'rejilla' : 'sube';
      el0.dataset.densidad = sobria ? 'sobria' : 'sintonia';
      el0.textContent = '';
      el0.appendChild(raizMod);

      /* ---------------- estado: planta activa y aguja ---------------- */
      var activo = -1, cur = 0, objetivo = 0, raf = 0;
      function fijar(i) {
        if (i === activo) return;
        activo = i;
        el0.dataset.planta = i < 0 ? '' : String(aps[i].planta);
        alz.activa(i);
        fichas.forEach(function (f, k) { f.art.classList.toggle('is-activa', k === i); });
        el0.querySelectorAll('.pl-planta-btn').forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      }
      function pintar() { alz.poner(cur); el0.dataset.p = cur.toFixed(3); }
      function paso() {
        raf = 0;
        var d = objetivo - cur;
        if (Math.abs(d) < 0.002) { cur = objetivo; pintar(); return; }
        cur += d * 0.2; pintar(); raf = requestAnimationFrame(paso);
      }
      function mover(p, sinInercia) {
        objetivo = p;
        if (sinInercia || !mov) { cur = p; pintar(); return; }
        if (!raf) raf = requestAnimationFrame(paso);
      }
      var mqMovil = window.matchMedia('(max-width: 899.98px)');
      function cabecera() { return px(getComputedStyle(el0).getPropertyValue('--pl-cab')) || 72; }
      function franja() { return mqMovil.matches && !rejilla ? indice.getBoundingClientRect().height : 0; }

      function calcular() {
        var tops = fichas.map(function (f) { return f.art.getBoundingClientRect().top; });
        var cab = cabecera();
        var linea = cab + franja() + (innerHeight - cab) * 0.3;
        var i = 0;
        for (var k = 0; k < tops.length; k++) if (tops[k] <= linea) i = k;
        var p = i;
        if (tops[0] > linea) p = 0;
        else if (i < tops.length - 1) p = i + Math.max(0, Math.min(1, (linea - tops[i]) / (tops[i + 1] - tops[i])));
        fijar(i); mover(p);
      }

      /* una ficha, a la vista: scroll hasta su cabecera (o solo enfoque si están en fila) */
      function irA(i) {
        var f = fichas[i];
        var enFila = rejilla && fichas.length > 1 && Math.abs(fichas[0].art.getBoundingClientRect().top - fichas[1].art.getBoundingClientRect().top) < 4;
        fijar(i); mover(i, rejilla);
        if (!enFila) {
          var top = f.art.getBoundingClientRect().top + scrollY - (cabecera() + franja() + 16);
          scrollTo({ top: Math.max(0, top), behavior: mov ? 'smooth' : 'auto' });
        } else if (f.art.getBoundingClientRect().top < cabecera() || f.art.getBoundingClientRect().top > innerHeight * 0.6) {
          f.art.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
        f.titulo.focus({ preventScroll: true });
      }
      el0.querySelectorAll('.pl-planta-btn').forEach(function (b) { b.addEventListener('click', function () { irA(+b.getAttribute('data-i')); }); });
      el0.querySelectorAll('.pl-a-hit').forEach(function (z) { z.addEventListener('click', function () { irA(+z.getAttribute('data-i')); }); });
      mover(0, true); alz.poner(0); el0.dataset.p = '0.000';

      if (rejilla) {
        /* sin sticky ni aguja viajera: la planta se marca al tocar, pasar o enfocar una ficha */
        el0.classList.add('pl--sin-aguja');
        fichas.forEach(function (f, k) {
          var on = function () { fijar(k); mover(k, true); };
          f.art.addEventListener('pointerenter', on); f.art.addEventListener('focusin', on);
        });
      } else {
        var visible = false, tick = 0;
        var pedir = function () { if (!tick) tick = requestAnimationFrame(function () { tick = 0; calcular(); }); };
        var io = new IntersectionObserver(function (es) {
          var v = es[0].isIntersecting;
          if (v === visible) return; visible = v;
          if (v) { addEventListener('scroll', pedir, { passive: true }); addEventListener('resize', pedir); calcular(); }
          else { removeEventListener('scroll', pedir); removeEventListener('resize', pedir); }
        }, { rootMargin: '200px 0px' });
        io.observe(el0);
        limpiezas.push(function () { io.disconnect(); removeEventListener('scroll', pedir); removeEventListener('resize', pedir); if (tick) cancelAnimationFrame(tick); });
      }
      limpiezas.push(function () { if (raf) cancelAnimationFrame(raf); });

      /* ---------------- estancia que se ve, dentro de cada galería ---------------- */
      if ('IntersectionObserver' in window) {
        var ioE = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            var art = e.target.closest('.pl-ap');
            fichas.forEach(function (f) { if (f.art === art) f.marcarEstancia(e.target.getAttribute('data-est')); });
          });
        }, { rootMargin: '-38% 0px -52% 0px' });
        fichas.forEach(function (f) { f.filas.forEach(function (fi) { ioE.observe(fi); }); });
        limpiezas.push(function () { ioE.disconnect(); });
      }

      limpiezas.push(function () { ctx.visor.cerrar(); });
      el0.dataset.montado = '1';
      J.plantas.datos = aps;
    }

    return {
      destruir: function () {
        vivo = false;
        limpiezas.forEach(function (f) { try { f(); } catch (e) { /* nada */ } });
        limpiezas = [];
        el0.textContent = '';
        original.forEach(function (n) { el0.appendChild(n); });
        delete el0.dataset.montado; delete el0.dataset.modo; delete el0.dataset.densidad; delete el0.dataset.planta; delete el0.dataset.p;
        el0.classList.remove('pl--sin-aguja');
      }
    };
  }

  J.plantas = { montar: montar };
})();
