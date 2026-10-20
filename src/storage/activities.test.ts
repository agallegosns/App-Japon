// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { freshDb } from '../test/helpers';
import {
  createActivity,
  deleteActivity,
  emptyActivity,
  listActivities,
  listActivitiesByDate,
  moveActivity,
  setActivityStatus,
  updateActivity,
} from './activities';
import type { NihonDB } from './db';
import { ValidationError } from './validation';

let db: NihonDB;
afterEach(async () => {
  await db.delete();
});

async function seed(titles: string[], date = '2030-04-01') {
  const out = [];
  for (const t of titles) out.push(await createActivity(db, { ...emptyActivity(date), title: t }));
  return out;
}

const titles = async (date = '2030-04-01') => (await listActivitiesByDate(db, date)).map((a) => a.title);

describe('actividades: CRUD', () => {
  it('crea en orden, actualiza, marca como hecha y elimina compactando el orden', async () => {
    db = freshDb();
    const [a, b, c] = await seed(['A', 'B', 'C']);
    expect(await titles()).toEqual(['A', 'B', 'C']);

    await updateActivity(db, b!.id, { ...emptyActivity('2030-04-01'), title: 'B2', startTime: '10:00', endTime: '11:00' });
    await setActivityStatus(db, a!.id, 'hecha');
    const list = await listActivitiesByDate(db, '2030-04-01');
    expect(list.map((x) => [x.title, x.status])).toEqual([
      ['A', 'hecha'],
      ['B2', 'pendiente'],
      ['C', 'pendiente'],
    ]);

    await deleteActivity(db, a!.id);
    const after = await listActivitiesByDate(db, '2030-04-01');
    expect(after.map((x) => [x.title, x.order])).toEqual([
      ['B2', 0],
      ['C', 1],
    ]);
    expect(c).toBeDefined();
  });

  it('valida horas y coordenadas', async () => {
    db = freshDb();
    await expect(
      createActivity(db, { ...emptyActivity('2030-04-01'), title: 'x', startTime: '12:00', endTime: '11:00' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createActivity(db, { ...emptyActivity('2030-04-01'), title: 'x', mapRef: { type: 'coords', lat: 200, lng: 0 } }),
    ).rejects.toThrow(/Coordenadas/);
  });

  it('al cambiar de día va al final del nuevo día y recompacta el anterior', async () => {
    db = freshDb();
    const [a] = await seed(['A', 'B']);
    await seed(['X'], '2030-04-02');
    await updateActivity(db, a!.id, { ...emptyActivity('2030-04-02'), title: 'A' });
    expect(await titles()).toEqual(['B']);
    expect(await titles('2030-04-02')).toEqual(['X', 'A']);
    expect((await listActivities(db)).map((x) => x.title)).toEqual(['B', 'X', 'A']);
  });
});

describe('reordenación', () => {
  it('mueve hacia abajo, hacia arriba y limita a los extremos', async () => {
    db = freshDb();
    const [a, , , d] = await seed(['A', 'B', 'C', 'D']);
    await moveActivity(db, a!.id, 2);
    expect(await titles()).toEqual(['B', 'C', 'A', 'D']);
    await moveActivity(db, d!.id, 0);
    expect(await titles()).toEqual(['D', 'B', 'C', 'A']);
    await moveActivity(db, d!.id, 99);
    expect(await titles()).toEqual(['B', 'C', 'A', 'D']);
    const orders = (await listActivitiesByDate(db, '2030-04-01')).map((x) => x.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it('no afecta a otros días', async () => {
    db = freshDb();
    const [a] = await seed(['A', 'B']);
    await seed(['X', 'Y'], '2030-04-02');
    await moveActivity(db, a!.id, 1);
    expect(await titles('2030-04-02')).toEqual(['X', 'Y']);
  });
});
