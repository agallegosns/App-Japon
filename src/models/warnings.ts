import { timeToMinutes } from './datetime';
import type { Activity, Booking, Day } from './types';

export interface Interval {
  start: number;
  end: number;
}

/** Intervalo en minutos del día, o null si no tiene hora de inicio. */
export function activityInterval(a: Pick<Activity, 'startTime' | 'endTime' | 'durationMin'>): Interval | null {
  if (!a.startTime) return null;
  const start = timeToMinutes(a.startTime);
  if (Number.isNaN(start)) return null;
  let end = start;
  if (a.endTime) end = timeToMinutes(a.endTime);
  else if (a.durationMin) end = start + a.durationMin;
  if (Number.isNaN(end) || end < start) end = start;
  return { start, end };
}

function overlaps(a: Interval, b: Interval): boolean {
  if (a.start === b.start) return true;
  return a.start < b.end && b.start < a.end;
}

/** Devuelve, para cada actividad con solape, los ids con los que se solapa (mismo día, no omitidas). */
export function detectOverlaps(activities: Activity[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const byDate = new Map<string, Activity[]>();
  for (const a of activities) {
    if (a.status === 'omitida') continue;
    const list = byDate.get(a.date) ?? [];
    list.push(a);
    byDate.set(a.date, list);
  }
  for (const list of byDate.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b) continue;
        const ia = activityInterval(a);
        const ib = activityInterval(b);
        if (!ia || !ib || !overlaps(ia, ib)) continue;
        result.set(a.id, [...(result.get(a.id) ?? []), b.id]);
        result.set(b.id, [...(result.get(b.id) ?? []), a.id]);
      }
    }
  }
  return result;
}

export function activityWarnings(a: Activity): string[] {
  if (a.status === 'omitida') return [];
  const out: string[] = [];
  if (!a.startTime) out.push('Sin hora de inicio');
  if (!a.location && !a.address && !a.mapRef) out.push('Sin ubicación');
  return out;
}

export function bookingWarnings(b: Booking): string[] {
  if (b.status === 'cancelada') return [];
  const out: string[] = [];
  if (b.status === 'pendiente') out.push('Sin confirmar');
  switch (b.category) {
    case 'vuelo':
    case 'transporte':
      if (!b.start) out.push('Falta la fecha de salida');
      else if (!b.start.time) out.push('Falta la hora de salida');
      if (!b.arrival?.time) out.push('Falta la hora de llegada');
      break;
    case 'alojamiento':
      if (!b.checkIn) out.push('Falta el check-in');
      if (!b.checkOut) out.push('Falta el check-out');
      if (!b.address) out.push('Falta la dirección');
      if (!b.addressJa) out.push('Falta la dirección en japonés');
      break;
    case 'restaurante':
    case 'entrada':
      if (!b.start) out.push('Falta la fecha');
      else if (!b.start.time) out.push('Falta la hora');
      if (!b.address && !b.addressJa) out.push('Falta la dirección');
      break;
    case 'otro':
      break;
  }
  if (b.status === 'confirmada' && !b.confirmationCode && b.category !== 'otro') out.push('Falta el localizador');
  return out;
}

export function daysWithoutCity(days: Day[], cities: string[]): Day[] {
  if (cities.length === 0) return [];
  return days.filter((d) => !d.city);
}
