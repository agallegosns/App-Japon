import { ldtToEpoch, zonedToEpoch } from './datetime';
import { CATEGORY_LABEL } from './labels';
import { legMinutes, seatText } from './flights';
import { FARE_LABEL } from './labels';
import type { Activity, Booking, FlightLeg } from './types';

export interface FlightOnDay {
  booking: Booking;
  /** Tramos que salen o llegan ese día (en la hora local de cada aeropuerto). */
  legs: FlightLeg[];
  /** Todos los tramos del vuelo, para mostrar la ruta completa. */
  allLegs: FlightLeg[];
  departsToday: boolean;
  arrivesToday: boolean;
}

/** Tramos de un vuelo; si no tiene tramos se usa su salida y llegada como un único tramo. */
export function legsOf(b: Booking): FlightLeg[] {
  if (b.legs.length > 0) return b.legs;
  if (!b.start && !b.arrival) return [];
  return [{ id: `${b.id}-0`, from: '', to: '', flightNumber: '', car: '', seat: '', fare: '', depart: b.start, arrive: b.arrival }];
}

/** Vuelos que salen o llegan en `date` (fecha local del aeropuerto). Se ignoran los cancelados. */
export function flightsOnDate(date: string, bookings: Booking[]): FlightOnDay[] {
  const out: FlightOnDay[] = [];
  for (const booking of bookings) {
    if (booking.category !== 'vuelo' || booking.status === 'cancelada') continue;
    const all = legsOf(booking);
    const legs = all.filter((l) => l.depart?.date === date || l.arrive?.date === date);
    if (legs.length === 0) continue;
    out.push({
      booking,
      legs,
      allLegs: all,
      departsToday: legs.some((l) => l.depart?.date === date),
      arrivesToday: legs.some((l) => l.arrive?.date === date),
    });
  }
  return out.sort((a, b) => (a.booking.sortAt ?? 0) - (b.booking.sortAt ?? 0));
}

/** Trayectos en tren/transporte que salen o llegan en `date` (misma forma que los vuelos). */
export function transfersOnDate(date: string, bookings: Booking[]): FlightOnDay[] {
  const out: FlightOnDay[] = [];
  for (const booking of bookings) {
    if (booking.category !== 'transporte' || booking.status === 'cancelada') continue;
    const all = legsOf(booking);
    const legs = all.filter((l) => l.depart?.date === date || l.arrive?.date === date);
    if (legs.length === 0) continue;
    out.push({
      booking,
      legs,
      allLegs: all,
      departsToday: legs.some((l) => l.depart?.date === date),
      arrivesToday: legs.some((l) => l.arrive?.date === date),
    });
  }
  return out.sort((a, b) => (a.booking.sortAt ?? 0) - (b.booking.sortAt ?? 0));
}

/** Fechas en las que hay algún trayecto en tren/transporte. */
export function transitDates(bookings: Booking[]): Set<string> {
  const dates = new Set<string>();
  for (const b of bookings) {
    if (b.category !== 'transporte' || b.status === 'cancelada') continue;
    for (const l of legsOf(b)) {
      if (l.depart?.date) dates.add(l.depart.date);
      if (l.arrive?.date) dates.add(l.arrive.date);
    }
  }
  return dates;
}

/**
 * Reservas de un día que no son vuelos ni alojamientos (restaurantes, entradas, trenes, otros),
 * ordenadas por hora y sin repetir las que ya están enlazadas desde una actividad de ese día.
 */
export function bookingsOnDate(date: string, bookings: Booking[], activities: Activity[]): Booking[] {
  const linked = new Set(activities.filter((a) => a.date === date && a.bookingId).map((a) => a.bookingId));
  return bookings
    .filter(
      (b) =>
        b.category !== 'vuelo' &&
        b.category !== 'alojamiento' &&
        !(b.category === 'transporte' && b.legs.length > 0) &&
        b.status !== 'cancelada' &&
        b.start?.date === date &&
        !linked.has(b.id),
    )
    .sort((a, b) => (ldtToEpoch(a.start) ?? 0) - (ldtToEpoch(b.start) ?? 0));
}

/** Fechas (AAAA-MM-DD) en las que hay algún vuelo, para marcar esos días en el selector. */
export function flightDates(bookings: Booking[]): Set<string> {
  const dates = new Set<string>();
  for (const b of bookings) {
    if (b.category !== 'vuelo' || b.status === 'cancelada') continue;
    for (const l of legsOf(b)) {
      if (l.depart?.date) dates.add(l.depart.date);
      if (l.arrive?.date) dates.add(l.arrive.date);
    }
  }
  return dates;
}

export function legDuration(l: FlightLeg): number | null {
  return legMinutes(l);
}

