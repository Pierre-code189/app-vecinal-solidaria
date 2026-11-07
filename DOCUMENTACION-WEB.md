# App Vecinal Solidaria — Documentación web

## Vista web (escritorio) y vista móvil (responsive)
- Escritorio: cabecera verde, navegación por pestañas, grilla de tarjetas
  (auto-fill, mínimo 300px), máximo 1100px centrado.
- Móvil (≤700px): una columna, botones y campos de mínimo 44px de alto,
  fuente 16px para evitar zoom automático, navegación deslizable.
- Ambas vistas usan el mismo HTML/CSS/JS y la misma API; no hay dos versiones.

## Arquitectura
- Frontend: HTML + CSS + JavaScript vanilla, sin build, en `app/static/`.
- Backend: FastAPI en `app/main.py`, API JSON en `/api/*`.
- Base de datos: SQLite con modo WAL (concurrencia), archivo `data/app.db`.
  Tablas: usuarios, sesiones, publicaciones, vistos, reportes,
  config_emergencia.
- Sin internet: service worker (`sw.js`) cachea la app; la lista muestra
  datos guardados en el navegador con aviso.

## Cómo correr
```
cd /root/app-vecinal-solidaria
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```
Abrir http://127.0.0.1:8010/

## Cuentas de demostración
- Moderador: mod@app.local / mod123
- Gasfitero: juan@app.local / gas123
- Carpintera: ana@app.local / carp123
- Vecino: pedro@app.local / pedro123
- Vecina: lucia@app.local / lucia123

## Flujos implementados
Registro, login, perfil, publicar (3 pantallas: tipo, datos, confirmar),
listar/filtrar por tipo y categoría y buscar por texto, detalle, visto bueno
(1 por persona, sin auto-voto, sin duplicados), reportar, favores
(necesito/ofrezco), emergencia (solo moderador activa, tablero con aviso
105/116/115/106), mapa/lista, tutorial, WhatsApp con texto precargado,
idempotencia por client_id (sin duplicados al reintentar).

## Verificación realizada
- API: salud, login, registro duplicado, publicación idempotente, visto
  bueno duplicado y auto-voto, emergencia 403 para vecino.
- Navegador: vistas Local, Favores, Emergencia y Perfil cargan con datos.
- Fallo corregido: base de datos bloqueada en logins simultáneos
  (modo WAL + timeout 30s).
- Fallos visuales corregidos: distancia en km (antes grados sin sentido),
  botón WhatsApp como principal.
