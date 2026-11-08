// Cliente de la API de Vecinal: sesión, cola sin conexión y errores legibles.
const TOKEN_KEY = "vecinal-token";
const COLA_KEY = "vecinal-cola";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, signal, queue = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  } catch (e) {
    if (method !== "GET" && queue) {
      encolar(path, method, body);
      throw new ApiError("Sin conexión: quedó pendiente y se enviará solo.", 0);
    }
    throw new ApiError("Sin conexión", 0);
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }

  if (!res.ok) {
    const detail = data && (data.detail || data.mensaje);
    const msg = typeof detail === "string" ? detail : `Error ${res.status}`;
    if (res.status === 401) setToken("");
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

/* ---------- cola de envío sin conexión ---------- */
export const leerCola = () => {
  try { return JSON.parse(localStorage.getItem(COLA_KEY) || "[]"); } catch { return []; }
};
const guardarCola = (c) => localStorage.setItem(COLA_KEY, JSON.stringify(c));

function encolar(path, method, body) {
  const c = leerCola();
  c.push({ path, method, body, cuando: Date.now() });
  guardarCola(c);
}

export async function sincronizarCola() {
  const cola = leerCola();
  if (!cola.length || !navigator.onLine) return 0;
  const quedan = [];
  let enviados = 0;
  for (const item of cola) {
    try {
      await request(item.path, { method: item.method, body: item.body, queue: false });
      enviados++;
    } catch (e) {
      if (e.status >= 400 && e.status < 500) continue; // se descarta: ya no sirve
      quedan.push(item);
    }
  }
  guardarCola(quedan);
  return enviados;
}
