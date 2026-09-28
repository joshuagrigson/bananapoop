// Proxyfolk folk kit: every character (agents, folk, kids, floor crew, visitors) as a chibi vector sprite,
// in the Code Lab house style: a fat plum outline around the whole silhouette, a thinner one between parts,
// light from the top left (a lit face, a darker rim bottom right, a cool rim light on the right edge),
// big glossy eyes, round hands, chunky boots, a soft ground shadow.
//
// No dependencies. An ES module (import { folkSvg } from './folkSvg.js'); the export script also writes it as a
// plain script (folk-kit.js, window.folkSvg). Returns an SVG string on a 64-unit grid, padded so raised arms,
// auras and tools fit.
//
//   folkSvg(look, options)
//   look: { role, world, tier, species, skin, hair, hairC, eyeC, expr, tint, agent }
//     role     prospector outreach pricing creator lister scout fulfiller auditor manager commander
//              barber kid crew client            (FOLK.roles has the titles and the tool each one carries)
//     world    space castle farm cyber alien ocean haunted pumpkin rocket lab mafia gamer   (the outfit and headgear)
//     gear     optional headgear that overrides the world's: hardhat weldmask chef cap comm goggles fedora gamerset vrset arglasses
//     tier     0 Runner, 1 Clerk, 2 Trader, 3 Broker, 4 Tycoon   (gear grows with it)
//     species  human fox robot grey skeleton octo blob alien vampire monster ghost cow pig chicken sheep cat pumpkinhead
//     coat     true puts a white lab coat on (the deep sea base's marine scientists)
//     skin, hair, hairC, eyeC: index numbers into FOLK.skins, FOLK.hairs, FOLK.hairColors, FOLK.eyeColors
//     expr     smile grin focus talk wink proud   (a pose picks its own when this is left out)
//     tint     a color for the role accent (defaults to the role's color)
//     agent    true draws the floating role diamond an AI agent carries (defaults: the ten agent roles)
//   options: { id, pose, dir, crop, phase } — phase is an optional normalized animation cycle.
//     id       unique per sprite on a page (it prefixes every gradient and clip)
//     pose     idle walk phone cheer type carry
//     dir      'r' (default) or 'l' (mirrored)
//     crop     full, bust or head
//   folkSvg(null, { catalog: true }) returns every option list.

const OUT = '#2a1d33';

// ---------------------------------------------------------------------------------------------- catalog
const ROLES = {
  prospector: { title: 'Prospector', col: '#5fd4ff', tool: 'pan', agent: true, does: 'Pans the web for leads that fit a money path.' },
  outreach: { title: 'Outreach drafter', col: '#b48cff', tool: 'envelope', agent: true, does: 'Writes first-touch messages as drafts. Never sends: the seal stays on.' },
  pricing: { title: 'Offer designer', col: '#ffb347', tool: 'tag', agent: true, does: 'Shapes offers and prices.' },
  creator: { title: 'Content creator', col: '#ff7ab8', tool: 'camera', agent: true, does: 'Films and writes content for a channel.' },
  lister: { title: 'Gig lister', col: '#9be15d', tool: 'sign', agent: true, does: 'Puts gigs up on marketplaces.' },
  scout: { title: 'Job scout', col: '#4df0d0', tool: 'spyglass', agent: true, does: 'Watches the job boards for work worth bidding on.' },
  fulfiller: { title: 'Deliverable drafter', col: '#f0e14d', tool: 'blueprint', agent: true, does: 'Drafts the thing the client paid for.' },
  auditor: { title: 'Google profile auditor', col: '#6bd6ff', tool: 'magnifier', agent: true, does: 'Audits a business profile, star by star.' },
  manager: { title: 'Monthly GBP manager', col: '#ffa3f5', tool: 'pin', agent: true, does: 'Tends a profile every month: posts, photos, replies drafted.' },
  commander: { title: 'Commander', col: '#e0b84a', tool: 'scepter', agent: false, does: 'You.' },
  barber: { title: 'Barber', col: '#f472b6', tool: 'scissors', agent: false, does: 'A person on the team, one character each.' },
  kid: { title: 'Kid', col: '#60a5fa', tool: 'broom', agent: false, does: 'Checks chores off and earns allowance.' },
  crew: { title: 'Floor crew', col: '#9aa6c0', tool: 'papers', agent: false, does: 'The trading-floor crowd. Atmosphere, not ledger lines.' },
  client: { title: 'Client', col: '#e8e4d8', tool: 'coffee', agent: false, does: 'Someone who walked in for a service.' },
};
const TIERS = ['Runner', 'Clerk', 'Trader', 'Broker', 'Tycoon'];
const WORLDS = {
  space: { title: 'Space station', suit: '#e9edf5', trim: '#ff8a3d', legs: '#dfe4ee', boots: '#b9c2d3', jacket: '#2f3f6e', gear: 'comm' },
  castle: { title: 'Dark castle', suit: '#7a3346', trim: '#c9a25a', legs: '#5a4034', boots: '#4a2e24', jacket: '#3e2350', gear: 'hood' },
  farm: { title: 'Farm', suit: '#3f74b0', trim: '#c8453a', legs: '#3f74b0', boots: '#7a4a2a', jacket: '#6b4a2e', gear: 'straw' },
  cyber: { title: 'Cyberpunk city', suit: '#262636', trim: null, legs: '#2c3348', boots: '#f0f0f5', jacket: '#1b1b28', gear: 'visor' },
  alien: { title: 'Alien ship', suit: '#3c4f93', trim: '#7ef0c8', legs: '#34437d', boots: '#23233a', jacket: '#2a2f5e', gear: 'crest' },
  ocean: { title: 'Deep sea base', suit: '#1f3d60', trim: '#ffd23f', legs: '#1f3d60', boots: '#ffd23f', jacket: '#16304e', gear: 'mask' },
  haunted: { title: 'Haunted mansion', suit: '#2a2233', trim: '#8a1c2b', legs: '#1e1a24', boots: '#141018', jacket: '#1a1420', gear: 'tophat' },
  pumpkin: { title: 'Pumpkin patch', suit: '#e8741a', trim: '#2a1d33', legs: '#3a2a4a', boots: '#4a2e24', jacket: '#5a2a6a', gear: 'costume' },
  rocket: { title: 'Rocket works', suit: '#f2f4f8', trim: '#ff6a1a', legs: '#e3e7ee', boots: '#2b2f3c', jacket: '#1d2b4a', gear: 'hardhat' },
  lab: { title: 'Mad scientist lab', suit: '#f7f7f2', trim: '#7dff4a', legs: '#3a3f58', boots: '#2a2a33', jacket: '#eef0ea', gear: 'goggles' },
  mafia: { title: 'Family mansion', suit: '#2a2a32', trim: '#e0b454', legs: '#26262e', boots: '#1a1418', jacket: '#1e1e26', gear: 'fedora' },
  gamer: { title: 'Game den', suit: '#3a2a6a', trim: '#39ff9e', legs: '#23233a', boots: '#f0f0f5', jacket: '#2a1f4a', gear: 'gamerset' },
};
const SPECIES = ['human', 'fox', 'robot', 'grey', 'skeleton', 'octo', 'blob', 'alien', 'vampire', 'monster', 'ghost', 'cow', 'pig', 'chicken', 'sheep', 'cat', 'pumpkinhead'];
const SKINS = ['#fbdcc6', '#f3c5a2', '#dea57c', '#bd7c52', '#8f5b3b', '#5f3b29'];
const HAIRS = ['short', 'bob', 'long', 'bun', 'spiky', 'puff', 'pony'];
const HAIR_COLORS = ['#5a3726', '#2b2126', '#e3b65c', '#b8502e', '#a3a9b8', '#ee76ae', '#3fb0cf'];
const EYE_COLORS = ['#c98a2c', '#5b8f3a', '#3b7fc4', '#7a4b2a', '#8d5fd3', '#2a2a2a'];
const EXPRS = ['smile', 'grin', 'focus', 'talk', 'wink', 'proud', 'sleep'];
const POSES = ['idle', 'walk', 'walk2', 'phone', 'cheer', 'type', 'carry'];
const FUR = { fox: ['#e98a3c', '#fff4ea'], octo: ['#a466d8', '#e7c9ff'], grey: ['#a9c2b4', '#d9eadf'], skeleton: ['#efe8da', '#fffaf0'], robot: ['#b9c4d6', '#e8eef7'], blob: ['#6fdc9a', '#c9ffd9'],
  vampire: ['#e4def0', '#f6f2fb'], monster: ['#8fbf72', '#b9dca4'], ghost: ['#eef2ff', '#ffffff'], cow: ['#f7f4ee', '#ffb8c4'], pig: ['#f7aebe', '#ffd3dc'], chicken: ['#fbf8f0', '#ffffff'], sheep: ['#6e5b52', '#f4efe2'], cat: ['#2f2a38', '#4a4458'], pumpkinhead: ['#f08a24', '#ffc46a'] };
// the alien crew's skins: green, mint, violet, teal, lime, sky blue
const ALIEN_SKINS = ['#86dc6a', '#7fe0b0', '#b48cf0', '#62d2dc', '#c8e65a', '#8fb4ff'];
// robots dress for their world: a sleek neon droid in the city, a riveted tin bot in the lab, a service bot elsewhere
const ROBOT = { cyber: ['#5b6478', '#8a94aa'], lab: ['#c3cad6', '#eef1f6'] };
// the colour a species is painted in (its fur, skin, shell or sheet), and its paler second colour
function furOf(L) {
  if (L.species === 'alien') { const c = at(ALIEN_SKINS, L.skin); return [c, light(c, 0.45)]; }
  if (L.species === 'robot' && ROBOT[L.world]) return ROBOT[L.world];
  return FUR[L.species] || null;
}
const handOf = (L) => (L.species === 'skeleton' ? '#efe8da' : L.species === 'robot' ? (L.world === 'cyber' ? '#3a4152' : '#9aa6bd') : L.species === 'cow' ? '#3a2e2c' : L.species === 'sheep' ? '#4a3c36' : L.species === 'chicken' ? '#f2b33a' : furOf(L) ? furOf(L)[0] : at(SKINS, L.skin));
// species that wear no hat of their world (the hat would hide what they are)
const BAREHEAD = new Set(['cat', 'blob', 'ghost', 'vampire', 'monster', 'pumpkinhead', 'chicken', 'sheep', 'alien']);
// the city's hair runs neon
const NEON_HAIR = ['#ff3fb8', '#39f0ff', '#b0ff3a', '#a46bff', '#f4f4f4', '#ff8a1a', '#2b2126'];

// ---------------------------------------------------------------------------------------------- color helpers
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const dark = (c, t) => mix(c, '#1a0f24', t);
const light = (c, t) => mix(c, '#ffffff', t);
// one color becomes the five a part is painted with
const tones = (c) => ({ base: dark(c, 0.2), lit: c, hi: light(c, 0.42), cool: mix(light(c, 0.3), '#a8dcff', 0.45), line: dark(c, 0.5) });
const f = (n) => (Math.round(n * 100) / 100).toString();
// any whole number picks from a list, negatives and all
const at = (arr, i) => arr[((((i | 0) % arr.length) + arr.length) % arr.length)];

// ---------------------------------------------------------------------------------------------- geometry helpers
const ell = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
const rrect = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
// a capsule from A to B, radius r: sleeves, legs, tubes
function capsule(ax, ay, bx, by, r, r2 = r) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  return `M${f(ax + nx * r)} ${f(ay + ny * r)}L${f(bx + nx * r2)} ${f(by + ny * r2)}A${f(r2)} ${f(r2)} 0 0 1 ${f(bx - nx * r2)} ${f(by - ny * r2)}L${f(ax - nx * r)} ${f(ay - ny * r)}A${f(r)} ${f(r)} 0 0 1 ${f(ax + nx * r)} ${f(ay + ny * r)}Z`;
}
const star = (cx, cy, r, k = 0.38) => { let d = ''; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * k : r; d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rr) + ' ' + f(cy + Math.sin(a) * rr); } return d + 'Z'; };
const sparkle = (cx, cy, r, col = '#fff6d8', op = 1) => `<path d="${star(cx, cy, r, 0.22)}" fill="${col}" opacity="${op}"/>`;

// ---------------------------------------------------------------------------------------------- the painter
// A figure is a tree of groups (with a transform) holding parts. Each part is one closed shape painted with the
// house recipe; it is drawn twice: once, with every other part, as the fat outline behind the whole figure,
// and once on its own with its fill, shading and details.
function Painter(id) {
  let n = 0;
  const defs = [];
  const P = {
    grad(stops, x2 = 0.5, y2 = 1) {
      const gid = `${id}-g${++n}`;
      defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}"${op < 1 ? ` stop-opacity="${op}"` : ''}/>`).join('')}</linearGradient>`);
      return `url(#${gid})`;
    },
    radial(stops) {
      const gid = `${id}-r${++n}`;
      defs.push(`<radialGradient id="${gid}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</radialGradient>`);
      return `url(#${gid})`;
    },
    // a part: d (path), col (its color), w (inner outline weight), detail (svg drawn inside it), flat (no shading),
    // grad (fill override for the lit layer), noOut (kept out of the fat outline), rim (false to skip the rim lights)
    part(d, col, o = {}) {
      const pid = `${id}-p${++n}`;
      defs.push(`<path id="${pid}" d="${d}"/><clipPath id="${pid}c"><use href="#${pid}"/></clipPath>`);
      return { pid, d, col, ...o };
    },
    defs: () => defs.join(''),
  };
  return P;
}
function paintPart(p) {
  const t = tones(p.col), w = p.w ?? 2;
  let s = '';
  if (w > 0) s += `<use href="#${p.pid}" fill="${OUT}" stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round"/>`;
  if (p.flat) { s += `<use href="#${p.pid}" fill="${p.grad || p.col}"/>`; if (p.detail) s += `<g clip-path="url(#${p.pid}c)">${p.detail}</g>`; return s; }
  s += `<use href="#${p.pid}" fill="${t.base}"/><g clip-path="url(#${p.pid}c)"><use href="#${p.pid}" fill="${p.grad || t.lit}" transform="translate(-0.7 -0.75)"/>`;
  if (p.rim !== false) {
    s += `<path d="M-60 -60H130V130H-60Z${p.d}" fill-rule="evenodd" fill="${t.hi}" opacity=".7" transform="translate(0.45 0.55)"/>`;
    s += `<path d="M-60 -60H130V130H-60Z${p.d}" fill-rule="evenodd" fill="${t.cool}" opacity=".6" transform="translate(-0.8 0)"/>`;
  }
  if (p.detail) s += p.detail;
  s += `</g><use href="#${p.pid}" fill="none" stroke="${t.line}" stroke-width=".7" stroke-linejoin="round"/>`;
  return s;
}
// node: { tf, parts: [...], kids: [...], under: '', over: '' }
function paintTree(node, mode) {
  let s = node.tf ? `<g transform="${node.tf}">` : '<g>';
  if (mode === 'fill' && node.under) s += node.under;
  for (const item of node.items || []) {
    if (item.kid) s += paintTree(item.kid, mode);
    else if (mode === 'out') { if (!item.noOut) s += `<use href="#${item.pid}" fill="${OUT}" stroke="${OUT}" stroke-width="3.8" stroke-linejoin="round" stroke-linecap="round"/>`; }
    else s += paintPart(item);
  }
  if (mode === 'fill' && node.over) s += node.over;
  return s + '</g>';
}
const G = (tf, ...items) => ({ tf, items: items.flat().filter(Boolean).map((it) => (it.items ? { kid: it } : it)) });

