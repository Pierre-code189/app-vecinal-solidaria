import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Btn, Field, useToast } from "../components/ui";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";

/* Recuperar acceso: teléfono → código de 6 dígitos → PIN nuevo. */
export default function Recuperar() {
  const toast = useToast();
  const nav = useNavigate();
  const { usuario } = useAuth();
  const volver = () => nav(usuario ? "/perfil" : "/");

  const [paso, setPaso] = useState(1);
  const [tel, setTel] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [codigoDemo, setCodigoDemo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const contar = () => {
    setEspera(45);
    clearInterval(timer.current);
    timer.current = setInterval(() => setEspera((s) => {
      if (s <= 1) { clearInterval(timer.current); return 0; }
      return s - 1;
    }), 1000);
  };

  const solicitar = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError("");
    if (!/^\d{9}$/.test(tel)) return setError("Escribe tu teléfono de 9 dígitos.");
    setEnviando(true);
    try {
      const r = await api.post("/api/telefono/solicitar", { telefono: tel, proposito: "pin" }, { queue: false });
      setCodigoDemo(r.codigo_demo || "");
      setPaso(2);
      contar();
      toast("Si el número tiene cuenta, el código ya se generó.");
    } catch (err) { setError(err.message); }
    finally { setEnviando(false); }
  };

  const confirmar = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(codigo)) return setError("El código son 6 dígitos.");
    if (!/^\d{6}$/.test(pin)) return setError("El PIN nuevo debe tener 6 dígitos.");
    try {
      await api.post("/api/pin/confirmar", { telefono: tel, codigo, pin }, { queue: false });
      toast("PIN actualizado. Entra con el nuevo.");
      nav(usuario ? "/perfil" : "/");
    } catch (err) { setError(err.message); }
  };

  return (
    <section className="view on">
      <button type="button" className="volver" onClick={volver}>
        <Icon name="back" /> {usuario ? "Volver a mi perfil" : "Volver a entrar"}
      </button>
      <h1>Recuperar acceso
        <span className="sub">Te enviamos un código al teléfono registrado</span>
      </h1>

      {paso === 1 ? (
        <form className="form-card" onSubmit={solicitar}>
          <Field label="Tu teléfono" id="rc-tel" hint="El mismo con el que te registraste.">
            <input id="rc-tel" type="tel" inputMode="numeric" maxLength={9} value={tel}
              onChange={(e) => setTel(e.target.value.replace(/\D/g, ""))} autoFocus />
          </Field>
          {error && <p className="error">{error}</p>}
          <Btn type="submit" variant="primary" className="wide" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviarme el código"}
          </Btn>
          <p className="hint">Por ahora no hay SMS real: en la demo el código aparece en pantalla.</p>
        </form>
      ) : (
        <form className="form-card" onSubmit={confirmar}>
          {codigoDemo && <div className="codigo-demo"><Icon name="chat" /> Código de demostración: <b>{codigoDemo}</b></div>}
          <Field label="Código de 6 dígitos" id="rc-cod">
            <input id="rc-cod" inputMode="numeric" maxLength={6} value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="PIN nuevo (6 dígitos)" id="rc-pin">
            <input id="rc-pin" type="password" inputMode="numeric" maxLength={6} className="pin" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          </Field>
          {error && <p className="error">{error}</p>}
          <div className="pubs-actions">
            <Btn type="button" onClick={() => setPaso(1)}>Atrás</Btn>
            <Btn type="submit" variant="primary">Cambiar mi PIN</Btn>
          </div>
          {espera > 0
            ? <p className="hint">Puedes pedir otro código en {espera} s.</p>
            : <button type="button" className="linkbtn" onClick={solicitar}>Pedir otro código</button>}
        </form>
      )}
    </section>
  );
}
