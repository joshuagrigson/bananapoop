// Shared timing core for every scene style.
// A style file defines window.Style = { setup(data), draw(frame) } and includes this script after it.
// The page then exposes window.setData(timeline) and window.seek(t, opt) for render.mjs.
//
// frame = { t, b, local, span, prog, first, built, thumbnail, alpha,
//           headP(i), lineP(i, n), iconP, captionHTML() }
//   b      current block (timeline entry)      local  seconds into the block
//   span   block length incl. gap              prog   0..1 through the SPEECH of the block
//   first  true on the first frame of a new block (rebuild DOM here)
//   alpha  0..1 fade in/out envelope for the whole block
(function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const pad2 = n => String(n).padStart(2, '0');
  window.H = { clamp, ease, pad2 };

  window.ICONS = {
    map:   '<svg viewBox="0 0 100 100"><path d="M10 25 L38 15 L62 25 L90 15 L90 75 L62 85 L38 75 L10 85 Z"/><line x1="38" y1="15" x2="38" y2="75"/><line x1="62" y1="25" x2="62" y2="85"/></svg>',
    clock: '<svg viewBox="0 0 100 100"><circle cx="50" cy="52" r="36"/><polyline points="50,30 50,52 68,62"/><line x1="30" y1="10" x2="42" y2="16"/><line x1="70" y1="10" x2="58" y2="16"/></svg>',
    phone: '<svg viewBox="0 0 100 100"><path d="M30 12 h40 a6 6 0 0 1 6 6 v64 a6 6 0 0 1 -6 6 h-40 a6 6 0 0 1 -6 -6 v-64 a6 6 0 0 1 6 -6 z"/><line x1="42" y1="22" x2="58" y2="22"/><circle cx="50" cy="76" r="4"/><path d="M14 38 q-6 14 0 28"/><path d="M86 38 q6 14 0 28"/></svg>',
    key:   '<svg viewBox="0 0 100 100"><circle cx="32" cy="50" r="18"/><circle cx="32" cy="50" r="5"/><line x1="50" y1="50" x2="90" y2="50"/><line x1="78" y1="50" x2="78" y2="64"/><line x1="90" y1="50" x2="90" y2="60"/></svg>',
    star:  '<svg viewBox="0 0 100 100"><path d="M50 10 L62 38 L92 40 L68 59 L76 88 L50 72 L24 88 L32 59 L8 40 L38 38 Z"/></svg>',
    check: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38"/><polyline points="30,52 44,66 72,36"/></svg>',
    dollar:'<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38"/><path d="M62 36 q-12 -8 -22 0 q-8 10 6 14 q16 4 10 16 q-8 8 -22 0"/><line x1="50" y1="24" x2="50" y2="76"/></svg>',
  };

  let D = null, cache = {}, lastIdx = -1;

  function buildBlock(b) {
    if (cache[b.index]) return cache[b.index];
    const headWords = (b.headline || '').split(/\s+/);
    const words = b.narration.trim().split(/\s+/);
    const chunks = []; let cur = [];
    for (const w of words) { cur.push(w); if (cur.length >= 7 || /[.!?]$/.test(w)) { chunks.push(cur); cur = []; } }
    if (cur.length) chunks.push(cur);
    const totalChars = words.join(' ').length;
    let pos = 0; const timed = [];
    for (const c of chunks) { const rows = []; for (const w of c) { const s = pos / totalChars; pos += w.length + 1; rows.push({ w, s, e: pos / totalChars }); } timed.push(rows); }
    cache[b.index] = { headWords, lines: b.lines || [], iconName: b.icon || 'check', iconSVG: ICONS[b.icon] || ICONS.check, timed };
    return cache[b.index];
  }

  function captionWords(built, prog) {
    const chunk = built.timed.find(rows => prog < rows[rows.length - 1].e) || built.timed[built.timed.length - 1];
    return chunk.map(r => ({ w: r.w, state: prog >= r.e ? 'on' : (prog >= r.s ? 'now' : 'off') }));
  }

  window.setData = (data) => {
    D = data; cache = {}; lastIdx = -1;
    const t1 = document.getElementById('t1'), t2 = document.getElementById('t2'), br = document.getElementById('brand');
    if (t1) t1.textContent = D.title || ''; if (t2) t2.textContent = D.brand || '';
    if (br) br.textContent = (D.brand || '').toUpperCase();
    if (D.accent) document.documentElement.style.setProperty('--accent', D.accent);
    if (Style.setup) Style.setup(D);
  };

  window.seek = (t, opt = {}) => {
    if (!D) return;
    const blocks = D.blocks;
    const b = blocks.find(x => t >= x.start && t < x.end) || (t < blocks[0].start ? null : blocks[blocks.length - 1]);
    const titleCard = !b;
    const title = document.getElementById('title'), frame = document.getElementById('frame');
    if (title) title.hidden = !titleCard;
    if (frame) frame.style.visibility = titleCard ? 'hidden' : 'visible';
    const bar = document.getElementById('bar'); if (bar) bar.style.width = (100 * clamp(t / D.duration, 0, 1)) + '%';
    const counter = document.getElementById('counter');
    if (titleCard) { if (Style.title) Style.title({ t, p: ease(t / 0.6), thumbnail: !!opt.thumbnail }); return; }

    const built = buildBlock(b);
    const first = lastIdx !== b.index; lastIdx = b.index;
    if (first && counter) counter.textContent = `${pad2(b.index + 1)} / ${pad2(blocks.length)}`;
    const local = t - b.start, span = b.end - b.start;
    const thumbnail = !!opt.thumbnail;
    const fadeOut = 1 - ease((local - (span - 0.3)) / 0.3);
    const alpha = thumbnail ? 1 : Math.min(ease(local / 0.35), fadeOut);
    const prog = clamp(local / b.speech, 0, 1.001);
    const n = built.lines.length;
    Style.draw({
      t, b, local, span, prog, first, built, thumbnail, alpha,
      headP: i => thumbnail ? 1 : ease((local - 0.08 * i) / 0.45),
      lineP: i => thumbnail ? 1 : ease((local - (0.9 + (b.speech - 1.2) * (i / Math.max(n, 1)))) / 0.4),
      iconP: thumbnail ? 1 : ease(local / 1.0),
      captionWords: () => captionWords(built, prog),
      captionHTML: () => captionWords(built, prog).map(x => `<span class="w ${x.state}">${x.w}</span>`).join(' '),
    });
  };
})();
