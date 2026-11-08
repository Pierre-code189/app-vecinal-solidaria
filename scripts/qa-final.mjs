// Verifica el registro de actividad, el tutorial nuevo y la lectura en voz alta.
// Uso: node scripts/qa-final.mjs <puerto> <carpeta> <url>
import fs from "node:fs";
const PORT = process.argv[2] || "9333";
const OUT = process.argv[3] || "./capturas/final";
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
const js = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.text; };
const go = async (u) => { await send("Page.navigate", { url: u }); await sleep(3200); };
const foto = async (n) => { const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(s.result.data, "base64")); };
fs.mkdirSync(OUT, { recursive: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
await go(BASE + "/?r=" + Date.now());
await js(`(async () => { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); return "ok"; })()`);
await js(`localStorage.setItem("vecinal-token", ${JSON.stringify(login.token)}); localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-zona-manual","1"); true`);

// --- registro de actividad ---
await go(BASE + "/?r=" + Date.now() + "#/actividad");
await sleep(2600);
const tab = await js(`document.querySelector('.segmented button[aria-selected="true"]')?.textContent || ""`);
paso("Mi actividad abre en el Registro", /Registro/i.test(tab), tab);
const ev = await js(`({ eventos: document.querySelectorAll(".evento").length, kpis: [...document.querySelectorAll(".registro-kpis b")].map(b => b.textContent), desborde: document.documentElement.scrollWidth - innerWidth })`);
paso("el registro lista los movimientos con sus totales", ev.eventos > 0 && ev.kpis.length === 3 && ev.desborde === 0, JSON.stringify(ev));
await foto("1-registro");

// --- tutorial ---
await js(`localStorage.removeItem("vecinal-tour"); true`);
await go(BASE + "/?r=" + Date.now() + "#/");
await sleep(3500);
const tour = await js(`({ abierto: Boolean(document.querySelector(".tour-card")), texto: (document.querySelector(".tour-card")?.innerText || "").slice(0, 90) })`);
paso("el tutorial se abre solo la primera vez", tour.abierto, tour.texto.replace(/\n/g, " · "));
const siguiente = await js(`(() => { const b = [...document.querySelectorAll("button")].find(x => /Siguiente|Empezar/i.test(x.textContent)); if (!b) return "NO"; b.click(); return "OK"; })()`);
await sleep(900);
const texto2 = await js(`document.querySelector(".tour-card")?.innerText || ""`);
paso("avanza al segundo paso (tu sector)",
  siguiente === "OK" && /sector/i.test(texto2), texto2.slice(0, 60).replace(/\n/g, " · "));
await foto("2-tutorial");

// --- lectura en voz alta ---
await js(`localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-voz","0"); true`);
await go(BASE + "/?r=" + Date.now() + "#/");
await sleep(2000);
await js(`(() => {
  window.__dichos = [];
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = (u) => { window.__dichos.push(u.text); };
    window.speechSynthesis.cancel = () => {};
  }
  return "ok";
})()`);
await js(`document.querySelector(".acces button").click(); true`);
await sleep(700);
const opcion = await js(`(() => { const b = [...document.querySelectorAll(".acces-menu button")].find(x => /voz alta/i.test(x.textContent)); if (!b) return "NO"; b.click(); return "OK"; })()`);
await sleep(500);
const guardado = await js(`localStorage.getItem("vecinal-voz")`);
paso("el menú de accesibilidad activa la lectura", opcion === "OK" && guardado === "1", `${opcion} voz=${guardado}`);
await js(`document.querySelector('.tabbar a[data-sec="favores"]').click(); true`);
await sleep(1200);
const dichos = await js(`window.__dichos`);
paso("al tocar un módulo lo anuncia en voz alta",
  Array.isArray(dichos) && dichos.some((d) => /Favor/i.test(d)), JSON.stringify(dichos));
await foto("3-voz");

console.log(fallos ? `\n${fallos} paso(s) fallaron` : "\nTodo en verde");
process.exit(fallos ? 1 : 0);