// ---------------------------------------------------------------------------------------------- the face
function eyes(P, look, ex, ey, mode, species) {
  const eyeC = species === 'vampire' ? '#e0304a' : species === 'cat' ? '#9be04a' : species === 'monster' ? '#c9a02c' : at(EYE_COLORS, look.eyeC);
  // an alien's eyes: two huge glossy black almonds, tilted up at the outer corners
  if (species === 'alien') {
    if (mode === 'sleep' || mode === 'grin') return [-1, 1].map((s) => `<path d="M${f(32.2 + s * 2.4)} ${f(ey - 0.6)}Q${f(32.2 + s * 6)} ${f(ey + (mode === 'grin' ? -2.4 : 1.6))} ${f(32.2 + s * 9.6)} ${f(ey - 2.6)}" fill="none" stroke="${OUT}" stroke-width="1.2" stroke-linecap="round"/>`).join('');
    const g = P.grad([[0, '#241e34'], [0.6, '#0c0a14'], [1, '#2e2848']]);
    return [-1, 1].map((s) => {
      const X = (v) => f(32.2 + s * v);
      const wink = mode === 'wink' && s > 0;
      if (wink) return `<path d="M${X(2.4)} ${f(ey - 0.6)}Q${X(6)} ${f(ey - 2.8)} ${X(9.6)} ${f(ey - 2.6)}" fill="none" stroke="${OUT}" stroke-width="1.2" stroke-linecap="round"/>`;
      return `<path d="M${X(1.6)} ${f(ey + 0.6)}Q${X(1.8)} ${f(ey - 3.4)} ${X(6.6)} ${f(ey - 4.6)}Q${X(10.8)} ${f(ey - 5.2)} ${X(10.2)} ${f(ey - 1.6)}Q${X(9.2)} ${f(ey + 2.6)} ${X(5.2)} ${f(ey + 3.2)}Q${X(1.6)} ${f(ey + 3.4)} ${X(1.6)} ${f(ey + 0.6)}Z" fill="${g}" stroke="${OUT}" stroke-width=".7"/>`
        + `<ellipse cx="${X(5.4)}" cy="${f(ey - 2)}" rx="1.7" ry="1" fill="#fff" opacity=".9" transform="rotate(${s * -25} ${X(5.4)} ${f(ey - 2)})"/><circle cx="${X(7.6)}" cy="${f(ey + 0.8)}" r=".6" fill="${look._accent}" opacity=".85"/>`;
    }).join('');
  }
  // a jack-o'-lantern's eyes are carved triangles with the candle behind them
  if (species === 'pumpkinhead') return [-1, 1].map((s) => { const x = 32.2 + s * 5; return `<path d="M${f(x - 2.8)} ${f(ey + 1.4)}L${f(x)} ${f(ey - (mode === 'sleep' ? 0.4 : 2.8))}L${f(x + 2.8)} ${f(ey + 1.4)}Z" fill="#ffd23f" stroke="#8a3a08" stroke-width=".6"/><path d="M${f(x - 1.2)} ${f(ey + 0.8)}L${f(x)} ${f(ey - 0.8)}L${f(x + 1.2)} ${f(ey + 0.8)}Z" fill="#fff6c4"/>`; }).join('');
  const one = (x, closed, wink) => {
    if (mode === 'sleep') return `<path d="M${f(x - 2.2)} ${f(ey + 0.2)}Q${f(x)} ${f(ey + 1.7)} ${f(x + 2.2)} ${f(ey + 0.2)}" fill="none" stroke="${OUT}" stroke-width="1.05" stroke-linecap="round"/>`;
    if (closed || wink) return `<path d="M${f(x - 2.3)} ${f(ey + 0.6)}Q${f(x)} ${f(ey - 2.2)} ${f(x + 2.3)} ${f(ey + 0.6)}" fill="none" stroke="${OUT}" stroke-width="1.05" stroke-linecap="round"/>`;
    if (species === 'grey') {
      const g = P.grad([[0, '#1d1a2a'], [0.6, '#0c0a14'], [1, '#2a2440']]);
      return `<path d="M${f(x - 3.1)} ${f(ey - 0.2)}Q${f(x - 2.4)} ${f(ey - 3.6)} ${f(x + 1)} ${f(ey - 3.1)}Q${f(x + 3.4)} ${f(ey - 2.3)} ${f(x + 2.6)} ${f(ey + 0.9)}Q${f(x + 1.4)} ${f(ey + 3)} ${f(x - 1.4)} ${f(ey + 2.4)}Q${f(x - 3.3)} ${f(ey + 1.7)} ${f(x - 3.1)} ${f(ey - 0.2)}Z" fill="${g}" stroke="${OUT}" stroke-width=".6"/>`
        + `<ellipse cx="${f(x - 0.6)}" cy="${f(ey - 1.4)}" rx="1.1" ry=".7" fill="#fff" opacity=".85" transform="rotate(-25 ${f(x - 0.6)} ${f(ey - 1.4)})"/><circle cx="${f(x + 1.3)}" cy="${f(ey + 1)}" r=".4" fill="#9ff6d8" opacity=".8"/>`;
    }
    if (species === 'ghost') return `<ellipse cx="${f(x)}" cy="${f(ey)}" rx="2.1" ry="${mode === 'focus' ? 1.8 : 2.9}" fill="#2a2440"/><circle cx="${f(x + 0.6)}" cy="${f(ey - 1)}" r=".6" fill="#fff" opacity=".7"/>`;
    if (species === 'robot' && look.world === 'cyber') return '';
    if (species === 'robot' && look.world === 'lab') return `<circle cx="${f(x)}" cy="${f(ey)}" r="2.6" fill="#3a4152" stroke="#8a94aa" stroke-width=".6"/><circle cx="${f(x)}" cy="${f(ey)}" r="${mode === 'focus' ? 1.1 : 1.7}" fill="#ffd23f"/><circle cx="${f(x - 0.6)}" cy="${f(ey - 0.6)}" r=".55" fill="#fff"/>`;
    if (species === 'robot') return `<rect x="${f(x - 1.7)}" y="${f(ey - 2.2)}" width="3.4" height="${mode === 'focus' ? 2.4 : 4.2}" rx="1.4" fill="${look._accent}"/><rect x="${f(x - 1)}" y="${f(ey - 1.7)}" width="1.1" height="1.3" rx=".5" fill="#fff" opacity=".85"/>`;
    if (species === 'skeleton') return `<path d="M${f(x - 2.4)} ${f(ey)}Q${f(x - 2.4)} ${f(ey - 2.8)} ${f(x)} ${f(ey - 2.8)}Q${f(x + 2.4)} ${f(ey - 2.8)} ${f(x + 2.4)} ${f(ey)}Q${f(x + 2.2)} ${f(ey + 2.6)} ${f(x)} ${f(ey + 2.6)}Q${f(x - 2.2)} ${f(ey + 2.6)} ${f(x - 2.4)} ${f(ey)}Z" fill="#2a1d33"/><circle cx="${f(x)}" cy="${f(ey + (mode === 'focus' ? 0.6 : 0))}" r="1" fill="${look._accent}"/><circle cx="${f(x)}" cy="${f(ey)}" r="1.9" fill="${look._accent}" opacity=".25"/>`;
    const dy = mode === 'focus' ? 0.55 : 0;
    const iris = P.grad([[0, dark(eyeC, 0.35)], [0.55, eyeC], [1, light(eyeC, 0.35)]], 0, 1);
    let e = `<ellipse cx="${f(x)}" cy="${f(ey)}" rx="2.45" ry="2.95" fill="${OUT}"/>`;
    e += `<ellipse cx="${f(x)}" cy="${f(ey + 0.25)}" rx="1.95" ry="2.45" fill="${iris}"/>`;
    e += `<ellipse cx="${f(x)}" cy="${f(ey + 0.45 + dy)}" rx="1.05" ry="1.35" fill="#1e1422"/>`;
    e += `<circle cx="${f(x + 0.75)}" cy="${f(ey - 0.85 + dy)}" r=".8" fill="#fff"/><circle cx="${f(x - 0.65)}" cy="${f(ey + 1.05 + dy)}" r=".38" fill="#fff" opacity=".9"/>`;
    // the lash line: a heavy lid over the top with a flick at the outer corner
    const outer = x < 32 ? -1 : 1;
    e += `<path d="M${f(x - 2.7)} ${f(ey - 1)}Q${f(x)} ${f(ey - 3.9 + dy * 1.6)} ${f(x + 2.7)} ${f(ey - 1)}" fill="none" stroke="${OUT}" stroke-width="1.15" stroke-linecap="round"/>`;
    e += `<path d="M${f(x + outer * 2.5)} ${f(ey - 1.3)}l${f(outer * 0.9)} -0.7" fill="none" stroke="${OUT}" stroke-width=".8" stroke-linecap="round"/>`;
    if (mode === 'focus') e += `<path d="M${f(x - 2.6)} ${f(ey - 1.1)}Q${f(x)} ${f(ey - 2)} ${f(x + 2.6)} ${f(ey - 1.1)}V${f(ey - 3.2)}H${f(x - 2.6)}Z" fill="${look._lid}"/><path d="M${f(x - 2.6)} ${f(ey - 1.1)}Q${f(x)} ${f(ey - 2)} ${f(x + 2.6)} ${f(ey - 1.1)}" fill="none" stroke="${OUT}" stroke-width="1.05" stroke-linecap="round"/>`;
    return e;
  };
  const closed = mode === 'grin';
  return one(ex, closed, false) + one(64.4 - ex, closed, mode === 'wink');
}
function mouth(look, mode, species, cy = 31.1) {
  if (species === 'cow' || species === 'chicken') return '';
  if (species === 'pig') cy = 33.8;
  if (species === 'alien') cy = 31.6;
  if (species === 'ghost') return `<ellipse cx="32.2" cy="${f(cy + 0.6)}" rx="${mode === 'talk' || mode === 'grin' ? 1.8 : 1.2}" ry="${mode === 'talk' || mode === 'grin' ? 2 : 1.3}" fill="#2a2440"/>`;
  if (species === 'pumpkinhead') return `<path d="M25.6 ${f(cy - 1)}L27.6 ${f(cy + 0.6)}L29.4 ${f(cy - 0.4)}L31.2 ${f(cy + 1.2)}L33.2 ${f(cy - 0.4)}L35 ${f(cy + 1.2)}L36.8 ${f(cy - 0.4)}L38.8 ${f(cy - 1)}Q37 ${f(cy + (mode === 'grin' || mode === 'talk' ? 4.4 : 3))} 32.2 ${f(cy + (mode === 'grin' || mode === 'talk' ? 4.6 : 3.2))}Q27.4 ${f(cy + (mode === 'grin' || mode === 'talk' ? 4.4 : 3))} 25.6 ${f(cy - 1)}Z" fill="#ffd23f" stroke="#8a3a08" stroke-width=".6"/>`;
  if (species === 'monster') return `<path d="M29 ${f(cy)}H35.4" stroke="#2a3a22" stroke-width=".9" stroke-linecap="round"/><path d="M30.2 ${f(cy - 0.7)}V${f(cy + 0.7)}M32.2 ${f(cy - 0.7)}V${f(cy + 0.7)}M34.2 ${f(cy - 0.7)}V${f(cy + 0.7)}" stroke="#2a3a22" stroke-width=".5"/>`;
  if (species === 'vampire') return `<path d="M29.8 ${f(cy - 0.4)}Q32.2 ${f(cy + 1.4)} 34.6 ${f(cy - 0.4)}" fill="#6a1a2a" stroke="#4a1020" stroke-width=".7" stroke-linecap="round"/><path d="M30.4 ${f(cy - 0.1)}L31 ${f(cy + 1.8)}L31.6 ${f(cy + 0.3)}ZM32.8 ${f(cy + 0.3)}L33.4 ${f(cy + 1.8)}L34 ${f(cy - 0.1)}Z" fill="#fff" stroke="${OUT}" stroke-width=".3"/>`;
  if (species === 'skeleton') return `<path d="M29.2 ${f(cy - 0.2)}H35.2" stroke="${OUT}" stroke-width=".7"/><path d="M30.2 ${f(cy - 0.9)}V${f(cy + 0.6)}M31.7 ${f(cy - 0.9)}V${f(cy + 0.6)}M33.2 ${f(cy - 0.9)}V${f(cy + 0.6)}M34.4 ${f(cy - 0.8)}V${f(cy + 0.4)}" stroke="${OUT}" stroke-width=".45"/>`;
  if (species === 'robot') return mode === 'talk' || mode === 'grin' ? `<rect x="29.9" y="${f(cy - 0.7)}" width="4.6" height="1.7" rx=".7" fill="${look._accent}"/>` : `<path d="M30 ${f(cy)}H34.4" stroke="${look._accent}" stroke-width=".9" stroke-linecap="round"/>`;
  if (mode === 'grin') return `<path d="M29.5 ${f(cy - 0.9)}Q32.2 ${f(cy - 0.3)} 34.9 ${f(cy - 0.9)}Q34.6 ${f(cy + 2.6)} 32.2 ${f(cy + 2.7)}Q29.8 ${f(cy + 2.6)} 29.5 ${f(cy - 0.9)}Z" fill="#7a2338" stroke="${OUT}" stroke-width=".6"/><path d="M30.6 ${f(cy + 1.4)}Q32.2 ${f(cy + 0.7)} 33.8 ${f(cy + 1.4)}Q33.3 ${f(cy + 2.4)} 32.2 ${f(cy + 2.4)}Q31.1 ${f(cy + 2.4)} 30.6 ${f(cy + 1.4)}Z" fill="#ff8aa0"/><path d="M30 ${f(cy - 0.6)}H34.4" stroke="#fff" stroke-width=".5" opacity=".9"/>`;
  if (mode === 'sleep') return `<ellipse cx="32.2" cy="${f(cy + 0.4)}" rx=".7" ry=".55" fill="#8a3040"/>`;
  if (mode === 'talk') return `<ellipse cx="32.2" cy="${f(cy + 0.5)}" rx="1.35" ry="1.15" fill="#7a2338" stroke="${OUT}" stroke-width=".55"/><ellipse cx="32.2" cy="${f(cy + 0.95)}" rx=".75" ry=".45" fill="#ff8aa0"/>`;
  if (mode === 'focus') return `<path d="M30.9 ${f(cy)}Q32.2 ${f(cy + 0.9)} 33.5 ${f(cy)}" fill="none" stroke="#8a3040" stroke-width=".8" stroke-linecap="round"/>`;
  if (mode === 'proud') return `<path d="M30 ${f(cy - 0.3)}Q32.5 ${f(cy + 1.9)} 34.8 ${f(cy - 0.7)}" fill="none" stroke="#8a3040" stroke-width=".9" stroke-linecap="round"/>`;
  return `<path d="M30.3 ${f(cy - 0.2)}Q32.2 ${f(cy + 1.7)} 34.1 ${f(cy - 0.2)}" fill="#a83a52" stroke="#8a3040" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ---------------------------------------------------------------------------------------------- heads
function headParts(P, look, pose, mode) {
  const sp = look.species, skin = at(SKINS, look.skin);
  // the mad scientist's hair is white or grey, Doc Brown style; the city's runs neon
  const hairC = look.world === 'lab' ? (look.hairC % 3 === 2 ? '#a3a9b8' : '#f1f1ec') : look.world === 'cyber' ? at(NEON_HAIR, look.hairC) : at(HAIR_COLORS, look.hairC);
  const fo = furOf(look), fur = fo ? fo[0] : skin, pale = fo ? fo[1] : light(skin, 0.4);
  const back = [], face = [], front = [];
  let over = '';
  const headD = 'M32.2 15.2C39.1 15.2 43.6 19.6 43.6 25.4C43.6 30.9 39 35 32.2 35C25.4 35 20.8 30.9 20.8 25.4C20.8 19.6 25.3 15.2 32.2 15.2Z';
  const ey = 26.3, ex = 27.2;
  const blush = `<ellipse cx="24.8" cy="29.6" rx="1.9" ry="1.1" fill="#ff7f8f" opacity=".45"/><ellipse cx="39.6" cy="29.6" rx="1.9" ry="1.1" fill="#ff7f8f" opacity=".45"/>`;
  if (sp === 'human') {
    back.push(P.part(ell(21.1, 27, 1.7, 2.3), skin, { w: 1.6 }), P.part(ell(43.3, 27, 1.7, 2.3), skin, { w: 1.6 }));
    hairParts(P, look, hairC, back, front);
    face.push(P.part(headD, skin, { grad: P.grad([[0, light(skin, 0.18)], [0.7, skin], [1, dark(skin, 0.06)]], 0.3, 1) }));
    over += blush + `<path d="M32.3 28.5q.5 .45 0 .8" fill="none" stroke="${dark(skin, 0.3)}" stroke-width=".55" stroke-linecap="round"/>`;
    over += brows(hairC);
    // the city: a glowing implant line down one cheek
    if (look.world === 'cyber') over += `<path d="M40.2 25.4V29.2L38.6 30.6" fill="none" stroke="${look._accent}" stroke-width=".7" stroke-linecap="round"/><circle cx="40.2" cy="25.2" r=".75" fill="${look._accent}"/><circle cx="38.5" cy="30.7" r=".55" fill="#fff" opacity=".9"/>`;
    // the family: a moustache on some of them
    if (look.world === 'mafia' && look.role !== 'kid' && look.hair % 2 === 0) over += `<path d="M28.4 30.2Q30.6 28.6 32.2 29.8Q33.8 28.6 36 30.2Q34.2 30.9 32.2 30.4Q30.2 30.9 28.4 30.2Z" fill="${dark(hairC, 0.15)}"/>`;
  } else if (sp === 'vampire') {
    // vampires: pale, with a widow's peak of slicked black hair and a high cape collar
    back.push(P.part(ell(21.1, 26.4, 1.7, 2.6), fur, { w: 1.6 }), P.part(ell(43.3, 26.4, 1.7, 2.6), fur, { w: 1.6 }));
    back.push(P.part('M16.4 36.4Q14.2 24 17.6 15.6Q21 22 23.4 31.4Z', '#1a1220', { w: 1.8, detail: `<path d="M17.8 18.4Q20.4 24.4 22.2 30.6L20.4 33.6Q17.4 26 17.8 18.4Z" fill="#9a1c2e"/>` }));
    back.push(P.part('M48 36.4Q50.2 24 46.8 15.6Q43.4 22 41 31.4Z', '#1a1220', { w: 1.8, detail: `<path d="M46.6 18.4Q44 24.4 42.2 30.6L44 33.6Q47 26 46.6 18.4Z" fill="#9a1c2e"/>` }));
    face.push(P.part(headD, fur, { grad: P.grad([[0, '#f7f3fc'], [0.7, fur], [1, '#cfc4e0']], 0.3, 1) }));
    front.push(P.part('M20.6 24.4C20.2 17.6 24.8 13.8 32.2 13.8C39.6 13.8 44.2 17.6 43.8 24.4Q42.8 20.6 40.2 19.6Q36 18.4 32.2 23.2Q28.4 18.4 24.2 19.6Q21.6 20.6 20.6 24.4Z', '#16121c', { detail: `<path d="M25 17.4Q30 15 36.4 16.2" fill="none" stroke="#5a4a72" stroke-width="1" stroke-linecap="round" opacity=".8"/>` }));
    over += `<path d="M25.2 22.6L29 23.4M39.2 22.6L35.4 23.4" stroke="#16121c" stroke-width=".9" stroke-linecap="round"/><ellipse cx="24.8" cy="29.6" rx="1.8" ry="1" fill="#b890c8" opacity=".35"/><ellipse cx="39.6" cy="29.6" rx="1.8" ry="1" fill="#b890c8" opacity=".35"/>`;
  } else if (sp === 'monster') {
    // the monster: a flat-topped green head, a stitched brow, bolts in the neck
    back.push(P.part(capsule(18.6, 32.4, 22.4, 32.4, 1.1), '#8a93a6', { w: 1.3 }), P.part(capsule(42, 32.4, 45.8, 32.4, 1.1), '#8a93a6', { w: 1.3 }));
    back.push(P.part(ell(20.8, 26.2, 1.6, 2.2), fur, { w: 1.6 }), P.part(ell(43.6, 26.2, 1.6, 2.2), fur, { w: 1.6 }));
    face.push(P.part('M22.4 14.6H42Q43.6 14.6 43.6 16.4V29.6C43.6 33.4 38.8 35.4 32.2 35.4C25.6 35.4 20.8 33.4 20.8 29.6V16.4Q20.8 14.6 22.4 14.6Z', fur, { grad: P.grad([[0, light(fur, 0.2)], [0.7, fur], [1, dark(fur, 0.1)]], 0.3, 1) }));
    front.push(P.part('M20.4 19.8V14.6Q20.4 11.6 23.6 11.6H40.8Q44 11.6 44 14.6V19.8L41.6 18L39.4 20.2L37 17.8L34.6 20L32.2 17.6L29.8 20L27.4 17.8L25 20.2L22.8 18Z', '#1c1a22', { detail: `<path d="M23.6 13.4H38" stroke="#4a4652" stroke-width=".8" stroke-linecap="round"/>` }));
    over += `<path d="M24.6 22.2H30M34.4 22.2H39.8" stroke="${dark(fur, 0.45)}" stroke-width="1.3" stroke-linecap="round"/><path d="M22.6 28.6L27 31.4" stroke="#2a3a22" stroke-width=".6"/><path d="M23.4 28L22.8 29.6M24.8 28.9L24.2 30.5M26.2 29.8L25.6 31.4" stroke="#2a3a22" stroke-width=".5"/>`;
  } else if (sp === 'ghost') {
    // a ghost is one sheet: the head is its dome
    face.push(P.part('M32.2 13.2C40.2 13.2 44.4 18.6 44.4 25.4V36H20V25.4C20 18.6 24.2 13.2 32.2 13.2Z', fur, { grad: P.grad([[0, '#ffffff'], [0.6, fur], [1, '#cfd8f4']], 0.3, 1) }));
    over += `<ellipse cx="24.4" cy="30" rx="1.8" ry="1" fill="#9fb6ff" opacity=".35"/><ellipse cx="40" cy="30" rx="1.8" ry="1" fill="#9fb6ff" opacity=".35"/>`;
  } else if (sp === 'alien') {
    // an alien's head is most of it: a big domed cranium over a small chin
    const ant = look.hair % 3 === 0, brain = look.hair % 3 === 1;
    if (ant) for (const s of [-1, 1]) back.push(P.part(capsule(32.2 + s * 4.2, 8.6, 32.2 + s * 8.6, 1.4, 0.55), dark(fur, 0.15), { w: 1.2 }), P.part(ell(32.2 + s * 8.9, 0.9, 1.9, 1.9), look._accent, { w: 1.3, detail: `<circle cx="${f(32.2 + s * 8.9 - 0.6)}" cy="0.3" r=".6" fill="#fff" opacity=".8"/>` }));
    const ridges = brain ? `<path d="M24.6 12.6Q28 9.6 31.4 12.4Q34.6 9.4 38.2 12.2M22.4 17.4Q26 14.6 29.4 17.2M35 17.2Q38.4 14.4 42 17.2" fill="none" stroke="${dark(fur, 0.22)}" stroke-width=".8" stroke-linecap="round" opacity=".8"/>` : `<circle cx="38.8" cy="10.4" r="1.1" fill="${dark(fur, 0.16)}" opacity=".6"/><circle cx="41.6" cy="14" r=".7" fill="${dark(fur, 0.16)}" opacity=".6"/><circle cx="24" cy="12.6" r=".8" fill="${dark(fur, 0.16)}" opacity=".5"/>`;
    face.push(P.part('M32.2 4C43.8 4 48.6 11.6 48 19.6C47.4 27.6 39.8 35.6 32.2 35.6C24.6 35.6 17 27.6 16.4 19.6C15.8 11.6 20.6 4 32.2 4Z', fur, { grad: P.grad([[0, light(fur, 0.35)], [0.6, fur], [1, dark(fur, 0.1)]], 0.2, 1), detail: ridges + `<path d="M25 8.6Q30 6 36.4 7.2" fill="none" stroke="${light(fur, 0.55)}" stroke-width="1" stroke-linecap="round" opacity=".8"/>` }));
    over += `<ellipse cx="22.6" cy="28.4" rx="1.5" ry=".9" fill="${light(fur, 0.5)}" opacity=".5"/><ellipse cx="41.8" cy="28.4" rx="1.5" ry=".9" fill="${light(fur, 0.5)}" opacity=".5"/>`;
  } else if (sp === 'cow') {
    back.push(P.part('M22.6 16.6Q20.6 11.4 22.4 9.4Q23.4 12.4 25.6 14.4Z', '#efe3c4', { w: 1.4 }), P.part('M41.8 16.6Q43.8 11.4 42 9.4Q41 12.4 38.8 14.4Z', '#efe3c4', { w: 1.4 }));
    back.push(P.part('M21.8 21.4Q15.6 19.4 14.2 22.6Q16.4 25.4 21.4 24.6Z', fur, { w: 1.6, detail: `<path d="M20.6 22.2Q17.4 21.4 16 22.6Q17.6 23.8 20.4 23.6Z" fill="#ffb8c4"/>` }), P.part('M42.6 21.4Q48.8 19.4 50.2 22.6Q48 25.4 43 24.6Z', fur, { w: 1.6, detail: `<path d="M43.8 22.2Q47 21.4 48.4 22.6Q46.8 23.8 44 23.6Z" fill="#ffb8c4"/>` }));
    face.push(P.part(headD, fur, { detail: `<path d="M34.6 15Q41.8 14.4 43.8 20.4Q41.4 22.8 38.2 21.4Q35.2 19.8 34.6 15Z" fill="#2a2226"/><path d="M20.8 23Q23 21.6 25 23.4Q24.6 26 21.4 26.2Z" fill="#2a2226"/>` }));
    front.push(P.part(ell(32.2, 31.4, 7, 3.9), '#ffb8c4', { w: 1.6, detail: `<ellipse cx="29.6" cy="31" rx=".9" ry="1.2" fill="#c96a7c"/><ellipse cx="34.8" cy="31" rx=".9" ry="1.2" fill="#c96a7c"/>` }));
    over += blush.replaceAll('.45', '.25');
  } else if (sp === 'pig') {
    back.push(P.part('M21.8 19.6L19.4 11.6Q25.4 12.4 27.4 16.6Z', fur, { w: 1.6, detail: `<path d="M21.4 16.6L20.8 13.2Q24 14 25.4 16.4Z" fill="#e8849a"/>` }), P.part('M42.6 19.6L45 11.6Q39 12.4 37 16.6Z', fur, { w: 1.6, detail: `<path d="M43 16.6L43.6 13.2Q40.4 14 39 16.4Z" fill="#e8849a"/>` }));
    face.push(P.part(headD, fur, { grad: P.grad([[0, light(fur, 0.2)], [0.7, fur], [1, dark(fur, 0.06)]], 0.3, 1) }));
    front.push(P.part(ell(32.2, 30, 4.2, 2.9), '#f28aa2', { w: 1.5, detail: `<ellipse cx="30.7" cy="30.1" rx=".85" ry="1.25" fill="#a8455e"/><ellipse cx="33.7" cy="30.1" rx=".85" ry="1.25" fill="#a8455e"/><path d="M29.4 28.4Q31 27.6 32.6 28" fill="none" stroke="#fff" stroke-width=".6" opacity=".6" stroke-linecap="round"/>` }));
    over += blush;
  } else if (sp === 'chicken') {
    back.push(P.part('M26.2 15.4Q25 10.6 28.4 10.2Q29.4 7 32.4 7.6Q35.6 6.8 36.2 10.4Q39.6 10.6 38.4 15.4Z', '#e8433a', { w: 1.6 }));
    face.push(P.part(headD, fur, { grad: P.grad([[0, '#ffffff'], [0.7, fur], [1, '#e6dfcf']], 0.3, 1) }));
    front.push(P.part('M28.8 28.6L35.6 28.6L32.2 32.4Z', '#f2b33a', { w: 1.4, detail: `<path d="M29 29.8H35.4" stroke="#c98a1a" stroke-width=".5"/>` }), P.part(ell(32.2, 34, 1.4, 1.8), '#e8433a', { w: 1.2 }));
    over += blush.replaceAll('.45', '.3');
  } else if (sp === 'sheep') {
    // a dark face in a cloud of wool
    back.push(P.part('M21 22.4Q15.2 21 14.2 24Q16.6 26.4 21 25.4Z', fur, { w: 1.5 }), P.part('M43.4 22.4Q49.2 21 50.2 24Q47.8 26.4 43.4 25.4Z', fur, { w: 1.5 }));
    face.push(P.part('M32.2 16.6C38.6 16.6 42 20.6 42 25.8C42 31 38 35 32.2 35C26.4 35 22.4 31 22.4 25.8C22.4 20.6 25.8 16.6 32.2 16.6Z', fur, { grad: P.grad([[0, light(fur, 0.2)], [0.7, fur], [1, dark(fur, 0.1)]], 0.3, 1) }));
    front.push(P.part('M19.6 22.4C18.4 17.6 21.4 13.4 24.4 13.2C25.6 10.4 29 9.2 31.4 10.4C33.4 8.8 37 9.4 38.2 11.8C41.6 11.4 44.8 14.6 44.6 18C46.4 19.6 45.8 22.4 44.6 23.2C43.4 21 41.6 20.2 40.4 20.6C39 18.6 36.6 18.6 35.4 19.8C33.8 18.4 30.8 18.4 29.2 19.8C27.8 18.6 25.4 18.6 24 20.6C22.6 20.2 20.8 21 19.6 22.4Z', pale, { w: 1.8, detail: `<circle cx="26" cy="14.6" r="1.6" fill="#fff" opacity=".7"/><circle cx="33" cy="12.4" r="1.3" fill="#fff" opacity=".7"/>` }));
    over += blush.replaceAll('.45', '.3');
  } else if (sp === 'pumpkinhead') {
    // a carved jack-o'-lantern for a head, lit from inside
    back.push(P.part('M31.2 13.4Q30.4 8.4 33.8 6.8L35.2 8.4Q32.6 9.6 33.2 13.4Z', '#3f6a2a', { w: 1.3 }), P.part('M34 9.4Q38.6 7.2 40.4 10.2Q37.4 11.8 34.4 10.6Z', '#5a8a3a', { w: 1.1 }));
    face.push(P.part('M32.2 13.2C35 12.4 38.6 12.6 41.4 14.8C45 17.4 46.2 21.6 45.6 26.2C45 31.4 40.2 35.2 32.2 35.2C24.2 35.2 19.4 31.4 18.8 26.2C18.2 21.6 19.4 17.4 23 14.8C25.8 12.6 29.4 12.4 32.2 13.2Z', fur, { grad: P.grad([[0, '#ffb04a'], [0.6, fur], [1, '#c8600e']], 0.3, 1), detail: `<path d="M26.4 14.2Q23.6 24 26.6 35M38 14.2Q40.8 24 37.8 35M32.2 13.4V35" fill="none" stroke="#c8600e" stroke-width=".9" opacity=".75"/>` }));
  } else if (sp === 'fox' || sp === 'cat') {
    const inner = sp === 'cat' ? '#ff8ab8' : '#fff0e2';
    back.push(P.part('M22.8 21.8L20.4 8.6Q27.2 10.8 30.4 16.8Z', fur, { w: 1.8, detail: `<path d="M22.8 20.4L21.4 11.6Q25.8 13.4 28 17.2Z" fill="${inner}"/>` }));
    back.push(P.part('M34 16.8Q37.2 10.8 44 8.6L41.6 21.8Z', fur, { w: 1.8, detail: `<path d="M36.4 17.2Q38.6 13.4 43 11.6L41.6 20.4Z" fill="${inner}"/>` }));
    if (sp === 'cat') over += `<path d="M22 28.4L17 27.6M22 29.8L17.2 30.4M42.4 28.4L47.4 27.6M42.4 29.8L47.2 30.4" stroke="#bdb6cc" stroke-width=".45" stroke-linecap="round"/>`;
    face.push(P.part(headD, fur, { detail: `<path d="M20 29.2Q26 26.2 32.2 29.4Q38.4 26.2 44.4 29.2V36H20Z" fill="${pale}"/><path d="M26 18.8Q32.2 15.6 38.4 18.8Q35 17.8 32.2 21.4Q29.4 17.8 26 18.8Z" fill="${light(fur, 0.25)}" opacity=".7"/>` }));
    over += blush.replaceAll('.45', '.35') + `<path d="M31 28.9Q32.2 28.1 33.4 28.9Q32.9 30 32.2 30.1Q31.5 30 31 28.9Z" fill="#2a1d33"/>`;
  } else if (sp === 'robot' && look.world === 'cyber') {
    // the city's droids: dark chrome, a fin on top and one neon visor across the face
    back.push(P.part('M29.6 15.8L32.2 9.4L34.8 15.8Z', dark(fur, 0.2), { w: 1.3, detail: `<path d="M32.2 10.6V15.4" stroke="${look._accent}" stroke-width=".7"/>` }));
    back.push(P.part(rrect(19.4, 22.4, 2.8, 8, 1.2), dark(fur, 0.15), { w: 1.4, detail: `<path d="M20.8 23.6V29.4" stroke="${look._accent}" stroke-width=".6"/>` }), P.part(rrect(42.2, 22.4, 2.8, 8, 1.2), dark(fur, 0.15), { w: 1.4, detail: `<path d="M43.6 23.6V29.4" stroke="${look._accent}" stroke-width=".6"/>` }));
    face.push(P.part(rrect(21.2, 15.2, 22, 19.8, 8), fur, { grad: P.grad([[0, pale], [0.55, fur], [1, dark(fur, 0.2)]], 0.3, 1), detail: `<path d="M22.4 31.4Q32.2 34 42 31.4" fill="none" stroke="${dark(fur, 0.3)}" stroke-width=".7"/><path d="M26 17.6Q30 16.4 34.4 17" fill="none" stroke="#fff" stroke-width=".7" opacity=".5" stroke-linecap="round"/>` }));
    over += `<rect x="21" y="21.8" width="22.4" height="7" rx="3.4" fill="${look._accent}" opacity=".22"/><rect x="21.8" y="22.6" width="20.8" height="5.4" rx="2.6" fill="#0c0f1a"/><rect x="22.6" y="23.4" width="19.2" height="3.8" rx="1.9" fill="${look._accent}" opacity=".9"/><path d="M24 24.4H30" stroke="#fff" stroke-width=".7" opacity=".85" stroke-linecap="round"/>`;
  } else if (sp === 'robot' && look.world === 'lab') {
    // the lab's tin bots: a riveted box head, a red dome light, round ear bolts and a grille mouth
    back.push(P.part(capsule(32.2, 15.4, 32.2, 11.6, 0.6), '#8d97ab', { w: 1.2 }), P.part('M29.4 11.8Q29.4 8 32.2 8Q35 8 35 11.8Z', '#ff4a4a', { w: 1.3, detail: `<path d="M30.6 10.4Q31.4 9 32.4 9" fill="none" stroke="#fff" stroke-width=".6" opacity=".8"/>` }));
    back.push(P.part(ell(20.2, 25.6, 2, 2.6), '#8d97ab', { w: 1.4, detail: `<path d="M19 25.6H21.4" stroke="#5a6478" stroke-width=".6"/>` }), P.part(ell(44.2, 25.6, 2, 2.6), '#8d97ab', { w: 1.4, detail: `<path d="M43 25.6H45.4" stroke="#5a6478" stroke-width=".6"/>` }));
    face.push(P.part(rrect(21, 15.4, 22.4, 19.4, 2.6), fur, { detail: `<circle cx="23.2" cy="17.6" r=".6" fill="#8a94aa"/><circle cx="41.2" cy="17.6" r=".6" fill="#8a94aa"/><circle cx="23.2" cy="32.6" r=".6" fill="#8a94aa"/><circle cx="41.2" cy="32.6" r=".6" fill="#8a94aa"/>` }));
    over += `<circle cx="32.2" cy="9.6" r="3.4" fill="#ff4a4a" opacity=".22"/>`;
  } else if (sp === 'robot') {
    back.push(P.part(capsule(32.2, 15.4, 32.2, 9.8, 0.55), '#8d97ab', { w: 1.2 }), P.part(ell(32.2, 9, 1.6, 1.6), look._accent, { w: 1.2 }));
    back.push(P.part(rrect(19.6, 23.2, 3, 6.6, 1.2), '#8d97ab', { w: 1.4 }), P.part(rrect(41.8, 23.2, 3, 6.6, 1.2), '#8d97ab', { w: 1.4 }));
    face.push(P.part(rrect(21.2, 15.6, 22, 19.2, 7), fur, { detail: `<path d="${rrect(23.6, 20.4, 17.2, 11.6, 4.4)}" fill="#1c2233"/><path d="M24.6 21.6H33" stroke="#fff" stroke-width=".6" opacity=".25" stroke-linecap="round"/>` }));
    over += `<circle cx="32.2" cy="9" r="3" fill="${look._accent}" opacity=".25"/>`;
  } else if (sp === 'grey') {
    face.push(P.part('M32.2 12.6C40.6 12.6 45 18.4 44.6 24.6C44.3 29.8 38.8 35.4 32.2 35.4C25.6 35.4 20.1 29.8 19.8 24.6C19.4 18.4 23.8 12.6 32.2 12.6Z', fur, { grad: P.grad([[0, light(fur, 0.35)], [0.6, fur], [1, dark(fur, 0.08)]], 0.2, 1), detail: `<path d="M27 16.4Q32.2 14.6 37.4 16.4" fill="none" stroke="${light(fur, 0.5)}" stroke-width=".8" opacity=".7" stroke-linecap="round"/>` }));
    over += `<ellipse cx="24.4" cy="30.4" rx="1.5" ry=".9" fill="#7fe0b8" opacity=".35"/><ellipse cx="40" cy="30.4" rx="1.5" ry=".9" fill="#7fe0b8" opacity=".35"/>`;
  } else if (sp === 'skeleton') {
    face.push(P.part('M32.2 15C39.4 15 43.8 19.4 43.8 25.2C43.8 28.8 42 31.2 39.8 32.2V35.2H24.6V32.2C22.4 31.2 20.6 28.8 20.6 25.2C20.6 19.4 25 15 32.2 15Z', fur, { detail: `<path d="M24.6 32.4H39.8" stroke="#cfc4b2" stroke-width=".6"/><path d="M36.8 18Q39.6 19.4 40.4 22.2" fill="none" stroke="#d6ccb9" stroke-width=".7" stroke-linecap="round"/>` }));
    over += `<path d="M31.4 29.3L32.2 27.8L33 29.3Z" fill="${OUT}"/>`;
  } else if (sp === 'blob') {
    face.push(P.part(headD, fur, { grad: P.grad([[0, light(fur, 0.35)], [0.7, fur], [1, dark(fur, 0.08)]], 0.2, 1), detail: `<ellipse cx="27" cy="19.4" rx="2.6" ry="1.4" fill="#fff" opacity=".45" transform="rotate(-20 27 19.4)"/><circle cx="39.4" cy="21.6" r=".8" fill="#fff" opacity=".5"/>` }));
    over += blush.replaceAll('.45', '.3');
  } else if (sp === 'octo') {
    // tentacles hang where hair would, curling at the tips
    for (const s of [-1, 1]) {
      const X = (v) => f(32.2 + s * v);
      back.push(P.part(`M${X(8.6)} 22.6Q${X(14.8)} 27.4 ${X(14.6)} 33.4Q${X(14.4)} 37.8 ${X(17.6)} 38.2Q${X(19.8)} 38 ${X(19.4)} 35.8Q${X(17.4)} 36.6 ${X(17.2)} 33.6Q${X(17.6)} 25.8 ${X(10.4)} 20.4Z`, fur, { w: 1.8, detail: `<circle cx="${X(15.4)}" cy="29.6" r=".75" fill="${light(fur, 0.5)}"/><circle cx="${X(15.8)}" cy="33.2" r=".65" fill="${light(fur, 0.5)}"/><circle cx="${X(17.4)}" cy="36.4" r=".5" fill="${light(fur, 0.5)}"/>` }));
    }
    face.push(P.part('M32.2 13.8C40 13.8 44 19.2 43.8 25.4C43.6 31 39 35 32.2 35C25.4 35 20.8 31 20.6 25.4C20.4 19.2 24.4 13.8 32.2 13.8Z', fur, { detail: `<circle cx="27" cy="18.6" r="1.1" fill="${light(fur, 0.45)}" opacity=".8"/><circle cx="37.8" cy="17.8" r=".8" fill="${light(fur, 0.45)}" opacity=".8"/><circle cx="40.4" cy="21.2" r=".6" fill="${light(fur, 0.45)}" opacity=".7"/>` }));
    over += blush.replaceAll('#ff7f8f', '#ff9ad2');
    // wet: a glossy streak across the mantle and a drip
    over += `<path d="M25 17.4Q29 14.6 34.4 15.2" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".75"/><path d="M38.6 16.6Q40.6 17.6 41.4 19.6" fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".6"/><path d="M42.6 22.4Q43.4 24 42.6 24.6Q41.8 24 42.6 22.4Z" fill="#cfefff" opacity=".85"/>`;
  }
  over += eyes(P, look, ex, ey, mode, sp) + mouth(look, mode, sp);
  // the family: a cigar on some of them, smoke curling up
  if (look.world === 'mafia' && sp === 'human' && look.role !== 'kid' && (look.hair + look.eyeC) % 3 === 0 && mode !== 'talk' && mode !== 'grin') over += `<path d="M34 31.2L40.6 32.6" stroke="#6a3a1e" stroke-width="1.5" stroke-linecap="round"/><path d="M39.6 32.4L40.8 32.7" stroke="#e8e0d0" stroke-width="1.5"/><circle cx="41.3" cy="32.8" r=".6" fill="#ff6a2a"/><path d="M41.6 31.6Q40.4 29.4 42 27.6Q43.6 25.8 42.4 23.6M43.4 30.4Q44.8 28.6 43.8 26.6" fill="none" stroke="#d8d4e0" stroke-width=".7" stroke-linecap="round" opacity=".55"/>`;
  const top = headGear(P, look, front, back) || '';
  return { back, face, front, over, top };
}
function brows(c) { const d = dark(c, 0.25); return `<path d="M25.4 21.9Q27.2 21 29 21.7M35.4 21.7Q37.2 21 39 21.9" fill="none" stroke="${d}" stroke-width=".85" stroke-linecap="round"/>`; }
function hairParts(P, look, c, back, front) {
  const st = look.world === 'lab' ? 'frizz' : look.world === 'mafia' ? 'short' : at(HAIRS, look.hair);
  if (st === 'frizz') {
    // the mad scientist's hair, Doc Brown style: a huge white cloud sticking out every way,
    // and it bounces: the tufts spring up on one step and droop on the next
    const bob = look._pose === 'walk' ? 1.6 : look._pose === 'walk2' ? -1 : look._pose === 'cheer' ? 2.4 : 0;
    let d = ''; const n = 26;
    for (let i = 0; i <= n; i++) { const a = Math.PI * (0.86 + i / n * 1.28), side = Math.abs(Math.cos(a)), r = 13.6 + (i % 2 ? 5.6 + (look.hair % 3) * 0.9 + bob * side : 0.8), x = 32.2 + Math.cos(a) * r * 1.12, y = 22.4 + Math.sin(a) * r * 0.9 - (i % 2 ? bob * 0.5 : 0); d += (i ? 'L' : 'M') + f(x) + ' ' + f(y); }
    d += 'L46 31Q44 28 42 26.4L22.4 26.4Q20.4 28 18.4 31Z';
    back.push(P.part(d, c, { w: 1.8, detail: `<path d="M22 14Q25.4 9.6 30.4 11.8M34.4 11Q39.6 9.6 42.4 14M17.8 22Q16.6 18 19 15.4M46.6 22Q47.8 18 45.4 15.4" fill="none" stroke="${light(c, 0.6)}" stroke-width=".9" opacity=".8" stroke-linecap="round"/><path d="M20 25Q18.6 22.6 19.6 20.4M44.4 25Q45.8 22.6 44.8 20.4" fill="none" stroke="${dark(c, 0.2)}" stroke-width=".7" opacity=".6" stroke-linecap="round"/>` }));
    front.push(P.part('M21 23.4C21 18.4 25.4 15.2 32.2 15.2C39 15.2 43.4 18.4 43.4 23.4Q41 20.4 38.4 21.4L36.6 18.6L34.6 21.2L32.2 18.2L29.8 21.2L27.8 18.6L26 21.4Q23.4 20.4 21 23.4Z', c, { detail: `<path d="M26 18.4Q30.6 15.9 36.6 17.4" fill="none" stroke="${light(c, 0.45)}" stroke-width="1" stroke-linecap="round" opacity=".7"/>` }));
    return;
  }
  const sheen = `<path d="M26 18.4Q30.6 15.9 36.6 17.4" fill="none" stroke="${light(c, 0.45)}" stroke-width="1" stroke-linecap="round" opacity=".7"/>`;
  // the cap every style shares: the crown of the head, with a fringe cut across the forehead
  const cap = (fr) => P.part(`M20.4 25.4C20.2 18.6 25 14 32.2 14C39.4 14 44.2 18.6 44 25.4C43.4 22.8 41.8 21.2 39.6 ${fr}Q37.4 ${fr - 0.8} 35.8 ${fr - 2.6}Q33.6 ${fr + 0.4} 30.4 ${fr - 0.6}Q27.6 ${fr + 0.6} 25 ${fr + 0.2}Q22.4 ${fr + 0.8} 20.4 25.4Z`, c, { detail: sheen });
  if (st === 'long') back.push(P.part('M20.2 24.4C19.4 17.6 24.4 13.6 32.2 13.6C40 13.6 45 17.6 44.2 24.4L45.2 39.6Q42.6 41.4 40.2 39.8L39.6 30H24.8L24.2 39.8Q21.8 41.4 19.2 39.6Z', c, { detail: `<path d="M21.6 30L21.2 38.4M43 30L43.4 38.4" stroke="${dark(c, 0.25)}" stroke-width=".6" opacity=".7"/>` }));
  if (st === 'bob') back.push(P.part('M20 24.6C19.4 17.4 24.6 13.6 32.2 13.6C39.8 13.6 45 17.4 44.4 24.6L44.6 32.4Q42.6 34.2 40.4 33L40 29H24.4L24 33Q21.8 34.2 19.8 32.4Z', c));
  if (st === 'puff') back.push(P.part('M32.2 8.6C39.6 8.6 44 11.6 45.8 15.8C49.6 17.4 49.6 24 46.2 26.8C45.8 30 43 31.2 40.8 30.2L23.6 30.2C21.4 31.2 18.6 30 18.2 26.8C14.8 24 14.8 17.4 18.6 15.8C20.4 11.6 24.8 8.6 32.2 8.6Z', c, { detail: `<circle cx="22" cy="15.6" r="1.6" fill="${light(c, 0.3)}" opacity=".5"/><circle cx="41" cy="12.6" r="1.3" fill="${light(c, 0.3)}" opacity=".5"/>` }));
  if (st === 'bun') back.push(P.part(ell(32.2, 11.6, 4.4, 3.8), c, { detail: `<path d="M29.4 10.4Q32.2 8.8 35 10.4" fill="none" stroke="${light(c, 0.4)}" stroke-width=".8" opacity=".7"/>` }));
  if (st === 'pony') back.push(P.part('M40.4 17.4Q48.6 17 48 25.6Q47.6 33.2 43.4 36.8Q45.2 30.8 43.2 25.2Q42.2 21.4 38.6 20.2Z', c, { w: 1.8 }));
  if (st === 'spiky') { front.push(P.part('M20.4 25C19.6 20 21 16.6 23.2 14.6L22.6 10.8L26.4 13L27.8 8.6L30.8 12.4L33.6 7.8L35.6 12.4L39.2 9.4L39.4 13.4L43.6 12.4L42.4 16.2Q44.6 19.6 44 25C42.6 22.4 41 21.4 38.6 20.8Q36 21.8 34.4 19.2Q32 21.8 28.4 20.8Q25.6 21.6 24.4 20.6Q22 22.2 20.4 25Z', c, { detail: sheen })); return; }
  if (st === 'short') { front.push(P.part('M20.6 24.6C20.2 18.2 24.8 14.2 32.2 14.2C39.6 14.2 44.2 18.2 43.8 24.6C43.2 22.2 41.4 20.8 39.6 20.4Q37.8 19.2 35.8 20.8Q33.4 18.6 30.2 20.4Q27.4 19.2 25.4 20.6Q22.2 21.2 20.6 24.6Z', c, { detail: sheen })); return; }
  front.push(cap(20.8));
}
function headGear(P, look, front, back) {
  const w0 = WORLDS[look.world], w = look.gear ? { ...w0, gear: look.gear } : w0, t = look.tier, acc = look._accent, gold = '#f2c14e';
  const trim = t >= 3 ? gold : acc;
  let top = '';
  if (look.species === 'alien') {
    // the ship's crew wear a gem on the brow, and Tycoons a thin gold band round the dome
    front.push(P.part(ell(32.2, 13.2, 1.9, 1.9), trim, { w: 1.2, detail: `<circle cx="31.6" cy="12.6" r=".6" fill="#fff" opacity=".8"/>` }));
    if (t >= 3) front.push(P.part('M18.2 15.2Q32.2 9.4 46.2 15.2L45.8 16.8Q32.2 11.2 18.6 16.8Z', gold, { w: 1.2 }));
    return top;
  }
  if (BAREHEAD.has(look.species) || (look.species === 'robot' && w.gear !== 'straw' && w.gear !== 'hood')) return top;
  if (w.gear === 'hardhat') {
    // a white hard hat with an orange stripe
    front.push(P.part('M19.6 20.4Q19.8 10.8 32.2 10.4Q44.6 10.8 44.8 20.4Z', '#f4f6fb', { w: 1.8, detail: `<path d="M30.8 10.6H33.6V20.4H30.8Z" fill="${w0.trim === '#ff6a1a' ? '#ff6a1a' : trim}"/><path d="M24 14.4Q27.4 11.8 31 12" fill="none" stroke="#fff" stroke-width=".9" opacity=".8" stroke-linecap="round"/>` }));
    front.push(P.part('M17.4 21.2Q32.2 18.2 47 21.2Q46.6 22.8 44.6 22.8Q32.2 20.6 19.8 22.8Q17.8 22.8 17.4 21.2Z', '#e3e7ee', { w: 1.4 }));
  } else if (w.gear === 'weldmask') {
    // a welding helmet flipped down, the dark window glowing with the arc
    front.push(P.part('M19.4 18.6Q19.6 11.2 32.2 10.8Q44.8 11.2 45 18.6L44.2 33.4Q32.2 37.4 20.2 33.4Z', '#3a404e', { w: 1.9, detail: `<path d="${rrect(24.4, 21.2, 15.6, 5.6, 1.4)}" fill="#12151f"/><path d="${rrect(25.4, 22, 13.6, 4, 1)}" fill="#5fb4ff" opacity=".55"/><path d="M26.2 22.8H30.4" stroke="#fff" stroke-width=".7" opacity=".8" stroke-linecap="round"/>` }));
  } else if (w.gear === 'chef') {
    // a tall white toque
    front.push(P.part('M22.4 19.4V14.6Q17.8 13.4 19.4 8.6Q21.4 4.4 26 6.6Q27.6 2.4 32.2 2.6Q36.8 2.4 38.4 6.6Q43 4.4 45 8.6Q46.6 13.4 42 14.6V19.4Q32.2 17.8 22.4 19.4Z', '#fbfaf5', { w: 1.8, detail: `<path d="M22.4 16.8Q32.2 15.2 42 16.8" fill="none" stroke="#d8d4c8" stroke-width=".8"/><path d="M27.4 8V14M32.2 6V14M37 8V14" stroke="#e6e2d6" stroke-width=".7"/>` }));
  } else if (w.gear === 'cap') {
    // a ball cap, brim forward
    front.push(P.part('M20.4 20.6Q20.6 11.4 32.2 11Q43.8 11.4 44 20.6Z', acc, { w: 1.8, detail: `<path d="M31.6 11.2H32.8V20.6H31.6Z" fill="${dark(acc, 0.2)}"/><circle cx="32.2" cy="11.4" r="1" fill="${dark(acc, 0.25)}"/>` }));
    front.push(P.part('M30 19.6Q40 18.6 48.4 21.4Q47.6 23.4 44 23Q37.6 21.8 30 22.2Z', dark(acc, 0.15), { w: 1.4 }));
  } else if (w.gear === 'goggles') {
    // brass goggles pushed up onto the forehead
    front.push(P.part('M20.4 19.4Q32.2 15.6 44 19.4L43.8 21.2Q32.2 17.6 20.6 21.2Z', '#4a3a2a', { w: 1.2 }));
    for (const x of [27.4, 37]) front.push(P.part(ell(x, 18, 3.3, 2.9), '#c9a24a', { w: 1.5, detail: `<ellipse cx="${x}" cy="18" rx="2.3" ry="2" fill="#7fe8c8" opacity=".85"/><path d="M${x - 1.2} 17.2L${x - 0.2} 16.6" stroke="#fff" stroke-width=".7" stroke-linecap="round"/>` }));
  } else if (w.gear === 'flatcap') {
    // a newsboy cap, the old neighbourhood's workday hat
    front.push(P.part('M20 21Q19.6 12.4 32.2 12Q45 12.4 44.6 19.4Q44.4 21.4 41.6 21.2Q32.2 18.8 22.8 21.4Z', '#4a4038', { w: 1.8, detail: `<path d="M32.2 12.2V19.6M26 13.8Q27.6 17 27.4 20.4M38.6 13.6Q37.4 16.8 37.4 20" fill="none" stroke="#3a322c" stroke-width=".6"/><circle cx="32.2" cy="12.6" r=".8" fill="#3a322c"/>` }));
    front.push(P.part('M19.6 20.4Q27.6 18.6 36 20.6Q31.4 23.4 22.4 23Q19.4 22.4 19.6 20.4Z', '#3e352e', { w: 1.4 }));
    top += `<path d="M21.2 22.2Q32.2 20.6 43.2 22.2L43.2 24.2Q32.2 22.8 21.2 24.2Z" fill="#000" opacity=".16"/>`;
  } else if (w.gear === 'astro') {
    // a rocket pilot's bubble helmet, clear glass with a gold rim
    back.push(P.part(ell(32.2, 24.6, 14.6, 13.8), '#dfe8f6', { w: 1.8, detail: `<ellipse cx="32.2" cy="24.6" rx="12.8" ry="12" fill="#26345a"/>` }));
    top += `<ellipse cx="32.2" cy="24.6" rx="14" ry="13.2" fill="#bfe4ff" opacity=".18" stroke="#eef6ff" stroke-width="1.1"/><path d="M22.4 17Q25.6 12.6 31 12" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".85"/><path d="M40.8 31.6Q43 29.6 43.8 27" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".6"/><path d="M19.8 34.6Q32.2 39.4 44.6 34.6" fill="none" stroke="${w0.trim}" stroke-width="1.6" stroke-linecap="round"/>`;
  } else if (w.gear === 'witch') {
    front.push(P.part('M14.8 19.8Q32.2 15.4 49.6 19.8Q32.2 23.6 14.8 19.8Z', '#2a1a36', { w: 1.6 }));
    front.push(P.part('M22.8 18.6L33.6 1.6Q36.4 0.4 37.8 3.6L41.6 18.6Q32.2 16.4 22.8 18.6Z', '#3a2248', { w: 1.8, detail: `<path d="M23.6 16.4Q32.2 14.4 40.9 16.4L41.3 18.2Q32.2 16.2 23.2 18.2Z" fill="#7dd83a"/><path d="${star(36, 9.6, 1.4, 0.4)}" fill="#ffd23f"/>` }));
  } else if (w.gear === 'fedora') {
    // a fedora with a band, brim snapped down in front, its shadow over the eyes
    top += `<path d="M21 21.6Q32.2 19.4 43.4 21.6L43.4 24.8Q32.2 22.8 21 24.8Z" fill="#000" opacity=".2"/>`;
    front.push(P.part('M14.8 20Q32.2 15.6 49.6 20Q47.4 22.6 42.6 21.6Q32.2 19.4 21.8 21.6Q17 22.6 14.8 20Z', '#2a2a32', { w: 1.6 }));
    front.push(P.part('M22 19.2Q21.4 9 32.2 8.4Q43 9 42.4 19.2Q32.2 17.2 22 19.2Z', '#34343e', { w: 1.8, detail: `<path d="M22.2 15.8Q32.2 14 42.2 15.8L42.3 18.2Q32.2 16.4 22.1 18.2Z" fill="${t >= 3 ? gold : '#1a1418'}"/><path d="M28 10Q32.2 12.4 36.4 10" fill="none" stroke="#1a1a22" stroke-width=".9"/>` }));
  } else if (w.gear === 'gamerset' || w.gear === 'comm') {
    // a gaming headset: big ear cups with RGB rings, a boom mic
    front.push(P.part('M20 24.2C20 15.8 25.4 12 32.2 12C39 12 44.4 15.8 44.4 24.2L42.4 24.2C42.4 17.4 38 14 32.2 14C26.4 14 22 17.4 22 24.2Z', w.gear === 'comm' ? '#c9d2e0' : '#2a2a3a', { w: 1.6 }));
    const led = w.gear === 'comm' ? trim : look.world === 'gamer' ? (look.hair % 2 ? '#39ff9e' : '#5fd4ff') : acc;
    for (const x of [18.8, 41.8]) front.push(P.part(rrect(x, 21.8, 3.8, 7.2, 1.8), w.gear === 'comm' ? '#e9edf5' : '#1a1a26', { w: 1.6, detail: `<circle cx="${x + 1.9}" cy="25.4" r="1.4" fill="none" stroke="${led}" stroke-width=".9"/>` }));
    front.push(P.part(capsule(43, 28.4, 36.8, 31.6, 0.45), '#3a3f58', { w: 1 }), P.part(ell(36.4, 31.8, 0.95, 0.95), w.gear === 'comm' ? '#2d3548' : led, { w: 1 }));
    // the status lights glow
    if (w.gear === 'gamerset') top += [20.7, 43.7].map((x) => `<circle cx="${x}" cy="25.4" r="3.6" fill="${P.radial([[0, led, 0.55], [1, led, 0]])}"/><circle cx="${x}" cy="25.4" r="1.4" fill="none" stroke="${led}" stroke-width="1"/>`).join('') + `<circle cx="36.4" cy="31.8" r="2" fill="${P.radial([[0, led, 0.5], [1, led, 0]])}"/>`;
  } else if (w.gear === 'vrset') {
    // a VR headset strapped over the eyes
    front.push(P.part('M20.4 22.6Q32.2 20.4 44 22.6', '#1a1a26', { w: 1.2 }));
    const glow = look.world === 'gamer' ? (look.hair % 2 ? '#39ff9e' : '#5fd4ff') : acc;
    front.push(P.part(rrect(21.4, 20.6, 21.6, 8.4, 3), '#f0f0f5', { w: 1.8, detail: `<path d="${rrect(22.6, 21.8, 19.2, 6, 2.2)}" fill="#1a1a26"/><path d="${rrect(23.6, 22.8, 17.2, 4, 1.6)}" fill="${glow}" opacity=".35"/><path d="M24 26.4H40.4" stroke="${glow}" stroke-width="1.2" stroke-linecap="round"/><path d="M25 24H31" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity=".7"/><circle cx="38.6" cy="23.6" r=".8" fill="${glow}"/>` }));
    // the visor glows onto the face around it
    top += `<ellipse cx="32.2" cy="24.8" rx="14" ry="7.4" fill="${P.radial([[0, glow, 0.4], [0.6, glow, 0.14], [1, glow, 0]])}"/>`;
  } else if (w.gear === 'arglasses') {
    // AR glasses: a clear visor with a heads-up line across it
    front.push(P.part(rrect(22, 22.4, 20.4, 5.4, 2.2), '#8fe3ff', { w: 1.4, detail: `<path d="M24 24.6H33" stroke="#39ff9e" stroke-width=".8" stroke-linecap="round"/><circle cx="38" cy="24.8" r=".9" fill="#ff3fb8"/>` }));
  } else if (w.gear === 'straw') {
    back.push(P.part('M22.6 17.8Q23 9.8 32.2 9.6Q41.4 9.8 41.8 17.8Z', '#e8c96a', { detail: `<path d="M22.6 15.6Q32.2 13.4 41.8 15.6V17.9H22.6Z" fill="${trim}"/><path d="M26 12.6Q29 11 32 11" fill="none" stroke="#fff3c4" stroke-width=".7" opacity=".7"/>` }));
    front.push(P.part('M13.6 19.2Q15 16.2 22 16.4Q32.2 15.2 42.4 16.4Q49.4 16.2 50.8 19.2Q47.8 21.4 42 20.8Q32.2 19.6 22.4 20.8Q16.6 21.4 13.6 19.2Z', '#e8c96a', { detail: `<path d="M17 18.8Q24 17.6 32.2 17.4Q40.4 17.6 47.4 18.8" fill="none" stroke="#c9a449" stroke-width=".5" stroke-dasharray="1 1"/>` }));
  } else if (w.gear === 'comm') {
    front.push(P.part('M20.2 24.2C20.2 16.4 25.4 12.6 32.2 12.6C39 12.6 44.2 16.4 44.2 24.2L42.4 24.2C42.4 17.8 38 14.6 32.2 14.6C26.4 14.6 22 17.8 22 24.2Z', '#c9d2e0', { w: 1.6 }));
    front.push(P.part(rrect(40.6, 22.4, 4.8, 6.2, 2), '#e9edf5', { w: 1.6, detail: `<circle cx="43" cy="25.5" r="1.2" fill="${trim}"/>` }));
    if (t >= 1) front.push(P.part(capsule(42.4, 28, 36.6, 31.6, 0.45), '#8d97ab', { w: 1 }), P.part(ell(36.2, 31.8, 0.9, 0.9), '#2d3548', { w: 1 }));
  } else if (w.gear === 'visor') {
    front.push(P.part('M20.4 22.4Q32.2 18.2 44 22.4L43.8 25.4Q32.2 21.6 20.6 25.4Z', '#1b1b28', { w: 1.8, detail: `<path d="M21.8 23.1Q32.2 19.6 42.6 23.1" fill="none" stroke="${trim}" stroke-width=".9"/>` }));
    front.push(P.part(rrect(22.4, 17.6, 19.6, 4.4, 2), trim, { w: 1.6, grad: P.grad([[0, light(trim, 0.35)], [1, dark(trim, 0.25)]], 0, 1), detail: `<path d="M24 18.6H31" stroke="#fff" stroke-width=".7" opacity=".6" stroke-linecap="round"/>` }));
  } else if (w.gear === 'mask' && (look.coat || look.species === 'octo')) {
    // the scientists and the octopuses go bare-headed
  } else if (w.gear === 'mask') {
    front.push(P.part('M20.6 20.6Q32.2 17 43.8 20.6L43.6 22.6Q32.2 19.2 20.8 22.6Z', '#2b2b3a', { w: 1.4 }));
    front.push(P.part(rrect(23.4, 13.6, 17.6, 7.4, 3.4), '#ffd23f', { w: 1.8, detail: `<path d="${rrect(24.8, 14.9, 14.8, 4.8, 2.3)}" fill="#8fe3ff" opacity=".85"/><path d="M26.2 15.9L28.4 18.9M29 15.9L30.4 17.8" stroke="#fff" stroke-width=".7" opacity=".8" stroke-linecap="round"/>` }));
  } else if (w.gear === 'crest') {
    if (look.species !== 'grey') return;
    front.push(P.part(ell(32.2, 15.6, 1.8, 1.8), trim, { w: 1.2, detail: `<circle cx="31.6" cy="15" r=".6" fill="#fff" opacity=".8"/>` }));
  } else if (w.gear === 'tophat') {
    // the mansion's gentlemen and ladies: a tall black hat with a blood-red band
    front.push(P.part('M17.4 19.4Q32.2 15.8 47 19.4Q32.2 22.2 17.4 19.4Z', '#16121c', { w: 1.6 }));
    front.push(P.part(rrect(24.2, 5.2, 16, 14.2, 1.2), '#1e1a26', { w: 1.8, detail: `<path d="M24.2 15.4H40.2V17.6H24.2Z" fill="${w.trim}"/><path d="M26 7V14" stroke="#fff" stroke-width=".6" opacity=".25"/>` }));
  } else if (w.gear === 'costume') {
    // trick-or-treat: a witch's hat, cat ears or a pumpkin cap, one per person
    const k = look.hair % 3;
    if (k === 0) {
      front.push(P.part('M14.8 19.8Q32.2 15.4 49.6 19.8Q32.2 23.6 14.8 19.8Z', '#3a1f4a', { w: 1.6 }));
      front.push(P.part('M22.8 18.6L33.6 1.6Q36.4 0.4 37.8 3.6L41.6 18.6Q32.2 16.4 22.8 18.6Z', '#4a2a5e', { w: 1.8, detail: `<path d="M23.6 16.4Q32.2 14.4 40.9 16.4L41.3 18.2Q32.2 16.2 23.2 18.2Z" fill="#ff8a1a"/>` }));
    } else if (k === 1) {
      front.push(P.part('M20.8 17.4L22.6 6.4L29.4 13.4Z', '#1e1a26', { w: 1.6, detail: `<path d="M22.6 9.6L23.2 13.2L26.4 13.6Z" fill="#ff8ab8"/>` }));
      front.push(P.part('M43.6 17.4L41.8 6.4L35 13.4Z', '#1e1a26', { w: 1.6, detail: `<path d="M41.8 9.6L41.2 13.2L38 13.6Z" fill="#ff8ab8"/>` }));
    } else {
      front.push(P.part('M20.4 19.4Q20.4 9.8 32.2 9.6Q44 9.8 44 19.4Q32.2 16.8 20.4 19.4Z', '#f07a1a', { w: 1.8, detail: `<path d="M27.4 10.6Q26.4 15 26.8 18.2M37 10.6Q38 15 37.6 18.2M32.2 9.8V17.2" fill="none" stroke="#c85a0a" stroke-width=".8"/>` }));
      front.push(P.part('M31.2 10.2Q30.6 6.8 33.4 5.4L34.4 6.6Q32.4 7.6 32.8 10.2Z', '#3f6a2a', { w: 1.2 }));
    }
  } else if (w.gear === 'hood' && t <= 1) {
    back.push(P.part('M18.6 30Q17.4 13.4 32.2 12.2Q47 13.4 45.8 30L43.4 34.2Q44 21 32.2 20.2Q20.4 21 21 34.2Z', '#4a3040', { detail: `<path d="M22 17.6Q32.2 12.6 42.4 17.6" fill="none" stroke="#6a4a5e" stroke-width=".8" opacity=".8"/>` }));
  }
  // from Trader up, a trading-floor headset: an earpiece and a mic on a boom
  if (t >= 2 && !['comm', 'gamerset', 'weldmask', 'vrset', 'astro'].includes(w.gear) && look.world !== 'mafia') {
    front.push(P.part(rrect(42, 23.6, 3.6, 5.6, 1.6), '#2b2f42', { w: 1.5, detail: `<circle cx="43.8" cy="26.4" r=".9" fill="${trim}"/>` }));
    front.push(P.part(capsule(43.4, 28.6, 37.4, 31.6, 0.42), '#3a3f58', { w: 1 }), P.part(ell(36.9, 31.8, 0.95, 0.95), '#2b2f42', { w: 1 }));
  }
  // the tycoon's circlet: gold, with the role's gem
  if (t === 4 && !['straw', 'mask', 'tophat', 'costume', 'hardhat', 'weldmask', 'chef', 'cap', 'fedora', 'vrset', 'gamerset', 'flatcap', 'astro', 'witch'].includes(w.gear)) front.push(P.part('M22.6 18.4L25 13.8L28.2 16.8L32.2 11.8L36.2 16.8L39.4 13.8L41.8 18.4Q32.2 16.2 22.6 18.4Z', gold, { w: 1.6, detail: `<circle cx="32.2" cy="16.2" r="1.3" fill="${acc}"/><circle cx="31.8" cy="15.8" r=".45" fill="#fff"/>` }));
  return top;
}

// ---------------------------------------------------------------------------------------------- body, outfit and tier gear
function outfit(P, look) {
  const w = WORLDS[look.world], t = look.tier, acc = look._accent, gold = '#f2c14e';
  const coat = look.coat && look.world === 'ocean';
  const tin = look.species === 'robot' && look.world === 'lab';
  const suit = coat ? '#f4f7f8' : tin ? furOf(look)[0] : look.world === 'cyber' ? '#2a2a3c' : w.suit;
  const torsoD = 'M25 38.4C25 35.6 27.8 34.4 32.2 34.4C36.6 34.4 39.4 35.6 39.4 38.4L40.3 47.4C40.4 48.8 39.4 49.4 38.1 49.4H26.3C25 49.4 24 48.8 24.1 47.4Z';
  let det = '';
  // the deep sea base's marine scientists: a white coat with a teal collar, an ID badge on a lanyard and an
  // oxygen gauge clipped to the pocket (the lab's mad scientists wear theirs with goggles and a bubbling vial)
  if (coat) {
    const parts = [P.part(rrect(29.3, 31.6, 5.8, 4.8, 1.4), look._neck, { w: 1.4 })];
    parts.push(P.part('M24.6 37.8C24.8 35.4 27.8 34.4 32.2 34.4C36.6 34.4 39.6 35.4 39.8 37.8L41.2 52.4Q41.2 53.4 40 53.4H24.4Q23.2 53.4 23.2 52.4Z', suit, { detail: `<path d="M28.4 34.6L32.2 39.6L36 34.6Z" fill="#1f3d60"/><path d="M28.4 34.6L30.8 41.2M36 34.6L33.6 41.2" stroke="#2bb6b0" stroke-width="1.2"/><path d="M32.2 39.6V53.4" stroke="#d6dde2" stroke-width=".7"/><path d="M29.6 35.2L31.2 42.4M34.8 35.2L33.2 42.4" stroke="#2bb6b0" stroke-width=".4"/><rect x="29.8" y="42.2" width="4.8" height="3.8" rx=".6" fill="#fff" stroke="#1f3d60" stroke-width=".5"/><rect x="30.2" y="42.6" width="4" height="1.1" fill="#2bb6b0"/><path d="M30.6 45Q31.6 44.2 32.4 45Q33.2 45.8 34 45" fill="none" stroke="#1f3d60" stroke-width=".4"/><path d="M25.4 46.2H29" stroke="#d6dde2" stroke-width=".6"/><path d="M35.2 44.6H39.2V48.6H35.2Z" fill="none" stroke="#d6dde2" stroke-width=".6"/><circle cx="37.2" cy="42.6" r="1.6" fill="#fff" stroke="#1f3d60" stroke-width=".5"/><path d="M37.2 42.6L38 41.8" stroke="#e8433a" stroke-width=".5" stroke-linecap="round"/><path d="M36.1 43.3A1.3 1.3 0 0 1 38.3 43.3" fill="none" stroke="#2bb6b0" stroke-width=".4"/>` }));
    return parts;
  }
  // world outfit details, drawn inside the torso
  if (look.world === 'space') det += `<path d="M24 38.2H40.4V40.4H24Z" fill="${w.trim}" opacity=".9"/><circle cx="36.8" cy="43" r="1.6" fill="#3b5bdb"/><circle cx="36.8" cy="43" r=".7" fill="#fff"/><path d="M24 45.6H40.6V47.4H24Z" fill="#9aa4b8"/>`;
  if (look.world === 'castle') det += `<path d="M29.2 34.4L32.2 40L35.2 34.4" fill="#e9d9b8"/><path d="M29.2 34.4L32.2 40L35.2 34.4" fill="none" stroke="${dark(w.suit, 0.4)}" stroke-width=".6"/><path d="M24 44.6H40.6V46.8H24Z" fill="#5a3a26"/><rect x="31" y="44.4" width="2.6" height="2.6" rx=".5" fill="${w.trim}"/>`;
  if (look.world === 'farm') det += `<path d="M24 34H40.6V40.4Q32.2 39.4 24 40.4Z" fill="${w.trim}"/><path d="M24 36.2H40.6M24 38.4H40.6M28 34V40M32.2 34V40M36.4 34V40" stroke="#8a2a24" stroke-width=".5" opacity=".7"/><path d="M27 40.2H37.6V49.6H27Z" fill="${light(w.suit, 0.08)}"/><path d="M27.4 40.4L25.6 34.8M37.2 40.4L39 34.8" stroke="${w.suit}" stroke-width="1.6"/><circle cx="28" cy="41.2" r=".7" fill="#f2c14e"/><circle cx="36.6" cy="41.2" r=".7" fill="#f2c14e"/><path d="M29.6 43.4H35" stroke="${dark(w.suit, 0.2)}" stroke-width=".6"/>`;
  if (tin) det += `<path d="${rrect(27, 38.6, 10.4, 7.4, 1.2)}" fill="#3a4152"/><circle cx="29.8" cy="41" r="1.3" fill="#ffd23f"/><circle cx="34.6" cy="41" r="1.3" fill="#5fd4ff"/><path d="M28.4 44H36" stroke="#39ff9e" stroke-width=".8" stroke-linecap="round"/><circle cx="25.8" cy="37" r=".5" fill="#8a94aa"/><circle cx="38.6" cy="37" r=".5" fill="#8a94aa"/><circle cx="25.4" cy="47.6" r=".5" fill="#8a94aa"/><circle cx="39" cy="47.6" r=".5" fill="#8a94aa"/>`;
  else if (look.world === 'cyber') det += `<path d="M31.4 34.4V49.6" stroke="${acc}" stroke-width=".9"/><path d="M24.2 47.6H40.4" stroke="${acc}" stroke-width=".9"/><path d="M28.6 34.4Q29.6 37.4 31.2 37.8" fill="none" stroke="#3a3a52" stroke-width="1.2"/><path d="M26 41.4L29.4 41.4" stroke="${acc}" stroke-width=".7" opacity=".8"/>`;
  if (look.world === 'alien') det += `<path d="M28.4 34.4L32.2 38.6L36 34.4Z" fill="${acc}"/><path d="M24 40.6H40.6V42.4H24Z" fill="${w.trim}" opacity=".35"/><path d="M34.8 38.6l1.3 -1.6 1.3 1.6 -1.3 1.8Z" fill="${w.trim}"/>`;
  if (look.world === 'rocket') det += `<path d="M24 41.2H40.4V43H24Z" fill="${w.trim}"/><circle cx="36.4" cy="38.2" r="1.7" fill="#26345a"/><path d="M35.4 38.8L36.4 36.6L37.4 38.8Z" fill="#fff"/><rect x="27" y="37" width="4.2" height="1.6" rx=".4" fill="#1d2b4a"/><path d="M29.2 34.4V49.6" stroke="#c9ced8" stroke-width=".6"/>`;
  if (look.world === 'lab' && !tin) det += `<path d="M28.6 34.4L32.2 42.4L35.8 34.4Z" fill="${acc}"/><path d="M28.6 34.4L30.4 44.8M35.8 34.4L34 44.8" stroke="#c9ccc4" stroke-width=".9"/><rect x="35.2" y="40.6" width="3.2" height="3.4" rx=".4" fill="none" stroke="#c9ccc4" stroke-width=".6"/><path d="M36 40.8V38.6M37 40.8V39" stroke="${w.trim}" stroke-width=".7" stroke-linecap="round"/><path d="M36.8 40.8V38.8" stroke="#ff4fb8" stroke-width=".7" stroke-linecap="round"/>`;
  if (look.world === 'mafia') det += `<path d="M25.2 35.6V49.4M27.2 35V49.4M29.2 34.6V49.4M35.2 34.6V49.4M37.2 35V49.4M39.2 35.6V49.4" stroke="#9a9aa8" stroke-width=".35" opacity=".85"/><path d="M29.2 34.4L32.2 39.8L35.2 34.4Z" fill="#f4f0e8"/><path d="M31.4 35.2H33L33.4 36.4L32.8 42L32.2 43.2L31.6 42L31 36.4Z" fill="#8a1c2b"/><path d="M35.8 37.2L38.2 36.6L37.8 38.4Z" fill="${w.trim}"/>`;
  if (look.world === 'gamer') det += `<path d="M26.6 42.4H37.8V47.6H26.6Z" fill="${dark(w.suit, 0.15)}"/><path d="M30.2 34.6V39.4M34.2 34.6V39.4" stroke="#e8e6ff" stroke-width=".6" stroke-linecap="round"/><path d="M29 37.8L32.2 36.2L35.4 37.8L32.2 40.2Z" fill="${w.trim}"/>`;
  if (look.world === 'ocean') det += `<path d="M24.2 39.2L40.4 36.4V38.4L24.2 41.2Z" fill="${w.trim}"/><path d="M24.2 44.2L40.4 41.4V42.8L24.2 45.6Z" fill="${w.trim}" opacity=".85"/><path d="M29.4 34.6Q32.2 36.4 35 34.6" fill="none" stroke="#0f2238" stroke-width="1"/>`;
  // tier gear over the outfit: 1 a tie, 2 a vest and a pen, 3 a jacket with gold buttons, 4 gold trim and a medallion
  if (t >= 1 && t < 3) det += `<path d="M31.2 35.4H33.2L33.6 36.6L32.9 42.2L32.2 43.4L31.5 42.2L30.8 36.6Z" fill="${acc}" stroke="${dark(acc, 0.45)}" stroke-width=".4"/>`;
  if (t === 0 && !tin) det += `<path d="M29.6 34.8L31.4 40.2M34.8 34.8L33 40.2" stroke="${acc}" stroke-width=".7"/><rect x="30.4" y="40" width="3.6" height="4.4" rx=".6" fill="#fff" stroke="${OUT}" stroke-width=".4"/><rect x="31" y="40.6" width="2.4" height="1.4" rx=".3" fill="${acc}"/>`;
  const vest = mix(dark(w.jacket, 0.05), acc, 0.3);
  if (t === 2) det += `<path d="M24.2 36.4Q27 35 29.6 35.2L30.4 49.6H24.8Q23.8 49 24 47.4Z" fill="${vest}"/><path d="M40.2 36.4Q37.4 35 34.8 35.2L34 49.6H39.6Q40.6 49 40.4 47.4Z" fill="${vest}"/><path d="M29.6 35.2L30.4 49.6M34.8 35.2L34 49.6" stroke="${light(vest, 0.35)}" stroke-width=".6"/><path d="M26.4 39.4V41.8" stroke="${acc}" stroke-width=".8" stroke-linecap="round"/><circle cx="31.9" cy="46" r=".5" fill="${gold}"/>`;
  const torso = P.part(torsoD, suit, { detail: det });
  const parts = [P.part(rrect(29.3, 31.6, 5.8, 4.8, 1.4), look._neck, { w: 1.4 }), torso];
  // the city: a high neon-edged collar turned up round the neck
  if (look.world === 'cyber') parts.push(P.part('M25.4 37.2Q25 33 28.6 31.8L30.2 35.6Q27.6 36 25.4 37.2Z', '#1b1b28', { w: 1.3, detail: `<path d="M28.6 32L30 35.4" stroke="${acc}" stroke-width=".7"/>` }), P.part('M39 37.2Q39.4 33 35.8 31.8L34.2 35.6Q36.8 36 39 37.2Z', '#1b1b28', { w: 1.3, detail: `<path d="M35.8 32L34.4 35.4" stroke="${acc}" stroke-width=".7"/>` }));
  // the family: a pinstriped suit jacket with lapels for everyone, not just the bosses
  if (look.world === 'mafia' && t < 3 && look.role !== 'kid') {
    parts.push(P.part('M24.8 37.6C25 35.6 27.6 34.6 30.4 34.4L31.8 49.6H26.2C24.8 49.6 23.9 48.8 24 47.4Z', '#2a2a32', { w: 1.3, detail: `<path d="M25.6 36.4V49.4M27.6 35.2V49.4M29.6 34.8V49.4" stroke="#9a9aa8" stroke-width=".35" opacity=".85"/><path d="M30.4 34.4L28.4 39.4L30.4 40.8L31.8 49.6" fill="none" stroke="#3e3e4a" stroke-width="1"/><path d="M25.6 38.8L28.4 38.2L27.4 39.8Z" fill="#f4f0e8"/>` }));
    parts.push(P.part('M39.6 37.6C39.4 35.6 36.8 34.6 34 34.4L32.6 49.6H38.2C39.6 49.6 40.5 48.8 40.4 47.4Z', '#2a2a32', { w: 1.3, detail: `<path d="M38.8 36.4V49.4M36.8 35.2V49.4M34.8 34.8V49.4" stroke="#9a9aa8" stroke-width=".35" opacity=".85"/><path d="M34 34.4L36 39.4L34 40.8L32.6 49.6" fill="none" stroke="#3e3e4a" stroke-width="1"/><circle cx="34.2" cy="44" r=".6" fill="#c9c9d6"/><circle cx="34" cy="47" r=".6" fill="#c9c9d6"/><path d="M36.2 38.4L38 37.8L37.6 39.6Z" fill="#8a1c2b"/>` }));
  }
  // a jacket: two open panels with lapels, over any world's outfit
  if (t >= 3) {
    const jc = t === 4 ? '#2b2140' : w.jacket;
    const edge = t === 4 ? gold : light(jc, 0.2);
    const tie = t === 4 ? `<path d="M30.2 35.2Q32.2 39.6 34.2 35.2" fill="none" stroke="${gold}" stroke-width=".8"/>` : `<path d="M31.2 35.4H33.2L33.6 36.6L32.9 42.2L32.2 43.4L31.5 42.2L30.8 36.6Z" fill="${acc}"/>`;
    parts.push(P.part('M24.8 37.6C25 35.6 27.6 34.6 30.6 34.4L32 49.6H26.2C24.8 49.6 23.9 48.8 24 47.4Z', jc, { w: 1.4, detail: `<path d="M30.6 34.4L28.6 39.2L30.6 40.6L32 49.6" fill="none" stroke="${edge}" stroke-width=".9"/><path d="M25 46.6L31.6 46.6" stroke="${edge}" stroke-width=".5" opacity=".6"/>` }));
    parts.push(P.part('M39.6 37.6C39.4 35.6 36.8 34.6 33.8 34.4L32.4 49.6H38.2C39.6 49.6 40.5 48.8 40.4 47.4Z', jc, { w: 1.4, detail: `<path d="M33.8 34.4L35.8 39.2L33.8 40.6L32.4 49.6" fill="none" stroke="${edge}" stroke-width=".9"/><circle cx="34.6" cy="44" r=".75" fill="${gold}"/><circle cx="34.4" cy="47.2" r=".75" fill="${gold}"/><path d="M36.4 41.4H38.6" stroke="${acc}" stroke-width="1.1" stroke-linecap="round"/>` }));
    parts.splice(2, 0, P.part('M30.2 34.6H34.2L33.4 49.6H31Z', light(suit, 0.1), { w: 0, rim: false, detail: tie }));
  }
  if (t === 4) parts.push(P.part(ell(32.2, 40.6, 2.3, 2.3), gold, { w: 1.4, detail: `<text x="32.2" y="41.8" font-size="3.3" font-weight="900" text-anchor="middle" fill="#7a5410" font-family="Arial, sans-serif">$</text>` }));
  return parts;
}
function belt(P, look) { return ['space', 'castle', 'lab', 'mafia', 'gamer'].includes(look.world) || (look.coat && look.world === 'ocean') ? [] : [P.part(rrect(24, 46.6, 16.4, 2.2, 0.8), look.world === 'farm' ? '#3f74b0' : look.world === 'cyber' ? '#1a1a26' : dark(WORLDS[look.world].suit, 0.2), { w: 1, rim: false, detail: `<rect x="31.1" y="46.8" width="2.2" height="1.8" rx=".4" fill="${look.tier >= 3 ? '#f2c14e' : '#c9c9d6'}"/>` })]; }
function leg(P, look, side) {
  const w = WORLDS[look.world], x = side < 0 ? 28.4 : 35.9;
  // an octopus walks upright on its tentacles: each leg is two, curling out, suckers and all; they curl the
  // other way on every step
  if (look.species === 'octo') {
    const fur = FUR.octo[0], k = look._pose === 'walk' ? 1 : look._pose === 'walk2' ? -1 : 0;
    const out = [];
    for (const j of [0, 1]) {
      const sx = x + side * (j ? 1.6 : -0.6), ex = sx + side * (j ? 5.4 : 2.2) + k * side * 1.2, ey = 57.6 - j * 0.8;
      const cx = ex + side * 2.2, cy = ey - 2.6 - k * 0.8;
      out.push(P.part(`M${f(sx - 2)} 46.4L${f(sx + 2)} 46.4Q${f(sx + 2.4 + side * 1.2)} 53.4 ${f(ex + 0.8)} ${f(ey)}Q${f(cx + side * 0.4)} ${f(ey + 0.8)} ${f(cx)} ${f(cy)}Q${f(cx - side * 1.6)} ${f(ey - 0.2)} ${f(ex - side * 0.2)} ${f(ey - 1.6)}Q${f(sx - side * 0.8)} 53 ${f(sx - 2)} 46.4Z`, j ? light(fur, 0.06) : fur, { w: 2, detail: `<circle cx="${f(sx + side * 0.8)}" cy="51.4" r=".6" fill="${FUR.octo[1]}"/><circle cx="${f((sx + ex) / 2 + side * 0.6)}" cy="${f((51.4 + ey) / 2 + 0.6)}" r=".55" fill="${FUR.octo[1]}"/><circle cx="${f(ex)}" cy="${f(ey - 0.4)}" r=".5" fill="${FUR.octo[1]}"/><path d="M${f(sx - 0.8)} 47.4Q${f(sx - 0.4)} 50 ${f(sx + side * 0.2)} 52" fill="none" stroke="#fff" stroke-width=".6" opacity=".55" stroke-linecap="round"/>` }));
    }
    return out;
  }
  const legC = look.species === 'skeleton' ? '#efe8da' : look.species === 'robot' ? (look.world === 'cyber' ? '#3a4152' : '#9aa6bd') : look.coat && look.world === 'ocean' ? '#2c4a6a' : w.legs;
  const parts = [P.part(capsule(x, 46.6, x + side * 0.2, 54.2, 2.45, 2.25), legC, { w: 2.4 })];
  // a hen stands on her own yellow feet
  if (look.species === 'chicken') { parts.push(P.part(`M${x - 2.6} 57.4L${x + 0.4} 55L${x + 4.8} 56.8L${x + 4.8} 58.2H${x - 2.6}Z`, '#f2b33a', { w: 2 })); return parts; }
  if (look.world === 'ocean' && !look.coat) parts.push(P.part(`M${x - 3.2 + side * 0.4} 54.2H${x + 2.6 + side * 0.4}Q${x + 5.6 + side * 1.4} 57.4 ${x + 4.6 + side * 1.6} 58.6H${x - 3.4 + side * 0.4}Z`, w.boots, { w: 2.2, detail: `<path d="M${x + side * 0.4} 55.4V58.4M${x + 2.6 + side * 0.6} 55.8L${x + 3.2 + side * 0.8} 58.4" stroke="${dark(w.boots, 0.25)}" stroke-width=".5"/>` }));
  else {
    const bc = look.world === 'cyber' ? '#f0f0f5' : look.world === 'ocean' ? '#e8eef2' : w.boots;
    parts.push(P.part(`M${x - 2.6} 54H${x + 1.6}Q${x + 4.4} 54.4 ${x + 4.5} 57.2V58.2H${x - 2.7}Z`, bc, { w: 2.4, detail: `<path d="M${x - 2.7} 57.1H${x + 4.5}V58.2H${x - 2.7}Z" fill="${look.world === 'cyber' ? look._accent : dark(bc, 0.35)}"/>` + (look.world === 'space' ? `<path d="M${x - 2.6} 55.4H${x + 3.4}" stroke="${w.trim}" stroke-width=".8"/>` : '') }));
  }
  return parts;
}
function arm(P, look, sx, sy, hx, hy) {
  const w = WORLDS[look.world];
  const sleeve = look.species === 'blob' ? FUR.blob[0] : look.species === 'ghost' ? FUR.ghost[0] : look.coat && look.world === 'ocean' ? '#f4f7f8' : look.species === 'robot' && look.world === 'lab' ? '#9aa6bd' : look.tier >= 3 ? (look.tier === 4 ? '#2b2140' : w.jacket) : look.world === 'mafia' ? '#2a2a32' : look.world === 'farm' ? w.trim : look.world === 'cyber' ? '#2a2a3c' : w.suit;
  const hand = look.species === 'ghost' ? FUR.ghost[0] : handOf(look);
  const dx = hx - sx, dy = hy - sy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const ex = sx + ux * (L - 1.4), ey = sy + uy * (L - 1.4);
  const cuff = look.tier === 4 ? '#f2c14e' : look.world === 'space' ? w.trim : look.world === 'cyber' ? look._accent : null;
  return {
    sleeve: P.part(capsule(sx, sy, ex, ey, 2.35, 2.05), sleeve, { w: 1.8, detail: cuff ? `<path d="${capsule(ex - ux * 1.2, ey - uy * 1.2, ex, ey, 2.4)}" fill="${cuff}"/>` : '' }),
    hand: P.part(ell(hx, hy, 2.25, 2.25), hand, { w: 1.7 }),
  };
}

// ---------------------------------------------------------------------------------------------- tools
// every tool is drawn around its grip at (0,0), handle pointing down, and placed in the hand by the pose
function tool(P, look, kind) {
  const acc = look._accent, t = look.tier, gold = '#f2c14e', metal = t >= 3 ? gold : '#b8c1d4', wood = '#9a6a3c';
  const glow = t === 4 ? `<circle cx="0" cy="-8" r="9" fill="${P.radial([[0, acc, 0.55], [1, acc, 0]])}"/>` : '';
  const parts = [];
  let under = glow, over = '';
  switch (kind) {
    case 'pan':
      parts.push(P.part(capsule(0, 1.4, 0, -3.2, 0.9), wood, { w: 1.4 }));
      parts.push(P.part('M-7.6 -6.4Q0 -9.8 7.6 -6.4Q6.4 -2.6 0 -2.2Q-6.4 -2.6 -7.6 -6.4Z', t >= 3 ? gold : '#9aa3b5', { detail: `<ellipse cx="0" cy="-6.2" rx="6.2" ry="1.9" fill="${t >= 3 ? '#a8761e' : '#6d7588'}"/><circle cx="-2" cy="-6.4" r="1.1" fill="${gold}"/><circle cx=".9" cy="-6.9" r=".9" fill="#ffe27a"/><circle cx="2.8" cy="-6" r=".75" fill="${gold}"/><circle cx="-.6" cy="-7" r=".35" fill="#fff"/>` }));
      over += sparkle(3.6, -9.6, 1.4, '#fff3b0');
      break;
    case 'envelope':
      parts.push(P.part(rrect(-5.4, -7.8, 11, 7.4, 1), '#f7f2e6', { detail: `<path d="M-5.4 -7.4L0.1 -3.2L5.6 -7.4" fill="none" stroke="#c9bfa8" stroke-width=".8"/><path d="M-4.2 -2H-1.2" stroke="#c9bfa8" stroke-width=".6"/>` }));
      parts.push(P.part(ell(0.1, -3.4, 1.8, 1.8), acc, { w: 1.2, detail: `<path d="M-.7 -3.6q.8-.9 .8 .2q0-1.1 .8-.2q-.3 .9-.8 1.1q-.5-.2-.8-1.1Z" fill="#fff" opacity=".8"/>` }));
      break;
    case 'tag':
      over += `<path d="M0 0Q2.2 -3 3.4 -5.6" fill="none" stroke="#8a6a3a" stroke-width=".6"/>`;
      parts.push(P.part('M-1.6 -12.6L4.6 -12.6L8.6 -8.4L4.6 -4.2L-1.6 -4.2Q-2.6 -4.2 -2.6 -5.2V-11.6Q-2.6 -12.6 -1.6 -12.6Z', t >= 3 ? gold : acc, { detail: `<circle cx="5" cy="-8.4" r=".9" fill="${OUT}"/><text x="1.2" y="-6.4" font-size="5.4" font-weight="900" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif">$</text>` }));
      break;
    case 'camera':
      parts.push(P.part(rrect(-4.6, -9.6, 10, 7.2, 1.6), '#2f3346', { detail: `<rect x="-3.6" y="-8.8" width="3" height="1.4" rx=".4" fill="#4a5070"/><circle cx="3.4" cy="-8.4" r=".7" fill="#ff4a5a"/>` }));
      parts.push(P.part(ell(0.6, -5.8, 2.8, 2.8), '#1e2233', { w: 1.4, detail: `<circle cx=".6" cy="-5.8" r="1.7" fill="${acc}" opacity=".85"/><circle cx="-.1" cy="-6.5" r=".6" fill="#fff"/>` }));
      parts.push(P.part(rrect(-2.4, -12, 5.6, 2.2, 0.8), t >= 3 ? gold : '#3a3f58', { w: 1.2 }));
      break;
    case 'sign':
      parts.push(P.part(capsule(0, 1.6, 0, -13, 0.8), wood, { w: 1.4 }));
      parts.push(P.part(rrect(-6, -19.4, 12, 8.4, 1.2), t >= 3 ? '#fff6dc' : '#f4f1ea', { detail: `<rect x="-6" y="-19.4" width="12" height="2.4" fill="${acc}"/><path d="M-4.2 -14.8H2.4M-4.2 -13H4.2M-4.2 -15.8" stroke="#8a8fa3" stroke-width=".7" stroke-linecap="round"/><circle cx="3.6" cy="-14.8" r=".9" fill="${acc}"/>` }));
      break;
    case 'spyglass':
      parts.push(P.part(capsule(0, 1.4, 0, -6, 1.3, 1.5), t >= 3 ? gold : '#8a5a2e', { w: 1.6 }));
      parts.push(P.part(capsule(0, -5.6, 0, -12.4, 1.8, 2.2), t >= 3 ? '#f7d774' : '#c9a25a', { w: 1.6, detail: `<path d="M-2.4 -8.4H2.4" stroke="${dark('#c9a25a', 0.3)}" stroke-width=".6"/>` }));
      parts.push(P.part(ell(0, -12.8, 2.4, 1), '#8fe3ff', { w: 1.2 }));
      break;
    case 'blueprint':
      parts.push(P.part(capsule(-1.6, 2, 1.6, -12, 2.2), '#3d7fd6', { detail: `<path d="M-2 -1L1 -9M-.6 -3.4L2 -6" stroke="#dcecff" stroke-width=".5" opacity=".8"/>` }));
      parts.push(P.part(ell(1.6, -12, 2.2, 2.2), '#dcecff', { w: 1.2, detail: `<circle cx="1.6" cy="-12" r="1" fill="#3d7fd6"/>` }));
      parts.push(P.part(rrect(-4.4, -4, 2.6, 7.2, 0.6), metal, { w: 1.2 }));
      break;
    case 'magnifier':
      parts.push(P.part(capsule(0, 1.6, 0, -5.8, 1.05), t >= 3 ? gold : '#3a2f4a', { w: 1.4 }));
      parts.push(P.part('M0 -6.2m-4.4 -4.6a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Zm1.3 0a3.1 3.1 0 1 1 6.2 0a3.1 3.1 0 1 1 -6.2 0Z', metal, { w: 1.4 }));
      over += `<circle cx="0" cy="-10.8" r="3.1" fill="#bfefff" opacity=".55"/><path d="M-1.8 -12.2Q-.8 -13.4 .6 -13.2" fill="none" stroke="#fff" stroke-width=".7" stroke-linecap="round"/><path d="${star(0.4, -10.4, 1.5, 0.45)}" fill="${gold}"/>`;
      break;
    case 'pin':
      parts.push(P.part(capsule(0, 1.6, 0, -12, 0.85), t >= 3 ? gold : '#5a4a6a', { w: 1.4 }));
      parts.push(P.part('M0 -10.6Q-5 -15.4 -5 -18.4A5 5 0 1 1 5 -18.4Q5 -15.4 0 -10.6Z', acc, { detail: `<circle cx="0" cy="-18.4" r="1.9" fill="#fff"/><path d="M-3.2 -20.6Q-1.8 -22.2 .2 -22.2" fill="none" stroke="#fff" stroke-width=".7" opacity=".8" stroke-linecap="round"/>` }));
      break;
    case 'scepter':
      parts.push(P.part(capsule(0, 2, 0, -12, 0.95), gold, { w: 1.4, detail: `<path d="M-1 -4H1M-1 -8H1" stroke="#a8761e" stroke-width=".6"/>` }));
      parts.push(P.part(ell(0, -14.2, 3, 3), acc, { detail: `<text x="0" y="-12.8" font-size="4" font-weight="900" text-anchor="middle" fill="#7a5410" font-family="Arial, sans-serif">$</text><circle cx="-1" cy="-15.4" r=".7" fill="#fff"/>` }));
      under += `<circle cx="0" cy="-14.2" r="6.4" fill="${P.radial([[0, gold, 0.5], [1, gold, 0]])}"/>`;
      break;
    case 'scissors':
      parts.push(P.part('M-.9 -1.2L-1.4 -12L.4 -11.4L.9 -1.2Z', '#dfe4ee', { w: 1.2 }));
      parts.push(P.part('M.9 -1.2L3.6 -11.4L5 -10.4L1.9 -.6Z', '#dfe4ee', { w: 1.2 }));
      parts.push(P.part('M-3.2 1.6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0Zm.9 0a1.1 1.1 0 1 1 2.2 0a1.1 1.1 0 1 1 -2.2 0Z', acc, { w: 1.2 }), P.part('M2.8 1.2m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0Zm.9 0a1.1 1.1 0 1 1 2.2 0a1.1 1.1 0 1 1 -2.2 0Z', acc, { w: 1.2 }));
      break;
    case 'broom':
      parts.push(P.part(capsule(0, 2.4, 0, -16, 0.8), wood, { w: 1.4 }));
      parts.push(P.part('M-3.6 2.2H3.6L5.6 9.6H-5.6Z', '#e6c46a', { detail: `<path d="M-3.4 4V9.4M-1.2 4V9.4M1.2 4V9.4M3.4 4V9.4" stroke="#b58f3a" stroke-width=".5"/><rect x="-3.8" y="2" width="7.6" height="1.6" fill="${acc}"/>` }));
      break;
    case 'papers':
      parts.push(P.part('M-5.2 -9.2L4.6 -10.6L5.8 -1.8L-4 -.4Z', '#fbf7ee', { detail: `<path d="M-3.4 -7.6L3.4 -8.6M-3.2 -6L3.6 -7M-3 -4.4L2.2 -5.2" stroke="#9aa3b5" stroke-width=".5"/><path d="M-2.4 -3.2L3.8 -4.2" stroke="${acc}" stroke-width=".7"/>` }));
      break;
    case 'coffee':
      parts.push(P.part('M-2.8 -7.2H2.8L2.2 0.8Q2.1 1.6 1.3 1.6H-1.3Q-2.1 1.6 -2.2 .8Z', '#f3efe6', { detail: `<rect x="-2.8" y="-4.4" width="5.6" height="2" fill="#8a5a3a"/>` }), P.part(rrect(-3.4, -8.8, 6.8, 1.8, 0.7), '#5a3a2a', { w: 1.2 }));
      over += `<path d="M-1 -10.4q.8 -1 0 -2M1 -10.8q.8 -1 0 -2" fill="none" stroke="#fff" stroke-width=".5" opacity=".6" stroke-linecap="round"/>`;
      break;
    case 'phone':
      parts.push(P.part(rrect(-2.3, -8.6, 4.6, 8.4, 1.1), '#2b2f42', { w: 1.4, detail: `<rect x="-1.6" y="-7.7" width="3.2" height="6.4" rx=".5" fill="${acc}" opacity=".9"/><path d="M-1 -6.8L.6 -5.4" stroke="#fff" stroke-width=".5" opacity=".7"/>` }));
      break;
    case 'tablet':
      under += `<ellipse cx="0" cy="-6" rx="9" ry="6" fill="${P.radial([[0, acc, 0.35], [1, acc, 0]])}"/>`;
      parts.push(P.part(rrect(-7.6, -4, 15.2, 9.4, 1.4), '#2b2f42', { detail: `<rect x="-6" y="-2.6" width="12" height="6.6" rx=".6" fill="#10182a"/><path d="M-5 2.8L-2.4 .6L.2 1.8L3 -1.2L5 -.4" fill="none" stroke="${acc}" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="3" cy="-1.2" r=".6" fill="#fff"/>` }));
      break;
    case 'controller': {
      // a game pad held in both hands: two grips, a d-pad, four face buttons and a glowing light bar
      const lit = look.hair % 2 ? '#39ff9e' : '#5fd4ff';
      under += `<ellipse cx="0" cy="-1.4" rx="9" ry="4.6" fill="${P.radial([[0, lit, 0.35], [1, lit, 0]])}"/>`;
      parts.push(P.part('M-6.4 -3.6Q-3 -4.6 0 -4.2Q3 -4.6 6.4 -3.6Q8.8 -2.6 8.6 1.4Q8.4 3.8 6.6 3.6Q5 3.4 4 1.2H-4Q-5 3.4 -6.6 3.6Q-8.4 3.8 -8.6 1.4Q-8.8 -2.6 -6.4 -3.6Z', look.hair % 3 === 1 ? '#f0f0f5' : '#2a2a3a', { w: 1.4, detail: `<path d="M-5.6 -1.4H-3.2M-4.4 -2.6V-.2" stroke="#8a8fa3" stroke-width=".8" stroke-linecap="round"/><circle cx="4.4" cy="-2.2" r=".55" fill="#39ff9e"/><circle cx="5.6" cy="-1.1" r=".55" fill="#ff3fb8"/><circle cx="3.2" cy="-1.1" r=".55" fill="#5fd4ff"/><circle cx="4.4" cy="0" r=".55" fill="#ffd23f"/><path d="M-1.6 -3.4H1.6" stroke="${lit}" stroke-width=".9" stroke-linecap="round"/><circle cx="-1.6" cy=".4" r=".9" fill="#1a1a26"/><circle cx="1.6" cy=".4" r=".9" fill="#1a1a26"/>` }));
      break;
    }
    case 'clipboard':
      parts.push(P.part(rrect(-4.4, -12.4, 8.8, 11.4, 1), '#9a6a3c', { w: 1.4, detail: `<rect x="-3.6" y="-11" width="7.2" height="9.4" rx=".4" fill="#fbf7ee"/><path d="M-2.6 -8.6H2.6M-2.6 -7H2.6M-2.6 -5.4H1.2" stroke="#9aa3b5" stroke-width=".5"/><path d="M-2.6 -3.8Q-1.4 -5 0 -3.8Q1.4 -2.6 2.6 -3.8" fill="none" stroke="#2bb6b0" stroke-width=".6"/>` }));
      parts.push(P.part(rrect(-2, -13.4, 4, 2, 0.6), '#c9ced8', { w: 1 }));
      break;
    case 'pitchfork':
      parts.push(P.part(capsule(0, 3, 0, -13.6, 0.8), wood, { w: 1.4 }));
      parts.push(P.part('M-3.6 -13.2H3.6V-12.2L2.8 -12.2V-19.4H2V-12.2H.4V-20H-.4V-12.2H-2V-19.4H-2.8V-12.2L-3.6 -12.2Z', '#b8c1d4', { w: 1.2 }));
      break;
    case 'stack':
      for (let i = 0; i < 3; i++) parts.push(P.part(`M${-6 + i * 0.4} ${-2.2 - i * 2.2}L${6 + i * 0.3} ${-2.8 - i * 2.2}L${6.4 + i * 0.3} ${-0.6 - i * 2.2}L${-5.6 + i * 0.4} ${0 - i * 2.2}Z`, i === 2 ? '#fbf7ee' : '#ece6d8', { w: 1.2, detail: i === 2 ? `<path d="M-3 -4.8L3 -5.2" stroke="${acc}" stroke-width=".7"/>` : '' }));
      break;
  }
  if (t === 4 && !['phone', 'tablet', 'stack', 'controller', 'clipboard'].includes(kind)) over += sparkle(-3.4, -12.6, 1.3) + sparkle(4.4, -4.6, 0.9);
  return { parts, under, over };
}

