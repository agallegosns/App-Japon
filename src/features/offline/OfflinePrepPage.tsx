import { CheckCircle2, CircleDashed, Clock, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePwaState } from '../../app/pwaState';
import { useOnline } from '../../app/useConnectivity';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { errorMessage } from '../../ui/States';
import {
  checkAppCache,
  checkAttachments,
  checkBackup,
  checkData,
  checkInstalled,
  checkPersistence,
  type CheckResult,
  type CheckStatus,
} from './checks';

interface Item {
  id: string;
  title: string;
  run: (() => Promise<CheckResult>) | null;
  pendingNote?: ReactNode;
}

const ICON: Record<CheckStatus | 'running', ReactNode> = {
  ok: <CheckCircle2 size={22} color="var(--c-success)" aria-label="Correcto" />,
  warning: <AlertTriangle size={22} color="var(--c-warning)" aria-label="Aviso" />,
  error: <XCircle size={22} color="var(--c-danger)" aria-label="Error" />,
  pending: <Clock size={22} color="var(--c-text-muted)" aria-label="Pendiente" />,
  running: <CircleDashed size={22} color="var(--c-text-muted)" aria-label="Comprobando" />,
};

export function OfflinePrepPage() {
  const pwa = usePwaState();
  const online = useOnline();
  const [results, setResults] = useState<Record<string, CheckResult | 'running'>>({});
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const items: Item[] = [
    { id: 'installed', title: 'App instalada en la pantalla de inicio', run: checkInstalled },
    { id: 'cache', title: 'App guardada para funcionar sin conexión', run: () => checkAppCache(pwa.registration) },
    { id: 'data', title: 'Datos del viaje legibles', run: checkData },
    { id: 'attachments', title: 'Adjuntos (PDF, imágenes, QR) legibles', run: checkAttachments },
    { id: 'persist', title: 'Almacenamiento persistente', run: checkPersistence },
    { id: 'backup', title: 'Copia de seguridad reciente', run: checkBackup },
    { id: 'maps', title: 'Mapas sin conexión', run: null, pendingNote: <>Pendiente de fase. <Link to="/lab#mapas">Ver prueba</Link></> },
    { id: 'translation', title: 'Traducción sin conexión', run: null, pendingNote: <>Pendiente de fase. <Link to="/lab#traduccion">Ver prueba</Link></> },
  ];

  const runAll = useCallback(async () => {
    const runnable = items.filter((i) => i.run);
    setResults(Object.fromEntries(runnable.map((i) => [i.id, 'running' as const])));
    for (const item of runnable) {
      let r: CheckResult;
      try {
        r = await item.run!();
      } catch (e) {
        r = { status: 'error', detail: errorMessage(e) };
      }
      setResults((prev) => ({ ...prev, [item.id]: r }));
    }
    setCheckedAt(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las comprobaciones dependen solo del registro del SW
  }, [pwa.registration]);

  useEffect(() => {
    void runAll();
  }, [runAll]);

  const values = Object.values(results);
  const allOk = values.length > 0 && values.every((r) => r !== 'running' && r.status === 'ok');

  return (
    <>
      <PageHeader title="Preparar Japón sin conexión" back="/" />
      <p className="muted">
        Comprobaciones reales hechas ahora en este dispositivo. Repítelas antes de salir y con el modo avión activado.
      </p>
      {!online && <Notice tone="info">Estás sin conexión: es buen momento para comprobar que todo funciona.</Notice>}
      <Card>
        <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0, border: 0 }}>
          {items.map((item) => {
            const r = results[item.id];
            const icon = item.run === null ? ICON.pending : r === undefined || r === 'running' ? ICON.running : ICON[r.status];
            return (
              <li key={item.id} className="list-item list-item-static" style={{ alignItems: 'flex-start' }}>
                <span style={{ marginTop: 2 }}>{icon}</span>
                <span className="grow">
                  <strong>{item.title}</strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    {item.run === null ? item.pendingNote : r === undefined || r === 'running' ? 'Comprobando…' : r.detail}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      {allOk && <Notice tone="success">Todo lo disponible en esta versión está listo para usarse sin conexión.</Notice>}
      <Button block icon={<RefreshCw size={18} />} onClick={() => void runAll()}>
        Comprobar de nuevo
      </Button>
      {checkedAt && <p className="muted small">Última comprobación: {checkedAt.toLocaleTimeString('es-ES')}</p>}
    </>
  );
}
