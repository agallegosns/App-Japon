import { RefreshCw } from 'lucide-react';
import type { FxRate } from '../models/currency';
import { formatDateShort } from '../models/datetime';

const SOURCE: Record<FxRate['source'], string> = {
  referencia: 'de referencia (sin actualizar)',
  bce: 'BCE',
  manual: 'escrita por ti',
};

/** Texto con la cotización en uso: «1 € = 177,32 ¥ · BCE · 12 oct». */
export function rateText(rate: FxRate): string {
  const yen = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate.eurToJpy);
  return `1 € = ${yen} ¥ · ${SOURCE[rate.source]} · ${formatDateShort(rate.date)}`;
}

export function RateLine({ rate, refreshing, onRefresh }: { rate: FxRate; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <p className="rate-line small muted">
      {rateText(rate)}
      {onRefresh && (
        <button type="button" className="rate-refresh" onClick={onRefresh} disabled={refreshing} aria-label="Actualizar la cotización">
          <RefreshCw size={14} className={refreshing ? 'spin' : undefined} aria-hidden="true" />
        </button>
      )}
    </p>
  );
}
