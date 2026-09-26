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
//     world    space castle farm cyber alien ocean   (the outfit and headgear)
//     tier     0 Runner, 1 Clerk, 2 Trader, 3 Broker, 4 Tycoon   (gear grows with it)
//     species  human fox robot grey skeleton octo
//     skin, hair, hairC, eyeC: index numbers into FOLK.skins, FOLK.hairs, FOLK.hairColors, FOLK.eyeColors
//     expr     smile grin focus talk wink proud   (a pose picks its own when this is left out)
//     tint     a color for the role accent (defaults to the role's color)
//     agent    true draws the floating role diamond an AI agent carries (defaults: the ten agent roles)
//   options: { id, pose, dir, crop }
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
};
const SPECIES = ['human', 'fox', 'robot', 'grey', 'skeleton', 'octo'];
const SKINS = ['#fbdcc6', '#f3c5a2', '#dea57c', '#bd7c52', '#8f5b3b', '#5f3b29'];
const HAIRS = ['short', 'bob', 'long', 'bun', 'spiky', 'puff', 'pony'];
const HAIR_COLORS = ['#5a3726', '#2b2126', '#e3b65c', '#b8502e', '#a3a9b8', '#ee76ae', '#3fb0cf'];
const EYE_COLORS = ['#c98a2c', '#5b8f3a', '#3b7fc4', '#7a4b2a', '#8d5fd3', '#2a2a2a'];
const EXPRS = ['smile', 'grin', 'focus', 'talk', 'wink', 'proud'];
const POSES = ['idle', 'walk', 'phone', 'cheer', 'type', 'carry'];
const FUR = { fox: ['#e98a3c', '#fff4ea'], octo: ['#a466d8', '#e7c9ff'], grey: ['#a9c2b4', '#d9eadf'], skeleton: ['#efe8da', '#fffaf0'], robot: ['#b9c4d6', '#e8eef7'] };

