import { describe, expect, it } from 'vitest';
import { addMonths, calendarMarkers, monthGrid, monthLabel, monthOf, weekOf } from './calendar';
import type { Activity, Booking } from './types';

describe('calendario del mes', () => {
  it('construye semanas completas que empiezan en lunes', () => {
    const grid = monthGrid('2026-10'); // 1 oct 2026 es jueves
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0]?.[0]).toBe('2026-09-28');
    expect(grid[0]?.[3]).toBe('2026-10-01');
    expect(grid[grid.length - 1]?.[6]).toBe('2026-11-01');
    expect(grid.flat().filter((d) => monthOf(d) === '2026-10')).toHaveLength(31);
  });

  it('un mes que empieza en lunes no añade días anteriores', () => {
    const grid = monthGrid('2030-04'); // 1 abr 2030 es lunes
    expect(grid[0]?.[0]).toBe('2030-04-01');
    expect(monthGrid('2031-02').flat().filter((d) => monthOf(d) === '2031-02')).toHaveLength(28);
  });

  it('la semana va de lunes a domingo, también al cruzar de mes o de año', () => {
    expect(weekOf('2026-10-20')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(weekOf('2026-10-25')[0]).toBe('2026-10-19'); // domingo
    expect(weekOf('2026-10-19')[0]).toBe('2026-10-19'); // lunes
    expect(weekOf('2030-05-01')).toEqual(['2030-04-29', '2030-04-30', '2030-05-01', '2030-05-02', '2030-05-03', '2030-05-04', '2030-05-05']);
    expect(weekOf('2030-12-31')[6]).toBe('2031-01-05');
  });

  it('navega entre meses cruzando el año', () => {
    expect(addMonths('2030-12', 1)).toBe('2031-01');
    expect(addMonths('2031-01', -1)).toBe('2030-12');
    expect(addMonths('2031-05', 0)).toBe('2031-05');
    expect(addMonths('2031-05', 13)).toBe('2032-06');
    expect(monthLabel('2031-05')).toBe('Mayo de 2031');
  });

  const act = (date: string, status: Activity['status'] = 'pendiente'): Activity => ({
    id: date + status, title: 't', date, allDay: false, startTime: null, endTime: null, tz: 'Asia/Tokyo', location: '', address: '',
    durationMin: null, notes: '', bookingId: null, status, mapRef: null, order: 0, createdAt: 1, updatedAt: 1,
  });
  const booking = (patch: Partial<Booking>): Booking => ({
    id: 'b', name: 'n', category: 'otro', status: 'confirmada', start: null, arrival: null, checkIn: null, checkOut: null, address: '', legs: [],
    guests: 2, taxes: [], price: null, phone: '', contact: '', notes: '', links: [], sortAt: 1, createdAt: 1, updatedAt: 1, ...patch,
  });
  const ldt = (date: string) => ({ date, time: '10:00', tz: 'Asia/Tokyo' });

  it('marca vuelos, actividades, reservas y cambios de hotel de cada día', () => {
    const markers = calendarMarkers(
      [act('2030-05-02'), act('2030-05-02'), act('2030-05-03', 'omitida')],
      [
        booking({ id: 'v', category: 'vuelo', start: ldt('2030-05-01'), arrival: ldt('2030-05-02') }),
        booking({ id: 'h', category: 'alojamiento', checkIn: ldt('2030-05-02'), checkOut: ldt('2030-05-05') }),
        booking({ id: 'c', category: 'restaurante', start: ldt('2030-05-03') }),
        booking({ id: 'x', category: 'entrada', status: 'cancelada', start: ldt('2030-05-04') }),
      ],
    );
    expect(markers.get('2030-05-01')).toMatchObject({ flight: true, transit: false, activities: 0 });
    expect(markers.get('2030-05-02')).toMatchObject({ flight: true, activities: 2, lodging: true });
    expect(markers.get('2030-05-03')).toMatchObject({ activities: 0, bookings: 1 });
    expect(markers.get('2030-05-04')).toBeUndefined();
    expect(markers.get('2030-05-05')).toMatchObject({ lodging: true });
  });

  it('marca los días de tren y no los cuenta como reservas sueltas', () => {
    const tren = booking({
      id: 't', category: 'transporte', start: ldt('2030-06-02'),
      legs: [{ id: 'l', from: 'Tokio', to: 'Kioto', flightNumber: '', car: '', seat: '', fare: '', depart: ldt('2030-06-02'), arrive: ldt('2030-06-02') }],
    });
    expect(calendarMarkers([], [tren]).get('2030-06-02')).toMatchObject({ transit: true, bookings: 0 });
  });
});
