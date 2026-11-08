import { Platform } from "react-native";

/* Paleta y medidas tomadas de la web (base.css + redesign.css). */
export const C = {
  brand900: "#002b11",
  brand800: "#00401a",
  brand700: "#005221",
  brand600: "#006b2c",
  brand500: "#00873a",
  brand100: "#b7e4c1",
  brand50: "#e8f5e9",

  ink: "#141b2b",
  text: "#3e4a3d",
  muted: "#5b6959",
  muted2: "#6e7b6c",
  line: "#e5e7eb",
  lineStrong: "#bdcaba",
  surface: "#ffffff",
  surface2: "#f8fafc",
  surface3: "#f1f3ff",
  bg: "#f9f9ff",

  danger: "#b61722",
  dangerInk: "#93000a",
  danger50: "#fee2e2",
  dangerLine: "#ffdad6",

  warn: "#92400e",
  warn50: "#fef3c7",
  warnLine: "#fcd9a0",

  info: "#006194",
  info50: "#e0f2fe",
  infoLine: "#cce5ff",

  ok: "#006b2c",
  okBg: "#e8f5e9",
  white: "#ffffff",
  black: "#000000",
  overlay: "rgba(12,20,14,.45)",
};

export const S = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 };
export const R = { sm: 10, md: 14, lg: 20, pill: 999 };

export const F = Platform.select({
  ios: { regular: "System", medium: "System", bold: "System" },
  android: { regular: "sans-serif", medium: "sans-serif-medium", bold: "sans-serif" },
  default: { regular: "System", medium: "System", bold: "System" },
});

export const shadow = {
  shadowColor: "#101814",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const shadowSoft = {
  shadowColor: "#101814",
  shadowOpacity: 0.05,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

/* Tamaños de letra accesibles (el ajuste "letra grande" multiplica). */
export const type = (grande) => {
  const k = grande ? 1.15 : 1;
  return {
    h1: Math.round(26 * k),
    h2: Math.round(19 * k),
    h3: Math.round(16.5 * k),
    body: Math.round(15.5 * k),
    small: Math.round(13.5 * k),
    tiny: Math.round(12 * k),
  };
};
