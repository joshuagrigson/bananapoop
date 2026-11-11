# Generation notes

Created and edited with the built-in image generation tool; no fallback CLI. The PNGs are concept artwork. Implementation dimensions in design-spec.json take precedence over small differences in the generated artwork.

## Common layout

Use case: UI layout transfer, preserving theme.
IMAGE 1 IS THE EXACT LAYOUT MASTER (Thumb First). IMAGE 2 IS THE COLOR AND STYLE REFERENCE for the specific output theme. User explicitly requests ALL layouts match Thumb First, but DO NOT CHANGE each theme's colors.
Build the output using IMAGE 1's EXACT component positions, widths, heights, spacing, screen boundaries and two-screen composition. Apply IMAGE 2's colors and control styling onto that fixed layout. Do NOT use image 2's old control positions. Do NOT keep the navy colors of image 1 unless they appear in image 2.
Required top-to-bottom order in BOTH screens:
1. Living room / Connected header, settings and power.
2. Disney+ / Inputs row.
3. FULL-WIDTH Volume 13 SLIDER row, no adjacent Mute.
4. Rewind / Pause / Forward transport row.
5. Trackpad / D-pad mode selector.
6. Large navigation region placed LOW as in Thumb First: left screen is Trackpad, right screen is the subtly raised Soft Hi-Fi circular D-pad.
7. Back / Home / Mute row, three equal buttons.
8. Voice / Apps bottom row.
Match the reference master trackpad size EXACTLY: 456 pixels wide and 300 pixels high in this 1536x1024 board. The trackpad occupies x248..704 and y476..776 approximately. Same 1.52:1 ratio; do not shorten the pad. Both phone UI cards are roughly 504x914, same scale as master. Keep navigation low for thumb reach.
The right D-pad keeps Soft Hi-Fi geometry: circular disc, four fine diagonal quadrant divisions, open line chevrons, raised round OK center, very subtle shadow lift. Recolor to the requested theme.
Preserve faint GREEN glow on the Voice letters AND mic icon, faint RED glow on Mute letters AND muted-speaker icon in both screens. Glow only glyphs, not entire buttons or borders. Keep all labels crisp and all controls visible. Do not introduce extra controls or change labels. Keep the canvas 1536x1024, two complete screens, title centered above. Return only one board for the specified theme.


## Glass Mode

Use case: UI theme edit with locked layout.
Create a sixth skin of this mobile TV remote called "06 / Glass Mode". The attached two-screen board is the exact layout and geometry reference. Preserve the same two-screen composition, all controls, all text, same low thumb-first trackpad/D-pad placement, same trackpad dimensions (456x300 pixels at this 1536x1024 board scale), same circular D-pad geometry, and same screen sizes. Re-skin only.
A real CLEAR GLASS aesthetic: nearly transparent lightly frosted glass screen panels and button surfaces, fine translucent white rim highlights, gentle refraction at rounded edges, soft small shadows and restrained glass depth. The glass should visibly transmit the background rather than look like opaque gray plastic. Use a quiet very soft abstract slate-blue and pale-gray tonal background behind both panels to make transparency readable; no photo, no distracting scenery, no saturated rainbow, no purple AI gradients, no glossy chrome, no excessive bloom. Dark slate highly readable lettering on the light translucent panels. Background remains part of the rendered image, not transparent alpha.
Keep the Soft Hi-Fi-style raised circular D-pad as clear subtly frosted glass: fine diagonal quadrant divisions, open dark line chevrons, a raised round glass OK center and restrained contact shadow. Trackpad is a large clear frosted glass rectangle with legible "Swipe to navigate" and "Tap to select" and the hand icon.
Exact common order: Living room/Connected/settings/power; Disney+/Inputs; full-row Volume 13 slider; rewind/pause/forward; Trackpad/D-pad mode switch; large navigation surface; Back/Home/Mute; Voice/Apps. Left screen Trackpad mode, right screen D-pad mode. Only central navigation differs between screens. Selected mode a slightly denser frosted panel with crisp dark label. Preserve faint GREEN glow only on Voice letters and microphone icon, faint RED glow only on Mute letters and muted-speaker icon. Glyphs remain crisp; no glowing whole buttons. Premium and physically plausible clear glass, practical legibility, no extra text. Title "06 / Glass Mode" centered above. Entire two-screen board, 1536x1024, no cropping.

## Voice / Mute refinement

Use case: precise-object-edit, UI mockup.
Edit this existing remote app concept image with a very small targeted visual change. In BOTH screens shown (Trackpad and D-pad), give the exact word "Voice" AND its microphone emblem a FAINT GREEN GLOW, and give the exact word "Mute" AND its crossed-out-speaker emblem a FAINT RED GLOW.
The colored light must follow only the individual letterforms and icon strokes, with a small, soft, subtle halo immediately around them. Keep the letters and icons crisp and readable. Use a restrained green tint for Voice text/icon and a restrained red tint for Mute text/icon, paired with faint matching light. On light themes use sufficiently dark green/red glyphs with a faint colored halo; on dark themes use softly luminous pale green/red glyphs with a faint matching halo. The glow should be visible but delicate and understated.
DO NOT glow or recolor entire button backgrounds or button outlines. DO NOT create bright neon bloom, large haze, saturated filled buttons, or pools of colored light.
Preserve EVERYTHING ELSE exactly: full-width volume slider rows, all layout positions and sizes, all other text, typography, neutral button backgrounds and borders, screen dimensions, title, canvas, palette, source selectors, navigation controls, icons, volume number 13, playback buttons, settings, power, Back, Home and Apps. This is ONLY a subtle text-and-icon color/glow edit to Voice and Mute, in both panels. Return the complete original two-screen presentation at the same framing.

## Combined playback button (latest instruction)

Precise small UI icon edit. In BOTH screens of the attached final remote skin, change ONLY the CENTER playback button currently showing two pause bars to a COMBINED PLAY/PAUSE SYMBOL: one right-pointing filled play triangle followed by two vertical pause bars, centered as one compact icon inside the SAME existing button. The single combined control must clearly communicate both play and pause. Do not split it into two buttons. Preserve the exact center button size, row position, style and colors. If that button has a text label "Pause", replace just that label with "Play/Pause" using the same small readable type; if it has no label, do not add one.
Preserve everything else exactly: board title, both screens, theme colors/materials/glass transparency if present, all UI geometry, the low trackpad of same size, the softly raised circular D-pad, open chevrons, fine quadrant lines, full-row Volume 13 slider above playback, all other icons and text, faint green Voice text/icon glow, faint red Mute text/icon glow. Only the center playback glyph (and existing label if present) changes. Same complete 1536x1024 two-screen board, no cropping or rescaling.

## Final names

Dark Mode, Light Mode, Ivory Mode, Navy Mode, Black/White Mode, Glass Mode.