// ---------------------------------------------------------------------------------------------- poses
// shoulder and hand points, leg swing, body lift, and where the tool goes
const POSE = {
  idle: { lift: 0, legs: [0, 0], armB: [26.2, 37.6, 23.2, 45.2], armF: [38.2, 37.6, 41.2, 45], toolAt: [41.2, 45, 22], expr: 'smile' },
  walk: { lift: -0.7, legs: [15, -15], armB: [26.2, 37.6, 22.6, 44], armF: [38.2, 37.6, 42.4, 44.2], toolAt: [42.4, 44.2, 36], expr: 'smile' },
  walk2: { lift: -0.2, legs: [-13, 13], armB: [26.2, 37.6, 24.6, 46.2], armF: [38.2, 37.6, 40.2, 46], toolAt: [40.2, 46, 12], expr: 'smile' },
  phone: { lift: 0, legs: [0, 0], armB: [26.2, 37.6, 24.2, 45.2], armF: [38.4, 37.2, 45.2, 31.2], toolAt: [45.2, 31.2, -8], expr: 'talk', held: 'phone', stow: true },
  cheer: { lift: -3.2, legs: [-9, 9], armB: [26, 37, 20.2, 28.4], armF: [38.4, 37, 44.2, 28.4], toolAt: [44.2, 28.4, 12], expr: 'grin' },
  type: { lift: 0, legs: [0, 0], armB: [26.2, 37.6, 27.4, 44.2], armF: [38.2, 37.6, 37, 44.2], toolAt: [32.2, 43.2, 0], expr: 'focus', held: 'tablet', both: true, stow: true },
  // the game den: both hands on the pad up at the chest, elbows out, leaning into it
  game: { lift: 0, legs: [0, 0], armB: [26.2, 37.6, 25, 42.4], armF: [38.2, 37.6, 39.6, 42.4], toolAt: [32.3, 41, 0], expr: 'focus', held: 'controller', both: true, stow: true, lean: -3 },
  game2: { lift: -0.4, legs: [-6, 6], armB: [26.2, 37.4, 25.6, 39.6], armF: [38.2, 37.4, 39.6, 38.4], toolAt: [32.6, 38, -10], expr: 'grin', held: 'controller', both: true, stow: true, lean: 5 },
  carry: { lift: -0.5, legs: [18, -20], armB: [26.2, 37.4, 28.6, 42.4], armF: [38.2, 37.4, 36.4, 42.4], toolAt: [32.4, 42.4, 0], expr: 'proud', held: 'stack', both: true, stow: true, lean: 6 },
};

