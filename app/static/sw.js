self.addEventListener('install',e=>{e.waitUntil(caches.open('v1').then(c=>c.addAll(['./','./style.css','./app.js'])))}});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