// ---------------------------------------------------------------------------------------------- color helpers
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const dark = (c, t) => mix(c, '#1a0f24', t);
const light = (c, t) => mix(c, '#ffffff', t);
// one color becomes the five a part is painted with
const tones = (c) => ({ base: dark(c, 0.2), lit: c, hi: light(c, 0.42), cool: mix(light(c, 0.3), '#a8dcff', 0.45), line: dark(c, 0.5) });
const f = (n) => (Math.round(n * 100) / 100).toString();

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
  const eyeC = EYE_COLORS[look.eyeC % EYE_COLORS.length];
  const one = (x, closed, wink) => {
    if (closed || wink) return `<path d="M${f(x - 2.3)} ${f(ey + 0.6)}Q${f(x)} ${f(ey - 2.2)} ${f(x + 2.3)} ${f(ey + 0.6)}" fill="none" stroke="${OUT}" stroke-width="1.05" stroke-linecap="round"/>`;
    if (species === 'grey') {
      const g = P.grad([[0, '#1d1a2a'], [0.6, '#0c0a14'], [1, '#2a2440']]);
      return `<path d="M${f(x - 3.1)} ${f(ey - 0.2)}Q${f(x - 2.4)} ${f(ey - 3.6)} ${f(x + 1)} ${f(ey - 3.1)}Q${f(x + 3.4)} ${f(ey - 2.3)} ${f(x + 2.6)} ${f(ey + 0.9)}Q${f(x + 1.4)} ${f(ey + 3)} ${f(x - 1.4)} ${f(ey + 2.4)}Q${f(x - 3.3)} ${f(ey + 1.7)} ${f(x - 3.1)} ${f(ey - 0.2)}Z" fill="${g}" stroke="${OUT}" stroke-width=".6"/>`
        + `<ellipse cx="${f(x - 0.6)}" cy="${f(ey - 1.4)}" rx="1.1" ry=".7" fill="#fff" opacity=".85" transform="rotate(-25 ${f(x - 0.6)} ${f(ey - 1.4)})"/><circle cx="${f(x + 1.3)}" cy="${f(ey + 1)}" r=".4" fill="#9ff6d8" opacity=".8"/>`;
    }
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
  if (species === 'skeleton') return `<path d="M29.2 ${f(cy - 0.2)}H35.2" stroke="${OUT}" stroke-width=".7"/><path d="M30.2 ${f(cy - 0.9)}V${f(cy + 0.6)}M31.7 ${f(cy - 0.9)}V${f(cy + 0.6)}M33.2 ${f(cy - 0.9)}V${f(cy + 0.6)}M34.4 ${f(cy - 0.8)}V${f(cy + 0.4)}" stroke="${OUT}" stroke-width=".45"/>`;
  if (species === 'robot') return mode === 'talk' || mode === 'grin' ? `<rect x="29.9" y="${f(cy - 0.7)}" width="4.6" height="1.7" rx=".7" fill="${look._accent}"/>` : `<path d="M30 ${f(cy)}H34.4" stroke="${look._accent}" stroke-width=".9" stroke-linecap="round"/>`;
  if (mode === 'grin') return `<path d="M29.5 ${f(cy - 0.9)}Q32.2 ${f(cy - 0.3)} 34.9 ${f(cy - 0.9)}Q34.6 ${f(cy + 2.6)} 32.2 ${f(cy + 2.7)}Q29.8 ${f(cy + 2.6)} 29.5 ${f(cy - 0.9)}Z" fill="#7a2338" stroke="${OUT}" stroke-width=".6"/><path d="M30.6 ${f(cy + 1.4)}Q32.2 ${f(cy + 0.7)} 33.8 ${f(cy + 1.4)}Q33.3 ${f(cy + 2.4)} 32.2 ${f(cy + 2.4)}Q31.1 ${f(cy + 2.4)} 30.6 ${f(cy + 1.4)}Z" fill="#ff8aa0"/><path d="M30 ${f(cy - 0.6)}H34.4" stroke="#fff" stroke-width=".5" opacity=".9"/>`;
  if (mode === 'talk') return `<ellipse cx="32.2" cy="${f(cy + 0.5)}" rx="1.35" ry="1.15" fill="#7a2338" stroke="${OUT}" stroke-width=".55"/><ellipse cx="32.2" cy="${f(cy + 0.95)}" rx=".75" ry=".45" fill="#ff8aa0"/>`;
  if (mode === 'focus') return `<path d="M30.9 ${f(cy)}Q32.2 ${f(cy + 0.9)} 33.5 ${f(cy)}" fill="none" stroke="#8a3040" stroke-width=".8" stroke-linecap="round"/>`;
  if (mode === 'proud') return `<path d="M30 ${f(cy - 0.3)}Q32.5 ${f(cy + 1.9)} 34.8 ${f(cy - 0.7)}" fill="none" stroke="#8a3040" stroke-width=".9" stroke-linecap="round"/>`;
  return `<path d="M30.3 ${f(cy - 0.2)}Q32.2 ${f(cy + 1.7)} 34.1 ${f(cy - 0.2)}" fill="#a83a52" stroke="#8a3040" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ---------------------------------------------------------------------------------------------- heads
function headParts(P, look, pose, mode) {
  const sp = look.species, skin = SKINS[look.skin % SKINS.length], hairC = HAIR_COLORS[look.hairC % HAIR_COLORS.length];
  const fur = FUR[sp] ? FUR[sp][0] : skin, pale = FUR[sp] ? FUR[sp][1] : light(skin, 0.4);
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
  } else if (sp === 'fox') {
    back.push(P.part('M22.8 21.8L20.4 8.6Q27.2 10.8 30.4 16.8Z', fur, { w: 1.8, detail: `<path d="M22.8 20.4L21.4 11.6Q25.8 13.4 28 17.2Z" fill="#fff0e2"/>` }));
    back.push(P.part('M34 16.8Q37.2 10.8 44 8.6L41.6 21.8Z', fur, { w: 1.8, detail: `<path d="M36.4 17.2Q38.6 13.4 43 11.6L41.6 20.4Z" fill="#fff0e2"/>` }));
    face.push(P.part(headD, fur, { detail: `<path d="M20 29.2Q26 26.2 32.2 29.4Q38.4 26.2 44.4 29.2V36H20Z" fill="${pale}"/><path d="M26 18.8Q32.2 15.6 38.4 18.8Q35 17.8 32.2 21.4Q29.4 17.8 26 18.8Z" fill="${light(fur, 0.25)}" opacity=".7"/>` }));
    over += blush.replaceAll('.45', '.35') + `<path d="M31 28.9Q32.2 28.1 33.4 28.9Q32.9 30 32.2 30.1Q31.5 30 31 28.9Z" fill="#2a1d33"/>`;
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
  } else if (sp === 'octo') {
    // tentacles hang where hair would, curling at the tips
    for (const s of [-1, 1]) {
      const X = (v) => f(32.2 + s * v);
      back.push(P.part(`M${X(8.6)} 22.6Q${X(14.8)} 27.4 ${X(14.6)} 33.4Q${X(14.4)} 37.8 ${X(17.6)} 38.2Q${X(19.8)} 38 ${X(19.4)} 35.8Q${X(17.4)} 36.6 ${X(17.2)} 33.6Q${X(17.6)} 25.8 ${X(10.4)} 20.4Z`, fur, { w: 1.8, detail: `<circle cx="${X(15.4)}" cy="29.6" r=".75" fill="${light(fur, 0.5)}"/><circle cx="${X(15.8)}" cy="33.2" r=".65" fill="${light(fur, 0.5)}"/><circle cx="${X(17.4)}" cy="36.4" r=".5" fill="${light(fur, 0.5)}"/>` }));
    }
    face.push(P.part('M32.2 13.8C40 13.8 44 19.2 43.8 25.4C43.6 31 39 35 32.2 35C25.4 35 20.8 31 20.6 25.4C20.4 19.2 24.4 13.8 32.2 13.8Z', fur, { detail: `<circle cx="27" cy="18.6" r="1.1" fill="${light(fur, 0.45)}" opacity=".8"/><circle cx="37.8" cy="17.8" r=".8" fill="${light(fur, 0.45)}" opacity=".8"/><circle cx="40.4" cy="21.2" r=".6" fill="${light(fur, 0.45)}" opacity=".7"/>` }));
    over += blush.replaceAll('#ff7f8f', '#ff9ad2');
  }
  over += eyes(P, look, ex, ey, mode, sp) + mouth(look, mode, sp);
  headGear(P, look, front, back);
  return { back, face, front, over };
}
function brows(c) { const d = dark(c, 0.25); return `<path d="M25.4 21.9Q27.2 21 29 21.7M35.4 21.7Q37.2 21 39 21.9" fill="none" stroke="${d}" stroke-width=".85" stroke-linecap="round"/>`; }
function hairParts(P, look, c, back, front) {
  const st = HAIRS[look.hair % HAIRS.length];
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
  const w = WORLDS[look.world], t = look.tier, acc = look._accent, gold = '#f2c14e';
  const trim = t >= 3 ? gold : acc;
  if (look.species === 'robot' && w.gear !== 'straw' && w.gear !== 'hood') return;
  if (w.gear === 'straw') {
    back.push(P.part('M22.6 17.8Q23 9.8 32.2 9.6Q41.4 9.8 41.8 17.8Z', '#e8c96a', { detail: `<path d="M22.6 15.6Q32.2 13.4 41.8 15.6V17.9H22.6Z" fill="${trim}"/><path d="M26 12.6Q29 11 32 11" fill="none" stroke="#fff3c4" stroke-width=".7" opacity=".7"/>` }));
    front.push(P.part('M13.6 19.2Q15 16.2 22 16.4Q32.2 15.2 42.4 16.4Q49.4 16.2 50.8 19.2Q47.8 21.4 42 20.8Q32.2 19.6 22.4 20.8Q16.6 21.4 13.6 19.2Z', '#e8c96a', { detail: `<path d="M17 18.8Q24 17.6 32.2 17.4Q40.4 17.6 47.4 18.8" fill="none" stroke="#c9a449" stroke-width=".5" stroke-dasharray="1 1"/>` }));
  } else if (w.gear === 'comm') {
    front.push(P.part('M20.2 24.2C20.2 16.4 25.4 12.6 32.2 12.6C39 12.6 44.2 16.4 44.2 24.2L42.4 24.2C42.4 17.8 38 14.6 32.2 14.6C26.4 14.6 22 17.8 22 24.2Z', '#c9d2e0', { w: 1.6 }));
    front.push(P.part(rrect(40.6, 22.4, 4.8, 6.2, 2), '#e9edf5', { w: 1.6, detail: `<circle cx="43" cy="25.5" r="1.2" fill="${trim}"/>` }));
    if (t >= 1) front.push(P.part(capsule(42.4, 28, 36.6, 31.6, 0.45), '#8d97ab', { w: 1 }), P.part(ell(36.2, 31.8, 0.9, 0.9), '#2d3548', { w: 1 }));
  } else if (w.gear === 'visor') {
    front.push(P.part('M20.4 22.4Q32.2 18.2 44 22.4L43.8 25.4Q32.2 21.6 20.6 25.4Z', '#1b1b28', { w: 1.8, detail: `<path d="M21.8 23.1Q32.2 19.6 42.6 23.1" fill="none" stroke="${trim}" stroke-width=".9"/>` }));
    front.push(P.part(rrect(22.4, 17.6, 19.6, 4.4, 2), trim, { w: 1.6, grad: P.grad([[0, light(trim, 0.35)], [1, dark(trim, 0.25)]], 0, 1), detail: `<path d="M24 18.6H31" stroke="#fff" stroke-width=".7" opacity=".6" stroke-linecap="round"/>` }));
  } else if (w.gear === 'mask') {
    front.push(P.part('M20.6 20.6Q32.2 17 43.8 20.6L43.6 22.6Q32.2 19.2 20.8 22.6Z', '#2b2b3a', { w: 1.4 }));
    front.push(P.part(rrect(23.4, 13.6, 17.6, 7.4, 3.4), '#ffd23f', { w: 1.8, detail: `<path d="${rrect(24.8, 14.9, 14.8, 4.8, 2.3)}" fill="#8fe3ff" opacity=".85"/><path d="M26.2 15.9L28.4 18.9M29 15.9L30.4 17.8" stroke="#fff" stroke-width=".7" opacity=".8" stroke-linecap="round"/>` }));
  } else if (w.gear === 'crest') {
    if (look.species !== 'grey') return;
    front.push(P.part(ell(32.2, 15.6, 1.8, 1.8), trim, { w: 1.2, detail: `<circle cx="31.6" cy="15" r=".6" fill="#fff" opacity=".8"/>` }));
  } else if (w.gear === 'hood' && t <= 1) {
    back.push(P.part('M18.6 30Q17.4 13.4 32.2 12.2Q47 13.4 45.8 30L43.4 34.2Q44 21 32.2 20.2Q20.4 21 21 34.2Z', '#4a3040', { detail: `<path d="M22 17.6Q32.2 12.6 42.4 17.6" fill="none" stroke="#6a4a5e" stroke-width=".8" opacity=".8"/>` }));
  }
  // from Trader up, a trading-floor headset: an earpiece and a mic on a boom
  if (t >= 2 && w.gear !== 'comm') {
    front.push(P.part(rrect(42, 23.6, 3.6, 5.6, 1.6), '#2b2f42', { w: 1.5, detail: `<circle cx="43.8" cy="26.4" r=".9" fill="${trim}"/>` }));
    front.push(P.part(capsule(43.4, 28.6, 37.4, 31.6, 0.42), '#3a3f58', { w: 1 }), P.part(ell(36.9, 31.8, 0.95, 0.95), '#2b2f42', { w: 1 }));
  }
  // the tycoon's circlet: gold, with the role's gem
  if (t === 4 && w.gear !== 'straw' && w.gear !== 'mask') front.push(P.part('M22.6 18.4L25 13.8L28.2 16.8L32.2 11.8L36.2 16.8L39.4 13.8L41.8 18.4Q32.2 16.2 22.6 18.4Z', gold, { w: 1.6, detail: `<circle cx="32.2" cy="16.2" r="1.3" fill="${acc}"/><circle cx="31.8" cy="15.8" r=".45" fill="#fff"/>` }));
}

// ---------------------------------------------------------------------------------------------- body, outfit and tier gear
function outfit(P, look) {
  const w = WORLDS[look.world], t = look.tier, acc = look._accent, gold = '#f2c14e';
  const suit = look.world === 'cyber' ? '#2a2a3c' : w.suit;
  const torsoD = 'M25 38.4C25 35.6 27.8 34.4 32.2 34.4C36.6 34.4 39.4 35.6 39.4 38.4L40.3 47.4C40.4 48.8 39.4 49.4 38.1 49.4H26.3C25 49.4 24 48.8 24.1 47.4Z';
  let det = '';
  // world outfit details, drawn inside the torso
  if (look.world === 'space') det += `<path d="M24 38.2H40.4V40.4H24Z" fill="${w.trim}" opacity=".9"/><circle cx="36.8" cy="43" r="1.6" fill="#3b5bdb"/><circle cx="36.8" cy="43" r=".7" fill="#fff"/><path d="M24 45.6H40.6V47.4H24Z" fill="#9aa4b8"/>`;
  if (look.world === 'castle') det += `<path d="M29.2 34.4L32.2 40L35.2 34.4" fill="#e9d9b8"/><path d="M29.2 34.4L32.2 40L35.2 34.4" fill="none" stroke="${dark(w.suit, 0.4)}" stroke-width=".6"/><path d="M24 44.6H40.6V46.8H24Z" fill="#5a3a26"/><rect x="31" y="44.4" width="2.6" height="2.6" rx=".5" fill="${w.trim}"/>`;
  if (look.world === 'farm') det += `<path d="M24 34H40.6V40.4Q32.2 39.4 24 40.4Z" fill="${w.trim}"/><path d="M24 36.2H40.6M24 38.4H40.6M28 34V40M32.2 34V40M36.4 34V40" stroke="#8a2a24" stroke-width=".5" opacity=".7"/><path d="M27 40.2H37.6V49.6H27Z" fill="${light(w.suit, 0.08)}"/><path d="M27.4 40.4L25.6 34.8M37.2 40.4L39 34.8" stroke="${w.suit}" stroke-width="1.6"/><circle cx="28" cy="41.2" r=".7" fill="#f2c14e"/><circle cx="36.6" cy="41.2" r=".7" fill="#f2c14e"/><path d="M29.6 43.4H35" stroke="${dark(w.suit, 0.2)}" stroke-width=".6"/>`;
  if (look.world === 'cyber') det += `<path d="M31.4 34.4V49.6" stroke="${acc}" stroke-width=".9"/><path d="M24.2 47.6H40.4" stroke="${acc}" stroke-width=".9"/><path d="M28.6 34.4Q29.6 37.4 31.2 37.8" fill="none" stroke="#3a3a52" stroke-width="1.2"/><path d="M26 41.4L29.4 41.4" stroke="${acc}" stroke-width=".7" opacity=".8"/>`;
  if (look.world === 'alien') det += `<path d="M28.4 34.4L32.2 38.6L36 34.4Z" fill="${acc}"/><path d="M24 40.6H40.6V42.4H24Z" fill="${w.trim}" opacity=".35"/><path d="M34.8 38.6l1.3 -1.6 1.3 1.6 -1.3 1.8Z" fill="${w.trim}"/>`;
  if (look.world === 'ocean') det += `<path d="M24.2 39.2L40.4 36.4V38.4L24.2 41.2Z" fill="${w.trim}"/><path d="M24.2 44.2L40.4 41.4V42.8L24.2 45.6Z" fill="${w.trim}" opacity=".85"/><path d="M29.4 34.6Q32.2 36.4 35 34.6" fill="none" stroke="#0f2238" stroke-width="1"/>`;
  // tier gear over the outfit: 1 a tie, 2 a vest and a pen, 3 a jacket with gold buttons, 4 gold trim and a medallion
  if (t >= 1 && t < 3) det += `<path d="M31.2 35.4H33.2L33.6 36.6L32.9 42.2L32.2 43.4L31.5 42.2L30.8 36.6Z" fill="${acc}" stroke="${dark(acc, 0.45)}" stroke-width=".4"/>`;
  if (t === 0) det += `<path d="M29.6 34.8L31.4 40.2M34.8 34.8L33 40.2" stroke="${acc}" stroke-width=".7"/><rect x="30.4" y="40" width="3.6" height="4.4" rx=".6" fill="#fff" stroke="${OUT}" stroke-width=".4"/><rect x="31" y="40.6" width="2.4" height="1.4" rx=".3" fill="${acc}"/>`;
  const vest = mix(dark(w.jacket, 0.05), acc, 0.3);
  if (t === 2) det += `<path d="M24.2 36.4Q27 35 29.6 35.2L30.4 49.6H24.8Q23.8 49 24 47.4Z" fill="${vest}"/><path d="M40.2 36.4Q37.4 35 34.8 35.2L34 49.6H39.6Q40.6 49 40.4 47.4Z" fill="${vest}"/><path d="M29.6 35.2L30.4 49.6M34.8 35.2L34 49.6" stroke="${light(vest, 0.35)}" stroke-width=".6"/><path d="M26.4 39.4V41.8" stroke="${acc}" stroke-width=".8" stroke-linecap="round"/><circle cx="31.9" cy="46" r=".5" fill="${gold}"/>`;
  const torso = P.part(torsoD, suit, { detail: det });
  const parts = [P.part(rrect(29.3, 31.6, 5.8, 4.8, 1.4), look._neck, { w: 1.4 }), torso];
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
function belt(P, look) { return look.world === 'space' || look.world === 'castle' ? [] : [P.part(rrect(24, 46.6, 16.4, 2.2, 0.8), look.world === 'farm' ? '#3f74b0' : look.world === 'cyber' ? '#1a1a26' : dark(WORLDS[look.world].suit, 0.2), { w: 1, rim: false, detail: `<rect x="31.1" y="46.8" width="2.2" height="1.8" rx=".4" fill="${look.tier >= 3 ? '#f2c14e' : '#c9c9d6'}"/>` })]; }
function leg(P, look, side) {
  const w = WORLDS[look.world], x = side < 0 ? 28.4 : 35.9;
  const legC = look.species === 'skeleton' ? '#efe8da' : look.species === 'robot' ? '#9aa6bd' : w.legs;
  const parts = [P.part(capsule(x, 46.6, x + side * 0.2, 54.2, 2.45, 2.25), legC, { w: 2.4 })];
  if (look.world === 'ocean') parts.push(P.part(`M${x - 3.2 + side * 0.4} 54.2H${x + 2.6 + side * 0.4}Q${x + 5.6 + side * 1.4} 57.4 ${x + 4.6 + side * 1.6} 58.6H${x - 3.4 + side * 0.4}Z`, w.boots, { w: 2.2, detail: `<path d="M${x + side * 0.4} 55.4V58.4M${x + 2.6 + side * 0.6} 55.8L${x + 3.2 + side * 0.8} 58.4" stroke="${dark(w.boots, 0.25)}" stroke-width=".5"/>` }));
  else {
    const bc = look.world === 'cyber' ? '#f0f0f5' : w.boots;
    parts.push(P.part(`M${x - 2.6} 54H${x + 1.6}Q${x + 4.4} 54.4 ${x + 4.5} 57.2V58.2H${x - 2.7}Z`, bc, { w: 2.4, detail: `<path d="M${x - 2.7} 57.1H${x + 4.5}V58.2H${x - 2.7}Z" fill="${look.world === 'cyber' ? look._accent : dark(bc, 0.35)}"/>` + (look.world === 'space' ? `<path d="M${x - 2.6} 55.4H${x + 3.4}" stroke="${w.trim}" stroke-width=".8"/>` : '') }));
  }
  return parts;
}
function arm(P, look, sx, sy, hx, hy) {
  const w = WORLDS[look.world];
  const sleeve = look.tier >= 3 ? (look.tier === 4 ? '#2b2140' : w.jacket) : look.world === 'farm' ? w.trim : look.world === 'cyber' ? '#2a2a3c' : w.suit;
  const hand = look.species === 'skeleton' ? '#efe8da' : look.species === 'robot' ? '#9aa6bd' : look.species === 'fox' ? FUR.fox[0] : look.species === 'grey' ? FUR.grey[0] : look.species === 'octo' ? FUR.octo[0] : SKINS[look.skin % SKINS.length];
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
    case 'stack':
      for (let i = 0; i < 3; i++) parts.push(P.part(`M${-6 + i * 0.4} ${-2.2 - i * 2.2}L${6 + i * 0.3} ${-2.8 - i * 2.2}L${6.4 + i * 0.3} ${-0.6 - i * 2.2}L${-5.6 + i * 0.4} ${0 - i * 2.2}Z`, i === 2 ? '#fbf7ee' : '#ece6d8', { w: 1.2, detail: i === 2 ? `<path d="M-3 -4.8L3 -5.2" stroke="${acc}" stroke-width=".7"/>` : '' }));
      break;
  }
  if (t === 4 && !['phone', 'tablet', 'stack'].includes(kind)) over += sparkle(-3.4, -12.6, 1.3) + sparkle(4.4, -4.6, 0.9);
  return { parts, under, over };
}

// ---------------------------------------------------------------------------------------------- poses
// shoulder and hand points, leg swing, body lift, and where the tool goes
const POSE = {
  idle: { lift: 0, legs: [0, 0], armB: [26.2, 37.6, 23.2, 45.2], armF: [38.2, 37.6, 41.2, 45], toolAt: [41.2, 45, 22], expr: 'smile' },
  walk: { lift: -0.7, legs: [15, -15], armB: [26.2, 37.6, 22.6, 44], armF: [38.2, 37.6, 42.4, 44.2], toolAt: [42.4, 44.2, 36], expr: 'smile' },
  phone: { lift: 0, legs: [0, 0], armB: [26.2, 37.6, 24.2, 45.2], armF: [38.4, 37.2, 45.2, 31.2], toolAt: [45.2, 31.2, -8], expr: 'talk', held: 'phone', stow: true },
  cheer: { lift: -3.2, legs: [-9, 9], armB: [26, 37, 20.2, 28.4], armF: [38.4, 37, 44.2, 28.4], toolAt: [44.2, 28.4, 12], expr: 'grin' },
  type: { lift: 0, legs: [0, 0], armB: [26.2, 37.6, 27.4, 44.2], armF: [38.2, 37.6, 37, 44.2], toolAt: [32.2, 43.2, 0], expr: 'focus', held: 'tablet', both: true, stow: true },
  carry: { lift: -0.5, legs: [18, -20], armB: [26.2, 37.4, 28.6, 42.4], armF: [38.2, 37.4, 36.4, 42.4], toolAt: [32.4, 42.4, 0], expr: 'proud', held: 'stack', both: true, stow: true, lean: 6 },
};

// ---------------------------------------------------------------------------------------------- the figure
function folkSvg(look, opts = {}) {
  if (opts.catalog) return { roles: ROLES, tiers: TIERS, worlds: WORLDS, species: SPECIES, skins: SKINS, hairs: HAIRS, hairColors: HAIR_COLORS, eyeColors: EYE_COLORS, exprs: EXPRS, poses: POSES };
  const L = { role: 'prospector', world: 'space', tier: 0, species: 'human', skin: 1, hair: 0, hairC: 0, eyeC: 0, ...look };
  const role = ROLES[L.role] || ROLES.crew;
  L._accent = L.tint || role.col;
  L._lid = L.species === 'human' ? SKINS[L.skin % SKINS.length] : FUR[L.species] ? FUR[L.species][0] : '#ccc';
  L._neck = L.species === 'human' ? dark(SKINS[L.skin % SKINS.length], 0.12) : L.species === 'robot' ? '#7d879b' : FUR[L.species] ? dark(FUR[L.species][0], 0.12) : '#ccc';
  const agent = L.agent ?? role.agent;
  const id = opts.id || 'folk';
  const pose = POSE[opts.pose] || POSE.idle;
  const mode = L.expr || pose.expr;
  const P = Painter(id);
  const kid = L.role === 'kid';

  const [ax, ay, ahx, ahy] = pose.armB, [fx, fy, fhx, fhy] = pose.armF;
  const aB = arm(P, L, ax, ay, ahx, ahy), aF = arm(P, L, fx, fy, fhx, fhy);
  const head = headParts(P, L, pose, mode);
  const toolKind = pose.held || role.tool;
  const tl = tool(P, L, toolKind);
  const [tx, ty, tr] = pose.toolAt;
  const toolNode = { tf: `translate(${f(tx)} ${f(ty)}) rotate(${tr})`, items: tl.parts, under: tl.under, over: tl.over };

  // the tail and cape go behind everything
  const behind = [];
  if (L.species === 'fox') behind.push(P.part('M26.4 48.6C20.2 49.6 14.2 47.4 11.8 42.2C10.2 38.6 10.8 34.6 13.2 32.6C13.4 36 15.8 38.8 19.4 40C22.4 41 25.4 42.4 27.6 45.4Z', FUR.fox[0], { detail: '<path d="M13.2 32.6C11 34.6 10.2 38.6 12 42.2C12.4 39.6 13.6 37.6 15.8 36.6C14.2 35.6 13.4 34.2 13.2 32.6Z" fill="#fff4ea"/>' }));
  if (L.tier === 4) behind.push(P.part('M25.2 36.2Q20.6 44 21.6 55.6Q32.2 58.4 42.8 55.6Q43.8 44 39.2 36.2Z', '#6a1f3a', { detail: `<path d="M21.8 54.4Q32.2 57.2 42.6 54.4" fill="none" stroke="#f2c14e" stroke-width="1.2"/>` }));

  const legTf = (i, hipX) => pose.legs[i] ? `rotate(${pose.legs[i]} ${hipX} 46.8)` : null;
  const body = G(pose.lean ? `rotate(${pose.lean} 32.2 50)` : null,
    G(null, behind),
    G(null, [aB.sleeve]),
    G(legTf(0, 28.4), leg(P, L, -1)),
    G(legTf(1, 35.9), leg(P, L, 1)),
    G(null, outfit(P, L), belt(P, L)),
    G(null, head.back),
    { ...G(null, head.face), over: head.over },
    G(null, head.front),
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
    const dy = kid ? 6 : 0, top = (L.species === 'grey' ? 7.2 : L.species === 'robot' ? 4 : L.hair % HAIRS.length === 5 && L.species === 'human' ? 3.6 : 6.6) + lift + dy;
    front += `<g transform="translate(32.2 ${f(top - 2)})"><circle r="4.6" fill="${P.radial([[0, L._accent, 0.5], [1, L._accent, 0]])}"/><path d="M0 -3.4L2.1 0L0 3.4L-2.1 0Z" fill="${L._accent}" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/><path d="M0 -3.4L2.1 0H0Z" fill="#fff" opacity=".55"/></g>`;
  }

  const shadowR = opts.pose === 'cheer' ? 9.6 : 12.8;
  const shadow = `<ellipse cx="32.2" cy="58.4" rx="${shadowR}" ry="2.5" fill="${P.radial([[0, '#0a0712', 0.55], [0.6, '#0a0712', 0.25], [1, '#0a0712', 0]])}"/>`;
  const fig = `<g transform="${figTf}"><g>${paintTree(body, 'out')}</g>${paintTree(body, 'fill')}</g>`;
  const mirror = opts.dir === 'l' ? ' transform="matrix(-1 0 0 1 64.4 0)"' : '';
  const vb = opts.crop === 'head' ? '17 5 30.4 30.4' : opts.crop === 'bust' ? '10 1 44.4 44.4' : '-10 -14 84.4 84.4';
  const cls = `folk folk-${L.role} folk-${L.world} folk-t${L.tier} folk-s-${L.species} folk-${opts.pose || 'idle'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="${cls}"><defs>${P.defs()}</defs><g${mirror}>${back}${shadow}${fig}${front}</g></svg>`;
}

const FOLK = { roles: ROLES, tiers: TIERS, worlds: WORLDS, species: SPECIES, skins: SKINS, hairs: HAIRS, hairColors: HAIR_COLORS, eyeColors: EYE_COLORS, exprs: EXPRS, poses: POSES };
if (typeof globalThis !== 'undefined') { globalThis.folkSvg = folkSvg; globalThis.FOLK = FOLK; }
export { folkSvg, FOLK };
