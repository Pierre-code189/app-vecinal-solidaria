import React from "react";
import { Icon } from "../../lib/icons";
import { Btn } from "../ui";
import { medios, copiar } from "../../lib/format";
import { Hechos, Descripcion, useDetalle } from "./DetalleBase";

/* Servicio o producto: precio, forma de pago e inventario. El resto pasa en el chat. */
export default function DetalleServicio() {
  const { p, toast } = useDetalle();
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

      {!soloIntercambio && p.contacto_visible && (p.yape_autor || p.plin_autor) && (
        <details className="det2-pago">
          <summary><Icon name="wallet" /> Datos para pagar</summary>
          <div className="det2-pago-cuerpo">
            {p.yape_autor && (
              <div className="pago-fila"><span>Yape <b>{p.yape_autor}</b></span>
                <Btn size="small" icon="copy" onClick={async () => (await copiar(p.yape_autor)) ? toast("Yape copiado") : toast("Copia manual", "warn")}>Copiar</Btn></div>
            )}
            {p.plin_autor && (
              <div className="pago-fila"><span>Plin <b>{p.plin_autor}</b></span>
                <Btn size="small" icon="copy" onClick={async () => (await copiar(p.plin_autor)) ? toast("Plin copiado") : toast("Copia manual", "warn")}>Copiar</Btn></div>
            )}
            <p className="hint">Pago directo entre vecinos. La app no cobra comisión ni guarda tu dinero.</p>
          </div>
        </details>
      )}
    </>
  );
}
