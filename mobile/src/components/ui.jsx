import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, CAT_ICON } from "../lib/icons";
import { cap, medios } from "../lib/format";
import { abs } from "../lib/api";
import { useTema } from "../context/ajustes";
import { R, S, shadow, shadowSoft, F } from "../lib/theme";

/* ------------------------------------------------------------------ botón */
export function Btn({ variant = "sec", size, icon, children, style, textStyle, disabled, color, ...props }) {
  const { c, escala } = useTema();
  const alto = size === "small" ? 38 : 48;
  const esPrimario = variant === "primary";
  const esPeligro = variant === "danger";
  const fondo = esPrimario ? c.brand600 : esPeligro ? c.danger : c.surface;
  const borde = esPrimario ? c.brand600 : esPeligro ? c.danger : c.line;
  const tinta = esPrimario || esPeligro ? "#fff" : color || c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: alto,
          paddingHorizontal: size === "small" ? 12 : 16,
          borderRadius: R.sm,
          borderWidth: 1,
          borderColor: borde,
          backgroundColor: fondo,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        },
        style,
      ]}
      {...props}
    >
      {icon ? <Icon name={icon} size={size === "small" ? 15 : 18} color={tinta} /> : null}
      {typeof children === "string" ? (
        <Text
          style={[
            {
              color: tinta,
              fontFamily: F.medium,
              fontSize: (size === "small" ? 13 : 15) * escala,
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function LinkBtn({ children, onPress, style, color }) {
  const { c, escala } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={style}>
      <Text style={{ color: color || c.brand600, fontFamily: F.medium, fontSize: 14 * escala, textDecorationLine: "underline" }}>
        {children}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ campos */
export function Field({ label, hint, error, children, contador, style }) {
  const { c, escala } = useTema();
  return (
    <View style={[{ marginBottom: S[4] }, style]}>
      {label ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala }}>{label}</Text>
          {contador != null ? <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>{contador}</Text> : null}
        </View>
      ) : null}
      {children}
      {hint ? <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: 6, lineHeight: 18 * escala }}>{hint}</Text> : null}
      {error ? <Text style={{ color: c.danger, fontSize: 13 * escala, marginTop: 6 }}>{error}</Text> : null}
    </View>
  );
}

export function Input({ style, multiline, rows = 3, ...props }) {
  const { c, escala } = useTema();
  const [foco, setFoco] = useState(false);
  return (
    <TextInput
      placeholderTextColor={c.muted2}
      multiline={multiline}
      style={[
        {
          minHeight: multiline ? 44 * rows : 48,
          borderWidth: 1,
          borderColor: foco ? c.brand500 : c.line,
          backgroundColor: c.surface,
          borderRadius: R.sm,
          paddingHorizontal: 13,
          paddingVertical: multiline ? 11 : 0,
          color: c.ink,
          fontSize: 15.5 * escala,
          textAlignVertical: multiline ? "top" : "center",
        },
        style,
      ]}
      onFocus={(e) => {
        setFoco(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFoco(false);
        props.onBlur?.(e);
      }}
      {...props}
    />
  );
}

export function Check({ checked, onChange, children }) {
  const { c, escala } = useTema();
  return (
    <Pressable
      onPress={() => onChange?.(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: Boolean(checked) }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 9, paddingVertical: 6 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? c.brand600 : c.lineStrong,
          backgroundColor: checked ? c.brand600 : c.surface,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {checked ? <Icon name="check" size={14} color="#fff" strokeWidth={2.4} /> : null}
      </View>
      <Text style={{ flex: 1, color: c.text, fontSize: 13.5 * escala, lineHeight: 20 * escala }}>{children}</Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- selector */
export function Select({ value, onChange, options, ariaLabel, placeholder, style }) {
  const { c, escala } = useTema();
  const [abierto, setAbierto] = useState(false);
  const insets = useSafeAreaInsets();
  const actual = options.find((o) => String(o.value) === String(value)) || options[0];

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`${ariaLabel || "Opción"}: ${actual?.label || ""}`}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: R.sm,
            backgroundColor: c.surface,
            paddingHorizontal: 13,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          },
          style,
        ]}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: actual ? c.ink : c.muted, fontSize: 15 * escala }}>
          {actual?.label || placeholder || "Elegir"}
        </Text>
        <Icon name="chevron" size={16} color={c.muted} />
      </Pressable>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={() => setAbierto(false)}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: insets.bottom + 12,
            maxHeight: 420,
            backgroundColor: c.surface,
            borderRadius: R.md,
            overflow: "hidden",
            ...shadow,
          }}
        >
          <Text style={{ padding: 14, fontFamily: F.medium, color: c.ink, fontSize: 15 * escala, borderBottomWidth: 1, borderBottomColor: c.line }}>
            {ariaLabel || "Elige una opción"}
          </Text>
          <ScrollView>
            {options.map((o) => {
              const on = String(o.value) === String(value);
              return (
                <Pressable
                  key={String(o.value)}
                  onPress={() => {
                    onChange?.(o.value);
                    setAbierto(false);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: on ? c.brand50 : c.surface,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.line,
                  }}
                >
                  <Text style={{ color: on ? c.brand700 : c.text, fontSize: 15 * escala, fontFamily: on ? F.medium : F.regular, flex: 1 }}>
                    {o.label}
                  </Text>
                  {on ? <Icon name="check" size={17} color={c.brand600} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------- segmentados */
export function Segmented({ value, onChange, options, scroll = false }) {
  const { c, escala } = useTema();
  const contenido = (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: R.pill,
        padding: 4,
        gap: 3,
      }}
    >
      {options.map((o) => {
        const on = String(value) === String(o.value);
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange?.(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: scroll ? undefined : 1,
              paddingHorizontal: 13,
              minHeight: 36,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: R.pill,
              backgroundColor: on ? c.surface : "transparent",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: on ? c.brand800 : c.muted,
                fontFamily: on ? F.medium : F.regular,
                fontSize: 13 * escala,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  if (!scroll) return contenido;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
      {contenido}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ piezas */
export function Badge({ tono = "", children }) {
  const { c, escala } = useTema();
  const mapa = {
    verde: { bg: c.brand50, fg: c.brand800, bd: c.brand100 },
    rojo: { bg: c.danger50, fg: c.dangerInk, bd: c.dangerLine },
    gris: { bg: c.surface2, fg: c.muted, bd: c.line },
    azul: { bg: c.info50, fg: c.info, bd: c.infoLine },
  };
  const t = mapa[tono] || mapa.gris;
  return (
    <View
      style={{
        backgroundColor: t.bg,
        borderColor: t.bd,
        borderWidth: 1,
        borderRadius: R.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: t.fg, fontSize: 11.5 * escala, fontFamily: F.medium }}>{children}</Text>
    </View>
  );
}

export function Avatar({ nombre, size = 40 }) {
  const { c } = useTema();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.brand50,
        borderWidth: 1,
        borderColor: c.brand100,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: c.brand800, fontFamily: F.bold, fontSize: size * 0.4 }}>
        {String(nombre || "?").trim()[0]?.toUpperCase() || "?"}
      </Text>
    </View>
  );
}

export function Empty({ icon = "search", titulo, texto, accion }) {
  const { c, escala } = useTema();
  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.lineStrong,
        borderRadius: R.md,
        backgroundColor: c.surface,
        padding: S[6],
        alignItems: "center",
        marginVertical: S[3],
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: c.brand50,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: S[3],
        }}
      >
        <Icon name={icon} size={24} color={c.brand700} />
      </View>
      <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 15.5 * escala, textAlign: "center" }}>{titulo}</Text>
      {texto ? (
        <Text style={{ color: c.muted, fontSize: 13.5 * escala, textAlign: "center", marginTop: 6, lineHeight: 20 * escala }}>
          {texto}
        </Text>
      ) : null}
      {accion ? <View style={{ marginTop: 14 }}>{accion}</View> : null}
    </View>
  );
}

export function Skeleton({ height = 90 }) {
  const { c } = useTema();
  return <View style={{ height, borderRadius: R.md, backgroundColor: c.surface3, marginVertical: 6 }} />;
}

/* ------------------------------------------------------------------- hoja */
export function Sheet({ open, onClose, titulo, children, maxHeight = "92%" }) {
  const { c, escala } = useTema();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={Boolean(open)} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              maxHeight,
              paddingBottom: insets.bottom,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: c.lineStrong }} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 6,
              }}
            >
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 15 * escala, flex: 1 }} numberOfLines={1}>
                {titulo || ""}
              </Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Icon name="close" size={22} color={c.muted} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: S[5] }}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ avisos */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const { c, escala } = useTema();
  const insets = useSafeAreaInsets();

  const push = useCallback((msg, tipo = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((a) => [...a, { id, msg, tipo }]);
    setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 90, gap: 8 }}>
        {items.map((t) => (
          <View
            key={t.id}
            style={{
              backgroundColor: t.tipo === "err" ? c.danger : t.tipo === "warn" ? c.warn : c.brand800,
              borderRadius: R.sm,
              paddingHorizontal: 14,
              paddingVertical: 11,
              ...shadow,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14 * escala, fontFamily: F.medium }}>{t.msg}</Text>
          </View>
        ))}
      </View>
    </ToastCtx.Provider>
  );
}

