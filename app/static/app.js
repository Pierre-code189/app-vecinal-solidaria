/* App Vecinal Solidaria · Piura
   Móvil primero, sin dependencias. Todo lo que se muestra pasa por esc(). */
"use strict";

const APP_VERSION = "3.3.1";   // se sube con cada despliegue que cambie JS o CSS

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const CATS = [
  ["gasfitería", "tool"], ["carpintería", "hammer"], ["electricidad", "bolt"],
  ["cerrajería", "key"], ["clases", "book"], ["alimentos", "food"],
  ["paseo de mascotas", "paw"], ["herramientas", "tool"],
  ["movilidad", "car"], ["préstamo", "box"], ["otros", "dots"],
];
const CAT_ICON = Object.fromEntries(CATS);
const NECESIDADES = [
  ["agua_potable", "Agua potable"], ["alimentos", "Alimentos"],
  ["abrigo", "Abrigo (frazadas, ropa)"], ["techo", "Techo o lona"],
  ["higiene", "Higiene"], ["salud", "Salud o medicinas"],
  ["balde_bidon", "Balde o bidón"], ["herramientas", "Herramientas"],
  ["movilidad", "Movilidad o traslado"], ["alojamiento", "Alojamiento"],
  ["energia", "Energía o luz"], ["otro", "Otro"],
];
const ESTADO_TEXTO = {
  activa: "Activa", pausada: "Pausada", resuelta: "Resuelta", cerrada: "Cerrada",
  vencida: "Vencida", borrador: "Borrador",
  enviada: "Esperando respuesta", expirada: "Vencida", respondida: "Respondida",
  acordado: "Acordado", cancelado: "Cancelado",
  solicitada: "Solicitada", aceptada: "Aceptada", en_curso: "En curso",
};
const S = {
  token: localStorage.getItem("vecinal-token") || "",
  user: null,
  zonas: [],
  zona: localStorage.getItem("vecinal-zona") || "Piura Centro",
  lat: parseFloat(localStorage.getItem("vecinal-lat") || "") || null,
  lng: parseFloat(localStorage.getItem("vecinal-lng") || "") || null,
  tipo: "servicio",
  filtroFavor: "",
  q: "", cat: "", catFavor: "", orden: "cercania",
  offset: 0, total: 0,
  sinLeer: 0,
  notifs: [],
  idioma: "es",
  fotos: [],
  paso: 1,
};

/* ------------------------------------------------------------ selector propio
   El desplegable nativo lo dibuja el sistema operativo (lista con radios) y no
   se puede vestir. Se reemplaza por un listbox propio, manteniendo el <select>
   real como fuente del valor para que el resto del código no cambie. */
function mejoraSelect(sel) {
  if (!sel || sel.dataset.selPropio) return;
  sel.dataset.selPropio = "1";
  const wrap = document.createElement("div");
  wrap.className = "sel";
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sel-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = `<span class="sel-txt"></span>
    <svg class="ic sel-chev" aria-hidden="true"><use href="#i-chevron"/></svg>`;

  const panel = document.createElement("ul");
  panel.className = "sel-panel";
  panel.setAttribute("role", "listbox");
  panel.hidden = true;
  wrap.appendChild(btn);
  wrap.appendChild(panel);

  const etiqueta = () => {
    const o = sel.options[sel.selectedIndex];
    btn.querySelector(".sel-txt").textContent = o ? o.textContent : "";
    const lbl = document.querySelector(`label[for="${sel.id}"]`);
    const nombre = sel.getAttribute("aria-label") || (lbl ? lbl.textContent.replace(/\s+/g, " ").trim() : "Opción");
    btn.setAttribute("aria-label", nombre + ": " + (o ? o.textContent : ""));
  };

  const pintar = () => {
    panel.innerHTML = "";
    Array.from(sel.options).forEach((o, i) => {
      const li = document.createElement("li");
      li.className = "sel-op";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === sel.selectedIndex));
      li.dataset.i = String(i);
      li.innerHTML = `<span>${esc(o.textContent)}</span>
        <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>`;
      li.onclick = () => elegir(i);
      panel.appendChild(li);
    });
    etiqueta();
  };

  const abrir = () => {
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    const act = panel.querySelector('[aria-selected="true"]') || panel.firstElementChild;
    act?.classList.add("activo");
    act?.scrollIntoView({ block: "nearest" });
  };
  const cerrar = () => {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    panel.querySelectorAll(".activo").forEach((e) => e.classList.remove("activo"));
  };
  const elegir = (i) => {
    if (i < 0 || i >= sel.options.length) return;
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    pintar(); cerrar(); btn.focus();
  };

  btn.onclick = (e) => { e.stopPropagation(); panel.hidden ? abrir() : cerrar(); };
  btn.onkeydown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (panel.hidden) { abrir(); return; }
      const ops = Array.from(panel.children);
      const actual = ops.findIndex((o) => o.classList.contains("activo"));
      const paso = e.key === "ArrowUp" ? -1 : 1;
      const siguiente = e.key === "Enter" || e.key === " " ? actual : Math.min(ops.length - 1, Math.max(0, actual + paso));
      ops.forEach((o) => o.classList.remove("activo"));
      ops[siguiente]?.classList.add("activo");
      ops[siguiente]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Escape") { cerrar(); }
    else if (e.key === "Tab") { cerrar(); }
  };
  panel.onkeydown = (e) => { if (e.key === "Escape") { cerrar(); btn.focus(); } };

  sel._sync = etiqueta;
  sel.addEventListener("change", etiqueta);
  new MutationObserver(pintar).observe(sel, { childList: true, subtree: true });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) cerrar(); });
  pintar();
}

window.syncSelects = () => $$("select").forEach((s) => s._sync && s._sync());

/* ------------------------------------------------------------ utilidades */
const cap = (s) => { const x = String(s || ""); return x.charAt(0).toUpperCase() + x.slice(1); };

const inicial = (nombre) => (String(nombre || "?").trim()[0] || "?").toUpperCase();

const ic = (name, cls = "") =>
  `<svg class="ic ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function toast(msg, tipo = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function banner(msg, tipo = "info") {
  const b = $("#banner");
  if (!msg) { b.hidden = true; return; }
  b.hidden = false;
  b.className = `banner ${tipo}`;
  b.innerHTML = esc(msg);
}

function fmtDist(km) {
  if (km === null || km === undefined || !isFinite(km) || km > 200) return "";
  if (km < 0.1) return "a menos de 100 m";
  if (km < 1) return `a ${Math.round(km * 1000)} m`;
  return `a ${km.toFixed(1).replace(".", ",")} km`;
}

function hace(ts) {
  if (!ts) return "";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 2592000) return `hace ${Math.floor(s / 86400)} días`;
  return new Date(ts * 1000).toLocaleDateString("es-PE");
}

function medios(p) {
  return (p.medios_pago || "").split(",").filter(Boolean).map((m) => {
    const n = { yape: "Yape", plin: "Plin", efectivo: "Efectivo", transferencia: "Transferencia", intercambio: "Intercambio" }[m] || m;
    return `<span class="badge">${esc(n)}</span>`;
  }).join(" ");
}

async function copy(txt, etiqueta = "Número") {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(txt);
    else { const i = document.createElement("input"); i.value = txt; document.body.appendChild(i); i.select(); document.execCommand("copy"); i.remove(); }
    toast(`${etiqueta} copiado: ${txt}`);
  } catch { toast(`Copia manual: ${txt}`, "warn"); }
}

/* ------------------------------------------------------------ API con cola */
function authHeaders() {
  return S.token ? { Authorization: `Bearer ${S.token}` } : {};
}

async function api(path, opts = {}) {
  const cfg = { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts.headers || {}) } };
  let res;
  try {
    res = await fetch(path, cfg);
  } catch (e) {
    if (opts.offlineQueue !== false && (opts.method || "GET") !== "GET") {
      encolar(path, JSON.parse(cfg.body || "{}"));
      throw new Error("SIN_CONEXION");
    }
    throw e;
  }
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { detail: txt }; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.mensaje)) || `Error ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : "No pudimos completar la acción");
    err.status = res.status;
    if (res.status === 401) { cerrarSesionLocal(); }
    throw err;
  }
  return data;
}

/* ------------------------------------------------------------ cola sin conexión */
const COLA = "vecinal-cola";

function leerCola() { try { return JSON.parse(localStorage.getItem(COLA) || "[]"); } catch { return []; } }
function guardarCola(c) { localStorage.setItem(COLA, JSON.stringify(c)); pintarCola(); }

function encolar(path, body) {
  const c = leerCola();
  c.push({ path, body, id: body.client_id || `${Date.now()}`, cuando: Date.now() });
  guardarCola(c);
  toast("Sin conexión: quedó pendiente y se enviará solo.", "warn");
}

async function sincronizarCola() {
  const c = leerCola();
  if (!c.length || !navigator.onLine) return;
  const quedan = [];
  for (const item of c) {
    try {
      await api(item.path, { method: "POST", body: JSON.stringify(item.body), offlineQueue: false });
      toast("Se envió lo que tenías pendiente.");
    } catch (e) {
      if (e.status && e.status >= 400 && e.status < 500) toast(`No se pudo enviar: ${e.message}`, "err");
      else quedan.push(item);
    }
  }
  guardarCola(quedan);
  if (leerCola().length === 0) cargarLista();
}

