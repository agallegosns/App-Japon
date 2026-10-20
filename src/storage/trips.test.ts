// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { freshDb } from '../test/helpers';
import type { NihonDB } from './db';
import { getTrip, listDays, saveTrip, setDayCity } from './trips';

let db: NihonDB;
afterEach(async () => {
  await db.delete();
});

describe('viaje y días', () => {
  it('crea los días del viaje y conserva la ciudad al cambiar fechas', async () => {
    db = freshDb();
    const trip = await saveTrip(db, { name: 'Viaje', startDate: '2030-04-01', endDate: '2030-04-03', cities: ['A', 'B'], tz: 'Asia/Tokyo' });
    let days = await listDays(db, trip.id);
    expect(days.map((d) => d.date)).toEqual(['2030-04-01', '2030-04-02', '2030-04-03']);
    await setDayCity(db, days[1]!.id, 'B');

    await saveTrip(db, { name: 'Viaje', startDate: '2030-04-02', endDate: '2030-04-04', cities: ['A', 'B'], tz: 'Asia/Tokyo' });
    days = await listDays(db, trip.id);
    expect(days.map((d) => [d.date, d.city])).toEqual([
      ['2030-04-02', 'B'],
      ['2030-04-03', ''],
      ['2030-04-04', ''],
    ]);
    expect((await getTrip(db))?.id).toBe(trip.id);
    expect(await db.trips.count()).toBe(1);
  });

  it('rechaza fechas invertidas', async () => {
    db = freshDb();
    await expect(saveTrip(db, { name: 'V', startDate: '2030-04-05', endDate: '2030-04-01', cities: [], tz: 'Asia/Tokyo' })).rejects.toThrow(/anterior/);
  });
});
