import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/auth";
import { useTema } from "../context/ajustes";
import { Icon } from "../lib/icons";
import { BarraVolver } from "../components/Header";
import { Badge, Btn, Empty, Field, Input, Segmented, Skeleton, useToast } from "../components/ui";
import { hace } from "../lib/format";
import { F, R, S } from "../lib/theme";

export default function Moderacion() {
  const { c, escala } = useTema();
  const { esModerador, esAdmin } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [nota, setNota] = useState("");
  const [tel, setTel] = useState("");
  const [rol, setRol] = useState("moderador");

  const { data: metricas } = useQuery({
    queryKey: ["metricas"],
    queryFn: () => api.get("/api/moderacion/metricas"),
    enabled: esModerador,
    refetchInterval: 30000,
  });
  const { data: reportes, isLoading } = useQuery({
    queryKey: ["reportes"],
    queryFn: () => api.get("/api/moderacion/reportes"),
    enabled: esModerador,
  });
  const { data: colusion } = useQuery({
    queryKey: ["colusion"],
    queryFn: () => api.get("/api/admin/colusion"),
    enabled: esModerador,
  });
  const { data: equipo } = useQuery({
    queryKey: ["equipo"],
    queryFn: () => api.get("/api/admin/equipo"),
    enabled: esAdmin,
  });

  if (!esModerador) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BarraVolver titulo="Moderación" />
        <View style={{ padding: 16 }}>
          <Empty icon="shield" titulo="Sección para moderadores" texto="Tu cuenta no tiene ese rol." />
        </View>
      </View>
    );
  }

  const decidir = async (r, accion) => {
    try {
      await api.post("/api/moderacion/reportes", { reporte_id: r.id, accion, nota });
      toast(`Reporte ${accion === "ninguna" ? "archivado" : "resuelto"}`);
      setNota("");
      qc.invalidateQueries({ queryKey: ["reportes"] });
      qc.invalidateQueries({ queryKey: ["metricas"] });
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const m = metricas || {};
  const listaReportes = Array.isArray(reportes) ? reportes : reportes?.items || [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BarraVolver titulo="Moderación" />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 24 * escala }}>Moderación</Text>
        <Text style={{ color: c.muted, fontSize: 13 * escala, marginBottom: 12, lineHeight: 19 * escala }}>
          Reportes pendientes e indicadores del barrio.
        </Text>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Kpi valor={m.ofertas_activas ?? "—"} texto="ofertas activas" />
          <Kpi valor={m.usuarios ?? "—"} texto="vecinos" />
          <Kpi valor={m.reportes_pendientes ?? "—"} texto="reportes" />
          <Kpi valor={m.vistos_buenos ?? "—"} texto="vistos buenos" />
        </View>

        <Seccion>Reportes pendientes</Seccion>
        {isLoading ? <Skeleton height={140} /> : null}
        {!isLoading && !listaReportes.length ? (
          <Empty icon="check" titulo="Nada pendiente" texto="El barrio está tranquilo." />
        ) : null}

        {listaReportes.map((r) => (
          <View
            key={r.id}
            style={{
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: R.md,
              padding: 12,
              gap: 6,
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14.5 * escala, flex: 1 }}>{r.titulo}</Text>
              <Badge tono="rojo">{r.motivo}</Badge>
            </View>
            <Text style={{ color: c.muted, fontSize: 11.5 * escala }}>
              Reportado por {r.reportante || r.denunciante || "un vecino"} · {hace(r.creado)}
            </Text>
            <Text style={{ color: c.text, fontSize: 12.5 * escala }}>«{(r.descripcion || "").slice(0, 160)}»</Text>
            <Input
              placeholder="Nota de moderación (queda registrada)"
              value={nota}
              onChangeText={setNota}
              maxLength={200}
              style={{ minHeight: 44 }}
            />
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Btn size="small" onPress={() => decidir(r, "ninguna")}>Sin problema</Btn>
              <Btn size="small" onPress={() => decidir(r, "ocultar")}>Ocultar</Btn>
              <Btn size="small" variant="danger" onPress={() => decidir(r, "eliminar")}>Eliminar</Btn>
            </View>
          </View>
        ))}

        <Seccion>Indicadores</Seccion>
        <View
          style={{
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: R.md,
            padding: 12,
            gap: 8,
          }}
        >
          <Dato etiqueta="Contactos iniciados" valor={m.contactos_iniciados ?? 0} />
          <Dato etiqueta="Cotizaciones" valor={m.cotizaciones ?? 0} />
          <Dato etiqueta="Cotizaciones respondidas" valor={m.cotizaciones_respondidas ?? 0} />
          <Dato etiqueta="Tratos" valor={m.tratos ?? 0} />
          <Dato etiqueta="Tratos cerrados" valor={m.tratos_cerrados ?? 0} />
          <Dato etiqueta="Intercambios resueltos" valor={m.intercambios_resueltos ?? 0} />
        </View>

        <Seccion>Señales de círculos cerrados</Seccion>
        <Text style={{ color: c.muted, fontSize: 12.5 * escala, lineHeight: 18 * escala, marginBottom: 8 }}>
          {colusion?.nota || "Señales para revisar: pares que repiten tratos y vistos concentrados."}
        </Text>
        {!(colusion?.items || []).length ? (
          <Empty icon="check" titulo="Sin señales por ahora" texto="Nadie concentra tratos ni recomendaciones de forma rara." />
        ) : null}
        {(colusion?.items || []).map((x, k) => (
          <View
            key={k}
            style={{
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: R.md,
              padding: 12,
              gap: 5,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 13.5 * escala, flex: 1 }}>
                {x.a} ↔ {x.b}
              </Text>
              <Badge tono="rojo">{x.veces} veces</Badge>
            </View>
            <Text style={{ color: c.muted, fontSize: 12 * escala }}>
              {x.tipo === "tratos_repetidos"
                ? "Cerraron varios tratos solo entre ellos."
                : "Una persona concentra sus vistos buenos en la misma cuenta."}
            </Text>
          </View>
        ))}

        {esAdmin ? (
          <>
            <Seccion>Equipo (solo administrador)</Seccion>
            <View
              style={{
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: R.md,
                padding: 12,
                gap: 8,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 12 * escala, lineHeight: 18 * escala }}>
                Reparte roles por teléfono. Cada cambio queda en el registro.
              </Text>
              <Field label="Teléfono">
                <Input
                  keyboardType="number-pad"
                  maxLength={9}
                  value={tel}
                  onChangeText={(t) => setTel(t.replace(/\D/g, ""))}
                  placeholder="999000006"
                />
              </Field>
              <Field label="Rol">
                <Segmented
                  value={rol}
                  onChange={setRol}
                  options={[
                    { value: "moderador", label: "Moderador" },
                    { value: "admin", label: "Admin" },
                    { value: "vecino", label: "Quitar" },
                  ]}
                />
              </Field>
              <Btn
                size="small"
                variant="primary"
                icon="shield"
                disabled={tel.length !== 9}
                onPress={async () => {
                  try {
                    await api.post("/api/admin/rol", { telefono: tel, rol });
                    toast("Rol actualizado");
                    setTel("");
                    qc.invalidateQueries({ queryKey: ["equipo"] });
                  } catch (e) {
                    toast(e.message, "err");
                  }
                }}
              >
                Guardar rol
              </Btn>
            </View>
            {(equipo?.items || []).map((u) => (
              <View
                key={u.id}
                style={{
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: R.md,
                  padding: 12,
                  gap: 4,
                  marginTop: 8,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 14 * escala, flex: 1 }}>{u.nombre}</Text>
                  <Badge tono={u.rol === "admin" ? "verde" : "gris"}>{u.rol}</Badge>
                </View>
                <Text style={{ color: c.muted, fontSize: 12 * escala }}>
                  {u.telefono} · {u.zona}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: S[5] }}>
          <Icon name="shield" size={14} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 11.5 * escala, flex: 1 }}>
            Las acciones de moderación quedan registradas con tu nombre.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Seccion({ children }) {
  const { c, escala } = useTema();
  return (
    <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala, marginTop: S[5], marginBottom: S[3] }}>
      {children}
    </Text>
  );
}

function Kpi({ valor, texto }) {
  const { c, escala } = useTema();
  return (
    <View
      style={{
        width: "47%",
        flexGrow: 1,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: R.md,
        paddingVertical: 10,
        alignItems: "center",
      }}
    >
      <Text style={{ color: c.ink, fontFamily: F.bold, fontSize: 18 * escala }}>{valor}</Text>
      <Text style={{ color: c.muted, fontSize: 10.5 * escala, textAlign: "center" }}>{texto}</Text>
    </View>
  );
}

function Dato({ etiqueta, valor }) {
  const { c, escala } = useTema();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <Text style={{ color: c.muted, fontSize: 13 * escala }}>{etiqueta}</Text>
      <Text style={{ color: c.ink, fontFamily: F.medium, fontSize: 13.5 * escala }}>{valor}</Text>
    </View>
  );
}
