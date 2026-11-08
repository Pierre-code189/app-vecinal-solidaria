// Flujo de trato completo con dos cuentas, todo por la interfaz (CDP, sin dependencias).
// Uso: node scripts/flujo-detalle.mjs <puerto_debug> <base_url> [comprobante.jpg]
// Cambia de cuenta inyectando el token en localStorage, así se prueban los botones reales
// de cada parte: cotizar → aceptar → confirmar → pagar con comprobante → cerrar → visto bueno.
import fs from "node:fs";

const PORT = process.argv[2] || "9333";
const BASE = process.argv[3] || "https://vecinal.apioai.online";
const COMPROBANTE = process.argv[4] || "";
const TEL_COMPRADOR = "999000002";  // Juan Quispe
const TEL_VENDEDOR = "999000003";   // Ana Morales
const PUB = "p13";                  // Cerrajería · S/ 40 · de Ana

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
const paso = (txt, ok, extra = "") => {
  if (!ok) fallos++;
  console.log(`${ok ? "OK  " : "FALLA"} ${txt}${extra ? "  · " + extra : ""}`);
};

async function conectar() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  const send = (method, params = {}) => {
    const mid = ++id;
    ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((res) => pend.set(mid, res));
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  const js = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text + " :: " + expr);
    return r.result?.result?.value;
  };
  const go = async (url) => { await send("Page.navigate", { url }); await sleep(3000); };
  return { send, js, go };
}

const api = async (ruta, cuerpo, token) => {
  const r = await fetch(BASE + ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => null) };
};

const loginPin = async (tel) => {
  const r = await api("/api/login_pin", { telefono: tel, pin: "123456" });
  if (!r.data?.token) throw new Error("login falló para " + tel + ": " + JSON.stringify(r));
  return r.data.token;
};

