import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../lib/icons";
import { Btn } from "./ui";

/* Recorrido guiado por la app. Cada paso puede cambiar de pantalla y resaltar un elemento. */
const PASOS = [
  {
    ruta: "/", selector: null, titulo: "Bienvenido a Vecinal",
    texto: "Te muestro en un minuto dónde está cada cosa. Puedes salir cuando quieras.",
  },
  {
    ruta: "/", selector: '[data-tour="zona"]', titulo: "Tu sector",
    texto: "Aquí vive tu sector. Tócalo para cambiarlo o para usar tu ubicación; con eso ordenamos todo por cercanía.",
  },
  {
    ruta: "/", selector: '[data-tour="buscar"]', titulo: "Buscar y filtrar",
    texto: "Escribe lo que necesitas o usa el micrófono. Abajo puedes filtrar por categoría y por distancia.",
  },
  {
    ruta: "/", selector: '[data-tour="tarjeta"]', titulo: "Cada tarjeta te dice lo importante",
    texto: "Categoría, distancia real, precio, cómo pagan y quién lo ofrece. Toca una para ver el detalle y pedir una cotización.",
  },
  {
    ruta: "/", selector: '[data-tour="publicar"]', titulo: "Publicar",
    texto: "Publicas en tres pasos: qué ofreces, los datos y la confirmación. Puedes poner precio o dejarlo a convenir.",
  },
  {
    ruta: "/favores", selector: '[data-tour="favores"]', titulo: "Economía solidaria",
    texto: "Aquí se pide y se ofrece ayuda sin dinero: préstamos, movilidad, compañía. Con garante cuando hace falta.",
  },
  {
    ruta: "/emergencia", selector: '[data-tour="sos"]', titulo: "Emergencias",
    texto: "Los teléfonos 105, 116, 115 y 106 siempre a la vista, y lo que tus vecinos ofrecen para esa emergencia.",
  },
  {
    ruta: "/actividad", selector: '[data-tour="actividad"]', titulo: "Mi actividad",
    texto: "Tus publicaciones, cotizaciones, tratos y favores. Aquí también ves quién consultó tu contacto.",
  },
  {
    ruta: "/", selector: '[data-tour="cuenta"]', titulo: "Tu cuenta",
    texto: "Tocando tu inicial abres tu perfil, tu actividad, el tutorial y el cierre de sesión.",
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
  const nav = useNavigate();
  const loc = useLocation();
  const paso = PASOS[i];
  const pendiente = useRef(null);

  useEffect(() => {
    setRect(null); setListo(false);
    if (loc.pathname !== paso.ruta) {
      nav(paso.ruta);
      return;
    }
    const medir = () => {
      if (!paso.selector) { setListo(true); return; }
      const el = document.querySelector(paso.selector);
      if (!el) { setListo(true); return; }
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const medir2 = () => {
        const r = el.getBoundingClientRect();
        setRect({ x: r.x, y: r.y, w: r.width, h: r.height });
        setListo(true);
      };
      pendiente.current = setTimeout(medir2, 220);
    };
    const t = setTimeout(medir, loc.pathname === paso.ruta ? 60 : 500);
    return () => { clearTimeout(t); clearTimeout(pendiente.current); };
  }, [i, loc.pathname, paso.ruta, paso.selector, nav]);

  const siguiente = () => {
    if (i >= PASOS.length - 1) { localStorage.setItem("vecinal-tour", "1"); onClose(); return; }
    setI(i + 1);
  };
  const anterior = () => setI(Math.max(0, i - 1));
  const saltar = () => { localStorage.setItem("vecinal-tour", "1"); onClose(); };

  const margen = 16;
  const ancho = 360;
  let estiloCaja = { position: "fixed", zIndex: 1200 };
  if (rect) {
    const abajo = rect.y + rect.h + 210 < window.innerHeight;
    estiloCaja = {
      ...estiloCaja,
      left: Math.min(Math.max(margen, rect.x + rect.w / 2 - ancho / 2), window.innerWidth - ancho - margen),
      ...(abajo
        ? { top: rect.y + rect.h + 14 }
        : { bottom: window.innerHeight - rect.y + 14 }),
      width: ancho,
    };
  } else {
    estiloCaja = { ...estiloCaja, left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: Math.min(380, window.innerWidth - 32) };
  }

  return (
    <>
      <div className={`tour-mask ${rect && listo ? "" : "oscuro"}`} aria-hidden="true" />
      {rect && listo && (
        <div className="tour-hueco" style={{
          left: rect.x - 6, top: rect.y - 6, width: rect.w + 12, height: rect.h + 12,
        }} />
      )}
      <div className="tour-card" style={estiloCaja} role="dialog" aria-modal="true" aria-label={paso.titulo}>
        <div className="tour-paso">{i + 1} de {PASOS.length}</div>
        <h3>{paso.titulo}</h3>
        <p>{paso.texto}</p>
        <div className="tour-acciones">
          <button type="button" className="linkbtn" onClick={saltar}>Salir del recorrido</button>
          <div className="tour-botones">
            {i > 0 && <Btn size="small" icon="back" onClick={anterior}>Atrás</Btn>}
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