function pintarCola() {
  const c = leerCola();
  const prev = $("#cola-pendiente");
  if (prev) prev.remove();
  if (!c.length) return;
  const div = document.createElement("div");
  div.id = "cola-pendiente";
  div.className = "card pendiente";
  div.innerHTML = `<strong>${ic("clock")} ${c.length} publicación(es) pendiente(s) de enviar</strong>
    <p class="hint">Se enviarán solas cuando vuelva la señal.</p>
    <button type="button" class="btn small" onclick="sincronizarCola()">Reintentar ahora</button>`;
  $("#view-local").prepend(div);
}
window.sincronizarCola = sincronizarCola;

/* ------------------------------------------------------------ sesión */
function cerrarSesionLocal() {
  S.token = ""; S.user = null;
  localStorage.removeItem("vecinal-token");
  pintarUsuario(); pintarAuth();
}

function pintarUsuario() {
  const box = $("#userbox");
  const mod = $('[data-view="moderacion"]');
  if (S.user) {
    box.innerHTML = `<button type="button" class="avatar-btn" id="btn-perfil"
        aria-label="Mi perfil" title="${esc(S.user.nombre)}">${esc(inicial(S.user.nombre))}</button>
      <span class="quien">${esc(S.user.nombre.split(" ")[0])}</span>
      <button type="button" class="btn small" id="btn-salir">Salir</button>`;
    $("#btn-perfil").onclick = () => ir("perfil");
    $("#btn-salir").onclick = async () => {
      try { await api("/api/logout", { method: "POST" }); } catch {}
      cerrarSesionLocal(); toast("Sesión cerrada");
    };
    if (mod) mod.hidden = S.user.rol !== "moderador";
  } else {
    box.innerHTML = `<button type="button" class="btn small" id="btn-entrar">Entrar</button>`;
    $("#btn-entrar").onclick = () => ir("perfil");
    if (mod) mod.hidden = true;
  }
}

function pintarAuth() {
  const dentro = Boolean(S.user);
  $("#auth-box").hidden = dentro;
  $("#perfil-edit").hidden = !dentro;
  $("#perfil-card").hidden = !dentro;
  if (dentro) {
    $("#p-nombre").value = S.user.nombre || "";
    $("#p-zona").value = S.user.zona || S.zona;
    $("#p-desc").value = S.user.descripcion || "";
    $("#p-ofi").value = S.user.oficios || "";
    $("#p-yape").value = S.user.yape || "";
    $("#p-plin").value = S.user.plin || "";
    $("#p-mostrar").checked = S.user.mostrar_contacto !== false;
    $("#perfil-card").innerHTML = `
      <div class="perfil-head">${ic("user")} <strong>${esc(S.user.nombre)}</strong></div>
      <p class="hint">${esc(S.user.zona || "")} · ${esc(S.user.email || "")}</p>
      <div class="badges">${S.user.rol === "moderador" ? '<span class="badge verde">Moderador</span>' : ""}
        ${S.user.yape ? `<span class="badge">Yape ${esc(S.user.yape)}</span>` : ""}
        ${S.user.plin ? `<span class="badge">Plin ${esc(S.user.plin)}</span>` : ""}</div>
      <button type="button" class="btn primary wide" id="ir-mias" style="margin-top:12px">
        ${ic("clipboard")}Mi actividad: publicaciones, tratos y cotizaciones</button>`;
    $("#ir-mias").onclick = () => ir("mias");
  }
}

async function cargarPerfil() {
  if (!S.token) return;
  try {
    S.user = await api("/api/perfil");
    if (S.user && S.user.zona) S.zona = S.user.zona;
    pintarUsuario(); pintarAuth(); pintarZona();
  } catch { cerrarSesionLocal(); }
}

/* ------------------------------------------------------------ navegación */
function ir(vista) {
  if (vista === "mias" && !S.user) vista = "perfil";
  $$(".view").forEach((v) => v.classList.toggle("on", v.id === `view-${vista}`));
  $$(".tabs button, .bottom-nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === vista));
  if (vista === "mias") cargarMias();
  if (vista === "moderacion") cargarModeracion();
  if (vista === "favores") cargarFavores();
  if (vista === "emergencia") cargarEmergencia();
  if (vista === "tutorial") pintarTutorial();
  window.scrollTo({ top: 0, behavior: "smooth" });
  location.hash = vista === "local" ? "" : vista;
}

function pintarZona() {
  $("#zona-actual").textContent = S.zona;
  $("#zona-h1").textContent = S.zona;
}

/* ------------------------------------------------------------ mini mapa */
function miniMap(lat, lng, titulo = "Ubicación aproximada") {
  if (lat === null || lng === null || lat === undefined) return "";
  const z = 16, n = 2 ** z;
  const xt = Math.floor(((lng + 180) / 360) * n);
  const yt = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  let celdas = "";
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = ((xt + dx) % n + n) % n, y = yt + dy;
      celdas += `<img alt="" loading="lazy" data-espejo="0"
        src="https://tile.openstreetmap.org/${z}/${x}/${y}.png"
        onerror="if(this.dataset.espejo==='0'){this.dataset.espejo='1';this.src='https://a.tile.openstreetmap.fr/osmfr/${z}/${x}/${y}.png';}else{this.style.visibility='hidden';}">`;
    }
  }
  return `<div class="minimapa" role="img" aria-label="${esc(titulo)}">
      <div class="tiles">${celdas}</div><span class="pin">${ic("pin", "ic-lg")}</span>
      <span class="credito">© OpenStreetMap</span></div>
    <p class="hint">Ubicación aproximada (±400 m). El punto exacto se coordina por WhatsApp.
      <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}"
         target="_blank" rel="noopener">Ver el sector en el mapa</a>.</p>`;
}

/* ------------------------------------------------------------ tarjetas */
function tarjeta(p) {
  const foto = (p.fotos && p.fotos.length) ? `<img class="thumb" alt="" src="${esc(p.fotos[0])}">` : "";
  let dist = "";
  if (p.ubicacion_aproximada && p.zona === S.zona) dist = `<span class="dist">${ic("pin")} en tu sector</span>`;
  else if (p.distancia_km !== null && p.distancia_km !== undefined) dist = `<span class="dist">${ic("pin")} ${fmtDist(p.distancia_km)}</span>`;
  else if (p.ubicacion_aproximada) dist = `<span class="dist">${ic("pin")} otro sector</span>`;
  const emerg = p.es_emergencia ? `<span class="badge rojo">${ic("alert")} Emergencia</span>` : "";
  const nv = p.vistos || 0;
  const aval = `<span class="visto" title="${nv === 0 ? "Sin visto bueno" : `${nv} visto${nv === 1 ? "" : "s"} buenos`}">
    ${ic("thumb")} ${nv}</span>`;
  return `<article class="card pub" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.titulo)}">
    <div class="pub-top">${foto}<div class="pub-info">
      <div class="catrow"><span class="cat">${ic(CAT_ICON[p.categoria] || "dots")} ${esc(cap(p.categoria))}</span>
        <span class="catrow-right">${emerg}<span class="ver-mas" aria-hidden="true">${ic("back")}</span></span></div>
      <h3>${esc(p.titulo)}</h3>
      <p class="desc">${esc(p.descripcion || "")}</p>
      <div class="meta">${dist} ${aval}</div>
      <div class="precio">${esc(p.precio || "A convenir")}</div>
      <div class="badges">${medios(p)}</div>
      <p class="quien"><span class="avatar" aria-hidden="true">${esc(inicial(p.nombre || p.vendedor))}</span>
        <span class="quien-txt">${esc(p.nombre || p.vendedor || "")} · ${esc(p.zona)}</span></p>
    </div></div>
  </article>`;
}

function engancharTarjetas(cont) {
  $$(".pub", cont).forEach((el) => {
    const abrir = () => verDetalle(el.dataset.id);
    el.onclick = abrir;
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } };
  });
}

/* Punto de referencia: GPS si lo hay, si no el centro del sector elegido. */
function refCoords() {
  if (S.lat && S.lng) return [S.lat, S.lng];
  const z = S.zonas.find((x) => x.nombre === S.zona);
  return z ? [z.lat, z.lng] : [null, null];
}