const main = async () => {
  const { send, js, go } = await conectar();

  const clickTexto = (texto, sel = "button,a,label,article") =>
    js(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(
        (e) => e.getClientRects().length > 0 && e.textContent.replace(/\\s+/g, " ").includes(${JSON.stringify(texto)}));
      if (!el) return "NO";
      el.click(); return "OK";
    })()`);

  const escribir = (sel, texto) =>
    js(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return "NO";
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(texto)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return "OK";
    })()`);


  const clickEnFila = (textoFila, boton) =>
    js(`(() => {
      const fila = [...document.querySelectorAll(".fila")].find((f) => f.textContent.includes(${JSON.stringify(textoFila)}));
      if (!fila) return "NO-FILA[" + document.querySelectorAll(".fila").length + "]";
      const el = [...fila.querySelectorAll("button,a,label")].find((e) => e.textContent.trim().includes(${JSON.stringify(boton)}));
      if (!el) return "NO-BOTON[" + [...fila.querySelectorAll("button,a,label")].map((x) => x.textContent.trim()).join(",") + "][" + fila.className + "]";
      el.click(); return "OK";
    })()`);

  const abrirTab = async (nombre) => {
    for (let k = 0; k < 5; k++) {
      const sel = await js(`document.querySelector('.segmented button[aria-selected="true"]')?.textContent || ""`);
      if (sel.includes(nombre)) { await sleep(900); return "OK"; }
      await clickTexto(nombre, ".segmented button");
      await sleep(1300);
    }
    return "NO";
  };

  const esperarFila = async (texto) => {
    for (let k = 0; k < 8; k++) {
      const hay = await js(`[...document.querySelectorAll(".fila")].some(f => f.textContent.includes(${JSON.stringify(texto)}))`);
      if (hay) return "OK";
      await sleep(700);
    }
    return "NO";
  };
  const ir = async (hash) => {
    await go(BASE + "/?r=" + Date.now() + "#" + hash);
    await sleep(1200);
  };

  const sesion = async (token, hash = "/") => {
    await go(BASE + "/?r=" + Date.now());
    await js(`localStorage.setItem("vecinal-token", ${JSON.stringify(token)}); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-tour","1"); true`);
    await ir(hash);
  };

  const abrirDetalle = async (titulo) => {
    await ir("/");
    const r = await clickTexto(titulo, "article.card, article.pub");
    await sleep(2200);
    return r;
  };

  const tokComprador = await loginPin(TEL_COMPRADOR);
  const tokVendedor = await loginPin(TEL_VENDEDOR);
  paso("dos cuentas entran con teléfono y PIN", Boolean(tokComprador && tokVendedor));

  // ---------- 1. comprador pide cotización desde el detalle ----------
  await sesion(tokComprador);
  let r = await abrirDetalle("apertura sin daño");
  paso("detalle de servicio abre desde la tarjeta", r === "OK", r);
  const titulo = await js(`document.querySelector(".det2-titulo")?.textContent || ""`);
  paso("el detalle muestra la ficha del servicio", titulo.includes("apertura sin daño"), titulo);
  const hechos = await js(`[...document.querySelectorAll(".hechos>div>span")].map(e=>e.textContent).join(" | ")`);
  paso("hechos: precio, pago, vistos (sin estado de favor)", /Precio/.test(hechos) && !/Estado/.test(hechos), hechos);
  const cta = await js(`(() => {
    const fila = document.querySelector(".det2-cta"); if (!fila) return "sin cta";
    const [a, b] = [...fila.children].map((e) => Math.round((e.getBoundingClientRect().width / fila.getBoundingClientRect().width) * 100));
    return a + "/" + b;
  })()`);
  paso("CTA 67/33 con WhatsApp", /^6[4-9]\/3[0-3]$/.test(String(cta)) && (await js(`document.querySelector(".det2-cta")?.innerText.includes("WhatsApp")`)), cta);

  r = await clickTexto("Pedir cotización");
  paso("pulsa «Pedir cotización»", r === "OK", r);
  await sleep(900);
  await escribir("#c-desc", "Necesito cambio de chapa en la puerta principal, para hoy.");
  await sleep(300);
  r = await clickTexto("Enviar cotización");
  paso("envía la cotización", r === "OK", r);
  await sleep(3000);

  // ---------- 2. vendedor responde ----------
  await sesion(tokVendedor, "/actividad");
  r = await abrirTab("Cotizaciones");
  paso("vendedor abre Cotizaciones", r === "OK", r);
  r = await esperarFila("apertura sin daño");
  paso("la cotización aparece en la lista del vendedor", r === "OK", r);
  r = await clickEnFila("apertura sin daño", "Responder");
  paso("pulsa «Responder» en la cotización", r === "OK", r);
  await sleep(800);
  r = await clickTexto("Sí puedo", ".pill");
  paso("elige «Sí puedo»", r === "OK", r);
  await escribir("#rr-n", "Puedo ir a las 5 de la tarde.");
  await sleep(300);
  r = await clickEnFila("apertura sin daño", "Enviar respuesta");
  paso("envía la respuesta", r === "OK", r);
  await sleep(2500);

  // ---------- 3. comprador acepta y abre el trato ----------
  await sesion(tokComprador);
  await abrirDetalle("apertura sin daño");
  r = await clickTexto("Aceptar y abrir trato");
  paso("aparece «Aceptar y abrir trato»", r === "OK", r);
  await sleep(900);
  await escribir("#a-monto", "S/ 40");
  await sleep(300);
  r = await clickTexto("Aceptar y abrir trato");
  paso("confirma el trato", r === "OK", r);
  await sleep(2800);
  await abrirDetalle("apertura sin daño");
  const espera = await js(`document.querySelector(".modalbox")?.innerText.includes("Esperando que el vecino confirme") || false`);
  paso("el comprador ve el trato pendiente de confirmación", espera);

  // ---------- 4. vendedor confirma ----------
  await sesion(tokVendedor, "/actividad");
  r = await abrirTab("Tratos");
  paso("vendedor abre Tratos", r === "OK", r);
  r = await esperarFila("apertura sin daño");
  paso("el trato aparece en la lista del vendedor", r === "OK", r);
  r = await clickEnFila("apertura sin daño", "Confirmar trato");
  paso("vendedor confirma el trato", r === "OK", r);
  await sleep(2500);

  // ---------- 5. comprador marca el pago desde el detalle ----------
  await sesion(tokComprador);
  await abrirDetalle("apertura sin daño");
  r = await clickTexto("Marcar que pagué");
  paso("el botón cambia a «Marcar que pagué»", r === "OK", r);
  await sleep(2800);

  // ---------- 6. vendedor adjunta comprobante y confirma el cobro ----------
  await sesion(tokVendedor, "/actividad");
  await abrirTab("Tratos");
  await esperarFila("apertura sin daño");
  if (COMPROBANTE) {
    const doc = await send("DOM.getDocument", { depth: -1 });
    const nodos = await send("DOM.querySelectorAll", { nodeId: doc.result.root.nodeId, selector: "input[type=file]" });
    const nodeId = nodos.result?.nodeIds?.[0];
    if (nodeId) {
      await send("DOM.setFileInputFiles", { files: [COMPROBANTE], nodeId });
      await sleep(3500);
      const conFoto = await js(`Boolean(document.querySelector(".comprobante img"))`);
      paso("comprobante del pago adjuntado y visible", conFoto);
    } else {
      paso("comprobante del pago adjuntado y visible", false, "sin input de archivo");
    }
  }
  r = await clickEnFila("apertura sin daño", "Confirmar que recibí el pago");
  paso("vendedor confirma que recibió el pago", r === "OK", r);
  await sleep(2800);
  r = await clickEnFila("apertura sin daño", "Marcar que entregué");
  paso("vendedor marca que entregó", r === "OK", r);
  await sleep(2500);

  // ---------- 7. comprador cierra y da el visto bueno ----------
  await sesion(tokComprador);
  await abrirDetalle("apertura sin daño");
  r = await clickTexto("Marcar servicio cumplido");
  paso("comprador marca el servicio cumplido", r === "OK", r);
  await sleep(2800);
  await abrirDetalle("apertura sin daño");
  r = await clickTexto("Dar visto bueno");
  paso("aparece «Dar visto bueno»", r === "OK", r);
  await sleep(800);
  await escribir("#v-nota", "Rápido y prolijo, dejó todo limpio.");
  await sleep(300);
  r = await clickTexto("Dar visto bueno");
  paso("envía el visto bueno", r === "OK", r);
  await sleep(2800);

  // ---------- 8. comprobación por API ----------
  const det = await (await fetch(`${BASE}/api/publicaciones/${PUB}`, { headers: { Authorization: `Bearer ${tokComprador}` } })).json();
  paso("el trato queda cerrado", det.mi_trato?.estado === "cerrado", JSON.stringify(det.mi_trato?.estado));
  paso("el trato guarda el comprobante", Boolean(det.mi_trato?.comprobante));
  paso("el visto bueno queda registrado", det.ya_recomende === true || (det.vistos || 0) >= 1, `vistos=${det.vistos}`);

  console.log(fallos ? `\n${fallos} paso(s) fallaron` : "\nFlujo completo en verde");
  process.exit(fallos ? 1 : 0);
};

main().catch((e) => { console.error("ERROR:", e.message); process.exit(2); });
