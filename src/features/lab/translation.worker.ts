/// <reference lib="webworker" />
import { env, pipeline, type ProgressInfo } from '@huggingface/transformers';

type Translator = (text: string, options: Record<string, unknown>) => Promise<unknown>;
// Los tipos genéricos de pipeline() son demasiado complejos para TypeScript: se acota a lo que se usa.
const createPipeline = pipeline as unknown as (task: 'translation', model: string, options: Record<string, unknown>) => Promise<Translator>;

export type ModelSpec =
  | { kind: 'direct'; localBase: string; model: string }
  | { kind: 'pivot'; first: string; second: string };

export type WorkerRequest = { type: 'load'; spec: ModelSpec; ortBase: string; offlineOnly: boolean } | { type: 'translate'; text: string };

export type WorkerResponse =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'loaded'; ms: number; files: Record<string, number> }
  | { type: 'result'; text: string; ms: number; intermediate?: string }
  | { type: 'error'; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let steps: Translator[] = [];
const files: Record<string, number> = {};

function post(msg: WorkerResponse) {
  scope.postMessage(msg);
}

function onProgress(p: ProgressInfo) {
  if (p.status === 'progress') {
    files[`${p.name}/${p.file}`] = p.total;
    post({ type: 'progress', file: `${p.name}/${p.file}`, loaded: p.loaded, total: p.total });
  }
}

async function load(spec: ModelSpec, ortBase: string, offlineOnly: boolean) {
  const t0 = performance.now();
  const onnx = env.backends.onnx;
  if (onnx.wasm) {
    onnx.wasm.wasmPaths = ortBase;
    // GitHub Pages no permite aislamiento entre orígenes: sin hilos.
    onnx.wasm.numThreads = 1;
    onnx.wasm.proxy = false;
  }
  env.useBrowserCache = true;
  env.allowRemoteModels = !offlineOnly;
  const opts = { dtype: 'q8', device: 'wasm', progress_callback: onProgress };
  if (spec.kind === 'direct') {
    env.allowLocalModels = true;
    env.localModelPath = spec.localBase;
    steps = [await createPipeline('translation', spec.model, opts)];
  } else {
    env.allowLocalModels = false;
    steps = [
      await createPipeline('translation', spec.first, opts),
      await createPipeline('translation', spec.second, opts),
    ];
  }
  post({ type: 'loaded', ms: performance.now() - t0, files: { ...files } });
}

async function run(text: string): Promise<{ text: string; intermediate?: string }> {
  let current = text;
  let intermediate: string | undefined;
  for (const [i, step] of steps.entries()) {
    const out = (await step(current, { max_new_tokens: 128 })) as unknown as { translation_text: string }[];
    current = out[0]?.translation_text ?? '';
    if (i === 0 && steps.length > 1) intermediate = current;
  }
  return { text: current, intermediate };
}

scope.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    if (e.data.type === 'load') await load(e.data.spec, e.data.ortBase, e.data.offlineOnly);
    else {
      if (steps.length === 0) throw new Error('El modelo no está cargado.');
      const t0 = performance.now();
      const r = await run(e.data.text);
      post({ type: 'result', text: r.text, intermediate: r.intermediate, ms: performance.now() - t0 });
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
  }
};
