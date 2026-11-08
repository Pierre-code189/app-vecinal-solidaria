// Capturas de los tres detalles (servicio, favor, emergencia) en móvil y escritorio.
// Uso: node scripts/capturas-detalle.mjs <puerto_debug> <carpeta_salida> <base_url>
import fs from "node:fs";

const PORT = process.argv[2] || "9333";
const OUT = process.argv[3] || "./capturas/detalle";
const BASE = process.argv[4] || "https://vecinal.apioai.online";
const TEL = "999000003"; // Ana Morales: no es autora de las tres publicaciones elegidas
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASOS = [
  { nombre: "servicio", ruta: "/", titulo: "Gasfitero 24h" },
  { nombre: "favor", ruta: "/favores", titulo: "Ayuda para limpiar el techo" },
  { nombre: "emergencia", ruta: "/emergencia", titulo: "Comida caliente para 15 personas" },
];

const login = await (await fetch(BASE + "/api/login_pin", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ telefono: TEL, pin: "123456" }),
})).json();
if (!login.token) throw new Error("sin token: " + JSON.stringify(login));

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

const go = async (url) => { await send("Page.navigate", { url }); await sleep(3200); };

fs.mkdirSync(OUT, { recursive: true });
await metricas(390, 844);
await go(BASE + "/?r=" + Date.now());
await js(`localStorage.setItem("vecinal-token", ${JSON.stringify(login.token)}); localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-zona-manual","1"); true`);

for (const [i, caso] of CASOS.entries()) {
  for (const vp of [{ k: "movil", w: 390, h: 844 }, { k: "escritorio", w: 1280, h: 900 }]) {
    await metricas(vp.w, vp.h);
    await go(`${BASE}/?r=${Date.now()}#${caso.ruta}`);
    let ok = "NO";
    for (let k = 0; k < 8 && ok !== "OK"; k++) {
      ok = await js(`(() => {
        const el = [...document.querySelectorAll("article.card, article.pub")].find((e) => e.textContent.includes(${JSON.stringify(caso.titulo)}));
        if (!el) return "NO";
        el.click(); return "OK";
      })()`);
      if (ok !== "OK") await sleep(900);
    }
    await sleep(2600);
    const datos = await js(`(() => {
      const t = document.querySelector(".det2-titulo")?.textContent || "";
      const hechos = [...document.querySelectorAll(".hechos>div")].map((d) => d.querySelector("span").textContent + ": " + d.querySelector("b").textContent.trim());
      const cta = document.querySelector(".det2-cta");
      const ctaTxt = cta ? [...cta.children].map((e) => e.textContent.trim()).join(" | ") : "sin fila 67/33";
      const medidas = cta ? [...cta.children].map((e) => Math.round((e.getBoundingClientRect().width / cta.getBoundingClientRect().width) * 100)).join("/") : "";
      const btns = [...document.querySelectorAll(".det2-acciones button")].map((b) => b.textContent.trim());
      const desborde = document.documentElement.scrollWidth - window.innerWidth;
      return { titulo: t, hechos, ctaTxt, medidas, btns, desborde };
    })()`);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const ruta = `${OUT}/${i + 1}-${caso.nombre}-${vp.k}.png`;
    fs.writeFileSync(ruta, Buffer.from(shot.result.data, "base64"));
    console.log(JSON.stringify({ caso: caso.nombre, vista: vp.k, tarjeta: ok, archivo: ruta, ...datos }));
    // cerrar el detalle para la siguiente pasada
    await js(`document.querySelector(".modalbox .close")?.click(); true`);
  }
}

console.log("LISTO");
process.exit(0);
