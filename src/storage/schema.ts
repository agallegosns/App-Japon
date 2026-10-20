import type { Transaction } from 'dexie';

/**
 * Historial COMPLETO de versiones del esquema IndexedDB.
 *
 * Reglas (ver ARCHITECTURE.md):
 * - Nunca modificar ni borrar una versión ya publicada: solo añadir nuevas al final.
 * - Cada versión nueva que transforme datos lleva `upgrade` y un test en migrations.test.ts
 *   que abre datos creados con la versión anterior.
 */
export interface SchemaVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void>;
}

export const SCHEMA_HISTORY: SchemaVersion[] = [
  {
    version: 1,
    stores: {
      trips: 'id',
      days: 'id, tripId, date, &[tripId+date]',
      bookings: 'id, category, sortAt, updatedAt',
      attachments: 'id, bookingId',
      activities: 'id, date, [date+order], bookingId',
      meta: 'key',
    },
  },
];

export const CURRENT_SCHEMA_VERSION = SCHEMA_HISTORY[SCHEMA_HISTORY.length - 1]?.version ?? 1;
