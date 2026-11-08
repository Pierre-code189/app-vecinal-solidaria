import React, { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useTema } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { Btn, Field, Input, Select, useToast } from "./ui";
import { adjuntarComprobante } from "../lib/foto";
import { F, R } from "../lib/theme";

const POLITICAS = [
  { value: "contra_entrega", label: "Pago contra entrega o al terminar" },
  { value: "mitad_mitad", label: "Mitad al empezar, mitad al terminar" },
  { value: "al_terminar", label: "Todo al terminar" },
];

/* Pasos del trato o de la cotización dentro de un hilo. */
export default function HiloAcciones({ h }) {
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [f, setF] = useState({});

  const { data: tratos } = useQuery({
    queryKey: ["tratos"],
    queryFn: () => api.get("/api/tratos"),
    enabled: h.contexto === "trato",
  });
  const { data: cots } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: () => api.get("/api/cotizaciones"),
    enabled: h.contexto === "cotizacion",
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["conversaciones"] });
    qc.invalidateQueries({ queryKey: ["tratos"] });
    qc.invalidateQueries({ queryKey: ["cotizaciones"] });
    qc.invalidateQueries({ queryKey: ["publicacion", h.publicacion_id] });
  };

  const accion = async (ruta, cuerpo) => {
    try {
      await api.post(ruta, cuerpo || {});
      refrescar();
      toast("Hecho");
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const Caja = ({ children }) => (
    <View style={{ backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, borderRadius: R.sm, padding: 12, gap: 8, marginTop: 8 }}>
      {children}
    </View>
  );

  if (h.contexto === "trato") {
    const t = (tratos || []).find((x) => x.id === h.ref_id);
    if (!t) return null;
    const vendedor = t.vendedor_id === usuario?.id;
    const yoPague = vendedor ? t.pago_vendedor : t.pago_comprador;
    const yoCumpli = vendedor ? t.marca_vendedor : t.marca_comprador;
    const abierto = t.estado === "acordado" || t.estado === "pagado";
    const porConfirmar = vendedor && t.pago_comprador && !t.pago_vendedor && t.estado !== "cerrado";

    return (
      <View style={{ paddingHorizontal: 12, paddingTop: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
        {porConfirmar ? (
          <View style={{ backgroundColor: c.warn50, borderWidth: 1, borderColor: c.warnLine, borderRadius: R.sm, padding: 12, gap: 8 }}>
            <Text style={{ color: c.warn, fontFamily: F.bold, fontSize: 14.5 * escala }}>¿Se abonó?</Text>
            <Text style={{ color: c.warn, fontSize: 12.5 * escala }}>El vecino marcó que pagó. Confírmalo para seguir.</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Btn size="small" variant="primary" icon="check" onPress={() => accion(`/api/tratos/${t.id}/pago`)}>
                Sí, recibí el pago
              </Btn>
              <Btn
                size="small"
                icon="close"
                onPress={() =>
                  accion("/api/mensajes", {
                    contexto: "trato",
                    ref_id: t.id,
                    texto: "Todavía no me aparece el pago. ¿Puedes revisarlo?",
                  })
                }
              >
                No me llegó
              </Btn>
            </View>
            <Btn
              size="small"
              icon="camera"
              onPress={() =>
                adjuntarComprobante(
                  t.id,
                  () => {
                    toast("Comprobante adjuntado. Queda como evidencia del pago.");
                    refrescar();
                  },
                  (m) => toast(m, "err"),
                )
              }
            >
              Adjuntar comprobante
            </Btn>
          </View>
        ) : null}

        <Text style={{ color: c.muted, fontSize: 12.5 * escala, lineHeight: 18 * escala }}>
          {t.estado === "pendiente"
            ? vendedor
              ? "Acepta el trato para empezar. Después cada uno marca su parte."
              : "Esperando que el vecino confirme el trato."
            : null}
          {abierto && !porConfirmar ? `Monto: ${t.monto || "a convenir"}. El pago lo confirman las dos partes.` : null}
          {t.estado === "cerrado" ? "Trato cerrado. Ya puedes dejar tu visto bueno en la publicación." : null}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
          {t.estado === "pendiente" && vendedor ? (
            <Btn size="small" variant="primary" icon="check" onPress={() => accion(`/api/tratos/${t.id}/confirmar`)}>
              Confirmar trato
            </Btn>
          ) : null}
          {abierto && !yoPague && !porConfirmar ? (
            <>
              <Btn size="small" variant="primary" icon="wallet" onPress={() => accion(`/api/tratos/${t.id}/pago`)}>
                {vendedor ? "Confirmar que recibí el pago" : "Marcar que pagué"}
              </Btn>
              <Btn
                size="small"
                icon="camera"
                onPress={() =>
                  adjuntarComprobante(
                    t.id,
                    () => {
                      toast("Comprobante adjuntado. Queda como evidencia del pago.");
                      refrescar();
                    },
                    (m) => toast(m, "err"),
                  )
                }
              >
                Comprobante
              </Btn>
            </>
          ) : null}
          {abierto && yoPague && !yoCumpli ? (
            <Btn size="small" variant="primary" icon="check" onPress={() => accion(`/api/tratos/${t.id}/cerrar`)}>
              {vendedor ? "Marcar que entregué" : "Marcar que recibí"}
            </Btn>
          ) : null}
          {t.estado === "cerrado" ? (
            <Btn
              size="small"
              variant="primary"
              icon="thumb"
              onPress={() => accion("/api/vistos", { publicacion_id: h.publicacion_id, comentario: "" })}
            >
              Dar visto bueno
            </Btn>
          ) : null}
        </View>

        {t.comprobante ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 8 }}>
            <Icon name="camera" size={14} color={c.brand700} />
            <Text style={{ color: c.brand700, fontSize: 12.5 * escala }}>Comprobante adjunto en el trato</Text>
          </View>
        ) : null}
      </View>
    );
  }

  const co = (cots || []).find((x) => x.id === h.ref_id);
  if (!co) return null;
  const soyVendedor = co.autor_id === usuario?.id;
  const aceptable = co.estado === "respondida" || co.estado === "puedo" || co.estado === "precio";

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Text style={{ color: c.muted, fontSize: 12.5 * escala, lineHeight: 18 * escala }}>
        {co.estado === "enviada"
          ? soyVendedor
            ? "Te piden este servicio. Responde si puedes o con otro precio."
            : "Esperando que el vecino responda tu pedido."
          : null}
        {co.estado === "respondida"
          ? soyVendedor
            ? `Respondiste: ${co.precio_respuesta || "sí puedo"}.`
            : "El vecino respondió: acepta para abrir el trato."
          : null}
        {co.estado === "aceptada" ? "Ya hay un trato abierto para esta conversación." : null}
        {co.estado === "expirada" ? "La cotización venció. Escríbele de nuevo si lo necesitas." : null}
      </Text>

      {soyVendedor && co.estado === "enviada" && form !== "resp" ? (
        <Btn
          size="small"
          variant="primary"
          style={{ alignSelf: "flex-start" }}
          onPress={() => {
            setForm("resp");
            setF({ respuesta: "puedo", precio: "", nota: "" });
          }}
        >
          Responder
        </Btn>
      ) : null}

      {soyVendedor && co.estado === "enviada" && form === "resp" ? (
        <Caja>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {[
              ["puedo", "Sí puedo"],
              ["precio", "Con otro precio"],
              ["no_puedo", "No puedo"],
            ].map(([v, t]) => (
              <Btn key={v} size="small" variant={f.respuesta === v ? "primary" : "sec"} onPress={() => setF({ ...f, respuesta: v })}>
                {t}
              </Btn>
            ))}
          </View>
          {f.respuesta === "precio" ? (
            <Field label="Precio propuesto">
              <Input value={f.precio} onChangeText={(t) => setF({ ...f, precio: t })} placeholder="S/ 45" />
            </Field>
          ) : null}
          <Field label="Nota">
            <Input value={f.nota} onChangeText={(t) => setF({ ...f, nota: t })} placeholder="Puedo mañana a las 10" />
          </Field>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Btn size="small" onPress={() => setForm(null)}>Cancelar</Btn>
            <Btn
              size="small"
              variant="primary"
              onPress={async () => {
                await accion(`/api/cotizaciones/${co.id}/responder`, f);
                setForm(null);
              }}
            >
              Enviar respuesta
            </Btn>
          </View>
        </Caja>
      ) : null}

      {!soyVendedor && aceptable && form !== "aceptar" ? (
        <Btn
          size="small"
          variant="primary"
          icon="check"
          style={{ alignSelf: "flex-start" }}
          onPress={() => {
            setForm("aceptar");
            setF({ monto: co.precio_respuesta || "", politica: "contra_entrega" });
          }}
        >
          Aceptar y abrir trato
        </Btn>
      ) : null}

      {!soyVendedor && aceptable && form === "aceptar" ? (
        <Caja>
          <Field label="Monto acordado">
            <Input value={f.monto} onChangeText={(t) => setF({ ...f, monto: t })} placeholder="S/ 40" />
          </Field>
          <Field label="Forma de pago">
            <Select ariaLabel="Forma de pago" value={f.politica} onChange={(v) => setF({ ...f, politica: v })} options={POLITICAS} />
          </Field>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Btn size="small" onPress={() => setForm(null)}>Cancelar</Btn>
            <Btn
              size="small"
              variant="primary"
              icon="check"
              onPress={async () => {
                await accion(`/api/cotizaciones/${co.id}/aceptar`, f);
                setForm(null);
              }}
            >
              Abrir trato
            </Btn>
          </View>
        </Caja>
      ) : null}

      {co.estado === "aceptada" && co.trato_id ? (
        <Btn
          size="small"
          variant="primary"
          icon="check"
          style={{ alignSelf: "flex-start" }}
          onPress={() => router.replace(`/chat/trato/${co.trato_id}`)}
        >
          Ir al trato
        </Btn>
      ) : null}
    </View>
  );
}
