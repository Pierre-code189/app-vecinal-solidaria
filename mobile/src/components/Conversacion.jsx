import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useTema } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { Btn, useToast } from "./ui";
import { hace } from "../lib/format";
import { F, R, S } from "../lib/theme";

/* Conversación de una cotización o de un trato. Libre, sin plantillas. */
export default function Conversacion({ contexto, refId, onNuevoMensaje, cabecera }) {
  const { c, escala } = useTema();
  const { usuario } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const scroll = useRef(null);

  const cargar = async () => {
    try {
      const d = await api.get(`/api/mensajes?contexto=${contexto}&ref=${refId}`);
      setItems(d.items || []);
    } catch {
      /* silencio */
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!refId) return;
    cargar();
    const t = setInterval(cargar, 7000);
    return () => clearInterval(t);
  }, [contexto, refId]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      await api.post("/api/mensajes", { contexto, ref_id: refId, texto: t });
      setTexto("");
      await cargar();
      onNuevoMensaje?.();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 12, gap: 8 }}
      >
        {cabecera}
        {cargando ? <Text style={{ color: c.muted, fontSize: 13 * escala }}>Cargando conversación…</Text> : null}
        {!cargando && items.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 13 * escala, lineHeight: 19 * escala }}>
            Aún no hay mensajes. Escribe el primero: coordina precio, hora o lugar.
          </Text>
        ) : null}
        {items.map((m) => {
          const mio = m.de_id === usuario?.id;
          return (
            <View
              key={m.id}
              style={{
                alignSelf: mio ? "flex-end" : "flex-start",
                maxWidth: "82%",
                backgroundColor: mio ? c.brand600 : c.surface,
                borderWidth: mio ? 0 : 1,
                borderColor: c.line,
                borderRadius: 14,
                borderBottomRightRadius: mio ? 4 : 14,
                borderBottomLeftRadius: mio ? 14 : 4,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              {!mio ? (
                <Text style={{ color: c.brand700, fontSize: 11 * escala, fontFamily: F.medium, marginBottom: 2 }}>
                  {m.de_nombre}
                </Text>
              ) : null}
              <Text style={{ color: mio ? "#fff" : c.ink, fontSize: 14 * escala, lineHeight: 20 * escala }}>{m.texto}</Text>
              <Text style={{ color: mio ? "rgba(255,255,255,.75)" : c.muted, fontSize: 10.5 * escala, marginTop: 4, alignSelf: "flex-end" }}>
                {hace(m.creado)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: 8,
          padding: 10,
          borderTopWidth: 1,
          borderTopColor: c.line,
          backgroundColor: c.surface,
        }}
      >
        <TextInput
          value={texto}
          onChangeText={setTexto}
          maxLength={600}
          placeholder="Escribe un mensaje…"
          placeholderTextColor={c.muted2}
          accessibilityLabel="Mensaje"
          multiline
          style={{
            flex: 1,
            maxHeight: 100,
            minHeight: 44,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: R.sm,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: c.ink,
            fontSize: 14.5 * escala,
            backgroundColor: c.surface2,
          }}
        />
        <Btn variant="primary" icon="chat" disabled={enviando || !texto.trim()} onPress={enviar} style={{ alignSelf: "flex-end" }}>
          {enviando ? "…" : "Enviar"}
        </Btn>
      </View>
    </View>
  );
}
