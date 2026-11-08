# Mejoras aplicadas — versión 3.0

Fecha: 7 de noviembre de 2026. Desplegado en https://vecinal.apioai.online
Verificación automatizada: **103 de 103 comprobaciones en verde**.

Este documento cuenta qué cambió en cada fase, con qué se comprobó y qué
queda pendiente. No reemplaza al `PLAN-MEJORAS.md` (el diagnóstico): lo cierra.

---

## Resumen en una tabla

| Fase | Qué se hizo | Cómo se comprobó |
|---|---|---|
| 1. Piura real y pagos | 8 sectores con coordenadas verdaderas; Yape y Plin del perfil copiados a cada publicación; botón de copiar y WhatsApp | Publicación de Piura Centro mostró «a 300 m» real; el número de Yape aparece para otro vecino con sesión |
| 2. Ciclo cerrado | Trato con doble confirmación; visto bueno solo con trato cerrado; vencimientos que avisan | Sin trato el visto bueno devuelve 400; con doble marca se cierra y entonces sí se puede recomendar |
| 3. Avisos y continuidad | Campana con contador, avisos por cotización/trato/favor/vencimiento, recuperación de clave por código, borrador de publicación | Cotización real de Juan generó aviso «Te pidieron una cotización» en la campana de Rosa; código de 6 dígitos cambió la clave |
| 4. Confianza y privacidad | Consentimiento por publicación, contraseñas con sal, bloqueo por cuenta, registro de consultas al contacto, moderador suplente | Contacto oculto no sale ni con sesión; 5 fallos bloquean 15 minutos; el autor ve quién consultó |
| 5. Fotos, mapa y sin conexión | Fotos comprimidas sin GPS, mapa con OpenStreetMap, cola de envío sin señal | Foto subida y servida; 9 mosaicos de mapa con calles; publicación en modo avión quedó en cola y llegó sola al volver la red |
| 6. Operación | 30 ofertas semilla en 8 sectores, respaldo diario verificado, vigilancia cada 5 minutos, panel de 6 indicadores | Respaldo restaurado con 30 publicaciones; panel mostró ofertas, tratos cerrados, favores, vecinos y reportes |

---

## Fase 1 — Localización real y pago en un toque

**Antes:** «Zona Centro / Norte / Sur / Este / Oeste» con coordenadas de Lima
(−12.04, −77.04). La distancia que veía un vecino de Piura era falsa.

**Ahora:** ocho sectores con coordenadas verdaderas del distrito:

| Sector | Latitud | Longitud |
|---|---|---|
| Piura Centro | −5,19449 | −80,63282 |
| Urb. Miraflores (Castilla) | −5,18520 | −80,62140 |
| Urb. Santa Isabel | −5,18680 | −80,63650 |
| Urb. Ignacio Merino | −5,17850 | −80,64210 |
| Veintiséis de Octubre | −5,19830 | −80,66120 |
| Urb. Los Ejidos | −5,16240 | −80,63190 |
| Urb. El Chipe | −5,17420 | −80,62580 |
| Catacaos Centro | −5,26670 | −80,68330 |

La distancia se calcula contra tu GPS si lo das, y si no, contra el centro de tu
sector: sigue siendo útil y nunca inventa un «9999 km». Cuando una publicación
solo tiene la ubicación del sector se muestra «en tu sector» en lugar de una
precisión falsa de metros.

**Pago:** el Yape y el Plin que el vecino registra se copian a la publicación
cuando la crea. Si después cambia su número en el perfil, las publicaciones
anteriores **no se reescriben** (así nadie paga a un número que ya no es suyo).
En el detalle aparecen el número, un botón de copiar y un botón de WhatsApp con
el mensaje ya escrito.

## Fase 2 — Ciclo cerrado: cotización → trato → cierre → recomendación

El ciclo ahora existe dentro de la app:

1. El comprador pide una cotización (o escribe directo).
2. Acuerdan y el comprador registra el trato con el monto.
3. Cada parte confirma por separado («recibí» / «entregué»). Hasta que **las dos**
   confirman, el trato queda «acordado».
4. Al cerrarse, se habilita **una sola vez** el visto bueno.
5. El visto bueno sin trato cerrado se rechaza con un mensaje que explica cómo
   cerrarlo.

Publicaciones y cotizaciones que vencen pasan a «vencida» y el autor recibe un
aviso; ya no desaparecen sin explicación.

