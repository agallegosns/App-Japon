import { describe, expect, it } from 'vitest';
import { addMonths, calendarMarkers, monthGrid, monthLabel, monthOf } from './calendar';
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
    expect(monthGrid('2027-02').flat().filter((d) => monthOf(d) === '2027-02')).toHaveLength(28);
  });

  it('navega entre meses cruzando el año', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2027-05', 0)).toBe('2027-05');
    expect(addMonths('2027-05', 13)).toBe('2028-06');
    expect(monthLabel('2027-05')).toBe('Mayo de 2027');
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
    expect(markers.get('2030-05-01')).toMatchObject({ flight: true, activities: 0 });
    expect(markers.get('2030-05-02')).toMatchObject({ flight: true, activities: 2, lodging: true });
    expect(markers.get('2030-05-03')).toMatchObject({ activities: 0, bookings: 1 });
    expect(markers.get('2030-05-04')).toBeUndefined();
    expect(markers.get('2030-05-05')).toMatchObject({ lodging: true });
  });
});
