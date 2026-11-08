# Análisis de BarrioConecta y plan de fusión

Repositorio: `github.com/victorfloresdev/BarrioConecta` (clonado en `/root/barrio-conecta`).
Fecha: 7 de noviembre de 2026.

---

## 1. Qué es el repositorio

Una aplicación **React Native con Expo** (no una web): 57 archivos, 5.179 líneas,
12 pantallas, navegación por pestañas y pila, Tailwind mediante NativeWind y un
**backend simulado en memoria** (`src/mockData.js`, 431 líneas).

Se ejecuta en teléfono con Expo Go o en navegador con `react-native-web`; también
se puede exportar como web estático.

### Arquitectura

| Capa | Archivo | Qué hace |
|---|---|---|
| Entrada | `index.js`, `App.jsx` | Monta `NavigationContainer` y el `AuthProvider` |
| Navegación | `src/navigation/AppNavigator.jsx` | Pila (login/registro/detalles/publicar) + 5 pestañas con botón central «+» |
| Estado | `src/context/AuthContext.jsx` | Usuario y token en memoria, sin persistencia |
| Datos | `src/services/api.js` | `USE_MOCK: true`; toda la app lee de arreglos en memoria |
| Hooks | `src/hooks/*` | `useEconomiaLocal`, `useEconomiaSolidaria`, `useEmergencias`, `useAuth` |
| Diseño | `src/constants/theme.js` | 12 colores, radios y altura de barra |
| Textos | `src/mockData.js` | 4 usuarios, publicaciones, favores y emergencias de ejemplo |

### Las 12 pantallas

1. **Login** — teléfono +51 y contraseña, pacto de confianza barrial.
2. **Registro** — sector obligatorio y aviso de privacidad.
3. **Economía Local** — pestañas Servicios / Productos / Trueques, filtro por categoría, tarjetas con distancia, **sello avalador** y botón de Visto Bueno.
4. **Detalle Economía Local** — fotos, ubicación aproximada y **WhatsApp con mensaje prearmado**.
5. **Economía Solidaria** — muro «Piden / Ofrecen ayuda», **buscador con dictado por voz**, categorías Movilidad, Herramientas, Tiempo.
6. **Detalle Solidaria** — préstamo de herramientas y movilidad escolar con **checklist de seguridad**.
7. **Tablero de Emergencias** — activación del modo, **botones SOS 105/116/115/106** y directorio de ollas comunes y centros de acopio.
8. **Detalle Emergencia** — insumos críticos (agua, bidones, víveres), radio de seguridad y «Tengo este recurso» con **SMS sin internet**.
9. **Publicar paso 1** — tres opciones grandes: servicio, producto o intercambio.
10. **Publicar paso 2** — categoría, modalidad de cobro y **radio de visibilidad de 2 km**.
11. **Perfil** — datos, vistos buenos otorgados, estado offline y acceso al tutorial.
12. **Tutorial** — modal por pasos con letra grande, audio y **modo asistido para adultos mayores**.

### Modelo de datos (mock)

- **Usuario**: `id`, `nombre`, `telefono`, `zona_residencia`, `rol`, `vistos_buenos_otorgados`, `oficio`, `bio`, `avatar`.
- **Publicación de comercio**: `tipo_publicacion` (servicio/producto), `categoria`, `precio_tipo` (fijo/a_convenir/trueque), `precio_monto`, `disponibilidad`, `vendedor{nombre_publico, zona_aproximada, sello_avalador, telefono, avatar, descripcion_avalador}`, `distancia_km`, `vistos_buenos`, `estado`, `imagen`, `beneficios[]`.
- **Favor**: `tipo_muro` (necesito/ofrezco), `categoria_favor`, `urgencia`, `usuario_publico{nombre_publico, zona_aproximada, iniciales, verificado, aportes_cumplidos, telefono}`.
- **Emergencia**: recurso crítico, radio, estado del tablero.

---

## 2. Comparación con nuestro proyecto

| Dimensión | BarrioConecta | Nuestro proyecto (Vecinal) |
|---|---|---|
| Plataforma | React Native / Expo (móvil + web) | PWA web (FastAPI + JS vanilla) |
| Backend | **Simulado en memoria** | **Real**: FastAPI + SQLite WAL, 105 comprobaciones |
| Persistencia | Se pierde al recargar | Base de datos, fotos en disco, respaldo diario |
| Autenticación | Mock, sin hash | Token + hash con sal, bloqueo por intentos |
| Privacidad | Texto y ubicación «aproximada» decorativa | Consentimiento por publicación, jitter real de 400 m, registro de consultas |
| Reputación | Visto bueno libre (se puede inflar) | Exige trato cerrado con doble confirmación |
| Pagos | No trata el tema | Yape/Plin del perfil, copiar en un toque, sin custodia |
| Favores | Muro con checklist de seguridad y voz | Muro con estados, garante, fecha de devolución y cierre |
| Emergencias | **SOS + centros de acopio + SMS sin internet** | Tablero 72 h, directorio, activación solo por moderador |
| Publicar | 3 toques, radio de 2 km | 3 pasos, fotos, consentimiento, borrador offline |
| Moderación | No existe | Reportes, acciones, métricas, moderador suplente |
| Offline | Texto que lo menciona | Cola real de envío + caché de lectura |
| Diseño | Tokens + Tailwind, 12 pantallas muy claras | Sistema propio: 28 colores, 37 iconos SVG, contraste AA |
| Estructura de código | **Componentes, hooks, contexto, servicios** | Un `app.js` de 1.500 líneas |
| Pruebas | Ninguna | 105 verificaciones automáticas de API |

