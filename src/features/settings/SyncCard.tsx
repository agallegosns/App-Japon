import { Cloud, Copy, Eye, EyeOff, RefreshCw, Share2, Users } from 'lucide-react';
import { useState } from 'react';
import { formatCode } from '../../sync/crypto';
import { joinSharing, planJoin, runSync, startSharing, stopSharing, useSync, wipeCloud, errorText, type JoinPlan } from '../../sync/service';
import { getDb } from '../../storage/db';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { copyText } from '../../ui/copy';
import { TextField } from '../../ui/Field';
import { Notice } from '../../ui/Notice';
import { useToast } from '../../ui/Toast';

function ago(ms: number | null): string {
  if (ms === null) return 'todavía no';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'hace unos segundos';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Compartir el viaje con tu pareja: un código secreto, datos cifrados y sincronización automática. */
export function SyncCard() {
  const sync = useSync();
  const toast = useToast();
  const db = getDb();
  const [joining, setJoining] = useState(false);
  const [codeText, setCodeText] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<JoinPlan | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const code = sync.config ? formatCode(sync.config.code) : '';

  const create = async () => {
    setBusy(true);
    try {
      await startSharing(db);
      setShowCode(true);
      toast.show('Listo: ya compartís este viaje. Pasa el código a tu pareja.');
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setJoinError(null);
    try {
      const p = await planJoin(db, codeText);
      if (p.needsChoice) {
        setPlan(p);
        return;
      }
      await joinSharing(db, p.code, false);
      setJoining(false);
      setCodeText('');
      toast.show(p.remoteItems > 0 ? 'Unido: se están descargando los datos.' : 'Unido. Aún no hay datos en la nube con ese código.');
    } catch (e) {
      setJoinError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const text = `Código de Nihon Trip (no lo compartas con nadie más): ${code}`;
    try {
      if (typeof navigator.share === 'function') await navigator.share({ text });
      else {
        await copyText(code);
        toast.show('Código copiado');
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast.error(errorText(e));
    }
  };

  return (
    <Card title="Compartir con tu pareja">
      <div className="stack">
        {!sync.config ? (
          <>
            <p className="small">
              Si compartís el viaje, lo que añadas (hoteles, actividades, trenes, documentos) aparece también en el móvil de tu pareja, y al revés.
              Los datos viajan <strong>cifrados</strong> con un código que solo tenéis vosotros: el servidor guarda datos ilegibles y no puede
              leerlos.
            </p>
            <Button variant="primary" block icon={<Users size={18} />} disabled={busy} onClick={() => void create()}>
              Crear código para compartir
            </Button>
            {!joining ? (
              <Button block onClick={() => setJoining(true)}>
                Ya tengo un código de mi pareja
              </Button>
            ) : (
              <div className="stack">
                <TextField
                  label="Código del viaje"
                  value={codeText}
                  onChange={(v) => {
                    setCodeText(v);
                    setJoinError(null);
                  }}
                  error={joinError ?? undefined}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                />
                <Button variant="primary" block disabled={busy || !codeText.trim()} onClick={() => void join()}>
                  Unirme
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="spread">
              <span className="row" style={{ gap: 'var(--sp-2)' }}>
                <Cloud size={18} aria-hidden="true" /> <strong>Compartiendo con tu pareja</strong>
              </span>
              <span className="muted small" role="status">
                {sync.syncing ? 'Sincronizando…' : `Última vez: ${ago(sync.config.lastSyncAt)}`}
              </span>
            </div>
            {sync.error && <Notice tone="danger" role="alert">{sync.error}</Notice>}
            {sync.warnings.map((w) => (
              <Notice key={w} tone="warning">
                {w}
              </Notice>
            ))}
            <div className="sync-code">
              <span className="sync-code-text" aria-label={showCode ? `Código ${code}` : 'Código oculto'}>
                {showCode ? code : '•••••-•••••-•••••-•••••'}
              </span>
              <Button variant="ghost" icon={showCode ? <EyeOff size={20} /> : <Eye size={20} />} label={showCode ? 'Ocultar código' : 'Mostrar código'} onClick={() => setShowCode((v) => !v)} />
            </div>
            <div className="input-row">
              <Button icon={<Share2 size={18} />} onClick={() => void share()}>
                Enviar código
              </Button>
              <Button
                icon={<Copy size={18} />}
                onClick={() => {
                  copyText(code).then(
                    () => toast.show('Código copiado'),
                    (e: unknown) => toast.error(errorText(e)),
                  );
                }}
              >
                Copiar
              </Button>
            </div>
            <Button variant="primary" block icon={<RefreshCw size={18} className={sync.syncing ? 'spin' : undefined} />} disabled={sync.syncing} onClick={() => void runSync(db)}>
              Sincronizar ahora
            </Button>
            <p className="muted small">
              Se sincroniza solo al abrir la app, al recuperar la conexión y unos segundos después de cada cambio. Si los dos cambiáis lo mismo, se
              queda el cambio más reciente. Envía el código solo a tu pareja y por un medio privado.
            </p>
            <details className="day-more">
              <summary>Opciones</summary>
              <div className="stack" style={{ marginTop: 'var(--sp-2)' }}>
                <Button block onClick={() => setConfirmStop(true)}>
                  Dejar de compartir en este móvil
                </Button>
                <Button block style={{ color: 'var(--c-danger)' }} onClick={() => setConfirmWipe(true)}>
                  Borrar los datos de la nube
                </Button>
              </div>
            </details>
          </>
        )}
      </div>

      <ConfirmDialog
        open={plan !== null}
        title="Este móvil ya tiene datos"
        message={
          <>
            En la nube ya hay datos con ese código y este móvil también tiene los suyos. Para compartir, <strong>se sustituirán los de este móvil</strong>{' '}
            por los de la nube y los de este móvil se perderán. Si quieres conservarlos, haz antes una copia de seguridad (más abajo en Ajustes).
          </>
        }
        confirmLabel="Sustituir por los de la nube"
        danger
        onCancel={() => setPlan(null)}
        onConfirm={async () => {
          if (!plan) return;
          setPlan(null);
          setBusy(true);
          try {
            await joinSharing(db, plan.code, true);
            setJoining(false);
            setCodeText('');
            toast.show('Unido: datos descargados de la nube.');
          } catch (e) {
            setJoinError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDialog
        open={confirmStop}
        title="¿Dejar de compartir?"
        message="Este móvil dejará de enviar y recibir cambios. No se borra nada, ni aquí ni en la nube, y podrás volver a unirte con el mismo código."
        confirmLabel="Dejar de compartir"
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => {
          stopSharing();
          setConfirmStop(false);
          setShowCode(false);
          toast.show('Has dejado de compartir en este móvil.');
        }}
      />
      <ConfirmDialog
        open={confirmWipe}
        title="¿Borrar los datos de la nube?"
        message="Se borra todo lo que hay en la nube con tu código y se deja de compartir. Los datos de los móviles se quedan como están. Tu pareja tendría que dejar de compartir también. No se puede deshacer."
        confirmLabel="Borrar de la nube"
        danger
        onCancel={() => setConfirmWipe(false)}
        onConfirm={async () => {
          setConfirmWipe(false);
          try {
            const n = await wipeCloud();
            setShowCode(false);
            toast.show(`Borrado de la nube (${n} elementos).`);
          } catch (e) {
            toast.error(errorText(e));
          }
        }}
      />
    </Card>
  );
}
