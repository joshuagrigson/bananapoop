// Proxyfolk world maps: the station as an illustrated map in the Code Lab house style (a fat plum outline
// around every building, flat faces lit from the top left, a rim of light on the top edges), one per world.
// The layout is the station's own: the vault in the middle, eight rooms around it, the dock bottom left,
// the comm mast top right, each on a floating slab joined by walkways, nothing underneath.
//
//   mapSvg(world, options) returns an SVG string, 1600 x 1000.
//   world    space castle farm cyber alien ocean haunted pumpkin rocket lab mafia gamer
//   options  { id, rooms: [{ name, accent, id }] (up to 10), hub, dock, level, title, plates }
//            a room with an id (and the vault and dock) gets data-sel="<id>" on its plate and its building, to click

const OUT = '#2a1d33';
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const dark = (c, t) => mix(c, '#1a0f24', t);
const light = (c, t) => mix(c, '#ffffff', t);
const f = (n) => (Math.round(n * 10) / 10).toString();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const W = 1600, H = 1000, U = 104;        // U: pixels per map unit along an iso axis
const OX = 0, OY = 0;
// iso: x runs down-right, y runs down-left, z is straight up in pixels
const iso = (x, y, z = 0) => [OX + (x - y) * U, OY + (x + y) * U * 0.5 - z];
const pts = (a) => a.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
const CELL = 2.15;                          // map units between cell centers

const DEFAULT_ROOMS = [
  { name: 'Ops consulting', accent: '#ffb454' }, { name: 'Show-rate engine', accent: '#4fd1c5' }, { name: 'Call QA', accent: '#a78bfa' },
  { name: 'GBP management', accent: '#4ade80' }, { name: 'Coparent HQ', accent: '#f87171' }, { name: 'Cohort course', accent: '#60a5fa' },
  { name: 'Content studio', accent: '#f472b6' }, { name: 'Freelance desk', accent: '#22d3ee' },
];
const ROOM_CELLS = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [1, 2], [2, 2], [3, 1], [3, 0], [3, 2]];
const HUB = [1, 1], DOCK = [0, 2];
let MAST = [3, 0];

const WORLD = {
  space: { title: 'Space station', sky: ['#070a1c', '#141a3e', '#2a1f4e'], slab: '#8f9ab3', slabTop: '#c9d1e0', edge: '#5d6884', walk: '#aab4c8', hub: 'Treasury', dock: 'Launch pad' },
  castle: { title: 'Dark castle', sky: ['#0d0b1d', '#221a3a', '#3a2346'], slab: '#6d6272', slabTop: '#8e8594', edge: '#4a3f52', walk: '#7a5b3f', hub: 'Treasure vault', dock: 'Scriptorium' },
  farm: { title: 'Farm', sky: ['#7cc8f2', '#a8dcf5', '#d9f1f7'], slab: '#8a6038', slabTop: '#7fcf5a', edge: '#5c3f24', walk: '#b88a52', hub: 'Grain bank', dock: 'Market cart' },
  cyber: { title: 'Cyberpunk city', sky: ['#160c32', '#2c1856', '#621f6a'], slab: '#4a4a68', slabTop: '#5e5e84', edge: '#30304a', walk: '#40405e', hub: 'Data vault', dock: 'Courier hub' },
  alien: { title: 'Alien ship', sky: ['#050b14', '#0c1f2e', '#1a3a3f'], slab: '#3f6b64', slabTop: '#5fa396', edge: '#28463f', walk: '#4f8a7f', hub: 'Core', dock: 'Pod bay' },
  ocean: { title: 'Deep sea base', sky: ['#021526', '#063356', '#0b5a7a'], slab: '#c9b27a', slabTop: '#e6d29a', edge: '#8f7a4a', walk: '#9aa3a8', hub: 'Pearl vault', dock: 'Sub dock' },
  haunted: { title: 'Haunted mansion', sky: ['#05040c', '#1a1228', '#2c1c3a'], slab: '#3a2e3a', slabTop: '#34402e', edge: '#1e161e', walk: '#4a3a3a', hub: 'Family vault', dock: 'Dead letters' },
  pumpkin: { title: 'Pumpkin patch', sky: ['#150a28', '#3a1a44', '#6a2a4a'], slab: '#4a3020', slabTop: '#3a2a1a', edge: '#2a1a10', walk: '#8a6a4a', hub: 'Candy cauldron', dock: 'Hay wagon' },
  rocket: { title: 'Rocket works', sky: ['#1a2a6a', '#6a4a8a', '#ff9a5a'], slab: '#6a5a4a', slabTop: '#9aa1ae', edge: '#3a3028', walk: '#5b6272', hub: 'Launch silo', dock: 'Payload bay' },
  lab: { title: 'Mad scientist lab', sky: ['#07040f', '#1a0c30', '#2a1446'], slab: '#3a3a52', slabTop: '#d8e6e0', edge: '#22223a', walk: '#4a4a62', hub: 'Grand reactor', dock: 'Delivery chute' },
  mafia: { title: 'Family mansion', sky: ['#3a2a5a', '#a05a6a', '#ffb070'], slab: '#8a6a4a', slabTop: '#7a8a4a', edge: '#5a4430', walk: '#c8a878', hub: "The don's office", dock: 'The garage' },
  gamer: { title: 'Game den', sky: ['#0a0428', '#3a0a5a', '#ff3fb8'], slab: '#2a2748', slabTop: '#1a1830', edge: '#12101f', walk: '#3a3660', hub: 'Championship stage', dock: 'Loot drop' },
};

