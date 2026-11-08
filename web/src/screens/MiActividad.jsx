import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn, Badge, Empty, Field, Select, useToast, Segmented } from "../components/ui";
import Conversacion from "../components/Conversacion";
import { cap, etiqueta, hace, medios } from "../lib/format";

function comprimirPago(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 900;
      let { width: w, height: h } = img;
      if (w >= h && w > max) { h = Math.round((h * max) / w); w = max; }
      else if (h > w && h > max) { w = Math.round((w * max) / h); h = max; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.62));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No pudimos leer la imagen")); };
    img.src = url;
  });
}

const TABS = [
  { value: "registro", label: "Registro" },
  { value: "pubs", label: "Publicaciones" },
  { value: "cotiz", label: "Cotizaciones" },
  { value: "tratos", label: "Tratos" },
  { value: "favores", label: "Favores" },
  { value: "privacidad", label: "Privacidad" },
];

/* Panel de registro: qué hizo el vecino y qué quedó pendiente, en orden. */
function Registro() {
  const { usuario } = useAuth();
  const pubs = useQuery({ queryKey: ["mis-pubs"], queryFn: () => api.get("/api/mis-publicaciones") });
  const cots = useQuery({ queryKey: ["cotizaciones"], queryFn: () => api.get("/api/cotizaciones") });
  const tratos = useQuery({ queryKey: ["tratos"], queryFn: () => api.get("/api/tratos") });

  const listaPubs = Array.isArray(pubs.data) ? pubs.data : (pubs.data?.items || []);
  const listaCots = Array.isArray(cots.data) ? cots.data : (cots.data?.items || []);
  const listaTratos = Array.isArray(tratos.data) ? tratos.data : (tratos.data?.items || []);

  const eventos = useMemo(() => {
    const out = [];
    listaPubs.forEach((p) => out.push({
      ts: p.creado, icono: "store", tono: "",
      texto: `Publicaste «${p.titulo}»`,
      detalle: p.estado === "activa" ? "Activa" : cap(p.estado || ""),
    }));
    listaCots.forEach((c) => {
      out.push({ ts: c.creado, icono: "chat", tono: "", texto: `Pediste «${c.titulo}»`, detalle: cap(c.estado || "") });
      if (c.respuesta && c.respuesta !== "no_puedo") {
        out.push({
          ts: c.creado + 1, icono: "check", tono: "ok",
          texto: `El vecino respondió por «${c.titulo}»`,
          detalle: c.precio_respuesta ? `Precio: ${c.precio_respuesta}` : "Sí puede",
        });
      }
    });
    listaTratos.forEach((t) => {
      out.push({
        ts: t.creado, icono: "handshake", tono: "",
        texto: `Trato con ${t.vendedor_id === usuario?.id ? (t.comprador_nombre || "un vecino") : (t.vendedor_nombre || "un vecino")} por «${t.titulo}»`,
        detalle: `${t.monto || "monto a convenir"} · ${etiqueta(t.estado)[0]}`,
      });
      if (t.cerrado_en) out.push({
        ts: t.cerrado_en, icono: "thumb", tono: "ok",
        texto: `Trato cerrado: «${t.titulo}»`, detalle: "Ya puedes dejar tu visto bueno",
      });
    });
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 40);
  }, [listaPubs, listaCots, listaTratos, usuario?.id]);

  const cerrados = listaTratos.filter((t) => t.estado === "cerrado").length;
  const pendientes = listaTratos.filter((t) => t.estado !== "cerrado" && t.estado !== "cancelado").length;
  const cargando = pubs.isLoading || cots.isLoading || tratos.isLoading;

  return (
    <>
      <div className="registro-kpis">
        <div><b>{listaPubs.length}</b><span>Publicaciones</span></div>
        <div><b>{pendientes}</b><span>Tratos en curso</span></div>
        <div><b>{cerrados}</b><span>Cerrados</span></div>
      </div>

      {cargando && <div className="skeleton tall" />}
      {!cargando && eventos.length === 0 && (
        <Empty icon="clipboard" titulo="Sin actividad todavía"
          texto="Publica algo o pide un favor y aquí queda el registro." />
      )}

      <div className="registro">
        {eventos.map((e, i) => (
          <div className="evento" key={`${e.ts}-${i}`}>
            <span className={`evento-ico ${e.tono}`}><Icon name={e.icono} /></span>
            <div className="evento-txt">
              <b>{e.texto}</b>
              <span>{e.detalle}</span>
            </div>
            <time>{hace(e.ts)}</time>
          </div>
        ))}
      </div>
    </>
  );
}

