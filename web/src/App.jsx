import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/Auth";
import { ZonaProvider } from "./context/Zona";
import { ToastProvider } from "./components/ui";
import { Shell } from "./components/Shell";
import { TourProvider } from "./components/Tour";
import AuthGate from "./components/AuthGate";
import { Icon } from "./lib/icons";
import { sincronizarCola } from "./lib/api";

import Local from "./screens/Local";
import Favores from "./screens/Favores";
import Emergencia from "./screens/Emergencia";
import MiActividad from "./screens/MiActividad";
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
  useEffect(() => {
    const on = () => { setOffline(false); sincronizarCola().catch(() => {}); };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{ background: "var(--info-50)", color: "var(--info)", padding: "8px 14px", fontSize: ".84rem", textAlign: "center" }}>
      Sin conexión. Puedes seguir mirando lo ya cargado; lo que publiques se enviará al volver.
    </div>
  );
}

function Cargando() {
  return (
    <div className="cargando" role="status" aria-live="polite">
      <Icon name="home" size="1.9em" />
      <b>Vecinal Solidaria</b>
      <span>Abriendo el barrio…</span>
    </div>
  );
}

/* Sin sesión no hay app: se pide entrar o crear cuenta. */
function Contenido() {
  const { usuario, cargando } = useAuth();
  const loc = useLocation();

  if (cargando) return <Cargando />;

  // El barrio se puede mirar sin cuenta; solo se pide al publicar, contactar o gestionar.
  const privada = ["/perfil", "/actividad", "/moderacion"].includes(loc.pathname);
  if (!usuario && privada) return <AuthGate />;
  if (!usuario && loc.pathname === "/recuperar") {
    return (
      <div className="entrada">
        <header className="entrada-head">
          <span className="entrada-marca"><Icon name="home" size="1.15em" /> Vecinal Solidaria</span>
          <span className="entrada-ciudad">Piura</span>
        </header>
        <main className="entrada-cuerpo"><Recuperar /></main>
      </div>
    );
  }

  return (
    <TourProvider>
      <Shell>
        <AvisoSinConexion />
        <Routes>
        <Route path="/" element={<Local />} />
        <Route path="/favores" element={<Favores />} />
        <Route path="/emergencia" element={<Emergencia />} />
        <Route path="/actividad" element={<MiActividad />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/moderacion" element={<Moderacion />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </TourProvider>
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
              <Contenido />
            </HashRouter>
          </ToastProvider>
        </ZonaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
