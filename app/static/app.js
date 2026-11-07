/* App Vecinal Solidaria — frontend
   Reglas: nada de innerHTML con datos sin escapar, avisos no bloqueantes,
   estado en localStorage, caché con hora de actualización. */
'use strict';

const $ = (id) => document.getElementById(id);
const API = '';

const state = {
  token: localStorage.getItem('tv_token') || '',
  user: JSON.parse(localStorage.getItem('tv_user') || 'null'),
  view: 'local',
  tipo: 'servicio',
  favorFiltro: '',
  offset: 0,
  limit: 12,
  total: 0,
  coords: null,
  cache: {},
};

/* ------------------------------------------------------------------ utilidades */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function toast(msg, kind = '') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 6000 : 4000);
}

function banner(msg, persist = false) {
  const b = $('banner');
  b.textContent = msg;
  b.hidden = false;
  if (!persist) setTimeout(() => { b.hidden = true; }, 5000);
}

function setError(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || '';
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
  };
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: headers() });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    let detail = data.detail;
    if (Array.isArray(detail)) {
      detail = detail.map((e) => {
        const campo = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : '';
        const msgs = {
          string_too_short: 'es demasiado corto',
          string_too_long: 'es demasiado largo',
          string_pattern_mismatch: 'no tiene el formato correcto',
          missing: 'es obligatorio',
          value_error: 'no es válido',
        };
        return `${campo}: ${msgs[e.type] || e.msg || 'dato inválido'}`;
      }).join('. ');
    }
    throw new Error(detail || 'No se pudo completar la acción');
  }
  return data;
}

const fecha = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '';
const hora = (ts) => ts ? new Date(ts * 1000).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';

const TIPO_LABEL = {
  servicio: 'Servicio', producto: 'Producto',
  favor_solicitado: 'Necesito', favor_ofrecido: 'Ofrezco',
};
const SUBTIPO_LABEL = {
  prestamo: 'Préstamo', ayuda_temporal: 'Ayuda temporal', donacion: 'Donación',
  intercambio_habilidades: 'Intercambio de habilidades', movilidad: 'Movilidad solidaria',
};
const MEDIO_LABEL = {
  yape: 'Yape', plin: 'Plin', efectivo: 'Efectivo', transferencia: 'Transferencia',
  intercambio: 'Intercambio',
};
const NECESIDAD_LABEL = {
  agua_potable: 'Agua potable', alimentos: 'Alimentos', abrigo: 'Abrigo (colchón, frazada)',
  techo: 'Techo (carpa, calamina)', higiene: 'Higiene', salud: 'Salud / medicinas',
  balde_bidon: 'Balde o bidón', herramientas: 'Herramientas', movilidad: 'Movilidad / evacuación',
  alojamiento: 'Alojamiento temporal', energia: 'Energía (linterna, radio)', otro: 'Otro',
};

/* ------------------------------------------------------------------ sesión */
function guardarSesion(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('tv_token', token);
  localStorage.setItem('tv_user', JSON.stringify(user));
  renderUser();
}

function cerrarSesion() {
  api('/api/logout', { method: 'POST' }).catch(() => {});
  state.token = '';
  state.user = null;
  localStorage.removeItem('tv_token');
  localStorage.removeItem('tv_user');
  renderUser();
  toast('Cerraste sesión', 'ok');
}

function renderUser() {
  const u = state.user;
  $('userbox').textContent = u ? `👤 ${u.nombre} · ${u.zona}` : 'Sin sesión';
  document.querySelectorAll('[data-auth]').forEach((b) => { b.disabled = false; });
  const modBtn = document.querySelector('[data-moderador]');
  if (modBtn) modBtn.hidden = !(u && u.rol === 'moderador');

  $('auth-box').hidden = !!u;
  $('perfil-edit').hidden = !u;

  if (u) {
    $('perfil-card').innerHTML = `
      <h3>${esc(u.nombre)}</h3>
      <p class="meta">${esc(u.zona)} · ${esc(u.telefono)} · ${esc(u.email)}</p>
      <div class="badges">
        <span class="badge">${u.rol === 'moderador' ? 'Moderador' : 'Vecino'}</span>
        ${u.telefono_verificado ? '<span class="badge gris">Teléfono verificado</span>' : ''}
        ${u.yape ? `<span class="badge">Yape: ${esc(u.yape)}</span>` : '<span class="badge ambar">Sin Yape</span>'}
      </div>
      ${u.descripcion ? `<p>${esc(u.descripcion)}</p>` : ''}
      ${u.oficios ? `<p class="meta">Oficios: ${esc(u.oficios)}</p>` : ''}`;
    $('p-nombre').value = u.nombre || '';
    $('p-zona').value = u.zona || 'Zona Centro';
    $('p-desc').value = u.descripcion || '';
    $('p-ofi').value = u.oficios || '';
    $('p-yape').value = u.yape || '';
  } else {
    $('perfil-card').innerHTML = '<p>Inicia sesión para ver tus datos, tu teléfono y tu Yape.</p>';
  }
}

