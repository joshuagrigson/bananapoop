// Builds 1000x1500 Pinterest pins (2:3) from the page PNGs, plus pins.json with each pin's copy.
// Usage: node pins.mjs   (run build.mjs first)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const pages = join(here, 'out', 'pages');
const outDir = join(here, 'site', 'pins');
await mkdir(outDir, { recursive: true });
const img = (n) => pathToFileURL(join(pages, `page-${String(n).padStart(2, '0')}.png`)).href;

const PINS = [
  { file: 'pin-01-start-here.png', page: 1, dark: true,
    head: 'Just became your parent’s caregiver?', sub: 'Start here. One page for each thing that keeps you up at night, in the order you’ll need them.',
    title: 'The First 30 Days: a starter kit for new family caregivers',
    desc: 'A 14-page printable kit for the month after you realize a parent needs your help. 30-day roadmap, emergency fridge sheet, medication list and log, appointment tracker, questions for the doctor, documents checklist, home safety walkthrough, and a weekly check-in for you. Instant PDF download, US Letter.' },
  { file: 'pin-02-roadmap.png', page: 3,
    head: 'A 30-day plan for caring for an aging parent', sub: 'Week 1 stabilize. Week 2 paperwork. Week 3 care team. Week 4 home, money, and you.',
    title: '30-day roadmap for new caregivers of aging parents (printable)',
    desc: 'Four weeks, one focus each, as a checklist. Fill in the fridge sheet, build the medication list, find the documents, book the appointments, walk the house for safety, and put one thing on the calendar for you. Part of The First 30 Days caregiver kit, a 14-page printable PDF.' },
  { file: 'pin-03-fridge.png', page: 4,
    head: 'The one sheet to put on your parent’s fridge', sub: 'Conditions, allergies, medications, who to call. Anyone who walks in can act on it.',
    title: 'Emergency information sheet for an aging parent (printable)',
    desc: 'If something happens, the person who walks in first should not have to guess. Name, conditions, allergies, current medications, advance directive, doctor, pharmacy, hospital, insurance, and who to call. Print it, tape it up, keep a photo on your phone. From The First 30 Days caregiver kit.' },
  { file: 'pin-04-med-list.png', page: 6,
    head: 'Bring this to every appointment', sub: 'A current medication list is the most useful thing you can carry into a doctor’s office or an ER.',
    title: 'Printable medication list for caregivers: every provider will ask for it',
    desc: 'Medication and strength, dose, when taken, prescriber, what it’s for, refill date, allergies, and stopped medications. Fill it in with the bottles in front of you and reprint when anything changes. Part of The First 30 Days caregiver kit (14-page PDF).' },
  { file: 'pin-05-doctor.png', page: 9,
    head: '13 questions to ask your parent’s doctor', sub: 'Fill it in the night before. Hand it to the doctor if that’s easier than reading it aloud.',
    title: '13 questions to ask your aging parent’s doctor (printable worksheet)',
    desc: 'What is the diagnosis in plain words? What should we watch for? Which medications shouldn’t be taken together? Who do we call after hours? Is it still safe to drive or live alone? Check the ones that apply, add your own, write the answers during the visit. From The First 30 Days caregiver kit.' },
  { file: 'pin-06-documents.png', page: 10,
    head: '18 documents to find before you need them', sub: 'Healthcare power of attorney, advance directive, insurance, deed, DD-214. Which exist, and where.',
    title: 'Important documents checklist for caring for an aging parent',
    desc: 'You are not creating these documents this month. You are finding out which ones exist and where they live. 18 documents with exists / where it’s kept / who has copies columns. Part of The First 30 Days caregiver kit, a 14-page printable PDF.' },
  { file: 'pin-07-home-safety.png', page: 12,
    head: '30 home safety checks for an aging parent', sub: 'Walk the house the way they move through it: bed to bathroom at night, chair to kitchen.',
    title: 'Home safety walkthrough checklist for aging parents (printable)',
    desc: 'Rugs, night lights, grab bars, water heater temperature, stove knobs, pill storage, handrails, a neighbor with a key. 30 room-by-room checks and a fix-it table with who does it and by when. From The First 30 Days caregiver kit.' },
  { file: 'pin-08-checkin.png', page: 13,
    head: 'Caregiver burnout shows up on paper first', sub: 'A five-minute weekly check-in that is only about you.',
    title: 'Weekly caregiver check-in: the five-minute page that is about you',
    desc: 'Caregivers who burn out usually saw it coming weeks before they felt it. Sleep, your own appointments, what went well, what was hardest, one task to hand off, one thing for you, and the warning signs worth taking seriously. Part of The First 30 Days caregiver kit (printable PDF).' },
  { file: 'pin-09-med-log.png', page: 7,
    head: 'The medication log that makes a missed dose obvious', sub: 'Initial the box when it’s given. A blank box is the fastest way to spot a miss.',
    title: 'Weekly medication log for caregivers (printable, initial-the-box)',
    desc: 'Morning, midday, evening, bedtime, as-needed, seven days across. One sheet a week, five copies covers a month. Space for missed doses, side effects, and refills ordered. From The First 30 Days caregiver kit, a 14-page printable PDF.' },
  { file: 'pin-10-inside.png', grid: true,
    head: 'Everything a new caregiver has to track, in one binder', sub: '14 printable pages. Print once, print weekly, hand the binder to whoever is on next.',
    title: 'The First 30 Days caregiver kit: all 14 printable pages',
    desc: 'Roadmap, emergency fridge sheet, care team and contacts, medication list and weekly log, appointment tracker, questions for the doctor, documents checklist, daily care log, home safety walkthrough, weekly caregiver check-in, call log. Instant PDF download, US Letter, prints in black and white.' },
];

