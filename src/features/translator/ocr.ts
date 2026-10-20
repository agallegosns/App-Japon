import type { Page, Worker } from 'tesseract.js';
import { assetUrl } from '../lab/offlineAssets';
import { cleanJapanese, japaneseCharCount } from './textUtils';

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

/** Confianza mínima de Tesseract para aceptar un párrafo (las fotos reales dan valores bajos). */
const MIN_CONFIDENCE = 25;
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

/**
 * Prepara la imagen para el OCR: escala de grises, contraste ampliado (percentiles 2–98 %) y,
 * opcionalmente, invertida. Tesseract lee mucho mejor texto oscuro sobre fondo claro: los carteles
 * con letras blancas sobre rojo/azul solo se leen tras invertirlos.
 */
export function enhance(source: HTMLCanvasElement, invert: boolean): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  const srcCtx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx || !srcCtx) throw new Error('No se pudo preparar la imagen.');
  const img = srcCtx.getImageData(0, 0, source.width, source.height);
  const d = img.data;
  const gray = new Uint8ClampedArray(d.length / 4);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = Math.round(0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0));
    gray[j] = v;
    hist[v] = (hist[v] ?? 0) + 1;
  }
  const total = gray.length;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v] ?? 0;
    if (acc >= total * 0.02) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v] ?? 0;
    if (acc >= total * 0.02) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let v = Math.round((((gray[j] ?? 0) - lo) * 255) / range);
    v = Math.max(0, Math.min(255, v));
    if (invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export interface OcrResult {
  blocks: OcrBlock[];
  /** Texto bruto de la mejor pasada, para explicar al usuario qué se leyó cuando no hay resultado. */
  rawText: string;
}

interface Pass {
  psm: 'sparse' | 'auto' | 'vertical';
  invert: boolean;
}

/** Pasadas en orden de más a menos probable; se corta en cuanto una da un resultado claramente bueno. */
const PASSES: Record<OcrMode, Pass[]> = {
  horizontal: [
    { psm: 'sparse', invert: false },
    { psm: 'sparse', invert: true },
    { psm: 'auto', invert: false },
    { psm: 'auto', invert: true },
  ],
  vertical: [
    { psm: 'vertical', invert: false },
    { psm: 'vertical', invert: true },
    { psm: 'sparse', invert: false },
    { psm: 'sparse', invert: true },
  ],
};

/** Puntuación de una pasada: caracteres japoneses ponderados por la confianza. */
export function scoreBlocks(blocks: OcrBlock[]): number {
  return blocks.reduce((sum, b) => sum + japaneseCharCount(b.text) * (b.confidence / 100), 0);
}

const GOOD_ENOUGH = 6;
/** Siempre se hacen al menos estas pasadas (normal e invertida). */
const MIN_PASSES = 2;

function extractBlocks(data: Page, mode: OcrMode, image: HTMLCanvasElement): OcrBlock[] {
  const blocks: OcrBlock[] = [];
  for (const block of data.blocks ?? []) {
    for (const p of block.paragraphs) {
      const text = cleanJapanese(p.lines.map((l) => l.text).join('\n'));
      const jp = japaneseCharCount(text);
      if (!text || jp === 0 || p.confidence < MIN_CONFIDENCE) continue;
      // Un solo carácter suelto con poca confianza suele ser ruido (p. ej. «一» o «ー»).
      if (jp < 2 && p.confidence < 70) continue;
      blocks.push({ text, bbox: p.bbox, confidence: p.confidence });
    }
  }
  // Si Tesseract devolvió texto sin estructura, se usa como un único bloque que ocupa toda la imagen.
  const fallback = cleanJapanese(data.text);
  if (blocks.length === 0 && japaneseCharCount(fallback) >= 2 && data.confidence >= MIN_CONFIDENCE)
    blocks.push({ text: fallback, bbox: { x0: 0, y0: 0, x1: image.width, y1: image.height }, confidence: data.confidence });
  return sortBlocks(blocks, mode);
}

export function sortBlocks(blocks: OcrBlock[], mode: OcrMode): OcrBlock[] {
  return [...blocks].sort((a, b) =>
    mode === 'vertical' ? b.bbox.x0 - a.bbox.x0 || a.bbox.y0 - b.bbox.y0 : a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0,
  );
}

function overlapRatio(a: Bbox, b: Bbox): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return 0;
  const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return smaller > 0 ? (w * h) / smaller : 0;
}

/**
 * Añade a `base` los bloques de `extra` que no ocupan el mismo sitio. Si ocupan el mismo sitio gana el de más
 * puntuación. Los bloques de pasadas posteriores deben tener algo más de confianza para evitar ruido.
 */
export function mergeBlocks(base: OcrBlock[], extra: OcrBlock[], strict: boolean): OcrBlock[] {
  const out = [...base];
  for (const cand of extra) {
    if (strict && (cand.confidence < 55 || japaneseCharCount(cand.text) < 2)) continue;
    const i = out.findIndex((b) => overlapRatio(b.bbox, cand.bbox) > 0.3);
    if (i === -1) out.push(cand);
    else if (scoreBlocks([cand]) > scoreBlocks([out[i] as OcrBlock])) out[i] = cand;
  }
  return out;
}

/** Motor OCR reutilizable: carga Tesseract una vez y lo mantiene mientras se usa el traductor. */
export class OcrEngine {
  private worker: Worker | null = null;
  private mode: OcrMode | null = null;

  async recognize(image: HTMLCanvasElement, mode: OcrMode, onStatus: (s: string) => void): Promise<OcrResult> {
    const worker = await this.ensure(mode, onStatus);
    const { PSM } = await import('tesseract.js');
    const psmOf = { sparse: PSM.SPARSE_TEXT, auto: PSM.AUTO, vertical: PSM.SINGLE_BLOCK_VERT_TEXT } as const;
    const passes = PASSES[mode];
    let merged: OcrBlock[] = [];
    let rawText = '';
    for (const [i, pass] of passes.entries()) {
      onStatus(`Leyendo el texto… (intento ${i + 1} de ${passes.length})`);
      await worker.setParameters({ tessedit_pageseg_mode: psmOf[pass.psm] });
      const { data } = await worker.recognize(enhance(image, pass.invert), {}, { blocks: true });
      const found = extractBlocks(data, mode, image);
      // Las pasadas se complementan: letras claras sobre fondo oscuro solo salen al invertir la imagen
      // y las oscuras sobre fondo claro, sin invertir. Se suman los bloques que no se solapan.
      merged = mergeBlocks(merged, found, i > 0);
      if (data.text.trim().length > rawText.length) rawText = data.text.trim();
      if (i >= MIN_PASSES - 1 && scoreBlocks(merged) >= GOOD_ENOUGH) break;
    }
    return { blocks: sortBlocks(merged, mode), rawText };
  }

  private async ensure(mode: OcrMode, onStatus: (s: string) => void): Promise<Worker> {
    if (this.worker && this.mode === mode) return this.worker;
    await this.dispose();
    const { createWorker, OEM } = await import('tesseract.js');
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