/* ------------------------------------------------------------ lista local */
async function cargarLista({ append = false } = {}) {
  if (!append) { S.offset = 0; $("#list").innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>'; }
  const p = new URLSearchParams({ limit: 12, offset: S.offset });
  if (S.tipo) p.set("tipo", S.tipo);
  if (S.q) p.set("q", S.q);
  if (S.cat) p.set("categoria", S.cat);
  p.set("orden", S.orden);
  const [rl, rg] = refCoords();
  if (rl && rg) { p.set("lat", rl); p.set("lng", rg); }
  try {
    const d = await api(`/api/publicaciones?${p}`);
    S.total = d.total;
    const html = d.items.map(tarjeta).join("");
    if (append) $("#list").insertAdjacentHTML("beforeend", html);
    else $("#list").innerHTML = html || `<div class="vacio">${ic("search")}<b>No hay publicaciones en ${esc(S.zona)}</b>
      Prueba con otra categoría o publica tú el primero.<br>
      <button type="button" class="btn primary" onclick="abrirPublicar()" style="margin-top:12px">Publicar</button></div>`;
    engancharTarjetas($("#list"));
    S.offset += d.items.length;
    $("#btn-more").hidden = !d.has_more;
    const etiqueta = { servicio: "servicios", producto: "productos", "": "publicaciones" }[S.tipo] || "publicaciones";
    $("#orden-info").textContent = `${d.total} ${etiqueta} en ${S.zona}`;
    localStorage.setItem("vecinal-cache-local", JSON.stringify({ items: d.items, cuando: Date.now() }));
  } catch (e) {
    const cache = JSON.parse(localStorage.getItem("vecinal-cache-local") || "null");
    if (cache && cache.items) {
      $("#list").innerHTML = cache.items.map(tarjeta).join("");
      engancharTarjetas($("#list"));
      banner(`Sin conexión. Mostrando lo último que cargaste (${new Date(cache.cuando).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}).`, "warn");
    } else {
      $("#list").innerHTML = `<div class="vacio">No pudimos cargar. Revisa tu conexión.</div>`;
    }
  }
}

/* ------------------------------------------------------------ favores */
async function cargarFavores() {
  const p = new URLSearchParams({ limit: 50, solo_favores: "1" });
  if (S.filtroFavor) p.set("tipo", S.filtroFavor);
  if (S.catFavor) p.set("tipo_favor", S.catFavor);
  const [fl, fg] = refCoords();
  if (fl && fg) { p.set("lat", fl); p.set("lng", fg); }
  $("#list-favores").innerHTML = '<div class="skeleton"></div>';
  try {
    const d = await api(`/api/publicaciones?${p}`);
    const items = d.items.filter((x) => x.tipo.startsWith("favor"));
    $("#list-favores").innerHTML = items.length ? items.map(tarjeta).join("")
      : `<div class="vacio">${ic("heart")}<b>Sin favores por ahora</b>Pide o ofrece ayuda a tus vecinos.</div>`;
    engancharTarjetas($("#list-favores"));
  } catch { $("#list-favores").innerHTML = `<div class="vacio">Sin conexión.</div>`; }
}

/* ------------------------------------------------------------ detalle */
async function verDetalle(id) {
  $("#modal").hidden = false;
  $("#modal-body").innerHTML = '<div class="skeleton tall"></div>';
  document.body.style.overflow = "hidden";
  let p;
  const [dl, dg] = refCoords();
  const q = (dl && dg) ? `?lat=${dl}&lng=${dg}` : "";
  try { p = await api(`/api/publicaciones/${id}${q}`); }
  catch (e) { $("#modal-body").innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }

  const yo = S.user;
  const esMio = p.es_mio;
  const fotos = (p.fotos && p.fotos.length)
    ? `<div class="fotos">${p.fotos.map((f) => `<img alt="" src="${esc(f)}">`).join("")}</div>` : "";
  const pago = p.contacto_visible ? `
      <div class="pagobox">
        <h4>${ic("wallet")} Cómo pagar</h4>
        ${p.yape_autor ? `<div class="pago-fila"><span>Yape: <b>${esc(p.yape_autor)}</b></span>
          <button type="button" class="btn small" data-copiar="${esc(p.yape_autor)}" data-etq="Yape">Copiar</button></div>` : ""}
        ${p.plin_autor ? `<div class="pago-fila"><span>Plin: <b>${esc(p.plin_autor)}</b></span>
          <button type="button" class="btn small" data-copiar="${esc(p.plin_autor)}" data-etq="Plin">Copiar</button></div>` : ""}
        ${p.telefono ? `<div class="pago-fila"><span>Teléfono: <b>${esc(p.telefono)}</b></span>
          <a class="btn small" href="https://wa.me/51${esc(p.telefono)}?text=${encodeURIComponent("Hola, vi tu publicación en Vecinal Solidaria: " + p.titulo)}" target="_blank" rel="noopener">WhatsApp</a></div>` : ""}
        <p class="hint">Pago directo entre vecinos. La app no cobra comisión ni guarda tu dinero.
        ${esc(({ contra_entrega: "Acuerdo: pago contra entrega.", mitad_mitad: "Acuerdo: 50 % al empezar y 50 % al terminar.", al_terminar: "Acuerdo: pago al terminar." }[p.politica_pago] || ""))}</p>
      </div>` : `<div class="pagobox aviso"><p>${ic("lock")} Este vecino decidió no mostrar su número hasta coordinar. Envía una cotización y te responderá por aquí.</p></div>`;

  const acciones = [];
  if (!yo) {
    acciones.push(`<button type="button" class="btn primary wide" onclick="ir('perfil');cerrarModal()">Entra para contactar</button>`);
  } else if (!esMio) {
    if (p.tipo === "servicio" || p.tipo === "producto") {
      acciones.push(`<button type="button" class="btn primary" id="btn-cotizar">${ic("chat")} Pedir cotización</button>`);
      acciones.push(`<button type="button" class="btn" id="btn-trato">${ic("check")} Cerrar trato</button>`);
    } else {
      acciones.push(`<button type="button" class="btn primary" id="btn-intercambio">${ic("handshake")} Quiero ayudar</button>`);
    }
    acciones.push(`<button type="button" class="btn" id="btn-visto" ${p.ya_recomende ? "disabled" : ""}>
      ${p.ya_recomende ? ic("check") + " Ya diste tu visto bueno" : ic("thumb") + " Dar visto bueno"}</button>`);

  } else {
    acciones.push(`<button type="button" class="btn" id="btn-mis-publicaciones">Gestionar en Mis cosas</button>`);
  }

  $("#modal-body").innerHTML = `
    <button type="button" class="btn small atras" id="btn-atras">← Regresar</button>
    <div class="detalle">
      <div class="cat">${ic(CAT_ICON[p.categoria] || "dots")} ${esc(cap(p.categoria))}
        ${p.es_emergencia ? `<span class="badge rojo">${ic("alert")} Emergencia</span>` : ""}</div>
      <h2 id="modal-title">${esc(p.titulo)}</h2>
      <p class="quien"><span class="avatar" aria-hidden="true">${esc(inicial(p.nombre || p.vendedor))}</span>
        <span class="quien-txt">${esc(p.nombre || p.vendedor || "")} · ${esc(p.zona)}${p.ubicacion_aproximada && p.zona === S.zona ? " · en tu sector" : (p.distancia_km != null ? " · " + fmtDist(p.distancia_km) : (p.ubicacion_aproximada ? " · otro sector" : ""))}</span></p>
      ${fotos}
      <p class="texto">${esc(p.descripcion)}</p>
      <div class="datos">
        <div><span>Precio</span><b>${esc(p.precio || "A convenir")}</b></div>
        <div><span>Pago</span><b>${medios(p) || "Intercambio"}</b></div>
        <div><span>Visto bueno</span><b>${ic("thumb")} ${p.vistos || 0}</b></div>
        <div><span>Publicado</span><b>${hace(p.creado)}</b></div>
        ${p.franja_horaria ? `<div><span>Horario</span><b>${esc(p.franja_horaria)}</b></div>` : ""}
        ${p.punto_encuentro ? `<div><span>Encuentro</span><b>${esc(p.punto_encuentro)}</b></div>` : ""}
      </div>
      ${pago}
      ${miniMap(p.lat_publica ?? p.lat ?? null, p.lng_publica ?? p.lng ?? null)}
      <div class="pubs-actions">${acciones.join("")}</div>
      ${(yo && !esMio) ? `<p class="reportar-linea"><button type="button" class="linkbtn" id="btn-reportar">${ic("flag")} Reportar esta publicación</button></p>` : ""}
      <div id="zona-accion"></div>
    </div>`;

  $("#btn-atras").onclick = cerrarModal;
  $$("[data-copiar]").forEach((b) => b.onclick = () => copy(b.dataset.copiar, b.dataset.etq));
  if (yo && !esMio) {
    api("/api/eventos/contacto", { method: "POST", body: JSON.stringify({ publicacion_id: p.id }), offlineQueue: false }).catch(() => {});
    const z = $("#zona-accion");
    if ($("#btn-cotizar")) $("#btn-cotizar").onclick = () => formCotizar(p);
    if ($("#btn-trato")) $("#btn-trato").onclick = () => formTrato(p);
    if ($("#btn-intercambio")) $("#btn-intercambio").onclick = () => formIntercambio(p);
    if ($("#btn-visto")) $("#btn-visto").onclick = () => darVisto(p);
    if ($("#btn-reportar")) $("#btn-reportar").onclick = () => reportar(p);
    if ($("#btn-mis-publicaciones")) $("#btn-mis-publicaciones").onclick = () => { cerrarModal(); ir("mias"); };
  }
}

function cerrarModal() {
  $("#modal").hidden = true;
  document.body.style.overflow = "";
}

/* ------------------------------------------------------------ acciones del detalle */
function formCotizar(p) {
  $("#zona-accion").innerHTML = `<div class="inline-form">
    <label>¿Qué necesitas y para cuándo?</label>
    <textarea id="cot-desc" rows="2" placeholder="Ej.: fuga en el baño, para hoy si se puede"></textarea>
    <div class="dos"><div><label>Medida / detalle</label><input id="cot-medida" placeholder="Opcional"></div>
    <div><label>Urgencia</label><select id="cot-urg"><option value="normal">Normal</option><option value="hoy">Para hoy</option><option value="urgente">Urgente</option></select></div></div>
    <p class="error" id="err-cot"></p>
    <button type="button" class="btn primary" id="cot-enviar">Enviar cotización</button></div>`;
  $("#cot-enviar").onclick = async () => {
    const descripcion = $("#cot-desc").value.trim();
    if (descripcion.length < 5) { $("#err-cot").textContent = "Escribe al menos 5 caracteres."; return; }
    try {
      await api("/api/cotizaciones", { method: "POST", body: JSON.stringify({
        publicacion_id: p.id, descripcion, medida: $("#cot-medida").value, urgencia: $("#cot-urg").value,
      }) });
      toast("Cotización enviada. Te responderá por aquí.");
      verDetalle(p.id);
    } catch (e) { $("#err-cot").textContent = e.message; }
  };
}

function formTrato(p) {
  $("#zona-accion").innerHTML = `<div class="inline-form">
    <label>¿Cuánto acordaron? (opcional)</label>
    <input id="tr-monto" placeholder="Ej.: S/ 30 o Intercambio">
    <label>Nota (opcional)</label>
    <input id="tr-nota" placeholder="Ej.: viene mañana a las 4">
    <p class="hint">El vendedor recibirá un aviso para confirmar. Cuando ambos confirmen, podrás dejar tu visto bueno.</p>
    <p class="error" id="err-tr"></p>
    <button type="button" class="btn primary" id="tr-enviar">Registrar trato</button></div>`;
  $("#tr-enviar").onclick = async () => {
    try {
      await api("/api/tratos", { method: "POST", body: JSON.stringify({
        publicacion_id: p.id, monto: $("#tr-monto").value, nota: $("#tr-nota").value,
      }) });
      toast("Trato registrado. Falta que el vendedor confirme.");
      cerrarModal(); ir("mias");
    } catch (e) { $("#err-tr").textContent = e.message; }
  };
}

function formIntercambio(p) {
  $("#zona-accion").innerHTML = `<div class="inline-form">
    <label>Mensaje para el vecino</label>
    <textarea id="in-msg" rows="2" placeholder="Ej.: tengo una muleta, te la presto hasta el viernes"></textarea>
    ${p.subtipo_favor === "prestamo" ? `
      <label>Garante del barrio (obligatorio en préstamos)</label>
      <input id="in-garante" placeholder="Nombre del vecino que responde">
      <label>Fecha de devolución</label>
      <input id="in-fecha" type="date">` : ""}
    <p class="error" id="err-in"></p>
    <button type="button" class="btn primary" id="in-enviar">Enviar</button></div>`;
  $("#in-enviar").onclick = async () => {
    const body = { peticion_id: p.id, mensaje: $("#in-msg").value };
    if ($("#in-garante")) body.garante_nombre = $("#in-garante").value;
    if ($("#in-fecha")) body.fecha_devolucion = $("#in-fecha").value;
    try {
      await api("/api/intercambios", { method: "POST", body: JSON.stringify(body) });
      toast("Enviado. El vecino recibirá tu mensaje.");
      verDetalle(p.id);
    } catch (e) { $("#err-in").textContent = e.message; }
  };
}

async function darVisto(p) {
  if (!confirm(`¿Confirmas que ${p.nombre || "este vecino"} te atendió bien?`)) return;
  try {
    await api("/api/vistos", { method: "POST", body: JSON.stringify({ publicacion_id: p.id }) });
    toast("¡Gracias! Tu visto bueno ya se ve.");
    verDetalle(p.id);
  } catch (e) {
    toast(e.message, "err");
    if (/cerrado/.test(e.message)) { $("#zona-accion").innerHTML = `<p class="hint">Primero marca "Cerramos el trato" y pide al vendedor que confirme.</p>`; }
  }
}

function reportar(p) {
  $("#zona-accion").innerHTML = `<div class="inline-form">
    <label>¿Qué problema tiene esta publicación?</label>
    <select id="rep-motivo">
      <option>Parece una estafa</option><option>Datos falsos</option>
      <option>Lenguaje ofensivo</option><option>Precio engañoso</option>
      <option>No es del sector</option><option>Otro</option>
    </select>
    <label>Detalle (opcional)</label><input id="rep-nota" maxlength="200">
    <p class="error" id="err-rep"></p>
    <button type="button" class="btn danger" id="rep-enviar">Enviar reporte</button></div>`;
  $("#rep-enviar").onclick = async () => {
    const motivo = $("#rep-motivo").value + ($("#rep-nota").value ? `: ${$("#rep-nota").value}` : "");
    try {
      await api("/api/reportes", { method: "POST", body: JSON.stringify({ publicacion_id: p.id, motivo }) });
      toast("Reporte enviado. Un moderador lo revisará.");
      cerrarModal();
    } catch (e) { $("#err-rep").textContent = e.message; }
  };
}

/* ------------------------------------------------------------ publicar */
function abrirPublicar(tipoPre = "") {
  $("#pubmodal").hidden = false;
  document.body.style.overflow = "hidden";
  if (!S.user) { mostrarPuerta(); return; }
  $("#pub-gate").hidden = true;
  $("#form-pub").hidden = false;
  $$("#pubmodal .steps").forEach((s) => { s.hidden = false; });
  S.quieroPublicar = true;
  S.paso = 1;
  pintarPaso(1);
  if (tipoPre) { $("#f-tipo").value = tipoPre; ajustarTipo(); }
  pintarPills();
  llenarZonas();
  restaurarBorrador();
}

function mostrarPuerta() {
  S.quieroPublicar = true;
  $("#pub-gate").hidden = false;
  $("#form-pub").hidden = true;
  $$("#pubmodal .steps").forEach((s) => { s.hidden = true; });
}

function pintarPaso(n) {
  S.paso = n;
  $$(".paso").forEach((f) => { f.hidden = Number(f.dataset.paso) !== n; });
  $$("#pubmodal .step").forEach((s) => s.classList.toggle("on", Number(s.dataset.step) === n));
  if (n === 3) pintarResumen();
}

function pintarPills() {
  const actual = $("#f-cat").value || "gasfitería";
  $("#pills-cat").innerHTML = CATS.map(([c, i]) =>
    `<button type="button" class="pill ${c === actual ? "on" : ""}" data-cat="${esc(c)}">${i} ${esc(c)}</button>`).join("");
  $$("#pills-cat .pill").forEach((b) => b.onclick = () => { $("#f-cat").value = b.dataset.cat; pintarPills(); });
  $("#f-cat").value = actual;
}

function ajustarTipo() {
  const t = $("#f-tipo").value;
  $("#bloque-favor").hidden = !t.startsWith("favor");
  $("#bloque-movilidad").hidden = $("#f-subtipo").value !== "movilidad" || !t.startsWith("favor");
  $("#bloque-necesidad").hidden = true;
  if (!t.startsWith("favor") && !$("#f-cat").value) $("#f-cat").value = "gasfitería";
}

function pintarResumen() {
  const t = $("#f-tipo").value;
  const tipoTxt = { servicio: "Servicio", producto: "Producto", favor_solicitado: "Favor que necesito", favor_ofrecido: "Favor que ofrezco" }[t];
  $("#resumen").innerHTML = `
    <p><b>${esc(tipoTxt)}</b> · ${esc($("#f-cat").value || "")}</p>
    <h3>${esc($("#f-titulo").value || "(sin título)")}</h3>
    <p>${esc($("#f-desc").value || "")}</p>
    <p><b>Precio:</b> ${esc($("#f-precio").value || "A convenir")}</p>
    <p><b>Sector:</b> ${esc($("#f-zona").value)}</p>
    <p><b>Pago:</b> ${esc($("#f-pagos").selectedOptions[0]?.textContent || "")}</p>
    ${S.fotos.length ? `<div class="fotos-prev">${S.fotos.map((f) => `<img alt="" src="${esc(f)}">`).join("")}</div>` : ""}`;
}

const BORRADOR = "vecinal-borrador";
function guardarBorrador() {
  const d = {
    tipo: $("#f-tipo").value, subtipo: $("#f-subtipo").value, cat: $("#f-cat").value,
    titulo: $("#f-titulo").value, desc: $("#f-desc").value, precio: $("#f-precio").value,
    pagos: $("#f-pagos").value, politica: $("#f-politica").value, zona: $("#f-zona").value,
    franja: $("#f-franja").value, punto: $("#f-punto").value,
    emerg: $("#f-emerg").checked, mostrar: $("#f-mostrar").checked,
  };
  localStorage.setItem(BORRADOR, JSON.stringify(d));
}
function restaurarBorrador() {
  setTimeout(() => window.syncSelects && window.syncSelects(), 0);
  let d; try { d = JSON.parse(localStorage.getItem(BORRADOR) || "null"); } catch { d = null; }
  if (!d) { $("#f-zona").value = S.user.zona || S.zona; return; }
  $("#f-tipo").value = d.tipo || "servicio";
  $("#f-subtipo").value = d.subtipo || "prestamo";
  $("#f-cat").value = d.cat || "gasfitería";
  $("#f-titulo").value = d.titulo || "";
  $("#f-desc").value = d.desc || "";
  $("#f-precio").value = d.precio || "";
  $("#f-pagos").value = d.pagos || "";
  $("#f-politica").value = d.politica || "contra_entrega";
  $("#f-zona").value = d.zona || S.user.zona || S.zona;
  $("#f-franja").value = d.franja || "";
  $("#f-punto").value = d.punto || "";
  $("#f-emerg").checked = Boolean(d.emerg);
  $("#f-mostrar").checked = d.mostrar !== false;
  actualizarContadores();
  if (d.titulo || d.desc) toast("Recuperamos tu borrador anterior.");
}

function actualizarContadores() {
  $("#cont-titulo").textContent = `${$("#f-titulo").value.length}/120`;
  $("#cont-desc").textContent = `${$("#f-desc").value.length}/600`;
}

/* compresión de fotos: 1000 px y ~150 KB, sin metadatos */
function comprimir(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1000;
      let { width: w, height: h } = img;
      if (w > h && w > max) { h = Math.round((h * max) / w); w = max; }
      else if (h >= w && h > max) { w = Math.round((w * max) / h); h = max; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.68));
    };
    img.onerror = () => reject(new Error("tu navegador no puede leer este formato"));
    img.src = url;
  });
}

