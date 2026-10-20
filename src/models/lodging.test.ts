import { describe, expect, it } from 'vitest';
import { dayLodging, lodgingChangesOn, lodgingsForNight } from './lodging';
import type { Booking } from './types';

function hotel(id: string, from: string | null, to: string | null, status: Booking['status'] = 'confirmada'): Booking {
  return {
    id, name: id, category: 'alojamiento', status, start: null, arrival: null,
    checkIn: from ? { date: from, time: '15:00', tz: 'Asia/Tokyo' } : null,
    checkOut: to ? { date: to, time: '11:00', tz: 'Asia/Tokyo' } : null,
    address: '', addressJa: '', legs: [], price: null, phone: '', contact: '', notes: '', links: [],
    sortAt: null, createdAt: 1, updatedAt: 1,
  };
}

const all = [hotel('Disney', '2030-04-01', '2030-04-03'), hotel('Tokio', '2030-04-03', '2030-04-06'), hotel('Cancelado', '2030-04-01', '2030-04-10', 'cancelada')];

describe('alojamiento por día', () => {
  it('la noche pertenece al hotel con check-in ≤ fecha < check-out', () => {
    expect(lodgingsForNight('2030-04-01', all).map((b) => b.id)).toEqual(['Disney']);
    expect(lodgingsForNight('2030-04-02', all).map((b) => b.id)).toEqual(['Disney']);
    expect(lodgingsForNight('2030-04-03', all).map((b) => b.id)).toEqual(['Tokio']);
    expect(lodgingsForNight('2030-04-05', all).map((b) => b.id)).toEqual(['Tokio']);
  });

  it('la noche del check-out no cuenta, y las reservas canceladas o sin fechas se ignoran', () => {
    expect(lodgingsForNight('2030-04-06', all)).toEqual([]);
    expect(lodgingsForNight('2030-04-02', [hotel('SinFechas', null, null)])).toEqual([]);
  });

  it('el día del cambio muestra check-out del anterior y check-in del nuevo', () => {
    const c = lodgingChangesOn('2030-04-03', all);
    expect(c.checkOut.map((b) => b.id)).toEqual(['Disney']);
    expect(c.checkIn.map((b) => b.id)).toEqual(['Tokio']);
  });

  it('la elección manual manda sobre la automática; si el hotel ya no existe vuelve a automático', () => {
    expect(dayLodging('2030-04-02', { lodgingId: 'Tokio' }, all)).toMatchObject({ source: 'manual' });
    expect(dayLodging('2030-04-02', { lodgingId: null }, all)).toMatchObject({ source: 'auto' });
    expect(dayLodging('2030-04-02', { lodgingId: 'borrado' }, all)).toMatchObject({ source: 'auto' });
    expect(dayLodging('2030-05-01', { lodgingId: null }, all)).toEqual({ source: 'none' });
  });
});
