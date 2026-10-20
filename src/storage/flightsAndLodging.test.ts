// @vitest-environment node
import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyLeg } from '../models/flights';
import { bookingWarnings } from '../models/warnings';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, parseBackup } from './backup';
import { createActivity, emptyActivity, getActivity, sortDayByTime } from './activities';
import { createBooking, deleteBooking, emptyBooking, getBooking, updateBooking } from './bookings';
import type { NihonDB } from './db';
import { CURRENT_SCHEMA_VERSION } from './schema';
import { listDays, saveTrip, setDayLodging } from './trips';
import { ValidationError } from './validation';
import { freshDb } from '../test/helpers';
import type { FlightLeg } from '../models/types';

let db: NihonDB;
afterEach(async () => {
  await db.delete();
});

const madDoh: FlightLeg = {
  ...emptyLeg(),
  from: 'Madrid (MAD)',
  to: 'Doha (DOH)',
  flightNumber: 'qr150', car: '', seat: '', fare: '',
  depart: { date: '2030-05-01', time: '14:00', tz: 'Europe/Madrid' },
  arrive: { date: '2030-05-01', time: '22:30', tz: 'Asia/Qatar' },
};
const dohHnd: FlightLeg = {
  ...emptyLeg(),
  from: 'Doha (DOH)',
  to: 'Tokio (HND)',
  depart: { date: '2030-05-02', time: '01:15', tz: 'Asia/Qatar' },
  arrive: { date: '2030-05-02', time: '18:00', tz: 'Asia/Tokyo' },
};

describe('vuelos con escalas', () => {
  it('la salida y la llegada del vuelo son las del primer y último tramo, y se conservan los tramos', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('vuelo'), name: 'MAD → HND', legs: [madDoh, dohHnd] });
    expect(b.start).toEqual(madDoh.depart);
    expect(b.arrival).toEqual(dohHnd.arrive);
    expect(b.sortAt).not.toBeNull();
    const read = await getBooking(db, b.id);
    expect(read?.legs).toHaveLength(2);
    expect(read?.legs[0]?.flightNumber).toBe('QR150');
  });

  it('descarta los tramos vacíos y deja un vuelo sin tramos como vuelo simple', async () => {
    db = freshDb();
    const b = await createBooking(db, {
      ...emptyBooking('vuelo'),
      name: 'Vuelo simple',
      legs: [emptyLeg()],
      start: { date: '2030-05-01', time: '10:00', tz: 'Europe/Madrid' },
    });
    expect(b.legs).toEqual([]);
    expect(b.start?.time).toBe('10:00');
  });

  it('solo los vuelos tienen tramos', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('restaurante'), name: 'Cena', legs: [madDoh] });
    expect(b.legs).toEqual([]);
  });

  it('rechaza una llegada anterior a la salida y un enlace imposible entre tramos', async () => {
    db = freshDb();
    const backwards = { ...madDoh, arrive: { date: '2030-05-01', time: '10:00', tz: 'Asia/Qatar' } };
    await expect(createBooking(db, { ...emptyBooking('vuelo'), name: 'x', legs: [backwards] })).rejects.toBeInstanceOf(ValidationError);
    const early = { ...dohHnd, depart: { date: '2030-05-01', time: '20:00', tz: 'Asia/Qatar' } };
    await expect(createBooking(db, { ...emptyBooking('vuelo'), name: 'x', legs: [madDoh, early] })).rejects.toBeInstanceOf(ValidationError);
  });

  it('se puede editar y quitar una escala', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('vuelo'), name: 'v', legs: [madDoh, dohHnd] });
    const edited = await updateBooking(db, b.id, { ...emptyBooking('vuelo'), name: 'v', legs: [madDoh] });
    expect(edited.legs).toHaveLength(1);
    expect(edited.arrival).toEqual(madDoh.arrive);
  });

  it('avisa de las escalas muy cortas', async () => {
    db = freshDb();
    const tight = { ...dohHnd, depart: { date: '2030-05-01', time: '23:10', tz: 'Asia/Qatar' } };
    const b = await createBooking(db, { ...emptyBooking('vuelo'), name: 'v', status: 'confirmada', legs: [madDoh, tight] });
    expect(bookingWarnings(b).some((w) => w.startsWith('Escala muy corta en Doha (DOH)'))).toBe(true);
    const ok = await createBooking(db, { ...emptyBooking('vuelo'), name: 'v', status: 'confirmada', legs: [madDoh, dohHnd] });
    expect(bookingWarnings(ok).some((w) => w.startsWith('Escala'))).toBe(false);
  });
});

