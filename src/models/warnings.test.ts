import { describe, expect, it } from 'vitest';
import type { Activity, Booking } from './types';
import { activityWarnings, bookingWarnings, detectOverlaps } from './warnings';

function act(id: string, patch: Partial<Activity>): Activity {
  return {
    id,
    title: id,
    date: '2030-04-01',
    startTime: null,
    endTime: null,
    tz: 'Asia/Tokyo',
    location: 'Lugar',
    address: '',
    addressJa: '',
    durationMin: null,
    notes: '',
    bookingId: null,
    status: 'pendiente',
    mapRef: null,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

describe('detección de solapes', () => {
  it('detecta actividades que se pisan por hora de fin', () => {
    const r = detectOverlaps([
      act('a', { startTime: '09:00', endTime: '11:00' }),
      act('b', { startTime: '10:30', endTime: '12:00' }),
      act('c', { startTime: '12:00', endTime: '13:00' }),
    ]);
    expect(r.get('a')).toEqual(['b']);
    expect(r.get('b')).toEqual(['a']);
    expect(r.has('c')).toBe(false);
  });

  it('usa la duración estimada si no hay hora de fin', () => {
    const r = detectOverlaps([
      act('a', { startTime: '09:00', durationMin: 90 }),
      act('b', { startTime: '10:00' }),
    ]);
    expect(r.get('b')).toEqual(['a']);
  });

  it('ignora días distintos, actividades omitidas y sin hora', () => {
    const r = detectOverlaps([
      act('a', { startTime: '09:00', endTime: '11:00' }),
      act('b', { startTime: '09:00', endTime: '11:00', date: '2030-04-02' }),
      act('c', { startTime: '09:30', endTime: '10:00', status: 'omitida' }),
      act('d', {}),
    ]);
    expect(r.size).toBe(0);
  });

  it('marca como solape dos actividades a la misma hora sin duración', () => {
    const r = detectOverlaps([act('a', { startTime: '09:00' }), act('b', { startTime: '09:00' })]);
    expect(r.get('a')).toEqual(['b']);
  });
});

describe('avisos de datos que faltan', () => {
  it('avisa de hora y ubicación en actividades', () => {
    expect(activityWarnings(act('a', { location: '' }))).toEqual(['Sin hora de inicio', 'Sin ubicación']);
  });

  it('avisa de lo esencial en un alojamiento confirmado', () => {
    const b = {
      category: 'alojamiento',
      status: 'confirmada',
      start: null,
      arrival: null,
      checkIn: { date: '2030-04-01', time: '15:00', tz: 'Asia/Tokyo' },
      checkOut: null,
      address: 'Calle',
      addressJa: '',
      confirmationCode: '',
    } as unknown as Booking;
    expect(bookingWarnings(b)).toEqual([
      'Falta el check-out',
      'Falta la dirección en japonés',
      'Falta el localizador',
    ]);
  });
});
