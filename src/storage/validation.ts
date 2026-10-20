import { isValidDate, isValidTime, isValidTimeZone } from '../models/datetime';
import type { LocalDateTime } from '../models/types';

export type FieldErrors = Record<string, string>;

export function validateLdt(errors: FieldErrors, field: string, ldt: LocalDateTime | null, required = false): void {
  if (!ldt) {
    if (required) errors[field] = 'Indica la fecha.';
    return;
  }
  if (!isValidDate(ldt.date)) errors[field] = 'La fecha no es válida.';
  else if (ldt.time !== null && !isValidTime(ldt.time)) errors[field] = 'La hora no es válida.';
  else if (!isValidTimeZone(ldt.tz)) errors[field] = 'La zona horaria no es válida.';
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export class ValidationError extends Error {
  constructor(public readonly errors: FieldErrors) {
    super(Object.values(errors).join(' '));
    this.name = 'ValidationError';
  }
}
