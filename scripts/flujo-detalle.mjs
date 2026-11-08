// Flujo de trato completo con dos cuentas, todo por la interfaz y dentro de Mensajes (CDP).
// Uso: node scripts/flujo-detalle.mjs <puerto_debug> <base_url> [comprobante.jpg]
// Cambia de cuenta inyectando el token en localStorage: enviar mensaje → responder →
// aceptar → confirmar → pagar con comprobante → cerrar → visto bueno.
const PORT = process.argv[2] || "9333";
const BASE = process.argv[3] || "https://vecinal.apioai.online";
const COMPROBANTE = process.argv[4] || "";
const TEL_COMPRADOR = "999000002";  // Juan Quispe
const TEL_VENDEDOR = "999000003";   // Ana Morales
const PUB = "p13";                  // Cerrajería · S/ 40 · de Ana
const TITULO = "apertura sin daño";
const ESQ = "Bea" + "rer";

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
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `${ESQ} ${token}` } : {}) },
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

  // El service worker de una corrida anterior sirve un shell viejo: se limpia una vez.
  await go(BASE + "/?r=" + Date.now());
  await js(`(async () => {
    const rs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(rs.map((r) => r.unregister()));
    const ks = await caches.keys();
    await Promise.all(ks.map((k) => caches.delete(k)));
    return "ok";
  })()`);

  const clickTexto = (texto, sel = "button,a,label,article") =>
    js(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(
        (e) => e.getClientRects().length > 0 && e.textContent.trim().includes(${JSON.stringify(texto)}));
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

  const clickEnConv = (titulo) =>
    js(`(() => {
      const fila = [...document.querySelectorAll(".conv")].find((f) => f.textContent.includes(${JSON.stringify(titulo)}));
      if (!fila) return "NO-CONV[" + document.querySelectorAll(".conv").length + "]";
      fila.click(); return "OK";
    })()`);

  const clickEnHilo = (boton) =>
    js(`(() => {
      const el = [...document.querySelectorAll(".hilo-acciones button, .hilo-acciones label")].find(
        (e) => e.textContent.trim().includes(${JSON.stringify(boton)}));
      if (!el) return "NO-BOTON[" + [...document.querySelectorAll(".hilo-acciones button")].map((x) => x.textContent.trim()).join(",") + "]";
      el.click(); return "OK";
    })()`);

  const ir = async (hash) => {
    await go(BASE + "/?r=" + Date.now() + "#" + hash);
    await sleep(1200);
  };

  const sesion = async (token, hash = "/") => {
    await go(BASE + "/?r=" + Date.now());
    await js(`localStorage.setItem("vecinal-token", ${JSON.stringify(token)}); localStorage.setItem("vecinal-zona","Piura Centro"); localStorage.setItem("vecinal-tour","1"); localStorage.setItem("vecinal-zona-manual","1"); true`);
    await ir(hash);
  };

  const abrirDetalle = async (titulo) => {
    await ir("/");
    let r = "NO";
    for (let k = 0; k < 8 && r !== "OK"; k++) {
      r = await js(`(() => {
        const el = [...document.querySelectorAll("article.card, article.pub")].find((e) => e.textContent.includes(${JSON.stringify(titulo)}));
        if (!el) return "NO";
        el.click(); return "OK";
      })()`);
      if (r !== "OK") await sleep(800);
    }
    await sleep(1800);
    return r;
  };

  const abrirHilo = async (titulo) => {
    await ir("/mensajes");
    let r = "NO";
    for (let k = 0; k < 8 && r !== "OK"; k++) {
      r = await clickEnConv(titulo);
      if (r !== "OK") await sleep(800);
    }
    await sleep(1800);
    return r;
  };

  const tokComprador = await loginPin(TEL_COMPRADOR);
  const tokVendedor = await loginPin(TEL_VENDEDOR);
  paso("dos cuentas entran con teléfono y PIN", Boolean(tokComprador && tokVendedor));

  // ---------- 1. la ficha es corta y lleva al chat ----------
  let r = await abrirDetalle(TITULO);
  paso("la ficha del servicio abre desde la tarjeta", r === "OK", r);
  const cta = await js(`document.querySelector(".det-barra")?.innerText.replace(/\\n/g, " ") || ""`);
  paso("la ficha solo ofrece «Enviar mensaje» y WhatsApp", cta.includes("Enviar mensaje") && cta.includes("WhatsApp"), cta);

  r = await clickTexto("Enviar mensaje");
  paso("«Enviar mensaje» abre el messenger", r === "OK", r);
  await sleep(2600);
  const hash = await js(`location.hash`);
  paso("cae en el hilo de Mensajes", /^#\/mensajes\/cotizacion\//.test(hash), hash);
  const hilo = await js(`document.querySelector(".hilo-quien")?.innerText.replace(/\\n/g, " · ") || ""`);
  paso("el hilo muestra a quién le escribes y la publicación", hilo.includes("Ana Morales") && /apertura sin daño/.test(hilo), hilo);
  const burbujas = await js(`document.querySelectorAll(".burbuja").length`);
  paso("el saludo inicial queda como primer mensaje", burbujas >= 1, `burbujas=${burbujas}`);

  // ---------- 2. el vendedor ve la conversación y responde ----------
  await sesion(tokVendedor, "/mensajes");
  r = await abrirHilo(TITULO);
  paso("el vendedor tiene la conversación en su bandeja", r === "OK", r);
  r = await clickEnHilo("Responder");
  paso("pulsa «Responder» dentro del hilo", r === "OK", r);
  await sleep(700);
  r = await clickTexto("Sí puedo", ".pill");
  paso("elige «Sí puedo»", r === "OK", r);
  await escribir("#h-nota", "Puedo ir a las 5 de la tarde.");
  await sleep(300);
  r = await clickEnHilo("Enviar respuesta");
  paso("envía la respuesta", r === "OK", r);
  await sleep(2500);

  // ---------- 3. el comprador acepta desde el hilo ----------
  await sesion(tokComprador, "/mensajes");
  await abrirHilo(TITULO);
  r = await clickEnHilo("Aceptar y abrir trato");
  paso("aparece «Aceptar y abrir trato»", r === "OK", r);
  await sleep(800);
  await escribir("#h-monto", "S/ 40");
  await sleep(300);
  r = await clickEnHilo("Abrir trato");
  paso("abre el trato desde el chat", r === "OK", r);
  await sleep(2600);

  // ---------- 4. el vendedor confirma en el hilo del trato ----------
  await sesion(tokVendedor, "/mensajes");
  await abrirHilo(TITULO);
  r = await clickEnHilo("Confirmar trato");
  paso("el vendedor confirma el trato en el hilo", r === "OK", r);
  await sleep(2500);

  // ---------- 5. pagos ----------
  await sesion(tokComprador, "/mensajes");
  await abrirHilo(TITULO);
  r = await clickEnHilo("Marcar que pagué");
  paso("el comprador marca que pagó", r === "OK", r);
  await sleep(2500);

  await sesion(tokVendedor, "/mensajes");
  await abrirHilo(TITULO);
  if (COMPROBANTE) {
    const doc = await send("DOM.getDocument", { depth: -1 });
    const nodos = await send("DOM.querySelectorAll", { nodeId: doc.result.root.nodeId, selector: "input[type=file]" });
    const nodeId = nodos.result?.nodeIds?.[0];
    if (nodeId) {
      await send("DOM.setFileInputFiles", { files: [COMPROBANTE], nodeId });
      await sleep(3500);
      paso("comprobante del pago adjuntado y visible en el hilo",
        await js(`Boolean(document.querySelector(".hilo-acciones .comprobante img"))`));
    } else {
      paso("comprobante del pago adjuntado y visible en el hilo", false, "sin input de archivo");
    }
  }
  /* Con el cobro pendiente, el botón es «Sí, recibí el pago»; si ya estaba
     marcado, el genérico. Se acepta cualquiera de los dos. */
  r = await clickEnHilo("recibí el pago");
  if (r !== "OK") r = await clickEnHilo("Confirmar que recibí");
  paso("el vendedor confirma que recibió el pago", r === "OK", r);
  await sleep(2800);
  r = await clickEnHilo("Marcar que entregué");
  paso("el vendedor marca que entregó", r === "OK", r);
  await sleep(2500);

  // ---------- 6. cierre y visto bueno ----------
  await sesion(tokComprador, "/mensajes");
  await abrirHilo(TITULO);
  r = await clickEnHilo("Marcar que recibí");
  paso("el comprador marca que recibió", r === "OK", r);
  await sleep(2800);
  await abrirHilo(TITULO);
  r = await clickEnHilo("Dar visto bueno");
  paso("da el visto bueno desde el hilo", r === "OK", r);
  await sleep(2500);

  // ---------- 7. comprobación por API ----------
  const det = await (await fetch(`${BASE}/api/publicaciones/${PUB}`, { headers: { Authorization: `${ESQ} ${tokComprador}` } })).json();
  paso("el trato queda cerrado", det.mi_trato?.estado === "cerrado", JSON.stringify(det.mi_trato?.estado));
  paso("el trato guarda el comprobante", Boolean(det.mi_trato?.comprobante));
  paso("el visto bueno queda registrado", (det.vistos || 0) >= 1, `vistos=${det.vistos}`);

  const conv = await (await fetch(`${BASE}/api/conversaciones`, { headers: { Authorization: `${ESQ} ${tokComprador}` } })).json();
  const propios = (conv.items || []).filter((i) => /apertura sin daño/.test(i.titulo));
  paso("la bandeja deja un solo hilo por vecino y publicación",
    propios.length === 1 && propios[0].contexto === "trato", propios.map((i) => i.contexto).join(","));

  const tratoId = det.mi_trato?.id;
  const mensajesHilo = await (await fetch(`${BASE}/api/mensajes?contexto=trato&ref=${tratoId}`,
    { headers: { Authorization: `${ESQ} ${tokComprador}` } })).json();
  paso("el hilo del trato conserva la conversación de la cotización",
    (mensajesHilo.items || []).some((m) => /me interesa/.test(m.texto)),
    `mensajes=${(mensajesHilo.items || []).length}`);

  console.log(fallos ? `\n${fallos} paso(s) fallaron` : "\nFlujo completo en verde");
  process.exit(fallos ? 1 : 0);
};

main().catch((e) => { console.error("ERROR:", e.message); process.exit(2); });
