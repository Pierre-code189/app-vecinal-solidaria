/* Comprime una foto de comprobante antes de subirla (máx. 900 px, JPEG). */
export function comprimirPago(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 900;
      let { width: w, height: h } = img;
      if (w >= h && w > max) { h = Math.round((h * max) / w); w = max; }
      else if (h > w && h > max) { w = Math.round((w * max) / h); h = max; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.62));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No pudimos leer la imagen")); };
    img.src = url;
  });
}
