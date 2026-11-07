/* Service worker: shell primero para cargar sin internet, red primero para datos.
   Los datos se guardan en localStorage desde la app; aquí solo se cachea el shell. */
const CACHE = 'vecinal-v3';
const SHELL = ['./', './index.html', './style.css', './app.js', './manifest.json',
  './icon-192.svg', './icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => null))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Datos: red primero, y si falla, lo último cacheado (la app maneja su propio caché).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE + '-api').then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || new Response(
          JSON.stringify({ detail: 'Sin conexión' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ))),
    );
    return;
  }

  // Shell: caché primero, luego red, con respaldo al index para navegación.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
