import { describe, expect, it } from 'vitest';
import { emptyLeg, formatMinutes, isLegBlank, layoverMinutes, legMinutes, routeText } from './flights';
import type { FlightLeg } from './types';

const leg = (patch: Partial<FlightLeg>): FlightLeg => ({ ...emptyLeg(), ...patch });

describe('vuelos con escalas', () => {
  const madDoh = leg({
    from: 'Madrid (MAD)',
    to: 'Doha (DOH)',
    depart: { date: '2030-05-01', time: '14:00', tz: 'Europe/Madrid' },
    arrive: { date: '2030-05-01', time: '22:30', tz: 'Asia/Qatar' },
  });
  const dohHnd = leg({
    from: 'Doha (DOH)',
    to: 'Tokio (HND)',
    depart: { date: '2030-05-02', time: '01:15', tz: 'Asia/Qatar' },
    arrive: { date: '2030-05-02', time: '18:00', tz: 'Asia/Tokyo' },
  });

  it('calcula la duración de cada tramo teniendo en cuenta las zonas horarias', () => {
    // 14:00 Madrid (CEST, UTC+2) = 12:00 UTC; 22:30 Doha (UTC+3) = 19:30 UTC → 7 h 30 min
    expect(legMinutes(madDoh)).toBe(450);
    // 01:15 Doha = 22:15 UTC (día anterior); 18:00 Tokio (UTC+9) = 09:00 UTC → 10 h 45 min
    expect(legMinutes(dohHnd)).toBe(645);
  });

  it('calcula la escala entre dos tramos', () => {
    // llegada 19:30 UTC, salida 22:15 UTC → 2 h 45 min
    expect(layoverMinutes(madDoh, dohHnd)).toBe(165);
    expect(formatMinutes(165)).toBe('2 h 45 min');
  });

  it('devuelve null si faltan las horas y negativo si el enlace es imposible', () => {
    expect(layoverMinutes(madDoh, leg({ depart: { date: '2030-05-02', time: null, tz: 'Asia/Qatar' } }))).toBeNull();
    const early = leg({ depart: { date: '2030-05-01', time: '20:00', tz: 'Asia/Qatar' } });
    expect(layoverMinutes(madDoh, early)).toBeLessThan(0);
  });

  it('da formato a las duraciones', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(-30)).toBe('-30 min');
  });

  it('construye la ruta y detecta tramos vacíos', () => {
    expect(routeText([madDoh, dohHnd])).toBe('Madrid (MAD) → Doha (DOH) → Tokio (HND)');
    expect(isLegBlank(emptyLeg())).toBe(true);
    expect(isLegBlank(madDoh)).toBe(false);
  });
});
