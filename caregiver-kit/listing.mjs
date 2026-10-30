// Builds square 2000x2000 listing images from the page PNGs in out/pages.
// Usage: node listing.mjs   (run build.mjs first)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const pages = join(here, 'out', 'pages');
const outDir = join(here, 'out', 'listing');
await mkdir(outDir, { recursive: true });

const img = (n) => pathToFileURL(join(pages, `page-${String(n).padStart(2, '0')}.png`)).href;
const shadow = 'box-shadow: 0 18px 40px rgba(31,78,95,0.22), 0 2px 6px rgba(0,0,0,0.08); border-radius: 6px;';
const base = `
  <style>
    html,body{margin:0;width:1000px;height:1000px;background:#f6f1ea;font-family:"Inter","DejaVu Sans",Arial,sans-serif;color:#1f4e5f;overflow:hidden}
    .frame{position:relative;width:1000px;height:1000px}
    img{display:block}
    .cap{position:absolute;left:0;right:0;text-align:center;font-weight:700}
    .pill{position:absolute;background:#c2673f;color:#fff;font-weight:700;font-size:20px;letter-spacing:.08em;text-transform:uppercase;padding:10px 18px;border-radius:999px}
  </style>`;

const scenes = {
  // 1. Hero: the cover, angled slightly, on sand.
  'listing-1-cover.png': `${base}<div class="frame">
    <div class="pill" style="left:60px;top:56px">Instant download · PDF</div>
    <img src="${img(1)}" style="position:absolute;left:230px;top:120px;width:540px;${shadow}transform:rotate(-2deg)">
    <div class="cap" style="bottom:52px;font-size:30px">14 printable pages · US Letter</div>
  </div>`,
  // 2. What's inside: 7 x 2 grid of every page.
  'listing-2-inside.png': `${base}<div class="frame">
    <div class="cap" style="top:48px;font-size:38px">Everything inside</div>
    <div style="position:absolute;left:40px;right:40px;top:120px;display:flex;flex-wrap:wrap;justify-content:center;gap:18px">
      ${Array.from({ length: 14 }, (_, i) => `<img src="${img(i + 1)}" style="width:166px;${shadow}">`).join('')}
    </div>
    <div class="cap" style="bottom:70px;font-size:22px;color:#6b7278;font-weight:500">Roadmap · fridge sheet · contacts · medication list &amp; log · appointments · doctor questions · documents · daily log · home safety · caregiver check-in · call log</div>
  </div>`,
  // 3. Week-1 pair: fridge sheet + medication list.
  'listing-3-week1.png': `${base}<div class="frame">
    <div class="cap" style="top:48px;font-size:34px">Week 1: stabilize</div>
    <img src="${img(4)}" style="position:absolute;left:70px;top:150px;width:420px;${shadow}transform:rotate(-3deg)">
    <img src="${img(6)}" style="position:absolute;left:510px;top:200px;width:420px;${shadow}transform:rotate(2deg)">
    <div class="cap" style="bottom:52px;font-size:22px;color:#6b7278;font-weight:500">The two pages every doctor and ER will ask for</div>
  </div>`,
  // 4. Roadmap + caregiver check-in.
  'listing-4-plan.png': `${base}<div class="frame">
    <div class="cap" style="top:48px;font-size:34px">A plan for the month, and a page for you</div>
    <img src="${img(3)}" style="position:absolute;left:70px;top:150px;width:420px;${shadow}transform:rotate(2deg)">
    <img src="${img(13)}" style="position:absolute;left:510px;top:200px;width:420px;${shadow}transform:rotate(-2deg)">
    <div class="cap" style="bottom:52px;font-size:22px;color:#6b7278;font-weight:500">Four weeks, one focus each · a five-minute weekly check-in</div>
  </div>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 2 });
for (const [name, html] of Object.entries(scenes)) {
  const tmp = join(outDir, name.replace('.png', '.html'));
  await writeFile(tmp, `<!doctype html><html><head><meta charset="utf-8">${html}</body></html>`);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outDir, name) });
}
await browser.close();
console.log('listing images written to', outDir);
