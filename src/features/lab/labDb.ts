import Dexie, { type Table } from 'dexie';

/**
 * Base de datos SOLO del laboratorio, separada de los datos del viaje:
 * nunca entra en las copias de seguridad ni la toca "Borrar todos los datos".
 */
export interface LabBlob {
  id: number;
  blob: Blob;
  size: number;
}

export interface LabFile {
  key: string;
  blob: Blob;
  size: number;
  savedAt: number;
  source: string;
}

export interface LabKv {
  key: string;
  value: unknown;
}

class LabDB extends Dexie {
  blobs!: Table<LabBlob, number>;
  files!: Table<LabFile, string>;
  kv!: Table<LabKv, string>;

  constructor() {
    super('nihon-lab');
    this.version(1).stores({ blobs: 'id', files: 'key', kv: 'key' });
  }
}

let db: LabDB | null = null;
export function labDb(): LabDB {
  if (!db) db = new LabDB();
  return db;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await labDb().kv.get(key))?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await labDb().kv.put({ key, value });
}

export async function kvDelete(key: string): Promise<void> {
  await labDb().kv.delete(key);
}

export interface OpenStats {
  count: number;
  firstAt: number;
  lastAt: number;
  previousAt: number | null;
}

/** Cuenta las aperturas de la app (prueba de persistencia tras cerrar y abrir). */
export async function recordAppOpen(now: number = Date.now()): Promise<OpenStats> {
  const d = labDb();
  return d.transaction('rw', d.kv, async () => {
    const prev = (await kvGet<OpenStats>('opens')) ?? null;
    const next: OpenStats = {
      count: (prev?.count ?? 0) + 1,
      firstAt: prev?.firstAt ?? now,
      lastAt: now,
      previousAt: prev?.lastAt ?? null,
    };
    await kvSet('opens', next);
    return next;
  });
}

export async function getOpenStats(): Promise<OpenStats | null> {
  return (await kvGet<OpenStats>('opens')) ?? null;
}
