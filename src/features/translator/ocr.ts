import type { Worker } from 'tesseract.js';
import { assetUrl } from '../lab/offlineAssets';
import { cleanJapanese, hasJapanese } from './textUtils';

export type OcrMode = 'horizontal' | 'vertical';

export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrBlock {
  text: string;
  bbox: Bbox;
  confidence: number;
}

const MIN_CONFIDENCE = 40;
export const MAX_IMAGE_SIDE = 1600;

/** Copia la imagen en un canvas reducido (máx. 1600 px) para que el reconocimiento sea rápido. */
export function toCanvas(source: HTMLVideoElement | HTMLImageElement | ImageBitmap): HTMLCanvasElement {
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!w || !h) throw new Error('La imagen está vacía.');
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen.');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Motor OCR reutilizable: carga Tesseract una vez y lo mantiene mientras se usa el traductor. */
export class OcrEngine {
  private worker: Worker | null = null;
  private mode: OcrMode | null = null;

  async recognize(image: HTMLCanvasElement, mode: OcrMode, onStatus: (s: string) => void): Promise<OcrBlock[]> {
    const worker = await this.ensure(mode, onStatus);
    onStatus('Leyendo el texto…');
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const blocks: OcrBlock[] = [];
    for (const block of data.blocks ?? []) {
      for (const p of block.paragraphs) {
        const text = cleanJapanese(p.lines.map((l) => l.text).join('\n'));
        if (!text || !hasJapanese(text) || p.confidence < MIN_CONFIDENCE) continue;
        blocks.push({ text, bbox: p.bbox, confidence: p.confidence });
      }
    }
    return blocks.sort((a, b) =>
      mode === 'vertical' ? b.bbox.x0 - a.bbox.x0 || a.bbox.y0 - b.bbox.y0 : a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0,
    );
  }

  private async ensure(mode: OcrMode, onStatus: (s: string) => void): Promise<Worker> {
    if (this.worker && this.mode === mode) return this.worker;
    await this.dispose();
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    const lang = mode === 'vertical' ? 'jpn_vert' : 'jpn';
    const worker = await createWorker(lang, OEM.LSTM_ONLY, {
      workerPath: assetUrl('tesseract/worker.min.js'),
      corePath: assetUrl('tesseract/core/'),
      langPath: assetUrl('tesseract/lang'),
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'write',
      logger: (m) => onStatus(`Preparando el lector de japonés… ${Math.round(m.progress * 100)}%`),
    });
    if (mode === 'vertical') await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK_VERT_TEXT });
    this.worker = worker;
    this.mode = mode;
    return worker;
  }

  async dispose(): Promise<void> {
    const w = this.worker;
    this.worker = null;
    this.mode = null;
    if (w) await w.terminate();
  }
}
