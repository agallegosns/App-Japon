import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { amountToText, parseAmount } from '../../models/currency';
import { setManualRate, useFxRate } from '../../storage/useFxRate';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/Field';
import { ConverterPanel } from './ConverterPanel';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { RateLine } from '../../ui/Rate';

/** Conversor yenes ↔ euros: escribes en un campo y el otro se calcula. Funciona sin conexión con la última cotización. */
export function ConverterPage() {
  const { rate, refreshing, error, refresh } = useFxRate();
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Yenes y euros" subtitle="Conversor" back="/" noConverter />
      <Card>
        <ConverterPanel />
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
                  if (!err) setManual('');
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
