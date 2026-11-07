# Documentación web — App Vecinal Solidaria v2

## 1. Vistas

| Vista | Contenido |
|---|---|
| Economía Local | Servicios, productos y todo; filtros por categoría y zona, búsqueda, orden por cercanía, paginación |
| Favores | Muro solidario con filtros Todos / Necesito / Ofrezco y tipo de favor |
| Emergencia | Aviso no oficial, números 105/116/115/106, reportes y directorio de apoyo |
| Mis publicaciones | Propias con opción de cerrar o eliminar; cotizaciones recibidas; intercambios |
| Mi perfil | Registro, inicio de sesión, edición de datos y cierre de sesión |
| Tutorial | Cinco pasos en lenguaje simple |
| Moderación | Solo rol moderador: reportes pendientes, métricas y activación de emergencia |

## 2. Escritorio y móvil

Un solo HTML y CSS para las dos vistas; no hay versiones separadas.

- Escritorio: contenido centrado, ancho máximo 1180 px, grilla de tarjetas de
  320 px mínimo, barra superior y pestañas fijas.
- Móvil (hasta 720 px): una columna, campos y botones de 44 px o más, fuente de
  16,5 px, pestañas deslizables con indicador y modales a pantalla casi completa.
- Verificado a 360 px: sin desplazamiento horizontal, sin texto cortado y sin
  botones por debajo del mínimo táctil.

## 3. Conexión entre frontend, backend y base de datos

```
Navegador (app.js)
   │  fetch JSON con Bearer token
   ▼
FastAPI (app/main.py)  ──► app/db.py (esquema, migraciones, semilla)
   │                          │
   ▼                          ▼
data/app.db  (SQLite en modo WAL)
```

- El cliente guarda el token en `localStorage` (`tv_token`) y el perfil en
  `tv_user`; al recargar, la sesión se restaura.
- Todas las llamadas pasan por `api()`, que añade la cabecera `Authorization`
  y traduce los errores de validación a mensajes en español.
- La privacidad se aplica en el servidor: sin token no se devuelven teléfono,
  Yape ni coordenadas exactas. La interfaz no filtra nada por su cuenta.
- Idempotencia: cada publicación lleva `client_id`; si se reintenta, la API
  devuelve el mismo registro en vez de duplicarlo.

## 4. Endpoints

### Cuenta
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/registro` | Crea cuenta (valida zona, teléfono de 9 dígitos, correo y privacidad) |
| POST | `/api/login` | Devuelve token y perfil |
| POST | `/api/logout` | Invalida el token |
| GET | `/api/perfil` | Perfil propio |
| PUT | `/api/perfil` | Edita nombre, zona, descripción, oficios y Yape |
| GET | `/api/mis-publicaciones` | Publicaciones propias con vistos y cotizaciones |

### Economía Local
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/publicaciones` | Lista con `tipo`, `categoria`, `zona`, `q`, `tipo_favor`, `solo_recomendadas`, `lat`, `lng`, `limit`, `offset` |
| GET | `/api/publicaciones/{id}` | Detalle con avaladores, recomendaciones e historial |
| POST | `/api/publicaciones` | Crea publicación (valida tipo, categoría, precio, medios de pago y movilidad) |
| PATCH | `/api/publicaciones/{id}` | Edita o cambia estado (versión optimista) |
| DELETE | `/api/publicaciones/{id}` | Borrado suave con motivo |

### Recomendaciones y reportes
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/vistos` | Recomendar (una vez por vecino, sin auto-recomendación) |
| DELETE | `/api/vistos/{id}` | Retirar recomendación |
| GET | `/api/vistos/{id}` | Recomendaciones con comentario |
| POST | `/api/reportes` | Reportar (no propia, una vez, motivo obligatorio) |
| GET | `/api/moderacion/reportes` | Pendientes (solo moderador) |
| POST | `/api/moderacion/reportes` | Resolver con acción y nota |
| GET | `/api/moderacion/metricas` | Indicadores de liquidez |

### Favores e intercambios
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/intercambios` | Solicitar o aceptar un favor (préstamo exige garante y fecha) |
| GET | `/api/intercambios` | Propios, con nombres de ambas partes |
| POST | `/api/intercambios/{id}/estado` | Cambia estado según reglas por rol |

### Cotizaciones
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/cotizaciones` | Pedir presupuesto (máximo 3 abiertas, vencen en 7 días) |
| GET | `/api/cotizaciones` | Propias enviadas y recibidas |
| POST | `/api/cotizaciones/{id}/responder` | El vendedor responde puede / no puede / precio |

### Emergencia
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/emergencia` | Estado, motivo, reportes, aviso y taxonomía de 72 h |
| POST | `/api/emergencia/activar` | Solo moderador; apagado automático a las 72 h |
| GET | `/api/emergencia/directorio` | Organizaciones de apoyo y puntos de encuentro |

### Avaladores y métricas de contacto
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/avaladores` | Lugares y organizaciones activas |
| POST | `/api/avaladores` | Alta (solo moderador, vence en un año) |
| POST | `/api/publicaciones/{id}/avalador/{id}` | Vincular aval |
| POST | `/api/eventos/contacto` | Registra el clic de contacto para medir liquidez |

### Salud
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/salud` | Estado, versión, contadores y migraciones aplicadas |
| GET | `/health` | Chequeo simple para monitoreo |

## 5. Base de datos

Tablas: `usuarios`, `sesiones`, `publicaciones`, `vistos`, `reportes`,
`config_emergencia`, `intercambios`, `cotizaciones`, `avaladores`,
`publicacion_avalador`, `eventos`, `historial_estado`.

- Migraciones aditivas al arrancar (`app/db.py`): si falta una columna se
  agrega sin perder datos.
- Índices por estado y fecha, por tipo/categoría/zona, por autor, por reportes
  pendientes y por tipo de evento.
- Semilla idempotente: cinco vecinos, diez publicaciones, cinco
  recomendaciones y cuatro avaladores con teléfonos de demostración.

## 6. Puesta en marcha

```bash
cd /root/proyectos/app-vecinal
python3 -m venv .venv
env -u PYTHONPATH .venv/bin/pip install -r requirements.txt
env -u PYTHONPATH .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
python3 scripts/verificar.py http://127.0.0.1:8010
```

Producción: `vecinal.service` (127.0.0.1:8010) detrás de Nginx con el dominio
https://vecinal.apioai.online y certificado de Let's Encrypt.

## 7. Variables de entorno

Ver `.env.example`: `PORT`, `DB_PATH` y `ENV`. No hay secretos en el código.

## 8. Cuentas de prueba

`mod@app.local / mod123` (moderador) · `juan@app.local / gas123` ·
`ana@app.local / carp123` · `pedro@app.local / pedro123` ·
`lucia@app.local / lucia123`.
