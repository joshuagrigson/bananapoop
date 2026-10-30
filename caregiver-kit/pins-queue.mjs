// Builds the standing pin queue: 1000x1500 images under site/pins/q/ plus site/pins/queue.json.
// The weekly scheduled task posts the next unposted entries (dedup by title against the live board).
// Usage: node pins-queue.mjs   (run build.mjs and build-kit.mjs for the holidays kit first)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const kit = (n) => pathToFileURL(join(here, 'out', 'pages', `page-${String(n).padStart(2, '0')}.png`)).href;
const hol = (n) => pathToFileURL(join(here, 'out', 'holidays', 'pages', `page-${String(n).padStart(2, '0')}.png`)).href;
const outDir = join(here, 'site', 'pins', 'q');
await mkdir(outDir, { recursive: true });

const SITE = 'https://first30days-kit.netlify.app';
const link = (c) => `${SITE}/?utm_source=pinterest&utm_medium=pin&utm_campaign=first30days&utm_content=${c}`;
const hlink = (c) => `${SITE}/#holidays?utm_source=pinterest&utm_medium=pin&utm_campaign=holidays&utm_content=${c}`;
const flink = (c) => `${SITE}/#free?utm_source=pinterest&utm_medium=pin&utm_campaign=free&utm_content=${c}`;