## Fase 3 — Avisos y continuidad

- **Campana con contador** en la barra superior. Avisos por: cotización
  recibida o respondida, trato registrado o confirmado, favor solicitado,
  aceptado o resuelto, publicación vencida.
- **Recuperar contraseña** con código de 6 dígitos válido 15 minutos. En la
  demo el código se muestra en pantalla; con un proveedor de WhatsApp se enviaría
  al teléfono sin cambiar nada del resto.
- **Borrador**: lo que se escribe en el formulario se guarda en el teléfono y se
  recupera al volver, aunque se cierre la pestaña.

## Fase 4 — Confianza verificable y privacidad

- **Consentimiento por publicación**: casilla «Mostrar mi número y mi Yape a
  vecinos con sesión». Si se desmarca, ni el número ni el Yape salen, ni siquiera
  para quien tiene sesión (solo el autor los ve en su propia publicación).
- **Contraseñas con sal** por usuario y migración transparente: las cuentas
  viejas se actualizan solas en el primer ingreso correcto.
- **Bloqueo por cuenta**: cinco intentos fallidos bloquean 15 minutos, además del
  límite por IP. El mensaje ofrece recuperar la contraseña.
- **Registro de consultas**: cada vez que un vecino abre el detalle de una
  publicación con contacto visible queda anotado; el autor ve cuántas veces y
  quién, en «Mis cosas».
- **Moderador suplente** (`mod2@app.local`) para que la moderación y la
  emergencia no dependan de una sola persona.

## Fase 5 — Fotos, mapa y funcionamiento sin señal

- **Fotos**: hasta tres, comprimidas en el propio teléfono (máximo 1000 px,
  ~150 KB) y con los metadatos eliminados al pasar por un lienzo, así que la
  foto no lleva el GPS del teléfono. Se sirven desde `/fotos/`.
- **Mapa**: mosaicos de OpenStreetMap centrados en la publicación, con pin,
  atribución y enlace «Ver el sector en el mapa». Si un mosaico falla se prueba
  un espejo y, si también falla, se oculta: nunca queda un cuadro roto.
- **Sin conexión**: lo que se publique sin señal entra a una cola en el teléfono,
  se avisa «quedó pendiente», y se envía sola al volver la red, con identificador
  para no duplicar. La lista muestra lo último cargado con su hora.

## Fase 6 — Operación del barrio

- **Semilla de 30 ofertas** repartidas en los ocho sectores, con oficios reales
  de Piura (gasfitería, carpintería, electricidad, cerrajería, clases,
  alimentos, paseo de mascotas, herramientas, movilidad y favores).
- **Panel de indicadores** en lenguaje simple: ofertas activas, pedidos con
  respuesta, tratos cerrados, favores resueltos, vecinos y reportes pendientes.
- **Respaldo diario** con verificación de integridad y prueba de restauración
  (se restauró una copia y se contaron 30 publicaciones y 6 usuarios).
- **Vigilancia cada 5 minutos** con alerta por Telegram si el sitio cae
  (`/root/.vecinal-alerta` con `bot chat` para activarla).

---

## Fallos que la prueba con usuario destapó y se corrigieron

Estos no salieron en la verificación de API: aparecieron al usar la app en un
navegador real, con capturas.

1. El registro creaba la cuenta pero no iniciaba sesión (la API devuelve `ok` sin
   token). Ahora registra y entra en el mismo paso.
2. El mapa no se dibujaba: el detalle borraba las coordenadas antes de
   responder. Se usan las coordenadas aproximadas.
3. Distancia «a 9999,0 km» cuando faltaba un punto. Ahora se omite o se usa el
   centro del sector.
4. Las fotos llegaban como texto JSON y rompían la tarjeta con una imagen rota.
   Ahora viajan como lista.
5. «Ofertas activas» salía vacío en el panel: la clave era `activas` y la API
   devuelve `ofertas_activas`.
6. El directorio de emergencia salía vacío: la API devuelve un objeto
   `{directorio, puntos}` y la pantalla esperaba una lista.
7. En móvil la última tarjeta quedaba bajo la barra inferior; se añadió espacio
   de seguridad y se acortó la cabecera para los nombres largos de sector.

## Lo que sigue pendiente (a propósito)

- Envío real del código de recuperación por WhatsApp o SMS (hoy se muestra en
  pantalla para la demo).
