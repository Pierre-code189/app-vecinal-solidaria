import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useTema } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { BarraVolver } from "../components/Header";
import { Badge, Btn, Check, Empty, Field, Input, Segmented, Select, Skeleton, useToast } from "../components/ui";
import { cap, etiqueta, hace } from "../lib/format";
import { F, R, S } from "../lib/theme";

const TABS = [
  { value: "registro", label: "Registro" },
  { value: "pubs", label: "Publicaciones" },
  { value: "cotiz", label: "Cotizaciones" },
  { value: "tratos", label: "Tratos" },
  { value: "favores", label: "Favores" },
  { value: "privacidad", label: "Privacidad" },
];

export default function Actividad() {
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("registro");

  if (!usuario) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BarraVolver titulo="Mi actividad" />
        <View style={{ padding: 16 }}>
          <Empty icon="clipboard" titulo="Entra a tu cuenta" texto="Aquí ves tus publicaciones, tratos y consultas." />
          <Btn variant="primary" onPress={() => router.push("/auth")}>Entrar</Btn>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo="Mi actividad" />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 24 * escala }}>Mi actividad</Text>
        <Text style={{ color: c.muted, fontSize: 13 * escala, marginBottom: 12, lineHeight: 19 * escala }}>
          Tus publicaciones, conversaciones, tratos y privacidad.
        </Text>
        <Segmented scroll value={tab} onChange={setTab} options={TABS} />
        <View style={{ marginTop: 12 }}>
          {tab === "registro" ? <Registro /> : null}
          {tab === "pubs" ? <Publicaciones /> : null}
          {tab === "cotiz" ? <Cotizaciones /> : null}
          {tab === "tratos" ? <Tratos /> : null}
          {tab === "favores" ? <Intercambios /> : null}
          {tab === "privacidad" ? <Privacidad /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Registro() {
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const pubs = useQuery({ queryKey: ["mis-pubs"], queryFn: () => api.get("/api/mis-publicaciones") });
  const cots = useQuery({ queryKey: ["cotizaciones"], queryFn: () => api.get("/api/cotizaciones") });
  const tratos = useQuery({ queryKey: ["tratos"], queryFn: () => api.get("/api/tratos") });

  const listaPubs = Array.isArray(pubs.data) ? pubs.data : pubs.data?.items || [];
  const listaCots = Array.isArray(cots.data) ? cots.data : cots.data?.items || [];
  const listaTratos = Array.isArray(tratos.data) ? tratos.data : tratos.data?.items || [];

  const eventos = useMemo(() => {
    const out = [];
    listaPubs.forEach((p) =>
      out.push({
        ts: p.creado,
        icono: "store",
        tono: "",
        texto: `Publicaste «${p.titulo}»`,
        detalle: p.estado === "activa" ? "Activa" : cap(p.estado || ""),
      }),
    );
    listaCots.forEach((co) => {
      out.push({ ts: co.creado, icono: "chat", tono: "", texto: `Pediste «${co.titulo}»`, detalle: cap(co.estado || "") });
      if (co.respuesta && co.respuesta !== "no_puedo") {
        out.push({
          ts: co.creado + 1,
          icono: "check",
          tono: "ok",
          texto: `El vecino respondió por «${co.titulo}»`,
          detalle: co.precio_respuesta ? `Precio: ${co.precio_respuesta}` : "Sí puede",
        });
      }
    });
    listaTratos.forEach((t) => {
      out.push({
        ts: t.creado,
        icono: "handshake",
        tono: "",
        texto: `Trato con ${t.vendedor_id === usuario?.id ? t.comprador_nombre || "un vecino" : t.vendedor_nombre || "un vecino"} por «${t.titulo}»`,
        detalle: `${t.monto || "monto a convenir"} · ${etiqueta(t.estado)[0]}`,
      });
      if (t.cerrado_en) {
        out.push({ ts: t.cerrado_en, icono: "thumb", tono: "ok", texto: `Trato cerrado: «${t.titulo}»`, detalle: "Ya puedes dejar tu visto bueno" });
      }
    });
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 40);
  }, [listaPubs, listaCots, listaTratos, usuario?.id]);

  const cerrados = listaTratos.filter((t) => t.estado === "cerrado").length;
  const pendientes = listaTratos.filter((t) => t.estado !== "cerrado" && t.estado !== "cancelado").length;
  const cargando = pubs.isLoading || cots.isLoading || tratos.isLoading;

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Kpi valor={listaPubs.length} texto="Publicaciones" />
        <Kpi valor={pendientes} texto="Tratos en curso" />
        <Kpi valor={cerrados} texto="Cerrados" />
      </View>

      {cargando ? <Skeleton height={120} /> : null}
      {!cargando && eventos.length === 0 ? (
        <Empty icon="clipboard" titulo="Sin actividad todavía" texto="Publica algo o pide un favor y aquí queda el registro." />
      ) : null}

      <View style={{ marginTop: 10, gap: 8 }}>
        {eventos.map((e, i) => (
          <View key={`${e.ts}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.sm, padding: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: e.tono === "ok" ? c.brand50 : c.surface2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={e.icono} size={16} color={e.tono === "ok" ? c.brand700 : c.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 13 * escala }}>{e.texto}</Text>
              <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>{e.detalle}</Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 10.5 * escala }}>{hace(e.ts)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Kpi({ valor, texto }) {
  const { c, escala } = useTema();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.md, paddingVertical: 10, alignItems: "center" }}>
      <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala }}>{valor}</Text>
      <Text style={{ color: c.muted, fontSize: 10 * escala, textAlign: "center" }}>{texto}</Text>
    </View>
  );
}

function Publicaciones() {
  const { c, escala } = useTema();
  const toast = useToast();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState({});

  const { data, isLoading } = useQuery({ queryKey: ["mis-pubs"], queryFn: () => api.get("/api/mis-publicaciones") });
  const refrescar = () => qc.invalidateQueries({ queryKey: ["mis-pubs"] });
  const lista = Array.isArray(data) ? data : data?.items || [];

  const guardar = async () => {
    try {
      await api.patch(`/api/publicaciones/${edit.id}`, {
        titulo: f.titulo ?? edit.titulo,
        descripcion: f.descripcion ?? edit.descripcion,
        precio: f.precio ?? edit.precio,
        zona: f.zona ?? edit.zona,
      });
      toast("Publicación actualizada");
      setEdit(null);
      setF({});
      refrescar();
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const estado = async (p, nuevo) => {
    try {
      await api.patch(`/api/publicaciones/${p.id}`, { estado: nuevo });
      refrescar();
      toast("Listo");
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const borrar = (p) => {
    Alert.alert("Eliminar publicación", `¿Eliminar «${p.titulo}»? Dejará de verse. Tus tratos se conservan.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/publicaciones/${p.id}`);
            refrescar();
            toast("Eliminada");
          } catch (e) {
            toast(e.message, "err");
          }
        },
      },
    ]);
  };

  if (isLoading) return <Skeleton height={140} />;
  if (!lista.length) return <Empty icon="clipboard" titulo="Todavía no publicaste nada" texto="Publica tu primer servicio, producto o favor." />;

  return (
    <View style={{ gap: 10 }}>
      {lista.map((p) => {
        const [txt, tono] = etiqueta(p.estado);
        return (
          <View key={p.id} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.md, padding: 12, gap: 7 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala, flex: 1 }}>{p.titulo}</Text>
              <Badge tono={tono}>{txt}</Badge>
            </View>
            <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>
              {cap(p.categoria)} · {p.zona} · {hace(p.creado)} · {p.vistos ? `${p.vistos} visto${p.vistos === 1 ? "" : "s"}` : "sin vistos"} · {p.precio || "a convenir"}
            </Text>

            {edit?.id === p.id ? (
              <View style={{ marginTop: 6 }}>
                <Field label="Título">
                  <Input maxLength={120} defaultValue={p.titulo} onChangeText={(t) => setF({ ...f, titulo: t })} />
                </Field>
                <Field label="Descripción">
                  <Input multiline rows={3} maxLength={600} defaultValue={p.descripcion} onChangeText={(t) => setF({ ...f, descripcion: t })} />
                </Field>
                <Field label="Precio">
                  <Input defaultValue={p.precio} onChangeText={(t) => setF({ ...f, precio: t })} />
                </Field>
                <Field label="Sector">
                  <Input defaultValue={p.zona} onChangeText={(t) => setF({ ...f, zona: t })} />
                </Field>
                <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                  <Btn size="small" onPress={() => { setEdit(null); setF({}); }}>Cancelar</Btn>
                  <Btn size="small" variant="primary" icon="check" onPress={guardar}>Guardar</Btn>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Btn size="small" icon="tool" onPress={() => { setEdit(p); setF({}); }}>Editar</Btn>
                {p.estado === "activa" ? (
                  <Btn size="small" icon="clock" onPress={() => estado(p, "pausada")}>Pausar</Btn>
                ) : (
                  <Btn size="small" onPress={() => estado(p, "activa")}>Reactivar</Btn>
                )}
                <Btn size="small" icon="trash" variant="danger" onPress={() => borrar(p)}>Eliminar</Btn>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Cotizaciones() {
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [responder, setResponder] = useState(null);
  const [r, setR] = useState({ respuesta: "puedo", precio: "", nota: "" });

  const { data, isLoading } = useQuery({ queryKey: ["cotizaciones"], queryFn: () => api.get("/api/cotizaciones") });
  const lista = Array.isArray(data) ? data : data?.items || [];
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["cotizaciones"] });
    qc.invalidateQueries({ queryKey: ["tratos"] });
  };

  const enviarRespuesta = async () => {
    try {
      await api.post(`/api/cotizaciones/${responder.id}/responder`, {
        respuesta: r.respuesta,
        precio_respuesta: r.precio,
        nota: r.nota,
      });
      toast("Respuesta enviada");
      setResponder(null);
      refrescar();
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const aceptar = async (co) => {
    try {
      await api.post(`/api/cotizaciones/${co.id}/aceptar`, { monto: co.precio_respuesta, politica: "contra_entrega" });
      toast("Trato abierto. Falta que el vecino lo confirme.");
      refrescar();
    } catch (e) {
      toast(e.message, "err");
    }
  };

  if (isLoading) return <Skeleton height={140} />;
  if (!lista.length) return <Empty icon="chat" titulo="Sin cotizaciones" texto="Cuando pidas o recibas una, aparece aquí con su conversación." />;

  return (
    <View style={{ gap: 10 }}>
      {lista.map((co) => {
        const [txt, tono] = etiqueta(co.estado);
        const soyVendedor = co.autor_id === usuario?.id;
        const abierta = co.estado === "enviada";
        return (
          <View key={co.id} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.md, padding: 12, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala, flex: 1 }}>{co.titulo}</Text>
              <Badge tono={tono}>{txt}</Badge>
            </View>
            <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>
              {soyVendedor ? `De ${co.comprador_nombre || "un vecino"}` : "La enviaste"} · {hace(co.creado)}
            </Text>
            <Text style={{ color: c.text, fontSize: 12.5 * escala }}>«{co.descripcion}»{co.medida ? ` · ${co.medida}` : ""}</Text>
            {co.precio_respuesta ? (
              <Text style={{ color: c.muted, fontSize: 12 * escala }}>
                Respuesta: <Text style={{ fontFamily: F.medium, color: c.ink }}>{co.precio_respuesta}</Text>
                {co.nota_vendedor ? ` · ${co.nota_vendedor}` : ""}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Btn size="small" icon="chat" onPress={() => router.push(`/chat/cotizacion/${co.id}`)}>Conversación</Btn>
              {soyVendedor && abierta ? (
                <Btn size="small" variant="primary" onPress={() => { setResponder(co); setR({ respuesta: "puedo", precio: "", nota: "" }); }}>
                  Responder
                </Btn>
              ) : null}
              {!soyVendedor && co.estado === "respondida" ? (
                <Btn size="small" variant="primary" icon="check" onPress={() => aceptar(co)}>Aceptar trato</Btn>
              ) : null}
            </View>

            {responder?.id === co.id ? (
              <View style={{ backgroundColor: c.surface2, borderRadius: R.sm, padding: 10, gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {[
                    ["puedo", "Sí puedo"],
                    ["precio", "Con otro precio"],
                    ["no_puedo", "No puedo"],
                  ].map(([v, t]) => (
                    <Btn key={v} size="small" variant={r.respuesta === v ? "primary" : "sec"} onPress={() => setR({ ...r, respuesta: v })}>
                      {t}
                    </Btn>
                  ))}
                </View>
                {r.respuesta === "precio" ? (
                  <Field label="Precio propuesto">
                    <Input value={r.precio} onChangeText={(t) => setR({ ...r, precio: t })} placeholder="S/ 45" />
                  </Field>
                ) : null}
                <Field label="Nota">
                  <Input value={r.nota} onChangeText={(t) => setR({ ...r, nota: t })} placeholder="Puedo mañana a las 10" />
                </Field>
                <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                  <Btn size="small" onPress={() => setResponder(null)}>Cancelar</Btn>
                  <Btn size="small" variant="primary" onPress={enviarRespuesta}>Enviar respuesta</Btn>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Tratos() {
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({ queryKey: ["tratos"], queryFn: () => api.get("/api/tratos") });
  const lista = Array.isArray(data) ? data : data?.items || [];
  const refrescar = () => qc.invalidateQueries({ queryKey: ["tratos"] });

  const accion = async (t, ruta, cuerpo) => {
    try {
      await api.post(`/api/tratos/${t.id}/${ruta}`, cuerpo || {});
      refrescar();
      toast("Hecho");
    } catch (e) {
      toast(e.message, "err");
    }
  };

  if (isLoading) return <Skeleton height={140} />;
  if (!lista.length) return <Empty icon="handshake" titulo="Sin tratos" texto="Cuando acepten una cotización, el trato aparece aquí." />;

  return (
    <View style={{ gap: 10 }}>
      {lista.map((t) => {
        const [txt, tono] = etiqueta(t.estado);
        const vendedor = t.vendedor_id === usuario?.id;
        const yoPague = vendedor ? t.pago_vendedor : t.pago_comprador;
        const yoCumpli = vendedor ? t.marca_vendedor : t.marca_comprador;
        return (
          <View key={t.id} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.md, padding: 12, gap: 7 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala, flex: 1 }}>{t.titulo}</Text>
              <Badge tono={tono}>{txt}</Badge>
            </View>
            <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>
              {vendedor ? `Cliente: ${t.comprador_nombre}` : `Vendedor: ${t.vendedor_nombre}`} · {t.monto || "monto a convenir"}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {["1. Acordado", "2. Pagado", "3. Cumplido"].map((paso, i) => {
                const hecho = i === 0 ? t.estado !== "pendiente" : i === 1 ? ["pagado", "cerrado"].includes(t.estado) : t.estado === "cerrado";
                return (
                  <Text key={paso} style={{ color: hecho ? c.brand700 : c.muted, fontSize: 10.5 * escala, fontFamily: hecho ? F.medium : F.regular }}>
                    {paso}
                  </Text>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {t.estado === "pendiente" && vendedor ? (
                <Btn size="small" variant="primary" icon="check" onPress={() => accion(t, "confirmar")}>Confirmar trato</Btn>
              ) : null}
              {t.estado === "pendiente" && !vendedor ? (
                <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>Esperando que el vecino confirme</Text>
              ) : null}
              {(t.estado === "acordado" || t.estado === "pagado") && !yoPague ? (
                <Btn size="small" variant="primary" icon="wallet" onPress={() => accion(t, "pago")}>
                  {vendedor ? "Confirmar que recibí el pago" : "Marcar que pagué"}
                </Btn>
              ) : null}
              {(t.estado === "acordado" || t.estado === "pagado") && yoPague && !yoCumpli ? (
                <Btn size="small" variant="primary" icon="check" onPress={() => accion(t, "cerrar")}>
                  {vendedor ? "Marcar que entregué" : "Marcar que recibí"}
                </Btn>
              ) : null}
              <Btn size="small" icon="chat" onPress={() => router.push(`/chat/trato/${t.id}`)}>Conversación</Btn>
            </View>

            {t.estado === "cerrado" ? (
              <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                <Icon name="check" size={13} color={c.brand600} />
                <Text style={{ color: c.brand700, fontSize: 11.5 * escala }}>Trato cerrado. Ya pueden dejar su visto bueno.</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Intercambios() {
  const { c, escala } = useTema();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["intercambios"], queryFn: () => api.get("/api/intercambios") });
  const lista = Array.isArray(data) ? data : data?.items || [];

  const cambiar = async (i, estado) => {
    try {
      await api.post(`/api/intercambios/${i.id}/estado`, { estado });
      qc.invalidateQueries({ queryKey: ["intercambios"] });
      toast("Favor actualizado");
    } catch (e) {
      toast(e.message, "err");
    }
  };

  if (isLoading) return <Skeleton height={120} />;
  if (!lista.length) return <Empty icon="heart" titulo="Sin favores" texto="Pide o ofrece ayuda en la sección Favores." />;

  return (
    <View style={{ gap: 10 }}>
      {lista.map((i) => {
        const [txt, tono] = etiqueta(i.estado);
        return (
          <View key={i.id} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.md, padding: 12, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala, flex: 1 }}>{i.titulo}</Text>
              <Badge tono={tono}>{txt}</Badge>
            </View>
            <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>
              {i.solicitante_nombre} ↔ {i.ofertante_nombre} · {i.zona} · {hace(i.creado)}
            </Text>
            {i.mensaje ? <Text style={{ color: c.text, fontSize: 12.5 * escala }}>«{i.mensaje}»</Text> : null}
            {i.garante_nombre ? (
              <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                <Icon name="shield" size={13} color={c.brand700} />
                <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>
                  Garante: {i.garante_nombre} · devolución {i.fecha_devolucion || "a coordinar"}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {i.estado === "solicitada" ? <Btn size="small" variant="primary" onPress={() => cambiar(i, "aceptada")}>Aceptar</Btn> : null}
              {i.estado === "aceptada" ? <Btn size="small" onPress={() => cambiar(i, "en_curso")}>Empezar</Btn> : null}
              {i.estado === "en_curso" ? <Btn size="small" variant="primary" onPress={() => cambiar(i, "resuelta")}>Terminado</Btn> : null}
              {i.estado !== "resuelta" ? <Btn size="small" onPress={() => cambiar(i, "cancelada")}>Cancelar</Btn> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Privacidad() {
  const { c, escala } = useTema();
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
    } catch (e) {
      toast(e.message, "err");
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.md, padding: 12, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 15 * escala }}>Mi número y mis pagos</Text>
          <Badge tono={mostrar ? "verde" : "gris"}>{mostrar ? "Visible" : "Oculto"}</Badge>
        </View>
        <Text style={{ color: c.muted, fontSize: 12 * escala, lineHeight: 18 * escala }}>
          Con la cuenta siempre puedes escribir por aquí; el número solo lo ven vecinos con sesión. Si lo ocultas,
          igual te llegan cotizaciones y mensajes.
        </Text>
        <Check checked={mostrar} onChange={cambiar}>
          Mostrar mi teléfono y Yape a otros vecinos con cuenta
        </Check>
      </View>

      <Text style={{ color: c.muted, fontSize: 12.5 * escala }}>
        Tu contacto se consultó <Text style={{ fontFamily: F.bold, color: c.ink }}>{data?.total || 0}</Text>{" "}
        {data?.total === 1 ? "vez" : "veces"}.
      </Text>

      {isLoading ? <Skeleton height={60} /> : null}
      {(data?.items || []).map((a, k) => (
        <View key={k} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.sm, padding: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 13 * escala }}>{a.quien}</Text>
            <Text style={{ color: c.muted, fontSize: 11 * escala }}>{hace(a.creado)}</Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 12 * escala }}>consultó «{a.titulo}»</Text>
        </View>
      ))}
      {!isLoading && !(data?.items || []).length ? (
        <Empty icon="lock" titulo="Nadie consultó tu contacto" texto="Cuando alguien lo vea, aparecerá aquí." />
      ) : null}
    </View>
  );
}
