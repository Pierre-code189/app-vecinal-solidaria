import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useZona } from "../context/Zona";
import { Btn, Segmented, Select, Tarjeta, Empty } from "../components/ui";
import DetallePub from "../components/DetallePub";
import PublicarNuevo from "../components/PublicarNuevo";

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
  const [detalle, setDetalle] = useState(null);
  const [publicar, setPublicar] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState("favor_solicitado");

  const params = new URLSearchParams({ limit: "50", solo_favores: "true" });
  if (filtro) params.set("tipo", filtro);
  if (subtipo) params.set("tipo_favor", subtipo);
  if (ref[0]) { params.set("lat", ref[0]); params.set("lng", ref[1]); }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["favores", filtro, subtipo, ref[0], ref[1]],
    queryFn: () => api.get(`/api/publicaciones?${params}`),
  });

  const abrirPublicar = (t) => { setNuevoTipo(t); setPublicar(true); };

  return (
    <section className="view on">
      <h1>Economía Solidaria
        <span className="sub">Pide o ofrece ayuda sin dinero a tus vecinos</span>
      </h1>

      <Segmented value={filtro} onChange={setFiltro} options={[
        { value: "", label: "Todos" },
        { value: "favor_solicitado", label: "Necesito" },
        { value: "favor_ofrecido", label: "Ofrezco" },
      ]} />

      <div className="toolbar">
        <Select ariaLabel="Tipo de favor" value={subtipo} onChange={setSubtipo} options={TIPOS_FAVOR} className="sel-toolbar" />
        <Btn icon="plus" onClick={() => abrirPublicar("favor_solicitado")}>Necesito ayuda</Btn>
        <Btn icon="heart" onClick={() => abrirPublicar("favor_ofrecido")}>Ofrezco ayuda</Btn>
      </div>

      {isLoading && <div className="grid"><div className="skeleton" /></div>}
      {!isLoading && (data?.items || []).length === 0 && (
        <Empty icon="heart" titulo="Sin favores por ahora" texto="Pide o ofrece ayuda a tus vecinos." />
      )}

      <div className="grid" data-tour="favores">
        {(data?.items || []).map((p) => (
          <Tarjeta key={p.id} p={p} zona={zona} onOpen={() => setDetalle(p.id)} />
        ))}
      </div>

      {detalle && <DetallePub id={detalle} onClose={() => setDetalle(null)} />}
      <PublicarNuevo open={publicar} inicial={nuevoTipo} onClose={() => setPublicar(false)} onPublicado={refetch} />
    </section>
  );
}
