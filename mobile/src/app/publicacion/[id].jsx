import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { api, abs } from "../../lib/api";
import { useAuth } from "../../context/auth";
import { useTema } from "../../context/ajustes";
import { Icon, CAT_ICON } from "../../lib/icons";
import { BarraVolver } from "../../components/Header";
import { Avatar, Badge, Btn, Field, Input, MiniMapa, Sheet, Skeleton, useToast } from "../../components/ui";
import { cap, hace, medios } from "../../lib/format";
import { F, R, S, shadowSoft } from "../../lib/theme";
import { Image } from "expo-image";

const MOTIVOS = ["Parece una estafa", "Datos falsos", "Lenguaje ofensivo", "Precio engañoso", "No es del sector", "Otro"];

export default function Publicacion() {
  const { id } = useLocalSearchParams();
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [reportando, setReportando] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["publicacion", id],
    queryFn: () => api.get(`/api/publicaciones/${id}`),
    enabled: Boolean(id),
  });

  const esFavor = String(p?.tipo || "").startsWith("favor");
  const esEmergencia = Boolean(p?.es_emergencia);
  const waLink = p?.whatsapp
    ? `https://wa.me/51${p.whatsapp}?text=${encodeURIComponent("Hola, vi tu publicación en Vecinal Solidaria: " + (p.titulo || ""))}`
    : "";

  const soloIntercambio = /intercambio/i.test(`${p?.precio || ""} ${p?.medios_pago || ""}`);
  const listaMedios = useMemo(
    () => medios(p).filter((m) => !(soloIntercambio && /intercambio/i.test(m))),
    [p, soloIntercambio],
  );

  const abrirConversacion = async () => {
    if (!usuario) {
      router.push("/auth");
      return;
    }
    try {
      const fresco = await api.get(`/api/publicaciones/${id}`);
      if (fresco.mi_trato) {
        router.replace(`/chat/trato/${fresco.mi_trato.id}`);
        return;
      }
      if (fresco.mi_cotizacion) {
        router.replace(`/chat/cotizacion/${fresco.mi_cotizacion.id}`);
        return;
      }
      const r = await api.post("/api/cotizaciones", {
        publicacion_id: id,
        descripcion: `Hola, me interesa «${p.titulo}». ¿Podemos coordinar?`,
        medida: "",
        urgencia: "normal",
      });
      qc.invalidateQueries({ queryKey: ["conversaciones"] });
      router.replace(`/chat/cotizacion/${r.id}`);
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const enviarReporte = async () => {
    setError("");
    setEnviando(true);
    const m = motivo === "Otro" ? `Otro: ${detalle || ""}`.slice(0, 300) : motivo;
    try {
      await api.post("/api/reportes", { publicacion_id: id, motivo: m });
      setReportando(false);
      toast("Reporte enviado. Un moderador lo revisará.");
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async (texto) => {
    await Clipboard.setStringAsync(String(texto));
    toast("Copiado");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo={p?.titulo || "Publicación"} />
      {isLoading ? (
        <View style={{ padding: 16 }}>
          <Skeleton height={300} />
        </View>
      ) : !p ? (
        <Text style={{ padding: 16, color: c.muted }}>No encontramos esta publicación.</Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Badge tono="verde">
                {cap(String(p.categoria || "").replace(/_/g, " "))}
              </Badge>
              <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>· {hace(p.creado) || "recién publicado"}</Text>
              {esEmergencia ? <Badge tono="rojo">Emergencia</Badge> : null}
              {(p.avaladores || [])[0] ? <Badge tono="verde">Aval vecinal</Badge> : null}
            </View>

            <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 25 * escala, letterSpacing: -0.5, marginTop: 10 }}>
              {p.titulo}
            </Text>

            {/* -------- datos rápidos -------- */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {esFavor ? (
                <Dato icono={p.tipo === "favor_solicitado" ? "handshake" : "solidaridad"} tono={p.tipo === "favor_solicitado" ? "rojo" : "verde"}>
                  {p.tipo === "favor_solicitado" ? "Necesito" : "Ofrezco"}
                </Dato>
              ) : (
                <Dato icono="wallet">{p.precio || "A convenir"}</Dato>
              )}
              {esFavor ? <Dato icono="clock">{p.estado === "activa" ? "Abierto" : "Pausado"}</Dato> : null}
              {listaMedios.length ? <Dato icono="check">{listaMedios.join(" · ")}</Dato> : null}
              {p.stock != null ? (
                <Dato icono="box" tono={p.stock === 0 ? "rojo" : ""}>
                  {p.stock === 0 ? "Agotado" : `${p.stock} disponible${p.stock === 1 ? "" : "s"}`}
                </Dato>
              ) : null}
              {p.creado && Date.now() / 1000 - p.creado < 86400 ? <Dato icono="clock" tono="verde">Disponible hoy</Dato> : null}
              {esEmergencia ? (
                <Dato icono="alert" tono="rojo">
                  {p.creado && Date.now() / 1000 - p.creado < 172800 ? "Urgente (48 h)" : "Recurso"}
                </Dato>
              ) : null}
              {p.contacto_visible && p.telefono ? (
                <Pressable onPress={() => Linking.openURL(`tel:${p.telefono}`)}>
                  <Dato icono="phone">{p.telefono}</Dato>
                </Pressable>
              ) : null}
            </View>

            {/* -------- portada -------- */}
            {p.fotos?.length ? (
              <View style={{ marginTop: 14, borderRadius: R.md, overflow: "hidden", height: 230, backgroundColor: c.surface3 }}>
                <Image source={{ uri: abs(p.fotos[0]) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                <View style={{ position: "absolute", left: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,.55)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Icon name="pin" size={12} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 11.5 * escala }}>{p.zona}</Text>
                </View>
                {p.fotos.length > 1 ? (
                  <View style={{ position: "absolute", right: 10, bottom: 10, backgroundColor: "rgba(0,0,0,.55)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <Text style={{ color: "#fff", fontSize: 11 * escala }}>1 de {p.fotos.length}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* -------- detalle -------- */}
            <Tarjeta icono={esEmergencia ? "alert" : esFavor ? "solidaridad" : "tool"} titulo={esEmergencia ? "Qué se necesita" : esFavor ? (p.tipo === "favor_solicitado" ? "Qué necesita" : "Qué ofrece") : "Detalle del servicio"}>
              <Text style={{ color: c.text, fontSize: 14 * escala, lineHeight: 21 * escala }}>{p.descripcion}</Text>
              {p.franja_horaria ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }}>
                  <Icon name="clock" size={14} color={c.muted} />
                  <Text style={{ color: c.muted, fontSize: 12.5 * escala }}>{p.franja_horaria}</Text>
                </View>
              ) : null}
              {p.garante_nombre ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }}>
                  <Icon name="shield" size={14} color={c.brand700} />
                  <Text style={{ color: c.brand700, fontSize: 12.5 * escala }}>Garante: {p.garante_nombre}</Text>
                </View>
              ) : null}
              {!esFavor && !soloIntercambio && p.contacto_visible && (p.yape_autor || p.plin_autor) ? (
                <View style={{ marginTop: 12, backgroundColor: c.surface2, borderRadius: R.sm, padding: 12, gap: 8 }}>
                  <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 13.5 * escala }}>Datos para pagar</Text>
                  {p.yape_autor ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: c.text, fontSize: 13 * escala }}>Yape <Text style={{ fontFamily: F.medium }}>{p.yape_autor}</Text></Text>
                      <Btn size="small" icon="copy" onPress={() => copiar(p.yape_autor)}>Copiar</Btn>
                    </View>
                  ) : null}
                  {p.plin_autor ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: c.text, fontSize: 13 * escala }}>Plin <Text style={{ fontFamily: F.medium }}>{p.plin_autor}</Text></Text>
                      <Btn size="small" icon="copy" onPress={() => copiar(p.plin_autor)}>Copiar</Btn>
                    </View>
                  ) : null}
                  <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>
                    Pago directo entre vecinos. La app no cobra comisión ni guarda tu dinero.
                  </Text>
                </View>
              ) : null}
            </Tarjeta>

            {/* -------- proveedor -------- */}
            <View
              style={{
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: R.md,
                padding: 14,
                marginTop: 10,
                flexDirection: "row",
                gap: 12,
                ...shadowSoft,
              }}
            >
              <Avatar nombre={p.nombre} size={50} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 15 * escala }}>{p.nombre}</Text>
                  <Icon name="check" size={15} color={c.brand600} />
                </View>
                <Text style={{ color: c.muted, fontSize: 12 * escala }}>
                  {p.zona}
                  {p.distancia_km != null
                    ? ` · ${p.distancia_km < 0.05 ? "en tu sector" : p.distancia_km < 1 ? `a ${Math.round(p.distancia_km * 1000)} m` : `a ${p.distancia_km.toFixed(1).replace(".", ",")} km`}`
                    : ""}
                </Text>
                {(p.avaladores || [])[0] ? (
                  <View style={{ flexDirection: "row", gap: 5, alignItems: "center", marginTop: 3 }}>
                    <Icon name="shield" size={14} color={c.brand700} />
                    <Text style={{ color: c.brand700, fontSize: 12 * escala }}>
                      Avalado por {(p.avaladores || [])[0].nombre}
                    </Text>
                  </View>
                ) : null}
                {(p.vistos || 0) > 0 ? (
                  <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                    <Icon name="thumb" size={13} color={c.brand600} />
                    <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>
                      {p.vistos} vecino{p.vistos === 1 ? "" : "s"} recomienda{p.vistos === 1 ? "" : "n"} esto
                    </Text>
                  </View>
                ) : null}
                {p.es_mio ? (
                  <Badge tono="verde">Tu publicación</Badge>
                ) : !usuario ? (
                  <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>Entra para ver el contacto</Text>
                ) : null}
              </View>
            </View>

            {/* -------- ubicación -------- */}
            {p.lat_publica != null && p.lng_publica != null ? (
              <Tarjeta icono="pin" titulo="Ubicación aproximada">
                <MiniMapa lat={p.lat_publica} lng={p.lng_publica} nombre={p.titulo} />
                <Text style={{ color: c.muted, fontSize: 11.5 * escala, marginTop: 6 }}>
                  Punto aproximado del sector, no la dirección exacta.{" "}
                  <Text
                    style={{ color: c.brand600, textDecorationLine: "underline" }}
                    onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.lat_publica},${p.lng_publica}`)}
                  >
                    Abrir en Google Maps
                  </Text>
                </Text>
              </Tarjeta>
            ) : null}

            {p.es_mio ? (
              <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: 12 }}>
                Esta publicación es tuya. Gestiónala en Mi actividad.
              </Text>
            ) : (
              <Pressable onPress={() => setReportando(true)} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 14, alignSelf: "center" }} hitSlop={8}>
                <Icon name="flag" size={14} color={c.muted} />
                <Text style={{ color: c.muted, fontSize: 12.5 * escala, textDecorationLine: "underline" }}>
                  Reportar esta publicación
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {/* -------- barra inferior -------- */}
          {!p.es_mio ? (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                padding: 10,
                paddingBottom: 18,
                backgroundColor: c.surface,
                borderTopWidth: 1,
                borderTopColor: c.line,
              }}
            >
              <Btn variant="primary" icon="chat" onPress={abrirConversacion} style={{ flex: 2 }}>
                {usuario ? "Enviar mensaje" : "Entra para contactar"}
              </Btn>
              {p.origen === "scraping" && p.url_origen ? (
                <Btn icon="link" onPress={() => Linking.openURL(p.url_origen)} style={{ flex: 1 }}>
                  Ver original
                </Btn>
              ) : waLink ? (
                <Btn icon="whatsapp" onPress={() => Linking.openURL(waLink)} style={{ flex: 1 }}>
                  WhatsApp
                </Btn>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <Sheet open={reportando} onClose={() => setReportando(false)} titulo="Reportar publicación">
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala, marginBottom: 6 }}>Reportar publicación</Text>
        <Text style={{ color: c.muted, fontSize: 12.5 * escala, lineHeight: 18 * escala, marginBottom: 10 }}>
          Un moderador del barrio lo revisa. Reportar en falso también tiene consecuencias.
        </Text>
        {MOTIVOS.map((m) => (
          <Pressable
            key={m}
            onPress={() => setMotivo(m)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: motivo === m ? c.brand600 : c.lineStrong,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {motivo === m ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand600 }} /> : null}
            </View>
            <Text style={{ color: c.text, fontSize: 14 * escala }}>{m}</Text>
          </Pressable>
        ))}
        {motivo === "Otro" ? (
          <Field label="Cuéntanos qué pasa">
            <Input maxLength={200} value={detalle} onChangeText={setDetalle} />
          </Field>
        ) : null}
        {error ? <Text style={{ color: c.danger, fontSize: 13 * escala, marginBottom: 8 }}>{error}</Text> : null}
        <Btn variant="danger" icon="flag" disabled={enviando} onPress={enviarReporte}>
          {enviando ? "Enviando…" : "Enviar reporte"}
        </Btn>
      </Sheet>
    </View>
  );
}

function Dato({ icono, children, tono = "" }) {
  const { c, escala } = useTema();
  const fondo = tono === "rojo" ? c.danger50 : tono === "verde" ? c.brand50 : c.surface2;
  const tinta = tono === "rojo" ? c.dangerInk : tono === "verde" ? c.brand800 : c.text;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: fondo,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: R.pill,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Icon name={icono} size={13} color={tinta} />
      <Text style={{ color: tinta, fontSize: 12 * escala }}>{children}</Text>
    </View>
  );
}

function Tarjeta({ icono, titulo, children }) {
  const { c, escala } = useTema();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: R.md,
        padding: 14,
        marginTop: 10,
        ...shadowSoft,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icon name={icono} size={17} color={c.brand700} />
        <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 15 * escala }}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}
