import { describe, expect, it } from 'vitest';
import { activityDirectionsUrl, bookingDirectionsUrl, directionsUrl, transitRouteUrl } from './mapLinks';

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

describe('rutas en tren con Google Maps', () => {
  it('la ruta entre estaciones usa el nombre en inglés de las conocidas', () => {
    const url = transitRouteUrl('Tokio', 'Kioto')!;
    expect(url).toContain('origin=Tokyo%20Station');
    expect(url).toContain('destination=Kyoto%20Station');
    expect(url.endsWith('travelmode=transit')).toBe(true);
    expect(decodeURIComponent(transitRouteUrl('Estación rara', 'Kioto')!)).toContain('origin=Estación rara');
    expect(transitRouteUrl('', 'Kioto')).toBeNull();
  });

  it('para un tren, «cómo llegar» lleva a la estación de salida del primer trayecto', () => {
    const leg = { id: 'l', from: 'Shin-Osaka', to: 'Kioto', flightNumber: '', car: '', seat: '', fare: '' as const, depart: null, arrive: null };
    const url = bookingDirectionsUrl({ category: 'transporte', name: 'Tren', address: '', legs: [leg] })!;
    expect(decodeURIComponent(url)).toContain('destination=Shin-Osaka Station');
    expect(bookingDirectionsUrl({ category: 'transporte', name: 'Tren', address: '', legs: [] })).toBeNull();
  });
});
