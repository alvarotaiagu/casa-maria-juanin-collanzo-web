/* ------------------------------------------------------------------
   Casa María Juanín · «Sintoniza el Alto Aller» · la escala        (agente Radio)

   window.Juanin.radio.montar(el, opciones)    → { destruir() }   la escala de la portada
   window.Juanin.radioPie.montar(el, opciones) → { destruir() }   la escala pequeña del pie
     el = [data-modulo="radio"] / [data-modulo="radio-pie"]
     opciones = { movimiento: bool, densidad: 'sintonia'|'sobria', hoy?: Date }

   La escala: una escala de cristal oscuro con marcas finas, números en mono, cuatro emisoras (Nieve, Rutas,
   Río y Berrea, en el orden del año) y una aguja ámbar. El brillo de detrás y las marcas se encienden cerca
   de la aguja (una copia ámbar de las marcas con una máscara centrada en la aguja).

   Sintonizar: se arrastra la aguja (o cualquier punto de la escala) con el dedo o el ratón, con inercia y
   «enganche» en cada emisora (un muelle amortiguado; un poco de imán al pasar cerca). Un toque en la escala
   sintoniza la emisora más cercana. Con teclado: las emisoras son botones con aria-pressed y las flechas,
   Inicio y Fin pasan de una a otra. touch-action: pan-y en la escala: el scroll vertical nunca se bloquea.

   Al sintonizar cambian: la luz (--radio-fondo y --radio-luz, en #portada mientras cambia y en :root al
   final, para la cabecera), la capa ambiental en canvas 2D (copos, curvas de nivel, reflejos de agua, una
   onda grave), la línea de texto con su dato y la foto (la fachada; el monte en Rutas). Entre emisoras, la
   capa se desenfoca y mete ruido visual. Sin sonido. Lanza «juanin:emisora» (detail: { id, origen }).

   Al cargar, la aguja barre la escala una vez y se para en la emisora de hoy (data/emisoras.json, «meses»).
   Movimiento reducido o densidad sobria: la escala quieta en la de hoy, sin capa; los botones siguen
   cambiando el contenido (la aguja salta).

   Rendimiento: sin WebGL; la capa a DPR ≤ 1,5; pausa fuera de pantalla y con la pestaña oculta; baja de
   partículas si los fotogramas van lentos. El resize de la barra del móvil no rehace nada.

   Parámetros de prueba: ?radio-hoy=AAAA-MM-DD (otra fecha para «hoy») · ?radio-info (calidad en consola).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var J = (window.Juanin = window.Juanin || {});
  var d = document;
  var SCRIPT = d.currentScript && d.currentScript.src ? d.currentScript.src : '';
  var BASE = SCRIPT ? new URL('../', SCRIPT).href : new URL('./', location.href).href;
  var VERSION = SCRIPT ? new URL(SCRIPT).search : '';
  var Q = new URLSearchParams(location.search);
  var SVGNS = 'http://www.w3.org/2000/svg';
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // recargar a media página vuelve arriba (checklist 12): la aguja barre al cargar y hay que verla
  try { if ('scrollRestoration' in history && !location.hash) history.scrollRestoration = 'manual'; } catch (e) {}

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var ahora = function () { return performance.now(); };
  function reducido() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  /* ================= datos ================= */
  var promesaDatos = null;
  function datos() {
    if (J.radioDatos) return Promise.resolve(J.radioDatos);
    if (!promesaDatos) {
      promesaDatos = fetch(BASE + 'data/emisoras.json' + VERSION, { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('emisoras.json ' + r.status); return r.json(); })
        .then(function (j) { J.radioDatos = j; return j; });
      promesaDatos.catch(function () { promesaDatos = null; });
    }
    return promesaDatos;
  }

  /* ================= la emisora de hoy ================= */
  function pascua(y) {                    // Domingo de Resurrección (algoritmo anónimo gregoriano)
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mes - 1, dia);
  }
  function limite(txt, y) {
    var t = String(txt).trim();
    var mp = /^pascua(?:\s*([+-])\s*(\d+))?$/.exec(t);
    if (mp) { var p = pascua(y); if (mp[1]) p.setDate(p.getDate() + (mp[1] === '-' ? -1 : 1) * Number(mp[2])); return p; }
    var md = /^(\d{1,2})-(\d{1,2})$/.exec(t);
    if (md) return new Date(y, Number(md[1]) - 1, Number(md[2]));
    throw new Error('límite de meses raro: ' + txt);
  }
  function enTramo(f, meses) {
    var y = f.getFullYear(), a = limite(meses.desde, y), b = limite(meses.hasta, y);
    return a <= b ? f >= a && f <= b : f >= a || f <= b;      // si da la vuelta al año (la nieve)
  }
  function soloDia(f) { return new Date(f.getFullYear(), f.getMonth(), f.getDate()); }
  function emisoraDeHoy(lista, fecha) {
    var f = soloDia(fecha || new Date());
    for (var i = 0; i < lista.length; i++) if (lista[i].meses && enTramo(f, lista[i].meses)) return lista[i].id;
    return lista[0].id;
  }
  function fechaHoy(opciones) {
    if (opciones && opciones.hoy instanceof Date) return soloDia(opciones.hoy);
    var q = /^(\d{4})-(\d{2})-(\d{2})$/.exec(Q.get('radio-hoy') || '');
    if (q) return new Date(Number(q[1]), Number(q[2]) - 1, Number(q[3]));
    return soloDia(new Date());
  }
  function fechaTexto(f) { return f.getDate() + ' de ' + MESES[f.getMonth()]; }
  function frecuencia(escala, p) { return (escala.desde + p * (escala.hasta - escala.desde)).toFixed(1).replace('.', ','); }

  /* ================= piezas de DOM ================= */
  function h(tag, attrs, hijos) {
    var n = d.createElement(tag);
    if (attrs) for (var k in attrs) { if (attrs[k] == null) continue; if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (hijos || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); });
    return n;
  }
  // las marcas: un SVG estirado a lo ancho (preserveAspectRatio none + trazo que no escala), de 0 a 1000
  function svgMarcas(escala, clase, alturas) {
    var s = d.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', clase);
    s.setAttribute('viewBox', '0 0 1000 100');
    s.setAttribute('preserveAspectRatio', 'none');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var n = Math.round((escala.hasta - escala.desde) / escala.paso);
    var porMedio = Math.round(escala.medio / escala.paso), porMayor = Math.round(escala.mayor / escala.paso);
    for (var i = 0; i <= n; i++) {
      var tipo = i % porMayor === 0 ? 2 : i % porMedio === 0 ? 1 : 0;
      var x = ((i / n) * 1000).toFixed(2);
      var l = d.createElementNS(SVGNS, 'line');
      l.setAttribute('x1', x); l.setAttribute('x2', x);
      l.setAttribute('y1', '0'); l.setAttribute('y2', String(alturas[tipo]));
      l.setAttribute('class', 'm' + tipo);
      l.setAttribute('vector-effect', 'non-scaling-stroke');
      s.appendChild(l);
    }
    return s;
  }
  function numeros(escala, cada) {
    var caja = h('div', { class: 'radio-numeros', 'aria-hidden': 'true' });
    var n = Math.round((escala.hasta - escala.desde) / cada);
    for (var i = 0; i <= n; i++) {
      var v = escala.desde + i * cada;
      caja.appendChild(h('span', { class: i % 2 ? 'radio-num-impar' : null, style: 'left:' + ((i / n) * 100).toFixed(3) + '%', text: String(v) }));
    }
    return caja;
  }
  function picture(foto, sizes, clase, prioridad) {
    var a = foto.anchos, mayor = a[a.length - 1];
    var src = function (ext) { return a.map(function (w) { return BASE + 'img/fotos/' + foto.nombre + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', '); };
    var img = h('img', {
      src: BASE + 'img/fotos/' + foto.nombre + '-' + (a.indexOf(800) >= 0 ? 800 : mayor) + '.jpg',
      srcset: src('jpg'), sizes: sizes, width: foto.ancho, height: foto.alto, alt: foto.alt || '',
      loading: prioridad ? 'eager' : 'lazy', decoding: 'async', fetchpriority: prioridad ? null : 'low',
      style: foto.posicion ? 'object-position:' + foto.posicion : null
    });
    return h('picture', { class: clase }, [
      h('source', { type: 'image/avif', srcset: src('avif'), sizes: sizes }),
      h('source', { type: 'image/webp', srcset: src('webp'), sizes: sizes }),
      img
    ]);
  }
  var TAM_FOTO = '(min-width: 1024px) 300px, (min-width: 700px) 34vw, calc(100vw - 32px)';

  /* ================= la capa ambiental (canvas 2D) ================= */
  function azarFijo(semilla) {             // mulberry32: siempre lo mismo
    var a = semilla >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function ruidoValor(semilla) {
    var hash = function (x, y) { var s = Math.sin(x * 127.1 + y * 311.7 + semilla * 74.7) * 43758.5453; return s - Math.floor(s); };
    var suave = function (t) { return t * t * (3 - 2 * t); };
    return function (x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = suave(x - ix), fy = suave(y - iy);
      var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), e = hash(ix + 1, iy + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy;
    };
  }
  var CASOS = { 1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[0, 1], [3, 2]], 6: [[0, 2]], 7: [[3, 0]],
    8: [[3, 0]], 9: [[0, 2]], 10: [[3, 0], [2, 1]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]] };

  function Capa(canvas) {
    var ctx = canvas.getContext('2d', { alpha: true });
    var W = 0, H = 0, dpr = 1, calidad = 1;
    var aguja = { x: 0, y: 0 };                          // la aguja, en px del lienzo (la onda y los reflejos la miran)
    var actual = null, objetivo = null, nivel = 0, ruido = 0, senal = 1, filtro = '';
    var t = 0, copos = [], reflejos = [], curvas = null, luz = [242, 169, 59];
    var azar = azarFijo(240611);

    function medir(w, hh) {
      W = Math.max(1, Math.round(w)); H = Math.max(1, Math.round(hh));
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      poblar();
      curvas = null;
      if (actual === 'curvas') prepararCurvas();
    }
    function poblar() {
      var area = W * H;
      var nC = Math.round(clamp(area * 0.00011, 40, 240) * calidad), nR = Math.round(clamp(area * 0.00009, 30, 170) * calidad);
      while (copos.length < nC) copos.push(nuevoCopo(true));
      copos.length = nC;
      while (reflejos.length < nR) reflejos.push(nuevoReflejo());
      reflejos.length = nR;
    }
    function nuevoCopo(cualquierY) {
      var z = azar();                                        // profundidad: los de cerca, más grandes, rápidos y claros
      return { x: azar() * W, y: cualquierY ? azar() * H : -4, r: 0.5 + z * 1.4, vy: 7 + z * 20, a: 0.18 + z * 0.42, ph: azar() * 6.283, amp: 3 + azar() * 7 };
    }
    function nuevoReflejo() {
      var r = azar();
      return { x: azar() * W, y: H * (0.3 + 0.7 * Math.sqrt(r)), len: 8 + azar() * 46 * (0.5 + r), sp: 0.5 + azar() * 1.3, ph: azar() * 6.283, v: 3 + azar() * 7 };
    }
    function prepararCurvas() {
      // curvas de nivel de un campo de ruido (siempre el mismo) con «marching squares»; se dibujan desde la aguja hacia fuera
      var c = W < 700 ? 10 : 13, cols = Math.ceil(W / c) + 1, filas = Math.ceil(H / c) + 1;
      var n = ruidoValor(7), esc = 1 / Math.max(260, W * 0.24);
      var campo = new Float32Array(cols * filas);
      for (var j = 0; j < filas; j++) for (var i = 0; i < cols; i++) {
        var x = i * c * esc, y = j * c * esc;
        campo[j * cols + i] = 0.62 * n(x, y) + 0.28 * n(x * 2.1 + 3.7, y * 2.1 + 1.9) + 0.1 * n(x * 4.3 + 9.1, y * 4.3 + 4.4);
      }
      var segs = [];
      for (var L = 0, nivelN = 0; nivelN < 9; nivelN++) {
        L = 0.24 + nivelN * 0.058;
        for (j = 0; j < filas - 1; j++) for (i = 0; i < cols - 1; i++) {
          var a = campo[j * cols + i], b = campo[j * cols + i + 1], cc = campo[(j + 1) * cols + i + 1], dd = campo[(j + 1) * cols + i];
          var caso = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (dd > L ? 1 : 0);
          var lista = CASOS[caso];
          if (!lista) continue;
          var x0 = i * c, y0 = j * c;
          for (var s = 0; s < lista.length; s++) {
            var p = borde(lista[s][0]), q = borde(lista[s][1]);
            var mx = (p[0] + q[0]) / 2 - aguja.x, my = (p[1] + q[1]) / 2 - aguja.y;
            segs.push([Math.sqrt(mx * mx + my * my), p[0], p[1], q[0], q[1], nivelN % 4 === 0 ? 1 : 0]);
          }
        }
      }
      function borde(e) {
        if (e === 0) return [x0 + c * (L - a) / (b - a), y0];
        if (e === 1) return [x0 + c, y0 + c * (L - b) / (cc - b)];
        if (e === 2) return [x0 + c * (L - dd) / (cc - dd), y0 + c];
        return [x0, y0 + c * (L - a) / (dd - a)];
      }
      segs.sort(function (u, v) { return u[0] - v[0]; });
      var lejos = segs.length ? segs[segs.length - 1][0] : 1;
      var off = d.createElement('canvas');
      off.width = canvas.width; off.height = canvas.height;
      curvas = { segs: segs, lejos: lejos, hecho: 0, off: off, octx: off.getContext('2d'), t0: t };
    }
    function pintarCurvas(alfa) {
      var cv = curvas, o = cv.octx;
      var prog = clamp((t - cv.t0) / 3.2, 0, 1), hasta = 0;
      var radio = (1 - Math.pow(1 - prog, 3)) * cv.lejos * 1.001;
      if (cv.hecho < cv.segs.length) {
        hasta = cv.hecho;
        while (hasta < cv.segs.length && cv.segs[hasta][0] <= radio) hasta++;
        if (hasta > cv.hecho) {
          o.setTransform(dpr, 0, 0, dpr, 0, 0);
          o.lineWidth = 1;
          for (var pasada = 0; pasada < 2; pasada++) {
            o.beginPath();
            for (var i = cv.hecho; i < hasta; i++) {
              var s = cv.segs[i];
              if (s[5] !== pasada) continue;
              o.moveTo(s[1], s[2]); o.lineTo(s[3], s[4]);
            }
            o.strokeStyle = pasada ? 'rgba(' + luz.join(',') + ',0.30)' : 'rgba(241,238,231,0.11)';
            o.stroke();
          }
          cv.hecho = hasta;
        }
      }
      ctx.globalAlpha = alfa * (0.86 + 0.14 * Math.sin(t * 0.5));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cv.off, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    }
    function pintarCopos(alfa, dt) {
      ctx.fillStyle = 'rgb(236,240,244)';
      for (var i = 0; i < copos.length; i++) {
        var p = copos[i];
        p.y += p.vy * dt;
        var x = p.x + Math.sin(t * 0.35 + p.ph) * p.amp;
        if (p.y > H + 4) { copos[i] = nuevoCopo(false); continue; }
        ctx.globalAlpha = p.a * alfa;
        if (p.r < 1.1) ctx.fillRect(x, p.y, p.r * 1.6, p.r * 1.6);
        else { ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.2832); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    function pintarReflejos(alfa, dt) {
      for (var i = 0; i < reflejos.length; i++) {
        var r = reflejos[i];
        r.x += r.v * dt;
        if (r.x - r.len > W) r.x = -r.len;
        var s = Math.sin(t * r.sp + r.ph + r.x * 0.004);
        if (s <= 0.15) continue;
        var a = Math.pow(s, 3) * 0.26 * alfa, largo = r.len * (0.55 + 0.45 * s);
        var cerca = clamp(1 - Math.abs(r.x - aguja.x) / 170, 0, 1);   // los reflejos de la luz de la aguja
        ctx.fillStyle = cerca > 0.05 ? 'rgba(' + luz.join(',') + ',' + (a * (0.6 + cerca)).toFixed(3) + ')' : 'rgba(198,224,234,' + a.toFixed(3) + ')';
        ctx.fillRect(r.x - largo / 2, r.y, largo, r.y > H * 0.7 ? 1.4 : 1);
      }
    }
    function pintarOnda(alfa) {
      // una onda grave que recorre la escala de izquierda a derecha cada ~7 s, como un bramido
      var ciclo = 7.2, fase = (t % ciclo) / ciclo, px = -0.25 * W + fase * 1.5 * W, ancho = Math.max(180, W * 0.2);
      var y0 = aguja.y, paso = W < 700 ? 5 : 6;
      for (var k = 0; k < 5; k++) {
        var desfase = k * 0.42, sep = (k - 2) * (W < 700 ? 7 : 11);
        ctx.beginPath();
        for (var x = 0; x <= W + paso; x += paso) {
          var env = Math.exp(-Math.pow((x - px + k * 22) / ancho, 2));
          var amp = (6 + 26 * env) * (1 - Math.abs(k - 2) * 0.18);
          var y = y0 + sep + amp * (Math.sin(x * 0.011 - t * 2.1 + desfase) * 0.75 + Math.sin(x * 0.027 - t * 3.3 + desfase * 2) * 0.25 * env);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        var a = (k === 2 ? 0.42 : 0.16 - Math.abs(k - 2) * 0.03) * alfa;
        ctx.strokeStyle = 'rgba(' + luz.join(',') + ',' + a.toFixed(3) + ')';
        ctx.lineWidth = k === 2 ? 1.4 : 1;
        ctx.stroke();
      }
    }
    function pintarRuido(r) {
      // el «ruido» visual entre emisoras: rayas finas que saltan
      var n = Math.round(10 + r * 40);
      for (var i = 0; i < n; i++) {
        ctx.globalAlpha = (0.03 + Math.random() * 0.09) * r;
        ctx.fillStyle = Math.random() < 0.2 ? 'rgb(' + luz.join(',') + ')' : 'rgb(241,238,231)';
        ctx.fillRect(Math.random() * W, Math.random() * H, 12 + Math.random() * 180 * r, 1);
      }
      ctx.globalAlpha = 1;
    }

    return {
      medir: medir,
      calidad: function (c) { if (c !== undefined) { calidad = c; poblar(); } return calidad; },
      aguja: function (x, y, cambia) { aguja.x = x; aguja.y = y; if (cambia && actual === 'curvas') prepararCurvas(); },
      luz: function (rgb) { luz = rgb.map(Math.round); },
      poner: function (id, inmediato) { objetivo = id; if (inmediato) { actual = id; nivel = 0; if (id === 'curvas') prepararCurvas(); } },
      senal: function (s) { senal = s; },
      estado: function () { return { actual: actual, objetivo: objetivo, nivel: nivel, ruido: ruido }; },
      paso: function (dt) {
        t += dt;
        // fuera la capa vieja (rápido, con ruido), dentro la nueva (despacio)
        if (objetivo !== actual) {
          nivel = Math.max(0, nivel - dt / 0.28);
          if (nivel === 0) { actual = objetivo; if (actual === 'curvas') prepararCurvas(); }
        } else nivel = Math.min(1, nivel + dt / 0.9);
        var rObj = clamp((objetivo !== actual ? 1 : 1 - nivel) * 0.9 + (1 - senal) * 0.7, 0, 1);
        ruido += (rObj - ruido) * Math.min(1, dt * 10);
        var f = ruido > 0.06 ? 'blur(' + (ruido * 4).toFixed(1) + 'px)' : '';
        if (f !== filtro) { canvas.style.filter = f; filtro = f; }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var alfa = nivel * (0.3 + 0.7 * senal);
        if (alfa > 0.004) {
          if (actual === 'copos') pintarCopos(alfa, dt);
          else if (actual === 'curvas') pintarCurvas(alfa);
          else if (actual === 'reflejos') pintarReflejos(alfa, dt);
          else if (actual === 'onda') pintarOnda(alfa);
        }
        if (ruido > 0.04) pintarRuido(ruido);
      },
      limpiar: function () { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    };
  }

  /* ================= colores ================= */
  function rgb(hex) { var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null; }
  function hex(c) { return '#' + c.map(function (v) { var s = Math.round(clamp(v, 0, 255)).toString(16); return s.length < 2 ? '0' + s : s; }).join(''); }

  /* ================= la escala de la portada ================= */
  function montarRadio(el, opciones) {
    opciones = opciones || {};
    var vivo = true, inst = null;
    var api = { destruir: function () { vivo = false; if (inst) inst.destruir(); } };
    datos().then(function (D) { if (vivo) inst = construirRadio(el, opciones, D); })
      .catch(function (er) { console.warn('Radio: se queda el respaldo', er); });
    return api;
  }

  function construirRadio(el, opciones, D) {
    var movimiento = opciones.movimiento !== false && opciones.densidad !== 'sobria' && !reducido();
    var densidad = opciones.densidad === 'sobria' ? 'sobria' : 'sintonia';
    var lista = D.emisoras, escala = D.escala;
    var porId = {}; lista.forEach(function (e) { porId[e.id] = e; });
    var hoyF = fechaHoy(opciones), hoyId = emisoraDeHoy(lista, hoyF);
    var ambito = el.closest('#portada') || el.parentElement || el;
    var raiz = d.documentElement;

    /* ---- el DOM (la foto de la fachada del respaldo se reaprovecha: ya está cargada) ---- */
    // la foto de la fachada del respaldo (la <picture> de img/radio/respaldo.html o la <img data-foto="fachada"> de Web)
    var fotoCasa = el.querySelector('picture') || el.querySelector('img[data-foto="fachada"]') || null;
    if (fotoCasa && fotoCasa.tagName === 'IMG' && !fotoCasa.getAttribute('src') && !fotoCasa.getAttribute('srcset')) fotoCasa = null;
    if (fotoCasa) fotoCasa.classList.add('radio-foto-casa');
    else fotoCasa = picture(D.casa.foto, TAM_FOTO, 'radio-foto-casa', true);
    var imgCasa = fotoCasa.tagName === 'IMG' ? fotoCasa : fotoCasa.querySelector('img');
    if (imgCasa) { imgCasa.removeAttribute('style'); if (!imgCasa.alt) imgCasa.alt = D.casa.foto.alt; }
    el.textContent = '';
    el.dataset.densidad = densidad;
    el.classList.toggle('radio-quieta', !movimiento);

    var canvas = movimiento ? h('canvas', { class: 'radio-capa', 'aria-hidden': 'true' }) : null;
    var pista = h('div', { class: 'radio-pista' });
    var marcas = svgMarcas(escala, 'radio-marcas', [16, 28, 42]);
    var marcasLuz = svgMarcas(escala, 'radio-marcas radio-marcas-luz', [16, 28, 42]);
    var aguja = h('span', { class: 'radio-aguja', 'aria-hidden': 'true' });
    var grupo = h('div', { class: 'radio-emisoras', role: 'group', 'aria-label': 'Emisoras: las épocas del año en Collanzo' });
    var botones = lista.map(function (e) {
      var b = h('button', { type: 'button', class: 'radio-emisora', 'data-id': e.id, 'aria-pressed': 'false', tabindex: '-1',
        style: 'left:' + (e.posicion * 100).toFixed(2) + '%' }, [
        h('span', { class: 'radio-lampara', 'aria-hidden': 'true' }),
        h('span', { class: 'radio-nombre-em', text: e.nombre }),
        h('span', { class: 'radio-frec', 'aria-hidden': 'true', text: frecuencia(escala, e.posicion) })
      ]);
      grupo.appendChild(b);
      return b;
    });
    var brillo = h('span', { class: 'radio-brillo', 'aria-hidden': 'true' });
    pista.appendChild(brillo);
    pista.appendChild(marcas);
    pista.appendChild(marcasLuz);
    pista.appendChild(numeros(escala, escala.mayor));
    pista.appendChild(grupo);
    pista.appendChild(aguja);
    var cristal = h('div', { class: 'radio-cristal' }, [pista]);
    var escalaEl = h('div', { class: 'radio-escala' }, [cristal]);

    var rotuloTxt = h('span', { class: 'radio-rotulo-txt' });
    var volver = h('button', { type: 'button', class: 'radio-volver', hidden: '' });
    var rotulo = h('p', { class: 'radio-rotulo' }, [rotuloTxt, volver]);
    var nombre = h('p', { class: 'radio-nombre' });
    var texto = h('p', { class: 'radio-texto' });
    var cifras = h('div', { class: 'radio-cifras' });
    var sintonia = h('div', { class: 'radio-sintonia' }, [nombre, texto, cifras]);
    var marco = h('div', { class: 'radio-marco' }, [fotoCasa]);
    var pie = h('figcaption', { class: 'radio-pie-foto' });
    var figura = h('figure', { class: 'radio-foto' }, [marco, pie]);
    var fotosEmisora = {};
    var lectura = h('div', { class: 'radio-lectura' }, [rotulo, sintonia]);

    if (canvas) el.appendChild(canvas);
    el.appendChild(escalaEl);
    el.appendChild(lectura);
    el.appendChild(figura);
    el.dataset.montado = '1';

    /* ---- estado ---- */
    var posiciones = lista.map(function (e) { return e.posicion; });
    var x = movimiento ? 0 : porId[hoyId].posicion, v = 0, objetivo = x, modo = movimiento ? 'barrido' : 'quieto';
    var tBarrido = 0, activa = null, pistaW = 1, pistaRect = null;
    var luzAhora = rgb(porId[hoyId].luz && porId[hoyId].luz.ambar) || [242, 169, 59];
    var fondoAhora = rgb(porId[hoyId].luz && porId[hoyId].luz.fondo) || [18, 20, 22];
    var luzObj = luzAhora.slice(), fondoObj = fondoAhora.slice(), luzMoviendo = false;
    var capa = canvas ? Capa(canvas) : null;
    var visible = true, raf = 0, tPrev = 0, lentos = [], cercas = lista.map(function () { return -1; });
    var anchoVista = innerWidth, altoVista = innerHeight;

    function cercana(p) {
      var mejor = 0, md = 2;
      for (var i = 0; i < posiciones.length; i++) { var dd = Math.abs(p - posiciones[i]); if (dd < md) { md = dd; mejor = i; } }
      return mejor;
    }
    function iman(raw) {                    // el «enganche» al pasar cerca de una emisora mientras se arrastra
      var i = cercana(raw), dd = Math.abs(raw - posiciones[i]), R = 0.035;
      if (dd >= R) return raw;
      var k = Math.pow(1 - dd / R, 2) * 0.55;
      return raw + (posiciones[i] - raw) * k;
    }

    /* ---- la luz ---- */
    function ponerLuz(final) {
      var l = hex(luzAhora), f = hex(fondoAhora);
      ambito.style.setProperty('--radio-luz', l);
      ambito.style.setProperty('--radio-fondo', f);
      if (final) { raiz.style.setProperty('--radio-luz', l); raiz.style.setProperty('--radio-fondo', f); }
      if (capa) capa.luz(luzAhora);
    }

    /* ---- el contenido: lo que cambia al sintonizar (también con movimiento reducido) ---- */
    function cifrasDe(e) {
      cifras.textContent = '';
      var dt = e.dato;
      if (!dt) return;
      if (dt.tipo === 'minutos') {
        var mins = dt.destinos.map(function (x) { return x.minutos; });
        var iguales = mins.every(function (m) { return m === mins[0]; });
        var nota = dt.provisional ? 'en coche, según Turismo Asturias' : 'en coche';
        if (iguales) {
          cifras.appendChild(h('p', { class: 'radio-cifra' }, [h('span', { class: 'radio-cifra-num', text: String(mins[0]) }), h('span', { class: 'radio-cifra-ud', text: ' min' })]));
          cifras.appendChild(h('p', { class: 'radio-cifra-nota', text: 'a ' + dt.destinos.map(function (x) { return x.nombre; }).join(' y ') + ', ' + nota }));
        } else {
          var filas = h('dl', { class: 'radio-cifra-filas' });
          dt.destinos.forEach(function (x) {
            filas.appendChild(h('div', null, [h('dt', { text: x.nombre }), h('dd', null, [h('span', { class: 'radio-cifra-num', text: String(x.minutos) }), h('span', { class: 'radio-cifra-ud', text: ' min' })])]));
          });
          cifras.appendChild(filas);
          cifras.appendChild(h('p', { class: 'radio-cifra-nota', text: nota.charAt(0).toUpperCase() + nota.slice(1) }));
        }
      } else {
        cifras.appendChild(h('p', { class: 'radio-cifra radio-cifra-palabra', text: dt.valor }));
        if (dt.nota) cifras.appendChild(h('p', { class: 'radio-cifra-nota', text: dt.nota }));
      }
    }
    function fotoDe(e) {
      var f = e.foto;
      Object.keys(fotosEmisora).forEach(function (k) { fotosEmisora[k].classList.toggle('radio-foto-on', !!f && k === f.nombre); });
      if (f) {
        if (!fotosEmisora[f.nombre]) {
          var p = picture(f, TAM_FOTO, 'radio-foto-emisora', false);
          var img = p.querySelector('img');
          img.loading = 'eager';
          marco.appendChild(p);
          fotosEmisora[f.nombre] = p;
          var encender = function () { if (activa === e.id) p.classList.add('radio-foto-on'); };
          if (img.complete && img.naturalWidth) encender(); else img.addEventListener('load', encender, { once: true });
          img.addEventListener('error', function () { p.remove(); delete fotosEmisora[f.nombre]; }, { once: true });
        } else fotosEmisora[f.nombre].classList.add('radio-foto-on');
        pie.textContent = f.pie || '';
      } else pie.textContent = D.casa.foto.pie || '';
      figura.dataset.foto = f ? f.nombre : 'fachada';
    }
    function rotuloDe(id) {
      var esHoy = id === hoyId;
      rotuloTxt.textContent = esHoy ? 'Sintonizado hoy, ' + fechaTexto(hoyF) : 'Sintonizado: ' + porId[id].nombre;
      volver.hidden = esHoy;
      volver.textContent = 'Volver a hoy';
      volver.setAttribute('aria-label', 'Volver a la emisora de hoy: ' + porId[hoyId].nombre);
    }
    function fijar(id, origen, enfocar) {
      var e = porId[id];
      if (!e) return;
      var cambia = id !== activa;
      activa = id;
      el.dataset.emisora = id;
      if (ambito !== el && ambito.dataset) ambito.dataset.emisora = id;
      botones.forEach(function (b) {
        var on = b.dataset.id === id;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        if (on && enfocar) b.focus({ preventScroll: true });
      });
      if (cambia) {
        nombre.textContent = e.nombre;
        texto.textContent = e.texto;
        cifrasDe(e);
        fotoDe(e);
        if (movimiento && origen !== 'hoy' && sintonia.animate) {
          sintonia.animate([{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
            { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      }
      rotuloDe(id);
      luzObj = rgb(e.luz && e.luz.ambar) || [242, 169, 59];
      fondoObj = rgb(e.luz && e.luz.fondo) || [18, 20, 22];
      if (!movimiento) { luzAhora = luzObj.slice(); fondoAhora = fondoObj.slice(); ponerLuz(true); }
      else luzMoviendo = true;
      if (capa) capa.poner(e.capa, origen === 'hoy');
      if (cambia || origen === 'hoy') {
        try { d.dispatchEvent(new CustomEvent('juanin:emisora', { detail: { id: id, origen: origen } })); } catch (er) {}
      }
      arrancar();
    }
    function sintonizar(i, origen, enfocar) {
      i = clamp(i, 0, lista.length - 1);
      objetivo = posiciones[i];
      if (movimiento) { if (modo !== 'barrido') modo = 'muelle'; delete el.dataset.reposo; }
      else { x = objetivo; v = 0; modo = 'quieto'; pintarAguja(); raiz.style.setProperty('--radio-x', x.toFixed(4)); }
      fijar(lista[i].id, origen, enfocar);
    }

    /* ---- pintar la aguja y las lámparas ---- */
    function pintarAguja() {
      var px = x * pistaW;
      aguja.style.transform = 'translate3d(' + px.toFixed(2) + 'px,0,0)';
      brillo.style.transform = 'translate3d(' + px.toFixed(2) + 'px,0,0)';
      pista.style.setProperty('--x', (x * 100).toFixed(3) + '%');
      for (var i = 0; i < posiciones.length; i++) {
        var c = Math.round(clamp(1 - Math.abs(x - posiciones[i]) / 0.06, 0, 1) * 100) / 100;
        if (c !== cercas[i]) { botones[i].style.setProperty('--cerca', String(c)); cercas[i] = c; }
      }
      if (capa && pistaRect) {
        // la señal: plena en la emisora sintonizada; entre emisoras la capa se apaga y mete ruido
        if (activa) capa.senal(clamp(1 - Math.abs(x - porId[activa].posicion) / 0.12, 0, 1));
        capa.aguja(pistaRect.left + px, pistaRect.cy, false);
      }
    }

    /* ---- medir (sin rehacer nada con la barra del móvil) ---- */
    var lienzo = { w: 0, h: 0 };
    function medir(forzar) {
      var r = pista.getBoundingClientRect();
      pistaW = Math.max(1, r.width);
      if (canvas) {
        var c = canvas.getBoundingClientRect(), cr = cristal.getBoundingClientRect();
        pistaRect = { left: r.left - c.left, cy: cr.top - c.top + cr.height / 2 };
        capa.aguja(pistaRect.left + x * pistaW, pistaRect.cy, false);
        // el lienzo solo se rehace si cambia de verdad (al girar, o si el titular cambia de alto con la letra)
        if (forzar || Math.abs(c.width - lienzo.w) > 1 || Math.abs(c.height - lienzo.h) > 24) {
          lienzo.w = c.width; lienzo.h = c.height;
          capa.medir(c.width, c.height);
        }
      }
      pintarAguja();
    }
    function alCambiarTamano() {
      if (innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160) return;   // la barra del móvil: nada
      anchoVista = innerWidth; altoVista = innerHeight;
      medir(true);
    }
    addEventListener('resize', alCambiarTamano);

    /* ---- el bucle ---- */
    function arrancar() { if (!raf && visible && !d.hidden && necesitaBucle()) { tPrev = ahora(); raf = requestAnimationFrame(fotograma); } }
    function necesitaBucle() { return !!capa || modo !== 'quieto' || luzMoviendo; }
    function fotograma(tt) {
      raf = 0;
      if (!visible || d.hidden) return;
      var dt = Math.min(0.05, Math.max(0, (tt - tPrev) / 1000)); tPrev = tt;
      // calidad automática: si los fotogramas van lentos, menos partículas
      if (capa && dt > 0) {
        lentos.push(dt); if (lentos.length > 45) lentos.shift();
        if (lentos.length === 45) {
          var media = lentos.reduce(function (a, b) { return a + b; }, 0) / 45;
          if (media > 0.026 && capa.calidad() > 0.36) { capa.calidad(Math.max(0.35, capa.calidad() * 0.7)); lentos = []; if (Q.has('radio-info')) console.info('Radio: calidad', capa.calidad()); }
        }
      }
      if (modo === 'barrido') {
        tBarrido += dt;
        var u = clamp(tBarrido / 1.5, 0, 1);
        x = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        v = 0;
        if (u >= 1) { modo = 'muelle'; x = 1; }
      } else if (modo === 'muelle') {
        var K = 140, C = 18.5, pasos = Math.max(1, Math.ceil(dt / 0.008)), h2 = dt / pasos;
        for (var s = 0; s < pasos; s++) { var a = K * (objetivo - x) - C * v; v += a * h2; x += v * h2; }
        if (Math.abs(objetivo - x) < 0.0006 && Math.abs(v) < 0.02) { x = objetivo; v = 0; modo = 'quieto'; el.dataset.reposo = '1'; raiz.style.setProperty('--radio-x', x.toFixed(4)); }
      }
      if (luzMoviendo) {
        var k = 1 - Math.exp(-dt * 3.2), fin = true;
        for (var c = 0; c < 3; c++) {
          luzAhora[c] += (luzObj[c] - luzAhora[c]) * k; fondoAhora[c] += (fondoObj[c] - fondoAhora[c]) * k;
          if (Math.abs(luzObj[c] - luzAhora[c]) > 0.6 || Math.abs(fondoObj[c] - fondoAhora[c]) > 0.6) fin = false;
        }
        if (fin) { luzAhora = luzObj.slice(); fondoAhora = fondoObj.slice(); luzMoviendo = false; }
        ponerLuz(fin);
      }
      pintarAguja();
      if (capa) capa.paso(dt);
      if (necesitaBucle()) raf = requestAnimationFrame(fotograma);
    }
    function parar() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      var vis = es.some(function (e) { return e.isIntersecting; });
      if (vis !== visible) { visible = vis; if (vis) arrancar(); else parar(); }
    }, { rootMargin: '80px 0px' }) : null;
    if (io) { io.observe(escalaEl); if (canvas) io.observe(canvas); }
    // cuando la escala llega a la cabecera: html.radio-en-cabecera (la cabecera de Web toma el relevo con su aguja)
    // (se mira la portada, que no se transforma, con umbrales finos, y la posición de la escala en la maqueta: offsetTop)
    var cab = parseFloat(getComputedStyle(raiz).getPropertyValue('--cab')) || 68;
    var vigia = ambito !== el ? ambito : escalaEl, umbrales = [];
    for (var u = 0; u <= 50; u++) umbrales.push(u / 50);
    function escalaArriba(r) {
      var off = 0, n = escalaEl;
      while (n && n !== vigia && n.offsetParent) { off += n.offsetTop; n = n.offsetParent; if (n === vigia) break; }
      return (vigia === escalaEl ? r.top : r.top + off) <= cab + 1;
    }
    var ioCab = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      raiz.classList.toggle('radio-en-cabecera', escalaArriba(es[es.length - 1].boundingClientRect));
    }, { threshold: umbrales }) : null;
    if (ioCab) ioCab.observe(vigia);
    function alVisibilidad() { if (d.hidden) parar(); else arrancar(); }
    d.addEventListener('visibilitychange', alVisibilidad);

    /* ---- arrastrar, con inercia y enganche ---- */
    var ptr = null, trasArrastre = false;
    function fracEn(clientX) { var r = pista.getBoundingClientRect(); return clamp((clientX - r.left) / Math.max(1, r.width), 0, 1); }
    function alBajar(e) {
      if (e.button !== 0 || ptr) return;
      ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: x, arr: false, muestras: [], boton: !!e.target.closest('.radio-emisora') };
    }
    function alMover(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      var dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0;
      if (!ptr.arr) {
        if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          ptr.arr = true;
          // si el barrido inicial está en marcha, se coge la aguja donde esté
          if (modo === 'barrido') modo = 'quieto';
          ptr.x = x - dx / pistaW;
          try { cristal.setPointerCapture(e.pointerId); } catch (er) {}
          el.classList.add('radio-arrastrando');
          arrancar();
        } else if (Math.abs(dy) > 10) { ptr = null; return; }
        else return;
      }
      var raw = clamp(ptr.x + dx / pistaW, 0, 1);
      x = iman(raw); v = 0; modo = 'arrastre';
      var tt = ahora();
      ptr.muestras.push([tt, raw]);
      while (ptr.muestras.length > 2 && tt - ptr.muestras[0][0] > 110) ptr.muestras.shift();
      if (!movimiento) pintarAguja(); else arrancar();
    }
    function alSoltar(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      var p = ptr; ptr = null;
      el.classList.remove('radio-arrastrando');
      if (p.arr) {
        trasArrastre = true; setTimeout(function () { trasArrastre = false; }, 0);
        // la velocidad, solo de lo último (si el dedo se paró antes de soltar, no hay inercia)
        var m = p.muestras, vel = 0, tFin = ahora();
        while (m.length && tFin - m[0][0] > 90) m.shift();
        if (e.type !== 'pointercancel' && m.length > 1 && tFin - m[m.length - 1][0] < 60) { var dtm = (m[m.length - 1][0] - m[0][0]) / 1000; if (dtm > 0.005) vel = (m[m.length - 1][1] - m[0][1]) / dtm; }
        vel = clamp(vel, -4, 4);
        var i = cercana(clamp(x + vel * 0.22, 0, 1));
        if (movimiento) { v = vel * 0.6; modo = 'muelle'; }
        sintonizar(i, 'arrastre', false);
      } else if (!p.boton && e.type === 'pointerup') {
        sintonizar(cercana(fracEn(e.clientX)), 'toque', false);
      }
    }
    cristal.addEventListener('pointerdown', alBajar);
    cristal.addEventListener('pointermove', alMover);
    cristal.addEventListener('pointerup', alSoltar);
    cristal.addEventListener('pointercancel', alSoltar);
    // (con el dedo, el navegador ya captura el puntero en el hijo tocado: al pasarlo al cristal, ese hijo «pierde» la
    //  captura y el aviso sube hasta aquí; solo cuenta si la pierde el propio cristal)
    cristal.addEventListener('lostpointercapture', function (e) { if (e.target === cristal && ptr && ptr.arr && e.pointerId === ptr.id) alSoltar({ pointerId: e.pointerId, type: 'pointercancel', clientX: 0 }); });

    /* ---- botones y teclado ---- */
    grupo.addEventListener('click', function (e) {
      var b = e.target.closest('.radio-emisora');
      if (!b || trasArrastre) return;
      sintonizar(lista.findIndex(function (x2) { return x2.id === b.dataset.id; }), 'boton', false);
    });
    grupo.addEventListener('keydown', function (e) {
      var b = e.target.closest('.radio-emisora');
      if (!b) return;
      var i = lista.findIndex(function (x2) { return x2.id === b.dataset.id; }), n = i;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = i + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = i - 1;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = lista.length - 1;
      else return;
      e.preventDefault();
      n = clamp(n, 0, lista.length - 1);
      if (n !== i) sintonizar(n, 'teclado', true);
    });
    volver.addEventListener('click', function () {
      sintonizar(lista.findIndex(function (x2) { return x2.id === hoyId; }), 'boton', false);
      var b = botones[lista.findIndex(function (x2) { return x2.id === hoyId; })];
      if (b) b.focus({ preventScroll: true });
    });

    /* ---- arranque ---- */
    medir(true);
    ponerLuz(true);
    fijar(hoyId, 'hoy', false);
    objetivo = porId[hoyId].posicion;
    if (!movimiento) { x = objetivo; el.dataset.reposo = '1'; }
    raiz.style.setProperty('--radio-x', objetivo.toFixed(4));
    pintarAguja();
    // el texto se anuncia al cambiar, no al cargar
    setTimeout(function () { sintonia.setAttribute('aria-live', 'polite'); }, 50);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { if (el.dataset.montado) medir(false); });
    arrancar();

    var instancia = {
      destruir: function () {
        parar();
        if (io) io.disconnect();
        if (ioCab) ioCab.disconnect();
        raiz.classList.remove('radio-en-cabecera');
        raiz.style.removeProperty('--radio-x');
        removeEventListener('resize', alCambiarTamano);
        d.removeEventListener('visibilitychange', alVisibilidad);
        if (capa) capa.limpiar();
        raiz.style.removeProperty('--radio-luz'); raiz.style.removeProperty('--radio-fondo');
        ambito.style.removeProperty('--radio-luz'); ambito.style.removeProperty('--radio-fondo');
        delete el.dataset.montado; delete el.dataset.reposo; delete el.dataset.emisora; delete el.dataset.densidad;
        if (ambito.dataset) delete ambito.dataset.emisora;
        el.classList.remove('radio-quieta', 'radio-arrastrando');
        if (J.radio._ultima === instancia) J.radio._ultima = null;
      },
      // para las pruebas y para la cabecera de Web
      estado: function () { return { emisora: activa, hoy: hoyId, x: x, modo: modo, movimiento: movimiento, corriendo: !!raf, capa: capa ? capa.estado() : null, calidad: capa ? capa.calidad() : null }; },
      sintonizar: function (id) { var i = lista.findIndex(function (x2) { return x2.id === id; }); if (i >= 0) sintonizar(i, 'api', false); }
    };
    J.radio._ultima = instancia;
    return instancia;
  }

  /* ================= la escala pequeña del pie ================= */
  function montarPie(el, opciones) {
    opciones = opciones || {};
    var vivo = true, inst = null;
    datos().then(function (D) { if (vivo) inst = construirPie(el, opciones, D); })
      .catch(function (er) { console.warn('Radio (pie): sin escala', er); });
    return { destruir: function () { vivo = false; if (inst) inst.destruir(); } };
  }
  function construirPie(el, opciones, D) {
    var movimiento = opciones.movimiento !== false && opciones.densidad !== 'sobria' && !reducido();
    var lista = D.emisoras, escala = D.escala;
    el.textContent = '';
    var pista = h('div', { class: 'radio-pie-pista' });
    pista.appendChild(svgMarcas({ desde: escala.desde, hasta: escala.hasta, paso: 0.5, medio: 1, mayor: 2 }, 'radio-pie-marcas', [26, 46, 70]));
    var marcas = lista.map(function (e) {
      var m = h('span', { class: 'radio-pie-em', style: 'left:' + (e.posicion * 100).toFixed(2) + '%' }, [h('span', { class: 'radio-pie-lampara' }), h('span', { class: 'radio-pie-nombre', text: e.nombre })]);
      pista.appendChild(m);
      return m;
    });
    var aguja = h('span', { class: 'radio-pie-aguja' });
    pista.appendChild(aguja);
    el.appendChild(h('div', { class: 'radio-pie' }, [pista]));
    el.dataset.montado = '1';
    var timers = [], io = null, hecho = false;
    function irA(p) { aguja.style.left = (p * 100).toFixed(2) + '%'; }
    function completo() { marcas.forEach(function (m) { m.classList.add('radio-pie-on'); }); irA(lista[lista.length - 1].posicion); el.dataset.completo = '1'; }
    function recorrer() {
      if (hecho) return; hecho = true;
      if (!movimiento) { completo(); return; }
      el.classList.add('radio-pie-mueve');
      lista.forEach(function (e, i) {
        timers.push(setTimeout(function () { irA(e.posicion); }, 120 + i * 620));
        timers.push(setTimeout(function () { marcas[i].classList.add('radio-pie-on'); if (i === lista.length - 1) el.dataset.completo = '1'; }, 120 + i * 620 + 460));
      });
    }
    irA(0);
    if (!movimiento) completo();
    else if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); recorrer(); } }, { threshold: 0.6 });
      io.observe(pista);
    } else completo();
    return {
      destruir: function () { timers.forEach(clearTimeout); if (io) io.disconnect(); el.textContent = ''; delete el.dataset.montado; delete el.dataset.completo; el.classList.remove('radio-pie-mueve'); }
    };
  }

  J.radio = { montar: montarRadio, emisoraDeHoy: emisoraDeHoy, pascua: pascua, datos: datos, _ultima: null };
  J.radioPie = { montar: montarPie };
})();
