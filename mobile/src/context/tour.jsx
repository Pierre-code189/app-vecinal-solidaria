import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Btn } from "../components/ui";
import { Icon } from "../lib/icons";
import { useTema } from "./ajustes";
import { useAuth } from "./auth";
import { kv } from "../lib/storage";
import { F, S } from "../lib/theme";

const PASOS = [
  { ruta: "/", icono: "home", titulo: "Bienvenido a Vecinal", texto: "Te muestro en menos de un minuto cómo funciona el barrio. Puedes salir cuando quieras." },
  { ruta: "/", icono: "pin", titulo: "Tu sector", texto: "Arriba está tu sector. Tócalo para cambiarlo o usar tu ubicación: con eso ordenamos todo por cercanía." },
  { ruta: "/", icono: "search", titulo: "Buscar", texto: "Escribe lo que necesitas y filtra por categoría, distancia o los mejor valorados." },
  { ruta: "/", icono: "store", titulo: "Cada tarjeta te dice lo importante", texto: "Categoría, distancia, precio, formas de pago y vistos buenos. Si tiene aval, verás quién lo respalda." },
  { ruta: "/", icono: "plus", titulo: "Un solo botón para publicar", texto: "El + del centro publica las tres cosas: servicio o producto, favor y aviso de emergencia." },
  { ruta: "/", icono: "chat", titulo: "Mensajes", texto: "El botón flotante abre tus conversaciones. Dentro de una publicación puedes escribir al vecino y acordar el trato." },
  { ruta: "/favores", icono: "solidaridad", titulo: "Favores", texto: "Aquí se pide y se ofrece ayuda sin dinero: préstamos, movilidad, compañía." },
  { ruta: "/emergencia", icono: "alert", titulo: "Emergencias", texto: "Los teléfonos 105, 116, 115 y 106 siempre a la vista, y los recursos que ofrecen tus vecinos." },
  { ruta: "/", icono: "user", titulo: "Tu cuenta y la accesibilidad", texto: "Con tu inicial abres tu perfil, la actividad y el tutorial. El ojo activa letra grande, alto contraste y lectura en voz alta." },
  { ruta: "/", icono: "check", titulo: "Listo", texto: "Eso es todo. Vuelve a este recorrido cuando quieras desde tu cuenta." },
];

const Ctx = createContext({ abrir: () => {} });
export const useTour = () => useContext(Ctx);

export function TourProvider({ children }) {
  const [activo, setActivo] = useState(false);
  const { usuario } = useAuth();

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    (async () => {
      const visto = await kv.get("vecinal-tour");
      if (!visto && vivo) setTimeout(() => vivo && setActivo(true), 1200);
    })();
    return () => {
      vivo = false;
    };
  }, [usuario]);

  const valor = useMemo(() => ({ abrir: () => setActivo(true) }), []);
  return (
    <Ctx.Provider value={valor}>
      {children}
      <Tour activo={activo} onClose={() => setActivo(false)} />
    </Ctx.Provider>
  );
}

function Tour({ activo, onClose }) {
  const { c, escala } = useTema();
  const router = useRouter();
  const [i, setI] = useState(0);
  const paso = PASOS[i];

  useEffect(() => {
    if (!activo) return;
    setI(0);
  }, [activo]);

  const cerrar = () => {
    kv.set("vecinal-tour", "1");
    onClose();
  };

  if (!activo) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cerrar}>
      <View style={{ flex: 1, backgroundColor: "rgba(8,16,10,.55)", justifyContent: "flex-end", padding: 14, paddingBottom: 84 }}>
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: c.brand50,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={paso.icono} size={17} color={c.brand700} />
            </View>
            <Text style={{ color: c.muted, fontSize: 11.5 * escala, fontFamily: F.medium }}>
              Paso {i + 1} de {PASOS.length}
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={cerrar} hitSlop={8} accessibilityLabel="Salir del recorrido">
              <Icon name="close" size={20} color={c.muted} />
            </Pressable>
          </View>

          <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 19 * escala, marginBottom: 6 }}>{paso.titulo}</Text>
          <Text style={{ color: c.text, fontSize: 14 * escala, lineHeight: 21 * escala }}>{paso.texto}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: S[4], gap: 8 }}>
            <Pressable onPress={cerrar} hitSlop={6}>
              <Text style={{ color: c.muted, fontSize: 13 * escala, textDecorationLine: "underline" }}>Salir</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {i > 0 ? (
              <Btn size="small" icon="back" onPress={() => setI(i - 1)}>
                Atrás
              </Btn>
            ) : null}
            <Btn
              size="small"
              variant="primary"
              icon={i === PASOS.length - 1 ? "check" : undefined}
              onPress={() => {
                if (i >= PASOS.length - 1) {
                  cerrar();
                  return;
                }
                const siguiente = PASOS[i + 1];
                router.push(siguiente.ruta);
                setI(i + 1);
              }}
            >
              {i === PASOS.length - 1 ? "Terminar" : "Siguiente"}
            </Btn>
          </View>

          <View style={{ flexDirection: "row", gap: 5, justifyContent: "center", marginTop: 14 }}>
            {PASOS.map((_, k) => (
              <View
                key={k}
                style={{
                  width: k === i ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: k === i ? c.brand600 : c.line,
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
