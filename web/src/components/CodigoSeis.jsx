import React, { useEffect, useRef } from "react";

/* Seis casillas para el código, con avance automático y pegado completo. */
export default function CodigoSeis({ valor = "", onChange, disabled = false, autoFocus = false }) {
  const refs = useRef([]);
  const digitos = Array.from({ length: 6 }, (_, i) => (valor || "")[i] || "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const escribir = (i, texto) => {
    const limpio = texto.replace(/\D/g, "");
    if (!limpio) {
      const nuevo = digitos.slice();
      nuevo[i] = "";
      onChange(nuevo.join(""));
      return;
    }
    if (limpio.length > 1) { // pegado
      const nuevo = (digitos.join("").slice(0, i) + limpio).slice(0, 6);
      onChange(nuevo);
      const foco = Math.min(nuevo.length, 5);
      refs.current[foco]?.focus();
      return;
    }
    const nuevo = digitos.slice();
    nuevo[i] = limpio;
    onChange(nuevo.join(""));
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const tecla = (i, e) => {
    if (e.key === "Backspace" && !digitos[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="cod6" role="group" aria-label="Código de 6 dígitos">
      {digitos.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChange={(e) => escribir(i, e.target.value)}
          onKeyDown={(e) => tecla(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`Dígito ${i + 1}`}
          className={d ? "lleno" : ""}
        />
      ))}
    </div>
  );
}
