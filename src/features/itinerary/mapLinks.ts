import type { Activity } from '../../models/types';

/** Enlace externo para abrir la ubicación en Apple Maps (necesita conexión para cargar el mapa). */
export function externalMapUrl(a: Pick<Activity, 'mapRef' | 'title' | 'address'>): string | null {
  if (a.mapRef?.type === 'url') return a.mapRef.url;
  if (a.mapRef?.type === 'coords') {
    const q = encodeURIComponent(a.title);
    return `https://maps.apple.com/?ll=${a.mapRef.lat},${a.mapRef.lng}&q=${q}`;
  }
  if (a.address) return `https://maps.apple.com/?q=${encodeURIComponent(a.address)}`;
  return null;
}
