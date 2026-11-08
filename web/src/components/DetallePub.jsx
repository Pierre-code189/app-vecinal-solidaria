import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon, CAT_ICON } from "../lib/icons";
import { Sheet, Btn, Field, Badge, Avatar, MiniMapa, Select, useToast } from "./ui";
import Conversacion from "./Conversacion";
import { cap, copiar, medios } from "../lib/format";

const MOTIVOS = ["Parece una estafa", "Datos falsos", "Lenguaje ofensivo", "Precio engañoso", "No es del sector", "Otro"];

export default function DetallePub({ id, onClose }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [accion, setAccion] = useState(null); // cotizar | aceptar | visto | reporte | chat
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
    qc.invalidateQueries({ queryKey: ["mis-pubs"] });
    qc.invalidateQueries({ queryKey: ["tratos"] });
  };

  const llamar = async (ruta, cuerpo) => {
    setError("");
    try {
      await api.post(ruta, cuerpo || {});
      refrescar();
      return true;
    } catch (e) { setError(e.message); return false; }
  };

  if (!id) return null;

  const trato = p?.mi_trato;
  const cot = p?.mi_cotizacion;
  const abrirChat = Boolean(trato || (cot && cot.estado !== "enviada"));

  const acciones = () => {
    if (!usuario) return [{ texto: "Entra para contactar", primario: true, onClick: onClose }];
    if (p?.es_mio) return [];
    if (trato) {
      switch (trato.estado) {
        case "pendiente":
          return [{ texto: "Esperando que el vecino confirme", primario: true, disabled: true },
                  { texto: "Ver conversación", icon: "chat", onClick: () => setAccion("chat") }];
        case "acordado":
          return [{ texto: "Marcar que pagué", primario: true, icon: "wallet", onClick: () => llamar(`/api/tratos/${trato.id}/pago`) },
                  { texto: "Ver conversación", icon: "chat", onClick: () => setAccion("chat") }];
        case "pagado":
          return [{ texto: "Marcar servicio cumplido", primario: true, icon: "check", onClick: () => llamar(`/api/tratos/${trato.id}/cerrar`) },
                  { texto: "Ver conversación", icon: "chat", onClick: () => setAccion("chat") }];
        case "cerrado":
          return [{ texto: p.ya_recomende ? "Ya diste tu visto bueno" : "Dar visto bueno",
                    primario: !p.ya_recomende, icon: "thumb", disabled: p.ya_recomende,
                    onClick: () => setAccion("visto") },
                  { texto: "Ver conversación", icon: "chat", onClick: () => setAccion("chat") }];
        default:
          return [{ texto: "El trato se canceló", disabled: true }];
      }
    }
    if (!cot) return [{ texto: p?.tipo?.startsWith("favor") ? "Ofrecer ayuda" : "Pedir cotización",
                        primario: true, icon: "chat", onClick: () => setAccion("cotizar") }];
    if (cot.estado === "enviada") {
      return [{ texto: "Esperando respuesta del vecino", primario: true, disabled: true },
              { texto: "Ver lo que enviaste", icon: "chat", onClick: () => setAccion("chat") }];
    }
    if (cot.estado === "respondida") {
      return [{ texto: "Aceptar y abrir trato", primario: true, icon: "check", onClick: () => setAccion("aceptar") },
              { texto: "Ver conversación", icon: "chat", onClick: () => setAccion("chat") }];
    }
    return [{ texto: "Ver conversación", primario: true, icon: "chat", onClick: () => setAccion("chat") }];
  };

  return (
    <Sheet open onClose={onClose} titulo={p?.titulo || "Publicación"}>
      {isLoading && <div className="skeleton tall" />}

      {p && (
        <div className="det2">
          <button type="button" className="volver" onClick={onClose}><Icon name="back" /> Regresar</button>

          <div className="det2-top">
            <span className="cat"><Icon name={CAT_ICON[p.categoria] || "dots"} />{cap(p.categoria)}</span>
            {Boolean(p.es_emergencia) && <Badge tono="rojo"><Icon name="alert" /> Emergencia</Badge>}
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

          <div className="hechos">
            <div><span>Precio</span><b>{p.precio || "A convenir"}</b></div>
            <div><span>Pago</span><b>{medios(p).join(", ") || "Intercambio"}</b></div>
            <div><span>Vistos buenos</span><b><Icon name="thumb" /> {p.vistos || 0}</b></div>
            {p.franja_horaria && <div><span>Horario</span><b>{p.franja_horaria}</b></div>}
          </div>

          <p className={`det2-desc ${verTexto ? "abierta" : ""}`}>{p.descripcion}</p>
          {p.descripcion?.length > 180 && (
            <button type="button" className="linkbtn" onClick={() => setVerTexto(!verTexto)}>
              {verTexto ? "Ver menos" : "Ver más"}
            </button>
          )}

          {p.contacto_visible && (p.yape_autor || p.plin_autor || p.telefono) && (
            <details className="det2-pago">
              <summary><Icon name="wallet" /> Datos para pagar</summary>
              <div className="det2-pago-cuerpo">
                {p.yape_autor && (
                  <div className="pago-fila"><span>Yape <b>{p.yape_autor}</b></span>
                    <Btn size="small" icon="copy" onClick={async () => (await copiar(p.yape_autor)) ? toast("Yape copiado") : toast("Copia manual", "warn")}>Copiar</Btn></div>
                )}
                {p.plin_autor && (
                  <div className="pago-fila"><span>Plin <b>{p.plin_autor}</b></span>
                    <Btn size="small" icon="copy" onClick={async () => (await copiar(p.plin_autor)) ? toast("Plin copiado") : toast("Copia manual", "warn")}>Copiar</Btn></div>
                )}
                {p.telefono && (
                  <div className="pago-fila"><span>Teléfono <b>{p.telefono}</b></span>
                    <a className="btn small" href={`https://wa.me/51${p.telefono}?text=${encodeURIComponent("Hola, vi tu publicación en Vecinal Solidaria: " + p.titulo)}`}
                      target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" /> WhatsApp</a></div>
                )}
                <p className="hint">Pago directo entre vecinos. La app no cobra comisión ni guarda tu dinero.</p>
              </div>
            </details>
          )}

          <MiniMapa lat={p.lat_publica} lng={p.lng_publica} nombre={p.titulo} />

          {accion === "chat" && (
            <div className="det2-bloque">
              <h3><Icon name="chat" /> Conversación</h3>
              <Conversacion contexto={trato ? "trato" : "cotizacion"} refId={trato ? trato.id : cot?.id} />
            </div>
          )}

          {accion === "cotizar" && (
            <div className="det2-bloque">
              <h3>¿Qué necesitas?</h3>
              <Field label="Cuéntale al vecino" id="c-desc">
                <textarea id="c-desc" rows={3} maxLength={400} value={campos.descripcion || ""}
                  onChange={(e) => setCampos({ ...campos, descripcion: e.target.value })}
                  placeholder="Ej.: fuga en el baño, para hoy si se puede" />
              </Field>
              <div className="dos">
                <Field label="Medida o detalle" id="c-med">
                  <input id="c-med" value={campos.medida || ""} onChange={(e) => setCampos({ ...campos, medida: e.target.value })} />
                </Field>
                <Field label="Urgencia" id="c-urg">
                  <Select id="c-urg" ariaLabel="Urgencia" value={campos.urgencia || "normal"}
                    onChange={(v) => setCampos({ ...campos, urgencia: v })}
                    options={[{ value: "normal", label: "Normal" }, { value: "hoy", label: "Para hoy" }, { value: "urgente", label: "Urgente" }]} />
                </Field>
              </div>
              {error && <p className="error">{error}</p>}
              <Btn variant="primary" icon="send" className="wide" disabled={(campos.descripcion || "").length < 5}
                onClick={async () => {
                  const ok = await llamar("/api/cotizaciones", { publicacion_id: id, ...campos });
                  if (ok) { setAccion(null); setCampos({}); toast("Cotización enviada"); }
                }}>Enviar cotización</Btn>
            </div>
          )}

          {accion === "aceptar" && (
            <div className="det2-bloque">
              <h3>Acordar el trato</h3>
              <p className="hint">El vecino respondió: <b>{cot?.precio_respuesta || "sin precio"}</b>{cot?.nota_vendedor ? ` · ${cot.nota_vendedor}` : ""}</p>
              <Field label="Monto acordado" id="a-monto">
                <input id="a-monto" value={campos.monto ?? cot?.precio_respuesta ?? ""}
                  onChange={(e) => setCampos({ ...campos, monto: e.target.value })} placeholder="S/ 40" />
              </Field>
              <Field label="Forma de pago" id="a-pol">
                <Select id="a-pol" ariaLabel="Forma de pago" value={campos.politica || "contra_entrega"}
                  onChange={(v) => setCampos({ ...campos, politica: v })}
                  options={[
                    { value: "contra_entrega", label: "Pago contra entrega o al terminar" },
                    { value: "mitad_mitad", label: "Mitad al empezar, mitad al terminar" },
                    { value: "al_terminar", label: "Todo al terminar" },
                  ]} />
              </Field>
              {error && <p className="error">{error}</p>}
              <Btn variant="primary" className="wide" icon="check"
                onClick={async () => {
                  const ok = await llamar(`/api/cotizaciones/${cot.id}/aceptar`, campos);
                  if (ok) { setAccion(null); toast("Trato abierto. Falta que el vecino lo confirme."); }
                }}>Aceptar y abrir trato</Btn>
            </div>
          )}

          {accion === "visto" && (
            <div className="det2-bloque">
              <h3>Visto bueno</h3>
              <p className="hint">Solo puedes recomendarlo porque cerraron un trato. Cuenta qué tal fue.</p>
              <Field label="Comentario (opcional)" id="v-nota">
                <input id="v-nota" maxLength={200} value={campos.comentario || ""}
                  onChange={(e) => setCampos({ ...campos, comentario: e.target.value })} />
              </Field>
              {error && <p className="error">{error}</p>}
              <Btn variant="primary" className="wide" icon="thumb"
                onClick={async () => {
                  const ok = await llamar("/api/vistos", { publicacion_id: id, comentario: campos.comentario || "" });
                  if (ok) { setAccion(null); toast("¡Gracias! Tu visto bueno ya se ve."); }
                }}>Dar visto bueno</Btn>
            </div>
          )}

          {accion === "reporte" && (
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
              <Btn variant="danger" className="wide" icon="flag" disabled={!campos.motivo}
                onClick={async () => {
                  const motivo = campos.motivo === "Otro" ? `Otro: ${campos.detalle || ""}`.slice(0, 300) : campos.motivo;
                  const ok = await llamar("/api/reportes", { publicacion_id: id, motivo });
                  if (ok) { setAccion(null); toast("Reporte enviado. Un moderador lo revisará."); }
                }}>Enviar reporte</Btn>
            </div>
          )}

          {!p.es_mio && (
            <div className="det2-acciones">
              {acciones().map((a, i) => (
                <Btn key={i} variant={a.primario ? "primary" : "sec"} icon={a.icon} disabled={a.disabled}
                  className={acciones().length === 1 ? "wide" : ""} onClick={a.onClick}>{a.texto}</Btn>
              ))}
              <button type="button" className="linkbtn det2-reportar"
                onClick={() => { setAccion("reporte"); setCampos({ motivo: MOTIVOS[0] }); setError(""); }}>
                <Icon name="flag" /> Reportar esta publicación
              </button>
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
