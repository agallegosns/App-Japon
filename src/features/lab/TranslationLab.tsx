import { useEffect, useRef, useState } from 'react';
import { formatTimestamp } from '../../models/datetime';
import { formatBytes } from '../../storage/persistence';
import { Button } from '../../ui/Button';
import { SelectField } from '../../ui/Field';
import { Notice } from '../../ui/Notice';
import { errorMessage } from '../../ui/States';
import { kvDelete, kvGet, kvSet } from './labDb';
import { LabSection } from './LabSection';
import { assetUrl, ensureCached, ORT_CACHE, ORT_FILES } from './offlineAssets';
import { formatMs, useLabReport } from './report';
import { TRANSLATION_SAMPLES } from './samples';
import type { ModelSpec, WorkerRequest, WorkerResponse } from './translation.worker';

type Choice = 'direct' | 'pivot';

const DIRECT_MODEL = 'opus-mt-ja-es';
const DIRECT_BASE = 'offline/models/';

const SPECS: Record<Choice, { label: string; spec: () => ModelSpec; note: string }> = {
  direct: {
    label: 'Directo ja→es (Helsinki-NLP/opus-mt-ja-es, alojado en la app)',
    spec: () => ({ kind: 'direct', localBase: assetUrl(DIRECT_BASE), model: DIRECT_MODEL }),
    note: 'Convertido a ONNX cuantizado por el workflow «Recursos offline» y publicado junto a la app.',
  },
  pivot: {
    label: 'Con paso por inglés ja→en→es (Xenova, desde Hugging Face)',
    spec: () => ({ kind: 'pivot', first: 'Xenova/opus-mt-ja-en', second: 'Xenova/opus-mt-en-es' }),
    note: 'Dos modelos ya convertidos; se descargan de huggingface.co la primera vez.',
  },
};

interface RunFlag {
  choice: Choice;
  startedAt: number;
  stage: string;
}