- Verificación del teléfono con código al registrarse.
- Mapa con calles dibujadas propias y búsqueda por dirección.
- PostgreSQL y PostGIS antes de abrir con datos reales de muchos sectores.
- Chat interno (hoy la coordinación es por WhatsApp, que es donde el vecino ya está).

## Cómo comprobarlo tú mismo

1. Abre https://vecinal.apioai.online desde el teléfono.
2. Entra como `rosa.quiroz@demo.local` / `vecina2026`.
3. Toca una publicación: verás distancia, Yape con botón de copiar y mapa.
4. Toca «Cerramos el trato»; entra como `juan@app.local` / `gas123`, confirma, y
   recién entonces aparecerá habilitado el visto bueno.
5. Apaga los datos y publica: verás el aviso de pendiente y cómo se envía solo al
   volver la conexión.

---

## Sistema de color e iconos (v3.1)

**Problema:** la interfaz usaba 36 colores distintos sin relación (morado de Yape,
turquesa de Plin, amarillo de aviso, seis grises casi iguales) y más de cuarenta
emojis de sistema como iconos, que cambian de forma según el teléfono.

**Regla aplicada:** una familia de marca, una rampa de neutros y dos acentos
semánticos. Todo lo demás sale del sistema.

| Familia | Uso | Escala |
|---|---|---|
| Verde (tono 158°) | Marca, acciones primarias, estados positivos | 50, 100, 500, 600, 700, 800, 900 |
| Neutros tintados en el mismo tono | Fondos, texto, bordes | 5 pasos |
| Rojo (tono 6°) | Solo peligro: emergencia, borrar, error | base, 50, borde |
| Ámbar (tono 38°) | Solo aviso: pendiente, vencido, advertencia | base, 50, borde |

Por qué funciona: los neutros comparten el tono del verde (saturación muy baja),
así que nada "ensucia" la pantalla; el rojo y el ámbar son la única familia cálida
y, al reservarse a semántica, el ojo los lee como señal y no como decoración.
El morado y el turquesa desaparecieron: Yape y Plin son etiquetas neutras porque
su color no aporta información.

**Iconos:** 37 símbolos SVG en un solo sprite, trazo de 1,7 px, mismo remate
redondeado, color heredado del texto. Los emojis quedaron en cero. Esto también
evita que en un teléfono sin fuente de emojis aparezcan cuadros vacíos.

**Contraste verificado (WCAG AA):**

| Combinación | Ratio |
|---|---|
| Texto principal sobre blanco | 16,7:1 |
| Texto de apoyo sobre blanco | 11,2:1 |
| Texto secundario sobre blanco | 4,77:1 |
| Blanco sobre verde de marca | 6,51:1 |
| Rojo sobre su fondo claro | 6,46:1 |
| Ámbar sobre su fondo claro | 5,40:1 |
| Verde de marca sobre su fondo claro | 5,91:1 |

El gris terciario (2,95:1) se retiró de cualquier texto pequeño y solo queda en
elementos decorativos, como la atribución del mapa.

---

## Refinamiento de interfaz (v3.2)

Objetivo: que la app no se sienta "de plantilla" y que los controles del sistema
(desplegables, buscador, casillas) formen parte del diseño.

**Controles.** Todos comparten alto (46 px), radio (11 px), borde y foco. Los
`select` nativos llevan `appearance:none` y un chevrón SVG propio; el buscador
lleva la lupa dentro del campo. Nada queda con el aspecto gris del navegador.

**Tarjetas.** El borde reemplaza la sombra fuerte; la categoría es una píldora
verde con su icono; el precio es el elemento dominante y usa cifras tabulares; el
pie (avatar con inicial, nombre y sector) está anclado al fondo con una línea
fina, así que todas las tarjetas de una fila quedan perfectamente alineadas
(medido: 618 px en las tres). La descripción se recorta por palabras, no por
caracteres.

**Ordenar.** El texto "toca el pin de arriba" desapareció: ahora hay un control
real «Ordenar por: Más cercano / Más reciente / Mejor valorado», con el parámetro
`orden` en la API.

**Cabecera en móvil.** Se quitó "Salir" (vive en el perfil), el nombre se
reemplazó por el avatar con inicial y la marca se acorta a "Vecinal". Queda:
marca, sector, campana, avatar.

**Detalle.** Las acciones se agrupan: una principal a todo el ancho y dos
secundarias parejas, fijas al fondo del modal mientras se desplaza; "Reportar"
pasó a enlace discreto.

