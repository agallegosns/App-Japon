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
- [hecho] c) Traducción con Transformers.js (ja→en→es con modelos Xenova desde Hugging Face), detección de
  cierre de Safari. **[dispositivo]** — no verificable en el entorno de desarrollo (Hugging Face bloqueado).
- [bloqueado] Modelo directo opus-mt-ja-es: la conversión con los scripts de Transformers.js 3.8.1 genera un
  decodificador que falla al ejecutarse (`Slice: Starts must be a 1-D array`) y pesa 185 MB (más de los
  100 MB por archivo de GitHub Pages; ≈ 236 MB en total). No se ha publicado. Ver ARCHITECTURE.md.
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
- [bloqueado] Conversión de opus-mt-ja-es: tres intentos. La exportación funciona, pero el decodificador
  fusionado cuantizado no se puede ejecutar (error real de ONNX Runtime en la comprobación de traducción) y su
  tamaño (185 MB) supera el límite de Pages. El workflow no publica nada que no traduzca o no quepa.

## v0.4.0 — Cambios pedidos por el usuario

- [hecho] Vuelos con escalas: tramos con aeropuerto, hora local y zona; duración de cada escala; aviso de escala corta.
- [hecho] Buscador de aeropuertos/ciudades sin conexión (p. ej. Hong Kong).
- [hecho] Alojamiento de cada noche en el Itinerario (automático por fechas o elegido a mano) y avisos de check-in/out.
- [hecho] Traductor solo con cámara (foto → OCR → traducción sobre la foto); aviso «Sin conexión en este momento».
- [hecho] Traductor y Mapa con conexión; «Preparar Japón sin conexión» limitado a reservas, documentos e itinerario.
- [hecho] Sin localizadores ni QR/códigos de barras; migración v2 y saneado de copias antiguas.
- [hecho] Retirada de la traducción local (Transformers.js) y de su Laboratorio.
- [dispositivo] Cámara en vivo en la app instalada (si falla: botón «Hacer una foto»).
- [dispositivo] Calidad del OCR con fotos reales (carteles, menús, máquinas) y tiempo de la primera carga.
- [dispositivo] Traducción real con MyMemory desde datos móviles y desde wifi; comprobar el aviso de límite diario.
- [dispositivo] Revisar el formulario de vuelo con teclado en el iPhone (buscador de aeropuertos).
- [hecho] Aviso de actualización rojo, grande y fijo arriba, con botón «Actualizar ahora».
- [hecho] Lector del traductor mejorado tras un fallo real («no se ha encontrado texto japonés» con fotos): contraste,
  imagen invertida (letras blancas sobre rojo/azul), modos de lectura disperso/automático y suma de resultados.
  Probado en Chromium con 3 fotos sintéticas (cartel rojo, menú, señal de estación) que antes no daban nada;
  la lectura sigue siendo imperfecta con fotos borrosas o muy inclinadas (límite de Tesseract).
- [pendiente] Borrar a mano `src/features/lab/TranslationLab.tsx` y `translation.worker.ts` (están vacíos a propósito).

## v0.5.0 — Diseño, itinerario y avisos

- [hecho] Itinerario rediseñado: cabecera compacta del día, actividades como línea de tiempo con la hora a la izquierda,
  alojamiento de la noche en un chip; «parada» pasa a «actividad» con una explicación en el estado vacío.
- [hecho] Días de vuelo diferenciados: chip rojo con avión en el selector y bloque «Día de vuelo» (ruta, horas locales, escalas).
- [hecho] Reservas del día (restaurantes, entradas, trenes) en el itinerario sin repetir las enlazadas desde una actividad.
- [hecho] Inicio: el itinerario de hoy (o del próximo día con plan) sustituye a «Próxima actividad»; tarjeta del viaje renovada.
- [hecho] Pulido general: tarjetas, títulos, accesos rápidos, barra inferior.
- [hecho] Avisos: exportación al Calendario del iPhone (.ics) con alarmas. Probado: formato, zonas horarias, escapes.
- [dispositivo] Que la hoja de compartir abra «Calendario» con el .ics y añada los eventos con sus avisos.
- [dispositivo] Revisar el aspecto del rediseño en el iPhone (tamaños, selector de ciudad, texto largo).
- [bloqueado] Notificaciones push reales: requieren un servidor de envío; descartado por la regla de no usar backend.
- [pendiente] Traductor más preciso con Google Cloud (Vision + Translation) usando una clave del usuario guardada solo
  en el móvil: pendiente de que el usuario decida si crea la cuenta (requiere tarjeta; cuota gratuita mensual).

## Siguientes fases (no empezar sin petición)

- [pendiente] Mapa con conexión (marcadores de actividades y alojamientos, ubicación GPS).
