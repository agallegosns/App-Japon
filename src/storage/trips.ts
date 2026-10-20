import { dateRange, isValidDate, isValidTimeZone } from '../models/datetime';
import { newId } from '../models/id';
import type { Day, Trip } from '../models/types';
import type { NihonDB } from './db';
import { recordChange } from './meta';
import { ValidationError, type FieldErrors } from './validation';

export type TripInput = Pick<Trip, 'name' | 'startDate' | 'endDate' | 'cities' | 'tz'>;

export const MAX_TRIP_DAYS = 120;

export function validateTrip(input: TripInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name.trim()) errors.name = 'Pon un nombre al viaje.';
  if (!isValidDate(input.startDate)) errors.startDate = 'Fecha de inicio no válida.';
  if (!isValidDate(input.endDate)) errors.endDate = 'Fecha de fin no válida.';
  if (!errors.startDate && !errors.endDate) {
    if (input.endDate < input.startDate) errors.endDate = 'La fecha de fin es anterior a la de inicio.';
    else if (dateRange(input.startDate, input.endDate, MAX_TRIP_DAYS + 1).length > MAX_TRIP_DAYS)
      errors.endDate = `El viaje no puede durar más de ${MAX_TRIP_DAYS} días.`;
  }
  if (!isValidTimeZone(input.tz)) errors.tz = 'Zona horaria no válida.';
  return errors;
}

export async function getTrip(db: NihonDB): Promise<Trip | undefined> {
  const trips = await db.trips.orderBy('id').toArray();
  return trips.sort((a, b) => a.createdAt - b.createdAt)[0];
}

/** Crea o actualiza el viaje y sincroniza sus días. */
export async function saveTrip(db: NihonDB, input: TripInput): Promise<Trip> {
  const errors = validateTrip(input);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const cities = input.cities.map((c) => c.trim()).filter(Boolean);
  return db.transaction('rw', db.trips, db.days, db.meta, async () => {
    const existing = await getTrip(db);
    const now = Date.now();
    const trip: Trip = {
      id: existing?.id ?? newId(),
      name: input.name.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      cities,
      tz: input.tz,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.trips.put(trip);
    await syncDays(db, trip);
    await recordChange(db);
    return trip;
  });
}

async function syncDays(db: NihonDB, trip: Trip): Promise<void> {
  const dates = dateRange(trip.startDate, trip.endDate, MAX_TRIP_DAYS);
  const existing = await db.days.where('tripId').equals(trip.id).toArray();
  const byDate = new Map(existing.map((d) => [d.date, d]));
  const toRemove = existing.filter((d) => !dates.includes(d.date)).map((d) => d.id);
  if (toRemove.length) await db.days.bulkDelete(toRemove);
  const defaultCity = trip.cities.length === 1 ? (trip.cities[0] ?? '') : '';
  const toAdd: Day[] = dates
    .filter((date) => !byDate.has(date))
    .map((date) => ({ id: newId(), tripId: trip.id, date, city: defaultCity, lodgingId: null }));
  if (toAdd.length) await db.days.bulkAdd(toAdd);
}

export async function listDays(db: NihonDB, tripId: string): Promise<Day[]> {
  const days = await db.days.where('tripId').equals(tripId).toArray();
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export async function setDayCity(db: NihonDB, dayId: string, city: string): Promise<void> {
  await db.transaction('rw', db.days, db.meta, async () => {
    const updated = await db.days.update(dayId, { city: city.trim() });
    if (!updated) throw new Error('El día no existe.');
    await recordChange(db);
  });
}

/** Elige a mano el alojamiento de la noche de un día. null = automático (según check-in/check-out). */
export async function setDayLodging(db: NihonDB, dayId: string, lodgingId: string | null): Promise<void> {
  await db.transaction('rw', db.days, db.bookings, db.meta, async () => {
    if (lodgingId !== null) {
      const b = await db.bookings.get(lodgingId);
      if (!b || b.category !== 'alojamiento') throw new Error('Ese alojamiento no existe.');
    }
    const updated = await db.days.update(dayId, { lodgingId });
    if (!updated) throw new Error('El día no existe.');
    await recordChange(db);
  });
}
