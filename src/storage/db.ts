import Dexie, { type Table } from 'dexie';
import type { Activity, Attachment, Booking, Day, Trip } from '../models/types';
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

  constructor(name: string = APP_DB_NAME) {
    super(name);
    for (const v of SCHEMA_HISTORY) {
      const version = this.version(v.version).stores(v.stores);
      if (v.upgrade) version.upgrade(v.upgrade);
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
