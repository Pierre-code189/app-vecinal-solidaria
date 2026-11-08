import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useTema } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { BarraVolver } from "../components/Header";
import { Btn, Field, Input, LinkBtn, useToast } from "../components/ui";
import CodigoSeis from "../components/CodigoSeis";
import { F, R } from "../lib/theme";

/* Recuperar acceso: teléfono → código de 6 dígitos → PIN nuevo. */
export default function Recuperar() {
  const { c, escala } = useTema();
  const toast = useToast();
  const router = useRouter();
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const volver = () => (router.canGoBack() ? router.back() : router.replace(usuario ? "/perfil" : "/"));

  const [paso, setPaso] = useState(1);
  const [tel, setTel] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [codigoDemo, setCodigoDemo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const [rellenando, setRellenando] = useState(false);
  const timer = useRef(null);
  const auto = useRef(null);

  useEffect(
    () => () => {
      clearInterval(timer.current);
      clearTimeout(auto.current);
    },
    [],
  );

  const contar = () => {
    setEspera(45);
    clearInterval(timer.current);
    timer.current = setInterval(
      () =>
        setEspera((s) => {
          if (s <= 1) {
            clearInterval(timer.current);
            return 0;
          }
          return s - 1;
        }),
      1000,
    );
  };

  const solicitar = async () => {
    setError("");
    if (!/^\d{9}$/.test(tel)) return setError("Escribe tu teléfono de 9 dígitos.");
    setEnviando(true);
    try {
      const r = await api.post("/api/telefono/solicitar", { telefono: tel, proposito: "pin" }, { queue: false });
      setCodigoDemo(r.codigo_demo || "");
      setPaso(2);
      contar();
      if (r.codigo_demo) {
        setRellenando(true);
        auto.current = setTimeout(() => {
          setCodigo(r.codigo_demo);
          setRellenando(false);
        }, 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    setError("");
    if (!/^\d{6}$/.test(codigo)) return setError("El código son 6 dígitos.");
    if (!/^\d{6}$/.test(pin)) return setError("El PIN nuevo debe tener 6 dígitos.");
    try {
      await api.post("/api/pin/confirmar", { telefono: tel, codigo, pin }, { queue: false });
      toast("PIN actualizado. Entra con el nuevo.");
      if (usuario) router.replace("/perfil");
      else router.replace("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo="Recuperar acceso" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
        >
          <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 24 * escala, letterSpacing: -0.5 }}>
            Recuperar acceso
          </Text>
          <Text style={{ color: c.muted, fontSize: 13 * escala, marginTop: 4, marginBottom: 16, lineHeight: 19 * escala }}>
            Te enviamos un código al teléfono registrado.
          </Text>

          {paso === 1 ? (
            <View
              style={{
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: R.md,
                padding: 14,
              }}
            >
              <Field label="Tu teléfono" hint="El mismo con el que te registraste.">
                <Input
                  keyboardType="number-pad"
                  maxLength={9}
                  value={tel}
                  onChangeText={(t) => setTel(t.replace(/\D/g, ""))}
                  autoFocus
                  placeholder="987654321"
                />
              </Field>
              {error ? <Text style={{ color: c.danger, fontSize: 13 * escala, marginBottom: 10 }}>{error}</Text> : null}
              <Btn variant="primary" disabled={enviando} onPress={solicitar}>
                {enviando ? "Enviando…" : "Enviarme el código"}
              </Btn>
              <Text style={{ color: c.muted, fontSize: 12 * escala, marginTop: 10, lineHeight: 18 * escala }}>
                Por ahora no hay SMS real: en la demo el código aparece en pantalla.
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: R.md,
                padding: 14,
              }}
            >
              {codigoDemo ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: c.info50,
                    borderWidth: 1,
                    borderColor: c.infoLine,
                    borderRadius: R.sm,
                    padding: 10,
                    marginBottom: 12,
                  }}
                >
                  <Icon name="chat" size={15} color={c.info} />
                  <Text style={{ color: c.info, fontSize: 12.5 * escala, flex: 1 }}>
                    Código de demostración: <Text style={{ fontFamily: F.bold }}>{codigoDemo}</Text>
                  </Text>
                </View>
              ) : null}

              <Field label="Código de 6 dígitos">
                <CodigoSeis valor={codigo} onChange={setCodigo} autoFocus />
              </Field>
              {rellenando ? (
                <Text style={{ color: c.info, fontSize: 12.5 * escala, textAlign: "center", marginBottom: 10 }}>
                  Esperando el mensaje…
                </Text>
              ) : null}

              <Field label="PIN nuevo (6 dígitos)">
                <Input
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={6}
                  value={pin}
                  onChangeText={(t) => setPin(t.replace(/\D/g, ""))}
                  style={{ letterSpacing: 6 }}
                />
              </Field>

              {error ? <Text style={{ color: c.danger, fontSize: 13 * escala, marginBottom: 10 }}>{error}</Text> : null}

              <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                <Btn onPress={() => setPaso(1)}>Atrás</Btn>
                <Btn variant="primary" icon="check" onPress={confirmar}>
                  Cambiar mi PIN
                </Btn>
              </View>

              <View style={{ alignItems: "center", marginTop: 12 }}>
                {espera > 0 ? (
                  <Text style={{ color: c.muted, fontSize: 12.5 * escala }}>Puedes pedir otro código en {espera} s.</Text>
                ) : (
                  <LinkBtn onPress={solicitar}>Pedir otro código</LinkBtn>
                )}
              </View>
            </View>
          )}

          <View style={{ alignItems: "center", marginTop: 16 }}>
            <LinkBtn onPress={volver}>{usuario ? "Volver a mi perfil" : "Volver a entrar"}</LinkBtn>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
