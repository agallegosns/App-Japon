import { ldtToEpoch } from './datetime';
import { newId } from './id';
import type { FlightLeg } from './types';

export function emptyLeg(): FlightLeg {
  return { id: newId(), from: '', to: '', flightNumber: '', car: '', seat: '', fare: '', depart: null, arrive: null };
}

/** true si el tramo no tiene ningún dato escrito. */
export function isLegBlank(l: FlightLeg): boolean {
  return !l.from.trim() && !l.to.trim() && !l.flightNumber.trim() && !l.car.trim() && !l.seat.trim() && !l.fare && !l.depart && !l.arrive;
}

/** Minutos de escala entre la llegada de un tramo y la salida del siguiente (null si faltan horas). */
export function layoverMinutes(prev: FlightLeg, next: FlightLeg): number | null {
  if (!prev.arrive?.time || !next.depart?.time) return null;
  const a = ldtToEpoch(prev.arrive);
  const d = ldtToEpoch(next.depart);
  if (a === null || d === null) return null;
  return Math.round((d - a) / 60_000);
}

/** Duración de un tramo en minutos (tiene en cuenta las zonas horarias de salida y llegada). */
export function legMinutes(l: FlightLeg): number | null {
  if (!l.depart?.time || !l.arrive?.time) return null;
  const d = ldtToEpoch(l.depart);
  const a = ldtToEpoch(l.arrive);
  if (d === null || a === null) return null;
  return Math.round((a - d) / 60_000);
}

export function formatMinutes(total: number): string {
  const sign = total < 0 ? '-' : '';
  const m = Math.abs(total);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${sign}${min} min`;
  return min === 0 ? `${sign}${h} h` : `${sign}${h} h ${min} min`;
}

/** Escalas de vuelo más cortas que esto se avisan como arriesgadas. */
export const SHORT_LAYOVER_MIN = 60;
/** Transbordos de tren más cortos que esto se avisan como arriesgados. */
export const SHORT_TRANSFER_MIN = 8;

/** Texto corto de la ruta: «Madrid (MAD) → Doha (DOH) → Tokio (HND)». */
export function routeText(legs: FlightLeg[]): string {
  const stops: string[] = [];
  legs.forEach((l, i) => {
    if (i === 0 && l.from.trim()) stops.push(l.from.trim());
    if (l.to.trim()) stops.push(l.to.trim());
  });
  return stops.join(' → ');
}

/** Texto de vagón y asiento: «Vagón 7 · asiento 12A» (vacío si no hay datos). */
export function seatText(l: Pick<FlightLeg, 'car' | 'seat'>): string {
  const parts = [l.car.trim() ? `vagón ${l.car.trim()}` : '', l.seat.trim() ? `asiento ${l.seat.trim()}` : ''].filter(Boolean);
  const text = parts.join(' · ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}
