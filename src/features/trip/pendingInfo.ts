import { formatDateShort } from '../../models/datetime';
import { CATEGORY_LABEL } from '../../models/labels';
import { activityWarnings, bookingWarnings, daysWithoutCity, detectOverlaps } from '../../models/warnings';
import type { AppData } from '../../storage/appData';

export interface PendingItem {
  key: string;
  text: string;
  to: string;
}

/** Información pendiente o incoherente que el usuario debería completar. */
export function pendingInfo(data: AppData): PendingItem[] {
  const out: PendingItem[] = [];
  if (data.trip) {
    const missing = daysWithoutCity(data.days, data.trip.cities);
    if (missing.length) out.push({ key: 'days-city', text: `${missing.length} día(s) sin ciudad asignada`, to: '/itinerario' });
  }
  for (const b of data.bookings) {
    const w = bookingWarnings(b);
    if (w.length) out.push({ key: `b-${b.id}`, text: `${b.name} (${CATEGORY_LABEL[b.category]}): ${w.join(', ').toLowerCase()}`, to: `/reservas/${b.id}` });
  }
  const overlaps = detectOverlaps(data.activities);
  const seen = new Set<string>();
  for (const a of data.activities) {
    const others = overlaps.get(a.id);
    if (others && !seen.has(a.id)) {
      others.forEach((o) => seen.add(o));
      seen.add(a.id);
      out.push({ key: `o-${a.id}`, text: `Solape de horario el ${formatDateShort(a.date)}: «${a.title}»`, to: `/itinerario?fecha=${a.date}` });
    }
    const w = activityWarnings(a);
    if (w.length) out.push({ key: `a-${a.id}`, text: `«${a.title}» (${formatDateShort(a.date)}): ${w.join(', ').toLowerCase()}`, to: `/itinerario/${a.id}/editar` });
  }
  return out;
}
