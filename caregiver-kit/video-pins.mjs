// Renders 1000x1500 Pinterest video pins (MP4, 20 fps, 8 s) frame by frame from a deterministic
// JS-driven animation, then encodes with ffmpeg. Also writes a cover PNG per pin and videos.json.
// Usage: node video-pins.mjs [ffmpegPath]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.argv[2] || 'ffmpeg';
const FPS = 20, SECONDS = 8, W = 1000, H = 1500;
const outDir = join(here, 'site', 'video');
await mkdir(outDir, { recursive: true });
const kit = (n) => pathToFileURL(join(here, 'out', 'pages', `page-${String(n).padStart(2, '0')}.png`)).href;
const hol = (n) => pathToFileURL(join(here, 'out', 'holidays', 'pages', `page-${String(n).padStart(2, '0')}.png`)).href;
const hos = (n) => pathToFileURL(join(here, 'out', 'hospital', 'pages', `page-${String(n).padStart(2, '0')}.png`)).href;
const SITE = 'https://first30days-kit.netlify.app';

// Each pin: a headline that types in, then pages that slide/fan in one after another, then a closing line.
const PINS = [
  { file: 'v01-first30', theme: 'teal', head: 'Just became your parent’s caregiver?', close: 'One binder. 14 pages. In the order you’ll need them.', pages: [kit(1), kit(4), kit(6), kit(9), kit(13)], brand: ['The First 30 Days', 'Caregiver starter kit · $12'], title: 'The First 30 Days caregiver kit: a look inside (video)', desc: 'Fridge sheet, medication list and log, questions for the doctor, documents checklist, weekly caregiver check-in. 14 printable pages for the month after you realize a parent needs your help. $12, instant download.', link: `${SITE}/?utm_source=pinterest&utm_medium=video&utm_campaign=first30days&utm_content=inside` },
  { file: 'v02-holidays', theme: 'clay', head: 'Driving home for Thanksgiving with a feeling something’s changed?', close: '36 signs. Three conversations. A plan for the drive home.', pages: [hol(1), hol(3), hol(4), hol(5), hol(7)], brand: ['Home for the Holidays', 'Is It Time? · $8'], title: 'Visiting aging parents this Thanksgiving? The quiet checklist (video)', desc: 'Home for the Holidays: Is It Time? 36 signs across six areas, the kitchen walk, three conversations that don’t start a fight, the family debrief, green / yellow / red. 8 printable pages, $8.', link: `${SITE}/#holidays?utm_source=pinterest&utm_medium=video&utm_campaign=holidays&utm_content=inside` },
  { file: 'v03-hospital', theme: 'plum', head: 'Bringing a parent home from the hospital this week?', close: 'Day 1 to day 7, on paper, before you need it at 2 a.m.', pages: [hos(1), hos(2), hos(3), hos(4), hos(5), hos(9)], brand: ['After the Hospital', 'The First 7 Days Home · $12'], title: 'After the Hospital: the first 7 days home, page by page (video)', desc: 'Before you leave the hospital, the medication changes sheet, when to call vs 911, the 7-day plan, the help roster. An 11-page printable discharge kit for the week most readmissions start. $12.', link: `${SITE}/#hospital?utm_source=pinterest&utm_medium=video&utm_campaign=hospital&utm_content=inside` },
  { file: 'v04-free', theme: 'green', head: 'Free: 13 questions to ask your parent’s doctor', close: 'One page. Print it the night before. No account needed.', pages: [kit(9)], brand: ['The First 30 Days', 'Free printable'], title: 'Free printable: 13 questions to ask your aging parent’s doctor (video)', desc: 'A free one-page worksheet from The First 30 Days caregiver kit. What is the diagnosis in plain words? What should we watch for? Who do we call after hours? Download free.', link: `${SITE}/#free?utm_source=pinterest&utm_medium=video&utm_campaign=free&utm_content=doctor` },
  { file: 'v05-bundle', theme: 'teal', head: 'Three kits, one binder', close: 'The holiday visit, the hospital week, the first month. $24, was $32.', pages: [hol(1), hos(1), kit(1)], fan: true, brand: ['The Caregiver Binder', 'All three kits · $24'], title: 'The Caregiver Binder: all three kits in one printable bundle (video)', desc: 'Home for the Holidays, After the Hospital, and The First 30 Days in one 33-page PDF. The three hardest weeks of the first year, in the order they arrive. $24, save $8.', link: `${SITE}/#bundle?utm_source=pinterest&utm_medium=video&utm_campaign=bundle&utm_content=inside` },
  { file: 'v06-fridge', theme: 'clay', head: 'The one sheet to put on your parent’s fridge', close: 'Conditions, allergies, medications, who to call. Anyone can act on it.', pages: [kit(4), kit(6), kit(5)], brand: ['The First 30 Days', 'Caregiver starter kit · $12'], title: 'Emergency information sheet for an aging parent (video)', desc: 'If something happens, the first person through the door should not have to guess. The fridge sheet, the medication list and the care team page from The First 30 Days caregiver kit. $12, 14 printable pages.', link: `${SITE}/?utm_source=pinterest&utm_medium=video&utm_campaign=first30days&utm_content=fridge` },
];

