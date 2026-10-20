import { ChevronRight, FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isStandalone } from '../../app/standalone';
import { formatBytes, getStorageInfo, type StorageInfo } from '../../storage/persistence';
import { Card } from '../../ui/Card';
import { PageHeader } from '../../ui/PageHeader';
import { errorMessage } from '../../ui/States';
import { StatusTag } from '../../ui/StatusTag';

export function SettingsPage() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getStorageInfo()
      .then(setInfo)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);
  return (
    <>
      <PageHeader title="Ajustes" back="/" />
      <Card title="Almacenamiento">
        <div className="stack">
          <div className="spread">
            <span>App instalada</span>
            {isStandalone() ? <StatusTag tone="success">Sí</StatusTag> : <StatusTag tone="warning">No (abierta en Safari)</StatusTag>}
          </div>
          <div className="spread">
            <span>Almacenamiento persistente</span>
            {error ? <StatusTag tone="danger">{error}</StatusTag> : info === null ? <StatusTag>…</StatusTag> : info.persisted ? <StatusTag tone="success">Concedido</StatusTag> : <StatusTag tone="warning">No concedido</StatusTag>}
          </div>
          <div className="spread">
            <span>Espacio usado</span>
            <span>{info ? `${formatBytes(info.usage)} de ${formatBytes(info.quota)}` : '…'}</span>
          </div>
        </div>
      </Card>
      <Card title="Herramientas">
        <Link to="/lab" className="list-item" style={{ borderTop: 0 }}>
          <FlaskConical size={20} aria-hidden="true" />
          <span className="grow">Laboratorio de viabilidad</span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </Card>
      <Card title="Aplicación">
        <p className="muted small">
          Versión {__APP_VERSION__} ({__COMMIT__})
        </p>
      </Card>
    </>
  );
}
