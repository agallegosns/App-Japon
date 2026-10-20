# CLAUDE.md — Nihon Trip

Instrucciones permanentes para cualquier sesión de Claude Code (PC o móvil) que trabaje en este repositorio.
Léelas antes de tocar nada y respétalas siempre.

## Contexto

PWA personal para planificar y vivir un viaje a Japón. La usan **2 personas** con **iPhone 15 y iPhone 16**,
en **Safari**, **instalada en la pantalla de inicio**. Publicada en https://agallegosns.github.io/App-Japon/.

El usuario **no programa**: nunca le pidas que ejecute comandos ni que edite archivos. Si algo solo se puede
comprobar en el iPhone, dale los pasos exactos (qué pulsar y qué debería ver).

## Reglas permanentes

- **Coste 0 €.** Sin backend, sin cuentas, sin Firebase/Supabase ni servicios de pago.
- **Repositorio PÚBLICO.** Jamás incluir datos personales, fechas o datos reales del viaje, reservas,
  documentos, capturas ni claves. Los ejemplos y tests usan datos genéricos (años 2030+, "Hotel de prueba").
  `.gitignore` excluye exportaciones y carpetas de datos. Los datos reales solo se introducen dentro de la app.
- **Offline-first.** Datos en IndexedDB con Dexie; archivos (PDF, imágenes, QR) como `Blob` en IndexedDB;
  se solicita `navigator.storage.persist()`.
- **Interfaz en español.** Fechas y horas se guardan como fecha + hora local + zona IANA (por defecto
  `Asia/Tokyo`; los vuelos llevan zona de origen en la salida y de destino en la llegada).
- **Diseño:** japonés contemporáneo, fondo claro, tonos neutros, rojo discreto como acento, tarjetas limpias
  con esquinas redondeadas, buena jerarquía tipográfica. Fuente del sistema + Noto Sans JP autoalojada para
  japonés. Iconos SVG de `lucide-react`; **NUNCA emojis como iconos**. Zonas táctiles ≥ 44 pt, safe areas del
  iPhone, `rem` para el texto, contraste AA. Sin efectos innecesarios. Tokens en `src/ui/tokens.css`.
- **Calidad:** TypeScript estricto, sin errores silenciados (`@ts-ignore`, `any`, `catch {}` vacíos), sin
  botones sin función, sin datos ficticios presentados como reales, sin pantallas que simulen operaciones.
  Cambios localizados en vez de reescribir archivos completos.
- **Nunca declarar algo como funcionando sin probarlo.** Lo que solo se puede verificar en un iPhone se marca
  en `TASKS.md` como "pendiente de verificar en dispositivo".
- Mantener actualizados `README.md` (uso y estado), `TASKS.md` (pendientes/hechas/bloqueadas) y
  `ARCHITECTURE.md` (decisiones y limitaciones de cada integración).
- **CI en verde antes de cada commit a `main`** (`npm run ci` en local: typecheck, lint, tests y build).
  Un commit al cerrar cada fase.

## Reglas de durabilidad (la app debe funcionar sin fallos 7 meses y todo el viaje)

- **Nada que caduque:** sin workflows programados (`schedule`/cron). El despliegue solo ocurre con push a `main`.
  El workflow "Recursos offline" es manual y guarda su resultado en la rama `offline-assets`.
- **Versiones fijadas:** `package-lock.json` y versiones exactas en `package.json` (sin `^` ni `~`; `.npmrc`
  tiene `save-exact=true`).
- **Las actualizaciones nunca borran ni corrompen datos.** El esquema Dexie está en
  `src/storage/schema.ts` (`SCHEMA_HISTORY`): solo se AÑADEN versiones al final, nunca se modifican las
  publicadas. Cada versión nueva lleva su fixture y test en `src/storage/migrations.test.ts` que abre datos
  de la versión anterior. El formato de copia (`BACKUP_FORMAT_VERSION`) también es versionado.
- **Service worker:** la versión nueva se instala en segundo plano y la app muestra "Actualización disponible";
  solo se aplica cuando el usuario pulsa "Actualizar". **Nunca se recarga sola.** Si el sitio no responde, la
  app funciona entera desde caché (todo el código, fuentes e iconos están precacheados).
- **Copias de seguridad:** Ajustes muestra la fecha de la última copia; la pantalla Viaje avisa si no hay copia
  en 14 días o tras cambios importantes. Exportación con la hoja de compartir (Archivos/iCloud Drive/AirDrop).
- **Aviso** visible si la app se abre desde Safari y no desde la pantalla de inicio.
- **Ajustes** muestra si el almacenamiento persistente está concedido y el espacio usado.
- README: sección "No hacer nunca" y checklist de congelación de versión antes del viaje.

## Stack y estructura

Vite + React + TypeScript, React Router con `HashRouter`, Dexie, vite-plugin-pwa (Workbox, estrategia
`injectManifest` con `src/sw.ts`), Vitest + fake-indexeddb + Testing Library, ESLint.

```
src/
  app/        navegación, layout, avisos globales, estado del service worker
  ui/         sistema de diseño (tokens.css, components.css y componentes)
  models/     tipos, fechas/zonas horarias, avisos y solapes
  storage/    Dexie (db, schema, repositorios), copias de seguridad, persistencia
  features/   trip, bookings, itinerary, map, translator, offline, settings, lab
  sw.ts       service worker
```

Base de publicación: `/App-Japon/` (Vite `base`, `scope` y `start_url` del manifest y del service worker).

## Comandos (los ejecuta Claude, no el usuario)

- `npm ci` · `npm run dev` · `npm run ci` (typecheck + lint + tests + build) · `npm run preview`
- Para probar la app compilada en Chromium: `npm run build && npx vite preview` y Playwright con
  `executablePath: '/opt/pw-browsers/chromium'` (no ejecutar `playwright install`).

## Fases

1. Base y Laboratorio — hecha. 2. Interfaz y navegación — hecha. 3. Reservas, itinerario y almacenamiento —
hecha. **Siguientes:** mapas y traductor (no empezar sin que el usuario lo pida). Ver `TASKS.md`.
