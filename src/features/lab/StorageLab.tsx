import { useEffect, useState } from 'react';
import { formatTimestamp } from '../../models/datetime';
import { formatBytes } from '../../storage/persistence';
import { Button } from '../../ui/Button';
import { errorMessage } from '../../ui/States';
import { getOpenStats, labDb, type OpenStats } from './labDb';
import { LabSection } from './LabSection';
import { formatMs, useLabReport } from './report';

const CHUNKS = 10;
const CHUNK_BYTES = 10 * 1024 * 1024;

function fillChunk(index: number): Uint8Array {
  const data = new Uint8Array(CHUNK_BYTES);
  const seed = (index * 131) & 255;
  for (let i = 0; i < data.length; i++) data[i] = (seed + i * 7 + (i >>> 11)) & 255;
  return data;
}

/** Comprueba muestras repartidas por todo el bloque (cada 1021 bytes + últimos bytes). */
function verifyChunk(index: number, data: Uint8Array): boolean {
  if (data.length !== CHUNK_BYTES) return false;
  const seed = (index * 131) & 255;
  for (let i = 0; i < data.length; i += 1021) if (data[i] !== ((seed + i * 7 + (i >>> 11)) & 255)) return false;
  for (let i = data.length - 16; i < data.length; i++) if (data[i] !== ((seed + i * 7 + (i >>> 11)) & 255)) return false;
  return true;
}

async function verifyStored(): Promise<{ ok: boolean; count: number; bytes: number; ms: number; bad: number[] }> {
  const t0 = performance.now();
  const bad: number[] = [];
  let bytes = 0;
  const ids = (await labDb().blobs.toCollection().primaryKeys()) as number[];
  for (const id of ids) {
    const row = await labDb().blobs.get(id);
    if (!row) {
      bad.push(id);
      continue;
    }
    const data = new Uint8Array(await row.blob.arrayBuffer());
    bytes += data.length;
    if (!verifyChunk(id, data)) bad.push(id);
  }
  return { ok: bad.length === 0 && ids.length === CHUNKS, count: ids.length, bytes, ms: performance.now() - t0, bad };
}

export function StorageLab() {
  const { report } = useLabReport();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [opens, setOpens] = useState<OpenStats | null>(null);
  const [stored, setStored] = useState<number | null>(null);

  useEffect(() => {
    getOpenStats().then(setOpens).catch(() => setOpens(null));
    labDb().blobs.count().then(setStored).catch(() => setStored(null));
  }, []);

  const run = async () => {
    setBusy(true);
    const lines: string[] = [];
    const log = (l: string) => {
      lines.push(l);
      report('storage', { title: 'Almacenamiento', status: 'running', lines: [...lines] });
    };
    try {
      if (!navigator.storage) throw new Error('navigator.storage no existe en este navegador.');
      const persisted = navigator.storage.persist ? await navigator.storage.persist() : null;
      log(`persist(): ${String(persisted)}`);
      const before = await navigator.storage.estimate();
      log(`estimate() antes: uso ${formatBytes(before.usage ?? null)} de ${formatBytes(before.quota ?? null)}`);

      await labDb().blobs.clear();
      const tw = performance.now();
      for (let i = 0; i < CHUNKS; i++) {
        setProgress(`Escribiendo bloque ${i + 1}/${CHUNKS}…`);
        const blob = new Blob([fillChunk(i).buffer as ArrayBuffer], { type: 'application/octet-stream' });
        await labDb().blobs.put({ id: i, blob, size: blob.size });
      }
      const writeMs = performance.now() - tw;
      log(`Escritura: ${formatBytes(CHUNKS * CHUNK_BYTES)} en ${formatMs(writeMs)} (${((CHUNKS * CHUNK_BYTES) / 1048576 / (writeMs / 1000)).toFixed(1)} MB/s)`);

      setProgress('Releyendo y verificando…');
      const v = await verifyStored();
      log(`Relectura: ${v.count} bloques, ${formatBytes(v.bytes)} en ${formatMs(v.ms)}; dañados: ${v.bad.length ? v.bad.join(', ') : 'ninguno'}`);
      const after = await navigator.storage.estimate();
      log(`estimate() después: uso ${formatBytes(after.usage ?? null)} de ${formatBytes(after.quota ?? null)}`);
      const os = await getOpenStats();
      setOpens(os);
      log(`Aperturas registradas: ${os?.count ?? 0}`);
      setStored(v.count);
      report('storage', { title: 'Almacenamiento', status: v.ok ? 'ok' : 'fail', lines: [...lines, v.ok ? 'Resultado: 100 MB escritos y releídos sin errores.' : 'Resultado: la verificación ha fallado.'] });
    } catch (e) {
      log(`ERROR: ${errorMessage(e)}`);
      report('storage', { title: 'Almacenamiento', status: 'fail', lines });
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const reverify = async () => {
    setBusy(true);
    try {
      const v = await verifyStored();
      report('storage-reread', {
        title: 'Almacenamiento: relectura tras reabrir',
        status: v.ok ? 'ok' : 'fail',
        lines: [`Bloques guardados: ${v.count}/${CHUNKS}, ${formatBytes(v.bytes)} leídos en ${formatMs(v.ms)}`, v.ok ? 'Siguen intactos.' : `Dañados o ausentes: ${v.bad.join(', ') || 'faltan bloques'}`],
      });
    } catch (e) {
      report('storage-reread', { title: 'Almacenamiento: relectura tras reabrir', status: 'fail', lines: [errorMessage(e)] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <LabSection
      ids={['storage', 'storage-reread']}
      anchor="almacenamiento"
      title="a) Almacenamiento"
      description="Pide almacenamiento persistente, escribe 100 MB en IndexedDB como Blob y los relee comprobando su contenido. Después cierra la app del todo (deslizando desde el multitarea), vuelve a abrirla y pulsa «Releer bloques»: el contador de aperturas debe subir y los bloques seguir intactos."
    >
      <div className="spread">
        <span>Aperturas de la app</span>
        <strong>{opens ? opens.count : '…'}</strong>
      </div>
      {opens && (
        <p className="muted small">
          Primera: {formatTimestamp(opens.firstAt)}
          {opens.previousAt && ` · anterior: ${formatTimestamp(opens.previousAt)}`}
        </p>
      )}
      <Button variant="primary" block disabled={busy} onClick={run}>
        {busy && progress ? progress : 'Escribir y releer 100 MB'}
      </Button>
      <div className="input-row">
        <Button disabled={busy || !stored} onClick={reverify}>
          Releer bloques ({stored ?? 0})
        </Button>
        <Button
          disabled={busy || !stored}
          onClick={async () => {
            await labDb().blobs.clear();
            setStored(0);
          }}
        >
          Borrar bloques
        </Button>
      </div>
    </LabSection>
  );
}
