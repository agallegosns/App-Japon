import type { Activity, Booking, Day } from '../models/types';

/**
 * Normalizan registros que vienen de fuera (una copia de seguridad antigua o el otro móvil) para que tengan todos los campos
 * actuales y ninguno de los que se retiraron (localizador y dirección en japonés).
 */
export function sanitizeDay(d: Day): Day {
  return { ...d, lodgingId: d.lodgingId ?? null, updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now() };
}

export function sanitizeBooking(b: Booking & { confirmationCode?: string; addressJa?: string }): Booking {
  const { confirmationCode: _c, addressJa: _j, ...rest } = b;
  void [_c, _j];
  return {
    ...rest,
    legs: (Array.isArray(rest.legs) ? rest.legs : []).map((l) => ({ ...l, car: l.car ?? '', seat: l.seat ?? '', fare: l.fare ?? '' })),
    guests: typeof rest.guests === 'number' ? rest.guests : 2,
    taxes: Array.isArray(rest.taxes) ? rest.taxes : [],
  };
}

export function sanitizeActivity(a: Activity & { addressJa?: string }): Activity {
  const { addressJa: _j, ...rest } = a;
  void _j;
  return { ...rest, allDay: typeof rest.allDay === 'boolean' ? rest.allDay : false };
}
