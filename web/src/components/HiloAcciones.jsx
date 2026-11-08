import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn, Field, Select, useToast } from "./ui";
import { comprimirPago } from "../lib/imagen";

const POLITICAS = [
  { value: "contra_entrega", label: "Pago contra entrega o al terminar" },
  { value: "mitad_mitad", label: "Mitad al empezar, mitad al terminar" },
  { value: "al_terminar", label: "Todo al terminar" },
];

/* Pasos del trato o de la cotización dentro de un hilo. Lo usan la bandeja
   (Mensajes) y la ventana flotante del messenger. */
export default function HiloAcciones({ h }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
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
    /* El comprador ya dijo «pagué» y el vendedor no lo ha confirmado. */
    const porConfirmar = vendedor && t.pago_comprador && !t.pago_vendedor && t.estado !== "cerrado";

    return (
      <div className="hilo-acciones">
        {porConfirmar && (
          <div className="cobro">
            <b>¿Se abonó?</b>
            <p className="hint">El vecino marcó que pagó. Confírmalo para seguir.</p>
            <div className="hilo-botones">
              <Btn size="small" variant="primary" icon="check"
                onClick={() => accion(`/api/tratos/${t.id}/pago`)}>Sí, recibí el pago</Btn>
              <Btn size="small" icon="close"
                onClick={() => accion(`/api/mensajes`, {
                  contexto: "trato", ref_id: t.id,
                  texto: "Todavía no me aparece el pago. ¿Puedes revisarlo?",
                })}>No me llegó</Btn>
            </div>
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
          </div>
        )}

        <p className="hint">
          {t.estado === "pendiente" && (vendedor
            ? "Acepta el trato para empezar. Después cada uno marca su parte."
            : "Esperando que el vecino confirme el trato.")}
          {abierto && !porConfirmar && `Monto: ${t.monto || "a convenir"}. El pago lo confirman las dos partes.`}
          {t.estado === "cerrado" && "Trato cerrado. Ya puedes dejar tu visto bueno en la publicación."}
        </p>

        <div className="hilo-botones">
          {t.estado === "pendiente" && vendedor && (
            <Btn size="small" variant="primary" icon="check" onClick={() => accion(`/api/tratos/${t.id}/confirmar`)}>Confirmar trato</Btn>
          )}
          {abierto && !yoPague && !porConfirmar && (
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
