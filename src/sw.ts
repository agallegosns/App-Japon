/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const manifest = self.__WB_MANIFEST;
const BASE = new URL(self.registration.scope).pathname;

// La app completa (HTML, JS, CSS, fuentes, iconos) queda precacheada al instalar.
precacheAndRoute(manifest);
cleanupOutdatedCaches();

// HashRouter: cualquier navegación dentro del scope sirve index.html desde caché.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Recursos grandes descargados bajo demanda desde el Laboratorio (OCR y motor de traducción).
const RUNTIME_CACHES = { ocr: 'nihon-ocr-v1', ort: 'nihon-ort-v1' } as const;

registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith(`${BASE}tesseract/`),
  new CacheFirst({ cacheName: RUNTIME_CACHES.ocr }),
);
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith(`${BASE}ort/`),
  new CacheFirst({ cacheName: RUNTIME_CACHES.ort }),
);

// La versión nueva se instala en segundo plano y espera: solo se activa cuando
// el usuario pulsa "Actualizar" (mensaje SKIP_WAITING). Nunca se recarga sola.
self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  } else if (data?.type === 'PRECACHE_STATUS') {
    const port = event.ports[0];
    if (!port) return;
    event.waitUntil(
      (async () => {
        const missing: string[] = [];
        for (const entry of manifest) {
          const res = await matchPrecache(entry.url);
          if (!res) missing.push(entry.url);
        }
        port.postMessage({ total: manifest.length, cached: manifest.length - missing.length, missing });
      })(),
    );
  }
});

clientsClaim();
