# Arquitectura y decisiones

## Visión general

PWA estática (Vite + React + TypeScript) publicada en GitHub Pages bajo `/App-Japon/`. Sin backend.
Todo el estado vive en IndexedDB del dispositivo; la app completa se precachea con un service worker propio.

```
HashRouter (rutas #/...) → páginas en src/features/* → repositorios en src/storage/* → Dexie/IndexedDB
                                                    ↘ src/models/* (tipos, fechas, avisos: lógica pura y testeada)
```

## Decisiones

### Enrutado: HashRouter
GitHub Pages no permite reescrituras de URL. Con `#/ruta` cualquier navegación sirve `index.html`, tanto en
línea como desde la caché del service worker.

### Datos: Dexie sobre IndexedDB
- Base `nihon-trip`, tablas `trips`, `days`, `bookings`, `attachments`, `activities`, `meta`.
- Un único viaje por app. Los días se generan a partir de las fechas del viaje y guardan la ciudad.
- Adjuntos como `Blob` en la tabla `attachments` (no en Cache Storage ni OPFS) para que entren en las mismas
  transacciones, copias y borrados que el resto de datos. Límite de 60 MB por archivo.
- **Migraciones:** `src/storage/schema.ts` contiene el historial completo (`SCHEMA_HISTORY`). Regla: solo se
  añaden versiones; cada una con fixture y test en `migrations.test.ts` que crea la base con versiones antiguas
  y la abre con la actual comprobando que los datos siguen intactos.
- `meta` guarda la fecha de la última copia y contadores de cambios desde entonces (aviso de copia).
- El Laboratorio usa otra base (`nihon-lab`) para que sus 100 MB de prueba nunca entren en las copias.

### Fechas y zonas horarias
`LocalDateTime = { date: 'AAAA-MM-DD', time: 'HH:mm' | null, tz: 'Zona/IANA' }`. Se guarda la hora local tal
como figura en la reserva. Para ordenar, calcular la próxima reserva o la duración de un vuelo se convierte a
instante con `Intl.DateTimeFormat` (`zonedToEpoch`), sin librerías externas. Los vuelos y trenes guardan la
zona de origen en la salida y la de destino en la llegada. Por defecto `Asia/Tokyo`.

### Copias de seguridad (fflate)
Zip con `manifest.json` (formato, versión de formato, versión de esquema, fecha, recuentos), `data.json` y
`attachments/<id>-<nombre>`. Los adjuntos se guardan sin recomprimir. La importación valida todo (incluido el
tamaño de cada adjunto) antes de tocar la base, muestra una vista previa y permite:
- **Reemplazar:** borra y restaura exactamente la copia, en una transacción.
- **Combinar:** añade lo nuevo; si un elemento existe en los dos sitios gana el `updatedAt` más reciente. Como
  hay un único viaje, los días entrantes se reasignan al viaje existente.
Se rechazan copias hechas con una versión más nueva de la app. Exportación con `navigator.share({ files })`
(hoja de compartir de iOS: Archivos, iCloud Drive, AirDrop); si no existe, descarga.

### Service worker (Workbox, `injectManifest`)
- Precachea todo el build: HTML, JS (incluidos los chunks del laboratorio, MapLibre, pdf.js y el worker de
  traducción), CSS, fuentes Noto Sans JP 400/700 (woff2), iconos, imágenes de prueba y los recursos de pdf.js
  (cmaps CJK, fuentes estándar, decodificadores WASM). ≈ 14 MB.
- **No** precachea los recursos grandes del laboratorio (OCR ≈ 8 MB, ONNX Runtime ≈ 21 MB, modelos y mapas):
  se descargan bajo demanda y quedan en Cache Storage (`nihon-ocr-v1`, `nihon-ort-v1`, `transformers-cache`)
  o en IndexedDB.
- `registerType: 'prompt'`: la versión nueva queda en espera; el aviso «Actualización disponible» envía
  `SKIP_WAITING` solo cuando el usuario pulsa. Se buscan versiones nuevas al volver a la app (sin temporizadores).
- Mensaje `PRECACHE_STATUS`: el SW comprueba uno a uno los archivos precacheados; lo usa «Preparar Japón sin
  conexión» para verificar de verdad que la app está guardada.

### Visor de PDF
pdf.js renderiza cada página en canvas (Safari en modo app no muestra bien PDFs de varias páginas en iframe).
Los cMaps CJK se incluyen para PDFs japoneses. Las imágenes de QR se muestran sobre blanco con aviso de subir el
brillo (la web no puede cambiar el brillo) y Screen Wake Lock para que la pantalla no se apague.

