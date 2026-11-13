// Meta loadouts for the CoD mode Joshua is in, from wzhub.gg (server-rendered pages).
// Warzone: tier list + full attachments and loadout code for the top builds.
// MW4 Multiplayer: tier list only (wzhub doesn't render MP attachments server-side).
// DMZ: dmzhub.gg sits behind a bot check, so a link only.

const BASE = 'https://wzhub.gg';
const TIERS = { pure_meta: 'Absolute Meta', meta: 'Meta', new: 'New' };

// Mode from Xbox rich presence text, e.g. "Warzone: Resurgence Quads" / "Multiplayer: Hardpoint".
export function modeFrom(detail = '') {
  const d = detail.toLowerCase();
  if (/\bdmz\b/.test(d)) return 'dmz';
  if (/warzone|resurgence|battle royale|\bbr\b|plunder|rebirth|verdansk|urzikstan|blackout/.test(d)) return 'warzone';
  if (/multiplayer|deathmatch|domination|hardpoint|search and destroy|kill confirmed|ranked|gunfight|headquarters|control|free.for.all|\bmp\b/.test(d)) return 'mp';
  if (/zombies/.test(d)) return 'zombies';
  return null;
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// Tier list page -> [{ tier, name, range, game }]
export function parseList(html) {
  const out = [];
  const sections = html.split(/<section id="lo2-group-/).slice(1);
  for (const sec of sections) {
    const key = sec.slice(0, sec.indexOf('"'));
    for (const a of sec.split('<article').slice(1)) {
      const m = a.match(/aria-label="([^"]+), ([^",]+)" class="lo2-tile__toggle"/);
      if (!m) continue;
      const game = (a.match(/class="lo2-tile__game"/) && (a.match(/alt="([a-z0-9]+)" class="lo2-tile__game"/) || [])[1]) || 'mw4';
      out.push({ tier: TIERS[key] || key, name: decode(m[1]), range: decode(m[2]), game });
    }
  }
  return out;
}

// Weapon page -> first build { slots: [[slot, part]], code }
export function parseBuild(html) {
  const ul = html.match(/<ul class="lo2-details__attachments">([\s\S]*?)<\/ul>/);
  if (!ul) return null;
  const slots = [...ul[1].matchAll(/<span>([^<]+)<\/span>\s*<strong>([^<]+)<\/strong>/g)].map((m) => [decode(m[1]), decode(m[2])]);
  const code = (html.match(/<span>LOADOUT CODE<\/span>\s*<strong>([^<]+)<\/strong>/) || [])[1] || null;
  return slots.length ? { slots, code } : null;
}

const slug = (w) => `${w.game}-${w.name.toLowerCase().replace(/\s+/g, '-')}`;

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (xbox-agent)' } });
  if (!r.ok) throw new Error(`meta source ${r.status}`);
  return r.text();
}

// Returns { title, message, click } for the phone.
export async function metaFor(mode, { builds = 2 } = {}) {
  if (mode === 'dmz') {
    return { title: 'DMZ meta', message: 'dmzhub.gg blocks automated reads, so open it directly.', click: 'https://dmzhub.gg/' };
  }
  if (mode === 'zombies') {
    return { title: 'Zombies', message: 'No Zombies meta source wired in yet.', click: `${BASE}/meta` };
  }
  const isMp = mode === 'mp';
  const page = isMp ? `${BASE}/mw4-loadouts` : `${BASE}/loadouts`;
  const list = parseList(await get(page)).filter((w) => w.tier !== 'New' || isMp);
  if (!list.length) throw new Error('meta page changed: no loadouts parsed');
  const lines = [];
  const top = list.filter((w) => w.tier === 'Absolute Meta');
  const rest = list.filter((w) => w.tier !== 'Absolute Meta');
  if (!isMp) {
    for (const w of top.slice(0, builds)) {
      let b = null;
      try { b = parseBuild(await get(`${BASE}/loadouts/${slug(w)}`)); } catch {}
      lines.push(`★ ${w.name} (${w.range})`);
      if (b) {
        lines.push('  ' + b.slots.map(([s, p]) => `${s}: ${p}`).join(' · '));
        if (b.code) lines.push(`  Code: ${b.code}`);
      }
    }
    for (const w of top.slice(builds)) lines.push(`★ ${w.name} (${w.range})`);
  } else {
    for (const w of top) lines.push(`★ ${w.name} (${w.range})`);
  }
  for (const w of rest.slice(0, 4)) lines.push(`${w.tier === 'New' ? 'New' : 'Meta'}: ${w.name} (${w.range})`);
  return {
    title: isMp ? 'MW4 Multiplayer meta right now' : 'Warzone meta right now',
    message: lines.join('\n'),
    click: page,
  };
}
