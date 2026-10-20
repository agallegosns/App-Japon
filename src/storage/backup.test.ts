// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { bytesBlob, freshDb } from '../test/helpers';
import { addAttachment } from './attachments';
import { createActivity, emptyActivity } from './activities';
import { exportBackup, importBackup, parseBackup, deleteAllData } from './backup';
import { createBooking, emptyBooking } from './bookings';
import type { NihonDB } from './db';
import { saveTrip } from './trips';

const dbs: NihonDB[] = [];
function db(): NihonDB {
  const d = freshDb();
  dbs.push(d);
  return d;
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()));
});

async function seed(d: NihonDB) {
  await saveTrip(d, { name: 'Viaje de prueba', startDate: '2030-04-01', endDate: '2030-04-03', cities: ['Ciudad A'], tz: 'Asia/Tokyo' });
  const b = await createBooking(d, {
    ...emptyBooking('alojamiento'),
    name: 'Hotel',
    addressJa: '東京都千代田区丸の内1丁目',
    price: { amount: 120.5, currency: 'EUR' },
    links: [{ label: 'Web', url: 'https://example.com' }],
    checkIn: { date: '2030-04-01', time: '15:00', tz: 'Asia/Tokyo' },
  });
  const pdf = Array.from({ length: 5000 }, (_, i) => i % 251);
  await addAttachment(d, b.id, bytesBlob(pdf, 'application/pdf'), 'reserva.pdf');
  await addAttachment(d, b.id, bytesBlob([9, 8, 7], 'image/png'), 'captura.png');
  await createActivity(d, { ...emptyActivity('2030-04-01'), title: 'Paseo', bookingId: b.id, mapRef: { type: 'coords', lat: 35, lng: 135.7 } });
  return { pdf };
}

async function snapshot(d: NihonDB) {
  const atts = await d.attachments.toArray();
  return {
    trips: await d.trips.toArray(),
    days: (await d.days.toArray()).sort((a, b) => a.date.localeCompare(b.date)),
    bookings: await d.bookings.toArray(),
    activities: await d.activities.toArray(),
    attachments: await Promise.all(
      atts
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async ({ blob, ...rest }) => ({ ...rest, type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) })),
    ),
  };
}

describe('copia de seguridad', () => {
  it('exportar → importar (reemplazar) sin pérdida', async () => {
    const src = db();
    await seed(src);
    const before = await snapshot(src);
    const { bytes, manifest } = await exportBackup(src);
    expect(manifest.counts).toMatchObject({ trips: 1, days: 3, bookings: 1, activities: 1, attachments: 2, attachmentBytes: 5003 });

    const dst = db();
    await createBooking(dst, { ...emptyBooking('otro'), name: 'Se borrará' });
    const parsed = parseBackup(bytes);
    await importBackup(dst, parsed, 'replace');
    expect(await snapshot(dst)).toEqual(before);
  });

  it('combinar conserva lo existente y añade lo nuevo', async () => {
    const src = db();
    await seed(src);
    const { bytes } = await exportBackup(src);

    const dst = db();
    const local = await createBooking(dst, { ...emptyBooking('otro'), name: 'Local' });
    const result = await importBackup(dst, parseBackup(bytes), 'merge');
    expect(result.added).toBeGreaterThan(0);
    const names = (await dst.bookings.toArray()).map((b) => b.name).sort();
    expect(names).toEqual(['Hotel', 'Local']);
    expect(await dst.bookings.get(local.id)).toBeDefined();
    expect(await dst.attachments.count()).toBe(2);

    // Importar dos veces la misma copia no duplica nada.
    const again = await importBackup(dst, parseBackup(bytes), 'merge');
    expect(again.added).toBe(0);
    expect(await dst.bookings.count()).toBe(2);
  });

  it('rechaza archivos que no son copias o que están dañados', async () => {
    expect(() => parseBackup(new Uint8Array([1, 2, 3]))).toThrow(/zip/);
    expect(() => parseBackup(zipSync({ 'a.txt': strToU8('hola') }))).toThrow(/Nihon Trip/);
    const src = db();
    await seed(src);
    const { bytes } = await exportBackup(src);
    const { unzipSync } = await import('fflate');
    const entries = unzipSync(bytes);
    const broken: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(entries)) if (!k.endsWith('.png')) broken[k] = v;
    expect(() => parseBackup(zipSync(broken))).toThrow(/Falta el archivo/);
    const future = { ...entries, 'manifest.json': strToU8(JSON.stringify({ format: 'nihon-trip-backup', formatVersion: 99, schemaVersion: 1 })) };
    expect(() => parseBackup(zipSync(future))).toThrow(/más nueva/);
  });

  it('borrar todos los datos deja la base vacía', async () => {
    const d = db();
    await seed(d);
    await deleteAllData(d);
    expect(await d.bookings.count()).toBe(0);
    expect(await d.attachments.count()).toBe(0);
    expect(await d.trips.count()).toBe(0);
  });
});
