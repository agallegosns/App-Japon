import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { setPwaState } from './app/pwaState';
import { recordAppOpen } from './features/lab/labDb';
import './ui/global.css';
import './ui/components.css';

// Solicita almacenamiento persistente (Safari lo concede a las apps instaladas).
if (navigator.storage?.persist) {
  navigator.storage.persist().catch((e: unknown) => console.warn('persist() falló', e));
}

// Contador de aperturas para la prueba de persistencia del Laboratorio.
recordAppOpen().catch((e: unknown) => console.warn('No se pudo registrar la apertura', e));

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      setPwaState({ needRefresh: true, applyUpdate: () => updateSW(true) });
    },
    onOfflineReady() {
      setPwaState({ offlineReady: true });
    },
    onRegisteredSW(_url, registration) {
      setPwaState({ registration: registration ?? null });
      if (!registration) return;
      // Busca versiones nuevas al volver a la app (sin temporizadores ni recargas automáticas).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => undefined);
        }
      });
    },
    onRegisterError(error: unknown) {
      setPwaState({ registerError: error instanceof Error ? error.message : String(error) });
    },
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
