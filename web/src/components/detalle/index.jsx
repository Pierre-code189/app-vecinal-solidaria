import React from "react";
import DetalleBase, { useDetalle } from "./DetalleBase";
import DetalleServicio from "./DetalleServicio";
import DetalleFavor from "./DetalleFavor";
import DetalleEmergencia from "./DetalleEmergencia";

function Ficha() {
  const { p } = useDetalle();
  if (Boolean(p.es_emergencia)) return <DetalleEmergencia />;
  if (String(p.tipo || "").startsWith("favor")) return <DetalleFavor />;
  return <DetalleServicio />;
}

/* Punto de entrada del detalle: elige la ficha según el tipo de publicación. */
export default function Detalle({ id, onClose }) {
  return (
    <DetalleBase id={id} onClose={onClose}>
      <Ficha />
    </DetalleBase>
  );
}