describe('alojamiento por día', () => {
  it('se elige y se quita a mano; al borrar el alojamiento el día vuelve a automático', async () => {
    db = freshDb();
    const trip = await saveTrip(db, { name: 'Viaje', startDate: '2030-04-01', endDate: '2030-04-02', cities: ['A'], tz: 'Asia/Tokyo' });
    const hotel = await createBooking(db, { ...emptyBooking('alojamiento'), name: 'Hotel de prueba' });
    const [d1] = await listDays(db, trip.id);
    expect(d1?.lodgingId).toBeNull();

    await setDayLodging(db, d1!.id, hotel.id);
    expect((await listDays(db, trip.id))[0]?.lodgingId).toBe(hotel.id);

    await deleteBooking(db, hotel.id);
    expect((await listDays(db, trip.id))[0]?.lodgingId).toBeNull();
  });

  it('rechaza reservas que no son alojamientos y días que no existen', async () => {
    db = freshDb();
    const trip = await saveTrip(db, { name: 'Viaje', startDate: '2030-04-01', endDate: '2030-04-01', cities: [], tz: 'Asia/Tokyo' });
    const cena = await createBooking(db, { ...emptyBooking('restaurante'), name: 'Cena' });
    const [d1] = await listDays(db, trip.id);
    await expect(setDayLodging(db, d1!.id, cena.id)).rejects.toThrow(/no existe/);
    await expect(setDayLodging(db, 'nada', null)).rejects.toThrow(/no existe/);
  });
});

describe('copias antiguas', () => {
  it('al importar una copia anterior se quitan localizadores y QR y se rellenan los campos nuevos', () => {
    const oldBackup = zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, schemaVersion: 1, exportedAt: '2030-01-01T00:00:00Z', counts: {} })),
      'data.json': strToU8(
        JSON.stringify({
          trips: [],
          days: [{ id: 'd1', tripId: 't', date: '2030-04-01', city: '' }],
          bookings: [{ id: 'b1', name: 'Hotel', category: 'alojamiento', status: 'confirmada', confirmationCode: 'SECRETO', addressJa: '東京都', createdAt: 1, updatedAt: 1 }],
          activities: [],
          attachments: [
            { id: 'a1', bookingId: 'b1', kind: 'code', name: 'qr.png', mime: 'image/png', size: 1, createdAt: 1, path: 'attachments/a1' },
            { id: 'a2', bookingId: 'b1', kind: 'image', name: 'foto.png', mime: 'image/png', size: 1, createdAt: 1, path: 'attachments/a2' },
          ],
        }),
      ),
      'attachments/a1': new Uint8Array([1]),
      'attachments/a2': new Uint8Array([2]),
    });
    const parsed = parseBackup(oldBackup);
    expect(parsed.attachments.map((a) => a.id)).toEqual(['a2']);
    expect(parsed.bookings[0]).not.toHaveProperty('confirmationCode');
    expect(parsed.bookings[0]?.legs).toEqual([]);
    expect(parsed.bookings[0]).not.toHaveProperty('addressJa');
    expect(parsed.bookings[0]).toMatchObject({ guests: 2, taxes: [] });
    expect(parsed.days[0]?.lodgingId).toBeNull();
    expect(JSON.stringify(parsed)).not.toContain('SECRETO');
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });
});