export default function MiActividad() {
  const { usuario } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("registro");

  if (!usuario) return <Empty titulo="Entra a tu cuenta" />;

  return (
    <section className="view on" data-tour="actividad">
      <button type="button" className="volver" onClick={() => nav("/perfil")}>
        <Icon name="back" /> Volver a mi perfil
      </button>
      <div className="page-head">
        <h1>Mi actividad
          <span className="sub">Tus publicaciones, conversaciones, tratos y privacidad</span>
        </h1>
      </div>

      <Segmented scroll value={tab} onChange={setTab} options={TABS} />

      {tab === "registro" && <Registro />}
      {tab === "pubs" && <Publicaciones />}
      {tab === "cotiz" && <Cotizaciones />}
      {tab === "tratos" && <Tratos />}
      {tab === "favores" && <Intercambios />}
      {tab === "privacidad" && <Privacidad />}
    </section>
  );
}

/* ------------------------------------------------------------- publicaciones */
function Publicaciones() {
  const toast = useToast();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState({});

  const { data, isLoading } = useQuery({ queryKey: ["mis-pubs"], queryFn: () => api.get("/api/mis-publicaciones") });
  const refrescar = () => qc.invalidateQueries({ queryKey: ["mis-pubs"] });

  const guardar = async () => {
    try {
      await api.patch(`/api/publicaciones/${edit.id}`, {
        titulo: f.titulo ?? edit.titulo, descripcion: f.descripcion ?? edit.descripcion,
        precio: f.precio ?? edit.precio, zona: f.zona ?? edit.zona,
      });
      toast("Publicación actualizada"); setEdit(null); setF({}); refrescar();
    } catch (e) { toast(e.message, "err"); }
  };

  const estado = async (p, nuevo) => {
    try { await api.patch(`/api/publicaciones/${p.id}`, { estado: nuevo }); refrescar(); toast("Listo"); }
    catch (e) { toast(e.message, "err"); }
  };

  const borrar = async (p) => {
    if (!confirm(`¿Eliminar «${p.titulo}»? Dejará de verse. Tus tratos se conservan.`)) return;
    try { await api.del(`/api/publicaciones/${p.id}`); refrescar(); toast("Eliminada"); }
    catch (e) { toast(e.message, "err"); }
  };

  if (isLoading) return <div className="skeleton tall" />;
  if (!data?.length) return <Empty icon="clipboard" titulo="Todavía no publicaste nada"
    texto="Publica tu primer servicio, producto o favor." accion={<Link className="btn primary" to="/">Ir a Economía Local</Link>} />;

  return (
    <div className="lista">
      {data.map((p) => {
        const [txt, tono] = etiqueta(p.estado);
        return (
          <div className="fila" key={p.id}>
            <div className="fila-top"><b>{p.titulo}</b><Badge tono={tono}>{txt}</Badge></div>
            <p className="hint">{cap(p.categoria)} · {p.zona} · {hace(p.creado)} · {p.vistos ? `${p.vistos} visto${p.vistos === 1 ? "" : "s"}` : "sin vistos"} · {p.precio || "a convenir"}</p>

            {edit?.id === p.id ? (
              <div className="fila-edit">
                <Field label="Título" id="e-t"><input id="e-t" maxLength={120} defaultValue={p.titulo}
                  onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Field>
                <Field label="Descripción" id="e-d"><textarea id="e-d" rows={3} maxLength={600} defaultValue={p.descripcion}
                  onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Field>
                <div className="dos">
                  <Field label="Precio" id="e-p"><input id="e-p" defaultValue={p.precio}
                    onChange={(e) => setF({ ...f, precio: e.target.value })} /></Field>
                  <Field label="Sector" id="e-z"><input id="e-z" defaultValue={p.zona}
                    onChange={(e) => setF({ ...f, zona: e.target.value })} /></Field>
                </div>
                <div className="fila-acc">
                  <Btn size="small" onClick={() => { setEdit(null); setF({}); }}>Cancelar</Btn>
                  <Btn size="small" variant="primary" icon="check" onClick={guardar}>Guardar cambios</Btn>
                </div>
              </div>
            ) : (
              <div className="fila-acc">
                <Btn size="small" icon="tool" onClick={() => { setEdit(p); setF({}); }}>Editar</Btn>
                {p.estado === "activa"
                  ? <Btn size="small" icon="clock" onClick={() => estado(p, "pausada")}>Pausar</Btn>
                  : <Btn size="small" onClick={() => estado(p, "activa")}>Reactivar</Btn>}
                <Btn size="small" icon="trash" variant="danger" onClick={() => borrar(p)}>Eliminar</Btn>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- cotizaciones */
function Cotizaciones() {
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [responder, setResponder] = useState(null);
  const [chat, setChat] = useState(null);
  const [r, setR] = useState({ respuesta: "puedo", precio: "", nota: "" });

  const { data, isLoading } = useQuery({ queryKey: ["cotizaciones"], queryFn: () => api.get("/api/cotizaciones") });
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["cotizaciones"] });
    qc.invalidateQueries({ queryKey: ["tratos"] });
  };

  const enviarRespuesta = async () => {
    try {
      await api.post(`/api/cotizaciones/${responder.id}/responder`, {
        respuesta: r.respuesta, precio_respuesta: r.precio, nota: r.nota,
      });
      toast("Respuesta enviada"); setResponder(null); refrescar();
    } catch (e) { toast(e.message, "err"); }
  };

  const aceptar = async (c) => {
    try {
      await api.post(`/api/cotizaciones/${c.id}/aceptar`, { monto: c.precio_respuesta, politica: "contra_entrega" });
      toast("Trato abierto. Falta que el vecino lo confirme."); refrescar();
    } catch (e) { toast(e.message, "err"); }
  };

  if (isLoading) return <div className="skeleton tall" />;
  if (!data?.length) return <Empty icon="chat" titulo="Sin cotizaciones" texto="Cuando pidas o recibas una, aparece aquí con su conversación." />;

  return (
    <div className="lista">
      {data.map((c) => {
        const [txt, tono] = etiqueta(c.estado);
        const soyVendedor = c.autor_id === usuario?.id;
        const abierta = c.estado === "enviada";
        return (
          <div className="fila" key={c.id}>
            <div className="fila-top"><b>{c.titulo}</b><Badge tono={tono}>{txt}</Badge></div>
            <p className="hint">{soyVendedor ? `De ${c.comprador_nombre || "un vecino"}` : "La enviaste"} · {hace(c.creado)}</p>
            <p className="fila-msg">«{c.descripcion}»{c.medida ? ` · ${c.medida}` : ""}</p>
            {c.precio_respuesta && <p className="hint">Respuesta: <b>{c.precio_respuesta}</b>{c.nota_vendedor ? ` · ${c.nota_vendedor}` : ""}</p>}

            <div className="fila-acc">
              <Btn size="small" icon="chat" onClick={() => setChat(chat === c.id ? null : c.id)}>
                {chat === c.id ? "Ocultar" : "Conversación"}
              </Btn>
              {soyVendedor && abierta && <Btn size="small" variant="primary" onClick={() => { setResponder(c); setR({ respuesta: "puedo", precio: "", nota: "" }); }}>Responder</Btn>}
              {!soyVendedor && c.estado === "respondida" && <Btn size="small" variant="primary" icon="check" onClick={() => aceptar(c)}>Aceptar trato</Btn>}
            </div>

            {responder?.id === c.id && (
              <div className="fila-edit">
                <div className="pills">
                  {[["puedo", "Sí puedo"], ["precio", "Con otro precio"], ["no_puedo", "No puedo"]].map(([v, t]) => (
                    <button key={v} type="button" className={`pill ${r.respuesta === v ? "on" : ""}`} onClick={() => setR({ ...r, respuesta: v })}>{t}</button>
                  ))}
                </div>
                {r.respuesta === "precio" && (
                  <Field label="Precio propuesto" id="rr-p">
                    <input id="rr-p" value={r.precio} onChange={(e) => setR({ ...r, precio: e.target.value })} placeholder="S/ 45" />
                  </Field>
                )}
                <Field label="Nota" id="rr-n">
                  <input id="rr-n" value={r.nota} onChange={(e) => setR({ ...r, nota: e.target.value })} placeholder="Puedo mañana a las 10" />
                </Field>
                <div className="fila-acc">
                  <Btn size="small" onClick={() => setResponder(null)}>Cancelar</Btn>
                  <Btn size="small" variant="primary" onClick={enviarRespuesta}>Enviar respuesta</Btn>
                </div>
              </div>
            )}

            {chat === c.id && (
              <div className="fila-chat">
                <Conversacion contexto="cotizacion" refId={c.id} onNuevoMensaje={refrescar} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------- tratos */
function Tratos() {
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [chat, setChat] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ["tratos"], queryFn: () => api.get("/api/tratos") });
  const refrescar = () => qc.invalidateQueries({ queryKey: ["tratos"] });

  const accion = async (t, ruta, cuerpo) => {
    try { await api.post(`/api/tratos/${t.id}/${ruta}`, cuerpo || {}); refrescar(); toast("Hecho"); }
    catch (e) { toast(e.message, "err"); }
  };

  if (isLoading) return <div className="skeleton tall" />;
  if (!data?.length) return <Empty icon="handshake" titulo="Sin tratos" texto="Cuando acepten una cotización, el trato aparece aquí." />;

  return (
    <div className="lista">
      {data.map((t) => {
        const [txt, tono] = etiqueta(t.estado);
        const vendedor = t.vendedor_id === usuario?.id;
        const yoPague = vendedor ? t.pago_vendedor : t.pago_comprador;
        const yoCumpli = vendedor ? t.marca_vendedor : t.marca_comprador;
        return (
          <div className="fila" key={t.id}>
            <div className="fila-top"><b>{t.titulo}</b><Badge tono={tono}>{txt}</Badge></div>
            <p className="hint">{vendedor ? `Cliente: ${t.comprador_nombre}` : `Vendedor: ${t.vendedor_nombre}`} · {t.monto || "monto a convenir"}</p>
            <div className="pasos-trato">
              <span className={t.estado !== "pendiente" ? "hecho" : ""}>1. Acordado</span>
              <span className={t.estado === "pagado" || t.estado === "cerrado" ? "hecho" : ""}>2. Pagado</span>
              <span className={t.estado === "cerrado" ? "hecho" : ""}>3. Cumplido</span>
            </div>

            <div className="fila-acc">
              {t.estado === "pendiente" && vendedor && <Btn size="small" variant="primary" icon="check" onClick={() => accion(t, "confirmar")}>Confirmar trato</Btn>}
              {t.estado === "pendiente" && !vendedor && <span className="hint">Esperando que el vecino confirme</span>}
              {(t.estado === "acordado" || t.estado === "pagado") && !yoPague && (
                <>
                  <Btn size="small" variant="primary" icon="wallet" onClick={() => accion(t, "pago")}>
                    {vendedor ? "Confirmar que recibí el pago" : "Marcar que pagué"}
                  </Btn>
                  <label className="btn small file-adj">
                    <Icon name="camera" /> Adjuntar comprobante
                    <input type="file" accept="image/*" hidden onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        const data = await comprimirPago(file);
                        await api.post(`/api/tratos/${t.id}/comprobante`, { data });
                        toast("Comprobante adjuntado. Queda como evidencia del pago.");
                        refrescar();
                      } catch (err) { toast(err.message, "err"); }
                    }} />
                  </label>
                </>
              )}
              {(t.estado === "acordado" || t.estado === "pagado") && yoPague && !yoCumpli && (
                <Btn size="small" variant="primary" icon="check" onClick={() => accion(t, "cerrar")}>
                  {vendedor ? "Marcar que entregué" : "Marcar que recibí"}
                </Btn>
              )}
              <Btn size="small" icon="chat" onClick={() => setChat(chat === t.id ? null : t.id)}>
                {chat === t.id ? "Ocultar" : "Conversación"}
              </Btn>
            </div>

            {t.comprobante && (
              <a className="comprobante" href={t.comprobante} target="_blank" rel="noopener noreferrer">
                <img src={t.comprobante} alt="Comprobante del pago" />
                <span>Ver comprobante del pago</span>
              </a>
            )}

            {t.estado === "cerrado" && (
              <p className="hint fila-ok"><Icon name="check" /> Trato cerrado. Ya pueden dejar su visto bueno en la publicación.</p>
            )}

            {chat === t.id && <div className="fila-chat"><Conversacion contexto="trato" refId={t.id} onNuevoMensaje={refrescar} /></div>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- favores */
function Intercambios() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["intercambios"], queryFn: () => api.get("/api/intercambios") });

  const cambiar = async (i, estado) => {
    try { await api.post(`/api/intercambios/${i.id}/estado`, { estado }); qc.invalidateQueries({ queryKey: ["intercambios"] }); toast("Favor actualizado"); }
    catch (e) { toast(e.message, "err"); }
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
            {i.mensaje && <p className="fila-msg">«{i.mensaje}»</p>}
            {i.garante_nombre && <p className="hint"><Icon name="shield" /> Garante: {i.garante_nombre} · devolución {i.fecha_devolucion || "a coordinar"}</p>}
            <div className="fila-acc">
              {i.estado === "solicitada" && <Btn size="small" variant="primary" onClick={() => cambiar(i, "aceptada")}>Aceptar</Btn>}
              {i.estado === "aceptada" && <Btn size="small" onClick={() => cambiar(i, "en_curso")}>Empezar</Btn>}
              {i.estado === "en_curso" && <Btn size="small" variant="primary" onClick={() => cambiar(i, "resuelta")}>Terminado</Btn>}
              {i.estado !== "resuelta" && <Btn size="small" onClick={() => cambiar(i, "cancelada")}>Cancelar</Btn>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- privacidad */
function Privacidad() {
  const { usuario, recargar } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["accesos"], queryFn: () => api.get("/api/mis-accesos") });
  const [mostrar, setMostrar] = useState(usuario?.mostrar_contacto !== false);

  const cambiar = async (v) => {
    setMostrar(v);
    try {
      await api.put("/api/perfil", { mostrar_contacto: v });
      await recargar();
      qc.invalidateQueries({ queryKey: ["accesos"] });
      toast(v ? "Tu número vuelve a mostrarse" : "Tu número quedó oculto");
    } catch (e) { toast(e.message, "err"); }
  };

  return (
    <div className="lista">
      <div className="fila">
        <div className="fila-top"><b>Mi número y mis pagos</b>
          <Badge tono={mostrar ? "verde" : "gris"}>{mostrar ? "Visible" : "Oculto"}</Badge></div>
        <p className="hint">Con la cuenta siempre puedes escribir por aquí; el número solo lo ven vecinos con sesión.
          Si lo ocultas, igual te llegan cotizaciones y mensajes.</p>
        <label className="check">
          <input type="checkbox" checked={mostrar} onChange={(e) => cambiar(e.target.checked)} />
          Mostrar mi teléfono y Yape a otros vecinos con cuenta
        </label>
      </div>

      <p className="hint">Tu contacto se consultó <b>{data?.total || 0}</b> {data?.total === 1 ? "vez" : "veces"}.</p>
      {isLoading && <div className="skeleton" />}
      {(data?.items || []).map((a, k) => (
        <div className="fila" key={k}>
          <div className="fila-top"><b>{a.quien}</b><span className="hint">{hace(a.creado)}</span></div>
          <p className="hint">consultó «{a.titulo}»</p>
        </div>
      ))}
      {!isLoading && (!data?.items || data.items.length === 0) && (
        <Empty icon="lock" titulo="Nadie consultó tu contacto" texto="Cuando alguien lo vea, aparecerá aquí." />
      )}
    </div>
  );
}
