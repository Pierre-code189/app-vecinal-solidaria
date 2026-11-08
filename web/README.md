# Vecinal · web (React)

Frontend de Vecinal Solidaria. React 19 + Vite + React Router + TanStack Query.
El backend es el FastAPI de `../app`, sin cambios: la app consume `/api/*`.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173 con proxy a 127.0.0.1:8010
```

## Publicación

```bash
npm run build   # escribe en ../app/static (index.html + assets con hash)
sudo systemctl restart vecinal
```

## Estructura

```
src/
  components/  ui.jsx (botón, campo, selector, hoja, avisos), Shell, Detalle, Publicar
  context/     Auth (sesión) y Zona (sector y GPS)
  lib/         api (sesión + cola sin conexión), format, icons (sprite propio)
  screens/     Local, Favores, Emergencia, Actividad, Perfil, Tutorial, Moderacion, Recuperar
  styles/      base.css (sistema de color, componentes y capa React)
```

Decisiones que conviene no deshacer:
- El selector es propio y se monta en `body`; dentro de un modal se abre como hoja inferior.
- Los mosaicos vienen de `tile.openstreetmap.fr` con respaldo Esri (el servidor de OSM bloquea).
- La barra inferior se oculta en escritorio; la navegación superior toma el relevo.
