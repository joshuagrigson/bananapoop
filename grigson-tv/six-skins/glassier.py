#!/usr/bin/env python3
"""Glass, glassier: light drift behind the card, specular sheen, refractive rim, saturated frost, grain,
lens highlights, press flash. Glass skin only; everything else untouched."""
R = '/home/user/paper-plate/'
CSS = r'''/* ----- Glass, glassier (2026-11-11). Only when the Glass skin is on. ----- */
/* Light moving behind the glass, so the transparency has something to show. Still if the phone asks for less motion. */
body[data-skin=glass]{position:relative;isolation:isolate}
body[data-skin=glass]::before,body[data-skin=glass]::after{content:'';position:fixed;z-index:-1;border-radius:50%;pointer-events:none;filter:blur(40px);opacity:.9}
body[data-skin=glass]::before{width:70vw;height:70vw;left:-15vw;top:8vh;background:radial-gradient(circle,#e8f1fa 0%,#cfe0ee 35%,#9DB2C600 70%);animation:nxDrift1 18s ease-in-out infinite alternate}
body[data-skin=glass]::after{width:60vw;height:60vw;right:-20vw;bottom:6vh;background:radial-gradient(circle,#7f97b0 0%,#8ea6bd 35%,#9DB2C600 70%);animation:nxDrift2 23s ease-in-out infinite alternate}
@keyframes nxDrift1{from{transform:translate(0,0) scale(1)}to{transform:translate(18vw,14vh) scale(1.15)}}
@keyframes nxDrift2{from{transform:translate(0,0) scale(1)}to{transform:translate(-16vw,-18vh) scale(1.1)}}
@media (prefers-reduced-motion:reduce){body[data-skin=glass]::before,body[data-skin=glass]::after{animation:none}}
/* The card: deeper frost that keeps the colour, a bright top rim, a thicker darker bottom edge, a diagonal sheen, a whisper of grain. */
body[data-skin=glass] #simpleRemote{background:linear-gradient(160deg,rgba(255,255,255,.34) 0%,rgba(240,248,255,.22) 45%,rgba(226,238,250,.30) 100%);
  border:1px solid rgba(255,255,255,.75);
  -webkit-backdrop-filter:blur(18px) saturate(170%) brightness(1.04);backdrop-filter:blur(18px) saturate(170%) brightness(1.04);
  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.85),inset 0 -1px 0 rgba(20,42,64,.16),inset 1px 0 0 rgba(255,255,255,.35),inset -1px 0 0 rgba(255,255,255,.25),0 1px 0 rgba(255,255,255,.25),0 18px 44px rgba(20,42,64,.22),0 2px 6px rgba(20,42,64,.10)}
body[data-skin=glass] #simpleRemote::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;
  background:linear-gradient(115deg,rgba(255,255,255,.42) 0%,rgba(255,255,255,.14) 22%,rgba(255,255,255,0) 40%,rgba(255,255,255,0) 68%,rgba(255,255,255,.12) 86%,rgba(255,255,255,.26) 100%)}
body[data-skin=glass] #simpleRemote::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;opacity:.07;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .9 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>")}
body[data-skin=glass] #simpleRemote .nx-inner{position:relative;z-index:1}
/* Keys and panels: a lit top edge, a dark bottom edge, a sheen that reads as curved glass. */
body[data-skin=glass] #simpleRemote .nx-chrome{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.46) 0%,rgba(244,250,255,.26) 48%,rgba(232,242,252,.30) 100%);border-color:rgba(255,255,255,.78);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(20,42,64,.14),0 4px 10px rgba(20,42,64,.14),0 1px 2px rgba(20,42,64,.08)}
body[data-skin=glass] #simpleRemote .nx-chrome::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(120deg,rgba(255,255,255,.38) 0%,rgba(255,255,255,0) 36%,rgba(255,255,255,0) 72%,rgba(255,255,255,.18) 100%)}
body[data-skin=glass] #simpleRemote .nx-chrome > *{position:relative}
/* Press: the glass lights up, then settles. */
body[data-skin=glass] #simpleRemote button.nx-chrome:active,body[data-skin=glass] #simpleRemote button.nx-chrome.pressed,body[data-skin=glass] #simpleRemote .nx-direction:active,body[data-skin=glass] #simpleRemote .nx-direction.nx-is-pressed{background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(240,248,255,.5));filter:none;transform:scale(.985);box-shadow:inset 0 1px 0 #fff,inset 0 0 18px rgba(255,255,255,.5),0 2px 6px rgba(20,42,64,.12)}
/* Selected things are denser, whiter glass with a soft inner glow instead of a flat fill. */
body[data-skin=glass] #simpleRemote .nx-mode[aria-selected=true],body[data-skin=glass] #simpleRemote .nx-room[aria-pressed=true],body[data-skin=glass] #simpleRemote .nx-input-card[aria-pressed=true],body[data-skin=glass] #simpleRemote .nx-inputs-btn[aria-expanded=true],body[data-skin=glass] #simpleRemote .nx-mute[aria-pressed=true],body[data-skin=glass] #simpleRemote .nx-app-tile[aria-pressed=true]{
  background:linear-gradient(180deg,rgba(255,255,255,.82),rgba(240,248,255,.62));color:var(--text);box-shadow:inset 0 1px 0 #fff,inset 0 0 14px rgba(255,255,255,.55),0 2px 8px rgba(20,42,64,.16)}
/* The pad: a deeper pane with an inner bevel and a caustic highlight in one corner. */
body[data-skin=glass] #simpleRemote .nx-surface{background:linear-gradient(160deg,rgba(255,255,255,.30) 0%,rgba(236,245,253,.18) 50%,rgba(226,238,250,.26) 100%);
  -webkit-backdrop-filter:blur(16px) saturate(160%);backdrop-filter:blur(16px) saturate(160%);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.85),inset 0 -2px 0 rgba(20,42,64,.14),inset 0 0 0 1px rgba(255,255,255,.25),inset 0 10px 30px rgba(255,255,255,.18),0 6px 16px rgba(20,42,64,.16)}
body[data-skin=glass] #simpleRemote .nx-surface::before{background:radial-gradient(ellipse 60% 40% at 18% 12%,rgba(255,255,255,.45) 0%,rgba(255,255,255,0) 70%),linear-gradient(120deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,0) 40%)}
/* D-pad: a thick glass disc with an edge ring, and an OK button that reads as a lens. */
body[data-skin=glass] #simpleRemote .nx-disc{background:radial-gradient(circle at 50% 38%,rgba(255,255,255,.46) 0%,rgba(244,250,255,.30) 55%,rgba(224,236,248,.40) 100%);border-color:rgba(255,255,255,.85);
  -webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.95),inset 0 -3px 6px rgba(20,42,64,.16),inset 0 0 0 calc(6 * var(--u)) rgba(255,255,255,.22),inset 0 0 0 calc(7 * var(--u)) rgba(255,255,255,.5),0 8px 20px rgba(20,42,64,.22),0 1px 0 rgba(255,255,255,.4)}
body[data-skin=glass] #simpleRemote .nx-disc::after{content:'';position:absolute;inset:0;border-radius:50%;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.42) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,0) 70%,rgba(255,255,255,.16) 100%)}
body[data-skin=glass] #simpleRemote .nx-center-select{background:radial-gradient(circle at 38% 28%,rgba(255,255,255,.95) 0%,rgba(248,252,255,.72) 32%,rgba(222,236,250,.62) 70%,rgba(200,218,236,.72) 100%);border-color:rgba(255,255,255,.95);
  box-shadow:inset 0 2px 2px #fff,inset 0 -4px 8px rgba(20,42,64,.18),inset 0 0 0 1px rgba(255,255,255,.6),0 4px 10px rgba(20,42,64,.24),0 0 0 calc(3 * var(--u)) rgba(255,255,255,.28)}
body[data-skin=glass] #simpleRemote .nx-direction{z-index:1}
/* Volume: a glass groove and an orb for a knob. */
body[data-skin=glass] #simpleRemote .nx-meter{background:linear-gradient(180deg,rgba(20,42,64,.16),rgba(255,255,255,.55));box-shadow:inset 0 1px 1px rgba(20,42,64,.18),0 1px 0 rgba(255,255,255,.7);height:calc(8 * var(--u))}
body[data-skin=glass] #simpleRemote .nx-meter-fill{background:linear-gradient(180deg,#5b8cff,#1253FA 55%,#0e42c8);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 10px rgba(18,83,250,.35)}
body[data-skin=glass] #simpleRemote .nx-meter-fill::after{background:radial-gradient(circle at 36% 30%,#fff 0%,#f4f9ff 40%,#d6e4f3 100%);border-color:rgba(255,255,255,.9);box-shadow:inset 0 -2px 4px rgba(20,42,64,.18),0 3px 8px rgba(20,42,64,.3),0 0 0 1px rgba(255,255,255,.5)}
/* Round header keys: small lenses too. */
body[data-skin=glass] #simpleRemote .nx-round{background:radial-gradient(circle at 40% 30%,rgba(255,255,255,.7) 0%,rgba(244,250,255,.34) 50%,rgba(226,238,250,.40) 100%)}
/* Source row app badge gets a glass cap over its colour. */
body[data-skin=glass] #simpleRemote .nx-app-badge{box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -1px 0 rgba(0,0,0,.25),0 2px 5px rgba(20,42,64,.25);background-image:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,0) 55%)}
/* Dropdowns and sheets: the same material, denser so text stays crisp. */
body[data-skin=glass] #simpleRemote .nx-rooms,body[data-skin=glass] #simpleRemote .nx-inputs-panel,body[data-skin=glass] #simpleRemote .nx-sheet-card{background:linear-gradient(180deg,rgba(248,252,255,.94),rgba(236,244,252,.9));border-color:rgba(255,255,255,.9);box-shadow:inset 0 1px 0 #fff,0 16px 40px rgba(20,42,64,.28)}
'''
for p in ['TVRemote/Web/remote.html', 'TVRemoteAndroid/app/src/main/assets/remote.html']:
    s = open(R + p).read()
    anchor = '/* SWITCH TO sheet */\n'
    assert s.count(anchor) == 1, p
    assert '/* ----- Glass, glassier' not in s, p
    s = s.replace(anchor, CSS + anchor)
    open(R + p, 'w').write(s); print('patched', p)
