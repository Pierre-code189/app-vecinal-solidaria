import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { Avatar, Badge, Empty } from "./ui";
import Conversacion from "./Conversacion";
import HiloAcciones from "./HiloAcciones";
import { hace, etiqueta } from "../lib/format";

/*
 * Ventana flotante del messenger. Se arrastra libremente por la pantalla,
 * rebota a los límites (sin tapar la cabecera ni la barra inferior) y, si la
 * sueltas en el centro, se desliza al borde más cercano. Solo muestra los
 * chats que nacieron de una publicación: no hay buscador ni chats nuevos.
 */

const MARGEN = 8;

export default function ChatFlotante({ abierto, onCerrar, inicial = null }) {
  const [pos, setPos] = useState(null);          // {l, t} en px de viewport
  const [tam, setTam] = useState({ w: 360, h: 520 });
  const [drag, setDrag] = useState(false);
  const [hilo, setHilo] = useState(inicial);     // {contexto, ref_id, ...}
  const caja = useRef(null);
  const suje = useRef(null);

  const { data } = useQuery({
    queryKey: ["conversaciones"],
    queryFn: () => api.get("/api/conversaciones"),
    enabled: abierto,
    refetchInterval: abierto ? 15000 : false,
  });
  const qc = useQueryClient();

  /* tamaño y posición inicial: abajo a la derecha, sobre la barra inferior */
  useEffect(() => {
    if (!abierto) return;
    const medir = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const bajo = window.matchMedia("(max-width:719px)").matches;
      const w = Math.min(380, vw - MARGEN * 2);
      const h = Math.min(540, vh - 150);
      setTam({ w, h });
      setPos((p) => p || {
        l: Math.max(MARGEN, vw - w - 16),
        t: Math.max(72, vh - (bajo ? 64 : 0) - h - 16),
      });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [abierto]);

  useEffect(() => { if (inicial) setHilo(inicial); }, [inicial]);

  const limites = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bajo = window.matchMedia("(max-width:719px)").matches;
    const arriba = 64 + MARGEN;                       // barra superior
    const abajo = vh - (bajo ? 64 : 0) - MARGEN;      // barra inferior + margen
    return {
      lMin: MARGEN, lMax: vw - tam.w - MARGEN,
      tMin: arriba, tMax: Math.max(arriba, abajo - tam.h),
      vw, vh, bajo,
    };
  };

  /* Arrastre desde la cabecera con escucha en window: sigue fuera de la caja. */
  const arrastrar = (e) => {
    if (e.target.closest("button") || !pos) return;
    const ini = { x: e.clientX, y: e.clientY, l: pos.l, t: pos.t };
    setDrag(true);

    const mover = (ev) => {
      const { lMin, lMax, tMin, tMax } = limites();
      setPos({
        l: Math.min(Math.max(ini.l + (ev.clientX - ini.x), lMin - 28), Math.max(lMin, lMax) + 28),
        t: Math.min(Math.max(ini.t + (ev.clientY - ini.y), tMin - 28), Math.max(tMin, tMax) + 28),
      });
    };

    const fin = (ev) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", fin);
      window.removeEventListener("pointercancel", fin);
      const { lMin, lMax, tMin, tMax, vw, vh } = limites();
      let l = Math.min(Math.max(ini.l + (ev.clientX - ini.x), lMin), Math.max(lMin, lMax));
      const t = Math.min(Math.max(ini.t + (ev.clientY - ini.y), tMin), Math.max(tMin, tMax));
      /* en el centro estorba: se va al borde horizontal más cercano */
      const cx = (l + tam.w / 2) / vw;
      const cy = (t + tam.h / 2) / vh;
      if (cx > 0.32 && cx < 0.68 && cy > 0.28 && cy < 0.72) l = cx < 0.5 ? lMin : lMax;
      setDrag(false);
      setPos({ l, t });
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", fin);
    window.addEventListener("pointercancel", fin);
  };

  if (!abierto) return null;

  const items = (data?.items || []).filter((i) => i.ultimo);
  const activo = hilo || null;
  const [estadoTxt, estadoTono] = activo ? etiqueta(activo.estado) : ["", ""];

  return (
    <aside className="chatflotante" ref={caja} role="dialog" aria-label="Mensajes"
      style={{
        left: pos?.l, top: pos?.t, width: tam.w, height: tam.h,
        transition: drag ? "none" : "left .22s var(--ease), top .22s var(--ease)",
      }}>
      <header className="chatflotante-cab" onPointerDown={arrastrar}
        style={{ cursor: drag ? "grabbing" : "grab" }}>
        {activo ? (
          <button type="button" className="linkbtn" aria-label="Volver a conversaciones"
            onClick={() => setHilo(null)}><Icon name="back" /></button>
        ) : <span className="chatflotante-ico"><Icon name="chat" /></span>}
        <div className="chatflotante-quien">
          <b>{activo ? activo.otro_nombre : "Mensajes"}</b>
          <span>{activo ? activo.titulo : "Conversaciones de tus publicaciones"}</span>
        </div>
        {activo && <Badge tono={estadoTono}>{estadoTxt}</Badge>}
        <button type="button" className="linkbtn chatflotante-x" aria-label="Cerrar mensajes" onClick={onCerrar}>
          <Icon name="close" />
        </button>
      </header>

      {!activo && (
        <div className="chatflotante-lista">
          {items.length === 0 && (
            <Empty icon="chat" titulo="Sin conversaciones"
              texto="Cuando escribas desde una publicación, el chat aparece aquí." />
          )}
          {items.map((i) => (
            <button key={`${i.contexto}-${i.ref_id}`} type="button" className="conv"
              onClick={() => { setHilo(i); api.get(`/api/mensajes?contexto=${i.contexto}&ref=${i.ref_id}`).catch(() => {}); qc.invalidateQueries({ queryKey: ["conversaciones"] }); }}>
              <Avatar nombre={i.otro_nombre} />
              <span className="conv-txt">
                <span className="conv-top"><b>{i.otro_nombre}</b><time>{hace(i.ts)}</time></span>
                <span className="conv-pub">{i.titulo}</span>
                <span className="conv-ult">{i.ultimo}</span>
              </span>
              {i.sin_leer > 0 && <span className="conv-n">{i.sin_leer}</span>}
            </button>
          ))}
        </div>
      )}

      {activo && (
        <div className="chatflotante-hilo">
          <HiloAcciones h={activo} />
          <Conversacion contexto={activo.contexto} refId={activo.ref_id}
            onNuevoMensaje={() => qc.invalidateQueries({ queryKey: ["conversaciones"] })} />
        </div>
      )}
    </aside>
  );
}
