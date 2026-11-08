import React from "react";
import { Icon } from "../../lib/icons";
import { Btn } from "../ui";
import { medios } from "../../lib/format";
import { Hechos, Descripcion, DatosPago, Paneles, CtaFila, Botones, AvisoMio, useDetalle } from "./DetalleBase";

/* Servicio o producto: precio, forma de pago, inventario y trato con cotización. */
export default function DetalleServicio() {
  const { p, abrirConversacion } = useDetalle();
  const soloIntercambio = /intercambio/i.test(`${p.precio || ""} ${p.medios_pago || ""}`);

  return (
    <>
      <Hechos>
        <div><span>Precio</span><b>{p.precio || "A convenir"}</b></div>
        {!soloIntercambio && <div><span>Pago</span><b>{medios(p).join(", ") || "A convenir"}</b></div>}
        <div><span>Vistos buenos</span><b><Icon name="thumb" /> {p.vistos || 0}</b></div>
        {p.stock != null && (
          <div><span>Disponibles</span><b className={p.stock === 0 ? "agotado" : ""}>
            {p.stock === 0 ? "Agotado" : `${p.stock} unidad${p.stock === 1 ? "" : "es"}`}</b></div>
        )}
        {p.franja_horaria && <div><span>Horario</span><b>{p.franja_horaria}</b></div>}
      </Hechos>

      <Descripcion />
      {!soloIntercambio && <DatosPago />}

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
