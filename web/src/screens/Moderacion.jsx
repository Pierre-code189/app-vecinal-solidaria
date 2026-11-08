import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn, Badge, Empty, useToast, Select } from "../components/ui";
import { hace } from "../lib/format";

export default function Moderacion() {
  const { esModerador } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [nota, setNota] = useState("");

  const { data: metricas } = useQuery({ queryKey: ["metricas"], queryFn: () => api.get("/api/moderacion/metricas"), enabled: esModerador, refetchInterval: 30000 });
  const { data: reportes, isLoading } = useQuery({ queryKey: ["reportes"], queryFn: () => api.get("/api/moderacion/reportes"), enabled: esModerador });

  if (!esModerador) {
    return (
      <section className="view on">
        <h1>Moderación</h1>
        <Empty icon="shield" titulo="Sección para moderadores" texto="Tu cuenta no tiene ese rol." />
      </section>
    );
  }

  const decidir = async (r, accion) => {
    try {
      await api.post("/api/moderacion/reportes", { reporte_id: r.id, accion, nota });
      toast(`Reporte ${accion === "ninguna" ? "archivado" : "resuelto"}`);
      setNota("");
      qc.invalidateQueries({ queryKey: ["reportes"] });
      qc.invalidateQueries({ queryKey: ["metricas"] });
    } catch (e) { toast(e.message, "err"); }
  };

  const m = metricas || {};

  return (
    <section className="view on">
      <h1>Moderación
        <span className="sub">Reportes pendientes e indicadores del barrio</span>
      </h1>

      <div className="stats-row">
        <div><b>{m.ofertas_activas ?? "—"}</b><span>ofertas activas</span></div>
        <div><b>{m.usuarios ?? "—"}</b><span>vecinos</span></div>
        <div><b>{m.reportes_pendientes ?? "—"}</b><span>reportes</span></div>
        <div><b>{m.vistos_buenos ?? "—"}</b><span>vistos buenos</span></div>
      </div>

      <h2 className="sec">Reportes pendientes</h2>
      {isLoading && <div className="skeleton tall" />}
      {!isLoading && (!reportes?.items || reportes.items.length === 0) && (
        <Empty icon="check" titulo="Nada pendiente" texto="El barrio está tranquilo." />
      )}

      {(reportes?.items || []).map((r) => (
        <div className="fila" key={r.id}>
          <div className="fila-top"><b>{r.titulo}</b><Badge tono="rojo">{r.motivo}</Badge></div>
          <p className="hint">Reportado por {r.denunciante || "un vecino"} · {hace(r.creado)} · autor: {r.autor}</p>
          <p className="hint">«{r.descripcion?.slice(0, 160)}»</p>
          <input className="nota-input" placeholder="Nota de moderación (queda registrada)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="fila-acc">
            <Btn size="small" onClick={() => decidir(r, "ninguna")}>Sin problema</Btn>
            <Btn size="small" onClick={() => decidir(r, "ocultar")}>Ocultar</Btn>
            <Btn size="small" variant="danger" onClick={() => decidir(r, "eliminar")}>Eliminar</Btn>
          </div>
        </div>
      ))}

      <h2 className="sec">Indicadores</h2>
      <div className="datos">
        <div><span>Contactos iniciados</span><b>{m.contactos_iniciados ?? 0}</b></div>
        <div><span>Cotizaciones</span><b>{m.cotizaciones ?? 0}</b></div>
        <div><span>Cotizaciones respondidas</span><b>{m.cotizaciones_respondidas ?? 0}</b></div>
        <div><span>Tratos</span><b>{m.tratos ?? 0}</b></div>
        <div><span>Tratos cerrados</span><b>{m.tratos_cerrados ?? 0}</b></div>
        <div><span>Intercambios resueltos</span><b>{m.intercambios_resueltos ?? 0}</b></div>
      </div>
      <p className="hint"><Icon name="shield" /> Las acciones de moderación quedan registradas con tu nombre.</p>
    </section>
  );
}
