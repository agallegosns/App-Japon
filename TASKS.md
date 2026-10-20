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
- [hecho] d) Mapas MapLibre + PMTiles desde archivo local en IndexedDB. **[dispositivo]**
- [hecho] e) GPS, f) Cámara (input capture vs getUserMedia), g) Conexión. **[dispositivo]**
- [bloqueado] Ejecutar el workflow «Recursos offline» (extracto de Kioto + conversión de opus-mt-ja-es).
  Ver estado en la sección «Recursos offline».

## Fase 2 — Interfaz y navegación

- [hecho] Tokens (color, tipografía, espaciado, radios) y componentes: botón, tarjeta, campos, fecha/hora con
  zona, hoja inferior, diálogo de confirmación (con confirmación escrita), estados vacío/carga/error, toast,
  etiqueta de estado, segmentado, lista reordenable.
- [hecho] Navegación inferior fija (Viaje, Itinerario, Mapa, Traductor, Reservas) con safe areas.
- [hecho] Accesos a Ajustes y «Preparar Japón sin conexión» desde la cabecera de Viaje.
- [hecho] Mapa y Traductor: estado honesto «En desarrollo — próxima fase» con enlace al Laboratorio.
- [dispositivo] Revisar tamaños táctiles, safe areas (isla dinámica, barra de inicio) y Dynamic Type.

## Fase 3 — Reservas, itinerario y almacenamiento

- [pendiente]

## Recursos offline (workflow manual)

- [pendiente] Ejecutar «Recursos offline» en Actions y volver a desplegar `main`.

## Siguientes fases (no empezar sin petición)

- [pendiente] Mapas sin conexión completos (extractos por ciudad, etiquetas, marcadores de actividades).
- [pendiente] Traductor (cámara → OCR → traducción) según los resultados del Laboratorio.
