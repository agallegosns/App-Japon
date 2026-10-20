// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { bytesBlob, freshDb } from '../test/helpers';
import { addAttachment, listAttachments } from './attachments';
import { createActivity, emptyActivity, getActivity } from './activities';
import { createBooking, deleteBooking, emptyBooking, getBooking, listBookings, updateBooking } from './bookings';
import type { NihonDB } from './db';
import { getBackupStatus } from './meta';
import { ValidationError } from './validation';

let db: NihonDB;
afterEach(async () => {
  await db.delete();
});

describe('reservas: CRUD', () => {
  it('crea, lee, actualiza y lista por fecha', async () => {
    db = freshDb();
    const hotel = await createBooking(db, {
      ...emptyBooking('alojamiento'),
      name: '  Hotel de prueba ',
      checkIn: { date: '2030-04-02', time: '15:00', tz: 'Asia/Tokyo' },
    });
    const vuelo = await createBooking(db, {
      ...emptyBooking('vuelo'),
      name: 'Vuelo de prueba',
      start: { date: '2030-04-01', time: '13:00', tz: 'Europe/Madrid' },
      arrival: { date: '2030-04-02', time: '09:00', tz: 'Asia/Tokyo' },
    });
    const sinFecha = await createBooking(db, { ...emptyBooking('otro'), name: 'Sin fecha' });

    expect((await getBooking(db, hotel.id))?.name).toBe('Hotel de prueba');
    expect((await listBookings(db)).map((b) => b.id)).toEqual([vuelo.id, hotel.id, sinFecha.id]);

    const updated = await updateBooking(db, hotel.id, {
      ...emptyBooking('alojamiento'),
      name: 'Hotel editado',
      status: 'confirmada',
      checkIn: { date: '2030-03-30', time: '15:00', tz: 'Asia/Tokyo' },
    });
    expect(updated.status).toBe('confirmada');
    expect((await listBookings(db))[0]?.id).toBe(hotel.id);
    expect((await getBackupStatus(db)).changesSinceBackup).toBe(4);
  });

  it('rechaza datos no válidos', async () => {
    db = freshDb();
    await expect(createBooking(db, { ...emptyBooking('vuelo'), name: '' })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createBooking(db, {
        ...emptyBooking('otro'),
        name: 'x',
        links: [{ label: 'web', url: 'javascript:alert(1)' }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createBooking(db, {
        ...emptyBooking('alojamiento'),
        name: 'x',
        checkIn: { date: '2030-04-05', time: null, tz: 'Asia/Tokyo' },
        checkOut: { date: '2030-04-01', time: null, tz: 'Asia/Tokyo' },
      }),
    ).rejects.toThrow(/check-out/);
    expect(await db.bookings.count()).toBe(0);
  });

  it('al eliminar borra adjuntos y desvincula actividades', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('restaurante'), name: 'Cena' });
    await addAttachment(db, b.id, bytesBlob([1, 2, 3], 'application/pdf'), 'r.pdf');
    const a = await createActivity(db, { ...emptyActivity('2030-04-01'), title: 'Cenar', bookingId: b.id });
    await deleteBooking(db, b.id);
    expect(await getBooking(db, b.id)).toBeUndefined();
    expect(await db.attachments.count()).toBe(0);
    expect((await getActivity(db, a.id))?.bookingId).toBeNull();
  });
});

describe('adjuntos', () => {
  it('persisten como Blob y se recuperan idénticos tras reabrir la base de datos', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('entrada'), name: 'Museo' });
    const bytes = Array.from({ length: 2048 }, (_, i) => (i * 7) % 256);
    await addAttachment(db, b.id, bytesBlob(bytes, 'image/png'), 'captura.png', 'image');
    await addAttachment(db, b.id, bytesBlob([37, 80, 68, 70], 'application/pdf'), 'billete.pdf');

    const name = db.name;
    db.close();
    const { NihonDB } = await import('./db');
    db = new NihonDB(name);

    const list = (await listAttachments(db, b.id)).sort((x, y) => x.name.localeCompare(y.name));
    expect(list.map((a) => [a.name, a.kind, a.size])).toEqual([
      ['billete.pdf', 'pdf', 4],
      ['captura.png', 'image', 2048],
    ]);
    const first = list[1];
    expect(first?.blob).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await first!.blob.arrayBuffer()))).toEqual(bytes);
    expect((await getBackupStatus(db)).attachmentsSinceBackup).toBe(2);
  });

  it('rechaza tipos no admitidos y archivos vacíos', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('otro'), name: 'x' });
    await expect(addAttachment(db, b.id, bytesBlob([1], 'text/plain'), 'a.txt')).rejects.toThrow(/no admitido/);
    await expect(addAttachment(db, b.id, bytesBlob([], 'image/png'), 'a.png')).rejects.toThrow(/vacío/);
  });
});