**Otros.** Botones de 44-46 px (objetivo táctil), foco visible en todo, estados
vacíos con icono y acción, esqueletos con la forma de la tarjeta, aviso de pago
con más contraste y etiqueta de emergencia sobria (borde y texto rojo, sin relleno).

**Datos de demostración.** Se limpiaron publicaciones de prueba duplicadas y los
usuarios demo ahora tienen nombres corrientes (Juan Quispe, Ana Morales, Pedro
Chunga, Lucía Yarlequé, María Panta, Rosa Huamán). El script de verificación usa
una cuenta fija y borra lo que crea, para no ensuciar el directorio.

## Carga de fotos: qué fallaba y qué se corrigió

El síntoma: al tocar «Agregar fotos» no aparecía nada y no se veía ningún error.

Causa: el `<input type="file">` estaba oculto con la clase `sr-only` (recortado a
1 px) y se abría solo por el `for` de la etiqueta. Varios navegadores móviles no
disparan el selector en esa combinación, y como no había mensaje de estado, el
fallo era invisible.

Correcciones:

1. El campo de archivo ahora **cubre el botón** (posición absoluta, opacidad 0,
   z-index superior). El toque cae directamente sobre el input, sin depender del
   `for`. Verificado con un toque real: `elementFromPoint` devuelve el propio input.
2. **Estado visible**: «Subiendo foto 1 de 3…», «1 de 3 fotos listas» o un error
   concreto en rojo. Ya no hay fallos silenciosos.
3. Mensajes específicos: archivo que no es imagen, formato que el navegador no
   puede leer (HEIC en Android), o falta de conexión.
4. Límites ampliados: servidor a 700 KB por imagen y `client_max_body_size 6m`
   en Nginx, para que una foto grande no sea rechazada antes de llegar.
5. Prueba real: PNG de 18 MB y 3000×2000 → se comprime, sube y muestra; archivo
   de texto → mensaje de error claro.

## «Mi actividad» y navegación (v3.3)

**Navegación.** «Mis cosas» salió de la barra: no tiene sentido ofrecer una
sección vacía a quien no ha entrado. La barra queda en cuatro: Local, Favores,
Emergencia, Perfil. Con sesión, el perfil muestra un botón principal «Mi
actividad: publicaciones, tratos y cotizaciones». Sin sesión, cualquier enlace a
esa vista cae en el perfil.

**Contenido.** La pantalla dejó de ser una pila de títulos vacíos:

- Cuatro indicadores arriba: publicaciones activas, cotizaciones en curso (en rojo
  si hay alguna esperando respuesta), tratos abiertos y favores en curso. Cada uno
  lleva a su pestaña.
- Cinco pestañas: Publicaciones, Cotizaciones, Tratos, Favores y Privacidad.
- Cada tarjeta muestra su estado como etiqueta (Activa, Esperando respuesta,
  Cerrado…) y sus acciones propias.
- Estados vacíos con icono, explicación y botón para actuar.

**Fallo corregido.** Un reemplazo masivo de la versión con `sed` (los puntos
actúan como comodín) dañó tres trazados SVG: el libro del tutorial, la llave de
cerrajería y el apretón de manos de «Cerrar trato». Se restauraron y se
comprobó que los 37 iconos siguen dibujándose.

## Desplegables propios (v3.3.1)

El `<select>` nativo lo pinta el sistema operativo: en Android e iOS se abre como
una lista con botones de radio grises, imposible de vestir con CSS. Por eso se veía
"del sistema" aunque el control cerrado ya estuviera integrado.

Ahora cada `<select>` se sustituye por un **listbox propio**: botón con el estilo de
los campos de la app, panel blanco redondeado con sombra, opción activa en verde con
marca de verificación y scroll interno cuando hay muchas opciones. El `<select>` real
sigue en el DOM como fuente del valor, así que todo el código existente
(`select.value`, eventos `change`, validaciones) funciona sin cambios.

Detalles: cierre al tocar fuera o con Escape, navegación con flechas y Enter, y
`aria-expanded` / `role="listbox"` para lectores de pantalla. Los 12 desplegables de
la app (categorías, sector, tipo, pagos, orden, recuperación de contraseña) usan el
mismo componente.

## Correcciones v3.3.2 / v3.3.3

