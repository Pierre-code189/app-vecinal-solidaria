import React, { useRef } from "react";
import { TextInput, View } from "react-native";
import { useTema } from "../context/ajustes";
import { F } from "../lib/theme";

/* Seis casillas para el código, con avance automático y pegado completo. */
export default function CodigoSeis({ valor = "", onChange, autoFocus = false }) {
  const { c, escala } = useTema();
  const refs = useRef([]);
  const digitos = Array.from({ length: 6 }, (_, i) => (valor || "")[i] || "");

  const escribir = (i, texto) => {
    const limpio = String(texto || "").replace(/\D/g, "");
    if (!limpio) {
      const nuevo = digitos.slice();
      nuevo[i] = "";
      onChange?.(nuevo.join(""));
      return;
    }
    if (limpio.length > 1) {
      const nuevo = (digitos.join("").slice(0, i) + limpio).slice(0, 6);
      onChange?.(nuevo);
      refs.current[Math.min(nuevo.length, 5)]?.focus();
      return;
    }
    const nuevo = digitos.slice();
    nuevo[i] = limpio;
    onChange?.(nuevo.join(""));
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const tecla = (i, e) => {
    if (e.nativeEvent.key === "Backspace" && !digitos[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }} accessibilityLabel="Código de 6 dígitos">
      {digitos.map((d, i) => (
        <TextInput
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChangeText={(t) => escribir(i, t)}
          onKeyPress={(e) => tecla(i, e)}
          onFocus={(e) => e.target?.select?.()}
          keyboardType="number-pad"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          accessibilityLabel={`Dígito ${i + 1}`}
          style={{
            width: 46,
            height: 54,
            borderWidth: 1.5,
            borderColor: d ? c.brand600 : c.line,
            backgroundColor: c.surface,
            borderRadius: 10,
            textAlign: "center",
            color: c.ink,
            fontFamily: F.bold,
            fontSize: 22 * escala,
          }}
        />
      ))}
    </View>
  );
}
