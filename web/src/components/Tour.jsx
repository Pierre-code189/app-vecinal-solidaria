import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Btn } from "./ui";

/* Recorrido guiado. La tarjeta vive siempre en el mismo sitio (abajo, centrada)
   para que no haya que perseguirla con el mouse; solo cambia lo resaltado. */
const PASOS = [
  {
    ruta: "/", selector: null, titulo: "Bienvenido a Vecinal",
    texto: "Te muestro en un minuto cómo se usa el barrio. Puedes salir cuando quieras.",
  },
  {
    ruta: "/", selector: '[data-tour="zona"]', titulo: "Tu sector",
    texto: "Aquí vive tu sector. Tócalo para cambiarlo o usar tu ubicación: con eso ordenamos todo por cercanía.",
  },
  {
    ruta: "/", selector: '[data-tour="buscar"]', titulo: "Buscar",
    texto: "Escribe lo que necesitas o usa el micrófono. Debajo quedan dos filtros rápidos: cerca y mejor valorados.",
  },
  {
    ruta: "/", selector: '[data-tour="tarjeta"]', titulo: "Cada tarjeta te dice lo importante",
    texto: "Categoría, distancia, precio, cómo pagan y los vistos buenos. Si tiene aval, verás quién lo respalda.",
  },
  {
    ruta: "/", selector: '[data-tour="publicar"]', titulo: "Un solo botón para publicar",
    texto: "El + del centro publica las tres cosas: servicio o producto, favor y aviso de emergencia. Cada una abre su formulario.",
  },
  {
    ruta: "/", selector: ".fab-msg", titulo: "Mensajes",
    texto: "El botón flotante abre tus conversaciones sin salir de la pantalla. Puedes arrastrarlo a donde te estorbe menos.",
  },
  {
    ruta: "/", selector: '[data-tour="tarjeta"]', titulo: "Hablar con el vecino",
    texto: "Dentro de una publicación, «Enviar mensaje» abre el chat con el contexto de lo que pides. Ahí se responde, se acuerda y se confirma el pago.",
  },
  {
    ruta: "/favores", selector: '[data-tour="favores"] .pub', titulo: "Favores",
    texto: "Aquí se pide y se ofrece ayuda sin dinero: préstamos, movilidad, compañía. El color te dice si es un pedido o algo que se ofrece.",
  },
  {
    ruta: "/emergencia", selector: '[data-tour="sos"]', titulo: "Emergencias",
    texto: "Los teléfonos 105, 116, 115 y 106 siempre a la vista, y los recursos que ofrecen tus vecinos en el tablero.",
  },
  {
    ruta: "/actividad", selector: '[data-tour="actividad"] .segmented', titulo: "Mi actividad",
    texto: "El registro de lo que haces: publicaciones, cotizaciones, tratos y favores, con lo que quedó pendiente.",
  },
  {
    ruta: "/", selector: '[data-tour="cuenta"]', titulo: "Tu cuenta y la accesibilidad",
    texto: "Tocando tu inicial abres tu perfil, la actividad y el tutorial. Junto a la campana está el ojo: letra grande, alto contraste y lectura en voz alta.",
  },
  {
    ruta: "/", selector: null, titulo: "Listo",
    texto: "Eso es todo. Vuelve a este recorrido cuando quieras desde el menú de tu cuenta.",
  },
];

const Ctx = createContext({ abrir: () => {}, activo: false });

export function TourProvider({ children }) {
  const [activo, setActivo] = useState(false);
  return (
    <Ctx.Provider value={{ activo, abrir: () => setActivo(true), cerrar: () => setActivo(false) }}>
      {children}
      {activo && <Tour onClose={() => setActivo(false)} />}
    </Ctx.Provider>
  );
}

export const useTour = () => useContext(Ctx);

