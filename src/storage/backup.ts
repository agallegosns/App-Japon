import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { Activity, Attachment, Booking, Day, Trip } from '../models/types';
import type { NihonDB } from './db';
import { recordChange } from './meta';
import { CURRENT_SCHEMA_VERSION } from './schema';

export const BACKUP_FORMAT = 'nihon-trip-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  counts: BackupCounts;
}

export interface BackupCounts {
  trips: number;
  days: number;
  bookings: number;
  activities: number;
  attachments: number;
  attachmentBytes: number;
}

type AttachmentMeta = Omit<Attachment, 'blob'> & { path: string };

interface BackupData {
  trips: Trip[];
  days: Day[];
  bookings: Booking[];
  activities: Activity[];
  attachments: AttachmentMeta[];
}

export interface ParsedBackup {
  manifest: BackupManifest;
  trips: Trip[];
  days: Day[];
  bookings: Booking[];
  activities: Activity[];
  attachments: Attachment[];
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'archivo';
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Genera un zip con todos los datos y adjuntos. */
export async function exportBackup(db: NihonDB, now: Date = new Date()): Promise<{ bytes: Uint8Array; manifest: BackupManifest }> {
  const [trips, days, bookings, activities, attachments] = await db.transaction(
    'r',
    [db.trips, db.days, db.bookings, db.activities, db.attachments],
    () =>
      Promise.all([
        db.trips.toArray(),
        db.days.toArray(),
        db.bookings.toArray(),
        db.activities.toArray(),
        db.attachments.toArray(),
      ]),
  );
  const files: Zippable = {};
  const metas: AttachmentMeta[] = [];
  let attachmentBytes = 0;
  for (const att of attachments) {
    const path = `attachments/${att.id}-${safeName(att.name)}`;
    const bytes = await blobBytes(att.blob);
    if (bytes.byteLength !== att.size) throw new Error(`El adjunto "${att.name}" está dañado (tamaño distinto).`);
    attachmentBytes += bytes.byteLength;
    // PDF e imágenes ya van comprimidos: se guardan sin recomprimir.
    files[path] = [bytes, { level: 0 }];
    const { blob: _omit, ...meta } = att;
    void _omit;
    metas.push({ ...meta, path });
  }
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    counts: {
      trips: trips.length,
      days: days.length,
      bookings: bookings.length,
      activities: activities.length,
      attachments: attachments.length,
      attachmentBytes,
    },
  };
  const data: BackupData = { trips, days, bookings, activities, attachments: metas };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  files['data.json'] = strToU8(JSON.stringify(data));
  return { bytes: zipSync(files, { level: 6 }), manifest };
}

export function backupFileName(now: Date = new Date()): string {
  const d = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `nihon-trip-copia-${d}.zip`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function arr(data: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const v = data[key];
  if (!Array.isArray(v) || !v.every(isObj)) throw new Error(`La copia no es válida: falta "${key}".`);
  for (const item of v) if (typeof item.id !== 'string') throw new Error(`La copia no es válida: elemento sin id en "${key}".`);
  return v;
}

/** Lee y valida un zip de copia. No modifica la base de datos. */
export function parseBackup(bytes: Uint8Array): ParsedBackup {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('El archivo no es un zip válido.');
  }
  const manifestRaw = entries['manifest.json'];
  const dataRaw = entries['data.json'];
  if (!manifestRaw || !dataRaw) throw new Error('El zip no es una copia de Nihon Trip.');
  let manifest: unknown;
  let data: unknown;
  try {
    manifest = JSON.parse(strFromU8(manifestRaw));
    data = JSON.parse(strFromU8(dataRaw));
  } catch {
    throw new Error('La copia está dañada (JSON no válido).');
  }
  if (!isObj(manifest) || manifest.format !== BACKUP_FORMAT) throw new Error('El zip no es una copia de Nihon Trip.');
  if (typeof manifest.formatVersion !== 'number' || manifest.formatVersion > BACKUP_FORMAT_VERSION)
    throw new Error('La copia se hizo con una versión más nueva de la app. Actualiza la app antes de importarla.');
  if (typeof manifest.schemaVersion !== 'number' || manifest.schemaVersion > CURRENT_SCHEMA_VERSION)
    throw new Error('La copia usa un formato de datos más nuevo. Actualiza la app antes de importarla.');
  if (!isObj(data)) throw new Error('La copia está dañada.');

  // Copias antiguas: se descartan los adjuntos tipo QR/código (ya no se guardan) y se rellenan los campos nuevos.
  const attachmentMetas = (arr(data, 'attachments') as unknown as AttachmentMeta[]).filter(
    (m) => (m.kind as string) !== 'code',
  );
  const attachments: Attachment[] = attachmentMetas.map((m) => {
    const file = entries[m.path];
    if (!file) throw new Error(`Falta el archivo del adjunto "${m.name}" en la copia.`);
    if (file.byteLength !== m.size) throw new Error(`El adjunto "${m.name}" está dañado en la copia.`);
    const { path: _p, ...rest } = m;
    void _p;
    return { ...rest, blob: new Blob([file.slice().buffer as ArrayBuffer], { type: m.mime }) };
  });
  return {
    manifest: manifest as unknown as BackupManifest,
    trips: arr(data, 'trips') as unknown as Trip[],
    days: (arr(data, 'days') as unknown as Day[]).map((d) => ({ ...d, lodgingId: d.lodgingId ?? null })),
    bookings: (arr(data, 'bookings') as unknown as (Booking & { confirmationCode?: string })[]).map((b) => {
      const { confirmationCode: _removed, ...rest } = b;
      void _removed;
      return { ...rest, legs: Array.isArray(rest.legs) ? rest.legs : [] };
    }),
    activities: arr(data, 'activities') as unknown as Activity[],
    attachments,
  };
}

