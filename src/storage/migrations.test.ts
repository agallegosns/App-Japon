// @vitest-environment node
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { NihonDB } from './db';
import { CURRENT_SCHEMA_VERSION, SCHEMA_HISTORY } from './schema';

/**
 * Datos de ejemplo tal como los escribía cada versión del esquema.
 * Al añadir una versión nueva: añade aquí su fixture y NO cambies las anteriores.
 */
const FIXTURES: Record<number, Record<string, Record<string, unknown>[]>> = {
  1: {
    trips: [{ id: 't1', name: 'Viaje', startDate: '2030-04-01', endDate: '2030-04-02', cities: ['A'], tz: 'Asia/Tokyo', createdAt: 1, updatedAt: 1 }],
    days: [
      { id: 'd1', tripId: 't1', date: '2030-04-01', city: 'A' },
      { id: 'd2', tripId: 't1', date: '2030-04-02', city: '' },
    ],
    bookings: [
      {
        id: 'b1', name: 'Hotel', category: 'alojamiento', status: 'confirmada', start: null, arrival: null,
        checkIn: { date: '2030-04-01', time: '15:00', tz: 'Asia/Tokyo' }, checkOut: null, address: '', addressJa: '',
        confirmationCode: 'X', price: null, phone: '', contact: '', notes: '', links: [], sortAt: 1, createdAt: 1, updatedAt: 1,
      },
    ],
    attachments: [
      { id: 'a1', bookingId: 'b1', kind: 'pdf', name: 'r.pdf', mime: 'application/pdf', size: 3, blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }), createdAt: 1 },
    ],
    activities: [
      {
        id: 'x1', title: 'Paseo', date: '2030-04-01', startTime: '10:00', endTime: null, tz: 'Asia/Tokyo', location: 'L',
        address: '', addressJa: '', durationMin: 60, notes: '', bookingId: 'b1', status: 'pendiente', mapRef: null, order: 0, createdAt: 1, updatedAt: 1,
      },
    ],
    meta: [{ key: 'lastBackupAt', value: 123 }],
  },
};

describe('migraciones de IndexedDB', () => {
  it('cada versión publicada tiene fixture y las versiones son crecientes', () => {
    const versions = SCHEMA_HISTORY.map((v) => v.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    for (const v of versions) expect(FIXTURES[v], `falta fixture de la versión ${v}`).toBeDefined();
  });

  for (const historic of SCHEMA_HISTORY) {
    it(`abre con la versión actual (${CURRENT_SCHEMA_VERSION}) datos creados con la versión ${historic.version}`, async () => {
      const name = `mig-${historic.version}-${Math.random()}`;
      const old = new Dexie(name);
      for (const v of SCHEMA_HISTORY.filter((s) => s.version <= historic.version)) {
        old.version(v.version).stores(v.stores);
      }
      await old.open();
      const fixture = FIXTURES[historic.version] ?? {};
      for (const [table, rows] of Object.entries(fixture)) await old.table(table).bulkAdd(rows);
      old.close();

      const db = new NihonDB(name);
      await db.open();
      expect(db.verno).toBe(CURRENT_SCHEMA_VERSION);
      expect(await db.trips.count()).toBe(1);
      expect(await db.bookings.get('b1')).toMatchObject({ name: 'Hotel', confirmationCode: 'X' });
      expect((await db.activities.where('[date+order]').equals(['2030-04-01', 0]).first())?.title).toBe('Paseo');
      const att = await db.attachments.get('a1');
      expect(Array.from(new Uint8Array(await att!.blob.arrayBuffer()))).toEqual([1, 2, 3]);
      expect((await db.meta.get('lastBackupAt'))?.value).toBe(123);
      await db.delete();
    });
  }
});
