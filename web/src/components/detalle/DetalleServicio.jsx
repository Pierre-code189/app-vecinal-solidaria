import React from "react";
import { Icon } from "../../lib/icons";
import { Btn } from "../ui";
import { medios, copiar } from "../../lib/format";
import { Datos, Dato, Hero, Tarjeta, Proveedor, Ubicacion, useDetalle } from "./DetalleBase";

/* Servicio o producto: precio, pago, inventario y datos para pagar. */
export default function DetalleServicio() {
  const { p, toast } = useDetalle();
  const soloIntercambio = /intercambio/i.test(`${p.precio || ""} ${p.medios_pago || ""}`);
  const lista = medios(p).filter((m) => !(soloIntercambio && /intercambio/i.test(m)));
  const reciente = Boolean(p.creado) && (Date.now() / 1000 - p.creado) < 86400;

  return (
    <>
      <Datos>
        <Dato icono="wallet">{p.precio || "A convenir"}</Dato>
        {lista.length > 0 && <Dato icono="check">{lista.join(" · ")}</Dato>}
        {p.stock != null && (
          <Dato icono="box" tono={p.stock === 0 ? "rojo" : ""}>
            {p.stock === 0 ? "Agotado" : `${p.stock} disponible${p.stock === 1 ? "" : "s"}`}
          </Dato>
        )}
        {reciente && <Dato icono="clock" tono="verde">Disponible hoy</Dato>}
      </Datos>

      <Hero />

      <Tarjeta icono="tool" titulo="Detalle del servicio">
        <p className="det-texto">{p.descripcion}</p>
        {p.franja_horaria && <p className="det-linea"><Icon name="clock" /> {p.franja_horaria}</p>}
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
      </Tarjeta>

      <Proveedor />
      <Ubicacion />
    </>
  );
}