/* ------------------------------------------------------------------ tarjeta */
function tarjeta(p) {
  const badges = [
    `<span class="badge">${esc(p.categoria)}</span>`,
    `<span class="badge gris">${esc(TIPO_LABEL[p.tipo] || p.tipo)}</span>`,
    p.subtipo_favor ? `<span class="badge gris">${esc(SUBTIPO_LABEL[p.subtipo_favor] || p.subtipo_favor)}</span>` : '',
    `<span class="badge">👍 ${p.vistos} visto bueno</span>`,
    p.es_emergencia ? '<span class="badge rojo">Emergencia</span>' : '',
    ...(p.avaladores || []).map((a) => `<span class="badge ambar">Avala: ${esc(a.nombre)}</span>`),
  ].join('');

  const dist = p.distancia_km != null && p.distancia_km < 900
    ? ` · a ${p.distancia_km < 1 ? Math.round(p.distancia_km * 1000) + ' m' : p.distancia_km + ' km'}`
    : '';

  const wa = p.telefono
    ? `<a class="btn primary" href="https://wa.me/51${encodeURIComponent(p.telefono)}?text=${encodeURIComponent('Hola, te escribo por la App Vecinal Solidaria sobre: ' + p.titulo)}" target="_blank" rel="noopener" data-contacto="${esc(p.id)}">WhatsApp</a>`
    : `<button type="button" class="btn" data-detalle="${esc(p.id)}">Ver y contactar</button>`;

  return `<article class="card">
    <h3>${esc(p.titulo)}</h3>
    <div class="badges">${badges}</div>
    <p class="meta">${esc(p.autor)} · ${esc(p.zona)}${dist} · ${fecha(p.creado)}</p>
    <p class="desc">${esc((p.descripcion || '').slice(0, 140))}${(p.descripcion || '').length > 140 ? '…' : ''}</p>
    <p class="precio">${esc(p.precio || 'Intercambio / sin dinero')}</p>
    <div class="actions">
      <button type="button" class="btn" data-detalle="${esc(p.id)}">Ver detalle</button>
      ${wa}
    </div>
  </article>`;
}

function vacio(texto, accion) {
  return `<div class="card"><p>${esc(texto)}</p>${accion || ''}</div>`;
}

/* ------------------------------------------------------------------ Economía Local */
async function cargarLocal(reset = true) {
  if (reset) { state.offset = 0; }
  const params = new URLSearchParams({ limit: state.limit, offset: state.offset });
  if (state.tipo) params.set('tipo', state.tipo);
  const cat = $('cat').value; if (cat) params.set('categoria', cat);
  const zona = $('zona').value; if (zona) params.set('zona', zona);
  const q = $('q').value.trim(); if (q) params.set('q', q);
  if (state.coords) { params.set('lat', state.coords.lat); params.set('lng', state.coords.lng); }

  try {
    const data = await api('/api/publicaciones?' + params);
    state.total = data.total;
    const html = data.items.map(tarjeta).join('');
    $('list').innerHTML = reset ? (html || vacio('No encontramos nada con esos filtros. Prueba otra categoría o publica tú el primero.',
      '<div class="actions"><button type="button" class="btn primary" data-publicar="1">+ Publicar</button></div>')) : $('list').innerHTML + html;
    $('btn-more').hidden = !data.has_more;
    guardarCache('local', data.items);
  } catch (e) {
    const cache = leerCache('local');
    $('list').innerHTML = cache.items.length
      ? cache.items.map(tarjeta).join('')
      : vacio('Sin conexión y sin datos guardados. Revisa tu internet e inténtalo otra vez.');
    $('btn-more').hidden = true;
    banner(`📴 Sin conexión — mostrando datos guardados${cache.at ? ' de las ' + cache.at : ''}`, true);
  }
}

async function cargarFavores() {
  const params = new URLSearchParams({ limit: 50 });
  if (state.favorFiltro) params.set('tipo', state.favorFiltro);
  const sub = $('cat-favor').value; if (sub) params.set('tipo_favor', sub);
  try {
    const data = await api('/api/publicaciones?' + params);
    const items = data.items.filter((p) => p.tipo.startsWith('favor'));
    $('list-favores').innerHTML = items.length
      ? items.map(tarjeta).join('')
      : vacio('Aún no hay favores con ese filtro. Publica el primero.',
        '<div class="actions"><button type="button" class="btn primary" data-publicar-favor="1">+ Publicar favor</button></div>');
    guardarCache('favores', items);
  } catch {
    const cache = leerCache('favores');
    $('list-favores').innerHTML = cache.items.length
      ? cache.items.map(tarjeta).join('')
      : vacio('Sin conexión y sin datos guardados.');
    banner(`📴 Sin conexión — favores guardados${cache.at ? ' de las ' + cache.at : ''}`, true);
  }
}

/* ------------------------------------------------------------------ caché offline */
function guardarCache(nombre, items) {
  const payload = { items, at: hora(Date.now() / 1000) };
  localStorage.setItem('tv_cache_' + nombre, JSON.stringify(payload));
}
function leerCache(nombre) {
  try { return JSON.parse(localStorage.getItem('tv_cache_' + nombre)) || { items: [], at: '' }; }
  catch { return { items: [], at: '' }; }
}

