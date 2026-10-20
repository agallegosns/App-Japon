import type { Booking, Day } from './types';

/**
 * Alojamientos en los que se duerme la noche de `date`: check-in ≤ fecha < check-out.
 * Solo reservas de alojamiento no canceladas y con fecha de check-in y de check-out.
 */
export function lodgingsForNight(date: string, bookings: Booking[]): Booking[] {
  return bookings.filter(
    (b) =>
      b.category === 'alojamiento' &&
      b.status !== 'cancelada' &&
      b.checkIn !== null &&
      b.checkOut !== null &&
      b.checkIn.date <= date &&
      date < b.checkOut.date,
  );
}

export function lodgingChangesOn(date: string, bookings: Booking[]): { checkOut: Booking[]; checkIn: Booking[] } {
  const live = bookings.filter((b) => b.category === 'alojamiento' && b.status !== 'cancelada');
  return {
    checkOut: live.filter((b) => b.checkOut?.date === date),
    checkIn: live.filter((b) => b.checkIn?.date === date),
  };
}

export type DayLodging =
  | { source: 'manual'; booking: Booking }
  | { source: 'auto'; bookings: Booking[] }
  | { source: 'none' };

/** Alojamiento de la noche de un día: el elegido a mano o, si no, el que corresponde por fechas. */
export function dayLodging(date: string, day: Pick<Day, 'lodgingId'> | null, bookings: Booking[]): DayLodging {
  if (day?.lodgingId) {
    const chosen = bookings.find((b) => b.id === day.lodgingId && b.category === 'alojamiento');
    if (chosen) return { source: 'manual', booking: chosen };
  }
  const auto = lodgingsForNight(date, bookings);
  return auto.length ? { source: 'auto', bookings: auto } : { source: 'none' };
}
