import React, { useEffect, useState } from "react";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { Icon } from "../lib/icons";
import { Btn, Field, Select, Segmented, useToast } from "./ui";

/* Pantalla de entrada obligatoria: sin cuenta no se ve el barrio. */
export default function AuthGate() {
  const { entrar, registrar } = useAuth();
  const { zonas, setZona, usarGPS } = useZona();
  const toast = useToast();
  const [modo, setModo] = useState("entrar");
  const [f, setF] = useState({ zona: "Piura Centro" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const [ubic, setUbic] = useState(() => localStorage.getItem("vecinal-ubicacion") || "pendiente");
  const [ubicCargando, setUbicCargando] = useState(false);

  const detectar = async (silencioso = false) => {
    setUbicCargando(true);
    try {
      const z = await usarGPS();
      if (!z) throw new Error("No pudimos ubicarte en un sector. Elígelo a mano.");
      set("zona", z);
      setUbic("detectado");
      localStorage.setItem("vecinal-ubicacion", "detectado");
      if (!silencioso) toast(`Estás cerca de ${z}`);
    } catch (e) {
      setUbic("manual");
      localStorage.setItem("vecinal-ubicacion", "manual");
      if (!silencioso) toast(e.message, "warn");
    } finally { setUbicCargando(false); }
  };

  /* si el navegador ya tiene permiso concedido, se detecta sin preguntar */
  useEffect(() => {
    if (localStorage.getItem("vecinal-ubicacion")) return;
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: "geolocation" })
      .then((r) => { if (r.state === "granted") detectar(true); })
      .catch(() => {});
  }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      let u;
      if (modo === "entrar") {
        if (!f.email || !f.password) throw new Error("Escribe tu correo y tu contraseña.");
        u = await entrar(f.email.trim().toLowerCase(), f.password);
      } else {
        if ((f.nombre || "").trim().length < 3) throw new Error("Escribe tu nombre y apellido.");
        if (!/^\d{9}$/.test(f.telefono || "")) throw new Error("El teléfono debe tener 9 dígitos.");
        if ((f.password || "").length < 6) throw new Error("La contraseña necesita 6 caracteres o más.");
        if (!f.acepta) throw new Error("Necesitamos que aceptes el aviso de privacidad.");
        u = await registrar({
          nombre: f.nombre.trim(),
          email: f.email.trim().toLowerCase(),
          password: f.password,
          telefono: f.telefono,
          zona: f.zona || "Piura Centro",
          yape: f.yape || "",
          plin: f.plin || "",
          acepta_privacidad: true,
        });
      }
      if (u?.zona) setZona(u.zona, false);
      toast(modo === "entrar" ? `Hola, ${u?.nombre?.split(" ")[0] || "vecino"}` : "Cuenta creada. Ya estás dentro.");
    } catch (err) {
      setError(err.message || "No pudimos entrar. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="entrada">
      <header className="entrada-head">
        <span className="entrada-marca"><Icon name="home" size="1.15em" /> Vecinal Solidaria</span>
        <span className="entrada-ciudad">Piura</span>
      </header>

      <main className="entrada-cuerpo">
        <div className="entrada-intro">
          <h1>El barrio, entre vecinos</h1>
          <p>
            Servicios y productos cerca de ti, favores sin dinero y avisos de emergencia.
            Pedimos una cuenta para que sepas con quién tratas y para que tu número solo lo
            vean vecinos reales.
          </p>
          <p className="entrada-nota">
            <Icon name="lock" /> Nadie sin cuenta puede ver teléfonos, Yape ni ubicaciones.
            Tu sector se muestra solo de forma aproximada.
          </p>
        </div>

        {ubic === "pendiente" ? (
          <div className="ubic-card">
            <span className="ubic-icono"><Icon name="pin" size="1.2em" /></span>
            <div className="ubic-txt">
              <b>¿Usamos tu ubicación?</b>
              <p>Sirve solo para elegir tu sector automáticamente. No mostramos tu dirección a nadie.</p>
            </div>
            <div className="ubic-acciones">
              <Btn variant="primary" icon="pin" disabled={ubicCargando} onClick={() => detectar()}>
                {ubicCargando ? "Buscando…" : "Detectar mi sector"}
              </Btn>
              <Btn onClick={() => { setUbic("manual"); localStorage.setItem("vecinal-ubicacion", "manual"); }}>
                Elegir a mano
              </Btn>
            </div>
          </div>
        ) : ubic === "detectado" ? (
          <p className="ubic-ok"><Icon name="check" /> Sector detectado: <b>{f.zona}</b>
            <button type="button" className="linkbtn" onClick={() => { setUbic("manual"); localStorage.setItem("vecinal-ubicacion", "manual"); }}>
              cambiarlo a mano
            </button>
          </p>
        ) : null}

        <div className="entrada-card">
          <Segmented value={modo} onChange={(v) => { setModo(v); setError(""); }} options={[
            { value: "entrar", label: "Entrar" },
            { value: "registro", label: "Crear cuenta" },
          ]} />

          <form onSubmit={enviar} noValidate>
            {modo === "registro" && (
              <>
                <Field label="Nombre y apellido" id="g-nombre">
                  <input id="g-nombre" autoComplete="name" value={f.nombre || ""} onChange={(e) => set("nombre", e.target.value)} />
                </Field>
                <Field label="Sector donde vives" id="g-zona">
                  <Select id="g-zona" ariaLabel="Sector" value={f.zona} onChange={(v) => set("zona", v)}
                    options={(zonas.length ? zonas : [{ nombre: "Piura Centro" }]).map((z) => ({ value: z.nombre, label: z.nombre }))} />
                </Field>
              </>
            )}

            <Field label="Correo electrónico" id="g-email">
              <input id="g-email" type="email" inputMode="email" autoComplete="email"
                value={f.email || ""} onChange={(e) => set("email", e.target.value)} />
            </Field>

            {modo === "registro" && (
              <Field label="Teléfono (9 dígitos)" id="g-tel" hint="Se usa para coordinar la entrega. No se muestra a desconocidos.">
                <input id="g-tel" inputMode="numeric" maxLength={9} value={f.telefono || ""}
                  onChange={(e) => set("telefono", e.target.value.replace(/\D/g, ""))} />
              </Field>
            )}

            <Field label="Contraseña" id="g-pass" hint={modo === "registro" ? "Mínimo 6 caracteres." : undefined}>
              <div className="passwrap">
                <input id="g-pass" type={verPass ? "text" : "password"}
                  autoComplete={modo === "registro" ? "new-password" : "current-password"}
                  value={f.password || ""} onChange={(e) => set("password", e.target.value)} />
                <button type="button" className="verpass" aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setVerPass(!verPass)}>
                  <Icon name={verPass ? "eyeoff" : "eye"} />
                </button>
              </div>
            </Field>

            {modo === "registro" && (
              <>
                <div className="dos">
                  <Field label="Yape (opcional)" id="g-yape">
                    <input id="g-yape" inputMode="numeric" maxLength={9} value={f.yape || ""}
                      onChange={(e) => set("yape", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                  <Field label="Plin (opcional)" id="g-plin">
                    <input id="g-plin" inputMode="numeric" maxLength={9} value={f.plin || ""}
                      onChange={(e) => set("plin", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                </div>
                <label className="check">
                  <input type="checkbox" checked={Boolean(f.acepta)} onChange={(e) => set("acepta", e.target.checked)} />
                  Acepto el aviso de privacidad (Ley 29733): mis datos se usan solo para coordinar el
                  servicio y puedo pedir que los borren.
                </label>
              </>
            )}

            {error && <p className="error" role="alert">{error}</p>}

            <Btn type="submit" variant="primary" className="wide" disabled={cargando}>
              {cargando ? "Un momento…" : modo === "entrar" ? "Entrar al barrio" : "Crear mi cuenta"}
            </Btn>
          </form>

          {modo === "entrar" && (
            <div className="entrada-pie">
              <button type="button" className="linkbtn" onClick={() => { location.hash = "#/recuperar"; }}>
                Olvidé mi contraseña
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
