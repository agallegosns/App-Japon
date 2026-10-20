import type { NihonDB } from './db';

export type SyncType = 'trips' | 'days' | 'bookings' | 'activities' | 'attachments';

export function syncKey(type: SyncType, id: string): string {
  return `${type}:${id}`;
}

/** Deja constancia de un borrado. Llamar dentro de una transacción que incluya `tombstones`. */
export async function markDeleted(db: NihonDB, type: SyncType, id: string, at: number = Date.now()): Promise<void> {
  await db.tombstones.put({ key: syncKey(type, id), deletedAt: at });
}
