/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// URL de publicación: https://agallegosns.github.io/App-Japon/
const BASE = '/App-Japon/';

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // La actualización solo se aplica cuando el usuario pulsa "Actualizar".
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: BASE,
        name: 'Nihon Trip',
        short_name: 'Nihon Trip',
        description: 'Planificador de viaje a Japón que funciona sin conexión.',
        lang: 'es',
        dir: 'ltr',
        scope: BASE,
        start_url: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f5f1',
        theme_color: '#f7f5f1',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,webmanifest,jpg}', 'pdfjs/**/*'],
        // Recursos grandes de OCR, traducción y mapas: se descargan bajo demanda
        // desde el Laboratorio y quedan en Cache Storage / IndexedDB.
        globIgnores: ['tesseract/**', 'ort/**', 'offline/**', '**/*.map'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 3000,
  },
  worker: { format: 'es' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
