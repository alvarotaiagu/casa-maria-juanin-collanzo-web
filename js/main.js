/* ------------------------------------------------------------------
   Casa María Juanín · «Sintoniza el Alto Aller» · lo común de la página
   - Monta los módulos (radio y radio-pie al cargar; plantas y nieve al acercarse) con su respaldo: si el JS de un módulo
     no está o falla, se queda el HTML que hay dentro de [data-modulo].
   - Cabecera: fondo al bajar (.sc), el enlace de la sección que se ve y la aguja finísima que avanza con el scroll
     (--sintonia de 0 a 1 en <html>). Menú móvil. Los enlaces a secciones que no existen (el puerto es quitable) se quitan.
   - Juanin.reservar(id?), el visor de fotos por NOMBRE (Juanin.visor.abrir(lista, nombre)), cookies, mapa de Google a
     petición, el foco del teclado con su subrayado y muesca y el mando de maqueta (?revision).
   - El motor de reservas va en js/reserva.js (Juanin.motor).
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !quieto;
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const J = (window.Juanin = window.Juanin || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA (checklist punto 10)
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 0. el puerto es quitable: si falta una sección, se quitan sus enlaces de la cabecera y del menú ============ */
  $$('.cab__nav a, .menu-movil nav a').forEach((a) => { const h = a.getAttribute('href'); if (h && h[0] === '#' && !document.getElementById(h.slice(1))) a.remove(); });

  /* ============ 1. titulares que suben al entrar (solo con movimiento). Se observa el contenedor (checklist punto 13) ============ */
  const revela = $$('[data-revela]');
  if (motion && 'IntersectionObserver' in window) {
    const deCaja = new Map();
    revela.forEach((h) => { const c = h.parentElement || h; if (!deCaja.has(c)) deCaja.set(c, []); deCaja.get(c).push(h); });
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { (deCaja.get(e.target) || []).forEach((h) => h.classList.add('es-visto')); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    deCaja.forEach((_, c) => io.observe(c));
    raiz.classList.add('con-movimiento');
  } else revela.forEach((h) => h.classList.add('es-visto'));

  /* ============ 2. ir a un sitio ============ */
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cab')) || 68;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    scrollTo({ top: Math.max(0, y), behavior: quieto || sobria() ? 'auto' : 'smooth' });
  };

  /* ============ 3. la cabecera: fondo al bajar, sección activa y la aguja que sintoniza la página ============ */
  const cab = $('#cab'), aguja = $('#cab-aguja'), portada = $('#portada');
  const enlaces = $$('.cab__nav a');
  const secciones = enlaces.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let actual = null, pPrev = -1, radioX = 0;
  // el relevo con Radio: la aguja de la cabecera arranca donde quedó la de la escala (--radio-x, de 0 a 1)
  const leerRadioX = () => { const v = parseFloat(getComputedStyle(portada || raiz).getPropertyValue('--radio-x')); radioX = v >= 0 && v <= 1 ? v : 0; pPrev = -1; };
  document.addEventListener('juanin:emisora', () => setTimeout(() => { leerRadioX(); pintarCabecera(); }, 60));
  addEventListener('load', () => setTimeout(() => { leerRadioX(); pintarCabecera(); }, 60));
  function pintarCabecera() {
    cab.classList.toggle('sc', scrollY > 24);
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const p = Math.min(1, Math.max(0, scrollY / max));
    if (Math.abs(p - pPrev) > 0.0004) {
      pPrev = p;
      raiz.style.setProperty('--sintonia', p.toFixed(4));
      if (aguja) aguja.style.transform = `translateX(${((radioX + p * (1 - radioX)) * (cab.clientWidth - 3) + 1).toFixed(1)}px)`;
    }
    if (portada) raiz.classList.toggle('cab-sintonizada', portada.getBoundingClientRect().bottom < cabAlto());
    const y = cabAlto() + altoVista * 0.3;
    let sec = null;
    for (const s of secciones) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) sec = s; }
    if (sec !== actual) {
      actual = sec;
      enlaces.forEach((a) => { if (sec && a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }
  }

  /* ============ 4. la emisora de hoy: la decide Radio con data/emisoras.json (una sola fuente); su respaldo ya la trae ============ */

  /* ============ 5. módulos: radio, radio-pie, plantas y nieve ============ */
  const montados = new Map();     // el → { inst, respaldo }
  const esperando = new Set();    // cerca de la pantalla, pero su JS aún no ha llegado
  const nombreMod = (el) => ({ 'radio-pie': 'radioPie' }[el.dataset.modulo] || el.dataset.modulo);
  function modulo(el) {
    const m = J[nombreMod(el)];
    return m && typeof m.montar === 'function' ? m : null;
  }
  const opciones = () => ({ movimiento: motion && !sobria(), densidad: sobria() ? 'sobria' : 'sintonia' });
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); return; }
    esperando.delete(el);
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones());
      montados.set(el, { inst, respaldo });
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      el.innerHTML = respaldo;
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); };
  addEventListener('load', reintentar);
  function remontarTodos() {
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
  }
  // la portada se monta al cargar; el resto, al acercarse a la pantalla
  const radio = $('[data-modulo="radio"]'), radioPie = $('[data-modulo="radio-pie"]');
  if (radio) montarModulo(radio);
  if (radioPie) montarModulo(radioPie);     // la escala del pie se monta al cargar: Radio espera sola a que entre en pantalla
  const resto = $$('[data-modulo]').filter((el) => el !== radio && el !== radioPie);
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    resto.forEach((el) => ioMod.observe(el));
  } else resto.forEach(montarModulo);

  /* ============ 6. menú y anclas ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
  });

  /* ============ 7. reservar: Juanin.reservar(id?) y el evento de Plantas ============ */
  J.reservar = function (id) {
    if (id && J.motor && typeof J.motor.apartamento === 'function') J.motor.apartamento(id);
    cerrarMenu();
    irA('#reservar');
  };
  document.addEventListener('juanin:apartamento', (e) => { const id = e.detail && e.detail.id; J.reservar(id); });
  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-reservar]');
    if (r) { e.preventDefault(); J.reservar(r.getAttribute('data-reservar') || undefined); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;          // los enlaces que ya atiende un módulo (p. ej. «Reservar este» de Plantas)
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, quieto ? 50 : 900);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 8. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'juanin-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  if (!leer()) ck.hidden = false;
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });

  /* ============ 9. mapa de Google solo al pedirlo ============ */
  const mapaBtn = $('#mapa-btn');
  if (mapaBtn) mapaBtn.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('Apartamentos Casa María Juanín, Ctra. General 48, 33680 Collanzo, Asturias') + '&z=15&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con Casa María Juanín en Collanzo';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 10. visor de fotos: se abre por el NOMBRE de la foto ============ */
  // Juanin.visor.abrir(lista, nombre): lista = nombres de foto (o { nombre, alt, pie }) y nombre = con cuál empieza.
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  const FOTOS = new Map();
  fetch('img/fotos/fotos.json').then((r) => r.json()).then((l) => l.forEach((f) => FOTOS.set(f.nombre, f))).catch(() => {});
  function infoFoto(n) {
    const img = $('picture[data-foto="' + n + '"] img');
    const f = FOTOS.get(n);
    let anchos = f ? f.anchos.slice() : [800], ancho = f ? f.ancho : 800, alto = f ? f.alto : 600, alt = '', pie = '';
    if (img) {
      alt = img.alt;
      const cap = img.closest('figure') && img.closest('figure').querySelector('figcaption');
      pie = cap ? cap.textContent.replace(/\s+/g, ' ').trim() : alt;
    }
    return { n, alt, pie: pie || alt, anchos, ancho, alto };
  }
  let lista = [], actualV = 0, origen = null;
  function poner(i) {
    actualV = (i + lista.length) % lista.length;
    const f = lista[actualV];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0], gran = f.anchos[f.anchos.length - 1];
    vImg.src = `img/fotos/${f.n}-${peq}.jpg`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    vImg.style.setProperty('--nat', f.ancho + 'px');
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.jpg`;
    }
    vPie.textContent = f.pie;
    vN.textContent = (actualV + 1) + ' / ' + lista.length;
  }
  function abrirVisor(nombres, nombre, desde) {
    if (!visor || typeof visor.showModal !== 'function') return;
    const vistos = new Set();
    lista = [];
    (nombres || []).forEach((x) => {
      const o = typeof x === 'string' ? { nombre: x } : x;
      const n = o.nombre || o.n;
      if (!n || vistos.has(n)) return;
      vistos.add(n);
      const f = infoFoto(n);
      if (o.alt) f.alt = o.alt;
      if (o.pie) f.pie = o.pie;
      lista.push(f);
    });
    if (!lista.length) return;
    let i = lista.findIndex((f) => f.n === nombre);
    if (i < 0) i = 0;
    origen = desde || document.activeElement;
    poner(i);
    if (!visor.open) visor.showModal();
  }
  J.visor = { abrir: (l, n) => abrirVisor(l, n) };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor]');
    if (!b) return;
    const g = b.getAttribute('data-grupo');
    const botones = g ? $$('[data-visor][data-grupo="' + g + '"]') : [b];
    abrirVisor(botones.map((x) => x.dataset.visor), b.dataset.visor, b);
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actualV - 1));
    $('#visor-sig').addEventListener('click', () => poner(actualV + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actualV - 1); else if (e.key === 'ArrowRight') poner(actualV + 1); });
    visor.addEventListener('close', () => { if (origen && document.contains(origen)) origen.focus({ preventScroll: true }); });
  }

  /* ============ 11. el foco del teclado: subrayado ámbar de 2 px con una muesca, como la marca de la escala ============ */
  const marca = $('#foco-marca');
  let enfocado = null;
  function ponerMarca() {
    if (!marca) return;
    const el = enfocado;
    // en los diálogos y en las escalas de Radio (que llevan su propio foco) no se pinta un segundo foco
    if (!el || !document.contains(el) || el.closest('dialog, [data-modulo="radio"], [data-modulo="radio-pie"]')) { marca.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { marca.classList.remove('es-visible'); return; }
    const fijo = !!el.closest('.cab, .cookies, .mando, .menu-movil, .saltar');
    marca.classList.toggle('es-fijo', fijo);
    const w = Math.max(16, r.width);
    marca.style.width = w + 'px';
    marca.style.left = (r.left + (r.width - w) / 2 + (fijo ? 0 : scrollX)) + 'px';
    marca.style.top = (r.bottom + 4 + (fijo ? 0 : scrollY)) + 'px';
    marca.style.setProperty('--foco', getComputedStyle(el).getPropertyValue('--foco').trim() || '#7A5A2A');
    marca.classList.add('es-visible');
  }
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible'); } catch (er) {}
      enfocado = visible ? el : null;
      ponerMarca();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 12. con el scroll: cabecera, aguja y módulos que esperan ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    pintarCabecera();
    reintentar();
    if (enfocado && marca.classList.contains('es-fijo')) ponerMarca();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (!pend) pend = requestAnimationFrame(alScroll); }).observe($('#principal'));
  alScroll();

  /* ============ 13. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      remontarTodos();
      document.dispatchEvent(new CustomEvent('juanin:densidad', { detail: sobria() ? 'sobria' : 'sintonia' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 14. recargar a media página: se vuelve arriba (checklist punto 12) ============ */
  addEventListener('load', () => { if (!location.hash && scrollY > 0) scrollTo(0, 0); });

  /* ============ 15. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      pPrev = -1;
      document.dispatchEvent(new CustomEvent('juanin:resize'));
      alScroll();
      ponerMarca();
    }, 200);
  });

  // lo que pueden usar los módulos y las pruebas
  J.web = { motion, quieto, sobria, irA, montados, get altoVista() { return altoVista; } };
  document.dispatchEvent(new CustomEvent('juanin:web'));
})();