// Optional cycle phase in [0, 1). Static exports retain their original poses.
function cyclePose(name, phase) {
  const base = POSE[name] || POSE.idle;
  if (!Number.isFinite(phase)) return base;
  const t = ((phase % 1) + 1) % 1, wave = Math.sin(t * Math.PI * 2);
  const p = { ...base, legs: [...base.legs], armB: [...base.armB], armF: [...base.armF], toolAt: [...base.toolAt] };
  if (name === 'walk' || name === 'walk2' || name === 'carry') {
    const stride = name === 'carry' ? 14 : 20;
    p.legs = [wave * stride, -wave * stride];
    p.lift = -Math.pow(Math.sin(t * Math.PI * 2), 2) * 1.1;
    p.lean = name === 'carry' ? 4 : wave * 1.2;
    if (name !== 'carry') {
      p.armB[2] = 24 - wave * 2.4; p.armB[3] = 44.8 + wave * 0.8;
      p.armF[2] = 40.8 + wave * 2.4; p.armF[3] = 44.8 - wave * 0.8;
      p.toolAt = [p.armF[2], p.armF[3], 22 + wave * 14];
    }
  } else if (name === 'type') {
    p.armB[3] += wave * 0.7; p.armF[3] -= wave * 0.7;
    p.toolAt[2] += wave * 1.5;
  } else if (name === 'cheer') {
    const jump = (1 - Math.cos(t * Math.PI * 2)) / 2;
    p.lift = -jump * 3.8; p.legs = [-3 - jump * 6, 3 + jump * 6];
    p.armB[2] -= wave; p.armF[2] += wave;
    p.toolAt[0] = p.armF[2];
  } else {
    p.lift = -wave * 0.35; p.lean = wave * 0.65;
    p.armF[3] += wave * 0.25; p.toolAt[1] += wave * 0.25;
  }
  return p;
}

