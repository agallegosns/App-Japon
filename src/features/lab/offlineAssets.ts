import { formatBytes } from '../../storage/persistence';

/** Nombre de caché compartido con el service worker (src/sw.ts). */
export const OCR_CACHE = 'nihon-ocr-v1';

export function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).href;
}

export const OCR_FILES = [
  'tesseract/worker.min.js',
  'tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'tesseract/core/tesseract-core-lstm.wasm.js',
  'tesseract/lang/jpn.traineddata.gz',
  'tesseract/lang/jpn_vert.traineddata.gz',
];

export interface CacheReport {
  ok: boolean;
  bytes: number;
  lines: string[];
}

/** Descarga (si falta) cada archivo a Cache Storage y comprueba que se puede leer entero desde la caché. */
export async function ensureCached(cacheName: string, paths: string[], onProgress?: (msg: string) => void): Promise<CacheReport> {
  if (!('caches' in window)) throw new Error('Cache Storage no está disponible.');
  const cache = await caches.open(cacheName);
  const lines: string[] = [];
  let bytes = 0;
  let ok = true;
  for (const [i, path] of paths.entries()) {
    const url = assetUrl(path);
    onProgress?.(`Archivo ${i + 1}/${paths.length}: ${path.split('/').pop() ?? path}`);
    let res = await cache.match(url);
    let origin = 'ya en caché';
    if (!res) {
      const net = await fetch(url, { cache: 'no-store' });
      if (!net.ok) {
        ok = false;
        lines.push(`✗ ${path}: HTTP ${net.status}`);
        continue;
      }
      await cache.put(url, net);
      res = await cache.match(url);
      origin = 'descargado';
    }
    const size = res ? (await res.blob()).size : 0;
    if (!res || size === 0) {
      ok = false;
      lines.push(`✗ ${path}: no se pudo leer de la caché`);
      continue;
    }
    bytes += size;
    lines.push(`✓ ${path}: ${formatBytes(size)} (${origin})`);
  }
  return { ok, bytes, lines };
}