// ---------------------------------------------------------------------------------------------- drawing kit
function Kit(id) {
  let n = 0;
  const defs = [];
  return {
    lin(stops, x2 = 0, y2 = 1) { const g = `${id}-l${++n}`; defs.push(`<linearGradient id="${g}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`); return `url(#${g})`; },
    rad(stops) { const g = `${id}-r${++n}`; defs.push(`<radialGradient id="${g}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</radialGradient>`); return `url(#${g})`; },
    defs: () => defs.join(''),
  };
}
// A shape set drawn in the house style: every polygon/path once fat in the outline color, then each filled,
// with a thin darker line and (for the top faces) a lit rim.
function outlined(shapes, fat = 7) {
  let o = '', fill = '';
  for (const s of shapes) {
    const tag = s.p ? `<polygon points="${pts(s.p)}"` : s.d ? `<path d="${s.d}"` : `<ellipse cx="${f(s.e[0])}" cy="${f(s.e[1])}" rx="${f(s.e[2])}" ry="${f(s.e[3])}"`;
    if (!s.noOut) o += `${tag} fill="${OUT}" stroke="${OUT}" stroke-width="${fat}" stroke-linejoin="round"/>`;
    fill += `${tag} fill="${s.fill}" stroke="${s.line || dark(s.c || '#888888', 0.5)}" stroke-width="${s.lw ?? 1.2}" stroke-linejoin="round"${s.op ? ` opacity="${s.op}"` : ''}/>`;
    if (s.rim && s.p) fill += `<polyline points="${pts(s.rim)}" fill="none" stroke="${light(s.c, 0.6)}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
    if (s.extra) fill += s.extra;
  }
  return `<g>${o}</g><g>${fill}</g>`;
}
// an iso box: its three visible faces
function box(x, y, z, w, d, h, c, o = {}) {
  const A = iso(x, y, z + h), B = iso(x + w, y, z + h), C = iso(x + w, y + d, z + h), D = iso(x, y + d, z + h);
  const B0 = iso(x + w, y, z), C0 = iso(x + w, y + d, z), D0 = iso(x, y + d, z);
  return [
    { p: [D, C, C0, D0], fill: o.left || c, c },                             // front-left face (faces down-left)
    { p: [C, B, B0, C0], fill: o.right || dark(c, 0.28), c: dark(c, 0.28) },  // front-right face
    { p: [A, B, C, D], fill: o.top || light(c, 0.25), c: light(c, 0.25), rim: [D, A, B] },
  ];
}
// a cylinder standing on (cx, cy), radius r (map units), from z to z+h
function cyl(cx, cy, z, r, h, c, o = {}) {
  const [x0, y0] = iso(cx, cy, z), [x1, y1] = iso(cx, cy, z + h);
  const rx = r * U * 1.414, ry = rx * 0.5;
  const side = `M${f(x0 - rx)} ${f(y0)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x0 + rx)} ${f(y0)}L${f(x1 + rx)} ${f(y1)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x1 - rx)} ${f(y1)}Z`;
  return [
    { d: side, fill: o.side || c, c, extra: o.bands || '' },
    { e: [x1, y1, rx, ry], fill: o.top || light(c, 0.25), c: light(c, 0.25) },
  ];
}
// a cone or dome on top of a cylinder
function cone(cx, cy, z, r, h, c) {
  const [x0, y0] = iso(cx, cy, z), [ax, ay] = iso(cx, cy, z + h), rx = r * U * 1.414, ry = rx * 0.5;
  return [{ d: `M${f(x0 - rx)} ${f(y0)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x0 + rx)} ${f(y0)}L${f(ax)} ${f(ay)}Z`, fill: c, c, extra: `<path d="M${f(x0 - rx * 0.55)} ${f(y0 + ry * 0.5)}L${f(ax)} ${f(ay)}" stroke="${light(c, 0.45)}" stroke-width="2" opacity=".6"/>` }];
}
function dome(cx, cy, z, r, c, o = {}) {
  const [x0, y0] = iso(cx, cy, z), rx = r * U * 1.414, ry = rx * 0.5, hh = o.h || rx * 0.95;
  return [{ d: `M${f(x0 - rx)} ${f(y0)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x0 + rx)} ${f(y0)}C${f(x0 + rx)} ${f(y0 - hh * 1.3)} ${f(x0 - rx)} ${f(y0 - hh * 1.3)} ${f(x0 - rx)} ${f(y0)}Z`, fill: o.fill || c, c, op: o.op, extra: o.extra || `<path d="M${f(x0 - rx * 0.6)} ${f(y0 - hh * 0.5)}Q${f(x0 - rx * 0.4)} ${f(y0 - hh * 0.85)} ${f(x0)} ${f(y0 - hh * 0.92)}" fill="none" stroke="#fff" stroke-width="3" opacity=".45" stroke-linecap="round"/>` }];
}
// a window on a box face: t along the face (0-1), at height z; side 'L' (front-left face) or 'R'
function win(x, y, w, d, side, t, z, ww, wh, col, frame = OUT) {
  let a, b;
  if (side === 'L') { a = iso(x + w * t - ww / 2, y + d, z); b = iso(x + w * t + ww / 2, y + d, z); }
  else { a = iso(x + w, y + d * t - ww / 2, z); b = iso(x + w, y + d * t + ww / 2, z); }
  const q = [a, b, [b[0], b[1] - wh], [a[0], a[1] - wh]];
  return `<polygon points="${pts(q)}" fill="${col}" stroke="${frame}" stroke-width="2" stroke-linejoin="round"/>`;
}

// ---------------------------------------------------------------------------------------------- slabs and walkways
function slab(k, wd, cx, cy, s = 0.62) {
  const x = cx - s, y = cy - s, w = s * 2, d = s * 2, T = 22;
  const top = [iso(x, y, 0), iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x, y + d, 0)];
  const shapes = box(x, y, -T, w, d, T, wd.slab, { top: wd.slabTop });
  // what hangs under it: a rocky taper, a thruster, coral
  const [bx, by] = iso(cx + s, cy + s, -T), [lx, ly] = iso(x, y + d, -T), [rx2, ry2] = iso(x + w, y, -T);
  const under = k === 'space' || k === 'cyber' ? `M${f(lx)} ${f(ly)}L${f(bx)} ${f(by)}L${f(rx2)} ${f(ry2)}L${f(bx)} ${f(by + 26)}Z` : `M${f(lx)} ${f(ly)}L${f(bx)} ${f(by)}L${f(rx2)} ${f(ry2)}Q${f(bx + 40)} ${f(by + 40)} ${f(bx)} ${f(by + 70)}Q${f(bx - 40)} ${f(by + 40)} ${f(lx)} ${f(ly)}Z`;
  let s2 = outlined([{ d: under, fill: dark(wd.slab, 0.35), c: dark(wd.slab, 0.35) }, ...shapes], 7);
  if (k === 'space' || k === 'cyber') s2 += `<ellipse cx="${f(bx)}" cy="${f(by + 30)}" rx="9" ry="5" fill="${k === 'space' ? '#7fd8ff' : '#ff5ce0'}" opacity=".7"/><ellipse cx="${f(bx)}" cy="${f(by + 44)}" rx="5" ry="14" fill="${k === 'space' ? '#7fd8ff' : '#ff5ce0'}" opacity=".25"/>`;
  // a touch of texture on the top
  const tx = { farm: '#6bbf49', castle: '#7d7483', space: '#b3bccd', cyber: '#56567a', alien: '#6fb8a8', ocean: '#d9c386', haunted: '#4a5a3a', pumpkin: '#3f8a3a', rocket: '#c9ced8', lab: '#7dff4a', mafia: '#5a7a3a', gamer: '#39ff9e' }[k];
  for (let i = 0; i < 5; i++) { const [px, py] = iso(x + 0.25 + ((i * 0.37) % 1) * (w - 0.5), y + 0.3 + ((i * 0.61) % 1) * (d - 0.6), 0); s2 += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="7" ry="3" fill="${tx}" opacity=".7"/>`; }
  if (k === 'cyber') s2 += `<polygon points="${pts(top)}" fill="none" stroke="#ff5ce0" stroke-width="1.5" opacity=".55"/>`;
  return s2;
}
function walkway(k, wd, a, b) {
  const [ax, ay] = a, [bx, by] = b, horiz = ay === by;
  const w = 0.16, gap = 0.62;
  const x0 = horiz ? Math.min(ax, bx) + gap : ax - w, y0 = horiz ? ay - w : Math.min(ay, by) + gap;
  const len = CELL - gap * 2;
  const shapes = horiz ? box(x0, y0, -8, len, w * 2, 8, wd.walk) : box(x0, y0, -8, w * 2, len, 8, wd.walk);
  return outlined(shapes, 5);
}