async function subirFotos(files) {
  const estado = $("#fotos-estado");
  const wrap = document.querySelector(".filewrap");
  const lista = Array.from(files || []).slice(0, 3 - S.fotos.length);
  if (!lista.length) return;
  wrap.classList.add("subiendo");
  for (let i = 0; i < lista.length; i++) {
    const f = lista[i];
    estado.classList.remove("error");
    estado.textContent = `Subiendo foto ${i + 1} de ${lista.length}…`;
    if (!f.type.startsWith("image/")) {
      estado.classList.add("error");
      estado.textContent = "Ese archivo no es una imagen. Elige JPG, PNG o HEIC desde la galería.";
      continue;
    }
    try {
      const data = await comprimir(f);
      const r = await api("/api/fotos", { method: "POST", body: JSON.stringify({ data }) });
      S.fotos.push(r.url);
      estado.textContent = `${S.fotos.length} de 3 fotos listas.`;
    } catch (e) {
      estado.classList.add("error");
      estado.textContent = e.message === "SIN_CONEXION"
        ? "Sin conexión: la foto se perderá. Conéctate y vuelve a intentarlo."
        : `No pudimos subir esa foto (${e.message}). Prueba con otra o más liviana.`;
      toast("No se pudo subir la foto", "err");
    }
  }
  wrap.classList.remove("subiendo");
  if (!estado.classList.contains("error") && S.fotos.length) {
    estado.textContent = `${S.fotos.length} de 3 fotos listas.`;
  }
  pintarFotos();
}

