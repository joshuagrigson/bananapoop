// Square 2000x2000 listing images for the Holidays kit. Usage: node listing-holidays.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const pages = join(here, 'out', 'holidays', 'pages');
const outDir = join(here, 'out', 'holidays', 'listing');
await mkdir(outDir, { recursive: true });
const img = (n) => pathToFileURL(join(pages, `page-${String(n).padStart(2, '0')}.png`)).href;
const shadow = 'box-shadow:0 18px 40px rgba(31,78,95,.22),0 2px 6px rgba(0,0,0,.08);border-radius:6px;';
const base = `<style>html,body{margin:0;width:1000px;height:1000px;background:#f6f1ea;font-family:"Inter","DejaVu Sans",Arial,sans-serif;color:#1f4e5f;overflow:hidden}.frame{position:relative;width:1000px;height:1000px}img{display:block}.cap{position:absolute;left:0;right:0;text-align:center;font-weight:700}.pill{position:absolute;background:#c2673f;color:#fff;font-weight:700;font-size:20px;letter-spacing:.08em;text-transform:uppercase;padding:10px 18px;border-radius:999px}</style>`;
const scenes = {
  'holidays-1-cover.png': `${base}<div class="frame"><div class="pill" style="left:60px;top:56px">Instant download · PDF</div><img src="${img(1)}" style="position:absolute;left:230px;top:120px;width:540px;${shadow}transform:rotate(-2deg)"><div class="cap" style="bottom:52px;font-size:30px">8 printable pages · US Letter</div></div>`,
  'holidays-2-inside.png': `${base}<div class="frame"><div class="cap" style="top:48px;font-size:38px">Everything inside</div><div style="position:absolute;left:60px;right:60px;top:130px;display:flex;flex-wrap:wrap;justify-content:center;gap:20px">${[1,2,3,4,5,6,7,8].map((n) => `<img src="${img(n)}" style="width:200px;${shadow}">`).join('')}</div><div class="cap" style="bottom:70px;font-size:22px;color:#6b7278;font-weight:500">36 signs · the kitchen walk · three conversations · family debrief · green / yellow / red · next steps</div></div>`,
  'holidays-3-pair.png': `${base}<div class="frame"><div class="cap" style="top:48px;font-size:34px">Notice quietly. Talk without a fight.</div><img src="${img(3)}" style="position:absolute;left:70px;top:150px;width:420px;${shadow}transform:rotate(-3deg)"><img src="${img(5)}" style="position:absolute;left:510px;top:200px;width:420px;${shadow}transform:rotate(2deg)"><div class="cap" style="bottom:52px;font-size:22px;color:#6b7278;font-weight:500">The 36 signs, and the words to use if you see them</div></div>`,
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 2 });
for (const [name, html] of Object.entries(scenes)) {
  const tmp = join(outDir, name.replace('.png', '.html'));
  await writeFile(tmp, `<!doctype html><html><head><meta charset="utf-8">${html}</head><body></body></html>`);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outDir, name) });
}
await browser.close();
console.log('holidays listing images written');
