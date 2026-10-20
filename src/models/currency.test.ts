import { describe, expect, it } from 'vitest';
import { amountToText, convert, counterpart, DEFAULT_RATE, formatCounterpart, formatMoney, isConvertible, parseAmount, type FxRate } from './currency';

const rate: FxRate = { eurToJpy: 160, date: '2030-01-01', source: 'manual', fetchedAt: null };

describe('conversión yenes ↔ euros', () => {
  it('convierte en los dos sentidos con la cotización indicada', () => {
    expect(convert(100, 'EUR', 'JPY', rate)).toBe(16000);
    expect(convert(16000, 'JPY', 'EUR', rate)).toBe(100);
    expect(convert(50, 'EUR', 'EUR', rate)).toBe(50);
  });

  it('ida y vuelta devuelve el mismo importe', () => {
    const yen = convert(12345.67, 'EUR', 'JPY', DEFAULT_RATE)!;
    expect(convert(yen, 'JPY', 'EUR', DEFAULT_RATE)!).toBeCloseTo(12345.67, 8);
  });

  it('no convierte otras monedas ni importes no válidos', () => {
    expect(convert(10, 'USD', 'EUR', rate)).toBeNull();
    expect(convert(Number.NaN, 'EUR', 'JPY', rate)).toBeNull();
    expect(counterpart({ amount: 5, currency: 'GBP' }, rate)).toBeNull();
    expect(isConvertible('JPY')).toBe(true);
    expect(isConvertible('USD')).toBe(false);
  });

  it('da la otra moneda: yenes → euros y euros → yenes', () => {
    expect(counterpart({ amount: 8000, currency: 'JPY' }, rate)).toEqual({ amount: 50, currency: 'EUR' });
    expect(counterpart({ amount: 50, currency: 'EUR' }, rate)).toEqual({ amount: 8000, currency: 'JPY' });
  });

  it('da formato a los importes (yenes sin decimales, euros con dos)', () => {
    expect(formatMoney(12000, 'JPY').replace(/\s/g, ' ')).toBe('12.000 ¥');
    expect(formatMoney(68.5, 'EUR').replace(/\s/g, ' ')).toBe('68,50 €');
    expect(formatCounterpart({ amount: 8000, currency: 'JPY' }, rate)?.replace(/\s/g, ' ')).toBe('≈ 50,00 €');
    expect(formatCounterpart({ amount: 10, currency: 'EUR' }, rate)?.replace(/\s/g, ' ')).toBe('≈ 1.600 ¥');
    expect(formatCounterpart({ amount: 10, currency: 'USD' }, rate)).toBeNull();
  });

  it('lee importes escritos a mano', () => {
    expect(parseAmount('12.500')).toBe(12500);
    expect(parseAmount('12 500')).toBe(12500);
    expect(parseAmount('1.234,50')).toBe(1234.5);
    expect(parseAmount('68,5')).toBe(68.5);
    expect(parseAmount('68.5')).toBe(68.5);
    expect(parseAmount('¥ 3.000')).toBe(3000);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('1,2,3')).toBeNaN();
  });

  it('escribe importes para los campos de texto', () => {
    expect(amountToText(68.5, 'EUR')).toBe('68,5');
    expect(amountToText(12000.4, 'JPY')).toBe('12000');
    expect(amountToText(0.005, 'EUR')).toBe('0,01');
  });
});
