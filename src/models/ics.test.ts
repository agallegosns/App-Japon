import { describe, expect, it } from 'vitest';
import { activityEvents, bookingEvents, buildIcs, escapeText, foldLine, tripIcs, utcStamp } from './ics';
import type { Activity, Booking } from './types';

const act = (patch: Partial<Activity>): Activity => ({
  id: 'a1', title: 'Templo, Senso-ji', date: '2030-05-03', allDay: false, startTime: '09:30', endTime: '11:00', tz: 'Asia/Tokyo', location: 'Asakusa', address: '', durationMin: null, notes: 'Llevar efectivo; entrada gratis', bookingId: null, status: 'pendiente', mapRef: null, order: 0, createdAt: 1, updatedAt: 1, ...patch,
});
const booking = (patch: Partial<Booking>): Booking => ({
  id: 'b1', name: 'Hotel', category: 'alojamiento', status: 'confirmada', start: null, arrival: null, checkIn: null, checkOut: null, address: 'Shinjuku', legs: [], guests: 2, taxes: [], price: null, phone: '', contact: '', notes: '', links: [], sortAt: 1, createdAt: 1, updatedAt: 1, ...patch,
});

describe('calendario .ics', () => {
  it('escapa y pliega el texto según el formato', () => {
    expect(escapeText('a,b;c\nd\\e')).toBe('a\\,b\\;c\\nd\\\\e');
    const folded = foldLine('DESCRIPTION:' + 'あ'.repeat(60));
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe('DESCRIPTION:' + 'あ'.repeat(60));
  });

  it('convierte las horas locales de Japón a UTC y añade un aviso de 30 minutos', () => {
    const [e] = activityEvents([act({})]);
    expect(utcStamp(e!.start as number)).toBe('20300503T003000Z'); // 09:30 JST = 00:30 UTC
    expect(utcStamp(e!.end!)).toBe('20300503T020000Z');
    expect(e!.alarmMinutes).toBe(30);
  });

  it('una actividad marcada «todo el día» es un evento de fecha sin aviso', () => {
    const [e] = activityEvents([act({ allDay: true, startTime: '10:00' })]);
    expect(e!.start).toEqual({ date: '2030-05-03' });
    expect(e!.alarmMinutes).toBe(0);
  });

  it('una actividad sin hora es de día completo y las omitidas no se exportan', () => {
    const events = activityEvents([act({ startTime: null, endTime: null }), act({ id: 'a2', status: 'omitida' })]);
    expect(events).toHaveLength(1);
    expect(events[0]!.start).toEqual({ date: '2030-05-03' });
    expect(events[0]!.alarmMinutes).toBe(0);
  });

  it('vuelos: un evento por tramo con aviso de 3 horas; hoteles: check-in y check-out', () => {
    const vuelo = booking({
      id: 'v', category: 'vuelo', name: 'MAD-HND',
      legs: [
        { id: 'l1', from: 'Madrid (MAD)', to: 'Doha (DOH)', flightNumber: 'QR150', depart: { date: '2030-05-01', time: '14:00', tz: 'Europe/Madrid' }, arrive: { date: '2030-05-01', time: '22:30', tz: 'Asia/Qatar' } },
        { id: 'l2', from: 'Doha (DOH)', to: 'Tokio (HND)', flightNumber: '', depart: { date: '2030-05-02', time: '01:15', tz: 'Asia/Qatar' }, arrive: { date: '2030-05-02', time: '18:00', tz: 'Asia/Tokyo' } },
      ],
    });
    const hotel = booking({ checkIn: { date: '2030-05-02', time: '15:00', tz: 'Asia/Tokyo' }, checkOut: { date: '2030-05-05', time: null, tz: 'Asia/Tokyo' } });
    const events = bookingEvents([vuelo, hotel, booking({ id: 'x', status: 'cancelada', checkIn: { date: '2030-05-02', time: '15:00', tz: 'Asia/Tokyo' } })]);
    expect(events.map((e) => e.summary)).toEqual(['Vuelo QR150 Madrid (MAD) → Doha (DOH)', 'Vuelo Doha (DOH) → Tokio (HND)', 'Check-in: Hotel', 'Check-out: Hotel']);
    expect(events[0]!.alarmMinutes).toBe(180);
    expect(utcStamp(events[0]!.start as number)).toBe('20300501T120000Z'); // 14:00 CEST = 12:00 UTC
  });

  it('genera un calendario válido con CRLF y sin eventos duplicados', () => {
    const { ics, count } = tripIcs([act({})], [booking({ checkIn: { date: '2030-05-02', time: '15:00', tz: 'Asia/Tokyo' } })], new Date('2030-01-01T00:00:00Z'));
    expect(count).toBe(2);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics).toContain('SUMMARY:Templo\\, Senso-ji');
    const uids = ics.match(/UID:.*/g) ?? [];
    expect(new Set(uids).size).toBe(uids.length);
    expect(buildIcs([], new Date(0))).toContain('END:VCALENDAR');
  });
});