/* ------------------------------------------------------------------ detalle */
async function abrirDetalle(id) {
  try {
    const p = await api('/api/publicaciones/' + id);
    const medios = (p.medios_pago || '').split(',').filter(Boolean)
      .map((m) => `<span class="badge">${esc(MEDIO_LABEL[m] || m)}</span>`).join('') ||
      '<span class="badge gris">Sin cobro</span>';

    const vistos = (p.vistos_detalle || []).map((v) => `
      <li>“${esc(v.comentario || 'Lo recomiendo')}” — ${esc(v.nombre)}, ${esc(v.zona)}</li>`).join('');

    const acciones = [
      p.telefono
        ? `<a class="btn primary" href="https://wa.me/51${encodeURIComponent(p.telefono)}?text=${encodeURIComponent('Hola, te escribo por la App Vecinal Solidaria sobre: ' + p.titulo)}" target="_blank" rel="noopener" data-contacto="${esc(p.id)}">WhatsApp</a>`
        : '',
      !p.es_mio ? `<button type="button" class="btn" data-cotizar="${esc(p.id)}">Pedir cotización</button>` : '',
      !p.es_mio && !p.ya_recomende ? `<button type="button" class="btn" data-visto="${esc(p.id)}">👍 Visto bueno</button>` : '',
      p.ya_recomende ? '<span class="badge">Ya diste tu visto bueno</span>' : '',
      !p.es_mio ? `<button type="button" class="btn" data-reportar="${esc(p.id)}">🚩 Reportar</button>` : '',
      p.tipo.startsWith('favor') && !p.es_mio
        ? `<button type="button" class="btn primary" data-intercambio="${esc(p.id)}" data-prestamo="${p.subtipo_favor === 'prestamo' ? '1' : '0'}">Quiero ayudar / pedirlo</button>`
        : '',
      p.es_mio ? `<button type="button" class="btn" data-cerrar-pub="${esc(p.id)}">Cerrar publicación</button>` : '',
      p.es_mio ? `<button type="button" class="btn danger" data-borrar-pub="${esc(p.id)}">Eliminar</button>` : '',
    ].join('');

    $('modal-body').innerHTML = `
      <h2 id="modal-title">${esc(p.titulo)}</h2>
      <div class="badges">
        <span class="badge">${esc(p.categoria)}</span>
        <span class="badge gris">${esc(TIPO_LABEL[p.tipo] || p.tipo)}</span>
        ${p.subtipo_favor ? `<span class="badge gris">${esc(SUBTIPO_LABEL[p.subtipo_favor] || p.subtipo_favor)}</span>` : ''}
        <span class="badge">👍 ${p.vistos} visto bueno</span>
        ${p.es_emergencia ? '<span class="badge rojo">Emergencia</span>' : ''}
      </div>
      <p class="precio">${esc(p.precio || 'Intercambio / sin dinero')}</p>
      <p>${esc(p.descripcion)}</p>
      <p class="meta">Publicado por <strong>${esc(p.autor)}</strong> · ${esc(p.zona)} · ${fecha(p.creado)}</p>

      ${p.punto_encuentro ? `<p class="meta">Punto de encuentro: ${esc(p.punto_encuentro)}</p>` : ''}
      ${p.franja_horaria ? `<p class="meta">Franja horaria: ${esc(p.franja_horaria)}</p>` : ''}
      ${p.cupo ? `<p class="meta">Cupo: ${esc(p.cupo)}</p>` : ''}

      <h3>Acepta</h3>
      <div class="badges">${medios}</div>
      <p class="meta">Acuerdo: ${{ contra_entrega: 'pago contra entrega o al terminar', mitad_mitad: '50 % al empezar y 50 % al terminar', al_terminar: 'todo al terminar' }[p.politica_pago] || 'a convenir'}</p>

      ${(p.avaladores || []).length ? `<h3>Avalado por</h3><div class="badges">${p.avaladores.map((a) => `<span class="badge ambar">${esc(a.nombre)} (${esc(a.tipo)})</span>`).join('')}</div>` : ''}

      <h3>Ubicación</h3>
      <p class="meta">${esc(p.zona)}${p.lat_publica ? ` · (${p.lat_publica}, ${p.lng_publica}) aproximada` : ''}
        ${p.distancia_km != null && p.distancia_km < 900 ? ` · a ${p.distancia_km} km de ti` : ''}</p>

      ${vistos ? `<h3>Qué dicen los vecinos</h3><ul>${vistos}</ul>` : '<p class="meta">Todavía sin recomendaciones. Puedes ser el primero.</p>'}

      <div class="actions">${acciones}</div>
      <p class="hint" style="margin-top:14px">🔒 Tu teléfono y tu ubicación exacta se muestran solo a usuarios con sesión iniciada.
        La aplicación no cobra nada y no se queda con tu dinero: el pago lo acuerdas directamente con la otra persona.</p>`;
    $('modal').hidden = false;
  } catch (e) {
    toast(e.message, 'err');
  }
}

function cerrarModales() {
  $('modal').hidden = true;
  $('pubmodal').hidden = true;
}

/* ------------------------------------------------------------------ publicación (3 pasos) */
let pasoActual = 1;

function abrirPublicar(tipoPreseleccionado) {
  if (!state.user) {
    toast('Primero crea tu cuenta o inicia sesión', 'err');
    irA('perfil');
    return;
  }
  pasoActual = 1;
  $('form-pub').reset();
  ['err-paso1', 'err-paso2', 'err-paso3'].forEach((id) => setError(id, ''));
  if (tipoPreseleccionado) $('f-tipo').value = tipoPreseleccionado;
  $('f-zona').value = state.user.zona || 'Zona Centro';
  actualizarBloquesTipo();
  mostrarPaso(1);
  $('pubmodal').hidden = false;
}

