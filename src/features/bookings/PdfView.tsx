import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import { ErrorState, LoadingState } from '../../ui/States';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const PDFJS_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

/** Renderiza todas las páginas de un PDF en canvas (funciona sin conexión). */
export function PdfView({ blob }: { blob: Blob }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | { error: unknown }>('loading');
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let task: pdfjs.PDFDocumentLoadingTask | null = null;
    const el = container.current;
    (async () => {
      const data = new Uint8Array(await blob.arrayBuffer());
      task = pdfjs.getDocument({
        data,
        cMapUrl: `${PDFJS_BASE}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`,
        wasmUrl: `${PDFJS_BASE}wasm/`,
        enableXfa: false,
      });
      const doc = await task.promise;
      if (cancelled || !el) return;
      setPages(doc.numPages);
      const width = Math.min(el.clientWidth || window.innerWidth, 1200);
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = (width / base.width) * ratio;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.className = 'pdf-page';
        canvas.setAttribute('aria-label', `Página ${n} de ${doc.numPages}`);
        canvas.setAttribute('role', 'img');
        el.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
        if (n === 1 && !cancelled) setState('ok');
      }
    })().catch((error: unknown) => {
      if (!cancelled) setState({ error });
    });
    return () => {
      cancelled = true;
      if (el) el.replaceChildren();
      void task?.destroy();
    };
  }, [blob]);

  return (
    <div>
      {state === 'loading' && <LoadingState label="Abriendo PDF…" />}
      {typeof state === 'object' && <ErrorState error={state.error} title="No se pudo abrir el PDF" />}
      {pages > 0 && <p className="visually-hidden">{pages} páginas</p>}
      <div ref={container} className="pdf-pages" />
    </div>
  );
}
