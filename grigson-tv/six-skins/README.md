# Grigson TV — six-skin remote (2026-11-11)

Joshua's handoff (`handoff/`) applied to the live remote page in paper-plate (both page copies) by
`skins-page.py`, which replaced the NEXUS layouts 1–4 block and markup with one shared thumb-first
layout and theme tokens on `<body data-skin>`. Glass is the default; the skin is picked in Settings › Look
and kept in localStorage `skin`. Every button kept its command string and page function.

Renders (390×844, stubbed TV): `skin-*.png`. The script was applied once to the live tree; it is a record,
not a rebuild path (the page keeps moving).

## Round two (2026-11-11, later)
`glassier.py` = the Glass material (drifting light, sheen, rim, grain, lenses, press flash). The fill-screen
unit (`--v`), bold Glass type, raised volume keys, red Power and the 94% D-pad were added inline (see the
paper-plate commit after a026bd2). `sbs-*.png` compare Chat's build-58 Glass with this one; `all-skins-dpad.png`
shows the five other skins with the same layout; `fill-14-*.png` is the shipped Glass at 390x844.
