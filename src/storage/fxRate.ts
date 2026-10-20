import { DEFAULT_RATE, MAX_RATE, MIN_RATE, type FxRate } from '../models/currency';

/**
 * Cotización euro/yen guardada en el móvil (localStorage), fuera de la base de datos para que no se borre con los datos
 * del viaje. Con conexión se actualiza sola desde Frankfurter (tipos de referencia del BCE, gratis y sin clave).
 */
export const FX_KEY = 'nihon.fx';
export const FX_ENDPOINT = 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=JPY';
/** Pasado este tiempo desde la última descarga se intenta actualizar al abrir una pantalla con importes. */
export const FX_MAX_AGE_MS = 6 * 3_600_000;

function isRate(v: unknown): v is FxRate {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.eurToJpy === 'number' &&
    r.eurToJpy >= MIN_RATE &&
    r.eurToJpy <= MAX_RATE &&
    typeof r.date === 'string' &&
    (r.source === 'referencia' || r.source === 'bce' || r.source === 'manual') &&
    (r.fetchedAt === null || typeof r.fetchedAt === 'number')
  );
}

export function loadRate(): FxRate {
  try {
    const raw = localStorage.getItem(FX_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isRate(parsed)) return parsed;
    }
  } catch {
    // Sin almacenamiento o dato dañado: se usa la cotización de referencia.
  }
  return DEFAULT_RATE;
}

export function saveRate(rate: FxRate): void {
  try {
    localStorage.setItem(FX_KEY, JSON.stringify(rate));
  } catch {
    // La cotización seguirá en memoria durante esta sesión.
  }
}

export function validateRate(value: number): string | null {
  if (!Number.isFinite(value)) return 'Escribe la cotización como número (p. ej. 177,3).';
  if (value < MIN_RATE || value > MAX_RATE) return `La cotización debe estar entre ${MIN_RATE} y ${MAX_RATE} yenes por euro.`;
  return null;
}

/** Descarga la cotización del BCE. Lanza un error con el motivo si no se puede. */
export async function fetchBceRate(now: number = Date.now(), signal?: AbortSignal): Promise<FxRate> {
  let res: Response;
  try {
    res = await fetch(FX_ENDPOINT, { signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new Error('No se pudo conectar para actualizar la cotización.');
  }
  if (!res.ok) throw new Error(`El servicio de cotizaciones respondió con el error ${res.status}.`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error('El servicio de cotizaciones devolvió una respuesta no válida.');
  }
  const b = body as { date?: unknown; rates?: { JPY?: unknown } };
  const jpy = b.rates?.JPY;
  if (typeof jpy !== 'number' || validateRate(jpy) !== null || typeof b.date !== 'string')
    throw new Error('La cotización recibida no es válida.');
  return { eurToJpy: jpy, date: b.date, source: 'bce', fetchedAt: now };
}

export function needsRefresh(rate: FxRate, now: number = Date.now()): boolean {
  if (rate.source === 'manual') return false;
  return rate.fetchedAt === null || now - rate.fetchedAt > FX_MAX_AGE_MS;
}

export function manualRate(eurToJpy: number, now: number = Date.now()): FxRate {
  const d = new Date(now);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { eurToJpy, date, source: 'manual', fetchedAt: now };
}
