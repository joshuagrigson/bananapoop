// POSIX path helpers standing in for node:path inside the preview's in-browser station.
const normalize = (p) => {
  const abs = String(p).startsWith('/');
  const out = [];
  for (const seg of String(p).split('/')) { if (!seg || seg === '.') continue; if (seg === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else if (!abs) out.push('..'); } else out.push(seg); }
  return (abs ? '/' : '') + out.join('/') || (abs ? '/' : '.');
};
const join = (...parts) => normalize(parts.filter((x) => x !== '').join('/'));
const resolve = (...parts) => { let p = ''; for (const x of parts) p = String(x).startsWith('/') ? x : p + '/' + x; return normalize(p.startsWith('/') ? p : '/' + p); };
const dirname = (p) => { const n = normalize(p); const i = n.lastIndexOf('/'); return i < 0 ? '.' : i === 0 ? '/' : n.slice(0, i); };
const basename = (p, ext) => { const b = normalize(p).split('/').pop(); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; };
const extname = (p) => { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; };
const path = { sep: '/', join, resolve, normalize, dirname, basename, extname, isAbsolute: (p) => String(p).startsWith('/') };
path.posix = path;
export default path;
export { join, resolve, normalize, dirname, basename, extname };
