// Proxyfolk world maps: the station as an illustrated map in the Code Lab house style (a fat plum outline
// around every building, flat faces lit from the top left, a rim of light on the top edges), one per world.
// The layout is the station's own: the vault in the middle, eight rooms around it, the dock bottom left,
// the comm mast top right, each on a floating slab joined by walkways, nothing underneath.
//
//   mapSvg(world, options) returns an SVG string, 1600 x 1000.
//   world    space castle farm cyber alien ocean
//   options  { id, rooms: [{ name, accent, id }] (up to 10), hub, dock, level, title }
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
  cyber: { title: 'Cyberpunk city', sky: ['#0a0716', '#1a0f33', '#3a1242'], slab: '#3a3a52', slabTop: '#4a4a66', edge: '#24243a', walk: '#2e2e46', hub: 'Data vault', dock: 'Courier hub' },
  alien: { title: 'Alien ship', sky: ['#050b14', '#0c1f2e', '#1a3a3f'], slab: '#3f6b64', slabTop: '#5fa396', edge: '#28463f', walk: '#4f8a7f', hub: 'Core', dock: 'Pod bay' },
  ocean: { title: 'Deep sea base', sky: ['#021526', '#063356', '#0b5a7a'], slab: '#c9b27a', slabTop: '#e6d29a', edge: '#8f7a4a', walk: '#9aa3a8', hub: 'Pearl vault', dock: 'Sub dock' },
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
  const tx = { farm: '#6bbf49', castle: '#7d7483', space: '#b3bccd', cyber: '#56567a', alien: '#6fb8a8', ocean: '#d9c386' }[k];
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
    s.push(...box(x, y, 0, w, w, h, '#3a3552'));
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
  const base = { space: '#c9d1e0', castle: '#8a8294', farm: '#c9a46a', cyber: '#3a3552', alien: '#4f8a7f', ocean: '#b8a570' }[k];
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
  if (k === 'space' || k === 'cyber' || k === 'castle' || k === 'alien') for (let i = 0; i < 140; i++) s += `<circle cx="${f(rnd(i) * W)}" cy="${f(rnd(i + 500) * H * (k === 'cyber' ? 0.45 : 0.9))}" r="${f(0.6 + rnd(i + 900) * 1.6)}" fill="#fff" opacity="${f(0.3 + rnd(i + 70) * 0.6)}"/>`;
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
    for (let i = 0; i < 26; i++) { const x = i * 64 - 10, h = 180 + rnd(i + 3) * 340; s += `<rect x="${x}" y="${H - h}" width="${50 + rnd(i) * 20}" height="${h}" fill="${i % 3 ? '#150f26' : '#1c1432'}"/>`; for (let j = 0; j < 8; j++) if (rnd(i * 10 + j) > 0.55) s += `<rect x="${x + 8 + (j % 3) * 14}" y="${H - h + 20 + j * 26}" width="8" height="10" fill="${rnd(j + i) > 0.5 ? '#ff5ce0' : '#6ff'}" opacity=".6"/>`; }
    for (let i = 0; i < 90; i++) s += `<path d="M${f(rnd(i + 11) * W)} ${f(rnd(i + 33) * H)}l-6 18" stroke="#8fb0ff" stroke-width="1.4" opacity=".35"/>`;
  }
  if (k === 'alien') {
    s += `<ellipse cx="1200" cy="260" rx="420" ry="200" fill="${K.rad([[0, '#5fe0c0', 0.25], [1, '#5fe0c0', 0]])}"/><ellipse cx="300" cy="700" rx="380" ry="220" fill="${K.rad([[0, '#b06bff', 0.2], [1, '#b06bff', 0]])}"/>`;
    for (let i = 0; i < 30; i++) s += `<circle cx="${f(rnd(i + 2) * W)}" cy="${f(rnd(i + 44) * H)}" r="${f(3 + rnd(i) * 7)}" fill="#7ef0c8" opacity=".25"/>`;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="pf-map pf-map-${k}"><defs>${K.defs()}</defs>${bg}<g transform="translate(${f(tx)} ${f(ty)}) scale(${sc.toFixed(3)})">${body}${labels}</g>${head}</svg>`;
}

const MAPS = { worlds: Object.keys(WORLD), rooms: DEFAULT_ROOMS };
if (typeof globalThis !== 'undefined') { globalThis.mapSvg = mapSvg; globalThis.PF_MAPS = MAPS; }
export { mapSvg, MAPS };
