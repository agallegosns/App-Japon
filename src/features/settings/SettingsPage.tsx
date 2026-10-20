import {
  ChevronRight,
  CloudDownload,
  Download,
  FlaskConical,
  HardDrive,
  RefreshCw,
  Share,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePwaState } from '../../app/pwaState';
import { isStandalone } from '../../app/standalone';
import { formatTimestamp } from '../../models/datetime';
import { hasAnyData, useAppData } from '../../storage/appData';
import { deleteAllData, importBackup, parseBackup, type ImportMode, type ParsedBackup } from '../../storage/backup';
import { getDb } from '../../storage/db';
import { backupReminder } from '../../storage/meta';
import { formatBytes, getStorageInfo, requestPersistence, type StorageInfo } from '../../storage/persistence';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { errorMessage } from '../../ui/States';
import { StatusTag } from '../../ui/StatusTag';
import { useToast } from '../../ui/Toast';
import { exportAndShare } from './backupActions';

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" back="/" />
      <BackupCard />
      <ImportCard />
      <StorageCard />
      <Card title="Herramientas">
        <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <li>
            <Link to="/sin-conexion" className="list-item">
              <CloudDownload size={20} aria-hidden="true" />
              <span className="grow">Preparar Japón sin conexión</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
          <li>
            <Link to="/lab" className="list-item">
              <FlaskConical size={20} aria-hidden="true" />
              <span className="grow">Laboratorio de viabilidad</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </Card>
      <AppCard />
      <DangerCard />
    </>
  );
}