export function TranslationLab() {
  const { report } = useLabReport();
  const [choice, setChoice] = useState<Choice>('direct');
  const [busy, setBusy] = useState<string | null>(null);
  const [directAvailable, setDirectAvailable] = useState<boolean | null>(null);
  const [crashed, setCrashed] = useState<RunFlag | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    kvGet<RunFlag>('translation-running').then((f) => f && setCrashed(f)).catch(() => undefined);
    fetch(assetUrl(`${DIRECT_BASE}${DIRECT_MODEL}/config.json`), { method: 'HEAD', cache: 'no-store' })
      .then((r) => {
        setDirectAvailable(r.ok);
        // Sin modelo directo publicado, se propone la vía ja→en→es.
        if (!r.ok) setChoice('pivot');
      })
      .catch(() => setDirectAvailable(null));
    return () => workerRef.current?.terminate();
  }, []);

  const call = (worker: Worker, msg: WorkerRequest, onProgress?: (r: Extract<WorkerResponse, { type: 'progress' }>) => void) =>
    new Promise<WorkerResponse>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type === 'progress') onProgress?.(e.data);
        else if (e.data.type === 'error') reject(new Error(e.data.message));
        else resolve(e.data);
      };
      worker.onerror = (e) => reject(new Error(e.message || 'El worker de traducción falló.'));
      worker.postMessage(msg);
    });

  const run = async (offlineOnly: boolean) => {
    const id = `translation-${choice}`;
    const title = `Traducción: ${choice === 'direct' ? 'ja→es directo' : 'ja→en→es'}${offlineOnly ? ' (solo caché)' : ''}`;
    const lines: string[] = [`Conexión: ${navigator.onLine ? 'sí' : 'no (modo avión)'}`];
    const log = (l: string, status: 'running' | 'ok' | 'fail' = 'running') => {
      lines.push(l);
      report(id, { title, status, lines: [...lines] });
    };
    setBusy('Preparando motor…');
    const flag: RunFlag = { choice, startedAt: Date.now(), stage: 'motor' };
    await kvSet('translation-running', flag);
    try {
      if (!offlineOnly) {
        const ort = await ensureCached(ORT_CACHE, ORT_FILES, setBusy);
        log(`Motor ONNX Runtime en caché: ${formatBytes(ort.bytes)}${ort.ok ? '' : ' (INCOMPLETO)'}`);
        if (!ort.ok) throw new Error(ort.lines.join('; '));
      }
      workerRef.current?.terminate();
      const worker = new Worker(new URL('./translation.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      await kvSet('translation-running', { ...flag, stage: 'carga del modelo' });
      const sizes: Record<string, number> = {};
      const loaded = await call(worker, { type: 'load', spec: SPECS[choice].spec(), ortBase: assetUrl('ort/'), offlineOnly }, (p) => {
        sizes[p.file] = p.total;
        setBusy(`Cargando ${p.file.split('/').pop() ?? ''}: ${formatBytes(p.loaded)} de ${formatBytes(p.total)}`);
      });
      if (loaded.type !== 'loaded') throw new Error('Respuesta inesperada del worker.');
      const total = Object.values(loaded.files).reduce((a, b) => a + b, 0);
      log(`Modelo cargado en ${formatMs(loaded.ms)}; tamaño: ${formatBytes(total)}`);
      for (const [f, s] of Object.entries(loaded.files)) log(`  · ${f}: ${formatBytes(s)}`);
      await kvSet('translation-running', { ...flag, stage: 'traducción' });
      let good = 0;
      for (const sentence of TRANSLATION_SAMPLES) {
        setBusy(`Traduciendo: ${sentence}`);
        const r = await call(worker, { type: 'translate', text: sentence });
        if (r.type !== 'result') throw new Error('Respuesta inesperada del worker.');
        const plausible = r.text.trim().length > 0 && /[a-záéíóúñ]/i.test(r.text) && !/[぀-ヿ一-龯]/.test(r.text);
        if (plausible) good++;
        log(`${sentence} → ${r.text || '(vacío)'}${r.intermediate ? `  [inglés: ${r.intermediate}]` : ''} (${formatMs(r.ms)})`);
      }
      const ok = good === TRANSLATION_SAMPLES.length;
      log(
        ok
          ? 'Funciona técnicamente sin cerrarse. Revisa a ojo la calidad de las traducciones.'
          : 'Alguna traducción está vacía o sin texto en español.',
        ok ? 'ok' : 'fail',
      );
    } catch (e) {
      log(`ERROR: ${errorMessage(e)}`, 'fail');
    } finally {
      await kvDelete('translation-running');
      setBusy(null);
    }
  };

  return (
    <LabSection
      ids={['translation-direct', 'translation-pivot']}
      anchor="traduccion"
      title="c) Traducción japonés→español sin conexión"
      description="Transformers.js con ONNX Runtime (WASM, un hilo) en un worker. La primera vez descarga el modelo a Cache Storage; después pulsa «Probar solo con caché» en modo avión. Se mide el tamaño, el tiempo de carga y si Safari aguanta sin cerrar la app."
    >
      {crashed && (
        <Notice tone="danger">
          La prueba anterior ({crashed.choice === 'direct' ? 'directo' : 'ja→en→es'}, iniciada {formatTimestamp(crashed.startedAt)}) no terminó durante
          «{crashed.stage}»: lo más probable es que Safari cerrara la app por falta de memoria.
          <div style={{ marginTop: 8 }}>
            <Button
              small
              onClick={() => {
                report(`translation-${crashed.choice}`, {
                  title: `Traducción: ${crashed.choice === 'direct' ? 'ja→es directo' : 'ja→en→es'}`,
                  status: 'fail',
                  lines: [`La app se cerró durante «${crashed.stage}» (iniciada ${new Date(crashed.startedAt).toISOString()}).`],
                });
                setCrashed(null);
              }}
            >
              Añadir al informe
            </Button>
          </div>
        </Notice>
      )}
      <SelectField<Choice>
        label="Modelo"
        value={choice}
        onChange={setChoice}
        options={(Object.keys(SPECS) as Choice[]).map((c) => ({ value: c, label: SPECS[c].label }))}
        hint={SPECS[choice].note}
      />
      {choice === 'direct' && directAvailable === false && (
        <Notice tone="warning">
          El modelo directo no está publicado: su conversión a ONNX no es válida y pesa ≈ 236 MB (ver ARCHITECTURE.md). La prueba fallará con el error real.
        </Notice>
      )}
      <Button variant="primary" block disabled={!!busy} onClick={() => run(false)}>
        Descargar y traducir
      </Button>
      <Button block disabled={!!busy} onClick={() => run(true)}>
        Probar solo con caché (modo avión)
      </Button>
      {busy && <p className="muted small" role="status">{busy}</p>}
    </LabSection>
  );
}
