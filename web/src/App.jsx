import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/Auth";
import { ZonaProvider } from "./context/Zona";
import { ToastProvider } from "./components/ui";
import { Shell } from "./components/Shell";
import { sincronizarCola } from "./lib/api";

import Local from "./screens/Local";
import Favores from "./screens/Favores";
import Emergencia from "./screens/Emergencia";
import Actividad from "./screens/Actividad";
import Perfil from "./screens/Perfil";
import Tutorial from "./screens/Tutorial";
import Moderacion from "./screens/Moderacion";
import Recuperar from "./screens/Recuperar";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 20000, refetchOnWindowFocus: false } },
});

function AlTop() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  return null;
}

function AvisoSinConexion() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pendientes, setPendientes] = useState(0);
  useEffect(() => {
    const on = () => {
      setOffline(false);
      sincronizarCola().then((n) => n && setPendientes(0)).catch(() => {});
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{ background: "var(--warn-50)", color: "var(--warn)", padding: "8px 14px", fontSize: ".84rem", textAlign: "center" }}>
      Sin conexión. Puedes seguir mirando lo ya cargado; lo que publiques se enviará al volver.
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ZonaProvider>
          <ToastProvider>
            <HashRouter>
              <AlTop />
              <Shell>
                <AvisoSinConexion />
                <Routes>
                  <Route path="/" element={<Local />} />
                  <Route path="/favores" element={<Favores />} />
                  <Route path="/emergencia" element={<Emergencia />} />
                  <Route path="/actividad" element={<Actividad />} />
                  <Route path="/perfil" element={<Perfil />} />
                  <Route path="/tutorial" element={<Tutorial />} />
                  <Route path="/recuperar" element={<Recuperar />} />
                  <Route path="/moderacion" element={<Moderacion />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Shell>
            </HashRouter>
          </ToastProvider>
        </ZonaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
