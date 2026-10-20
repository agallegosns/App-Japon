// Genera las imágenes de prueba del OCR (public/lab/*.png) con texto japonés genérico,
// usando la fuente Noto Sans JP autoalojada. Solo hace falta ejecutarlo si cambian los textos.
// Uso: node scripts/generate-lab-images.mjs <ruta-a-playwright-core> [ruta-a-chromium]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [pwPath, chromiumPath = '/opt/pw-browsers/chromium'] = process.argv.slice(2);
if (!pwPath) {
  console.error('Indica la ruta a playwright-core');
  process.exit(1);
}
const { chromium } = await import(pathToFileURL(join(pwPath, 'index.mjs')).href);

const samplesSrc = readFileSync(join(root, 'src/features/lab/samples.ts'), 'utf8');
const lines = (key) => {
  const block = samplesSrc.split(`${key}: {`)[1];
  return JSON.parse(block.split('lines: ')[1].split(',\n')[0].replace(/'/g, '"'));
};
const font = readFileSync(join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff2')).toString('base64');
const css = `@font-face{font-family:N;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:700}
body{margin:0;background:#fff;color:#111;font-family:N;font-weight:700}`;

const browser = await chromium.launch({ executablePath: chromiumPath });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function shot(html, out, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<style>${css}</style>${html}`);
  await page.evaluate(() => globalThis.document.fonts.ready);
  writeFileSync(join(root, out), await page.screenshot({ type: 'png' }));
  console.log('generado', out);
}

await shot(
  `<div style="padding:40px 48px;font-size:52px;line-height:1.6">${lines('horizontal').map((l) => `<div>${l}</div>`).join('')}</div>`,
  'public/lab/ocr-horizontal.png',
  820,
  340,
);
await shot(
  `<div style="padding:40px;font-size:60px;line-height:1.7;writing-mode:vertical-rl;height:430px">${lines('vertical').map((l) => `<div>${l}</div>`).join('')}</div>`,
  'public/lab/ocr-vertical.png',
  320,
  510,
);
await browser.close();
