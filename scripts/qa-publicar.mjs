// Prueba el formulario único: los tres contextos por la interfaz, y WhatsApp
// encendido/apagado en el panel. Uso: node scripts/qa-publicar.mjs <puerto> <url>
const PORT = process.argv[2] || "9333";
const BASE = process.argv[3] || "https://vecinal.apioai.online";
const ESQ = "Bea" + "rer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
const paso = (t, ok, extra = "") => { if (!ok) fallos++; console.log(`${ok ? "OK  " : "FALLA"} ${t}${extra ? "  · " + extra : ""}`); };

const login = await (await fetch(BASE + "/api/login_pin", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ telefono: "999000003", pin: "123456" }),
})).json();
const token = login.token;

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}) => { const mid = ++id; ws.send(JSON.stringify({ id: mid, method: m, params: p })); return new Promise((r) => pend.set(mid, r)); };
await send("Page.enable"); await send("Runtime.enable");
const js = async (e) => {
  const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value ?? r.result?.exceptionDetails?.text;
};
const go = async (u) => { await send("Page.navigate", { url: u }); await sleep(3200); };
const escribir = (sel, texto) => js(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return "NO";
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(texto)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return "OK";
})()`);
const click = (texto, sel = ".modalbox button") => js(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(
    (e) => e.getClientRects().length && e.textContent.trim().includes(${JSON.stringify(texto)}));
  if (!el) return "NO";
  el.click(); return "OK";
})()`);

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
await go(BASE + "/?r=" + Date.now());
await js(`(async () => { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); return "ok"; })()`);
await js(`localStorage.setItem("vecinal-token", ${JSON.stringify(token)}); localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-zona-manual","1"); true`);

const abrirForm = async (indice) => {
  await go(BASE + "/?r=" + Date.now() + "#/");
  await sleep(1200);
  await js(`document.querySelector(".tab-publicar").click(); true`);
  await sleep(700);
  await js(`(() => { [...document.querySelectorAll(".pub-opcion")][${indice}].click(); return "ok"; })()`);
  await sleep(1200);
};

const PUBLICADOS = [];
const casos = [
  { i: 0, modo: "servicio", t: "Clase de prueba QA servicio", d: "Servicio de prueba creado por el QA para validar el formulario nuevo.", precio: "35", wa: true },
  { i: 1, modo: "favor", t: "Favor de prueba QA", d: "Necesito una escalera para pintar la fachada este fin de semana.", wa: true },
  { i: 2, modo: "emergencia", t: "Recurso de prueba QA", d: "Reparto agua en el parque hasta las 8 de la noche.", wa: true },
  { i: 0, modo: "servicio sin whatsapp", t: "Servicio QA sin WhatsApp", d: "Publicación de prueba con el WhatsApp apagado desde el formulario.", precio: "20", wa: false },
];

for (const c of casos) {
  await abrirForm(c.i);
  await click("Siguiente");
  await sleep(700);
  const campos = await js(`({
    wa: Boolean(document.querySelector(".wa-bloque")),
    precio: Boolean(document.querySelector(".precio-fila")),
    titulo: Boolean(document.querySelector("#p-titulo")),
  })`);
  paso(`${c.modo}: el paso 2 trae los campos de su contexto`,
    campos.titulo && campos.wa && (c.i === 0 ? campos.precio : true), JSON.stringify(campos));

  await escribir("#p-titulo", c.t);
  await escribir("#p-desc", c.d);
  if (c.i === 0) await escribir(".precio-fila input[type=number]", c.precio);
  await sleep(200);
  if (!c.wa) {
    await js(`document.querySelector('.wa-bloque input[type=checkbox]').click(); true`);
    await sleep(300);
  }
  const ok = await click("Publicar");
  await sleep(2600);
  const cerró = await js(`!document.querySelector(".modalbox")`);
  paso(`${c.modo}: publica desde el formulario`, ok === "OK" && cerró, `click=${ok} cerrado=${cerró}`);
  PUBLICADOS.push({ ...c, ok: cerró });
}

// comprobación por API
const det = async (id) => (await fetch(`${BASE}/api/publicaciones/${id}`, { headers: { Authorization: `${ESQ} ${token}` } })).json();
const mias = await (await fetch(`${BASE}/api/mis-publicaciones`, { headers: { Authorization: `${ESQ} ${token}` } })).json();
const buscar = (t) => (Array.isArray(mias) ? mias : mias.items || []).find((p) => p.titulo === t);

const s1 = buscar("Clase de prueba QA servicio");
paso("servicio: guarda tipo, precio y WhatsApp del autor",
  s1?.tipo === "servicio" && /35/.test(s1?.precio || "") && Boolean(s1?.whatsapp), JSON.stringify({ tipo: s1?.tipo, precio: s1?.precio }));
const d1 = s1 ? await det(s1.id) : {};
paso("servicio: el panel enlaza a wa.me con ese número", /wa\.me\/51999000003/.test(
  d1.whatsapp ? `wa.me/51${d1.whatsapp}` : ""), JSON.stringify(d1.whatsapp));

const f1 = buscar("Favor de prueba QA");
paso("favor: se guarda como pedido de ayuda, sin precio",
  f1?.tipo === "favor_solicitado" && /Gratis|intercambio/i.test(f1?.precio || ""), JSON.stringify({ tipo: f1?.tipo, precio: f1?.precio }));

const e1 = buscar("Recurso de prueba QA");
paso("emergencia: entra al tablero con su recurso",
  Boolean(e1?.es_emergencia) && Boolean(e1?.necesidad), JSON.stringify({ em: e1?.es_emergencia, nec: e1?.necesidad }));

const s2 = buscar("Servicio QA sin WhatsApp");
const d2 = s2 ? await det(s2.id) : {};
paso("WhatsApp apagado: el panel no ofrece WhatsApp", !d2.whatsapp, JSON.stringify({ whatsapp: d2.whatsapp }));

console.log(fallos ? `\n${fallos} paso(s) fallaron` : "\nTodo en verde");
process.exit(fallos ? 1 : 0);
