# Informe QA — 8 subagentes redundantes (2026-11-07)
## Fallos críticos encontrados por 3+ agentes y corregidos
1. XSS almacenado (crítico, QA1/5/8): título/desc con <script> se ejecutaba. Fix: escape HTML en frontend (esc()) + sanitización en backend (strip tags) + CSP. Verificado: título guardado como "alert(1)" texto inocuo.
2. Teléfono/Yape/GPS exacto sin login (alto, QA5): lista pública exponía PII. Fix: sin auth se redactan telefono/yape/lat/lng. Verificado: lista sin auth = 0 campos sensibles.
3. Credenciales demo en HTML (alto, QA5/6): quitadas de index.html, solo en documentación.
4. Publicación vacía aceptada (alto, QA1/6): validación min_length en backend (título 3, descripción 5, categoría 2, zona 2, teléfono 9 dígitos, contraseña 6). Verificado: vacía = 422.
5. Sin UI para activar emergencia (alto, QA2/8): botón Activar/Desactivar para moderador en vista Emergencia.
6. Reporte huérfano/auto/duplicado (medio, QA4): valida existencia 404, no propia 400, único por usuario.
7. Idempotencia global (medio, QA4): scope por autor (client_id+autor_id).
8. Sin paginación (medio, QA4/7): limit 20 por defecto, máx 50, offset validado.
9. alert/prompt bloqueantes (medio, QA1/2/6/8): reemplazados por toast/banner no bloqueante (window.alert interceptado).
10. sw.js/manifest 404 en QA inicial: ya existían tras el commit posterior; verificado 200/200.
11. Base de datos bloqueada en logins simultáneos (hallado en pruebas propias): WAL + timeout 30s. Verificado: 5 logins simultáneos OK.
12. Distancia sin sentido (~0.000°): ahora en km aproximados. Botón WhatsApp como principal.
## Pendientes conocidos (no bloquean MVP demo)
- Sin endpoint de borrado/edición: IDOR no explotable (405), pero tampoco se puede limpiar datos QA. Sugerido: endpoint DELETE propio.
- Sin paginación por cursor geo (offset actual), sin mapa real (lista por distancia es el respaldo aprobado en el documento).
- Rate-limit y captcha: no implementados (RNF-044 S).
- Tutorial sin micrófono real ni quechua: texto + audio pendiente.
