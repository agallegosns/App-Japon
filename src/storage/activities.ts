import { isValidDate, isValidTime, isValidTimeZone, timeToMinutes } from '../models/datetime';
import { compareByTime } from '../models/activitySort';
import { newId } from '../models/id';
import { ACTIVITY_STATUSES, DEFAULT_TZ, type Activity, type ActivityStatus } from '../models/types';
import type { NihonDB } from './db';
import { recordChange } from './meta';
import { isHttpUrl, ValidationError, type FieldErrors } from './validation';

export type ActivityInput = Omit<Activity, 'id' | 'order' | 'createdAt' | 'updatedAt'>;

export function emptyActivity(date: string, tz: string = DEFAULT_TZ): ActivityInput {
  return {
    title: '',
    date,
    allDay: false,
    startTime: null,
    endTime: null,
    tz,
    location: '',
    address: '',
    durationMin: null,
    notes: '',
    bookingId: null,
    status: 'pendiente',
    mapRef: null,
  };
}

export function validateActivity(input: ActivityInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.title.trim()) errors.title = 'El título es obligatorio.';
  if (!isValidDate(input.date)) errors.date = 'La fecha no es válida.';
  if (input.startTime !== null && !isValidTime(input.startTime)) errors.startTime = 'Hora no válida.';
  if (input.endTime !== null && !isValidTime(input.endTime)) errors.endTime = 'Hora no válida.';
  if (!errors.startTime && !errors.endTime && input.startTime && input.endTime) {
    if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime))
      errors.endTime = 'La hora de fin debe ser posterior a la de inicio.';
  }
  if (input.durationMin !== null && (!Number.isInteger(input.durationMin) || input.durationMin <= 0 || input.durationMin > 24 * 60))
    errors.durationMin = 'Duración en minutos entre 1 y 1440.';
  if (!isValidTimeZone(input.tz)) errors.tz = 'Zona horaria no válida.';
  if (!ACTIVITY_STATUSES.includes(input.status)) errors.status = 'Estado no válido.';
  if (input.mapRef?.type === 'coords') {
    const { lat, lng } = input.mapRef;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180)
      errors.mapRef = 'Coordenadas no válidas.';
  } else if (input.mapRef?.type === 'url' && !isHttpUrl(input.mapRef.url)) {
    errors.mapRef = 'El enlace debe empezar por https://';
  }
  return errors;
}

function normalize(input: ActivityInput): ActivityInput {
  return {
    ...input,
    title: input.title.trim(),
    location: input.location.trim(),
    address: input.address.trim(),
    // Una actividad de todo el día no tiene horas.
    ...(input.allDay ? { startTime: null, endTime: null, durationMin: null } : {}),
  };
}

async function dayList(db: NihonDB, date: string): Promise<Activity[]> {
  const list = await db.activities.where('date').equals(date).toArray();
  return list.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

async function writeOrder(db: NihonDB, list: Activity[]): Promise<void> {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a && a.order !== i) await db.activities.update(a.id, { order: i });
  }
}

export async function createActivity(db: NihonDB, input: ActivityInput): Promise<Activity> {
  const data = normalize(input);
  const errors = validateActivity(data);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return db.transaction('rw', db.activities, db.bookings, db.meta, async () => {
    if (data.bookingId && !(await db.bookings.get(data.bookingId))) throw new Error('La reserva asociada no existe.');
    const now = Date.now();
    const activity: Activity = {
      ...data,
      id: newId(),
      order: (await dayList(db, data.date)).length,
      createdAt: now,
      updatedAt: now,
    };
    await db.activities.add(activity);
    await recordChange(db);
    return activity;
  });
}

export async function updateActivity(db: NihonDB, id: string, input: ActivityInput): Promise<Activity> {
  const data = normalize(input);
  const errors = validateActivity(data);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return db.transaction('rw', db.activities, db.bookings, db.meta, async () => {
    const existing = await db.activities.get(id);
    if (!existing) throw new Error('La actividad no existe.');
    if (data.bookingId && !(await db.bookings.get(data.bookingId))) throw new Error('La reserva asociada no existe.');
    let order = existing.order;
    if (existing.date !== data.date) {
      order = (await dayList(db, data.date)).length;
    }
    const activity: Activity = { ...existing, ...data, order, updatedAt: Date.now() };
    await db.activities.put(activity);
    if (existing.date !== data.date) await writeOrder(db, await dayList(db, existing.date));
    await recordChange(db);
    return activity;
  });
}

export async function deleteActivity(db: NihonDB, id: string): Promise<void> {
  await db.transaction('rw', db.activities, db.meta, async () => {
    const existing = await db.activities.get(id);
    if (!existing) return;
    await db.activities.delete(id);
    await writeOrder(db, await dayList(db, existing.date));
    await recordChange(db);
  });
}

export async function setActivityStatus(db: NihonDB, id: string, status: ActivityStatus): Promise<void> {
  await db.transaction('rw', db.activities, db.meta, async () => {
    const updated = await db.activities.update(id, { status, updatedAt: Date.now() });
    if (!updated) throw new Error('La actividad no existe.');
    await recordChange(db);
  });
}

/** Mueve una actividad a otra posición dentro de su día. */
export async function moveActivity(db: NihonDB, id: string, toIndex: number): Promise<void> {
  await db.transaction('rw', db.activities, db.meta, async () => {
    const existing = await db.activities.get(id);
    if (!existing) throw new Error('La actividad no existe.');
    const list = await dayList(db, existing.date);
    const from = list.findIndex((a) => a.id === id);
    const target = Math.max(0, Math.min(list.length - 1, toIndex));
    if (from === target) return;
    const [item] = list.splice(from, 1);
    if (!item) return;
    list.splice(target, 0, item);
    await writeOrder(db, list);
    await recordChange(db);
  });
}

export async function getActivity(db: NihonDB, id: string): Promise<Activity | undefined> {
  return db.activities.get(id);
}

export async function listActivitiesByDate(db: NihonDB, date: string): Promise<Activity[]> {
  return dayList(db, date);
}

/** Todas las actividades por fecha y orden del día. */
export async function listActivities(db: NihonDB): Promise<Activity[]> {
  const all = await db.activities.toArray();
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
}

/** Reordena las actividades de un día por hora (todo el día primero, sin hora al final). */
export async function sortDayByTime(db: NihonDB, date: string): Promise<void> {
  await db.transaction('rw', db.activities, db.meta, async () => {
    const list = (await dayList(db, date)).sort(compareByTime);
    await writeOrder(db, list);
    await recordChange(db);
  });
}
