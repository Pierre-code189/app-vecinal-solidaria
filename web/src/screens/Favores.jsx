import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useZona } from "../context/Zona";
import { Btn, Segmented, Select, Tarjeta, Empty } from "../components/ui";
import Detalle from "../components/detalle";
import { Icon } from "../lib/icons";

const TIPOS_FAVOR = [
  { value: "", label: "Todos los tipos" },
  { value: "prestamo", label: "Préstamo de cosas" },
  { value: "ayuda_temporal", label: "Ayuda temporal" },
  { value: "donacion", label: "Donación de materiales" },
  { value: "intercambio_habilidades", label: "Intercambio de habilidades" },
  { value: "movilidad", label: "Movilidad solidaria" },
];

export default function Favores() {
  const { zona, ref } = useZona();
  const [filtro, setFiltro] = useState("");
  const [subtipo, setSubtipo] = useState("");
  const [q, setQ] = useState("");
  const [rapidos, setRapidos] = useState({ cerca: false, top: false });
  const [detalle, setDetalle] = useState(null);

  const params = new URLSearchParams({ limit: "50", solo_favores: "true" });
  if (filtro) params.set("tipo", filtro);
  if (subtipo) params.set("tipo_favor", subtipo);
  if (ref[0]) { params.set("lat", ref[0]); params.set("lng", ref[1]); }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["favores", filtro, subtipo, ref[0], ref[1]],
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


  return (
    <section className="view on">
      <h1>Favores
        <span className="sub">Pide o ofrece ayuda sin dinero a tus vecinos</span>
      </h1>

      <Segmented value={filtro} onChange={setFiltro} options={[
        { value: "", label: "Todos" },
        { value: "favor_solicitado", label: "Necesito" },
        { value: "favor_ofrecido", label: "Ofrezco" },
      ]} />

      <div className="toolbar panel-acciones">
      <div className="buscador buscador-solo">
        <Icon name="search" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un favor…" aria-label="Buscar favores" />
      </div>
      </div>

      {isLoading && <div className="grid"><div className="skeleton" /></div>}
      {!isLoading && lista.length === 0 && (
        <Empty icon="heart" titulo="Sin favores por ahora" texto="Pide o ofrece ayuda a tus vecinos." />
      )}

      <div className="chips-filtro dos-filtros">
        <button type="button" className={`chip ${rapidos.cerca ? "on" : ""}`}
          onClick={() => setRapidos({ ...rapidos, cerca: !rapidos.cerca })}>
          <Icon name="pin" /> Cerca (≤ 1 km)
        </button>
        <button type="button" className={`chip ${rapidos.top ? "on" : ""}`}
          onClick={() => setRapidos({ ...rapidos, top: !rapidos.top })}>
          <Icon name="thumb" /> Mejor valorados
        </button>
      </div>

      {!isLoading && (
        <div className="orden">
          <span className="hint">{lista.length} {
            filtro === "favor_solicitado"
              ? (lista.length === 1 ? "pedido" : "pedidos")
              : filtro === "favor_ofrecido"
                ? (lista.length === 1 ? "ofrecido" : "ofrecidos")
                : (lista.length === 1 ? "favor" : "favores")
          } en {zona}</span>
        </div>
      )}

      <div className="grid" data-tour="favores">
        {lista.map((p) => (
          <Tarjeta key={p.id} p={p} zona={zona} onOpen={() => setDetalle(p.id)} />
        ))}
      </div>

      {detalle && <Detalle id={detalle} onClose={() => setDetalle(null)} />}
    </section>
  );
}
