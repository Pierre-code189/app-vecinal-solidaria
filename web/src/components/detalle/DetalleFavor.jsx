import React from "react";
import { Icon } from "../../lib/icons";
import { Datos, Dato, Hero, Tarjeta, Proveedor, Ubicacion, useDetalle } from "./DetalleBase";

/* Favor (pedido u ofrecido): sin dinero. Estado, cuándo y aval vecinal. */
export default function DetalleFavor() {
  const { p } = useDetalle();
  const abierto = p.estado === "activa";
  const esPedido = p.tipo === "favor_solicitado";

  return (
    <>
      <Datos>
        <Dato icono={esPedido ? "handshake" : "solidaridad"} tono={esPedido ? "rojo" : "verde"}>
          {esPedido ? "Necesito" : "Ofrezco"}
        </Dato>
        <Dato icono="clock">{abierto ? "Abierto" : "Pausado"}</Dato>
        {p.franja_horaria && <Dato icono="clock">{p.franja_horaria}</Dato>}
      </Datos>

      <Hero />

      <Tarjeta icono="solidaridad" titulo={esPedido ? "Qué necesita" : "Qué ofrece"}>
        <p className="det-texto">{p.descripcion}</p>
        {p.garante_nombre && <p className="det-linea"><Icon name="shield" /> Garante: {p.garante_nombre}</p>}
      </Tarjeta>

      <Proveedor />
      <Ubicacion />
    </>
  );
}
