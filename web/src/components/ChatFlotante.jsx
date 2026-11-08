import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { Avatar, Badge, Empty } from "./ui";
import Conversacion from "./Conversacion";
import HiloAcciones from "./HiloAcciones";
import AvisoCobro from "./AvisoCobro";
import { hace, etiqueta } from "../lib/format";

/*
 * Ventana flotante del messenger. Se arrastra libremente por la pantalla,
 * rebota a los límites (sin tapar la cabecera ni la barra inferior) y, si la
 * sueltas en el centro, se desliza al borde más cercano. Solo muestra los
 * chats que nacieron de una publicación: no hay buscador ni chats nuevos.
 */

export default function ChatFlotante({ abierto, onCerrar, inicial = null }) {
  const [hilo, setHilo] = useState(inicial);     // {contexto, ref_id, ...}

  const { data } = useQuery({
    queryKey: ["conversaciones"],
    queryFn: () => api.get("/api/conversaciones"),
    enabled: abierto,
    refetchInterval: abierto ? 15000 : false,
  });
  const qc = useQueryClient();

  useEffect(() => { if (inicial) setHilo(inicial); }, [inicial]);

  if (!abierto) return null;

  const items = (data?.items || []).filter((i) => i.ultimo);
  const activo = hilo || null;
  const [estadoTxt, estadoTono] = activo ? etiqueta(activo.estado) : ["", ""];

  return (
    <aside className="chatflotante" role="dialog" aria-label="Mensajes">
      <header className="chatflotante-cab">
        {activo ? (
          <button type="button" className="linkbtn" aria-label="Volver a conversaciones"
            onClick={() => setHilo(null)}><Icon name="back" /></button>
        ) : <span className="chatflotante-ico"><Icon name="chat" /></span>}
        <div className="chatflotante-quien">
          <b>{activo ? activo.otro_nombre : "Mensajes"}</b>
          <span>{activo ? activo.titulo : "Conversaciones de tus publicaciones"}</span>
        </div>
        {activo && <Badge tono={estadoTono}>{estadoTxt}</Badge>}
      </header>

      {!activo && (
        <>
        <AvisoCobro onIr={setHilo} />
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
        </>
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
