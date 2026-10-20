import { describe, expect, it } from 'vitest';
import type { Activity, Booking } from './types';
import { activityWarnings, bookingWarnings, detectOverlaps } from './warnings';

function act(id: string, patch: Partial<Activity>): Activity {
  return {
    id,
    title: id,
    date: '2030-04-01',
    allDay: false,
    startTime: null,
    endTime: null,
    tz: 'Asia/Tokyo',
    location: 'Lugar',
    address: '',
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
      legs: [],
    } as unknown as Booking;
    expect(bookingWarnings(b)).toEqual([
      'Falta el check-out',
    ]);
  });
});

describe('actividades de todo el día', () => {
  it('no avisan de que falta la hora de inicio', () => {
    expect(activityWarnings(act('a', { location: 'Nikko' }))).toContain('Sin hora de inicio');
    expect(activityWarnings(act('a', { location: 'Nikko', allDay: true }))).not.toContain('Sin hora de inicio');
  });

  it('no se solapan con otras actividades', () => {
    const list = [act('dia', { allDay: true }), act('cena', { startTime: '20:00', endTime: '21:00' })];
    expect(detectOverlaps(list).size).toBe(0);
  });
});

describe('avisos de trenes', () => {
  const ldt = (time: string) => ({ date: '2030-05-05', time, tz: 'Asia/Tokyo' });
  const leg = (patch: object) => ({ id: 'l', from: 'Tokio', to: 'Kioto', flightNumber: '', car: '', seat: '', fare: '' as const, depart: ldt('09:00'), arrive: ldt('11:00'), ...patch });
  const tren = (legs: object[]) =>
    ({ category: 'transporte', status: 'confirmada', start: ldt('09:00'), arrival: ldt('13:00'), checkIn: null, checkOut: null, address: '', legs }) as unknown as Booking;

  it('avisa si un billete con asiento reservado no tiene vagón o asiento, pero no con Suica', () => {
    expect(bookingWarnings(tren([leg({ fare: 'reservado', car: '7' })]))).toContain('Falta el vagón o el asiento del trayecto 1');
    expect(bookingWarnings(tren([leg({ fare: 'reservado', car: '7', seat: '12A' })]))).toEqual([]);
    expect(bookingWarnings(tren([leg({ fare: 'suica' })]))).toEqual([]);
  });

  it('avisa de un transbordo muy justo, pero no de uno razonable', () => {
    const corto = [leg({ arrive: ldt('11:00') }), leg({ id: 'm', from: 'Kioto', to: 'Nara', depart: ldt('11:05'), arrive: ldt('12:00') })];
    const normal = [leg({ arrive: ldt('11:00') }), leg({ id: 'm', from: 'Kioto', to: 'Nara', depart: ldt('11:20'), arrive: ldt('12:00') })];
    expect(bookingWarnings(tren(corto)).some((w) => w.startsWith('Transbordo muy justo en Kioto'))).toBe(true);
    expect(bookingWarnings(tren(normal)).some((w) => w.startsWith('Transbordo'))).toBe(false);
  });
});
