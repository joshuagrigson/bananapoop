// Fling, phone side. Pick files, fling them left, they land on the laptop.
// Files the laptop throws back slide in at the top.

(() => {
  const $ = (id) => document.getElementById(id);
  const CHUNK = 8 * 1024 * 1024; // the Anywhere tunnel refuses single requests over 100 MB
  const PREFETCH_MAX = 250 * 1024 * 1024;

  // --- pairing ------------------------------------------------------------------
  const hashKey = new URLSearchParams(location.hash.slice(1)).get('k');
  if (hashKey) {
    try { localStorage.setItem('fling.k', hashKey); } catch {}
    history.replaceState(null, '', location.pathname); // keep the key out of screenshots
  }
  let key = hashKey;
  if (!key) { try { key = localStorage.getItem('fling.k'); } catch {} }
  const api = (p, extra = '') => `${p}?k=${encodeURIComponent(key || '')}${extra}`;

  // --- small UI helpers ------------------------------------------------------------
  function toast(text, ms = 2400) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
  }
  function haptic() { try { $('haptic').click(); } catch {} }
  function flare() {
    const b = $('beam');
    b.classList.add('flare');
    setTimeout(() => b.classList.remove('flare'), 260);
  }
  function fmtSize(n) {
    if (!n) return '0 B';
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
    if (/docx?|pages/.test(ext)) return '📄';
    if (/xlsx?|csv|numbers/.test(ext)) return '📊';
    return '📦';
  }
  // The photo picker hands over generic names like "image.jpeg"; give them a real one.
  function niceName(file) {
    const n = file.name || 'file';
    if (!/^(image|video|trim|FullSizeRender)\b/i.test(n)) return n;
    const d = new Date(file.lastModified || Date.now());
    const p = (x) => String(x).padStart(2, '0');
    const ext = n.includes('.') ? n.slice(n.lastIndexOf('.')) : '';
    const kind = (file.type || '').startsWith('video/') ? 'Video' : 'Photo';
    return `${kind} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}${ext}`;
  }

  // --- connection to the laptop -------------------------------------------------------
  let ws = null;
  let laptopName = '';
  let retry = 0;
  let linked = false;

  function setStatus(state, text) {
    const s = $('status');
    s.classList.toggle('on', state === 'on');
    s.classList.toggle('bad', state === 'bad');
    $('statusText').textContent = text;
  }

  function connect() {
    if (!key) return;
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}${api('/ws', '&role=phone')}`);
    ws.onopen = () => { retry = 0; };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'hello') {
        laptopName = m.name || 'laptop';
        linked = true;
        setStatus('on', `Linked · ${laptopName}`);
      } else if (m.t === 'peers') {
        // Fling Web: the laptop side is a browser tab that may be closed.
        linked = m.desks > 0;
        setStatus(linked ? 'on' : 'bad', linked ? 'Laptop tab open' : 'Laptop tab closed · files will wait');
      } else if (m.t === 'cancel') {
        const o = inbound.get(m.id);
        if (o) { o.el.remove(); inbound.delete(m.id); }
      } else if (m.t === 'offer') {
        addInbound({ id: m.id, name: m.name, type: m.type || '', size: m.size || 0 });
      } else if (m.t === 'text') {
        addInbound({ id: m.id || 'txt' + Date.now(), name: 'Text', type: 'text/plain', text: m.text });
      }
    };
    ws.onclose = () => {
      linked = false;
      setStatus('bad', navigator.onLine ? "Can't reach laptop" : 'Offline');
      const wait = Math.min(15000, 1000 * 2 ** retry++);
      setTimeout(connect, wait);
    };
    ws.onerror = () => {};
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) connect(); });
  window.addEventListener('online', connect);
  $('status').addEventListener('click', () => {
    if (!key) return;
    toast(linked ? `Linked to ${laptopName}` : 'Trying again…');
    retry = 0;
    connect();
  });

  // --- the deck --------------------------------------------------------------------------
  const deck = $('deck');
  let items = []; // { file, url, name, type, size, el }
  let textItems = 0;

  function render() {
    for (const it of items) if (!it.el) it.el = makeCard(it);
    items.forEach((it, i) => {
      const depth = items.length - 1 - i; // last item is on top
      const el = it.el;
      el.classList.toggle('top', depth === 0);
      el.style.zIndex = String(10 + i);
      el.style.opacity = depth > 3 ? '0' : '1';
      if (!el.classList.contains('live')) {
        el.style.transform = `translateY(${depth * 12}px) scale(${1 - depth * 0.045}) rotate(${depth ? (depth % 2 ? 2 : -2) : 0}deg)`;
      }
      el.querySelector('.badge').textContent = depth === 0 && items.length > 1 ? `${items.length} ready` : '';
      el.querySelector('.badge').style.display = depth === 0 && items.length > 1 ? '' : 'none';
    });
    $('empty').hidden = items.length > 0;
    $('hint').hidden = items.length === 0;
    $('all').disabled = items.length === 0;
  }

  function makeCard(it) {
    const el = document.createElement('div');
    el.className = 'card';
    const media = document.createElement('div');
    media.className = 'media';
    if (it.text != null) {
      const n = document.createElement('div');
      n.className = 'note';
      n.textContent = it.text.slice(0, 500);
      media.appendChild(n);
    } else if (it.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = it.url;
      img.onerror = () => { media.textContent = glyph(it.type, it.name); media.classList.add('glyph'); };
      media.appendChild(img);
    } else if (it.type.startsWith('video/')) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'metadata';
      v.src = it.url + '#t=0.1';
      media.appendChild(v);
    } else {
      const g = document.createElement('div');
      g.className = 'glyph';
      g.textContent = glyph(it.type, it.name);
      media.appendChild(g);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const nm = document.createElement('div');
    nm.className = 'name';
    nm.textContent = it.name;
    const sz = document.createElement('div');
    sz.className = 'size';
    sz.textContent = it.text != null ? 'Text' : fmtSize(it.size);
    meta.append(nm, sz);
    const badge = document.createElement('div');
    badge.className = 'badge';
    el.append(media, meta, badge);
    bindSwipe(el, it);
    deck.appendChild(el);
    return el;
  }

  function addFiles(list) {
    // The last item is the top card; the first file picked ends up on top.
    for (const f of [...list].reverse()) {
      items.push({ file: f, url: URL.createObjectURL(f), name: niceName(f), type: f.type || '', size: f.size });
    }
    render();
  }

  function removeItem(it) {
    items = items.filter((x) => x !== it);
    if (it.url) setTimeout(() => URL.revokeObjectURL(it.url), 60000);
    if (it.el) setTimeout(() => it.el.remove(), 320);
    render();
  }

  // --- swipe physics on the top card -------------------------------------------------------
  function bindSwipe(el, it) {
    let start = null;
    let hist = [];
    el.addEventListener('pointerdown', (e) => {
      if (!el.classList.contains('top')) return;
      el.setPointerCapture(e.pointerId);
      el.classList.add('live');
      start = { x: e.clientX, y: e.clientY };
      hist = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const now = performance.now();
      hist.push({ x: e.clientX, y: e.clientY, t: now });
      while (hist.length > 2 && now - hist[0].t > 90) hist.shift();
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.06}deg)`;
      el.classList.toggle('go-left', dx < -60);
      el.classList.toggle('go-right', dx > 60);
    });
    const end = (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const a = hist[0];
      const b = hist[hist.length - 1];
      const dt = Math.max(16, b.t - a.t);
      const vx = (b.x - a.x) / dt;
      const vy = (b.y - a.y) / dt;
      start = null;
      el.classList.remove('live', 'go-left', 'go-right');
      const w = window.innerWidth;
      if (vx < -0.45 || dx < -w * 0.33) {
        flingOut(it, e.clientY / window.innerHeight, vy, dy);
      } else if (vx > 0.45 || dx > w * 0.33) {
        el.style.transform = `translate(${w * 1.3}px, ${dy + vy * 200}px) rotate(24deg)`;
        el.style.opacity = '0';
        removeItem(it);
      } else {
        render();
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function flingOut(it, fy, vy, dy = 0) {
    const w = window.innerWidth;
    it.el.classList.remove('live');
    it.el.style.transform = `translate(${-w * 1.4}px, ${dy + vy * 260}px) rotate(-26deg)`;
    it.el.style.opacity = '0';
    haptic();
    flare();
    queueSend({ ...it, fy: Math.max(0, Math.min(1, fy)), vy });
    removeItem(it);
  }

  $('all').addEventListener('click', () => {
    const list = items.slice().reverse(); // top first
    list.forEach((it, i) => setTimeout(() => flingOut(it, 0.25 + 0.5 * Math.random(), (Math.random() - 0.5) * 0.6), i * 140));
  });

  // --- sending --------------------------------------------------------------------------------
  const queue = [];
  let sending = false;
  let wakeLock = null;

  function queueSend(it) {
    if (!key) { toast('Scan the QR code on your laptop first'); return; }
    queue.push(it);
    pump();
  }

  async function pump() {
    if (sending) return;
    sending = true;
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
    while (queue.length) {
      const it = queue.shift();
      try {
        const r = it.text != null ? await sendText(it) : await sendFile(it);
        toast(r && r.waiting ? 'Sent · it lands when the laptop tab is open' : `Landed on ${laptopName || 'laptop'} ✓`, r && r.waiting ? 3200 : 1600);
      } catch (err) {
        toast(`Didn't land: ${it.name} — ${err.message || err}`, 4000);
      }
    }
    $('outbox').hidden = true;
    try { await wakeLock?.release(); } catch {}
    wakeLock = null;
    sending = false;
  }

  async function postJson(path, body, extra = '') {
    const r = await fetch(api(path, extra), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    if (r.status === 401) throw new Error('not paired — rescan the code');
    if (!r.ok) throw new Error(`laptop said ${r.status}`);
    return r.json();
  }

  function putChunk(id, offset, blob, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', api('/api/chunk', `&id=${encodeURIComponent(id)}&offset=${offset}`));
      x.upload.onprogress = (e) => onProgress(e.loaded);
      x.onload = () => {
        let body = {};
        try { body = JSON.parse(x.responseText); } catch {}
        if (x.status === 200) resolve(body);
        else if (x.status === 409) resolve({ resync: body.received });
        else reject(new Error(`laptop said ${x.status}`));
      };
      x.onerror = () => reject(new Error('connection dropped'));
      x.ontimeout = () => reject(new Error('timed out'));
      x.timeout = 5 * 60 * 1000;
      x.send(blob);
    });
  }

  function showOut(name, done, total, sub) {
    $('outbox').hidden = false;
    $('outName').textContent = name;
    const pct = total ? Math.floor((done / total) * 100) : 100;
    $('outPct').textContent = `${pct}%`;
    $('outBar').style.width = `${pct}%`;
    $('outSub').textContent = sub || (queue.length ? `${queue.length} more after this · keep Fling open` : 'Keep Fling open until it lands');
  }

  async function sendFile(it) {
    const { id } = await postJson('/api/begin', { name: it.name, type: it.type, size: it.size, fy: it.fy, vy: it.vy });
    let offset = 0;
    let tries = 0;
    const t0 = performance.now();
    showOut(it.name, 0, it.size);
    while (offset < it.size) {
      const blob = it.file.slice(offset, offset + CHUNK);
      try {
        const r = await putChunk(id, offset, blob, (loaded) => {
          const done = offset + loaded;
          const secs = (performance.now() - t0) / 1000;
          const rate = secs > 0.5 ? `${fmtSize(done / secs)}/s` : '';
          showOut(it.name, done, it.size, rate ? `${fmtSize(done)} of ${fmtSize(it.size)} · ${rate}` : undefined);
        });
        offset = r.resync != null ? r.resync : r.received;
        tries = 0;
      } catch (err) {
        if (++tries > 4) {
          fetch(api('/api/cancel', `&id=${encodeURIComponent(id)}`), { method: 'POST' }).catch(() => {});
          throw err;
        }
        await new Promise((r) => setTimeout(r, 800 * 2 ** tries));
      }
    }
    const r = await postJson('/api/end', {}, `&id=${encodeURIComponent(id)}`);
    showOut(it.name, 1, 1, 'Landed ✓');
    return r;
  }

  async function sendText(it) {
    showOut('Text', 0, 1);
    return postJson('/api/text', { text: it.text, fy: it.fy, vy: it.vy });
  }

  // --- picking -------------------------------------------------------------------------------
  const input = $('files');
  const openPicker = () => { if (!key) { toast('Scan the QR code on your laptop first'); return; } input.click(); };
  $('pick').addEventListener('click', openPicker);
  $('pickBig').addEventListener('click', openPicker);
  input.addEventListener('change', () => {
    if (input.files && input.files.length) addFiles([...input.files]);
    input.value = '';
  });

  // --- text --------------------------------------------------------------------------------------
  $('textBtn').addEventListener('click', async () => {
    if (!key) { toast('Scan the QR code on your laptop first'); return; }
    $('textSheet').hidden = false;
    const ta = $('textIn');
    ta.value = '';
    try { if (navigator.clipboard?.readText) ta.value = await navigator.clipboard.readText(); } catch {}
    ta.focus();
  });
  $('textCancel').addEventListener('click', () => { $('textSheet').hidden = true; });
  $('textSend').addEventListener('click', () => {
    const text = $('textIn').value;
    $('textSheet').hidden = true;
    if (!text.trim()) return;
    const it = { text, name: 'Text', type: 'text/plain', size: text.length, id: 't' + ++textItems };
    items.push(it);
    render();
    setTimeout(() => flingOut(it, 0.4, 0), 220);
  });

  // --- laptop -> phone -------------------------------------------------------------------------
  const inbound = new Map();

  function addInbound(o) {
    if (inbound.has(o.id)) return;
    $('inbound').hidden = false;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'in-card';
    const th = document.createElement('div');
    th.className = 'in-thumb';
    th.textContent = o.text != null ? '💬' : glyph(o.type, o.name);
    const nm = document.createElement('div');
    nm.className = 'in-name';
    nm.textContent = o.name;
    const ring = document.createElement('div');
    ring.className = 'ring';
    card.append(th, nm, ring);
    $('inboundRow').prepend(card);
    o.el = card;
    o.thumb = th;
    inbound.set(o.id, o);
    haptic();
    toast(o.text != null ? 'Text from laptop' : `${o.name} from laptop`);
    card.addEventListener('click', () => openInbound(o));
    if (o.text != null) card.classList.add('ready');
    else prefetch(o);
  }

  // Download in the background so tapping can open the share sheet right away (iOS needs the tap).
  function prefetch(o) {
    if (o.size > PREFETCH_MAX) { o.el.classList.add('ready'); return; }
    const x = new XMLHttpRequest();
    x.open('GET', api(`/api/dl/${encodeURIComponent(o.id)}`));
    x.responseType = 'blob';
    x.onprogress = (e) => { if (o.size) o.el.style.setProperty('--p', String(e.loaded / o.size)); };
    x.onload = () => {
      if (x.status !== 200) { o.el.classList.add('ready'); return; }
      o.blob = x.response;
      o.el.classList.add('ready');
      if (o.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(o.blob);
        o.thumb.textContent = '';
        o.thumb.appendChild(img);
      }
    };
    x.onerror = () => o.el.classList.add('ready');
    x.send();
  }

  function markGot(o) {
    if (o.text == null) fetch(api('/api/got', `&id=${encodeURIComponent(o.id)}`), { method: 'POST' }).catch(() => {});
  }

  async function openInbound(o) {
    if (o.blob && navigator.canShare) {
      const file = new File([o.blob], o.name, { type: o.type || o.blob.type });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          markGot(o);
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
    }
    showViewer(o);
  }

  function showViewer(o) {
    const media = $('viewerMedia');
    media.textContent = '';
    const dl = $('viewerDl');
    const tip = $('viewerTip');
    const src = o.blob ? URL.createObjectURL(o.blob) : api(`/api/dl/${encodeURIComponent(o.id)}`, '&inline=1');
    if (o.text != null) {
      const n = document.createElement('div');
      n.className = 'note';
      n.textContent = o.text;
      media.appendChild(n);
      tip.textContent = '';
      dl.textContent = 'Copy';
      dl.removeAttribute('href');
      dl.onclick = (e) => { e.preventDefault(); copyText(o.text); };
    } else {
      if (o.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = src;
        media.appendChild(img);
        tip.textContent = 'Press and hold the picture → Save to Photos';
      } else if (o.type.startsWith('video/')) {
        const v = document.createElement('video');
        v.src = src;
        v.controls = true;
        v.playsInline = true;
        media.appendChild(v);
        tip.textContent = 'Tap Download, then save it from the Files app';
      } else {
        const g = document.createElement('div');
        g.style.cssText = 'font-size:64px;padding:30px';
        g.textContent = glyph(o.type, o.name);
        media.appendChild(g);
        tip.textContent = o.name;
      }
      dl.textContent = 'Download';
      dl.href = api(`/api/dl/${encodeURIComponent(o.id)}`);
      dl.setAttribute('download', o.name);
      dl.onclick = () => markGot(o);
    }
    $('viewer').hidden = false;
  }
  $('viewerClose').addEventListener('click', () => { $('viewer').hidden = true; $('viewerMedia').textContent = ''; });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      document.execCommand('copy');
      ta.remove();
    }
    toast('Copied');
  }

  // --- start --------------------------------------------------------------------------------------
  if (!key) {
    $('unpaired').hidden = false;
    $('deck').hidden = true;
    setStatus('bad', 'Not paired');
  } else {
    setStatus('', 'Connecting…');
    connect();
  }
  render();
})();
