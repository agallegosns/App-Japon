import { isValidTimeZone, ldtToEpoch } from '../models/datetime';
import { newId } from '../models/id';
import {
  BOOKING_CATEGORIES,
  BOOKING_STATUSES,
  type Booking,
  type BookingCategory,
} from '../models/types';
import type { NihonDB } from './db';
import { recordChange } from './meta';
import { isHttpUrl, validateLdt, ValidationError, type FieldErrors } from './validation';

export type BookingInput = Omit<Booking, 'id' | 'sortAt' | 'createdAt' | 'updatedAt'>;

export function emptyBooking(category: BookingCategory = 'otro'): BookingInput {
  return {
    name: '',
    category,
    status: 'pendiente',
    start: null,
    arrival: null,
    checkIn: null,
    checkOut: null,
    address: '',
    addressJa: '',
    confirmationCode: '',
    price: null,
    phone: '',
    contact: '',
    notes: '',
    links: [],
  };
}

export function validateBooking(input: BookingInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name.trim()) errors.name = 'El nombre es obligatorio.';
  if (!BOOKING_CATEGORIES.includes(input.category)) errors.category = 'Categoría no válida.';
  if (!BOOKING_STATUSES.includes(input.status)) errors.status = 'Estado no válido.';
  validateLdt(errors, 'start', input.start);
  validateLdt(errors, 'arrival', input.arrival);
  validateLdt(errors, 'checkIn', input.checkIn);
  validateLdt(errors, 'checkOut', input.checkOut);
  const a = ldtToEpoch(input.start);
  const b = ldtToEpoch(input.arrival);
  if (a !== null && b !== null && input.start?.time && input.arrival?.time && b < a)
    errors.arrival = 'La llegada es anterior a la salida.';
  const ci = ldtToEpoch(input.checkIn);
  const co = ldtToEpoch(input.checkOut);
  if (ci !== null && co !== null && co < ci) errors.checkOut = 'El check-out es anterior al check-in.';
  if (input.price) {
    if (!Number.isFinite(input.price.amount) || input.price.amount < 0)
      errors.price = 'El precio debe ser un número positivo.';
    else if (!/^[A-Z]{3}$/.test(input.price.currency)) errors.price = 'Moneda no válida (p. ej. EUR, JPY).';
  }
  input.links.forEach((l, i) => {
    if (!isHttpUrl(l.url)) errors[`links.${i}`] = 'El enlace debe empezar por https://';
  });
  for (const ldt of [input.start, input.arrival, input.checkIn, input.checkOut]) {
    if (ldt && !isValidTimeZone(ldt.tz)) errors.tz = 'Zona horaria no válida.';
  }
  return errors;
}

/** Instante usado para ordenar y para calcular la "próxima reserva". */
export function bookingSortAt(b: Pick<Booking, 'start' | 'checkIn' | 'arrival'>): number | null {
  return ldtToEpoch(b.start) ?? ldtToEpoch(b.checkIn) ?? ldtToEpoch(b.arrival);
}

function normalize(input: BookingInput): BookingInput {
  return {
    ...input,
    name: input.name.trim(),
    address: input.address.trim(),
    addressJa: input.addressJa.trim(),
    confirmationCode: input.confirmationCode.trim(),
    phone: input.phone.trim(),
    contact: input.contact.trim(),
    links: input.links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url.length > 0),
  };
}

export async function createBooking(db: NihonDB, input: BookingInput): Promise<Booking> {
  const data = normalize(input);
  const errors = validateBooking(data);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const now = Date.now();
  const booking: Booking = { ...data, id: newId(), sortAt: bookingSortAt(data), createdAt: now, updatedAt: now };
  await db.transaction('rw', db.bookings, db.meta, async () => {
    await db.bookings.add(booking);
    await recordChange(db);
  });
  return booking;
}

export async function updateBooking(db: NihonDB, id: string, input: BookingInput): Promise<Booking> {
  const data = normalize(input);
  const errors = validateBooking(data);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return db.transaction('rw', db.bookings, db.meta, async () => {
    const existing = await db.bookings.get(id);
    if (!existing) throw new Error('La reserva no existe.');
    const booking: Booking = { ...existing, ...data, sortAt: bookingSortAt(data), updatedAt: Date.now() };
    await db.bookings.put(booking);
    await recordChange(db);
    return booking;
  });
}

/** Elimina la reserva, sus adjuntos y desvincula las actividades asociadas. */
export async function deleteBooking(db: NihonDB, id: string): Promise<void> {
  await db.transaction('rw', db.bookings, db.attachments, db.activities, db.meta, async () => {
    await db.attachments.where('bookingId').equals(id).delete();
    const linked = await db.activities.where('bookingId').equals(id).toArray();
    for (const a of linked) await db.activities.update(a.id, { bookingId: null, updatedAt: Date.now() });
    await db.bookings.delete(id);
    await recordChange(db);
  });
}

export async function getBooking(db: NihonDB, id: string): Promise<Booking | undefined> {
  return db.bookings.get(id);
}

/** Reservas ordenadas por fecha; las que no tienen fecha, al final por nombre. */
export async function listBookings(db: NihonDB): Promise<Booking[]> {
  const all = await db.bookings.toArray();
  return sortBookings(all);
}

export function sortBookings(list: Booking[]): Booking[] {
  return [...list].sort((a, b) => {
    if (a.sortAt === null && b.sortAt === null) return a.name.localeCompare(b.name, 'es');
    if (a.sortAt === null) return 1;
    if (b.sortAt === null) return -1;
    return a.sortAt - b.sortAt;
  });
}
