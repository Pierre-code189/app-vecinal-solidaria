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
