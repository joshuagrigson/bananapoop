// The two pieces of node:crypto the engine uses, for the preview's in-browser station: random ids and a SHA-1 digest
// (the CSV importer's fingerprint for rows that carry no transaction id).
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
function randomBytes(n) {
  const u8 = new Uint8Array(n);
  crypto.getRandomValues(u8);
  return { length: n, toString: (enc) => (enc === 'hex' ? hex(u8) : String.fromCharCode(...u8)) };
}
function sha1(bytes) {
  const ml = bytes.length * 8;
  const withOne = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withOne.set(bytes); withOne[bytes.length] = 0x80;
  const dv = new DataView(withOne.buffer);
  dv.setUint32(withOne.length - 4, ml >>> 0); dv.setUint32(withOne.length - 8, Math.floor(ml / 2 ** 32));
  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  for (let off = 0; off < withOne.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
    for (let i = 0; i < 80; i++) {
      const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999] : i < 40 ? [b ^ c ^ d, 0x6ed9eba1] : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, '0')).join('');
}
function createHash(alg) {
  if (String(alg).toLowerCase() !== 'sha1') throw new Error(`the preview only carries sha1, not ${alg}`);
  let buf = '';
  const h = { update: (s) => { buf += String(s); return h; }, digest: () => sha1(new TextEncoder().encode(buf)) };
  return h;
}
export default { randomBytes, createHash };
export { randomBytes, createHash };
