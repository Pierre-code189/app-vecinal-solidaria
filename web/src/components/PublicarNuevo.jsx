import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon, CAT_ICON } from "../lib/icons";
import { Sheet, Btn, Field, Select, useToast } from "./ui";

const CATS = ["gasfitería", "carpintería", "electricidad", "cerrajería", "clases", "alimentos",
  "paseo de mascotas", "herramientas", "movilidad", "préstamo", "otros"];

const SUBTIPOS = [
  { value: "prestamo", label: "Préstamo de cosas" },
  { value: "ayuda_temporal", label: "Ayuda temporal" },
  { value: "donacion", label: "Donación de materiales" },
  { value: "intercambio_habilidades", label: "Intercambio de habilidades" },
  { value: "movilidad", label: "Movilidad solidaria" },
];

const PAGOS = [
  { value: "yape,efectivo", label: "Yape y efectivo" },
  { value: "yape", label: "Solo Yape" },
  { value: "plin,efectivo", label: "Plin y efectivo" },
  { value: "efectivo", label: "Solo efectivo" },
  { value: "transferencia,efectivo", label: "Transferencia y efectivo" },
  { value: "intercambio", label: "Intercambio (sin dinero)" },
];

const POLITICAS = [
  { value: "contra_entrega", label: "Contra entrega o al terminar" },
  { value: "mitad_mitad", label: "Mitad al empezar, mitad al terminar" },
  { value: "al_terminar", label: "Todo al terminar" },
];

const BORRADOR = "vecinal-borrador";

function comprimir(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("archivo-no-imagen"));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 900;
      let { width: w, height: h } = img;
      if (w >= h && w > max) { h = Math.round((h * max) / w); w = max; }
      else if (h > w && h > max) { w = Math.round((w * max) / h); h = max; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.62));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("formato")); };
    img.src = url;
  });
}

