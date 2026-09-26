// The art handoff: every character, room, backdrop and map of Proxyfolk rendered to PNG through the game's own
// renderer (src/station.html, switched into export mode with ?export), packed with sprite-sheet atlases, a manifest,
// a gallery page, the source and a standalone character renderer.
//   npm run preview && node scripts/export-art.mjs [outDir]
//   node scripts/export-art.mjs [outDir] --docs      rewrite only HANDOFF.md, the gallery and code/ from the current source
// Needs Playwright with Chromium (PLAYWRIGHT_MODULE and CHROMIUM_PATH can point at an installed copy).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(root, 'art-handoff'));
const previewDir = path.join(root, 'preview');
const STATIONS = [['barber', '/barber/', 'The barbershop'], ['family', '/family/', 'The family chores farm'], ['business', '/', 'The business paths station']];
const WORLDS = ['space', 'castle', 'farm', 'cyber', 'alien', 'ocean'];
const THEMES = ['barber', 'salon', 'shop', 'kitchen', 'bedroom', 'study', 'laundry', 'pets', 'trash', 'yard', 'playroom', 'studio', 'office'];
const ANIMALS = [['pasture', 'Cow'], ['pigpen', 'Pig'], ['coop', 'Chicken'], ['meadow', 'Sheep'], ['stable', 'Horse'], ['garden', 'Bunny'], ['reef', 'Clownfish'], ['kelp', 'Seahorse'], ['grotto', 'Octopus'], ['wreck', 'Crab'], ['deep', 'Jellyfish'], ['subbay', 'Sea turtle']];

// one row per animation; periods are the renderer's own cycle lengths, so the frames loop seamlessly
const row = (name, pose, frames, period, o = {}) => ({ name, pose, frames, period, ...o });
const PERSON_ROWS = [
  row('stand', 'stand', 6, 3.927), row('walk', 'walk', 8, 0.785), row('sit', 'sit', 6, 0.393), row('sit_front', 'sit', 4, 3.927, { seatFront: true }),
  row('sleep', 'sleep', 4, 3.927, { fx: 176 }), row('serve', 'serve', 8, 0.449), row('chore', 'chore', 8, 0.898), row('tinker', 'tinker', 6, 0.393),
  row('chat', 'chat', 8, 1.257), row('carry', 'carry', 6, 3.927),
  row('phone', 'phone', 8, 1.257), row('cheer', 'cheer', 6, 0.898), row('runner', 'runner', 8, 0.785),
  row('back_stand', 'stand', 6, 3.927, { back: true }), row('back_walk', 'walk', 8, 0.785, { back: true }), row('back_chore', 'chore', 8, 0.898, { back: true }),
  row('back_tinker', 'tinker', 6, 0.393, { back: true }), row('back_chat', 'chat', 8, 1.257, { back: true }), row('back_carry', 'carry', 6, 3.927, { back: true }),
  row('far', 'stand', 1, 1, { lod: 0 }),
];
const ANIMAL_ROWS = [row('idle', 'stand', 8, 4.189), row('move', 'stand', 8, 0.628, { moving: true }), row('far', 'stand', 1, 1, { lod: 0 })];
const SHEET = { ppu: 44, cw: 200, ch: 176, fx: 100, fy: 152 };        // 44 px per floor unit; feet at (100, 152) in every cell
const PREVIEW = { ppu: 120, w: 400, h: 440, x: 200, y: 404 };

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const write = (rel, data) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); return rel; };
const writePng = (rel, dataUrl) => write(rel, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));

async function loadPlaywright() {
  for (const spec of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean)) {
    try { return await import(spec); } catch { /* try the next place */ }
  }
  throw new Error('Playwright is needed: npm i -D playwright, or set PLAYWRIGHT_MODULE to an installed copy');
}
function serve(dir) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(dir, p);
      if (!f.startsWith(dir)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || (p.includes('/api/') ? 'application/json' : 'application/octet-stream') });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ---- the standalone character renderer: the renderer's own character functions, lifted out of station.html
