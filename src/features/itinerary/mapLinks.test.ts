import { describe, expect, it } from 'vitest';
import { activityDirectionsUrl, bookingDirectionsUrl, directionsUrl } from './mapLinks';

const act = (patch: object) => ({ mapRef: null, location: '', address: '', title: 'Actividad', ...patch });

describe('cómo llegar con Google Maps', () => {
  it('construye la ruta con el destino codificado y el modo de viaje', () => {
    const url = directionsUrl({ text: 'Senso-ji, Asakusa 2-3-1' }, 'walking')!;
    expect(url.startsWith('https://www.google.com/maps/dir/?api=1&destination=')).toBe(true);
    expect(url).toContain(encodeURIComponent('Senso-ji, Asakusa 2-3-1'));
    expect(url.endsWith('travelmode=walking')).toBe(true);
    expect(directionsUrl({ text: 'x' })).toContain('travelmode=transit');
    expect(directionsUrl({ text: '  ' })).toBeNull();
  });

  it('para una actividad usa coordenadas, un enlace de Google Maps o el lugar y la dirección', () => {
    expect(activityDirectionsUrl(act({ mapRef: { type: 'coords', lat: 35.7148, lng: 139.7967 } }))).toContain('destination=35.7148%2C139.7967');
    expect(activityDirectionsUrl(act({ mapRef: { type: 'url', url: 'https://maps.app.goo.gl/abc123' } }))).toBe('https://maps.app.goo.gl/abc123');
    const u = activityDirectionsUrl(act({ location: 'Templo Senso-ji', address: 'Asakusa, Tokio' }))!;
    expect(decodeURIComponent(u)).toContain('Templo Senso-ji, Asakusa, Tokio');
  });

  it('un enlace que no es de Google Maps no se usa como destino; sin datos no hay ruta', () => {
    const u = activityDirectionsUrl(act({ mapRef: { type: 'url', url: 'https://example.com/mapa' }, location: 'Parque Ueno' }))!;
    expect(decodeURIComponent(u)).toContain('Parque Ueno');
    expect(activityDirectionsUrl(act({}))).toBeNull();
  });

  it('para reservas: alojamientos, restaurantes y entradas sí; vuelos y trenes no', () => {
    expect(bookingDirectionsUrl({ category: 'alojamiento', name: 'Hotel Granbell', address: 'Kabukicho' })).not.toBeNull();
    expect(bookingDirectionsUrl({ category: 'restaurante', name: 'Sushi Dai', address: '' })).not.toBeNull();
    expect(bookingDirectionsUrl({ category: 'vuelo', name: 'MAD-HND', address: 'x' })).toBeNull();
    expect(bookingDirectionsUrl({ category: 'transporte', name: 'Shinkansen', address: 'Estación de Tokio' })).toBeNull();
    expect(bookingDirectionsUrl({ category: 'otro', name: 'Algo', address: '' })).toBeNull();
  });
});
