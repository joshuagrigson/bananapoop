// Renders the rebuild pins (1000x1500) and pins.json.
// Usage: node render.mjs <artRoot>   artRoot holds repo/ (bananapoop clone) and prep/ (90-day pages) and node_modules/playwright-core
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { BOARDS, PINS } from './plan.mjs';

const root = process.argv[2] || 'C:/bp';
const require = createRequire(join(root, 'package.json'));
const { chromium } = require('playwright-core');
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'pins');
await mkdir(out, { recursive: true });

const pad = (n) => String(n).padStart(2, '0');
const src = (k, n) => 'data:image/png;base64,' + readFileSync({
  c: join(root, 'repo/caregiver-kit/out/pages', `page-${pad(n)}.png`),
  h: join(root, 'repo/caregiver-kit/out/hospital/pages', `page-${pad(n)}.png`),
  v: join(root, 'repo/caregiver-kit/out/holidays/pages', `page-${pad(n)}.png`),
  p: join(root, 'prep', `p${pad(n)}.png`),
}[k]).toString('base64');

const T = {
  cream: { bg: '#f4ede3', ink: '#1d3b47', sub: '#5d6a70', acc: '#c45c32', foot: '#1d3b47', footInk: '#fff' },
  teal:  { bg: '#1d4f5e', ink: '#ffffff', sub: '#cfe1e6', acc: '#f2b544', foot: '#f2b544', footInk: '#1d3b47' },
  clay:  { bg: '#b9542c', ink: '#ffffff', sub: '#f7dccd', acc: '#fff1d6', foot: '#1d3b47', footInk: '#fff' },
  sage:  { bg: '#dfe8dc', ink: '#203c32', sub: '#4f6157', acc: '#2f7d5b', foot: '#203c32', footInk: '#fff' },
  navy:  { bg: '#16243a', ink: '#ffffff', sub: '#c9d3e2', acc: '#e98a5b', foot: '#e98a5b', footInk: '#16243a' },
};

const html = (p) => {
  const t = T[p.theme];
  const imgs = [];
  for (let i = 0; i < p.art.length; i += 2) imgs.push(src(p.art[i], p.art[i + 1]));
  const art = imgs.length === 2
    ? `<img class="a2b" src="${imgs[1]}"><img class="a2f" src="${imgs[0]}">`
    : `<img class="a1" src="${imgs[0]}">`;
  const free = /free/i.test(p.kicker) || p.b === 'prep' || p.b === 'food' || p.b === 'power' || p.link.includes('#free');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1000px;height:1500px;overflow:hidden}
.f{position:relative;width:1000px;height:1500px;background:${t.bg};color:${t.ink};font-family:Georgia,'Times New Roman',serif}
.k{position:absolute;left:72px;top:70px;font:700 24px/1 'Segoe UI',Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${t.acc}}
.k:before{content:'';display:inline-block;width:46px;height:4px;background:${t.acc};vertical-align:middle;margin-right:16px;margin-top:-4px}
.h{position:absolute;left:72px;right:72px;top:126px;font-weight:700;font-size:${p.head.length > 46 ? 66 : 76}px;line-height:1.04;letter-spacing:-.02em;text-wrap:balance}
.s{position:absolute;left:72px;right:72px;top:${p.head.length > 46 ? 420 : 400}px;font:500 31px/1.35 'Segoe UI',Arial,sans-serif;color:${t.sub}}
.art{position:absolute;left:0;right:0;top:540px;bottom:110px;overflow:hidden}
.art img{position:absolute;display:block;border-radius:6px;box-shadow:0 30px 60px rgba(0,0,0,.28),0 3px 8px rgba(0,0,0,.12);background:#fff}
.a1{left:150px;top:40px;width:700px;transform:rotate(1.8deg)}
.a2b{left:330px;top:30px;width:560px;transform:rotate(5deg)}
.a2f{left:110px;top:70px;width:560px;transform:rotate(-3deg)}
.badge{position:absolute;right:60px;top:560px;z-index:5;background:${t.acc};color:${p.theme==='clay'?'#b9542c':'#fff'};font:800 26px/1 'Segoe UI',Arial,sans-serif;letter-spacing:.08em;padding:18px 24px;border-radius:999px;transform:rotate(6deg);box-shadow:0 8px 20px rgba(0,0,0,.2)}
.ft{position:absolute;left:0;right:0;bottom:0;height:110px;background:${t.foot};color:${t.footInk};display:flex;align-items:center;justify-content:space-between;padding:0 72px;font:700 28px/1 'Segoe UI',Arial,sans-serif}
.ft span:last-child{font-weight:500;opacity:.9}
</style></head><body><div class="f">
<div class="k">${p.kicker}</div><div class="h">${p.head}</div><div class="s">${p.sub}</div>
<div class="art">${art}</div>${free ? '<div class="badge">FREE PRINTABLE</div>' : '<div class="badge">PRINTABLE PDF</div>'}
<div class="ft"><span>Prepared at Home</span><span>preparedathome.netlify.app</span></div>
</div></body></html>`;
};

const browser = await chromium.launch({ executablePath: 'C://Program Files//Google//Chrome//Application//chrome.exe', headless: true, args: ['--headless=new','--no-sandbox','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
const rows = [];
let n = 0;
for (const p of PINS) {
  n++;
  const file = `r${pad(n)}-${p.b}.png`;
  await page.setContent(html(p), { waitUntil: 'load' });
  await page.screenshot({ path: join(out, file), type: 'png' });
  const board = BOARDS.find((b) => b.key === p.b);
  if (p.title.length > 100) throw new Error(`title too long: ${p.title}`);
  if (p.desc.length > 500) throw new Error(`desc too long: ${p.title}`);
  rows.push({ seq: n, file, board: board.name, title: p.title, description: p.desc, alt_text: p.alt, link: p.link });
}
await browser.close();
await writeFile(join(here, 'pins.json'), JSON.stringify({ boards: BOARDS, pins: rows }, null, 2));
console.log(`rendered ${rows.length} pins`);
