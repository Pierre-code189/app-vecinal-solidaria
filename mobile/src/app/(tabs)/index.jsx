import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useZona } from "../../context/zona";
import { useAuth } from "../../context/auth";
import { useLectorVoz, useTema } from "../../context/ajustes";
import { Icon } from "../../lib/icons";
import { Btn, Chip, Empty, Input, Segmented, Select, Skeleton, Tarjeta, Titulo, useAncho, useToast } from "../../components/ui";
import { F, R, S } from "../../lib/theme";

const CATS = ["", "gasfitería", "carpintería", "electricidad", "cerrajería", "clases", "alimentos",
  "paseo de mascotas", "herramientas", "movilidad", "préstamo", "otros"];

const ORDENES = [
  { value: "cercania", label: "Más cercano" },
  { value: "reciente", label: "Más reciente" },
  { value: "vistos", label: "Mejor valorado" },
];

const RADIOS = [
  { value: "0", label: "Todo" },
  { value: "1", label: "1 km" },
  { value: "2", label: "2 km" },
  { value: "5", label: "5 km" },
];

export default function Local() {
  const { c, escala } = useTema();
  const { zona, ref } = useZona();
  const { usuario } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const ancho = useAncho();
  const columnas = ancho >= 700 ? 2 : 1;

  const [tipo, setTipo] = useState("");
  const [cat, setCat] = useState("");
  const [orden, setOrden] = useState("cercania");
  const [radio, setRadio] = useState("0");
  const [q, setQ] = useState("");
  const [rapidos, setRapidos] = useState({ cerca: false, top: false });

  useLectorVoz(`Economía Local. Servicios y productos de tus vecinos en ${zona}.`);

  const params = new URLSearchParams({ limit: "30", orden });
  if (tipo) params.set("tipo", tipo);
  if (cat) params.set("categoria", cat);
  if (q) params.set("q", q);
  if (ref[0]) {
    params.set("lat", ref[0]);
    params.set("lng", ref[1]);
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["lista", tipo, cat, orden, q, ref[0], ref[1]],
    queryFn: () => api.get(`/api/publicaciones?${params}`),
  });

  const items = useMemo(() => {
    let lista = (data?.items || []).filter((p) => !String(p.tipo || "").startsWith("favor"));
    if (radio !== "0") lista = lista.filter((p) => p.distancia_km != null && p.distancia_km <= Number(radio));
    if (rapidos.cerca) lista = lista.filter((p) => p.distancia_km != null && p.distancia_km <= 1);
    if (rapidos.top) lista = [...lista].sort((a, b) => (b.vistos || 0) - (a.vistos || 0));
    return lista;
  }, [data, radio, rapidos]);

  const etiqueta = { servicio: "servicios", producto: "productos", "": "publicaciones" }[tipo] || "publicaciones";

  const dictar = () => {
    toast("El dictado por voz necesita una compilación con micrófono. Por ahora escribe tu búsqueda.", "warn");
  };

  const Cabecera = (
    <View>
      <Titulo sub={`Servicios y productos de tus vecinos en ${zona}, del más cercano al más lejano`}>
        Economía Local
      </Titulo>

      <Segmented
        value={tipo}
        onChange={setTipo}
        options={[
          { value: "", label: "Todo" },
          { value: "servicio", label: "Servicios" },
          { value: "producto", label: "Productos" },
        ]}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: S[3] }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <Input
            value={q}
            onChangeText={setQ}
            placeholder="Buscar en tu sector…"
            accessibilityLabel="Buscar"
            returnKeyType="search"
            style={{ flex: 1, paddingRight: 44 }}
          />
          <Pressable
            onPress={dictar}
            accessibilityLabel="Buscar por voz"
            style={{ position: "absolute", right: 4, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="mic" size={19} color={c.muted} />
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop: 8 }}>
        <Select
          ariaLabel="Categoría"
          value={cat}
          onChange={setCat}
          options={CATS.map((x) => ({ value: x, label: x ? x.charAt(0).toUpperCase() + x.slice(1) : "Todas las categorías" }))}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Chip icono="pin" activo={rapidos.cerca} onPress={() => setRapidos({ ...rapidos, cerca: !rapidos.cerca })}>
          Cerca (≤ 1 km)
        </Chip>
        <Chip icono="thumb" activo={rapidos.top} onPress={() => setRapidos({ ...rapidos, top: !rapidos.top })}>
          Mejor valorados
        </Chip>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: S[4], marginBottom: S[2], gap: 10 }}>
        <Text style={{ color: c.muted, fontSize: 12.5 * escala, flex: 1 }}>
          {items.length} {etiqueta} en {zona}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, width: 210 }}>
          <Select ariaLabel="Ordenar por" value={orden} onChange={setOrden} options={ORDENES} style={{ flex: 1.4 }} />
          <Select ariaLabel="Distancia" value={radio} onChange={setRadio} options={RADIOS} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      key={`cols-${columnas}`}
      data={isLoading ? [] : items}
      keyExtractor={(p) => String(p.id)}
      numColumns={columnas}
      columnWrapperStyle={columnas > 1 ? { gap: 12 } : undefined}
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      ListHeaderComponent={Cabecera}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brand600} />}
      renderItem={({ item }) => (
        <View style={{ flex: 1, marginBottom: 12 }}>
          <Tarjeta p={item} zona={zona} onOpen={(p) => router.push(`/publicacion/${p.id}`)} />
        </View>
      )}
      ListEmptyComponent={
        isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={240} />
            <Skeleton height={240} />
          </View>
        ) : (
          <Empty
            icon="search"
            titulo={`No hay ${etiqueta} con ese filtro`}
            texto="Prueba con otra categoría o publica tú el primero."
            accion={
              <Btn variant="primary" icon="plus" onPress={() => router.push("/publicar?modo=servicio")}>
                Publicar
              </Btn>
            }
          />
        )
      }
      ListFooterComponent={
        !isLoading && items.length > 0 && !usuario ? (
          <Text style={{ color: c.muted, fontSize: 12.5 * escala, textAlign: "center", marginTop: 8 }}>
            Entra a tu cuenta para ver teléfonos y contactar.
          </Text>
        ) : null
      }
    />
  );
}

