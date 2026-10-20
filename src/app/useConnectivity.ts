import { useEffect, useState } from 'react';

/** Estado de conexión según el navegador (navigator.onLine y eventos online/offline). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Comprobación real de red: pide un recurso del sitio saltándose la caché.
 * Devuelve la latencia en ms o lanza el error de red.
 */
export async function probeNetwork(timeoutMs = 6000): Promise<number> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}manifest.webmanifest?probe=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Math.round(performance.now() - t0);
  } catch (e) {
    if (controller.signal.aborted) throw new Error(`Sin respuesta en ${timeoutMs / 1000} s`);
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}
