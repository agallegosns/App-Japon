import { chunkText } from './textUtils';

/**
 * Traducción japonés → español con MyMemory (https://mymemory.translated.net).
 * - Gratuito, sin cuenta ni clave, con CORS (se puede llamar desde la app).
 * - Límite: 5 000 caracteres/día por IP; 50 000/día si se indica un email (parámetro `de`).
 * - Solo se envía el TEXTO reconocido; las fotos no salen del dispositivo.
 * - Necesita conexión. Si se cambia de proveedor, solo hay que tocar este archivo.
 */
export const TRANSLATE_ENDPOINT = 'https://api.mymemory.translated.net/get';
export const EMAIL_KEY = 'nihon.translate.email';

export class TranslateError extends Error {
  constructor(
    message: string,
    public readonly kind: 'offline' | 'quota' | 'network' | 'service',
  ) {
    super(message);
    this.name = 'TranslateError';
  }
}

export function getStoredEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeEmail(email: string): void {
  try {
    if (email.trim()) localStorage.setItem(EMAIL_KEY, email.trim());
    else localStorage.removeItem(EMAIL_KEY);
  } catch {
    // Sin almacenamiento disponible: la app sigue funcionando sin guardar el email.
  }
}

export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.documentElement.textContent ?? text;
}

interface MyMemoryResponse {
  responseData?: { translatedText?: string };
  responseStatus?: number | string;
  responseDetails?: string;
  quotaFinished?: boolean;
}

async function translateChunk(text: string, email: string, signal?: AbortSignal): Promise<string> {
  const params = new URLSearchParams({ q: text, langpair: 'ja|es' });
  if (email) params.set('de', email);
  let res: Response;
  try {
    res = await fetch(`${TRANSLATE_ENDPOINT}?${params.toString()}`, { signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new TranslateError('No se pudo conectar con el servicio de traducción.', 'network');
  }
  if (res.status === 429) throw new TranslateError('Se ha agotado el límite diario de traducciones gratuitas.', 'quota');
  if (!res.ok) throw new TranslateError(`El servicio de traducción respondió con el error ${res.status}.`, 'service');
  let body: MyMemoryResponse;
  try {
    body = (await res.json()) as MyMemoryResponse;
  } catch {
    throw new TranslateError('El servicio de traducción devolvió una respuesta no válida.', 'service');
  }
  const translated = body.responseData?.translatedText ?? '';
  const status = Number(body.responseStatus ?? 200);
  if (body.quotaFinished || status === 429 || translated.toUpperCase().startsWith('MYMEMORY WARNING'))
    throw new TranslateError('Se ha agotado el límite diario de traducciones gratuitas.', 'quota');
  if (status !== 200 || !translated)
    throw new TranslateError(body.responseDetails || 'El servicio no devolvió ninguna traducción.', 'service');
  return decodeEntities(translated);
}

/** Traduce un texto (lo parte en trozos de ≤ 450 bytes si hace falta). */
export async function translateJaToEs(text: string, opts: { email?: string; signal?: AbortSignal } = {}): Promise<string> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw new TranslateError('Sin conexión en este momento.', 'offline');
  const parts: string[] = [];
  for (const chunk of chunkText(text)) parts.push(await translateChunk(chunk, opts.email ?? '', opts.signal));
  return parts.join(' ').trim();
}
