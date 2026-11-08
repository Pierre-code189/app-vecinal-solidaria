import React, { createContext, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../context/Auth";
import { Icon, CAT_ICON } from "../../lib/icons";
import { Sheet, Btn, Field, Avatar, MiniMapa, useToast } from "../ui";
import { cap, hace } from "../../lib/format";

/*
 * Panel de una publicación, en tarjetas apiladas: estado + título + datos,
 * portada, detalle, quién lo publica y ubicación. Cada tipo arma su ficha con
 * las piezas exportadas aquí; la hoja se puede arrastrar a pantalla completa.
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

  const { data: p, isLoading } = useQuery({
    queryKey: ["publicacion", id],
    queryFn: () => api.get(`/api/publicaciones/${id}`),
    enabled: Boolean(id),
  });

  if (!id) return null;

  const trato = p?.mi_trato;
  const cot = p?.mi_cotizacion;
  const waLink = p?.telefono
    ? `https://wa.me/51${p.telefono}?text=${encodeURIComponent("Hola, vi tu publicación en Vecinal Solidaria: " + (p.titulo || ""))}`
    : "";

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
      qc.invalidateQueries({ queryKey: ["conversaciones"] });
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

  const valor = { id, p, usuario, toast, trato, cot, abrirConversacion, waLink };
  const aval = (p?.avaladores || [])[0]?.nombre || "";

  return (
    <Sheet open onClose={onClose} titulo={p?.titulo || "Publicación"}>
      {isLoading && <div className="skeleton tall" />}

      {p && (
        <Ctx.Provider value={valor}>
          <div className="det2">

            <div className="det-estado">
              <span className="det-cat"><Icon name={CAT_ICON[p.categoria] || "dots"} />
                {cap(String(p.categoria || "").replace(/_/g, " "))}</span>
              <span className="det-pub">· {hace(p.creado) || "recién publicado"}</span>
              {Boolean(p.es_emergencia) && <span className="det-sello rojo">Emergencia</span>}
              {aval && <span className="det-sello"><Icon name="shield" /> Aval vecinal</span>}
            </div>

            <h2 className="det2-titulo">{p.titulo}</h2>

            {children}

            {!p.es_mio && (
              <div className="det-barra">
                <Btn className="cta-67" variant="primary" icon="chat" onClick={abrirConversacion}>
                  {usuario ? "Enviar mensaje" : "Entra para contactar"}
                </Btn>
                {p.origen === "scraping" && p.url_origen ? (
                  <a className="btn cta-33" href={p.url_origen} target="_blank" rel="noopener noreferrer">
                    <Icon name="link" /> Ver original
                  </a>
                ) : waLink ? (
                  <a className="btn cta-33" href={waLink} target="_blank" rel="noopener noreferrer">
                    <Icon name="whatsapp" /> WhatsApp
                  </a>
                ) : (
                  <span className="cta-33 sin-wa">Sin WhatsApp</span>
                )}
              </div>
            )}

            {p.es_mio && (
              <p className="hint det2-mio">Esta publicación es tuya. Gestiónala en <b>Mi actividad</b>.</p>
            )}

            {!p.es_mio && (
              <button type="button" className="linkbtn det2-reportar"
                onClick={() => { setReportando(true); setCampos({ motivo: MOTIVOS[0] }); setError(""); }}>
                <Icon name="flag" /> Reportar esta publicación
              </button>
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
          </div>
        </Ctx.Provider>
      )}
    </Sheet>
  );
}

/* ---------- piezas de la ficha ---------- */

export function Datos({ children }) {
  return <div className="det-chips">{children}</div>;
}

export function Dato({ icono, children, tono = "", titulo }) {
  return (
    <span className={`chip-dato ${tono}`} title={titulo}>
      {icono && <Icon name={icono} />}{children}
    </span>
  );
}

export function Hero() {
  const { p } = useDetalle();
  const fotos = Array.isArray(p.fotos) ? p.fotos.filter(Boolean) : [];
  /* Sin foto no hay portada: una banda vacía se lee como publicación a medias. */
  if (!fotos.length) return null;
  return (
    <div className="det-hero">
      <img src={fotos[0]} alt="" />
      <span className="det-hero-pie"><Icon name="pin" /> {p.zona}</span>
      {fotos.length > 1 && <span className="det-hero-num">1 de {fotos.length}</span>}
    </div>
  );
}

export function Tarjeta({ icono, titulo, children }) {
  return (
    <section className="det-card">
      <h3><Icon name={icono} /> {titulo}</h3>
      {children}
    </section>
  );
}

export function Proveedor() {
  const { p, usuario } = useDetalle();
  const aval = (p.avaladores || [])[0] || null;
  return (
    <section className="det-card det-proveedor">
      <Avatar nombre={p.nombre} cls="grande" />
      <div className="det-quien">
        <div className="det-quien-top">
          <b>{p.nombre}</b>
          <Icon name="check" className="det-check" />
        </div>
        <span><Icon name="pin" />{p.zona}{p.distancia_km != null
          ? ` · ${p.distancia_km < 0.05 ? "en tu sector"
            : p.distancia_km < 1 ? `a ${Math.round(p.distancia_km * 1000)} m`
            : `a ${p.distancia_km.toFixed(1).replace(".", ",")} km`}` : ""}</span>
        {aval && (
          <div className="det-aval">
            <Icon name="shield" />
            <span><b>Avalado por {aval.nombre}</b><em>{cap(String(aval.tipo || "").replace(/_/g, " "))}</em></span>
          </div>
        )}
        {(p.vistos || 0) > 0 && (
          <p className="det-social"><Icon name="thumb" /> {p.vistos} vecino{p.vistos === 1 ? "" : "s"} recomienda{p.vistos === 1 ? "" : "n"} esto</p>
        )}
        {p.es_mio && <span className="det-tuya"><Icon name="user" /> Tu publicación</span>}
        {!p.es_mio && !usuario && <span className="det-tuya"><Icon name="lock" /> Entra para ver el contacto</span>}
      </div>
    </section>
  );
}

export function Ubicacion() {
  const { p } = useDetalle();
  if (p.lat_publica == null || p.lng_publica == null) return null;
  return (
    <section className="det-card det-ubicacion">
      <h3><Icon name="pin" /> Ubicación aproximada</h3>
      <MiniMapa lat={p.lat_publica} lng={p.lng_publica} nombre={p.titulo} />
      <p className="hint">Punto aproximado del sector, no la dirección exacta.</p>
    </section>
  );
}
