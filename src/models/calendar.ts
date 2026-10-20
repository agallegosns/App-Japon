import { addDays } from './datetime';
import { flightDates, transitDates } from './dayEvents';
import type { Activity, Booking } from './types';

/** Mes en formato AAAA-MM. */
export type YearMonth = string;

export function monthOf(date: string): YearMonth {
  return date.slice(0, 7);
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7)) - 1 + n;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** «Octubre de 2026». */
export function monthLabel(ym: YearMonth): string {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1, 12));
  const text = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Cuadrícula del mes en semanas que empiezan en lunes; incluye los días de los meses vecinos para completarlas. */
export function monthGrid(ym: YearMonth): string[][] {
  const first = `${ym}-01`;
  const dow = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1, 12)).getUTCDay(); // 0 = domingo
  const offset = (dow + 6) % 7; // lunes = 0
  const start = addDays(first, -offset);
  const weeks: string[][] = [];
  let cursor = start;
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  } while (monthOf(cursor) === ym);
  return weeks;
}

/** Los siete días (lunes a domingo) de la semana que contiene `date`. */
export function weekOf(date: string): string[] {
  const dow = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), 12)).getUTCDay();
  const start = addDays(date, -((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export interface DayMarkers {
  flight: boolean;
  /** Hay un trayecto en tren/transporte (día de traslado). */
  transit: boolean;
  activities: number;
  bookings: number;
  /** Día en que hay check-in o check-out de un alojamiento. */
  lodging: boolean;
}

const EMPTY: DayMarkers = { flight: false, transit: false, activities: 0, bookings: 0, lodging: false };

export function emptyMarkers(): DayMarkers {
  return { ...EMPTY };
}

/** Qué hay cada día, para marcarlo en el calendario. */
export function calendarMarkers(activities: Activity[], bookings: Booking[]): Map<string, DayMarkers> {
  const map = new Map<string, DayMarkers>();
  const at = (date: string): DayMarkers => {
    let m = map.get(date);
    if (!m) {
      m = emptyMarkers();
      map.set(date, m);
    }
    return m;
  };
  for (const a of activities) if (a.status !== 'omitida') at(a.date).activities++;
  for (const d of flightDates(bookings)) at(d).flight = true;
  for (const d of transitDates(bookings)) at(d).transit = true;
  for (const b of bookings) {
    if (b.status === 'cancelada') continue;
    if (b.category === 'alojamiento') {
      if (b.checkIn) at(b.checkIn.date).lodging = true;
      if (b.checkOut) at(b.checkOut.date).lodging = true;
    } else if (b.category !== 'vuelo' && !(b.category === 'transporte' && b.legs.length > 0) && b.start) {
      at(b.start.date).bookings++;
    }
  }
  return map;
}
