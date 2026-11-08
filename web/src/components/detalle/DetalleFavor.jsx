import React from "react";
import { Icon } from "../../lib/icons";
import { Hechos, Descripcion, useDetalle } from "./DetalleBase";

/* Favor (pedido u ofrecido): sin dinero. Estado, cuándo y aval vecinal. */
export default function DetalleFavor() {
  const { p } = useDetalle();
  const abierto = p.estado === "activa";

  return (
    <>
      <Hechos>
        <div><span>Estado</span><b className={abierto ? "abierto" : ""}>{abierto ? "Abierto" : "Pausado"}</b></div>
        {p.franja_horaria && <div><span>Cuándo</span><b>{p.franja_horaria}</b></div>}
        <div><span>Vistos buenos</span><b><Icon name="thumb" /> {p.vistos || 0}</b></div>
        {p.garante_nombre && <div><span>Garante</span><b>{p.garante_nombre}</b></div>}
      </Hechos>

      <Descripcion />
    </>
  );
}
