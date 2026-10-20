import { describe, expect, it } from 'vitest';
import { mergeBlocks, scoreBlocks, sortBlocks, type OcrBlock } from './ocr';
import { japaneseCharCount } from './textUtils';

const block = (text: string, x0: number, y0: number, x1: number, y1: number, confidence = 80): OcrBlock => ({
  text,
  bbox: { x0, y0, x1, y1 },
  confidence,
});

describe('lectura del japonés (utilidades)', () => {
  it('cuenta solo kana y kanji', () => {
    expect(japaneseCharCount('お手洗い Restroom 12')).toBe(4);
    expect(japaneseCharCount('ABC 123')).toBe(0);
  });

  it('puntúa por caracteres japoneses y confianza', () => {
    expect(scoreBlocks([block('お手洗い', 0, 0, 10, 10, 100)])).toBe(4);
    expect(scoreBlocks([block('お手洗い', 0, 0, 10, 10, 50)])).toBe(2);
    expect(scoreBlocks([])).toBe(0);
  });

  it('suma los bloques que no se solapan (pasada normal + invertida)', () => {
    const normal = [block('メニュー', 0, 0, 100, 20)];
    const inverted = [block('出口案内', 0, 100, 100, 120)];
    expect(mergeBlocks(normal, inverted, true).map((b) => b.text)).toEqual(['メニュー', '出口案内']);
  });

  it('si dos bloques ocupan el mismo sitio se queda el mejor', () => {
    const a = [block('ラ', 0, 0, 100, 20, 60)];
    const b = [block('ラーメン', 5, 2, 105, 22, 80)];
    expect(mergeBlocks(a, b, false).map((x) => x.text)).toEqual(['ラーメン']);
  });

  it('en pasadas posteriores descarta el ruido (poca confianza o un solo carácter)', () => {
    const base = [block('お手洗い', 0, 0, 100, 20)];
    const noise = [block('る', 0, 100, 20, 120, 90), block('出口案内', 0, 200, 100, 220, 30)];
    expect(mergeBlocks(base, noise, true)).toHaveLength(1);
  });

  it('ordena de arriba abajo en horizontal y de derecha a izquierda en vertical', () => {
    const list = [block('segundo', 0, 50, 10, 60), block('primero', 0, 0, 10, 10)];
    expect(sortBlocks(list, 'horizontal').map((b) => b.text)).toEqual(['primero', 'segundo']);
    const vert = [block('izquierda', 10, 0, 20, 100), block('derecha', 80, 0, 90, 100)];
    expect(sortBlocks(vert, 'vertical').map((b) => b.text)).toEqual(['derecha', 'izquierda']);
  });
});
