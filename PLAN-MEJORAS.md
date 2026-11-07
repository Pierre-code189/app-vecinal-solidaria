# Plan de mejoras — de demo funcional a aplicación operativa

Fecha: 2026-11-07. Base: versión desplegada v2.0.0 (`/root/proyectos/app-vecinal`,
https://vecinal.apioai.online) y análisis del paquete «Edición Piura v2.0».

---

## 0. Punto de partida (lo que hay, verificado)

| Dimensión | Estado real |
|---|---|
| Funciona en producción | Sí: 70 comprobaciones automatizadas en verde, HTTPS, servicio con reinicio automático |
| Datos de demostración | 5 vecinos, 10 publicaciones, 4 avaladores, 5 recomendaciones |
| Cobertura del reto | Economía Local, favores, emergencia, tutorial, moderación básica |
| Localización | **Genérica**: «Zona Centro/Norte/Sur/Este/Oeste» con coordenadas de Lima |
| Pagos | Se declaran medios de pago, pero **el comprador nunca ve el número de Yape** |
| Reputación | Visto bueno suelto, no ligado a una transacción cerrada |
| Notificaciones | Ninguna: nadie se entera de que le respondieron |

---

## 1. Deficiencias encontradas

### 1.1 Funciones que faltan (huecos de producto)

| # | Hueco | Evidencia | Consecuencia para el vecino |
|---|---|---|---|
| F1 | **Zonas inventadas con coordenadas de Lima** | `app/main.py:46-54`: «Zona Centro» → -12.0464, -77.0428 | La distancia que se muestra a un vecino de Piura es falsa; la promesa central del reto («cerca, sin transporte») no se cumple |
| F2 | **El comprador no ve el número de Yape** | `app/static/app.js:91` solo muestra la etiqueta «Yape» como medio; el número nunca se imprime | Tiene que preguntarlo por WhatsApp; el flujo de pago se alarga y se pierde la venta |
| F3 | **Sin notificaciones ni avisos internos** | `grep notificacion` = 0 | Un favor solicitado o una cotización respondida quedan esperando para siempre |
| F4 | **Sin recuperación de contraseña** | `grep recuperar/olvid` = 0 | El vecino que olvida la clave queda fuera y depende de soporte manual |
| F5 | **Sin fotos** | `grep FileReader` = 0, no hay campo de imagen | Un gasfitero no puede mostrar su trabajo; un producto no se ve |
| F6 | **Sin mapa** | `grep mapa/leaflet` = 0 | Solo lista; en emergencia no se ve dónde está la necesidad |
| F7 | **Sin funcionamiento sin conexión real** | Hay caché de lectura, no cola de escritura | Publicar sin señal falla; en emergencia es justo cuando no hay red |
| F8 | **Sin voz ni quechua** | `grep quechua` = 0 | Excluye a quien no lee bien o habla quechua, y el reto pide «cualquier vecino» |
| F9 | **Sin onboarding asistido** | No hay modo «ayúdame» | El adulto mayor no puede publicar solo, y son casi la mitad de los vecinos |
| F10 | **Sin perfil público del oficio** | El perfil no se puede ver desde una publicación | No se puede evaluar al vecino antes de contratarlo |

### 1.2 Lógica incompleta (reglas que no cierran el ciclo)

| # | Hueco | Evidencia | Consecuencia |
|---|---|---|---|
| L1 | **El visto bueno no exige haber usado el servicio** | RF-016 permite recomendar cualquier publicación activa | La reputación se puede inflar entre amigos; el «aval vecinal» pierde valor |
| L2 | **El intercambio no desemboca en recomendación** | `POST /api/intercambios/{id}/estado` cierra, pero no habilita ni sugiere el visto bueno | Se cierra el favor y no queda memoria de que salió bien |
| L3 | **Las cotizaciones vencen pero no avisan ni cierran** | `expira` se guarda, nunca se evalúa al leer | El vendedor ve cotizaciones muertas como si estuvieran abiertas |
| L4 | **Las publicaciones vencen a 30 días sin aviso** | `expira_en` filtra en la consulta, pero no cambia de estado | El autor cree que sigue publicado; desaparece sin explicación |
| L5 | **Moderador único, sin suplente ni SLA** | `usuarios.rol` con un solo registro moderador | Si no está, los reportes se acumulan y la emergencia no se puede activar |
| L6 | **La emergencia no tiene caducidad revisada al leer** | Se apaga en la consulta (`expira`), pero nadie deja constancia del cierre | El historial queda sin motivo de cierre |
| L7 | **«Recurso crítico» no se aplica a la taxonomía** | Se marca `es_emergencia`, pero no se elige necesidad de las 72 h | El tablero no se puede filtrar por «agua» o «abrigo» |
| L8 | **Sin estado «en disputa» para pagos** | El documento lo pide; el código no lo tiene | Un pago fallido no tiene dónde registrarse |

### 1.3 Uso y accesibilidad (fricción real)

| # | Hueco | Evidencia | Consecuencia |
|---|---|---|---|
| U1 | **Navegación móvil arriba con desplazamiento horizontal** | 7 pestañas en una fila deslizable | En el pulgar, la mitad de las secciones quedan fuera de alcance |
| U2 | **Publicar pide categoría en lista larga** | 11 opciones en un `select` | Duda y abandono; el ZIP usa pastillas por categoría |
| U3 | **Sin borrador**: si se cierra el modal, se pierde lo escrito | El formulario se resetea | El vecino que se distrae empieza de nuevo |
| U4 | **Errores solo arriba del paso** | `err-paso2` es un párrafo | No se resalta el campo culpable |
| U5 | **Sin confirmación visual de «pendiente de enviar»** | No hay cola | El vecino no sabe si su publicación salió |
| U6 | **Sin contador de caracteres** | — | Se corta el texto sin avisar |

### 1.4 Datos, privacidad y seguridad

| # | Hueco | Evidencia | Consecuencia |
|---|---|---|---|
| S1 | **Contraseñas SHA-256 sin sal** | `hash_pw` directo; la columna `salt` existe vacía | Con la base robada, las claves caen por diccionario |
| S2 | **Teléfono visible con solo iniciar sesión** | `serializar_publicacion` devuelve `telefono` a cualquier sesión | Un curioso crea cuenta y cosecha teléfonos del barrio |
| S3 | **Sin consentimiento por publicación** | No hay casilla «mostrar mi número» | El vecino no elige qué comparte |
| S4 | **Sin límite de intentos por cuenta** | Solo por IP | Ataque distribuido de fuerza bruta |
| S5 | **Sin registro de accesos a datos personales** | No existe tabla de auditoría de contacto | No se puede investigar un abuso |
| S6 | **Sin respaldo automático** | `RNF-061` lo pide; no hay tarea programada | Un borrado accidental pierde el barrio entero |
| S7 | **Sin monitoreo**: si el servicio cae, nadie se entera | No hay chequeo externo | La app puede estar caída horas |

### 1.5 Operación (lo que impide llamarlo «operativa»)

| # | Hueco | Consecuencia |
|---|---|---|
| O1 | **Sin métricas de resultado en pantalla para el moderador** (sí existen, pero son técnicas) | No se puede decidir si el barrio funciona |
| O2 | **Sin modo mantenimiento ni aviso de versión** | Los cambios se despliegan sin avisar |
| O3 | **Sin semilla de liquidez real**: 10 publicaciones no sostienen un barrio | Al abrir, el directorio se ve vacío |
| O4 | **Sin protocolo de apertura** (cuántas ofertas antes de invitar) | Se abre antes de tiempo y muere por vacío |

---

## 2. Qué significa «operativa» (criterio que voy a usar)

Una aplicación es operativa cuando una persona que no la conoce puede, **sin
ayuda y sin que nadie intervenga**:

1. Encontrar un servicio a menos de 2 km de su casa y ver quién lo ofrece.
2. Saber a quién le paga y con qué número, sin preguntar.
3. Contratar, pagar y cerrar la operación.
4. Dejar una recomendación que solo pueda dar quien realmente usó el servicio.
5. Ser avisado cuando le responden.
6. Volver a usarla la semana siguiente.
7. Y si algo falla (olvidó la clave, no tiene señal, hay una emergencia),
   obtener una salida sin llamar a nadie.

Hoy cumple 1 a medias, 3 sin pago claro, 4 no, 5 no, 6 no y 7 no.

---

## 3. Plan de mejora en 6 fases

Cada fase es desplegable por sí sola y verificable con `scripts/verificar.py`.

### Fase 1 — Localización real y pago en un toque *(la que desbloquea el uso diario)*
- Cambiar las 5 zonas genéricas por **8 sectores reales de Piura** con sus
  coordenadas (Piura Centro, Miraflores-Castilla, Santa Isabel, Ignacio Merino,
  Veintiséis de Octubre, Los Ejidos, El Chipe, Catacaos).
- **Yape y Plin en el perfil**, heredados por la publicación al crearla
  (número congelado en la publicación, no reescrito si cambia después).
- **Botón «Pagar con Yape»** que copia el número y otro que abre Yape/Plin si
  el teléfono lo permite; el número visible solo con sesión y solo si el autor
  lo autorizó.
- Selector de ubicación por sector (opcional, no bloqueante) y GPS cuando se
  concede.
- **Aceptación:** una publicación de Piura Centro muestra «a 0,4 km» con
  coordenadas reales; el comprador ve el número de Yape y lo copia en un toque.

### Fase 2 — Ciclo cerrado: cotización → trato → cierre → recomendación
- La cotización respondida habilita el botón «cerrar trato».
- Al cerrarse el trato (estado `resuelta`), se habilita **una sola vez** el
  visto bueno al comprador, con comentario.
- El perfil de cada vecino muestra su historial: servicios cerrados,
  recomendaciones recibidas, años en el barrio.
- Vencimientos reales: cotización a 7 días y publicación a 30 días pasan a
  estado `expirada`/`vencida` con aviso al autor.
- **Aceptación:** no se puede recomendar sin trato cerrado; al cerrar, el
  contador sube; la publicación vencida sale del directorio y avisa al autor.

### Fase 3 — Avisos y continuidad
- **Avisos internos** (campana con contador): cotización recibida o respondida,
  favor solicitado o aceptado, trato cerrado, reporte resuelto, emergencia
  activada en tu zona.
- **Recordatorio de cierre**: a los 3 días de un trato aceptado, pregunta
  «¿se concretó?».
- **Recuperación de contraseña** con código de 6 dígitos al teléfono
  registrado (visible en el servidor, sin costo de SMS: código mostrado al
  moderador en la demo y enviado por WhatsApp cuando haya proveedor).
- **Borrador de publicación** guardado en el teléfono.
- **Aceptación:** pedir una cotización genera aviso en la campana del vendedor;
  cerrar sesión y volver a entrar conserva el borrador; se recupera la clave
  con código.

### Fase 4 — Confianza verificable y privacidad por publicación
- **Consentimiento por publicación**: casilla «mostrar mi número a vecinos con
  sesión» y «mostrar ubicación aproximada». Por defecto, número oculto y
  ubicación aproximada a 400 m.
- **Contraseñas con sal por usuario** (Argon2 o PBKDF2 del estándar, sin
  dependencias nuevas).
- **Límite de intentos por cuenta** además de por IP.
- **Registro de accesos**: cada vez que alguien revela un contacto queda
  anotado (quién, cuándo, qué publicación) y el vecino puede verlo.
- **Moderador suplente** con el mismo rol y registro de acciones.
- **Aceptación:** sin consentimiento el número no sale ni con sesión; el
  intento 6 de login en 10 minutos se bloquea; el vecino ve «tu número se
  consultó 3 veces esta semana».

### Fase 5 — Fotos, mapa y sin conexión
- **Fotos**: subida desde el teléfono, comprimida a 150 KB, sin datos de
  ubicación (EXIF borrado), máximo 3 por publicación.
- **Mapa** con mosaicos de OpenStreetMap en la vista de detalle y en el
  tablero de emergencia, con degradado a lista si no hay red.
- **Cola sin conexión**: publicar y reportar sin señal queda «pendiente de
  enviar» con reintento idempotente y confirmación visible.
- **Aceptación:** una foto de 5 MB queda en 150 KB sin GPS; en modo avión se
  publica un favor y aparece una sola vez al volver la señal; el mapa cae a
  lista sin quedar en blanco.

### Fase 6 — Operación del barrio
- **Tablero de indicadores** para el moderador en lenguaje simple: ofertas
  activas, pedidos que recibieron respuesta, tiempo medio de respuesta,
  tratos cerrados por semana, vecinos que repiten.
- **Semilla de liquidez**: 30 ofertas verificadas por teléfono antes de abrir,
  con guion de llamada y hoja de registro.
- **Respaldo diario** con restauración probada y aviso si falla.
- **Monitoreo externo** cada 5 minutos con alerta al correo si el sitio cae.
- **Protocolo de apertura y cierre**: criterios para abrir un segundo sector
  y para archivar con orden si no hay tracción.
- **Aceptación:** el panel muestra los cinco números; el respaldo se restaura
  en menos de 10 minutos; una caída genera alerta.

### Lo que NO entra en este plan
Pagos dentro de la app con custodia de dinero, chat interno, aplicación nativa
de tiendas, integración con INDECI, verificación de identidad con DNI,
multiidioma completo (solo el tutorial en quechua de la Fase 6b si hay tiempo).

---

## 4. Matriz: deficiencia → cambio → efecto

| Deficiencia | Cambio | Efecto operativo |
|---|---|---|
| F1 zonas falsas | Sectores reales de Piura | La distancia deja de ser decorativa: sirve para decidir |
| F2 número oculto | Yape/Plin heredados + copiar en 1 toque | Se cierra la venta sin salir de la app a preguntar |
| F3 sin avisos | Campana con contador | Las respuestas no se pierden; el ciclo avanza solo |
| F4 sin recuperación | Código al teléfono | El vecino vuelve sin soporte humano |
| F5 sin fotos | Fotos comprimidas y sin GPS | El servicio se puede mostrar; sube la confianza |
| F6 sin mapa | Mapa con degradado | En emergencia se ve el «dónde», no solo el «qué» |
| F7 sin escritura offline | Cola idempotente | Funciona cuando más se necesita: sin señal |
| F8 sin voz/quechua | Tutorial oral en quechua | Incluye al vecino que no lee |
| F9 sin asistencia | Modo «ayúdame» | El adulto mayor publica con su familia |
| L1 reputación inflable | Visto bueno solo tras trato cerrado | La recomendación vuelve a significar algo |
| L2 ciclo abierto | Cierre → recomendación | Queda memoria del servicio prestado |
| L3/L4 vencimientos silenciosos | Estados y avisos | Nada «desaparece» sin explicación |
| L5 moderador único | Suplente + registro | La moderación no depende de una persona |
| S1 claves débiles | Sal por usuario + Argon2/PBKDF2 | Una filtración no entrega las claves |
| S2 teléfono regalado | Consentimiento por publicación | El vecino decide qué comparte |
| S3 sin consentimiento | Casillas explícitas | Cumple lo que promete el aviso de privacidad |
| S6/S7 sin respaldo ni monitoreo | Respaldo diario + alerta | La app deja de ser un experimento |
| O1 sin indicadores | Panel de 5 números | Se puede decidir con datos, no con impresiones |
| O3/O4 abrir vacío | Semilla de 30 ofertas + protocolo | El barrio no se ve desierto el primer día |
| U1 nav inalcanzable | Barra inferior móvil | Se usa con el pulgar, como el resto de apps |
| U2 categoría en lista larga | Pastillas de categoría | Publicar deja de ser un examen |
| U3 sin borrador | Borrador local | Se puede interrumpir sin perder |

---

## 5. Por qué con estos cambios la aplicación pasa a ser operativa

La operatividad no la da tener más funciones: la da **cerrar el ciclo completo
y quitar las dependencias humanas**.

1. **Cierra el ciclo económico.** Hoy el vecino ve el servicio, escribe por
   WhatsApp y ahí termina todo: la app no sabe si se contrató, ni cuánto se
   pagó, ni si salió bien. Con F1 (número visible) y F2 (cotización → trato →
   cierre → recomendación) la app pasa a tener **principio, medio y fin**
   dentro de sí misma. Sin ese ciclo, cualquier métrica es ficción y cualquier
   reputación es un adorno.

2. **Vuelve medible lo que antes era una impresión.** Con el cierre de tratos y
   la campana de avisos, el panel de F6 puede responder la única pregunta que
   importa: *¿cuántas veces se usó esto esta semana y cuántos vecinos
   repitieron?* Hoy no se puede contestar. Una app que no se puede medir no se
   puede operar, solo se puede presentar.

3. **Elimina la dependencia de una persona.** Hoy la emergencia depende de un
   moderador único, la recuperación de clave depende del soporte, y la apertura
   del barrio depende de que alguien cargue datos a mano. Con suplente,
   recuperación por código y semilla verificada, la app sigue funcionando si esa
   persona falta. Ese es el umbral entre demo y servicio.

4. **Restituye la confianza como consecuencia, no como promesa.** El visto
   bueno suelto se puede inflar; el que exige trato cerrado, consentimiento y
   registro de accesos ya no. Y cuando el vecino sabe que su número no se
   publica sin su permiso, sube la disposición a usarla. La confianza es el
   activo del reto, y hoy está en el texto, no en el código.

5. **Funciona en las condiciones reales del barrio.** Piura con lluvia, señal
   intermitente, teléfono de gama baja, adulto mayor que no instala nada y
   vecino que habla quechua. F1 (zonas reales), F5 (offline, fotos, mapa
   degradado) y F8/F9 (voz y ayuda) están elegidas por esas condiciones, no por
   lucimiento.

6. **Se puede sostener sin héroes.** Respaldo diario, alerta de caída y
   protocolo de apertura/archivo hacen que el servicio sobreviva a un olvido, a
   un disco lleno o a la falta de tracción. El 65 % de los proyectos de
   hackatón muere por esto, no por falta de funciones.

En una frase: **pasa de «se puede demostrar» a «se puede usar un martes
cualquiera sin que nadie del equipo esté mirando».**

---

## 6. Orden de ejecución propuesto

| Orden | Fase | Esfuerzo | Se nota en el uso |
|---|---|---|---|
| 1 | Fase 1 — Piura real + Yape/Plin | 4–6 h | Inmediato: es lo primero que ve el vecino |
| 2 | Fase 2 — ciclo cerrado | 6–8 h | Alto: cambia el significado del visto bueno |
| 3 | Fase 3 — avisos y recuperación | 5–7 h | Alto: la app «responde» |
| 4 | Fase 4 — confianza y privacidad | 5–6 h | Medio-alto: sin esto no se abren datos reales |
| 5 | Fase 5 — fotos, mapa, offline | 8–10 h | Medio: mejora percepción y emergencia |
| 6 | Fase 6 — operación del barrio | 6–8 h | Decisivo al día 49 |

Total estimado: 34–45 horas de trabajo, entregable por fases independientes.
Cada fase termina con `scripts/verificar.py` ampliado y desplegada en
https://vecinal.apioai.online.
