#!/usr/bin/env node
// Quick look: one or more frames of a scene, with page console errors surfaced. preview.mjs timeline.json scene.html outdir WxH t1,t2,...
import { createRequire } from 'node:module'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [,, tlPath, scene, outdir, size, times] = process.argv; const [w,h]=size.split('x').map(Number);
const tl = JSON.parse(readFileSync(tlPath,'utf8'));
const br = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await br.newPage({ viewport:{width:w,height:h} });
pg.on('console', m => { if (m.type()==='error') console.log('  console.error:', m.text()); }); pg.on('pageerror', e => console.log('  pageerror:', e.message));
await pg.goto(pathToFileURL(path.resolve(scene)).href); await pg.evaluate(d=>window.setData(d), tl); await pg.waitForFunction(()=>document.fonts.status==='loaded');
const name = path.basename(scene,'.html');
for (const t of times.split(',').map(Number)) { const t0=Date.now(); await pg.evaluate(t=>window.seek(t),t); await pg.screenshot({ path:`${outdir}/${name}_${t}.png` }); console.log(`  ${name} t=${t} ${Date.now()-t0}ms`); }
await br.close();
