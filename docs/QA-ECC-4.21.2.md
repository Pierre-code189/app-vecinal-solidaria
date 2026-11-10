# ECC aplicado a App Vecinal — informe de verificación

Fecha: 2026-11-09 · Versión desplegada: **4.21.2** · Entorno: producción (`vecinal.apioai.online`)

## Qué se hizo

Se aplicó el sistema ECC (skills instalados para Hermes) al repositorio real, no a un
proyecto de demostración. ECC no instala calidad por sí solo: aportó el **método** —
lint/análisis estático, ciclo TDD (test RED antes del arreglo), y verificación en seis
fases contra el entorno real.

Herramientas añadidas al venv de desarrollo (no a producción):

- `ruff` (análisis estático) y `pytest-cov` (cobertura), declarados en `requirements-dev.txt`.
- `tests/test_ecc_regresiones.py`: 3 pruebas nuevas que fijan los defectos encontrados.

## Hallazgos

`ruff check app tests` reportó **98 avisos**. Clasificados:

| Regla | Nº | Veredicto |
|---|---|---|
| UP045 (Optional[X] → X \| None) | 74 | Estilo. No se toca: churn masivo sin cambio de comportamiento |
| ISC004 (concatenación implícita en colecciones) | 11 | **Falso positivo**: textos de `SEED_PUBS` partidos a propósito en varias líneas |
| BLE001 (except ciego) | 4 | Deliberado: degradación ante fallos de BD/JSON, documentado en el código |
| **F601** (clave de diccionario repetida) | 1 | **Defecto real → corregido** |
| **F841** (variable asignada y no usada) | 1 | **Defecto real → corregido** |
| **F811** (import duplicado) | 1 | **Defecto real → corregido** |
| SIM102, PERF102, PLR0402, RUF100, I001 | 5 | Cosmético, sin efecto observable |

### Defecto 1 — `MIGRATIONS["tratos"]` declarado dos veces (F601)

`app/db.py` definía la clave `"tratos"` en dos entradas del diccionario `MIGRATIONS`.
En un literal de diccionario la **segunda entrada pisa a la primera**: las columnas
`pago_comprador`, `pago_vendedor`, `confirmado` y `cotizacion_id` nunca se migraban.

No se manifiesta hoy porque la base de producción ya las tiene (18 columnas verificadas),
pero cualquier base creada o restaurada solo con el esquema base quedaba sin ellas y el
primer `SELECT` con `pago_comprador` habría dado 500 — exactamente el patrón que ya
documenta el skill del proyecto. Ambas entradas se fusionaron en una sola.

### Defecto 2 — La notificación de respuesta no dice de qué publicación se trata (F841)

`app/main.py` consultaba `titulo_pub` y no lo usaba: la notificación decía
«Respondieron tu cotización — Lucía: puedo (18)» sin nombrar la publicación, así que un
vecino con varias cotizaciones abiertas no sabía a cuál respondían. Ahora el cuerpo
incluye «Título de la publicación» antes del autor y la respuesta.

### Defecto 3 — `uuid` importado dos veces en `app/db.py` (F811)

Sin efecto en ejecución; eliminado el duplicado.

## Evidencia

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas unitarias | `.venv/bin/pytest -q` | **14 passed** (11 existentes + 3 nuevas) |
| RED antes del arreglo | `.venv/bin/pytest -q tests/test_ecc_regresiones.py` | 3 fallos con el motivo correcto |
| Cobertura | `pytest --cov=app` | **44 %** total · `db.py` **95 %** · `main.py` **42 %** |
| Análisis estático | `ruff check app tests --select F601,F811,F841` | *All checks passed* |
| Despliegue | `systemctl restart vecinal` + `/api/salud` | `version: 4.21.2`, migraciones `[]` |
| Verificación del proyecto | `scripts/verificar.py https://vecinal.apioai.online` | **PASARON: 105 · FALLARON: 0** |
| Limpieza | `scripts/limpiar_pruebas.py` | 33 cuentas de prueba eliminadas, 9 publicaciones ocultas |

Tras la limpieza quedan 37 publicaciones activas y 9 usuarios (7 cuentas demo, la cuenta
de Pierre y una cuenta «abcd» previa).

## Límites reconocidos

- **Cobertura real del 44 %.** Los 14 tests cubren reglas de negocio y migraciones, no los
  61 endpoints. Subirla exige pruebas de integración por flujo (tratos, moderación,
  scraping), trabajo de días, no de una pasada.
- **Sin verificación de tipos.** `pyright` no está instalado y el código usa `sqlite3.Row`
  sin anotaciones; añadirlo hoy produciría cientos de avisos y no guiaría ningún arreglo.
- **Sin CI.** Nada obliga a correr las pruebas antes de un push: se ejecutan a mano.
- **Los 74 UP045 quedan sin tocar** a propósito: son ruido de estilo, y un `--fix` masivo
  sobre 2 400 líneas de producción sin pruebas de cobertura suficiente es riesgo sin retorno.
