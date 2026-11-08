// Comprueba el chat a pantalla completa, el botón X fijo en la esquina y que el
// selector de "Acuerdo de pago" no se salga del formulario en móvil.
// Uso: node scripts/qa-chatpantalla.mjs <puerto> <carpeta> <url>
import fs from "node:fs";

const PORT = process.argv[2] || "9333";
const OUT = process.argv[3] || "./capturas/chatpantalla";
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
  fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(s.result.data, "base64"));
};
fs.mkdirSync(OUT, { recursive: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
await go(BASE + "/?r=" + Date.now());
await js(`(async () => { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); return "ok"; })()`);
await js(`localStorage.removeItem("vecinal-fab2"); localStorage.setItem("vecinal-token", ${JSON.stringify(login.token)}); localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-zona-manual","1"); true`);
await go(BASE + "/?r=" + Date.now() + "#/");
await sleep(1600);

// --- selector "Acuerdo de pago" dentro del formulario ---
await js(`document.querySelector(".tab-publicar").click(); true`);
await sleep(700);
await js(`[...document.querySelectorAll(".pub-opcion")][0].click(); true`);
await sleep(1200);
await js(`(() => { const b = [...document.querySelectorAll(".modalbox button")].find(x => x.textContent.includes("Siguiente")); b?.click(); return "ok"; })()`);
await sleep(900);
const desborde = await js(`(() => {
  const vw = window.innerWidth;
  const malos = [...document.querySelectorAll(".modalbox .sel-btn, .modalbox input, .modalbox .precio-fila")]
    .map((e) => ({ r: e.getBoundingClientRect(), txt: e.textContent.trim().slice(0, 24) }))
    .filter((x) => x.r.right > vw + 1 || x.r.left < -1);
  return { vw, malos: malos.map((m) => ({ txt: m.txt, left: Math.round(m.r.left), right: Math.round(m.r.right) })),
    scroll: document.documentElement.scrollWidth - vw };
})()`);
paso("ningún campo del formulario se sale de la pantalla",
  desborde.malos.length === 0 && desborde.scroll === 0, JSON.stringify(desborde));
await foto("1-formulario");

// --- chat a pantalla completa ---
await js(`document.querySelector(".modalbox .close").click(); true`);
await sleep(600);
await js(`document.querySelector(".fab-msg").click(); true`);
await sleep(1400);
const caja = await js(`(() => { const r = document.querySelector(".chatflotante").getBoundingClientRect();
  return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight }; })()`);
paso("el chat ocupa la pantalla dejando el borde superior",
  caja.l <= 10 && caja.t <= 10 && caja.r >= caja.vw - 10 && caja.b >= caja.vh - 10, JSON.stringify(caja));

const fab = await js(`(() => { const r = document.querySelector(".fab-msg").getBoundingClientRect();
  return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight,
    icono: document.querySelector(".fab-msg svg")?.outerHTML.includes("M4 5h16v11H9") ? "chat" : "otro",
    z: getComputedStyle(document.querySelector(".flotantes")).zIndex,
    visible: document.querySelector(".fab-msg").checkVisibility?.() ?? true }; })()`);
paso("el botón queda abajo a la derecha, encima del chat y con una X",
  fab.l > fab.vw / 2 && fab.b <= fab.vh - 60 && fab.b >= fab.vh - 90 && fab.icono === "otro" && Number(fab.z) >= 90,
  JSON.stringify(fab));

// arrastrarlo estando abierto no debe moverlo
const antes = await js(`(() => { const r = document.querySelector(".fab-msg").getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top) }; })()`);
await js(`(() => {
  const el = document.querySelector(".fab-msg"); const r = el.getBoundingClientRect();
  const o = (x, y) => ({ bubbles: true, pointerId: 1, clientX: x, clientY: y });
  el.dispatchEvent(new PointerEvent("pointerdown", o(r.left + 10, r.top + 10)));
  window.dispatchEvent(new PointerEvent("pointermove", o(60, 200)));
  window.dispatchEvent(new PointerEvent("pointerup", o(60, 200)));
  return "ok";
})()`);
await sleep(600);
const despues = await js(`(() => { const r = document.querySelector(".fab-msg").getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top) }; })()`);
paso("con el chat abierto el botón no se mueve", antes.l === despues.l && antes.t === despues.t, `${JSON.stringify(antes)} -> ${JSON.stringify(despues)}`);
await foto("2-chat-pantalla");

// cerrar con la X devuelve el icono de mensaje
await js(`document.querySelector(".fab-msg").click(); true`);
await sleep(900);
const cerrado = await js(`({
  chat: Boolean(document.querySelector(".chatflotante")),
  icono: document.querySelector(".fab-msg svg")?.outerHTML.includes("M4 5h16v11H9") ? "chat" : "otro",
})`);
paso("al cerrar vuelve el icono de mensaje", !cerrado.chat && cerrado.icono === "chat", JSON.stringify(cerrado));
await foto("3-cerrado");

console.log(fallos ? `\n${fallos} paso(s) fallaron` : "\nTodo en verde");
process.exit(fallos ? 1 : 0);
