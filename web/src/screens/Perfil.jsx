import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon } from "../lib/icons";
import { Btn, Field, Select, Avatar, useToast, Segmented } from "../components/ui";

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
      await api.put("/api/perfil", {
        nombre: f.nombre ?? usuario.nombre, telefono: f.telefono ?? usuario.telefono,
        zona: f.zona ?? usuario.zona, yape: f.yape ?? usuario.yape, plin: f.plin ?? usuario.plin,
      });
      await recargar();
      toast("Datos guardados"); setEditando(false);
    } catch (err) { toast(err.message, "err"); }
  };

  return (
    <section className="view on">
      <h1>Mi perfil</h1>
      <div className="perfil-card">
        <Avatar nombre={usuario.nombre} cls="grande" />
        <div>
          <b>{usuario.nombre}</b>
          <p className="hint">{usuario.email} · {usuario.zona}</p>
          {usuario.rol === "moderador" && <span className="badge verde"><Icon name="shield" />Moderador</span>}
        </div>
      </div>

      <div className="stats-row">
        <div><b>{usuario.vistos_recibidos ?? 0}</b><span>vistos buenos</span></div>
        <div><b>{usuario.publicaciones ?? 0}</b><span>publicaciones</span></div>
        <div><b>{usuario.tratos_cerrados ?? 0}</b><span>tratos cerrados</span></div>
      </div>

      {!editando ? (
        <>
          <div className="datos">
            <div><span>Teléfono</span><b>{usuario.telefono || "—"}</b></div>
            <div><span>Yape</span><b>{usuario.yape || "—"}</b></div>
            <div><span>Plin</span><b>{usuario.plin || "—"}</b></div>
            <div><span>Sector</span><b>{usuario.zona}</b></div>
          </div>
          <div className="pubs-actions">
            <Btn icon="user" onClick={() => { setEditando(true); setF({}); }}>Editar mis datos</Btn>
            <Btn icon="clipboard" onClick={() => nav("/actividad")}>Mi actividad</Btn>
            <Btn icon="logout" onClick={async () => { await salir(); toast("Sesión cerrada"); nav("/"); }}>Salir</Btn>
          </div>
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
          <p className="hint">Cambiar tu Yape o Plin aquí <b>no</b> reescribe tus publicaciones anteriores: cada una conserva el número con el que se creó.</p>
          <div className="pubs-actions">
            <Btn onClick={() => setEditando(false)}>Cancelar</Btn>
            <Btn type="submit" variant="primary" icon="check">Guardar</Btn>
          </div>
        </form>
      )}
    </section>
  );
}
