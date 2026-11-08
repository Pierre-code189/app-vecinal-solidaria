import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Sheet, Btn, Field, Badge, Avatar, MiniMapa, useToast } from "./ui";
import { cap, copiar, fmtDist, hace, medios } from "../lib/format";

const POLITICA = {
  contra_entrega: "Acuerdo: pago contra entrega.",
  mitad_mitad: "Acuerdo: 50 % al empezar y 50 % al terminar.",
  al_terminar: "Acuerdo: pago al terminar.",
};

export function Detalle({ id, onClose, onPublicarFavor }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [modo, setModo] = useState(null);
  const [campos, setCampos] = useState({});
  const [error, setError] = useState("");

  const { data: p, isLoading } = useQuery({
    queryKey: ["publicacion", id],
    queryFn: () => api.get(`/api/publicaciones/${id}`),
    enabled: Boolean(id),
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: ["publicacion", id] });

  const accion = useMutation({
    mutationFn: async ({ tipo }) => {
      if (tipo === "visto") return api.post("/api/vistos", { publicacion_id: id });
      if (tipo === "cotizar") return api.post("/api/cotizaciones", { publicacion_id: id, descripcion: campos.descripcion, medida: campos.medida, urgencia: campos.urgencia || "normal" });
      if (tipo === "trato") return api.post("/api/tratos", { publicacion_id: id, monto: campos.monto, nota: campos.nota });
      if (tipo === "intercambio") return api.post("/api/intercambios", {
        peticion_id: id, mensaje: campos.mensaje,
        garante_nombre: campos.garante, fecha_devolucion: campos.fecha,
      });
      if (tipo === "reporte") return api.post("/api/reportes", { publicacion_id: id, motivo: campos.motivo });
    },
    onSuccess: (_, v) => {
      toast({
        visto: "¡Gracias! Tu visto bueno ya se ve.",
        cotizar: "Cotización enviada. Te responderá por aquí.",
        trato: "Trato registrado. Falta que la otra persona confirme.",
        intercambio: "Enviado. El vecino recibirá tu mensaje.",
        reporte: "Reporte enviado. Un moderador lo revisará.",
      }[v.tipo]);
      setModo(null); setCampos({}); setError(""); refrescar();
    },
    onError: (e) => setError(e.message),
  });

  if (!id) return null;

  return (
    <Sheet open onClose={onClose} titulo={p?.titulo || "Publicación"}>
      <Btn size="small" icon="back" onClick={onClose} style={{ marginBottom: 12 }}>Regresar</Btn>
      {isLoading && <div className="skeleton tall" />}
      {p && (
        <div className="detalle">
          <div className="cat"><Icon name={p.categoria ? "dots" : "dots"} />{cap(p.categoria)}
            {Boolean(p.es_emergencia) && <span className="badge rojo"><Icon name="alert" />Emergencia</span>}
          </div>
          <h2>{p.titulo}</h2>
          <p className="quien">
            <Avatar nombre={p.nombre} />
            <span className="quien-txt">
              {p.nombre} · {p.zona}
              {p.ubicacion_aproximada && p.zona === p.zona ? "" : ""}
              {p.distancia_km != null ? ` · ${fmtDist(p.distancia_km)}` : ""}
            </span>
          </p>

          {p.fotos?.length > 0 && (
            <div className="fotos">{p.fotos.map((f) => <img key={f} src={f} alt="" />)}</div>
          )}

          <p className="texto">{p.descripcion}</p>

          <div className="datos">
            <div><span>Precio</span><b>{p.precio || "A convenir"}</b></div>
            <div><span>Pago</span><b>{medios(p).join(", ") || "Intercambio"}</b></div>
            <div><span>Visto bueno</span><b><Icon name="thumb" /> {p.vistos || 0}</b></div>
            <div><span>Publicado</span><b>{hace(p.creado)}</b></div>
            {p.franja_horaria && <div><span>Horario</span><b>{p.franja_horaria}</b></div>}
            {p.punto_encuentro && <div><span>Encuentro</span><b>{p.punto_encuentro}</b></div>}
          </div>

          {p.contacto_visible ? (
            <div className="pagobox">
              <h4><Icon name="wallet" /> Cómo pagar</h4>
              {p.yape_autor && (
                <div className="pago-fila">
                  <span>Yape: <b>{p.yape_autor}</b></span>
                  <Btn size="small" icon="copy" onClick={async () => (await copiar(p.yape_autor)) ? toast("Yape copiado") : toast("Copia manual", "warn")}>Copiar</Btn>
                </div>
              )}
              {p.plin_autor && (
                <div className="pago-fila">
                  <span>Plin: <b>{p.plin_autor}</b></span>
                  <Btn size="small" icon="copy" onClick={async () => (await copiar(p.plin_autor)) ? toast("Plin copiado") : toast("Copia manual", "warn")}>Copiar</Btn>
                </div>
              )}
              {p.telefono && (
                <div className="pago-fila">
                  <span>Teléfono: <b>{p.telefono}</b></span>
                  <a className="btn small" href={`https://wa.me/51${p.telefono}?text=${encodeURIComponent("Hola, vi tu publicación en Vecinal Solidaria: " + p.titulo)}`}
                    target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />WhatsApp</a>
                </div>
              )}
              <p className="hint">Pago directo entre vecinos. La app no cobra comisión ni guarda tu dinero. {POLITICA[p.politica_pago] || ""}</p>
            </div>
          ) : (
            <div className="pagobox aviso">
              <p><Icon name="lock" /> Este vecino decidió no mostrar su número. Envía una cotización y te responderá por aquí.</p>
            </div>
          )}

          <MiniMapa lat={p.lat_publica} lng={p.lng_publica} nombre={p.titulo} />

          {!usuario && <Btn variant="primary" className="wide" onClick={onClose}>Entra para contactar</Btn>}

          {usuario && !p.es_mio && (
            <>
              <div className="pubs-actions">
                {(p.tipo === "servicio" || p.tipo === "producto") ? (
                  <>
                    <Btn variant="primary" icon="chat" onClick={() => { setModo("cotizar"); setError(""); }}>Pedir cotización</Btn>
                    <Btn icon="check" onClick={() => { setModo("trato"); setError(""); }}>Cerrar trato</Btn>
                  </>
                ) : (
                  <Btn variant="primary" icon="handshake" onClick={() => { setModo("intercambio"); setError(""); }}>Quiero ayudar</Btn>
                )}
                <Btn icon="thumb" disabled={p.ya_recomende} onClick={() => accion.mutate({ tipo: "visto" })}>
                  {p.ya_recomende ? "Ya diste tu visto bueno" : "Dar visto bueno"}
                </Btn>
              </div>
              <p className="reportar-linea">
                <button type="button" className="linkbtn" onClick={() => { setModo("reporte"); setError(""); }}>
                  <Icon name="flag" /> Reportar esta publicación
                </button>
              </p>
            </>
          )}

          {usuario && p.es_mio && (
            <p className="hint">Esta publicación es tuya. Gestionarla en <strong>Mi actividad</strong>.</p>
          )}

          {modo === "cotizar" && (
            <div className="inline-form">
              <Field label="¿Qué necesitas y para cuándo?" id="cot-desc">
                <textarea id="cot-desc" rows={2} placeholder="Ej.: fuga en el baño, para hoy si se puede"
                  value={campos.descripcion || ""} onChange={(e) => setCampos({ ...campos, descripcion: e.target.value })} />
              </Field>
              <div className="dos">
                <Field label="Medida / detalle" id="cot-med"><input id="cot-med" value={campos.medida || ""} onChange={(e) => setCampos({ ...campos, medida: e.target.value })} /></Field>
                <Field label="Urgencia" id="cot-urg">
                  <select id="cot-urg" value={campos.urgencia || "normal"} onChange={(e) => setCampos({ ...campos, urgencia: e.target.value })}>
                    <option value="normal">Normal</option><option value="hoy">Para hoy</option><option value="urgente">Urgente</option>
                  </select>
                </Field>
              </div>
              {error && <p className="error">{error}</p>}
              <Btn variant="primary" onClick={() => accion.mutate({ tipo: "cotizar" })} disabled={(campos.descripcion || "").length < 5}>
                Enviar cotización
              </Btn>
            </div>
          )}

          {modo === "trato" && (
            <div className="inline-form">
              <Field label="¿Cuánto acordaron? (opcional)" id="tr-monto">
                <input id="tr-monto" placeholder="Ej.: S/ 30 o Intercambio" value={campos.monto || ""} onChange={(e) => setCampos({ ...campos, monto: e.target.value })} />
              </Field>
              <Field label="Nota (opcional)" id="tr-nota">
                <input id="tr-nota" placeholder="Ej.: viene mañana a las 4" value={campos.nota || ""} onChange={(e) => setCampos({ ...campos, nota: e.target.value })} />
              </Field>
              <p className="hint">La otra persona recibirá un aviso para confirmar. Cuando ambos confirmen podrás dejar tu visto bueno.</p>
              {error && <p className="error">{error}</p>}
              <Btn variant="primary" onClick={() => accion.mutate({ tipo: "trato" })}>Registrar trato</Btn>
            </div>
          )}

          {modo === "intercambio" && (
            <div className="inline-form">
              <Field label="Mensaje para el vecino" id="in-msg">
                <textarea id="in-msg" rows={2} placeholder="Ej.: tengo una muleta, te la presto hasta el viernes"
                  value={campos.mensaje || ""} onChange={(e) => setCampos({ ...campos, mensaje: e.target.value })} />
              </Field>
              {p.subtipo_favor === "prestamo" && (
                <>
                  <Field label="Garante del barrio (obligatorio en préstamos)" id="in-gar">
                    <input id="in-gar" value={campos.garante || ""} onChange={(e) => setCampos({ ...campos, garante: e.target.value })} />
                  </Field>
                  <Field label="Fecha de devolución" id="in-fecha">
                    <input id="in-fecha" type="date" value={campos.fecha || ""} onChange={(e) => setCampos({ ...campos, fecha: e.target.value })} />
                  </Field>
                </>
              )}
              {error && <p className="error">{error}</p>}
              <Btn variant="primary" onClick={() => accion.mutate({ tipo: "intercambio" })}>Enviar</Btn>
            </div>
          )}

          {modo === "reporte" && (
            <div className="inline-form">
              <Field label="¿Qué problema tiene esta publicación?" id="rep-motivo">
                <select id="rep-motivo" value={campos.motivo || "Parece una estafa"} onChange={(e) => setCampos({ ...campos, motivo: e.target.value })}>
                  <option>Parece una estafa</option><option>Datos falsos</option><option>Lenguaje ofensivo</option>
                  <option>Precio engañoso</option><option>No es del sector</option><option>Otro</option>
                </select>
              </Field>
              {error && <p className="error">{error}</p>}
              <Btn variant="danger" onClick={() => accion.mutate({ tipo: "reporte" })}>Enviar reporte</Btn>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