// kind: product (kit), holidays, free (lead magnet), seasonal. Order = posting order, 4 per week.
const Q = [
  // Week 1
  { file: 'q01.png', kind: 'holidays', dark: true, img: hol(1), head: 'Driving home for Thanksgiving with a feeling something’s changed?', sub: 'A quiet way to notice, and the words to use if you do.', title: 'Visiting your parents this Thanksgiving? How to tell if they need more help', desc: 'Home for the Holidays: Is It Time? is an 8-page printable kit: 36 signs across six areas, the kitchen walk, three conversations that don’t start a fight, a family debrief for siblings, and a green / yellow / red guide for what to do next. $8, instant download.', link: hlink('thanksgiving') },
  { file: 'q02.png', kind: 'free', img: kit(9), head: 'Free: 13 questions to ask your parent’s doctor', sub: 'One printable page. Fill it in the night before the visit.', title: 'Free printable: 13 questions to ask your aging parent’s doctor', desc: 'A free one-page worksheet from The First 30 Days caregiver kit. What is the diagnosis in plain words? What should we watch for? Who do we call after hours? Check the ones that apply, add your own, write the answers during the visit. Download free, no account needed.', link: flink('doctor-questions') },
  { file: 'q03.png', kind: 'product', img: kit(5), head: 'Every doctor, pharmacy and sibling on one page', sub: 'The care team sheet that saves the next caregiver an hour of phone calls.', title: 'Care team & contacts sheet for family caregivers (printable)', desc: 'Primary doctor, specialists, pharmacy, home health, insurance, attorney, the neighbor with a key, and every family member, with notes on best time to call. Part of The First 30 Days, a 14-page printable kit for new family caregivers. $12, instant download.', link: link('care-team') },
  { file: 'q04.png', kind: 'holidays', img: hol(4), head: 'The kitchen tells you more than an hour of asking', sub: 'Offer to make coffee. Ten minutes at the fridge, the pill bottles and the mail pile.', title: 'The kitchen walk: what your parent’s fridge and counters tell you', desc: 'From Home for the Holidays: Is It Time? Dates on the milk, duplicates in the pantry, scorched pans, pill bottles, the mail pile, the trash. What to look at and what it means. Printable 8-page kit, $8.', link: hlink('kitchen-walk') },
  // Week 2
  { file: 'q05.png', kind: 'holidays', img: hol(5), head: 'Three ways to start the conversation without a fight', sub: 'Word-for-word openers. Say your line, then stop talking.', title: 'How to talk to aging parents about needing help: three scripts that work', desc: 'The “I noticed” opener, the future framing, and the ask for help, word for word, plus what not to say and what to do if they get angry. From Home for the Holidays: Is It Time?, an 8-page printable kit. $8.', link: hlink('scripts') },
  { file: 'q06.png', kind: 'product', dark: true, img: kit(1), head: 'The binder you hand your sibling when it’s their turn', sub: '14 printable pages. Everything a new caregiver has to track, in the order you’ll need it.', title: 'The First 30 Days: the caregiver binder your family can share', desc: 'Roadmap, fridge sheet, contacts, medication list and log, appointments, doctor questions, documents, daily log, home safety, caregiver check-in, call log. Print it once, hand it over when someone else takes a shift. $12, instant PDF.', link: link('binder') },
  { file: 'q07.png', kind: 'seasonal', img: hol(3), head: 'Mom seems fine on the phone. Is she?', sub: 'The 36 small changes adult kids notice at the holidays, and what each one means.', title: '36 signs an aging parent may need more help (holiday visit checklist)', desc: 'The house, the kitchen, their body, mind and mood, money and mail, driving. Six signs in each area, marked privately after the visit. From Home for the Holidays: Is It Time?, an 8-page printable kit for adult children. $8.', link: hlink('36-signs') },
  { file: 'q08.png', kind: 'product', img: kit(8), head: 'Write down what the doctor said before you forget it', sub: 'An appointment tracker with the column everyone forgets: what happens next.', title: 'Appointment tracker for caregivers: what they said, what happens next', desc: 'Date, provider, reason, what they said, next steps and follow-up date. Plus three questions to ask before you leave the office. Part of The First 30 Days caregiver kit, 14 printable pages, $12.', link: link('appointments') },
  // Week 3
  { file: 'q09.png', kind: 'holidays', img: hol(6), head: 'Siblings saw different things. Compare notes within the week.', sub: 'A one-page family debrief that ends with three next steps and names on them.', title: 'The family debrief: how siblings agree on what to do about Mom or Dad', desc: 'What each of you noticed (facts, not worry), where you agree, where you don’t, and three next steps with a name and a date on each. From Home for the Holidays: Is It Time?, 8 printable pages, $8.', link: hlink('debrief') },
  { file: 'q10.png', kind: 'free', img: kit(9), head: 'Print this the night before Mom’s appointment', sub: 'Free one-page worksheet: 13 questions, space for the answers.', title: 'Free one-page worksheet for your parent’s doctor visit', desc: 'Thirteen questions caregivers wish they’d asked, with room to write the answers. Free download from The First 30 Days caregiver kit.', link: flink('doctor-worksheet') },
  { file: 'q11.png', kind: 'product', img: kit(14), head: '“Who told you that?”', sub: 'A call log for insurance, pharmacy and the doctor’s office: date, who, what, reference number.', title: 'Caregiver call log: every insurance and pharmacy call in one place', desc: 'Date, who you spoke with, about what, what was said or decided, follow-up and reference number. Because you will be asked “who told you that?” Part of The First 30 Days caregiver kit, $12.', link: link('call-log') },
  { file: 'q12.png', kind: 'seasonal', dark: true, img: hol(7), head: 'Green, yellow or red: how fast to move after the visit', sub: 'A decision guide for the drive home.', title: 'After the holiday visit: a green / yellow / red guide for adult children', desc: 'Count what you noticed. Green: enjoy the visit, start a baseline. Yellow: one conversation, a doctor visit within 60 days, light help first. Red: this week, not after New Year’s. From Home for the Holidays: Is It Time?, $8 printable kit.', link: hlink('gyr') },
  // Week 4
  { file: 'q13.png', kind: 'product', img: kit(11), head: 'Patterns show up on paper before they show up in memory', sub: 'A daily care & symptom log for when a doctor said “watch for changes.”', title: 'Daily care & symptom log for caregivers (printable)', desc: 'Mood, meals, bathroom, mobility, sleep, vitals, pain scale, medications given, what to report. One page per day when something feels off. Part of The First 30 Days caregiver kit, 14 pages, $12.', link: link('daily-log') },
  { file: 'q14.png', kind: 'holidays', img: hol(2), head: 'You’re not there to inspect. You’re there for the holiday.', sub: 'Three rules for noticing without turning dinner into an intervention.', title: 'How to check on aging parents at the holidays without an intervention', desc: 'One thing at a time. Curious, not corrective. Their life, their say. Plus what can’t wait. From Home for the Holidays: Is It Time?, an 8-page printable kit for adult children, $8.', link: hlink('three-rules') },
  { file: 'q15.png', kind: 'product', img: kit(2), head: 'Print once. Print weekly. Hand it over.', sub: 'How the 14-page caregiver kit is meant to be used.', title: 'How to set up a caregiver binder in one evening', desc: 'Which pages to print once (fridge sheet, contacts, medication list, documents, home safety) and which to print weekly (medication log, check-in, daily log). Three habits that make the rest easier. The First 30 Days, $12 printable kit.', link: link('how-to-use') },
  { file: 'q16.png', kind: 'seasonal', img: hol(8), head: 'New Year, same worry about Dad? Start with the paperwork.', sub: 'What you decided at Thanksgiving, who owns it, and when to look again.', title: 'The next steps tracker: turning a holiday worry into a January plan', desc: 'Visit date, overall color, three steps with owners and outcomes, questions for the doctor, when to look again. From Home for the Holidays: Is It Time?, $8. Pairs with The First 30 Days for the paperwork month.', link: hlink('tracker') },
];

