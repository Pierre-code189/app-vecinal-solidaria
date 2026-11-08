import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon, CAT_ICON } from "../lib/icons";
import { Sheet, Btn, Field, Select, useToast } from "./ui";

const CATS = ["gasfitería", "carpintería", "electricidad", "cerrajería", "clases", "alimentos",
  "paseo de mascotas", "herramientas", "movilidad", "préstamo", "otros"];

const TIPOS = [
  { value: "servicio", label: "Un servicio que ofrezco" },
  { value: "producto", label: "Un producto que vendo" },
  { value: "favor_solicitado", label: "Un favor que necesito" },
  { value: "favor_ofrecido", label: "Un favor que ofrezco" },
];

const SUBTIPOS = [
  { value: "prestamo", label: "Préstamo de cosas" },
  { value: "ayuda_temporal", label: "Ayuda temporal" },
  { value: "donacion", label: "Donación de materiales" },
  { value: "intercambio_habilidades", label: "Intercambio de habilidades" },
  { value: "movilidad", label: "Movilidad solidaria" },
];

const PAGOS = [
  { value: "", label: "Sin cobro (intercambio)" },
  { value: "yape,efectivo", label: "Yape y efectivo" },
  { value: "yape", label: "Solo Yape" },
  { value: "plin,efectivo", label: "Plin y efectivo" },
  { value: "efectivo", label: "Solo efectivo contra entrega" },
  { value: "transferencia,efectivo", label: "Transferencia y efectivo" },
  { value: "intercambio", label: "Intercambio por otro servicio" },
];

const POLITICAS = [
  { value: "contra_entrega", label: "Pago contra entrega o al terminar" },
  { value: "mitad_mitad", label: "50 % al empezar y 50 % al terminar" },
  { value: "al_terminar", label: "Todo al terminar" },
];

const BORRADOR = "vecinal-borrador";

function comprimir(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1000;
      let { width: w, height: h } = img;
      if (w > h && w > max) { h = Math.round((h * max) / w); w = max; }
      else if (h >= w && h > max) { w = Math.round((w * max) / h); h = max; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.68));
    };
    img.onerror = () => reject(new Error("tu navegador no puede leer este formato"));
    img.src = url;
  });
}

