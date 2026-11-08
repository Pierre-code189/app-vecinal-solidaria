import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { api, abs } from "../lib/api";
import { useAuth } from "../context/auth";
import { useZona } from "../context/zona";
import { useTema } from "../context/ajustes";
import { Icon, CAT_ICON } from "../lib/icons";
import { BarraVolver } from "../components/Header";
import { Badge, Btn, Check, Field, Input, Segmented, Select, useToast } from "../components/ui";
import { elegirFoto, subirFoto } from "../lib/foto";
import { F, R, S } from "../lib/theme";

const CATS = ["gasfitería", "carpintería", "electricidad", "cerrajería", "clases", "alimentos",
  "paseo de mascotas", "herramientas", "movilidad", "préstamo", "otros"];

const SUBTIPOS = [
  { value: "prestamo", label: "Préstamo de cosas" },
  { value: "ayuda_temporal", label: "Ayuda temporal" },
  { value: "donacion", label: "Donación de materiales" },
  { value: "intercambio_habilidades", label: "Intercambio de habilidades" },
  { value: "movilidad", label: "Movilidad solidaria" },
];

const NECESIDADES = [
  ["agua_potable", "Agua potable"], ["alimentos", "Alimentos"], ["balde_bidon", "Bidones o baldes"],
  ["techo", "Techo o carpa"], ["abrigo", "Abrigo"], ["higiene", "Higiene"],
  ["salud", "Salud o medicinas"], ["herramientas", "Herramientas"], ["movilidad", "Movilidad"],
  ["alojamiento", "Alojamiento"], ["energia", "Energía o luz"], ["otro", "Otro"],
];

const PAGOS = [
  { value: "yape,efectivo", label: "Yape y efectivo" },
  { value: "yape", label: "Solo Yape" },
  { value: "plin,efectivo", label: "Plin y efectivo" },
  { value: "efectivo", label: "Solo efectivo" },
  { value: "transferencia,efectivo", label: "Transferencia y efectivo" },
  { value: "intercambio", label: "Intercambio (sin dinero)" },
];

const POLITICAS = [
  { value: "contra_entrega", label: "Contra entrega o al terminar" },
  { value: "mitad_mitad", label: "Mitad al empezar, mitad al terminar" },
  { value: "al_terminar", label: "Todo al terminar" },
];

