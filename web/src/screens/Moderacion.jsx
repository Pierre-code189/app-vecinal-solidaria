import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn, Badge, Empty, useToast, Field } from "../components/ui";
import { hace } from "../lib/format";

export default function Moderacion() {
  const { esModerador, esAdmin } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [nota, setNota] = useState("");

  const { data: metricas } = useQuery({ queryKey: ["metricas"], queryFn: () => api.get("/api/moderacion/metricas"), enabled: esModerador, refetchInterval: 30000 });
  const { data: reportes, isLoading } = useQuery({ queryKey: ["reportes"], queryFn: () => api.get("/api/moderacion/reportes"), enabled: esModerador });
  const { data: colusion } = useQuery({ queryKey: ["colusion"], queryFn: () => api.get("/api/admin/colusion"), enabled: esModerador });
  const { data: equipo } = useQuery({ queryKey: ["equipo"], queryFn: () => api.get("/api/admin/equipo"), enabled: esAdmin });
  const [tel, setTel] = useState("");
  const [rol, setRol] = useState("moderador");

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
      <h2 className="sec">Señales de círculos cerrados</h2>
      <p className="hint">{colusion?.nota || "Señales para revisar: pares que repiten tratos y vistos concentrados."}</p>
      {(!colusion?.items || colusion.items.length === 0) && (
        <Empty icon="check" titulo="Sin señales por ahora" texto="Nadie concentra tratos ni recomendaciones de forma rara." />
      )}
      {(colusion?.items || []).map((c, k) => (
        <div className="fila" key={k}>
          <div className="fila-top">
            <b>{c.a} ↔ {c.b}</b>
            <Badge tono="rojo">{c.veces} veces</Badge>
          </div>
          <p className="hint">{c.tipo === "tratos_repetidos"
            ? "Cerraron varios tratos solo entre ellos."
            : "Una persona concentra sus vistos buenos en la misma cuenta."}</p>
        </div>
      ))}

      {esAdmin && (
        <>
          <h2 className="sec">Equipo (solo administrador)</h2>
          <div className="fila">
            <p className="hint">Reparte roles por teléfono. Cada cambio queda en el registro.</p>
            <div className="dos">
              <Field label="Teléfono" id="eq-tel">
                <input id="eq-tel" inputMode="numeric" maxLength={9} value={tel}
                  onChange={(e) => setTel(e.target.value.replace(/\D/g, ""))} placeholder="999000006" />
              </Field>
              <Field label="Rol" id="eq-rol">
                <select id="eq-rol" value={rol} onChange={(e) => setRol(e.target.value)}>
                  <option value="moderador">Moderador</option>
                  <option value="admin">Administrador</option>
                  <option value="vecino">Vecino (quitar rol)</option>
                </select>
              </Field>
            </div>
            <Btn size="small" variant="primary" icon="shield" disabled={tel.length !== 9}
              onClick={async () => {
                try {
                  await api.post("/api/admin/rol", { telefono: tel, rol });
                  toast("Rol actualizado"); setTel("");
                  qc.invalidateQueries({ queryKey: ["equipo"] });
                } catch (e) { toast(e.message, "err"); }
              }}>Guardar rol</Btn>
          </div>
          {(equipo?.items || []).map((u) => (
            <div className="fila" key={u.id}>
              <div className="fila-top"><b>{u.nombre}</b><Badge tono={u.rol === "admin" ? "verde" : "gris"}>{u.rol}</Badge></div>
              <p className="hint">{u.telefono} · {u.zona}</p>
            </div>
          ))}
        </>
      )}

      <p className="hint"><Icon name="shield" /> Las acciones de moderación quedan registradas con tu nombre.</p>
    </section>
  );
}
