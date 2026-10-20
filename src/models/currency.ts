import type { Money } from './types';

/** Solo se convierten euros y yenes: el viaje es España → Japón. */
export type Currency = 'EUR' | 'JPY';

export interface FxRate {
  /** Yenes por 1 euro. */
  eurToJpy: number;
  /** Fecha (AAAA-MM-DD) de la cotización. */
  date: string;
  /** referencia = incluida en la app; bce = bajada de internet (BCE); manual = escrita por el usuario. */
  source: 'referencia' | 'bce' | 'manual';
  /** Cuándo se descargó (ms) o null si no se ha descargado nunca. */
  fetchedAt: number | null;
}

/**
 * Cotización de referencia incluida en la app (1 € = 177,32 ¥, 12 oct 2026). Es solo un punto de partida:
 * con conexión se sustituye por la del BCE, y se puede escribir a mano la que aplique tu banco.
 */
export const DEFAULT_RATE: FxRate = { eurToJpy: 177.32, date: '2026-10-12', source: 'referencia', fetchedAt: null };

export const MIN_RATE = 50;
export const MAX_RATE = 500;

export function isConvertible(currency: string): currency is Currency {
  return currency === 'EUR' || currency === 'JPY';
}

export function convert(amount: number, from: string, to: string, rate: FxRate): number | null {
  if (!isConvertible(from) || !isConvertible(to) || !Number.isFinite(amount)) return null;
  if (from === to) return amount;
  return from === 'EUR' ? amount * rate.eurToJpy : amount / rate.eurToJpy;
}

/** El mismo importe en la otra moneda (EUR ↔ JPY), o null si no es ni euros ni yenes. */
export function counterpart(money: Money, rate: FxRate): Money | null {
  if (!isConvertible(money.currency)) return null;
  const to: Currency = money.currency === 'EUR' ? 'JPY' : 'EUR';
  const value = convert(money.amount, money.currency, to, rate);
  return value === null ? null : { amount: value, currency: to };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      // En español 1600 se escribe sin punto; en importes de yenes conviene agrupar siempre (1.600 ¥).
      useGrouping: 'always',
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** «≈ 1.234 ¥» o «≈ 6,95 €» con el importe convertido a la otra moneda. */
export function formatCounterpart(money: Money, rate: FxRate): string | null {
  const c = counterpart(money, rate);
  return c ? `≈ ${formatMoney(c.amount, c.currency)}` : null;
}

/**
 * Lee un importe escrito a mano: «12.500», «12 500», «1.234,50», «68,5», «68.5».
 * Devuelve NaN si no es un número válido.
 */
export function parseAmount(text: string): number {
  let t = text.replace(/[\s\u00a0€¥]/g, '');
  if (!t) return NaN;
  if (!/^[0-9.,]+$/.test(t)) return NaN;
  if (t.includes(',')) {
    // La coma es el decimal y los puntos son miles.
    if ((t.match(/,/g) ?? []).length > 1) return NaN;
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  } else if ((t.match(/\./g) ?? []).length > 1) {
    return NaN;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Texto editable de un importe (sin separador de miles; coma decimal). */
export function amountToText(amount: number, currency: string): string {
  const digits = currency === 'JPY' ? 0 : 2;
  const rounded = Number(amount.toFixed(digits));
  return String(rounded).replace('.', ',');
}
