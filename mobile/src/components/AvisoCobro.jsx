import React from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useTema } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { Btn } from "./ui";
import { F, R } from "../lib/theme";

/* Recordatorio de cobro pendiente: el servidor también frena otros tratos. */
export default function AvisoCobro({ onIr }) {
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const { data } = useQuery({
    queryKey: ["tratos"],
    queryFn: () => api.get("/api/tratos"),
    enabled: Boolean(usuario),
  });
  const p = (data || []).find(
    (t) =>
      t.vendedor_id === usuario?.id &&
      t.pago_comprador &&
      !t.pago_vendedor &&
      (t.estado === "acordado" || t.estado === "pagado"),
  );
  if (!p) return null;

  return (
    <View
      style={{
        backgroundColor: c.warn50,
        borderWidth: 1,
        borderColor: c.warnLine,
        borderRadius: R.sm,
        padding: 12,
        gap: 8,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Icon name="wallet" size={18} color={c.warn} />
        <Text style={{ color: c.warn, fontSize: 12.5 * escala, flex: 1, lineHeight: 18 * escala }}>
          Tienes un cobro sin confirmar en <Text style={{ fontFamily: F.bold }}>{p.titulo}</Text>. Resuélvelo antes de
          aceptar otros tratos.
        </Text>
      </View>
      <Btn
        size="small"
        style={{ alignSelf: "flex-start" }}
        onPress={() =>
          onIr?.({
            contexto: "trato",
            ref_id: p.id,
            publicacion_id: p.publicacion_id,
            otro_nombre: p.comprador_nombre || "Vecino",
            titulo: p.titulo,
            estado: p.estado,
            ultimo: "",
            ts: p.creado,
          })
        }
      >
        Ver
      </Btn>
    </View>
  );
}
