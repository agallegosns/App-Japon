import { describe, expect, it } from 'vitest';
import type { Activity, Trip } from '../../models/types';
import { nextActivity, tripPhase } from './tripStatus';

const trip: Trip = { id: 't', name: 'V', startDate: '2030-04-01', endDate: '2030-04-10', cities: [], tz: 'Asia/Tokyo', createdAt: 0, updatedAt: 0 };

describe('estado del viaje', () => {
  it('cuenta atrás, durante y después según la hora de Japón', () => {
    expect(tripPhase(trip, Date.UTC(2030, 2, 29, 12))).toEqual({ phase: 'before', daysLeft: 3 });
    // 31 mar 16:00 UTC = 1 abr 01:00 en Tokio
    expect(tripPhase(trip, Date.UTC(2030, 2, 31, 16))).toMatchObject({ phase: 'during', dayNumber: 1, totalDays: 10 });
    expect(tripPhase(trip, Date.UTC(2030, 3, 11, 12))).toEqual({ phase: 'after' });
  });

  it('elige la próxima actividad pendiente', () => {
    const base = { tz: 'Asia/Tokyo', status: 'pendiente', order: 0 } as const;
    const acts = [
      { ...base, id: 'pasada', date: '2030-04-01', startTime: '08:00' },
      { ...base, id: 'hecha', date: '2030-04-01', startTime: '12:00', status: 'hecha' },
      { ...base, id: 'siguiente', date: '2030-04-01', startTime: '13:00' },
      { ...base, id: 'despues', date: '2030-04-02', startTime: '09:00' },
    ] as unknown as Activity[];
    // 1 abr 10:00 en Tokio
    expect(nextActivity(acts, Date.UTC(2030, 3, 1, 1))?.id).toBe('siguiente');
  });
});
