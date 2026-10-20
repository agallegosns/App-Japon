import Dexie, { type Table } from 'dexie';
import type { Activity, Attachment, Booking, Day, Tombstone, Trip } from '../models/types';
import { SCHEMA_HISTORY } from './schema';

export interface MetaEntry {
  key: string;
  value: unknown;
}

export const APP_DB_NAME = 'nihon-trip';

export class NihonDB extends Dexie {
  trips!: Table<Trip, string>;
  days!: Table<Day, string>;
  bookings!: Table<Booking, string>;
  attachments!: Table<Attachment, string>;
  activities!: Table<Activity, string>;
  meta!: Table<MetaEntry, string>;
  tombstones!: Table<Tombstone, string>;
  /** Transacción de la sincronización que está escribiendo datos recibidos: en ella no se tocan las fechas de modificación. */
  noTouchTx: unknown = null;

  constructor(name: string = APP_DB_NAME) {
    super(name);
    for (const v of SCHEMA_HISTORY) {
      const version = this.version(v.version).stores(v.stores);
      if (v.upgrade) version.upgrade(v.upgrade);
    }
    // Cualquier modificación de un viaje, día, reserva o actividad actualiza su fecha de modificación (base de la sincronización).
    for (const table of [this.trips, this.days, this.bookings, this.activities]) {
      table.hook('updating', () => (Dexie.currentTransaction && Dexie.currentTransaction === this.noTouchTx ? undefined : { updatedAt: Date.now() }));
    }
  }
}

export const DATA_TABLES = ['trips', 'days', 'bookings', 'attachments', 'activities'] as const;

let appDb: NihonDB | null = null;

/** Base de datos de la app (una sola instancia). */
export function getDb(): NihonDB {
  if (!appDb) appDb = new NihonDB();
  return appDb;
}
