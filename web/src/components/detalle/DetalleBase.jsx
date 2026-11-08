import React, { createContext, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../context/Auth";
import { Icon, CAT_ICON } from "../../lib/icons";
import { Sheet, Btn, Field, Badge, Avatar, useToast } from "../ui";
import { cap } from "../../lib/format";

/*
 * Ficha flotante de una publicación: lo esencial y una sola salida, «Enviar
 * mensaje», que abre la conversación en la bandeja de Mensajes (tipo messenger).
 * Cada tipo de publicación pone su cuerpo como children y lee el contexto.
 */

export const MOTIVOS = ["Parece una estafa", "Datos falsos", "Lenguaje ofensivo", "Precio engañoso", "No es del sector", "Otro"];

const Ctx = createContext(null);
export const useDetalle = () => useContext(Ctx);

export default function DetalleBase({ id, onClose, children }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [reportando, setReportando] = useState(false);
  const [campos, setCampos] = useState({});
  const [error, setError] = useState("");
  const [verTexto, setVerTexto] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["publicacion", id],
    queryFn: () => api.get(`/api/publicaciones/${id}`),
    enabled: Boolean(id),
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["publicacion", id] });
    qc.invalidateQueries({ queryKey: ["conversaciones"] });
    qc.invalidateQueries({ queryKey: ["tratos"] });
  };

  if (!id) return null;

  const trato = p?.mi_trato;
  const cot = p?.mi_cotizacion;
  const esExterno = p?.origen === "scraping";
  const waLink = p?.telefono
    ? `https://wa.me/51${p.telefono}?text=${encodeURIComponent("Hola, vi tu publicación en Vecinal Solidaria: " + (p.titulo || ""))}`
    : "";

  /* Abre el hilo en Mensajes; si no hay conversación, la crea con un saludo. */
  const abrirConversacion = async () => {
    if (!usuario) { onClose?.(); location.hash = "#/perfil"; return; }
    try {
      const fresco = await api.get(`/api/publicaciones/${id}`);
      if (fresco.mi_trato) { onClose?.(); location.hash = `#/mensajes/trato/${fresco.mi_trato.id}`; return; }
      if (fresco.mi_cotizacion) {
        onClose?.(); location.hash = `#/mensajes/cotizacion/${fresco.mi_cotizacion.id}`; return;
      }
      const r = await api.post("/api/cotizaciones", {
        publicacion_id: id,
        descripcion: `Hola, me interesa «${p.titulo}». ¿Podemos coordinar?`,
        medida: "", urgencia: "normal",
      });
      refrescar();
      onClose?.();
      location.hash = `#/mensajes/cotizacion/${r.id}`;
    } catch (e) { toast(e.message, "err"); }
  };

  const enviarReporte = async () => {
    setError("");
    const motivo = campos.motivo === "Otro" ? `Otro: ${campos.detalle || ""}`.slice(0, 300) : campos.motivo;
    try {
      await api.post("/api/reportes", { publicacion_id: id, motivo });
      setReportando(false);
      toast("Reporte enviado. Un moderador lo revisará.");
    } catch (e) { setError(e.message); }
  };

  const valor = { id, p, usuario, toast, trato, cot, verTexto, setVerTexto, abrirConversacion, refrescar };

  return (
    <Sheet open onClose={onClose} titulo={p?.titulo || "Publicación"}>
      {isLoading && <div className="skeleton tall" />}

      {p && (
        <div className="det2">

          <div className="det2-top">
            <span className="cat"><Icon name={CAT_ICON[p.categoria] || "dots"} />{cap(String(p.categoria || "").replace(/_/g, " "))}</span>
            {Boolean(p.es_emergencia) && <Badge tono="rojo"><Icon name="alert" /> Emergencia</Badge>}
            {esExterno && <Badge><Icon name="link" /> {cap(p.fuente || "otra red")}</Badge>}
          </div>
          <h2 className="det2-titulo">{p.titulo}</h2>

          <div className="det2-autor">
            <Avatar nombre={p.nombre} />
            <span>{p.nombre} · {p.zona}</span>
            {p.distancia_km != null && (
              <span className="det2-dist"><Icon name="pin" />
                {p.distancia_km < 0.05 ? "en tu sector"
                  : p.distancia_km < 1 ? `${Math.round(p.distancia_km * 1000)} m`
                  : `${p.distancia_km.toFixed(1).replace(".", ",")} km`}
              </span>)}
          </div>

          <Ctx.Provider value={valor}>
            {children}
          </Ctx.Provider>

          {!p.es_mio && (
            <>
              {esExterno ? (
                <div className="det2-cta">
                  <a className="btn primary cta-67" href={p.url_origen} target="_blank" rel="noopener noreferrer">
                    <Icon name="link" /> Ir a la publicación
                  </a>
                  {waLink
                    ? <a className="btn cta-33" href={waLink} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" /> WhatsApp</a>
                    : <span className="cta-33 sin-wa">Sin WhatsApp</span>}
                </div>
              ) : (
                <div className="det2-cta">
                  <Btn className="cta-67" variant="primary" icon="chat" onClick={abrirConversacion}>
                    {usuario ? "Enviar mensaje" : "Entra para contactar"}
                  </Btn>
                  {waLink
                    ? <a className="btn cta-33" href={waLink} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" /> WhatsApp</a>
                    : <span className="cta-33 sin-wa">Sin WhatsApp</span>}
                </div>
              )}

              <div className="det2-acciones">
                <button type="button" className="linkbtn det2-reportar"
                  onClick={() => { setReportando(true); setCampos({ motivo: MOTIVOS[0] }); setError(""); }}>
                  <Icon name="flag" /> Reportar esta publicación
                </button>
              </div>
            </>
          )}

          {reportando && (
            <div className="det2-bloque">
              <h3>Reportar publicación</h3>
              <p className="hint">Un moderador del barrio lo revisa. Reportar en falso también tiene consecuencias.</p>
              <div className="radios">
                {MOTIVOS.map((m) => (
                  <label key={m} className={`radio ${campos.motivo === m ? "on" : ""}`}>
                    <input type="radio" name="motivo" value={m} checked={campos.motivo === m}
                      onChange={() => setCampos({ ...campos, motivo: m })} />
                    {m}
                  </label>
                ))}
              </div>
              {campos.motivo === "Otro" && (
                <Field label="Cuéntanos qué pasa" id="r-otro">
                  <input id="r-otro" maxLength={200} value={campos.detalle || ""}
                    onChange={(e) => setCampos({ ...campos, detalle: e.target.value })} />
                </Field>
              )}
              {error && <p className="error">{error}</p>}
              <Btn variant="danger" className="wide" icon="flag" disabled={!campos.motivo} onClick={enviarReporte}>
                Enviar reporte
              </Btn>
            </div>
          )}

          {p.es_mio && (
            <p className="hint det2-mio">Esta publicación es tuya. Gestiónala en <b>Mi actividad</b>.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- piezas que usan las tres fichas ---------- */

export function Hechos({ children }) {
  return <div className="hechos">{children}</div>;
}

export function Descripcion() {
  const { p, verTexto, setVerTexto } = useDetalle();
  if (!p.descripcion) return null;
  return (
    <>
      <p className={`det2-desc ${verTexto ? "abierta" : ""}`}>{p.descripcion}</p>
      {p.descripcion.length > 180 && (
        <button type="button" className="linkbtn" onClick={() => setVerTexto(!verTexto)}>
          {verTexto ? "Ver menos" : "Ver más"}
        </button>
      )}
    </>
  );
}
