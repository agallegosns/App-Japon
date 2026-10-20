import type { StyleSpecification } from 'maplibre-gl';

/**
 * Estilo mínimo para el esquema de teselas de Protomaps (sin etiquetas: así no
 * hacen falta fuentes de glifos remotas y todo funciona sin conexión).
 */
export function labMapStyle(sourceUrl: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      protomaps: {
        type: 'vector',
        url: sourceUrl,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (ODbL) · <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f2efe9' } },
      { id: 'earth', type: 'fill', source: 'protomaps', 'source-layer': 'earth', paint: { 'fill-color': '#f2efe9' } },
      { id: 'landcover', type: 'fill', source: 'protomaps', 'source-layer': 'landcover', paint: { 'fill-color': '#e2ecd9', 'fill-opacity': 0.7 } },
      { id: 'landuse', type: 'fill', source: 'protomaps', 'source-layer': 'landuse', paint: { 'fill-color': '#dfe9d4', 'fill-opacity': 0.6 } },
      { id: 'water', type: 'fill', source: 'protomaps', 'source-layer': 'water', paint: { 'fill-color': '#b9d3e6' } },
      { id: 'buildings', type: 'fill', source: 'protomaps', 'source-layer': 'buildings', minzoom: 14, paint: { 'fill-color': '#ded8ce' } },
      {
        id: 'roads',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        paint: {
          'line-color': ['match', ['get', 'kind'], 'highway', '#d98c7a', 'major_road', '#e8b98f', '#ffffff'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 5],
        },
      },
      {
        id: 'rail',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'rail'],
        paint: { 'line-color': '#8a8580', 'line-width': 1.2, 'line-dasharray': [3, 2] },
      },
    ],
  };
}
