import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { Avatar, Badge, Empty } from "../components/ui";
import Conversacion from "../components/Conversacion";
import HiloAcciones from "../components/HiloAcciones";
import { hace, etiqueta } from "../lib/format";

/* Bandeja de la vista web: lista de conversaciones a la izquierda y el hilo a la derecha. */
export default function Mensajes() {
  const { contexto, ref } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["conversaciones"],
    queryFn: () => api.get("/api/conversaciones"),
    refetchInterval: 20000,
  });

  const items = data?.items || [];
  const activo = items.find((i) => i.contexto === contexto && i.ref_id === ref);

  useEffect(() => { if (contexto && ref) document.title = "Mensajes · Vecinal Solidaria"; }, [contexto, ref]);

  return (
    <section className="view on msj-vista">
      <div className="page-head">
        <h1>Mensajes
          <span className="sub">Habla con el vecino que ofrece el servicio o el favor, sin salir de la app</span>
        </h1>
      </div>

      <div className={`msj ${activo ? "con-hilo" : ""}`}>
        <aside className="msj-lista">
          {isLoading && <div className="skeleton tall" />}
          {!isLoading && items.length === 0 && (
            <Empty icon="chat" titulo="Sin conversaciones"
              texto="Cuando le escribas a un vecino, el hilo aparece aquí." />
          )}
          {items.map((i) => {
            const on = activo && i.contexto === activo.contexto && i.ref_id === activo.ref_id;
            return (
              <button key={`${i.contexto}-${i.ref_id}`} type="button"
                className={`conv ${on ? "on" : ""}`}
                onClick={() => nav(`/mensajes/${i.contexto}/${i.ref_id}`)}>
                <Avatar nombre={i.otro_nombre} />
                <span className="conv-txt">
                  <span className="conv-top"><b>{i.otro_nombre}</b><time>{hace(i.ts)}</time></span>
                  <span className="conv-pub">{i.titulo}</span>
                  <span className="conv-ult">{i.ultimo || "Sin mensajes todavía"}</span>
                </span>
                {i.sin_leer > 0 && <span className="conv-n" aria-label={`${i.sin_leer} sin leer`}>{i.sin_leer}</span>}
              </button>
            );
          })}
        </aside>

        <div className="msj-hilo">
          {activo ? <Hilo key={`${activo.contexto}-${activo.ref_id}`} h={activo} /> : (
            <div className="msj-vacio">
              <Icon name="chat" size="1.8em" />
              <b>Elige una conversación</b>
              <p className="hint">A la izquierda están los vecinos con los que ya hablaste.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Hilo({ h }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [txt, tono] = etiqueta(h.estado);

  return (
    <>
      <header className="hilo-cab">
        <button type="button" className="linkbtn hilo-volver" onClick={() => nav("/mensajes")}>
          <Icon name="back" /> Conversaciones
        </button>
        <Avatar nombre={h.otro_nombre} />
        <div className="hilo-quien">
          <b>{h.otro_nombre}</b>
          <span>{h.titulo}</span>
        </div>
        <Badge tono={tono}>{txt}</Badge>
      </header>

      <HiloAcciones h={h} />

      <Conversacion contexto={h.contexto} refId={h.ref_id}
        onNuevoMensaje={() => {
          qc.invalidateQueries({ queryKey: ["conversaciones"] });
          qc.invalidateQueries({ queryKey: ["tratos"] });
        }} />
    </>
  );
}