---

## 3. FODA

### BarrioConecta

**Fortalezas**
- Arquitectura clara para crecer: pantallas separadas, hooks por dominio, capa de servicios y contexto de sesión.
- Flujos muy bien contados: tres toques para publicar, SOS siempre visible, checklist de seguridad para menores.
- Ideas que no tenemos: **sello avalador** visible en la tarjeta, **buscador por voz**, **SMS sin internet**, **radio de visibilidad**, tutorial con audio y modo asistido.
- Código idiomático de React: fácil de leer y de trasladar.

**Oportunidades**
- Al conectarse a un backend real (el nuestro) gana persistencia, seguridad y confianza.
- `react-native-web` ya permite publicarlo como web; con React web se despliega en el dominio actual.
- Su modelo de datos encaja casi uno a uno con el nuestro.

**Debilidades**
- Todo es simulado: no hay base de datos, ni sesiones reales, ni validación en servidor.
- Sin moderación, sin privacidad efectiva, sin límites de uso, sin respaldos.
- Estado en memoria: cualquier recarga borra publicaciones y usuarios.
- Imágenes de Unsplash (externas) y sin atribución; sin fotos propias.
- Sin pruebas automatizadas.

**Amenazas**
- Si se presenta como producto, cualquiera descubre que no guarda nada.
- La dependencia de Expo complica el despliegue web en un servidor propio.
- Reputación inflable y datos personales sin protección: riesgo legal (Ley 29733).

### Nuestro proyecto (Vecinal)

**Fortalezas**
- Backend real y verificado: 105 comprobaciones, respaldo con restauración probada, vigilancia cada 5 minutos.
- Confianza real: visto bueno solo tras trato cerrado, consentimiento de contacto, registro de accesos.
- Localización de Piura con coordenadas verdaderas y ocho sectores.
- Sistema visual propio, accesible y coherente; sin emojis, contraste AA.

**Oportunidades**
- Adoptar la estructura de React y las ideas de producto del otro repositorio.
- Sumar SOS, sello avalador, voz y radio de visibilidad sin rehacer el backend.

**Debilidades**
- Frontend en un solo archivo, sin componentes ni build: difícil de mantener y de repartir el trabajo.
- Sin tipado, sin pruebas de interfaz, sin app nativa.
- Sin búsqueda por voz ni modo asistido real.

**Amenazas**
- Un `app.js` monolítico frena al equipo y multiplica los errores al crecer.
- Depender de un solo servidor con SQLite tiene techo si el barrio crece mucho.

---

## 4. Cómo se complementan

| Idea del repositorio | Cómo entra en el nuestro |
|---|---|
| Estructura `screens/components/hooks/context/services` | Base de la migración a React |
| **Sello avalador** en la tarjeta | Mostrar los avaladores que ya existen en nuestra base (`avaladores`) |
| **SOS 105/116/115/106** fijos | Bloque fijo en Emergencia, siempre visible, no dentro de un desplegable |
| **Checklist de seguridad** en favores | Se suma al formulario de movilidad y préstamo (ya validamos en servidor) |
| **Buscador por voz** | `SpeechRecognition` en el buscador, con degradado a texto |
| **Modo asistido / letra grande** | Interruptor de accesibilidad que sube el tamaño base y simplifica la vista |
| **Radio de visibilidad (2 km)** | Filtro de distancia en la lista, con nuestro cálculo real de km |
| **SMS sin internet** | Enlace `sms:` en el detalle de emergencia como alternativa a WhatsApp |
| **Tutorial por pasos con audio** | Nuestro tutorial ya tiene voz y quechua; se pasa a modal por pasos |
| **Navegación por pila + pestañas** | React Router: rutas por pantalla y barra inferior |

Lo que **no** se adopta: el backend simulado, el estado en memoria, las imágenes de Unsplash y el visto bueno libre.

---

## 5. Plan de migración a React

**Decisión:** reescribir el frontend como **React 19 + Vite + React Router + TanStack Query**,
manteniendo FastAPI y toda la lógica de negocio del servidor. La app nativa queda
para después: primero una web React que funciona en el mismo dominio.

| Fase | Contenido |
|---|---|
| 1 | Proyecto Vite, tokens de diseño y sprite de iconos |
| 2 | Capa de servicios (`api.js`), contexto de sesión, hooks por dominio |
| 3 | Pantallas: Local, Favores, Emergencia, Actividad, Perfil, Tutorial, Moderación |
| 4 | Detalle, publicación en 3 pasos, componentes compartidos (tarjeta, selector, hoja) |
| 5 | Accesibilidad: voz, letra grande, foco, teclado |
| 6 | Compilar, servir desde FastAPI, verificar y capturar |

Criterio de aceptación: las 105 comprobaciones siguen en verde y la app React
cumple los mismos flujos que la actual, con las ideas nuevas incorporadas.
