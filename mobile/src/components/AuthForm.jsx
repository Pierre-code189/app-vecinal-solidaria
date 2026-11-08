import React, { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/auth";
import { useZona } from "../context/zona";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { Btn, Check, Field, Input, LinkBtn, Segmented, Select, useToast } from "./ui";
import CodigoSeis from "./CodigoSeis";
import { useTema } from "../context/ajustes";
import { F } from "../lib/theme";

export default function AuthForm({ onListo, inicial = "entrar" }) {
  const { c, escala } = useTema();
  const { entrarPin, registrarPin } = useAuth();
  const { zonas, setZona, usarGPS, gps } = useZona();
  const router = useRouter();
  const toast = useToast();

  const [modo, setModo] = useState(inicial);
  const [f, setF] = useState({ zona: "Piura Centro" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [verPin, setVerPin] = useState(false);
  const [codigoDemo, setCodigoDemo] = useState("");
  const [pasoReg, setPasoReg] = useState("datos");
  const [rellenando, setRellenando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const [otroSector, setOtroSector] = useState(false);
  const timer = useRef(null);
  const auto = useRef(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

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
    timer.current = setInterval(() => {
      setEspera((s) => {
        if (s <= 1) {
          clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const pedirCodigo = async () => {
    setError("");
    setCodigoDemo("");
    if (!/^\d{9}$/.test(f.telefono || "")) {
      setError("Escribe tu teléfono de 9 dígitos.");
      return false;
    }
    setEnviando(true);
    try {
      const r = await api.post("/api/telefono/solicitar", { telefono: f.telefono, proposito: "registro" }, { queue: false });
      setCodigoDemo(r.codigo_demo || "");
      contar();
      if (r.codigo_demo) {
        setRellenando(true);
        auto.current = setTimeout(() => {
          set("codigo", r.codigo_demo);
          setRellenando(false);
          toast("Código recibido");
        }, 3000);
      }
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setEnviando(false);
    }
  };

  const continuarRegistro = async () => {
    setError("");
    if ((f.nombre || "").trim().length < 3) return setError("Escribe tu nombre y apellido.");
    if (!/^\d{9}$/.test(f.telefono || "")) return setError("El teléfono debe tener 9 dígitos.");
    if (!/^\d{6}$/.test(f.pin || "")) return setError("El PIN debe tener 6 dígitos.");
    if (!f.acepta) return setError("Necesitamos que aceptes el aviso de privacidad.");
    const ok = await pedirCodigo();
    if (ok) setPasoReg("codigo");
  };

  const crearCuenta = async () => {
    setError("");
    if (!/^\d{6}$/.test(f.codigo || "")) return setError("Escribe el código de 6 dígitos.");
    setCargando(true);
    try {
      const u = await registrarPin({
        nombre: f.nombre.trim(),
        telefono: f.telefono,
        codigo: f.codigo,
        pin: f.pin,
        zona: f.zona || "Piura Centro",
        yape: f.yape || "",
        plin: f.plin || "",
        acepta_privacidad: true,
        lat: gps?.lat ?? null,
        lng: gps?.lng ?? null,
      });
      if (u?.zona) await setZona(u.zona, false);
      toast("Cuenta creada. Ya estás dentro.");
      onListo?.();
    } catch (err) {
      setError(err.message || "No pudimos crear la cuenta.");
    } finally {
      setCargando(false);
    }
  };

  const entrar = async () => {
    setError("");
    if (!/^\d{9}$/.test(f.telefono || "")) return setError("Escribe tu teléfono de 9 dígitos.");
    if (!/^\d{6}$/.test(f.pin || "")) return setError("El PIN son 6 dígitos.");
    setCargando(true);
    try {
      const u = await entrarPin(f.telefono, f.pin);
      if (u?.zona) await setZona(u.zona, false);
      toast(`Hola, ${u?.nombre?.split(" ")[0] || "vecino"}`);
      onListo?.();
    } catch (err) {
      setError(err.message || "No pudimos entrar. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  if (modo === "registro" && pasoReg === "codigo") {
    return (
      <View>
        <Btn icon="back" onPress={() => { setPasoReg("datos"); setError(""); }} style={{ alignSelf: "flex-start" }}>
          Volver a mis datos
        </Btn>
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 22 * escala, marginTop: 16 }}>
          Confirma tu número
        </Text>
        <Text style={{ color: c.muted, fontSize: 13.5 * escala, marginTop: 5, marginBottom: 16 }}>
          Enviamos un código de 6 dígitos al{" "}
          <Text style={{ fontFamily: F.medium }}>{f.telefono?.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}</Text>.
        </Text>

        <CodigoSeis valor={f.codigo || ""} onChange={(v) => set("codigo", v)} autoFocus />

        <Text style={{ color: rellenando ? c.info : c.muted, fontSize: 12.5 * escala, textAlign: "center", marginTop: 12 }}>
          {rellenando
            ? "Esperando el mensaje…"
            : codigoDemo
              ? "En la demo el código se rellena solo a los 3 segundos."
              : "Escríbelo tal como llegó."}
        </Text>

        {codigoDemo ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 10 }}>
            <Icon name="chat" size={15} color={c.info} />
            <Text style={{ color: c.info, fontSize: 13 * escala }}>
              Código de demostración: <Text style={{ fontFamily: F.bold }}>{codigoDemo}</Text>
            </Text>
          </View>
        ) : null}

        {error ? <Text style={{ color: c.danger, fontSize: 13.5 * escala, marginTop: 12 }}>{error}</Text> : null}

        <Btn
          variant="primary"
          icon="check"
          style={{ marginTop: 16 }}
          disabled={cargando || (f.codigo || "").length < 6}
          onPress={crearCuenta}
        >
          {cargando ? "Creando…" : "Confirmar y crear cuenta"}
        </Btn>

        <View style={{ alignItems: "center", marginTop: 12 }}>
          {espera > 0 ? (
            <Text style={{ color: c.muted, fontSize: 12.5 * escala }}>Puedes pedir otro código en {espera} s.</Text>
          ) : (
            <LinkBtn onPress={pedirCodigo}>Reenviar código</LinkBtn>
          )}
        </View>
      </View>
    );
  }

  return (
    <View>
      <Segmented
        value={modo}
        onChange={(v) => {
          setModo(v);
          setError("");
          setCodigoDemo("");
          setPasoReg("datos");
        }}
        options={[
          { value: "entrar", label: "Entrar" },
          { value: "registro", label: "Crear cuenta" },
        ]}
      />

      <View style={{ marginTop: 16 }}>
        {modo === "registro" ? (
          <>
            <Field label="Nombre y apellido">
              <Input value={f.nombre || ""} onChangeText={(t) => set("nombre", t)} autoComplete="name" />
            </Field>
            <Field label="Sector donde vives">
              <Select
                ariaLabel="Sector"
                value={f.zona}
                onChange={(v) => {
                  if (v === "OTRO") {
                    setOtroSector(true);
                    set("zona", "");
                  } else {
                    setOtroSector(false);
                    set("zona", v);
                  }
                }}
                options={[
                  ...(zonas.length ? zonas : [{ nombre: "Piura Centro" }]).map((z) => ({ value: z.nombre, label: z.nombre })),
                  { value: "OTRO", label: "Mi sector no está en la lista" },
                ]}
              />
            </Field>
            {otroSector ? (
              <View style={{ marginBottom: 12 }}>
                <Field label="Escribe tu sector" hint="Guardamos el nombre del sector, no tu dirección exacta.">
                  <Input
                    maxLength={60}
                    value={f.zona || ""}
                    onChangeText={(t) => set("zona", t)}
                    placeholder="Ej.: Urb. San Ramón, Piura"
                  />
                </Field>
                <Btn
                  size="small"
                  icon="pin"
                  onPress={async () => {
                    try {
                      const z = await usarGPS();
                      if (z) set("zona", z);
                    } catch (e) {
                      toast(e.message, "warn");
                    }
                  }}
                  style={{ alignSelf: "flex-start" }}
                >
                  Usar mi ubicación
                </Btn>
              </View>
            ) : null}
          </>
        ) : null}

        <Field
          label="Teléfono (9 dígitos)"
          hint={modo === "registro" ? "Te enviaremos un código para confirmar que es tuyo." : "El número con el que te registraste."}
        >
          <Input
            keyboardType="number-pad"
            maxLength={9}
            placeholder="Ej.: 987654321"
            value={f.telefono || ""}
            onChangeText={(t) => set("telefono", t.replace(/\D/g, ""))}
          />
        </Field>

        <Field label="PIN de 6 dígitos" hint={modo === "registro" ? "Con esto entras la próxima vez. No lo compartas." : undefined}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Input
              secureTextEntry={!verPin}
              keyboardType="number-pad"
              maxLength={6}
              value={f.pin || ""}
              onChangeText={(t) => set("pin", t.replace(/\D/g, ""))}
              style={{ flex: 1, paddingRight: 48, letterSpacing: 6 }}
            />
            <Btn
              size="small"
              onPress={() => setVerPin(!verPin)}
              style={{ position: "absolute", right: 4, borderWidth: 0, backgroundColor: "transparent" }}
              accessibilityLabel={verPin ? "Ocultar PIN" : "Mostrar PIN"}
            >
              <Icon name={verPin ? "eyeoff" : "eye"} size={19} color={c.muted} />
            </Btn>
          </View>
        </Field>

        {modo === "registro" ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Yape (opcional)">
                  <Input keyboardType="number-pad" maxLength={9} value={f.yape || ""} onChangeText={(t) => set("yape", t.replace(/\D/g, ""))} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Plin (opcional)">
                  <Input keyboardType="number-pad" maxLength={9} value={f.plin || ""} onChangeText={(t) => set("plin", t.replace(/\D/g, ""))} />
                </Field>
              </View>
            </View>
            <Check checked={Boolean(f.acepta)} onChange={(v) => set("acepta", v)}>
              Acepto el aviso de privacidad (Ley 29733): mis datos se usan solo para coordinar el servicio y puedo pedir que los borren.
            </Check>
          </>
        ) : null}

        {error ? <Text style={{ color: c.danger, fontSize: 13.5 * escala, marginTop: 10 }}>{error}</Text> : null}

        <Btn
          variant="primary"
          style={{ marginTop: 16 }}
          disabled={cargando || enviando}
          onPress={modo === "entrar" ? entrar : continuarRegistro}
        >
          {cargando || enviando ? "Un momento…" : modo === "entrar" ? "Entrar al barrio" : "Continuar"}
        </Btn>

        {modo === "entrar" ? (
          <View style={{ alignItems: "center", marginTop: 14 }}>
            <LinkBtn onPress={() => router.push("/recuperar")}>Olvidé mi PIN</LinkBtn>
          </View>
        ) : null}
      </View>
    </View>
  );
}
