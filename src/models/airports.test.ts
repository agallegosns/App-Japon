import { describe, expect, it } from 'vitest';
import { AIRPORTS, airportFromLabel, airportLabel, invalidAirportTimeZones, searchAirports } from './airports';

describe('buscador de aeropuertos', () => {
  it('encuentra Hong Kong por nombre, con o sin tildes y mayúsculas', () => {
    expect(searchAirports('hong kong')[0]?.code).toBe('HKG');
    expect(searchAirports('HONG')[0]?.code).toBe('HKG');
    expect(searchAirports('Hkg')[0]?.code).toBe('HKG');
  });

  it('encuentra por nombres en español y alternativos', () => {
    expect(searchAirports('tokio').map((a) => a.code)).toEqual(expect.arrayContaining(['HND', 'NRT']));
    expect(searchAirports('Estambul').map((a) => a.code)).toContain('IST');
    expect(searchAirports('london').map((a) => a.code)).toContain('LHR');
    expect(searchAirports('munich').map((a) => a.code)).toContain('MUC');
    expect(searchAirports('Kioto').map((a) => a.code)).toContain('KIX');
  });

  it('el código exacto va primero y hace falta escribir al menos 2 letras', () => {
    expect(searchAirports('DOH')[0]?.code).toBe('DOH');
    expect(searchAirports('h')).toEqual([]);
    expect(searchAirports('zzzzzz')).toEqual([]);
  });

  it('limita el número de resultados', () => {
    expect(searchAirports('a', 3).length).toBeLessThanOrEqual(3);
    expect(searchAirports('es', 5).length).toBeLessThanOrEqual(5);
  });

  it('la lista es coherente: códigos únicos de 3 letras y zonas horarias válidas', () => {
    const codes = AIRPORTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{3}$/.test(c))).toBe(true);
    expect(invalidAirportTimeZones()).toEqual([]);
  });

  it('las zonas horarias de los aeropuertos clave son las correctas', () => {
    const tz = (code: string) => AIRPORTS.find((a) => a.code === code)?.tz;
    expect(tz('MAD')).toBe('Europe/Madrid');
    expect(tz('HKG')).toBe('Asia/Hong_Kong');
    expect(tz('DOH')).toBe('Asia/Qatar');
    expect(tz('HND')).toBe('Asia/Tokyo');
    expect(tz('KIX')).toBe('Asia/Tokyo');
  });

  it('la etiqueta guardada permite recuperar el aeropuerto y su zona', () => {
    const hkg = AIRPORTS.find((a) => a.code === 'HKG')!;
    expect(airportLabel(hkg)).toContain('(HKG)');
    expect(airportFromLabel(airportLabel(hkg))?.tz).toBe('Asia/Hong_Kong');
    expect(airportFromLabel('Un sitio cualquiera')).toBeNull();
  });
});