// ---------------------------------------------------------------------------------------------- buildings
function building(k, cx, cy, acc, rank, K) {
  const s = [];
  let extra = '';
  if (k === 'castle') {
    const x = cx - 0.34, y = cy - 0.34, w = 0.68, h = 92, stone = '#8a8294';
    s.push(...box(x, y, 0, w, w, h, stone));
    for (const [i, j] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) if (!(i === 0 && j === 0)) s.push(...box(x + i * w + 0.02, y + j * w + 0.02, h, 0.14, 0.14, 12, stone));
    s.push(...cone(cx + 0.06, cy + 0.06, h, 0.3, 84, dark(acc, 0.25)));
    const [fx, fy] = iso(cx + 0.06, cy + 0.06, h + 84);
    extra += `<path d="M${f(fx)} ${f(fy)}V${f(fy - 34)}" stroke="${OUT}" stroke-width="3"/><path d="M${f(fx)} ${f(fy - 34)}L${f(fx + 30)} ${f(fy - 27)}L${f(fx)} ${f(fy - 18)}Z" fill="${acc}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>`;
    extra += win(x, y, w, w, 'L', 0.5, 0, 0.18, 34, '#3a2a2a') + win(x, y, w, w, 'L', 0.5, 50, 0.1, 20, '#ffd66b') + win(x, y, w, w, 'R', 0.35, 50, 0.1, 20, '#ffd66b') + win(x, y, w, w, 'R', 0.75, 50, 0.1, 20, '#ffd66b');
  } else if (k === 'farm') {
    const x = cx - 0.36, y = cy - 0.3, w = 0.72, d = 0.6, h = 58, wall = acc;
    s.push(...box(x, y, 0, w, d, h, wall));
    // a gable roof along x
    const r1 = iso(x - 0.05, y - 0.05, h), r2 = iso(x + w + 0.05, y - 0.05, h), r3 = iso(x + w + 0.05, y + d + 0.05, h), r4 = iso(x - 0.05, y + d + 0.05, h);
    const ridgeA = iso(x - 0.05, y + d / 2, h + 44), ridgeB = iso(x + w + 0.05, y + d / 2, h + 44);
    s.push({ p: [r4, r3, ridgeB, ridgeA], fill: '#8a3a2e', c: '#8a3a2e', rim: [ridgeA, ridgeB] });
    s.push({ p: [r3, r2, ridgeB], fill: '#6e2b24', c: '#6e2b24' });
    const dL = iso(x + w * 0.3, y + d, 0), dR = iso(x + w * 0.7, y + d, 0);
    extra += `<polygon points="${pts([dL, dR, [dR[0], dR[1] - 38], [dL[0], dL[1] - 38]])}" fill="#f4ecd8" stroke="${OUT}" stroke-width="2.4"/><path d="M${f(dL[0])} ${f(dL[1])}L${f(dR[0])} ${f(dR[1] - 38)}M${f(dR[0])} ${f(dR[1])}L${f(dL[0])} ${f(dL[1] - 38)}" stroke="${dark(acc, 0.2)}" stroke-width="3"/>`;
    extra += win(x, y, w, d, 'R', 0.5, 30, 0.14, 16, '#ffe9a0');
    if (rank % 3 === 0) s.push(...cyl(x + w + 0.1, y + 0.12, 0, 0.13, 96, '#c9ced6', { bands: '' }), ...dome(x + w + 0.1, y + 0.12, 96, 0.13, '#9aa4b2'));
  } else if (k === 'space') {
    s.push(...cyl(cx, cy, 0, 0.32, 70, '#e3e8f2', { bands: '' }));
    s.push(...dome(cx, cy, 70, 0.32, '#e3e8f2', { h: 38, extra: '' }));
    const [px, py] = iso(cx, cy, 30), rx = 0.32 * U * 1.414;
    extra += `<path d="M${f(px - rx)} ${f(py + 8)}A${f(rx)} ${f(rx / 2)} 0 0 0 ${f(px + rx)} ${f(py + 8)}" fill="none" stroke="${acc}" stroke-width="7"/>`;
    for (const t of [-0.45, 0, 0.45]) extra += `<circle cx="${f(px + t * rx)}" cy="${f(py - 14 + Math.abs(t) * -6 + 12)}" r="7" fill="#8fe3ff" stroke="${OUT}" stroke-width="2.4"/>`;
    // solar wings
    const [wx, wy] = iso(cx + 0.36, cy - 0.1, 56);
    extra += `<g stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"><path d="M${f(wx)} ${f(wy)}L${f(wx + 60)} ${f(wy - 28)}" /><polygon points="${f(wx + 34)},${f(wy - 30)} ${f(wx + 86)},${f(wy - 56)} ${f(wx + 90)},${f(wy - 40)} ${f(wx + 38)},${f(wy - 14)}" fill="#2f4f9e"/></g><path d="M${f(wx + 50)} ${f(wy - 35)}L${f(wx + 60)} ${f(wy - 22)}M${f(wx + 66)} ${f(wy - 43)}L${f(wx + 76)} ${f(wy - 30)}" stroke="#7fb0ff" stroke-width="1.5"/>`;
  } else if (k === 'cyber') {
    const x = cx - 0.3, y = cy - 0.3, w = 0.6, h = 110 + (rank % 3) * 26;
    s.push(...box(x, y, 0, w, w, h, '#4a4468'));
    for (let r = 0; r < 4; r++) for (const t of [0.25, 0.5, 0.75]) extra += win(x, y, w, w, 'L', t, 18 + r * ((h - 30) / 4), 0.09, 12, (r + t * 4) % 3 < 1 ? acc : '#ffe38a', '#1a1428') + win(x, y, w, w, 'R', t, 18 + r * ((h - 30) / 4), 0.09, 12, (r * 2 + t * 3) % 3 < 1 ? '#6ff' : '#2a2438', '#1a1428');
    const A = iso(x, y + w, h), B = iso(x + w, y + w, h), C = iso(x + w, y, h);
    extra += `<polyline points="${pts([A, B, C])}" fill="none" stroke="${acc}" stroke-width="3"/>`;
    const [sx, sy] = iso(cx - 0.05, cy + 0.3, h + 6);
    extra += `<rect x="${f(sx - 34)}" y="${f(sy - 34)}" width="68" height="26" rx="6" fill="#140f22" stroke="${OUT}" stroke-width="3"/><rect x="${f(sx - 30)}" y="${f(sy - 30)}" width="60" height="18" rx="4" fill="none" stroke="${acc}" stroke-width="2.4"/><circle cx="${f(sx)}" cy="${f(sy - 21)}" r="22" fill="${K.rad([[0, acc, 0.35], [1, acc, 0]])}"/>`;
    const [ax2, ay2] = iso(x + w * 0.8, y + 0.1, h);
    extra += `<path d="M${f(ax2)} ${f(ay2)}V${f(ay2 - 40)}" stroke="${OUT}" stroke-width="3"/><circle cx="${f(ax2)}" cy="${f(ay2 - 42)}" r="4" fill="#ff4a6a" stroke="${OUT}" stroke-width="2"/>`;
  } else if (k === 'alien') {
    const [bx, by] = iso(cx, cy, 0);
    const stalk = { d: `M${f(bx - 14)} ${f(by)}Q${f(bx - 8)} ${f(by - 40)} ${f(bx - 18)} ${f(by - 60)}H${f(bx + 18)}Q${f(bx + 8)} ${f(by - 40)} ${f(bx + 14)} ${f(by)}Z`, fill: '#3f7f73', c: '#3f7f73' };
    const bulb = { d: `M${f(bx)} ${f(by - 150)}C${f(bx + 64)} ${f(by - 150)} ${f(bx + 70)} ${f(by - 70)} ${f(bx + 24)} ${f(by - 56)}H${f(bx - 24)}C${f(bx - 70)} ${f(by - 70)} ${f(bx - 64)} ${f(by - 150)} ${f(bx)} ${f(by - 150)}Z`, fill: K.lin([[0, light('#6fc7b5', 0.25)], [1, '#3f8f80']], 0.3, 1), c: '#5fa396' };
    s.push(stalk, bulb);
    extra += `<ellipse cx="${f(bx)}" cy="${f(by - 100)}" rx="30" ry="22" fill="${acc}" opacity=".85" stroke="${OUT}" stroke-width="2.4"/><ellipse cx="${f(bx - 8)}" cy="${f(by - 108)}" rx="10" ry="6" fill="#fff" opacity=".5"/>`;
    for (const [dx, dy, r] of [[-40, -120, 5], [38, -126, 4], [44, -86, 5], [-46, -84, 4]]) extra += `<circle cx="${f(bx + dx)}" cy="${f(by + dy)}" r="${r}" fill="${light(acc, 0.4)}" opacity=".9"/>`;
    extra += `<path d="M${f(bx - 20)} ${f(by - 148)}Q${f(bx - 34)} ${f(by - 176)} ${f(bx - 16)} ${f(by - 186)}M${f(bx + 16)} ${f(by - 148)}Q${f(bx + 30)} ${f(by - 170)} ${f(bx + 22)} ${f(by - 184)}" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><circle cx="${f(bx - 16)}" cy="${f(by - 188)}" r="5" fill="${acc}" stroke="${OUT}" stroke-width="2"/><circle cx="${f(bx + 22)}" cy="${f(by - 186)}" r="5" fill="${acc}" stroke="${OUT}" stroke-width="2"/>`;
  } else if (k === 'haunted') {
    // a tall, narrow house with a steep roof and a turret; a light on in some windows
    const x = cx - 0.32, y = cy - 0.26, w = 0.56, d = 0.5, h = 84;
    s.push(...box(x, y, 0, w, d, h, '#4a3e52'));
    const r2 = iso(x + w + 0.04, y - 0.04, h), r3 = iso(x + w + 0.04, y + d + 0.04, h), r4 = iso(x - 0.04, y + d + 0.04, h);
    const ridgeA = iso(x - 0.04, y + d / 2, h + 70), ridgeB = iso(x + w + 0.04, y + d / 2, h + 70);
    s.push({ p: [r4, r3, ridgeB, ridgeA], fill: '#2a2230', c: '#2a2230', rim: [ridgeA, ridgeB] }, { p: [r3, r2, ridgeB], fill: '#1e1826', c: '#1e1826' });
    s.push(...cyl(x + w, y + d * 0.25, 0, 0.12, h + 26, '#443850'), ...cone(x + w, y + d * 0.25, h + 26, 0.17, 64, '#2a2230'));
    for (const [t, z] of [[0.25, 52], [0.75, 52], [0.25, 20]]) extra += win(x, y, w, d, 'L', t, z, 0.1, 22, (rank + t * 4 + z) % 3 < 1 ? '#b8ffb0' : '#1a1422');
    extra += win(x, y, w, d, 'R', 0.6, 52, 0.1, 22, rank % 2 ? '#ffd66b' : '#1a1422') + win(x, y, w, d, 'L', 0.72, 0, 0.14, 30, acc);
    const [bx, by] = iso(cx + 0.1, cy - 0.3, h + 96);
    extra += `<path d="M${f(bx)} ${f(by)}q10 -10 20 0q10 -10 20 0q-10 4 -20 12q-10 -8 -20 -12Z" fill="#0a0612"/>`;
  } else if (k === 'pumpkin') {
    // a carved pumpkin with a door in its side and a light inside
    const [a, b] = iso(cx, cy, 0), R = 62 + (rank % 3) * 6;
    extra += `<circle cx="${f(a)}" cy="${f(b - R * 0.7)}" r="${f(R * 1.6)}" fill="${K.rad([[0, '#ffb000', 0.35], [1, '#ffb000', 0]])}"/>`;
    s.push({ d: `M${f(a - R)} ${f(b - R * 0.6)}Q${f(a - R)} ${f(b)} ${f(a)} ${f(b)}Q${f(a + R)} ${f(b)} ${f(a + R)} ${f(b - R * 0.6)}Q${f(a + R)} ${f(b - R * 1.3)} ${f(a)} ${f(b - R * 1.3)}Q${f(a - R)} ${f(b - R * 1.3)} ${f(a - R)} ${f(b - R * 0.6)}Z`, fill: '#f07a1a', c: '#f07a1a' });
    for (const dx of [-0.5, 0, 0.5]) extra += `<path d="M${f(a + dx * R)} ${f(b - R * 1.25)}Q${f(a + dx * R * 1.5)} ${f(b - R * 0.6)} ${f(a + dx * R)} ${f(b - 4)}" fill="none" stroke="#c85a0a" stroke-width="3"/>`;
    extra += `<path d="M${f(a - R * 0.5)} ${f(b - R * 0.85)}l${f(R * 0.2)} ${f(-R * 0.22)}l${f(R * 0.2)} ${f(R * 0.22)}zM${f(a + R * 0.1)} ${f(b - R * 0.85)}l${f(R * 0.2)} ${f(-R * 0.22)}l${f(R * 0.2)} ${f(R * 0.22)}z" fill="#ffe94a" stroke="${OUT}" stroke-width="2.4"/>`;
    extra += `<path d="M${f(a - R * 0.55)} ${f(b - R * 0.45)}l${f(R * 0.18)} ${f(R * 0.14)}l${f(R * 0.18)} ${f(-R * 0.1)}l${f(R * 0.18)} ${f(R * 0.14)}l${f(R * 0.18)} ${f(-R * 0.1)}l${f(R * 0.18)} ${f(R * 0.14)}l${f(R * 0.02)} ${f(-R * 0.18)}q${f(-R * 0.55)} ${f(R * 0.2)} ${f(-R * 1.1)} 0z" fill="#ffe94a" stroke="${OUT}" stroke-width="2.4"/>`;
    extra += `<path d="M${f(a - 4)} ${f(b - R * 1.25)}q-4 -20 10 -28" fill="none" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/><path d="M${f(a - 4)} ${f(b - R * 1.25)}q-4 -20 10 -28" fill="none" stroke="#3f6a2a" stroke-width="8" stroke-linecap="round"/>`;
    extra += `<rect x="${f(a + R * 0.5)}" y="${f(b - R * 0.5)}" width="${f(R * 0.28)}" height="${f(R * 0.46)}" rx="${f(R * 0.14)}" fill="${acc}" stroke="${OUT}" stroke-width="3"/>`;
  } else if (k === 'rocket') {
    // a white hangar with an orange stripe, a rocket's nose showing over the roof
    const x = cx - 0.36, y = cy - 0.3, w = 0.72, d = 0.6, h = 64;
    s.push(...box(x, y, 0, w, d, h, '#e3e7ee'));
    s.push(...cyl(x + w * 0.7, y + d * 0.4, h, 0.1, 70 + (rank % 3) * 14, '#f4f6fb', { bands: '' }), ...cone(x + w * 0.7, y + d * 0.4, h + 70 + (rank % 3) * 14, 0.1, 34, '#ff6a1a'));
    const A = iso(x, y + d, 34), B = iso(x + w, y + d, 34), C = iso(x + w, y, 34);
    extra += `<polyline points="${pts([A, B, C])}" fill="none" stroke="#ff6a1a" stroke-width="5"/>`;
    extra += win(x, y, w, d, 'L', 0.5, 0, 0.34, 40, '#2a2f3c') + win(x, y, w, d, 'R', 0.4, 44, 0.12, 12, acc);
  } else if (k === 'lab') {
    // a stone lab with a glass dome glowing green, a chimney puffing color
    const x = cx - 0.32, y = cy - 0.3, w = 0.64, d = 0.6, h = 60;
    s.push(...box(x, y, 0, w, d, h, '#5a5a74'));
    s.push(...dome(cx, cy, h, 0.28, '#9aff7a', { h: 40 }));
    s.push(...cyl(x + w - 0.08, y + 0.08, h, 0.06, 40, '#4a4a62', { bands: '' }));
    const [px2, py2] = iso(x + w - 0.08, y + 0.08, h + 44);
    extra += `<circle cx="${f(px2)}" cy="${f(py2 - 8)}" r="10" fill="${acc}" opacity=".6"/><circle cx="${f(px2 + 8)}" cy="${f(py2 - 24)}" r="13" fill="#ff4fb8" opacity=".45"/>`;
    extra += win(x, y, w, d, 'L', 0.3, 18, 0.1, 22, '#9aff7a') + win(x, y, w, d, 'L', 0.72, 18, 0.1, 22, '#39f0ff') + win(x, y, w, d, 'R', 0.5, 18, 0.12, 22, '#ff4fb8');
  } else if (k === 'mafia') {
    // a villa: ochre walls, a terracotta roof, arched windows lit warm
    const x = cx - 0.38, y = cy - 0.3, w = 0.76, d = 0.6, h = 54;
    s.push(...box(x, y, 0, w, d, h, '#e0c08a'));
    const r2 = iso(x + w + 0.05, y - 0.05, h), r3 = iso(x + w + 0.05, y + d + 0.05, h), r4 = iso(x - 0.05, y + d + 0.05, h), r1 = iso(x - 0.05, y - 0.05, h), top = iso(cx, cy, h + 30);
    s.push({ p: [r4, r3, top], fill: '#b8563a', c: '#b8563a' }, { p: [r3, r2, top], fill: '#9a4430', c: '#9a4430' }, { p: [r1, r4, top], fill: '#c8664a', c: '#c8664a' });
    for (const t of [0.2, 0.5, 0.8]) extra += win(x, y, w, d, 'L', t, 10, 0.1, 26, '#ffd98a');
    extra += win(x, y, w, d, 'R', 0.5, 10, 0.12, 26, acc);
  } else if (k === 'gamer') {
    // a dark block wrapped in RGB, a giant screen on its face
    const x = cx - 0.32, y = cy - 0.32, w = 0.64, h = 90 + (rank % 3) * 20;
    s.push(...box(x, y, 0, w, w, h, '#2a2748'));
    const cols = ['#39ff9e', '#29e7ff', '#9a5cff', '#ff3fb8'];
    for (let r = 0; r < 3; r++) { const A = iso(x, y + w, 20 + r * (h - 30) / 3), B = iso(x + w, y + w, 20 + r * (h - 30) / 3), C = iso(x + w, y, 20 + r * (h - 30) / 3); extra += `<polyline points="${pts([A, B, C])}" fill="none" stroke="${cols[(r + rank) % 4]}" stroke-width="4"/>`; }
    extra += win(x, y, w, w, 'L', 0.5, h * 0.45, 0.4, 36, acc, '#12101f');
  } else if (k === 'ocean') {
    s.push(...cyl(cx, cy, 0, 0.36, 18, '#8a95a3'));
    const [x0, y0] = iso(cx, cy, 18), rx = 0.36 * U * 1.414;
    s.push({ d: `M${f(x0 - rx)} ${f(y0)}A${f(rx)} ${f(rx / 2)} 0 0 0 ${f(x0 + rx)} ${f(y0)}C${f(x0 + rx)} ${f(y0 - rx * 1.25)} ${f(x0 - rx)} ${f(y0 - rx * 1.25)} ${f(x0 - rx)} ${f(y0)}Z`, fill: K.lin([[0, '#bff3ff', 0.75], [1, '#4fc3e8', 0.55]], 0.3, 1), c: '#7fd8f0', line: '#1b5f7a' });
    extra += `<ellipse cx="${f(x0)}" cy="${f(y0 - 18)}" rx="${f(rx * 0.55)}" ry="${f(rx * 0.3)}" fill="${acc}" opacity=".85" stroke="${OUT}" stroke-width="2"/><path d="M${f(x0 - rx * 0.6)} ${f(y0 - rx * 0.5)}Q${f(x0 - rx * 0.4)} ${f(y0 - rx * 0.85)} ${f(x0)} ${f(y0 - rx * 0.92)}" fill="none" stroke="#fff" stroke-width="4" opacity=".6" stroke-linecap="round"/>`;
    for (let i = 0; i < 4; i++) extra += `<circle cx="${f(x0 + rx * 0.5 + i * 5)}" cy="${f(y0 - rx - 20 - i * 22)}" r="${4 + i}" fill="none" stroke="#dff7ff" stroke-width="1.6" opacity=".7"/>`;
  }
  return outlined(s, 7) + extra;
}
// the vault: a gold dome with a $ door, the same in every world, on a base in that world's stone
function vault(k, wd, K) {
  const [cx, cy] = [HUB[0] * CELL, HUB[1] * CELL];
  const base = { space: '#c9d1e0', castle: '#8a8294', farm: '#c9a46a', cyber: '#4a4468', alien: '#4f8a7f', ocean: '#b8a570', haunted: '#3a2e3a', pumpkin: '#5a3a20', rocket: '#9aa1ae', lab: '#5a5a74', mafia: '#8a5a3a', gamer: '#2a2748' }[k];
  const s = [...cyl(cx, cy, 0, 0.44, 34, base), ...cyl(cx, cy, 34, 0.36, 40, '#f2c14e', { bands: '' }), ...dome(cx, cy, 74, 0.36, '#f2c14e', { h: 46 })];
  const [dx, dy] = iso(cx + 0.36, cy + 0.36, 34);
  let extra = `<path d="M${f(dx - 18)} ${f(dy)}V${f(dy - 26)}A18 18 0 0 1 ${f(dx + 18)} ${f(dy - 26)}V${f(dy)}Z" fill="#7a5410" stroke="${OUT}" stroke-width="3"/><text x="${f(dx)}" y="${f(dy - 12)}" font-size="26" font-weight="900" text-anchor="middle" fill="#ffe27a" font-family="Arial Black, Arial, sans-serif">$</text>`;
  const [tx, ty] = iso(cx, cy, 128);
  extra += `<circle cx="${f(tx)}" cy="${f(ty)}" r="60" fill="${K.rad([[0, '#ffe27a', 0.45], [1, '#ffe27a', 0]])}"/><path d="M${f(tx)} ${f(ty - 22)}L${f(tx + 13)} ${f(ty)}L${f(tx)} ${f(ty + 22)}L${f(tx - 13)} ${f(ty)}Z" fill="#ffd84d" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/><path d="M${f(tx)} ${f(ty - 22)}L${f(tx + 13)} ${f(ty)}H${f(tx)}Z" fill="#fff" opacity=".5"/>`;
  // coin piles on the slab
  for (const [ox, oy] of [[-0.45, 0.2], [0.25, -0.45], [0.42, 0.18]]) { const [px, py] = iso(cx + ox, cy + oy, 0); for (let i = 0; i < 3; i++) extra += `<ellipse cx="${f(px)}" cy="${f(py - i * 5)}" rx="12" ry="5" fill="#f2c14e" stroke="${OUT}" stroke-width="2"/>`; }
  return outlined(s, 7) + extra;
}
function dock(k, wd, K) {
  const [cx, cy] = [DOCK[0] * CELL, DOCK[1] * CELL];
  const s = [...box(cx - 0.4, cy - 0.3, 0, 0.8, 0.6, 14, dark(wd.walk, 0.1))];
  let extra = '';
  const [px, py] = iso(cx, cy, 14);
  const craft = {
    space: `<path d="M${px - 46} ${py - 10}Q${px - 10} ${py - 66} ${px + 44} ${py - 30}Q${px + 56} ${py - 14} ${px + 36} ${py - 6}Z" fill="#e3e8f2"/><circle cx="${px + 10}" cy="${py - 34}" r="9" fill="#8fe3ff" stroke="${OUT}" stroke-width="2.4"/><path d="M${px - 44} ${py - 10}L${px - 64} ${py - 2}L${px - 44} ${py - 24}Z" fill="#ff8a3d"/>`,
    castle: `<rect x="${px - 30}" y="${py - 70}" width="60" height="58" rx="6" fill="#6a4a36"/><path d="M${px - 36} ${py - 70}L${px} ${py - 96}L${px + 36} ${py - 70}Z" fill="#4a2e40"/><rect x="${px - 12}" y="${py - 44}" width="24" height="30" rx="10" fill="#ffd66b"/>`,
    farm: `<rect x="${px - 44}" y="${py - 48}" width="80" height="34" rx="6" fill="#c8453a"/><path d="M${px - 48} ${py - 48}Q${px - 4} ${py - 86} ${px + 40} ${py - 48}Z" fill="#f4ecd8"/><circle cx="${px - 26}" cy="${py - 12}" r="12" fill="#7a4a2a"/><circle cx="${px + 22}" cy="${py - 12}" r="12" fill="#7a4a2a"/>`,
    cyber: `<path d="M${px - 50} ${py - 18}L${px - 34} ${py - 52}H${px + 34}L${px + 50} ${py - 18}Z" fill="#2a2440"/><rect x="${px - 28}" y="${py - 48}" width="56" height="18" rx="4" fill="#ff5ce0" opacity=".85"/><circle cx="${px - 30}" cy="${py - 14}" r="9" fill="#6ff"/><circle cx="${px + 30}" cy="${py - 14}" r="9" fill="#6ff"/>`,
    alien: `<ellipse cx="${px}" cy="${py - 34}" rx="54" ry="20" fill="#6fc7b5"/><ellipse cx="${px}" cy="${py - 48}" rx="24" ry="16" fill="#bff3e6" opacity=".9"/><circle cx="${px - 30}" cy="${py - 30}" r="5" fill="#ffe27a"/><circle cx="${px}" cy="${py - 24}" r="5" fill="#ffe27a"/><circle cx="${px + 30}" cy="${py - 30}" r="5" fill="#ffe27a"/>`,
    haunted: `<rect x="${px - 44}" y="${py - 64}" width="88" height="48" rx="6" fill="#16121a"/><rect x="${px - 30}" y="${py - 56}" width="34" height="24" rx="3" fill="#b8ffb0" opacity=".5"/><circle cx="${px - 30}" cy="${py - 12}" r="13" fill="none" stroke-width="5"/><circle cx="${px + 30}" cy="${py - 12}" r="13" fill="none" stroke-width="5"/><circle cx="${px + 46}" cy="${py - 60}" r="6" fill="#9dff8a"/>`,
    pumpkin: `<rect x="${px - 46}" y="${py - 46}" width="92" height="30" rx="6" fill="#8a5a32"/><path d="M${px - 44} ${py - 46}Q${px - 6} ${py - 80} ${px + 40} ${py - 46}Z" fill="#e6c25a"/><ellipse cx="${px + 4}" cy="${py - 56}" rx="18" ry="14" fill="#f07a1a"/><circle cx="${px - 26}" cy="${py - 12}" r="12" fill="#4a2f1b"/><circle cx="${px + 26}" cy="${py - 12}" r="12" fill="#4a2f1b"/>`,
    rocket: `<rect x="${px - 40}" y="${py - 50}" width="80" height="38" rx="4" fill="#e3e7ee"/><rect x="${px - 40}" y="${py - 30}" width="80" height="6" fill="#ff6a1a"/><circle cx="${px - 24}" cy="${py - 12}" r="9" fill="#2a2f3c"/><circle cx="${px + 24}" cy="${py - 12}" r="9" fill="#2a2f3c"/>`,
    lab: `<rect x="${px - 34}" y="${py - 70}" width="68" height="58" rx="8" fill="#4a4a62"/><circle cx="${px}" cy="${py - 46}" r="16" fill="#9aff7a" opacity=".85"/><rect x="${px - 6}" y="${py - 84}" width="12" height="18" fill="#8a95a8"/>`,
    mafia: `<rect x="${px - 50}" y="${py - 44}" width="100" height="26" rx="10" fill="#1a1418"/><rect x="${px - 30}" y="${py - 62}" width="56" height="22" rx="8" fill="#1a1418"/><rect x="${px - 26}" y="${py - 58}" width="22" height="14" rx="3" fill="#bfd8f0"/><circle cx="${px - 30}" cy="${py - 16}" r="9" fill="#2a2a30"/><circle cx="${px + 30}" cy="${py - 16}" r="9" fill="#2a2a30"/><rect x="${px + 40}" y="${py - 40}" width="10" height="6" fill="#e0b454"/>`,
    gamer: `<rect x="${px - 40}" y="${py - 60}" width="80" height="44" rx="8" fill="#2a2748"/><path d="M${px - 16} ${py - 50}V${py - 26}L${px + 16} ${py - 38}Z" fill="#39ff9e"/><rect x="${px - 44}" y="${py - 64}" width="88" height="52" rx="10" fill="none" stroke="#ff3fb8" stroke-width="3"/>`,
    ocean: `<ellipse cx="${px}" cy="${py - 34}" rx="50" ry="24" fill="#ffd23f"/><circle cx="${px + 14}" cy="${py - 38}" r="11" fill="#8fe3ff" stroke="${OUT}" stroke-width="2.4"/><path d="M${px - 48} ${py - 36}L${px - 70} ${py - 52}V${py - 20}Z" fill="#ffb300"/><rect x="${px - 8}" y="${py - 72}" width="8" height="18" fill="#ffd23f"/>`,
  }[k];
  extra += `<g stroke="${OUT}" stroke-width="3" stroke-linejoin="round">${craft}</g>`;
  return outlined(s, 7) + extra;
}
function mast(k, K) {
  const [cx, cy] = [MAST[0] * CELL - 0.2, MAST[1] * CELL - 0.3];
  const [bx, by] = iso(cx, cy, 0), top = by - 190;
  let s = `<g stroke="${OUT}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"><path d="M${bx - 22} ${by}L${bx} ${top}L${bx + 22} ${by}"/></g><g stroke="#9aa4b8" stroke-width="3.4" stroke-linecap="round"><path d="M${bx - 22} ${by}L${bx} ${top}L${bx + 22} ${by}M${bx - 16} ${by - 50}H${bx + 16}M${bx - 10} ${by - 100}H${bx + 10}M${bx - 16} ${by - 50}L${bx + 10} ${by - 100}"/></g>`;
  s += `<g stroke="${OUT}" stroke-width="3" stroke-linejoin="round"><ellipse cx="${bx + 4}" cy="${top + 18}" rx="26" ry="16" transform="rotate(-25 ${bx + 4} ${top + 18})" fill="#e3e8f2"/><circle cx="${bx}" cy="${top - 4}" r="6" fill="#4ade80"/></g><circle cx="${bx}" cy="${top - 4}" r="22" fill="${K.rad([[0, '#4ade80', 0.45], [1, '#4ade80', 0]])}"/>`;
  for (const r of [34, 52, 70]) s += `<path d="M${bx + r * 0.7} ${top - r * 0.7}A${r} ${r} 0 0 1 ${bx + r} ${top}" fill="none" stroke="#4ade80" stroke-width="3" opacity="${1 - r / 90}" stroke-linecap="round"/>`;
  return s;
}

