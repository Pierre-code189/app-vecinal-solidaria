import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon } from "../lib/icons";
import { Btn, Empty, useToast } from "../components/ui";
import PublicarEmergencia from "../components/PublicarEmergencia";
import DetallePub from "../components/DetallePub";

const SOS = [
  { num: "105", nombre: "Emergencias (Policía)", icon: "shield" },
  { num: "116", nombre: "Bomberos", icon: "alert" },
  { num: "115", nombre: "SAMU / ambulancia", icon: "heart" },
  { num: "106", nombre: "Defensa Civil", icon: "shield" },
];

export default function Emergencia() {
  const { usuario, esModerador } = useAuth();
  const { zona } = useZona();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: tablero } = useQuery({ queryKey: ["emergencia"], queryFn: () => api.get("/api/emergencia"), refetchInterval: 60000 });
  const { data: dir } = useQuery({ queryKey: ["directorio"], queryFn: () => api.get("/api/emergencia/directorio") });
  const [necesidad, setNecesidad] = useState("");
  const [nuevo, setNuevo] = useState(null); // ofrezco | necesito
  const [detalle, setDetalle] = useState(null);
  const { data: recursos } = useQuery({
    queryKey: ["recursos", zona],
    queryFn: () => api.get(`/api/publicaciones?emergencia=true&limit=20&zona=${encodeURIComponent(zona)}`),
  });
  const { data: otros } = useQuery({
    queryKey: ["recursos-todos"],
    queryFn: () => api.get("/api/publicaciones?emergencia=true&limit=20"),
    enabled: (recursos?.items || []).length === 0,
  });

  const activar = useMutation({
    mutationFn: (activo) => api.post("/api/emergencia/activar", { activo, motivo: activo ? "Activado por moderación" : "Desactivado" }),
    onSuccess: () => { toast("Tablero actualizado"); qc.invalidateQueries({ queryKey: ["emergencia"] }); },
    onError: (e) => toast(e.message, "err"),
  });

  const activo = tablero?.activo;

  return (
    <section className="view on">
      <h1>Emergencias
        <span className="sub">Qué hacer, a quién llamar y qué hay disponible en tu sector</span>
      </h1>

      <div className={`tablero ${activo ? "on" : ""}`}>
        <div className="tablero-estado">
          <Icon name={activo ? "alert" : "shield"} />
          <div>
            <b>{activo ? "Tablero activo" : "Sin emergencia declarada"}</b>
            <p>{activo
              ? `Activado ${tablero?.motivo ? `por ${tablero.motivo}` : "por moderación"}. Los recursos marcados se muestran primero.`
              : "Los recursos de emergencia siguen visibles, pero sin alerta general."}</p>
          </div>
        </div>
        {esModerador && (
          <Btn size="small" variant={activo ? "danger" : "primary"} onClick={() => activar.mutate(!activo)}>
            {activo ? "Desactivar" : "Activar tablero"}
          </Btn>
        )}
      </div>

      <h2 className="sec">Llamadas de emergencia</h2>
      <div className="sos" data-tour="sos">
        {SOS.map((s) => (
          <a key={s.num} href={`tel:${s.num}`} className="sos-item">
            <Icon name={s.icon} /><b>{s.num}</b><span>{s.nombre}</span>
          </a>
        ))}
      </div>

      <div className="em-publicar">
        <Btn variant="primary" icon="box" onClick={() => setNuevo("ofrezco")}>Ofrecer un recurso</Btn>
        <Btn icon="alert" onClick={() => setNuevo("necesito")}>Necesito ayuda</Btn>
      </div>

      <h2 className="sec">Recursos en {zona}</h2>
      <div className="chips-filtro">
        {[["", "Todo"], ["agua_potable", "Agua"], ["alimentos", "Comida"], ["balde_bidon", "Bidones"],
          ["herramientas", "Herramientas"], ["movilidad", "Movilidad"], ["salud", "Salud"], ["techo", "Techo"]]
          .map(([v, etiqueta]) => (
            <button key={v} type="button" className={`chip ${necesidad === v ? "on" : ""}`}
              onClick={() => setNecesidad(v)}>{etiqueta}</button>
          ))}
      </div>
      {(!recursos?.items || recursos.items.length === 0) && (
        <Empty icon="box" titulo="Aún no hay recursos marcados aquí" texto="Si tienes agua, bidones o víveres, publícalo y marca «también disponible en emergencias»." />
      )}
      <div className="grid">
        {(recursos?.items || []).length === 0 && (otros?.items || []).length > 0 && (
          <p className="nota">No hay recursos en {zona}. Estos son de otros sectores del distrito.</p>
        )}
        {((recursos?.items?.length ? recursos.items : otros?.items) || [])
          .filter((r) => !necesidad || r.necesidad === necesidad).map((r) => (
          <article className="card recurso" key={r.id} role="button" tabIndex={0}
            onClick={() => setDetalle(r.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setDetalle(r.id)}>
            <div className="cat"><Icon name="box" />{r.categoria}</div>
            <h3>{r.titulo}</h3>
            <p className="desc">{r.descripcion}</p>
            <p className="quien"><span className="quien-txt">{r.nombre} · {r.zona}</span></p>
            {r.contacto_visible && r.telefono ? (
              <>
                <a className="btn small" href={`https://wa.me/51${r.telefono}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />WhatsApp</a>
                <a className="btn small" href={`sms:+51${r.telefono}?body=${encodeURIComponent("Necesito: " + r.titulo)}`}><Icon name="chat" />Enviar SMS</a>
              </>
            ) : (
              <p className="hint"><Icon name="lock" /> Contacto visible solo con sesión.</p>
            )}
          </article>
        ))}
      </div>

      <h2 className="sec">Directorio del barrio</h2>
      <div className="dir">
        {(dir?.items || []).map((d) => (
          <div className="dir-item" key={d.id || d.nombre}>
            <b>{d.nombre}</b>
            <span>{d.detalle}</span>
            {d.telefono && <a href={`tel:${d.telefono}`}>{d.telefono}</a>}
          </div>
        ))}
        {(!dir?.items || dir.items.length === 0) && <p className="hint">El directorio aún está vacío.</p>}
      </div>

      <PublicarEmergencia open={Boolean(nuevo)} modo={nuevo || "ofrezco"}
        onClose={() => setNuevo(null)}
        onPublicado={() => qc.invalidateQueries({ queryKey: ["recursos"] })} />
      {detalle && <DetallePub id={detalle} onClose={() => setDetalle(null)} />}

      <p className="nota">
        Esta app no reemplaza a los servicios de emergencia. Si hay riesgo de vida, llama primero al 105.
        {!usuario && " Entra a tu cuenta para ver teléfonos de contacto de los recursos."}
      </p>
    </section>
  );
}
