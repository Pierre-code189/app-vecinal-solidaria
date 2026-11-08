import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    if (!getToken()) { setUsuario(null); setCargando(false); return; }
    try {
      const u = await api.get("/api/perfil");
      setUsuario(u);
    } catch {
      setToken(""); setUsuario(null);
    } finally { setCargando(false); }
  };

  useEffect(() => { cargar(); }, []);

  const entrar = async (email, password) => {
    const d = await api.post("/api/login", { email, password }, { queue: false });
    setToken(d.token);
    const u = await api.get("/api/perfil");
    setUsuario(u);
    return u;
  };

  const registrar = async (datos) => {
    await api.post("/api/registro", datos, { queue: false });
    return entrar(datos.email, datos.password);
  };

  const entrarPin = async (telefono, pin) => {
    const d = await api.post("/api/login_pin", { telefono, pin }, { queue: false });
    setToken(d.token);
    setUsuario(d.usuario);
    return d.usuario;
  };

  const registrarPin = async (datos) => {
    const d = await api.post("/api/registro_pin", datos, { queue: false });
    setToken(d.token);
    setUsuario(d.usuario);
    return d.usuario;
  };

  const salir = async () => {
    try { await api.post("/api/logout", {}, { queue: false }); } catch { /* da igual */ }
    setToken(""); setUsuario(null);
  };

  const valor = useMemo(
    () => ({ usuario, cargando, entrar, registrar, entrarPin, registrarPin, salir, recargar: cargar,
      esModerador: usuario?.rol === "moderador" }),
    [usuario, cargando],
  );

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