function pintarFotos() {
  $("#fotos-prev").innerHTML = S.fotos.map((f, i) =>
    `<div class="foto-item"><img alt="" src="${esc(f)}"><button type="button" data-quitar="${i}" aria-label="Quitar">${ic("close")}</button></div>`).join("");
  $$("#fotos-prev [data-quitar]").forEach((b) => b.onclick = () => { S.fotos.splice(Number(b.dataset.quitar), 1); pintarFotos(); });
}

function validarPaso2() {
  const t = $("#f-titulo").value.trim(), d = $("#f-desc").value.trim();
  if (t.length < 3) return "El título necesita al menos 3 caracteres.";
  if (d.length < 5) return "La descripción necesita al menos 5 caracteres.";
  if ($("#f-subtipo").value === "movilidad" && $("#f-tipo").value.startsWith("favor")) {
    if (!$("#f-franja").value.trim()) return "Indica la franja horaria.";
    if (!$("#f-punto").value.trim()) return "Indica un punto de encuentro público.";
    if (!$("#f-check-mov").checked) return "Confirma la lista de seguridad de movilidad.";
  }
  const texto = `${t} ${d} ${$("#f-punto").value}`.toLowerCase();
  if (/\b(colegio|escuela)\s+\w/i.test(texto) || texto.includes("dni")) {
    return "No publiques el nombre del colegio ni DNI: usa solo el sector y un punto público.";
  }
  return "";
}

async function enviarPublicacion(e) {
  e.preventDefault();
  const err = validarPaso2();
  if (err) { pintarPaso(2); $("#err-paso2").textContent = err; return; }
  const t = $("#f-tipo").value;
  const body = {
    tipo: t,
    categoria: $("#f-cat").value,
    subtipo_favor: t.startsWith("favor") ? $("#f-subtipo").value : null,
    titulo: $("#f-titulo").value.trim(),
    descripcion: $("#f-desc").value.trim(),
    precio: $("#f-precio").value.trim(),
    medios_pago: $("#f-pagos").value,
    politica_pago: $("#f-politica").value,
    zona: $("#f-zona").value,
    franja_horaria: $("#f-franja").value,
    punto_encuentro: $("#f-punto").value,
    checklist_ok: $("#f-check-mov").checked,
    es_emergencia: $("#f-emerg").checked,
    mostrar_contacto: $("#f-mostrar").checked,
    fotos: S.fotos,
    lat: null, lng: null,
    client_id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  };
  if (S.lat && S.lng && $("#f-zona").value === S.zona) { body.lat = S.lat; body.lng = S.lng; }
  const btn = $("#form-pub button[type=submit]");
  btn.disabled = true; btn.textContent = "Publicando…";
  try {
    await api("/api/publicaciones", { method: "POST", body: JSON.stringify(body) });
    localStorage.removeItem(BORRADOR);
    S.fotos = []; pintarFotos();
    toast("¡Publicado! Ya lo ven tus vecinos.");
    $("#pubmodal").hidden = true; document.body.style.overflow = "";
    $("#form-pub").reset();
    cargarLista();
  } catch (e2) {
    if (e2.message === "SIN_CONEXION") {
      $("#pubmodal").hidden = true; document.body.style.overflow = "";
      pintarCola();
    } else { $("#err-paso3").textContent = e2.message; }
  } finally { btn.disabled = false; btn.innerHTML = ic("check") + " Publicar"; }
}

