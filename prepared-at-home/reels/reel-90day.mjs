// Renders reel-v07-90day.mp4 (1080x1920, 20 fps, 9 s, silent audio track) for the 90-Day Home Readiness Kit.
// Deterministic frame-by-frame animation in Playwright, encoded with ffmpeg. Usage: node reel-90day.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const img = (f) => pathToFileURL(join(here, '..', 'img', f)).href;
const FPS = 20, SECONDS = 9, W = 1080, H = 1920;
const HEAD = 'Ready for the next ice storm?';
const CLOSE = '90 days. One payday at a time. $9 printable.';

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@500;700&display=swap" rel="stylesheet">
<style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#111923;color:#fff;font-family:Inter,"DejaVu Sans",sans-serif}
.brand{position:absolute;top:110px;left:0;right:0;text-align:center;font-weight:700;font-size:40px;letter-spacing:.06em}
.stripes{position:absolute;top:190px;left:50%;transform:translateX(-50%);display:flex;gap:14px}
.stripes i{display:block;width:70px;height:12px;border-radius:6px}
.head{position:absolute;left:80px;right:80px;top:260px;font-family:Anton,Impact,sans-serif;font-size:112px;line-height:1.02;text-transform:uppercase;color:#ffd23f}
.close{position:absolute;left:80px;right:80px;top:1530px;font-size:46px;line-height:1.3;font-weight:700;opacity:0}
.stage img{position:absolute;width:760px;left:160px;top:640px;border-radius:14px;box-shadow:0 30px 60px rgba(0,0,0,.5);opacity:0}
.url{position:absolute;bottom:120px;left:0;right:0;text-align:center;font-size:34px;font-weight:700;color:#ffd23f}
.bar{position:absolute;left:0;bottom:0;height:10px;background:#ffd23f;width:0}
</style></head><body>
<div class="brand">PREPARED AT HOME</div>
<div class="stripes"><i style="background:#3fbf6f"></i><i style="background:#3f8fdf"></i><i style="background:#ffd23f"></i><i style="background:#ff8c3f"></i></div>
<div class="head" id="head"></div>
<div class="stage">
  <img id="p0" src="${img('90-day-kit-cover.png')}">
  <img id="p1" src="${img('90-day-kit-stages.png')}">
  <img id="p2" src="${img('90-day-kit-post-water.png')}" style="width:640px;left:220px">
</div>
<div class="close" id="close">${CLOSE}</div>
<div class="url">preparedathome.netlify.app</div>
<div class="bar" id="bar"></div>
<script>
const HEAD = ${JSON.stringify(HEAD)}, T = ${SECONDS};
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
window.setT = (t) => {
  document.getElementById('head').textContent = HEAD.slice(0, Math.floor(ease(t / 1.3) * HEAD.length));
  const starts = [1.5, 3.4, 5.3];
  starts.forEach((s, i) => {
    const el = document.getElementById('p' + i), u = ease((t - s) / 0.6);
    const out = i < 2 ? ease((t - starts[i + 1]) / 0.5) : 0;
    el.style.opacity = u * (1 - out * 0.85);
    el.style.transform = 'translateY(' + ((1 - u) * 160) + 'px) rotate(' + ((i % 2 ? 2 : -2) * u) + 'deg) scale(' + (1 - out * 0.08) + ')';
    el.style.zIndex = i;
  });
  document.getElementById('close').style.opacity = ease((t - 7.0) / 0.6);
  document.getElementById('bar').style.width = (${W} * t / T) + 'px';
};
</script></body></html>`;

const frames = join(here, 'frames-90day'); await mkdir(frames, { recursive: true });
const tmp = join(here, 'reel-90day.html'); await writeFile(tmp, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
for (let f = 0; f < FPS * SECONDS; f++) {
  await page.evaluate((t) => window.setT(t), f / FPS);
  await page.screenshot({ path: join(frames, `f${String(f).padStart(4, '0')}.png`) });
}
await browser.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png'),
  '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21',
  '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', join(here, 'reel-v07-90day.mp4')]);
await rm(frames, { recursive: true, force: true }); await rm(tmp);
console.log('rendered reel-v07-90day.mp4');
