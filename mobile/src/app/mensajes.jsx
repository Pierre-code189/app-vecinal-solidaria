import React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useTema } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { BarraVolver } from "../components/Header";
import { Avatar, Badge, Empty, Skeleton } from "../components/ui";
import AvisoCobro from "../components/AvisoCobro";
import { etiqueta, hace } from "../lib/format";
import { F, R } from "../lib/theme";

export default function MensajesScreen() {
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["conversaciones"],
    queryFn: () => api.get("/api/conversaciones"),
    refetchInterval: 20000,
    enabled: Boolean(usuario),
  });

  const items = data?.items || [];

  if (!usuario) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BarraVolver titulo="Mensajes" />
        <View style={{ padding: 16 }}>
          <Empty
            icon="chat"
            titulo="Entra para ver tus mensajes"
            texto="Las conversaciones son privadas y solo se ven con tu cuenta."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo="Mensajes" />
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brand600} />}
      >
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 24 * escala, marginBottom: 4 }}>Mensajes</Text>
        <Text style={{ color: c.muted, fontSize: 13 * escala, marginBottom: 12, lineHeight: 19 * escala }}>
          Habla con el vecino que ofrece el servicio o el favor, sin salir de la app.
        </Text>

        <AvisoCobro onIr={(h) => router.push(`/chat/${h.contexto}/${h.ref_id}`)} />

        {isLoading ? <Skeleton height={90} /> : null}

        {!isLoading && items.length === 0 ? (
          <Empty icon="chat" titulo="Sin conversaciones" texto="Cuando le escribas a un vecino, el hilo aparece aquí." />
        ) : null}

        <View style={{ gap: 8 }}>
          {items.map((i) => {
            const [txt, tono] = etiqueta(i.estado);
            return (
              <Pressable
                key={`${i.contexto}-${i.ref_id}`}
                onPress={() => router.push(`/chat/${i.contexto}/${i.ref_id}`)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: R.md,
                }}
              >
                <Avatar nombre={i.otro_nombre} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
                    <Text numberOfLines={1} style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala, flex: 1 }}>
                      {i.otro_nombre}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 10.5 * escala }}>{hace(i.ts)}</Text>
                  </View>
                  <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11.5 * escala }}>
                    {i.titulo}
                  </Text>
                  <Text numberOfLines={1} style={{ color: c.text, fontSize: 12.5 * escala }}>
                    {i.ultimo || "Sin mensajes todavía"}
                  </Text>
                  <View style={{ marginTop: 3 }}>
                    <Badge tono={tono}>{txt}</Badge>
                  </View>
                </View>
                {i.sin_leer > 0 ? (
                  <View
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: c.brand600,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 5,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "700" }}>{i.sin_leer}</Text>
                  </View>
                ) : (
                  <Icon name="chevron" size={16} color={c.muted} />
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
