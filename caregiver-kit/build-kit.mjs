// Generic kit builder: HTML → Letter PDF + per-page PNGs.
// Usage: node build-kit.mjs src/holidays.html out/holidays home-for-the-holidays-is-it-time.pdf
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , srcArg, outArg, pdfName] = process.argv;
if (!srcArg || !outArg || !pdfName) { console.error('usage: node build-kit.mjs <src.html> <outdir> <pdf-name>'); process.exit(1); }
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, srcArg);
const out = resolve(here, outArg);
await mkdir(join(out, 'pages'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: join(out, pdfName), format: 'Letter', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await page.emulateMedia({ media: 'screen' });
const sections = await page.$$('section.page');
for (let i = 0; i < sections.length; i++) {
  await sections[i].screenshot({ path: join(out, 'pages', `page-${String(i + 1).padStart(2, '0')}.png`) });
}
console.log(`${pdfName}: ${sections.length} pages`);
await browser.close();
