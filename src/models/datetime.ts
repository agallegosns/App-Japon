import type { LocalDateTime } from './types';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallTime(epochMs: number, tz: string): Wall {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(epochMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year ?? 0,
    month: out.month ?? 1,
    day: out.day ?? 1,
    hour: (out.hour ?? 0) % 24,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

/** Desfase (ms) de la zona respecto a UTC en un instante dado. */
export function tzOffsetMs(epochMs: number, tz: string): number {
  const w = wallTime(epochMs, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/** Convierte fecha + hora local de una zona IANA a instante (ms desde epoch). */
export function zonedToEpoch(date: string, time: string | null, tz: string): number {
  const dm = DATE_RE.exec(date);
  if (!dm) throw new Error(`Fecha no válida: ${date}`);
  const tm = time ? TIME_RE.exec(time) : null;
  if (time && !tm) throw new Error(`Hora no válida: ${time}`);
  const guess = Date.UTC(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    tm ? Number(tm[1]) : 0,
    tm ? Number(tm[2]) : 0,
  );
  const first = guess - tzOffsetMs(guess, tz);
  const second = guess - tzOffsetMs(first, tz);
  return second;
}

export function ldtToEpoch(ldt: LocalDateTime | null): number | null {
  if (!ldt || !isValidDate(ldt.date)) return null;
  try {
    return zonedToEpoch(ldt.date, ldt.time, ldt.tz);
  } catch {
    return null;
  }
}

/** Fecha y hora actuales en una zona. */
export function nowInZone(tz: string, now: number = Date.now()): { date: string; time: string } {
  const w = wallTime(now, tz);
  return {
    date: `${w.year}-${pad(w.month)}-${pad(w.day)}`,
    time: `${pad(w.hour)}:${pad(w.minute)}`,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateToUtcNoon(date: string): Date {
  const m = DATE_RE.exec(date);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

export function addDays(date: string, days: number): string {
  const d = dateToUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Días naturales de a hasta b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((dateToUtcNoon(b).getTime() - dateToUtcNoon(a).getTime()) / 86_400_000);
}

export function dateRange(start: string, end: string, max = 366): string[] {
  if (!isValidDate(start) || !isValidDate(end)) return [];
  const out: string[] = [];
  for (let d = start; d <= end && out.length < max; d = addDays(d, 1)) out.push(d);
  return out;
}

const longDate = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const shortDate = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const dayMonth = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short' });

export function formatDateLong(date: string): string {
  return isValidDate(date) ? longDate.format(dateToUtcNoon(date)) : 'Sin fecha';
}

/** «martes 20 de octubre» (sin año), para títulos. */
export function formatDayLong(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d).replace(',', '');
}

export function formatDateShort(date: string): string {
  return isValidDate(date) ? shortDate.format(dateToUtcNoon(date)) : 'Sin fecha';
}

export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es-ES') + text.slice(1);
}

/** "1 abr – 5 abr 2030" */
export function formatDateRange(start: string, end: string): string {
  if (!isValidDate(start) || !isValidDate(end)) return '';
  const year = end.slice(0, 4);
  const startYear = start.slice(0, 4);
  return `${formatDayMonth(start)}${startYear !== year ? ` ${startYear}` : ''} – ${formatDayMonth(end)} ${year}`;
}

export function formatDayMonth(date: string): string {
  return isValidDate(date) ? dayMonth.format(dateToUtcNoon(date)) : '';
}

/** Abreviatura legible de la zona (p. ej. "GMT+9"). */
export function tzLabel(tz: string, at: number = Date.now()): string {
  try {
    const part = new Intl.DateTimeFormat('es-ES', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date(at))
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

export function formatLdt(ldt: LocalDateTime | null): string {
  if (!ldt) return 'Sin fecha';
  const epoch = ldtToEpoch(ldt) ?? Date.now();
  const base = formatDateShort(ldt.date);
  return ldt.time ? `${base}, ${ldt.time} (${tzLabel(ldt.tz, epoch)})` : base;
}

export function formatTimestamp(ms: number): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function timeToMinutes(time: string): number {
  const m = TIME_RE.exec(time);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

const COMMON_ZONES = [
  'Asia/Tokyo',
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/London',
  'Europe/Paris',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Zurich',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Qatar',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Singapore',
  'Asia/Bangkok',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

/** Zonas frecuentes primero y el resto de las soportadas por el navegador después. */
export function timeZoneOptions(): string[] {
  const all =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const common = COMMON_ZONES.filter(isValidTimeZone);
  return [...common, ...all.filter((z) => !common.includes(z))];
}
