import { describe, expect, it } from 'vitest';
import type { FxRate } from './currency';
import { nightsBetween, summarizeTaxes, taxTotal, totalIn } from './taxes';
import type { BookingTax } from './types';

const rate: FxRate = { eurToJpy: 160, date: '2030-01-01', source: 'manual', fetchedAt: null };
const tax = (patch: Partial<BookingTax>): BookingTax => ({ id: 't', name: 'Tasa', amount: 200, currency: 'JPY', basis: 'persona_noche', paid: false, ...patch });
const ldt = (date: string) => ({ date, time: null, tz: 'Asia/Tokyo' });

describe('tasas de alojamiento', () => {
  it('cuenta las noches entre check-in y check-out', () => {
    expect(nightsBetween(ldt('2030-05-02'), ldt('2030-05-05'))).toBe(3);
    expect(nightsBetween(ldt('2030-05-02'), null)).toBe(0);
    expect(nightsBetween(ldt('2030-05-05'), ldt('2030-05-02'))).toBe(0);
  });

  it('calcula la tasa por persona y noche o el importe total', () => {
    expect(taxTotal(tax({}), 2, 3)).toBe(1200); // 200 × 2 personas × 3 noches
    expect(taxTotal(tax({ basis: 'total', amount: 1500 }), 2, 3)).toBe(1500);
  });

  it('suma por moneda y separa lo pendiente de lo pagado', () => {
    const s = summarizeTaxes([tax({}), tax({ id: 'b', basis: 'total', amount: 10, currency: 'EUR', paid: true })], 2, 3);
    expect(s.total).toEqual([{ amount: 1200, currency: 'JPY' }, { amount: 10, currency: 'EUR' }]);
    expect(s.pending).toEqual([{ amount: 1200, currency: 'JPY' }]);
  });

  it('suma importes de varias monedas en una sola', () => {
    expect(totalIn([{ amount: 1600, currency: 'JPY' }, { amount: 10, currency: 'EUR' }], 'EUR', rate)).toBe(20);
    expect(totalIn([{ amount: 1, currency: 'USD' }], 'EUR', rate)).toBeNull();
    expect(totalIn([], 'EUR', rate)).toBe(0);
  });
});
