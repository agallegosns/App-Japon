import { describe, expect, it } from 'vitest';
import { STATIONS, searchStations, stationFromLabel, stationQuery } from './stations';

describe('buscador de estaciones', () => {
  it('encuentra Kioto por nombre, en inglés y en kanji', () => {
    expect(searchStations('kioto')[0]?.name).toBe('Kioto');
    expect(searchStations('Kyoto')[0]?.name).toBe('Kioto');
    expect(searchStations('京都')[0]?.name).toBe('Kioto');
  });

  it('encuentra por ciudad o alias y no devuelve nada con menos de 2 letras', () => {
    expect(searchStations('osaka').map((s) => s.name)).toEqual(expect.arrayContaining(['Osaka', 'Shin-Osaka']));
    expect(searchStations('fuji').map((s) => s.name)).toContain('Kawaguchiko');
    expect(searchStations('k')).toEqual([]);
    expect(searchStations('zzzzzz')).toEqual([]);
  });

  it('el nombre exacto va primero', () => {
    expect(searchStations('shin-osaka')[0]?.name).toBe('Shin-Osaka');
  });

  it('la lista es coherente: nombres únicos y con kanji', () => {
    const names = STATIONS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(STATIONS.every((s) => s.jp.length > 0 && s.en.length > 0)).toBe(true);
  });

  it('da el nombre para Google Maps: en inglés si se conoce y, si no, lo escrito', () => {
    expect(stationFromLabel('Tokio')?.jp).toBe('東京');
    expect(stationQuery('Tokio')).toBe('Tokyo Station');
    expect(stationQuery('Estación de Atocha')).toBe('Estación de Atocha');
    expect(stationQuery('  ')).toBe('');
  });
});
