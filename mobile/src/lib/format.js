export const esc = (v) => String(v ?? "");

export function fmtDist(km) {
  if (km === null || km === undefined || !isFinite(km) || km > 200) return "";
  if (km < 0.1) return "a menos de 100 m";
  if (km < 1) return `a ${Math.round(km * 1000)} m`;
  return `a ${km.toFixed(1).replace(".", ",")} km`;
}

export function hace(ts) {
  if (!ts) return "";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 2592000) return `hace ${Math.floor(s / 86400)} días`;
  return new Date(ts * 1000).toLocaleDateString("es-PE");
}

export const cap = (s) => {
  const x = String(s || "");
  return x.charAt(0).toUpperCase() + x.slice(1);
};

export const inicial = (nombre) => (String(nombre || "?").trim()[0] || "?").toUpperCase();

export const MEDIOS = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  intercambio: "Intercambio",
};

export const medios = (p) =>
  String(p?.medios_pago || "").split(",").filter(Boolean).map((m) => MEDIOS[m] || m);

export const ETIQUETAS = {
  activa: ["Activa", "verde"],
  pausada: ["Pausada", "gris"],
  resuelta: ["Resuelta", "gris"],
  cerrada: ["Cerrada", "gris"],
  vencida: ["Vencida", "gris"],
  enviada: ["Esperando respuesta", "gris"],
  respondida: ["Respondida", "verde"],
  expirada: ["Vencida", "gris"],
  acordado: ["Acordado", "gris"],
  cerrado: ["Cerrado", "verde"],
  cancelado: ["Cancelado", "gris"],
  solicitada: ["Solicitada", "gris"],
  aceptada: ["Aceptada", "verde"],
  rechazada: ["Rechazada", "gris"],
  en_curso: ["En curso", "verde"],
};

export const etiqueta = (e) => ETIQUETAS[e] || [e || "", "gris"];

export const telefonoVisible = (t) => String(t || "").replace(/\D/g, "");

export const precioCorto = (p) => {
  const s = String(p?.precio || "");
  return s || "A convenir";
};
