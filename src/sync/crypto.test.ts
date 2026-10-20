// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CODE_LENGTH, decryptBytes, decryptJson, deriveCredentials, encryptBytes, encryptJson, formatCode, generateCode, parseCode } from './crypto';

describe('código del viaje', () => {
  it('se genera con 20 caracteres en grupos de 5 y es distinto cada vez', () => {
    const a = generateCode();
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
    expect(parseCode(a)).toHaveLength(CODE_LENGTH);
    const many = new Set(Array.from({ length: 200 }, generateCode));
    expect(many.size).toBe(200);
  });

  it('acepta minúsculas, espacios, guiones y confusiones típicas (O/0, I/L/1)', () => {
    const code = 'ABCDE-12345-FGHJK-MNPQR';
    expect(parseCode(code)).toBe('ABCDE12345FGHJKMNPQR');
    expect(parseCode('abcde 12345 fghjk mnpqr')).toBe('ABCDE12345FGHJKMNPQR');
    expect(parseCode('ABCDE-I2345-FGHJK-MNPQR')).toBe('ABCDE12345FGHJKMNPQR');
    expect(parseCode('ABCDE-l2345-FGHJK-MNPQR')).toBe('ABCDE12345FGHJKMNPQR');
    expect(parseCode('ABCDE-O2345-FGHJK-MNPQR')).toBe('ABCDE02345FGHJKMNPQR');
    expect(formatCode('ABCDE12345FGHJKMNPQR')).toBe(code);
    expect(formatCode(code)).toBe(code); // si ya trae guiones, no se estropea
  });

  it('rechaza códigos incompletos o con caracteres que no existen', () => {
    expect(parseCode('')).toBeNull();
    expect(parseCode('ABCDE-12345')).toBeNull();
    expect(parseCode('ABCDE-12345-FGHJK-MNPQRS')).toBeNull();
    expect(parseCode('ABCDE-12345-FGHJK-MNPQ!')).toBeNull();
    expect(parseCode('ABCDE-12345-FGHJK-MNPQU')).toBeNull();
  });
});

describe('claves derivadas del código', () => {
  it('el mismo código da siempre la misma sala y los dos móviles se entienden', async () => {
    const code = generateCode();
    const a = await deriveCredentials(code);
    const b = await deriveCredentials(code.toLowerCase().replace(/-/g, ' '));
    expect(a.room).toMatch(/^[a-f0-9]{64}$/);
    expect(b.room).toBe(a.room);
    const payload = await encryptJson(a.key, { hola: 'mundo' }, 'bookings:x');
    expect(await decryptJson(b.key, payload, 'bookings:x')).toEqual({ hola: 'mundo' });
  });

  it('códigos distintos dan salas y claves distintas', async () => {
    const a = await deriveCredentials(generateCode());
    const b = await deriveCredentials(generateCode());
    expect(a.room).not.toBe(b.room);
    const payload = await encryptJson(a.key, { secreto: 1 }, 'trips:t');
    await expect(decryptJson(b.key, payload, 'trips:t')).rejects.toThrow(/No se pudo descifrar/);
  });

  it('el nombre de la sala no contiene el código ni permite deducirlo', async () => {
    const code = generateCode();
    const raw = parseCode(code)!;
    const { room } = await deriveCredentials(code);
    expect(room.toUpperCase()).not.toContain(raw);
    expect(room).toHaveLength(64);
  });

  it('un código no válido da error', async () => {
    await expect(deriveCredentials('corto')).rejects.toThrow(/no es válido/);
  });
});

describe('cifrado de registros y archivos', () => {
  it('cada cifrado es distinto aunque el contenido sea igual y no deja ver el texto', async () => {
    const { key } = await deriveCredentials(generateCode());
    const a = await encryptJson(key, { name: 'Hotel Granbell' }, 'bookings:1');
    const b = await encryptJson(key, { name: 'Hotel Granbell' }, 'bookings:1');
    expect(a).not.toBe(b);
    expect(a).not.toContain('Granbell');
  });

  it('detecta cualquier alteración o cambio de nombre del registro', async () => {
    const { key } = await deriveCredentials(generateCode());
    const payload = await encryptJson(key, { precio: 100 }, 'bookings:1');
    await expect(decryptJson(key, payload, 'bookings:2')).rejects.toThrow(/alterado/);
    const parsed = JSON.parse(payload) as { ct: string };
    const flipped = JSON.stringify({ ...parsed, ct: (parsed.ct[0] === 'A' ? 'B' : 'A') + parsed.ct.slice(1) });
    await expect(decryptJson(key, flipped, 'bookings:1')).rejects.toThrow(/alterado/);
    await expect(decryptJson(key, 'no es json', 'bookings:1')).rejects.toThrow(/dañado/);
    await expect(decryptJson(key, '{"v":9}', 'bookings:1')).rejects.toThrow(/no reconocido/);
  });

  it('los archivos se cifran y descifran sin perder ni un byte', async () => {
    const { key } = await deriveCredentials(generateCode());
    const original = new Uint8Array(5000).map((_, i) => i % 251);
    const sealed = await encryptBytes(key, original.buffer, 'blob:a1');
    expect(sealed.length).toBe(original.length + 12 + 16);
    const back = new Uint8Array(await decryptBytes(key, sealed.buffer.slice(sealed.byteOffset, sealed.byteOffset + sealed.byteLength) as ArrayBuffer, 'blob:a1'));
    expect(back).toEqual(original);
    await expect(decryptBytes(key, sealed.buffer.slice(0) as ArrayBuffer, 'blob:otro')).rejects.toThrow(/alterado/);
    await expect(decryptBytes(key, new ArrayBuffer(5), 'blob:a1')).rejects.toThrow(/dañado/);
  });
});
