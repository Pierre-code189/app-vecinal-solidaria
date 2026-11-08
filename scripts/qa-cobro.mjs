// Regla del cobro pendiente: el vendedor no puede confirmar otros tratos hasta
// responder "¿Se abonó?". Crea sus propias publicaciones para no depender de datos.
// Uso: node scripts/qa-cobro.mjs <puerto> <url>
const PORT = process.argv[2] || "9333";
const BASE = process.argv[3] || "https://vecinal.apioai.online";
const ESQ = "Bea" + "rer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
const paso = (t, ok, extra = "") => { if (!ok) fallos++; console.log(`${ok ? "OK  " : "FALLA"} ${t}${extra ? "  · " + extra : ""}`); };

const login = async (tel) => (await (await fetch(BASE + "/api/login_pin", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ telefono: tel, pin: "123456" }),
})).json()).token;

const comprador = await login("999000002");
const vendedor = await login("999000003");

const post = async (ruta, cuerpo, token) => {
  const r = await fetch(BASE + ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `${ESQ} ${token}` },
    body: JSON.stringify(cuerpo || {}),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
};

const publicar = async (titulo) => {
  const r = await post("/api/publicaciones", {
    tipo: "servicio", categoria: "gasfitería", titulo, precio: "S/ 40.00",
    descripcion: "Publicación temporal para probar la regla del cobro pendiente.",
    medios_pago: "yape,efectivo", politica_pago: "contra_entrega", zona: "Piura Centro",
    mostrar_contacto: true, whatsapp: true, telefono_whatsapp: "999000003",
    client_id: `qa-cobro-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
  }, vendedor);
  if (!r.data?.id) throw new Error("no se creó la publicación: " + JSON.stringify(r));
  return r.data.id;
};

const abrirTrato = async (pub) => {
  const c = await post("/api/cotizaciones", { publicacion_id: pub, descripcion: "Prueba de cobro pendiente entre vecinos.", medida: "", urgencia: "normal" }, comprador);
  if (!c.data?.id) throw new Error("no se creó la cotización: " + JSON.stringify(c));
  await post(`/api/cotizaciones/${c.data.id}/responder`, { respuesta: "puedo", precio: "", nota: "" }, vendedor);
  const a = await post(`/api/cotizaciones/${c.data.id}/aceptar`, { monto: "S/ 40", politica: "contra_entrega" }, comprador);
  return a.data?.trato_id;
};

const marca = Date.now().toString().slice(-5);
const pubA = await publicar(`QA cobro A ${marca}`);
const pubB = await publicar(`QA cobro B ${marca}`);

const t1 = await abrirTrato(pubA);
paso("trato 1 abierto en su propia publicación", Boolean(t1), t1);
paso("el vendedor confirma el trato 1", (await post(`/api/tratos/${t1}/confirmar`, {}, vendedor)).status === 200);
paso("el comprador marca que pagó", (await post(`/api/tratos/${t1}/pago`, {}, comprador)).status === 200);

const t2 = await abrirTrato(pubB);
paso("trato 2 abierto", Boolean(t2), t2);
const c2 = await post(`/api/tratos/${t2}/confirmar`, {}, vendedor);
paso("sin resolver el cobro, no puede confirmar otro trato",
  c2.status === 400 && /abon/i.test(JSON.stringify(c2.data)), `${c2.status} ${JSON.stringify(c2.data)}`);

// aviso dentro del chat
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}) => { const mid = ++id; ws.send(JSON.stringify({ id: mid, method: m, params: p })); return new Promise((r) => pend.set(mid, r)); };
await send("Page.enable"); await send("Runtime.enable");
const js = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.text; };
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
await send("Page.navigate", { url: BASE + "/?r=" + Date.now() });
await sleep(3000);
await js(`localStorage.setItem("vecinal-token", ${JSON.stringify(vendedor)}); localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-zona-manual","1"); true`);
await send("Page.navigate", { url: BASE + "/?r=" + Date.now() + "#/" });
await sleep(2600);
await js(`document.querySelector(".fab-msg").click(); true`);
await sleep(2200);
const aviso = await js(`document.querySelector(".aviso-cobro")?.innerText.replace(/\\n/g, " ") || ""`);
paso("el chat le avisa al vendedor del cobro pendiente", /cobro sin confirmar/i.test(aviso), aviso.slice(0, 80));
await js(`document.querySelector(".fab-msg").click(); true`);
await sleep(500);

// resolver y seguir
paso("el vendedor responde «sí, recibí el pago»", (await post(`/api/tratos/${t1}/pago`, {}, vendedor)).status === 200);
paso("con el cobro resuelto, el trato 2 se confirma", (await post(`/api/tratos/${t2}/confirmar`, {}, vendedor)).status === 200);

console.log(fallos ? `\n${fallos} paso(s) fallaron` : "\nTodo en verde");
process.exit(fallos ? 1 : 0);
