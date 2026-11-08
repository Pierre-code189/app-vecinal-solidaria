import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/auth";
import { useZona } from "../../context/zona";
import { useLectorVoz, useTema } from "../../context/ajustes";
import { Icon } from "../../lib/icons";
import { Avatar, Badge, Btn, Field, Input, LinkBtn, Select, Sheet, Titulo, useToast } from "../../components/ui";
import AuthForm from "../../components/AuthForm";
import { api } from "../../lib/api";
import { F, R, S, shadowSoft } from "../../lib/theme";

export default function Perfil() {
  const { c, escala } = useTema();
  const { usuario, salir, recargar, entrarPin } = useAuth();
  const { zonas } = useZona();
  const toast = useToast();
  const router = useRouter();

  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({});
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState({ actual: "", nuevo: "" });
  const [pinError, setPinError] = useState("");

  useLectorVoz(usuario ? `Mi perfil. ${usuario.nombre}.` : "Entrar o crear cuenta.");

  if (!usuario) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        <Titulo sub="Una cuenta por persona. Tu número solo lo ven vecinos con sesión.">
          Entrar o crear cuenta
        </Titulo>
        <AuthForm />
      </ScrollView>
    );
  }

  const guardar = async () => {
    try {
      const r = await api.put("/api/perfil", {
        nombre: f.nombre ?? usuario.nombre,
        telefono: f.telefono ?? usuario.telefono,
        zona: f.zona ?? usuario.zona,
        yape: f.yape ?? usuario.yape,
        plin: f.plin ?? usuario.plin,
      });
      await recargar();
      const n = r?.publicaciones_actualizadas || 0;
      toast(n ? `Datos guardados. Actualizamos ${n} publicación(es) activa(s).` : "Datos guardados");
      setEditando(false);
      setF({});
    } catch (err) {
      toast(err.message, "err");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
      <Titulo>Mi perfil</Titulo>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar nombre={usuario.nombre} size={58} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala }}>{usuario.nombre}</Text>
          <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: 2 }}>
            {usuario.telefono} · {usuario.zona}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {usuario.rol !== "vecino" ? (
              <Badge tono="verde">{usuario.rol === "admin" ? "Administrador" : "Moderador"}</Badge>
            ) : null}
            {usuario.telefono_verificado ? <Badge tono="verde">Verificado</Badge> : null}
          </View>
        </View>
        <Btn size="small" icon="user" onPress={() => { setEditando(true); setF({}); }}>
          Editar
        </Btn>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: S[4] }}>
        <Kpi icono="store" valor={usuario.publicaciones ?? 0} texto="Publicaciones" />
        <Kpi icono="thumb" valor={usuario.vistos_recibidos ?? 0} texto="Vistos buenos" />
        <Kpi icono="handshake" valor={usuario.tratos_cerrados ?? 0} texto="Tratos cerrados" />
      </View>

      {!(usuario.publicaciones || usuario.vistos_recibidos || usuario.tratos_cerrados) ? (
        <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: 10 }}>
          Aún sin actividad. Publica tu primer servicio o favor y aparecerá aquí.
        </Text>
      ) : null}

      {editando ? (
        <View style={{ marginTop: S[5] }}>
          <Field label="Nombre">
            <Input defaultValue={usuario.nombre} onChangeText={(t) => setF({ ...f, nombre: t })} />
          </Field>
          <Field label="Teléfono">
            <Input
              defaultValue={usuario.telefono || ""}
              keyboardType="number-pad"
              maxLength={9}
              onChangeText={(t) => setF({ ...f, telefono: t.replace(/\D/g, "") })}
            />
          </Field>
          <Field label="Sector">
            <Select
              ariaLabel="Sector"
              value={f.zona ?? usuario.zona}
              onChange={(v) => setF({ ...f, zona: v })}
              options={zonas.map((z) => ({ value: z.nombre, label: z.nombre }))}
            />
          </Field>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Yape">
                <Input defaultValue={usuario.yape || ""} keyboardType="number-pad" maxLength={9} onChangeText={(t) => setF({ ...f, yape: t.replace(/\D/g, "") })} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Plin">
                <Input defaultValue={usuario.plin || ""} keyboardType="number-pad" maxLength={9} onChangeText={(t) => setF({ ...f, plin: t.replace(/\D/g, "") })} />
              </Field>
            </View>
          </View>
          <Text style={{ color: c.muted, fontSize: 12 * escala, lineHeight: 18 * escala, marginBottom: 12 }}>
            Al guardar, tu Yape y Plin se actualizan también en tus publicaciones activas, para que nadie pague a un
            número viejo.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Btn onPress={() => { setEditando(false); setF({}); }}>Cancelar</Btn>
            <Btn variant="primary" icon="check" onPress={guardar}>
              Guardar
            </Btn>
          </View>
        </View>
      ) : (
        <>
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: R.md,
              borderWidth: 1,
              borderColor: c.line,
              padding: 14,
              marginTop: S[5],
              gap: 9,
              ...shadowSoft,
            }}
          >
            <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 15 * escala, marginBottom: 2 }}>Contacto y cobros</Text>
            <Dato etiqueta="Teléfono" valor={usuario.telefono || "—"} />
            <Dato etiqueta="Yape" valor={usuario.yape || "Sin configurar"} onPress={!usuario.yape ? () => { setEditando(true); setF({}); } : undefined} />
            <Dato etiqueta="Plin" valor={usuario.plin || "Sin configurar"} onPress={!usuario.plin ? () => { setEditando(true); setF({}); } : undefined} />
            <Text style={{ color: c.muted, fontSize: 12 * escala, marginTop: 2 }}>Solo los vecinos con sesión ven estos datos.</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: S[4] }}>
            <Accion icono="clipboard" titulo="Mi actividad" texto="Publicaciones y tratos" onPress={() => router.push("/actividad")} />
            <Accion icono="lock" titulo="Cambiar PIN" texto="Seguridad de la cuenta" onPress={() => setPinOpen(true)} />
          </View>

          <Btn
            variant="danger"
            icon="logout"
            style={{ marginTop: S[5] }}
            onPress={() =>
              Alert.alert("Cerrar sesión", "¿Quieres salir de tu cuenta?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Salir",
                  style: "destructive",
                  onPress: async () => {
                    await salir();
                    toast("Sesión cerrada");
                    router.replace("/");
                  },
                },
              ])
            }
          >
            Salir de mi cuenta
          </Btn>
        </>
      )}

      <Sheet open={pinOpen} onClose={() => { setPinOpen(false); setPinError(""); setPin({ actual: "", nuevo: "" }); }} titulo="Cambiar mi PIN">
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 19 * escala, marginBottom: 6 }}>Cambiar mi PIN</Text>
        <Text style={{ color: c.muted, fontSize: 13 * escala, lineHeight: 19 * escala, marginBottom: 12 }}>
          Por seguridad pedimos tu PIN actual. Si lo olvidaste, sal y usa «Olvidé mi PIN» con un código al teléfono.
        </Text>
        <Field label="PIN actual">
          <Input
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            value={pin.actual}
            onChangeText={(t) => setPin({ ...pin, actual: t.replace(/\D/g, "") })}
            style={{ letterSpacing: 6 }}
          />
        </Field>
        <Field label="PIN nuevo (6 dígitos)">
          <Input
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            value={pin.nuevo}
            onChangeText={(t) => setPin({ ...pin, nuevo: t.replace(/\D/g, "") })}
            style={{ letterSpacing: 6 }}
          />
        </Field>
        {pinError ? <Text style={{ color: c.danger, fontSize: 13 * escala, marginBottom: 8 }}>{pinError}</Text> : null}
        <Btn
          variant="primary"
          icon="check"
          disabled={pin.actual.length !== 6 || pin.nuevo.length !== 6}
          onPress={async () => {
            setPinError("");
            try {
              await api.post("/api/perfil/pin", { pin_actual: pin.actual, pin_nuevo: pin.nuevo });
              toast("PIN actualizado");
              setPinOpen(false);
              setPin({ actual: "", nuevo: "" });
            } catch (e) {
              setPinError(e.message);
            }
          }}
        >
          Guardar PIN
        </Btn>
      </Sheet>
    </ScrollView>
  );
}

function Kpi({ icono, valor, texto }) {
  const { c, escala } = useTema();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: R.md,
        paddingVertical: 12,
        alignItems: "center",
        gap: 3,
      }}
    >
      <Icon name={icono} size={19} color={c.brand700} />
      <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala }}>{valor}</Text>
      <Text style={{ color: c.muted, fontSize: 10.5 * escala, textAlign: "center" }}>{texto}</Text>
    </View>
  );
}

function Dato({ etiqueta, valor, onPress }) {
  const { c, escala } = useTema();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <Text style={{ color: c.muted, fontSize: 13 * escala }}>{etiqueta}</Text>
      {onPress ? (
        <LinkBtn onPress={onPress}>{valor} · Agregar</LinkBtn>
      ) : (
        <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 13.5 * escala }}>{valor}</Text>
      )}
    </View>
  );
}

function Accion({ icono, titulo, texto, onPress }) {
  const { c, escala } = useTema();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: R.md,
        padding: 14,
        gap: 4,
      }}
    >
      <Icon name={icono} size={21} color={c.brand700} />
      <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 13.5 * escala }}>{titulo}</Text>
      <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>{texto}</Text>
    </Pressable>
  );
}
