// The desk: files from the phone fly in from the right edge, land as cards,
// and stay. Throw a card off the right edge to send it back to the phone,
// off the bottom to clear it. Everything else on screen stays clickable.

const api = window.fling;
const desk = document.getElementById('desk');
const hud = document.getElementById('hud');
const canvas = document.getElementById('trails');
const ctx = canvas.getContext('2d');

const CARD_W = 208;
const CARD_H = 196;
const FRICTION = 0.0042; // per ms; a 2 px/ms throw coasts about 475 px
const BOUNCE = 0.45;
const EXIT_SPEED = 0.7; // px/ms needed to leave through the right or bottom edge

const cards = new Map(); // id -> card
let zTop = 1;
let captured = false;
let dragging = null;
const particles = [];

function W() { return window.innerWidth; }
function H() { return window.innerHeight; }

function resize() {
  canvas.width = W() * devicePixelRatio;
  canvas.height = H() * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// --- click-through: only grab the mouse while it is over a card -------------
function setCapture(on) {
  if (on === captured) return;
  captured = on;
  api.mouse(on);
}
document.addEventListener('mousemove', (e) => {
  if (dragging) return;
  setCapture(!!(e.target && e.target.closest && e.target.closest('.card')));
});
document.addEventListener('mouseleave', () => { if (!dragging) setCapture(false); });

// --- helpers ------------------------------------------------------------------
function toast(text, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  hud.appendChild(t);
  while (hud.children.length > 3) hud.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
}

function fmtSize(n) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function glyphFor(type, name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type === 'application/pdf' || ext === 'pdf') return '📕';
  if (/zip|rar|7z/.test(ext)) return '🗜️';
  if (/docx?|pages|rtf/.test(ext)) return '📄';
  if (/xlsx?|csv|numbers/.test(ext)) return '📊';
  if (/pptx?|key/.test(ext)) return '📽️';
  return '📦';
}

const WEB_IMAGES = /^image\/(jpeg|png|gif|webp|bmp|svg\+xml|avif)$/;
const WEB_VIDEO = /^video\/(mp4|webm|quicktime|x-m4v)$/;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// --- cards --------------------------------------------------------------------
function makeCard(c) {
  const root = el('div', 'card');
  const media = el('div', 'media');
  const meta = el('div', 'meta');
  const name = el('div', 'name', c.kind === 'text' ? 'Text' : c.name);
  const sub = el('div', 'sub', c.kind === 'text' ? 'Copied to clipboard' : fmtSize(c.size));
  meta.append(name, sub);
  const tools = el('div', 'tools');
  root.append(media, meta, tools);
  desk.appendChild(root);
  c.el = root;
  c.media = media;
  c.sub = sub;
  c.tools = tools;
  c.rot = c.rot ?? (Math.random() * 6 - 3);
  root.style.zIndex = ++zTop;
  fillMedia(c);
  bindCard(c);
  place(c);
  return c;
}

