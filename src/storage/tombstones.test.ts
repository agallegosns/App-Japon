// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { freshDb, bytesBlob } from '../test/helpers';
import { createActivity, deleteActivity, emptyActivity, setActivityStatus } from './activities';
import { addAttachment, deleteAttachment } from './attachments';
import { deleteAllData, importBackup, type ParsedBackup } from './backup';
import { createBooking, deleteBooking, emptyBooking, updateBooking } from './bookings';
import type { NihonDB } from './db';
import { listDays, saveTrip, setDayCity } from './trips';

let db: NihonDB;
afterEach(async () => {
  await db.delete();
});

const keys = async () => (await db.tombstones.toArray()).map((t) => t.key).sort();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('marcas de borrado y fechas de modificación (base de la sincronización)', () => {
  it('borrar una actividad, un adjunto o una reserva (con sus adjuntos) deja marcas', async () => {
    db = freshDb();
    const act = await createActivity(db, { ...emptyActivity('2030-05-02'), title: 'Cena' });
    const b = await createBooking(db, { ...emptyBooking('restaurante'), name: 'Sushi' });
    const a1 = await addAttachment(db, b.id, bytesBlob([1, 2, 3], 'application/pdf'), 'a.pdf');
    const a2 = await addAttachment(db, b.id, bytesBlob([4], 'image/png'), 'b.png');
    await deleteActivity(db, act.id);
    await deleteAttachment(db, a1.id);
    expect(await keys()).toEqual([`activities:${act.id}`, `attachments:${a1.id}`].sort());
    await deleteBooking(db, b.id);
    expect(await keys()).toEqual([`activities:${act.id}`, `attachments:${a1.id}`, `attachments:${a2.id}`, `bookings:${b.id}`].sort());
    expect(await db.attachments.count()).toBe(0);
  });

  it('acortar el viaje deja marcas de los días quitados', async () => {
    db = freshDb();
    const trip = await saveTrip(db, { name: 'V', startDate: '2030-05-01', endDate: '2030-05-04', cities: [], tz: 'Asia/Tokyo' });
    const days = await listDays(db, trip.id);
    await saveTrip(db, { name: 'V', startDate: '2030-05-01', endDate: '2030-05-02', cities: [], tz: 'Asia/Tokyo' });
    expect(await keys()).toEqual([`days:${days[2]!.id}`, `days:${days[3]!.id}`].sort());
  });

  it('cualquier cambio actualiza la fecha de modificación, también en los días y al reordenar', async () => {
    db = freshDb();
    const trip = await saveTrip(db, { name: 'V', startDate: '2030-05-01', endDate: '2030-05-02', cities: ['Tokio'], tz: 'Asia/Tokyo' });
    const [d1] = await listDays(db, trip.id);
    const before = d1!.updatedAt;
    await wait(5);
    await setDayCity(db, d1!.id, 'Kioto');
    expect((await db.days.get(d1!.id))!.updatedAt).toBeGreaterThan(before);

    const a = await createActivity(db, { ...emptyActivity('2030-05-01'), title: 'A' });
    const c = await createActivity(db, { ...emptyActivity('2030-05-01'), title: 'C' });
    await wait(5);
    await deleteActivity(db, a.id); // la siguiente cambia de posición
    expect((await db.activities.get(c.id))!.updatedAt).toBeGreaterThan(c.updatedAt);

    const b = await createBooking(db, { ...emptyBooking('otro'), name: 'X' });
    await wait(5);
    const edited = await updateBooking(db, b.id, { ...emptyBooking('otro'), name: 'Y' });
    expect(edited.updatedAt).toBeGreaterThan(b.updatedAt);
  });

  it('al recibir datos de otro móvil (sin tocar la fecha) se conserva su fecha original', async () => {
    db = freshDb();
    const act = await createActivity(db, { ...emptyActivity('2030-05-02'), title: 'Cena' });
    await db.transaction('rw', db.activities, async (tx) => {
      db.noTouchTx = tx;
      await db.activities.update(act.id, { title: 'Cena (editada en el otro móvil)', updatedAt: 42 });
      db.noTouchTx = null;
    });
    expect((await db.activities.get(act.id))!.updatedAt).toBe(42);
    await setActivityStatus(db, act.id, 'hecha');
    expect((await db.activities.get(act.id))!.updatedAt).toBeGreaterThan(42);
  });

  it('importar una copia reemplazando marca como borrado lo que ya no está; fusionar lo recupera', async () => {
    db = freshDb();
    const keep = await createBooking(db, { ...emptyBooking('otro'), name: 'Se queda' });
    const gone = await createBooking(db, { ...emptyBooking('otro'), name: 'Desaparece' });
    const backup: ParsedBackup = {
      manifest: { format: 'nihon-trip-backup', formatVersion: 1, schemaVersion: 5, exportedAt: '', counts: {} },
      trips: [], days: [], bookings: [keep], activities: [], attachments: [],
    } as unknown as ParsedBackup;
    await importBackup(db, backup, 'replace');
    expect(await keys()).toEqual([`bookings:${gone.id}`]);
    await importBackup(db, { ...backup, bookings: [{ ...gone, updatedAt: Date.now() + 1000 }] } as ParsedBackup, 'merge');
    expect(await keys()).toEqual([]);
    expect(await db.bookings.get(gone.id)).toBeDefined();
  });

  it('«Borrar todos los datos» limpia también las marcas (no se propaga a la pareja)', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('otro'), name: 'X' });
    await deleteBooking(db, b.id);
    expect(await keys()).toHaveLength(1);
    await deleteAllData(db);
    expect(await keys()).toEqual([]);
  });
});
