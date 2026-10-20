import { diffDays, ldtToEpoch, nowInZone, zonedToEpoch } from '../../models/datetime';
import type { Activity, Booking, Day, Trip } from '../../models/types';

export type TripPhase =
  | { phase: 'before'; daysLeft: number }
  | { phase: 'during'; dayNumber: number; totalDays: number; today: string }
  | { phase: 'after' };

export function tripPhase(trip: Trip, now: number = Date.now()): TripPhase {
  const today = nowInZone(trip.tz, now).date;
  const total = diffDays(trip.startDate, trip.endDate) + 1;
  if (today < trip.startDate) return { phase: 'before', daysLeft: diffDays(today, trip.startDate) };
  if (today > trip.endDate) return { phase: 'after' };
  return { phase: 'during', dayNumber: diffDays(trip.startDate, today) + 1, totalDays: total, today };
}

export function currentDay(days: Day[], trip: Trip, now: number = Date.now()): Day | null {
  const today = nowInZone(trip.tz, now).date;
  return days.find((d) => d.date === today) ?? null;
}

function activityStart(a: Activity): number | null {
  try {
    return zonedToEpoch(a.date, a.startTime, a.tz);
  } catch {
    return null;
  }
}

/** Próxima actividad pendiente: la primera cuyo inicio (o día, si no tiene hora) no ha pasado. */
export function nextActivity(activities: Activity[], now: number = Date.now()): Activity | null {
  const candidates = activities
    .filter((a) => a.status === 'pendiente')
    .map((a) => ({ a, at: activityStart(a) }))
    .filter((x): x is { a: Activity; at: number } => x.at !== null)
    .filter(({ a, at }) => (a.startTime ? at >= now : at + 86_400_000 > now))
    .sort((x, y) => x.at - y.at || x.a.order - y.a.order);
  return candidates[0]?.a ?? null;
}

export function nextBooking(bookings: Booking[], now: number = Date.now()): Booking | null {
  const upcoming = bookings
    .filter((b) => b.status !== 'cancelada')
    .map((b) => {
      const at = ldtToEpoch(b.start) ?? ldtToEpoch(b.checkIn);
      const hasTime = !!(b.start?.time ?? b.checkIn?.time);
      return { b, at, hasTime };
    })
    .filter((x): x is { b: Booking; at: number; hasTime: boolean } => x.at !== null)
    .filter(({ at, hasTime }) => (hasTime ? at >= now : at + 86_400_000 > now))
    .sort((x, y) => x.at - y.at);
  return upcoming[0]?.b ?? null;
}
