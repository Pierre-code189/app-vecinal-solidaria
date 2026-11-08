// Capturas de la rejilla de tarjetas (Local y Favores) en móvil y escritorio.
// Uso: node scripts/capturas-tarjetas.mjs <puerto_debug> <carpeta_salida> <base_url>
import fs from "node:fs";

const PORT = process.argv[2] || "9333";
const OUT = process.argv[3] || "./capturas/tarjetas";
const BASE = process.argv[4] || "https://vecinal.apioai.online";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const send = (m, p = {}) => { const mid = ++id; ws.send(JSON.stringify({ id: mid, method: m, params: p })); return new Promise((res) => pend.set(mid, res)); };
await send("Page.enable"); await send("Runtime.enable");
const js = async (e) => {
  const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value ?? r.result?.exceptionDetails?.text;
};
const metricas = (w, h) => send("Emulation.setDeviceMetricsOverride", {
  width: w, height: h, deviceScaleFactor: 2, mobile: w < 720, screenWidth: w, screenHeight: h,
});
const go = async (url) => { await send("Page.navigate", { url }); await sleep(3400); };

fs.mkdirSync(OUT, { recursive: true });
await metricas(390, 844);
await go(BASE + "/?r=" + Date.now());
await js(`localStorage.setItem("vecinal-token", ${JSON.stringify(login.token)}); localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-zona-manual","1"); true`);

for (const [i, caso] of [{ k: "local", ruta: "/" }, { k: "favores", ruta: "/favores" }].entries()) {
  for (const vp of [{ k: "movil", w: 390, h: 844 }, { k: "escritorio", w: 1280, h: 900 }]) {
    await metricas(vp.w, vp.h);
    await go(`${BASE}/?r=${Date.now()}#${caso.ruta}`);
    await sleep(1500);
    const datos = await js(`(() => {
      const cards = [...document.querySelectorAll(".pub")];
      const altos = [...new Set(cards.slice(0, 6).map((c) => Math.round(c.getBoundingClientRect().height)))];
      const anchos = [...new Set(cards.slice(0, 6).map((c) => Math.round(c.getBoundingClientRect().width)))];
      const ult = cards[cards.length - 1]?.getBoundingClientRect();
      return {
        tarjetas: cards.length, altos, anchos,
        foto: cards.filter((c) => c.querySelector(".pub-foto img")).length,
        aval: cards.filter((c) => c.querySelector(".pub-aval")).length,
        bordeDerecho: Math.round(ult?.right || 0),
        desborde: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const archivo = `${OUT}/${i + 1}-${caso.k}-${vp.k}.png`;
    fs.writeFileSync(archivo, Buffer.from(shot.result.data, "base64"));
    console.log(JSON.stringify({ vista: vp.k, ...datos, archivo }));
  }
}
console.log("LISTO");
process.exit(0);
