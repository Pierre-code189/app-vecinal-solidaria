import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cargarToken, getToken, setToken } from "../lib/storage";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    if (!getToken()) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    try {
      const u = await api.get("/api/perfil");
      setUsuario(u);
      qc.invalidateQueries();
    } catch {
      await setToken("");
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    (async () => {
      await cargarToken();
      await cargar();
    })();
  }, []);

  const entrarPin = async (telefono, pin) => {
    const d = await api.post("/api/login_pin", { telefono, pin }, { queue: false });
    await setToken(d.token);
    setUsuario(d.usuario);
    qc.invalidateQueries();
    return d.usuario;
  };

  const registrarPin = async (datos) => {
    const d = await api.post("/api/registro_pin", datos, { queue: false });
    await setToken(d.token);
    setUsuario(d.usuario);
    qc.invalidateQueries();
    return d.usuario;
  };

  const salir = async () => {
    try {
      await api.post("/api/logout", {}, { queue: false });
    } catch {
      /* da igual */
    }
    await setToken("");
    setUsuario(null);
    qc.clear();
  };

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      entrarPin,
      registrarPin,
      salir,
      recargar: cargar,
      esModerador: usuario?.rol === "moderador" || usuario?.rol === "admin",
      esAdmin: usuario?.rol === "admin",
    }),
    [usuario, cargando],
  );

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
