/* Abre el selector de publicación desde cualquier pantalla.
   Shell escucha el evento y muestra la hoja con los tres formularios. */
export function abrirPublicar(tipo = "") {
  window.dispatchEvent(new CustomEvent("vecinal:publicar", { detail: tipo }));
}
