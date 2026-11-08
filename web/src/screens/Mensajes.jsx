import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn, Field, Select, Avatar, Badge, Empty, useToast } from "../components/ui";
import Conversacion from "../components/Conversacion";
import { hace, etiqueta } from "../lib/format";
import { comprimirPago } from "../lib/imagen";

const POLITICAS = [
  { value: "contra_entrega", label: "Pago contra entrega o al terminar" },
  { value: "mitad_mitad", label: "Mitad al empezar, mitad al terminar" },
  { value: "al_terminar", label: "Todo al terminar" },
];

/* Bandeja tipo messenger: lista de conversaciones a la izquierda y el hilo a la derecha. */
export default function Mensajes() {
  const { contexto, ref } = useParams();
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["conversaciones"],
    queryFn: () => api.get("/api/conversaciones"),
    refetchInterval: 20000,
  });

  const items = data?.items || [];
  const activo = items.find((i) => i.contexto === contexto && i.ref_id === ref);

  useEffect(() => { if (contexto && ref) document.title = "Mensajes · Vecinal Solidaria"; }, [contexto, ref]);

  return (
    <section className="view on msj-vista">
      <div className="page-head">
        <h1>Mensajes
          <span className="sub">Habla con el vecino que ofrece el servicio o el favor, sin salir de la app</span>
        </h1>
      </div>

      <div className={`msj ${activo ? "con-hilo" : ""}`}>
        <aside className="msj-lista">
          {isLoading && <div className="skeleton tall" />}
          {!isLoading && items.length === 0 && (
            <Empty icon="chat" titulo="Sin conversaciones"
              texto="Cuando le escribas a un vecino, el hilo aparece aquí." />
          )}
          {items.map((i) => {
            const on = activo && i.contexto === activo.contexto && i.ref_id === activo.ref_id;
            return (
              <button key={`${i.contexto}-${i.ref_id}`} type="button"
                className={`conv ${on ? "on" : ""}`}
                onClick={() => nav(`/mensajes/${i.contexto}/${i.ref_id}`)}>
                <Avatar nombre={i.otro_nombre} />
                <span className="conv-txt">
                  <span className="conv-top"><b>{i.otro_nombre}</b><time>{hace(i.ts)}</time></span>
                  <span className="conv-pub">{i.titulo}</span>
                  <span className="conv-ult">{i.ultimo || "Sin mensajes todavía"}</span>
                </span>
                {i.sin_leer > 0 && <span className="conv-n" aria-label={`${i.sin_leer} sin leer`}>{i.sin_leer}</span>}
              </button>
            );
          })}
        </aside>

        <div className="msj-hilo">
          {activo ? <Hilo key={`${activo.contexto}-${activo.ref_id}`} h={activo} /> : (
            <div className="msj-vacio">
              <Icon name="chat" size="1.8em" />
              <b>Elige una conversación</b>
              <p className="hint">A la izquierda están los vecinos con los que ya hablaste.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Hilo({ h }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [txt, estado] = etiqueta(h.estado);

  return (
    <>
      <header className="hilo-cab">
        <button type="button" className="linkbtn hilo-volver" onClick={() => nav("/mensajes")}>
          <Icon name="back" /> Conversaciones
        </button>
        <Avatar nombre={h.otro_nombre} />
        <div className="hilo-quien">
          <b>{h.otro_nombre}</b>
          <span>{h.titulo}</span>
        </div>
        <Badge tono={estado}>{txt}</Badge>
      </header>

      <Acciones h={h} />

      <Conversacion contexto={h.contexto} refId={h.ref_id}
        onNuevoMensaje={() => {
          qc.invalidateQueries({ queryKey: ["conversaciones"] });
          qc.invalidateQueries({ queryKey: ["tratos"] });
        }} />
    </>
  );
}

/* Pasos del trato o de la cotización, dentro del hilo. */
function Acciones({ h }) {
  const { usuario } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [f, setF] = useState({});

  const { data: tratos } = useQuery({
    queryKey: ["tratos"], queryFn: () => api.get("/api/tratos"),
    enabled: h.contexto === "trato",
  });
  const { data: cots } = useQuery({
    queryKey: ["cotizaciones"], queryFn: () => api.get("/api/cotizaciones"),
    enabled: h.contexto === "cotizacion",
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["conversaciones"] });
    qc.invalidateQueries({ queryKey: ["tratos"] });
    qc.invalidateQueries({ queryKey: ["cotizaciones"] });
    qc.invalidateQueries({ queryKey: ["publicacion", h.publicacion_id] });
  };

  const accion = async (ruta, cuerpo) => {
    try { await api.post(ruta, cuerpo || {}); refrescar(); toast("Hecho"); }
    catch (e) { toast(e.message, "err"); }
  };

  if (h.contexto === "trato") {
    const t = (tratos || []).find((x) => x.id === h.ref_id);
    if (!t) return null;
    const vendedor = t.vendedor_id === usuario?.id;
    const yoPague = vendedor ? t.pago_vendedor : t.pago_comprador;
    const yoCumpli = vendedor ? t.marca_vendedor : t.marca_comprador;
    const abierto = t.estado === "acordado" || t.estado === "pagado";

    return (
      <div className="hilo-acciones">
        <p className="hint">
          {t.estado === "pendiente" && (vendedor
            ? "Acepta el trato para empezar. Después cada uno marca su parte."
            : "Esperando que el vecino confirme el trato.")}
          {abierto && `Monto: ${t.monto || "a convenir"}. El pago lo confirman las dos partes.`}
          {t.estado === "cerrado" && "Trato cerrado. Ya puedes dejar tu visto bueno en la publicación."}
        </p>
        <div className="hilo-botones">
          {t.estado === "pendiente" && vendedor && (
            <Btn size="small" variant="primary" icon="check" onClick={() => accion(`/api/tratos/${t.id}/confirmar`)}>Confirmar trato</Btn>
          )}
          {abierto && !yoPague && (
            <>
              <Btn size="small" variant="primary" icon="wallet" onClick={() => accion(`/api/tratos/${t.id}/pago`)}>
                {vendedor ? "Confirmar que recibí el pago" : "Marcar que pagué"}
              </Btn>
              <label className="btn small file-adj">
                <Icon name="camera" /> Adjuntar comprobante
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const data = await comprimirPago(file);
                    await api.post(`/api/tratos/${t.id}/comprobante`, { data });
                    toast("Comprobante adjuntado. Queda como evidencia del pago.");
                    refrescar();
                  } catch (err) { toast(err.message, "err"); }
                }} />
              </label>
            </>
          )}
          {abierto && yoPague && !yoCumpli && (
            <Btn size="small" variant="primary" icon="check" onClick={() => accion(`/api/tratos/${t.id}/cerrar`)}>
              {vendedor ? "Marcar que entregué" : "Marcar que recibí"}
            </Btn>
          )}
          {t.estado === "cerrado" && (
            <Btn size="small" variant="primary" icon="thumb"
              onClick={() => accion("/api/vistos", { publicacion_id: h.publicacion_id, comentario: "" })}>
              Dar visto bueno
            </Btn>
          )}
        </div>
        {t.comprobante && (
          <a className="comprobante" href={t.comprobante} target="_blank" rel="noopener noreferrer">
            <img src={t.comprobante} alt="Comprobante del pago" /><span>Ver comprobante del pago</span>
          </a>
        )}
      </div>
    );
  }

  const c = (cots || []).find((x) => x.id === h.ref_id);
  if (!c) return null;
  const soyVendedor = c.autor_id === usuario?.id;

  return (
    <div className="hilo-acciones">
      <p className="hint">
        {c.estado === "enviada" && (soyVendedor ? "Te piden este servicio. Responde si puedes o con otro precio."
          : "Esperando que el vecino responda tu pedido.")}
        {c.estado === "respondida" && (soyVendedor ? `Respondiste: ${c.precio_respuesta || "sí puedo"}.` : "El vecino respondió: acepta para abrir el trato.")}
        {c.estado === "aceptada" && "Ya hay un trato abierto para esta conversación."}
        {c.estado === "expirada" && "La cotización venció. Escríbele de nuevo si lo necesitas."}
      </p>

      {soyVendedor && c.estado === "enviada" && form !== "resp" && (
        <Btn size="small" variant="primary" onClick={() => { setForm("resp"); setF({ respuesta: "puedo", precio: "", nota: "" }); }}>Responder</Btn>
      )}
      {soyVendedor && c.estado === "enviada" && form === "resp" && (
        <div className="hilo-form">
          <div className="pills">
            {[["puedo", "Sí puedo"], ["precio", "Con otro precio"], ["no_puedo", "No puedo"]].map(([v, t]) => (
              <button key={v} type="button" className={`pill ${f.respuesta === v ? "on" : ""}`} onClick={() => setF({ ...f, respuesta: v })}>{t}</button>
            ))}
          </div>
          {f.respuesta === "precio" && (
            <Field label="Precio propuesto" id="h-precio">
              <input id="h-precio" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} placeholder="S/ 45" />
            </Field>
          )}
          <Field label="Nota" id="h-nota">
            <input id="h-nota" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Puedo mañana a las 10" />
          </Field>
          <div className="hilo-botones">
            <Btn size="small" onClick={() => setForm(null)}>Cancelar</Btn>
            <Btn size="small" variant="primary" onClick={async () => {
              await accion(`/api/cotizaciones/${c.id}/responder`, f); setForm(null);
            }}>Enviar respuesta</Btn>
          </div>
        </div>
      )}

      {!soyVendedor && (c.estado === "respondida" || c.estado === "puedo" || c.estado === "precio") && form !== "aceptar" && (
        <Btn size="small" variant="primary" icon="check" onClick={() => { setForm("aceptar"); setF({ monto: c.precio_respuesta || "", politica: "contra_entrega" }); }}>
          Aceptar y abrir trato
        </Btn>
      )}
      {!soyVendedor && (c.estado === "respondida" || c.estado === "puedo" || c.estado === "precio") && form === "aceptar" && (
        <div className="hilo-form">
          <Field label="Monto acordado" id="h-monto">
            <input id="h-monto" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} placeholder="S/ 40" />
          </Field>
          <Field label="Forma de pago" id="h-pol">
            <Select id="h-pol" ariaLabel="Forma de pago" value={f.politica}
              onChange={(v) => setF({ ...f, politica: v })} options={POLITICAS} />
          </Field>
          <div className="hilo-botones">
            <Btn size="small" onClick={() => setForm(null)}>Cancelar</Btn>
            <Btn size="small" variant="primary" icon="check" onClick={async () => {
              await accion(`/api/cotizaciones/${c.id}/aceptar`, f); setForm(null);
            }}>Abrir trato</Btn>
          </div>
        </div>
      )}

      {c.estado === "aceptada" && c.trato_id && (
        <div className="hilo-botones">
          <p className="hint">Este pedido ya es un trato: el pago y el cierre se siguen en la misma conversación.</p>
          <Btn size="small" variant="primary" icon="check" onClick={() => nav(`/mensajes/trato/${c.trato_id}`)}>
            Ir al trato
          </Btn>
        </div>
      )}
    </div>
  );
}
