#!/usr/bin/env node
// Render the scene page frame by frame with Playwright and pipe PNGs into ffmpeg.
// Deterministic: the page exposes window.seek(t) and draws the exact state for time t,
// so output never depends on machine speed.
// Usage: node render.mjs timeline.json scene.html out.mp4 [--fps 30] [--w 1920] [--h 1080]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright'); // CJS require honours NODE_PATH (the cloud sandbox's global install)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [,, timelinePath, scenePath, outPath, ...rest] = process.argv;
const opt = { fps: 30, w: 1920, h: 1080 };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace('--', '')] = Number(rest[i + 1]);

const timeline = JSON.parse(readFileSync(timelinePath, 'utf8'));
const total = timeline.duration;
const frames = Math.ceil(total * opt.fps);

// ANGLE + SwiftShader gives software WebGL for the three.js styles; harmless for DOM-only styles.
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve(scenePath)).href);
await page.evaluate((data) => window.setData(data), timeline);
await page.waitForFunction(() => document.fonts.status === 'loaded');

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(opt.fps),
  '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(opt.fps), outPath],
  { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const t = f / opt.fps;
  await page.evaluate((t) => window.seek(t), t);
  const png = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % (opt.fps * 5) === 0) process.stderr.write(`frame ${f}/${frames}  ${(t).toFixed(1)}s  (${((Date.now()-t0)/1000).toFixed(0)}s elapsed)\n`);
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
await browser.close();
console.log(`rendered ${frames} frames -> ${outPath}`);
