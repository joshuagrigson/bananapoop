// 3D icon builders for the three.js styles. makeIcon3D(name, material) -> THREE.Group centred at origin, ~2 units tall.
(function () {
  const T = window.THREE;
  function star(outer, inner, n = 5) {
    const s = new T.Shape();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? inner : outer, a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
    s.closePath(); return s;
  }
  function extrude(shape, depth = 0.35) {
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3 });
    g.center(); return g;
  }
  function box(w, h, d, m, x = 0, y = 0, z = 0) { const me = new T.Mesh(new T.BoxGeometry(w, h, d), m); me.position.set(x, y, z); return me; }

  window.makeIcon3D = function (name, m, m2) {
    const g = new T.Group(); m2 = m2 || m;
    const add = (...ms) => { for (const x of ms) { x.castShadow = true; x.receiveShadow = true; g.add(x); } };
    switch (name) {
      case 'map': {
        for (let i = -1; i <= 1; i++) { const p = box(0.72, 1.6, 0.08, i ? m : m2, i * 0.72, 0, 0); p.rotation.y = i ? i * 0.55 : -0.0; p.position.z = i ? -0.18 : 0; add(p); }
        break; }
      case 'clock': {
        const face = new T.Mesh(new T.CylinderGeometry(1, 1, 0.25, 48), m); face.rotation.x = Math.PI / 2; add(face);
        const ring = new T.Mesh(new T.TorusGeometry(1, 0.08, 16, 64), m2); add(ring);
        add(box(0.09, 0.62, 0.08, m2, 0, 0.28, 0.17), box(0.5, 0.09, 0.08, m2, 0.22, 0, 0.17));
        const pin = new T.Mesh(new T.SphereGeometry(0.08, 16, 16), m2); pin.position.z = 0.2; add(pin);
        break; }
      case 'phone': {
        add(box(1.0, 1.9, 0.14, m));
        const screen = box(0.84, 1.5, 0.02, m2, 0, 0.05, 0.08); add(screen);
        const btn = new T.Mesh(new T.SphereGeometry(0.07, 16, 16), m2); btn.position.set(0, -0.82, 0.08); add(btn);
        break; }
      case 'key': {
        const ring = new T.Mesh(new T.TorusGeometry(0.42, 0.14, 16, 48), m); ring.position.x = -0.65; add(ring);
        add(box(1.3, 0.2, 0.2, m, 0.3, 0, 0), box(0.16, 0.34, 0.2, m2, 0.55, -0.22, 0), box(0.16, 0.28, 0.2, m2, 0.85, -0.2, 0));
        break; }
      case 'star': { add(new T.Mesh(extrude(star(1.05, 0.48)), m)); break; }
      case 'dollar': {
        const coin = new T.Mesh(new T.CylinderGeometry(1, 1, 0.22, 48), m); coin.rotation.x = Math.PI / 2; add(coin);
        const s = new T.Shape(); s.moveTo(-0.12, 0.6); s.lineTo(0.12, 0.6); s.lineTo(0.12, -0.6); s.lineTo(-0.12, -0.6); s.closePath();
        const bar = new T.Mesh(extrude(s, 0.1), m2); bar.position.z = 0.16; add(bar);
        break; }
      default: { // check
        const ring = new T.Mesh(new T.TorusGeometry(1, 0.13, 16, 64), m); add(ring);
        const s = new T.Shape(); s.moveTo(-0.55, 0.02); s.lineTo(-0.15, -0.38); s.lineTo(0.6, 0.45); s.lineTo(0.42, 0.62); s.lineTo(-0.15, -0.02); s.lineTo(-0.38, 0.2); s.closePath();
        add(new T.Mesh(extrude(s, 0.2), m2));
      }
    }
    return g;
  };
})();
