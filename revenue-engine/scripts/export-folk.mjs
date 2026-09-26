// Export the folk kit (art/folk-kit): every agent in every world and tier, every species, pose, portrait,
// the folk (barbers, kids, floor crew, clients) and the six world maps, as SVG masters plus PNGs,
// with contact sheets, a manifest, the code and a demo page.
//
//   node scripts/export-folk.mjs [outDir]      default ./folk-art
//
// Needs Chromium (Playwright) to turn the SVGs into PNGs; the SVGs themselves need nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'folk-art'));
const KIT = path.join(ROOT, 'art/folk-kit');
const { folkSvg, FOLK } = await import(path.join(KIT, 'folkSvg.js'));
const { mapSvg, MAPS } = await import(path.join(KIT, 'mapSvg.js'));

let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));

// each role's own face, so the same agent is recognisable in every world and tier
const CAST = {
  prospector: { skin: 1, hair: 0, hairC: 0, eyeC: 0 },
  outreach: { skin: 0, hair: 2, hairC: 3, eyeC: 2 },
  pricing: { skin: 2, hair: 4, hairC: 3, eyeC: 0 },
  creator: { skin: 2, hair: 1, hairC: 2, eyeC: 1 },
  lister: { skin: 1, hair: 1, hairC: 6, eyeC: 2 },
  scout: { skin: 5, hair: 5, hairC: 1, eyeC: 3 },
  fulfiller: { skin: 0, hair: 6, hairC: 0, eyeC: 4 },
  auditor: { skin: 4, hair: 4, hairC: 1, eyeC: 3 },
  manager: { skin: 1, hair: 3, hairC: 5, eyeC: 1 },
  commander: { skin: 1, hair: 0, hairC: 0, eyeC: 0 },
  barber: { skin: 3, hair: 3, hairC: 5, eyeC: 2 },
  kid: { skin: 1, hair: 6, hairC: 2, eyeC: 1 },
  crew: { skin: 2, hair: 0, hairC: 1, eyeC: 3 },
  client: { skin: 4, hair: 1, hairC: 4, eyeC: 0 },
};
const AGENTS = ['prospector', 'outreach', 'pricing', 'creator', 'lister', 'scout', 'fulfiller', 'auditor', 'manager', 'commander'];
const FOLKS = ['barber', 'kid', 'crew', 'client'];
const WORLDS = Object.keys(FOLK.worlds);
const NATIVE = { human: 'space', fox: 'farm', robot: 'cyber', grey: 'alien', skeleton: 'castle', octo: 'ocean' };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const jobs = [];
const add = (rel, svg, w, h, meta) => jobs.push({ rel, svg, w, h, meta });
let n = 0;
const fig = (look, opts = {}) => folkSvg(look, { id: 'f' + ++n, ...opts });

for (const role of AGENTS) for (const world of WORLDS) for (let tier = 0; tier < 5; tier++) {
  const look = { role, world, tier, ...CAST[role] };
  add(`agents/${role}/${world}_t${tier}-${slug(FOLK.tiers[tier])}`, fig(look), 512, 512, { look, pose: 'idle' });
}
for (const species of FOLK.species) for (const role of AGENTS) {
  const look = { role, world: NATIVE[species], tier: 2, species, ...CAST[role] };
  add(`species/${species}/${role}`, fig(look), 512, 512, { look, pose: 'idle' });
}
AGENTS.forEach((role, i) => { for (const pose of FOLK.poses) { const look = { role, world: WORLDS[i % WORLDS.length], tier: 2, ...CAST[role] }; add(`poses/${role}/${pose}`, fig(look, { pose }), 384, 384, { look, pose }); } });
for (const role of FOLKS) for (const world of WORLDS) {
  const look = { role, world, tier: role === 'kid' ? 0 : 1, ...CAST[role] };
  add(`folk/${role}/${world}`, fig(look), 384, 384, { look, pose: 'idle' });
}
for (const world of WORLDS) for (const pose of ['phone', 'carry', 'cheer', 'walk']) {
  const look = { role: 'crew', world, tier: 1, ...CAST.crew, skin: (WORLDS.indexOf(world) + 1) % 6, hair: WORLDS.indexOf(world) % 7 };
  add(`folk/crew-poses/${world}_${pose}`, fig(look, { pose }), 384, 384, { look, pose });
}
for (const role of AGENTS) for (const tier of [0, 4]) for (const crop of ['bust', 'head']) {
  const look = { role, world: 'space', tier, ...CAST[role] };
  add(`portraits/${crop}/${role}_t${tier}`, fig(look, { crop }), 256, 256, { look, crop });
}
for (const world of MAPS.worlds) add(`maps/${world}`, mapSvg(world, { id: 'm' + world }), 2400, 1500, { world });

