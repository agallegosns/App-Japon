/** Utilidades de texto del traductor (funciones puras, con tests). */

const CJK = '\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef';
const SPACE_BETWEEN_CJK = new RegExp(`(?<=[${CJK}])[ \\t\\u3000]+(?=[${CJK}])`, 'g');
const HAS_JAPANESE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/** Tesseract separa los caracteres japoneses con espacios: se eliminan y se normalizan los saltos de línea. */
export function cleanJapanese(text: string): string {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(SPACE_BETWEEN_CJK, '').replace(/[ \t\u3000]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function hasJapanese(text: string): boolean {
  return HAS_JAPANESE.test(text);
}

const encoder = new TextEncoder();

export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Parte un texto en trozos de como máximo `maxBytes` bytes UTF-8, cortando preferentemente
 * en saltos de línea o signos de puntuación japoneses y nunca en mitad de un carácter.
 */
export function chunkText(text: string, maxBytes = 450): string[] {
  const chunks: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };
  const pieces = text.split(/(?<=[\n。！？!?])/u);
  for (const piece of pieces) {
    if (utf8Bytes(piece) > maxBytes) {
      flush();
      let part = '';
      for (const ch of piece) {
        if (utf8Bytes(part + ch) > maxBytes) {
          chunks.push(part.trim());
          part = '';
        }
        part += ch;
      }
      current = part;
      continue;
    }
    if (utf8Bytes(current + piece) > maxBytes) flush();
    current += piece;
  }
  flush();
  return chunks.filter(Boolean);
}

/** Reparte el texto en líneas que quepan en `maxWidth` según la función de medida. */
export function wrapWords(text: string, maxWidth: number, measure: (t: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Mayor tamaño de letra (entre min y max) con el que el texto cabe en la caja. */
export function fitFontSize(
  text: string,
  box: { width: number; height: number },
  measureAt: (fontPx: number, t: string) => number,
  opts: { min: number; max: number; lineHeight?: number },
): { fontPx: number; lines: string[] } {
  const lh = opts.lineHeight ?? 1.15;
  let best: { fontPx: number; lines: string[] } | null = null;
  for (let px = Math.floor(opts.max); px >= opts.min; px--) {
    const lines = wrapWords(text, box.width, (t) => measureAt(px, t));
    if (lines.length * px * lh <= box.height) return { fontPx: px, lines };
    best = { fontPx: px, lines };
  }
  return best ?? { fontPx: opts.min, lines: [text] };
}
