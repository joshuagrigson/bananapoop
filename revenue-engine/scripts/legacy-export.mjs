// The legacy pixel art: the pixel engine as it stood at commit a9eba0c (the version before the smooth renderer),
// exported through a small hook added to that commit's src/station.html (window.__PF_LEGACY, ?export only).
// Every sprite at its native size and scaled up with hard pixel edges, plus the pixel world of each station.
//   node legacy-export.mjs <legacy preview dir> <outDir>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [previewDir, out] = process.argv.slice(2).map((p) => path.resolve(p));
const WORLDS = ['space', 'castle', 'farm', 'cyber', 'alien', 'ocean'];
const STATIONS = [['family', '/family/'], ['barber', '/barber/'], ['business', '/']];   // family first: the kids' colors come from it
const write = (rel, data) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); return rel; };
const writePng = (rel, url) => write(rel, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(dir, p);
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/json' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const srv = await serve(previewDir), base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('pf-toured', '1'); } catch { /* ignore */ } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const M = { from: 'commit a9eba0c, the pixel engine', characters: [], residents: [], worlds: [], skies: [] };

// lay sprites out as a sheet in the page, native and scaled with hard edges; returns both PNGs and the frame boxes
async function sheet(cells, scale) {
  return page.evaluate(async ([cells, scale]) => {
    const imgs = await Promise.all(cells.map(async (r) => Promise.all(r.map(async (c) => { if (!c) return null; const i = new Image(); i.src = c.png; await i.decode(); return i; }))));
    const cw = Math.max(...cells.flat().filter(Boolean).map((c) => c.w)), ch = Math.max(...cells.flat().filter(Boolean).map((c) => c.h));
    const cols = Math.max(...cells.map((r) => r.length));
    const n = document.createElement('canvas'); n.width = cols * cw; n.height = cells.length * ch;
    const g = n.getContext('2d'), frames = {};
    imgs.forEach((r, y) => r.forEach((im, x) => { if (!im) return; const dx = x * cw + Math.floor((cw - im.width) / 2), dy = y * ch + (ch - im.height); g.drawImage(im, dx, dy); frames[`${y}_${x}`] = { x: x * cw, y: y * ch, w: cw, h: ch }; }));
    const b = document.createElement('canvas'); b.width = n.width * scale; b.height = n.height * scale;
    const bg = b.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(n, 0, 0, b.width, b.height);
    return { native: n.toDataURL(), big: b.toDataURL(), w: n.width, h: n.height, cw, ch, frames };
  }, [cells, scale]);
}
const ROWS = [['front', [['front', 'stand'], ['front', 'walkA'], ['front', 'walkB']]], ['back', [['back', 'stand'], ['back', 'walkA'], ['back', 'walkB']]], ['seated', [['seat', 'stand'], ['seat', 'typeB']]]];

let kids = [];
for (const world of WORLDS) {
  for (const [station, pth] of STATIONS) {
    await page.goto(`${base}${pth}?export&hd=0&skin=${world}&hour=12`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__PF_LEGACY && window.__PF_LEGACY.ready(), null, { timeout: 60000 });
    await page.waitForTimeout(4000);
    if (station === 'family') kids = await page.evaluate(() => window.__PF_LEGACY.kids());
    // the pixel world of this station: the world buffer alone (transparent) and over its sky, native and x3
    const w = await page.evaluate(async () => {
      const L = window.__PF_LEGACY, wd = L.world(), sky = L.sky(wd.w, wd.h);
      const load = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
      const [wi, si] = [await load(wd.png), await load(sky.png)];
      const c = document.createElement('canvas'); c.width = wd.w; c.height = wd.h; const g = c.getContext('2d');
      g.drawImage(si, (wd.w - si.width) / 2, (wd.h - si.height) / 2); g.drawImage(wi, 0, 0);
      const up = (src, k) => { const b = document.createElement('canvas'); b.width = src.width * k; b.height = src.height * k; const bg = b.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(src, 0, 0, b.width, b.height); return b.toDataURL(); };
      const wc = document.createElement('canvas'); wc.width = wd.w; wc.height = wd.h; wc.getContext('2d').drawImage(wi, 0, 0);
      return { clear: wd.png, clear3: up(wc, 3), sky: c.toDataURL(), sky3: up(c, 3), w: wd.w, h: wd.h };
    });
    for (const [k, v] of [['clear', w.clear], ['clear@3x', w.clear3], ['day', w.sky], ['day@3x', w.sky3]]) { const rel = `legacy-pixel/maps/${station}/${world}-${k}.png`; writePng(rel, v); M.worlds.push({ file: rel, station, world, variant: k }); }
    if (station !== 'barber') continue;
    // the sky alone, at the pixel world's size
    const sky = await page.evaluate(() => window.__PF_LEGACY.sky(960, 600));
    M.skies.push({ file: writePng(`legacy-pixel/backgrounds/${world}.png`, sky.png), world, size: [sky.w, sky.h] });
    // crew: every role in this world's outfit, front, back and seated, standing and both walk steps
    const roles = await page.evaluate(() => window.__PF_LEGACY.roles());
    for (const role of roles) {
      const cells = [];
      for (const [, fr] of ROWS) cells.push(await Promise.all(fr.map(([v, f]) => page.evaluate(([v2, f2, r2]) => window.__PF_LEGACY.crew(v2, f2, r2, null, false), [v, f, role]))));
      const s = await sheet(cells, 8);
      const nm = role === 'commander' ? 'you-commander' : role;
      M.characters.push({ world, name: nm, role, native: writePng(`legacy-pixel/characters/${world}/${nm}.png`, s.native), x8: writePng(`legacy-pixel/characters/${world}/${nm}@8x.png`, s.big), cell: [s.cw, s.ch], rows: ROWS.map(([n, fr]) => ({ name: n, frames: fr.map(([, f]) => f) })) });
    }
    // kids: the family's children, shorter, in their own color
    for (const kid of kids) {
      const cells = [];
      for (const [, fr] of ROWS) cells.push(await Promise.all(fr.map(([v, f]) => page.evaluate(([v2, f2, t]) => window.__PF_LEGACY.crew(v2, f2, 'prospector', t, true), [v, f, kid.color]))));
      const s = await sheet(cells, 8);
      const nm = 'kid-' + kid.name.toLowerCase();
      M.characters.push({ world, name: nm, kid: kid.name, colour: kid.color, native: writePng(`legacy-pixel/characters/${world}/${nm}.png`, s.native), x8: writePng(`legacy-pixel/characters/${world}/${nm}@8x.png`, s.big), cell: [s.cw, s.ch], rows: ROWS.map(([n, fr]) => ({ name: n, frames: fr.map(([, f]) => f) })) });
    }
    // residents of the world's room looks (skeletons, cows, clownfish...), standing and stepping
    for (const lk of await page.evaluate(() => window.__PF_LEGACY.looks())) {
      const cells = [[await page.evaluate((id) => window.__PF_LEGACY.resident(id, 0), lk.id), await page.evaluate((id) => window.__PF_LEGACY.resident(id, 1), lk.id)]];
      if (!cells[0][0]) continue;
      const s = await sheet(cells, 8);
      const nm = lk.resident.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      M.residents.push({ world, look: lk.id, name: lk.resident, native: writePng(`legacy-pixel/characters/${world}/resident-${nm}.png`, s.native), x8: writePng(`legacy-pixel/characters/${world}/resident-${nm}@8x.png`, s.big), cell: [s.cw, s.ch] });
    }
    console.log(world, 'done');
  }
}
write('legacy-pixel/manifest.json', JSON.stringify(M, null, 1));
console.log(`legacy: ${M.characters.length} crew sheets, ${M.residents.length} residents, ${M.worlds.length} world images, ${M.skies.length} skies`);
if (errors.length) console.log('errors', errors.slice(0, 5));
await browser.close(); srv.close();