export default function PublicarNuevo({ open, inicial = "servicio", onClose, onPublicado }) {
  const { usuario } = useAuth();
  const { zona, zonas, usarGPS } = useZona();
  const toast = useToast();

  const [paso, setPaso] = useState(1);
  const [f, setF] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BORRADOR) || "null") || {}; } catch { return {}; }
  });
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [otroSector, setOtroSector] = useState(false);

  const tipo = f.tipo || inicial;
  const esFavor = tipo.startsWith("favor");
  const esMovilidad = esFavor && (f.subtipo || "prestamo") === "movilidad";

  const set = (k, v) => setF((prev) => {
    const next = { ...prev, [k]: v };
    localStorage.setItem(BORRADOR, JSON.stringify(next));
    return next;
  });

  useEffect(() => {
    if (!open) return;
    setPaso(1); setError("");
  }, [open]);

  const zonaActual = f.zona || zona;
  const zonaConocida = zonas.some((z) => z.nombre === zonaActual) || zonaActual === zona;

  const agregarFotos = async (files) => {
    const lista = Array.from(files || []).slice(0, 3 - fotos.length);
    for (let i = 0; i < lista.length; i++) {
      setSubiendo(`Subiendo foto ${i + 1} de ${lista.length}…`);
      try {
        const data = await comprimir(lista[i]);
        const r = await api.post("/api/fotos", { data });
        setFotos((prev) => [...prev, r.url]);
        setSubiendo("Foto lista.");
      } catch (e) {
        setSubiendo(e.message === "formato"
          ? "Ese archivo no se puede leer (prueba con JPG o PNG)."
          : e.message === "archivo-no-imagen" ? "Ese archivo no es una imagen." : "No pudimos subir la foto.");
      }
    }
  };

  const validar = () => {
    if ((f.titulo || "").trim().length < 3) return "El título necesita al menos 3 caracteres.";
    if ((f.descripcion || "").trim().length < 10) return "Cuenta un poco más en la descripción (10 caracteres).";
    if (!esFavor && !f.sinPrecio) {
      const n = Number(f.precioNum);
      if (!f.precioNum || isNaN(n) || n <= 0) return "Escribe un precio en soles o marca «A convenir».";
      if (n > 5000) return "El precio parece muy alto. Revisa el monto.";
    }
    if (esFavor && esMovilidad) {
      if (!(f.franja || "").trim()) return "Indica la franja horaria.";
      if (!(f.punto || "").trim()) return "Indica un punto de encuentro público.";
      if (!f.checklist) return "Confirma la lista de seguridad.";
    }
    if (!zonaConocida && !f.lat) return "Comparte tu ubicación para ubicar tu sector.";
    return "";
  };

  const publicar = async () => {
    const err = validar();
    if (err) { setPaso(2); setError(err); return; }
    setGuardando(true); setError("");
    try {
      const precio = esFavor ? (f.sinPrecio === false && f.precioNum ? `S/ ${Number(f.precioNum).toFixed(2)}` : "Gratis / intercambio")
        : (f.sinPrecio ? "A convenir" : `S/ ${Number(f.precioNum).toFixed(2)}`);
      await api.post("/api/publicaciones", {
        tipo,
        categoria: esFavor ? (f.categoria || "otros") : (f.categoria || "gasfitería"),
        subtipo_favor: esFavor ? (f.subtipo || "prestamo") : null,
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim(),
        precio,
        medios_pago: esFavor ? "intercambio" : (f.pagos || "yape,efectivo"),
        politica_pago: f.politica || "contra_entrega",
        zona: zonaActual,
        lat: f.lat || null,
        lng: f.lng || null,
        punto_encuentro: f.punto || "",
        franja_horaria: f.franja || "",
        checklist_ok: Boolean(f.checklist),
        es_emergencia: Boolean(f.emerg),
        mostrar_contacto: f.mostrar !== false,
        fotos,
        client_id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      });
      localStorage.removeItem(BORRADOR);
      setF({}); setFotos([]); setSubiendo("");
      toast("¡Publicado! Ya lo ven tus vecinos.");
      onClose?.(); onPublicado?.();
    } catch (e) {
      setError(e.message); toast(e.message, "err");
    } finally { setGuardando(false); }
  };

  if (!open) return null;

  if (!usuario) {
    return (
      <Sheet open onClose={onClose} titulo="Publicar" ancho={460}>
        <div className="gate">
          <div className="gate-icon"><Icon name="user" size="1.4em" /></div>
          <h3>Necesitas una cuenta</h3>
          <p className="hint">Publicar es gratis. Tu número solo lo ven vecinos con sesión.</p>
          <Btn variant="primary" className="wide" onClick={() => { onClose?.(); location.hash = "#/perfil"; }}>
            Entrar para publicar
          </Btn>
        </div>
      </Sheet>
    );
  }

  const TIPO_TITULO = esFavor
    ? (tipo === "favor_solicitado" ? "Pedir ayuda" : "Ofrecer ayuda")
    : (tipo === "producto" ? "Publicar un producto" : "Publicar un servicio");

  return (
    <Sheet open onClose={onClose} titulo={TIPO_TITULO}>
      <div className="steps">
        {["1. Qué publicas", "2. Datos", "3. Revisar"].map((t, i) => (
          <span key={t} className={`step ${paso === i + 1 ? "on" : ""}`}>{t}</span>
        ))}
      </div>

      {paso === 1 && (
        <div className="paso">
          {!esFavor && (
            <>
              <Field label="Tipo" id="p-tipo">
                <Select id="p-tipo" ariaLabel="Tipo" value={tipo} onChange={(v) => set("tipo", v)}
                  options={[{ value: "servicio", label: "Un servicio que ofrezco" },
                            { value: "producto", label: "Un producto que vendo" }]} />
              </Field>
              <label>Categoría</label>
              <div className="pills">
                {CATS.filter((c) => c !== "movilidad" && c !== "préstamo").map((c) => (
                  <button key={c} type="button" className={`pill ${(f.categoria || "gasfitería") === c ? "on" : ""}`}
                    onClick={() => set("categoria", c)}><Icon name={CAT_ICON[c]} />{c}</button>
                ))}
              </div>
            </>
          )}

          {esFavor && (
            <>
              <Field label="¿Qué tipo de favor?" id="p-sub">
                <Select id="p-sub" ariaLabel="Tipo de favor" value={f.subtipo || "prestamo"}
                  onChange={(v) => set("subtipo", v)} options={SUBTIPOS} />
              </Field>
              <Field label="¿Para qué categoría?" id="p-cat">
                <Select id="p-cat" ariaLabel="Categoría" value={f.categoria || "herramientas"}
                  onChange={(v) => set("categoria", v)}
                  options={CATS.map((c) => ({ value: c, label: c }))} />
              </Field>
            </>
          )}

          <div className="pubs-actions">
            <Btn variant="primary" onClick={() => setPaso(2)}>Siguiente →</Btn>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="paso">
          <Field label="Título corto" id="p-titulo" contador={`${(f.titulo || "").length}/120`}>
            <input id="p-titulo" maxLength={120} value={f.titulo || ""} onChange={(e) => set("titulo", e.target.value)}
              placeholder={esFavor ? "Ej.: Necesito una muleta por una semana" : "Ej.: Gasfitero para fugas y destapes"} />
          </Field>
          <Field label="Descripción" id="p-desc" contador={`${(f.descripcion || "").length}/600`}>
            <textarea id="p-desc" rows={3} maxLength={600} value={f.descripcion || ""}
              onChange={(e) => set("descripcion", e.target.value)}
              placeholder={esFavor ? "Cuenta qué necesitas y hasta cuándo" : "Qué incluye, en cuánto tiempo, qué necesitas saber"} />
          </Field>

          {!esFavor && (
            <>
              <label>Precio</label>
              <div className="precio-fila">
                <span className="prefijo">S/</span>
                <input type="number" inputMode="decimal" min="0" step="1" placeholder="0"
                  value={f.precioNum || ""} disabled={Boolean(f.sinPrecio)}
                  onChange={(e) => set("precioNum", e.target.value.replace(/[^\d.]/g, ""))} />
                <label className="check inline">
                  <input type="checkbox" checked={Boolean(f.sinPrecio)} onChange={(e) => set("sinPrecio", e.target.checked)} />
                  A convenir
                </label>
              </div>
              <Field label="Formas de pago" id="p-pagos">
                <Select id="p-pagos" ariaLabel="Formas de pago" value={f.pagos || "yape,efectivo"}
                  onChange={(v) => set("pagos", v)} options={PAGOS} />
              </Field>
              <Field label="Acuerdo de pago" id="p-pol">
                <Select id="p-pol" ariaLabel="Acuerdo de pago" value={f.politica || "contra_entrega"}
                  onChange={(v) => set("politica", v)} options={POLITICAS} />
              </Field>
            </>
          )}

          {esMovilidad && (
            <>
              <Field label="Franja horaria" id="p-franja">
                <input id="p-franja" value={f.franja || ""} onChange={(e) => set("franja", e.target.value)} placeholder="Ej.: 7:00 a 8:00" />
              </Field>
              <Field label="Punto de encuentro público" id="p-punto">
                <input id="p-punto" value={f.punto || ""} onChange={(e) => set("punto", e.target.value)} placeholder="Ej.: parque del sector" />
              </Field>
              <label className="check">
                <input type="checkbox" checked={Boolean(f.checklist)} onChange={(e) => set("checklist", e.target.checked)} />
                No publico el nombre del colegio, la dirección exacta ni datos del menor.
              </label>
            </>
          )}

          <Field label="Sector" id="p-zona">
            <Select id="p-zona" ariaLabel="Sector" value={zonaConocida ? zonaActual : "OTRO"}
              onChange={(v) => {
                if (v === "OTRO") { setOtroSector(true); }
                else { setOtroSector(false); set("zona", v); set("lat", null); set("lng", null); }
              }}
              options={[...(zonas.length ? zonas : [{ nombre: zona }]).map((z) => ({ value: z.nombre, label: z.nombre })),
                        { value: "OTRO", label: "Mi sector no está en la lista" }]} />
          </Field>
          {(otroSector || !zonaConocida) && (
            <div className="sector-libre">
              <Field label="Escribe tu sector" id="p-zona-libre">
                <input id="p-zona-libre" maxLength={60} value={f.zona || ""} onChange={(e) => set("zona", e.target.value)} placeholder="Ej.: Urb. San Ramón, Piura" />
              </Field>
              <Btn size="small" icon="pin" onClick={async () => {
                try { const z = await usarGPS(); if (z) set("zona", f.zona || z); } catch (e) { toast(e.message, "warn"); }
              }}>Usar mi ubicación</Btn>
              <p className="hint">Guardamos tu zona, no tu dirección exacta.</p>
            </div>
          )}

          <label>Fotos (opcional, máximo 3)</label>
          <div className="filewrap">
            <input type="file" accept="image/*" multiple aria-label="Agregar fotos"
              onChange={(e) => { agregarFotos(e.target.files); e.target.value = ""; }} />
            <span className="filebtn-face"><Icon name="camera" /> Agregar fotos</span>
          </div>
          {subiendo && <p className="hint">{subiendo}</p>}
          {fotos.length > 0 && (
            <div className="fotos-prev">
              {fotos.map((src, i) => (
                <div className="foto-item" key={src}>
                  <img src={src} alt="" />
                  <button type="button" aria-label="Quitar" onClick={() => setFotos(fotos.filter((_, j) => j !== i))}><Icon name="close" /></button>
                </div>
              ))}
            </div>
          )}

          <label className="check"><input type="checkbox" checked={Boolean(f.emerg)} onChange={(e) => set("emerg", e.target.checked)} /> También disponible en emergencias</label>
          <label className="check"><input type="checkbox" checked={f.mostrar !== false} onChange={(e) => set("mostrar", e.target.checked)} /> Mostrar mi número y Yape a vecinos con sesión</label>

          {error && <p className="error">{error}</p>}
          <div className="pubs-actions">
            <Btn icon="back" onClick={() => setPaso(1)}>Atrás</Btn>
            <Btn variant="primary" onClick={() => { const err = validar(); if (err) return setError(err); setError(""); setPaso(3); }}>Siguiente →</Btn>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="paso">
          <div className="resumen">
            <p className="hint">{TIPO_TITULO}{esFavor ? ` · ${SUBTIPOS.find((s) => s.value === (f.subtipo || "prestamo"))?.label}` : ""}</p>
            <h3>{f.titulo}</h3>
            <p>{f.descripcion}</p>
            <p><b>Precio:</b> {esFavor ? "Gratis / intercambio" : (f.sinPrecio ? "A convenir" : `S/ ${Number(f.precioNum || 0).toFixed(2)}`)}</p>
            <p><b>Sector:</b> {zonaActual}</p>
            {fotos.length > 0 && <div className="fotos-prev">{fotos.map((x) => <img key={x} src={x} alt="" />)}</div>}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="pubs-actions">
            <Btn icon="back" onClick={() => setPaso(2)}>Atrás</Btn>
            <Btn variant="primary" icon="check" onClick={publicar} disabled={guardando}>{guardando ? "Publicando…" : "Publicar"}</Btn>
          </div>
        </div>
      )}
    </Sheet>
  );
}
