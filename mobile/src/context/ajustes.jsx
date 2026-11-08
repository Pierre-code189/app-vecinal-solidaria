import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as Speech from "expo-speech";
import { C } from "../lib/theme";
import { kv } from "../lib/storage";

const Ctx = createContext(null);

export const CAlto = {
  ...C,
  bg: "#ffffff",
  surface: "#ffffff",
  surface2: "#ffffff",
  surface3: "#ffffff",
  text: "#000000",
  ink: "#000000",
  muted: "#1c1c1c",
  muted2: "#1c1c1c",
  line: "#000000",
  lineStrong: "#000000",
  brand50: "#ffffff",
  brand100: "#d7f5de",
  brand600: "#00401a",
  brand700: "#002b11",
  brand800: "#002b11",
  info50: "#ffffff",
  infoLine: "#000000",
  danger50: "#ffffff",
  dangerLine: "#000000",
  warn50: "#ffffff",
  warnLine: "#000000",
};

export function AjustesProvider({ children }) {
  const [grande, setGrande] = useState(false);
  const [contraste, setContraste] = useState(false);
  const [voz, setVoz] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    (async () => {
      const [g, ct, v] = await Promise.all([
        kv.get("vecinal-letra"),
        kv.get("vecinal-contraste"),
        kv.get("vecinal-voz"),
      ]);
      setGrande(g === "grande");
      setContraste(ct === "1");
      setVoz(v === "1");
      setListo(true);
    })();
  }, []);

  const cambiar = (clave, valor) => {
    if (clave === "grande") {
      setGrande(valor);
      kv.set("vecinal-letra", valor ? "grande" : "normal");
    }
    if (clave === "contraste") {
      setContraste(valor);
      kv.set("vecinal-contraste", valor ? "1" : "0");
    }
    if (clave === "voz") {
      setVoz(valor);
      kv.set("vecinal-voz", valor ? "1" : "0");
      if (!valor) Speech.stop();
    }
  };

  const valor = useMemo(
    () => ({
      grande,
      contraste,
      voz,
      listo,
      cambiar,
      c: contraste ? CAlto : C,
      escala: grande ? 1.15 : 1,
    }),
    [grande, contraste, voz, listo],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useTema = () => useContext(Ctx);

export function hablar(texto) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  if (!limpio) return;
  Speech.stop();
  Speech.speak(limpio.slice(0, 220), { language: "es-PE", rate: 1 });
}

/* Lee el título de la pantalla al entrar, si la persona activó la lectura. */
export function useLectorVoz(texto) {
  const { voz } = useTema();
  useEffect(() => {
    if (!voz) return;
    const t = setTimeout(() => hablar(texto), 450);
    return () => clearTimeout(t);
  }, [voz, texto]);
}
