# App Vecinal Solidaria

Aplicación web progresiva (PWA) para que un barrio encuentre servicios y
productos cerca, pida favores sin dinero y coordine ayuda en emergencias.

- **Producción:** https://vecinal.apioai.online
- **Repositorio:** https://github.com/Pierre-code189/app-vecinal-solidaria
- **Versión de la API:** 2.0.0
- **Especificación:** `DOCUMENTO-TECNICO-GESTION.md` (documento del proyecto)

## Cómo se levanta

```bash
cd /root/proyectos/app-vecinal
python3 -m venv .venv
env -u PYTHONPATH .venv/bin/pip install -r requirements.txt
env -u PYTHONPATH .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Servicio en el servidor: `systemctl {start,stop,restart,status} vecinal`
(unit `vecinal.service`, escucha en 127.0.0.1:8010; Nginx publica el dominio).

## Verificación

```bash
python3 scripts/verificar.py http://127.0.0.1:8010
```

Recorre 70 comprobaciones (cuenta, privacidad, economía local, movilidad y
menores, visto bueno, reportes, moderación, emergencia, cotizaciones,
intercambios, avaladores, borrado suave, estáticos y PWA) y termina con
`Todo en verde` cuando no hay fallos.

## Cuentas de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Moderador | mod@app.local | mod123 |
| Gasfitero | juan@app.local | gas123 |
| Carpintera | ana@app.local | carp123 |
| Vecino | pedro@app.local | pedro123 |
| Vecina | lucia@app.local | lucia123 |

> En una instalación real se cambian al primer arranque: son datos de demostración.

## Estructura

```
app/
├── db.py            esquema, migraciones aditivas y semilla
├── main.py          API (FastAPI): cuenta, publicaciones, favores, emergencia…
└── static/
    ├── index.html   vistas y formularios (una sola página)
    ├── style.css    diseño responsive (escritorio y móvil 360 px)
    ├── app.js       lógica del cliente, sin dependencias
    ├── sw.js        service worker (shell sin conexión)
    ├── manifest.json, icon-192.svg, icon-512.svg
data/app.db          base SQLite en WAL (se crea sola)
scripts/verificar.py verificación funcional de extremo a extremo
```

## Qué está implementado

**Cuenta y privacidad**
- Registro con nombre, zona de lista cerrada, teléfono de 9 dígitos, correo,
  contraseña y aceptación del aviso de privacidad.
- Login, cierre de sesión con expiración a 7 días, edición de perfil.
- Sin sesión: no se devuelven teléfono, Yape ni coordenadas exactas; la
  ubicación pública se desplaza 300–500 m por publicación.

**Economía Local**
- Lista con pestañas Productos/Servicios/Todo, filtro por categoría y zona,
  búsqueda por texto y paginación de 12 con «Cargar más».
- Orden por cercanía usando la ubicación del navegador (con alternativa por
  zona si se deniega el permiso).
- Detalle con precio opcional (monto, a convenir, intercambio), medios de pago
  (Yape, efectivo, transferencia, Plin, intercambio), acuerdo de pago,
  avaladores (ferretería, bodega, olla, parroquia, comité), recomendaciones
  con comentario y ubicación aproximada.
- Publicación en 3 pasos reales (Tipo → Datos → Confirmar) con validación por
  paso y resumen antes de publicar.

**Economía Solidaria**
- Muro con filtros Todos / Necesito / Ofrezco y los cinco tipos de favor del
  video: préstamo, ayuda temporal, donación, intercambio de habilidades y
  movilidad solidaria.
- Intercambios con estados (`solicitada → aceptada → en_curso → resuelta`),
  quién puede cambiar cada estado y acuerdo de préstamo con garante y fecha.
- Movilidad: bloquea nombres de colegio, direcciones y datos del menor; exige
  franja horaria, punto de encuentro público y confirmación de no cobro.

**Emergencias**
- Tablero con aviso de que no es un canal oficial y los números 105, 116, 115
  y 106 siempre visibles.
- Taxonomía de necesidades de las primeras 72 horas (agua, alimentos, abrigo,
  techo, higiene, salud, balde, herramientas, movilidad, alojamiento, energía).
- Activación solo por el moderador, con motivo, registro y apagado automático
  a las 72 horas.
- Directorio de organizaciones de apoyo y puntos de encuentro.

**Moderación y métricas**
- Reporte en dos pasos, único por vecino, sin poder reportar lo propio.
- Panel del moderador: reportes pendientes, baja con registro en el historial y
  métricas de liquidez (ofertas activas, contactos, cotizaciones respondidas,
  intercambios resueltos, publicaciones de la semana, densidad).

**Plataforma**
- PWA instalable con iconos, service worker y funcionamiento sin conexión
  mostrando lo último guardado con la hora de actualización.
- Cabeceras de seguridad (CSP, nosniff, DENY, Referrer-Policy), límite de
  peticiones en login, registro, publicaciones, cotizaciones, vistos y reportes.
- Idempotencia por `client_id` para no duplicar publicaciones al reintentar.

## Lo que todavía no está

Se deja explícito para no prometer de más:

1. Mapa con calles: hay lista ordenada por distancia y coordenada aproximada,
   no un mapa con mosaicos (decisión del documento: lista primero).
2. Subida de fotos y códigos QR de Yape: la API acepta el campo, la interfaz
   todavía no tiene selector de imagen.
3. Notificaciones: hay avisos en pantalla, no notificaciones push.
4. Recuperación de contraseña por SMS o correo.
5. MySQL/PostgreSQL: se usa SQLite en WAL; migrar es trabajo de producción.
6. Validación del teléfono con código: hoy se marca verificado al registrarse.
7. Mapa de calor y analítica de uso más allá de las métricas del panel.