// ---------------------------------------------------------------------------------------------- the figure
function folkSvg(look, opts = {}) {
  if (opts.catalog) return { roles: ROLES, tiers: TIERS, worlds: WORLDS, species: SPECIES, skins: SKINS, hairs: HAIRS, hairColors: HAIR_COLORS, eyeColors: EYE_COLORS, exprs: EXPRS, poses: POSES };
  const L = { role: 'prospector', world: 'space', tier: 0, species: 'human', skin: 1, hair: 0, hairC: 0, eyeC: 0, ...look };
  const role = ROLES[L.role] || ROLES.crew;
  L._accent = L.tint || role.col;
  const fo = furOf(L);
  L._lid = L.species === 'human' ? at(SKINS, L.skin) : fo ? fo[0] : '#ccc';
  L._neck = L.species === 'human' ? dark(at(SKINS, L.skin), 0.12) : L.species === 'robot' ? '#7d879b' : fo ? dark(fo[0], 0.12) : '#ccc';
  const agent = L.agent ?? role.agent;
  const id = opts.id || 'folk';
  // the game den plays: sitting, standing about or at work, everyone has a pad in both hands
  let poseName = opts.pose || 'idle';
  if (L.world === 'gamer' && (poseName === 'type' || (poseName === 'idle' && !agent))) poseName = (L.hair + L.eyeC) % 3 === 0 ? 'game2' : 'game';
  L._pose = poseName;
  const pose = cyclePose(poseName, opts.phase);
  const mode = L.expr || pose.expr;
  const P = Painter(id);
  const kid = L.role === 'kid';

  const [ax, ay, ahx, ahy] = pose.armB, [fx, fy, fhx, fhy] = pose.armF;
  const aB = arm(P, L, ax, ay, ahx, ahy), aF = arm(P, L, fx, fy, fhx, fhy);
  const head = headParts(P, L, pose, mode);
  // what's in hand: the pose's own thing, else the role's tool, else what this world's folk carry
  const worldTool = L.world === 'gamer' && !agent ? 'controller' : L.world === 'ocean' && L.coat && !agent ? 'clipboard' : L.tool;
  const toolKind = pose.held || worldTool || role.tool;
  const tl = tool(P, L, toolKind);
  const [tx, ty, tr] = pose.toolAt;
  const toolNode = { tf: `translate(${f(tx)} ${f(ty)}) rotate(${tr})`, items: tl.parts, under: tl.under, over: tl.over };

  // the tail and cape go behind everything
  const behind = [];
  if (L.species === 'cat') behind.push(P.part('M26 48.4Q17.4 50.4 16.6 42Q16.2 36.6 19.6 34.6Q21.4 34 21 35.4Q18.4 37.4 19 42Q19.8 47.4 26.6 45.8Z', FUR.cat[0], { w: 1.8 }));
  if (L.species === 'pig') behind.push(P.part('M26.2 47.4Q22.4 48.6 22.2 46.2Q22 44.2 23.8 44.6Q25 45.4 23.6 46.2Q24.4 46.8 26 46Z', FUR.pig[0], { w: 1.4 }));
  if (L.species === 'fox') behind.push(P.part('M26.4 48.6C20.2 49.6 14.2 47.4 11.8 42.2C10.2 38.6 10.8 34.6 13.2 32.6C13.4 36 15.8 38.8 19.4 40C22.4 41 25.4 42.4 27.6 45.4Z', FUR.fox[0], { detail: '<path d="M13.2 32.6C11 34.6 10.2 38.6 12 42.2C12.4 39.6 13.6 37.6 15.8 36.6C14.2 35.6 13.4 34.2 13.2 32.6Z" fill="#fff4ea"/>' }));
  if (L.tier === 4) behind.push(P.part('M25.2 36.2Q20.6 44 21.6 55.6Q32.2 58.4 42.8 55.6Q43.8 44 39.2 36.2Z', '#6a1f3a', { detail: `<path d="M21.8 54.4Q32.2 57.2 42.6 54.4" fill="none" stroke="#f2c14e" stroke-width="1.2"/>` }));

  const legTf = (i, hipX) => pose.legs[i] ? `rotate(${pose.legs[i]} ${hipX} 46.8)` : null;
  const blob = L.species === 'blob', ghost = L.species === 'ghost';
  // a ghost's body is its sheet, hanging to a wavy hem that never quite reaches the floor
  const sheet = () => { const fl = L._pose === 'walk' ? 0.8 : L._pose === 'walk2' ? -0.8 : 0; return [P.part(`M23.4 36C23.4 34 27.4 33.2 32.2 33.2C37 33.2 41 34 41 36L43.6 53.4Q44 55.6 42.4 55.8Q40.8 ${f(54.2 + fl)} 39 55.8Q37.2 ${f(57.4 - fl)} 35.4 55.8Q33.6 ${f(54.2 + fl)} 31.8 55.8Q30 ${f(57.4 - fl)} 28.2 55.8Q26.4 ${f(54.2 + fl)} 24.4 55.8Q21.6 56 20.8 53.4Z`, FUR.ghost[0], { grad: P.grad([[0, '#ffffff'], [0.6, FUR.ghost[0]], [1, '#cdd6f2']], 0.2, 1), detail: `<path d="M27.4 38Q26.4 46 27.6 54M36.8 38Q38 46 36.8 54" fill="none" stroke="#cdd6f2" stroke-width=".8" opacity=".8"/>` })]; };
  const jelly = () => [P.part('M24.4 38.2C24.4 35 27.8 33.4 32.2 33.4C36.6 33.4 40 35 40 38.2L43.2 55.2Q43.6 58.4 40.4 58.4H24Q20.8 58.4 21.2 55.2Z', FUR.blob[0], { grad: P.grad([[0, light(FUR.blob[0], 0.3)], [0.7, FUR.blob[0]], [1, dark(FUR.blob[0], 0.12)]], 0.2, 1), detail: `<circle cx="28" cy="48" r="1.3" fill="${FUR.blob[1]}" opacity=".7"/><circle cx="36.6" cy="52.4" r="1.8" fill="${FUR.blob[1]}" opacity=".55"/><circle cx="33" cy="44.4" r=".9" fill="${FUR.blob[1]}" opacity=".7"/><path d="M29.4 36.4L32.2 38.2L35 36.4L35 39.8L32.2 38.2L29.4 39.8Z" fill="${L._accent}" stroke="${OUT}" stroke-width=".5"/><path d="M22.4 55.6Q32.2 57.8 42 55.6" fill="none" stroke="${dark(FUR.blob[0], 0.25)}" stroke-width=".6" opacity=".6"/>` })];
  const body = G(pose.lean ? `rotate(${pose.lean} 32.2 50)` : null,
    G(Number.isFinite(opts.phase) ? `rotate(${f(Math.sin(opts.phase * Math.PI * 2 - 0.7) * 2)} 32.2 38)` : null, behind),
    G(null, [aB.sleeve]),
    blob || ghost ? null : G(legTf(0, 28.4), leg(P, L, -1)),
    blob || ghost ? null : G(legTf(1, 35.9), leg(P, L, 1)),
    blob ? G(null, jelly()) : ghost ? G(null, sheet()) : G(null, outfit(P, L), belt(P, L)),
    G(null, head.back),
    { ...G(null, head.face), over: head.over },
    G(null, head.front),
    head.top ? { tf: null, items: [], over: head.top } : null,
    pose.both ? null : G(null, [aB.hand]),
    G(null, [aF.sleeve]),
    toolNode,
    G(null, [aF.hand]),
  );
  // when both hands hold the tool, the back hand goes over it too
  if (pose.both) body.items.push({ kid: G(null, [aB.hand]) });
  const lift = pose.lift, scale = kid ? 0.86 : 1;
  const figTf = `translate(${f(32.2 * (1 - scale))} ${f(58.2 * (1 - scale) + lift)}) scale(${scale})`;

  // aura, diamond, sparkles: drawn without the outline
  let back = '', front = '';
  if (L.tier === 4) back += `<circle cx="32.2" cy="36" r="27" fill="${P.radial([[0, L._accent, 0.32], [0.55, L._accent, 0.12], [1, L._accent, 0]])}"/><ellipse cx="32.2" cy="58.4" rx="15" ry="2.8" fill="none" stroke="${L._accent}" stroke-width=".7" opacity=".6"/>`;
  if (L.tier >= 3) front += sparkle(12, 20, 1.6) + sparkle(53, 30, 1.2) + sparkle(50, 12, 0.9, '#ffe9a8');
  if (L.tier === 4) front += [[14.5, 44, 1.5], [50.6, 46.6, 1.3], [47, 20.6, 1.1]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r * 1.35}" fill="#f2c14e" stroke="#a8761e" stroke-width=".5"/><text x="${x}" y="${y + r * 0.62}" font-size="${r * 1.9}" font-weight="900" text-anchor="middle" fill="#7a5410" font-family="Arial, sans-serif">$</text>`).join('');
  if (opts.pose === 'cheer') front += sparkle(15, 22, 1.6) + sparkle(50, 21, 1.4) + sparkle(46, 12, 1) + sparkle(18, 12, 0.9);
  if (agent) {
    const dy = kid ? 6 : 0, top = (L.species === 'alien' ? (L.hair % 3 === 0 ? -3 : 1) : L.species === 'grey' ? 7.2 : L.species === 'robot' ? 4 : L.world === 'lab' && L.species === 'human' ? 1.6 : at(HAIRS, L.hair) === 'puff' && L.species === 'human' ? 3.6 : 6.6) + lift + dy;
    front += `<g transform="translate(32.2 ${f(top - 2)})"><circle r="4.6" fill="${P.radial([[0, L._accent, 0.5], [1, L._accent, 0]])}"/><path d="M0 -3.4L2.1 0L0 3.4L-2.1 0Z" fill="${L._accent}" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/><path d="M0 -3.4L2.1 0H0Z" fill="#fff" opacity=".55"/></g>`;
  }

  const shadowR = opts.pose === 'cheer' ? 9.6 : 12.8;
  const shadow = opts.shadow === false ? '' : `<ellipse cx="32.2" cy="58.4" rx="${shadowR}" ry="2.5" fill="${P.radial([[0, '#0a0712', 0.55], [0.6, '#0a0712', 0.25], [1, '#0a0712', 0]])}"/>`;
  const fig = `<g transform="${figTf}"><g>${paintTree(body, 'out')}</g>${paintTree(body, 'fill')}</g>`;
  const mirror = opts.dir === 'l' ? ' transform="matrix(-1 0 0 1 64.4 0)"' : '';
  const vb = opts.crop === 'head' ? '17 5 30.4 30.4' : opts.crop === 'bust' ? '10 1 44.4 44.4' : '-10 -14 84.4 84.4';
  const cls = `folk folk-${L.role} folk-${L.world} folk-t${L.tier} folk-s-${L.species} folk-${poseName}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="${cls}"><defs>${P.defs()}</defs><g${mirror}>${back}${shadow}${fig}${front}</g></svg>`;
}

