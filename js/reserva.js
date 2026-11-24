/* ------------------------------------------------------------------
   Casa María Juanín · reserva.js · motor de reservas de DEMOSTRACIÓN para TRES apartamentos
   (el de las hermanas, adaptado). Eliges apartamento (o «el que esté libre» según las personas), personas y noches;
   después, tus datos y la confirmación con su localizador JUANIN-AAMMDD-X (X = P, C o S).
   Cada apartamento tiene su calendario de 12 meses con noches ocupadas DE EJEMPLO (semilla fija: siempre las mismas).
   El resumen es una escala de 12 meses SINTONIZADA: las noches elegidas son un tramo iluminado y la temporada de la
   nieve se lee en ella. No hay servidor: no se envía ni se guarda nada.

   Una sola fuente: data/apartamentos.json (nombres, plazas, tarifas). Si no se puede leer (file://), valen los mismos
   valores escritos abajo.
   SUPUESTOS (marcados también en la página y en el README):
   - precio por apartamento y noche: 85 € en baja y 115 € en alta (su tarifa de 2021, dentro de la horquilla oficial
     de 70 a 150 €); Nochevieja (la noche del 31 de diciembre), 150 €; cama supletoria, 12 € la noche desde la 5.ª persona;
   - temporada alta = la de la nieve: del 26 de noviembre a fin de Semana Santa (Domingo de Resurrección incluido);
   - mínimo 2 noches; El Salao es el de 4 plazas (Turismo Asturias no dice cuál).
   Escucha Juanin.motor.apartamento(id) (lo llama Juanin.reservar, que lanza main.js al oír «juanin:apartamento»).
   API: Juanin.motor.apartamento(id), .personas(n), .fechas(entrada, salida), .mes(v), .borrar(), .estado
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const raiz = document.getElementById('motor');
  if (!raiz) return;
  const J = (window.Juanin = window.Juanin || {});

  /* ---------- fechas ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deClave = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const mas = (k, n) => { const d = deClave(k); d.setDate(d.getDate() + n); return clave(d); };
  const entre = (a, b) => Math.round((deClave(b) - deClave(a)) / 864e5);
  const hoy = (() => { try { const q = new URLSearchParams(location.search).get('motor-hoy'); if (q && /^\d{4}-\d\d-\d\d$/.test(q)) return q; } catch (e) {} return clave(new Date()); })();
  const fCorta = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fEur = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const corta = (k) => fCorta.format(deClave(k));
  const larga = (k) => fLarga.format(deClave(k));
  const eur = (n) => fEur.format(Math.round(n * 100) / 100) + ' €';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // Domingo de Pascua (algoritmo anónimo gregoriano)
  const cachePascua = new Map();
  function pascua(y) {
    if (cachePascua.has(y)) return cachePascua.get(y);
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    const r = clave(new Date(y, mes - 1, dia));
    cachePascua.set(y, r);
    return r;
  }

  /* ---------- los apartamentos y las tarifas (de data/apartamentos.json; estos valores son su copia de respaldo) ---------- */
  let APTOS = [
    { id: 'panera', letra: 'P', nombre: 'La Panera', planta_texto: '1.ª planta', plazas: { fijas: 4, supletorias: 1, max: 5, texto: '4 a 5 personas' } },
    { id: 'capitan', letra: 'C', nombre: 'El Capitán', planta_texto: '2.ª planta', plazas: { fijas: 4, supletorias: 1, max: 5, texto: '4 a 5 personas' } },
    { id: 'salao', letra: 'S', nombre: 'El Salao', planta_texto: '3.ª planta', plazas: { fijas: 4, supletorias: 0, max: 4, texto: '4 personas' } },
  ];
  let T = { baja: 85, alta: 115, nochevieja: 150, supletoria: 12, minimo_noches: 2 };
  const apto = (id) => APTOS.find((a) => a.id === id);
  const MAXP = () => Math.max(...APTOS.map((a) => a.plazas.max));
  const VENTANA = 12;

  // una noche es de temporada alta (la de la nieve) del 26 de noviembre a fin de Semana Santa
  const cacheAlta = new Map();
  function esAlta(k) {
    if (cacheAlta.has(k)) return cacheAlta.get(k);
    const y = +k.slice(0, 4), md = k.slice(5);
    const v = md >= '11-26' || k <= pascua(y);
    cacheAlta.set(k, v);
    return v;
  }
  const esNochevieja = (k) => k.slice(5) === '12-31';
  const precioNoche = (k) => (esNochevieja(k) ? T.nochevieja : esAlta(k) ? T.alta : T.baja);

  /* ---------- noches ocupadas de ejemplo, por apartamento (siempre las mismas) ---------- */
  function azar(s) { return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SEMILLA = { panera: 510, capitan: 1898, salao: 2006 };
  function generar(id) {
    const set = new Set();
    const tomar = (a, n) => { for (let i = 0; i < n; i++) set.add(mas(a, i)); };
    const anios = new Set();
    for (let k = mas(hoy, -40), fin = mas(hoy, 400); k <= fin; k = mas(k, 1)) anios.add(+k.slice(0, 4));
    anios.forEach((y) => {
      const r = azar(y * 1000 + (SEMILLA[id] || 7));
      for (let k = `${y}-01-01`; k <= `${y}-12-31`; k = mas(k, 1)) {
        const w = deClave(k).getDay();
        // los fines de semana de nieve se llenan más
        if (w === 5 && r() < (esAlta(k) ? 0.55 : 0.22)) tomar(k, 2);
      }
      if (r() < 0.9) tomar(mas(pascua(y), -4), 4);
      [[`${y}-12-05`, 4], [`${y}-12-29`, 4], [`${y}-02-14`, 3], [`${y}-10-10`, 3], [`${y}-05-01`, 2], [`${y}-11-01`, 2]].forEach(([a, n]) => { if (r() < 0.6) tomar(a, n); });
      let k = `${y}-07-15`;
      while (k < `${y}-08-31`) { const n = 3 + Math.floor(r() * 5); if (r() < 0.7) tomar(k, n); k = mas(k, n + (r() < 0.5 ? 1 : 2)); }
      for (let i = 0; i < 6; i++) { const d = Math.floor(r() * 365); if (r() < 0.6) tomar(mas(`${y}-01-01`, d), 2 + Math.floor(r() * 3)); }
    });
    return set;
  }
  const OCUP = new Map();
  const ocupDe = (id) => { if (!OCUP.has(id)) OCUP.set(id, generar(id)); return OCUP.get(id); };
  const libreApto = (id, k) => !ocupDe(id).has(k);
  const caben = (a, p) => a.plazas.max >= p;

  /* ---------- estado ---------- */
  const b0 = deClave(hoy);
  const st = { apt: 'libre', pers: 2, y: b0.getFullYear(), m: b0.getMonth(), ini: null, fin: null, paso: 'fechas', msg: '', datos: {}, loc: '', asignado: null };
  const minMes = st.y * 12 + st.m, maxMes = minMes + VENTANA - 1;
  const inicioVentana = clave(new Date(b0.getFullYear(), b0.getMonth(), 1));
  const limite = clave(new Date(b0.getFullYear(), b0.getMonth() + VENTANA, 0));

  // los apartamentos que cuentan con la elección actual (uno, o todos los que caben)
  const candidatos = () => (st.apt === 'libre' ? APTOS.filter((a) => caben(a, st.pers)) : APTOS.filter((a) => a.id === st.apt));
  const ocupada = (k) => !candidatos().some((a) => libreApto(a.id, k));
  const libreEntreApto = (id, a, b) => { for (let k = a; k < b; k = mas(k, 1)) if (!libreApto(id, k)) return false; return true; };
  // el apartamento que queda para esas noches: el elegido, o el primero que cabe y está libre todas
  const aptoPara = (a, b) => candidatos().find((x) => caben(x, st.pers) && libreEntreApto(x.id, a, b)) || null;
  const noches = () => { if (!st.ini || !st.fin) return []; const r = []; for (let k = st.ini; k < st.fin; k = mas(k, 1)) r.push(k); return r; };
  function cuenta() {
    const n = noches(), a = st.ini && st.fin ? aptoPara(st.ini, st.fin) : null;
    const extra = a ? Math.max(0, st.pers - a.plazas.fijas) : 0;
    let baja = 0, alta = 0, nv = 0;
    n.forEach((k) => { if (esNochevieja(k)) nv++; else if (esAlta(k)) alta++; else baja++; });
    const sup = extra * n.length * T.supletoria;
    return { n: n.length, baja, alta, nv, extra, sup, apto: a, total: baja * T.baja + alta * T.alta + nv * T.nochevieja + sup };
  }
  const aforoMal = () => st.apt !== 'libre' && !caben(apto(st.apt), st.pers);

  /* ---------- pintar ---------- */
  const DSEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const SUP = '<span class="sup">supuesto</span>';
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function mesHTML(y, m) {
    const primero = new Date(y, m, 1), dias = new Date(y, m + 1, 0).getDate();
    const off = (primero.getDay() + 6) % 7;
    const nombre = MESES[m] + ' de ' + y;
    let h = `<div class="mes"><h4 class="mes__tit">${MESES[m]} ${y}</h4><div class="dias" role="group" aria-label="${nombre}">`;
    h += DSEM.map((d) => `<span class="dsem" aria-hidden="true">${d}</span>`).join('');
    for (let i = 0; i < off; i++) h += '<span class="vacio"></span>';
    for (let d = 1; d <= dias; d++) {
      const k = `${y}-${pad(m + 1)}-${pad(d)}`;
      const c = ['dia'];
      let dis = false, et = fLarga.format(deClave(k));
      if (k < hoy || k > limite) { c.push('pasado'); dis = true; }
      else if (ocupada(k)) {
        if (st.ini && !st.fin && k > st.ini && aptoPara(st.ini, k)) { c.push('solo-salida'); et += ', libre para salir'; }
        else { c.push('ocupado'); dis = true; et += ', ocupado'; }
      } else et += ', libre';
      if (esAlta(k) && !dis) { c.push('alta'); et += ', temporada alta'; }
      if (st.ini && k === st.ini) { c.push('ini'); et += ', llegada'; }
      if (st.fin && k === st.fin) { c.push('fin'); et += ', salida'; }
      if (st.ini && st.fin && k > st.ini && k < st.fin) c.push('rango');
      h += `<button type="button" class="${c.join(' ')}" data-k="${k}" aria-label="${et}"${dis ? ' aria-disabled="true" tabindex="-1"' : ''}${(k === st.ini || k === st.fin) ? ' aria-pressed="true"' : ''}>${d}</button>`;
    }
    return h + '</div></div>';
  }

  /* la escala del año: una marca por noche (más tenue si está ocupada), la banda de la nieve, el tramo elegido encendido,
     la aguja en la llegada y una marca en hoy. Debajo, los 12 meses como botones para mover el calendario */
  function anioHTML() {
    const total = entre(inicioVentana, mas(limite, 1));
    const X0 = 8, W = 584;
    const x = (k) => X0 + (entre(inicioVentana, k) / total) * W;
    let marcas = '', bandas = '';
    for (let i = 0, k = inicioVentana; i < total; i++, k = mas(k, 1)) {
      const xi = x(k).toFixed(1);
      const primero = k.slice(8) === '01';
      const ocu = k >= hoy && ocupada(k);
      marcas += `<line class="tick${primero ? ' mes' : ''}${ocu ? ' ocu' : ''}" x1="${xi}" x2="${xi}" y1="${primero ? 16 : 22}" y2="44"/>`;
    }
    // la banda de la nieve: tramos continuos de temporada alta dentro de la ventana
    let ini = null;
    for (let k = inicioVentana; k <= mas(limite, 1); k = mas(k, 1)) {
      const a = k <= limite && esAlta(k);
      if (a && ini === null) ini = k;
      if (!a && ini !== null) {
        const x1 = x(ini), x2 = x(k);
        bandas += `<rect class="banda" x="${x1.toFixed(1)}" y="48" width="${(x2 - x1).toFixed(1)}" height="5" rx="1"/>`;
        if (x2 - x1 > 70) bandas += `<text class="banda-txt" x="${(x1 + 2).toFixed(1)}" y="64">Nieve · alta</text>`;
        ini = null;
      }
    }
    let tramo = '';
    if (st.ini) {
      const x1 = x(st.ini), x2 = st.fin ? x(st.fin) : x1 + W / total;
      tramo = `<rect class="tramo" x="${x1.toFixed(1)}" y="12" width="${Math.max(2, x2 - x1).toFixed(1)}" height="34"/>`
        + `<rect class="tramo-borde" x="${x1.toFixed(1)}" y="44" width="${Math.max(2, x2 - x1).toFixed(1)}" height="2.5"/>`
        + `<line class="aguja" x1="${x1.toFixed(1)}" x2="${x1.toFixed(1)}" y1="4" y2="54"/>`;
    }
    const xh = x(hoy);
    const hoyM = `<path class="hoy" d="M${(xh - 4).toFixed(1)} 2h8l-4 6z"/>`;
    const actual = st.y * 12 + st.m;
    let meses = '';
    for (let i = 0; i < VENTANA; i++) {
      const idx = minMes + i, y = Math.floor(idx / 12), m = idx % 12;
      const visible = idx === actual || idx === actual + 1;
      meses += `<button type="button" data-mes="${y}-${pad(m + 1)}" aria-label="Ver ${MESES[m]} de ${y}"${visible ? ' aria-current="true"' : ''}>${MES3[m]}</button>`;
    }
    return `<div class="anio"><svg viewBox="0 0 600 68" aria-hidden="true" focusable="false">${bandas}${marcas}${tramo}${hoyM}</svg>
      <div class="anio__meses" role="group" aria-label="Ir a un mes">${meses}</div></div>`;
  }

  const resumenFechas = () => `<div class="fechas"><div><small>Llegada</small><b>${st.ini ? corta(st.ini) : 'por elegir'}</b></div><div><small>Salida</small><b>${st.fin ? corta(st.fin) : 'por elegir'}</b></div></div>`;
  function desglose() {
    const c = cuenta();
    let d = '<div class="desglose" id="desglose">';
    if (!c.n) d += `<div class="nada">${st.ini ? 'Ahora, el día de salida.' : 'Elige el día de llegada en el calendario.'}</div>`;
    else {
      const fila = (n, txt, p) => `<div><span>${n} ${n === 1 ? 'noche' : 'noches'}${txt} × ${eur(p)}</span><span>${eur(n * p)}</span></div>`;
      if (c.baja) d += fila(c.baja, '', T.baja);
      if (c.alta) d += fila(c.alta, ' de nieve', T.alta);
      if (c.nv) d += fila(c.nv, ' de Nochevieja', T.nochevieja);
      if (c.sup) d += `<div><span>Cama supletoria × ${c.n} ${c.n === 1 ? 'noche' : 'noches'}</span><span>${eur(c.sup)}</span></div>`;
      d += `<div class="tot"><span>Total estimado</span><span data-total>${eur(c.total)}</span></div>`;
    }
    return d + '</div>';
  }
  function cabResumen() {
    const c = cuenta();
    const a = st.apt === 'libre' ? c.apto : apto(st.apt);
    const txt = a ? `${a.nombre} · ${a.planta_texto}` : 'El que esté libre';
    return `<p class="sintonia__apt" id="motor-apt">${esc(txt)} · ${st.pers} ${st.pers === 1 ? 'persona' : 'personas'}</p>`;
  }

  function panelFechas() {
    const c = cuenta(), listo = c.n >= T.minimo_noches && !!c.apto && !aforoMal();
    return `<h3 id="motor-tit-paso" tabindex="-1">Tu estancia, sintonizada</h3>
      ${cabResumen()}
      ${anioHTML()}
      ${resumenFechas()}
      ${desglose()}
      <button type="button" class="btn btn--luz" data-acc="seguir" aria-disabled="${!listo}">Seguir: tus datos</button>
      ${st.ini ? '<button type="button" class="btn btn--linea" data-acc="borrar">Borrar las fechas</button>' : ''}
      <p class="motor__fino">Mínimo ${T.minimo_noches} noches ${SUP}. Precio por apartamento y noche: ${eur(T.baja)}, y ${eur(T.alta)} en la temporada de la nieve ${SUP}.</p>
      <p class="motor__msg" aria-live="polite">${st.paso === 'fechas' && st.msgPanel ? st.msgPanel : ''}</p>`;
  }
  function panelDatos() {
    const c = cuenta(), v = st.datos;
    return `<h3 id="motor-tit-paso" tabindex="-1">Tus datos</h3>
      ${cabResumen()}
      <p class="motor__fino"><b>${corta(st.ini)} → ${corta(st.fin)}</b> · ${c.n} noches · <b>${eur(c.total)}</b></p>
      <form class="form" id="motor-form" novalidate>
        <label for="m-nombre">Nombre y apellidos<input type="text" id="m-nombre" autocomplete="name" required value="${esc(v.nombre)}"></label>
        <label for="m-correo">Correo<input type="email" id="m-correo" autocomplete="email" required value="${esc(v.correo)}"></label>
        <label for="m-tel">Teléfono<input type="tel" id="m-tel" autocomplete="tel" inputmode="tel" required value="${esc(v.tel)}"></label>
        <label for="m-nota">¿Algo que debamos saber? <span>(opcional)</span><textarea id="m-nota" rows="2">${esc(v.nota)}</textarea></label>
        <label class="check" for="m-ok"><input type="checkbox" id="m-ok" required${v.ok ? ' checked' : ''}><span>He leído la <a href="privacidad.html">política de privacidad</a>.</span></label>
        <p class="motor__msg" id="m-error" aria-live="assertive"></p>
        <button type="submit" class="btn btn--luz">Pedir la reserva</button>
        <p class="motor__fino motor__aviso">Demostración: no se envía ni se guarda nada.</p>
        <button type="button" class="btn btn--linea" data-acc="volver">Volver a las fechas</button>
      </form>`;
  }
  function panelHecho() {
    const c = cuenta(), a = st.asignado;
    return `<div class="confirmacion">
      <h3 id="motor-tit-paso" tabindex="-1">Reserva pedida <small>(de demostración)</small></h3>
      <p class="confirmacion__loc" id="motor-loc">${st.loc}</p>
      <p><b>${esc(a.nombre)}</b>, ${a.planta_texto}<br>${larga(st.ini)} → ${larga(st.fin)}<br>${c.n} noches · ${st.pers} ${st.pers === 1 ? 'persona' : 'personas'} · ${eur(c.total)}</p>
      <p>Entrada desde las 14:00 y salida hasta las 12:00.</p>
      <p class="motor__fino" id="motor-demo-hecho">Demostración: no se ha enviado ni guardado nada. En la web de verdad, la casa te escribiría para confirmarla.</p>
      <button type="button" class="btn btn--linea" data-acc="otra">Hacer otra reserva</button>
    </div>`;
  }

  function controles() {
    const opciones = [...APTOS.map((a) => [a.id, a.nombre, a.plazas.max > a.plazas.fijas ? `${a.plazas.fijas}-${a.plazas.max}` : String(a.plazas.max)]), ['libre', 'El que esté libre', '']];
    const botones = opciones.map(([id, n, p]) => `<button type="button" data-apt="${id}" aria-pressed="${st.apt === id}">${n}${p ? `<small>${p} pers.</small>` : ''}</button>`).join('');
    let aforo = '';
    if (aforoMal()) {
      const a = apto(st.apt), otros = APTOS.filter((x) => caben(x, st.pers));
      aforo = `<p class="motor__aforo" role="status"><span>${esc(a.nombre)} es para ${a.plazas.max} personas <span class="sup">supuesto</span>. Para ${st.pers}:</span>${otros.map((o) => `<button type="button" data-apt="${o.id}">Cambiar a ${esc(o.nombre)}</button>`).join('')}</p>`;
    }
    const tope = MAXP();
    return `<div class="motor__ctrl"${st.paso !== 'fechas' ? ' inert' : ''}>
      <div class="motor__grupo" role="group" aria-labelledby="m-apt-eti"><span class="motor__eti" id="m-apt-eti">Apartamento</span><div class="aptos">${botones}</div></div>
      <div class="motor__grupo" role="group" aria-labelledby="m-pers-eti"><span class="motor__eti" id="m-pers-eti">Personas · hasta ${tope}</span>
        <div class="pers"><button type="button" data-acc="menos" aria-label="Una persona menos"${st.pers <= 1 ? ' disabled' : ''}>−</button><output id="m-pers" aria-live="polite">${st.pers}</output><button type="button" data-acc="mas" aria-label="Una persona más"${st.pers >= tope ? ' disabled' : ''}>+</button></div></div>
      ${aforo}
      ${st.pers >= tope ? `<p class="motor__fino" style="flex-basis:100%">¿Sois más de ${tope}? La casa entera son 14 plazas: llama al <a class="enlace" href="tel:+34669750209">669 75 02 09</a>.</p>` : ''}
    </div>`;
  }

  function pintar(foco) {
    const y2 = st.m === 11 ? st.y + 1 : st.y, m2 = (st.m + 1) % 12, actual = st.y * 12 + st.m;
    const panel = { fechas: panelFechas, datos: panelDatos, hecho: panelHecho }[st.paso]();
    raiz.innerHTML = controles() + `<div class="motor__in">
      <div class="motor__cal"${st.paso !== 'fechas' ? ' inert' : ''}>
        <div class="motor__top"><h3>Noches libres${st.apt === 'libre' ? '' : ' en ' + esc(apto(st.apt).nombre)}</h3>
          <button type="button" class="motor__nav" data-acc="prev" aria-label="Mes anterior"${actual <= minMes ? ' disabled' : ''}>‹</button>
          <button type="button" class="motor__nav" data-acc="next" aria-label="Mes siguiente"${actual + 1 >= maxMes ? ' disabled' : ''}>›</button></div>
        <div class="motor__meses">${mesHTML(st.y, st.m)}${mesHTML(y2, m2)}</div>
        <div class="motor__ley"><span><i class="ley-sel"></i>Tu estancia</span><span><i class="ley-ocu"></i>Ocupado (de ejemplo)</span><span><i class="ley-alta"></i>Temporada de la nieve (alta)</span></div>
        <p class="motor__msg" aria-live="polite">${st.msg}</p>
      </div>
      <div class="sintonia sup-noche">${panel}</div></div>`;
    if (foco) {
      const el = raiz.querySelector(foco);
      if (el) el.focus({ preventScroll: true });
    }
  }

  function aMes(v) {
    let y, m;
    const s = String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    if (/^\d{4}-\d{1,2}$/.test(s)) { [y, m] = s.split('-').map(Number); m -= 1; }
    else {
      const n = /^\d{1,2}$/.test(s) ? +s - 1 : MESES.indexOf(s);
      if (n < 0 || n > 11) return false;
      m = n; y = b0.getFullYear(); if (y * 12 + m < minMes) y++;
    }
    const idx = Math.max(minMes, Math.min(maxMes - 1, y * 12 + m));
    st.y = Math.floor(idx / 12); st.m = idx % 12;
    return true;
  }
  // al cambiar de apartamento o de personas, las fechas que ya no valen se quitan con un aviso
  function revisarFechas() {
    if (!st.ini) return;
    if (st.fin && !aptoPara(st.ini, st.fin)) {
      st.msg = st.apt === 'libre' ? 'Ningún apartamento con sitio queda libre todas esas noches: elige otras.' : `${apto(st.apt).nombre} tiene noches ocupadas en esas fechas: elige otras.`;
      st.ini = st.fin = null;
    } else if (!st.fin && ocupada(st.ini)) { st.ini = null; }
  }
  function elegirApto(id) {
    if (!(id === 'libre' || apto(id))) return false;
    st.apt = id; st.msg = '';
    revisarFechas();
    return true;
  }

  /* ---------- acciones ---------- */
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.k) {
      if (b.getAttribute('aria-disabled') === 'true' || st.paso !== 'fechas') return;
      const k = b.dataset.k;
      st.msg = '';
      if (!st.ini || st.fin || k <= st.ini) {
        if (ocupada(k)) return;
        st.ini = k; st.fin = null;
      } else if (!aptoPara(st.ini, k)) {
        st.msg = st.apt === 'libre' ? 'Ningún apartamento con sitio está libre todas esas noches: elige otra salida.' : 'Hay noches ocupadas entre medias: elige otra salida.';
        if (!ocupada(k)) { st.ini = k; st.fin = null; }
      } else if (entre(st.ini, k) < T.minimo_noches) {
        st.msg = `La estancia mínima es de ${T.minimo_noches} noches.`;
      } else st.fin = k;
      pintar(`[data-k="${k}"]`);
      return;
    }
    if (b.dataset.apt) { elegirApto(b.dataset.apt); pintar(`.aptos [data-apt="${b.dataset.apt}"]`); return; }
    if (b.dataset.mes) { aMes(b.dataset.mes); pintar(`[data-mes="${b.dataset.mes}"]`); return; }
    const a = b.dataset.acc;
    if (!a) return;
    if (b.getAttribute('aria-disabled') === 'true') {
      if (a === 'seguir') {
        st.msg = aforoMal() ? 'Elige un apartamento donde quepáis.' : !st.ini ? 'Elige primero el día de llegada.' : !st.fin ? 'Falta el día de salida.' : 'Elige otras fechas.';
        pintar('[data-acc="seguir"]');
      }
      return;
    }
    let foco = `[data-acc="${a}"]:not(:disabled)`;
    if (a === 'prev') { if (st.y * 12 + st.m <= minMes) return; if (st.m === 0) { st.m = 11; st.y--; } else st.m--; }
    else if (a === 'next') { if (st.y * 12 + st.m + 1 >= maxMes) return; if (st.m === 11) { st.m = 0; st.y++; } else st.m++; }
    else if (a === 'menos') { st.pers = Math.max(1, st.pers - 1); revisarFechas(); }
    else if (a === 'mas') { st.pers = Math.min(MAXP(), st.pers + 1); revisarFechas(); }
    else if (a === 'borrar') { st.ini = st.fin = null; st.msg = ''; foco = '#motor-tit-paso'; }
    else if (a === 'seguir') { st.paso = 'datos'; st.msg = ''; foco = '#motor-tit-paso'; }
    else if (a === 'volver') { guardarDatos(); st.paso = 'fechas'; foco = '#motor-tit-paso'; }
    else if (a === 'otra') { st.paso = 'fechas'; st.ini = st.fin = null; st.datos = {}; st.asignado = null; foco = '#motor-tit-paso'; }
    else return;
    pintar(foco);
    if (['seguir', 'volver', 'otra'].includes(a) && J.web && J.web.irA) {
      const r = raiz.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.5) J.web.irA(raiz);
    }
  });

  function guardarDatos() {
    const v = (id) => { const el = raiz.querySelector('#' + id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
    if (!raiz.querySelector('#m-nombre')) return;
    st.datos = { nombre: v('m-nombre'), correo: v('m-correo'), tel: v('m-tel'), nota: v('m-nota'), ok: v('m-ok') };
  }

  raiz.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, err = f.querySelector('#m-error');
    guardarDatos();
    const campos = ['m-nombre', 'm-correo', 'm-tel'].map((id) => f.querySelector('#' + id));
    campos.forEach((c) => c.removeAttribute('aria-invalid'));
    const falta = [];
    if (!st.datos.nombre.trim()) falta.push([campos[0], 'el nombre']);
    if (!/^\S+@\S+\.\S{2,}$/.test(st.datos.correo.trim())) falta.push([campos[1], 'un correo válido']);
    if (st.datos.tel.replace(/\D/g, '').length < 9) falta.push([campos[2], 'un teléfono de al menos 9 cifras']);
    if (falta.length) {
      falta.forEach(([c]) => c.setAttribute('aria-invalid', 'true'));
      err.textContent = 'Falta ' + falta.map((x) => x[1]).join(', ') + '.';
      falta[0][0].focus();
      return;
    }
    if (!st.datos.ok) { err.textContent = 'Falta aceptar la política de privacidad.'; f.querySelector('#m-ok').focus(); return; }
    st.asignado = aptoPara(st.ini, st.fin);
    // localizador JUANIN-AAMMDD-X: la llegada y la letra del apartamento. En la demostración no se guarda en ningún sitio
    st.loc = 'JUANIN-' + st.ini.slice(2).replace(/-/g, '') + '-' + st.asignado.letra;
    st.paso = 'hecho';
    pintar('#motor-tit-paso');
  });

  /* ---------- API para la web y los módulos ---------- */
  J.motor = {
    apartamento(id) {
      if (st.paso === 'hecho') { st.paso = 'fechas'; st.ini = st.fin = null; st.asignado = null; }
      if (st.paso === 'datos') { guardarDatos(); st.paso = 'fechas'; }
      if (!elegirApto(id)) return false;
      pintar();
      return true;
    },
    personas(n) { n = Math.round(+n); if (!(n >= 1 && n <= MAXP())) return false; st.pers = n; revisarFechas(); pintar(); return true; },
    mes(v) { if (!aMes(v)) return false; pintar(); return true; },
    fechas(entrada, salida) {
      if (!entrada || !salida || salida <= entrada || entre(entrada, salida) < T.minimo_noches) return false;
      if (entrada < hoy || salida > mas(limite, 1) || !aptoPara(entrada, salida)) return false;
      st.ini = entrada; st.fin = salida; st.paso = 'fechas'; st.msg = '';
      aMes(entrada.slice(0, 7));
      pintar();
      return true;
    },
    borrar() { st.ini = st.fin = null; st.paso = 'fechas'; pintar(); },
    get estado() { return { apartamento: st.apt, personas: st.pers, entrada: st.ini, salida: st.fin, paso: st.paso, localizador: st.loc }; },
  };

  pintar();

  // una sola fuente: los datos reales del JSON (si se puede leer) sustituyen a la copia de respaldo
  fetch('data/apartamentos.json').then((r) => r.json()).then((d) => {
    if (d && Array.isArray(d.apartamentos) && d.apartamentos.length) APTOS = d.apartamentos;
    if (d && d.tarifas) T = Object.assign({}, T, d.tarifas);
    pintar();
  }).catch(() => {});

  // para las pruebas
  window.__motor = { st, ocupDe, esAlta, precioNoche, cuenta, pascua, aptoPara, get T() { return T; }, get APTOS() { return APTOS; }, hoy, limite };
})();
