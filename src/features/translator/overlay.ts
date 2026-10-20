import type { Bbox } from './ocr';
import { fitFontSize } from './textUtils';

export interface OverlayItem {
  bbox: Bbox;
  text: string;
}

const FONT = '600 {px}px -apple-system, "Helvetica Neue", Arial, sans-serif';

/**
 * Caja donde se pinta la traducción. En texto horizontal es la propia caja del texto original.
 * En texto vertical (estrecho y alto) se ensancha para que el español sea legible.
 */
export function overlayRect(bbox: Bbox, canvasW: number, canvasH: number, vertical: boolean): { x: number; y: number; w: number; h: number } {
  const pad = 4;
  let x = bbox.x0 - pad;
  let y = bbox.y0 - pad;
  let w = bbox.x1 - bbox.x0 + pad * 2;
  let h = bbox.y1 - bbox.y0 + pad * 2;
  if (vertical || w < canvasW * 0.18) {
    const minW = Math.min(canvasW * 0.34, canvasW - 8);
    if (w < minW) {
      x -= (minW - w) / 2;
      w = minW;
    }
    h = Math.max(h, 44);
  }
  x = Math.max(2, Math.min(x, canvasW - w - 2));
  y = Math.max(2, Math.min(y, canvasH - h - 2));
  return { x, y, w, h };
}

/** Pinta las traducciones sobre la foto, como en un traductor de cámara. */
export function drawOverlay(ctx: CanvasRenderingContext2D, items: OverlayItem[], vertical: boolean): void {
  const { width, height } = ctx.canvas;
  for (const item of items) {
    const r = overlayRect(item.bbox, width, height, vertical);
    const inner = { width: r.w - 12, height: r.h - 8 };
    const fit = fitFontSize(item.text, inner, (px, t) => {
      ctx.font = FONT.replace('{px}', String(px));
      return ctx.measureText(t).width;
    }, { min: 11, max: Math.min(44, Math.max(14, r.h * 0.8)) });
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(180,30,40,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = FONT.replace('{px}', String(fit.fontPx));
    ctx.textBaseline = 'top';
    const lh = fit.fontPx * 1.15;
    const total = fit.lines.length * lh;
    let y = r.y + Math.max(4, (r.h - total) / 2);
    for (const line of fit.lines) {
      ctx.fillText(line, r.x + 6, y);
      y += lh;
    }
  }
}
