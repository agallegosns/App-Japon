import type { Activity, Attachment, Booking, Day, Trip } from '../models/types';
import type { NihonDB } from '../storage/db';
import { sanitizeActivity, sanitizeBooking, sanitizeDay } from '../storage/sanitize';
import { syncKey, type SyncType } from '../storage/tombstones';
import type { PutItem, SyncApi } from './api';
import { decryptBytes, decryptJson, encryptBytes, encryptJson, type Credentials } from './crypto';

/**
 * Motor de sincronización entre dos móviles. Regla: por cada elemento (viaje, día, reserva, actividad, adjunto) gana el cambio
 * más reciente; los borrados viajan como «marcas» para que no reaparezca lo que se quitó. Todo se cifra antes de salir.
 */

const TYPES: SyncType[] = ['trips', 'days', 'bookings', 'activities', 'attachments'];
const GET_BATCH = 40;
const PUT_BATCH = 20;
/** El servidor admite 20 MB por archivo cifrado (el cifrado añade 28 bytes). */
export const MAX_CLOUD_FILE_BYTES = 20 * 1024 * 1024 - 64;

type Row = Trip | Day | Booking | Activity | Attachment;

interface LocalEntry {
  type: SyncType;
  id: string;
  u: number;
  row?: Row;
  deleted: boolean;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  deleted: number;
  warnings: string[];
}

export type SyncMode = 'normal' | 'replaceLocal';

function split(key: string): { type: SyncType; id: string } | null {
  const i = key.indexOf(':');
  if (i < 0) return null;
  const type = key.slice(0, i) as SyncType;
  return TYPES.includes(type) ? { type, id: key.slice(i + 1) } : null;
}

function version(type: SyncType, row: Row): number {
  return type === 'attachments' ? (row as Attachment).createdAt : (row as Trip | Day | Booking | Activity).updatedAt;
}

async function readLocal(db: NihonDB): Promise<Map<string, LocalEntry>> {
  const map = new Map<string, LocalEntry>();
  const load = (type: SyncType, rows: Row[]) => {
    for (const row of rows) map.set(syncKey(type, row.id), { type, id: row.id, u: version(type, row), row, deleted: false });
  };
  load('trips', await db.trips.toArray());
  load('days', await db.days.toArray());
  load('bookings', await db.bookings.toArray());
  load('activities', await db.activities.toArray());
  load('attachments', await db.attachments.toArray());
  for (const t of await db.tombstones.toArray()) {
    const parts = split(t.key);
    if (!parts) continue;
    const row = map.get(t.key);
    // Si el elemento existe y es más nuevo que la marca, gana el elemento (nunca se pierden datos por una marca vieja).
    if (row && row.u >= t.deletedAt) continue;
    map.set(t.key, { ...parts, u: t.deletedAt, deleted: true });
  }
  return map;
}

