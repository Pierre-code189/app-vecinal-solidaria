import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useTema } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { shadow } from "../lib/theme";

const VISIBLE = ["/", "/favores", "/emergencia", "/perfil", "/index"];

/* Botón flotante de mensajes: se arrastra, rebota a los bordes y abre la bandeja. */
export function ChatFab() {
  const { c } = useTema();
  const { usuario } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [pos, setPos] = useState({ x: width - 70, y: height - 230 });
  const inicio = useRef({ x: 0, y: 0 });
  const movido = useRef(0);
  const valor = useRef(new Animated.ValueXY({ x: width - 70, y: height - 230 })).current;

  useEffect(() => {
    valor.setValue(pos);
  }, [pos, valor]);

  const { data: avisos } = useQuery({
    queryKey: ["avisos", usuario?.id],
    queryFn: () => api.get("/api/notificaciones"),
    enabled: Boolean(usuario),
    refetchInterval: 60000,
  });

  const limites = () => ({
    xMin: 14,
    xMax: Math.max(14, width - 62),
    yMin: insets.top + 74,
    yMax: Math.max(insets.top + 74, height - insets.bottom - 96),
  });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        movido.current = 0;
        valor.stopAnimation((v) => {
          inicio.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        movido.current = Math.max(movido.current, Math.abs(g.dx) + Math.abs(g.dy));
        const { xMin, xMax, yMin, yMax } = limites();
        const x = Math.min(Math.max(inicio.current.x + g.dx, xMin - 20), xMax + 20);
        const y = Math.min(Math.max(inicio.current.y + g.dy, yMin - 20), yMax + 20);
        valor.setValue({ x, y });
      },
      onPanResponderRelease: () => {
        const { xMin, xMax, yMin, yMax } = limites();
        valor.stopAnimation((v) => {
          const centro = (v.x + 24) / width;
          const x = centro < 0.5 ? xMin : xMax;
          const y = Math.min(Math.max(v.y, yMin), yMax);
          setPos({ x, y });
          if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        });
      },
    }),
  ).current;

  if (!VISIBLE.includes(pathname)) return null;

  const sinLeer = avisos?.sin_leer || 0;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: valor.getTranslateTransform(),
        zIndex: 50,
      }}
      {...responder.panHandlers}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sinLeer ? `Mensajes, ${sinLeer} sin leer` : "Mensajes"}
        onPress={() => {
          if (movido.current > 8) return;
          if (!usuario) {
            router.push("/auth");
            return;
          }
          router.push("/mensajes");
        }}
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: c.brand600,
          alignItems: "center",
          justifyContent: "center",
          ...shadow,
        }}
      >
        <Icon name="chat" size={23} color="#fff" />
        {sinLeer > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              minWidth: 19,
              height: 19,
              paddingHorizontal: 4,
              borderRadius: 10,
              backgroundColor: c.danger,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: "#fff",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "700" }}>{sinLeer > 9 ? "9+" : sinLeer}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
