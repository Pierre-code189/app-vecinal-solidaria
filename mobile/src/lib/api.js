import { Platform } from "react-native";
import { getToken, setToken, kv } from "./storage";

/*
 * Cliente de la API de Vecinal para la app móvil.
 * La web usa rutas relativas porque comparte dominio con FastAPI; aquí se
 * apunta al dominio público (configurable con EXPO_PUBLIC_API_URL).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://vecinal.apioai.online").replace(/\/+$/, "");

export const abs = (u) => {
  if (!u) return "";
  const s = String(u);
  if (/^(https?:|data:|file:|blob:)/.test(s)) return s;
  return `${API_URL}${s.startsWith("/") ? "" : "/"}${s}`;
};

const COLA_KEY = "vecinal-cola";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, signal, queue = true } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (method !== "GET" && queue) {
      await encolar(path, method, body);
      throw new ApiError("Sin conexión: quedó pendiente y se enviará solo.", 0);
    }
    throw new ApiError("Sin conexión. Revisa tu internet.", 0);
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }

  if (!res.ok) {
    const detail = data && (data.detail || data.mensaje);
    const msg = typeof detail === "string" ? detail : `Error ${res.status}`;
    if (res.status === 401) await setToken("");
    throw new ApiError(msg, res.status);
  }
  return data;
}

export const api = {
  get: (p, opts) => request(p, opts),
  post: (p, body, opts) => request(p, { ...opts, method: "POST", body }),
  put: (p, body, opts) => request(p, { ...opts, method: "PUT", body }),
  patch: (p, body, opts) => request(p, { ...opts, method: "PATCH", body }),
  del: (p, opts) => request(p, { ...opts, method: "DELETE" }),
};

/* ---------- cola de envío sin conexión (misma idea que la web) ---------- */
export const leerCola = async () => (await kv.getJSON(COLA_KEY, [])) || [];
const guardarCola = (c) => kv.setJSON(COLA_KEY, c);

async function encolar(path, method, body) {
  const c = await leerCola();
  c.push({ path, method, body, cuando: Date.now() });
  await guardarCola(c);
}

export async function sincronizarCola() {
  const cola = await leerCola();
  if (!cola.length) return 0;
  const quedan = [];
  let enviados = 0;
  for (const item of cola) {
    try {
      await request(item.path, { method: item.method, body: item.body, queue: false });
      enviados++;
    } catch (e) {
      if (e.status >= 400 && e.status < 500) continue;
      quedan.push(item);
    }
  }
  await guardarCola(quedan);
  return enviados;
}

export const esWeb = Platform.OS === "web";