// ---------------------------------------------------------------------------------------------- render
fs.rmSync(OUT, { recursive: true, force: true });
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage();
await pg.setContent('<body></body>');
const manifest = [];
for (let i = 0; i < jobs.length; i += 24) {
  const batch = jobs.slice(i, i + 24);
  const pngs = await pg.evaluate(async (list) => Promise.all(list.map(async ({ svg, w, h }) => {
    const sized = svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
    const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
    return c.toDataURL('image/png').slice(22);
  })), batch.map(({ svg, w, h }) => ({ svg, w, h })));
  batch.forEach((j, k) => {
    const file = path.join(OUT, j.rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.svg', j.svg);
    fs.writeFileSync(file + '.png', Buffer.from(pngs[k], 'base64'));
    manifest.push({ file: j.rel, png: `${j.w}x${j.h}`, ...j.meta });
  });
}

// ---------------------------------------------------------------------------------------------- contact sheets
const sheet = async (name, title, cols, size, cells) => {
  const html = `<body style="margin:0;background:#2e3246;font:13px Arial,sans-serif;color:#e8e6f0;padding:18px"><h1 style="margin:0 0 12px;font:900 22px Arial Black,Arial">${title}</h1><div style="display:grid;grid-template-columns:repeat(${cols},${size}px);gap:6px">${cells.map(([svg, label]) => `<div style="background:#3b4058;border-radius:10px;padding:4px;text-align:center"><div style="width:${size - 8}px;height:${size - 8}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div><div style="padding:2px 0 4px;color:#c9c6d8">${label}</div></div>`).join('')}</div></body>`;
  const sp = await b.newPage({ viewport: { width: cols * (size + 6) + 36, height: 400 } });
  await sp.setContent(html); await sp.waitForTimeout(300);
  fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });
  await sp.screenshot({ path: path.join(OUT, 'sheets', name + '.png'), fullPage: true }); await sp.close();
};
const title = (r) => FOLK.roles[r].title;
for (const world of WORLDS) await sheet(`agents-${world}`, `The agents · ${FOLK.worlds[world].title} · tiers ${FOLK.tiers.join(' → ')}`, 5, 190,
  AGENTS.flatMap((role) => [0, 1, 2, 3, 4].map((tier) => [fig({ role, world, tier, ...CAST[role] }), `${title(role)} · ${FOLK.tiers[tier]}`])));
await sheet('agents-by-world', 'Every agent in every world (Trader tier)', 6, 190, AGENTS.flatMap((role) => WORLDS.map((world) => [fig({ role, world, tier: 2, ...CAST[role] }), `${title(role)} · ${world}`])));
await sheet('species', 'Species, each in its home world', 6, 190, AGENTS.slice(0, 5).flatMap((role) => FOLK.species.map((species) => [fig({ role, world: NATIVE[species], tier: 2, species, ...CAST[role] }), `${species} ${title(role).toLowerCase()}`])));
await sheet('poses', 'Poses', 6, 190, AGENTS.slice(0, 5).flatMap((role, i) => FOLK.poses.map((pose) => [fig({ role, world: WORLDS[i], tier: 2, ...CAST[role] }, { pose }), `${title(role)} · ${pose}`])));
await sheet('folk', 'The folk: team, kids, floor crew, clients', 6, 190, FOLKS.flatMap((role) => WORLDS.map((world) => [fig({ role, world, tier: role === 'kid' ? 0 : 1, ...CAST[role] }), `${title(role)} · ${world}`])));
await sheet('portraits', 'Portraits: Runner and Tycoon', 5, 190, AGENTS.flatMap((role) => [[fig({ role, world: 'space', tier: 0, ...CAST[role] }, { crop: 'bust' }), `${title(role)} · bust`], [fig({ role, world: 'space', tier: 4, ...CAST[role] }, { crop: 'head' }), 'Tycoon · head']]).slice(0, 20));
{
  const html = `<body style="margin:0;background:#2e3246;padding:14px;display:grid;grid-template-columns:repeat(2,900px);gap:10px">${MAPS.worlds.map((w) => `<div style="width:900px;height:562px">${mapSvg(w, { id: 'sm' + w }).replace('<svg ', '<svg width="100%" height="100%" ')}</div>`).join('')}</body>`;
  const sp = await b.newPage({ viewport: { width: 1838, height: 600 } });
  await sp.setContent(html); await sp.waitForTimeout(300);
  await sp.screenshot({ path: path.join(OUT, 'sheets', 'maps.png'), fullPage: true }); await sp.close();
}
await b.close();

