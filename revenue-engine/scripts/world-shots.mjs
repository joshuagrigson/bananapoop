// The world picker's pictures: every world shot through the game's own renderer, twice. <world>.webp is the whole
// station (the picker's tile and the preview's first look), <world>-room.webp is one room in close-up with its folk
// drawn big. Written to art/worlds/, which the station serves at /worlds/ and the preview copies.
//   npm run preview && node scripts/world-shots.mjs [world ...]
// Needs Playwright with Chromium (PLAYWRIGHT_MODULE and CHROMIUM_PATH can point at an installed copy).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previewDir = path.join(root, 'preview');
const out = path.join(root, 'art', 'worlds');
const ALL = ['space', 'castle', 'farm', 'cyber', 'alien', 'ocean', 'haunted', 'pumpkin', 'rocket', 'lab', 'mafia', 'gamer'];
const worlds = process.argv.slice(2).filter((w) => ALL.includes(w));
const W = 960, H = 600, Q = 0.84;

async function loadPlaywright() {
  for (const spec of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean)) {
    try { return await import(spec); } catch { /* next */ }
  }
  throw new Error('Playwright is needed: npm i -D playwright, or set PLAYWRIGHT_MODULE to an installed copy');
}
if (!fs.existsSync(path.join(previewDir, 'index.html'))) throw new Error('build the preview first: npm run preview');

// the preview, served from memory-free disk reads on a free port
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(previewDir, p);
  if (!f.startsWith(previewDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': (TYPES[path.extname(f)] || (p.includes('/api/') ? 'application/json' : 'application/octet-stream')) + '; charset=utf-8' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await loadPlaywright();
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
fs.mkdirSync(out, { recursive: true });
// nothing but the world: every panel, label and bar hidden
const CLEAN = '#pfMockBar,#rail,#topbar,#inspector,#insToggle,#comms,#toasts,#labels,#controls,#tabbar,#boot,#rtip,#tour,#dock,#sheetHandle,.float,.bubble{display:none!important} body{background:#000}';
const toWebp = async (page, png) => page.evaluate(async ({ b64, w, h, q }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/webp', q);
}, { b64: png.toString('base64'), w: W, h: H, q: Q });
const save = (name, dataUrl) => { const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'); fs.writeFileSync(path.join(out, name), buf); return buf.length; };

for (const w of worlds.length ? worlds : ALL) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('pf-toured', '1'); localStorage.setItem('proxyfolk-mock-auto', 'off'); } catch { /* fine */ } });
  await page.goto(`${base}/?skin=${w}&hour=16`, { waitUntil: 'load' });
  await page.addStyleTag({ content: CLEAN });
  await page.waitForTimeout(5000);
  // the whole station, a step closer than fit-all
  await page.mouse.move(W / 2, H / 2 + 20);
  await page.mouse.wheel(0, -420); await page.waitForTimeout(1800);
  const a = save(`${w}.webp`, await toWebp(page, await page.screenshot()));
  // the first room, walls up, folk big
  await page.keyboard.press('1'); await page.waitForTimeout(2600);
  await page.keyboard.press('v'); await page.waitForTimeout(2600);
  const b = save(`${w}-room.webp`, await toWebp(page, await page.screenshot()));
  console.log(`${w}: ${Math.round(a / 1024)} KB + ${Math.round(b / 1024)} KB`);
  await page.close();
}
await browser.close();
server.close();
