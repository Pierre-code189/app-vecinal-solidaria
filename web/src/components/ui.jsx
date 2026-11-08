import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, CAT_ICON } from "../lib/icons";
import { cap } from "../lib/format";

/* ---------------------------------------------------------------- botón */
export function Btn({ variant = "sec", size, icon, children, className = "", type = "button", ...props }) {
  const cls = ["btn", variant === "primary" && "primary", variant === "danger" && "danger",
    size === "small" && "small", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- campos */
export function Field({ label, hint, error, id, children, contador }) {
  return (
    <div className="field">
      {label && (
        <label htmlFor={id}>
          {label}
          {contador != null && <span className="contador">{contador}</span>}
        </label>
      )}
      {children}
      {hint && <p className="hint">{hint}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function Input({ id, ...props }) {
  return <input id={id} {...props} />;
}

/* ---------------------------------------------------------------- selector */
export function Select({ id, value, onChange, options, ariaLabel, className = "" }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({});
  const btn = useRef(null);
  const panel = useRef(null);

  const actual = options.find((o) => String(o.value) === String(value)) || options[0];

  const abrir = () => {
    const r = btn.current.getBoundingClientRect();
    const ancho = Math.min(r.width, window.innerWidth - 16);
    const abajo = window.innerHeight - r.bottom - 12;
    const arriba = r.top - 12;
    const hoja = abajo < 220 || window.matchMedia("(max-width: 759px)").matches;
    setPos(hoja
      ? { hoja: true }
      : {
          hoja: false, width: ancho, maxHeight: Math.max(160, Math.min(300, abajo)),
          left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)), top: r.bottom + 6,
        });
    setAbierto(true);
  };

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (btn.current?.contains(e.target) || panel.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const cerrar = () => setAbierto(false);
    document.addEventListener("click", fuera);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    const esc = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", fuera);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  return (
    <div className={`sel ${className}`}>
      <button ref={btn} type="button" className="sel-btn" aria-haspopup="listbox"
        aria-expanded={abierto} aria-label={`${ariaLabel || "Opción"}: ${actual?.label || ""}`}
        onClick={(e) => { e.stopPropagation(); abierto ? setAbierto(false) : abrir(); }}>
        <span className="sel-txt">{actual?.label}</span>
        <Icon name="chevron" className="sel-chev" />
      </button>
      {abierto && createPortal(
        <ul ref={panel} className={`sel-panel ${pos.hoja ? "hoja" : ""}`} role="listbox"
          style={pos.hoja ? undefined : pos}>
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={String(o.value) === String(value)}
              className="sel-op"
              onClick={() => { onChange(o.value); setAbierto(false); }}>
              <span>{o.label}</span>
              <Icon name="check" />
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- piezas */
export function Segmented({ value, onChange, options, scroll = false }) {
  return (
    <div className={`segmented ${scroll ? "scroll" : ""}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Badge = ({ tono = "", children }) => <span className={`badge ${tono}`}>{children}</span>;

export const Avatar = ({ nombre, cls = "" }) => (
  <span className={`avatar ${cls}`} aria-hidden="true">{String(nombre || "?").trim()[0] || "?"}</span>
);

export function Empty({ icon = "search", titulo, texto, accion }) {
  return (
    <div className="vacio">
      <Icon name={icon} />
      <b>{titulo}</b>
      {texto}
      {accion && <div style={{ marginTop: 12 }}>{accion}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, titulo, children, ancho = 720 }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal" onClick={(e) => e.target.classList.contains("modal") && onClose?.()}>
      <div className="modalbox" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={titulo}>
        <button type="button" className="close" aria-label="Cerrar" onClick={onClose}><Icon name="close" /></button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- avisos */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, tipo = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((actual) => [...actual, { id, msg, tipo }]);
    setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.tipo}`}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------------------------------------------------------- tarjeta */
export function Tarjeta({ p, onOpen, zona }) {
  const cat = CAT_ICON[p.categoria] || "dots";
  const nv = p.vistos || 0;
  let dist = null;
  if (p.ubicacion_aproximada && p.zona === zona) dist = "en tu sector";
  else if (p.distancia_km != null) dist = null; // se formatea abajo
  const foto = p.fotos && p.fotos.length ? p.fotos[0] : null;

  return (
    <article className="card pub" tabIndex={0} role="button"
      aria-label={`Ver detalle de ${p.titulo}`}
      onClick={() => onOpen(p)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(p)}>
      <div className="pub-top">
        {foto && <img className="thumb" src={foto} alt="" loading="lazy" />}
        <div className="pub-info">
          <div className="catrow">
            <span className="cat"><Icon name={cat} />{cap(p.categoria)}</span>
            <span className="catrow-right">
              {Boolean(p.es_emergencia) && <span className="badge rojo"><Icon name="alert" />Emergencia</span>}
              <span className="ver-mas" aria-hidden="true"><Icon name="back" /></span>
            </span>
          </div>
          <h3>{p.titulo}</h3>
          <p className="desc">{p.descripcion}</p>
          <div className="meta">
            {dist
              ? <span className="dist"><Icon name="pin" />{dist}</span>
              : p.distancia_km != null
                ? <span className="dist"><Icon name="pin" />{`a ${p.distancia_km < 1 ? Math.round(p.distancia_km * 1000) + " m" : p.distancia_km.toFixed(1).replace(".", ",") + " km"}`}</span>
                : null}
            <span className="visto" title={nv ? `${nv} vistos buenos` : "Sin visto bueno"}><Icon name="thumb" />{nv}</span>
          </div>
          <div className="precio">{p.precio || "A convenir"}</div>
          <div className="badges">
            {String(p.medios_pago || "").split(",").filter(Boolean).map((m) => (
              <span key={m} className="badge">{{ yape: "Yape", plin: "Plin", efectivo: "Efectivo", transferencia: "Transferencia", intercambio: "Intercambio" }[m] || m}</span>
            ))}
          </div>
          <p className="quien"><Avatar nombre={p.nombre} /><span className="quien-txt">{p.nombre} · {p.zona}</span></p>
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- mapa */
export function MiniMapa({ lat, lng, nombre }) {
  const celdas = useMemo(() => {
    const n = 2 ** 16;
    if (lat == null || lng == null) return [];
    const xt = Math.floor(((lng + 180) / 360) * n);
    const yt = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
    const out = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = ((xt + dx) % n + n) % n;
        out.push({ x, y: yt + dy, sub: "abc"[(xt + yt) % 3] });
      }
    }
    return out;
  }, [lat, lng]);

  if (!celdas.length) return null;
  return (
    <>
      <div className="minimapa" role="img" aria-label={`Ubicación aproximada de ${nombre || "la publicación"}`}>
        <div className="tiles">
          {celdas.map((c) => (
            <img key={`${c.x}-${c.y}`} alt="" loading="lazy"
              src={`https://${c.sub}.tile.openstreetmap.fr/osmfr/16/${c.x}/${c.y}.png`}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.alt) { img.style.visibility = "hidden"; return; }
                img.dataset.alt = "1";
                img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/16/${c.y}/${c.x}`;
              }} />
          ))}
        </div>
        <span className="pin"><Icon name="pin" /></span>
        <span className="credito">© OpenStreetMap</span>
      </div>
      <p className="hint">
        Ubicación aproximada (±400 m). El punto exacto se coordina por WhatsApp.{" "}
        <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
          target="_blank" rel="noopener noreferrer">Ver el sector en el mapa</a>.
      </p>
    </>
  );
}