const THEMES = { teal: ['#1f4e5f', '#ffffff', '#c2673f', '#d7e3e8'], clay: ['#fbe9df', '#1f4e5f', '#c2673f', '#5f6b72'], plum: ['#ece6f1', '#1f4e5f', '#5b4a6b', '#5f6b72'], green: ['#f6f1ea', '#1f4e5f', '#2f7d5b', '#5f6b72'] };

const html = (p) => {
  const [bg, fg, accent, sub] = THEMES[p.theme];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${bg};font-family:"Inter","DejaVu Sans",Arial,sans-serif;color:${fg}}
.tag{position:absolute;left:70px;top:64px;background:${accent};color:#fff;font-weight:700;font-size:21px;letter-spacing:.08em;text-transform:uppercase;padding:11px 20px;border-radius:999px}
.head{position:absolute;left:70px;right:70px;top:136px;font-size:58px;line-height:1.08;font-weight:700;letter-spacing:-.015em}
.close{position:absolute;left:70px;right:70px;top:430px;font-size:28px;line-height:1.4;color:${sub};opacity:0}
.stage{position:absolute;left:0;right:0;top:560px;height:800px}
.stage img{position:absolute;left:190px;top:40px;width:620px;box-shadow:0 24px 50px rgba(31,78,95,.25),0 2px 6px rgba(0,0,0,.08);border-radius:8px;opacity:0}
.band{position:absolute;left:0;right:0;bottom:0;height:120px;background:${p.theme === 'teal' ? '#c2673f' : '#1f4e5f'};color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 70px;font-size:26px;font-weight:600}
.band span:last-child{font-weight:500;opacity:.9}
.bar{position:absolute;left:0;bottom:120px;height:8px;background:${accent};width:0}
</style></head><body>
<div class="tag">${p.brand[1].includes('Free') ? 'Free printable' : 'Printable kit'}</div>
<div class="head" id="head"></div>
<div class="close" id="close">${p.close}</div>
<div class="stage">${p.pages.map((src, i) => `<img id="pg${i}" src="${src}">`).join('')}</div>
<div class="bar" id="bar"></div>
<div class="band"><span>${p.brand[0]}</span><span>${p.brand[1]}</span></div>
<script>
const HEAD = ${JSON.stringify(p.head)}; const N = ${p.pages.length}; const FAN = ${!!p.fan}; const T = ${SECONDS};
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
window.setT = (t) => {
  const chars = Math.floor(ease(t / 1.4) * HEAD.length);
  document.getElementById('head').textContent = HEAD.slice(0, chars);
  const per = (T - 2.2 - 1.2) / N;
  for (let i = 0; i < N; i++) {
    const s = 1.2 + i * per; const u = ease((t - s) / 0.55);
    const el = document.getElementById('pg' + i);
    if (FAN) { const rot = (i - (N - 1) / 2) * 9; const dx = (i - (N - 1) / 2) * 150;
      el.style.opacity = u; el.style.width = '420px'; el.style.left = (290 + dx) + 'px'; el.style.top = (120 + (1 - u) * 80) + 'px'; el.style.transform = 'rotate(' + (rot * u) + 'deg)'; el.style.zIndex = i; }
    else { const settled = Math.max(0, i - 1);
      el.style.opacity = u; el.style.top = (40 + (1 - u) * 140 + i * 6) + 'px'; el.style.left = (190 + i * 10) + 'px'; el.style.transform = 'rotate(' + ((i % 2 ? 2.5 : -2.5) * u) + 'deg)'; el.style.zIndex = i; }
  }
  document.getElementById('close').style.opacity = ease((t - (T - 2.2)) / 0.6);
  document.getElementById('bar').style.width = (1000 * t / T) + 'px';
};
</script></body></html>`;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const manifest = [];
for (const p of PINS) {
  const frames = join(outDir, `${p.file}-frames`); await mkdir(frames, { recursive: true });
  const tmp = join(outDir, `${p.file}.html`); await writeFile(tmp, html(p));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  const total = FPS * SECONDS;
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.setT(t), f / FPS);
    await page.screenshot({ path: join(frames, `f${String(f).padStart(4, '0')}.png`) });
    if (f === Math.floor(total * 0.75)) await page.screenshot({ path: join(outDir, `${p.file}-cover.png`) });
  }
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', join(outDir, `${p.file}.mp4`)]);
  await rm(frames, { recursive: true, force: true }); await rm(tmp);
  manifest.push({ file: `${p.file}.mp4`, cover: `${SITE}/video/${p.file}-cover.png`, title: p.title, description: p.desc, alt_text: p.head, link: p.link });
  console.log('rendered', p.file);
}
await browser.close();
await writeFile(join(outDir, 'videos.json'), JSON.stringify(manifest, null, 2));
console.log(`${PINS.length} video pins written to ${outDir}`);
