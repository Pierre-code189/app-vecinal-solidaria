// Comprueba la barra inferior nueva: iconos, colores por sección, botón central
// de publicar y los tres formularios. Uso: node scripts/qa-tabbar.mjs <puerto> <carpeta> <url>
import fs from "node:fs";

const PORT = process.argv[2] || "9333";
const OUT = process.argv[3] || "./capturas/tabbar";
const BASE = process.argv[4] || "https://vecinal.apioai.online";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
const paso = (t, ok, extra = "") => { if (!ok) fallos++; console.log(`${ok ? "OK  " : "FALLA"} ${t}${extra ? "  · " + extra : ""}`); };

const login = await (await fetch(BASE + "/api/login_pin", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ telefono: "999000003", pin: "123456" }),
})).json();

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
const foto = async (n) => {
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const ruta = `${OUT}/${n}.png`; fs.writeFileSync(ruta, Buffer.from(s.result.data, "base64")); return ruta;
};

fs.mkdirSync(OUT, { recursive: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
await go(BASE + "/?r=" + Date.now());
await js(`(async () => { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); return "ok"; })()`);
await js(`localStorage.setItem("vecinal-token", ${JSON.stringify(login.token)}); localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-zona-manual","1"); true`);

const COLOR = `(sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).color : ""; }`;
await go(BASE + "/?r=" + Date.now() + "#/");
await sleep(1500);

// 1. barra con cinco posiciones
const orden = await js(`[...document.querySelectorAll(".tabbar > *")].map(e => e.getAttribute("data-sec") || e.className || e.tagName).join(",")`);
paso("la barra tiene Local, Favores, +, Emergencia y Perfil en ese orden",
  orden === "local,favores,tab-publicar,emergencia,perfil", orden);
paso("el botón central es un +", (await js(`Boolean(document.querySelector(".tab-publicar svg"))`)));
paso("Local ya no tiene el botón Publicar junto al buscador", (await js(`!document.querySelector(".toolbar .btn-publicar")`)));
paso("Local ya no tiene el botón flotante +", (await js(`!document.querySelector(".fab")`)));

// 2. colores: gris fuera, color dentro
const colores = await js(`(() => {
  const g = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).color : ""; };
  return { local: g('.tabbar a[data-sec="local"]'), fav: g('.tabbar a[data-sec="favores"]'), em: g('.tabbar a[data-sec="emergencia"]'), per: g('.tabbar a[data-sec="perfil"]') };
})()`);
paso("en Local, Local va en verde y el resto en gris",
  colores.local === "rgb(15, 122, 61)" && colores.fav === colores.em && colores.fav === colores.per, JSON.stringify(colores));
await foto("1-local");

await go(BASE + "/?r=" + Date.now() + "#/favores");
await sleep(1600);
const cFav = await js(`getComputedStyle(document.querySelector('.tabbar a[data-sec="favores"]')).color`);
paso("en Favores, su icono va en azul", cFav === "rgb(29, 79, 140)", cFav);
await foto("2-favores");

await go(BASE + "/?r=" + Date.now() + "#/emergencia");
await sleep(1600);
const cEm = await js(`getComputedStyle(document.querySelector('.tabbar a[data-sec="emergencia"]')).color`);
paso("en Emergencia, su icono va en rojo", cEm === "rgb(179, 38, 30)", cEm);
await foto("3-emergencia");

// 3. el + abre el selector y cada opción su formulario
await go(BASE + "/?r=" + Date.now() + "#/");
await sleep(1400);
await js(`document.querySelector(".tab-publicar").click(); true`);
await sleep(900);
const opciones = await js(`[...document.querySelectorAll(".pub-opcion")].map(b => b.querySelector("b").textContent)`);
paso("el + abre «¿Qué quieres publicar?» con tres opciones",
  Array.isArray(opciones) && opciones.length === 3, JSON.stringify(opciones));
await foto("4-selector");

const ESPERA = { servicio: /servicio que ofrezco|Un producto/i, favor: /Pedir ayuda|Ofrecer ayuda|favor/i, emergencia: /Necesito|recurso|emergencia/i };
for (const [i, o] of [{ k: "servicio" }, { k: "favor" }, { k: "emergencia" }].entries()) {
  await go(BASE + "/?r=" + Date.now() + "#/");
  await sleep(1300);
  await js(`document.querySelector(".tab-publicar").click(); true`);
  await sleep(700);
  await js(`(() => { const b = [...document.querySelectorAll(".pub-opcion")][${i}]; b.click(); return "ok"; })()`);
  await sleep(1400);
  const texto = await js(`[...document.querySelectorAll(".modalbox")].map(m => m.innerText).join(" ")`);
  paso(`la opción ${o.k} abre su formulario`, ESPERA[o.k].test(texto), texto.slice(0, 80).replace(/\n/g, " · "));
  await foto(`5-form-${o.k}`);
}

console.log(fallos ? `\n${fallos} paso(s) fallaron` : "\nTodo en verde");
process.exit(fallos ? 1 : 0);
