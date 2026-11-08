import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn, Segmented, Badge, Empty, Sheet, useToast } from "../components/ui";
import { cap, etiqueta, hace, medios } from "../lib/format";

export default function Actividad() {
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pubs");
  const [respuesta, setRespuesta] = useState(null);

  if (!usuario) {
    return (
      <section className="view on">
        <h1>Mi actividad</h1>
        <Empty icon="lock" titulo="Entra para ver tu actividad"
          texto="Aquí están tus publicaciones, cotizaciones, tratos y favores."
          accion={<Link className="btn primary" to="/perfil">Entrar a mi cuenta</Link>} />
      </section>
    );
  }

  return (
    <section className="view on">
      <h1>Mi actividad
        <span className="sub">Tus publicaciones, tus tratos y quién consultó tu contacto</span>
      </h1>
      <Segmented scroll value={tab} onChange={setTab} options={[
        { value: "pubs", label: "Publicaciones" },
        { value: "cotiz", label: "Cotizaciones" },
        { value: "tratos", label: "Tratos" },
        { value: "favores", label: "Favores" },
        { value: "accesos", label: "Contacto" },
      ]} />
      {tab === "pubs" && <Publicaciones />}
      {tab === "cotiz" && <Cotizaciones onResponder={setRespuesta} />}
      {tab === "tratos" && <Tratos />}
      {tab === "favores" && <Intercambios />}
      {tab === "accesos" && <Accesos />}

      <Sheet open={Boolean(respuesta)} onClose={() => setRespuesta(null)} titulo="Responder cotización" ancho={420}>
        {respuesta && (
          <Responder cot={respuesta} onDone={() => { setRespuesta(null); qc.invalidateQueries({ queryKey: ["cotizaciones"] }); }} />
        )}
      </Sheet>
    </section>
  );
}

