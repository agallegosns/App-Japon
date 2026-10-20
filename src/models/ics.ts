import { ldtToEpoch, addDays, zonedToEpoch } from './datetime';
import { legsOf } from './dayEvents';
import { routeText, seatText } from './flights';
import { FARE_LABEL } from './labels';
import { CATEGORY_LABEL } from './labels';
import type { Activity, Booking } from './types';

/**
 * Exporta el viaje como calendario .ics para añadirlo al Calendario del iPhone, que avisa por sí solo
 * (también sin conexión). Todas las horas se escriben en UTC para no depender de definiciones de zona.
 */

const CRLF = '\r\n';

export function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Pliega las líneas a 75 octetos como exige el formato. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (enc.encode(current + ch).length > limit) {
      parts.push(current);
      current = '';
    }
    current += ch;
  }
  parts.push(current);
  return parts.join(CRLF + ' ');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function utcStamp(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function dateStamp(date: string): string {
  return date.replace(/-/g, '');
}

export interface IcsEvent {
  uid: string;
  summary: string;
  /** Instante de inicio (ms) o fecha si es de día completo. */
  start: number | { date: string };
  end?: number;
  location?: string;
  description?: string;
  /** Minutos de antelación del aviso (0 = sin aviso). */
  alarmMinutes: number;
}

function eventLines(e: IcsEvent, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}@nihon-trip`, `DTSTAMP:${stamp}`];
  if (typeof e.start === 'number') {
    lines.push(`DTSTART:${utcStamp(e.start)}`);
    lines.push(`DTEND:${utcStamp(e.end && e.end > e.start ? e.end : e.start + 3_600_000)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.start.date)}`);
    lines.push(`DTEND;VALUE=DATE:${dateStamp(addDays(e.start.date, 1))}`);
  }
  lines.push(`SUMMARY:${escapeText(e.summary)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.alarmMinutes > 0) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.summary)}`, `TRIGGER:-PT${e.alarmMinutes}M`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

export function buildIcs(events: IcsEvent[], now: Date = new Date()): string {
  const stamp = utcStamp(now.getTime());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nihon Trip//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Nihon Trip',
    ...events.flatMap((e) => eventLines(e, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

function place(...parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(', ');
}

export function activityEvents(activities: Activity[]): IcsEvent[] {
  const out: IcsEvent[] = [];
  for (const a of activities) {
    if (a.status === 'omitida') continue;
    const desc = a.notes;
    const location = place(a.location, a.address);
    if (a.allDay || !a.startTime) {
      out.push({ uid: `act-${a.id}`, summary: a.title, start: { date: a.date }, location, description: desc, alarmMinutes: 0 });
      continue;
    }
    const start = zonedToEpoch(a.date, a.startTime, a.tz);
    const end = a.endTime ? zonedToEpoch(a.date, a.endTime, a.tz) : a.durationMin ? start + a.durationMin * 60_000 : undefined;
    out.push({ uid: `act-${a.id}`, summary: a.title, start, end, location, description: desc, alarmMinutes: 30 });
  }
  return out;
}

export function bookingEvents(bookings: Booking[]): IcsEvent[] {
  const out: IcsEvent[] = [];
  for (const b of bookings) {
    if (b.status === 'cancelada') continue;
    const location = place(b.address);
    const desc = [b.phone, b.notes].filter(Boolean).join('\n');
    if (b.category === 'vuelo') {
      const legs = legsOf(b);
      legs.forEach((l, i) => {
        const start = ldtToEpoch(l.depart);
        if (start === null || !l.depart?.time) return;
        const end = l.arrive?.time ? (ldtToEpoch(l.arrive) ?? undefined) : undefined;
        const route = l.from || l.to ? `${l.from} → ${l.to}` : b.name;
        out.push({
          uid: `vuelo-${b.id}-${i}`,
          summary: `Vuelo ${l.flightNumber ? `${l.flightNumber} ` : ''}${route}`.replace(/\s+/g, ' ').trim(),
          start,
          end,
          description: routeText(legs),
          alarmMinutes: 180,
        });
      });
    } else if (b.category === 'transporte' && b.legs.length > 0) {
      b.legs.forEach((l, i) => {
        const start = ldtToEpoch(l.depart);
        if (start === null || !l.depart?.time) return;
        const end = l.arrive?.time ? (ldtToEpoch(l.arrive) ?? undefined) : undefined;
        const route = l.from || l.to ? `${l.from} → ${l.to}` : b.name;
        out.push({
          uid: `tren-${b.id}-${i}`,
          summary: `Tren ${l.flightNumber ? `${l.flightNumber} ` : ''}${route}`.replace(/\s+/g, ' ').trim(),
          start,
          end,
          description: [seatText(l), l.fare ? FARE_LABEL[l.fare] : ''].filter(Boolean).join('\n'),
          alarmMinutes: 60,
        });
      });
    } else if (b.category === 'alojamiento') {
      const ci = ldtToEpoch(b.checkIn);
      if (ci !== null && b.checkIn)
        out.push(b.checkIn.time
          ? { uid: `in-${b.id}`, summary: `Check-in: ${b.name}`, start: ci, location, description: desc, alarmMinutes: 60 }
          : { uid: `in-${b.id}`, summary: `Check-in: ${b.name}`, start: { date: b.checkIn.date }, location, description: desc, alarmMinutes: 0 });
      const co = ldtToEpoch(b.checkOut);
      if (co !== null && b.checkOut)
        out.push(b.checkOut.time
          ? { uid: `out-${b.id}`, summary: `Check-out: ${b.name}`, start: co, location, alarmMinutes: 60 }
          : { uid: `out-${b.id}`, summary: `Check-out: ${b.name}`, start: { date: b.checkOut.date }, location, alarmMinutes: 0 });
    } else {
      const s = ldtToEpoch(b.start);
      if (s === null || !b.start) continue;
      const summary = `${CATEGORY_LABEL[b.category]}: ${b.name}`;
      out.push(b.start.time
        ? { uid: `res-${b.id}`, summary, start: s, end: ldtToEpoch(b.arrival) ?? undefined, location, description: desc, alarmMinutes: 60 }
        : { uid: `res-${b.id}`, summary, start: { date: b.start.date }, location, description: desc, alarmMinutes: 0 });
    }
  }
  return out;
}

export function tripIcs(activities: Activity[], bookings: Booking[], now: Date = new Date()): { ics: string; count: number } {
  const events = [...bookingEvents(bookings), ...activityEvents(activities)];
  return { ics: buildIcs(events, now), count: events.length };
}
