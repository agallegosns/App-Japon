import type { Activity, Booking, Day, Trip } from '../models/types';
import { listActivities } from './activities';
import { listBookings } from './bookings';
import { getDb } from './db';
import { getBackupStatus, type BackupStatus } from './meta';
import { getTrip, listDays } from './trips';
import { useLiveQuery } from './useLiveQuery';

export interface AppData {
  trip: Trip | null;
  days: Day[];
  bookings: Booking[];
  activities: Activity[];
  attachmentCount: number;
  backup: BackupStatus;
}

export async function loadAppData(): Promise<AppData> {
  const db = getDb();
  const trip = (await getTrip(db)) ?? null;
  const [days, bookings, activities, attachmentCount, backup] = await Promise.all([
    trip ? listDays(db, trip.id) : Promise.resolve([]),
    listBookings(db),
    listActivities(db),
    db.attachments.count(),
    getBackupStatus(db),
  ]);
  return { trip, days, bookings, activities, attachmentCount, backup };
}

export function useAppData() {
  return useLiveQuery(loadAppData, []);
}

export function hasAnyData(d: AppData): boolean {
  return !!d.trip || d.bookings.length > 0 || d.activities.length > 0;
}
