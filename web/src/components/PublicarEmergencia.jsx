import React, { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon } from "../lib/icons";
import { Sheet, Btn, Field, Select, useToast } from "./ui";

const NECESIDADES = [
  ["agua_potable", "Agua potable"], ["alimentos", "Alimentos"], ["balde_bidon", "Bidones o baldes"],
  ["techo", "Techo o carpa"], ["abrigo", "Abrigo"], ["higiene", "Higiene"],
  ["salud", "Salud o medicinas"], ["herramientas", "Herramientas"], ["movilidad", "Movilidad"],
  ["alojamiento", "Alojamiento"], ["energia", "Energía o luz"], ["otro", "Otro"],
];

/* Publicar un recurso o una necesidad del tablero de emergencia. */
export default function PublicarEmergencia({ open, modo = "ofrezco", onClose, onPublicado }) {
  const { usuario } = useAuth();
  const { zona } = useZona();
  const toast = useToast();
  const [tipo, setTipo] = useState(modo);
  const [f, setF] = useState({ necesidad: "agua_potable", zona });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const publicar = async () => {
    setError("");
    if ((f.titulo || "").trim().length < 4) return setError("Ponle un título corto: qué ofreces o qué necesitas.");
    if ((f.descripcion || "").trim().length < 8) return setError("Cuenta en una línea dónde y cuándo.");
    setGuardando(true);
    try {
      const ofrezco = tipo === "ofrezco";
      await api.post("/api/publicaciones", {
        tipo: ofrezco ? "favor_ofrecido" : "favor_solicitado",
        categoria: "otros",
        subtipo_favor: ofrezco ? "donacion" : "ayuda_temporal",
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim(),
        precio: "",
        medios_pago: "",
        politica_pago: "contra_entrega",
        zona: f.zona || zona,
        es_emergencia: true,
        necesidad: f.necesidad,
        mostrar_contacto: f.mostrar !== false,
        client_id: `em-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      });
      toast(ofrezco ? "Recurso publicado en el tablero" : "Pedido publicado en el tablero");
      setF({ necesidad: "agua_potable", zona });
      onClose?.(); onPublicado?.();
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  };

  if (!open) return null;
  if (!usuario) {
    return (
      <Sheet open onClose={onClose} titulo="Emergencias" ancho={420}>
        <div className="gate">
          <div className="gate-icon"><Icon name="alert" size="1.4em" /></div>
          <h3>Entra para avisar al barrio</h3>
          <p className="hint">Los recursos se ven sin cuenta; para publicar o coordinar necesitas una.</p>
          <Btn variant="primary" className="wide" onClick={() => { onClose?.(); location.hash = "#/perfil"; }}>Entrar</Btn>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} titulo="Tablero de emergencia" ancho={520}>
      <div className="segmented" role="tablist">
        <button type="button" className={tipo === "ofrezco" ? "on" : ""} onClick={() => setTipo("ofrezco")}>Ofrezco un recurso</button>
        <button type="button" className={tipo === "necesito" ? "on" : ""} onClick={() => setTipo("necesito")}>Necesito ayuda</button>
      </div>

      <Field label="¿Qué es?" id="em-nec">
        <Select id="em-nec" ariaLabel="Tipo de recurso" value={f.necesidad}
          onChange={(v) => set("necesidad", v)} options={NECESIDADES.map(([v, l]) => ({ value: v, label: l }))} />
      </Field>
      <Field label="Título corto" id="em-tit" contador={`${(f.titulo || "").length}/90`}>
        <input id="em-tit" maxLength={90} value={f.titulo || ""} onChange={(e) => set("titulo", e.target.value)}
          placeholder={tipo === "ofrezco" ? "Ej.: 20 bidones de agua en el parque" : "Ej.: Necesito agua para 8 personas"} />
      </Field>
      <Field label="Dónde y cuándo" id="em-desc" contador={`${(f.descripcion || "").length}/300`}>
        <textarea id="em-desc" rows={2} maxLength={300} value={f.descripcion || ""}
          onChange={(e) => set("descripcion", e.target.value)}
          placeholder="Ej.: los dejo en el parque del sector hasta las 8 de la noche" />
      </Field>
      <Field label="Sector" id="em-zona">
        <input id="em-zona" maxLength={60} value={f.zona || ""} onChange={(e) => set("zona", e.target.value)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={f.mostrar !== false} onChange={(e) => set("mostrar", e.target.checked)} />
        Mostrar mi teléfono a vecinos con sesión
      </label>

      {error && <p className="error">{error}</p>}
      <Btn variant="primary" className="wide" icon="check" onClick={publicar} disabled={guardando}>
        {guardando ? "Publicando…" : "Publicar en el tablero"}
      </Btn>
    </Sheet>
  );
}