function Tour({ onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [listo, setListo] = useState(false);
  const [alto, setAlto] = useState(200);
  const cardRef = useRef(null);
  const intentos = useRef(0);
  const nav = useNavigate();
  const loc = useLocation();
  const paso = PASOS[i];

  const movil = window.innerWidth < 760;
  const margenInferior = movil ? 78 : 24; // en móvil deja ver la barra inferior

  /* 1. medir el objetivo del paso */
  useEffect(() => {
    setRect(null); setListo(false); intentos.current = 0;
    if (loc.pathname !== paso.ruta) { nav(paso.ruta); return; }
    const medir = () => {
      if (!paso.selector) { setListo(true); return; }
      const el = document.querySelector(paso.selector);
      if (!el) { setListo(true); return; }
      el.scrollIntoView({ block: "center", behavior: "instant" });
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        setRect({ x: r.x, y: r.y, w: r.width, h: r.height, el });
        setListo(true);
      }, 120);
    };
    const t = setTimeout(medir, loc.pathname === paso.ruta ? 60 : 450);
    return () => clearTimeout(t);
  }, [i, loc.pathname, paso.ruta, paso.selector, nav]);

  /* 2. alto real de la tarjeta */
  useEffect(() => {
    if (!listo || !cardRef.current) return;
    const h = cardRef.current.offsetHeight;
    if (h && Math.abs(h - alto) > 2) setAlto(h);
  }, [listo, i, alto]);

  /* 3. si el objetivo queda tapado por la tarjeta, se desplaza lo justo (y solo lo justo) */
  useEffect(() => {
    if (!listo || !rect) return;
    const vh = window.innerHeight;
    const limiteAbajo = vh - alto - margenInferior - 18;
    const limiteArriba = 64;
    let dy = 0;
    if (rect.y < limiteArriba) dy = rect.y - limiteArriba;
    else if (rect.y + rect.h > limiteAbajo) dy = rect.y + rect.h - limiteAbajo;
    if (Math.abs(dy) > 2 && intentos.current < 4) {
      intentos.current++;
      window.scrollBy({ top: dy, behavior: "instant" });
      setTimeout(() => {
        const el = document.querySelector(paso.selector);
        if (el) {
          const r = el.getBoundingClientRect();
          setRect({ x: r.x, y: r.y, w: r.width, h: r.height, el });
        }
      }, 70);
    }
  }, [listo, rect, alto, margenInferior, paso.selector]);

  const siguiente = () => {
    if (i >= PASOS.length - 1) { localStorage.setItem("vecinal-tour", "1"); onClose(); return; }
    setI(i + 1);
  };
  const anterior = () => setI(Math.max(0, i - 1));
  const saltar = () => { localStorage.setItem("vecinal-tour", "1"); onClose(); };

  const vw = window.innerWidth;
  const ancho = Math.min(movil ? vw - 20 : 560, vw - 20);

  const estiloCaja = {
    position: "fixed",
    zIndex: 1200,
    left: "50%",
    transform: "translateX(-50%)",
    bottom: margenInferior,
    width: ancho,
    height: movil ? Math.min(300, Math.round(window.innerHeight * 0.42)) : "auto",
    maxHeight: movil ? Math.round(window.innerHeight * 0.42) : 250,
    overflowY: "auto",
  };

  return (
    <>
      <div className={`tour-mask ${rect && listo ? "" : "oscuro"}`} aria-hidden="true" />
      {rect && listo && (
        <div className="tour-hueco" style={{
          left: rect.x - 6, top: rect.y - 6, width: rect.w + 12, height: rect.h + 12,
        }} />
      )}
      <div ref={cardRef} className="tour-card" style={estiloCaja} role="dialog" aria-modal="true" aria-label={paso.titulo}>
        <div className="tour-paso">{i + 1} de {PASOS.length}</div>
        <h3>{paso.titulo}</h3>
        <p>{paso.texto}</p>
        <div className="tour-acciones">
          <button type="button" className="linkbtn" onClick={saltar}>Salir</button>
          <div className="tour-botones">
            <Btn size="small" icon="back" onClick={anterior}
              style={{ visibility: i === 0 ? "hidden" : "visible" }} aria-hidden={i === 0}>Atrás</Btn>
            <Btn size="small" variant="primary" icon={i === PASOS.length - 1 ? "check" : undefined} onClick={siguiente}>
              {i === PASOS.length - 1 ? "Terminar" : "Siguiente"}
            </Btn>
          </div>
        </div>
        <div className="tour-puntos" aria-hidden="true">
          {PASOS.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
      </div>
    </>
  );
}
