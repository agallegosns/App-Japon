import { tripIcs } from '../../models/ics';
import { listActivities } from '../../storage/activities';
import { listBookings } from '../../storage/bookings';
import { getDb } from '../../storage/db';

export interface CalendarResult {
  outcome: 'shared' | 'downloaded' | 'cancelled';
  count: number;
}

/**
 * Genera el calendario del viaje (.ics) y lo entrega con la hoja de compartir del iPhone, desde donde se abre con
 * «Calendario» para añadir todos los eventos con sus avisos. Funciona sin conexión.
 */
export async function shareCalendar(): Promise<CalendarResult> {
  const db = getDb();
  const [activities, bookings] = await Promise.all([listActivities(db), listBookings(db)]);
  const { ics, count } = tripIcs(activities, bookings);
  if (count === 0) throw new Error('Aún no hay actividades ni reservas con fecha para añadir al calendario.');
  const file = new File([ics], 'nihon-trip.ics', { type: 'text/calendar' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Itinerario de Nihon Trip' });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { outcome: 'cancelled', count };
      throw e;
    }
    return { outcome: 'shared', count };
  }
  const url = URL.createObjectURL(file);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return { outcome: 'downloaded', count };
}