**Desplegable dentro de un modal.** El panel del selector se dibujaba dentro del
contenedor del modal y quedaba recortado, además de empujar la ventana. Ahora el
panel se monta en el `body` (portal) y, cuando el campo está dentro de un modal, se
abre como hoja inferior con asa, ancho completo y scroll propio: se ven las ocho
opciones y no tapa el formulario de abajo.

**Mapa.** OpenStreetMap bloqueó los mosaicos del servidor («403 Access blocked,
tile usage policy»). Se cambió al espejo de OSM Francia (mismo dato y atribución),
con respaldo a Esri y ocultado limpio si ambos fallan. Verificado: 9 de 9 mosaicos.

**Navegación.** «Perfil» salió de la barra inferior (quedan Local, Favores y
Emergencia). El acceso es el avatar cuando hay sesión y un botón de persona en la
cabecera cuando no la hay; se acabó el «Entrar» con texto junto a la campana.

**Cabecera sin sesión.** El botón de entrar no se pintaba para invitados
(`pintarUsuario` solo corría al cargar un perfil). Corregido en el arranque.


## v4.0.0 — migración a React

El frontend pasó de un `app.js` de 1.500 líneas a una aplicación React 19 con Vite,
React Router y TanStack Query. El backend FastAPI no cambió: la app consume los mismos
endpoints, así que las 103 comprobaciones siguen en verde.

**Estructura nueva** (`web/`): `screens/` una pantalla por sección, `components/` piezas
reutilizables, `context/` sesión y sector, `lib/` cliente de API, formato e iconos.
Compila a `app/static` y se sirve desde el mismo dominio.

**Ideas incorporadas de BarrioConecta**

- **SOS fijo** en Emergencia: 105, 116, 115 y 106 como botones `tel:` grandes.
- **SMS sin internet** en los recursos de emergencia, junto a WhatsApp.
- **Buscador por voz** con `SpeechRecognition` y aviso cuando el navegador no lo tiene.
- **Filtro por distancia** (1, 2 y 5 km) sobre la distancia real del servidor.
- **Tutorial por pasos** con lectura en voz alta y frase en quechua.
- **Letra grande** en toda la app, recordada entre visitas.
- **Radio de visibilidad** y **punto de encuentro** en publicaciones de movilidad.

**Lo que se conservó del proyecto propio**: backend real, visto bueno solo tras trato
cerrado, consentimiento de contacto, registro de consultas, moderación con métricas,
cola de envío sin conexión y sistema visual con contraste AA.

**Verificado**: registro, inicio de sesión, publicación en tres pasos, detalle con pagos y
mapa (9 de 9 mosaicos), actividad con pestañas, emergencia, tutorial y moderación;
sin errores de consola en móvil (390×844) ni en escritorio (1280×900).


## v4.0.1 — paleta de BarrioConecta

Se adoptó su paleta tal cual, sin inventar tonos:

| Uso | Color | Contraste medido |
|---|---|---|
| Marca y acción principal | `#006b2c` | blanco encima 6,69:1 |
| Marca oscura (cabecera) | `#005221` | blanco encima 9,42:1 |
| Marca clara (fondos suaves) | `#e8f5e9` | verde encima 5,95:1 |
| Información y enlaces | `#006194` | sobre blanco 6,69:1 |
| Peligro y emergencia | `#b61722` | blanco encima 6,70:1 |
| Fondo | `#f9f9ff` | — |
| Tarjetas | `#ffffff` | — |
| Texto principal | `#141b2b` | 17,19:1 |
| Texto de apoyo | `#3e4a3d` | 9,33:1 |
| Texto secundario | `#5b6959` | 5,82:1 |
| Bordes | `#e5e7eb` / `#bdcaba` | — |

Ajustes de consecuencia: el aviso de contacto pasó de ámbar a azul (es información, no alarma),
las etiquetas de pago quedaron neutras para que no compitan con la marca, el icono de la app y
el color del manifiesto pasaron a `#006b2c`, y el texto secundario se oscureció de `#6e7b6c`
a `#5b6959` porque el original se quedaba en 4,46:1 (por debajo de AA).

Verificado: 105 comprobaciones en verde, cero errores de consola en móvil y escritorio,
contrastes medidos sobre la página real.


## v4.1.0 — entrada obligatoria

La app ya no se puede mirar sin cuenta. Al abrir, si no hay sesión guardada aparece una
pantalla de entrada (móvil y escritorio) con dos caminos: **Entrar** o **Crear cuenta**.
No se renderiza la barra, ni las listas, ni los contactos hasta que haya sesión.