// ---------------------------------------------------------------------------------------------- skies
function sky(k, wd, K) {
  let s = `<rect width="${W}" height="${H}" fill="${K.lin([[0, wd.sky[0]], [0.55, wd.sky[1]], [1, wd.sky[2]]])}"/>`;
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  if (k === 'space' || k === 'cyber' || k === 'castle' || k === 'alien' || k === 'haunted' || k === 'pumpkin' || k === 'rocket' || k === 'lab' || k === 'gamer' || k === 'mafia') for (let i = 0; i < 140; i++) s += `<circle cx="${f(rnd(i) * W)}" cy="${f(rnd(i + 500) * H * (k === 'cyber' ? 0.45 : 0.9))}" r="${f(0.6 + rnd(i + 900) * 1.6)}" fill="#fff" opacity="${f(0.3 + rnd(i + 70) * 0.6)}"/>`;
  if (k === 'space') s += outlined([{ e: [1330, 210, 120, 120], fill: K.lin([[0, '#f6a36b'], [1, '#b0487a']], 0.3, 1), c: '#d06a70' }], 9) + `<ellipse cx="1330" cy="215" rx="210" ry="38" fill="none" stroke="${OUT}" stroke-width="14" transform="rotate(-14 1330 215)"/><ellipse cx="1330" cy="215" rx="210" ry="38" fill="none" stroke="#ffd9a8" stroke-width="7" transform="rotate(-14 1330 215)"/><path d="M1224 180A120 120 0 0 1 1436 186" fill="none" stroke="#fff" stroke-width="6" opacity=".35"/>` + outlined([{ e: [230, 150, 34, 34], fill: '#c9d1e0', c: '#c9d1e0' }], 8);
  if (k === 'castle') {
    s += `<circle cx="1320" cy="170" r="120" fill="${K.rad([[0, '#fff3c4', 0.35], [1, '#fff3c4', 0]])}"/>` + outlined([{ e: [1320, 170, 64, 64], fill: '#fff3c4', c: '#fff3c4', line: '#c9b98a' }], 9);
    s += `<path d="M0 760L120 620L230 700L380 560L520 690L640 600L760 720L900 590L1040 700L1180 580L1320 690L1460 610L1600 700V1000H0Z" fill="#1a1428" opacity=".9"/>`;
    for (const [x, y] of [[300, 220], [360, 260], [1100, 300]]) s += `<path d="M${x} ${y}q10 -10 20 0q10 -10 20 0q-10 4 -20 12q-10 -8 -20 -12Z" fill="#0a0712"/>`;
  }
  if (k === 'farm') {
    s += `<circle cx="1360" cy="150" r="140" fill="${K.rad([[0, '#fff7b0', 0.7], [1, '#fff7b0', 0]])}"/>` + outlined([{ e: [1360, 150, 62, 62], fill: '#ffe066', c: '#ffe066', line: '#e0a92a' }], 9);
    for (const [x, y, sc] of [[220, 140, 1], [560, 90, 0.8], [980, 160, 1.1]]) s += `<g transform="translate(${x} ${y}) scale(${sc})">${outlined([{ d: 'M0 0c0 -30 50 -40 64 -14c16 -24 64 -10 58 20c26 4 22 38 -6 38h-120c-28 0 -30 -38 4 -44Z', fill: '#fff', c: '#e6f3fb', line: '#b9d6e6' }], 6)}</g>`;
    s += `<path d="M0 820Q300 700 620 790T1200 760T1600 800V1000H0Z" fill="#8fd16a"/><path d="M0 880Q400 800 800 870T1600 850V1000H0Z" fill="#6bbf49"/>`;
  }
  if (k === 'cyber') {
    for (let i = 0; i < 26; i++) { const x = i * 64 - 10, h = 180 + rnd(i + 3) * 340; s += `<rect x="${x}" y="${H - h}" width="${50 + rnd(i) * 20}" height="${h}" fill="${i % 3 ? '#22183c' : '#2c204a'}"/>`; for (let j = 0; j < 8; j++) if (rnd(i * 10 + j) > 0.55) s += `<rect x="${x + 8 + (j % 3) * 14}" y="${H - h + 20 + j * 26}" width="8" height="10" fill="${rnd(j + i) > 0.5 ? '#ff5ce0' : '#6ff'}" opacity=".85"/>`; }
    for (let i = 0; i < 90; i++) s += `<path d="M${f(rnd(i + 11) * W)} ${f(rnd(i + 33) * H)}l-6 18" stroke="#8fb0ff" stroke-width="1.4" opacity=".35"/>`;
  }
  if (k === 'alien') {
    s += `<ellipse cx="1200" cy="260" rx="420" ry="200" fill="${K.rad([[0, '#5fe0c0', 0.25], [1, '#5fe0c0', 0]])}"/><ellipse cx="300" cy="700" rx="380" ry="220" fill="${K.rad([[0, '#b06bff', 0.2], [1, '#b06bff', 0]])}"/>`;
    for (let i = 0; i < 30; i++) s += `<circle cx="${f(rnd(i + 2) * W)}" cy="${f(rnd(i + 44) * H)}" r="${f(3 + rnd(i) * 7)}" fill="#7ef0c8" opacity=".25"/>`;
  }
  if (k === 'haunted') {
    s += `<circle cx="1320" cy="170" r="140" fill="${K.rad([[0, '#e0ffd8', 0.3], [1, '#e0ffd8', 0]])}"/>` + outlined([{ e: [1320, 170, 64, 64], fill: '#eef2dc', c: '#eef2dc', line: '#b8c0a0' }], 9);
    for (const [x, y, w] of [[1200, 190, 150], [1400, 140, 120]]) s += `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="20" fill="#120c1c" opacity=".85"/>`;
    s += `<path d="M0 780Q260 700 540 760T1080 740T1600 770V1000H0Z" fill="#120c18"/>`;
    s += `<path d="M180 790V640M180 690L130 640M180 670L230 610M180 720L120 690" stroke="#0a060e" stroke-width="10" stroke-linecap="round" fill="none"/>`;
    for (let i = 0; i < 10; i++) s += `<rect x="${360 + i * 110}" y="${770 - (i % 3) * 6}" width="26" height="40" rx="13" fill="#0a060e"/>`;
    for (const [x, y] of [[300, 220], [360, 260], [1100, 300], [900, 120]]) s += `<path d="M${x} ${y}q10 -10 20 0q10 -10 20 0q-10 4 -20 12q-10 -8 -20 -12Z" fill="#0a0612"/>`;
    for (let i = 0; i < 5; i++) s += `<ellipse cx="${200 + i * 320}" cy="${900 + (i % 2) * 30}" rx="320" ry="40" fill="#d8e0f0" opacity=".06"/>`;
  }
  if (k === 'pumpkin') {
    s += `<circle cx="320" cy="300" r="200" fill="${K.rad([[0, '#ffb040', 0.45], [1, '#ffb040', 0]])}"/>` + outlined([{ e: [320, 300, 84, 84], fill: '#ffa53a', c: '#ffa53a', line: '#c8641a' }], 9);
    s += `<path d="M0 760Q300 690 640 750T1300 720T1600 760V1000H0Z" fill="#2a1a2e"/><path d="M0 860Q400 800 800 850T1600 830V1000H0Z" fill="#1e1220"/>`;
    for (let i = 0; i < 14; i++) s += `<ellipse cx="${60 + i * 115}" cy="${790 + Math.sin(i * 1.7) * 14}" rx="16" ry="12" fill="#e8741a" stroke="${OUT}" stroke-width="3"/>`;
    for (const [x, y] of [[1150, 200], [1230, 250], [1320, 170]]) s += `<path d="M${x} ${y}q10 -10 20 0q10 -10 20 0q-10 4 -20 12q-10 -8 -20 -12Z" fill="#0a0612"/>`;
  }
  if (k === 'rocket') {
    s += `<circle cx="1200" cy="760" r="260" fill="${K.rad([[0, '#ffc080', 0.55], [1, '#ffc080', 0]])}"/><circle cx="1200" cy="760" r="70" fill="#ffd08a"/>`;
    s += `<path d="M0 800Q300 740 600 790T1200 770T1600 790V1000H0Z" fill="#6a4a5a"/>`;
    for (const [x, hh] of [[220, 240], [420, 180], [1420, 210]]) s += `<rect x="${x}" y="${800 - hh}" width="16" height="${hh}" fill="#2a2030"/><rect x="${x + 26}" y="${800 - hh * 0.85}" width="14" height="${hh * 0.85}" fill="#e8ebf1"/><path d="M${x + 26} ${800 - hh * 0.85}L${x + 33} ${800 - hh * 0.85 - 22}L${x + 40} ${800 - hh * 0.85}Z" fill="#e8ebf1"/>`;
  }
  if (k === 'lab') {
    for (const [x, w] of [[300, 260], [900, 320], [1400, 220]]) s += `<ellipse cx="${x}" cy="160" rx="${w}" ry="46" fill="#140a24" opacity=".85"/>`;
    s += `<path d="M1120 0L1080 160L1130 170L1070 360" fill="none" stroke="#f4f0ff" stroke-width="5"/>`;
    s += `<path d="M0 780Q260 660 560 740T1100 700T1600 740V1000H0Z" fill="#120a20"/><rect x="1260" y="560" width="70" height="190" fill="#0c0616"/><path d="M1250 560L1295 480L1340 560Z" fill="#0c0616"/>`;
    for (const y of [590, 640, 690]) s += `<rect x="1285" y="${y}" width="16" height="22" fill="#9aff7a"/>`;
  }
  if (k === 'mafia') {
    s += `<circle cx="300" cy="600" r="200" fill="${K.rad([[0, '#ffd0a0', 0.5], [1, '#ffd0a0', 0]])}"/>`;
    s += `<path d="M0 760Q300 640 700 720T1300 680T1600 720V1000H0Z" fill="#7a6a5a"/><path d="M0 860Q400 780 800 840T1600 820V1000H0Z" fill="#5a6a3a"/>`;
    for (let i = 0; i < 14; i++) s += `<ellipse cx="${60 + i * 115}" cy="${760 + Math.sin(i * 1.3) * 18}" rx="14" ry="56" fill="#1f3a24"/>`;
  }
  if (k === 'gamer') {
    s += `<circle cx="800" cy="720" r="240" fill="#ff3fb8"/><circle cx="800" cy="720" r="240" fill="${K.lin([[0, '#ffe14a'], [1, '#ff3fb8']])}"/>`;
    for (let i = 0; i < 6; i++) s += `<rect x="540" y="${560 + i * 32}" width="520" height="${6 + i * 2}" fill="#3a0a5a"/>`;
    s += `<rect x="0" y="780" width="${W}" height="220" fill="#0a0420"/>`;
    for (let i = 1; i < 10; i++) s += `<path d="M0 ${780 + i * i * 2.4}H${W}" stroke="#ff3fb8" stroke-width="2" opacity=".6"/>`;
    for (let i = -12; i <= 12; i++) s += `<path d="M${800 + i * 30} 780L${800 + i * 200} 1000" stroke="#29e7ff" stroke-width="2" opacity=".5"/>`;
  }
  if (k === 'ocean') {
    for (let i = 0; i < 7; i++) s += `<path d="M${200 + i * 200} 0L${120 + i * 210} ${H}H${260 + i * 210}Z" fill="#bff3ff" opacity=".05"/>`;
    s += `<path d="M0 860Q260 800 520 850T1040 830T1600 860V1000H0Z" fill="#c9b27a"/><path d="M0 910Q400 870 800 920T1600 900V1000H0Z" fill="#b39a62"/>`;
    for (const [x, c] of [[120, '#ff7a8a'], [1460, '#ffb347'], [1520, '#f472b6'], [60, '#ffd23f']]) s += outlined([{ d: `M${x} 920C${x - 10} 880 ${x - 30} 860 ${x - 20} 830M${x} 920C${x + 6} 870 ${x + 26} 850 ${x + 20} 810`, fill: 'none', c, line: c, lw: 9 }], 15);
    for (let i = 0; i < 6; i++) { const x = rnd(i + 7) * W, y = 120 + rnd(i + 9) * 400; s += `<path d="M${f(x)} ${f(y)}q16 -12 32 0q-16 12 -32 0Zm32 0l10 -8v16Z" fill="${['#ffd23f', '#ff8a4c', '#8fe3ff'][i % 3]}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>`; }
  }
  return s;
}