### Reordenación
`ReorderList` usa Pointer Events sobre un asa con `touch-action: none` (funciona con dedo y ratón); como
alternativa accesible cada parada tiene botones Subir/Bajar. El orden se guarda en `order` dentro de cada día.

### Integraciones del Laboratorio y sus limitaciones

| Prueba | Implementación | Limitaciones conocidas |
| --- | --- | --- |
| Almacenamiento | `persist()`, `estimate()`, 10 Blobs de 10 MB en IndexedDB verificados por muestreo; contador de aperturas. | Safari solo concede persistencia a apps instaladas; la cuota real se ve en el dispositivo. |
| OCR | Tesseract.js 6 en worker propio (`workerBlobURL: false`), núcleo LSTM WASM (con y sin SIMD) y `jpn`/`jpn_vert` 4.0.0_best_int autoalojados en `/tesseract/`. | ≈ 8 MB por dispositivo. Precisión baja con fotos torcidas o poca luz. Verificado en Chromium (97–100 % en las imágenes de prueba, también sin red); pendiente en iPhone. |
| Traducción | Transformers.js 3.8.1 en worker, ONNX Runtime WASM autoalojado en `/ort/`, 1 hilo (Pages no permite cross-origin isolation), modelos q8. Dos opciones: `opus-mt-ja-es` convertido por el workflow «Recursos offline» y servido desde `/offline/models/`, o `Xenova/opus-mt-ja-en` + `Xenova/opus-mt-en-es` desde Hugging Face. | No existe una conversión pública de `opus-mt-ja-es` para Transformers.js: hay que generarla en Actions. Calidad de OPUS-MT ja→es modesta. Riesgo de cierre de Safari por memoria (≈ 100–300 MB): el Laboratorio lo detecta si la prueba no terminó. Alternativas evaluadas: NLLB-200 600M y M2M100 418M son demasiado grandes (> 500 MB) para Safari en iPhone. No verificable en este entorno (huggingface.co bloqueado). |
| Mapas | MapLibre GL 6 + PMTiles 4. El extracto se descarga entero a IndexedDB y una fuente PMTiles propia lee rangos del Blob (`blob.slice`), así que no se usa la red. Estilo sin etiquetas (no requiere glifos remotos). | El extracto de prueba (centro de Kioto, z ≤ 15) lo genera el workflow «Recursos offline» con `pmtiles extract` desde el build diario de Protomaps. Etiquetas, búsqueda y extractos completos: siguiente fase. |
| GPS | `getCurrentPosition` solo al pulsar. | En modo avión puede tardar más. |
| Cámara | Compara `<input capture>` con `getUserMedia` en modo instalado. | iOS ha tenido fallos de `getUserMedia` en apps de pantalla de inicio: por eso se prueban ambos. |
| Conexión | `navigator.onLine` + petición real sin caché. | `onLine` puede decir «en línea» con una wifi sin salida: la comprobación real lo detecta. |

### Recursos offline grandes y límites de GitHub Pages
GitHub Pages: sitio ≤ 1 GB, archivos ≤ 100 MB, ancho de banda orientativo 100 GB/mes. El CI falla si el sitio
supera 900 MB o algún archivo 95 MB. El workflow manual **Recursos offline** genera una vez el extracto de mapa
y el modelo de traducción y los guarda en la rama `offline-assets`; cada despliegue los copia a `/offline/`.
Así los despliegues no dependen de servicios externos.

**Para los mapas completos de la siguiente fase** (varias ciudades, decenas o cientos de MB), alternativas
gratuitas: (1) extractos por ciudad < 95 MB cada uno en la propia GitHub Pages (Tokio, Kioto, Osaka…);
(2) publicarlos como *assets* de GitHub Releases (hasta 2 GB por archivo) descargados por la app — no admiten
CORS directo, por lo que habría que comprobarlo; (3) Cloudflare R2 (10 GB gratis, admite CORS y rangos) si las
dos anteriores no bastan. Recomendación: (1).

### Licencias
OpenStreetMap: ODbL — la atribución «© OpenStreetMap» debe verse en el mapa (control de atribución de
MapLibre). Protomaps basemap: datos OSM con licencia ODbL. OPUS-MT: CC-BY 4.0 (atribución en README).
Tesseract: Apache 2.0. Noto Sans JP: OFL 1.1.

### Dependencias y seguridad
Versiones exactas. `maplibre-gl` 6.15, `pdfjs-dist` 6.4 y `react-router-dom` 7.18 se eligieron por avisos de
seguridad en versiones anteriores. `npm audit` informa de `sharp`/`onnxruntime-node` dentro de
`@huggingface/transformers`: son dependencias solo de Node, que el navegador nunca carga.
