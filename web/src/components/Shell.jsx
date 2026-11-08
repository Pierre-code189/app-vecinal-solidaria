import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon } from "../lib/icons";
import { Sheet, Select, Btn } from "./ui";
import { hace } from "../lib/format";

const NAV = [
  { to: "/", icon: "store", label: "Local", end: true },
  { to: "/favores", icon: "heart", label: "Favores" },
  { to: "/emergencia", icon: "alert", label: "Emergencia" },
];

export function Shell({ children }) {
  const { usuario, salir, esModerador } = useAuth();
  const { zonas, setZonas, zona, setZona, usarGPS } = useZona();
  const [locOpen, setLocOpen] = useState(false);
  const [locSel, setLocSel] = useState(zona);
  const [avisosOpen, setAvisosOpen] = useState(false);
  const [grande, setGrande] = useState(() => localStorage.getItem("vecinal-letra") === "grande");
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    api.get("/api/zonas").then(setZonas).catch(() => {});
  }, [setZonas]);

  useEffect(() => {
    document.documentElement.classList.toggle("letra-grande", grande);
    localStorage.setItem("vecinal-letra", grande ? "grande" : "normal");
  }, [grande]);

  const { data: avisos } = useQuery({
    queryKey: ["avisos", usuario?.id],
    queryFn: () => api.get("/api/notificaciones"),
    enabled: Boolean(usuario),
    refetchInterval: 60000,
  });

  const marcarLeidos = async () => {
    try { await api.post("/api/notificaciones/leer", {}); } catch { /* da igual */ }
  };

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <Icon name="home" className="brand-icon" size="1.3em" />
          <strong><span className="brand-full">Vecinal Solidaria</span><span className="brand-mini">Vecinal</span></strong>
        </Link>
        <div className="topbar-actions">
          <button type="button" className="chip-zona" onClick={() => { setLocSel(zona); setLocOpen(true); }}>
            <Icon name="pin" /><span>{zona}</span>
          </button>
          {usuario ? (
            <>
              <button type="button" className="campana" aria-label="Avisos" onClick={() => setAvisosOpen(true)}>
                <Icon name="bell" size="1.2em" />
                {avisos?.sin_leer > 0 && <span className="campana-badge">{avisos.sin_leer > 99 ? "99+" : avisos.sin_leer}</span>}
              </button>
              <button type="button" className="avatar-btn" aria-label="Mi perfil" onClick={() => nav("/perfil")}>
                {String(usuario.nombre || "?").trim()[0]}
              </button>
            </>
          ) : (
            <button type="button" className="icon-btn" aria-label="Entrar a mi cuenta" onClick={() => nav("/perfil")}>
              <Icon name="user" size="1.2em" />
            </button>
          )}
        </div>
      </header>

      <nav className="tabs" aria-label="Secciones principales">
        {[{ to: "/", icon: "store", label: "Economía Local", end: true },
          { to: "/favores", icon: "heart", label: "Favores" },
          { to: "/emergencia", icon: "alert", label: "Emergencia" },
          { to: "/actividad", icon: "clipboard", label: "Mi actividad" },
          { to: "/perfil", icon: "user", label: "Mi perfil" },
          { to: "/tutorial", icon: "book", label: "Tutorial" },
          ...(esModerador ? [{ to: "/moderacion", icon: "shield", label: "Moderación" }] : [])]
          .map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => (isActive || (n.to !== "/" && loc.pathname.startsWith(n.to)) ? "on" : "")}>
              <Icon name={n.icon} />{n.label}
            </NavLink>
          ))}
      </nav>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "on" : "")}>
            <Icon name={n.icon} size="1.35em" /><span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <main>{children}</main>

      {/* ---- sector ---- */}
      <Sheet open={locOpen} onClose={() => setLocOpen(false)} titulo="Elegir sector" ancho={440}>
        <h2 className="sheet-title"><Icon name="pin" /> ¿En qué sector estás?</h2>
        <p className="hint">Lo usamos para mostrarte primero lo más cercano. Puedes cambiarlo cuando quieras.</p>
        <Btn variant="primary" className="wide" icon="pin"
          onClick={async () => {
            try { await usarGPS(); setLocOpen(false); } catch (e) { alert(e.message); }
          }}>
          Usar mi ubicación (GPS)
        </Btn>
        <p className="hint" style={{ textAlign: "center", margin: "12px 0 6px" }}>o elige tu sector</p>
        <Select id="loc-sector" ariaLabel="Sector" value={locSel} onChange={setLocSel}
          options={(zonas.length ? zonas : [{ nombre: zona }]).map((z) => ({ value: z.nombre, label: z.nombre }))} />
        <div className="pubs-actions">
          <Btn variant="primary" className="wide" onClick={() => { setZona(locSel); setLocOpen(false); }}>Confirmar sector</Btn>
        </div>
      </Sheet>

      {/* ---- avisos ---- */}
      <Sheet open={avisosOpen} onClose={() => setAvisosOpen(false)} titulo="Avisos" ancho={420}>
        <div className="sheet-head">
          <h2 className="sheet-title"><Icon name="bell" /> Avisos</h2>
          <Btn size="small" onClick={marcarLeidos}>Marcar leídos</Btn>
        </div>
        {(avisos?.items || []).length === 0 && <p className="hint">Sin avisos.</p>}
        {(avisos?.items || []).map((n) => (
          <div key={n.id} className={`aviso ${n.leida ? "" : "nueva"}`}>
            <strong>{n.titulo}</strong>
            <p>{n.cuerpo}</p>
            <small>{hace(n.creado)}</small>
          </div>
        ))}
        <div className="pubs-actions">
          <Btn className="wide" onClick={() => { marcarLeidos(); setAvisosOpen(false); }}>Cerrar</Btn>
        </div>
      </Sheet>
    </>
  );
}
