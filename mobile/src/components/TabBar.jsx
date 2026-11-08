import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "../lib/icons";
import { useTema } from "../context/ajustes";
import { F, shadow } from "../lib/theme";

const SECCIONES = {
  index: { icono: "store", label: "Local", color: "#006b2c" },
  favores: { icono: "solidaridad", label: "Favores", color: "#006194" },
  emergencia: { icono: "alert", label: "Emergencia", color: "#b61722" },
  perfil: { icono: "user", label: "Perfil", color: "#4b3fa7" },
};

/* Barra inferior con el botón central de publicar, igual que la web. */
export function TabBar({ state, navigation }) {
  const { c, escala } = useTema();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const actual = state.routes[state.index]?.name;
  const color = SECCIONES[actual]?.color || c.brand600;

  const ir = (nombre) => {
    const ruta = state.routes.find((r) => r.name === nombre);
    if (!ruta) return;
    const evento = navigation.emit({ type: "tabPress", target: ruta.key, canPreventDefault: true });
    if (!evento.defaultPrevented) navigation.navigate(nombre);
  };

  const Item = ({ nombre, activo, colorActivo }) => {
    const s = SECCIONES[nombre];
    return (
      <Pressable
        onPress={() => ir(nombre)}
        accessibilityRole="tab"
        accessibilityState={{ selected: activo }}
        accessibilityLabel={s.label}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}
      >
        <Icon name={s.icono} size={22} color={activo ? colorActivo : c.muted} strokeWidth={activo ? 2 : 1.7} />
        <Text
          style={{
            color: activo ? colorActivo : c.muted,
            fontSize: 10.5 * escala,
            fontFamily: activo ? F.medium : F.regular,
          }}
        >
          {nombre === "index" ? "Local" : s.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingBottom: insets.bottom,
        flexDirection: "row",
        alignItems: "flex-end",
        height: 64 + insets.bottom,
      }}
    >
      <Item nombre="index" activo={actual === "index"} colorActivo={c.brand700} />
      <Item nombre="favores" activo={actual === "favores"} colorActivo="#006194" />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
        <Pressable
          onPress={() => router.push("/publicar")}
          accessibilityRole="button"
          accessibilityLabel="Publicar"
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: color,
            borderWidth: 4,
            borderColor: c.surface,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
            marginTop: -26,
            ...shadow,
          }}
        >
          <Icon name="plus" size={27} color="#fff" strokeWidth={2.2} />
        </Pressable>
        <Text style={{ color: c.muted, fontSize: 9.5 * escala, marginBottom: 6 }}>Publicar</Text>
      </View>

      <Item nombre="emergencia" activo={actual === "emergencia"} colorActivo={c.danger} />
      <Item nombre="perfil" activo={actual === "perfil"} colorActivo="#4b3fa7" />
    </View>
  );
}
