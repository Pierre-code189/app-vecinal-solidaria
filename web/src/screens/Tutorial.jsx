import React from "react";
import { Icon } from "../lib/icons";
import { Btn } from "../components/ui";
import { useTour } from "../components/Tour";
import { useAuth } from "../context/Auth";

const RESUMEN = [
  ["pin", "Tu sector", "Cómo se elige y por qué ordena todo por cercanía."],
  ["search", "Buscar y filtrar", "Texto, voz, categoría y distancia."],
  ["store", "Las tarjetas", "Precio, pagos, distancia y quién lo ofrece."],
  ["plus", "Publicar", "Tres pasos, con fotos y aviso de privacidad."],
  ["heart", "Favores", "Pedir y ofrecer ayuda sin dinero."],
  ["alert", "Emergencias", "SOS, recursos y directorio del barrio."],
  ["clipboard", "Mi actividad", "Tus tratos, cotizaciones y consultas."],
  ["user", "Tu cuenta", "Perfil, PIN y cierre de sesión."],
];

export default function Tutorial() {
  const { abrir } = useTour();
  const { usuario } = useAuth();

  return (
    <section className="view on">
      <div className="page-head">
        <h1>Cómo funciona Vecinal
          <span className="sub">Un recorrido por la app, pantalla por pantalla. Dura menos de un minuto.</span>
        </h1>
      </div>

      <div className="tuto-hero">
        <div className="tuto-hero-txt">
          <b>{usuario ? `Hola, ${usuario.nombre.split(" ")[0]}.` : "Hola."}</b>
          <p>
            Te acompañamos desde el primer paso: elegir tu sector, buscar, publicar, pedir ayuda
            y avisar de una emergencia. Puedes salir cuando quieras y repetirlo cuando lo necesites.
          </p>
        </div>
        <div className="tuto-hero-acciones">
          <Btn variant="primary" icon="book" onClick={abrir}>Empezar el recorrido</Btn>
          <span className="hint">También puedes activar la letra grande desde tu cuenta.</span>
        </div>
      </div>

      <h2 className="sec">Lo que verás</h2>
      <div className="tuto-lista">
        {RESUMEN.map(([icono, titulo, texto]) => (
          <div className="tuto-item" key={titulo}>
            <span className="tuto-ico"><Icon name={icono} /></span>
            <div>
              <b>{titulo}</b>
              <p>{texto}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="nota">
        El recorrido resalta cada parte de la pantalla y te lleva a la sección que toca.
        Si al volver no lo ves, entra a <b>Tutorial</b> desde el menú de tu cuenta.
      </p>
    </section>
  );
}
