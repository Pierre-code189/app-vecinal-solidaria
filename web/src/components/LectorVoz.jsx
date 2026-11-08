import { useEffect } from "react";

/* Lectura en voz alta para vecinos con baja visión o lectores de pantalla.
   Se activa desde el menú de accesibilidad y anuncia lo que enfocas o tocas. */
export default function LectorVoz({ activo }) {
  useEffect(() => {
    if (!activo || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const hablar = (texto) => {
      const limpio = String(texto || "").replace(/\s+/g, " ").trim().slice(0, 180);
      if (!limpio) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(limpio);
      u.lang = "es-PE";
      u.rate = 1;
      window.speechSynthesis.speak(u);
    };

    const describir = (el) => {
      const marca = el.getAttribute?.("aria-label");
      if (marca) return marca;
      const alt = el.getAttribute?.("alt");
      if (alt) return alt;
      const titulo = el.querySelector?.("h3, b, strong")?.textContent;
      if (titulo) return titulo;
      return el.innerText || el.textContent || "";
    };

    const alFoco = (e) => {
      const el = e.target.closest?.("a,button,[role=button],article.card,input,select,textarea");
      if (!el) return;
      const sel = el.getAttribute("aria-selected") === "true" ? ", seleccionado" : "";
      hablar(describir(el) + sel);
    };

    const alTocar = (e) => {
      const el = e.target.closest?.("a,button,[role=button],article.card");
      if (!el || el.closest(".chat-form")) return;
      const estado = el.classList.contains("on") ? ", activado" : "";
      hablar(describir(el) + estado);
    };

    document.addEventListener("focusin", alFoco);
    document.addEventListener("click", alTocar);
    return () => {
      document.removeEventListener("focusin", alFoco);
      document.removeEventListener("click", alTocar);
      window.speechSynthesis.cancel();
    };
  }, [activo]);

  return null;
}
