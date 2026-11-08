import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useZona } from "../context/zona";
import { useTema, hablar } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { Btn, Select, Sheet, useToast } from "./ui";
import { hace } from "../lib/format";
import { F, R } from "../lib/theme";

function IconBtn({ icono, onPress, badge, label }) {
  const { c } = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.28)",
        backgroundColor: "rgba(255,255,255,.12)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icono} size={19} color="#fff" />
      {badge > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: c.brand700, fontFamily: F.bold, fontSize: 10 }}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Header() {
  const { c, escala, grande, contraste, voz, cambiar } = useTema();
  const { usuario, salir, esModerador } = useAuth();
  const { zonas, zona, setZona, usarGPS } = useZona();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [zonaOpen, setZonaOpen] = useState(false);
  const [avisosOpen, setAvisosOpen] = useState(false);
  const [accesOpen, setAccesOpen] = useState(false);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [selZona, setSelZona] = useState(zona);
  const [ubicando, setUbicando] = useState(false);

  const { data: avisos } = useQuery({
    queryKey: ["avisos", usuario?.id],
    queryFn: () => api.get("/api/notificaciones"),
    enabled: Boolean(usuario),
    refetchInterval: 60000,
  });

  const marcarLeidos = async () => {
    try {
      await api.post("/api/notificaciones/leer", {});
      qc.invalidateQueries({ queryKey: ["avisos"] });
    } catch {
      /* da igual */
    }
  };

  const ir = (ruta) => {
    setCuentaOpen(false);
    setAccesOpen(false);
    router.push(ruta);
  };

  return (
    <>
      <View style={{ backgroundColor: c.brand700, paddingTop: insets.top }}>
        <View
          style={{
            minHeight: 56,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => router.push("/")}
            accessibilityRole="button"
            accessibilityLabel="Vecinal Solidaria, ir al inicio"
            style={{ flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "rgba(255,255,255,.15)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="home" size={18} color="#fff" />
            </View>
            <Text
              numberOfLines={1}
              style={{ color: "#fff", fontFamily: F.bold, fontSize: 15 * escala, maxWidth: 118 }}
            >
              Vecinal
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setSelZona(zona);
              setZonaOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Sector: ${zona}. Cambiar`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: "rgba(255,255,255,.13)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,.22)",
              borderRadius: R.pill,
              paddingHorizontal: 9,
              height: 34,
              maxWidth: 150,
              flexShrink: 1,
            }}
          >
            <Icon name="pin" size={13} color="#fff" />
            <Text numberOfLines={1} style={{ color: "#fff", fontSize: 11.5 * escala, fontFamily: F.medium, flexShrink: 1 }}>
              {zona}
            </Text>
          </Pressable>

          <View style={{ flex: 1 }} />

          <IconBtn icono="eye" label="Accesibilidad" onPress={() => setAccesOpen(true)} />

          {usuario ? (
            <>
              <IconBtn icono="bell" label="Avisos" onPress={() => setAvisosOpen(true)} badge={avisos?.sin_leer || 0} />
              <Pressable
                onPress={() => setCuentaOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Mi cuenta"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "rgba(255,255,255,.2)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,.45)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontFamily: F.bold, fontSize: 15 }}>
                  {String(usuario.nombre || "?").trim()[0]?.toUpperCase()}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => router.push("/auth")}
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: "#fff",
                borderRadius: R.pill,
                paddingHorizontal: 12,
                height: 34,
              }}
            >
              <Icon name="user" size={14} color={c.brand800} />
              <Text style={{ color: c.brand800, fontFamily: F.medium, fontSize: 12.5 * escala }}>Entrar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* -------- sector -------- */}
      <Sheet open={zonaOpen} onClose={() => setZonaOpen(false)} titulo="Elegir sector">
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 20 * escala, marginBottom: 6 }}>¿En qué sector estás?</Text>
        <Text style={{ color: c.muted, fontSize: 13.5 * escala, marginBottom: 14, lineHeight: 20 * escala }}>
          Lo usamos para mostrarte primero lo más cercano. Puedes cambiarlo cuando quieras.
        </Text>
        <Btn
          variant="primary"
          icon="pin"
          disabled={ubicando}
          onPress={async () => {
            setUbicando(true);
            try {
              const z = await usarGPS();
              if (z) setSelZona(z);
              toast(z ? `Estás cerca de ${z}` : "Elige tu sector");
            } catch (e) {
              toast(e.message, "warn");
            } finally {
              setUbicando(false);
            }
          }}
        >
          {ubicando ? "Buscando…" : "Usar mi ubicación (GPS)"}
        </Btn>
        <Text style={{ color: c.muted, fontSize: 12.5 * escala, textAlign: "center", marginVertical: 12 }}>
          o elige tu sector
        </Text>
        <Select
          ariaLabel="Sector"
          value={selZona}
          onChange={setSelZona}
          options={(zonas.length ? zonas : [{ nombre: zona }]).map((z) => ({ value: z.nombre, label: z.nombre }))}
        />
        <Btn
          variant="primary"
          style={{ marginTop: 14 }}
          onPress={async () => {
            await setZona(selZona);
            qc.invalidateQueries({ queryKey: ["lista"] });
            qc.invalidateQueries({ queryKey: ["favores"] });
            qc.invalidateQueries({ queryKey: ["recursos"] });
            setZonaOpen(false);
          }}
        >
          Confirmar sector
        </Btn>
      </Sheet>

      {/* -------- avisos -------- */}
      <Sheet open={avisosOpen} onClose={() => setAvisosOpen(false)} titulo="Avisos">
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 20 * escala, marginBottom: 10 }}>Avisos</Text>
        {!(avisos?.items || []).length ? (
          <Text style={{ color: c.muted, fontSize: 13.5 * escala, lineHeight: 20 * escala }}>
            Sin avisos por ahora. Aquí llegan las respuestas a tus cotizaciones y los tratos.
          </Text>
        ) : null}
        {(avisos?.items || []).map((n) => (
          <Pressable
            key={n.id}
            onPress={() => {
              marcarLeidos();
              setAvisosOpen(false);
              const e = n.enlace || "";
              if (e.includes("tab=cotiz") || e.includes("mias")) router.push("/actividad");
              else if (e.includes("emergencia")) router.push("/emergencia");
              else router.push("/");
            }}
            style={{
              padding: 12,
              borderRadius: R.sm,
              marginBottom: 8,
              backgroundColor: n.leida ? c.surface : c.brand50,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala }}>{n.titulo}</Text>
            <Text style={{ color: c.text, fontSize: 13 * escala, marginTop: 3 }}>{n.cuerpo}</Text>
            <Text style={{ color: c.muted, fontSize: 11.5 * escala, marginTop: 4 }}>{hace(n.creado)}</Text>
          </Pressable>
        ))}
        <Btn style={{ marginTop: 8 }} onPress={marcarLeidos}>
          Marcar todos como leídos
        </Btn>
      </Sheet>

      {/* -------- accesibilidad -------- */}
      <Sheet open={accesOpen} onClose={() => setAccesOpen(false)} titulo="Accesibilidad">
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 20 * escala, marginBottom: 8 }}>Accesibilidad</Text>
        <OpcionAcces
          icono="text"
          titulo={grande ? "Letra normal" : "Letra grande"}
          texto="Aumenta el tamaño de todo el texto."
          onPress={() => cambiar("grande", !grande)}
        />
        <OpcionAcces
          icono="eye"
          titulo={contraste ? "Contraste normal" : "Alto contraste"}
          texto="Bordes y textos más marcados."
          onPress={() => cambiar("contraste", !contraste)}
        />
        <OpcionAcces
          icono="speaker"
          titulo={voz ? "Detener lectura" : "Leer en voz alta"}
          texto="La app lee el título de cada pantalla."
          onPress={() => cambiar("voz", !voz)}
        />
        <Btn
          style={{ marginTop: 10 }}
          icon="speaker"
          onPress={() => hablar("Vecinal Solidaria. El barrio, entre vecinos.")}
        >
          Probar la voz
        </Btn>
      </Sheet>

      {/* -------- cuenta -------- */}
      <Sheet open={cuentaOpen} onClose={() => setCuentaOpen(false)} titulo="Mi cuenta">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: c.brand50,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: c.brand800, fontFamily: F.bold, fontSize: 22 }}>
              {String(usuario?.nombre || "?").trim()[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 17 * escala }}>{usuario?.nombre}</Text>
            <Text style={{ color: c.muted, fontSize: 12.5 * escala }}>
              {usuario?.telefono} · {usuario?.zona}
            </Text>
          </View>
        </View>

        <MenuCuenta icono="user" texto="Mi perfil" onPress={() => ir("/perfil")} />
        <MenuCuenta icono="chat" texto="Mensajes" onPress={() => ir("/mensajes")} />
        <MenuCuenta icono="clipboard" texto="Mi actividad" onPress={() => ir("/actividad")} />
        <MenuCuenta icono="book" texto="Tutorial" onPress={() => ir("/tutorial")} />
        {esModerador ? <MenuCuenta icono="shield" texto="Moderación" onPress={() => ir("/moderacion")} /> : null}
        <MenuCuenta
          icono="logout"
          texto="Cerrar sesión"
          peligro
          onPress={async () => {
            await salir();
            setCuentaOpen(false);
            toast("Sesión cerrada");
            router.replace("/");
          }}
        />
      </Sheet>
    </>
  );
}

function OpcionAcces({ icono, titulo, texto, onPress }) {
  const { c, escala } = useTema();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.line,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.brand50,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icono} size={18} color={c.brand700} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala }}>{titulo}</Text>
        <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: 2 }}>{texto}</Text>
      </View>
    </Pressable>
  );
}

function MenuCuenta({ icono, texto, onPress, peligro }) {
  const { c, escala } = useTema();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.line,
      }}
    >
      <Icon name={icono} size={19} color={peligro ? c.danger : c.brand700} />
      <Text style={{ color: peligro ? c.danger : c.ink, fontSize: 15 * escala, flex: 1 }}>{texto}</Text>
      <Icon name="chevron" size={15} color={c.muted} />
    </Pressable>
  );
}

export function BarraVolver({ titulo, acciones }) {
  const { c, escala } = useTema();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: c.brand700,
      }}
    >
      <View style={{ height: 54, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="back" size={22} color="#fff" />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontFamily: F.medium, fontSize: 16 * escala }}>
          {titulo}
        </Text>
        {acciones}
      </View>
    </View>
  );
}