export default function Publicar() {
  const { modo = "servicio" } = useLocalSearchParams();
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const { zona, zonas, usarGPS } = useZona();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  const scroll = useRef(null);
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState({});
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [otroSector, setOtroSector] = useState(false);

  const esEmergencia = modo === "emergencia";
  const esFavor = modo === "favor" || esEmergencia;

  useEffect(() => {
    setPaso(1);
    setError("");
    setF({
      wa: true,
      tel: (usuario?.telefono || "").slice(0, 9),
      lado: "necesito",
      necesidad: "agua_potable",
      categoria: modo === "favor" ? "herramientas" : "gasfitería",
      tipo: "servicio",
    });
    setFotos([]);
    setSubiendo("");
    setOtroSector(false);
  }, [modo, usuario?.telefono]);

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  const tipo = esEmergencia
    ? f.lado === "ofrezco"
      ? "favor_ofrecido"
      : "favor_solicitado"
    : esFavor
      ? f.lado === "ofrezco"
        ? "favor_ofrecido"
        : "favor_solicitado"
      : f.tipo || "servicio";
  const esProducto = tipo === "producto";
  const esMovilidad = esFavor && !esEmergencia && (f.subtipo || "prestamo") === "movilidad";
  const zonaActual = f.zona || zona;
  const zonaConocida = zonas.some((z) => z.nombre === zonaActual) || zonaActual === zona;
  const categoria = f.categoria || (esEmergencia ? "otros" : "gasfitería");
  const tituloLargo = esEmergencia ? 90 : 120;

  if (!usuario) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BarraVolver titulo="Publicar" />
        <View style={{ padding: 20, alignItems: "center" }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: c.brand50,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Icon name="user" size={26} color={c.brand700} />
          </View>
          <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 19 * escala, textAlign: "center" }}>
            Necesitas una cuenta
          </Text>
          <Text style={{ color: c.muted, fontSize: 13.5 * escala, textAlign: "center", marginTop: 6, marginBottom: 16 }}>
            Publicar es gratis. Tu número solo lo ven vecinos con sesión.
          </Text>
          <Btn variant="primary" onPress={() => router.replace("/auth")}>Entrar para publicar</Btn>
        </View>
      </View>
    );
  }

  const agregarFotos = async () => {
    if (fotos.length >= 3) {
      toast("Máximo 3 fotos", "warn");
      return;
    }
    try {
      const asset = await elegirFoto();
      if (!asset) return;
      setSubiendo("Subiendo foto…");
      const url = await subirFoto(asset.uri);
      setFotos((prev) => [...prev, url]);
      setSubiendo("Foto lista.");
    } catch (e) {
      setSubiendo("");
      toast(e.message || "No pudimos subir la foto.", "err");
    }
  };

  const validar = () => {
    if ((f.titulo || "").trim().length < 4) return "Ponle un título corto: qué ofreces, pides o necesitas.";
    if ((f.descripcion || "").trim().length < 10) return "Cuenta un poco más en la descripción (10 caracteres).";
    if (!esFavor && !f.sinPrecio && !f.precioNum) return "Escribe un precio en soles o marca «A convenir».";
    if (!esFavor && !f.sinPrecio && Number(f.precioNum) > 5000) return "El precio parece muy alto. Revisa el monto.";
    if (esMovilidad) {
      if (!(f.franja || "").trim()) return "Indica la franja horaria.";
      if (!(f.punto || "").trim()) return "Indica un punto de encuentro público.";
      if (!f.checklist) return "Confirma la lista de seguridad.";
    }
    if (esEmergencia && !f.necesidad) return "Elige de qué se trata.";
    if (f.wa && !/^9\d{8}$/.test(String(f.tel || ""))) return "Escribe un celular de 9 dígitos o desmarca WhatsApp.";
    if (!zonaConocida && !f.lat) return "Comparte tu ubicación para ubicar tu sector.";
    return "";
  };

  const publicar = async () => {
    const err = validar();
    if (err) {
      setPaso(2);
      setError(err);
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const precio = esFavor ? "Gratis / intercambio" : f.sinPrecio ? "A convenir" : `S/ ${Number(f.precioNum).toFixed(2)}`;
      await api.post("/api/publicaciones", {
        tipo,
        categoria: esEmergencia ? "otros" : categoria,
        subtipo_favor: esEmergencia
          ? f.lado === "ofrezco"
            ? "donacion"
            : "ayuda_temporal"
          : esFavor
            ? f.subtipo || "prestamo"
            : null,
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim(),
        precio,
        stock: esProducto ? (f.stock === "" || f.stock == null ? null : Number(f.stock)) : null,
        medios_pago: esFavor ? "intercambio" : f.pagos || "yape,efectivo",
        politica_pago: f.politica || "contra_entrega",
        zona: zonaActual,
        lat: f.lat || null,
        lng: f.lng || null,
        punto_encuentro: f.punto || "",
        franja_horaria: f.franja || "",
        checklist_ok: Boolean(f.checklist),
        es_emergencia: Boolean(esEmergencia),
        necesidad: esEmergencia ? f.necesidad : null,
        mostrar_contacto: f.mostrar !== false,
        whatsapp: Boolean(f.wa),
        telefono_whatsapp: f.wa ? f.tel : "",
        fotos,
        client_id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      });
      toast(esEmergencia ? "Publicado en el tablero" : "¡Publicado! Ya lo ven tus vecinos.");
      qc.invalidateQueries({ queryKey: ["lista"] });
      qc.invalidateQueries({ queryKey: ["favores"] });
      qc.invalidateQueries({ queryKey: ["recursos"] });
      qc.invalidateQueries({ queryKey: ["recursos-todos"] });
      qc.invalidateQueries({ queryKey: ["mis-pubs"] });
      router.back();
    } catch (e) {
      setError(e.message);
      toast(e.message, "err");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo={esEmergencia ? "Tablero de emergencia" : esFavor ? "Publicar un favor" : "Publicar en Economía Local"} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {["1. Qué publicas", "2. Datos y publicación"].map((t, i) => (
              <View
                key={t}
                style={{
                  flex: 1,
                  borderRadius: R.pill,
                  paddingVertical: 7,
                  alignItems: "center",
                  backgroundColor: paso === i + 1 ? c.brand600 : c.surface2,
                  borderWidth: 1,
                  borderColor: paso === i + 1 ? c.brand600 : c.line,
                }}
              >
                <Text style={{ color: paso === i + 1 ? "#fff" : c.muted, fontSize: 11.5 * escala, fontFamily: F.medium }}>{t}</Text>
              </View>
            ))}
          </View>

          {paso === 1 ? (
            <View style={{ gap: 10 }}>
              {esFavor ? (
                <Segmented
                  value={f.lado || "necesito"}
                  onChange={(v) => set("lado", v)}
                  options={
                    esEmergencia
                      ? [
                          { value: "necesito", label: "Necesito ayuda" },
                          { value: "ofrezco", label: "Ofrezco un recurso" },
                        ]
                      : [
                          { value: "necesito", label: "Necesito ayuda" },
                          { value: "ofrezco", label: "Ofrezco ayuda" },
                        ]
                  }
                />
              ) : (
                <Segmented
                  value={tipo}
                  onChange={(v) => set("tipo", v)}
                  options={[
                    { value: "servicio", label: "Un servicio" },
                    { value: "producto", label: "Un producto" },
                  ]}
                />
              )}

              {esEmergencia ? (
                <>
                  <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala, marginTop: 6 }}>¿Qué hace falta?</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {NECESIDADES.map(([v, l]) => (
                      <Pildora key={v} activo={(f.necesidad || "agua_potable") === v} onPress={() => set("necesidad", v)}>
                        {l}
                      </Pildora>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala, marginTop: 6 }}>
                    {esFavor ? "¿De qué se trata?" : "Categoría"}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {CATS.map((cat) => (
                      <Pildora
                        key={cat}
                        activo={(f.categoria || (esFavor ? "herramientas" : "gasfitería")) === cat}
                        onPress={() => set("categoria", cat)}
                        icono={CAT_ICON[cat] || "dots"}
                      >
                        {cat}
                      </Pildora>
                    ))}
                  </View>
                  {esFavor ? (
                    <Field label="Tipo de favor" style={{ marginTop: 8 }}>
                      <Select
                        ariaLabel="Tipo de favor"
                        value={f.subtipo || "prestamo"}
                        onChange={(v) => set("subtipo", v)}
                        options={SUBTIPOS}
                      />
                    </Field>
                  ) : null}
                </>
              )}

              <Btn variant="primary" onPress={() => setPaso(2)} style={{ marginTop: 8 }}>
                Siguiente →
              </Btn>
            </View>
          ) : (
            <View>
              <Field label="Título corto" contador={`${(f.titulo || "").length}/${tituloLargo}`}>
                <Input
                  maxLength={tituloLargo}
                  value={f.titulo || ""}
                  onChangeText={(t) => set("titulo", t)}
                  placeholder={
                    esEmergencia
                      ? "Ej.: Necesito agua para 8 personas"
                      : esFavor
                        ? "Ej.: Necesito una muleta por una semana"
                        : "Ej.: Gasfitero para fugas y destapes"
                  }
                />
              </Field>

              <Field label={esEmergencia ? "Dónde" : "Descripción"} contador={`${(f.descripcion || "").length}/600`}>
                <Input
                  multiline
                  rows={4}
                  maxLength={600}
                  value={f.descripcion || ""}
                  onChangeText={(t) => set("descripcion", t)}
                  placeholder={
                    esEmergencia
                      ? "Ej.: parque del sector, frente a la losa deportiva"
                      : esFavor
                        ? "Cuenta qué necesitas y hasta cuándo"
                        : "Qué incluye, en cuánto tiempo, qué necesitas saber"
                  }
                />
              </Field>

              {!esFavor ? (
                <>
                  <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala, marginBottom: 6 }}>Precio</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Text style={{ color: c.muted, fontFamily: F.medium }}>S/</Text>
                    <Input
                      keyboardType="decimal-pad"
                      placeholder="0"
                      value={String(f.precioNum || "")}
                      editable={!f.sinPrecio}
                      onChangeText={(t) => set("precioNum", t.replace(/[^\d.]/g, ""))}
                      style={{ flex: 1, opacity: f.sinPrecio ? 0.5 : 1 }}
                    />
                    <Check checked={Boolean(f.sinPrecio)} onChange={(v) => set("sinPrecio", v)}>
                      A convenir
                    </Check>
                  </View>

                  {esProducto ? (
                    <Field label="Disponibles" hint="Cuántas unidades tienes. Se descuenta al cerrar cada trato.">
                      <Input
                        keyboardType="number-pad"
                        maxLength={4}
                        placeholder="1"
                        value={f.stock == null ? "" : String(f.stock)}
                        onChangeText={(t) => set("stock", t.replace(/\D/g, ""))}
                      />
                    </Field>
                  ) : null}

                  <Field label="Formas de pago">
                    <Select ariaLabel="Formas de pago" value={f.pagos || "yape,efectivo"} onChange={(v) => set("pagos", v)} options={PAGOS} />
                  </Field>
                  <Field label="Acuerdo de pago">
                    <Select ariaLabel="Acuerdo de pago" value={f.politica || "contra_entrega"} onChange={(v) => set("politica", v)} options={POLITICAS} />
                  </Field>
                </>
              ) : null}

              {esFavor || esEmergencia ? (
                <Field label={esEmergencia ? "Cuándo hace falta" : "Cuándo"}>
                  <Input
                    value={f.franja || ""}
                    onChangeText={(t) => set("franja", t)}
                    placeholder="Ej.: hoy hasta las 8 pm · mañana en la mañana"
                  />
                </Field>
              ) : null}

              {esMovilidad ? (
                <>
                  <Field label="Punto de encuentro público">
                    <Input value={f.punto || ""} onChangeText={(t) => set("punto", t)} placeholder="Ej.: parque del sector" />
                  </Field>
                  <Check checked={Boolean(f.checklist)} onChange={(v) => set("checklist", v)}>
                    No publico el nombre del colegio, la dirección exacta ni datos del menor.
                  </Check>
                </>
              ) : null}

              <Field label="Sector" style={{ marginTop: 8 }}>
                <Select
                  ariaLabel="Sector"
                  value={zonaConocida ? zonaActual : "OTRO"}
                  onChange={(v) => {
                    if (v === "OTRO") {
                      setOtroSector(true);
                    } else {
                      setOtroSector(false);
                      set("zona", v);
                      set("lat", null);
                      set("lng", null);
                    }
                  }}
                  options={[
                    ...(zonas.length ? zonas : [{ nombre: zona }]).map((z) => ({ value: z.nombre, label: z.nombre })),
                    { value: "OTRO", label: "Mi sector no está en la lista" },
                  ]}
                />
              </Field>

              {otroSector || !zonaConocida ? (
                <View style={{ marginBottom: 10 }}>
                  <Field label="Escribe tu sector" hint="Guardamos tu zona, no tu dirección exacta.">
                    <Input maxLength={60} value={f.zona || ""} onChangeText={(t) => set("zona", t)} placeholder="Ej.: Urb. San Ramón, Piura" />
                  </Field>
                  <Btn
                    size="small"
                    icon="pin"
                    style={{ alignSelf: "flex-start" }}
                    onPress={async () => {
                      try {
                        const z = await usarGPS();
                        if (z) set("zona", f.zona || z);
                        set("lat", 1);
                      } catch (e) {
                        toast(e.message, "warn");
                      }
                    }}
                  >
                    Usar mi ubicación
                  </Btn>
                </View>
              ) : null}

              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala, marginBottom: 6 }}>
                Fotos (opcional, máximo 3)
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {fotos.map((src, i) => (
                  <View key={src} style={{ width: 82, height: 82 }}>
                    <Image source={{ uri: abs(src) }} style={{ width: 82, height: 82, borderRadius: 10 }} contentFit="cover" />
                    <Pressable
                      onPress={() => setFotos(fotos.filter((_, j) => j !== i))}
                      accessibilityLabel="Quitar foto"
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: c.danger,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: "#fff",
                      }}
                    >
                      <Icon name="close" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {fotos.length < 3 ? (
                  <Pressable
                    onPress={agregarFotos}
                    style={{
                      width: 82,
                      height: 82,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: c.lineStrong,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                    }}
                  >
                    <Icon name="camera" size={20} color={c.muted} />
                    <Text style={{ color: c.muted, fontSize: 10 * escala }}>Agregar</Text>
                  </Pressable>
                ) : null}
              </View>
              {subiendo ? <Text style={{ color: c.muted, fontSize: 12 * escala, marginBottom: 8 }}>{subiendo}</Text> : null}

              <Check checked={f.wa !== false} onChange={(v) => set("wa", v)}>
                Quiero que me escriban por WhatsApp
              </Check>
              {f.wa !== false ? (
                <Field label="Número con WhatsApp" hint="Debe ser un celular de 9 dígitos." style={{ marginTop: 6 }}>
                  <Input
                    keyboardType="number-pad"
                    maxLength={9}
                    value={f.tel || ""}
                    onChangeText={(t) => set("tel", t.replace(/\D/g, "").slice(0, 9))}
                    placeholder="999 000 000"
                  />
                </Field>
              ) : null}

              <Check checked={f.mostrar !== false} onChange={(v) => set("mostrar", v)}>
                Mostrar mi número y Yape a vecinos con sesión
              </Check>

              {error ? <Text style={{ color: c.danger, fontSize: 13.5 * escala, marginVertical: 10 }}>{error}</Text> : null}

              <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                <Btn icon="back" onPress={() => { setPaso(1); setError(""); }}>Atrás</Btn>
                <Btn variant="primary" icon="check" disabled={guardando} onPress={publicar}>
                  {guardando ? "Publicando…" : esEmergencia ? "Publicar en el tablero" : "Publicar"}
                </Btn>
              </View>
            </View>
          )}

          {!zonaConocida && paso === 2 ? (
            <View style={{ marginTop: 10 }}>
              <Badge tono="rojo">Tu sector no está en la lista</Badge>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Pildora({ activo, onPress, children, icono }) {
  const { c, escala } = useTema();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: R.pill,
        borderWidth: 1,
        borderColor: activo ? c.brand600 : c.line,
        backgroundColor: activo ? c.brand600 : c.surface,
        paddingHorizontal: 11,
        paddingVertical: 7,
      }}
    >
      {icono ? <Icon name={icono} size={13} color={activo ? "#fff" : c.muted} /> : null}
      <Text style={{ color: activo ? "#fff" : c.text, fontSize: 12 * escala, fontFamily: F.medium }}>{children}</Text>
    </Pressable>
  );
}
