# Auditoría técnica de la App Vecinal Solidaria

Fecha: 2026-11-07. Alcance: código v2.0.0 desplegado en
https://vecinal.apioai.online, contrastado con `DOCUMENTO-TECNICO-GESTION.md`.

Método: lectura del código, 70 comprobaciones automatizadas
(`scripts/verificar.py`), pruebas de interfaz en navegador real en escritorio
(780–1180 px) y móvil (360 px), y prueba de los flujos completos como usuario.

---

## 1. Veredicto

| Área | Estado | Comentario |
|---|---|---|
| Cuenta y sesión | Cumple | Registro validado, login, cierre, expiración, perfil editable |
| Privacidad por diseño | Cumple | Sin sesión no hay teléfono, Yape ni coordenadas exactas |
| Economía Local | Cumple | Lista, filtros, búsqueda, paginación, detalle, publicación en 3 pasos |
| Economía Solidaria | Cumple | Muro, cinco tipos, intercambios con estados y acuerdo de préstamo |
| Emergencias | Cumple | Tablero, taxonomía 72 h, activación solo moderador, auto-apagado |
| Moderación y métricas | Cumple | Reportes, baja con historial, indicadores de liquidez |
| Seguridad | Cumple con reservas | Falta verificación de teléfono real y rate-limit distribuido |
| Accesibilidad | Cumple parcial | Etiquetas, contraste, 44 px, foco visible; falta prueba con lector real |
| Sin conexión | Cumple parcial | Shell y datos guardados; sin cola de escritura offline |
| Escalabilidad | No probada | SQLite WAL sirve para el piloto; PostgreSQL antes de crecer |

**Conclusión:** el producto cubre el reto del video y los requisitos del
documento que eran viables en el plazo. Lo que falta está listado como
deuda explícita, no como hueco oculto.

---

## 2. Fallos encontrados y corregidos en esta ronda

| # | Fallo | Severidad | Causa | Estado |
|---|---|---|---|---|
| 1 | La activación de emergencia no persistía: la API respondía `ok` pero el tablero seguía inactivo | Crítica | La tabla `config_emergencia` no tenía la fila `global` en la base nueva y el `UPDATE` afectaba 0 filas | Corregido: la semilla crea la fila y la API la inserta si falta. Verificado activando y desactivando |
| 2 | Al pulsar «Emergencia» aparecía el error «accion: es obligatorio» | Alta | El atributo `data-mod` de la pestaña de moderación colisionaba con el `data-mod` de las acciones de reporte | Corregido: la pestaña usa `data-moderador` |
| 3 | Publicaciones sin GPS quedaban sin ubicación y no entraban en el orden por distancia | Media | `lat`/`lng` opcionales sin valor de respaldo | Corregido: centro de zona como ubicación aproximada (fallback manual del documento) |
| 4 | El teléfono del vecino aparecía en el HTML de la lista sin sesión | Crítica (heredada) | Lista y detalle devolvían la fila completa | Corregido: redacción por sesión; verificado en las 70 pruebas |
| 5 | XSS almacenado en título, descripción, zona, precio, motivo de emergencia y lista del mapa | Crítica (heredada) | Interpolación con `innerHTML` sin escapar | Corregido: `esc()` en el cliente y `clean_txt()` en el servidor. CSP activa |
| 6 | `client_id` repetido entre usuarios rompía la escritura (500) | Alta (heredada) | `UNIQUE` global y comprobación por autor | Corregido: 409 explícito si el identificador es de otro vecino |
| 7 | Los errores de validación salían como `[object Object]` | Media (heredada) | El cliente no traducía la lista de errores de FastAPI | Corregido: mensajes por campo en español |
| 8 | El tutorial prometía micrófono y hora de guardado que no existían | Media (heredada) | Texto escrito antes de implementar la función | Corregido: tutorial honesto y caché con hora de actualización |

---

## 3. Cobertura de la verificación automatizada

`scripts/verificar.py` ejecuta 70 comprobaciones. Resumen por bloque:

- **Salud:** 2 comprobaciones (API y health).
- **Cuenta:** 8 (registro válido, duplicado, inválido, login correcto e
  incorrecto, perfil sin token, perfil con token, edición).
- **Privacidad:** 4 (sin teléfono, sin latitud exacta, con ubicación
  aproximada, con sesión sí hay teléfono).
- **Economía Local:** 9 (tipo, categoría, búsqueda, paginación, paginación
  inválida, publicar, idempotencia, sin sesión, tipo inválido, campos vacíos).
- **Movilidad y menores:** 3 (bloqueo por colegio, permiso con checklist,
  bloqueo sin checklist).