// ---------------------------------------------------------------------------------------------- labels
function plate(x, y, rank, name, acc, big = false, sel = '') {
  const fs = big ? 21 : 19, w = Math.max(110, name.length * fs * 0.6 + 70), h = big ? 44 : 40;
  const r = typeof rank === 'number' ? String(rank).padStart(2, '0') : rank;
  return `<g transform="translate(${f(x - w / 2)} ${f(y)})"${sel ? ` data-sel="${esc(sel)}"` : ''}><rect x="-3" y="-3" width="${w + 6}" height="${h + 6}" rx="${h / 2 + 3}" fill="${OUT}"/><rect width="${w}" height="${h}" rx="${h / 2}" fill="#fbf6ea"/><rect x="4" y="4" width="${h + 8}" height="${h - 8}" rx="${(h - 8) / 2}" fill="${acc}" stroke="${OUT}" stroke-width="2"/><text x="${(h + 16) / 2}" y="${h / 2 + 6.5}" font-size="${fs}" font-weight="900" text-anchor="middle" fill="${OUT}" font-family="Arial Black, Arial, sans-serif">${esc(r)}</text><text x="${h + 22}" y="${h / 2 + 6.5}" font-size="${fs}" font-weight="800" fill="${OUT}" font-family="Arial, sans-serif">${esc(name)}</text></g>`;
}

