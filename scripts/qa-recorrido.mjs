/**
 * Recorrido de QA: mide desbordes, errores de consola, respuestas ≥400 y
 * objetivos táctiles pequeños en cada vista, en móvil y escritorio.
 *
 * Uso:  node scripts/qa-recorrido.mjs [movil|escritorio] [telefono]
 * Requiere Chromium con --remote-debugging-port=9335.
 */
import fs from "node:fs";

const modo = process.argv[2] || "movil";
const tel = process.argv[3] || "";
const BASE = "https://vecinal.apioai.online";
const SALIDA = "capturas/qa";
fs.mkdirSync(SALIDA, { recursive: true });

const lista = await (await fetch("http://127.0.0.1:9335/json/list")).json();
const page = lista.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pend = new Map();
let errores = [];
let fallosRed = [];
let httpMalos = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") {
    errores.push(m.params.exceptionDetails.exception?.description?.split("\n")[0] || "excepción");
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errores.push((m.params.args || []).map((a) => a.value || a.description || "").join(" ").slice(0, 160));
  }
  if (m.method === "Network.loadingFailed" && !m.params.canceled) fallosRed.push(m.params.errorText);
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400) {
    httpMalos.push(`${m.params.response.status} ${m.params.response.url.replace(BASE, "")}`);
  }
};

const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((r) => pend.set(i, r));
};
const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
if (modo === "movil") {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
} else {
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
}

const metricas = () =>
  js(`(() => {
    const w = window.innerWidth, h = window.innerHeight;
    const fuera = [];
    document.querySelectorAll("main *, header *, nav *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > w + 1 || r.left < -1) {
        const estilo = getComputedStyle(el);
        if (estilo.position === "fixed" || estilo.visibility === "hidden") return;
        fuera.push((el.className || el.tagName).toString().slice(0, 40) + " @" + Math.round(r.right));
      }
    });
    const chicos = [...document.querySelectorAll("button, a, [role=button], input, select")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.height < 38 && getComputedStyle(el).display !== "inline";
      })
      .map((el) => (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 24));
    return {
      scrollW: document.documentElement.scrollWidth, innerW: w,
      desborde: document.documentElement.scrollWidth > w + 1,
      fuera: [...new Set(fuera)].slice(0, 6),
      chicos: [...new Set(chicos)].slice(0, 6),
      titulo: document.querySelector("h1")?.innerText || document.querySelector(".det2-titulo")?.innerText || "",
      tarjetas: document.querySelectorAll(".pub, .recurso, .fila").length,
      vacio: !!document.querySelector(".empty, .vacio"),
    };
  })()`);

async function ir(hash, { recargar = false } = {}) {
  errores = []; fallosRed = []; httpMalos = [];
  if (recargar) {
    await send("Page.navigate", { url: `${BASE}/?qa=${Date.now()}` });
    await dormir(2600);
  }
  await js(`location.hash = ${JSON.stringify(hash)}`);
  await dormir(2200);
  return { ...(await metricas()), errores: [...new Set(errores)], fallosRed: [...new Set(fallosRed)], httpMalos: [...new Set(httpMalos)] };
}

const capturar = async (nombre) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${SALIDA}/${modo}-${nombre}.png`, Buffer.from(r.data, "base64"));
};

// Arranque limpio
await send("Page.navigate", { url: `${BASE}/?qa=inicio` });
await dormir(2800);
await js(`localStorage.clear();
  localStorage.setItem("vecinal-tour", "1");
  localStorage.setItem("vecinal-ubicacion", "manual");`);

if (tel) {
  const sesion = await js(`(async () => {
    const r = await fetch("/api/login_pin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono: ${JSON.stringify(tel)}, pin: "123456" }) });
    const d = await r.json();
    if (!r.ok) return { error: d.detail || r.status };
    localStorage.setItem("vecinal-token", d.token);
    localStorage.setItem("vecinal-usuario", JSON.stringify(d.usuario));
    return { ok: true, nombre: d.usuario.nombre, rol: d.usuario.rol };
  })()`);
  console.log("sesión:", JSON.stringify(sesion));
}

const vistas = tel
  ? ["#/", "#/favores", "#/emergencia", "#/actividad", "#/perfil", "#/tutorial"]
  : ["#/", "#/favores", "#/emergencia", "#/tutorial", "#/perfil"];

const reporte = { modo, tel: tel || "invitado", cuando: new Date().toISOString(), vistas: [] };
for (const v of vistas) {
  const r = await ir(v, { recargar: true });
  reporte.vistas.push({ ruta: v, ...r });
  await capturar(v.replace(/[#/]/g, "") || "inicio");
  console.log(`${v.padEnd(14)} desborde=${r.desborde} tarjetas=${r.tarjetas} chicos=${r.chicos.length} errores=${r.errores.length} http=${r.httpMalos.length}`);
}

// Detalle de la primera tarjeta (volviendo a la portada)
await ir("#/");
const abre = await js(`(() => { const p = document.querySelector(".pub"); if (!p) return false; p.click(); return true; })()`);
if (abre) {
  await dormir(1800);
  const r = await metricas();
  reporte.detalle = { ...r, errores: [...new Set(errores)], httpMalos: [...new Set(httpMalos)] };
  await capturar("detalle");
  console.log(`detalle        desborde=${r.desborde} chicos=${r.chicos.length} errores=${reporte.detalle.errores.length}`);
}

fs.writeFileSync(`${SALIDA}/reporte-${modo}${tel ? "-" + tel : ""}.json`, JSON.stringify(reporte, null, 2));
console.log("guardado:", `${SALIDA}/reporte-${modo}${tel ? "-" + tel : ""}.json`);
process.exit(0);
