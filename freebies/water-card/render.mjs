// Render card.html to a Letter PDF and a PNG preview. Usage: node render.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
await p.goto(pathToFileURL(path.join(here, 'card.html')).href);
await p.waitForFunction(() => document.fonts.status === 'loaded');
const over = await p.evaluate(() => { const pg = document.querySelector('.page'); return pg.scrollHeight - pg.clientHeight; });
console.log('overflow px:', over);
await p.pdf({ path: path.join(here, 'prepared-at-home-water-card.pdf'), format: 'Letter', printBackground: true });
await p.screenshot({ path: path.join(here, 'water-card-preview.png') });
await b.close();
