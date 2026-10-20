import { isStandalone } from '../../app/standalone';
import { formatTimestamp } from '../../models/datetime';
import { getDb } from '../../storage/db';
import { BACKUP_MAX_DAYS, getBackupStatus } from '../../storage/meta';
import { formatBytes, getStorageInfo } from '../../storage/persistence';

export type CheckStatus = 'ok' | 'warning' | 'error' | 'pending';

export interface CheckResult {
  status: CheckStatus;
  detail: string;
}

export interface PrecacheStatus {
  total: number;
  cached: number;
  missing: string[];
}

/** Pregunta al service worker activo cuántos archivos de la app tiene realmente en caché. */
export async function queryPrecache(registration: ServiceWorkerRegistration | null, timeoutMs = 10_000): Promise<PrecacheStatus> {
  const reg = registration ?? (await navigator.serviceWorker?.getRegistration());
  const sw = reg?.active;
  if (!sw) throw new Error('El service worker no está activo todavía. Abre la app con conexión y espera unos segundos.');
  return new Promise<PrecacheStatus>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => reject(new Error('El service worker no respondió.')), timeoutMs);
    channel.port1.onmessage = (e: MessageEvent<PrecacheStatus>) => {
      window.clearTimeout(timer);
      resolve(e.data);
    };
    sw.postMessage({ type: 'PRECACHE_STATUS' }, [channel.port2]);
  });
}

export async function checkInstalled(): Promise<CheckResult> {
  return isStandalone()
    ? { status: 'ok', detail: 'Abierta desde la pantalla de inicio.' }
    : { status: 'error', detail: 'Abierta en Safari. Añádela a la pantalla de inicio y ábrela desde el icono.' };
}

export async function checkAppCache(registration: ServiceWorkerRegistration | null): Promise<CheckResult> {
  if (!('serviceWorker' in navigator)) return { status: 'error', detail: 'Este navegador no admite service workers.' };
  const s = await queryPrecache(registration);
  if (s.missing.length === 0) return { status: 'ok', detail: `${s.cached} de ${s.total} archivos de la app en caché.` };
  return { status: 'error', detail: `Faltan ${s.missing.length} de ${s.total} archivos en caché (p. ej. ${s.missing.slice(0, 2).join(', ')}).` };
}

export async function checkData(): Promise<CheckResult> {
  const db = getDb();
  const [trips, bookings, activities, days] = await Promise.all([db.trips.toArray(), db.bookings.toArray(), db.activities.toArray(), db.days.count()]);
  for (const b of bookings) if (typeof b.id !== 'string' || typeof b.name !== 'string') throw new Error('Hay una reserva dañada.');
  for (const a of activities) if (typeof a.id !== 'string' || typeof a.date !== 'string') throw new Error('Hay una actividad dañada.');
  if (trips.length === 0) return { status: 'warning', detail: 'Datos legibles, pero aún no has creado el viaje.' };
  return { status: 'ok', detail: `Leídos: viaje, ${days} días, ${bookings.length} reservas y ${activities.length} actividades.` };
}

export async function checkAttachments(): Promise<CheckResult> {
  const db = getDb();
  const ids = (await db.attachments.toCollection().primaryKeys()) as string[];
  if (ids.length === 0) return { status: 'ok', detail: 'No hay adjuntos guardados.' };
  let bytes = 0;
  const broken: string[] = [];
  for (const id of ids) {
    const att = await db.attachments.get(id);
    if (!att) continue;
    try {
      const buf = await att.blob.arrayBuffer();
      if (buf.byteLength !== att.size) broken.push(att.name);
      bytes += buf.byteLength;
    } catch {
      broken.push(att.name);
    }
  }
  if (broken.length) return { status: 'error', detail: `No se pudieron leer: ${broken.join(', ')}.` };
  return { status: 'ok', detail: `${ids.length} adjuntos leídos completos (${formatBytes(bytes)}).` };
}

export async function checkPersistence(): Promise<CheckResult> {
  const info = await getStorageInfo();
  if (!info.supported) return { status: 'error', detail: 'El navegador no informa del almacenamiento.' };
  const usage = `Uso: ${formatBytes(info.usage)} de ${formatBytes(info.quota)}.`;
  return info.persisted
    ? { status: 'ok', detail: `Concedido. ${usage}` }
    : { status: 'warning', detail: `No concedido: Safari podría borrar datos si falta espacio. ${usage}` };
}

export async function checkBackup(): Promise<CheckResult> {
  const s = await getBackupStatus(getDb());
  if (s.lastBackupAt === null) return { status: 'warning', detail: 'Nunca se ha hecho una copia.' };
  const days = Math.floor((Date.now() - s.lastBackupAt) / 86_400_000);
  if (days >= BACKUP_MAX_DAYS || s.attachmentsSinceBackup > 0)
    return { status: 'warning', detail: `Última copia: ${formatTimestamp(s.lastBackupAt)}; hay cambios sin copiar.` };
  return { status: 'ok', detail: `Última copia: ${formatTimestamp(s.lastBackupAt)}.` };
}