function BackupCard() {
  const result = useAppData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = result.status === 'ok' ? result.data : null;
  const reminder = data ? backupReminder(data.backup, hasAnyData(data)) : null;

  return (
    <Card title="Copia de seguridad">
      <div className="stack">
        <div className="spread">
          <span>Última copia</span>
          <strong>{data ? (data.backup.lastBackupAt ? formatTimestamp(data.backup.lastBackupAt) : 'Nunca') : '…'}</strong>
        </div>
        {data && data.backup.lastBackupAt !== null && (
          <p className="muted small">
            Cambios desde entonces: {data.backup.changesSinceBackup}
            {data.backup.attachmentsSinceBackup > 0 && ` (incluidos ${data.backup.attachmentsSinceBackup} adjuntos)`}
          </p>
        )}
        {reminder && <Notice tone="warning">{reminder}</Notice>}
        <p className="muted small">
          Un solo archivo .zip con todo: viaje, reservas, itinerario y adjuntos. Guárdalo en Archivos / iCloud Drive o
          envíalo por AirDrop al otro iPhone.
        </p>
        <Button
          variant="primary"
          block
          icon={<Share size={18} />}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const outcome = await exportAndShare();
              if (outcome === 'shared') toast.show('Copia compartida');
              else if (outcome === 'downloaded') toast.show('Copia descargada');
              else toast.show('Copia cancelada');
            } catch (e) {
              toast.error(`No se pudo exportar: ${errorMessage(e)}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Preparando copia…' : 'Exportar copia completa'}
        </Button>
      </div>
    </Card>
  );
}

function ImportCard() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ backup: ParsedBackup; fileName: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<ImportMode | null>(null);
  const appData = useAppData();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const backup = parseBackup(new Uint8Array(await file.arrayBuffer()));
      setParsed({ backup, fileName: file.name, size: file.size });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const run = async (mode: ImportMode) => {
    if (!parsed) return;
    try {
      const r = await importBackup(getDb(), parsed.backup, mode);
      toast.show(mode === 'replace' ? 'Copia restaurada' : `Combinado: ${r.added} nuevos, ${r.updated} actualizados`);
      setParsed(null);
    } catch (e) {
      toast.error(`No se pudo importar: ${errorMessage(e)}`);
    } finally {
      setConfirmMode(null);
    }
  };

  const m = parsed?.backup.manifest;
  const current = appData.status === 'ok' ? appData.data : null;

  return (
    <Card title="Importar copia">
      <div className="stack">
        <p className="muted small">Elige un archivo .zip exportado desde Nihon Trip. Antes de aplicar nada verás qué contiene.</p>
        <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button block icon={<Upload size={18} />} onClick={() => input.current?.click()}>
          Elegir copia…
        </Button>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>

      <BottomSheet open={!!parsed} title="Vista previa de la copia" onClose={() => setParsed(null)}>
        {parsed && m && (
          <div className="stack">
            <dl className="kv">
              <dt>Archivo</dt>
              <dd>{parsed.fileName}</dd>
              <dt>Creada</dt>
              <dd>{formatTimestamp(Date.parse(m.exportedAt))}</dd>
              <dt>Viaje</dt>
              <dd>{parsed.backup.trips[0]?.name ?? 'Sin viaje'}</dd>
              <dt>Reservas</dt>
              <dd>{m.counts.bookings}</dd>
              <dt>Actividades</dt>
              <dd>{m.counts.activities}</dd>
              <dt>Adjuntos</dt>
              <dd>
                {m.counts.attachments} ({formatBytes(m.counts.attachmentBytes)})
              </dd>
            </dl>
            {current && (
              <p className="muted small">
                Ahora tienes: {current.bookings.length} reservas, {current.activities.length} actividades y {current.attachmentCount} adjuntos.
              </p>
            )}
            <Button variant="primary" block onClick={() => setConfirmMode('merge')}>
              Combinar con mis datos
            </Button>
            <p className="muted small">Añade lo nuevo; si algo existe en los dos sitios, se queda la versión editada más tarde.</p>
            <Button block onClick={() => setConfirmMode('replace')} style={{ color: 'var(--c-danger)' }}>
              Reemplazar todos mis datos
            </Button>
            <p className="muted small">Borra lo que hay en este iPhone y deja exactamente lo de la copia.</p>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmMode !== null}
        title={confirmMode === 'replace' ? '¿Reemplazar todos los datos?' : '¿Combinar la copia?'}
        message={
          confirmMode === 'replace'
            ? 'Se borrarán los datos actuales de este dispositivo y se sustituirán por los de la copia.'
            : 'Se añadirán los elementos de la copia a tus datos actuales.'
        }
        confirmLabel={confirmMode === 'replace' ? 'Reemplazar' : 'Combinar'}
        danger={confirmMode === 'replace'}
        onCancel={() => setConfirmMode(null)}
        onConfirm={() => (confirmMode ? run(confirmMode) : undefined)}
      />
    </Card>
  );
}

function StorageCard() {
  const toast = useToast();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    getStorageInfo()
      .then((i) => {
        setInfo(i);
        setError(null);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);
  useEffect(refresh, [refresh]);
  const standalone = isStandalone();

  return (
    <Card title="Almacenamiento" action={<Button variant="ghost" small icon={<RefreshCw size={16} />} label="Actualizar" onClick={refresh} />}>
      <div className="stack">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="spread">
          <span>App instalada</span>
          {standalone ? <StatusTag tone="success">Sí</StatusTag> : <StatusTag tone="warning">No (abierta en Safari)</StatusTag>}
        </div>
        <div className="spread">
          <span>Almacenamiento persistente</span>
          {info === null ? (
            <StatusTag>…</StatusTag>
          ) : !info.supported ? (
            <StatusTag tone="danger">No disponible</StatusTag>
          ) : info.persisted ? (
            <StatusTag tone="success" icon={<ShieldCheck size={12} />}>Concedido</StatusTag>
          ) : (
            <StatusTag tone="warning">No concedido</StatusTag>
          )}
        </div>
        <div className="spread">
          <span>Espacio usado</span>
          <span className="row">
            <HardDrive size={16} aria-hidden="true" />
            {info ? `${formatBytes(info.usage)} de ${formatBytes(info.quota)}` : '…'}
          </span>
        </div>
        {info?.supported && !info.persisted && (
          <>
            <Button
              block
              icon={<ShieldCheck size={18} />}
              onClick={async () => {
                try {
                  const ok = await requestPersistence();
                  toast[ok ? 'show' : 'error'](ok ? 'Almacenamiento persistente concedido' : 'El navegador no lo ha concedido');
                } catch (e) {
                  toast.error(errorMessage(e));
                }
                refresh();
              }}
            >
              Solicitar almacenamiento persistente
            </Button>
            <p className="muted small">
              Safari suele concederlo solo a las apps abiertas desde la pantalla de inicio. Mientras no esté concedido, haz
              copias de seguridad con frecuencia.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

function AppCard() {
  const pwa = usePwaState();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  return (
    <Card title="Aplicación">
      <div className="stack">
        <dl className="kv">
          <dt>Versión</dt>
          <dd>
            {__APP_VERSION__} ({__COMMIT__})
          </dd>
          <dt>Compilada</dt>
          <dd>{formatTimestamp(Date.parse(__BUILD_TIME__))}</dd>
          <dt>Modo sin conexión</dt>
          <dd>{pwa.registerError ? `Error: ${pwa.registerError}` : pwa.registration?.active ? 'Activo' : 'Instalándose…'}</dd>
        </dl>
        {pwa.needRefresh && <Notice tone="info">Hay una actualización lista. Pulsa «Actualizar ahora» en el aviso rojo de arriba.</Notice>}
        <Button
          block
          icon={<Download size={18} />}
          disabled={checking || !pwa.registration}
          onClick={async () => {
            if (!pwa.registration) return;
            setChecking(true);
            try {
              await pwa.registration.update();
              toast.show(pwa.registration.waiting || pwa.registration.installing ? 'Descargando actualización…' : 'Comprobado');
            } catch (e) {
              toast.error(`No se pudo comprobar: ${errorMessage(e)}`);
            } finally {
              setChecking(false);
            }
          }}
        >
          Buscar actualización
        </Button>
      </div>
    </Card>
  );
}

function DangerCard() {
  const toast = useToast();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  return (
    <Card title="Zona peligrosa">
      <div className="stack">
        <p className="muted small">Borra el viaje, las reservas, el itinerario y todos los adjuntos de este iPhone.</p>
        <Button block icon={<Trash2 size={18} />} style={{ color: 'var(--c-danger)' }} onClick={() => setStep(1)}>
          Borrar todos los datos
        </Button>
      </div>
      <ConfirmDialog
        open={step === 1}
        title="¿Borrar todos los datos?"
        message="Se eliminará toda la información de la app en este dispositivo. Si no tienes copia de seguridad, no se podrá recuperar."
        confirmLabel="Continuar"
        danger
        onCancel={() => setStep(0)}
        onConfirm={() => setStep(2)}
      />
      <ConfirmDialog
        open={step === 2}
        title="Confirmación final"
        message="Esta acción no se puede deshacer."
        confirmLabel="Borrar definitivamente"
        danger
        requireText="BORRAR"
        onCancel={() => setStep(0)}
        onConfirm={async () => {
          try {
            await deleteAllData(getDb());
            toast.show('Datos borrados');
          } catch (e) {
            toast.error(errorMessage(e));
          }
          setStep(0);
        }}
      />
    </Card>
  );
}