const shadow = 'box-shadow:0 24px 50px rgba(31,78,95,.25),0 2px 6px rgba(0,0,0,.08);border-radius:8px;';
const css = `<style>
html,body{margin:0;width:1000px;height:1500px;overflow:hidden;font-family:"Inter","DejaVu Sans",Arial,sans-serif}
.f{position:relative;width:1000px;height:1500px;background:#f6f1ea;color:#1f4e5f}
.f.dark{background:#1f4e5f;color:#fff}
.tag{position:absolute;left:70px;top:64px;background:#c2673f;color:#fff;font-weight:700;font-size:21px;letter-spacing:.08em;text-transform:uppercase;padding:11px 20px;border-radius:999px}
.head{position:absolute;left:70px;right:70px;top:136px;font-size:66px;line-height:1.08;font-weight:700;letter-spacing:-.015em}
.sub{position:absolute;left:70px;right:70px;top:420px;font-size:29px;line-height:1.4;color:#5f6b72}
.f.dark .sub{color:#d7e3e8}
.art{position:absolute;left:0;right:0;top:560px;height:800px}
.art img{position:absolute;display:block;${shadow}}
.band{position:absolute;left:0;right:0;bottom:0;height:120px;background:#1f4e5f;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 70px;font-size:26px;font-weight:600}
.f.dark .band{background:#c2673f}
.band span:last-child{font-weight:500;opacity:.9}
</style>`;

const art = (p) => p.grid
  ? `<div class="art"><div style="position:absolute;left:60px;right:60px;top:10px;display:flex;flex-wrap:wrap;justify-content:center;gap:16px">
      ${[1,3,4,6,7,9,10,12,13,14].map((n) => `<img src="${img(n)}" style="position:static;width:160px">`).join('')}</div></div>`
  : `<div class="art"><img src="${img(p.page)}" style="left:190px;top:0;width:620px;transform:rotate(-2.5deg)"></div>`;

const html = (p) => `<!doctype html><html><head><meta charset="utf-8">${css}</head><body>
<div class="f ${p.dark ? 'dark' : ''}">
  <div class="tag">Printable kit · 14 pages</div>
  <div class="head">${p.head}</div>
  <div class="sub">${p.sub}</div>
  ${art(p)}
  <div class="band"><span>The First 30 Days</span><span>Caregiver starter kit · PDF</span></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1500 }, deviceScaleFactor: 1 });
for (const p of PINS) {
  const tmp = join(outDir, p.file.replace('.png', '.html'));
  await writeFile(tmp, html(p));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outDir, p.file) });
}
await browser.close();
await writeFile(join(here, 'site', 'pins.json'), JSON.stringify(PINS.map(({ file, title, desc, head }) => ({ file, title, description: desc, alt: head })), null, 2));
console.log(`${PINS.length} pins written to ${outDir}`);
