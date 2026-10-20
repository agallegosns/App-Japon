import { diffDays } from './datetime';
import { convert, type FxRate } from './currency';
import type { BookingTax, LocalDateTime, Money } from './types';

/** Noches entre el check-in y el check-out (0 si falta alguno). */
export function nightsBetween(checkIn: LocalDateTime | null, checkOut: LocalDateTime | null): number {
  if (!checkIn || !checkOut) return 0;
  const n = diffDays(checkIn.date, checkOut.date);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Importe total de una tasa: fijo, o multiplicado por personas y noches. */
export function taxTotal(tax: BookingTax, guests: number, nights: number): number {
  return tax.basis === 'persona_noche' ? tax.amount * guests * nights : tax.amount;
}

export function sumByCurrency(items: { amount: number; currency: string }[]): Money[] {
  const totals = new Map<string, number>();
  for (const i of items) totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.amount);
  return [...totals.entries()].map(([currency, amount]) => ({ amount, currency }));
}

export interface TaxSummary {
  total: Money[];
  pending: Money[];
}

export function summarizeTaxes(taxes: BookingTax[], guests: number, nights: number): TaxSummary {
  const rows = taxes.map((t) => ({ amount: taxTotal(t, guests, nights), currency: t.currency, paid: t.paid }));
  return { total: sumByCurrency(rows), pending: sumByCurrency(rows.filter((r) => !r.paid)) };
}

/** Suma de importes en una sola moneda (null si alguno no se puede convertir). */
export function totalIn(items: Money[], target: string, rate: FxRate): number | null {
  let sum = 0;
  for (const m of items) {
    const v = convert(m.amount, m.currency, target, rate);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}
