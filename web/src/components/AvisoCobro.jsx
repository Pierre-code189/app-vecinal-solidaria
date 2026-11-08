import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn } from "./ui";

/* Si el vendedor dejó un cobro sin confirmar, se le recuerda antes de seguir
   con otros tratos (el servidor también lo frena). */
export default function AvisoCobro({ onIr }) {
  const { usuario } = useAuth();
  const { data } = useQuery({
    queryKey: ["tratos"],
    queryFn: () => api.get("/api/tratos"),
    enabled: Boolean(usuario),
  });
  const p = (data || []).find((t) => t.vendedor_id === usuario?.id
    && t.pago_comprador && !t.pago_vendedor
    && (t.estado === "acordado" || t.estado === "pagado"));
  if (!p) return null;

  return (
    <div className="aviso-cobro">
      <Icon name="wallet" />
      <span>Tienes un cobro sin confirmar en <b>{p.titulo}</b>. Resuélvelo antes de aceptar otros tratos.</span>
      <Btn size="small" onClick={() => onIr({
        contexto: "trato", ref_id: p.id, publicacion_id: p.publicacion_id,
        otro_nombre: p.comprador_nombre || "Vecino", titulo: p.titulo,
        estado: p.estado, ultimo: "", ts: p.creado,
      })}>Ver</Btn>
    </div>
  );
}
