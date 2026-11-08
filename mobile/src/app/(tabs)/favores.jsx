import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useZona } from "../../context/zona";
import { useLectorVoz, useTema } from "../../context/ajustes";
import { Btn, Chip, Empty, Input, Segmented, Skeleton, Tarjeta, Titulo } from "../../components/ui";
import { F, S } from "../../lib/theme";

export default function Favores() {
  const { c, escala } = useTema();
  const { zona, ref } = useZona();
  const router = useRouter();

  const [filtro, setFiltro] = useState("");
  const [q, setQ] = useState("");
  const [rapidos, setRapidos] = useState({ cerca: false, top: false });

  useLectorVoz("Favores. Pide o ofrece ayuda sin dinero a tus vecinos.");

  const params = new URLSearchParams({ limit: "50", solo_favores: "true" });
  if (filtro) params.set("tipo", filtro);
  if (ref[0]) {
    params.set("lat", ref[0]);
    params.set("lng", ref[1]);
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["favores", filtro, ref[0], ref[1]],
    queryFn: () => api.get(`/api/publicaciones?${params}`),
  });

  const lista = useMemo(() => {
    let l = data?.items || [];
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((p) => `${p.titulo || ""} ${p.descripcion || ""}`.toLowerCase().includes(s));
    if (rapidos.cerca) l = l.filter((p) => p.distancia_km != null && p.distancia_km <= 1);
    if (rapidos.top) l = [...l].sort((a, b) => (b.vistos || 0) - (a.vistos || 0));
    return l;
  }, [data, q, rapidos]);

  const etiqueta =
    filtro === "favor_solicitado"
      ? lista.length === 1
        ? "pedido"
        : "pedidos"
      : filtro === "favor_ofrecido"
        ? lista.length === 1
          ? "ofrecido"
          : "ofrecidos"
        : lista.length === 1
          ? "favor"
          : "favores";

  const Cabecera = (
    <View>
      <Titulo sub="Pide o ofrece ayuda sin dinero a tus vecinos">Favores</Titulo>

      <Segmented
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: "", label: "Todos" },
          { value: "favor_solicitado", label: "Necesito" },
          { value: "favor_ofrecido", label: "Ofrezco" },
        ]}
      />

      <View style={{ marginTop: S[3] }}>
        <Input value={q} onChangeText={setQ} placeholder="Buscar un favor…" accessibilityLabel="Buscar favores" returnKeyType="search" />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Chip icono="pin" activo={rapidos.cerca} onPress={() => setRapidos({ ...rapidos, cerca: !rapidos.cerca })}>
          Cerca (≤ 1 km)
        </Chip>
        <Chip icono="thumb" activo={rapidos.top} onPress={() => setRapidos({ ...rapidos, top: !rapidos.top })}>
          Mejor valorados
        </Chip>
      </View>

      {!isLoading ? (
        <Text style={{ color: c.muted, fontSize: 12.5 * escala, marginTop: S[4], marginBottom: S[2] }}>
          {lista.length} {etiqueta} en {zona}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={isLoading ? [] : lista}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      ListHeaderComponent={Cabecera}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brand600} />}
      renderItem={({ item }) => (
        <View style={{ marginBottom: 12 }}>
          <Tarjeta p={item} zona={zona} onOpen={(p) => router.push(`/publicacion/${p.id}`)} />
        </View>
      )}
      ListEmptyComponent={
        isLoading ? (
          <Skeleton height={240} />
        ) : (
          <Empty
            icon="heart"
            titulo="Sin favores por ahora"
            texto="Pide o ofrece ayuda a tus vecinos."
            accion={
              <Btn variant="primary" icon="plus" onPress={() => router.push("/publicar?modo=favor")}>
                Publicar un favor
              </Btn>
            }
          />
        )
      }
      ListFooterComponent={
        lista.length > 0 ? (
          <Text style={{ color: c.muted, fontSize: 12 * escala, textAlign: "center", fontFamily: F.regular }}>
            Los favores no tienen precio: se coordinan por mensaje.
          </Text>
        ) : null
      }
    />
  );
}
