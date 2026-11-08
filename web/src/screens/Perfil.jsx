import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon } from "../lib/icons";
import { Btn, Field, Select, Avatar, useToast, Segmented, Sheet } from "../components/ui";

export default function Perfil() {
  const { usuario, entrar, registrar, salir, recargar } = useAuth();
  const { zonas } = useZona();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [modo, setModo] = useState(() => (new URLSearchParams(loc.search).get("modo") === "registro" ? "registro" : "entrar"));
  const [f, setF] = useState({});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState({ actual: "", nuevo: "" });
  const [pinError, setPinError] = useState("");

  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => api.get("/api/salud"), enabled: Boolean(usuario) });

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setError(""); setCargando(true);
    try {
      if (modo === "entrar") await entrar((f.email || "").trim().toLowerCase(), f.password || "");
      else {
        if ((f.nombre || "").trim().length < 3) throw new Error("Escribe tu nombre y apellido.");
        if (!/^\d{9}$/.test(f.telefono || "")) throw new Error("El teléfono debe tener 9 dígitos.");
        if ((f.password || "").length < 6) throw new Error("La contraseña necesita 6 caracteres o más.");
        if (!f.acepta) throw new Error("Debes aceptar el aviso de privacidad.");
        await registrar({
          nombre: f.nombre.trim(), email: (f.email || "").trim().toLowerCase(), password: f.password,
          telefono: f.telefono, zona: f.zona || "Piura Centro", yape: f.yape || "", plin: f.plin || "",
          acepta_privacidad: true,
        });
      }
      toast(modo === "entrar" ? "Bienvenido de vuelta" : "Cuenta creada. Ya puedes publicar.");
      setF({}); setError("");
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  };

  if (!usuario) {
    return (
      <section className="view on">
        <h1>{modo === "entrar" ? "Entrar" : "Crear cuenta"}
          <span className="sub">Una cuenta por persona. Tu número solo lo ven vecinos con sesión.</span>
        </h1>

        <Segmented value={modo} onChange={(v) => { setModo(v); setError(""); }} options={[
          { value: "entrar", label: "Ya tengo cuenta" }, { value: "registro", label: "Crear cuenta" },
        ]} />

        <form className="form-card" onSubmit={enviar}>
          {modo === "registro" && (
            <>
              <Field label="Nombre y apellido" id="r-nombre">
                <input id="r-nombre" autoComplete="name" value={f.nombre || ""} onChange={(e) => set("nombre", e.target.value)} />
              </Field>
              <Field label="Sector donde vives" id="r-zona">
                <Select id="r-zona" ariaLabel="Sector" value={f.zona || "Piura Centro"} onChange={(v) => set("zona", v)}
                  options={zonas.map((z) => ({ value: z.nombre, label: z.nombre }))} />
              </Field>
            </>
          )}
          <Field label="Correo electrónico" id="r-email">
            <input id="r-email" type="email" autoComplete="email" inputMode="email" value={f.email || ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
          {modo === "registro" && (
            <Field label="Teléfono (9 dígitos)" id="r-tel" hint="Se usa para coordinar la entrega. No se publica sin tu permiso.">
              <input id="r-tel" inputMode="numeric" maxLength={9} value={f.telefono || ""}
                onChange={(e) => set("telefono", e.target.value.replace(/\D/g, ""))} />
            </Field>
          )}
          <Field label="Contraseña" id="r-pass" hint={modo === "registro" ? "Mínimo 6 caracteres." : undefined}>
            <input id="r-pass" type="password" autoComplete={modo === "registro" ? "new-password" : "current-password"} value={f.password || ""} onChange={(e) => set("password", e.target.value)} />
          </Field>
          {modo === "registro" && (
            <>
              <div className="dos">
                <Field label="Yape (opcional)" id="r-yape"><input id="r-yape" inputMode="numeric" maxLength={9} value={f.yape || ""} onChange={(e) => set("yape", e.target.value.replace(/\D/g, ""))} /></Field>
                <Field label="Plin (opcional)" id="r-plin"><input id="r-plin" inputMode="numeric" maxLength={9} value={f.plin || ""} onChange={(e) => set("plin", e.target.value.replace(/\D/g, ""))} /></Field>
              </div>
              <label className="check">
                <input type="checkbox" checked={Boolean(f.acepta)} onChange={(e) => set("acepta", e.target.checked)} />
                Acepto el aviso de privacidad (Ley 29733): mis datos se usan solo para coordinar el trueque o servicio y puedo pedir su borrado.
              </label>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <Btn type="submit" variant="primary" className="wide" disabled={cargando}>{cargando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear mi cuenta"}</Btn>
          {modo === "entrar" && (
            <p className="hint" style={{ textAlign: "center" }}>
              <button type="button" className="linkbtn" onClick={() => nav("/recuperar")}>Olvidé mi contraseña</button>
            </p>
          )}
        </form>
      </section>
    );
  }

  const guardar = async (e) => {
    e.preventDefault();
    try {
      const r = await api.put("/api/perfil", {
        nombre: f.nombre ?? usuario.nombre, telefono: f.telefono ?? usuario.telefono,
        zona: f.zona ?? usuario.zona, yape: f.yape ?? usuario.yape, plin: f.plin ?? usuario.plin,
      });
      await recargar();
      const n = r?.publicaciones_actualizadas || 0;
      toast(n ? `Datos guardados. Actualizamos ${n} publicación(es) activa(s).` : "Datos guardados");
      setEditando(false);
    } catch (err) { toast(err.message, "err"); }
  };

  return (
    <section className="view on">
      <h1>Mi perfil</h1>

      <Sheet open={pinOpen} onClose={() => { setPinOpen(false); setPinError(""); setPin({ actual: "", nuevo: "" }); }}
        titulo="Cambiar mi PIN" ancho={400}>
        <h2 className="sheet-title"><Icon name="lock" /> Cambiar mi PIN</h2>
        <p className="hint">Por seguridad pedimos tu PIN actual. Si lo olvidaste, sal y usa «Olvidé mi PIN» con un código al teléfono.</p>
        <Field label="PIN actual" id="pin-actual">
          <input id="pin-actual" type="password" inputMode="numeric" maxLength={6} className="pin"
            value={pin.actual} onChange={(e) => setPin({ ...pin, actual: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label="PIN nuevo (6 dígitos)" id="pin-nuevo">
          <input id="pin-nuevo" type="password" inputMode="numeric" maxLength={6} className="pin"
            value={pin.nuevo} onChange={(e) => setPin({ ...pin, nuevo: e.target.value.replace(/\D/g, "") })} />
        </Field>
        {pinError && <p className="error">{pinError}</p>}
        <Btn variant="primary" className="wide" icon="check"
          disabled={pin.actual.length !== 6 || pin.nuevo.length !== 6}
          onClick={async () => {
            setPinError("");
            try {
              await api.post("/api/perfil/pin", { pin_actual: pin.actual, pin_nuevo: pin.nuevo });
              toast("PIN actualizado"); setPinOpen(false); setPin({ actual: "", nuevo: "" });
            } catch (e) { setPinError(e.message); }
          }}>Guardar PIN</Btn>
      </Sheet>
      <section className="perfil-cab">
        <Avatar nombre={usuario.nombre} cls="grande" />
        <div className="perfil-id">
          <b>{usuario.nombre}</b>
          <p className="hint">{usuario.telefono} · {usuario.zona}</p>
          <div className="perfil-tags">
            {usuario.rol !== "vecino" && (
              <span className="badge verde"><Icon name="shield" />{usuario.rol === "admin" ? "Administrador" : "Moderador"}</span>
            )}
            {usuario.telefono_verificado && <span className="tag-ok"><Icon name="check" />Verificado</span>}
          </div>
        </div>
        <Btn size="small" icon="user" onClick={() => { setEditando(true); setF({}); }}>Editar</Btn>
      </section>

      <div className="kpis">
        <div className="kpi"><Icon name="store" /><b>{usuario.publicaciones ?? 0}</b><span>Publicaciones</span></div>
        <div className="kpi"><Icon name="thumb" /><b>{usuario.vistos_recibidos ?? 0}</b><span>Vistos buenos</span></div>
        <div className="kpi"><Icon name="handshake" /><b>{usuario.tratos_cerrados ?? 0}</b><span>Tratos cerrados</span></div>
      </div>
      {!(usuario.publicaciones || usuario.vistos_recibidos || usuario.tratos_cerrados) && (
        <p className="hint perfil-vacio">Aún sin actividad. Publica tu primer servicio o favor y aparecerá aquí.</p>
      )}

      {!editando ? (
        <>
          <section className="bloque">
            <h3 className="bloque-t">Contacto y cobros</h3>
            <div className="fila-dato"><span>Teléfono</span><b>{usuario.telefono || "—"}</b></div>
            <div className="fila-dato"><span>Yape</span>
              {usuario.yape ? <b>{usuario.yape}</b> : <button type="button" className="linkbtn" onClick={() => { setEditando(true); setF({}); }}>Sin configurar · Agregar</button>}
            </div>
            <div className="fila-dato"><span>Plin</span>
              {usuario.plin ? <b>{usuario.plin}</b> : <button type="button" className="linkbtn" onClick={() => { setEditando(true); setF({}); }}>Sin configurar · Agregar</button>}
            </div>
            <p className="hint">Solo los vecinos con sesión ven estos datos.</p>
          </section>

          <div className="acciones-grid">
            <button type="button" className="accion" onClick={() => nav("/actividad")}>
              <Icon name="clipboard" /><b>Mi actividad</b><span>Publicaciones y tratos</span>
            </button>
            <button type="button" className="accion" onClick={() => setPinOpen(true)}>
              <Icon name="lock" /><b>Cambiar PIN</b><span>Seguridad de la cuenta</span>
            </button>
          </div>

          <Btn variant="danger" icon="logout" className="wide salir-btn"
            onClick={async () => { await salir(); toast("Sesión cerrada"); nav("/"); }}>Salir de mi cuenta</Btn>
        </>
      ) : (
        <form className="form-card" onSubmit={guardar}>
          <Field label="Nombre" id="p-nombre"><input id="p-nombre" defaultValue={usuario.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
          <Field label="Teléfono" id="p-tel"><input id="p-tel" inputMode="numeric" maxLength={9} defaultValue={usuario.telefono || ""} onChange={(e) => set("telefono", e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="Sector" id="p-zona">
            <Select id="p-zona" ariaLabel="Sector" value={f.zona ?? usuario.zona} onChange={(v) => set("zona", v)}
              options={zonas.map((z) => ({ value: z.nombre, label: z.nombre }))} />
          </Field>
          <div className="dos">
            <Field label="Yape" id="p-yape"><input id="p-yape" maxLength={9} defaultValue={usuario.yape || ""} onChange={(e) => set("yape", e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Plin" id="p-plin"><input id="p-plin" maxLength={9} defaultValue={usuario.plin || ""} onChange={(e) => set("plin", e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          <p className="hint">Al guardar, tu Yape y Plin se actualizan también en tus publicaciones activas,
            para que nadie pague a un número viejo. Los tratos ya cerrados conservan el original.</p>
          <div className="pubs-actions">
            <Btn onClick={() => setEditando(false)}>Cancelar</Btn>
            <Btn type="submit" variant="primary" icon="check">Guardar</Btn>
          </div>
        </form>
      )}
    </section>
  );
}
