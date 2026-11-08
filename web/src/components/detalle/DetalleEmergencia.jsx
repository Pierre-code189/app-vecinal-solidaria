import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Icon } from "../../lib/icons";
import { hace, cap } from "../../lib/format";
import { Hechos, Descripcion, useDetalle } from "./DetalleBase";

/* Recurso del tablero de emergencia: qué hace falta, cuándo y con quién hablar. */
export default function DetalleEmergencia() {
  const { p, usuario } = useDetalle();
  const { data: tablero } = useQuery({
    queryKey: ["emergencia"],
    queryFn: () => api.get("/api/emergencia"),
    staleTime: 60000,
  });

  const urgente = Boolean(p.creado) && (Date.now() / 1000 - p.creado) < 172800;
  const tel = p.contacto_visible && p.telefono ? p.telefono : "";
  const telefono = tel
    ? <a href={`tel:${tel}`}>{tel}</a>
    : (!usuario ? "Entra para ver" : "Sin teléfono");

  return (
    <>
      <Hechos>
        <div><span>Recurso</span><b>{cap(String(p.necesidad || p.categoria || "").replace(/_/g, " ")) || "A convenir"}</b></div>
        <div><span>Urgencia</span><b className={urgente ? "abierto" : ""}>{urgente ? "Urgente (48 h)" : "Sin urgencia marcada"}</b></div>
        <div><span>Teléfono</span><b>{telefono}</b></div>
        <div><span>Publicado</span><b>{hace(p.creado) || "—"}</b></div>
        {tablero?.activo && <div><span>Alerta</span><b>Alerta general activa</b></div>}
        <div><span>Vistos buenos</span><b><Icon name="thumb" /> {p.vistos || 0}</b></div>
      </Hechos>

      <Descripcion />
    </>
  );
}
