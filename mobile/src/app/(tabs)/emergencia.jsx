import React, { useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../context/auth";
import { useZona } from "../../context/zona";
import { useLectorVoz, useTema } from "../../context/ajustes";
import { Icon } from "../../lib/icons";
import { Badge, Btn, Chip, Empty, Fila, Titulo, useToast } from "../../components/ui";
import { F, R, S, shadowSoft } from "../../lib/theme";
import { hace } from "../../lib/format";

const SOS = [
  { num: "105", nombre: "Emergencias (Policía)", icono: "shield" },
  { num: "116", nombre: "Bomberos", icono: "alert" },
  { num: "115", nombre: "SAMU / ambulancia", icono: "heart" },
  { num: "106", nombre: "Defensa Civil", icono: "shield" },
];

export default function Emergencia() {
  const { c, escala } = useTema();
  const { usuario, esModerador } = useAuth();
  const { zona } = useZona();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  const [rapidos, setRapidos] = useState({ cerca: false, urg: false });

  useLectorVoz("Emergencias. Qué hacer, a quién llamar y qué hay disponible en tu sector.");

  const { data: tablero, refetch: refTablero, isRefetching } = useQuery({
    queryKey: ["emergencia"],
    queryFn: () => api.get("/api/emergencia"),
    refetchInterval: 60000,
  });
  const { data: dir } = useQuery({ queryKey: ["directorio"], queryFn: () => api.get("/api/emergencia/directorio") });
  const { data: recursos, refetch: refRecursos } = useQuery({
    queryKey: ["recursos", zona],
    queryFn: () => api.get(`/api/publicaciones?emergencia=true&limit=20&zona=${encodeURIComponent(zona)}`),
  });
  const { data: otros } = useQuery({
    queryKey: ["recursos-todos"],
    queryFn: () => api.get("/api/publicaciones?emergencia=true&limit=20"),
    enabled: (recursos?.items || []).length === 0,
  });

  const activar = useMutation({
    mutationFn: (activo) =>
      api.post("/api/emergencia/activar", { activo, motivo: activo ? "Activado por moderación" : "Desactivado" }),
    onSuccess: () => {
      toast("Tablero actualizado");
      qc.invalidateQueries({ queryKey: ["emergencia"] });
    },
    onError: (e) => toast(e.message, "err"),
  });

  const activo = tablero?.activo;
  const listaDirectorio = dir?.directorio || dir?.items || [];
  const lista = recursos?.items?.length ? recursos.items : otros?.items || [];
  const filtrados = lista.filter(
    (r) =>
      (!rapidos.cerca || (r.distancia_km != null && r.distancia_km <= 1)) &&
      (!rapidos.urg || (r.creado && Date.now() / 1000 - r.creado < 172800)),
  );

  const abrir = async (url) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast("No pudimos abrir esa llamada", "warn");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            refTablero();
            refRecursos();
          }}
          tintColor={c.brand600}
        />
      }
    >
      <Titulo sub="Qué hacer, a quién llamar y qué hay disponible en tu sector">Emergencias</Titulo>

      <View
        style={{
          borderRadius: R.md,
          borderWidth: 1,
          borderColor: activo ? c.dangerLine : c.line,
          backgroundColor: activo ? c.danger50 : c.surface,
          padding: 14,
          gap: 10,
          ...shadowSoft,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Icon name={activo ? "alert" : "shield"} size={26} color={activo ? c.danger : c.brand700} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 16 * escala }}>
              {activo ? "Tablero activo" : "Sin emergencia declarada"}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 * escala, marginTop: 3, lineHeight: 19 * escala }}>
              {activo
                ? `Activado ${tablero?.motivo ? `por ${tablero.motivo}` : "por moderación"}. Los recursos marcados se muestran primero.`
                : "Los recursos de emergencia siguen visibles, pero sin alerta general."}
            </Text>
          </View>
        </View>
        {esModerador ? (
          <Btn
            size="small"
            variant={activo ? "danger" : "primary"}
            onPress={() => activar.mutate(!activo)}
            style={{ alignSelf: "flex-start" }}
          >
            {activo ? "Desactivar tablero" : "Activar tablero"}
          </Btn>
        ) : null}
      </View>

      <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala, marginTop: S[5], marginBottom: S[3] }}>
        Llamadas de emergencia
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {SOS.map((s) => (
          <Pressable
            key={s.num}
            onPress={() => abrir(`tel:${s.num}`)}
            accessibilityRole="button"
            accessibilityLabel={`Llamar al ${s.num}, ${s.nombre}`}
            style={{
              width: "47.5%",
              flexGrow: 1,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: R.md,
              padding: 13,
              gap: 3,
              ...shadowSoft,
            }}
          >
            <Icon name={s.icono} size={20} color={c.danger} />
            <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 19 * escala, marginTop: 4 }}>{s.num}</Text>
            <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>{s.nombre}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala, marginTop: S[5], marginBottom: S[3] }}>
        Recursos en {zona}
      </Text>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: S[3] }}>
        <Chip icono="pin" activo={rapidos.cerca} onPress={() => setRapidos({ ...rapidos, cerca: !rapidos.cerca })}>
          Cerca (≤ 1 km)
        </Chip>
        <Chip icono="alert" activo={rapidos.urg} onPress={() => setRapidos({ ...rapidos, urg: !rapidos.urg })}>
          Urgentes (48 h)
        </Chip>
      </View>

      {!recursos?.items?.length && otros?.items?.length ? (
        <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginBottom: 8 }}>
          No hay recursos en {zona}. Estos son de otros sectores del distrito.
        </Text>
      ) : null}

      {filtrados.length === 0 ? (
        <Empty
          icon="box"
          titulo="Aún no hay recursos marcados aquí"
          texto="Si tienes agua, bidones o víveres, publícalo y marca «también disponible en emergencias»."
          accion={
            <Btn variant="primary" icon="plus" onPress={() => router.push("/publicar?modo=emergencia")}>
              Publicar recurso
            </Btn>
          }
        />
      ) : (
        <View style={{ gap: 10 }}>
          {filtrados.map((r) => {
            const tel = r.contacto_visible && r.telefono ? r.telefono : "";
            return (
              <View
                key={r.id}
                style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.md, padding: 14, gap: 7 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="box" size={14} color={c.brand700} />
                  <Badge>{r.categoria || "recurso"}</Badge>
                  {r.creado && Date.now() / 1000 - r.creado < 172800 ? <Badge tono="rojo">Urgente</Badge> : null}
                </View>
                <Pressable onPress={() => router.push(`/publicacion/${r.id}`)}>
                  <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 16 * escala }}>{r.titulo}</Text>
                  <Text numberOfLines={3} style={{ color: c.text, fontSize: 13.5 * escala, marginTop: 3 }}>
                    {r.descripcion}
                  </Text>
                </Pressable>
                <Text style={{ color: c.muted, fontSize: 12 * escala }}>
                  {r.nombre} · {r.zona}
                </Text>
                {tel ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <Btn size="small" icon="whatsapp" onPress={() => abrir(`https://wa.me/51${tel}?text=${encodeURIComponent("Hola, vi tu publicación en Vecinal Solidaria: " + (r.titulo || ""))}`)}>
                      WhatsApp
                    </Btn>
                    <Btn size="small" icon="phone" onPress={() => abrir(`tel:${tel}`)}>
                      Llamar
                    </Btn>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Icon name="lock" size={13} color={c.muted} />
                    <Text style={{ color: c.muted, fontSize: 12 * escala }}>Contacto visible solo con sesión.</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala, marginTop: S[5], marginBottom: S[3] }}>
        Directorio del barrio
      </Text>
      <Fila>
        {listaDirectorio.map((d, k) => {
          const tel = d.telefono || d.contacto || "";
          const detalle = d.detalle || [d.tipo, d.zona].filter(Boolean).join(" · ");
          return (
            <View key={d.id || d.nombre || k} style={{ paddingVertical: 8, borderBottomWidth: k < listaDirectorio.length - 1 ? 1 : 0, borderBottomColor: c.line }}>
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala }}>{d.nombre}</Text>
              {detalle ? <Text style={{ color: c.muted, fontSize: 12.5 * escala }}>{detalle}</Text> : null}
              {tel ? (
                <Pressable onPress={() => abrir(`tel:${tel}`)} hitSlop={6}>
                  <Text style={{ color: c.brand600, fontSize: 14 * escala, marginTop: 3, textDecorationLine: "underline" }}>{tel}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {!listaDirectorio.length ? <Text style={{ color: c.muted, fontSize: 13 * escala }}>El directorio aún está vacío.</Text> : null}
      </Fila>

      <Text style={{ color: c.muted, fontSize: 12 * escala, marginTop: S[4], lineHeight: 18 * escala }}>
        Esta app no reemplaza a los servicios de emergencia. Si hay riesgo de vida, llama primero al 105.
        {!usuario ? " Entra a tu cuenta para ver teléfonos de contacto de los recursos." : ""}
      </Text>
    </ScrollView>
  );
}
