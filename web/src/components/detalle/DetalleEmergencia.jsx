import React from "react";
import { Icon } from "../../lib/icons";
import { hace, cap } from "../../lib/format";
import { Datos, Dato, Hero, Tarjeta, Proveedor, Ubicacion, useDetalle } from "./DetalleBase";

/* Recurso o pedido del tablero de emergencia: qué hace falta y cómo coordinar. */
export default function DetalleEmergencia() {
  const { p, usuario } = useDetalle();
  const urgente = Boolean(p.creado) && (Date.now() / 1000 - p.creado) < 172800;
  const tel = p.contacto_visible && p.telefono ? p.telefono : "";

  return (
    <>
      <Datos>
        <Dato icono="box">{cap(String(p.necesidad || p.categoria || "").replace(/_/g, " ")) || "Recurso"}</Dato>
        <Dato icono="alert" tono={urgente ? "rojo" : ""}>{urgente ? "Urgente (48 h)" : "Sin urgencia"}</Dato>
        {tel && <Dato icono="phone"><a href={`tel:${tel}`}>{tel}</a></Dato>}
        {p.creado && <Dato icono="clock">{hace(p.creado)}</Dato>}
      </Datos>

      <Hero />

      <Tarjeta icono="alert" titulo="Qué se necesita">
        <p className="det-texto">{p.descripcion}</p>
        {!tel && <p className="det-linea"><Icon name="lock" /> {usuario ? "El vecino no dejó teléfono." : "Entra para ver el teléfono."}</p>}
      </Tarjeta>

      <Proveedor />
      <Ubicacion />
    </>
  );
}