function fillMedia(c) {
  const m = c.media;
  m.textContent = '';
  if (c.kind === 'text') {
    m.appendChild(el('div', 'note', c.text.slice(0, 600)));
    return;
  }
  if (!c.path) { m.appendChild(el('div', 'glyph', glyphFor(c.type || '', c.name))); return; }
  const fallback = async () => {
    m.textContent = '';
    const url = await api.thumb(c.path);
    if (url) {
      const img = el('img');
      img.src = url;
      const isIcon = !/^image\/|^video\//.test(c.type || '');
      if (isIcon) img.className = 'icon';
      m.appendChild(img);
    } else {
      m.appendChild(el('div', 'glyph', glyphFor(c.type || '', c.name)));
    }
  };
  if (WEB_IMAGES.test(c.type)) {
    const img = el('img');
    img.onerror = fallback;
    img.src = api.fileUrl(c.path);
    m.appendChild(img);
  } else if (WEB_VIDEO.test(c.type)) {
    const v = el('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.onerror = fallback;
    v.src = api.fileUrl(c.path) + '#t=0.1';
    c.el.addEventListener('mouseenter', () => v.play().catch(() => {}));
    c.el.addEventListener('mouseleave', () => v.pause());
    m.appendChild(v);
  } else {
    fallback();
  }
  api.thumb(c.path); // warm the cache so dragging into an app has a picture
}

function addTools(c) {
  c.tools.textContent = '';
  const mk = (glyph, title, fn, cls) => {
    const b = el('button', 'tool' + (cls ? ' ' + cls : ''), glyph);
    b.title = title;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    c.tools.appendChild(b);
    return b;
  };
  if (c.kind === 'text') {
    mk('⧉', 'Copy', () => { api.copy(c.text); toast('Copied'); });
  } else {
    const grip = mk('⇱', 'Drag into any app', () => {}, 'grip');
    grip.draggable = true;
    grip.addEventListener('dragstart', (e) => { e.preventDefault(); api.dragOut(c.path); });
    mk('↗', 'Open', () => api.open(c.path));
    mk('📁', 'Show in folder', () => api.reveal(c.path));
  }
  mk('✕', 'Clear from screen', () => removeCard(c, true));
}

function place(c) {
  const tilt = c.rot + Math.max(-14, Math.min(14, (c.vx || 0) * 6));
  c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) rotate(${tilt}deg)`;
}

function bindCard(c) {
  const root = c.el;
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    root.setPointerCapture(e.pointerId);
    root.style.zIndex = ++zTop;
    dragging = { c, dx: e.clientX - c.x, dy: e.clientY - c.y, hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
    c.held = true;
    c.vx = c.vy = 0;
    root.classList.add('dragging');
    setCapture(true);
  });
  root.addEventListener('pointermove', (e) => {
    if (!dragging || dragging.c !== c) return;
    c.x = e.clientX - dragging.dx;
    c.y = e.clientY - dragging.dy;
    const now = performance.now();
    dragging.hist.push({ x: e.clientX, y: e.clientY, t: now });
    while (dragging.hist.length > 2 && now - dragging.hist[0].t > 90) dragging.hist.shift();
    place(c);
  });
  const release = (e) => {
    if (!dragging || dragging.c !== c) return;
    const h = dragging.hist;
    const a = h[0];
    const b = h[h.length - 1];
    const dt = Math.max(16, b.t - a.t);
    const fresh = performance.now() - b.t < 60; // a pause before letting go means "drop", not "throw"
    c.vx = fresh ? (b.x - a.x) / dt : 0;
    c.vy = fresh ? (b.y - a.y) / dt : 0;
    c.held = false;
    dragging = null;
    root.classList.remove('dragging');
    setCapture(!!(e.target && e.target.closest && e.target.closest('.card')));
    // The cursor stops at the screen edge, so a card dragged mostly off an edge counts as thrown.
    if (c.x > W() - CARD_W * 0.75) { throwToPhone(c); return; }
    if (c.y > H() - CARD_H * 0.5) { removeCard(c, true); return; }
    wake();
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('dblclick', () => {
    if (c.kind === 'text') { api.copy(c.text); toast('Copied'); } else if (c.path) api.open(c.path);
  });
}

function removeCard(c, animate) {
  cards.delete(c.id);
  if (animate) {
    c.el.style.transition = 'transform 260ms ease-in, opacity 260ms ease-in';
    c.el.style.opacity = '0';
    c.el.style.transform += ' scale(0.8)';
    setTimeout(() => c.el.remove(), 280);
  } else {
    c.el.remove();
  }
  save();
}

// --- physics --------------------------------------------------------------------
let running = false;
let last = 0;
function wake() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(step);
}

function step(now) {
  const dt = Math.min(40, now - last);
  last = now;
  let busy = false;
  for (const c of [...cards.values()]) {
    if (c.held || c.leaving) continue;
    const speed = Math.hypot(c.vx || 0, c.vy || 0);
    if (speed < 0.02 && !c.entering) {
      if (c.el.classList.contains('moving')) { c.el.classList.remove('moving'); c.vx = c.vy = 0; place(c); save(); }
      continue;
    }
    busy = true;
    c.el.classList.toggle('moving', speed > 0.35);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    const k = Math.exp(-FRICTION * dt);
    c.vx *= k;
    c.vy *= k;
    if (speed > 0.35) emit(c, speed);

    const maxX = W() - CARD_W;
    const maxY = H() - CARD_H;
    if (c.entering) {
      if (c.x <= maxX) c.entering = false; // fully on screen now
    } else if (c.x > maxX) {
      if (c.vx > EXIT_SPEED && c.x > maxX + 20) { throwToPhone(c); continue; }
      c.x = maxX; c.vx = -Math.abs(c.vx) * BOUNCE;
    }
    if (c.y > maxY) {
      if (c.vy > EXIT_SPEED && c.y > maxY + 20) { c.leaving = true; removeCard(c, true); continue; }
      c.y = maxY; c.vy = -Math.abs(c.vy) * BOUNCE;
    }
    if (c.x < 0) { c.x = 0; c.vx = Math.abs(c.vx) * BOUNCE; }
    if (c.y < 0) { c.y = 0; c.vy = Math.abs(c.vy) * BOUNCE; }
    place(c);
  }
  drawTrails(dt);
  if (busy || particles.length) requestAnimationFrame(step);
  else running = false;
}

function emit(c, speed) {
  const n = Math.min(4, Math.ceil(speed * 1.5));
  for (let i = 0; i < n; i++) {
    particles.push({
      x: c.x + CARD_W / 2 + (Math.random() - 0.5) * CARD_W * 0.7,
      y: c.y + CARD_H / 2 + (Math.random() - 0.5) * CARD_H * 0.7,
      vx: -c.vx * 0.08 + (Math.random() - 0.5) * 0.05,
      vy: -c.vy * 0.08 + (Math.random() - 0.5) * 0.05,
      life: 1,
      hue: 190 + Math.random() * 90,
      r: 2 + Math.random() * 4,
    });
  }
  if (particles.length > 900) particles.splice(0, particles.length - 900);
}

function drawTrails(dt) {
  ctx.clearRect(0, 0, W(), H());
  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt / 650;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.fillStyle = `hsla(${p.hue}, 95%, 65%, ${p.life * 0.55})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// --- laptop -> phone ------------------------------------------------------------
async function throwToPhone(c) {
  c.leaving = true;
  c.el.style.transition = 'transform 220ms ease-in, opacity 220ms ease-in';
  c.el.style.transform = `translate3d(${W() + 60}px, ${c.y}px, 0) rotate(18deg)`;
  c.el.style.opacity = '0';
  const r = c.kind === 'text' ? await api.sendText(c.text) : await api.sendToPhone(c.path, 'card');
  if (r && r.ok) {
    toast(r.queued ? 'Queued — your phone gets it when Fling is open there' : 'Flung to your phone');
    removeCard(c, false);
    return;
  }
  // Nobody caught it: bounce back in.
  toast(c.kind === 'text' ? 'Open Fling on your phone to catch text' : "Couldn't send that file");
  c.el.style.transition = '';
  c.el.style.opacity = '1';
  c.leaving = false;
  c.x = W() - CARD_W - 10;
  c.vx = -1.2;
  c.vy = 0;
  place(c);
  wake();
}

// --- phone -> laptop --------------------------------------------------------------
function spawnIncoming(d, kind) {
  const y = Math.max(0, Math.min(H() - CARD_H, d.fy * H() - CARD_H / 2));
  const c = {
    id: d.id, kind, name: d.name || 'Text', type: d.type || '', size: d.size || 0, text: d.text,
    x: W() + 30, y, vx: -(1.9 + Math.random() * 0.5), vy: (d.vy || 0) * 0.25,
    entering: true, path: null,
  };
  cards.set(c.id, c);
  makeCard(c);
  if (kind === 'file') { c.el.classList.add('flying'); c.el.style.setProperty('--p', '0'); }
  else { addTools(c); }
  wake();
  return c;
}

api.on('incoming', (d) => spawnIncoming(d, 'file'));
api.on('progress', (d) => {
  const c = cards.get(d.id);
  if (!c || !d.size) return;
  c.el.style.setProperty('--p', String(Math.min(1, d.received / d.size)));
  c.sub.textContent = `${fmtSize(d.received)} of ${fmtSize(d.size)}`;
});
api.on('arrive', (d) => {
  let c = cards.get(d.id);
  if (!c) c = spawnIncoming({ ...d, fy: 0.5 }, 'file');
  Object.assign(c, { path: d.path, name: d.name, type: d.type, size: d.size });
  c.el.classList.remove('flying');
  c.el.classList.add('landed');
  c.el.querySelector('.name').textContent = d.name;
  c.sub.textContent = fmtSize(d.size);
  fillMedia(c);
  addTools(c);
  save();
});
api.on('cancel', (d) => { const c = cards.get(d.id); if (c) { removeCard(c, true); toast('Transfer cancelled'); } });
api.on('text', (d) => {
  api.copy(d.text);
  spawnIncoming({ ...d, name: 'Text' }, 'text');
  save();
});
// Files thrown from the edge portal or the tray menu report here.
api.on('sent', (d) => {
  if (d.source === 'card') return;
  if (!d.ok) toast("Couldn't send that file");
  else toast(d.queued ? 'Queued — your phone gets it when Fling is open there' : 'Flung to your phone');
});
let phones = 0;
api.on('phones', (n) => {
  if (n > phones) toast('📱 Phone linked');
  phones = n;
});
api.on('clear-cards', () => {
  for (const c of [...cards.values()]) { c.vy = 1.6 + Math.random(); c.vx = (Math.random() - 0.5) * 0.4; }
  wake();
});

// --- persistence: cards stay on the desktop across restarts -----------------------
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const out = [];
    for (const c of cards.values()) {
      if (c.kind === 'file' && !c.path) continue;
      out.push({ id: c.id, kind: c.kind, name: c.name, type: c.type, size: c.size, path: c.path, text: c.text, x: Math.round(c.x), y: Math.round(c.y), rot: c.rot });
    }
    api.saveCards(out);
  }, 400);
}

(async function restore() {
  const saved = await api.loadCards();
  for (const s of saved || []) {
    if (s.kind === 'file' && !(await api.exists(s.path))) continue;
    const c = { ...s, vx: 0, vy: 0, x: Math.min(s.x, W() - CARD_W), y: Math.min(s.y, H() - CARD_H) };
    cards.set(c.id, c);
    makeCard(c);
    addTools(c);
  }
})();
