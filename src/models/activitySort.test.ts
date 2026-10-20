import { describe, expect, it } from 'vitest';
import { compareByTime, isChronological } from './activitySort';

const a = (order: number, startTime: string | null, allDay = false) => ({ order, startTime, allDay });

describe('orden por hora de las actividades', () => {
  it('pone primero las de todo el día, luego por hora y al final las sin hora', () => {
    const list = [a(0, null), a(1, '19:30'), a(2, '08:00'), a(3, null, true), a(4, '08:00')];
    expect(list.sort(compareByTime).map((x) => x.order)).toEqual([3, 2, 4, 1, 0]);
  });

  it('detecta si la lista ya está ordenada', () => {
    expect(isChronological([a(0, null, true), a(1, '08:00'), a(2, '09:30'), a(3, null)])).toBe(true);
    expect(isChronological([a(0, '09:30'), a(1, '08:00')])).toBe(false);
    expect(isChronological([a(0, null), a(1, '08:00')])).toBe(false);
    expect(isChronological([])).toBe(true);
  });
});