- **Visto bueno:** 5 (auto-recomendación, recomendación ajena, duplicado, sin
  sesión, comentarios listados).
- **Reportes y moderación:** 7 (inexistente, propia, ajena, duplicada, panel
  cerrado, moderador ve y resuelve, métricas).
- **Emergencia:** 8 (aviso, números, taxonomía, vecino bloqueado, moderador
  activa, queda activa, directorio, desactivación).
- **Cotizaciones:** 4.
- **Intercambios:** 3.
- **Avaladores:** 3.
- **Borrado y edición:** 4.
- **Estáticos y PWA:** 6.

Resultado de la última ejecución: **70 de 70 en verde**.

---

## 4. Riesgos que siguen abiertos

1. **Verificación de teléfono solo declarativa.** El registro marca el teléfono
   como verificado sin enviar código. Un vecino con dos números puede crear dos
   cuentas y recomendarse. Mitigación pendiente: código por SMS o WhatsApp.
2. **Reputación sin prueba de transacción.** El visto bueno exige sesión y no
   permite auto-recomendación, pero no exige un intercambio cerrado. El
   documento preveía el paso; queda como siguiente mejora.
3. **Sin cola de escritura sin conexión.** Se ve lo guardado, pero publicar sin
   señal muestra error. La cola idempotente está especificada y no construida.
4. **SQLite de un solo escritor.** Suficiente para el piloto y la demostración;
   con varias decenas de usuarios simultáneos hay que pasar a PostgreSQL.
5. **Sin rate-limit por cuenta.** Existe el límite por IP en memoria; con varios
   procesos o detrás de un proxy hay que llevarlo a almacenamiento compartido.
6. **Backups no automatizados en este servidor.** El documento exige respaldo
   diario con restauración probada; hoy no hay tarea programada.
7. **Sin recuperación de contraseña.** Si un vecino la olvida, no puede volver
   a entrar sin ayuda del moderador.
8. **Contraseñas con SHA-256 sin sal por usuario** (hay columna `salt` creada
   pero no usada). Migrar a Argon2 o bcrypt antes de datos reales.

---

## 5. Accesibilidad revisada

Comprobado en navegador real:

- 0 botones visibles por debajo de 44 px de alto.
- Sin desplazamiento horizontal a 360 px (`scrollWidth` = `innerWidth` = 360).
- Contraste: blanco sobre verde `#0b6e4f` = 6,25:1; texto `#4a5560` sobre
  `#f2f5f7` ≈ 7,4:1; etiquetas y avisos por encima de 4,5:1.
- Todas las entradas de los formularios tienen `<label>` asociado; los iconos
  llevan `aria-label`.
- Foco visible (`outline` de 3 px) en botones, enlaces y campos.
- Región `aria-live` para resultados y avisos; el modal se marca como
  `role="dialog"` con `aria-modal` y se cierra con Escape.
- Enlace «Saltar al contenido» para navegación con teclado.

Pendiente: prueba con lector de pantalla real (TalkBack/VoiceOver) y con una
persona mayor, que el documento exige como criterio de aceptación.

---

## 6. Rendimiento medido

| Recurso | Tamaño | Tiempo |
|---|---|---|
| `index.html` | 17,2 KB | ~10 ms local |
| `style.css` | 8,5 KB | ~4 ms |
| `app.js` | 40,7 KB | ~12 ms |
| `manifest.json` + iconos | 1,5 KB | ~3 ms |
| `GET /api/publicaciones?limit=12` | ~6 KB | 8–20 ms con 10 registros |

Sin dependencias externas, sin fuentes remotas y sin imágenes de mapa: la carga
inicial completa pesa menos de 70 KB. El límite de la API es 300 registros por
consulta con paginación de 12; con 500 publicaciones la lista sigue siendo
una sola consulta indexada.

---

## 7. Próximas mejoras sugeridas (ordenadas por impacto)

1. **Código de verificación de teléfono** al registrarse (WhatsApp o SMS).
2. **Visto bueno ligado a intercambio cerrado** (sube la confianza real).
3. **Cola de escritura sin conexión** con indicador «pendiente de enviar».
4. **Recuperación de contraseña** por código.
5. **Subida de foto y QR de Yape** desde la interfaz (comprimir a 150 KB y
   borrar metadatos antes de subir).
6. **Mapa real** con mosaicos cacheados del barrio, como vista secundaria.
7. **Respaldo diario** con restauración probada y aviso de fallo.
8. **Migración a PostgreSQL** con índices geográficos antes de abrir un
   segundo barrio.
9. **Argon2/bcrypt** para contraseñas y sal por usuario.
10. **Prueba con usuarios reales** del barrio (5 personas, 3 tareas) y ajuste
    del flujo de publicación con lo que se observe.
