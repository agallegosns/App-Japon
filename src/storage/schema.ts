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
  {
    // v2: vuelos con escalas (legs), alojamiento por día (lodgingId) y se eliminan los
    // localizadores y los adjuntos tipo QR / código de barras (decisión de seguridad).
    version: 2,
    stores: {},
    upgrade: async (tx) => {
      await tx.table('bookings').toCollection().modify((b: Record<string, unknown>) => {
        delete b.confirmationCode;
        if (!Array.isArray(b.legs)) b.legs = [];
      });
      await tx.table('days').toCollection().modify((d: Record<string, unknown>) => {
        if (d.lodgingId === undefined) d.lodgingId = null;
      });
      await tx
        .table('attachments')
        .filter((a: { kind?: string }) => a.kind === 'code')
        .delete();
    },
  },
  {
    // v3: actividades de todo el día (allDay), tasas de alojamiento (guests, taxes) y se elimina la
    // dirección en japonés (decisión del usuario).
    version: 3,
    stores: {},
    upgrade: async (tx) => {
      await tx.table('bookings').toCollection().modify((b: Record<string, unknown>) => {
        delete b.addressJa;
        if (typeof b.guests !== 'number') b.guests = 2;
        if (!Array.isArray(b.taxes)) b.taxes = [];
      });
      await tx.table('activities').toCollection().modify((a: Record<string, unknown>) => {
        delete a.addressJa;
        if (typeof a.allDay !== 'boolean') a.allDay = false;
      });
    },
  },
  {
    // v4: trayectos de tren con vagón, asiento y tipo de billete (car, seat, fare en cada tramo).
    version: 4,
    stores: {},
    upgrade: async (tx) => {
      await tx.table('bookings').toCollection().modify((b: { legs?: Record<string, unknown>[] }) => {
        if (!Array.isArray(b.legs)) return;
        b.legs = b.legs.map((l) => ({
          ...l,
          car: typeof l.car === 'string' ? l.car : '',
          seat: typeof l.seat === 'string' ? l.seat : '',
          fare: typeof l.fare === 'string' ? l.fare : '',
        }));
      });
    },
  },
];

export const CURRENT_SCHEMA_VERSION = SCHEMA_HISTORY[SCHEMA_HISTORY.length - 1]?.version ?? 1;
