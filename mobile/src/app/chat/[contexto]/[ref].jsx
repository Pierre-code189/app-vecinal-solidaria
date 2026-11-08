import React from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/auth";
import { useTema } from "../../../context/ajustes";
import { BarraVolver } from "../../../components/Header";
import { Avatar, Badge, Btn, Empty } from "../../../components/ui";
import Conversacion from "../../../components/Conversacion";
import HiloAcciones from "../../../components/HiloAcciones";
import { etiqueta } from "../../../lib/format";
import { F, S } from "../../../lib/theme";

export default function ChatScreen() {
  const { c, escala } = useTema();
  const { contexto, ref } = useLocalSearchParams();
  const { usuario } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["conversaciones"],
    queryFn: () => api.get("/api/conversaciones"),
    enabled: Boolean(usuario),
    refetchInterval: 20000,
  });

  const h = (data?.items || []).find(
    (i) => i.contexto === contexto && String(i.ref_id) === String(ref),
  );

  if (!usuario) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BarraVolver titulo="Conversación" />
        <View style={{ padding: 16 }}>
          <Empty icon="lock" titulo="Entra para conversar" texto="Los mensajes solo se ven con tu cuenta." />
          <Btn variant="primary" onPress={() => router.push("/auth")}>Entrar</Btn>
        </View>
      </View>
    );
  }

  const [txt, tono] = h ? etiqueta(h.estado) : ["", "gris"];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo={h?.otro_nombre || "Conversación"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {h ? (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: c.surface,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
              }}
            >
              <Avatar nombre={h.otro_nombre} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala }}>{h.otro_nombre}</Text>
                <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11.5 * escala }}>{h.titulo}</Text>
              </View>
              <Badge tono={tono}>{txt}</Badge>
            </View>

            <Conversacion
              contexto={h.contexto}
              refId={h.ref_id}
              cabecera={<HiloAcciones h={h} />}
              onNuevoMensaje={() => qc.invalidateQueries({ queryKey: ["conversaciones"] })}
            />
          </>
        ) : (
          <View style={{ padding: 16 }}>
            <Text style={{ color: c.muted, fontSize: 13 * escala }}>Cargando conversación…</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