- La sesión se guarda en el dispositivo: al volver, entra directo.
- Cualquier ruta escrita a mano (`#/emergencia`, `#/actividad`…) cae en la misma puerta.
- Al cerrar sesión se vuelve a la puerta y se borra el token.
- Al entrar, el sector de la cuenta manda sobre el guardado antes; si la persona lo cambia
  a mano en el selector, se respeta su elección.
- La recuperación de contraseña sigue disponible desde la puerta (`#/recuperar`).

Consecuencia de privacidad: como ya no hay invitados, el teléfono y Yape de una publicación
solo los ve alguien con sesión, y queda registrado quién consultó el contacto.

Verificado en navegador: puerta visible sin sesión, ruta directa bloqueada, registro entra,
recarga mantiene la sesión, cerrar sesión devuelve a la puerta; 105 comprobaciones del API
siguen en verde.


## v4.1.1 — el desplegable cuelga del campo, siempre

Se eliminó la hoja inferior para los selectores. El panel calcula su posición desde el campo:
se abre hacia abajo si hay espacio y hacia arriba si no lo hay, con una flecha que apunta al
campo y scroll propio cuando la lista es larga. Vale igual en la pantalla de entrada, en el
formulario de publicar y en la ventana de sector, en móvil y en escritorio.

De paso: los sectores se cargan al abrir la app (antes solo con sesión, así que en la puerta
solo aparecía «Piura Centro») y el campo ahora lleva su `id`, que faltaba para que la etiqueta
lo enfocara.


## v4.1.2 — salida de «Recuperar acceso»

La pantalla de recuperación no tenía retorno: quien tocaba «Olvidé mi contraseña» quedaba
atrapado. Ahora lleva arriba un botón **Volver a entrar** que regresa a la puerta (o al perfil
si ya hay sesión), y sigue el «Atrás» entre los dos pasos del formulario.


## v4.1.3 — el desplegable ya no se cierra al desplazar

El panel se cerraba al primer evento de scroll porque escuchaba el desplazamiento de toda la
página en fase de captura, incluido el de su propia lista. Ahora:

- Al desplazar la página, el panel se recoloca y sigue pegado a su campo; solo se cierra si el
  campo sale de la vista.
- La rueda y la barra de desplazamiento dentro de la lista no lo cierran.
- Sigue cerrando con clic fuera, Escape o al elegir una opción.

Aplica a todos los selectores del proyecto (entrada, publicar, sector, categoría y orden):
todos usan el mismo componente, y se probaron uno por uno.


## v4.2.0 — ubicación al abrir y enlace coherente

**Ubicación al entrar.** La puerta pregunta «¿Usamos tu ubicación?» con dos botones:
*Detectar mi sector* y *Elegir a mano*. Si se concede, se busca el sector más cercano de los
ocho de Piura (Haversine), se preselecciona en el registro y se avisa: «Sector detectado:
Catacaos Centro · cambiarlo a mano». Si el navegador ya tenía el permiso concedido, la
detección ocurre sola al abrir. La decisión se recuerda: no vuelve a preguntar en cada visita.
Solo se guarda el sector, no la dirección; las coordenadas quedan en el dispositivo.

**«Olvidé mi contraseña».** Ahora aparece únicamente en la pestaña *Entrar*. En *Crear cuenta*
no tiene sentido y se ocultó.

Verificado con geolocalización simulada: coordenadas de Catacaos → sector «Catacaos Centro»,
con el formulario ya preseleccionado. 103 comprobaciones del API en verde.


## v4.2.1 — el desplegable termina en fila completa

El panel se dimensionaba con un alto fijo, así que la última opción quedaba partida por la
mitad y el borde inferior desaparecía: se veía como un cuadro cortado. Ahora el alto se calcula
en múltiplos de la fila (42 px) más el relleno y el borde, con un máximo de ocho filas visibles.
Cada opción se ve entera y el panel siempre cierra con su borde y su sombra, se abra hacia
arriba o hacia abajo.


## v4.3.0 — acceso con teléfono, código por SMS y PIN de 6 dígitos

**Fuera el correo.** La cuenta se identifica por el teléfono. El registro pide nombre,
sector, teléfono, un código de 6 dígitos y un PIN de 6 dígitos. El correo ya no se pide ni
se muestra en ninguna pantalla; en la base queda un marcador interno porque la columna es
obligatoria.

