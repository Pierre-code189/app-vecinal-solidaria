import React, { useEffect, useState } from "react";
import { Icon } from "../lib/icons";
import { Btn } from "../components/ui";

const PASOS = [
  {
    t: "1. Mira lo que hay cerca",
    d: "Abre Economía Local. Verás servicios y productos de tu sector, ordenados del más cercano al más lejano, con su precio y si acepta Yape.",
    q: "Qhaway ima kaqkunata. (Mira lo que hay.)",
  },
  {
    t: "2. Pide o pide precio",
    d: "Toca una tarjeta y pulsa «Pedir cotización». El vecino recibirá tu mensaje y podrá responderte. Sin llamadas, sin dar tu número antes de tiempo.",
    q: "Mañay chaninta. (Pide su precio.)",
  },
  {
    t: "3. Cierra el trato y paga",
    d: "Cuando acuerden, registra el trato. Pagas directo con Yape, Plin o efectivo: la app no cobra comisión ni guarda tu dinero.",
    q: "Chaylla. (Así es.)",
  },
  {
    t: "4. Deja tu visto bueno",
    d: "Cuando ambos confirman que el trato se cumplió, puedes dar tu visto bueno. Así el barrio sabe en quién confiar.",
    q: "Allin kaqta niy. (Di que estuvo bien.)",
  },
  {
    t: "5. Si hay emergencia",
    d: "El botón Emergencia muestra los teléfonos 105, 116, 115 y 106, y los recursos que tus vecinos ofrecen: agua, bidones, víveres.",
    q: "Manchay. (Peligro.)",
  },
];

export default function Tutorial() {
  const [i, setI] = useState(0);
  const [voz, setVoz] = useState(true);
  const p = PASOS[i];

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const hablar = (texto = `${p.t}. ${p.d}`) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-PE";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const avanzar = (n) => {
    setI(n);
    if (voz) setTimeout(() => hablar(`${PASOS[n].t}. ${PASOS[n].d}`), 120);
  };

  return (
    <section className="view on">
      <h1>Cómo se usa
        <span className="sub">Cinco pasos, sin tecnicismos. También en quechua.</span>
      </h1>

      <div className="tuto">
        <div className="tuto-paso"><span>{i + 1} de {PASOS.length}</span></div>
        <h2>{p.t}</h2>
        <p className="tuto-texto">{p.d}</p>
        <p className="tuto-quechua"><Icon name="book" /> {p.q}</p>

        <div className="tuto-acciones">
          <Btn icon="speaker" onClick={() => hablar()}>Escuchar este paso</Btn>
          <Btn icon="speaker" onClick={() => hablar(p.q)}>Escuchar en quechua</Btn>
        </div>

        <label className="check">
          <input type="checkbox" checked={voz} onChange={(e) => { setVoz(e.target.checked); if (!e.target.checked) window.speechSynthesis?.cancel(); }} />
          Leer cada paso en voz alta al avanzar
        </label>

        <div className="tuto-nav">
          <Btn icon="back" disabled={i === 0} onClick={() => avanzar(i - 1)}>Atrás</Btn>
          {i < PASOS.length - 1
            ? <Btn variant="primary" onClick={() => avanzar(i + 1)}>Siguiente →</Btn>
            : <Btn variant="primary" icon="check" onClick={() => avanzar(0)}>Volver al inicio</Btn>}
        </div>
      </div>

      <p className="hint">
        Si te cuesta leer letra pequeña, activa <b>letra grande</b> aquí abajo. La app recuerda tu elección.
      </p>
      <LetraGrande />
    </section>
  );
}

function LetraGrande() {
  const [grande, setGrande] = useState(() => localStorage.getItem("vecinal-letra") === "grande");
  useEffect(() => {
    document.documentElement.classList.toggle("letra-grande", grande);
    localStorage.setItem("vecinal-letra", grande ? "grande" : "normal");
  }, [grande]);
  return (
    <label className="check">
      <input type="checkbox" checked={grande} onChange={(e) => setGrande(e.target.checked)} />
      Usar letra grande en toda la app
    </label>
  );
}
