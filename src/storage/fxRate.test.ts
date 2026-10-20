import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RATE } from '../models/currency';
import { fetchBceRate, FX_KEY, FX_MAX_AGE_MS, loadRate, manualRate, needsRefresh, saveRate, validateRate } from './fxRate';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

describe('cotización euro/yen guardada', () => {
  it('sin nada guardado usa la cotización de referencia', () => {
    expect(loadRate()).toEqual(DEFAULT_RATE);
  });

  it('guarda y recupera la cotización, y descarta datos dañados o absurdos', () => {
    const r = { eurToJpy: 171.5, date: '2030-04-01', source: 'bce' as const, fetchedAt: 123 };
    saveRate(r);
    expect(loadRate()).toEqual(r);
    localStorage.setItem(FX_KEY, '{"eurToJpy": 3, "date": "x"}');
    expect(loadRate()).toEqual(DEFAULT_RATE);
    localStorage.setItem(FX_KEY, 'no es json');
    expect(loadRate()).toEqual(DEFAULT_RATE);
  });

  it('valida la cotización escrita a mano', () => {
    expect(validateRate(175)).toBeNull();
    expect(validateRate(Number.NaN)).not.toBeNull();
    expect(validateRate(5)).not.toBeNull();
    expect(validateRate(5000)).not.toBeNull();
  });

  it('descarga la cotización del BCE desde Frankfurter', async () => {
    mockFetch({ amount: 1, base: 'EUR', date: '2030-04-02', rates: { JPY: 171.25 } });
    const r = await fetchBceRate(1000);
    expect(r).toEqual({ eurToJpy: 171.25, date: '2030-04-02', source: 'bce', fetchedAt: 1000 });
    const url = String((vi.mocked(fetch).mock.calls[0] as unknown[])[0]);
    expect(url).toContain('base=EUR');
    expect(url).toContain('symbols=JPY');
  });

  it('rechaza respuestas inválidas o errores sin tocar lo guardado', async () => {
    mockFetch({ rates: { JPY: 3 }, date: '2030-04-02' });
    await expect(fetchBceRate()).rejects.toThrow(/no es válida/);
    mockFetch({}, 500);
    await expect(fetchBceRate()).rejects.toThrow(/500/);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(fetchBceRate()).rejects.toThrow(/No se pudo conectar/);
    expect(loadRate()).toEqual(DEFAULT_RATE);
  });

  it('decide cuándo actualizar: nunca la manual, siempre la que nunca se descargó, y la antigua', () => {
    const now = 10_000_000_000;
    expect(needsRefresh(DEFAULT_RATE, now)).toBe(true);
    expect(needsRefresh({ ...DEFAULT_RATE, source: 'bce', fetchedAt: now - 1000 }, now)).toBe(false);
    expect(needsRefresh({ ...DEFAULT_RATE, source: 'bce', fetchedAt: now - FX_MAX_AGE_MS - 1 }, now)).toBe(true);
    expect(needsRefresh(manualRate(180, now - FX_MAX_AGE_MS * 10), now)).toBe(false);
  });
});

describe('descarga automática de la cotización', () => {
  it('una respuesta tardía NO pisa una cotización escrita a mano; el botón «Actualizar» sí', async () => {
    const { refreshRate, setManualRate, reloadRateFromStorage } = await import('./useFxRate');
    localStorage.clear();
    reloadRateFromStorage();
    let release: () => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await new Promise<void>((r) => {
          release = r;
        });
        return new Response(JSON.stringify({ date: '2030-04-02', rates: { JPY: 171.25 } }), { status: 200 });
      }),
    );
    const auto = refreshRate(false);
    expect(setManualRate(160)).toBeNull();
    release();
    await auto;
    expect(loadRate()).toMatchObject({ eurToJpy: 160, source: 'manual' });

    const forced = refreshRate(true);
    release();
    await forced;
    expect(loadRate()).toMatchObject({ eurToJpy: 171.25, source: 'bce' });
  });
});
