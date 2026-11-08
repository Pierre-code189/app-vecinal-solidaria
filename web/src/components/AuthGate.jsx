import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/Auth";
import { useZona } from "../context/Zona";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { Btn, Field, Select, Segmented, useToast } from "./ui";
import CodigoSeis from "./CodigoSeis";

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
  const [pasoReg, setPasoReg] = useState("datos"); // datos | codigo
  const [rellenando, setRellenando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const [ubic, setUbic] = useState(() => localStorage.getItem("vecinal-ubicacion") || "pendiente");
  const [ubicCargando, setUbicCargando] = useState(false);
  const [otroSector, setOtroSector] = useState(false);
  const timer = useRef(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const detectar = async (silencioso = false) => {
    setUbicCargando(true);
    try {
      const z = await usarGPS();
      if (!z) throw new Error("No pudimos ubicarte en un sector. Elígelo a mano.");
      set("zona", z);
      const la = parseFloat(localStorage.getItem("vecinal-lat") || "");
      const ln = parseFloat(localStorage.getItem("vecinal-lng") || "");
      if (!isNaN(la) && !isNaN(ln)) { set("lat", la); set("lng", ln); }
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
      setEspera(45);
      clearInterval(timer.current);
      timer.current = setInterval(() => setEspera((s) => {
        if (s <= 1) { clearInterval(timer.current); return 0; }
        return s - 1;
      }), 1000);
      // En la demo no hay SMS: a los 3 segundos el código se rellena solo.
      if (r.codigo_demo) {
        setRellenando(true);
        setTimeout(() => { set("codigo", r.codigo_demo); setRellenando(false); toast("Código recibido"); }, 3000);
      }
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setEnviando(false); }
  };

  /* Paso 1: datos completos. Al continuar se pide el código y se pasa al paso 2. */
  const continuarRegistro = async () => {
    setError("");
    if ((f.nombre || "").trim().length < 3) return setError("Escribe tu nombre y apellido.");
    if (!/^\d{9}$/.test(f.telefono || "")) return setError("El teléfono debe tener 9 dígitos.");
    if (!/^\d{6}$/.test(f.pin || "")) return setError("El PIN debe tener 6 dígitos.");
    if (!f.acepta) return setError("Necesitamos que aceptes el aviso de privacidad.");
    const ok = await pedirCodigo();
    if (ok) { setPasoReg("codigo"); setCargando(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  /* Paso 2: solo el número y las seis casillas. Aquí recién se crea la cuenta. */
  const crearCuenta = async () => {
    setError("");
    if (!/^\d{6}$/.test(f.codigo || "")) return setError("Escribe el código de 6 dígitos.");
    setCargando(true);
    try {
      const u = await registrarPin({
        nombre: f.nombre.trim(),
        telefono: f.telefono,
        codigo: f.codigo,
        pin: f.pin,
        zona: f.zona || "Piura Centro",
        yape: f.yape || "",
        plin: f.plin || "",
        acepta_privacidad: true,
      });
      if (u?.zona) setZona(u.zona, false);
      toast("Cuenta creada. Ya estás dentro.");
    } catch (err) {
      setError(err.message || "No pudimos crear la cuenta.");
    } finally { setCargando(false); }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (modo === "registro") return continuarRegistro();
    setCargando(true);
    try {
      if (!/^\d{9}$/.test(f.telefono || "")) throw new Error("Escribe tu teléfono de 9 dígitos.");
      if (!/^\d{6}$/.test(f.pin || "")) throw new Error("El PIN son 6 dígitos.");
      const u = await entrarPin(f.telefono, f.pin);
      if (u?.zona) setZona(u.zona, false);
      toast(`Hola, ${u?.nombre?.split(" ")[0] || "vecino"}`);
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

      <main className={`entrada-cuerpo ${modo === "registro" && pasoReg === "codigo" ? "solo-codigo" : ""}`}>
        <div className="entrada-intro">
          <h1>El barrio, entre vecinos</h1>
          <p>
            Servicios y productos cerca de ti, favores sin dinero y avisos de emergencia.
            Entras con tu teléfono y un PIN de 6 dígitos, para que sepas con quién tratas y
            para que tu número solo lo vean vecinos reales.
          </p>
          <ul className="beneficios">
            <li><span className="ben-ico"><Icon name="pin" /></span>
              <div><b>Primero lo de tu sector</b><p>Servicios y productos ordenados por cercanía real.</p></div></li>
            <li><span className="ben-ico"><Icon name="heart" /></span>
              <div><b>Favores sin dinero</b><p>Préstamos, movilidad y ayuda entre vecinos, con garante.</p></div></li>
            <li><span className="ben-ico"><Icon name="alert" /></span>
              <div><b>Emergencias a mano</b><p>105, 116, 115 y 106, y lo que el barrio ofrece.</p></div></li>
          </ul>
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

        <div className="entrada-marca-centro">
          <span className="marca-badge"><Icon name="home" size="1.35em" /></span>
          <b>Vecinal Solidaria</b>
          <small>Piura · el barrio, entre vecinos</small>
        </div>

        <div className="entrada-card">
          {!(modo === "registro" && pasoReg === "codigo") && (
            <Segmented value={modo} onChange={(v) => { setModo(v); setError(""); setCodigoDemo(""); setPasoReg("datos"); }} options={[
              { value: "entrar", label: "Entrar" },
              { value: "registro", label: "Crear cuenta" },
            ]} />
          )}

          {modo === "registro" && pasoReg === "codigo" ? (
            <div className="paso-codigo">
              <button type="button" className="volver" onClick={() => { setPasoReg("datos"); setError(""); }}>
                <Icon name="back" /> Volver a mis datos
              </button>
              <h2 className="codigo-titulo">Confirma tu número</h2>
              <p className="codigo-sub">
                Enviamos un código de 6 dígitos al <b>{f.telefono?.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}</b>.
              </p>

              <CodigoSeis valor={f.codigo || ""} onChange={(v) => set("codigo", v)} autoFocus />

              <p className={`hint codigo-estado ${rellenando ? "esperando" : ""}`}>
                {rellenando
                  ? "Esperando el mensaje…"
                  : codigoDemo
                    ? "En la demo el código se rellena solo a los 3 segundos."
                    : "Escríbelo tal como llegó."}
              </p>

              {codigoDemo && (
                <div className="codigo-demo">
                  <Icon name="chat" /> Código de demostración: <b>{codigoDemo}</b>
                </div>
              )}

              {error && <p className="error" role="alert">{error}</p>}

              <Btn variant="primary" className="wide" icon="check" disabled={cargando || (f.codigo || "").length < 6}
                onClick={crearCuenta}>
                {cargando ? "Creando…" : "Confirmar y crear cuenta"}
              </Btn>

              <div className="entrada-pie">
                {espera > 0
                  ? <span className="hint">Puedes pedir otro código en {espera} s.</span>
                  : <button type="button" className="linkbtn" onClick={pedirCodigo}>Reenviar código</button>}
              </div>
            </div>
          ) : (
          <form onSubmit={enviar} noValidate>
            {modo === "registro" && (
              <>
                <Field label="Nombre y apellido" id="g-nombre">
                  <input id="g-nombre" autoComplete="name" value={f.nombre || ""} onChange={(e) => set("nombre", e.target.value)} />
                </Field>
                <Field label="Sector donde vives" id="g-zona">
                  <Select id="g-zona" ariaLabel="Sector" value={f.zona} onChange={(v) => {
                    if (v === "OTRO") { setOtroSector(true); set("zona", ""); }
                    else { setOtroSector(false); set("zona", v); set("lat", null); set("lng", null); }
                  }}
                    options={[...(zonas.length ? zonas : [{ nombre: "Piura Centro" }]).map((z) => ({ value: z.nombre, label: z.nombre })),
                              { value: "OTRO", label: "Mi sector no está en la lista" }]} />
                </Field>
                {otroSector && (
                  <div className="sector-libre">
                    <Field label="Escribe tu sector" id="g-sector-libre">
                      <input id="g-sector-libre" maxLength={60} value={f.zona || ""}
                        onChange={(e) => set("zona", e.target.value)} placeholder="Ej.: Urb. San Ramón, Piura" />
                    </Field>
                    <Btn size="small" icon="pin" onClick={() => detectar()}>Usar mi ubicación</Btn>
                    <p className="hint">Guardamos el nombre del sector, no tu dirección exacta.</p>
                  </div>
                )}
              </>
            )}

            <Field label="Teléfono (9 dígitos)" id="g-tel"
              hint={modo === "registro" ? "Te enviaremos un código para confirmar que es tuyo." : "El número con el que te registraste."}>
              <input id="g-tel" type="tel" inputMode="numeric" maxLength={9} placeholder="Ej.: 987654321"
                autoComplete="tel" value={f.telefono || ""}
                onChange={(e) => set("telefono", e.target.value.replace(/\D/g, ""))} />
            </Field>

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

            <Btn type="submit" variant="primary" className="wide" disabled={cargando || enviando}>
              {cargando || enviando
                ? "Un momento…"
                : modo === "entrar" ? "Entrar al barrio" : "Continuar"}
            </Btn>
          </form>
          )}

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