/* ------------------------------------------------------------ emergencia */
async function cargarEmergencia() {
  try {
    const e = await api("/api/emergencia");
    $("#emerg-box").innerHTML = e.activa
      ? `<div class="alerta roja"><strong>${ic("alert")} EMERGENCIA ACTIVA</strong>
          <p>${esc(e.motivo || "Emergencia declarada por el comité vecinal")}</p>
          <p class="hint">Activada ${hace(e.activada_en)} · Vence ${hace(e.expira)}</p>
          <p>Esto no reemplaza a las autoridades. Llama al 105, 116 o 115.</p></div>`
      : `<div class="alerta verde"><strong>${ic("check")} Sin emergencia declarada</strong>
          <p class="hint">Si hay peligro, llama primero al 105, 116 o 115. Después reporta la necesidad aquí.</p></div>`;
    const dir = await api("/api/emergencia/directorio");
    const orgs = dir.directorio || [];
    $("#directorio").innerHTML = (orgs.length ? orgs.map((d) => `
      <div class="card mini"><strong>${esc(d.nombre)}</strong>
        <p class="hint">${esc(d.tipo)} · ${esc(d.zona)}</p>
        ${d.contacto ? `<button type="button" class="btn small" data-copiar="${esc(d.contacto)}" data-etq="Teléfono">Copiar ${esc(d.contacto)}</button>` : ""}
      </div>`).join("") : `<p class="hint">Aún no hay organizaciones registradas en el distrito.</p>`)
      + (dir.puntos && dir.puntos.length ? `<div class="card mini"><strong>Puntos de acopio conocidos</strong>
          <ul class="lista">${dir.puntos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "");
    $$("#directorio [data-copiar]").forEach((b) => b.onclick = () => copy(b.dataset.copiar, b.dataset.etq));

    const d = await api(`/api/publicaciones?limit=20&emergencia=true${S.lat ? `&lat=${S.lat}&lng=${S.lng}` : ""}`);
    $("#list-emergencia").innerHTML = d.items.length ? d.items.map(tarjeta).join("")
      : `<div class="vacio">Sin reportes de emergencia en el sector.</div>`;
    engancharTarjetas($("#list-emergencia"));
  } catch {
    $("#emerg-box").innerHTML = `<div class="alerta gris">Sin conexión. Los números de emergencia siguen disponibles arriba.</div>`;
  }
}

/* ------------------------------------------------------------ mis cosas */
const MIAS = { tab: "pubs" };

const ETQ = {
  activa: ["Activa", "verde"], pausada: ["Pausada", "gris"], resuelta: ["Resuelta", "gris"],
  cerrada: ["Cerrada", "gris"], vencida: ["Vencida", "gris"],
  enviada: ["Esperando respuesta", "gris"], respondida: ["Respondida", "verde"], expirada: ["Vencida", "gris"],
  acordado: ["Acordado", "gris"], cerrado: ["Cerrado", "verde"], cancelado: ["Cancelado", "gris"],
  solicitada: ["Solicitada", "gris"], aceptada: ["Aceptada", "verde"], rechazada: ["Rechazada", "gris"],
  en_curso: ["En curso", "verde"],
};
const etiqueta = (e) => {
  const [txt, tono] = ETQ[e] || [e || "", "gris"];
  return `<span class="badge ${tono}">${esc(txt)}</span>`;
};

function statMias(n, txt, tab, tono = "") {
  return `<button type="button" class="stat ${tono}" data-ir-tab="${tab}">
    <b>${n}</b><span>${esc(txt)}</span></button>`;
}

async function cargarMias(tab) {
  if (!S.user) { ir("perfil"); return; }
  if (tab) MIAS.tab = tab;
  $$(".tabs-mias button").forEach((b) => b.classList.toggle("on", b.dataset.tab === MIAS.tab));
  $$(".panel-mias").forEach((p) => { p.hidden = p.id !== `panel-${MIAS.tab}`; });
  $("#list-mias").innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';

  let pubs = [], cots = [], tratos = [], favores = [], accesos = null;
  try {
    [pubs, cots, tratos, favores, accesos] = await Promise.all([
      api("/api/mis-publicaciones").catch(() => []),
      api("/api/cotizaciones").catch(() => []),
      api("/api/tratos").catch(() => []),
      api("/api/intercambios").catch(() => []),
      api("/api/mis-accesos").catch(() => null),
    ]);
  } catch (e) { toast(e.message, "err"); }

  const activas = pubs.filter((p) => p.estado === "activa").length;
  const porResponder = cots.filter((c) => c.estado === "enviada" && c.autor_id === S.user.id).length;
  const misPendientes = cots.filter((c) => c.estado === "enviada" && c.autor_id !== S.user.id).length;
  const tratosAbiertos = tratos.filter((t) => t.estado === "acordado").length;
  const favoresAbiertos = favores.filter((f) => ["solicitada", "aceptada", "en_curso"].includes(f.estado)).length;

  $("#resumen-mias").innerHTML = [
    statMias(activas, activas === 1 ? "publicación activa" : "publicaciones activas", "pubs"),
    statMias(porResponder + misPendientes, "cotizaciones en curso", "cots", (porResponder + misPendientes) ? "alerta" : ""),
    statMias(tratosAbiertos, tratosAbiertos === 1 ? "trato abierto" : "tratos abiertos", "tratos"),
    statMias(favoresAbiertos, favoresAbiertos === 1 ? "favor en curso" : "favores en curso", "favores"),
  ].join("");
  $$("#resumen-mias .stat").forEach((b) => b.onclick = () => cargarMias(b.dataset.irTab));

  // --- publicaciones
  $("#list-mias").innerHTML = pubs.length ? pubs.map((p) => `
    <article class="card pub">
      <div class="catrow"><span class="cat">${ic(CAT_ICON[p.categoria] || "dots")} ${esc(cap(p.categoria))}</span>
        <span class="catrow-right">${etiqueta(p.estado)}</span></div>
      <h3>${esc(p.titulo)}</h3>
      <div class="meta"><span class="visto">${ic("thumb")} ${p.vistos || 0}</span>
        <span>${esc(p.zona)}</span><span>${hace(p.creado)}</span></div>
      <div class="pubs-actions">
        <button type="button" class="btn small" data-ver="${esc(p.id)}">Ver</button>
        ${p.estado === "activa" ? `<button type="button" class="btn small" data-cerrar="${esc(p.id)}">Marcar resuelta</button>` : ""}
        <button type="button" class="btn small danger" data-borrar="${esc(p.id)}">${ic("trash")}Borrar</button>
      </div>
    </article>`).join("")
    : `<div class="vacio">${ic("clipboard")}<b>Aún no publicas nada</b>
        Tus servicios, productos y favores aparecerán aquí.<br>
        <button type="button" class="btn primary" onclick="abrirPublicar()" style="margin-top:12px">Publicar algo</button></div>`;

  $$("#list-mias [data-ver]").forEach((b) => b.onclick = () => verDetalle(b.dataset.ver));
  $$("#list-mias [data-cerrar]").forEach((b) => b.onclick = async () => {
    try { await api(`/api/publicaciones/${b.dataset.cerrar}`, { method: "PATCH", body: JSON.stringify({ estado: "resuelta" }) });
      toast("Marcada como resuelta"); cargarMias(); } catch (e) { toast(e.message, "err"); }
  });
  $$("#list-mias [data-borrar]").forEach((b) => b.onclick = async () => {
    if (!confirm("¿Borrar esta publicación? Dejará de verse.")) return;
    try { await api(`/api/publicaciones/${b.dataset.borrar}`, { method: "DELETE", offlineQueue: false });
      toast("Publicación borrada"); cargarMias(); } catch (e) { toast(e.message, "err"); }
  });

  // --- cotizaciones
  $("#list-cotizaciones").innerHTML = cots.length ? cots.map((x) => {
    const soyVendedor = x.autor_id === S.user.id;
    return `<div class="card mini">
      <div class="fila-titulo"><strong>${esc(x.titulo)}</strong>${etiqueta(x.estado)}</div>
      <p class="hint">${soyVendedor ? "Te preguntó " + esc(x.comprador_nombre || "un vecino") : "Preguntaste por este servicio"} ·
        ${hace(x.creado)}</p>
      <p class="texto-cot">${esc(x.descripcion)}</p>
      ${x.precio_respuesta ? `<p><b>Respuesta: ${esc(x.precio_respuesta)}</b></p>` : ""}
      ${x.estado === "enviada" && soyVendedor ? `
        <div class="pubs-actions">
          <button type="button" class="btn small primary" data-resp="puedo" data-cid="${esc(x.id)}">Puedo hacerlo</button>
          <button type="button" class="btn small" data-resp="no_puedo" data-cid="${esc(x.id)}">No puedo</button>
        </div>` : ""}
    </div>`;
  }).join("")
    : `<div class="vacio">${ic("chat")}<b>Sin cotizaciones</b>
        Cuando un vecino pregunte por tu servicio, aparecerá aquí.</div>`;

  $$("#list-cotizaciones [data-resp]").forEach((b) => b.onclick = async () => {
    try {
      await api(`/api/cotizaciones/${b.dataset.cid}/responder`, { method: "POST", body: JSON.stringify({ respuesta: b.dataset.resp }) });
      toast("Respuesta enviada"); cargarMias();
    } catch (e) { toast(e.message, "err"); }
  });

  // --- tratos
  $("#list-tratos").innerHTML = tratos.length ? tratos.map((x) => {
    const soyComprador = x.comprador_id === S.user.id;
    const miMarca = soyComprador ? x.marca_comprador : x.marca_vendedor;
    const otra = soyComprador ? x.vendedor_nombre : x.comprador_nombre;
    return `<div class="card mini">
      <div class="fila-titulo"><strong>${esc(x.titulo)}</strong>${etiqueta(x.estado)}</div>
      <p class="hint">${soyComprador ? "Compraste a" : "Vendiste a"} ${esc(otra)} · ${esc(x.monto || "sin monto")} · ${hace(x.creado)}</p>
      ${x.estado === "acordado" && !miMarca ? `
        <div class="pubs-actions">
          <button type="button" class="btn small primary" data-trato="${esc(x.id)}">${soyComprador ? "Recibí el servicio" : "Entregué el servicio"}</button>
          <button type="button" class="btn small" data-cancelar="${esc(x.id)}">Cancelar</button>
        </div>`
      : x.estado === "acordado" ? `<p class="hint">Falta que ${esc(otra)} confirme.</p>`
      : x.estado === "cerrado" ? `<p class="hint">${ic("check")} Cerrado. Puedes dejar tu visto bueno en la publicación.</p>` : ""}
    </div>`;
  }).join("")
    : `<div class="vacio">${ic("handshake")}<b>Todavía no hay tratos</b>
        Cuando acuerdes un servicio, regístralo desde la publicación para dejar constancia.</div>`;

  $$("#list-tratos [data-trato]").forEach((b) => b.onclick = async () => {
    try { await api(`/api/tratos/${b.dataset.trato}/estado`, { method: "POST", body: JSON.stringify({ estado: "cerrado" }) });
      toast("Confirmado"); cargarMias(); } catch (e) { toast(e.message, "err"); }
  });
  $$("#list-tratos [data-cancelar]").forEach((b) => b.onclick = async () => {
    try { await api(`/api/tratos/${b.dataset.cancelar}/estado`, { method: "POST", body: JSON.stringify({ estado: "cancelado" }) });
      cargarMias(); } catch (e) { toast(e.message, "err"); }
  });

  // --- favores
  $("#list-intercambios").innerHTML = favores.length ? favores.map((x) => `
    <div class="card mini">
      <div class="fila-titulo"><strong>${esc(x.peticion_titulo || "Favor")}</strong>${etiqueta(x.estado)}</div>
      <p class="hint">${hace(x.creado)}</p>
      <p class="texto-cot">${esc(x.mensaje || "")}</p>
      ${x.estado === "solicitada" && x.solicitante_id === S.user.id ? `
        <div class="pubs-actions">
          <button type="button" class="btn small primary" data-inter="aceptada" data-iid="${esc(x.id)}">Aceptar</button>
          <button type="button" class="btn small" data-inter="rechazada" data-iid="${esc(x.id)}">Rechazar</button>
        </div>`
      : x.estado === "aceptada" ? `
        <div class="pubs-actions"><button type="button" class="btn small primary" data-inter="resuelta" data-iid="${esc(x.id)}">Se concretó</button></div>` : ""}
    </div>`).join("")
    : `<div class="vacio">${ic("heart")}<b>Sin favores en curso</b>
        Pide o ofrece ayuda en la pestaña Favores.</div>`;

  $$("#list-intercambios [data-inter]").forEach((b) => b.onclick = async () => {
    try { await api(`/api/intercambios/${b.dataset.iid}/estado`, { method: "POST", body: JSON.stringify({ estado: b.dataset.inter }) });
      toast("Actualizado"); cargarMias(); } catch (e) { toast(e.message, "err"); }
  });

  // --- privacidad
  const total = accesos ? accesos.total : 0;
  $("#accesos-box").innerHTML = `
    <p class="acceso-num"><b>${total}</b> ${total === 1 ? "vez consultaron tu contacto" : "veces consultaron tu contacto"}</p>
    ${accesos && accesos.items.length ? `<ul class="lista">${accesos.items.slice(0, 10).map((x) =>
      `<li>${esc(x.quien)} · ${esc(x.titulo)} · ${hace(x.creado)}</li>`).join("")}</ul>` : ""}
    <p class="hint">Solo se registra cuando un vecino con sesión abre una publicación tuya que muestra contacto.
      Puedes ocultar tu número en Mi perfil.</p>`;
}

/* ------------------------------------------------------------ moderación */
async function cargarModeracion() {
  if (!S.user || S.user.rol !== "moderador") return;
  const m = await api("/api/moderacion/metricas").catch(() => null);
  if (m) {
    const tarj = (t, v, s = "", estado = "") =>
      `<div class="card metrica ${estado}"><span>${esc(t)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`;
    $("#metricas").innerHTML = [
      tarj("Ofertas activas", m.ofertas_activas, "publicaciones visibles hoy"),
      tarj("Pedidos con respuesta", `${m.cotizaciones_respondidas}/${m.cotizaciones}`, "cotizaciones atendidas"),
      tarj("Tratos cerrados", m.tratos_cerrados ?? 0, "con doble confirmación"),
      tarj("Favores resueltos", `${m.intercambios_resueltos}/${m.intercambios}`, "intercambios concretados"),
      tarj("Vecinos registrados", m.usuarios, "cuentas creadas"),
      tarj("Reportes pendientes", m.reportes_pendientes, "por revisar", Number(m.reportes_pendientes) > 0 ? "alerta" : "bien"),
    ].join("");
  }
  const r = await api("/api/moderacion/reportes").catch(() => []);
  $("#list-reportes").innerHTML = r.length ? r.map((x) => `
    <div class="card mini"><strong>${esc(x.titulo || "Publicación")}</strong>
      <p class="hint">Motivo: ${esc(x.motivo)} · ${hace(x.creado)}</p>
      <div class="pubs-actions">
        <button type="button" class="btn small" data-ver="${esc(x.publicacion_id)}">Revisar</button>
        <button type="button" class="btn small" data-mod="ninguna" data-rid="${esc(x.id)}">Sin acción</button>
        <button type="button" class="btn small danger" data-mod="ocultar" data-rid="${esc(x.id)}">Ocultar</button>
      </div></div>`).join("") : `<p class="hint">Sin reportes pendientes.</p>`;
  $$("#list-reportes [data-ver]").forEach((b) => b.onclick = () => verDetalle(b.dataset.ver));
  $$("#list-reportes [data-mod]").forEach((b) => b.onclick = async () => {
    try { await api("/api/moderacion/reportes", { method: "POST", body: JSON.stringify({ reporte_id: b.dataset.rid, accion: b.dataset.mod }) });
      toast("Reporte resuelto"); cargarModeracion(); } catch (e) { toast(e.message, "err"); }
  });
}

async function toggleEmergencia(activa) {
  const motivo = $("#motivo-emerg").value.trim() || "Emergencia declarada por el comité";
  try {
    await api("/api/emergencia/activar", { method: "POST", body: JSON.stringify({ activa, motivo }) });
    toast(activa ? "Emergencia activada. Todos los vecinos la verán." : "Emergencia desactivada.");
    cargarEmergencia();
  } catch (e) { toast(e.message, "err"); }
}

/* ------------------------------------------------------------ tutorial */
const TUTORIAL = {
  es: [
    ["Elige tu sector", "Al entrar te preguntamos dónde vives. Así ves primero a los vecinos más cercanos y las distancias son reales."],
    ["Busca o publica", "En Economía Local encuentras servicios y productos. Si ofreces algo, toca Publicar: son tres pasos cortos."],
    ["Pide una cotización", "Toca una publicación y escríbele al vecino. Te responde por aquí y te avisa la campana."],
    ["Paga y cierra", "Acuerdan el precio, pagas con Yape o Plin con un toque, y cuando termina ambos confirman el trato."],
    ["Deja tu visto bueno", "Solo puedes recomendar a quien te atendió de verdad. Así el aval del barrio significa algo."],
  ],
  qu: [
    ["Maypim tiyanki", "Yaykuptiyki tapusunki maypim tiyanki. Chaywanmi aswan qayllapi kaq runakunata qhawanki."],
    ["Maskay utaq willay", "Economía Local nisqapi tariy serviciokunata, rantisqakunata. Willayta munaspayki 'Publicar' ñitiy."],
    ["Mañakuy", "Huk willayta ñitiy, chay runaman qillqay. Paymi kutichisunki, campanapi willasunki."],
    ["Pagay", "Yape utaq Plin wan pagay. Tukuruspaqa iskaynin runakuna trato nisqata ch'iqllanku."],
    ["Allin rimay", "Chay runa allinta yanapasqanmanta rimay. Chaywanmi barrio allin rimay kallpanchakun."],
  ],
};

function pintarTutorial() {
  const pasos = TUTORIAL[S.idioma];
  $("#tutorial-pasos").innerHTML = pasos.map(([t, d]) => `<li><b>${esc(t)}</b><p>${esc(d)}</p></li>`).join("");
  $("#btn-idioma-es").classList.toggle("on", S.idioma === "es");
  $("#btn-idioma-qu").classList.toggle("on", S.idioma === "qu");
}

function leerTutorial() {
  if (!("speechSynthesis" in window)) { toast("Tu navegador no tiene voz. Lee los pasos en pantalla.", "warn"); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(TUTORIAL[S.idioma].map(([t, d]) => `${t}. ${d}`).join(" "));
  u.lang = S.idioma === "qu" ? "es-PE" : "es-PE";
  u.rate = 0.92;
  window.speechSynthesis.speak(u);
  toast("Leyendo el tutorial en voz alta…");
}

/* ------------------------------------------------------------ zonas y ubicación */
function llenarZonas() {
  const opciones = S.zonas.map((z) => `<option value="${esc(z.nombre)}">${esc(z.nombre)}</option>`).join("");
  ["#f-zona", "#p-zona", "#loc-sector"].forEach((sel) => {
    const el = $(sel); if (!el) return;
    const v = el.value;
    el.innerHTML = opciones;
    if (v) el.value = v;
  });
  const rz = $("#r-zona");
  rz.innerHTML = `<option value="">Elige tu sector</option>` + opciones;
  window.syncSelects && window.syncSelects();
}

async function pedirGPS() {
  if (!navigator.geolocation) { toast("Este navegador no tiene GPS.", "warn"); return; }
  toast("Ubicando…");
  navigator.geolocation.getCurrentPosition(async (pos) => {
    S.lat = pos.coords.latitude; S.lng = pos.coords.longitude;
    localStorage.setItem("vecinal-lat", S.lat);
    localStorage.setItem("vecinal-lng", S.lng);
    // Sector más cercano por distancia al centro
    let mejor = null, mejorD = Infinity;
    S.zonas.forEach((z) => {
      const d = Math.hypot(z.lat - S.lat, z.lng - S.lng);
      if (d < mejorD) { mejorD = d; mejor = z; }
    });
    if (mejor) { S.zona = mejor.nombre; localStorage.setItem("vecinal-zona", S.zona); pintarZona(); }
    $("#locmodal").hidden = true;
    toast(`Listo: ${S.zona}. Ordenamos por cercanía.`);
    cargarLista();
  }, () => toast("No pudimos ubicarte. Elige tu sector a mano.", "warn"), { timeout: 8000, maximumAge: 600000 });
}

/* ------------------------------------------------------------ avisos */
async function cargarAvisos() {
  if (!S.user) return;
  try {
    const d = await api("/api/notificaciones");
    S.sinLeer = d.sin_leer; S.notifs = d.items;
    const b = $("#campana-badge");
    b.hidden = !d.sin_leer;
    b.textContent = d.sin_leer > 99 ? "99+" : d.sin_leer;
    $("#lista-avisos").innerHTML = d.items.length ? d.items.map((n) => `
      <div class="aviso ${n.leida ? "" : "nueva"}">
        <strong>${esc(n.titulo)}</strong>
        <p>${esc(n.cuerpo)}</p><small>${hace(n.creado)}</small>
      </div>`).join("") : `<p class="hint" style="padding:12px">Sin avisos.</p>`;
  } catch {}
}

/* ------------------------------------------------------------ arranque */
function engancharEventos() {
  $$(".tabs button, .bottom-nav button").forEach((b) => b.onclick = () => {
    if (b.dataset.moderador && (!S.user || S.user.rol !== "moderador")) return;
    ir(b.dataset.view);
  });
  $$("#view-local .segmented button").forEach((b) => b.onclick = () => {
    $$("#view-local .segmented button").forEach((x) => x.classList.toggle("on", x === b));
    S.tipo = b.dataset.tipo; cargarLista();
  });
  $$("#view-favores .segmented button").forEach((b) => b.onclick = () => {
    $$("#view-favores .segmented button").forEach((x) => x.classList.toggle("on", x === b));
    S.filtroFavor = b.dataset.filtro; cargarFavores();
  });
  let tmr;
  $("#q").addEventListener("input", (e) => {
    clearTimeout(tmr);
    tmr = setTimeout(() => { S.q = e.target.value.trim(); cargarLista(); }, 350);
  });
  $("#cat").onchange = (e) => { S.cat = e.target.value; cargarLista(); };
  $("#orden").onchange = (e) => { S.orden = e.target.value; cargarLista(); };
  $$(".tabs-mias button").forEach((b) => b.onclick = () => cargarMias(b.dataset.tab));
  $("#cat-favor").onchange = (e) => { S.catFavor = e.target.value; cargarFavores(); };
  $("#btn-more").onclick = () => cargarLista({ append: true });
  $("#btn-publicar").onclick = () => abrirPublicar();
  $("#gate-crear").onclick = () => { $("#pubmodal").hidden = true; document.body.style.overflow = ""; ir("perfil");
    setTimeout(() => { $("#r-nombre").focus(); }, 300); };
  $("#gate-entrar").onclick = () => { $("#pubmodal").hidden = true; document.body.style.overflow = ""; ir("perfil");
    setTimeout(() => { $("#l-email").focus(); }, 300); };
  $("#fab-publicar").onclick = () => abrirPublicar();
  $("#btn-publicar-favor").onclick = () => abrirPublicar("favor_solicitado");
  $("#btn-reportar-necesidad").onclick = () => abrirPublicar("favor_solicitado");
  $("#btn-ofrecer-recurso").onclick = () => abrirPublicar("favor_ofrecido");
  $("#btn-zona").onclick = () => { $("#locmodal").hidden = false; $("#loc-sector").value = S.zona; };
  $("#btn-loc-ok").onclick = () => {
    S.zona = $("#loc-sector").value; localStorage.setItem("vecinal-zona", S.zona);
    S.lat = null; S.lng = null; localStorage.removeItem("vecinal-lat"); localStorage.removeItem("vecinal-lng");
    $("#locmodal").hidden = true; pintarZona(); cargarLista();
  };
  $("#btn-gps").onclick = pedirGPS;

  $("#btn-campana").onclick = () => {
    const p = $("#panel-avisos");
    p.hidden = !p.hidden;
    if (!p.hidden) cargarAvisos();
  };
  $("#btn-avisos-leer").onclick = async () => {
    try { await api("/api/notificaciones/leer", { method: "POST" }); cargarAvisos(); } catch {}
  };

  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-close]");
    if (c) { c.closest(".modal").hidden = true; document.body.style.overflow = ""; }
    if (e.target.classList.contains("modal")) { e.target.hidden = true; document.body.style.overflow = ""; }
    if (!e.target.closest("#panel-avisos") && !e.target.closest("#btn-campana")) $("#panel-avisos").hidden = true;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { cerrarModal(); $("#pubmodal").hidden = true; document.body.style.overflow = ""; } });

  $("#form-pub").addEventListener("submit", enviarPublicacion);
  $("#f-tipo").onchange = () => { ajustarTipo(); guardarBorrador(); };
  $("#f-subtipo").onchange = ajustarTipo;
  $("#f-titulo").addEventListener("input", () => { actualizarContadores(); guardarBorrador(); });
  $("#f-desc").addEventListener("input", () => { actualizarContadores(); guardarBorrador(); });
  ["#f-precio", "#f-pagos", "#f-politica", "#f-zona", "#f-franja", "#f-punto"].forEach((s) => {
    $(s).addEventListener("change", guardarBorrador);
    $(s).addEventListener("input", guardarBorrador);
  });
  $("#f-emerg").onchange = guardarBorrador;
  $("#f-mostrar").onchange = guardarBorrador;
  $("#f-fotos").onchange = (e) => subirFotos(e.target.files);
  $$("#form-pub [data-next]").forEach((b) => b.onclick = () => {
    if (S.paso === 1) {
      if (!$("#f-cat").value) { $("#err-paso1").textContent = "Elige una categoría."; return; }
      $("#err-paso1").textContent = "";
    }
    if (S.paso === 2) {
      const err = validarPaso2();
      if (err) { $("#err-paso2").textContent = err; return; }
      $("#err-paso2").textContent = "";
    }
    pintarPaso(Number(b.dataset.next));
  });
  $$("#form-pub [data-prev]").forEach((b) => b.onclick = () => pintarPaso(Number(b.dataset.prev)));

  $("#form-registro").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#err-registro"); err.textContent = "";
    const body = {
      nombre: $("#r-nombre").value.trim(),
      zona: $("#r-zona").value,
      telefono: $("#r-tel").value.trim(),
      email: $("#r-email").value.trim(),
      password: $("#r-pass").value,
      yape: $("#r-yape").value.trim() || null,
      plin: $("#r-plin").value.trim() || null,
      acepta_privacidad: $("#r-priv").checked,
    };
    if (!body.nombre) return err.textContent = "Escribe tu nombre.";
    if (!body.zona) return err.textContent = "Elige tu sector.";
    if (!/^[0-9]{9}$/.test(body.telefono)) return err.textContent = "El teléfono debe tener 9 dígitos.";
    if (!body.email.includes("@")) return err.textContent = "Revisa el correo.";
    if (body.password.length < 6) return err.textContent = "La contraseña necesita 6 caracteres.";
    if (!body.acepta_privacidad) return err.textContent = "Debes aceptar el aviso de privacidad.";
    try {
      await api("/api/registro", { method: "POST", body: JSON.stringify(body), offlineQueue: false });
      const sesion = await api("/api/login", { method: "POST",
        body: JSON.stringify({ email: body.email, password: body.password }), offlineQueue: false });
      S.token = sesion.token; localStorage.setItem("vecinal-token", sesion.token);
      await cargarPerfil();
      toast(`Bienvenido${S.user ? ", " + S.user.nombre.split(" ")[0] : ""}. Ya puedes publicar.`);
      ir("local");
      if (S.quieroPublicar) setTimeout(() => abrirPublicar(), 400);
    } catch (e2) { err.textContent = e2.message; }
  });

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#err-login"); err.textContent = "";
    try {
      const d = await api("/api/login", { method: "POST",
        body: JSON.stringify({ email: $("#l-email").value.trim(), password: $("#l-pass").value }),
        offlineQueue: false });
      S.token = d.token; localStorage.setItem("vecinal-token", d.token);
      await cargarPerfil();
      toast("Entraste. ¡Bienvenido!");
      cargarAvisos(); ir("local");
      if (S.quieroPublicar) setTimeout(() => abrirPublicar(), 400);
    } catch (e2) { err.textContent = e2.message; }
  });

  $("#form-perfil").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#err-perfil"); err.textContent = "";
    try {
      await api("/api/perfil", { method: "PUT", body: JSON.stringify({
        nombre: $("#p-nombre").value.trim(),
        zona: $("#p-zona").value,
        descripcion: $("#p-desc").value.trim(),
        oficios: $("#p-ofi").value.trim(),
        yape: $("#p-yape").value.trim(),
        plin: $("#p-plin").value.trim(),
        mostrar_contacto: $("#p-mostrar").checked,
      }) });
      await cargarPerfil();
      toast("Datos guardados.");
    } catch (e2) { err.textContent = e2.message; }
  });

  $("#btn-olvide").onclick = () => { $("#resetmodal").hidden = false; $("#rs-paso2").hidden = true; $("#err-reset").textContent = ""; };
  $("#btn-rs-pedir").onclick = async () => {
    const err = $("#err-reset"); err.textContent = "";
    try {
      const d = await api("/api/password/solicitar", { method: "POST",
        body: JSON.stringify({ identificador: $("#rs-ident").value.trim() }) });
      $("#rs-paso2").hidden = false;
      if (d.codigo_demo) {
        $("#rs-code").value = d.codigo_demo;
        toast(`Código: ${d.codigo_demo} (en la demo se muestra aquí)`);
      } else toast(d.mensaje || "Revisa tu teléfono.");
    } catch (e2) { err.textContent = e2.message; }
  };
  $("#btn-rs-confirmar").onclick = async () => {
    const err = $("#err-reset"); err.textContent = "";
    try {
      await api("/api/password/confirmar", { method: "POST", body: JSON.stringify({
        identificador: $("#rs-ident").value.trim(), codigo: $("#rs-code").value.trim(), password: $("#rs-pass").value,
      }) });
      $("#resetmodal").hidden = true;
      toast("Contraseña cambiada. Inicia sesión.");
    } catch (e2) { err.textContent = e2.message; }
  };

  $("#btn-idioma-es").onclick = () => { S.idioma = "es"; pintarTutorial(); };
  $("#btn-idioma-qu").onclick = () => { S.idioma = "qu"; pintarTutorial(); };
  $("#btn-leer").onclick = leerTutorial;
  $("#btn-emerg-on").onclick = () => toggleEmergencia(true);
  $("#btn-emerg-off").onclick = () => toggleEmergencia(false);

  window.addEventListener("online", () => { banner(""); sincronizarCola(); cargarLista(); });
  window.addEventListener("offline", () => banner("Sin conexión: puedes seguir viendo lo cargado y publicar; se enviará al volver la señal.", "warn"));
}

/* El botón flotante se aparta al bajar: deja leer la lista sin que tape texto. */
function fabInteligente() {
  const fab = $("#fab-publicar");
  if (!fab) return;
  let ultimo = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const bajando = y > ultimo + 8;
    const subiendo = y < ultimo - 8;
    if (bajando && y > 120) fab.classList.add("oculto");
    if (subiendo || y < 80) fab.classList.remove("oculto");
    ultimo = y;
  }, { passive: true });
}

/* Si el teléfono quedó con una versión vieja en caché, se actualiza sola una vez. */
async function verificarVersion() {
  try {
    const d = await api("/api/salud", { offlineQueue: false });
    if (!d || !d.version || d.version === APP_VERSION) return;
    if (sessionStorage.getItem("vecinal-actualizado") === d.version) return;
    sessionStorage.setItem("vecinal-actualizado", d.version);
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
    location.reload();
  } catch { /* sin conexión: se reintenta en la próxima visita */ }
}

async function arrancar() {
  try { S.zonas = await api("/api/zonas"); } catch { S.zonas = []; }
  llenarZonas();
  if (S.user === null) await cargarPerfil();
  pintarZona();
  engancharEventos();
  $$("select").forEach(mejoraSelect);
  fabInteligente();
  pintarAuth();
  await cargarLista();
  pintarCola();
  if (S.user) { cargarAvisos(); setInterval(cargarAvisos, 60000); }
  const hash = location.hash.replace("#", "");
  if (hash && $(`#view-${hash}`)) ir(hash);
  verificarVersion();
  if (!localStorage.getItem("vecinal-visto-loc") && !S.token) {
    $("#locmodal").hidden = false;
    localStorage.setItem("vecinal-visto-loc", "1");
  }
}

document.addEventListener("DOMContentLoaded", arrancar);
window.ir = ir;
window.abrirPublicar = abrirPublicar;
window.cerrarModal = cerrarModal;
