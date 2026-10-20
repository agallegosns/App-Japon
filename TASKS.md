# Tareas

Leyenda: **[hecho]** implementado y probado en CI/Chromium · **[dispositivo]** pendiente de verificar en
iPhone · **[pendiente]** sin hacer · **[bloqueado]** depende de algo externo.

## Fase 1 — Base y Laboratorio

- [hecho] Proyecto Vite + React + TS estricto, ESLint, Vitest, versiones exactas y lockfile.
- [hecho] Manifest PWA con iconos propios (192, 512, maskable, apple-touch-icon); base `/App-Japon/`.
- [hecho] Service worker propio (Workbox injectManifest) que precachea la app completa (≈ 14 MB).
- [hecho] CI en GitHub Actions (typecheck, lint, tests, build, límites de Pages) y despliegue en `main`.
- [hecho] Laboratorio (`#/lab`, desde Ajustes) con «Copiar informe» y datos del dispositivo.
- [hecho] a) Almacenamiento: persist, estimate, 100 MB de Blobs escritos/releídos, contador de aperturas.
  Verificado en Chromium. **[dispositivo]**
- [hecho] b) OCR jpn + jpn_vert con recursos autoalojados y cacheados. Verificado en Chromium con y sin red
  (97 % y 100 %). **[dispositivo]**
- [hecho] c) Traducción con Transformers.js (directo ja→es o ja→en→es), detección de cierre de Safari.
  **[dispositivo]** — no verificable en el entorno de desarrollo (Hugging Face bloqueado).
- [hecho] d) Mapas MapLibre + PMTiles desde archivo local en IndexedDB. Extracto de Kioto generado (6,2 MB)
  y verificado en Chromium sin red. **[dispositivo]**
- [hecho] e) GPS, f) Cámara (input capture vs getUserMedia), g) Conexión. **[dispositivo]**
- Workflow «Recursos offline»: ver la sección «Recursos offline».

## Fase 2 — Interfaz y navegación

- [hecho] Tokens (color, tipografía, espaciado, radios) y componentes: botón, tarjeta, campos, fecha/hora con
  zona, hoja inferior, diálogo de confirmación (con confirmación escrita), estados vacío/carga/error, toast,
  etiqueta de estado, segmentado, lista reordenable.
- [hecho] Navegación inferior fija (Viaje, Itinerario, Mapa, Traductor, Reservas) con safe areas.
- [hecho] Accesos a Ajustes y «Preparar Japón sin conexión» desde la cabecera de Viaje.
- [hecho] Mapa y Traductor: estado honesto «En desarrollo — próxima fase» con enlace al Laboratorio.
- [dispositivo] Revisar tamaños táctiles, safe areas (isla dinámica, barra de inicio) y Dynamic Type.

## Fase 3 — Reservas, itinerario y almacenamiento

- [hecho] Modelos y repositorios Dexie con esquema versionado y test de migración.
- [hecho] Reservas: crear/editar/eliminar (con confirmación), lista por fecha y por categoría, filtros, detalle,
  adjuntos (PDF, imagen, QR/código), visor a pantalla completa, dirección en japonés a pantalla completa,
  copiar dirección y localizador, enlaces externos, avisos de datos que faltan.
- [hecho] Itinerario: días y ciudades, vista diaria y cronológica, reordenar (arrastre y botones), añadir/
  eliminar paradas, asociar reservas, marcar hecha/omitida, copiar dirección, solapes y avisos.
- [hecho] Pantalla Viaje con cuenta atrás, día/ciudad actual, próxima actividad y reserva, accesos rápidos,
  información pendiente, aviso de copia y estado sin conexión. Estados vacíos con acción.
- [hecho] Ajustes: exportar (zip, hoja de compartir), importar con vista previa (combinar/reemplazar), borrar
  todo con doble confirmación, almacenamiento persistente y espacio, versión y búsqueda de actualización.
- [hecho] «Preparar Japón sin conexión» con comprobaciones reales; mapas y traducción «pendiente de fase».
- [hecho] Tests: CRUD de reservas y actividades, adjuntos, reordenación, solapes, exportar→importar, migraciones.
- [hecho] Recorrido completo probado en Chromium (crear, adjuntar, exportar, borrar, importar, modo sin conexión).
- [dispositivo] Hoja de compartir con el zip → Guardar en Archivos y AirDrop.
- [dispositivo] Importar el zip desde Archivos en el otro iPhone.
- [dispositivo] Visor de PDF real de una reserva (varias páginas, japonés).
- [dispositivo] Arrastre para reordenar con el dedo.
- [dispositivo] Pantalla completa del QR y que no se apague la pantalla (Wake Lock).
- [dispositivo] Aviso «Actualización disponible» tras un despliegue y que no se recargue sola.

## Recursos offline (workflow manual)

- [hecho] Extracto PMTiles del centro de Kioto (6,2 MB, Protomaps 4.15) en la rama `offline-assets`.
- [hecho] Primer intento de conversión de opus-mt-ja-es: la exportación a ONNX funcionó, pero la validación
  estricta rechazó el decodificador cuantizado (`ShapeInferenceError`). Corregido: se relaja solo ese caso y el
  workflow ahora comprueba que el modelo traduce de verdad con Transformers.js antes de publicarlo.
- [pendiente] Resultado del segundo intento de conversión (ver resumen de la sesión / Actions).

## Siguientes fases (no empezar sin petición)

- [pendiente] Mapas sin conexión completos (extractos por ciudad, etiquetas, marcadores de actividades).
- [pendiente] Traductor (cámara → OCR → traducción) según los resultados del Laboratorio.
