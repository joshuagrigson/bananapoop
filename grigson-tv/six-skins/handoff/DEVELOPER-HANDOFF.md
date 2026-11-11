# Remote — developer handoff
Prepared November 11, 2026.

## What is included
Six final visual directions, each shown in Trackpad and D-pad mode. Open START-HERE.html for an offline gallery. The PNG boards are visual references, not working application screens. This package contains no deployed service or connected TV implementation.

## Final requested design
All six themes use the **Navy Mode layout** with each theme's own palette. This shared layout was previously called Thumb First. The common control order is:
1. Living room selector, Connected state, Settings and Power.
2. Current source/app and Inputs.
3. Full-row Volume slider.
4. Rewind, Play/Pause and Forward.
5. Trackpad / D-pad mode selector.
6. Large navigation surface.
7. Back, Home and Mute.
8. Voice and Apps.

The trackpad uses Light Mode's larger proportions across all themes. Every D-pad uses Ivory Mode's continuous circular disc, fine diagonal quadrant lines, open chevrons, raised round OK button and faint contact shadow. Voice lettering AND microphone icon have a faint green glow; Mute lettering AND speaker icon have a faint red glow. Full button surfaces do not glow.

## Source of truth for dimensions
Use **one shared layout component** with theme tokens. Do not build six independently sized layouts.

At a 504 px reference card width, use 24 px horizontal padding and a **456 × 300 px trackpad** (aspect ratio 38:25). At smaller sizes, trackpad width equals the available content width; height equals width × 25/38. Apply the same formula to every theme and keep the navigation area stable when switching modes. Center the circular D-pad within that area; reference diameter 276 px, with OK button diameter about 36% of the disc.

These are implementation dimensions, not a claim that every generated PNG has identical pixel boundaries. Artwork can have small spacing, color and dimensional variations; this shared specification overrides them. Do not measure conflicting dimensions from individual mockups.

Use touch targets of at least 44 × 44 px. Let short screens scroll and respect safe areas instead of squeezing controls. Keep the full-width volume row independent of Mute. Use spacing tokens of 8, 12, 16 and 24 px. The included CSS is a layout/token reference, not a complete application or a tested UI framework.

## Themes
- **Dark Mode:** almost black and charcoal; restrained blue mode accent.
- **Light Mode:** white, pale cool gray and cobalt.
- **Ivory Mode:** warm ivory, espresso and tobacco brown; subtle tactile surfaces.
- **Navy Mode:** deep navy, slate blue and pale icy blue.
- **Black/White Mode:** white, near-black, clear borders and stronger labels.
- **Glass Mode:** clear translucent panels over a quiet slate-blue background, fine white rims, slight frosting and shallow glass shadows; dark readable text.

All six skins share the same structure. Navy Mode is the name of the navy palette. Hex values in design-spec.json/theme-tokens.css are proposed implementation choices matching the visual direction, not exact brand colors sampled from the raster artwork. Recheck contrast during implementation.

## Controls and runtime behavior
**Device / connection.** Living room opens the device/room selector (Office was another original example). “Connected” must reflect an acknowledged device connection. Show pairing, connecting, disconnected and error states. Settings holds device management and preferences. Bind Power to supported device operations; indicate unavailable commands rather than pretending they succeeded.

**Source / Inputs / Apps.** Disney+ is example runtime content, not a hardcoded default. Inputs opens available sources; allow user-friendly HDMI names where supported. Apps lists launchable apps. Keep the current source synchronized with the TV.

**Volume.** Use an actual horizontal slider, with quieter/louder controls at its ends. Obtain range and step from the device. The example value 13 does not establish a 0–100 range. Throttle drag commands and send a final committed value; reconcile with device acknowledgements. Do not blast rapid unlimited commands or display unconfirmed changes as settled state.

**Mute.** Toggle the device's mute state and expose pressed/unpressed state accessibly. The faint red glyph glow is the requested base appearance; it must not be the only indicator of actual muting. Use explicit “Muted”/“Mute” state text or another clear indicator.

**Playback.** Use ONE center button displaying the combined play-triangle and two-pause-bars symbol. Keep both marks visible. Activating this button toggles playback based on acknowledged device state; use the device toggle command when supported. Black/White Mode labels it “Play/Pause.” Expose the actual current/next action to assistive technology without changing the requested combined visible glyph. Rewind/Forward should map to the device's supported seek/scan behavior. Disable unsupported actions and show clear feedback.

**Navigation.** Trackpad swipes issue directional navigation; tap selects. Distinguish a tap from a drag so a completed swipe does not accidentally select. Support pointer cancellation and repeat-rate limits. D-pad has four directions and central OK. Back and Home map to distinct remote commands. Remember the selected navigation mode per user/device.

**Voice.** The faint green lettering/icon glow is decorative base styling, not evidence the microphone is recording. Start voice explicitly; expose Listening, Processing, Error and Stop/Cancel states. Obtain the relevant microphone permission if the chosen implementation actually records audio. Decide whether the adapter invokes device voice functionality or sends recognized text; this depends on the selected platform/TV capabilities.


## Glass Mode implementation
Keep the same geometry as every other skin. Use translucent surfaces, restrained background blur and subtle edge highlights; the backdrop should show through the panels. Keep a stable, quiet slate-blue/gray backdrop so dark labels remain readable. Use a lightly frosted layer under controls, not highly opaque gray blocks. Preserve the raised circular D-pad and faint Voice/Mute glyph glows.

The CSS includes a starting glass treatment and an opaque fallback. These values are implementation starting points, not a claim of optical pixel matching to the artwork. Test contrast over the actual backdrop, reduce effects on constrained devices, and offer a solid-surface alternative when transparency is unavailable or reduced.

## Implementation boundary
Choose native mobile, web or another host before selecting libraries. Implement a device adapter for the actual supported TV protocol/provider. This handoff does not assume a particular vendor, cloud service, discovery method or public API.

An adapter should expose capabilities and normalized current state; support pairing, reconnecting, command acknowledgements and errors; and map navigation, select, back, home, volume, mute, transport, power, source selection, app launch and voice where available. Never hardcode API credentials in a distributable client. Consult the selected provider's current documentation when implementing.

## Accessibility and validation
Use actual buttons and a range input or accessible native equivalents. Give icon-only buttons meaningful names; expose range value, selected mode, mute state and connection status. Provide visible keyboard focus and directional keyboard support. Ensure pointer/touch cancellation works, avoid color-only state indicators and validate contrast after applying theme colors. Glow must not blur legibility.

Before release, verify:
- Same trackpad dimensions and control order in every theme at a given viewport.
- Both navigation modes maintain consistent controls and do not shift the surrounding layout.
- Full-row volume slider, separate Mute, and glyph-only green/red glows.
- No clipping at small screens, large type sizes or device safe areas.
- Correct tap/swipe handling, mode switching, keyboard and assistive-technology behavior.
- Pairing, lost connection, reconnect, stale state, command failure and unsupported features.
- Actual device volume/mute/playback synchronization and explicit voice lifecycle.
- Every remote command works on the supported hardware.

## Assets and ownership of implementation
The six PNG boards were created and revised with the built-in image generation tool. They contain illustrative branding/source labels. Build real UI elements and a consistent vector icon set; do not slice the PNGs into clickable buttons. Obtain production branding assets from the chosen provider where appropriate.

The developer still needs to implement, connect, test and deploy the application. This is a design handoff, not a production-ready connected remote.

