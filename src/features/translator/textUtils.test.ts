import { describe, expect, it } from 'vitest';
import { chunkText, cleanJapanese, fitFontSize, hasJapanese, utf8Bytes, wrapWords } from './textUtils';

describe('textos del traductor', () => {
  it('quita los espacios que Tesseract mete entre caracteres japoneses', () => {
    expect(cleanJapanese('お 会 計 は こ ち ら')).toBe('お会計はこちら');
    expect(cleanJapanese('東京 駅\n\n ラーメン 　 500円')).toBe('東京駅\nラーメン 500円');
  });

  it('conserva un único espacio junto a letras y números latinos', () => {
    expect(cleanJapanese('JR 東日本')).toBe('JR 東日本');
    expect(cleanJapanese('Hello world')).toBe('Hello world');
  });

  it('detecta si hay texto japonés', () => {
    expect(hasJapanese('こんにちは')).toBe(true);
    expect(hasJapanese('駅')).toBe(true);
    expect(hasJapanese('Hello 123')).toBe(false);
    expect(hasJapanese('')).toBe(false);
  });

  it('parte textos largos en trozos de ≤ 450 bytes sin cortar caracteres', () => {
    const long = 'これはテストです。'.repeat(80);
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => utf8Bytes(c) <= 450)).toBe(true);
    expect(chunks.join('')).toBe(long);
  });

  it('parte también un texto largo sin signos de puntuación', () => {
    const long = '駅'.repeat(500);
    const chunks = chunkText(long);
    expect(chunks.every((c) => utf8Bytes(c) <= 450)).toBe(true);
    expect(chunks.join('')).toBe(long);
  });

  it('un texto corto es un solo trozo', () => {
    expect(chunkText('お会計をお願いします。')).toEqual(['お会計をお願いします。']);
  });

  it('reparte el texto en líneas según el ancho', () => {
    const measure = (t: string) => t.length * 10;
    expect(wrapWords('uno dos tres cuatro', 100, measure)).toEqual(['uno dos', 'tres', 'cuatro']);
    expect(wrapWords('palabralarguísima', 50, measure)).toEqual(['palabralarguísima']);
  });

  it('elige el mayor tamaño de letra con el que cabe', () => {
    const measureAt = (px: number, t: string) => t.length * px * 0.5;
    const fit = fitFontSize('Los aseos están al fondo a la derecha', { width: 200, height: 60 }, measureAt, { min: 10, max: 30 });
    expect(fit.fontPx).toBeGreaterThanOrEqual(10);
    expect(fit.fontPx).toBeLessThanOrEqual(30);
    expect(fit.lines.length * fit.fontPx * 1.15).toBeLessThanOrEqual(60);
    expect(fit.lines.join(' ')).toBe('Los aseos están al fondo a la derecha');
  });
});