export interface TimelineEntry {
  id: string;
  kind: 'flight' | 'transit' | 'activity' | 'booking';
  /** Hora local HH:mm o null si no tiene. */
  time: string | null;
  title: string;
  subtitle: string;
  /** Actividad de todo el día. */
  allDay?: boolean;
  /** Ruta de la app a la que lleva la entrada. */
  to: string;
  done: boolean;
  sort: number;
}

/** Plan de un día: vuelos, actividades y reservas mezclados por hora (los que no tienen hora, al final). */
export function dayTimeline(date: string, activities: Activity[], bookings: Booking[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const NO_TIME = Number.MAX_SAFE_INTEGER / 2;

  for (const f of flightsOnDate(date, bookings)) {
    for (const l of f.legs) {
      const departs = l.depart?.date === date;
      const ldt = departs ? l.depart : l.arrive;
      const route = l.from || l.to ? `${l.from || '?'} → ${l.to || '?'}` : f.booking.name;
      entries.push({
        id: `${f.booking.id}-${l.id}-${departs ? 'd' : 'a'}`,
        kind: 'flight',
        time: ldt?.time ?? null,
        title: departs ? `Vuelo ${l.flightNumber ? `${l.flightNumber} ` : ''}${route}`.replace(/\s+/g, ' ').trim() : `Llegada a ${l.to || 'destino'}`,
        subtitle: departs
          ? l.arrive?.time
            ? `Llega a las ${l.arrive.time} (hora local${l.arrive.date !== date ? `, ${l.arrive.date.slice(8)}/${l.arrive.date.slice(5, 7)}` : ''})`
            : 'Vuelo'
          : `Vuelo ${l.flightNumber || f.booking.name}`,
        to: `/reservas/${f.booking.id}`,
        done: false,
        sort: ldtToEpoch(ldt) ?? NO_TIME,
      });
    }
  }

  for (const f of transfersOnDate(date, bookings)) {
    for (const l of f.legs) {
      const departs = l.depart?.date === date;
      const ldt = departs ? l.depart : l.arrive;
      const route = l.from || l.to ? `${l.from || '?'} → ${l.to || '?'}` : f.booking.name;
      const bits = [
        l.fare === 'suica' ? 'Con Suica' : '',
        seatText(l),
        l.fare && l.fare !== 'suica' && !seatText(l) ? FARE_LABEL[l.fare] : '',
        departs && l.arrive?.time ? `llega a las ${l.arrive.time}` : '',
      ].filter(Boolean);
      entries.push({
        id: `${f.booking.id}-${l.id}-${departs ? 'd' : 'a'}`,
        kind: 'transit',
        time: ldt?.time ?? null,
        title: departs ? `${l.flightNumber ? `${l.flightNumber}: ` : 'Tren: '}${route}` : `Llegada a ${l.to || 'la estación'}`,
        subtitle: bits.join(' · '),
        to: `/reservas/${f.booking.id}`,
        done: false,
        sort: ldtToEpoch(ldt) ?? NO_TIME,
      });
    }
  }

  for (const a of activities) {
    if (a.date !== date || a.status === 'omitida') continue;
    entries.push({
      id: a.id,
      kind: 'activity',
      time: a.allDay ? null : a.startTime,
      allDay: a.allDay,
      title: a.title,
      subtitle: [a.endTime ? `hasta ${a.endTime}` : '', a.location].filter(Boolean).join(' · '),
      to: `/itinerario?fecha=${date}`,
      done: a.status === 'hecha',
      sort: a.allDay ? -NO_TIME + a.order : a.startTime ? zonedToEpoch(date, a.startTime, a.tz) : NO_TIME + a.order,
    });
  }

  for (const b of bookingsOnDate(date, bookings, activities)) {
    entries.push({
      id: b.id,
      kind: 'booking',
      time: b.start?.time ?? null,
      title: b.name,
      subtitle: CATEGORY_LABEL[b.category],
      to: `/reservas/${b.id}`,
      done: false,
      sort: ldtToEpoch(b.start) ?? NO_TIME,
    });
  }
  return entries.sort((a, b) => a.sort - b.sort);
}

/**
 * Día que se enseña en la pantalla de inicio: hoy si es un día del viaje; si no, el primer día
 * (desde hoy) con algo en el plan; si no hay nada, null.
 */
export function homeDay(
  today: string,
  days: { date: string }[],
  activities: Activity[],
  bookings: Booking[],
): string | null {
  const dates = days.map((d) => d.date).sort();
  if (dates.includes(today)) return today;
  const candidates = today < (dates[0] ?? '') ? dates : dates.filter((d) => d >= today);
  return candidates.find((d) => dayTimeline(d, activities, bookings).length > 0) ?? null;
}