export type ImportMode = 'replace' | 'merge';

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

type Stamped = { id: string; updatedAt?: number; createdAt?: number };

function stamp(item: Stamped): number {
  return item.updatedAt ?? item.createdAt ?? 0;
}

/**
 * Importa una copia.
 * - replace: borra todo y deja exactamente lo de la copia.
 * - merge: añade lo nuevo y, si un elemento existe en ambos, conserva el modificado más recientemente.
 */
export async function importBackup(db: NihonDB, backup: ParsedBackup, mode: ImportMode): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
  const tables = [db.trips, db.days, db.bookings, db.activities, db.attachments, db.meta];
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all([db.trips.clear(), db.days.clear(), db.bookings.clear(), db.activities.clear(), db.attachments.clear()]);
      await db.trips.bulkAdd(backup.trips);
      await db.days.bulkAdd(backup.days);
      await db.bookings.bulkAdd(backup.bookings);
      await db.activities.bulkAdd(backup.activities);
      await db.attachments.bulkAdd(backup.attachments);
      result.added =
        backup.trips.length + backup.days.length + backup.bookings.length + backup.activities.length + backup.attachments.length;
    } else {
      // Un solo viaje por app: si ya hay uno, se mantiene su id y los días entrantes se reasignan a él.
      const currentTrip = (await db.trips.toArray())[0];
      const incomingTrip = backup.trips[0];
      let days = backup.days;
      if (currentTrip && incomingTrip && currentTrip.id !== incomingTrip.id) {
        const newer = stamp(incomingTrip) > stamp(currentTrip);
        if (newer) {
          await db.trips.put({ ...incomingTrip, id: currentTrip.id });
          result.updated++;
        } else result.skipped++;
        const existingDays = await db.days.where('tripId').equals(currentTrip.id).toArray();
        const existingDates = new Set(existingDays.map((d) => d.date));
        days = backup.days
          .filter((d) => !existingDates.has(d.date))
          .map((d) => ({ ...d, tripId: currentTrip.id }));
        result.skipped += backup.days.length - days.length;
      } else {
        await mergeTable(db.trips, backup.trips, result);
      }
      await mergeTable(db.days, days, result);
      await mergeTable(db.bookings, backup.bookings, result);
      await mergeTable(db.activities, backup.activities, result);
      await mergeTable(db.attachments, backup.attachments, result);
    }
    await recordChange(db);
  });
  return result;
}

interface MergeTable<T extends Stamped> {
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<unknown>;
}

async function mergeTable<T extends Stamped>(table: MergeTable<T>, items: T[], result: ImportResult): Promise<void> {
  for (const item of items) {
    const existing = await table.get(item.id);
    if (!existing) {
      await table.put(item);
      result.added++;
    } else if (stamp(item) > stamp(existing)) {
      await table.put(item);
      result.updated++;
    } else {
      result.skipped++;
    }
  }
}

/** Borra todos los datos del viaje (no toca la configuración interna). */
export async function deleteAllData(db: NihonDB): Promise<void> {
  await db.transaction('rw', [db.trips, db.days, db.bookings, db.activities, db.attachments, db.meta], async () => {
    await Promise.all([
      db.trips.clear(),
      db.days.clear(),
      db.bookings.clear(),
      db.activities.clear(),
      db.attachments.clear(),
      db.meta.clear(),
    ]);
  });
}
