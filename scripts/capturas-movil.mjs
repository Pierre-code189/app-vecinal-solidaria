// Capturas móviles reales vía CDP (sin dependencias).
// Uso: node scripts/capturas-movil.mjs <puerto_debug> <carpeta_salida> <base_url>
import fs from "node:fs";

const PORT = process.argv[2] || "9333";
const OUT = process.argv[3] || "./capturas/v3";
const BASE = process.argv[4] || "https://vecinal.apioai.online";

async function targets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return r.json();
}

function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.onopen = () => res(ws);
    ws.onerror = rej;
  });
}

let id = 0;
const pending = new Map();
function send(ws, method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((res) => pending.set(msgId, res));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const list = await targets();
  const page = list.find((t) => t.type === "page");
  const ws = await connect(page.webSocketDebuggerUrl);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: false,
    screenWidth: 390, screenHeight: 844,
  });
  await send(ws, "Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

  const js = async (expr) => {
    const r = await send(ws, "Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    return r?.result?.value;
  };
  const go = async (path) => {
    await send(ws, "Page.navigate", { url: BASE + path });
    await sleep(3500);
  };
  const shot = async (name) => {
    const r = await send(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, "base64"));
    console.log("captura:", name);
  };

  fs.mkdirSync(OUT, { recursive: true });
  await go("/?v=movil");
  await sleep(1200);
  // Cerrar el modal de sector y entrar como vecina
  await js("(() => { const m=document.querySelector('#locmodal'); if (m && !m.hidden) document.querySelector('#btn-loc-ok').click(); })()");
  await sleep(800);
  console.log("ancho:", await js("window.innerWidth"), "| nav:", await js("getComputedStyle(document.querySelector('.bottom-nav')).display"));
  await shot("m1-lista");

  // Login
  await js("ir('perfil')"); await sleep(600);
  await js(`(() => {
    const set=(s,v)=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input'));};
    set('#l-email','rosa.quiroz@demo.local'); set('#l-pass','vecina2026');
    document.querySelector('#form-login').requestSubmit(); return 1;
  })()`);
  await sleep(2500);
  console.log("logueada:", await js("!!document.querySelector('#perfil-edit') && !document.querySelector('#perfil-edit').hidden"));
  await shot("m2-perfil");

  // Avisos
  await js("document.querySelector('#btn-campana').click()"); await sleep(1200);
  await shot("m3-avisos");
  await js("document.querySelector('#panel-avisos').hidden=true");

  // Detalle de un servicio ajeno con pago
  await js("ir('local'); verDetalle('p1')"); await sleep(3000);
  await js("document.querySelector('#modalbox-scroll') ? 0 : window.scrollTo(0,0)");
  await shot("m4-detalle");
  await js("(() => { const b=document.querySelector('.modalbox'); b.scrollTop = b.scrollHeight*0.52; })()"); await sleep(900);
  await shot("m5-detalle-pago-mapa");
  await js("cerrarModal()"); await sleep(600);

  // Favores
  await js("ir('favores')"); await sleep(1500);
  await shot("m6-favores");

  // Emergencia
  await js("ir('emergencia')"); await sleep(1800);
  await shot("m7-emergencia");

  // Mis cosas
  await js("ir('mias')"); await sleep(1800);
  await shot("m8-mis-cosas");

  // Tutorial en quechua
  await js("ir('tutorial'); document.querySelector('#btn-idioma-qu').click()"); await sleep(700);
  await shot("m9-tutorial-quechua");

  // Formulario de publicar, paso 1 y 2
  await js("abrirPublicar()"); await sleep(900);
  await shot("m10-publicar-1");
  await js("document.querySelector('[data-next=\"2\"]').click()"); await sleep(600);
  await shot("m11-publicar-2");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
