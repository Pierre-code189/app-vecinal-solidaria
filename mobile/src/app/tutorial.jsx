import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/auth";
import { useTema, useLectorVoz } from "../context/ajustes";
import { useTour } from "../context/tour";
import { Icon } from "../lib/icons";
import { BarraVolver } from "../components/Header";
import { Btn } from "../components/ui";
import { F, R, S } from "../lib/theme";

const RESUMEN = [
  ["pin", "Tu sector", "Cómo se elige y por qué ordena todo por cercanía."],
  ["search", "Buscar y filtrar", "Texto, voz, categoría y distancia."],
  ["store", "Las tarjetas", "Precio, pagos, distancia y quién lo ofrece."],
  ["plus", "Publicar", "Tres pasos, con fotos y aviso de privacidad."],
  ["heart", "Favores", "Pedir y ofrecer ayuda sin dinero."],
  ["alert", "Emergencias", "SOS, recursos y directorio del barrio."],
  ["clipboard", "Mi actividad", "Tus tratos, cotizaciones y consultas."],
  ["user", "Tu cuenta", "Perfil, PIN y cierre de sesión."],
];

export default function Tutorial() {
  const { c, escala } = useTema();
  const { abrir } = useTour();
  const { usuario } = useAuth();
  const router = useRouter();

  useLectorVoz("Cómo funciona Vecinal. Un recorrido por la app, pantalla por pantalla.");

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo="Tutorial" />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 24 * escala, letterSpacing: -0.5 }}>
          Cómo funciona Vecinal
        </Text>
        <Text style={{ color: c.muted, fontSize: 13 * escala, marginTop: 4, marginBottom: 14, lineHeight: 19 * escala }}>
          Un recorrido por la app, pantalla por pantalla. Dura menos de un minuto.
        </Text>

        <View
          style={{
            backgroundColor: c.brand50,
            borderWidth: 1,
            borderColor: c.brand100,
            borderRadius: R.md,
            padding: 16,
            gap: 10,
          }}
        >
          <Text style={{ color: c.brand900, fontFamily: F.bold, fontSize: 16 * escala }}>
            {usuario ? `Hola, ${usuario.nombre.split(" ")[0]}.` : "Hola."}
          </Text>
          <Text style={{ color: c.text, fontSize: 13.5 * escala, lineHeight: 20 * escala }}>
            Te acompañamos desde el primer paso: elegir tu sector, buscar, publicar, pedir ayuda y avisar de una
            emergencia. Puedes salir cuando quieras y repetirlo cuando lo necesites.
          </Text>
          <Btn variant="primary" icon="book" onPress={abrir} style={{ alignSelf: "flex-start", marginTop: 4 }}>
            Empezar el recorrido
          </Btn>
          <Text style={{ color: c.muted, fontSize: 12 * escala }}>
            También puedes activar la letra grande desde tu cuenta.
          </Text>
        </View>

        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala, marginTop: S[5], marginBottom: S[3] }}>
          Lo que verás
        </Text>

        <View style={{ gap: 10 }}>
          {RESUMEN.map(([icono, titulo, texto]) => (
            <View
              key={titulo}
              style={{
                flexDirection: "row",
                gap: 12,
                alignItems: "flex-start",
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: R.md,
                padding: 12,
              }}
            >
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
                <Icon name={icono} size={18} color={c.brand700} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala }}>{titulo}</Text>
                <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: 2, lineHeight: 18 * escala }}>{texto}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={{ color: c.muted, fontSize: 12 * escala, lineHeight: 18 * escala, marginTop: S[4] }}>
          El recorrido te lleva a la sección que toca. Si al volver no lo ves, entra a Tutorial desde el menú de tu
          cuenta.
        </Text>

        <Btn
          style={{ marginTop: S[4] }}
          icon="back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        >
          Volver
        </Btn>
      </ScrollView>
    </View>
  );
}
