#!/usr/bin/env node
// Render one frame of the scene page as a 1280x720 PNG thumbnail.
// Usage: node thumbnail.mjs timeline.json scene.html out.png [seconds]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [,, timelinePath, scenePath, outPath, ...rest] = process.argv;
const opt = { w: 1080, h: 1920, at: null };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace('--', '')] = Number(rest[i + 1]);
const timeline = JSON.parse(readFileSync(timelinePath, 'utf8'));
const t = opt.at ?? (timeline.blocks[0].start + Math.min(2.5, timeline.blocks[0].speech * 0.6));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
await page.goto(pathToFileURL(path.resolve(scenePath)).href);
await page.evaluate((d) => window.setData(d), timeline);
await page.waitForFunction(() => document.fonts.status === 'loaded');
await page.evaluate((t) => window.seek(t, { thumbnail: true }), t);
await page.screenshot({ path: outPath, type: 'png' });
await browser.close();
console.log('thumbnail ->', outPath);