/* ---------------------------------------------------------------- tarjeta */
export function Tarjeta({ p, zona, onOpen }) {
  const { c, escala } = useTema();
  const cat = CAT_ICON[p.categoria] || "dots";
  const nv = p.vistos || 0;
  const esFavor = String(p.tipo || "").startsWith("favor");
  const esEmergencia = Boolean(p.es_emergencia);
  const reciente = Boolean(p.creado) && Date.now() / 1000 - p.creado < 86400;
  const foto = p.fotos && p.fotos.length ? p.fotos[0] : null;
  const aval = (p.avaladores || [])[0]?.nombre || "";
  const dist =
    p.ubicacion_aproximada && p.zona === zona
      ? "en tu sector"
      : p.distancia_km != null
        ? p.distancia_km < 0.05
          ? "en tu sector"
          : p.distancia_km < 1
            ? `a ${Math.round(p.distancia_km * 1000)} m`
            : `a ${p.distancia_km.toFixed(1).replace(".", ",")} km`
        : "";
  const mediosPago = String(p.medios_pago || "")
    .split(",")
    .filter(Boolean)
    .filter((m) => !(esFavor && m === "intercambio"));

  return (
    <Pressable
      onPress={() => onOpen?.(p)}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de ${p.titulo}`}
      style={({ pressed }) => [
        {
          backgroundColor: c.surface,
          borderRadius: R.md,
          borderWidth: 1,
          borderColor: c.line,
          overflow: "hidden",
          opacity: pressed ? 0.94 : 1,
          ...shadowSoft,
        },
      ]}
    >
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 }}>
            <Icon name={cat} size={15} color={c.brand700} />
            <Text numberOfLines={1} style={{ color: c.brand800, backgroundColor: c.brand50, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2, fontSize: 11.5 * escala, fontFamily: F.medium }}>
              {cap(String(p.categoria || "").replace(/_/g, " "))}
            </Text>
          </View>
          {esEmergencia ? (
            <Badge tono="rojo">Emergencia</Badge>
          ) : reciente ? (
            <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>Hoy</Text>
          ) : null}
        </View>

        <Text
          numberOfLines={2}
          style={{ color: c.ink, fontFamily: F.bold, fontSize: 16.5 * escala, lineHeight: 22 * escala }}
        >
          {p.titulo}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {dist ? (
            <>
              <Icon name="pin" size={12} color={c.muted} />
              <Text style={{ color: c.muted, fontSize: 12 * escala }}>{dist}</Text>
              <Text style={{ color: c.muted }}>•</Text>
            </>
          ) : null}
          {esFavor ? (
            <Badge tono={p.tipo === "favor_solicitado" ? "rojo" : "verde"}>
              {p.tipo === "favor_solicitado" ? "Necesito" : "Ofrezco"}
            </Badge>
          ) : (
            <Text style={{ color: c.brand800, fontFamily: F.bold, fontSize: 16 * escala }}>{p.precio || "A convenir"}</Text>
          )}
          {p.stock === 0 ? <Badge tono="gris">Agotado</Badge> : null}
        </View>

        {aval ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="shield" size={13} color={c.brand700} />
            <Text style={{ color: c.brand700, fontSize: 11.5 * escala }}>Avalado por {aval}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ height: 148, backgroundColor: c.surface3, alignItems: "center", justifyContent: "center" }}>
        {foto ? (
          <Image source={{ uri: abs(foto) }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
        ) : (
          <Icon name={esFavor ? "handshake" : cat} size={58} color={c.brand500} strokeWidth={1.2} />
        )}
      </View>

      <View style={{ padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", flex: 1 }}>
          {mediosPago.slice(0, 3).map((m) => (
            <Badge key={m} tono="gris">
              {medios({ medios_pago: m })[0] || m}
            </Badge>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="thumb" size={14} color={nv ? c.brand600 : c.muted} />
          <Text style={{ color: nv ? c.brand700 : c.muted, fontSize: 12 * escala, fontFamily: F.medium }}>
            {nv || "Nuevo"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- mini mapa */
const TILE = 256;

export function MiniMapa({ lat, lng, nombre }) {
  const { c, escala } = useTema();
  const [dim, setDim] = useState({ w: 0, h: 230 });

  const celdas = useMemo(() => {
    if (lat == null || lng == null || !dim.w) return [];
    const z = 16;
    const n = 2 ** z;
    const xf = ((lng + 180) / 360) * n;
    const yf =
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
    const xt = Math.floor(xf);
    const yt = Math.floor(yf);
    const fx = xf - xt;
    const fy = yf - yt;
    const out = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = (((xt + dx) % n) + n) % n;
        const y = yt + dy;
        out.push({
          key: `${x}-${y}`,
          x,
          y,
          z,
          sub: "abc"[(xt + yt) % 3],
          left: Math.round(dim.w / 2 - fx * TILE + dx * TILE),
          top: Math.round(dim.h / 2 - fy * TILE + dy * TILE),
        });
      }
    }
    return out;
  }, [lat, lng, dim]);

  if (lat == null || lng == null) return null;

  return (
    <View>
      <View
        onLayout={(e) => setDim({ w: e.nativeEvent.layout.width, h: 230 })}
        style={{ height: 230, borderRadius: R.md, overflow: "hidden", backgroundColor: c.surface3 }}
        accessibilityLabel={`Ubicación aproximada de ${nombre || "la publicación"}`}
      >
        {celdas.map((t) => (
          <Image
            key={t.key}
            source={{ uri: `https://${t.sub}.tile.openstreetmap.fr/osmfr/${t.z}/${t.x}/${t.y}.png` }}
            style={{ position: "absolute", left: t.left, top: t.top, width: TILE, height: TILE }}
            contentFit="cover"
          />
        ))}
        <View style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -14, marginTop: -28 }}>
          <Icon name="pin" size={28} color={c.danger} strokeWidth={2} />
        </View>
        <Text style={{ position: "absolute", right: 6, bottom: 4, fontSize: 9, color: c.muted }}>© OpenStreetMap</Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: 8, lineHeight: 18 * escala }}>
        Ubicación aproximada (±400 m). El punto exacto se coordina por WhatsApp.
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ títulos */
export function Titulo({ children, sub, accion }) {
  const { c, escala } = useTema();
  return (
    <View style={{ marginTop: S[3], marginBottom: S[3], flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 26 * escala, letterSpacing: -0.6, lineHeight: 31 * escala }}>
          {children}
        </Text>
        {sub ? (
          <Text style={{ color: c.muted, fontSize: 13.5 * escala, marginTop: 5, lineHeight: 20 * escala }}>{sub}</Text>
        ) : null}
      </View>
      {accion}
    </View>
  );
}

