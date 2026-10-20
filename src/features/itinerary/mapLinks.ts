import { stationQuery } from '../../models/stations';
import type { Activity, Booking } from '../../models/types';

export type TravelMode = 'transit' | 'walking' | 'driving';

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  transit: 'En transporte público',
  walking: 'A pie',
  driving: 'En coche o taxi',
};

const GOOGLE_MAPS_LINK = /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

/**
 * Ruta de Google Maps hasta el destino, desde la ubicación actual. En el iPhone abre la app de Google Maps si está
 * instalada y, si no, Google Maps en el navegador. Necesita conexión.
 */
export function directionsUrl(
  destination: { text?: string; coords?: { lat: number; lng: number } | null },
  mode: TravelMode = 'transit',
): string | null {
  const dest = destination.coords ? `${destination.coords.lat},${destination.coords.lng}` : (destination.text ?? '').trim();
  if (!dest) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}

/** Ruta hasta una actividad: sus coordenadas, su enlace de Google Maps, o su lugar y dirección. */
export function activityDirectionsUrl(a: Pick<Activity, 'mapRef' | 'location' | 'address' | 'title'>, mode: TravelMode = 'transit'): string | null {
  if (a.mapRef?.type === 'coords') return directionsUrl({ coords: a.mapRef }, mode);
  if (a.mapRef?.type === 'url' && GOOGLE_MAPS_LINK.test(a.mapRef.url)) return a.mapRef.url;
  const text = [a.location, a.address].map((p) => p.trim()).filter(Boolean).join(', ');
  return directionsUrl({ text }, mode);
}

/** Ruta en Google Maps entre dos estaciones (con horarios de trenes cuando Google los tiene). */
export function transitRouteUrl(from: string, to: string, mode: TravelMode = 'transit'): string | null {
  const o = stationQuery(from);
  const d = stationQuery(to);
  if (!o || !d) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=${mode}`;
}

/**
 * Ruta hasta un alojamiento, restaurante o entrada; en un tren, hasta la estación de salida del primer trayecto.
 * No tiene sentido para vuelos.
 */
export function bookingDirectionsUrl(
  b: Pick<Booking, 'category' | 'name' | 'address'> & { legs?: Booking['legs'] },
  mode: TravelMode = 'transit',
): string | null {
  if (b.category === 'vuelo') return null;
  if (b.category === 'transporte') {
    const first = b.legs?.find((l) => l.from.trim());
    return first ? directionsUrl({ text: stationQuery(first.from) }, mode) : null;
  }
  const text = [b.name, b.address].map((p) => p.trim()).filter(Boolean).join(', ');
  return b.address.trim() || b.category === 'alojamiento' || b.category === 'restaurante' || b.category === 'entrada'
    ? directionsUrl({ text }, mode)
    : null;
}