function extract(src, name) {
  let i = src.indexOf(`\n    function ${name}(`);
  const isFn = i >= 0;
  if (!isFn) i = src.indexOf(`\n    const ${name} =`);
  if (i < 0) throw new Error('not found in station.html: ' + name);
  i += 1;
  // a function ends where its body's braces close; a const ends at the semicolon outside all brackets
  let depth = 0, q = null, params = !isFn, body = false;
  for (let k = i; k < src.length; k++) {
    const ch = src[k];
    if (q) { if (ch === '\\') { k++; continue; } if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if ('{(['.includes(ch)) { if (params && depth === 0 && ch === '{') body = true; depth++; }
    else if ('})]'.includes(ch)) { depth--; if (!params && depth === 0 && ch === ')') params = true; if (isFn && body && depth === 0) return src.slice(i, k + 1).replace(/^ {4}/gm, ''); }
    else if (!isFn && ch === ';' && depth === 0) return src.slice(i, k + 1).replace(/^ {4}/gm, '');
  }
  throw new Error('unbalanced: ' + name);
}
function characterModule(src) {
  const parts = ['hx', 'rgb', 'shade', 'mixc', 'alpha', 'hsh', 'limb', 'blob', 'SKIN_TONES', 'HAIR_COLS', 'PANTS', 'COSTUME', 'OUTFIT', 'lookFor', 'outfitTorso', 'headGear',
    'drawPerson', 'face', 'backHair', 'hairOn', 'drawTool', 'drawAnimal', 'simpleFigure', 'figure'].map((n) => extract(src, n));
  const costumes = [...extract(src, 'COSTUME').matchAll(/\b(\w+): \{/g)].map((m) => m[1]).join(', ');
  return `// Proxyfolk characters, standalone: the exact drawing code the game uses (lifted from src/station.html by
// scripts/export-art.mjs), wrapped so any canvas can draw any character in any pose, at any size.
//
//   drawCharacter(ctx, {
//     kind: 'person' | 'kid' | 'agent' | 'client' | 'lead' | 'animal',
//     name: 'Tasha',                 // the name picks skin tone, hair and clothes (same name, same look)
//     col: '#8fb0ff',                // their colour: shirt for folk and kids, glow for agents
//     pose: 'stand' | 'walk' | 'sit' | 'sleep' | 'serve' | 'chore' | 'tinker' | 'chat' | 'carry',
//     t: 0,                          // seconds into the animation
//     face: 1,                       // 1 faces right, -1 faces left
//     back: false,                   // seen from behind
//     theme: 'barber',               // the room they work in: sets tools and work clothes (see THEMES)
//     world: 'space',                // the world's outfit: space, castle, farm, cyber, alien, ocean
//     costume: null,                 // a world costume: ${costumes}
//     animal: null,                  // for kind 'animal': pasture (cow), pigpen (pig), coop (chicken), meadow (sheep), stable (horse), garden (bunny),
//                                    //   reef (clownfish), kelp (seahorse), grotto (octopus), wreck (crab), deep (jellyfish); anything else is the sea turtle
//     ppu: 44, x: 100, y: 152,       // pixels per floor unit, and where the feet land on the canvas
//     lod: 2,                        // 0 draws the far-away simple figure
//     shadow: true, seatFront: false, moving: false,
//   })
//
// Works in any browser or in Node with a canvas package (ctx needs roundRect, ellipse and gradients).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const u = 12;                                    // world pixels per floor unit, as in the game
let g = null, us = 44, LOD = 2, dpr = 1, px1 = 1, T = 0, tt = 0, curTheme = 'office', curWorld = 'space';
export const THEMES = ${JSON.stringify(THEMES)};

${parts.join('\n\n')}

export { COSTUME, OUTFIT, SKIN_TONES, HAIR_COLS, PANTS, lookFor };

const KIND = { person: 'folk', kid: 'folk', agent: 'job', client: 'guest', lead: 'lead', animal: 'res' };
export function drawCharacter(ctx, o) {
  const kind = o.kind || 'person', ppu = o.ppu || 44;
  const a = { id: o.id || o.name || kind, name: o.name || null, kind: KIND[kind] || 'folk', role: o.role || null, t: o.t || 0, face: o.face || 1, view: o.back ? 'back' : 'front',
    busy: null, bubble: null, real: 0, queue: o.moving ? [[0, 0]] : [], lk: o.animal ? { id: o.animal } : null, costume: o.costume ? { id: o.costume, res: true } : null,
    tint: o.tint || null, small: false, seatFront: Boolean(o.seatFront), x: 0, y: 0 };
  const id = { kind: kind === 'animal' ? 'animal' : kind, col: o.col || '#8fb0ff', name: o.name || '' };
  g = ctx; us = ppu; dpr = 1; px1 = u / ppu; LOD = o.lod ?? 2; T = tt = o.t || 0; curTheme = o.theme || 'office'; curWorld = o.world || 'space';
  ctx.save();
  ctx.setTransform(ppu / u, 0, 0, ppu / u, o.x ?? ppu * 2.3, o.y ?? ppu * 3.45);
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.42, u * 0.18, 0, 0, 7); ctx.fill(); }
  const top = figure(a, id, a.kind === 'res' ? null : lookFor(a, id), o.pose || 'stand', 1);
  ctx.restore();
  return top;                                    // height of the head above the feet, in floor units
}
`;
}

async function main() {
  if (!fs.existsSync(path.join(previewDir, 'index.html'))) throw new Error('build the preview first: npm run preview');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = await loadPlaywright();
  const srv = await serve(previewDir);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('pf-toured', '1'); } catch { /* ignore */ } });
  const X = (fn, ...args) => page.evaluate(fn, ...args);

  const M = { generated: new Date().toISOString(), conventions: {}, characters: [], backgrounds: [], interiors: [], maps: [], pieces: [], code: [] };
  const sigs = new Map(), usedSlugs = new Set();
  const uniqueSlug = (s) => { let k = s, n = 2; while (usedSlugs.has(k)) k = `${s}-${n++}`; usedSlugs.add(k); return k; };
  const natural = new Map();          // theme -> first station room that has it naturally

  async function sheetFor(target, rows, group, name, meta) {
    const res = await X(([t, spec]) => window.__PF_EXPORT.sheet(t, spec), [target, { ...SHEET, rows, theme: meta.theme }]);
    if (!res) return null;
    const s = uniqueSlug(`${group}/${slug(name)}`);
    const img = writePng(`characters/${s}.png`, res.png);
    const animations = {};
    for (const r of rows) animations[r.name] = Array.from({ length: r.frames }, (_, k) => `${r.name}_${k}`);
    const atlas = { frames: Object.fromEntries(Object.entries(res.frames).map(([k, f]) => [k, { frame: f.frame, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.frame.w, h: f.frame.h }, sourceSize: { w: f.frame.w, h: f.frame.h }, pivot: f.pivot, duration: f.duration }])),
      animations, meta: { app: 'Proxyfolk scripts/export-art.mjs', image: path.basename(img), format: 'RGBA8888', size: { w: res.w, h: res.h }, scale: '1', pixelsPerFloorUnit: SHEET.ppu, facing: 'right (mirror horizontally for left)' } };
    write(`characters/${s}.json`, JSON.stringify(atlas, null, 1));
    const prev = await X(([t, o]) => window.__PF_EXPORT.still(t, o), [target, { ...PREVIEW, ppu: PREVIEW.ppu, pose: 'stand', t: 0.4, theme: meta.theme }]);
    const pimg = prev ? writePng(`characters/${s}@preview.png`, prev) : null;
    const entry = { group, name, sheet: img, atlas: `characters/${s}.json`, preview: pimg, rows: rows.map((r) => ({ name: r.name, frames: r.frames, fps: +(r.frames / r.period).toFixed(2) })), ...meta, appearsIn: [] };
    M.characters.push(entry);
    return entry;
  }

  for (const [station, pth, stationTitle] of STATIONS) {
    for (const world of WORLDS) {
      await page.goto(`${base}${pth}?export&skin=${world}&hour=12`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__PF_EXPORT && window.__PF_EXPORT.ready(), null, { timeout: 60000 });
      await page.waitForTimeout(3500);                          // let the folk, visitors and animals arrive
      const cast = await X(() => window.__PF_EXPORT.cast());
      const rooms = await X(() => window.__PF_EXPORT.rooms());
      console.log(`${station} / ${world}: ${cast.length} characters, ${rooms.length} cells`);

      // characters, one sheet per distinct look
      for (const c of cast) {
        let entry = sigs.get(c.sig);
        if (!entry) {
          const animal = c.who === 'animal';
          const nm = animal ? `${c.resident || c.name}` : `${c.name}${c.costume ? '-' + c.costume : ''}${c.who === 'person' || c.who === 'kid' ? '-' + c.theme : ''}`;
          entry = await sheetFor(c.id, animal ? ANIMAL_ROWS : PERSON_ROWS, 'cast', nm, { who: c.who, label: c.label, role: c.role, colour: c.col, theme: c.theme, costume: c.costume, animal: c.animal });
          if (!entry) continue;
          sigs.set(c.sig, entry);
        }
        entry.appearsIn.push({ station, world, room: c.room });
      }

      // interiors: every room theme this station has, the vault and the dock, walls up
      for (const r of rooms) {
        if (r.kind === 'path') {
          if (!natural.has(r.theme)) natural.set(r.theme, { station, name: r.name });
          if (natural.get(r.theme).station !== station) continue;
          const rel = `locations/interiors/${world}/${r.theme}.png`;
          if (M.interiors.some((i) => i.file === rel)) continue;
          writePng(rel, await X(([c0, r0]) => window.__PF_EXPORT.cell(c0, r0, { width: 1200, hour: 12 }), [r.c, r.r]));
          M.interiors.push({ file: rel, world, theme: r.theme, from: `${stationTitle}: ${r.name}` });
        } else {
          const rel = `locations/interiors/${world}/${r.kind === 'hub' ? 'vault' : 'dock'}-${station}.png`;
          writePng(rel, await X(([c0, r0]) => window.__PF_EXPORT.cell(c0, r0, { width: 1200, hour: 12 }), [r.c, r.r]));
          M.interiors.push({ file: rel, world, theme: r.kind === 'hub' ? 'vault' : 'dock', from: `${stationTitle}: ${r.name}` });
        }
      }

      // the whole station: as seen by day and by night, and clear (no sky, no folk) for compositing
      for (const [suffix, o] of [['', { sky: true, folk: true, hour: 12 }], ['-night', { sky: true, folk: true, hour: 23 }], ['-clear', { sky: false, folk: false, hour: 12 }]]) {
        const rel = `locations/maps/${station}/${world}${suffix}.png`;
        writePng(rel, await X((oo) => window.__PF_EXPORT.map(oo), { width: 2000, ...o }));
        M.maps.push({ file: rel, station, world, variant: suffix.slice(1) || 'day', sky: o.sky, folk: o.folk });
      }

      if (station === STATIONS[0][0]) {
        // the sky of each world at three times of day, for a desktop and a phone screen
        for (const [screen, W, H] of [['desktop', 1920, 1080], ['phone', 1080, 1920]]) for (const [when, hour] of [['day', 12], ['dusk', 19.5], ['night', 23]]) {
          const rel = `backgrounds/${world}/${screen}-${when}.png`;
          writePng(rel, await X(([w, h, hr]) => window.__PF_EXPORT.background(w, h, hr), [W, H, hour]));
          M.backgrounds.push({ file: rel, world, screen, time: when, size: [W, H] });
        }
        // pieces: the walkways between rooms and the comm mast
        const halls = await X(() => window.__PF_EXPORT.halls());
        const h = halls.find((k) => k[1] === k[3]), v = halls.find((k) => k[0] === k[2]);
        for (const [nm, hl] of [['hall-horizontal', h], ['hall-vertical', v]]) if (hl) { const rel = `locations/pieces/${world}/${nm}.png`; writePng(rel, await X((k) => window.__PF_EXPORT.hall(...k, 600), hl)); M.pieces.push({ file: rel, world, piece: nm }); }
        const rel = `locations/pieces/${world}/mast.png`; writePng(rel, await X(() => window.__PF_EXPORT.mast(400))); M.pieces.push({ file: rel, world, piece: 'mast' });
      }
    }
  }

  // themes no demo room has, and the gated and closed states, drawn on a room of the business station
  for (const world of WORLDS) {
    await page.goto(`${base}/?export&skin=${world}&hour=12`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__PF_EXPORT && window.__PF_EXPORT.ready(), null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const room = (await X(() => window.__PF_EXPORT.rooms())).find((r) => r.kind === 'path');
    for (const theme of THEMES) {
      const rel = `locations/interiors/${world}/${theme}.png`;
      if (M.interiors.some((i) => i.file === rel)) continue;
      writePng(rel, await X(([c0, r0, th]) => window.__PF_EXPORT.cell(c0, r0, { width: 1200, hour: 12, theme: th }), [room.c, room.r, theme]));
      M.interiors.push({ file: rel, world, theme, from: `drawn as ${theme} on ${room.name} (no demo room has this theme)` });
    }
    for (const look of ['gated', 'killed']) {
      const rel = `locations/interiors/${world}/office--${look}.png`;
      writePng(rel, await X(([c0, r0, lk]) => window.__PF_EXPORT.cell(c0, r0, { width: 1200, hour: 12, theme: 'office', look: lk }), [room.c, room.r, look]));
      M.interiors.push({ file: rel, world, theme: 'office', state: look, from: `The business paths station: ${room.name}` });
    }
    // archetypes, once: every world costume, every client hairstyle, every agent role, every animal
    if (world === 'space') {
      for (const c of await X(() => window.__PF_EXPORT.costumes())) await sheetFor({ kind: 'folk', name: `Sample ${c.id}`, costume: { id: c.id, res: true }, tint: '#8fb0ff' }, PERSON_ROWS, 'costumes', c.id, { who: 'person', costume: c.id, theme: 'office' });
      for (const c of await X(() => window.__PF_EXPORT.clientNames())) await sheetFor({ kind: 'guest', name: c.name, tint: '#9ec5ff', ev: { source: c.name } }, PERSON_ROWS, 'clients', `client-hair-${c.style < 0 ? 'm' + -c.style : c.style}`, { who: 'client', theme: 'barber' });
      for (const r of (await X(() => window.__PF_EXPORT.roles())).filter((r) => r.id !== 'commander')) await sheetFor({ kind: 'job', role: r.id, name: r.title }, PERSON_ROWS, 'agents', r.id, { who: 'agent', role: r.id, label: r.title, colour: r.col, theme: 'office' });
      for (const [id, nm] of ANIMALS) await sheetFor({ kind: 'res', lk: { id, resident: nm }, name: nm }, ANIMAL_ROWS, 'animals', nm, { who: 'animal', animal: id, theme: 'office' });
    }
  }

  const mod = writeCode(M);

  // check the standalone renderer draws exactly what the game draws
  await page.goto(`${base}/barber/?export&skin=space&hour=12`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__PF_EXPORT && window.__PF_EXPORT.ready(), null, { timeout: 60000 });
  const check = await page.evaluate(async (code) => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const m = await import(url);
    const results = [];
    for (const pose of ['stand', 'walk', 'serve', 'sit']) {
      const spec = { kind: 'folk', name: 'Tasha', tint: '#ff7ab8' };
      const a = window.__PF_EXPORT.still(spec, { w: 200, h: 176, ppu: 44, x: 100, y: 152, pose, t: 0.3, theme: 'barber' });
      const c = document.createElement('canvas'); c.width = 200; c.height = 176;
      m.drawCharacter(c.getContext('2d'), { kind: 'person', name: 'Tasha', id: 'sample:Tasha', col: '#ff7ab8', pose, t: 0.3, theme: 'barber', world: 'space', ppu: 44, x: 100, y: 152 });
      const img = new Image(); img.src = a; await img.decode();
      const c2 = document.createElement('canvas'); c2.width = 200; c2.height = 176; c2.getContext('2d').drawImage(img, 0, 0);
      const d1 = c.getContext('2d').getImageData(0, 0, 200, 176).data, d2 = c2.getContext('2d').getImageData(0, 0, 200, 176).data;
      let diff = 0; for (let i = 0; i < d1.length; i++) if (Math.abs(d1[i] - d2[i]) > 2) diff++;
      results.push({ pose, differingChannels: diff });
    }
    return results;
  }, mod);
  console.log('standalone check', JSON.stringify(check));
  M.standaloneCheck = check;

  M.conventions = {
    characters: `Sprite sheets: every cell ${SHEET.cw}x${SHEET.ch} px, ${SHEET.ppu} px per floor unit, feet at (${SHEET.fx}, ${SHEET.fy}) in each cell (the atlas pivot), facing right; the game makes left by mirroring. One row per animation, frames left to right, loop seamlessly at the fps given. Atlases are TexturePacker "JSON Hash" (frames + animations + meta), read as-is by PixiJS, Phaser and most engines. @preview.png is the standing pose at ${PREVIEW.ppu} px per unit.`,
    interiors: 'One room, walls at full height as in the close-up, transparent background, 1200 px wide, midday. Rooms get their furniture from their theme; the numbers on wall screens are the demo data.',
    maps: 'The whole station: day and night as seen in the game (with its sky and folk), and "clear" with neither, on transparent, 2000 px wide.',
    backgrounds: 'The sky of each world, screen-sized, camera at home, at midday, dusk (19:30) and night (23:00).',
    pieces: 'Walkways between rooms and the comm mast, transparent.',
  };
  write('manifest.json', JSON.stringify(M, null, 1));
  writeDocs(M);
  console.log(`characters ${M.characters.length}, interiors ${M.interiors.length}, maps ${M.maps.length}, backgrounds ${M.backgrounds.length}, pieces ${M.pieces.length}`);
  if (errors.length) console.log('page errors', errors.slice(0, 10));
  await browser.close();
  srv.close();
}

