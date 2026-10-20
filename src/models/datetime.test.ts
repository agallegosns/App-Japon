import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  diffDays,
  isValidDate,
  isValidTime,
  nowInZone,
  zonedToEpoch,
} from './datetime';

describe('datetime', () => {
  it('convierte hora de Tokio (UTC+9, sin horario de verano)', () => {
    expect(zonedToEpoch('2030-04-01', '09:00', 'Asia/Tokyo')).toBe(Date.UTC(2030, 3, 1, 0, 0));
  });

  it('respeta el horario de verano de Madrid', () => {
    expect(zonedToEpoch('2030-01-15', '12:00', 'Europe/Madrid')).toBe(Date.UTC(2030, 0, 15, 11));
    expect(zonedToEpoch('2030-07-15', '12:00', 'Europe/Madrid')).toBe(Date.UTC(2030, 6, 15, 10));
  });

  it('calcula la duración real de un vuelo con zonas distintas', () => {
    const dep = zonedToEpoch('2030-04-01', '13:00', 'Europe/Madrid');
    const arr = zonedToEpoch('2030-04-02', '09:00', 'Asia/Tokyo');
    expect((arr - dep) / 3_600_000).toBe(13);
  });

  it('devuelve fecha y hora local de una zona', () => {
    expect(nowInZone('Asia/Tokyo', Date.UTC(2030, 11, 31, 16, 30))).toEqual({
      date: '2031-01-01',
      time: '01:30',
    });
  });

  it('valida fechas y horas', () => {
    expect(isValidDate('2030-02-29')).toBe(false);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('23:59')).toBe(true);
  });

  it('opera con días', () => {
    expect(addDays('2030-12-31', 1)).toBe('2031-01-01');
    expect(diffDays('2030-03-30', '2030-04-02')).toBe(3);
    expect(dateRange('2030-03-30', '2030-04-01')).toEqual(['2030-03-30', '2030-03-31', '2030-04-01']);
  });
});

describe('formato de rangos', () => {
  it('muestra el año una vez si coincide', async () => {
    const { formatDateRange } = await import('./datetime');
    expect(formatDateRange('2030-04-01', '2030-04-05')).toBe('1 abr – 5 abr 2030');
    expect(formatDateRange('2030-12-30', '2031-01-02')).toBe('30 dic 2030 – 2 ene 2031');
  });
});
