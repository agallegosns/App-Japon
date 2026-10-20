/**
 * Cifrado de la sincronización. Todo ocurre en el móvil: el servidor solo recibe datos ya cifrados.
 *
 * - El «código del viaje» son 20 caracteres (100 bits) generados al azar. Es el único secreto y solo lo conocéis vosotros dos.
 * - De ese código salen dos cosas distintas con hashes independientes: el nombre de la «sala» (lo único que ve el servidor,
 *   no permite recuperar el código) y la clave de cifrado AES-GCM de 256 bits (nunca sale del móvil).
 * - Cada registro lleva su propia IV aleatoria y se autentica con su nombre («bookings:id»): el servidor no puede cambiar
 *   el contenido ni intercambiar registros sin que se detecte.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: sin I, L, O, U
export const CODE_LENGTH = 20;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Genera un código nuevo con formato «XXXXX-XXXXX-XXXXX-XXXXX». */
export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let raw = '';
  for (const b of bytes) raw += ALPHABET[b & 31];
  return formatCode(raw);
}

export function formatCode(text: string): string {
  const raw = text.replace(/-/g, '');
  return raw.match(/.{1,5}/g)?.join('-') ?? raw;
}

/**
 * Normaliza lo que escribe la persona: sin guiones ni espacios, en mayúsculas, y confundiendo O→0, I/L→1 como en Crockford.
 * Devuelve null si no es un código válido.
 */
export function parseCode(text: string): string | null {
  const raw = text
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (raw.length !== CODE_LENGTH) return null;
  for (const ch of raw) if (!ALPHABET.includes(ch)) return null;
  return raw;
}

export interface Credentials {
  /** Nombre de la sala (64 caracteres hexadecimales): lo único que conoce el servidor. */
  room: string;
  key: CryptoKey;
}

export async function deriveCredentials(code: string): Promise<Credentials> {
  const raw = parseCode(code);
  if (!raw) throw new Error('El código del viaje no es válido.');
  const material = enc.encode(`nihon-trip|v1|${raw}`);
  const room = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', concat(enc.encode('room|'), material))));
  const base = await crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('nihon-trip-salt-v1'), info: enc.encode('aes-256-gcm') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { room, key };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(a.length + b.length));
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Cifra un objeto. `aad` ata el contenido a su nombre (p. ej. «bookings:abc»). Devuelve texto JSON {v, iv, ct}. */
export async function encryptJson(key: CryptoKey, value: unknown, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(value))));
  return JSON.stringify({ v: 1, iv: toBase64(iv), ct: toBase64(ct) });
}

export async function decryptJson<T = unknown>(key: CryptoKey, payload: string, aad: string): Promise<T> {
  let parsed: { v?: number; iv?: string; ct?: string };
  try {
    parsed = JSON.parse(payload) as typeof parsed;
  } catch {
    throw new Error('Dato cifrado dañado.');
  }
  if (parsed.v !== 1 || typeof parsed.iv !== 'string' || typeof parsed.ct !== 'string') throw new Error('Dato cifrado no reconocido.');
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(parsed.iv), additionalData: enc.encode(aad) },
      key,
      fromBase64(parsed.ct),
    );
    return JSON.parse(dec.decode(plain)) as T;
  } catch {
    throw new Error('No se pudo descifrar: el código no coincide o el dato fue alterado.');
  }
}

/** Cifra un archivo: IV (12 bytes) seguida del contenido cifrado. */
export async function encryptBytes(key: CryptoKey, bytes: ArrayBuffer, aad: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, bytes));
  return concat(iv, ct);
}

export async function decryptBytes(key: CryptoKey, payload: ArrayBuffer, aad: string): Promise<ArrayBuffer> {
  if (payload.byteLength < 13) throw new Error('Archivo cifrado dañado.');
  const data = new Uint8Array(payload);
  try {
    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12), additionalData: enc.encode(aad) }, key, data.slice(12));
  } catch {
    throw new Error('No se pudo descifrar el archivo: el código no coincide o fue alterado.');
  }
}
