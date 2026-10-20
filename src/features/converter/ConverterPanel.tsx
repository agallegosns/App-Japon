import { useState } from 'react';
import { amountToText, convert, formatMoney, parseAmount } from '../../models/currency';
import { useFxRate } from '../../storage/useFxRate';
import { TextField } from '../../ui/Field';
import { RateLine } from '../../ui/Rate';

const QUICK_YEN = [500, 1000, 5000, 10000, 50000];

/** Los dos campos del conversor (yenes y euros) con importes rápidos. Lo usan la pantalla y la hoja rápida del menú. */
export function ConverterPanel({ showRate = false }: { showRate?: boolean }) {
  const { rate, refreshing, refresh } = useFxRate();
  const [yen, setYen] = useState('');
  const [eur, setEur] = useState('');

  const fromYen = (text: string) => {
    setYen(text);
    const n = parseAmount(text);
    setEur(Number.isNaN(n) ? '' : amountToText(convert(n, 'JPY', 'EUR', rate) ?? 0, 'EUR'));
  };
  const fromEur = (text: string) => {
    setEur(text);
    const n = parseAmount(text);
    setYen(Number.isNaN(n) ? '' : amountToText(convert(n, 'EUR', 'JPY', rate) ?? 0, 'JPY'));
  };

  const yenValue = parseAmount(yen);
  const eurValue = parseAmount(eur);

  return (
    <div className="stack">
      <TextField label="Yenes (¥)" inputMode="decimal" value={yen} onChange={fromYen} placeholder="0" autoComplete="off" />
      <TextField label="Euros (€)" inputMode="decimal" value={eur} onChange={fromEur} placeholder="0,00" autoComplete="off" />
      {!Number.isNaN(yenValue) && !Number.isNaN(eurValue) && (
        <p className="converter-result" aria-live="polite">
          {formatMoney(yenValue, 'JPY')} = {formatMoney(eurValue, 'EUR')}
        </p>
      )}
      <div className="chips" role="group" aria-label="Importes rápidos en yenes">
        {QUICK_YEN.map((v) => (
          <button key={v} type="button" className="chip" onClick={() => fromYen(String(v))}>
            {formatMoney(v, 'JPY')}
          </button>
        ))}
      </div>
      {showRate && <RateLine rate={rate} refreshing={refreshing} onRefresh={() => void refresh()} />}
    </div>
  );
}