/* --------------------------------------------------------------- publicaciones */
function Publicaciones() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["mis-pubs"], queryFn: () => api.get("/api/mis-publicaciones") });

  const cambiar = async (p, campos) => {
    try {
      await api.patch(`/api/publicaciones/${p.id}`, campos);
      qc.invalidateQueries({ queryKey: ["mis-pubs"] });
      toast("Publicación actualizada");
    } catch (e) { toast(e.message, "err"); }
  };

  const borrar = async (p) => {
    if (!confirm(`¿Eliminar «${p.titulo}»? Dejará de verse, pero tus tratos se conservan.`)) return;
    try { await api.del(`/api/publicaciones/${p.id}`); qc.invalidateQueries({ queryKey: ["mis-pubs"] }); toast("Publicación eliminada"); }
    catch (e) { toast(e.message, "err"); }
  };

  if (isLoading) return <div className="skeleton tall" />;
  if (!data?.length) return <Empty icon="clipboard" titulo="Todavía no publicaste nada" texto="Publica tu primer servicio o favor." accion={<Link className="btn primary" to="/">Ir a Economía Local</Link>} />;

  return (
    <div className="lista">
      {data.map((p) => {
        const [txt, tono] = etiqueta(p.estado);
        return (
          <div className="fila" key={p.id}>
            <div className="fila-top">
              <b>{p.titulo}</b>
              <Badge tono={tono}>{txt}</Badge>
            </div>
            <p className="hint">{cap(p.categoria)} · {p.zona} · {hace(p.creado)} · {p.vistos ? `${p.vistos} vistos buenos` : "sin vistos buenos"}</p>
            <div className="fila-acc">
              {p.estado === "activa"
                ? <Btn size="small" onClick={() => cambiar(p, { estado: "pausada" })}>Pausar</Btn>
                : <Btn size="small" onClick={() => cambiar(p, { estado: "activa" })}>Reactivar</Btn>}
              <Btn size="small" icon="trash" variant="danger" onClick={() => borrar(p)}>Eliminar</Btn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- cotizaciones */
function Cotizaciones({ onResponder }) {
  const { data, isLoading } = useQuery({ queryKey: ["cotizaciones"], queryFn: () => api.get("/api/cotizaciones") });
  if (isLoading) return <div className="skeleton tall" />;
  if (!data?.length) return <Empty icon="chat" titulo="Sin cotizaciones" texto="Cuando pidas o recibas una, aparecerá aquí." />;

  return (
    <div className="lista">
      {data.map((c) => {
        const [txt, tono] = etiqueta(c.estado);
        return (
          <div className="fila" key={c.id}>
            <div className="fila-top"><b>{c.titulo}</b><Badge tono={tono}>{txt}</Badge></div>
            <p className="hint">{c.descripcion} {c.medida ? `· ${c.medida}` : ""} {c.urgencia ? `· ${c.urgencia}` : ""}</p>
            <p className="hint">{c.es_mia ? "La enviaste" : `De ${c.comprador_nombre || "un vecino"}`} · {hace(c.creado)}</p>
            {c.estado === "enviada" && !c.es_mia && (
              <div className="fila-acc"><Btn size="small" variant="primary" onClick={() => onResponder(c)}>Responder</Btn></div>
            )}
            {c.respuesta && <p className="resp"><Icon name="check" /> {c.respuesta} {c.precio_respuesta || ""}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Responder({ cot, onDone }) {
  const toast = useToast();
  const [r, setR] = useState("puedo");
  const [precio, setPrecio] = useState("");
  const [nota, setNota] = useState("");
  return (
    <div>
      <p className="hint">Piden: {cot.descripcion}</p>
      <div className="pills">
        {[["puedo", "Sí puedo"], ["precio", "Con otro precio"], ["no_puedo", "No puedo"]].map(([v, t]) => (
          <button key={v} type="button" className={`pill ${r === v ? "on" : ""}`} onClick={() => setR(v)}>{t}</button>
        ))}
      </div>
      {r === "precio" && (
        <label className="field"><span>Precio propuesto</span>
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="S/ 25" />
        </label>
      )}
      <label className="field"><span>Nota (opcional)</span>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: puedo mañana a las 10" />
      </label>
      <Btn variant="primary" className="wide" onClick={async () => {
        try {
          await api.post(`/api/cotizaciones/${cot.id}/responder`, { respuesta: r, precio_respuesta: precio, nota });
          toast("Respuesta enviada"); onDone();
        } catch (e) { toast(e.message, "err"); }
      }}>Enviar respuesta</Btn>
    </div>
  );
}

/* --------------------------------------------------------------- tratos */
function Tratos() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tratos"], queryFn: () => api.get("/api/tratos") });

  const marcar = async (t, estado) => {
    try {
      await api.post(`/api/tratos/${t.id}/estado`, { estado });
      qc.invalidateQueries({ queryKey: ["tratos"] });
      toast(estado === "cerrado" ? "Marcado como cumplido. Falta la otra parte." : "Trato cancelado");
    } catch (e) { toast(e.message, "err"); }
  };

  if (isLoading) return <div className="skeleton tall" />;
  if (!data?.length) return <Empty icon="handshake" titulo="Sin tratos" texto="Cuando cierres un trato con un vecino, lo verás aquí." />;

  return (
    <div className="lista">
      {data.map((t) => {
        const [txt, tono] = etiqueta(t.estado);
        const yoComprador = t.comprador_id === t.yo_id || t.mi_rol === "comprador";
        return (
          <div className="fila" key={t.id}>
            <div className="fila-top"><b>{t.titulo}</b><Badge tono={tono}>{txt}</Badge></div>
            <p className="hint">{t.comprador_nombre} → {t.vendedor_nombre} · {t.monto || "monto a convenir"} · {hace(t.creado)}</p>
            <p className="hint">{t.marca_comprador ? "Comprador confirmó" : "Comprador pendiente"} · {t.marca_vendedor ? "Vendedor confirmó" : "Vendedor pendiente"}</p>
            {t.estado !== "cerrado" && t.estado !== "cancelado" && (
              <div className="fila-acc">
                <Btn size="small" variant="primary" onClick={() => marcar(t, "cerrado")}>Marcar cumplido</Btn>
                <Btn size="small" onClick={() => marcar(t, "cancelado")}>Cancelar</Btn>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- favores */
function Intercambios() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["intercambios"], queryFn: () => api.get("/api/intercambios") });

  const cambiar = async (i, estado) => {
    try {
      await api.post(`/api/intercambios/${i.id}/estado`, { estado });
      qc.invalidateQueries({ queryKey: ["intercambios"] });
      toast("Favor actualizado");
    } catch (e) { toast(e.message, "err"); }
  };

  if (isLoading) return <div className="skeleton tall" />;
  if (!data?.length) return <Empty icon="heart" titulo="Sin favores" texto="Pide o ofrece ayuda en la sección Favores." />;

  return (
    <div className="lista">
      {data.map((i) => {
        const [txt, tono] = etiqueta(i.estado);
        return (
          <div className="fila" key={i.id}>
            <div className="fila-top"><b>{i.titulo}</b><Badge tono={tono}>{txt}</Badge></div>
            <p className="hint">{i.solicitante_nombre} ↔ {i.ofertante_nombre} · {i.zona} · {hace(i.creado)}</p>
            {i.mensaje && <p className="hint">«{i.mensaje}»</p>}
            {i.garante_nombre && <p className="hint"><Icon name="shield" /> Garante: {i.garante_nombre} · devolución {i.fecha_devolucion || "a coordinar"}</p>}
            <div className="fila-acc">
              {i.estado === "solicitada" && <Btn size="small" variant="primary" onClick={() => cambiar(i, "aceptada")}>Aceptar</Btn>}
              {i.estado === "aceptada" && <Btn size="small" onClick={() => cambiar(i, "en_curso")}>En curso</Btn>}
              {i.estado === "en_curso" && <Btn size="small" variant="primary" onClick={() => cambiar(i, "resuelta")}>Resuelto</Btn>}
              {i.estado !== "resuelta" && <Btn size="small" onClick={() => cambiar(i, "cancelada")}>Cancelar</Btn>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- accesos */
function Accesos() {
  const { data, isLoading } = useQuery({ queryKey: ["accesos"], queryFn: () => api.get("/api/mis-accesos") });
  if (isLoading) return <div className="skeleton tall" />;
  return (
    <div className="lista">
      <p className="hint">Tu contacto se consultó <b>{data?.total || 0}</b> {data?.total === 1 ? "vez" : "veces"}.</p>
      {(data?.items || []).map((a, k) => (
        <div className="fila" key={k}>
          <div className="fila-top"><b>{a.quien}</b><span className="hint">{hace(a.creado)}</span></div>
          <p className="hint">consultó «{a.titulo}»</p>
        </div>
      ))}
      {(!data?.items || data.items.length === 0) && <Empty icon="lock" titulo="Nadie consultó tu contacto" texto="Cuando alguien lo vea, aparecerá aquí." />}
    </div>
  );
}