describe('tasas de alojamiento', () => {
  const tax = { id: 't1', name: ' Tasa de alojamiento ', amount: 200, currency: 'JPY', basis: 'persona_noche' as const, paid: false };

  it('se guardan en alojamientos con el nombre limpio y se recuperan', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('alojamiento'), name: 'Hotel', guests: 3, taxes: [tax] });
    const read = await getBooking(db, b.id);
    expect(read?.guests).toBe(3);
    expect(read?.taxes).toEqual([{ ...tax, name: 'Tasa de alojamiento' }]);
  });

  it('solo existen en los alojamientos', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('restaurante'), name: 'Cena', taxes: [tax] });
    expect(b.taxes).toEqual([]);
  });

  it('se validan: nombre, importe, moneda, tipo y personas', async () => {
    db = freshDb();
    const base = { ...emptyBooking('alojamiento'), name: 'Hotel' };
    await expect(createBooking(db, { ...base, taxes: [{ ...tax, name: '  ' }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(createBooking(db, { ...base, taxes: [{ ...tax, amount: -5 }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(createBooking(db, { ...base, taxes: [{ ...tax, amount: Number.NaN }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(createBooking(db, { ...base, taxes: [{ ...tax, currency: 'yen' }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(createBooking(db, { ...base, guests: 0 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('actividades de todo el día', () => {
  it('no guardan horas ni duración aunque vengan rellenas', async () => {
    db = freshDb();
    const a = await createActivity(db, { ...emptyActivity('2030-05-02'), title: 'Excursión a Nikko', allDay: true, startTime: '09:00', endTime: '18:00', durationMin: 540 });
    const read = await getActivity(db, a.id);
    expect(read).toMatchObject({ allDay: true, startTime: null, endTime: null, durationMin: null });
  });

  it('una actividad normal conserva sus horas', async () => {
    db = freshDb();
    const a = await createActivity(db, { ...emptyActivity('2030-05-02'), title: 'Cena', startTime: '20:00', endTime: '21:30' });
    expect(await getActivity(db, a.id)).toMatchObject({ allDay: false, startTime: '20:00', endTime: '21:30' });
  });
});

describe('ordenar el día por hora', () => {
  it('reordena las actividades: todo el día, por hora y sin hora al final', async () => {
    db = freshDb();
    const date = '2030-05-02';
    const cena = await createActivity(db, { ...emptyActivity(date), title: 'Cena', startTime: '20:00' });
    const sinHora = await createActivity(db, { ...emptyActivity(date), title: 'Pasear' });
    const desayuno = await createActivity(db, { ...emptyActivity(date), title: 'Desayuno', startTime: '08:00' });
    const todo = await createActivity(db, { ...emptyActivity(date), title: 'Nikko', allDay: true });
    await sortDayByTime(db, date);
    const order = async (id: string) => (await getActivity(db, id))?.order;
    expect([await order(todo.id), await order(desayuno.id), await order(cena.id), await order(sinHora.id)]).toEqual([0, 1, 2, 3]);
  });
});

describe('trenes con vagón, asiento y Suica', () => {
  const tren = (patch: object = {}) => ({
    ...emptyLeg(), from: ' Tokio ', to: 'Kioto', flightNumber: ' Nozomi 25 ', car: ' 7 ', seat: ' 12a ', fare: 'reservado' as const,
    depart: { date: '2030-05-05', time: '09:00', tz: 'Asia/Tokyo' }, arrive: { date: '2030-05-05', time: '11:15', tz: 'Asia/Tokyo' }, ...patch,
  });

  it('guarda los trayectos limpios y toma la salida y la llegada del primer y último trayecto', async () => {
    db = freshDb();
    const b = await createBooking(db, { ...emptyBooking('transporte'), name: 'Tokio-Kioto', legs: [tren()] });
    const read = await getBooking(db, b.id);
    expect(read?.legs[0]).toMatchObject({ from: 'Tokio', flightNumber: 'Nozomi 25', car: '7', seat: '12A', fare: 'reservado' });
    expect(read?.start?.time).toBe('09:00');
    expect(read?.arrival?.time).toBe('11:15');
  });

  it('con Suica o un transbordo se guardan varios trayectos, y los vuelos no guardan vagón ni asiento', async () => {
    db = freshDb();
    const t2 = tren({ id: 'x2', from: 'Kioto', to: 'Nara', fare: 'suica', car: '', seat: '', depart: { date: '2030-05-05', time: '11:30', tz: 'Asia/Tokyo' }, arrive: { date: '2030-05-05', time: '12:15', tz: 'Asia/Tokyo' } });
    const b = await createBooking(db, { ...emptyBooking('transporte'), name: 'T', legs: [tren(), t2] });
    expect(b.legs.map((l) => l.fare)).toEqual(['reservado', 'suica']);
    const v = await createBooking(db, { ...emptyBooking('vuelo'), name: 'V', legs: [tren({ car: '9', seat: '1A', fare: 'reservado' })] });
    expect(v.legs[0]).toMatchObject({ car: '', seat: '', fare: '' });
  });

  it('rechaza un trayecto que llega antes de salir o un transbordo imposible', async () => {
    db = freshDb();
    const atras = tren({ arrive: { date: '2030-05-05', time: '08:00', tz: 'Asia/Tokyo' } });
    await expect(createBooking(db, { ...emptyBooking('transporte'), name: 'T', legs: [atras] })).rejects.toBeInstanceOf(ValidationError);
    const t2 = tren({ id: 'y', depart: { date: '2030-05-05', time: '10:00', tz: 'Asia/Tokyo' } });
    await expect(createBooking(db, { ...emptyBooking('transporte'), name: 'T', legs: [tren(), t2] })).rejects.toBeInstanceOf(ValidationError);
  });
});