export function Publicar({ open, onClose, inicial = "servicio", onPublicado }) {
  const { usuario } = useAuth();
  const { zona, zonas } = useZona();
  const toast = useToast();
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BORRADOR) || "null") || {}; } catch { return {}; }
  });
  const [fotos, setFotos] = useState([]);
  const [estadoFoto, setEstadoFoto] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const datos = useMemo(() => ({
    tipo: f.tipo || inicial, categoria: f.categoria || "gasfitería", subtipo: f.subtipo || "prestamo",
    titulo: f.titulo || "", descripcion: f.descripcion || "", precio: f.precio || "",
    pagos: f.pagos ?? "", politica: f.politica || "contra_entrega", zona: f.zona || zona,
    franja: f.franja || "", punto: f.punto || "", checklist: Boolean(f.checklist),
    emerg: Boolean(f.emerg), mostrar: f.mostrar !== false,
  }), [f, inicial, zona]);

  useEffect(() => {
    if (!open) return;
    setPaso(1); setError("");
    localStorage.setItem(BORRADOR, JSON.stringify(f));
  }, [open]); // eslint-disable-line

  const set = (k, v) => {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      localStorage.setItem(BORRADOR, JSON.stringify(next));
      return next;
    });
  };

  const esFavor = datos.tipo.startsWith("favor");
  const esMovilidad = esFavor && datos.subtipo === "movilidad";

  const validar2 = () => {
    if (datos.titulo.trim().length < 3) return "El título necesita al menos 3 caracteres.";
    if (datos.descripcion.trim().length < 5) return "La descripción necesita al menos 5 caracteres.";
    if (esMovilidad) {
      if (!datos.franja.trim()) return "Indica la franja horaria.";
      if (!datos.punto.trim()) return "Indica un punto de encuentro público.";
      if (!datos.checklist) return "Confirma la lista de seguridad de movilidad.";
    }
    const texto = `${datos.titulo} ${datos.descripcion} ${datos.punto}`.toLowerCase();
    if (/\b(colegio|escuela)\s+\w/i.test(texto) || texto.includes("dni")) {
      return "No publiques el nombre del colegio ni DNI: usa solo el sector y un punto público.";
    }
    return "";
  };

  const subir = async (files) => {
    const lista = Array.from(files || []).slice(0, 3 - fotos.length);
    for (let i = 0; i < lista.length; i++) {
      const file = lista[i];
      setEstadoFoto(`Subiendo foto ${i + 1} de ${lista.length}…`);
      if (!file.type.startsWith("image/")) { setEstadoFoto("Ese archivo no es una imagen."); continue; }
      try {
        const data = await comprimir(file);
        const r = await api.post("/api/fotos", { data });
        setFotos((prev) => [...prev, r.url]);
        setEstadoFoto(`${fotos.length + i + 1} de 3 fotos listas.`);
      } catch (e) {
        setEstadoFoto(`No pudimos subir esa foto (${e.message}).`);
      }
    }
  };

  const publicar = async () => {
    const err = validar2();
    if (err) { setPaso(2); setError(err); return; }
    setGuardando(true); setError("");
    try {
      await api.post("/api/publicaciones", {
        tipo: datos.tipo,
        categoria: datos.categoria,
        subtipo_favor: esFavor ? datos.subtipo : null,
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
        precio: datos.precio,
        medios_pago: datos.pagos,
        politica_pago: datos.politica,
        zona: datos.zona,
        franja_horaria: datos.franja,
        punto_encuentro: datos.punto,
        checklist_ok: datos.checklist,
        es_emergencia: datos.emerg,
        mostrar_contacto: datos.mostrar,
        fotos,
        client_id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      });
      localStorage.removeItem(BORRADOR);
      setF({}); setFotos([]); setEstadoFoto("");
      toast("¡Publicado! Ya lo ven tus vecinos.");
      onClose?.();
      onPublicado?.();
    } catch (e) {
      setError(e.message);
      toast(e.message, "err");
    } finally { setGuardando(false); }
  };

  if (!open) return null;

  if (!usuario) {
    return (
      <Sheet open onClose={onClose} titulo="Publicar" ancho={480}>
        <div className="gate">
          <div className="gate-icon"><Icon name="user" size="1.4em" /></div>
          <h3>Necesitas una cuenta para publicar</h3>
          <p className="hint">Es gratis y solo se usa para que tus vecinos sepan con quién tratan. Tu número no se muestra a quien no haya entrado.</p>
          <div className="pubs-actions" style={{ flexDirection: "column" }}>
            <Btn variant="primary" className="wide" onClick={() => { onClose?.(); location.hash = "#/perfil?modo=registro"; }}>Crear mi cuenta</Btn>
            <Btn className="wide" onClick={() => { onClose?.(); location.hash = "#/perfil"; }}>Ya tengo cuenta</Btn>
          </div>
          <p className="hint" style={{ textAlign: "center" }}>Lo que ibas a publicar no se pierde: vuelves aquí al entrar.</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} titulo="Publicar">
      <div className="steps">
        {["1. Tipo", "2. Datos", "3. Confirmar"].map((t, i) => (
          <span key={t} className={`step ${paso === i + 1 ? "on" : ""}`}>{t}</span>
        ))}
      </div>

      {paso === 1 && (
        <div className="paso">
          <Field label="¿Qué quieres publicar?" id="f-tipo">
            <Select id="f-tipo" ariaLabel="Tipo" value={datos.tipo} onChange={(v) => set("tipo", v)} options={TIPOS} />
          </Field>

          {esFavor && (
            <Field label="Tipo de favor" id="f-sub">
              <Select id="f-sub" ariaLabel="Tipo de favor" value={datos.subtipo} onChange={(v) => set("subtipo", v)} options={SUBTIPOS} />
            </Field>
          )}

          <label>Categoría</label>
          <div className="pills">
            {CATS.map((c) => (
              <button key={c} type="button" className={`pill ${datos.categoria === c ? "on" : ""}`} onClick={() => set("categoria", c)}>
                <Icon name={CAT_ICON[c]} />{c}
              </button>
            ))}
          </div>

          <div className="pubs-actions">
            <Btn variant="primary" onClick={() => setPaso(2)}>Siguiente →</Btn>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="paso">
          <Field label="Título corto" id="f-titulo" contador={`${datos.titulo.length}/120`}>
            <input id="f-titulo" maxLength={120} placeholder="Ej.: Gasfitero para fugas y destapes"
              value={datos.titulo} onChange={(e) => set("titulo", e.target.value)} />
          </Field>
          <Field label="Descripción" id="f-desc" contador={`${datos.descripcion.length}/600`}>
            <textarea id="f-desc" rows={3} maxLength={600} value={datos.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
          </Field>

          {esMovilidad && (
            <>
              <Field label="Franja horaria" id="f-franja">
                <input id="f-franja" placeholder="Ej.: 7:00 a 8:00" value={datos.franja} onChange={(e) => set("franja", e.target.value)} />
              </Field>
              <Field label="Punto de encuentro público" id="f-punto">
                <input id="f-punto" placeholder="Ej.: parque del sector" value={datos.punto} onChange={(e) => set("punto", e.target.value)} />
              </Field>
              <label className="check">
                <input type="checkbox" checked={datos.checklist} onChange={(e) => set("checklist", e.target.checked)} />
                No publico el nombre del colegio, la dirección exacta ni datos del menor, y no cobro por llevar al colegio.
              </label>
            </>
          )}

          <Field label="Precio (opcional)" id="f-precio">
            <input id="f-precio" placeholder="S/ 20 · A convenir · Intercambio / sin dinero" value={datos.precio} onChange={(e) => set("precio", e.target.value)} />
          </Field>
          <Field label="¿Cómo aceptas el pago?" id="f-pagos">
            <Select id="f-pagos" ariaLabel="Medios de pago" value={datos.pagos} onChange={(v) => set("pagos", v)} options={PAGOS} />
          </Field>
          <Field label="Acuerdo de pago" id="f-pol">
            <Select id="f-pol" ariaLabel="Acuerdo de pago" value={datos.politica} onChange={(v) => set("politica", v)} options={POLITICAS} />
          </Field>
          <Field label="Sector" id="f-zona">
            <Select id="f-zona" ariaLabel="Sector" value={datos.zona} onChange={(v) => set("zona", v)}
              options={(zonas.length ? zonas : [{ nombre: zona }]).map((z) => ({ value: z.nombre, label: z.nombre }))} />
          </Field>

          <label>Fotos (opcional, máximo 3)</label>
          <div className="filewrap">
            <input type="file" accept="image/*" multiple aria-label="Agregar fotos" onChange={(e) => subir(e.target.files)} />
            <span className="filebtn-face"><Icon name="camera" />Agregar fotos</span>
          </div>
          <p className={`hint ${estadoFoto.includes("No pudimos") || estadoFoto.includes("no es una imagen") ? "error" : ""}`}>
            {estadoFoto || "Se reducen en tu teléfono antes de subirlas y se borran los datos de ubicación de la foto."}
          </p>
          {fotos.length > 0 && (
            <div className="fotos-prev">
              {fotos.map((src, i) => (
                <div className="foto-item" key={src}>
                  <img src={src} alt="" />
                  <button type="button" aria-label="Quitar" onClick={() => setFotos(fotos.filter((_, j) => j !== i))}>
                    <Icon name="close" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="check"><input type="checkbox" checked={datos.emerg} onChange={(e) => set("emerg", e.target.checked)} /> También disponible en emergencias</label>
          <label className="check"><input type="checkbox" checked={datos.mostrar} onChange={(e) => set("mostrar", e.target.checked)} /> Mostrar mi número y Yape a vecinos con sesión</label>

          {error && <p className="error">{error}</p>}
          <div className="pubs-actions">
            <Btn icon="back" onClick={() => setPaso(1)}>Atrás</Btn>
            <Btn variant="primary" onClick={() => { const err = validar2(); if (err) return setError(err); setError(""); setPaso(3); }}>Siguiente →</Btn>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="paso">
          <div className="resumen">
            <p><b>{TIPOS.find((t) => t.value === datos.tipo)?.label}</b> · {datos.categoria}</p>
            <h3>{datos.titulo || "(sin título)"}</h3>
            <p>{datos.descripcion}</p>
            <p><b>Precio:</b> {datos.precio || "A convenir"}</p>
            <p><b>Sector:</b> {datos.zona}</p>
            <p><b>Pago:</b> {PAGOS.find((p) => p.value === datos.pagos)?.label}</p>
            {fotos.length > 0 && <div className="fotos-prev">{fotos.map((f2) => <img key={f2} src={f2} alt="" />)}</div>}
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
