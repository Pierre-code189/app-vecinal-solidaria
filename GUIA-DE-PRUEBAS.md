# Guía de pruebas — Vecinal Solidaria (MVP)

Todo lo necesario para probar la app está aquí; no hace falta abrir otros documentos.

- **URL:** https://vecinal.apioai.online
- **Versión:** 4.9.0
- **Qué es:** PWA de barrio para Piura. Tres secciones: **Economía Local** (servicios y productos), **Favores** (pedir u ofrecer ayuda) y **Emergencias** (qué hacer, a quién llamar y qué recursos hay).
- **Cómo se entra:** teléfono de 9 dígitos + PIN de 6 dígitos. No hay correo ni contraseña.
- **Código SMS:** no hay proveedor contratado; el código aparece en pantalla como «Código de demostración».

## Cuentas para probar

Todas usan PIN **123456**.

| Teléfono | Nombre | Rol | Sector |
|---|---|---|---|
| 999000001 | María Panta | Administradora | Piura Centro |
| 999000002 | Juan Quispe | Vecino | Piura Centro |
| 999000003 | Ana Morales | Vecina | Urb. Miraflores (Castilla) |
| 999000004 | Pedro Chunga | Vecino | Piura Centro |
| 999000005 | Lucía Yarlequé | Vecina | Urb. Santa Isabel |
| 999000006 | Rosa Huamán | Moderadora | Piura Centro |
| 968112233 | Rosa Quiroz | Vecina | Urb. Los Ejidos |

Para probar como **invitado**, abre la URL en una ventana privada: se puede mirar todo, pero no publicar ni contactar.

## Qué probar (12 recorridos)

**1. Entrada y cuenta**
- Abrir sin sesión: debe verse el barrio y un botón **Entrar** arriba a la derecha.
- Entrar con 999000003 / 123456. Debe cargar el sector de la cuenta.
- Cerrar sesión y crear una cuenta nueva con otro teléfono: pide nombre, sector, teléfono, código de 6 dígitos y PIN. El código se rellena solo en 3 segundos.
- Probar PIN equivocado 5 veces: debe bloquear.

**2. Economía Local**
- Los filtros «Todo / Servicios / Productos» deben empezar en «Todo».
- Los chips «Acepta Yape», «Hasta S/ 20» y «Para emergencias» deben cambiar la lista de verdad.
- Ordenar por «Más cercano» y comprobar que las distancias suben.
- Buscar «gasfitero» y luego borrar: la lista vuelve.

**3. Favores**
- Cambiar entre «Todos / Necesito / Ofrezco» y por tipo (préstamo, movilidad, donación).
- Abrir un favor de otro vecino: debe ofrecer «Ofrecer ayuda» y conversación.

**4. Tarjetas**
- Cada tarjeta debe mostrar solo: categoría, título, vistos buenos (o «Nuevo»), distancia, precio y medios de pago. Sin descripción ni autor.

**5. Detalle**
- Abrir un servicio de otro vecino: precio, pago, vistos y (si es producto) cuántas unidades quedan.
- «Ver más» despliega la descripción.
- «Datos para pagar» muestra Yape/Plin con botón copiar.
- El mapa debe abrir **Google Maps** al tocarlo.

**5b. Botones de contacto (67 / 33)**
- Abrir un servicio creado en la app (por ejemplo «Gasfitero 24h»): 67 % «Chat con el vecino» + 33 % «WhatsApp».
- Abrir «Reparación de celulares» o «Clases de reforzamiento» (traídas de Instagram/Facebook): 67 % «Ir a la publicación» + 33 % «WhatsApp», con el aviso «Publicación tomada de…».
- El chat debe abrir la conversación dentro de la app, sin salir a otra aplicación.

**6. Publicar**
- Publicar un **servicio**: tipo, categoría, título, descripción, precio (no acepta letras), pago, sector, fotos.
- Publicar un **producto** con «Disponibles = 1».
- Intentar precios raros: 0, 99999, letras. Debe frenar.
- Subir una foto grande: debe comprimirse y verse.

**7. Cotización y trato (lo importante)**
- Con Ana, pedir cotización a un servicio de Juan.
- Con Juan, responder (puedo / otro precio / no puedo).
- Abrir la conversación y escribir.
- Aceptar, cerrar trato, confirmar como vendedor.
- Cada parte marca el pago; el comprador adjunta **comprobante** (foto). Solo al coincidir queda pagado.
- Cada parte marca cumplimiento; solo al coincidir queda cerrado.
- Recién entonces aparece **Dar visto bueno**.

**8. Stock**
- Publicar producto con «Disponibles = 1» y cerrar un trato: debe quedar en 0 y mostrar **Agotado**, sin permitir otra cotización.

**9. Reportes y moderación**
- Con Ana, reportar una publicación de Pedro («Parece una estafa»). Debe confirmar sin error 422.
- Reportar la misma dos veces: la segunda debe rechazarse.
- Entrar con 999000006 (moderadora) o 999000001 (admin): ver reportes, ocultar o descartar.
- Con 999000001, entrar a **Moderación → Equipo** y cambiar un rol.

**10. Emergencias**
- Ver llamadas (105, 116, 115, 106), estado del tablero y recursos.
- Si tu sector no tiene recursos, debe avisar y mostrar los de otros sectores.
- «Ofrecer un recurso» y «Necesito ayuda»: publicar agua, comida, techo… y verlo en el tablero.
- Filtrar por recurso (Agua, Comida, Bidones…).

**11. Mi actividad**
- Pestañas: Publicaciones, Cotizaciones, Tratos, Favores, Privacidad.
- Editar una publicación (título, precio, sector) y guardar.
- Ver quién consultó tu contacto y ocultar el número.

**12. Accesibilidad y móvil**
- Menú de cuenta: **Letra grande**, **Alto contraste**, **Reducir movimiento**. Deben aplicarse y recordarse.
- En móvil no debe haber scroll horizontal ni texto cortado.
- Teclado: Tab, Enter y Escape deben funcionar en menús y formularios.

## Cómo reportar un fallo

Enviar, por cada fallo:

1. **Qué hice** (pasos numerados, con el teléfono usado).
2. **Qué esperaba** que pasara.
3. **Qué pasó** (texto del error y captura).
4. **Dónde**: sección y si fue móvil o web.
5. **Gravedad**: crítica (no puedo usar la app), alta (función rota), media (molesta), baja (detalle visual).

## Límites conocidos de esta versión

- **SMS real:** el código se muestra en pantalla (modo demostración). Con proveedor, se envía por WhatsApp o SMS.
- **Base de datos:** SQLite. Antes de datos reales se migra a PostgreSQL.
- **Mapa:** mosaicos comunitarios de OpenStreetMap; puede faltar detalle en zonas nuevas.
- **Notificaciones:** hay campana y avisos internos, pero no push al teléfono.
- **Pagos:** se hacen fuera de la app (Yape, Plin, efectivo). La app solo deja evidencia y confirmación.
- **Datos:** 8 sectores de Piura y 31 publicaciones de ejemplo.

## Pruebas automáticas ya existentes

- `python3 scripts/verificar.py https://vecinal.apioai.online` → 105 comprobaciones contra la app viva.
- `.venv/bin/pytest -q` → 11 pruebas de reglas (privacidad, permisos, doble confirmación, stock).
- `node scripts/qa-recorrido.mjs movil 999000003` → desbordes, errores de consola y objetivos táctiles en cada vista (requiere Chromium en el puerto 9335).
