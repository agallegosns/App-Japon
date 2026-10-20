import { Camera, ClipboardCopy, Copy, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OnlineGate } from '../../ui/OnlineGate';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { copyText } from '../../ui/copy';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { Segmented } from '../../ui/Segmented';
import { errorMessage } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { OcrEngine, toCanvas, type OcrBlock, type OcrMode } from './ocr';
import { drawOverlay } from './overlay';
import { getStoredEmail, storeEmail, translateJaToEs, TranslateError } from './translate';

type Phase = 'idle' | 'starting' | 'live' | 'working' | 'result';

interface Item {
  id: number;
  block: OcrBlock;
  es: string | null;
}

const MAX_BLOCKS = 12;

export function TranslatorPage() {
  return (
    <>
      <PageHeader title="Traductor" subtitle="Cámara japonés → español" />
      <OnlineGate feature="El traductor">
        <Translator />
      </OnlineGate>
    </>
  );
}

function Translator() {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<OcrMode>('horizontal');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<'traduccion' | 'foto'>('traduccion');
  const [email, setEmail] = useState(getStoredEmail);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const resultRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const engine = useRef(new OcrEngine());

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const ocr = engine.current;
    return () => {
      stopCamera();
      void ocr.dispose();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite usar la cámara dentro de la app. Usa el botón «Hacer una foto».');
      return;
    }
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('live');
    } catch (e) {
      setPhase('idle');
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'No has dado permiso a la cámara. Actívalo en Ajustes del iPhone → Apps → Safari/Nihon Trip → Cámara, o usa «Hacer una foto».'
          : `No se pudo abrir la cámara: ${errorMessage(e)}. Prueba con «Hacer una foto».`,
      );
    }
  };

  // Conecta el flujo de vídeo cuando el elemento <video> ya existe.
  useEffect(() => {
    const video = videoRef.current;
    if (phase === 'live' && video && streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch((e: unknown) => setError(`No se pudo iniciar el vídeo: ${errorMessage(e)}`));
    }
  }, [phase]);

  const translateItems = useCallback(
    async (list: Item[]): Promise<Item[]> => {
      const out = [...list];
      setTranslateError(null);
      for (const [i, item] of out.entries()) {
        if (item.es !== null) continue;
        setStatus(`Traduciendo ${i + 1} de ${out.length}…`);
        try {
          const es = await translateJaToEs(item.block.text, { email: email.trim() });
          out[i] = { ...item, es };
        } catch (e) {
          setTranslateError(e instanceof TranslateError ? e.message : errorMessage(e));
          break;
        }
      }
      return out;
    },
    [email],
  );

  const process = async (canvas: HTMLCanvasElement) => {
    captureRef.current = canvas;
    setPhase('working');
    setError(null);
    setItems([]);
    setView('traduccion');
    try {
      const blocks = (await engine.current.recognize(canvas, mode, setStatus)).slice(0, MAX_BLOCKS);
      const initial = blocks.map((block, id) => ({ id, block, es: null as string | null }));
      setItems(initial);
      if (initial.length > 0) setItems(await translateItems(initial));
      setPhase('result');
    } catch (e) {
      setError(`No se pudo leer el texto: ${errorMessage(e)}`);
      setPhase('result');
    } finally {
      setStatus('');
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const canvas = toCanvas(video);
      stopCamera();
      await process(canvas);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      stopCamera();
      const bitmap = await createImageBitmap(file);
      const canvas = toCanvas(bitmap);
      bitmap.close();
      await process(canvas);
    } catch (e) {
      setError(`No se pudo abrir la foto: ${errorMessage(e)}`);
      setPhase('idle');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Dibuja la foto con las traducciones encima.
  useEffect(() => {
    const target = resultRef.current;
    const base = captureRef.current;
    if (phase !== 'result' || !target || !base) return;
    target.width = base.width;
    target.height = base.height;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(base, 0, 0);
    if (view === 'traduccion') {
      drawOverlay(
        ctx,
        items.filter((i) => i.es).map((i) => ({ bbox: i.block.bbox, text: i.es as string })),
        mode === 'vertical',
      );
    }
  }, [phase, items, view, mode]);

  const retryTranslation = async () => {
    setPhase('working');
    setItems(await translateItems(items));
    setStatus('');
    setPhase('result');
  };

  const copy = async (text: string, what: string) => {
    try {
      await copyText(text);
      toast.show(`${what} copiado`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const reset = () => {
    setItems([]);
    setError(null);
    setTranslateError(null);
    captureRef.current = null;
    setPhase('idle');
  };

  const pending = items.some((i) => i.es === null);

  return (
    <div className="stack-lg">
      {(phase === 'idle' || phase === 'live' || phase === 'starting') && (
        <Segmented<OcrMode>
          label="Dirección del texto"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'horizontal', label: 'Texto horizontal' },
            { value: 'vertical', label: 'Texto vertical' },
          ]}
        />
      )}

      {error && <Notice tone="danger" role="alert">{error}</Notice>}

      {phase === 'idle' && (
        <Card>
          <div className="stack">
            <p>Apunta la cámara a un cartel, menú, señal o máquina expendedora y pulsa el botón para traducirlo al español.</p>
            <Button variant="primary" block icon={<Camera size={20} />} onClick={() => void startCamera()}>
              Abrir cámara
            </Button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onPhoto(e.target.files?.[0])} />
            <Button block onClick={() => fileRef.current?.click()}>
              Hacer una foto
            </Button>
          </div>
        </Card>
      )}

      {(phase === 'starting' || phase === 'live') && (
        <div className="stack">
          <div className="lab-media" style={{ background: '#000', borderRadius: 'var(--r-md, 12px)', overflow: 'hidden' }}>
            <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', display: 'block' }} />
          </div>
          <Button variant="primary" block icon={<Camera size={20} />} disabled={phase !== 'live'} onClick={() => void capture()}>
            {phase === 'live' ? 'Traducir lo que veo' : 'Abriendo cámara…'}
          </Button>
          <Button variant="ghost" block onClick={() => { stopCamera(); setPhase('idle'); }}>
            Cerrar cámara
          </Button>
        </div>
      )}

      {phase === 'working' && (
        <Card>
          <p role="status" aria-live="polite">{status || 'Procesando…'}</p>
          <p className="muted small">La primera vez descarga el lector de japonés (unos 8 MB) y tarda más.</p>
        </Card>
      )}

      {phase === 'result' && (
        <div className="stack">
          <Segmented<'traduccion' | 'foto'>
            label="Qué ver sobre la foto"
            value={view}
            onChange={setView}
            options={[
              { value: 'traduccion', label: 'Con traducción' },
              { value: 'foto', label: 'Foto original' },
            ]}
          />
          <canvas ref={resultRef} className="lab-media" style={{ width: '100%', height: 'auto' }} aria-label="Foto con la traducción superpuesta" />

          {items.length === 0 && !error && (
            <Notice tone="warning">
              No he encontrado texto japonés. Acércate, evita reflejos y prueba a cambiar entre texto horizontal y vertical.
            </Notice>
          )}
          {translateError && (
            <Notice tone="danger" role="alert">
              {translateError}
              {pending && (
                <>
                  <br />
                  <Button small icon={<RefreshCw size={16} />} onClick={() => void retryTranslation()}>
                    Reintentar traducción
                  </Button>
                </>
              )}
            </Notice>
          )}

          {items.map((i) => (
            <Card key={i.id}>
              <div className="stack">
                <p lang="ja" className="break muted">{i.block.text}</p>
                <p className="break" style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>{i.es ?? 'Sin traducir todavía'}</p>
                {i.es && (
                  <Button small icon={<Copy size={16} />} onClick={() => void copy(i.es as string, 'Traducción')}>
                    Copiar traducción
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {items.some((i) => i.es) && (
            <Button
              icon={<ClipboardCopy size={18} />}
              onClick={() => void copy(items.filter((i) => i.es).map((i) => i.es).join('\n'), 'Texto')}
            >
              Copiar todo
            </Button>
          )}
          <Button variant="primary" block icon={<RotateCcw size={18} />} onClick={reset}>
            Nueva foto
          </Button>
        </div>
      )}

      <details>
        <summary>Privacidad y límite diario</summary>
        <div className="stack" style={{ marginTop: 'var(--sp-2)' }}>
          <p className="small">
            La foto no sale del móvil: solo se envía a MyMemory (translated.net) el texto japonés reconocido para traducirlo. El servicio
            gratuito permite unos 5 000 caracteres al día por conexión. Si se agota, puedes escribir un email para ampliarlo a 50 000: se guarda
            solo en este móvil y se envía a MyMemory únicamente con las traducciones.
          </p>
          <label className="field-label" htmlFor="tr-email">Email (opcional)</label>
          <input
            id="tr-email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            value={email}
            onChange={(e) => { setEmail(e.target.value); storeEmail(e.target.value); }}
          />
        </div>
      </details>
    </div>
  );
}
