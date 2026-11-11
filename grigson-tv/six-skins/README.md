# Grigson TV — six-skin remote (2026-11-11)

Joshua's handoff (`handoff/`) applied to the live remote page in paper-plate (both page copies) by
`skins-page.py`, which replaced the NEXUS layouts 1–4 block and markup with one shared thumb-first
layout and theme tokens on `<body data-skin>`. Glass is the default; the skin is picked in Settings › Look
and kept in localStorage `skin`. Every button kept its command string and page function.

Renders (390×844, stubbed TV): `skin-*.png`. The script was applied once to the live tree; it is a record,
not a rebuild path (the page keeps moving).
