import { isStandalone } from '../../app/standalone';
import { formatBytes, getStorageInfo } from '../../storage/persistence';

export async function deviceInfoLines(): Promise<string[]> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lines = [
    `Fecha: ${new Date().toISOString()}`,
    `App: ${__APP_VERSION__} (${__COMMIT__}), compilada ${__BUILD_TIME__}`,
    `Agente: ${navigator.userAgent}`,
    `Modo: ${isStandalone() ? 'instalada (pantalla de inicio)' : 'pestaña del navegador'}`,
    `Pantalla: ${screen.width}×${screen.height} @${window.devicePixelRatio}x, ventana ${window.innerWidth}×${window.innerHeight}`,
    `Idioma: ${navigator.language}; zona: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    `Núcleos: ${navigator.hardwareConcurrency ?? 'desconocido'}; memoria: ${nav.deviceMemory ? `${nav.deviceMemory} GB` : 'no informada'}`,
    `Conexión (navigator.onLine): ${navigator.onLine ? 'sí' : 'no'}`,
    `Service worker controlando: ${navigator.serviceWorker?.controller ? 'sí' : 'no'}`,
    `WebAssembly: ${typeof WebAssembly === 'object' ? 'sí' : 'no'}; SharedArrayBuffer: ${typeof SharedArrayBuffer === 'function' ? 'sí' : 'no'}; crossOriginIsolated: ${String(self.crossOriginIsolated)}`,
    `OPFS: ${typeof navigator.storage?.getDirectory === 'function' ? 'sí' : 'no'}; WebGPU: ${'gpu' in navigator ? 'sí' : 'no'}`,
  ];
  try {
    const s = await getStorageInfo();
    lines.push(`Almacenamiento: persistente=${String(s.persisted)}, uso ${formatBytes(s.usage)} de ${formatBytes(s.quota)}`);
  } catch (e) {
    lines.push(`Almacenamiento: error ${e instanceof Error ? e.message : String(e)}`);
  }
  return lines;
}
