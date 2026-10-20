import { useState } from 'react';
import { probeNetwork, useOnline } from '../../app/useConnectivity';
import { Button } from '../../ui/Button';
import { errorMessage } from '../../ui/States';
import { LabSection } from './LabSection';
import { useLabReport } from './report';

export function OnlineLab() {
  const online = useOnline();
  const { report } = useLabReport();
  const [busy, setBusy] = useState(false);
  return (
    <LabSection
      ids={['online']}
      anchor="conexion"
      title="g) Conexión"
      description="El indicador cambia solo al activar o desactivar el modo avión. La comprobación real pide un archivo al servidor saltándose la caché."
    >
      <div className="spread">
        <span>navigator.onLine</span>
        <span className={`offline-pill${online ? '' : ' is-offline'}`}>
          <span className="dot" aria-hidden="true" />
          {online ? 'En línea' : 'Sin conexión'}
        </span>
      </div>
      <Button
        block
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const lines = [`navigator.onLine: ${navigator.onLine}`];
          try {
            const ms = await probeNetwork();
            lines.push(`Servidor alcanzable en ${ms} ms.`);
            report('online', { title: 'Conexión', status: 'ok', lines: [...lines, 'Indicador coherente con la red real: ' + (navigator.onLine ? 'sí' : 'no')] });
          } catch (e) {
            lines.push(`Servidor NO alcanzable: ${errorMessage(e)}`);
            report('online', {
              title: 'Conexión',
              status: navigator.onLine ? 'fail' : 'ok',
              lines: [...lines, navigator.onLine ? 'El indicador dice "en línea" pero no hay red.' : 'Sin red y el indicador lo refleja correctamente.'],
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        Comprobar red real
      </Button>
    </LabSection>
  );
}
