import React from "react";
import { Icon } from "../../lib/icons";
import { Btn } from "../ui";
import { Hechos, Descripcion, Paneles, CtaFila, Botones, AvisoMio, useDetalle } from "./DetalleBase";

/* Favor (pedido u ofrecido): sin dinero, con estado y franja horaria. */
export default function DetalleFavor() {
  const { p, abrirConversacion } = useDetalle();
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

      <Paneles />

      <CtaFila principal={
        <Btn className="cta-67" variant="primary" icon="chat" onClick={abrirConversacion}>
          Consultar al vecino
        </Btn>
      } />
      <Botones />
      <AvisoMio />
    </>
  );
}
