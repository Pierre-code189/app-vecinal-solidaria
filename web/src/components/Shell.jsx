import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon } from "../lib/icons";
import { Sheet, Select, Btn } from "./ui";
import { useTour } from "./Tour";
import { hace } from "../lib/format";

const NAV = [
  { to: "/", icon: "store", label: "Economía Local", end: true, tour: "local" },
  { to: "/favores", icon: "heart", label: "Favores", tour: "favores" },
  { to: "/emergencia", icon: "alert", label: "Emergencia", tour: "emergencia" },
];

export function Shell({ children }) {
  const { usuario, salir, esModerador } = useAuth();
  const { zonas, zona, setZona, usarGPS } = useZona();
  const { abrir: abrirTour } = useTour();
  const [locOpen, setLocOpen] = useState(false);
  const [locSel, setLocSel] = useState(zona);
  const [avisosOpen, setAvisosOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [grande, setGrande] = useState(() => localStorage.getItem("vecinal-letra") === "grande");
  const [contraste, setContraste] = useState(() => localStorage.getItem("vecinal-contraste") === "1");
  const [menosMov, setMenosMov] = useState(() => localStorage.getItem("vecinal-movimiento") === "0");
  const nav = useNavigate();
  const loc = useLocation();
  const cuenta = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("letra-grande", grande);
    localStorage.setItem("vecinal-letra", grande ? "grande" : "normal");
  }, [grande]);

  useEffect(() => {
    document.documentElement.classList.toggle("alto-contraste", contraste);
    localStorage.setItem("vecinal-contraste", contraste ? "1" : "0");
  }, [contraste]);

  useEffect(() => {
    document.documentElement.classList.toggle("menos-movimiento", menosMov);
    localStorage.setItem("vecinal-movimiento", menosMov ? "0" : "1");
  }, [menosMov]);

  /* primer ingreso: recorrido guiado */
  useEffect(() => {
    if (!usuario || localStorage.getItem("vecinal-tour")) return;
    const t = setTimeout(() => abrirTour(), 900);
    return () => clearTimeout(t);
  }, [usuario, abrirTour]);

  /* el menú de cuenta se cierra al cambiar de pantalla o al tocar fuera */
  useEffect(() => { setMenu(false); }, [loc.pathname]);
  useEffect(() => {
    if (!menu) return;
    const fuera = (e) => { if (!cuenta.current?.contains(e.target)) setMenu(false); };
    document.addEventListener("click", fuera);
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", fuera); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const { data: avisos } = useQuery({
    queryKey: ["avisos", usuario?.id],
    queryFn: () => api.get("/api/notificaciones"),
    enabled: Boolean(usuario),
    refetchInterval: 60000,
  });

  const marcarLeidos = async () => {
    try { await api.post("/api/notificaciones/leer", {}); } catch { /* da igual */ }
  };

  const ir = (ruta) => { setMenu(false); nav(ruta); };

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <Icon name="home" className="brand-icon" size="1.3em" />
          <strong><span className="brand-full">Vecinal Solidaria</span><span className="brand-mini">Vecinal</span></strong>
        </Link>

        <nav className="mainnav" aria-label="Secciones principales">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-tour={n.tour}
              className={({ isActive }) => (isActive ? "on" : "")}>
              <Icon name={n.icon} />{n.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <button type="button" className="chip-zona" data-tour="zona" onClick={() => { setLocSel(zona); setLocOpen(true); }}>
            <Icon name="pin" /><span>{zona}</span>
          </button>
          {usuario && (
            <button type="button" className="campana" aria-label="Avisos" onClick={() => setAvisosOpen(true)}>
              <Icon name="bell" size="1.2em" />
              {avisos?.sin_leer > 0 && <span className="campana-badge">{avisos.sin_leer > 99 ? "99+" : avisos.sin_leer}</span>}
            </button>
          )}
          <div className="cuenta" ref={cuenta}>
            <button type="button" className={`avatar-btn ${usuario ? "" : "invitado"}`} data-tour="cuenta"
              aria-haspopup={usuario ? "menu" : undefined} aria-expanded={usuario ? menu : undefined}
              aria-label={usuario ? "Mi cuenta" : "Entrar"}
              onClick={(e) => {
                e.stopPropagation();
                if (!usuario) { ir("/perfil"); return; }
                setMenu(!menu);
              }}>
              {usuario ? String(usuario.nombre || "?").trim()[0] : <><Icon name="user" size="1.05em" /><span className="entrar-txt">Entrar</span></>}
            </button>
            {menu && usuario && (
              <div className="menu-cuenta" role="menu">
                <div className="menu-cabeza">
                  <b>{usuario?.nombre}</b>
                  <span>{usuario?.telefono} · {usuario?.zona}</span>
                </div>
                <button type="button" role="menuitem" onClick={() => ir("/perfil")}><Icon name="user" /> Mi perfil</button>
                <button type="button" role="menuitem" onClick={() => ir("/actividad")}><Icon name="clipboard" /> Mi actividad</button>
                <button type="button" role="menuitem" onClick={() => ir("/tutorial")}><Icon name="book" /> Tutorial</button>
                {esModerador && <button type="button" role="menuitem" onClick={() => ir("/moderacion")}><Icon name="shield" /> Moderación</button>}
                <hr />
                <button type="button" role="menuitem" onClick={() => setGrande(!grande)}>
                  <Icon name="text" /> {grande ? "Letra normal" : "Letra grande"}
                </button>
                <button type="button" role="menuitem" onClick={() => setContraste(!contraste)}>
                  <Icon name="eye" /> {contraste ? "Contraste normal" : "Alto contraste"}
                </button>
                <button type="button" role="menuitem" onClick={() => setMenosMov(!menosMov)}>
                  <Icon name="clock" /> {menosMov ? "Animaciones normales" : "Reducir movimiento"}
                </button>
                <button type="button" role="menuitem" className="peligro" onClick={async () => { await salir(); nav("/"); }}>
                  <Icon name="logout" /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "on" : "")}>
            <Icon name={n.icon} size="1.35em" /><span>{n.label === "Economía Local" ? "Local" : n.label}</span>
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
        <h2 className="sheet-title"><Icon name="bell" /> Avisos</h2>
        {(avisos?.items || []).length === 0 && <p className="hint">Sin avisos por ahora. Aquí llegan las respuestas a tus cotizaciones y los tratos.</p>}
        <div className="avisos-lista">
          {(avisos?.items || []).map((n) => (
            <button key={n.id} type="button" className={`aviso ${n.leida ? "" : "nueva"}`}
              onClick={() => {
                marcarLeidos();
                setAvisosOpen(false);
                const e = n.enlace || "";
                if (e.includes("tab=cotiz") || e.includes("mias")) nav("/actividad");
                else if (e.includes("emergencia")) nav("/emergencia");
                else nav("/");
              }}>
              <strong>{n.titulo}</strong>
              <p>{n.cuerpo}</p>
              <small>{hace(n.creado)}</small>
            </button>
          ))}
        </div>
        <div className="pubs-actions">
          <Btn className="wide" onClick={marcarLeidos}>Marcar todos como leídos</Btn>
        </div>
      </Sheet>
    </>
  );
}