// ---- the code: the game page, the renderer, the standalone character renderer and this exporter, from the current source
function writeCode(M) {
  M.code = [];
  const src = fs.readFileSync(path.join(root, 'src', 'station.html'), 'utf8');
  M.code.push({ file: write('code/station.html', src), what: 'the whole game page: renderer, sim, UI (the source of truth)' });
  const w0 = src.indexOf('  const WR = (() => {'), w1 = src.indexOf('\n  })();', w0);
  M.code.push({ file: write('code/renderer.js', `// The Proxyfolk renderer, verbatim from src/station.html (the WR module). It runs inside the game page and reads\n// the game's state (rooms, folk, the ledger snapshot, the camera); see HANDOFF.md for what it needs.\n\n${src.slice(w0, w1 + 7)}\n`), what: 'the renderer: rooms, furniture, walls, halls, mast, backdrops, characters, effects' });
  const mod = characterModule(src);
  M.code.push({ file: write('code/proxyfolk-characters.js', mod), what: 'standalone character renderer (ES module): draw any character in any pose on any canvas' });
  M.code.push({ file: write('code/export-art.mjs', fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')), what: 'this exporter: regenerates the whole handoff' });
  return mod;
}

// ---- the docs: HANDOFF.md and a gallery page that plays every animation (also: node scripts/export-art.mjs <out> --docs)
const ROW_NOTES = {
  stand: 'standing, breathing', walk: 'walking', sit: 'seated at work, back to the camera, hands busy', sit_front: 'seated facing out (how clients sit)', sleep: 'asleep, lying down',
  serve: 'working on a client (scissors in a barbershop, a bag in a shop, a clipboard elsewhere)', chore: 'doing a chore (sponge, rake, shirt, book or duster by room)', tinker: 'hands busy at a desk',
  chat: 'talking, one hand up', carry: 'carrying a box', phone: 'on the phone, the other hand going', cheer: 'both arms up (a sale landed)', runner: 'walking fast with a stack of paper', far: 'the simple figure used when zoomed far out', idle: 'animal standing (bobbing, for sea life)', move: 'animal walking or swimming',
};
function writeDocs(M) {
  const legacyFile = path.join(out, 'legacy-pixel', 'manifest.json');
  const L = fs.existsSync(legacyFile) ? JSON.parse(fs.readFileSync(legacyFile, 'utf8')) : null;
  write('manifest.js', 'window.MANIFEST = ' + JSON.stringify(M) + ';\nwindow.LEGACY = ' + JSON.stringify(L) + ';\n');
  const count = (f) => M.characters.filter(f).length;
  const groups = [['cast', 'every character in the three demo stations, once per distinct look (a costume in a castle, cyber or alien room, a room\'s work clothes, a kid\'s colour); appearsIn says where each one shows up'], ['costumes', 'each world costume on a sample person'], ['clients', 'every client hairstyle (the game picks one from the client\'s name)'], ['agents', 'the hologram AI agent of every role, in its role colour'], ['animals', 'the farm and ocean stock']];
  const md = `# Proxyfolk art handoff

Every character, room, backdrop and map of Proxyfolk as PNG, drawn by the game's own renderer, with the code behind them.
Generated ${M.generated} by \`scripts/export-art.mjs\`.

## Start here

- **index.html**: open it in a browser. Every image, and every character animation playing.
- **manifest.json**: every file with what it is (world, station, theme, pose rows, frame rates). Build anything else from this.
- **code/**: the source. \`proxyfolk-characters.js\` draws any character at any size, standalone; it was checked pixel for pixel against the game (${(M.standaloneCheck || []).map((c) => `${c.pose}: ${c.differingChannels} differing`).join(', ')}).

## What is in here

| Folder | What | Count |
|---|---|---|
${groups.map(([g, what]) => `| characters/${g}/ | ${what} | ${count((c) => c.group === g)} |`).join('\n')}
| locations/interiors/<world>/ | each room theme with its walls up, the vault and the dock of each station, the gated and closed states | ${M.interiors.length} |
| locations/maps/<station>/ | the whole station in each world: day, night, and clear (no sky, no folk) | ${M.maps.length} |
| locations/pieces/<world>/ | the walkways between rooms and the comm mast | ${M.pieces.length} |
| backgrounds/<world>/ | the sky of each world for desktop and phone, day, dusk and night | ${M.backgrounds.length} |
${L ? `| legacy-pixel/ | the pixel-art version from before the smooth renderer: crew, kids and residents per world (native and 8x), the pixel world of each station, the pixel skies | ${L.characters.length + L.residents.length + L.worlds.length + L.skies.length} |\n` : ''}| code/ | the game page, the renderer, the standalone character renderer, the exporters | ${M.code.length + (L ? 2 : 0)} |

Worlds: space, castle, farm, cyber, alien, ocean. Stations: the barbershop (/barber/), the family chores farm (/family/), the business paths station (/).

## Characters

${M.conventions.characters}

Rows in every person sheet, top to bottom (the \`animations\` in each atlas list the frame names in order):

| Row | Frames | fps | What |
|---|---|---|---|
${PERSON_ROWS.map((r) => `| ${r.name} | ${r.frames} | ${(r.frames / r.period).toFixed(2)} | ${r.name.startsWith('back_') ? 'seen from behind: ' + (ROW_NOTES[r.name.slice(5)] || '') : ROW_NOTES[r.name] || ''} |`).join('\n')}

Animal sheets: ${ANIMAL_ROWS.map((r) => `${r.name} (${r.frames} frames, ${(r.frames / r.period).toFixed(2)} fps)`).join(', ')}.

Using the sheets:
- **PixiJS**: \`const sheet = await Assets.load('characters/cast/tasha-barber.json'); new AnimatedSprite(sheet.animations.walk)\`; set \`anchor\` to the pivot (0.5, 0.864) and \`animationSpeed = fps / 60\`.
- **Phaser**: \`this.load.atlas('tasha', 'tasha-barber.png', 'tasha-barber.json')\`, then \`this.anims.create({ key: 'walk', frames: this.anims.generateFrameNames('tasha', { prefix: 'walk_', end: 7 }), frameRate: 10.19, repeat: -1 })\`.
- **Unity**: import the PNG, Sprite Mode Multiple, Slice by Cell Size ${SHEET.cw}x${SHEET.ch}, pivot Custom (0.5, ${(1 - SHEET.fy / SHEET.ch).toFixed(3)}) (Unity measures from the bottom). Pixels Per Unit ${SHEET.ppu} makes one floor tile one unit.
- **Godot**: SpriteFrames > Add frames from sprite sheet, 8 columns, one row per animation; offset the sprite so the pivot sits at its origin.
- **Figma, Canva, slides**: drag in the @preview.png files or the sheets.
- **Left-facing**: mirror horizontally. That is exactly how the game draws it.
- **Any other size**: \`code/proxyfolk-characters.js\` (vector, exact): \`drawCharacter(ctx, { kind: 'person', name: 'Tasha', col: '#ff7ab8', pose: 'walk', t: 0.2, theme: 'barber', ppu: 200 })\`.

## Locations

- **Interiors**: ${M.conventions.interiors} Themes: ${THEMES.join(', ')}; plus the vault (hub) and the dock of each station. Themes no demo room has were drawn on a room of the business station (see \`from\` in the manifest).
- **Maps**: ${M.conventions.maps}
- **Pieces**: ${M.conventions.pieces}

## Backgrounds

${M.conventions.backgrounds}
${L ? `
## Legacy pixel art

The pixel engine as it stood at commit a9eba0c, before the smooth renderer replaced it (the look of the old castle with its towers).
- legacy-pixel/characters/<world>/: every role in that world's outfit, the family's kids (shorter, in their colour), and the residents of the room looks (skeletons, cows, clownfish...). Each sheet has rows front, back and seated; columns stand, step A, step B (seated: resting, typing). Native size and @8x with hard pixel edges.
- legacy-pixel/maps/<station>/: the pixel world of each station in each world, on its own (clear) and over its sky, native (960x600) and @3x.
- legacy-pixel/backgrounds/: each world's pixel sky.
` : ''}
## Code

${M.code.map((c) => `- **${c.file}**: ${c.what}`).join('\n')}${L ? '\n- **code/legacy/station-a9eba0c.html**: the pixel engine\'s game page, as it was at commit a9eba0c\n- **code/legacy/legacy-export.mjs**: the exporter for the legacy pixel art (run against that commit\'s preview with its export hook)' : ''}

The renderer and the game page run in a browser and read the game's state; \`proxyfolk-characters.js\` needs nothing but a 2D canvas.
To regenerate everything from the repo: \`npm run preview && node scripts/export-art.mjs\`.

## Worth knowing

- Room signs and wall screens show the demo stations' names and numbers.
- This is the art as it stands on ${M.generated.slice(0, 10)}. Changes made after that (outfits per world, back walls) need a fresh export.
`;
  write('HANDOFF.md', md);
  write('index.html', GALLERY);
}
const GALLERY = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proxyfolk art</title>
<style>
:root { --bg: #0b0f1c; --card: #141a2e; --line: #26304f; --ink: #e8eeff; --dim: #93a3cc; --acc: #ffcf5a; }
* { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.4 system-ui, sans-serif; }
header { position: sticky; top: 0; z-index: 2; background: rgba(11,15,28,.94); border-bottom: 1px solid var(--line); padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
h1 { font-size: 16px; margin: 0 12px 0 0; letter-spacing: .08em; text-transform: uppercase; }
button, select { background: var(--card); color: var(--ink); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; font: inherit; cursor: pointer; }
button[aria-pressed=true] { border-color: var(--acc); color: var(--acc); }
main { padding: 16px; } h2 { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); margin: 22px 0 10px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.grid.wide { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 8px; cursor: pointer; }
.card img, .card canvas { width: 100%; display: block; background: repeating-conic-gradient(#1a2138 0% 25%, #151b2e 0% 50%) 50% / 16px 16px; border-radius: 6px; image-rendering: auto; }
.card .px { image-rendering: pixelated; }
.card b { display: block; margin-top: 6px; font-size: 12.5px; } .card span { color: var(--dim); font-size: 11.5px; }
dialog { background: var(--card); color: var(--ink); border: 1px solid var(--line); border-radius: 12px; max-width: min(96vw, 900px); }
dialog canvas { background: repeating-conic-gradient(#1a2138 0% 25%, #151b2e 0% 50%) 50% / 16px 16px; border-radius: 8px; width: 100%; max-width: 400px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
</style></head><body>
<header><h1>Proxyfolk art</h1><div id="tabs" class="row"></div><select id="world"></select></header>
<main id="main"></main>
<dialog id="dlg"><div class="row"><b id="dname"></b><select id="anim"></select><button id="flip">Mirror</button><button onclick="dlg.close()">Close</button></div><canvas id="play" width="400" height="352"></canvas><div id="dinfo" style="color:var(--dim);font-size:12px"></div></dialog>
<script src="manifest.js"></script>
<script>
const M = window.MANIFEST, L = window.LEGACY, $ = (s) => document.querySelector(s), esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WORLDS = ['all', 'space', 'castle', 'farm', 'cyber', 'alien', 'ocean'];
const TABS = [['characters', 'Characters'], ['interiors', 'Interiors'], ['maps', 'Maps'], ['backgrounds', 'Backgrounds'], ['pieces', 'Pieces']].concat(L ? [['legacy', 'Legacy pixel']] : []);
let tab = 'characters', world = 'all';
$('#world').innerHTML = WORLDS.map((w) => '<option>' + w + '</option>').join(''); $('#world').onchange = (e) => { world = e.target.value; draw(); };
function tabs() { $('#tabs').innerHTML = TABS.map(([k, t]) => '<button aria-pressed="' + (k === tab) + '" data-t="' + k + '">' + t + '</button>').join(''); }
$('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; tabs(); draw(); } };
const inWorld = (w) => world === 'all' || w === world;
const card = (img, title, sub, attrs = '', px = false) => '<div class="card" ' + attrs + '><img loading="lazy" class="' + (px ? 'px' : '') + '" src="' + esc(img) + '"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>';
function draw() {
  let h = '';
  if (tab === 'characters') for (const g of ['cast', 'costumes', 'clients', 'agents', 'animals']) {
    const list = M.characters.map((c, i) => [c, i]).filter(([c]) => c.group === g && (g !== 'cast' || world === 'all' || c.appearsIn.some((a) => a.world === world)));
    if (!list.length) continue;
    h += '<h2>' + g + ' (' + list.length + ')</h2><div class="grid">' + list.map(([c, i]) => card(c.preview || c.sheet, c.name, [c.who, c.theme, c.costume, c.animal].filter(Boolean).join(' · '), 'data-c="' + i + '"')).join('') + '</div>';
  }
  if (tab === 'interiors') for (const w of WORLDS.slice(1).filter(inWorld)) h += '<h2>' + w + '</h2><div class="grid wide">' + M.interiors.filter((i) => i.world === w).map((i) => card(i.file, i.theme + (i.state ? ' (' + i.state + ')' : ''), i.from, 'data-open="' + esc(i.file) + '"')).join('') + '</div>';
  if (tab === 'maps') for (const s of ['barber', 'family', 'business']) h += '<h2>' + s + '</h2><div class="grid wide">' + M.maps.filter((m) => m.station === s && inWorld(m.world)).map((m) => card(m.file, m.world + ' · ' + m.variant, m.file, 'data-open="' + esc(m.file) + '"')).join('') + '</div>';
  if (tab === 'backgrounds') h += '<div class="grid wide">' + M.backgrounds.filter((b) => inWorld(b.world)).map((b) => card(b.file, b.world + ' · ' + b.screen + ' · ' + b.time, b.size.join(' x '), 'data-open="' + esc(b.file) + '"')).join('') + '</div>';
  if (tab === 'pieces') h += '<div class="grid">' + M.pieces.filter((p) => inWorld(p.world)).map((p) => card(p.file, p.piece, p.world, 'data-open="' + esc(p.file) + '"')).join('') + '</div>';
  if (tab === 'legacy' && L) {
    h += '<h2>crew, kids and residents</h2><div class="grid">' + L.characters.concat(L.residents).filter((c) => inWorld(c.world)).map((c) => card(c.x8, c.name, c.world, 'data-open="' + esc(c.x8) + '"', true)).join('') + '</div>';
    h += '<h2>pixel worlds</h2><div class="grid wide">' + L.worlds.filter((m) => inWorld(m.world) && !m.variant.includes('@')).map((m) => card(m.file.replace('.png', '@3x.png'), m.station + ' · ' + m.world + ' · ' + m.variant, '960 x 600, and @3x', 'data-open="' + esc(m.file.replace('.png', '@3x.png')) + '"', true)).join('') + '</div>';
    h += '<h2>pixel skies</h2><div class="grid wide">' + L.skies.filter((s) => inWorld(s.world)).map((s) => card(s.file, s.world, s.size.join(' x '), 'data-open="' + esc(s.file) + '"', true)).join('') + '</div>';
  }
  $('#main').innerHTML = h;
}
$('#main').onclick = (e) => { const c = e.target.closest('.card'); if (!c) return; if (c.dataset.open) window.open(c.dataset.open, '_blank'); else if (c.dataset.c) openChar(M.characters[+c.dataset.c]); };
let playing = null, mirror = false;
function openChar(c) {
  const img = new Image(); img.src = c.sheet;
  $('#dname').textContent = c.name; $('#anim').innerHTML = c.rows.map((r, i) => '<option value="' + i + '">' + r.name + ' (' + r.frames + ' @ ' + r.fps + ' fps)</option>').join('');
  $('#dinfo').innerHTML = 'Sheet ' + esc(c.sheet) + ' · atlas ' + esc(c.atlas) + (c.appearsIn && c.appearsIn.length ? '<br>In: ' + esc([...new Set(c.appearsIn.map((a) => a.station + '/' + a.world + (a.room ? ' (' + a.room + ')' : '')))].join(', ')) : '');
  const cw = 200, ch = 176, cv = $('#play'), g = cv.getContext('2d'); let t0 = performance.now();
  cancelAnimationFrame(playing);
  const loop = (now) => { const ri = +$('#anim').value, r = c.rows[ri], k = Math.floor(((now - t0) / 1000) * r.fps) % r.frames; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); if (mirror) { g.translate(cv.width, 0); g.scale(-1, 1); } if (img.complete) g.drawImage(img, k * cw, ri * ch, cw, ch, 0, 0, cv.width, cv.height); playing = requestAnimationFrame(loop); };
  playing = requestAnimationFrame(loop); $('#dlg').showModal();
}
$('#flip').onclick = () => { mirror = !mirror; }; $('#dlg').onclose = () => cancelAnimationFrame(playing);
tabs(); draw();
</script></body></html>
`;

if (process.argv.includes('--docs')) { const M = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')); writeCode(M); write('manifest.json', JSON.stringify(M, null, 1)); writeDocs(M); }
else main().catch((e) => { console.error(e); process.exit(1); });