// ---------------------------------------------------------------------------------------------- critters
// small world creatures in the same style: critterSvg('crab', { id, pose: 'idle' | 'walk', tint })
function critterSvg(kind = 'crab', opts = {}) {
  const P = Painter(opts.id || 'critter'), walk = opts.pose === 'walk';
  let parts = [], over = '';
  if (kind === 'crab') {
    const c = opts.tint || '#e8573f';
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const x = 32.2 + s * (6 + k * 2.2), y = 52.4 + k * 0.6, kick = walk ? (k % 2 ? 1.2 : -1.2) * s : 0;
      parts.push(P.part(capsule(x, y, x + s * 3.4 + kick, y + 4.6, 0.8, 0.6), dark(c, 0.1), { w: 1.2, rim: false }));
    }
    for (const s of [-1, 1]) {
      parts.push(P.part(capsule(32.2 + s * 7, 49, 32.2 + s * 12.6, 43.6, 1.1), c, { w: 1.4 }));
      parts.push(P.part(`M${f(32.2 + s * 11)} 44.4Q${f(32.2 + s * 13.4)} 36.8 ${f(32.2 + s * 17.2)} 40Q${f(32.2 + s * 15)} 41.4 ${f(32.2 + s * 14.6)} 43.4Q${f(32.2 + s * 17.8)} 43.6 ${f(32.2 + s * 17.4)} 45.8Q${f(32.2 + s * 14)} 48.6 ${f(32.2 + s * 11)} 44.4Z`, c, { w: 1.6 }));
      parts.push(P.part(capsule(32.2 + s * 2.6, 46, 32.2 + s * 3.4, 40.6, 0.55), dark(c, 0.1), { w: 1, rim: false }), P.part(ell(32.2 + s * 3.4, 40, 1.6, 1.6), '#ffffff', { w: 1.2, rim: false, detail: `<circle cx="${f(32.2 + s * 3.6)}" cy="40.3" r=".85" fill="#1e1422"/><circle cx="${f(32.2 + s * 3.9)}" cy="39.7" r=".3" fill="#fff"/>` }));
    }
    parts.push(P.part('M20.6 51.4C20.6 45.4 25.6 43 32.2 43C38.8 43 43.8 45.4 43.8 51.4C43.8 54.6 39 56.4 32.2 56.4C25.4 56.4 20.6 54.6 20.6 51.4Z', c, { detail: `<circle cx="27.4" cy="48" r="1" fill="${light(c, 0.4)}" opacity=".8"/><circle cx="36" cy="47.2" r=".8" fill="${light(c, 0.4)}" opacity=".8"/>` }));
    over = `<path d="M29.6 51.6Q32.2 53.4 34.8 51.6" fill="none" stroke="${OUT}" stroke-width=".9" stroke-linecap="round"/><ellipse cx="26.6" cy="51.8" rx="1.4" ry=".8" fill="#ff8a9a" opacity=".5"/><ellipse cx="37.8" cy="51.8" rx="1.4" ry=".8" fill="#ff8a9a" opacity=".5"/>`;
  }
  const node = { items: parts, over };
  const shadow = opts.shadow === false ? '' : `<ellipse cx="32.2" cy="58" rx="12" ry="2.2" fill="#0a0712" opacity=".3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -14 84.4 84.4" class="critter critter-${kind}"><defs>${P.defs()}</defs>${shadow}<g transform="translate(0 ${walk ? -0.6 : 0})"><g>${paintTree(node, 'out')}</g>${paintTree(node, 'fill')}</g></svg>`;
}

const FOLK = { roles: ROLES, tiers: TIERS, worlds: WORLDS, species: SPECIES, skins: SKINS, hairs: HAIRS, hairColors: HAIR_COLORS, eyeColors: EYE_COLORS, exprs: EXPRS, poses: POSES };
if (typeof globalThis !== 'undefined') { globalThis.folkSvg = folkSvg; globalThis.critterSvg = critterSvg; globalThis.FOLK = FOLK; }
export { folkSvg, critterSvg, FOLK };