// ---------------------------------------------------------------------------------------------- code, manifest, readme
fs.mkdirSync(path.join(OUT, 'code'), { recursive: true });
for (const f of ['folkSvg.js', 'mapSvg.js']) fs.copyFileSync(path.join(KIT, f), path.join(OUT, 'code', f));
fs.copyFileSync(path.join(KIT, 'PROPOSALS.md'), path.join(OUT, 'PROPOSALS.md'));
// the same code as one plain script (no modules), so it runs from a double-clicked file too
const classic = ['folkSvg.js', 'mapSvg.js'].map((f) => `(function () {\n${fs.readFileSync(path.join(KIT, f), 'utf8').replace(/^export \{[^}]*\};?\s*$/m, '')}\n})();`).join('\n');
fs.writeFileSync(path.join(OUT, 'code', 'folk-kit.js'), `// Proxyfolk folk kit as a plain script: defines window.folkSvg, window.FOLK, window.mapSvg, window.PF_MAPS.\n${classic}\n`);
fs.writeFileSync(path.join(OUT, 'code', 'example.html'), `<!doctype html><meta charset="utf-8"><title>Folk kit demo</title>
<style>body{background:#2e3246;color:#eee;font:14px Arial;margin:20px}.row{display:flex;flex-wrap:wrap;gap:8px}.row>div{width:150px;height:150px;background:#3b4058;border-radius:10px}svg{width:100%;height:100%}</style>
<h2>Agents</h2><div class="row" id="a"></div><h2>Map</h2><div id="m" style="width:960px;height:600px"></div>
<script src="folk-kit.js"></script><script>
let i = 0;
for (const role of Object.keys(FOLK.roles)) for (const pose of ['idle', 'cheer']) {
  const d = document.createElement('div');
  d.innerHTML = folkSvg({ role, world: 'cyber', tier: 3 }, { id: 's' + i++, pose });
  document.getElementById('a').append(d);
}
document.getElementById('m').innerHTML = mapSvg('farm', { id: 'map1' });
</script>`);
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), catalog: FOLK, cast: CAST, files: manifest }, null, 1));
const count = (dir) => manifest.filter((m) => m.file.startsWith(dir)).length;
fs.writeFileSync(path.join(OUT, 'README.md'), `# Proxyfolk folk kit

Every Proxyfolk character and world map redrawn in the Code Lab house style: a fat plum outline around the whole
silhouette, thinner lines between parts, light from the top left with a cool rim on the right, big glossy eyes,
round hands and chunky boots. Everything is vector: each PNG has an SVG twin with the same name, and the SVG is
the master (it scales to any size with no loss). PNGs have transparent backgrounds, except the maps.

| Folder | What | Count |
|---|---|---|
| \`agents/<role>/\` | The ten agent roles (and you, the Commander) in all 6 worlds x 5 tiers, standing. \`<world>_t<tier>-<tier name>\` | ${count('agents/')} |
| \`species/<species>/\` | Every agent as each species (human, fox, robot, grey, skeleton, octo), in that species' home world | ${count('species/')} |
| \`poses/<role>/\` | Every agent in every pose: idle, walk, phone, cheer, type, carry | ${count('poses/')} |
| \`folk/\` | The people who are not agents: the team (barber), kids, the floor crew (and its poses), clients, in every world | ${count('folk/')} |
| \`portraits/bust\`, \`/head\` | Bust and head crops, Runner (t0) and Tycoon (t4) | ${count('portraits/')} |
| \`maps/\` | The six world maps, 2400 x 1500: the station laid out as it is in the game (vault, eight rooms, dock, mast) | ${count('maps/')} |
| \`sheets/\` | Contact sheets to see everything at a glance | |
| \`code/\` | \`folkSvg.js\` and \`mapSvg.js\` (ES modules, no dependencies; each returns an SVG string), \`folk-kit.js\` (both as one plain script) and \`example.html\` (open it in a browser) | |
| \`manifest.json\` | Every file with the exact look that drew it | |
| \`PROPOSALS.md\` | 20 proposed new worlds and their casts, and new characters for the six worlds | |

Tiers: ${FOLK.tiers.map((t, i) => `${i} ${t}`).join(', ')}. The gear grows with the tier: a lanyard badge, then a tie,
then a vest and a trading-floor headset, then a jacket with gold buttons and sparkles, then gold trim, a cape,
a circlet, an aura and coins in the air. Agents carry a floating diamond in their role's color; people do not.

Roles and what each one carries:
${Object.entries(FOLK.roles).map(([k, r]) => `- **${r.title}** (\`${k}\`): ${r.tool}. ${r.does}`).join('\n')}

## Drawing one

\`\`\`js
import { folkSvg } from './code/folkSvg.js';
el.innerHTML = folkSvg(
  { role: 'prospector', world: 'castle', tier: 3, species: 'human', skin: 2, hair: 4, hairC: 3 },
  { id: 'hero1', pose: 'cheer', crop: 'full' }
);
\`\`\`

The header comment of \`folkSvg.js\` lists every option. \`mapSvg('farm', { rooms: [{ name, accent }] })\` draws a map
with your own rooms.

Rebuild everything with \`node scripts/export-folk.mjs\`.
`);
console.log(`${manifest.length} images (+ SVGs) and ${fs.readdirSync(path.join(OUT, 'sheets')).length} sheets in ${OUT}`);