**Verificación del teléfono.** `POST /api/telefono/solicitar` genera un código de 6 dígitos
válido 10 minutos, con límite de intentos y de peticiones (8 cada 5 minutos).
`POST /api/registro_pin` crea la cuenta solo si el código coincide. Sin proveedor de SMS el
código vuelve en la respuesta y la app lo muestra como «código de demostración»; con un
proveedor real se envía al teléfono y deja de mostrarse.

**Entrada.** `POST /api/login_pin` con teléfono + PIN, con bloqueo de 15 minutos a los cinco
intentos. El PIN se guarda con sal, igual que antes la contraseña. «Olvidé mi PIN» pide código
al teléfono y permite definir uno nuevo (`POST /api/pin/confirmar`).

**Compatibilidad.** Se mantienen `/api/registro` y `/api/login` (correo y contraseña) para no
romper las comprobaciones automáticas ni las cuentas antiguas; la interfaz ya no los usa.

**Cuentas de demostración.** Se les asignó PIN `123456` para poder probar el acceso por
teléfono. En producción cada persona define el suyo al verificar su número.


## v4.4.0 — código aleatorio y único, y confirmación en dos pasos

**Los códigos son aleatorios.** Se generan con `secrets.randbelow(1_000_000)` y se formatean a
seis dígitos (`000123` es válido). No siguen ninguna secuencia ni se derivan del teléfono.

**Son únicos.** Antes de guardar, el servidor comprueba que ese código no esté vigente en otro
teléfono; si coincide, genera otro (hasta 40 intentos). Un teléfono tiene un solo código activo,
y al usarlo se borra: no se puede reutilizar.

**Registro en dos pasos.** El formulario ya no muestra el campo del código. Primero se llenan
todos los datos (nombre, sector, teléfono, PIN, Yape/Plin, aviso de privacidad) y se pulsa
*Continuar*: eso pide el código y pasa a una pantalla donde solo están el número y las seis
casillas. En la demo, a los 3 segundos el código se rellena solo; se pulsa *Confirmar y crear
cuenta* y recién ahí se crea la cuenta. Con SMS real, las casillas se llenan al escribir.

La misma pantalla de seis casillas se usa en «Olvidé mi PIN».


## v4.4.1 — la confirmación del código en escritorio

En escritorio la pantalla heredaba la rejilla de dos columnas de la entrada (texto + tarjeta).
Al ocultar la columna de texto, la tarjeta se metía en la columna estrecha de 246 px y las
casillas quedaban diminutas. Ahora esa pantalla usa una sola columna de 520 px, centrada
vertical y horizontalmente, con casillas de 64 × 62 px.

También se quitó el aviso duplicado: ya no salen «Código enviado» y «Código recibido» juntos;
queda solo el segundo.


## v4.5.0 — escritorio ordenado, menú de cuenta y recorrido guiado

**Cabecera.** Se eliminaron las pestañas «Mi actividad», «Mi perfil» y «Tutorial» de la barra.
Quedan las tres secciones (Economía Local, Favores, Emergencia) y, a la derecha, el sector, los
avisos y el avatar. El avatar abre un menú con el nombre, el teléfono, Mi perfil, Mi actividad,
Tutorial, Moderación (si aplica), letra grande y cerrar sesión.

**Escritorio.** Contenido hasta 1240 px con 32 px de margen, título más grande, barra de filtros
como panel y rejilla de tres columnas con tarjetas de la misma altura en cada fila. En móvil
todo sigue igual que antes.

**Tutorial como recorrido.** Ya no es una lista de texto: es un tour de 10 pasos que resalta el
elemento real de cada pantalla (sector, buscador, tarjeta, publicar, favores, emergencia,
actividad, cuenta), cambia de sección cuando toca y avanza con Siguiente/Atrás. Se abre solo la
primera vez que alguien entra y se puede repetir desde el menú de la cuenta o desde Tutorial.


## v4.5.1 — el avatar de la cabecera no se veía

La hoja de estilos traía una regla de la versión anterior (`.avatar-btn{display:none}`) que el
JavaScript antiguo encendía al iniciar sesión. En React el botón se dibujaba pero quedaba
oculto: se podía abrir el menú solo desde código. Ahora la regla del contexto (`.topbar .avatar-btn`)
fuerza `inline-flex` con su tamaño de 36 px, y el botón muestra la inicial en escritorio y móvil.
