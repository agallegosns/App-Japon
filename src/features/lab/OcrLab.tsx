import { useRef, useState } from 'react';
import { formatBytes } from '../../storage/persistence';
import { Button } from '../../ui/Button';
import { errorMessage } from '../../ui/States';
import { useObjectUrl } from '../../ui/useObjectUrl';
import { LabSection } from './LabSection';
import { assetUrl, ensureCached, OCR_CACHE, OCR_FILES } from './offlineAssets';
import { formatMs, useLabReport } from './report';
import { OCR_SAMPLES } from './samples';
import { lcsRatio } from './textSimilarity';

type Lang = 'jpn' | 'jpn_vert';
const MIN_RATIO = 0.8;

async function recognize(image: string | Blob, lang: Lang, onStatus: (s: string) => void) {
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  const t0 = performance.now();
  const worker = await createWorker(lang, OEM.LSTM_ONLY, {
    workerPath: assetUrl('tesseract/worker.min.js'),
    corePath: assetUrl('tesseract/core/'),
    langPath: assetUrl('tesseract/lang'),
    workerBlobURL: false,
    gzip: true,
    cacheMethod: 'write',
    logger: (m) => onStatus(`${m.status} ${Math.round(m.progress * 100)}%`),
    errorHandler: (e: unknown) => onStatus(`error: ${errorMessage(e)}`),
  });
  const initMs = performance.now() - t0;
  try {
    if (lang === 'jpn_vert') await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK_VERT_TEXT });
    const t1 = performance.now();
    const { data } = await worker.recognize(image);
    return { text: data.text.trim(), confidence: data.confidence, initMs, recognizeMs: performance.now() - t1 };
  } finally {
    await worker.terminate();
  }
}

export function OcrLab() {
  const { report } = useLabReport();
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const photoUrl = useObjectUrl(photo);

  const download = async () => {
    setBusy('Descargando…');
    try {
      const r = await ensureCached(OCR_CACHE, OCR_FILES, setBusy);
      report('ocr-download', {
        title: 'OCR: descarga para uso sin conexión',
        status: r.ok ? 'ok' : 'fail',
        lines: [...r.lines, `Total en caché: ${formatBytes(r.bytes)}`, 'El idioma también queda guardado por Tesseract en IndexedDB tras el primer reconocimiento.'],
      });
    } catch (e) {
      report('ocr-download', { title: 'OCR: descarga para uso sin conexión', status: 'fail', lines: [errorMessage(e)] });
    } finally {
      setBusy(null);
    }
  };

  const runSample = async (key: keyof typeof OCR_SAMPLES) => {
    const sample = OCR_SAMPLES[key];
    const id = `ocr-${key}`;
    const title = `OCR: imagen de prueba (${sample.lang})`;
    setBusy('Preparando OCR…');
    report(id, { title, status: 'running', lines: [`Conexión: ${navigator.onLine ? 'sí' : 'no (modo avión)'}`] });
    try {
      const r = await recognize(assetUrl(sample.image), sample.lang, (s) => setBusy(s));
      const expected = sample.lines.join('');
      const ratio = lcsRatio(expected, r.text);
      report(id, {
        title,
        status: ratio >= MIN_RATIO ? 'ok' : 'fail',
        lines: [
          `Conexión: ${navigator.onLine ? 'sí' : 'no (modo avión)'}`,
          `Carga del motor e idioma: ${formatMs(r.initMs)}; reconocimiento: ${formatMs(r.recognizeMs)}`,
          `Confianza media de Tesseract: ${Math.round(r.confidence)}%`,
          `Esperado: ${sample.lines.join(' / ')}`,
          `Leído: ${r.text.replace(/\n+/g, ' / ') || '(nada)'}`,
          `Coincidencia: ${Math.round(ratio * 100)}% (mínimo para aprobar: ${MIN_RATIO * 100}%)`,
        ],
      });
    } catch (e) {
      report(id, { title, status: 'fail', lines: [`ERROR: ${errorMessage(e)}`] });
    } finally {
      setBusy(null);
    }
  };

  const runPhoto = async (file: File | undefined, lang: Lang) => {
    if (!file) return;
    setPhoto(file);
    const title = `OCR: foto de la cámara (${lang})`;
    setBusy('Preparando OCR…');
    try {
      const r = await recognize(file, lang, (s) => setBusy(s));
      report('ocr-photo', {
        title,
        status: r.text ? 'info' : 'fail',
        lines: [
          `Carga: ${formatMs(r.initMs)}; reconocimiento: ${formatMs(r.recognizeMs)}; confianza ${Math.round(r.confidence)}%`,
          `Texto leído:\n${r.text || '(nada)'}`,
          'Revisa a ojo si el texto coincide con la foto.',
        ],
      });
    } catch (e) {
      report('ocr-photo', { title, status: 'fail', lines: [`ERROR: ${errorMessage(e)}`] });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const [photoLang, setPhotoLang] = useState<Lang>('jpn');

  return (
    <LabSection
      ids={['ocr-download', 'ocr-horizontal', 'ocr-vertical', 'ocr-photo']}
      anchor="ocr"
      title="b) OCR japonés (Tesseract.js)"
      description="Primero «Descargar y verificar» con conexión (≈ 8 MB: worker, motor WASM y modelos jpn y jpn_vert). Después repite las pruebas en modo avión: deben funcionar igual."
    >
      <Button variant="primary" block disabled={!!busy} onClick={download}>
        Descargar y verificar
      </Button>
      <div className="row-wrap">
        <img src={assetUrl(OCR_SAMPLES.horizontal.image)} alt="Texto de prueba horizontal" style={{ height: 70, border: '1px solid var(--c-border)' }} />
        <img src={assetUrl(OCR_SAMPLES.vertical.image)} alt="Texto de prueba vertical" style={{ height: 110, border: '1px solid var(--c-border)' }} />
      </div>
      <div className="input-row">
        <Button disabled={!!busy} onClick={() => runSample('horizontal')}>
          Probar horizontal
        </Button>
        <Button disabled={!!busy} onClick={() => runSample('vertical')}>
          Probar vertical
        </Button>
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void runPhoto(e.target.files?.[0], photoLang)} />
      <div className="input-row">
        <Button disabled={!!busy} onClick={() => { setPhotoLang('jpn'); input.current?.click(); }}>
          Foto (horizontal)
        </Button>
        <Button disabled={!!busy} onClick={() => { setPhotoLang('jpn_vert'); input.current?.click(); }}>
          Foto (vertical)
        </Button>
      </div>
      {photoUrl && <img src={photoUrl} alt="Foto para OCR" className="lab-media" />}
      {busy && <p className="muted small" role="status">{busy}</p>}
    </LabSection>
  );
}
