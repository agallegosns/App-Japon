import { describe, expect, it } from 'vitest';
import { bookingsOnDate, dayTimeline, flightDates, flightsOnDate, homeDay, legsOf } from './dayEvents';
import type { Activity, Booking, FlightLeg } from './types';

const leg = (from: string, to: string, d: [string, string, string], a: [string, string, string]): FlightLeg => ({
  id: `${from}${to}`, from, to, flightNumber: '',
  depart: { date: d[0], time: d[1], tz: d[2] }, arrive: { date: a[0], time: a[1], tz: a[2] },
});
function booking(id: string, category: Booking['category'], patch: Partial<Booking> = {}): Booking {
  return {
    id, name: id, category, status: 'confirmada', start: null, arrival: null, checkIn: null, checkOut: null,
    address: '', addressJa: '', legs: [], price: null, phone: '', contact: '', notes: '', links: [],
    sortAt: 1, createdAt: 1, updatedAt: 1, ...patch,
  };
}

const vuelo = booking('vuelo', 'vuelo', {
  legs: [
    leg('MAD', 'DOH', ['2030-05-01', '14:00', 'Europe/Madrid'], ['2030-05-01', '22:30', 'Asia/Qatar']),
    leg('DOH', 'HND', ['2030-05-02', '01:15', 'Asia/Qatar'], ['2030-05-02', '18:00', 'Asia/Tokyo']),
  ],
});

describe('días de vuelo', () => {
  it('un vuelo con escala marca el día de salida y el de llegada', () => {
    expect([...flightDates([vuelo])].sort()).toEqual(['2030-05-01', '2030-05-02']);
    expect(flightsOnDate('2030-05-01', [vuelo])[0]).toMatchObject({ departsToday: true, arrivesToday: true });
    expect(flightsOnDate('2030-05-01', [vuelo])[0]?.legs).toHaveLength(1);
    expect(flightsOnDate('2030-05-02', [vuelo])[0]?.legs.map((l) => l.to)).toEqual(['HND']);
    expect(flightsOnDate('2030-05-03', [vuelo])).toEqual([]);
  });

  it('un vuelo sin tramos usa su salida y llegada, y uno cancelado no cuenta', () => {
    const simple = booking('simple', 'vuelo', { start: { date: '2030-06-01', time: '10:00', tz: 'Europe/Madrid' }, arrival: { date: '2030-06-02', time: '08:00', tz: 'Asia/Tokyo' } });
    expect(legsOf(simple)).toHaveLength(1);
    expect(flightsOnDate('2030-06-02', [simple])).toHaveLength(1);
    expect(flightsOnDate('2030-06-02', [{ ...simple, status: 'cancelada' }])).toEqual([]);
  });
});

describe('reservas del día', () => {
  const act = (patch: Partial<Activity>): Activity => ({
    id: 'a', title: 't', date: '2030-05-03', startTime: null, endTime: null, tz: 'Asia/Tokyo', location: '', address: '', addressJa: '',
    durationMin: null, notes: '', bookingId: null, status: 'pendiente', mapRef: null, order: 0, createdAt: 1, updatedAt: 1, ...patch,
  });
  const cena = booking('cena', 'restaurante', { start: { date: '2030-05-03', time: '20:00', tz: 'Asia/Tokyo' } });
  const museo = booking('museo', 'entrada', { start: { date: '2030-05-03', time: '10:00', tz: 'Asia/Tokyo' } });

  it('ordena por hora, ignora vuelos y alojamientos y oculta las enlazadas desde una actividad', () => {
    const hotel = booking('hotel', 'alojamiento', { start: { date: '2030-05-03', time: '09:00', tz: 'Asia/Tokyo' } });
    expect(bookingsOnDate('2030-05-03', [cena, museo, vuelo, hotel], []).map((b) => b.id)).toEqual(['museo', 'cena']);
    expect(bookingsOnDate('2030-05-03', [cena, museo], [act({ bookingId: 'cena' })]).map((b) => b.id)).toEqual(['museo']);
    expect(bookingsOnDate('2030-05-04', [cena], [])).toEqual([]);
  });
});

describe('plan del día', () => {
  const act = (patch: Partial<Activity>): Activity => ({
    id: 'a', title: 'Actividad', date: '2030-05-02', startTime: null, endTime: null, tz: 'Asia/Tokyo', location: '', address: '', addressJa: '',
    durationMin: null, notes: '', bookingId: null, status: 'pendiente', mapRef: null, order: 0, createdAt: 1, updatedAt: 1, ...patch,
  });
  const cena = booking('cena', 'restaurante', { start: { date: '2030-05-02', time: '20:30', tz: 'Asia/Tokyo' } });

  it('mezcla vuelos, actividades y reservas por hora y deja al final lo que no tiene hora', () => {
    const entries = dayTimeline(
      '2030-05-02',
      [act({ id: 'x', title: 'Check-in', startTime: '19:00', location: 'Hotel' }), act({ id: 'y', title: 'Sin hora', order: 1 }), act({ id: 'z', title: 'Omitida', status: 'omitida' })],
      [vuelo, cena],
    );
    expect(entries.map((e) => `${e.kind}:${e.time ?? '-'}`)).toEqual(['flight:01:15', 'activity:19:00', 'booking:20:30', 'activity:-']);
    expect(entries[0]?.title).toContain('DOH → HND');
    expect(entries[0]?.subtitle).toBe('Llega a las 18:00 (hora local)');
    expect(entries[1]?.subtitle).toBe('Hotel');
  });

  it('un vuelo nocturno aparece como llegada en el día en que aterriza', () => {
    const nocturno = booking('noc', 'vuelo', {
      legs: [leg('MAD', 'HND', ['2030-05-01', '23:00', 'Europe/Madrid'], ['2030-05-02', '18:30', 'Asia/Tokyo'])],
    });
    const salida = dayTimeline('2030-05-01', [], [nocturno])[0];
    const llegada = dayTimeline('2030-05-02', [], [nocturno])[0];
    expect(salida?.subtitle).toBe('Llega a las 18:30 (hora local, 02/05)');
    expect(llegada).toMatchObject({ time: '18:30', title: 'Llegada a HND' });
  });

  it('elige el día que se enseña en inicio', () => {
    const days = [{ date: '2030-05-01' }, { date: '2030-05-02' }, { date: '2030-05-03' }];
    expect(homeDay('2030-05-02', days, [], [])).toBe('2030-05-02');
    expect(homeDay('2030-04-20', days, [], [vuelo])).toBe('2030-05-01');
    expect(homeDay('2030-04-20', days, [], [])).toBeNull();
    expect(homeDay('2030-05-09', days, [act({})], [])).toBeNull();
  });
});