function actualizarBloquesTipo() {
  const t = $('f-tipo').value;
  const esFavor = t.startsWith('favor');
  $('bloque-favor').hidden = !esFavor;
  $('bloque-normal').hidden = esFavor;
  const esMovilidad = esFavor && $('f-subtipo').value === 'movilidad';
  $('bloque-movilidad').hidden = !esMovilidad;
}

function mostrarPaso(n) {
  pasoActual = n;
  document.querySelectorAll('#form-pub .paso').forEach((f) => {
    f.hidden = Number(f.dataset.paso) !== n;
  });
  document.querySelectorAll('.step').forEach((s) => {
    s.classList.toggle('on', Number(s.dataset.step) === n);
  });
  if (n === 3) armarResumen();
  const box = document.querySelector('#pubmodal .modalbox');
  if (box) box.scrollTop = 0;
}

function armarResumen() {
  const t = $('f-tipo').value;
  const esFavor = t.startsWith('favor');
  const cat = esFavor ? $('f-cat-favor').value : $('f-cat').value;
  const filas = [
    ['Tipo', TIPO_LABEL[t] || t],
    ...(esFavor ? [['Tipo de favor', SUBTIPO_LABEL[$('f-subtipo').value] || '']] : []),
    ['Categoría', cat],
    ['Título', $('f-titulo').value],
    ['Descripción', $('f-desc').value],
    ['Precio', $('f-precio').value || 'Intercambio / sin dinero'],
    ['Pago', MEDIO_LABEL[($('f-pagos').value || '').split(',')[0]] || 'Sin cobro'],
    ['Zona', $('f-zona').value],
  ];
  if (esFavor && $('f-subtipo').value === 'movilidad') {
    filas.push(['Franja', $('f-franja').value], ['Punto de encuentro', $('f-punto').value]);
  }
  $('resumen').innerHTML = filas
    .filter(([, v]) => v)
    .map(([k, v]) => `<p><strong>${esc(k)}:</strong> ${esc(v)}</p>`).join('');
}

async function enviarPublicacion(ev) {
  ev.preventDefault();
  setError('err-paso3', '');
  const t = $('f-tipo').value;
  const esFavor = t.startsWith('favor');
  const body = {
    tipo: t,
    categoria: (esFavor ? $('f-cat-favor').value : $('f-cat').value || '').toLowerCase(),
    subtipo_favor: esFavor ? $('f-subtipo').value : null,
    titulo: $('f-titulo').value,
    descripcion: $('f-desc').value,
    precio: $('f-precio').value || 'Intercambio / sin dinero',
    medios_pago: $('f-pagos').value,
    politica_pago: $('f-politica').value,
    zona: $('f-zona').value,
    es_emergencia: $('f-emerg').checked,
    franja_horaria: $('f-franja').value,
    punto_encuentro: $('f-punto').value,
    checklist_ok: $('f-check-mov').checked,
    client_id: (crypto.randomUUID ? crypto.randomUUID() : 'c' + Date.now()),
  };
  try {
    const r = await api('/api/publicaciones', { method: 'POST', body: JSON.stringify(body) });
    cerrarModales();
    toast(r.duplicado ? 'Esa publicación ya existía; no la duplicamos' : '¡Publicado! Ya lo ven tus vecinos', 'ok');
    cargarLocal(); cargarFavores();
  } catch (e) {
    setError('err-paso3', e.message);
  }
}

