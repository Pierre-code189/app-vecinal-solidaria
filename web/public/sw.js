/* Service worker de la app React.
   Navegación: red primero, con la copia guardada si no hay señal.
   Archivos con hash: caché primero (nunca cambian).
   Mosaicos del mapa: se guardan para que el mapa siga visible sin datos. */
const CACHE = "vecinal-react-v1";
const TILES = "vecinal-react-mosaicos";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(["./", "./manifest.json", "./icon-192.svg", "./icon-512.svg"]).catch(() => null))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname.endsWith("tile.openstreetmap.fr") || url.hostname.endsWith("arcgisonline.com")) {
    event.respondWith(
      caches.open(TILES).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit)),
      ),
    );
    return;
  }

  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copia));
          return res;
        })
        .catch(() => caches.match("./").then((hit) => hit || caches.match("./index.html"))),
    );
    return;
  }

  if (url.pathname.includes("/assets/") || /\.(css|js|svg|png|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
          return res;
        }),
      ),
    );
  }
});
