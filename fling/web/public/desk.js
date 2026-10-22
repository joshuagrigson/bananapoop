// Fling Web desk: the laptop side as a browser tab. Files flung from the phone
// fly in from the right and stay (kept in this browser). Throw a card off the
// right edge to send it to the phone, off the bottom to clear it.

(() => {
  const $ = (id) => document.getElementById(id);
  const desk = $('desk');
  const canvas = $('trails');
  const ctx = canvas.getContext('2d');

  const CARD_W = 208;
  const CARD_H = 196;
  const FRICTION = 0.0042;
  const BOUNCE = 0.45;
  const EXIT_SPEED = 0.7;
  const CHUNK = 8 * 1024 * 1024;

  // --- key ----------------------------------------------------------------------
  const hashKey = new URLSearchParams(location.hash.slice(1)).get('k');
  if (hashKey) {
    try { localStorage.setItem('fling.desk.k', hashKey); } catch {}
    history.replaceState(null, '', location.pathname);
  }
  let key = hashKey;
  if (!key) { try { key = localStorage.getItem('fling.desk.k'); } catch {} }
  const api = (p, extra = '') => `${p}?k=${encodeURIComponent(key || '')}${extra}`;

  // --- small helpers -----------------------------------------------------------------
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function toast(text, ms = 2600) {
    const t = el('div', 'toast', text);
    $('hud').appendChild(t);
    while ($('hud').children.length > 3) $('hud').firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
  }
  function fmtSize(n) {
    if (!n) return '';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
  }
  function glyph(type, name) {
    const ext = (String(name).split('.').pop() || '').toLowerCase();
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type === 'application/pdf' || ext === 'pdf') return '📕';
    if (/docx?|pages|rtf/.test(ext)) return '📄';
    if (/xlsx?|csv|numbers/.test(ext)) return '📊';
    if (/pptx?|key/.test(ext)) return '📽️';
    if (/zip|rar|7z/.test(ext)) return '🗜️';
    return '📦';
  }

  // --- storage: cards and their files stay in this browser ----------------------------
  let dbp = null;
  function idb() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const r = indexedDB.open('fling-desk', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('cards', { keyPath: 'id' });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return dbp;
  }
  async function idbDo(mode, fn) {
    try {
      const db = await idb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('cards', mode);
        const req = fn(tx.objectStore('cards'));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      });
    } catch { return null; }
  }
  const putCard = (rec) => idbDo('readwrite', (s) => s.put(rec));
  const delCard = (id) => idbDo('readwrite', (s) => s.delete(id));
  const allCards = () => idbDo('readonly', (s) => s.getAll());

  function saveCard(c) {
    if (c.kind === 'file' && !c.blob) return;
    putCard({ id: c.id, kind: c.kind, name: c.name, type: c.type, size: c.size, text: c.text, blob: c.blob, x: Math.round(c.x), y: Math.round(c.y), rot: c.rot });
  }

  // --- trails canvas ------------------------------------------------------------------
  function resize() {
    canvas.width = W() * devicePixelRatio;
    canvas.height = H() * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    for (const c of cards.values()) { c.x = Math.min(c.x, W() - CARD_W); c.y = Math.min(c.y, H() - CARD_H); place(c); }
  }
  window.addEventListener('resize', resize);

  // --- cards ----------------------------------------------------------------------------
  const cards = new Map();
  let zTop = 1;
  let dragging = null;
  const particles = [];

  function updateEmpty() { $('empty').hidden = cards.size > 0; }

  function makeCard(c) {
    const root = el('div', 'card');
    const media = el('div', 'media');
    const meta = el('div', 'meta');
    const name = el('div', 'name', c.kind === 'text' ? 'Text' : c.name);
    const sub = el('div', 'sub', c.kind === 'text' ? (c.copied ? 'Copied to clipboard' : 'Double-click to copy') : fmtSize(c.size));
    meta.append(name, sub);
    const tools = el('div', 'tools');
    root.append(media, meta, tools);
    root.tabIndex = 0;
    desk.appendChild(root);
    Object.assign(c, { el: root, media, sub, nameEl: name, tools });
    c.rot = c.rot ?? (Math.random() * 6 - 3);
    root.style.zIndex = ++zTop;
    fillMedia(c);
    bindCard(c);
    place(c);
    updateEmpty();
    return c;
  }

  function fillMedia(c) {
    const m = c.media;
    m.textContent = '';
    if (c.kind === 'text') { m.appendChild(el('div', 'note', c.text.slice(0, 600))); return; }
    if (!c.blob) { m.appendChild(el('div', 'glyph', glyph(c.type || '', c.name))); return; }
    if (!c.url) c.url = URL.createObjectURL(c.blob);
    if (/^image\//.test(c.type)) {
      const img = el('img');
      img.onerror = () => { m.textContent = ''; m.appendChild(el('div', 'glyph', glyph(c.type, c.name))); };
      img.src = c.url;
      m.appendChild(img);
    } else if (/^video\//.test(c.type)) {
      const v = el('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'metadata';
      v.onerror = () => { m.textContent = ''; m.appendChild(el('div', 'glyph', '🎬')); };
      v.src = c.url + '#t=0.1';
      c.el.addEventListener('mouseenter', () => v.play().catch(() => {}));
      c.el.addEventListener('mouseleave', () => v.pause());
      m.appendChild(v);
    } else {
      m.appendChild(el('div', 'glyph', glyph(c.type || '', c.name)));
    }
  }

  function addTools(c) {
    c.tools.textContent = '';
    const mk = (g, title, fn, cls) => {
      const b = el('button', 'tool' + (cls ? ' ' + cls : ''), g);
      b.type = 'button';
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      c.tools.appendChild(b);
      return b;
    };
    if (c.kind === 'text') {
      mk('⧉', 'Copy', () => copyText(c));
    } else {
      // Drag this onto the desktop, a folder, or an email to drop the file there.
      const grip = mk('⇱', 'Drag into a folder or app', () => {}, 'grip');
      grip.draggable = true;
      grip.addEventListener('dragstart', (e) => {
        if (!c.url) return;
        const abs = new URL(c.url, location.href).href;
        e.dataTransfer.setData('DownloadURL', `${c.type || 'application/octet-stream'}:${c.name}:${abs}`);
        e.dataTransfer.setData('text/uri-list', abs);
        e.dataTransfer.effectAllowed = 'copy';
      });
      mk('⬇', 'Save to Downloads', () => saveFile(c));
      mk('↗', 'Open', () => { if (c.url) window.open(c.url, '_blank', 'noopener'); });
    }
    mk('✕', 'Clear from desk', () => removeCard(c, true));
  }

  function saveFile(c) {
    if (!c.url) return;
    const a = el('a');
    a.href = c.url;
    a.download = c.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyText(c) {
    try {
      await navigator.clipboard.writeText(c.text);
      c.copied = true;
      c.sub.textContent = 'Copied to clipboard';
      toast('Copied');
      return true;
    } catch {
      return false;
    }
  }

  function place(c) {
    const tilt = c.rot + Math.max(-14, Math.min(14, (c.vx || 0) * 6));
    c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) rotate(${tilt}deg)`;
  }

  function bindCard(c) {
    const root = c.el;
    root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || c.leaving) return;
      root.setPointerCapture(e.pointerId);
      root.style.zIndex = ++zTop;
      dragging = { c, dx: e.clientX - c.x, dy: e.clientY - c.y, hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
      c.held = true;
      c.vx = c.vy = 0;
      root.classList.add('dragging');
    });
    root.addEventListener('pointermove', (e) => {
      if (!dragging || dragging.c !== c) return;
      c.x = e.clientX - dragging.dx;
      c.y = e.clientY - dragging.dy;
      const now = performance.now();
      dragging.hist.push({ x: e.clientX, y: e.clientY, t: now });
      while (dragging.hist.length > 2 && now - dragging.hist[0].t > 90) dragging.hist.shift();
      $('edge').classList.toggle('hot', c.x > W() - CARD_W * 0.9);
      place(c);
    });
    const release = () => {
      if (!dragging || dragging.c !== c) return;
      const h = dragging.hist;
      const a = h[0];
      const b = h[h.length - 1];
      const dt = Math.max(16, b.t - a.t);
      const fresh = performance.now() - b.t < 60;
      c.vx = fresh ? (b.x - a.x) / dt : 0;
      c.vy = fresh ? (b.y - a.y) / dt : 0;
      c.held = false;
      dragging = null;
      root.classList.remove('dragging');
      $('edge').classList.remove('hot');
      if (c.x > W() - CARD_W * 0.75) { throwToPhone(c); return; }
      if (c.y > H() - CARD_H * 0.5) { removeCard(c, true); return; }
      saveCard(c);
      wake();
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('dblclick', () => {
      if (c.kind === 'text') copyText(c); else if (c.url) window.open(c.url, '_blank', 'noopener');
    });
  }

  function removeCard(c, animate) {
    cards.delete(c.id);
    delCard(c.id);
    const done = () => { c.el.remove(); if (c.url) URL.revokeObjectURL(c.url); };
    if (animate) {
      c.el.style.transition = 'transform 260ms ease-in, opacity 260ms ease-in';
      c.el.style.opacity = '0';
      c.el.style.transform += ' scale(0.8)';
      setTimeout(done, 280);
    } else done();
    updateEmpty();
  }

  // --- physics -----------------------------------------------------------------------------
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
        if (c.el.classList.contains('moving')) { c.el.classList.remove('moving'); c.vx = c.vy = 0; place(c); saveCard(c); }
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
        if (c.x <= maxX) c.entering = false;
      } else if (c.x > maxX) {
        if (c.vx > EXIT_SPEED && c.x > maxX + 20) { throwToPhone(c); continue; }
        c.x = maxX; c.vx = -Math.abs(c.vx) * BOUNCE;
      }
      if (c.y > maxY) {
        if (c.vy > EXIT_SPEED && c.y > maxY + 20) { c.leaving = true; removeCard(c, true); continue; }
        c.y = maxY; c.vy = -Math.abs(c.vy) * BOUNCE;
      }
      if (c.x < 0) { c.x = 0; c.vx = Math.abs(c.vx) * BOUNCE; }
      if (c.y < 64) { c.y = 64; c.vy = Math.abs(c.vy) * BOUNCE; }
      place(c);
    }
    drawTrails(dt);
    if (busy || particles.length) requestAnimationFrame(step);
    else running = false;
  }
  function emit(c, speed) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const n = Math.min(4, Math.ceil(speed * 1.5));
    for (let i = 0; i < n; i++) {
      particles.push({
        x: c.x + CARD_W / 2 + (Math.random() - 0.5) * CARD_W * 0.7,
        y: c.y + CARD_H / 2 + (Math.random() - 0.5) * CARD_H * 0.7,
        vx: -c.vx * 0.08 + (Math.random() - 0.5) * 0.05,
        vy: -c.vy * 0.08 + (Math.random() - 0.5) * 0.05,
        life: 1, hue: 190 + Math.random() * 90, r: 2 + Math.random() * 4,
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

  // --- network ---------------------------------------------------------------------------------
  async function postJson(path, body, extra = '') {
    const r = await fetch(api(path, extra), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    if (r.status === 401) throw new Error('this link has the wrong key');
    if (!r.ok) throw new Error(`server said ${r.status}`);
    return r.json();
  }
  function putChunk(id, offset, blob) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', api('/api/chunk', `&id=${encodeURIComponent(id)}&offset=${offset}`));
      x.onload = () => {
        let b = {};
        try { b = JSON.parse(x.responseText); } catch {}
        if (x.status === 200) resolve(b);
        else if (x.status === 409) resolve({ received: b.received });
        else reject(new Error(`server said ${x.status}`));
      };
      x.onerror = () => reject(new Error('connection dropped'));
      x.send(blob);
    });
  }
  async function uploadToPhone(blob, name, type, onProgress) {
    const { id } = await postJson('/api/begin', { to: 'phone', name, type, size: blob.size });
    let offset = 0;
    let tries = 0;
    while (offset < blob.size) {
      try {
        const r = await putChunk(id, offset, blob.slice(offset, offset + CHUNK));
        offset = r.received;
        tries = 0;
        onProgress && onProgress(offset / blob.size);
      } catch (err) {
        if (++tries > 4) { fetch(api('/api/cancel', `&id=${id}`), { method: 'POST' }).catch(() => {}); throw err; }
        await new Promise((r) => setTimeout(r, 800 * 2 ** tries));
      }
    }
    return postJson('/api/end', {}, `&id=${encodeURIComponent(id)}`);
  }

  // Throwing back: the card flies out right, uploads, and is gone once the phone has it queued.
  async function throwToPhone(c) {
    c.leaving = true;
    c.el.style.transition = 'transform 220ms ease-in, opacity 220ms ease-in';
    c.el.style.transform = `translate3d(${W() + 60}px, ${c.y}px, 0) rotate(18deg)`;
    c.el.style.opacity = '0';
    try {
      const r = c.kind === 'text'
        ? await postJson('/api/text', { to: 'phone', text: c.text })
        : await uploadToPhone(c.blob, c.name, c.type);
      toast(r.waiting ? 'Sent · it lands when Fling is open on your phone' : 'Flung to your phone');
      removeCard(c, false);
    } catch (err) {
      toast(`Couldn't send: ${err.message}`);
      c.el.style.transition = '';
      c.el.style.opacity = '1';
      c.leaving = false;
      c.x = W() - CARD_W - 10;
      c.vx = -1.2;
      c.vy = 0;
      place(c);
      wake();
    }
  }

  // --- arrivals from the phone -------------------------------------------------------------------
  let unseen = 0;
  function nudge(what) {
    if (!document.hidden) return;
    unseen++;
    document.title = `(${unseen}) Fling`;
    try { if (Notification.permission === 'granted') new Notification('Fling', { body: what, icon: '/icon-192.png', tag: 'fling' }); } catch {}
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { unseen = 0; document.title = 'Fling'; } });

  function spawn(d, kind) {
    // Land where the thumb let go, nudged so a burst of files fans out instead of stacking.
    const jitter = (Math.random() - 0.5) * 160;
    const y = Math.max(64, Math.min(H() - CARD_H, (d.fy ?? 0.5) * H() - CARD_H / 2 + jitter));
    const c = {
      id: d.id, kind, name: d.name || 'Text', type: d.type || '', size: d.size || 0, text: d.text,
      x: W() + 30, y, vx: -(1.7 + Math.random() * 1.6), vy: (d.vy || 0) * 0.25, entering: true,
    };
    cards.set(c.id, c);
    makeCard(c);
    if (kind === 'file') { c.el.classList.add('flying'); c.el.style.setProperty('--p', '0'); } else addTools(c);
    wake();
    return c;
  }

  const fetching = new Set();
  function fetchFile(d) {
    if (fetching.has(d.id)) return;
    let c = cards.get(d.id);
    if (c && c.blob) return;
    if (!c) c = spawn(d, 'file');
    fetching.add(d.id);
    Object.assign(c, { name: d.name, type: d.type, size: d.size });
    c.nameEl.textContent = d.name;
    const x = new XMLHttpRequest();
    x.open('GET', api(`/api/dl/${encodeURIComponent(d.id)}`));
    x.responseType = 'blob';
    x.onprogress = (e) => {
      // second half of the ring: phone -> server was the first half
      if (d.size) c.el.style.setProperty('--p', String(0.5 + 0.5 * (e.loaded / d.size)));
    };
    x.onload = () => {
      fetching.delete(d.id);
      if (x.status !== 200) { toast(`${d.name} didn't arrive`); removeCard(c, true); return; }
      c.blob = x.response.type ? x.response : new Blob([x.response], { type: d.type });
      c.el.classList.remove('flying');
      c.el.classList.add('landed');
      c.sub.textContent = fmtSize(d.size);
      fillMedia(c);
      addTools(c);
      saveCard(c);
      fetch(api('/api/got', `&id=${encodeURIComponent(d.id)}`), { method: 'POST' }).catch(() => {});
      nudge(`${d.name} landed`);
    };
    x.onerror = () => { fetching.delete(d.id); toast(`${d.name} didn't arrive — it'll retry`); };
    x.send();
  }

  // --- socket ---------------------------------------------------------------------------------------
  let ws = null;
  let retry = 0;
  function setStatus(state, text) {
    $('status').classList.toggle('on', state === 'on');
    $('status').classList.toggle('bad', state === 'bad');
    $('statusText').textContent = text;
  }
  function connect() {
    if (!key) return;
    if (ws && ws.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}${api('/ws', '&role=desk')}`);
    ws.onopen = () => { retry = 0; setStatus('', 'Waiting for your phone'); };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'peers') {
        setStatus(m.phones > 0 ? 'on' : '', m.phones > 0 ? 'Phone linked' : 'Phone not open · it can still send');
      } else if (m.t === 'incoming') {
        if (!cards.has(m.id)) spawn(m, 'file');
      } else if (m.t === 'progress') {
        const c = cards.get(m.id);
        if (c && m.size) {
          c.el.style.setProperty('--p', String(0.5 * Math.min(1, m.received / m.size)));
          c.sub.textContent = `${fmtSize(m.received)} of ${fmtSize(m.size)}`;
        }
      } else if (m.t === 'arrive') {
        fetchFile(m);
      } else if (m.t === 'cancel') {
        const c = cards.get(m.id);
        if (c && !c.blob) { removeCard(c, true); toast('Transfer cancelled'); }
      } else if (m.t === 'text') {
        if (cards.has(m.id)) return;
        const c = spawn({ ...m, name: 'Text' }, 'text');
        saveCard(c);
        copyText(c);
        nudge('Text landed');
      } else if (m.t === 'delivered') {
        toast('Your phone caught it');
      }
    };
    ws.onclose = () => {
      setStatus('bad', 'Reconnecting… (the server may be waking up)');
      setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++));
    };
    ws.onerror = () => {};
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) connect(); });
  window.addEventListener('online', connect);

  // --- sending files from the laptop ---------------------------------------------------------------
  async function sendFiles(list) {
    for (const f of list) {
      const c = {
        id: 'local-' + Math.random().toString(36).slice(2), kind: 'file', name: f.name, type: f.type || 'application/octet-stream',
        size: f.size, blob: f, x: W() / 2 - CARD_W / 2 + (Math.random() - 0.5) * 120, y: H() / 2 - CARD_H / 2, vx: 0, vy: 0,
      };
      cards.set(c.id, c);
      makeCard(c);
      addTools(c);
      await new Promise((r) => setTimeout(r, 250));
      throwToPhone(c);
    }
  }
  $('sendBtn').addEventListener('click', () => $('files').click());
  $('files').addEventListener('change', () => { if ($('files').files.length) sendFiles([...$('files').files]); $('files').value = ''; });

  let depth = 0;
  window.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    e.preventDefault(); depth++; $('drop').hidden = false;
  });
  window.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) $('drop').hidden = true; });
  window.addEventListener('drop', (e) => {
    depth = 0;
    $('drop').hidden = true;
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    sendFiles([...e.dataTransfer.files]);
  });

  // --- header buttons ---------------------------------------------------------------------------------
  $('pairBtn').addEventListener('click', () => { $('qr').src = api('/api/qr.svg'); $('pair').hidden = false; });
  $('pairClose').addEventListener('click', () => { $('pair').hidden = true; });
  $('pair').addEventListener('click', (e) => { if (e.target === $('pair')) $('pair').hidden = true; });
  $('clearBtn').addEventListener('click', () => {
    for (const c of [...cards.values()]) { c.vy = 1.6 + Math.random(); c.vx = (Math.random() - 0.5) * 0.4; }
    wake();
  });
  if ('Notification' in window && Notification.permission === 'default') {
    $('alertBtn').hidden = false;
    $('alertBtn').addEventListener('click', async () => {
      const p = await Notification.requestPermission();
      $('alertBtn').hidden = true;
      if (p === 'granted') toast("You'll get an alert when something lands while this tab is in the background");
    });
  }

  // --- start --------------------------------------------------------------------------------------------
  resize();
  if (!key) {
    $('locked').hidden = false;
    setStatus('bad', 'Not set up');
    return;
  }
  (async () => {
    const saved = (await allCards()) || [];
    for (const s of saved) {
      const c = { ...s, vx: 0, vy: 0, x: Math.min(s.x, W() - CARD_W), y: Math.min(Math.max(64, s.y), H() - CARD_H) };
      cards.set(c.id, c);
      makeCard(c);
      addTools(c);
    }
    updateEmpty();
    connect();
  })();
})();