export function Cargando({ texto = "Cargando…" }) {
  const { c, escala } = useTema();
  return (
    <View style={{ paddingVertical: 38, alignItems: "center", gap: 10 }}>
      <ActivityIndicator color={c.brand600} />
      <Text style={{ color: c.muted, fontSize: 13 * escala }}>{texto}</Text>
    </View>
  );
}

export function Fila({ children, style }) {
  const { c } = useTema();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: R.md, padding: 14, gap: 8 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------- chip */
export function Chip({ icono, activo, onPress, children }) {
  const { c, escala } = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(activo) }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 34,
        paddingHorizontal: 12,
        borderRadius: R.pill,
        borderWidth: 1,
        borderColor: activo ? c.brand600 : c.line,
        backgroundColor: activo ? c.brand600 : c.surface,
      }}
    >
      {icono ? <Icon name={icono} size={14} color={activo ? "#fff" : c.muted} /> : null}
      <Text style={{ color: activo ? "#fff" : c.text, fontSize: 12.5 * escala, fontFamily: F.medium }}>{children}</Text>
    </Pressable>
  );
}

export const pantalla = { flex: 1 };

export function useAncho() {
  const [w, setW] = useState(Dimensions.get("window").width);
  useEffect(() => {
    const s = Dimensions.addEventListener("change", ({ window }) => setW(window.width));
    return () => s?.remove?.();
  }, []);
  return w;
}
