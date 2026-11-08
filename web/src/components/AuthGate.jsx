import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { Btn, Field, Select, Segmented, useToast } from "./ui";

/* Pantalla de entrada obligatoria: sin cuenta no se ve el barrio.
   Se entra con teléfono + PIN de 6 dígitos; el teléfono se confirma por código. */
export default function AuthGate() {
  const { entrarPin, registrarPin } = useAuth();
  const { zonas, setZona, usarGPS } = useZona();
  const toast = useToast();
  const [modo, setModo] = useState("entrar");
  const [f, setF] = useState({ zona: "Piura Centro" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [verPin, setVerPin] = useState(false);
  const [codigoDemo, setCodigoDemo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const [ubic, setUbic] = useState(() => localStorage.getItem("vecinal-ubicacion") || "pendiente");
  const [ubicCargando, setUbicCargando] = useState(false);
  const timer = useRef(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

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

  useEffect(() => {
    if (localStorage.getItem("vecinal-ubicacion")) return;
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: "geolocation" })
      .then((r) => { if (r.state === "granted") detectar(true); })
      .catch(() => {});
  }, []);

  useEffect(() => () => clearInterval(timer.current), []);

  const pedirCodigo = async () => {
    setError(""); setCodigoDemo("");
    if (!/^\d{9}$/.test(f.telefono || "")) return setError("Escribe tu teléfono de 9 dígitos.");
    setEnviando(true);
    try {
      const r = await api.post("/api/telefono/solicitar",
        { telefono: f.telefono, proposito: "registro" }, { queue: false });
      setCodigoDemo(r.codigo_demo || "");
      toast("Código generado. Vence en 10 minutos.");
      setEspera(45);
      clearInterval(timer.current);
      timer.current = setInterval(() => setEspera((s) => {
        if (s <= 1) { clearInterval(timer.current); return 0; }
        return s - 1;
      }), 1000);
    } catch (e) { setError(e.message); }
    finally { setEnviando(false); }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      let u;
      if (modo === "entrar") {
        if (!/^\d{9}$/.test(f.telefono || "")) throw new Error("Escribe tu teléfono de 9 dígitos.");
        if (!/^\d{6}$/.test(f.pin || "")) throw new Error("El PIN son 6 dígitos.");
        u = await entrarPin(f.telefono, f.pin);
      } else {
        if ((f.nombre || "").trim().length < 3) throw new Error("Escribe tu nombre y apellido.");
        if (!/^\d{9}$/.test(f.telefono || "")) throw new Error("El teléfono debe tener 9 dígitos.");
        if (!/^\d{6}$/.test(f.codigo || "")) throw new Error("Escribe el código de 6 dígitos que te enviamos.");
        if (!/^\d{6}$/.test(f.pin || "")) throw new Error("El PIN debe tener 6 dígitos.");
        if (!f.acepta) throw new Error("Necesitamos que aceptes el aviso de privacidad.");
        u = await registrarPin({
          nombre: f.nombre.trim(),
          telefono: f.telefono,
          codigo: f.codigo,
          pin: f.pin,
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
            Entras con tu teléfono y un PIN de 6 dígitos, para que sepas con quién tratas y
            para que tu número solo lo vean vecinos reales.
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
          <Segmented value={modo} onChange={(v) => { setModo(v); setError(""); setCodigoDemo(""); }} options={[
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

            <Field label="Teléfono (9 dígitos)" id="g-tel"
              hint={modo === "registro" ? "Te enviaremos un código para confirmar que es tuyo." : "El número con el que te registraste."}>
              <div className="telwrap">
                <input id="g-tel" type="tel" inputMode="numeric" maxLength={9} placeholder="Ej.: 987654321"
                  autoComplete="tel" value={f.telefono || ""}
                  onChange={(e) => set("telefono", e.target.value.replace(/\D/g, ""))} />
                {modo === "registro" && (
                  <Btn size="small" onClick={pedirCodigo} disabled={enviando || espera > 0 || (f.telefono || "").length !== 9}>
                    {enviando ? "Enviando…" : espera > 0 ? `Reenviar en ${espera}s` : "Enviar código"}
                  </Btn>
                )}
              </div>
            </Field>

            {modo === "registro" && (
              <>
                <Field label="Código del SMS" id="g-cod"
                  hint="Seis dígitos, válido 10 minutos.">
                  <input id="g-cod" inputMode="numeric" maxLength={6} value={f.codigo || ""}
                    onChange={(e) => set("codigo", e.target.value.replace(/\D/g, ""))} />
                </Field>
                {codigoDemo && <div className="codigo-demo"><Icon name="chat" /> Código de demostración: <b>{codigoDemo}</b></div>}
              </>
            )}

            <Field label="PIN de 6 dígitos" id="g-pin"
              hint={modo === "registro" ? "Con esto entras la próxima vez. No lo compartas." : undefined}>
              <div className="passwrap">
                <input id="g-pin" type={verPin ? "text" : "password"} inputMode="numeric" maxLength={6}
                  autoComplete={modo === "registro" ? "new-password" : "current-password"}
                  className="pin" value={f.pin || ""}
                  onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} />
                <button type="button" className="verpass" aria-label={verPin ? "Ocultar PIN" : "Mostrar PIN"}
                  onClick={() => setVerPin(!verPin)}>
                  <Icon name={verPin ? "eyeoff" : "eye"} />
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
                Olvidé mi PIN
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
