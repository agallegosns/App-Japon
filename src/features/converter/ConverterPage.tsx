import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { amountToText, convert, formatMoney, parseAmount } from '../../models/currency';
import { setManualRate, useFxRate } from '../../storage/useFxRate';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/Field';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { RateLine } from '../../ui/Rate';

const QUICK_YEN = [500, 1000, 5000, 10000, 50000];

/** Conversor yenes ↔ euros: escribes en un campo y el otro se calcula. Funciona sin conexión con la última cotización. */
export function ConverterPage() {
  const { rate, refreshing, error, refresh } = useFxRate();
  const [yen, setYen] = useState('');
  const [eur, setEur] = useState('');
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

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
    <>
      <PageHeader title="Yenes y euros" subtitle="Conversor" back="/" />
      <Card>
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
        </div>
      </Card>

      <Card title="Cotización">
        <div className="stack">
          <RateLine rate={rate} refreshing={refreshing} />
          {error && <Notice tone="warning">{error} Se sigue usando la última cotización guardada.</Notice>}
          <Button icon={<RefreshCw size={18} className={refreshing ? 'spin' : undefined} />} disabled={refreshing} onClick={() => void refresh()}>
            {refreshing ? 'Actualizando…' : 'Actualizar con la cotización del BCE'}
          </Button>
          <p className="muted small">
            La cotización del BCE es un valor medio de referencia. Tu tarjeta o el cajero aplicarán su propio cambio y comisión, así que el
            importe real puede variar un poco. Si quieres que la app use el cambio que te da tu banco, escríbelo aquí.
          </p>
          <details className="day-more">
            <summary>Escribir mi propia cotización</summary>
            <div className="stack" style={{ marginTop: 'var(--sp-2)' }}>
              <TextField
                label="Yenes por 1 euro"
                inputMode="decimal"
                value={manual}
                onChange={(v) => {
                  setManual(v);
                  setManualError(null);
                }}
                error={manualError ?? undefined}
                placeholder={amountToText(rate.eurToJpy, 'EUR')}
                autoComplete="off"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  const err = setManualRate(parseAmount(manual));
                  setManualError(err);
                  if (!err) {
                    setManual('');
                    fromYen(yen);
                  }
                }}
              >
                Usar esta cotización
              </Button>
              <p className="muted small">Con una cotización escrita por ti, la app deja de actualizarla sola. Para volver al BCE, pulsa «Actualizar».</p>
            </div>
          </details>
        </div>
      </Card>
    </>
  );
}