/* ------------------------------------------------------------------ acciones de detalle */
async function pedirCotizacion(id) {
  const desc = prompt('Describe lo que necesitas (qué falla, qué medida):');
  if (!desc) return;
  try {
    await api('/api/cotizaciones', {
      method: 'POST',
      body: JSON.stringify({ publicacion_id: id, descripcion: desc }),
    });
    toast('Cotización enviada. El vecino tiene 7 días para responder.', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

async function darVisto(id) {
  const com = prompt('¿Por qué lo recomiendas? (opcional)') || '';
  try {
    const r = await api('/api/vistos', {
      method: 'POST',
      body: JSON.stringify({ publicacion_id: id, comentario: com }),
    });
    toast(`¡Gracias! Ahora tiene ${r.vistos} visto bueno`, 'ok');
    abrirDetalle(id); cargarLocal();
  } catch (e) { toast(e.message, 'err'); }
}

async function reportar(id) {
  const motivo = prompt('¿Qué problema tiene esta publicación?');
  if (!motivo) return;
  try {
    const r = await api('/api/reportes', {
      method: 'POST', body: JSON.stringify({ publicacion_id: id, motivo }),
    });
    toast(r.mensaje, 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

async function crearIntercambio(id, esPrestamo) {
  let garante = ''; let fechaDev = '';
  if (esPrestamo === '1') {
    garante = prompt('Nombre del vecino que será garante:') || '';
    if (!garante) { toast('Un préstamo necesita garante', 'err'); return; }
    fechaDev = prompt('¿Cuándo lo devuelves? (ej.: viernes 8)') || '';
    if (!fechaDev) { toast('Indica la fecha de devolución', 'err'); return; }
  }
  try {
    await api('/api/intercambios', {
      method: 'POST',
      body: JSON.stringify({ peticion_id: id, garante_nombre: garante, fecha_devolucion: fechaDev }),
    });
    toast('Solicitud enviada. La otra persona debe aceptarla.', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

async function cerrarPublicacion(id) {
  try {
    await api('/api/publicaciones/' + id, {
      method: 'PATCH', body: JSON.stringify({ estado: 'resuelta' }),
    });
    toast('Publicación cerrada como resuelta', 'ok');
    cerrarModales(); cargarLocal(); cargarMias();
  } catch (e) { toast(e.message, 'err'); }
}

async function borrarPublicacion(id) {
  if (!confirm('¿Eliminar esta publicación? Dejará de verse en el directorio.')) return;
  try {
    await api('/api/publicaciones/' + id + '?motivo=' + encodeURIComponent('el autor la retiró'), { method: 'DELETE' });
    toast('Publicación eliminada', 'ok');
    cerrarModales(); cargarLocal(); cargarMias();
  } catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------------------------ emergencia */
async function cargarEmergencia() {
  try {
    const d = await api('/api/emergencia');
    const esMod = state.user && state.user.rol === 'moderador';
    $('emerg-box').innerHTML = d.activa
      ? `<div class="emerg-on">
           <h3>🚨 Modo emergencia activo</h3>
           <p>${esc(d.motivo || 'Coordinación vecinal en curso')}</p>
           <p class="meta">Activado ${d.activada_en ? 'el ' + fecha(d.activada_en) + ' a las ' + hora(d.activada_en) : ''}.
             Se apaga solo a las 72 horas.</p>
           <p class="hint">${esc(d.aviso)}</p>
           ${esMod ? '<button type="button" class="btn" data-emerg-off="1">Desactivar</button>' : ''}
         </div>`
      : `<div class="emerg-off"><strong>Modo emergencia inactivo.</strong>
           <p class="meta">Los reportes marcados para emergencia se siguen viendo abajo.</p></div>`;

    const tipos = d.necesidades_72h.map((n) => `<span class="badge gris">${esc(NECESIDAD_LABEL[n] || n)}</span>`).join('');
    $('list-emergencia').innerHTML =
      `<div class="card" style="grid-column:1/-1"><h3>Qué se puede reportar</h3><div class="badges">${tipos}</div></div>` +
      (d.reportes.length ? d.reportes.map(tarjeta).join('') : vacio('Sin reportes por ahora.'));

    const dir = await api('/api/emergencia/directorio');
    $('directorio').innerHTML = (dir.directorio.length ? dir.directorio.map((x) => `
      <div class="card"><h3>${esc(x.nombre)}</h3>
        <div class="badges"><span class="badge ambar">${esc(x.tipo)}</span><span class="badge gris">${esc(x.zona)}</span></div>
        ${x.contacto ? `<p class="meta">Contacto: ${esc(x.contacto)}</p>` : ''}</div>`).join('')
      : vacio('Aún no hay organizaciones registradas.')) +
      `<div class="card"><h3>Puntos de encuentro</h3><ul>${dir.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
    guardarCache('emergencia', d.reportes);
  } catch {
    const cache = leerCache('emergencia');
    $('emerg-box').innerHTML = '<div class="emerg-off">Sin conexión: no se puede confirmar el estado actual.</div>';
    $('list-emergencia').innerHTML = cache.items.length ? cache.items.map(tarjeta).join('')
      : vacio('Sin conexión y sin reportes guardados.');
    banner(`📴 Sin conexión — datos de emergencia${cache.at ? ' de las ' + cache.at : ' sin guardar'}`, true);
  }
}

/* ------------------------------------------------------------------ mis cosas */
async function cargarMias() {
  if (!state.user) return;
  try {
    const pubs = await api('/api/mis-publicaciones');
    $('list-mias').innerHTML = pubs.length ? pubs.map((p) => `
      <article class="card">
        <h3>${esc(p.titulo)}</h3>
        <div class="badges">
          <span class="badge gris">${esc(p.estado)}</span>
          <span class="badge">👍 ${p.vistos}</span>
          <span class="badge gris">${p.cotizaciones} cotización(es)</span>
        </div>
        <p class="meta">${esc(p.zona)} · ${fecha(p.creado)}</p>
        <div class="actions">
          <button type="button" class="btn" data-detalle="${esc(p.id)}">Ver</button>
          <button type="button" class="btn" data-cerrar-pub="${esc(p.id)}">Cerrar (resuelto)</button>
          <button type="button" class="btn danger" data-borrar-pub="${esc(p.id)}">Eliminar</button>
        </div>
      </article>`).join('') : vacio('Todavía no publicaste nada.',
        '<div class="actions"><button type="button" class="btn primary" data-publicar="1">+ Publicar</button></div>');

    const cots = await api('/api/cotizaciones');
    $('list-cotizaciones').innerHTML = cots.length ? cots.map((c) => `
      <div class="card">
        <h3>${esc(c.titulo)}</h3>
        <div class="badges">
          <span class="badge gris">${esc(c.estado)}</span>
          ${c.precio_respuesta ? `<span class="badge">${esc(c.precio_respuesta)}</span>` : ''}
        </div>
        <p class="meta">${esc(c.descripcion)}</p>
        <p class="meta">${c.comprador_id === (state.user && state.user.id) ? 'La enviaste tú' : 'Te la enviaron'} · ${fecha(c.creado)}</p>
        ${c.estado === 'enviada' && c.autor_id === (state.user && state.user.id)
          ? `<div class="actions">
               <button type="button" class="btn primary" data-resp-cot="${esc(c.id)}" data-resp="puedo">Puedo hacerlo</button>
               <button type="button" class="btn" data-resp-cot="${esc(c.id)}" data-resp="no_puedo">No puedo</button>
             </div>` : ''}
      </div>`).join('') : vacio('Sin cotizaciones por ahora.');

    const ints = await api('/api/intercambios');
    $('list-intercambios').innerHTML = ints.length ? ints.map((i) => {
      const soySolicitante = i.solicitante_id === (state.user && state.user.id);
      const botones = [];
      if (i.estado === 'solicitada' && soySolicitante) {
        botones.push(`<button type="button" class="btn primary" data-int-estado="${esc(i.id)}" data-estado="aceptada">Aceptar</button>`);
        botones.push(`<button type="button" class="btn" data-int-estado="${esc(i.id)}" data-estado="rechazada">Rechazar</button>`);
      }
      if (i.estado === 'aceptada' && !soySolicitante) {
        botones.push(`<button type="button" class="btn primary" data-int-estado="${esc(i.id)}" data-estado="en_curso">Entregado / en curso</button>`);
      }
      if (['aceptada', 'en_curso'].includes(i.estado) && soySolicitante) {
        botones.push(`<button type="button" class="btn primary" data-int-estado="${esc(i.id)}" data-estado="resuelta">Ya se resolvió</button>`);
      }
      if (['solicitada', 'aceptada'].includes(i.estado)) {
        botones.push(`<button type="button" class="btn" data-int-estado="${esc(i.id)}" data-estado="cancelada">Cancelar</button>`);
      }
      return `<div class="card">
        <h3>${esc(i.titulo)}</h3>
        <div class="badges"><span class="badge gris">${esc(i.estado)}</span>
          <span class="badge">${esc(SUBTIPO_LABEL[i.subtipo_favor] || i.subtipo_favor || '')}</span></div>
        <p class="meta">${soySolicitante ? 'Pedido por ti' : 'Pedido de ' + esc(i.solicitante_nombre)} ·
          ${i.garante_nombre ? 'Garante: ' + esc(i.garante_nombre) + ' · ' : ''}
          ${i.fecha_devolucion ? 'Devolución: ' + esc(i.fecha_devolucion) : ''}</p>
        <div class="actions">${botones.join('')}</div>
      </div>`;
    }).join('') : vacio('Sin intercambios por ahora.');
  } catch (e) {
    toast(e.message, 'err');
  }
}

/* ------------------------------------------------------------------ moderación */
async function cargarModeracion() {
  if (!state.user || state.user.rol !== 'moderador') {
    $('list-reportes').innerHTML = vacio('Solo el moderador puede ver esta sección.');
    $('metricas').innerHTML = '';
    return;
  }
  try {
    const m = await api('/api/moderacion/metricas');
    const filas = [
      ['Ofertas activas', m.ofertas_activas],
      ['Usuarios', m.usuarios],
      ['Vistos buenos', m.vistos_buenos],
      ['Contactos iniciados', m.contactos_iniciados],
      ['Cotizaciones respondidas', `${m.cotizaciones_respondidas}/${m.cotizaciones} (${m.fill_rate_cotizaciones} %)`],
      ['Intercambios resueltos', `${m.intercambios_resueltos}/${m.intercambios}`],
      ['Publicaciones últimos 7 días', m.publicaciones_ultimos_7_dias],
      ['Reportes pendientes', m.reportes_pendientes],
    ];
    $('metricas').innerHTML = `<div class="card" style="grid-column:1/-1">
      <h3>Indicadores del barrio</h3>
      <div class="badges"><span class="badge ${m.densidad === 'ok' ? '' : 'ambar'}">Densidad: ${esc(m.densidad)}</span></div>
      <table class="tabla"><tbody>
        ${filas.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
      </tbody></table>
      <p class="hint">${esc(m.criterio)}</p></div>`;

    const reps = await api('/api/moderacion/reportes');
    $('list-reportes').innerHTML = reps.length ? reps.map((r) => `
      <div class="card">
        <h3>${esc(r.titulo)}</h3>
        <p class="meta">Reportado por ${esc(r.reportante)} · ${fecha(r.creado)}</p>
        <p><strong>Motivo:</strong> ${esc(r.motivo)}</p>
        <div class="actions">
          <button type="button" class="btn" data-mod="${esc(r.id)}" data-accion="ninguna">Sin acción</button>
          <button type="button" class="btn danger" data-mod="${esc(r.id)}" data-accion="eliminar">Dar de baja</button>
        </div>
      </div>`).join('') : vacio('Sin reportes pendientes. Buen trabajo.');
  } catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------------------------ navegación */
function irA(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('on'));
  const el = $('view-' + view);
  if (el) el.classList.add('on');
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.view === view);
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (view === 'local') cargarLocal();
  if (view === 'favores') cargarFavores();
  if (view === 'emergencia') cargarEmergencia();
  if (view === 'mias') cargarMias();
  if (view === 'moderacion') cargarModeracion();
}

/* ------------------------------------------------------------------ eventos */
document.querySelectorAll('.tabs button').forEach((b) => {
  b.addEventListener('click', () => irA(b.dataset.view));
});

document.querySelectorAll('#view-local .segmented button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#view-local .segmented button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    state.tipo = b.dataset.tipo;
    cargarLocal();
  });
});

document.querySelectorAll('#view-favores .segmented button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#view-favores .segmented button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    state.favorFiltro = b.dataset.filtro;
    cargarFavores();
  });
});

let tBusqueda;
$('q').addEventListener('input', () => {
  clearTimeout(tBusqueda);
  tBusqueda = setTimeout(() => cargarLocal(), 320);
});
$('cat').addEventListener('change', () => cargarLocal());
$('zona').addEventListener('change', () => cargarLocal());
$('cat-favor').addEventListener('change', () => cargarFavores());

$('btn-more').addEventListener('click', () => {
  state.offset += state.limit;
  cargarLocal(false);
});

$('btn-ubicacion').addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Tu navegador no permite ubicación', 'err'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      $('orden-info').hidden = false;
      $('orden-info').textContent = 'Ordenado por cercanía a tu ubicación. La distancia es aproximada.';
      cargarLocal();
    },
    () => {
      $('orden-info').hidden = false;
      $('orden-info').textContent = 'No pudimos usar tu ubicación. Te mostramos el directorio por zona.';
      toast('Sin ubicación: ordenamos por zona', '');
    },
    { timeout: 8000 },
  );
});

document.querySelectorAll('[data-publicar]').forEach((b) => b.addEventListener('click', () => abrirPublicar()));
$('btn-publicar').addEventListener('click', () => abrirPublicar());
$('btn-publicar-favor').addEventListener('click', () => abrirPublicar('favor_solicitado'));
$('btn-reportar-necesidad').addEventListener('click', () => abrirPublicar('favor_solicitado'));
$('btn-ofrecer-recurso').addEventListener('click', () => abrirPublicar('favor_ofrecido'));

$('f-tipo').addEventListener('change', actualizarBloquesTipo);
$('f-subtipo').addEventListener('change', actualizarBloquesTipo);

document.querySelectorAll('[data-next]').forEach((b) => {
  b.addEventListener('click', () => {
    if (pasoActual === 1) {
      const t = $('f-tipo').value;
      const esFavor = t.startsWith('favor');
      const cat = esFavor ? $('f-cat-favor').value : $('f-cat').value;
      if (!cat) { setError('err-paso1', 'Elige una categoría'); return; }
      setError('err-paso1', '');
    }
    if (pasoActual === 2) {
      const titulo = $('f-titulo').value.trim();
      const desc = $('f-desc').value.trim();
      if (titulo.length < 3) { setError('err-paso2', 'Escribe un título de al menos 3 letras'); return; }
      if (desc.length < 5) { setError('err-paso2', 'Escribe una descripción de al menos 5 letras'); return; }
      const esMovilidad = $('f-tipo').value.startsWith('favor') && $('f-subtipo').value === 'movilidad';
      if (esMovilidad) {
        if (!$('f-franja').value.trim()) { setError('err-paso2', 'Indica la franja horaria'); return; }
        if (!$('f-punto').value.trim()) { setError('err-paso2', 'Indica un punto de encuentro público'); return; }
        if (!$('f-check-mov').checked) { setError('err-paso2', 'Confirma la lista de seguridad de movilidad'); return; }
      }
      setError('err-paso2', '');
    }
    mostrarPaso(Number(b.dataset.next));
  });
});

document.querySelectorAll('[data-prev]').forEach((b) => {
  b.addEventListener('click', () => mostrarPaso(Number(b.dataset.prev)));
});

$('form-pub').addEventListener('submit', enviarPublicacion);

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', cerrarModales));
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) cerrarModales(); });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModales(); });

/* delegación global de acciones de tarjeta y detalle */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-detalle],[data-contacto],[data-visto],[data-reportar],[data-cotizar],[data-intercambio],[data-cerrar-pub],[data-borrar-pub],[data-publicar-favor],[data-emerg-off],[data-int-estado],[data-resp-cot],[data-mod]');
  if (!t) return;

  if (t.dataset.contacto) {
    api('/api/eventos/contacto?publicacion_id=' + encodeURIComponent(t.dataset.contacto), { method: 'POST' }).catch(() => {});
    return;
  }
  if (t.dataset.publicarFavor) { abrirPublicar('favor_solicitado'); return; }
  if (t.dataset.detalle) { abrirDetalle(t.dataset.detalle); return; }
  if (t.dataset.visto) { darVisto(t.dataset.visto); return; }
  if (t.dataset.reportar) { reportar(t.dataset.reportar); return; }
  if (t.dataset.cotizar) { pedirCotizacion(t.dataset.cotizar); return; }
  if (t.dataset.intercambio) { crearIntercambio(t.dataset.intercambio, t.dataset.prestamo); return; }
  if (t.dataset.cerrarPub) { cerrarPublicacion(t.dataset.cerrarPub); return; }
  if (t.dataset.borrarPub) { borrarPublicacion(t.dataset.borrarPub); return; }

  if (t.dataset.emergOff) {
    try {
      await api('/api/emergencia/activar', { method: 'POST', body: JSON.stringify({ activa: false }) });
      toast('Emergencia desactivada', 'ok');
      cargarEmergencia();
    } catch (err) { toast(err.message, 'err'); }
    return;
  }

  if (t.dataset.intEstado) {
    try {
      await api('/api/intercambios/' + t.dataset.intEstado + '/estado', {
        method: 'POST', body: JSON.stringify({ estado: t.dataset.estado }),
      });
      toast('Intercambio actualizado: ' + t.dataset.estado, 'ok');
      cargarMias();
    } catch (err) { toast(err.message, 'err'); }
    return;
  }

  if (t.dataset.respCot) {
    try {
      await api('/api/cotizaciones/' + t.dataset.respCot + '/responder', {
        method: 'POST', body: JSON.stringify({ respuesta: t.dataset.resp }),
      });
      toast('Respuesta enviada', 'ok');
      cargarMias();
    } catch (err) { toast(err.message, 'err'); }
    return;
  }

  if (t.dataset.mod) {
    try {
      await api('/api/moderacion/reportes', {
        method: 'POST',
        body: JSON.stringify({ reporte_id: t.dataset.mod, accion: t.dataset.accion, nota: '' }),
      });
      toast('Reporte resuelto', 'ok');
      cargarModeracion(); cargarLocal();
    } catch (err) { toast(err.message, 'err'); }
    return;
  }
});

/* moderación: activar emergencia */
$('btn-emerg-on').addEventListener('click', async () => {
  const motivo = $('motivo-emerg').value.trim();
  if (!motivo) { toast('Escribe el motivo: queda registrado', 'err'); return; }
  try {
    await api('/api/emergencia/activar', { method: 'POST', body: JSON.stringify({ activa: true, motivo }) });
    toast('Modo emergencia activado. Se apaga solo en 72 horas.', 'ok');
    $('motivo-emerg').value = '';
    cargarEmergencia();
  } catch (e) { toast(e.message, 'err'); }
});
$('btn-emerg-off').addEventListener('click', async () => {
  try {
    await api('/api/emergencia/activar', { method: 'POST', body: JSON.stringify({ activa: false }) });
    toast('Emergencia desactivada', 'ok');
    cargarEmergencia();
  } catch (e) { toast(e.message, 'err'); }
});

/* registro, login, perfil */
$('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('err-registro', '');
  const body = {
    nombre: $('r-nombre').value.trim(),
    zona: $('r-zona').value,
    telefono: $('r-tel').value.trim(),
    email: $('r-email').value.trim(),
    password: $('r-pass').value,
    yape: $('r-yape').value.trim() || null,
    acepta_privacidad: $('r-priv').checked,
  };
  if (!body.nombre) { setError('err-registro', 'Escribe tu nombre'); return; }
  if (!body.zona) { setError('err-registro', 'Elige tu zona'); return; }
  if (!/^[0-9]{9}$/.test(body.telefono)) { setError('err-registro', 'El teléfono debe tener 9 dígitos'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(body.email)) { setError('err-registro', 'Revisa el correo'); return; }
  if (body.password.length < 6) { setError('err-registro', 'La contraseña necesita 6 caracteres o más'); return; }
  if (!body.acepta_privacidad) { setError('err-registro', 'Debes aceptar el aviso de privacidad'); return; }
  try {
    const r = await api('/api/registro', { method: 'POST', body: JSON.stringify(body) });
    toast(r.mensaje || 'Cuenta creada', 'ok');
    $('l-email').value = body.email;
    $('form-registro').reset();
    $('r-priv').checked = true;
    $('l-pass').focus();
  } catch (err) { setError('err-registro', err.message); }
});

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('err-login', '');
  try {
    const r = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('l-email').value.trim(), password: $('l-pass').value }),
    });
    guardarSesion(r.token, r.usuario);
    toast('¡Hola ' + r.usuario.nombre + '!', 'ok');
    $('form-login').reset();
    irA('local');
  } catch (err) { setError('err-login', err.message); }
});

$('form-perfil').addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('err-perfil', '');
  try {
    const r = await api('/api/perfil', {
      method: 'PUT',
      body: JSON.stringify({
        nombre: $('p-nombre').value.trim(),
        zona: $('p-zona').value,
        descripcion: $('p-desc').value.trim(),
        oficios: $('p-ofi').value.trim(),
        yape: $('p-yape').value.trim(),
      }),
    });
    state.user = r;
    localStorage.setItem('tv_user', JSON.stringify(r));
    renderUser();
    toast('Datos guardados', 'ok');
  } catch (err) { setError('err-perfil', err.message); }
});

$('btn-logout').addEventListener('click', cerrarSesion);

$('btn-tutorial-otra') && $('btn-tutorial-otra').addEventListener('click', () => {
  localStorage.removeItem('tv_tutorial_visto');
  irA('tutorial');
});

/* ------------------------------------------------------------------ conexión */
window.addEventListener('online', () => {
  $('banner').hidden = true;
  toast('Conexión restaurada', 'ok');
  if (state.view === 'local') cargarLocal();
  if (state.view === 'favores') cargarFavores();
  if (state.view === 'emergencia') cargarEmergencia();
});
window.addEventListener('offline', () => banner('📴 Sin conexión — sigues viendo lo último guardado', true));

/* ------------------------------------------------------------------ pista de desplazamiento en pestañas */
function marcarScrollPestanas() {
  const nav = document.querySelector('.tabs');
  if (!nav) return;
  nav.classList.toggle('scrollable', nav.scrollWidth > nav.clientWidth + 4);
}
window.addEventListener('resize', marcarScrollPestanas);

/* ------------------------------------------------------------------ arranque */
renderUser();
marcarScrollPestanas();
cargarLocal();
if (!localStorage.getItem('tv_tutorial_visto')) {
  localStorage.setItem('tv_tutorial_visto', '1');
  setTimeout(() => toast('¿Primera vez? Mira el Tutorial: son 5 pasos.', ''), 1200);
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