const shadow = 'box-shadow:0 24px 50px rgba(31,78,95,.25),0 2px 6px rgba(0,0,0,.08);border-radius:8px;';
const css = `<style>
html,body{margin:0;width:1000px;height:1500px;overflow:hidden;font-family:"Inter","DejaVu Sans",Arial,sans-serif}
.f{position:relative;width:1000px;height:1500px;background:#f6f1ea;color:#1f4e5f}
.f.dark{background:#1f4e5f;color:#fff}
.f.hol{background:#fbe9df}
.tag{position:absolute;left:70px;top:64px;background:#c2673f;color:#fff;font-weight:700;font-size:21px;letter-spacing:.08em;text-transform:uppercase;padding:11px 20px;border-radius:999px}
.f.free .tag{background:#2f7d5b}
.head{position:absolute;left:70px;right:70px;top:136px;font-size:60px;line-height:1.08;font-weight:700;letter-spacing:-.015em}
.sub{position:absolute;left:70px;right:70px;top:430px;font-size:28px;line-height:1.4;color:#5f6b72}
.f.dark .sub{color:#d7e3e8}
.art{position:absolute;left:0;right:0;top:570px;height:800px}
.art img{position:absolute;display:block;${shadow}left:190px;top:0;width:620px;transform:rotate(-2.5deg)}
.band{position:absolute;left:0;right:0;bottom:0;height:120px;background:#1f4e5f;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 70px;font-size:26px;font-weight:600}
.f.dark .band{background:#c2673f}
.band span:last-child{font-weight:500;opacity:.9}
</style>`;
const tagFor = (p) => p.kind === 'free' ? 'Free printable' : p.kind === 'product' ? 'Printable kit · 14 pages' : 'Printable kit · 8 pages';
const brandFor = (p) => p.kind === 'product' || p.kind === 'free' ? ['The First 30 Days', 'Caregiver starter kit · PDF'] : ['Home for the Holidays', 'Is It Time? · PDF'];
const html = (p) => { const [b1, b2] = brandFor(p); return `<!doctype html><html><head><meta charset="utf-8">${css}</head><body>
<div class="f ${p.dark ? 'dark' : ''} ${p.kind === 'free' ? 'free' : ''} ${(p.kind === 'holidays' || p.kind === 'seasonal') && !p.dark ? 'hol' : ''}">
  <div class="tag">${tagFor(p)}</div><div class="head">${p.head}</div><div class="sub">${p.sub}</div>
  <div class="art"><img src="${p.img}"></div>
  <div class="band"><span>${b1}</span><span>${b2}</span></div>
</div></body></html>`; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1500 }, deviceScaleFactor: 1 });
for (const p of Q) {
  const tmp = join(outDir, p.file.replace('.png', '.html'));
  await writeFile(tmp, html(p));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outDir, p.file) });
}
await browser.close();
const queue = Q.map((p, i) => ({ seq: i + 1, kind: p.kind, image_url: `${SITE}/pins/q/${p.file}`, title: p.title, description: p.desc, alt_text: p.head, link: p.link }));
await writeFile(join(here, 'site', 'pins', 'queue.json'), JSON.stringify({ board_id: '669769844523888735', per_run: 2, pins: queue }, null, 2));
console.log(`${Q.length} queue pins written`);
