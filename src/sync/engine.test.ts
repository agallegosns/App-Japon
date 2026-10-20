// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../../cloudflare/worker.js';
import { createActivity, deleteActivity, emptyActivity, setActivityStatus } from '../storage/activities';
import { addAttachment } from '../storage/attachments';
import { createBooking, deleteBooking, emptyBooking, updateBooking } from '../storage/bookings';
import type { NihonDB } from '../storage/db';
import { listDays, saveTrip, setDayCity } from '../storage/trips';
import { bytesBlob, freshDb } from '../test/helpers';
import { FakeKV } from '../test/fakeKv';
import { SyncApi, SyncError } from './api';
import { deriveCredentials, generateCode, type Credentials } from './crypto';
import { hasLocalData, MAX_CLOUD_FILE_BYTES, syncNow } from './engine';

const ORIGIN = 'https://agallegosns.github.io';
const dbs: NihonDB[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function phone(): NihonDB {
  const db = freshDb();
  dbs.push(db);
  return db;
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()));
});

/** Servidor real (el mismo código que va en Cloudflare) con un almacén KV simulado. */
function server(kv: FakeKV = new FakeKV()) {
  const fetcher = async (input: string, init?: RequestInit) =>
    worker.fetch(new Request(input, { ...init, headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN } }), { DATA: kv });
  return { kv, api: new SyncApi('https://sync.test', fetcher) };
}

async function seed(db: NihonDB) {
  const trip = await saveTrip(db, { name: 'Viaje', startDate: '2030-05-01', endDate: '2030-05-03', cities: ['Tokio'], tz: 'Asia/Tokyo' });
  const hotel = await createBooking(db, { ...emptyBooking('alojamiento'), name: 'Hotel Granbell', address: 'Shinjuku' });
  const pdf = await addAttachment(db, hotel.id, bytesBlob([1, 2, 3, 4, 5], 'application/pdf'), 'reserva.pdf');
  const cena = await createActivity(db, { ...emptyActivity('2030-05-02'), title: 'Cena de sushi', startTime: '20:00' });
  return { trip, hotel, pdf, cena };
}

async function snapshot(db: NihonDB) {
  const strip = <T extends { id: string }>(rows: T[]) => rows.sort((a, b) => a.id.localeCompare(b.id));
  const atts = await db.attachments.toArray();
  return {
    trips: strip(await db.trips.toArray()),
    days: strip(await db.days.toArray()),
    bookings: strip(await db.bookings.toArray()),
    activities: strip(await db.activities.toArray()),
    attachments: await Promise.all(strip(atts).map(async (a) => ({ ...a, blob: Array.from(new Uint8Array(await a.blob.arrayBuffer())) }))),
  };
}

let creds: Credentials;
async function setup() {
  creds = await deriveCredentials(generateCode());
}