// ---------------------------------------------------------------------------------------------- the map
function mapSvg(world = 'space', opts = {}) {
  const k = WORLD[world] ? world : 'space', wd = WORLD[k], K = Kit(opts.id || 'map');
  const rooms = (opts.rooms || DEFAULT_ROOMS).slice(0, 10);
  // a ninth room takes the mast's corner; the mast steps out one cell
  MAST = rooms.length > 8 ? [4, 0] : [3, 0];
  const cells = [];
  ROOM_CELLS.forEach(([c, r], i) => { if (rooms[i]) cells.push({ c, r, kind: 'room', i }); });
  cells.push({ c: HUB[0], r: HUB[1], kind: 'hub' }, { c: DOCK[0], r: DOCK[1], kind: 'dock' });
  const occupied = new Set(cells.map((q) => q.c + ',' + q.r));
  let body = '';
  // walkways first, under everything
  for (const q of cells) for (const [dc, dr] of [[1, 0], [0, 1]]) if (occupied.has(q.c + dc + ',' + (q.r + dr))) body += walkway(k, wd, [q.c * CELL, q.r * CELL], [(q.c + dc) * CELL, (q.r + dr) * CELL]);
  // back to front
  const order = cells.slice().sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c);
  let labels = '';
  for (const q of order) {
    const cx = q.c * CELL, cy = q.r * CELL;
    const sel = q.kind === 'room' ? rooms[q.i].id || '' : opts.rooms && opts.rooms.some((r) => r.id) ? q.kind : '';
    body += sel ? `<g data-sel="${esc(sel)}">` : '<g>';
    body += slab(k, wd, cx, cy, q.kind === 'hub' ? 0.7 : 0.62);
    if (q.kind === 'room') body += building(k, cx, cy, rooms[q.i].accent, q.i + 1, K);
    if (q.kind === 'hub') body += vault(k, wd, K);
    if (q.kind === 'dock') body += dock(k, wd, K);
    body += '</g>';
    // each name sits on its own island, just in front of its building: below the tip it would land on the island in
    // front, which is packed in right under it
    const s = q.kind === 'hub' ? 0.7 : 0.62, [lx, ly] = iso(cx + s * 0.72, cy + s * 0.72, 0), top = ly - (q.kind === 'hub' ? 20 : 18);
    if (q.kind === 'room') labels += plate(lx, top, q.i + 1, rooms[q.i].name, rooms[q.i].accent, false, sel);
    if (q.kind === 'hub') labels += plate(lx, top, 'L' + (opts.level || 2), opts.hub || wd.hub, '#f2c14e', true, sel);
    if (q.kind === 'dock') labels += plate(lx, top, '✉', opts.dock || wd.dock, '#cfd6e6', false, sel);
  }
  body += mast(k, K);
  const title = opts.title || wd.title;
  const tw = title.length * 21 + 70;
  const head = `<g transform="translate(48 44)"><rect x="-4" y="-4" width="${tw + 8}" height="72" rx="20" fill="${OUT}"/><rect width="${tw}" height="64" rx="16" fill="#fbf6ea"/><text x="32" y="44" font-size="32" font-weight="900" fill="${OUT}" font-family="Arial Black, Arial, sans-serif" letter-spacing="1">${esc(title.toUpperCase())}</text></g>`;
  // the sky is drawn after the station so every gradient exists before the defs are written
  const bg = sky(k, wd, K);
  // fit the station into the frame below the title: its slabs' corners, room above for the tallest roofs and the mast
  const xs = [], ys = [];
  for (const q of cells.concat([{ c: MAST[0], r: MAST[1] }])) for (const [dx, dy] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) { const [px, py] = iso(q.c * CELL + dx, q.r * CELL + dy, 0); xs.push(px); ys.push(py); }
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys) - 205, by1 = Math.max(...ys) + 70;
  const sc = Math.min((W - 80) / (bx1 - bx0), (H - 150) / (by1 - by0));
  const tx = (W - (bx1 - bx0) * sc) / 2 - bx0 * sc, ty = 130 - by0 * sc;
  // plates: false leaves off the name plates and the title (a thumbnail, a picture of the world on its own)
  const bare = opts.plates === false;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="pf-map pf-map-${k}"><defs>${K.defs()}</defs>${bg}<g transform="translate(${f(tx)} ${f(ty)}) scale(${sc.toFixed(3)})">${body}${bare ? '' : labels}</g>${bare ? '' : head}</svg>`;
}

const MAPS = { worlds: Object.keys(WORLD), rooms: DEFAULT_ROOMS };
if (typeof globalThis !== 'undefined') { globalThis.mapSvg = mapSvg; globalThis.PF_MAPS = MAPS; }
export { mapSvg, MAPS };
