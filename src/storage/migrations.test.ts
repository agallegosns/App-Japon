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

// La versión 2 guarda los mismos datos sin localizador y con tramos de vuelo y alojamiento por día.
FIXTURES[2] = {
  trips: FIXTURES[1]!.trips!,
  days: [
    { id: 'd1', tripId: 't1', date: '2030-04-01', city: 'A', lodgingId: null },
    { id: 'd2', tripId: 't1', date: '2030-04-02', city: '', lodgingId: 'b1' },
  ],
  bookings: [
    {
      id: 'b1', name: 'Hotel', category: 'alojamiento', status: 'confirmada', start: null, arrival: null,
      checkIn: { date: '2030-04-01', time: '15:00', tz: 'Asia/Tokyo' }, checkOut: null, address: '', addressJa: '',
      legs: [], price: null, phone: '', contact: '', notes: '', links: [], sortAt: 1, createdAt: 1, updatedAt: 1,
    },
  ],
  attachments: FIXTURES[1]!.attachments!,
  activities: FIXTURES[1]!.activities!,
  meta: FIXTURES[1]!.meta!,
};

// La versión 3 añade tasas y «todo el día» y ya no guarda la dirección en japonés.
function withoutJa(row: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...row };
  delete copy.addressJa;
  return copy;
}

FIXTURES[3] = {
  trips: FIXTURES[2]!.trips!,
  days: FIXTURES[2]!.days!,
  bookings: FIXTURES[2]!.bookings!.map((b) => ({ ...withoutJa(b), guests: 2, taxes: [] })),
  attachments: FIXTURES[2]!.attachments!,
  activities: FIXTURES[2]!.activities!.map((a) => ({ ...withoutJa(a), allDay: false })),
  meta: FIXTURES[2]!.meta!,
};

// La versión 4 añade vagón, asiento y tipo de billete a los tramos.
FIXTURES[4] = {
  ...FIXTURES[3],
  bookings: FIXTURES[3]!.bookings!.map((b) => ({ ...b, legs: [] })),
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
      const hotel = await db.bookings.get('b1');
      expect(hotel).toMatchObject({ name: 'Hotel', legs: [] });
      expect(hotel).not.toHaveProperty('confirmationCode');
      expect(hotel).not.toHaveProperty('addressJa');
      expect(hotel).toMatchObject({ guests: 2, taxes: [] });
      expect((await db.activities.get('x1'))).toMatchObject({ allDay: false });
      expect((await db.activities.get('x1'))).not.toHaveProperty('addressJa');
      expect((await db.days.get('d1'))?.lodgingId).toBeNull();
      expect((await db.activities.where('[date+order]').equals(['2030-04-01', 0]).first())?.title).toBe('Paseo');
      const att = await db.attachments.get('a1');
      expect(Array.from(new Uint8Array(await att!.blob.arrayBuffer()))).toEqual([1, 2, 3]);
      expect((await db.meta.get('lastBackupAt'))?.value).toBe(123);
      await db.delete();
    });
  }

  it('v1 → v2: elimina localizadores y adjuntos QR/código, conserva el resto y rellena los campos nuevos', async () => {
    const name = `mig-v2-${Math.random()}`;
    const old = new Dexie(name);
    old.version(1).stores(SCHEMA_HISTORY[0]!.stores as Record<string, string>);
    await old.open();
    await old.table('trips').bulkAdd(FIXTURES[1]!.trips!);
    await old.table('days').bulkAdd(FIXTURES[1]!.days!);
    await old.table('bookings').bulkAdd(FIXTURES[1]!.bookings!);
    await old.table('attachments').bulkAdd([
      ...FIXTURES[1]!.attachments!,
      { id: 'a2', bookingId: 'b1', kind: 'code', name: 'qr.png', mime: 'image/png', size: 1, blob: new Blob([new Uint8Array([1])], { type: 'image/png' }), createdAt: 2 },
      { id: 'a3', bookingId: 'b1', kind: 'image', name: 'foto.png', mime: 'image/png', size: 1, blob: new Blob([new Uint8Array([2])], { type: 'image/png' }), createdAt: 3 },
    ]);
    old.close();

    const db = new NihonDB(name);
    await db.open();
    const hotel = await db.bookings.get('b1');
    expect(hotel).not.toHaveProperty('confirmationCode');
    expect(hotel?.legs).toEqual([]);
    expect((await db.attachments.toArray()).map((a) => a.id).sort()).toEqual(['a1', 'a3']);
    expect((await db.days.toArray()).every((d) => d.lodgingId === null)).toBe(true);
    await db.delete();
  });

  it('v2 → v3: quita la dirección en japonés y rellena personas, tasas y «todo el día»', async () => {
    const name = `mig-v3-${Math.random()}`;
    const old = new Dexie(name);
    old.version(1).stores(SCHEMA_HISTORY[0]!.stores as Record<string, string>);
    old.version(2).stores({});
    await old.open();
    await old.table('trips').bulkAdd(FIXTURES[2]!.trips!);
    await old.table('bookings').bulkAdd([{ ...FIXTURES[2]!.bookings![0]!, addressJa: '東京都' }]);
    await old.table('activities').bulkAdd([{ ...FIXTURES[2]!.activities![0]!, addressJa: '東京都' }]);
    old.close();

    const db = new NihonDB(name);
    await db.open();
    expect(db.verno).toBe(4);
    const hotel = await db.bookings.get('b1');
    expect(hotel).not.toHaveProperty('addressJa');
    expect(hotel).toMatchObject({ name: 'Hotel', guests: 2, taxes: [] });
    const act = await db.activities.get('x1');
    expect(act).not.toHaveProperty('addressJa');
    expect(act).toMatchObject({ title: 'Paseo', allDay: false });
    await db.delete();
  });

  it('v3 → v4: los tramos existentes reciben vagón, asiento y billete vacíos sin perder nada', async () => {
    const name = `mig-v4-${Math.random()}`;
    const old = new Dexie(name);
    old.version(1).stores(SCHEMA_HISTORY[0]!.stores as Record<string, string>);
    old.version(2).stores({});
    old.version(3).stores({});
    await old.open();
    const leg = { id: 'l1', from: 'Madrid (MAD)', to: 'Doha (DOH)', flightNumber: 'QR150', depart: null, arrive: null };
    await old.table('bookings').bulkAdd([{ ...FIXTURES[3]!.bookings![0]!, category: 'vuelo', legs: [leg] }]);
    old.close();

    const db = new NihonDB(name);
    await db.open();
    expect(db.verno).toBe(4);
    const b = await db.bookings.get('b1');
    expect(b?.legs).toEqual([{ ...leg, car: '', seat: '', fare: '' }]);
    await db.delete();
  });
});
