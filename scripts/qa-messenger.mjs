// Prueba del messenger flotante: abre sin cambiar de ruta, lista los chats que
// vienen de una publicación, y el botón se arrastra libre con rebote a límites.
// Uso: node scripts/qa-messenger.mjs <puerto> <carpeta> <url>
import fs from "node:fs";

const PORT = process.argv[2] || "9333";
const OUT = process.argv[3] || "./capturas/messenger";
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

const caja = `(() => { const r = document.querySelector(".fab-msg").getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight }; })()`;
const c0 = await js(caja);
paso("el botón nace dentro de la pantalla y sobre la barra inferior",
  c0.l >= 0 && c0.t >= 72 && c0.t + c0.h <= c0.vh - 64, JSON.stringify(c0));

// abrir el chat flotante
await js(`document.querySelector(".fab-msg").click(); true`);
await sleep(1200);
const abierto = await js(`Boolean(document.querySelector(".chatflotante"))`);
const ruta = await js(`location.hash`);
paso("abre una ventana flotante sin cambiar de pantalla", abierto && !ruta.includes("mensajes"), `abierto=${abierto} ruta=${ruta}`);
const chats = await js(`document.querySelectorAll(".chatflotante .conv").length`);
paso("muestra solo conversaciones nacidas de una publicación", chats > 0, `chats=${chats}`);
const sinBuscador = await js(`!document.querySelector(".chatflotante input[type=search], .chatflotante .chat-form")`);
paso("sin buscador ni chats nuevos en la bandeja", sinBuscador);
await foto("1-bandeja");

// abrir un hilo
await js(`document.querySelector(".chatflotante .conv")?.click(); true`);
await sleep(2000);
const hilo = await js(`document.querySelector(".chatflotante-quien")?.innerText.replace(/\\n/g, " · ") || ""`);
const burbujas = await js(`document.querySelectorAll(".chatflotante .burbuja").length`);
paso("el hilo muestra vecino y publicación", /·/.test(hilo), hilo);
paso("el hilo carga los mensajes", burbujas >= 1, `burbujas=${burbujas}`);
await foto("2-hilo");

// arrastrar el botón al centro: debe volver a un borde
const antes = await js(caja);
await js(`(() => {
  const el = document.querySelector(".fab-msg");
  const r = el.getBoundingClientRect();
  const opts = (x, y) => ({ bubbles: true, pointerId: 1, clientX: x, clientY: y });
  el.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 10, r.top + 10)));
  el.dispatchEvent(new PointerEvent("pointermove", opts(195, 420)));
  el.dispatchEvent(new PointerEvent("pointerup", opts(195, 420)));
  return "ok";
})()`);
await sleep(700);
const centro = await js(caja);
const cx = (centro.l + 27) / centro.vw;
paso("al soltarlo en el centro se va al borde más cercano",
  cx <= 0.2 || cx >= 0.8, `centro x=${cx.toFixed(2)}`);

// arrastrar fuera por arriba: debe rebotar dentro
await js(`(() => {
  const el = document.querySelector(".fab-msg");
  const r = el.getBoundingClientRect();
  const opts = (x, y) => ({ bubbles: true, pointerId: 1, clientX: x, clientY: y });
  el.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 10, r.top + 10)));
  el.dispatchEvent(new PointerEvent("pointermove", opts(r.left, -400)));
  el.dispatchEvent(new PointerEvent("pointerup", opts(r.left, -400)));
  return "ok";
})()`);
await sleep(700);
const arriba = await js(caja);
paso("si lo sacan por arriba, rebota debajo de la cabecera", arriba.t >= 72, `t=${arriba.t}`);

// arrastrar abajo: no entra en la barra inferior
await js(`(() => {
  const el = document.querySelector(".fab-msg");
  const r = el.getBoundingClientRect();
  const opts = (x, y) => ({ bubbles: true, pointerId: 1, clientX: x, clientY: y });
  el.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 10, r.top + 10)));
  el.dispatchEvent(new PointerEvent("pointermove", opts(r.left + 10, 2000)));
  el.dispatchEvent(new PointerEvent("pointerup", opts(r.left + 10, 2000)));
  return "ok";
})()`);
await sleep(700);
const abajo = await js(caja);
paso("si lo sacan por abajo, se queda sobre la barra", abajo.t + abajo.h <= abajo.vh - 64, `borde=${abajo.t + abajo.h} vh=${abajo.vh}`);

// la ventana arrastrable tampoco debe tapar la cabecera
const cw = await js(`(() => { const r = document.querySelector(".chatflotante").getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, desborde: document.documentElement.scrollWidth - innerWidth }; })()`);
paso("la ventana ocupa la pantalla sin desbordar",
  cw.l <= 10 && cw.t <= 10 && cw.l + cw.w <= cw.vw + 1 && cw.t + cw.h >= cw.vh - 10 && cw.desborde === 0, JSON.stringify(cw));
await foto("3-final");

console.log(fallos ? `\n${fallos} paso(s) fallaron` : "\nTodo en verde");
process.exit(fallos ? 1 : 0);