function attachmentMeta(a: Attachment): Omit<Attachment, 'blob'> {
  const { blob: _blob, ...meta } = a;
  void _blob;
  return meta;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Comprueba lo mínimo de un registro recibido y lo deja con todos los campos actuales. */
function parseIncoming(type: SyncType, id: string, value: unknown): Row {
  if (!isRecord(value) || value.id !== id) throw new Error('Registro recibido no válido.');
  const str = (k: string) => typeof value[k] === 'string';
  const need = (ok: boolean) => {
    if (!ok) throw new Error('Registro recibido incompleto.');
  };
  switch (type) {
    case 'trips':
      need(str('name') && str('startDate') && str('endDate') && Array.isArray(value.cities) && typeof value.updatedAt === 'number');
      return value as unknown as Trip;
    case 'days':
      need(str('date') && str('tripId') && typeof value.updatedAt === 'number');
      return sanitizeDay(value as unknown as Day);
    case 'bookings':
      need(str('name') && str('category') && typeof value.updatedAt === 'number');
      return sanitizeBooking(value as unknown as Booking);
    case 'activities':
      need(str('title') && str('date') && typeof value.updatedAt === 'number');
      return sanitizeActivity(value as unknown as Activity);
    case 'attachments':
      need(str('bookingId') && str('name') && str('mime') && str('kind') && typeof value.createdAt === 'number');
      return value as unknown as Attachment;
  }
}

function table(db: NihonDB, type: SyncType) {
  return db[type] as unknown as { put(row: Row): Promise<unknown>; delete(id: string): Promise<void> };
}

/** Borra los datos de este móvil (para descargar los de la nube en su lugar). */
async function clearLocal(db: NihonDB): Promise<void> {
  await db.transaction('rw', [db.trips, db.days, db.bookings, db.activities, db.attachments, db.tombstones], async () => {
    await Promise.all([db.trips.clear(), db.days.clear(), db.bookings.clear(), db.activities.clear(), db.attachments.clear(), db.tombstones.clear()]);
  });
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function syncNow(db: NihonDB, api: SyncApi, creds: Credentials, mode: SyncMode = 'normal'): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, deleted: 0, warnings: [] };
  if (mode === 'replaceLocal') await clearLocal(db);

  const remote = await api.list(creds.room);
  const remoteMap = new Map(remote.items.map((i) => [i.k, i]));
  const remoteBlobs = new Set(remote.blobs);
  const local = await readLocal(db);

  const toPull: string[] = [];
  const toPush: string[] = [];
  for (const key of new Set([...local.keys(), ...remoteMap.keys()])) {
    if (!split(key)) continue;
    const lu = local.get(key)?.u ?? -1;
    const ru = remoteMap.get(key)?.u ?? -1;
    if (ru > lu) toPull.push(key);
    else if (lu > ru) toPush.push(key);
  }
  // Primero reservas y demás; los adjuntos al final para que su reserva ya exista.
  const order = (k: string) => TYPES.indexOf(split(k)?.type ?? 'attachments');
  toPull.sort((a, b) => order(a) - order(b));
  toPush.sort((a, b) => order(a) - order(b));

  // ---------- bajar lo nuevo ----------
  for (const keys of chunk(toPull, GET_BATCH)) {
    const records = await api.get(creds.room, keys);
    for (const rec of records) {
      const parts = split(rec.k);
      if (!parts) continue;
      try {
        if (rec.d === 1) {
          await applyDelete(db, parts.type, parts.id, rec.u);
          result.deleted++;
          continue;
        }
        const value = await decryptJson(creds.key, rec.v, rec.k);
        const row = parseIncoming(parts.type, parts.id, value);
        if (parts.type === 'attachments') {
          const att = row as Omit<Attachment, 'blob'>;
          const sealed = await api.getBlob(creds.room, parts.id);
          if (!sealed) {
            result.warnings.push(`Falta en la nube el archivo «${att.name}»: se reintentará en la próxima sincronización.`);
            continue;
          }
          const bytes = await decryptBytes(creds.key, sealed, `blob:${parts.id}`);
          await applyUpsert(db, 'attachments', { ...att, blob: new Blob([bytes], { type: att.mime }) } as Attachment);
        } else {
          await applyUpsert(db, parts.type, row);
        }
        result.pulled++;
      } catch (e) {
        result.warnings.push(`No se pudo aplicar «${rec.k}»: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // ---------- subir lo propio ----------
  const items: PutItem[] = [];
  for (const key of toPush) {
    const entry = local.get(key);
    if (!entry) continue;
    if (entry.deleted) {
      items.push({ k: key, u: entry.u, d: 1, v: '0' });
      continue;
    }
    const row = entry.row as Row;
    if (entry.type === 'attachments') {
      const att = row as Attachment;
      if (!remoteBlobs.has(att.id)) {
        if (att.size > MAX_CLOUD_FILE_BYTES) {
          result.warnings.push(`«${att.name}» pesa demasiado para la nube (máx. 19 MB): se queda solo en este móvil.`);
          continue;
        }
        const sealed = await encryptBytes(creds.key, await att.blob.arrayBuffer(), `blob:${att.id}`);
        await api.putBlob(creds.room, att.id, sealed as Uint8Array<ArrayBuffer>);
      }
      items.push({ k: key, u: entry.u, d: 0, v: await encryptJson(creds.key, attachmentMeta(att), key) });
    } else {
      items.push({ k: key, u: entry.u, d: 0, v: await encryptJson(creds.key, row, key) });
    }
  }
  for (const batch of chunk(items, PUT_BATCH)) {
    const res = await api.put(creds.room, batch);
    result.pushed += res.written.length;
  }
  return result;
}

async function applyUpsert(db: NihonDB, type: SyncType, row: Row): Promise<void> {
  await db.transaction('rw', [db[type], db.tombstones], async (tx) => {
    db.noTouchTx = tx;
    try {
      await table(db, type).put(row);
      await db.tombstones.delete(syncKey(type, row.id));
    } finally {
      db.noTouchTx = null;
    }
  });
}

async function applyDelete(db: NihonDB, type: SyncType, id: string, at: number): Promise<void> {
  await db.transaction('rw', [db[type], db.tombstones], async () => {
    await table(db, type).delete(id);
    await db.tombstones.put({ key: syncKey(type, id), deletedAt: at });
  });
}

/** ¿Hay datos del viaje en este móvil? */
export async function hasLocalData(db: NihonDB): Promise<boolean> {
  return (await db.trips.count()) + (await db.bookings.count()) + (await db.activities.count()) > 0;
}
