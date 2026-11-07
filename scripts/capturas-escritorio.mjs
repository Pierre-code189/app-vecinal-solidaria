// Capturas de escritorio vía CDP. Uso: node scripts/capturas-escritorio.mjs <puerto> <carpeta> <base>
import fs from "node:fs";

const PORT = process.argv[2] || "9333";
const OUT = process.argv[3] || "./capturas/v3";
const BASE = process.argv[4] || "https://vecinal.apioai.online";

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
};
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((r) => pend.set(i, r));
};
const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, "base64"));
  console.log("captura:", name);
};

fs.mkdirSync(OUT, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${BASE}/?v=esc` });
await sleep(4000);
await js("(() => { const m=document.querySelector('#locmodal'); if(m && !m.hidden) document.querySelector('#btn-loc-ok').click(); })()");
await sleep(1000);
await shot("e1-lista");

// Entrar como moderadora (María) para ver la sección de moderación
await js(`(() => {
  const set=(s,v)=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input'));};
  ir('perfil'); set('#l-email','mod@app.local'); set('#l-pass','mod123');
  document.querySelector('#form-login').requestSubmit(); return 1;
})()`);
await sleep(3000);
console.log("moderadora:", await js("document.querySelector('#userbox').innerText.trim()"));
await js("ir('moderacion')"); await sleep(2500);
await shot("e2-moderacion");
await js("ir('mias')"); await sleep(2000);
await shot("e3-mis-cosas");
await js("ir('local'); verDetalle('p1')"); await sleep(3500);
await shot("e4-detalle");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
await js("cerrarModal(); ir('emergencia')"); await sleep(2000);
await shot("m12-emergencia-directorio");
process.exit(0);
