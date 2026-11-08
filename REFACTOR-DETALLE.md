# Refactor: dividir el detalle en tres componentes

Estado: **ejecutado en v4.12.1** (sesión dedicada; `DetallePub.jsx` eliminado).
Archivo actual: `web/src/components/DetallePub.jsx` (~300 líneas, un solo componente con condicionales por tipo).

## Por qué

Hoy un favor muestra precio y pago, una emergencia no muestra su recurso y un servicio y un favor comparten acciones que no aplican. El objetivo es que cada tipo tenga su ficha, sin duplicar la cabecera ni el mapa.

## Estructura propuesta

```
components/detalle/
  DetalleBase.jsx        # hoja, cabecera (categoría, título, autor, distancia), mapa, cierre
  DetalleServicio.jsx    # servicio y producto
  DetalleFavor.jsx       # favor_solicitado y favor_ofrecido
  DetalleEmergencia.jsx  # es_emergencia
  index.jsx              # elige el componente según p.tipo / p.es_emergencia
```

`DetalleBase` recibe `p`, `onClose`, `refrescar` y un `children` con el cuerpo y las acciones. Así el mapa y la cabecera viven en un solo sitio.

## Qué muestra cada uno

**Servicio / producto**
- Hechos: Precio · Pago · Vistos · Disponibles (solo producto).
- Cuerpo: descripción, «Datos para pagar» (Yape/Plin) si no es intercambio.
- Acciones: Consultar al vecino (67 %) + WhatsApp (33 %); si hay trato, los pasos del trato; reportar.

**Favor**
- Hechos: Estado (Abierto/Pausado) · Vistos · Cuándo (franja) · Garante (si existe).
- Sin precio ni medios de pago.
- Acciones: Consultar al vecino + WhatsApp; «Ofrecer ayuda» cuando es `favor_solicitado`; reportar.

**Emergencia**
- Hechos: Recurso (necesidad) · Urgencia · Teléfono visible con sesión · Estado del tablero.
- Acciones: Coordinar por la app + llamar; sin cotización ni trato.

## Dependencias que no se pueden romper

- `p.mi_trato` y `p.mi_cotizacion` (los pone `GET /api/publicaciones/{pid}`); de ellos dependen los botones de pago, cierre y visto bueno.
- `abrirConversacion()` crea la cotización cuando no existe; el chat se abre con `Conversacion`.
- `p.es_mio` oculta acciones y muestra el aviso de gestión.
- `soloIntercambio` y `esFavor` ocultaban bloques; con la división desaparecen los condicionales.

## Pasos

1. Extraer `DetalleBase` sin cambiar comportamiento y verificar que el detalle de servicio se ve igual (captura antes/después).
2. Crear `DetalleFavor` con los hechos y acciones de favor; probar Necesito y Ofrezco.
3. Crear `DetalleEmergencia`; probar un recurso del tablero.
4. `index.jsx` decide según `es_emergencia`, tipo `favor_*` o servicio/producto.
5. Reemplazar los imports en `screens/Local.jsx`, `screens/Favores.jsx` y `screens/Emergencia.jsx`.

## Criterios de aceptación

- `scripts/verificar.py` en verde (105 comprobaciones).
- `pytest` en verde (11 pruebas).
- Flujo completo probado con dos cuentas: cotizar → aceptar → confirmar → pagar con comprobante → cerrar → visto bueno.
- Capturas móvil y escritorio de los tres detalles.
- Sin cambios en `app/main.py`, `app/db.py` ni en el contrato de la API.

## Riesgos

- El detalle es el punto donde vive el dinero simbólico: cualquier cambio en las condiciones de las acciones puede dejar un trato sin forma de cerrarse. Probar con un trato real, no solo con la lista.
- El mapa y la hoja (`Sheet`) tienen `z-index` propios; al mover JSX hay que conservar la jerarquía (`selector 1100`, `modal 900`).
