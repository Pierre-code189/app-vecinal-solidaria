import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarraVolver } from "../components/Header";
import AuthForm from "../components/AuthForm";
import { Icon } from "../lib/icons";
import { useTema } from "../context/ajustes";
import { F, R, S } from "../lib/theme";

const BENEFICIOS = [
  { icono: "pin", titulo: "Primero lo de tu sector", texto: "Servicios y productos ordenados por cercanía real." },
  { icono: "heart", titulo: "Favores sin dinero", texto: "Préstamos, movilidad y ayuda entre vecinos, con garante." },
  { icono: "alert", titulo: "Emergencias a mano", texto: "105, 116, 115 y 106, y lo que el barrio ofrece." },
];

export default function AuthScreen() {
  const { c, escala } = useTema();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo="Entrar" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
        >
          <View
            style={{
              alignItems: "center",
              paddingVertical: 18,
              backgroundColor: c.brand50,
              borderRadius: R.md,
              marginBottom: S[4],
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                backgroundColor: c.brand600,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="home" size={28} color="#fff" />
            </View>
            <Text style={{ color: c.brand900, fontFamily: F.bold, fontSize: 22 * escala, marginTop: 10 }}>
              Vecinal Solidaria
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 * escala, marginTop: 3 }}>Piura · el barrio, entre vecinos</Text>
          </View>

          <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 24 * escala, letterSpacing: -0.5 }}>
            El barrio, entre vecinos
          </Text>
          <Text style={{ color: c.text, fontSize: 14 * escala, lineHeight: 21 * escala, marginTop: 6, marginBottom: 16 }}>
            Servicios y productos cerca de ti, favores sin dinero y avisos de emergencia. Entras con tu teléfono y un
            PIN de 6 dígitos, para que sepas con quién tratas y tu número solo lo vean vecinos reales.
          </Text>

          {BENEFICIOS.map((b) => (
            <View key={b.titulo} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: c.brand50,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={b.icono} size={18} color={c.brand700} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala }}>{b.titulo}</Text>
                <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: 2 }}>{b.texto}</Text>
              </View>
            </View>
          ))}

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              backgroundColor: c.surface2,
              borderRadius: R.sm,
              padding: 12,
              marginBottom: 18,
            }}
          >
            <Icon name="lock" size={16} color={c.muted} />
            <Text style={{ color: c.muted, fontSize: 12 * escala, flex: 1, lineHeight: 18 * escala }}>
              Nadie sin cuenta puede ver teléfonos, Yape ni ubicaciones. Tu sector se muestra solo de forma
              aproximada.
            </Text>
          </View>

          <AuthForm onListo={() => router.replace("/perfil")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
