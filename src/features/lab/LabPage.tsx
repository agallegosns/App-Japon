import { ClipboardCopy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { copyText } from '../../ui/copy';
import { errorMessage } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { CameraLab } from './CameraLab';
import { deviceInfoLines } from './deviceInfo';
import { GpsLab } from './GpsLab';
import { MapLab } from './MapLab';
import { OcrLab } from './OcrLab';
import { OnlineLab } from './OnlineLab';
import { LabReportProvider, STATUS_TEXT, useLabReport } from './report';
import { StorageLab } from './StorageLab';

export default function LabPage() {
  return (
    <LabReportProvider>
      <Lab />
    </LabReportProvider>
  );
}

function Lab() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <>
      <PageHeader title="Laboratorio de viabilidad" subtitle="Pruebas reales en este dispositivo" back="/ajustes" />
      <Notice tone="info">
        Cada prueba se marca como VERIFICADO solo si se ha comprobado de verdad; si falla, verás el error real. Haz las
        pruebas con la app instalada y repítelas en modo avión.
      </Notice>
      <ReportButton />
      <StorageLab />
      <OcrLab />
      <MapLab />
      <GpsLab />
      <CameraLab />
      <OnlineLab />
      <ReportButton />
    </>
  );
}

function ReportButton() {
  const { results } = useLabReport();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      block
      icon={<ClipboardCopy size={18} />}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const device = await deviceInfoLines();
          const entries = Object.values(results).sort((a, b) => a.at - b.at);
          const body = entries.length
            ? entries.map((r) => `## ${r.title}: ${STATUS_TEXT[r.status]}\n${r.lines.join('\n')}`).join('\n\n')
            : '(No se ha ejecutado ninguna prueba en esta sesión)';
          await copyText(`# Informe del laboratorio — Nihon Trip\n\n${device.join('\n')}\n\n${body}\n`);
          toast.show('Informe copiado');
        } catch (e) {
          toast.error(`No se pudo copiar: ${errorMessage(e)}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      Copiar informe
    </Button>
  );
}
