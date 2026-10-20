import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeEntities, translateJaToEs, TranslateError } from './translate';

function mockFetch(body: unknown, init: { status?: number } = {}) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: init.status ?? 200 }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('traducción japonés → español', () => {
  it('traduce y envía el par de idiomas ja|es', async () => {
    const fn = mockFetch({ responseData: { translatedText: 'Los aseos están al fondo' }, responseStatus: 200 });
    await expect(translateJaToEs('トイレは奥です')).resolves.toBe('Los aseos están al fondo');
    const url = new URL(String((fn.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('langpair')).toBe('ja|es');
    expect(url.searchParams.get('q')).toBe('トイレは奥です');
    expect(url.searchParams.has('de')).toBe(false);
  });

  it('envía el email solo si se indica', async () => {
    const fn = mockFetch({ responseData: { translatedText: 'Hola' }, responseStatus: 200 });
    await translateJaToEs('こんにちは', { email: 'a@b.es' });
    expect(new URL(String((fn.mock.calls[0] as unknown[])[0])).searchParams.get('de')).toBe('a@b.es');
  });

  it('decodifica las entidades HTML de la respuesta', async () => {
    mockFetch({ responseData: { translatedText: 'L&#39;estaci&oacute;n &amp; tren' }, responseStatus: 200 });
    await expect(translateJaToEs('駅')).resolves.toBe("L'estación & tren");
    expect(decodeEntities('sin entidades')).toBe('sin entidades');
  });

  it('un texto largo se envía en varias peticiones y se une', async () => {
    const fn = vi.fn(async () => new Response(JSON.stringify({ responseData: { translatedText: 'parte' }, responseStatus: 200 })));
    vi.stubGlobal('fetch', fn);
    const out = await translateJaToEs('これはテストです。'.repeat(80));
    expect(fn.mock.calls.length).toBeGreaterThan(1);
    expect(out.split(' ').length).toBe(fn.mock.calls.length);
  });

  it('detecta el límite diario agotado (aviso de MyMemory, 429 o quotaFinished)', async () => {
    mockFetch({ responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.' }, responseStatus: 200 });
    await expect(translateJaToEs('駅')).rejects.toMatchObject({ kind: 'quota' });
    mockFetch({ responseData: { translatedText: '' }, responseStatus: 429 });
    await expect(translateJaToEs('駅')).rejects.toMatchObject({ kind: 'quota' });
    mockFetch({}, { status: 429 });
    await expect(translateJaToEs('駅')).rejects.toMatchObject({ kind: 'quota' });
  });

  it('informa de errores del servicio y de red', async () => {
    mockFetch({}, { status: 503 });
    await expect(translateJaToEs('駅')).rejects.toMatchObject({ kind: 'service' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(translateJaToEs('駅')).rejects.toMatchObject({ kind: 'network' });
  });

  it('sin conexión no llama al servicio', async () => {
    const fn = mockFetch({});
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await expect(translateJaToEs('駅')).rejects.toBeInstanceOf(TranslateError);
    expect(fn).not.toHaveBeenCalled();
  });
});
