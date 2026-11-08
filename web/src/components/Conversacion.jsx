import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn, useToast } from "./ui";
import { hace } from "../lib/format";

/* Conversación de una cotización o de un trato. Libre, sin plantillas. */
export default function Conversacion({ contexto, refId, onNuevoMensaje }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const fin = useRef(null);

  const cargar = async () => {
    try {
      const d = await api.get(`/api/mensajes?contexto=${contexto}&ref=${refId}`);
      setItems(d.items || []);
    } catch { /* silencio */ }
    finally { setCargando(false); }
  };

  useEffect(() => { if (refId) cargar(); }, [contexto, refId]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest" }); }, [items.length]);

  const enviar = async (e) => {
    e?.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      await api.post("/api/mensajes", { contexto, ref_id: refId, texto: t });
      setTexto("");
      await cargar();
      onNuevoMensaje?.();
    } catch (err) { toast(err.message, "err"); }
    finally { setEnviando(false); }
  };

  return (
    <div className="chat">
      <div className="chat-lista">
        {cargando && <p className="hint">Cargando conversación…</p>}
        {!cargando && items.length === 0 && (
          <p className="hint">Aún no hay mensajes. Escribe el primero: coordina precio, hora o lugar.</p>
        )}
        {items.map((m) => {
          const mio = m.de_id === usuario?.id;
          return (
            <div key={m.id} className={`burbuja ${mio ? "mia" : "suya"}`}>
              {!mio && <span className="burbuja-autor">{m.de_nombre}</span>}
              <p>{m.texto}</p>
              <time>{hace(m.creado)}</time>
            </div>
          );
        })}
        <div ref={fin} />
      </div>
      <form className="chat-form" onSubmit={enviar}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={600}
          placeholder="Escribe un mensaje…" aria-label="Mensaje" />
        <Btn type="submit" variant="primary" icon="chat" disabled={enviando || !texto.trim()}>
          {enviando ? "…" : "Enviar"}
        </Btn>
      </form>
    </div>
  );
}
