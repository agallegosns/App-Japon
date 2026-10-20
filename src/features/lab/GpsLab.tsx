import { useState } from 'react';
import { Button } from '../../ui/Button';
import { LabSection } from './LabSection';
import { formatMs, useLabReport } from './report';

const GEO_ERRORS: Record<number, string> = { 1: 'Permiso denegado', 2: 'Posición no disponible', 3: 'Tiempo agotado' };

export function GpsLab() {
  const { report } = useLabReport();
  const [busy, setBusy] = useState(false);
  return (
    <LabSection
      ids={['gps']}
      anchor="gps"
      title="e) GPS"
      description="Pide permiso de ubicación solo al pulsar. Funciona también en modo avión (el GPS no necesita datos), aunque puede tardar más."
    >
      <Button
        variant="primary"
        block
        disabled={busy}
        onClick={async () => {
          if (!('geolocation' in navigator)) {
            report('gps', { title: 'GPS', status: 'fail', lines: ['navigator.geolocation no existe.'] });
            return;
          }
          setBusy(true);
          const lines: string[] = [];
          try {
            const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName }).catch(() => null);
            if (perm) lines.push(`Permiso previo: ${perm.state}`);
          } catch {
            lines.push('Permissions API no disponible');
          }
          const t0 = performance.now();
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const c = pos.coords;
              report('gps', {
                title: 'GPS',
                status: 'ok',
                lines: [
                  ...lines,
                  `Posición: ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`,
                  `Precisión: ±${Math.round(c.accuracy)} m${c.altitude !== null ? `; altitud ${Math.round(c.altitude)} m` : ''}`,
                  `Tiempo: ${formatMs(performance.now() - t0)}; conexión: ${navigator.onLine ? 'sí' : 'no'}`,
                ],
              });
              setBusy(false);
            },
            (err) => {
              report('gps', { title: 'GPS', status: 'fail', lines: [...lines, `ERROR ${err.code} (${GEO_ERRORS[err.code] ?? 'desconocido'}): ${err.message}`] });
              setBusy(false);
            },
            { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 },
          );
        }}
      >
        {busy ? 'Buscando posición…' : 'Obtener mi posición'}
      </Button>
    </LabSection>
  );
}
