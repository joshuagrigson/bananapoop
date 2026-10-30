// Builds the printable PDF and listing preview images from src/kit.html.
// Usage: node build.mjs   (requires the pre-installed Playwright + Chromium)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
// The sandbox's Playwright is a global CommonJS install; ESM import can't see it.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src', 'kit.html');
const out = join(here, 'out');
await mkdir(join(out, 'pages'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });

// 1. The product: a vector PDF, Letter size, backgrounds on.
await page.pdf({
  path: join(out, 'first-30-days-caregiver-kit.pdf'),
  format: 'Letter',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

// 2. Page previews (PNG, 2x) for listing images and the Pinterest pins.
await page.emulateMedia({ media: 'screen' });
const sections = await page.$$('section.page');
const names = [];
for (let i = 0; i < sections.length; i++) {
  const file = `page-${String(i + 1).padStart(2, '0')}.png`;
  await sections[i].screenshot({ path: join(out, 'pages', file) });
  names.push(file);
}
console.log(`PDF written, ${sections.length} pages captured: ${names.join(', ')}`);
await browser.close();
