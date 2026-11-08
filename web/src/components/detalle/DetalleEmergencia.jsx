import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Icon } from "../../lib/icons";
import { Btn } from "../ui";
import { hace, cap } from "../../lib/format";
import { Hechos, Descripcion, Paneles, CtaFila, Botones, AvisoMio, useDetalle } from "./DetalleBase";

/* Recurso del tablero de emergencia: qué hace falta, cuándo y cómo coordinar. */
export default function DetalleEmergencia() {
  const { p, usuario, abrirConversacion } = useDetalle();
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
        <div><span>Publicado</span><b>{hace(p.creado) || "—"}</b></div>
        <div><span>Teléfono</span><b>{telefono}</b></div>
        <div><span>Alerta</span><b>{tablero?.activo ? "Alerta general activa" : "Sin alerta general"}</b></div>
        <div><span>Vistos buenos</span><b><Icon name="thumb" /> {p.vistos || 0}</b></div>
      </Hechos>

      <Descripcion />

      <Paneles conTrato={false} />

      <CtaFila
        principal={<Btn className="cta-67" variant="primary" icon="chat" onClick={abrirConversacion}>Coordinar por la app</Btn>}
        secundario={tel
          ? <a className="btn cta-33" href={`tel:${tel}`}><Icon name="phone" /> Llamar</a>
          : <span className="cta-33 sin-wa">Sin teléfono</span>}
      />
      <Botones conAcciones={false} />
      <AvisoMio />
    </>
  );
}
