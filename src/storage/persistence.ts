export interface StorageInfo {
  supported: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s) return { supported: false, persisted: null, usage: null, quota: null };
  const [persisted, estimate] = await Promise.all([
    s.persisted ? s.persisted() : Promise.resolve(null),
    s.estimate ? s.estimate() : Promise.resolve(null),
  ]);
  return { supported: true, persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}

/** Solicita almacenamiento persistente. Devuelve si quedó concedido. */
export async function requestPersistence(): Promise<boolean> {
  const s = navigator.storage;
  if (!s?.persist) throw new Error('Este navegador no permite solicitar almacenamiento persistente.');
  return s.persist();
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return 'desconocido';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
