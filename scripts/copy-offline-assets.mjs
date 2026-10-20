// Copia a public/ los recursos grandes que la app descarga bajo demanda
// (no se precachean al instalar). Se ejecuta antes de cada build.
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const pub = join(root, 'public');

const copies = [
  // OCR (Tesseract.js): worker, núcleo WASM (solo variantes LSTM) y modelos de idioma
  ['tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract/core/tesseract-core-lstm.wasm.js'],
  ['@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz', 'tesseract/lang/jpn.traineddata.gz'],
  ['@tesseract.js-data/jpn_vert/4.0.0_best_int/jpn_vert.traineddata.gz', 'tesseract/lang/jpn_vert.traineddata.gz'],
  // Traducción (Transformers.js → ONNX Runtime Web): binarios WASM
  ['@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs', 'ort/ort-wasm-simd-threaded.jsep.mjs'],
  ['@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm', 'ort/ort-wasm-simd-threaded.jsep.wasm'],
  // Visor de PDF (pdf.js): mapas de caracteres CJK, fuentes estándar y decodificadores.
  // Se precachean con la app para abrir PDF japoneses sin conexión.
  ['pdfjs-dist/cmaps', 'pdfjs/cmaps'],
  ['pdfjs-dist/standard_fonts', 'pdfjs/standard_fonts'],
  ['pdfjs-dist/wasm', 'pdfjs/wasm'],
];

for (const dir of ['tesseract', 'ort', 'pdfjs']) rmSync(join(pub, dir), { recursive: true, force: true });

for (const [from, to] of copies) {
  const src = join(nm, from);
  if (!existsSync(src)) {
    console.error(`Falta ${src}. Ejecuta npm ci.`);
    process.exit(1);
  }
  const dest = join(pub, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  const size = statSync(dest).isDirectory() ? 'carpeta' : `${(statSync(dest).size / 1048576).toFixed(1)} MB`;
  console.log(`copiado ${to} (${size})`);
}