describe('sincronización entre dos móviles', () => {
  it('el primer móvil sube todo cifrado: el servidor no ve nada legible', async () => {
    await setup();
    const { kv, api } = server();
    const a = phone();
    await seed(a);
    const res = await syncNow(a, api, creds);
    expect(res.pushed).toBe(1 + 3 + 1 + 1 + 1); // viaje, 3 días, reserva, actividad, adjunto
    expect(res.warnings).toEqual([]);
    const stored = [...kv.store.entries()];
    expect(stored.length).toBe(res.pushed + 1); // + el archivo del adjunto
    const everything = JSON.stringify(stored.map(([k, v]) => [k, typeof v.value === 'string' ? v.value : Array.from(new Uint8Array(v.value))]));
    for (const secret of ['Granbell', 'sushi', 'Shinjuku', 'reserva.pdf', 'Viaje', 'Tokio']) expect(everything).not.toContain(secret);
  });

  it('el segundo móvil recibe exactamente lo mismo, adjuntos incluidos', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    await seed(a);
    await syncNow(a, api, creds);
    const res = await syncNow(b, api, creds, 'replaceLocal');
    expect(res.pulled).toBe(7);
    expect(res.pushed).toBe(0);
    expect(await snapshot(b)).toEqual(await snapshot(a));
  });

  it('sin cambios no vuelve a mandar nada, en ninguno de los dos móviles', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    await seed(a);
    await syncNow(a, api, creds);
    await syncNow(b, api, creds, 'replaceLocal');
    expect(await syncNow(a, api, creds)).toMatchObject({ pushed: 0, pulled: 0, deleted: 0 });
    expect(await syncNow(b, api, creds)).toMatchObject({ pushed: 0, pulled: 0, deleted: 0 });
  });

  it('lo que cambia uno aparece en el otro (reservas, actividades, ciudad del día)', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    const { hotel, cena, trip } = await seed(a);
    await syncNow(a, api, creds);
    await syncNow(b, api, creds, 'replaceLocal');

    await wait(5);
    await updateBooking(b, hotel.id, { ...hotel, name: 'Hotel Granbell Shinjuku', guests: 2, taxes: [], legs: [] });
    await setActivityStatus(b, cena.id, 'hecha');
    const days = await listDays(b, trip.id);
    await setDayCity(b, days[0]!.id, 'Kioto');
    const nueva = await createActivity(b, { ...emptyActivity('2030-05-03'), title: 'Templo', allDay: true });
    await syncNow(b, api, creds);
    const res = await syncNow(a, api, creds);

    expect(res.pulled).toBe(4);
    expect((await a.bookings.get(hotel.id))?.name).toBe('Hotel Granbell Shinjuku');
    expect((await a.activities.get(cena.id))?.status).toBe('hecha');
    expect((await a.days.get(days[0]!.id))?.city).toBe('Kioto');
    expect((await a.activities.get(nueva.id))?.allDay).toBe(true);
    expect(await snapshot(a)).toEqual(await snapshot(b));
  });

  it('los borrados llegan al otro móvil y lo borrado no reaparece', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    const { hotel, pdf, cena } = await seed(a);
    await syncNow(a, api, creds);
    await syncNow(b, api, creds, 'replaceLocal');

    await wait(5);
    await deleteActivity(a, cena.id);
    await deleteBooking(a, hotel.id); // también sus adjuntos
    await syncNow(a, api, creds);
    const res = await syncNow(b, api, creds);
    expect(res.deleted).toBe(3);
    expect(await b.activities.count()).toBe(0);
    expect(await b.bookings.count()).toBe(0);
    expect(await b.attachments.get(pdf.id)).toBeUndefined();

    // Una sincronización posterior de cualquiera no lo resucita.
    await syncNow(b, api, creds);
    await syncNow(a, api, creds);
    expect(await a.bookings.count()).toBe(0);
    expect(await b.bookings.count()).toBe(0);
    expect(await snapshot(a)).toEqual(await snapshot(b));
  });

  it('si los dos cambian lo mismo sin conexión, gana el cambio más reciente en ambos', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    const { cena } = await seed(a);
    await syncNow(a, api, creds);
    await syncNow(b, api, creds, 'replaceLocal');

    await wait(5);
    await a.activities.update(cena.id, { title: 'Cena (cambio de A)' });
    await wait(10);
    await b.activities.update(cena.id, { title: 'Cena (cambio de B, más reciente)' });
    await syncNow(a, api, creds); // A sube el suyo
    await syncNow(b, api, creds); // B sube el suyo (más nuevo) y el servidor se queda con él
    await syncNow(a, api, creds);
    expect((await a.activities.get(cena.id))?.title).toBe('Cena (cambio de B, más reciente)');
    expect((await b.activities.get(cena.id))?.title).toBe('Cena (cambio de B, más reciente)');
  });

  it('borrar en uno y editar después en el otro: gana lo más reciente (la edición recupera el elemento)', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    const { cena } = await seed(a);
    await syncNow(a, api, creds);
    await syncNow(b, api, creds, 'replaceLocal');
    await wait(5);
    await deleteActivity(a, cena.id);
    await syncNow(a, api, creds);
    await wait(10);
    await b.activities.update(cena.id, { title: 'Cena (B no sabía que A la borró)' });
    await syncNow(b, api, creds);
    await syncNow(a, api, creds);
    expect((await a.activities.get(cena.id))?.title).toBe('Cena (B no sabía que A la borró)');
  });

  it('acortar el viaje quita también los días en el otro móvil', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    await seed(a);
    await syncNow(a, api, creds);
    await syncNow(b, api, creds, 'replaceLocal');
    await wait(5);
    await saveTrip(a, { name: 'Viaje', startDate: '2030-05-01', endDate: '2030-05-02', cities: ['Tokio'], tz: 'Asia/Tokyo' });
    await syncNow(a, api, creds);
    await syncNow(b, api, creds);
    expect(await b.days.count()).toBe(2);
    expect((await b.trips.toArray())[0]?.endDate).toBe('2030-05-02');
  });

  it('muchos elementos se suben y se bajan por tandas', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    await saveTrip(a, { name: 'V', startDate: '2030-05-01', endDate: '2030-05-02', cities: [], tz: 'Asia/Tokyo' });
    for (let i = 0; i < 55; i++) await createActivity(a, { ...emptyActivity('2030-05-01'), title: `Actividad ${i}` });
    const up = await syncNow(a, api, creds);
    expect(up.pushed).toBe(1 + 2 + 55);
    const down = await syncNow(b, api, creds, 'replaceLocal');
    expect(down.pulled).toBe(58);
    expect(await b.activities.count()).toBe(55);
  });

  it('un código distinto no ve nada y la sala no se mezcla', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const intruso = phone();
    await seed(a);
    await syncNow(a, api, creds);
    const otra = await deriveCredentials(generateCode());
    const res = await syncNow(intruso, api, otra, 'replaceLocal');
    expect(res).toMatchObject({ pulled: 0, pushed: 0 });
    expect(await intruso.bookings.count()).toBe(0);
  });

  it('un dato alterado en el servidor no se aplica y se avisa; lo demás sigue funcionando', async () => {
    await setup();
    const { kv, api } = server();
    const a = phone();
    const b = phone();
    const { hotel } = await seed(a);
    await syncNow(a, api, creds);
    const name = `${creds.room}:bookings:${hotel.id}`;
    const entry = kv.store.get(name)!;
    const parsed = JSON.parse(entry.value as string) as { ct: string };
    entry.value = JSON.stringify({ ...parsed, ct: (parsed.ct[0] === 'A' ? 'B' : 'A') + parsed.ct.slice(1) });
    const res = await syncNow(b, api, creds, 'replaceLocal');
    expect(res.warnings.some((w) => w.includes(`bookings:${hotel.id}`))).toBe(true);
    expect(await b.bookings.count()).toBe(0);
    expect(await b.activities.count()).toBe(1);
  });

  it('un archivo demasiado grande para la nube se avisa y se queda solo en ese móvil', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const { pdf } = await seed(a);
    await a.attachments.update(pdf.id, { size: MAX_CLOUD_FILE_BYTES + 1 });
    const res = await syncNow(a, api, creds);
    expect(res.warnings.some((w) => w.includes('reserva.pdf') && w.includes('demasiado'))).toBe(true);
    expect(res.pushed).toBe(1 + 3 + 1 + 1); // todo menos el adjunto
  });

  it('sin conexión o con el servidor caído da un error claro y no toca los datos', async () => {
    await setup();
    const a = phone();
    await seed(a);
    const before = await snapshot(a);
    const caido = new SyncApi('https://sync.test', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(syncNow(a, caido, creds)).rejects.toMatchObject({ kind: 'network' });
    const error500 = new SyncApi('https://sync.test', async () => new Response(JSON.stringify({ error: 'límite diario' }), { status: 500 }));
    await expect(syncNow(a, error500, creds)).rejects.toMatchObject({ kind: 'server', message: 'límite diario' });
    const prohibido = new SyncApi('https://sync.test', async () => new Response('{}', { status: 403 }));
    await expect(syncNow(a, prohibido, creds)).rejects.toBeInstanceOf(SyncError);
    expect(await snapshot(a)).toEqual(before);
  });

  it('«Descargar lo de la nube» sustituye lo que hubiera en el móvil', async () => {
    await setup();
    const { api } = server();
    const a = phone();
    const b = phone();
    await seed(a);
    await syncNow(a, api, creds);
    await createBooking(b, { ...emptyBooking('otro'), name: 'Dato viejo de B' });
    expect(await hasLocalData(b)).toBe(true);
    await syncNow(b, api, creds, 'replaceLocal');
    expect((await b.bookings.toArray()).map((x) => x.name)).toEqual(['Hotel Granbell']);
  });

  it('la sala se puede borrar entera de la nube', async () => {
    await setup();
    const { kv, api } = server();
    const a = phone();
    await seed(a);
    await syncNow(a, api, creds);
    expect(kv.store.size).toBeGreaterThan(0);
    const res = await api.wipe(creds.room);
    expect(res.deleted).toBe(8);
    expect(kv.store.size).toBe(0);
  });
});
