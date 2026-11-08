# Vecinal Solidaria · App móvil (React Native + Expo)

Migración de la app web de `web/` a React Native con Expo SDK 58. Reutiliza el
mismo backend FastAPI (`app/`) sin cambios: la app consume la API REST con token
Bearer.

## Requisitos

- Node.js 22+
- Un teléfono con **Expo Go** (SDK 58) o un emulador Android/iOS
- Opcional: `EXPO_PUBLIC_API_URL` para apuntar a otro backend

## Arrancar

```bash
cd mobile
npm install
npm run start
```

Luego escanea el QR con Expo Go o pulsa `a` / `i` para emulador. Para abrir la
versión web del mismo código:

```bash
npm run web
```

El backend por defecto es `https://vecinal.apioai.online`. Para usar uno local:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:8010 npm run start
```

> En un teléfono real `localhost` apunta al teléfono, no a tu PC. Usa la IP de
> tu red o el dominio público.

## Cuentas de demostración

Cualquier usuario sembrado entra con su teléfono y PIN **123456**:

| Teléfono | Nombre | Rol |
| --- | --- | --- |
| 999000001 | María Panta | admin |
| 999000002 | Juan Quispe | vecino |
| 999000003 | Ana Morales | vecino |
| 999000006 | Rosa Huamán | moderador |

## Estructura

```
mobile/
├─ app.json                  configuración Expo (permisos, iconos, scheme)
├─ src/
│  ├─ app/                   rutas de expo-router
│  │  ├─ _layout.jsx         providers, pila de navegación, aviso offline
│  │  ├─ (tabs)/             Local, Favores, Emergencia, Perfil
│  │  ├─ publicacion/[id]    detalle, reporte, contacto y pago
│  │  ├─ publicar            formulario en 2 pasos + fotos
│  │  ├─ mensajes, chat/     bandeja e hilo con acciones de trato
│  │  ├─ actividad           registro, publicaciones, cotizaciones, tratos…
│  │  ├─ moderacion          reportes, métricas y roles (moderador/admin)
│  │  ├─ tutorial, recuperar
│  ├─ components/            UI kit, header, tab bar, chat flotante, etc.
│  ├─ context/               ajustes (tema/voz), auth, zona, tour
│  └─ lib/                   api, storage, formato, iconos SVG, fotos
```

## Funcionalidades portadas

- Sesión con teléfono + PIN de 6 dígitos, registro con código de demostración.
- Token en **SecureStore** (nativo) y AsyncStorage (web/preferencias).
- Economía Local con búsqueda, categorías, orden, distancia y filtros rápidos.
- Favores (pedidos/ofrecidos) y tablero de emergencia con directorio del barrio.
- Publicar servicio, producto, favor o recurso de emergencia; hasta 3 fotos.
- Detalle con aval, mapa aproximado, Yape/Plin, WhatsApp, reporte y visto bueno.
- Mensajería con polling, cotizaciones y tratos (pago, cierre, comprobante).
- Mi actividad completa y panel de moderación con señales de colusión.
- Accesibilidad: letra grande, alto contraste y lectura en voz alta.
- Cola de envíos sin conexión y aviso de red.
- Recorrido guiado (tour) en formato de tarjetas paso a paso.

## Diferencias conocidas frente a la web

- **Dictado por voz**: el micrófono muestra un aviso; la transcripción necesita
  un módulo nativo que Expo Go no incluye. La lectura en voz alta sí funciona.
- **Tour**: en móvil es una tarjeta por paso que navega entre pestañas, sin
  resaltar elementos concretos de la pantalla.
- **Mapa**: cuadrícula de teselas de OpenStreetMap con `expo-image` y enlace a
  Google Maps; no usa un SDK de mapas nativo.
- Los pagos siguen siendo directos entre vecinos: la app no procesa dinero.

## Validación

```bash
npx expo export --platform android   # bundle de producción Android
npx expo export --platform web       # bundle web
npx expo-doctor                      # 20/20 checks
```

Pruebas de humo realizadas sobre el bundle web en Chromium (móvil 412×900):
login, perfil, moderación, detalle, tutorial, emergencia, actividad, mensajes y
recuperación de PIN, sin errores de consola.
