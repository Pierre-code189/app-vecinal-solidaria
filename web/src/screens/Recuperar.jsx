import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Btn, Field, useToast } from "../components/ui";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";

export default function Recuperar() {
  const toast = useToast();
  const nav = useNavigate();
  const { usuario } = useAuth();
  const volver = () => nav(usuario ? "/perfil" : "/");
  const [paso, setPaso] = useState(1);
  const [ident, setIdent] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [demo, setDemo] = useState("");

  const solicitar = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const r = await api.post("/api/password/solicitar", { identificador: ident }, { queue: false });
      setDemo(r.codigo_demo || "");
      setPaso(2);
      toast("Si la cuenta existe, el código ya se generó.");
    } catch (err) { setError(err.message); }
  };

  const confirmar = async (e) => {
    e.preventDefault();
    setError("");
    if (pass.length < 6) return setError("La nueva contraseña necesita 6 caracteres.");
    try {
      await api.post("/api/password/confirmar", { identificador: ident, codigo, password: pass }, { queue: false });
      toast("Contraseña actualizada. Entra con la nueva.");
      nav(usuario ? "/perfil" : "/");
    } catch (err) { setError(err.message); }
  };

  return (
    <section className="view on">
      <button type="button" className="volver" onClick={volver}>
        <Icon name="back" /> {usuario ? "Volver a mi perfil" : "Volver a entrar"}
      </button>
      <h1>Recuperar acceso
        <span className="sub">Te damos un código de 6 dígitos válido por 15 minutos</span>
      </h1>

      {paso === 1 ? (
        <form className="form-card" onSubmit={solicitar}>
          <Field label="Tu correo o teléfono" id="rc-id" hint="El mismo con el que te registraste.">
            <input id="rc-id" value={ident} onChange={(e) => setIdent(e.target.value)} autoFocus />
          </Field>
          {error && <p className="error">{error}</p>}
          <Btn type="submit" variant="primary" className="wide">Enviarme el código</Btn>
          <p className="hint">Por ahora no enviamos WhatsApp real: en la demo el código aparece en pantalla.</p>
        </form>
      ) : (
        <form className="form-card" onSubmit={confirmar}>
          {demo && (
            <p className="hint"><b>Código de demostración:</b> {demo}</p>
          )}
          <Field label="Código de 6 dígitos" id="rc-cod">
            <input id="rc-cod" inputMode="numeric" maxLength={6} value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Nueva contraseña" id="rc-pass">
            <input id="rc-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </Field>
          {error && <p className="error">{error}</p>}
          <div className="pubs-actions">
            <Btn type="button" onClick={() => setPaso(1)}>Atrás</Btn>
            <Btn type="submit" variant="primary">Cambiar contraseña</Btn>
          </div>
        </form>
      )}
    </section>
  );
}
