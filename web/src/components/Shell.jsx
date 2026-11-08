import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon } from "../lib/icons";
import { Sheet, Select, Btn, useToast } from "./ui";
import Publicar from "./Publicar";
import ChatFlotante from "./ChatFlotante";
import { useQueryClient } from "@tanstack/react-query";
import { abrirPublicar } from "../lib/publicar";
import { useTour } from "./Tour";
import { hace } from "../lib/format";

const NAV = [
  { to: "/", icon: "store", label: "Economía Local", end: true, tour: "local" },
  { to: "/favores", icon: "solidaridad", label: "Favores", tour: "favores" },
  { to: "/emergencia", icon: "alert", label: "Emergencia", tour: "emergencia" },
];

export function Shell({ children }) {
  const { usuario, salir, esModerador } = useAuth();
  const { zonas, zona, setZona, usarGPS } = useZona();
  const { abrir: abrirTour } = useTour();
  const [locOpen, setLocOpen] = useState(false);
  const [locSel, setLocSel] = useState(zona);
  const [avisosOpen, setAvisosOpen] = useState(false);
  const [pubMenu, setPubMenu] = useState(false);
  const [pubForm, setPubForm] = useState(null); // servicio | favor | emergencia
  const qc = useQueryClient();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [grande, setGrande] = useState(() => localStorage.getItem("vecinal-letra") === "grande");
  const [contraste, setContraste] = useState(() => localStorage.getItem("vecinal-contraste") === "1");
  const [menosMov, setMenosMov] = useState(() => localStorage.getItem("vecinal-movimiento") === "0");
  const nav = useNavigate();
  const loc = useLocation();
  const publicado = () => {
    qc.invalidateQueries({ queryKey: ["lista"] });
    qc.invalidateQueries({ queryKey: ["recursos"] });
    qc.invalidateQueries({ queryKey: ["recursos-todos"] });
    qc.invalidateQueries({ queryKey: ["mis-pubs"] });
  };
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

  /* el botón central (y cualquier pantalla) piden publicar */
  useEffect(() => {
    const pedir = (e) => {
      const tipo = e.detail || "";
      if (tipo === "servicio" || tipo === "favor" || tipo === "emergencia") { setPubMenu(false); setPubForm(tipo); }
      else setPubMenu(true);
    };
    window.addEventListener("vecinal:publicar", pedir);
    return () => window.removeEventListener("vecinal:publicar", pedir);
  }, []);

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

  const ir = (ruta) => { setMenu(false); setAcces(false); nav(ruta); };

  const [subir, setSubir] = useState(false);
  const [acces, setAcces] = useState(false);
  /* El botón de mensajes se mueve por toda la pantalla, con rebote. */
  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vecinal-fab2") || "null"); }
    catch { return null; }
  });
  const [chatAbierto, setChatAbierto] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const arrastre = useRef(null);

  const limitesFab = () => {
    const bajo = window.innerWidth < 720;
    return {
      lMin: 8, lMax: window.innerWidth - 54 - 8,
      tMin: 64 + 8, tMax: window.innerHeight - 54 - 8 - (bajo ? 64 : 0),
    };
  };

  useEffect(() => {
    document.body.classList.toggle("chat-abierto", chatAbierto);
  }, [chatAbierto]);

  /* Red de seguridad: pase lo que pase, el botón nunca sale de su franja. */
  useEffect(() => {
    if (!pos) return;
    const { lMin, lMax, tMin, tMax } = limitesFab();
    const l = Math.min(Math.max(pos.l, lMin), Math.max(lMin, lMax));
    const t = Math.min(Math.max(pos.t, tMin), Math.max(tMin, tMax));
    if (l !== pos.l || t !== pos.t) setPos({ l, t });
  }, [pos]);

  useEffect(() => {
    if (pos) return;
    const { lMax, tMax } = limitesFab();
    setPos({ l: lMax, t: tMax });
  }, [pos]);

  /* Arrastre con escucha en window: así sigue aunque el dedo salga del botón. */
  const arrastrarFab = (e) => {
    if (!pos) return;
    const ini = { x: e.clientX, y: e.clientY, l: pos.l, t: pos.t };
    let movido = 0;
    setMoviendo(true);

    const mover = (ev) => {
      const dx = ev.clientX - ini.x;
      const dy = ev.clientY - ini.y;
      movido = Math.max(movido, Math.abs(dx) + Math.abs(dy));
      const { lMin, lMax, tMin, tMax } = limitesFab();
      setPos({
        l: Math.min(Math.max(ini.l + dx, lMin - 24), Math.max(lMin, lMax) + 24),
        t: Math.min(Math.max(ini.t + dy, tMin - 24), Math.max(tMin, tMax) + 24),
      });
    };

    const fin = (ev) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", fin);
      window.removeEventListener("pointercancel", fin);
      const { lMin, lMax, tMin, tMax } = limitesFab();
      const nl = Math.min(Math.max(ini.l + (ev.clientX - ini.x), lMin), Math.max(lMin, lMax));
      const nt = Math.min(Math.max(ini.t + (ev.clientY - ini.y), tMin), Math.max(tMin, tMax));
      let l = nl;
      const cx = (nl + 27) / window.innerWidth;
      const cy = (nt + 27) / window.innerHeight;
      /* si lo sueltan en el centro, se va al borde horizontal más cercano */
      if (cx > 0.32 && cx < 0.68 && cy > 0.25 && cy < 0.75) l = cx < 0.5 ? lMin : lMax;
      arrastre.current = { movido };
      setMoviendo(false);
      setPos({ l, t: nt });
      localStorage.setItem("vecinal-fab2", JSON.stringify({ l, t: nt }));
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", fin);
    window.addEventListener("pointercancel", fin);
  };
  const accesRef = useRef(null);

  useEffect(() => {
    if (!acces) return;
    const fuera = (e) => { if (accesRef.current && !accesRef.current.contains(e.target)) setAcces(false); };
    const esc = (e) => { if (e.key === "Escape") setAcces(false); };
    document.addEventListener("click", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", fuera); document.removeEventListener("keydown", esc); };
  }, [acces]);

  useEffect(() => {
    const cerrar = () => { setAcces(false); setMenu(false); };
    window.addEventListener("hashchange", cerrar);
    return () => window.removeEventListener("hashchange", cerrar);
  }, []);
  useEffect(() => {
    const alScroll = () => setSubir(window.scrollY > 360);
    window.addEventListener("scroll", alScroll, { passive: true });
    alScroll();
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

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
          <button type="button" className="chip-zona" data-tour="zona" title={zona} onClick={() => { setLocSel(zona); setLocOpen(true); }}>
            <Icon name="pin" /><span>{zona}</span>
          </button>
          <div className="acces" ref={accesRef}>
            <button type="button" className="campana" aria-label="Accesibilidad" aria-expanded={acces}
              onClick={() => setAcces(!acces)}><Icon name="eye" size="1.15em" /></button>
            {acces && (
              <div className="menu-cuenta acces-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => setGrande(!grande)}>
                  <Icon name="text" /> {grande ? "Letra normal" : "Letra grande"}
                </button>
                <button type="button" role="menuitem" onClick={() => setContraste(!contraste)}>
                  <Icon name="eye" /> {contraste ? "Contraste normal" : "Alto contraste"}
                </button>
                <button type="button" role="menuitem" onClick={() => setMenosMov(!menosMov)}>
                  <Icon name="clock" /> {menosMov ? "Animaciones normales" : "Reducir movimiento"}
                </button>
              </div>
            )}
          </div>
          {usuario && (
            <button type="button" className="campana" aria-label="Avisos" onClick={() => setAvisosOpen(true)}>
              <Icon name="bell" size="1.2em" />
              {avisos?.sin_leer > 0 && <span className="campana-badge">{avisos.sin_leer > 99 ? "99+" : avisos.sin_leer}</span>}
            </button>
          )}
          <button type="button" className="btn primary publicar-top" onClick={() => setPubMenu(true)}>
            <Icon name="plus" /> Publicar
          </button>
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
                <button type="button" role="menuitem" onClick={() => ir("/mensajes")}><Icon name="chat" /> Mensajes</button>
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

      <nav className="tabbar" aria-label="Secciones principales">
        {NAV.slice(0, 2).map((n, i) => (
          <NavLink key={n.to} to={n.to} end={n.end} data-sec={i === 0 ? "local" : "favores"}
            className={({ isActive }) => (isActive ? "on" : "")}>
            <Icon name={n.icon} /><span>{i === 0 ? "Local" : n.label}</span>
          </NavLink>
        ))}
        <button type="button" aria-label="Publicar" onClick={() => setPubMenu(true)}
          className={`tab-publicar ${loc.pathname === "/favores" ? "sec-favores"
            : loc.pathname === "/emergencia" ? "sec-emergencia"
            : loc.pathname === "/" ? "sec-local" : "sec-perfil"}`}>
          <Icon name="plus" size="1.5em" />
        </button>
        <NavLink to="/emergencia" end data-sec="emergencia" className={({ isActive }) => (isActive ? "on" : "")}>
          <Icon name="alert" /><span>Emergencia</span>
        </NavLink>
        <NavLink to="/perfil" data-sec="perfil" className={({ isActive }) => (isActive ? "on" : "")}>
          <Icon name="user" /><span>{usuario ? "Perfil" : "Entrar"}</span>
        </NavLink>
      </nav>

      <div className="flotantes"
        style={{
          left: pos?.l, top: pos?.t,
          transition: moviendo ? "none" : "left .22s var(--ease), top .22s var(--ease)",
        }}>
        <button type="button" className={`fab-top ${subir ? "vis" : ""}`} aria-label="Volver arriba"
          aria-hidden={!subir} tabIndex={subir ? 0 : -1}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="arrow-up" aria-hidden="true">↑</span>
        </button>
        <button type="button" className="fab-msg" aria-label="Mensajes"
          aria-expanded={chatAbierto}
          style={{ touchAction: "none" }}
          onPointerDown={arrastrarFab}
          onClick={() => {
            if ((arrastre.current?.movido || 0) > 8) return;   // fue un arrastre, no un toque
            if (!usuario) { ir("/perfil"); return; }
            setChatAbierto((v) => !v);
          }}>
          <Icon name="chat" />
          {avisos?.sin_leer > 0 && <span className="fab-msg-badge">{avisos.sin_leer > 9 ? "9+" : avisos.sin_leer}</span>}
        </button>
      </div>

      <ChatFlotante abierto={chatAbierto} onCerrar={() => setChatAbierto(false)} />

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

      {/* ---- publicar: elegir el tipo y abrir su formulario ---- */}
      <Sheet open={pubMenu} onClose={() => setPubMenu(false)} titulo="Publicar" ancho={460}>
        <h2 className="sheet-title">¿Qué quieres publicar?</h2>
        <p className="hint">Elige el tipo y te llevo al formulario.</p>
        <div className="pub-opciones">
          {[
            { tipo: "servicio", ico: "store", tono: "verde", t: "Ofrecer un servicio o producto", d: "Lo que sabes hacer o lo que vendes" },
            { tipo: "favor", ico: "solidaridad", tono: "azul", t: "Pedir u ofrecer ayuda", d: "Un favor entre vecinos, sin dinero" },
            { tipo: "emergencia", ico: "alert", tono: "rojo", t: "Aviso de emergencia", d: "Agua, comida, techo o traslado urgente" },
          ].map((o) => (
            <button key={o.tipo} type="button" className="pub-opcion"
              onClick={() => { setPubMenu(false); setPubForm(o.tipo); }}>
              <span className={`pub-opcion-ico ${o.tono}`}><Icon name={o.ico} /></span>
              <span className="pub-opcion-txt"><b>{o.t}</b><em>{o.d}</em></span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
      </Sheet>

      <Publicar key={pubForm || "cerrado"} open={Boolean(pubForm)} modo={pubForm || "servicio"}
        onClose={() => setPubForm(null)} onPublicado={publicado} />
    </>
  );
}
