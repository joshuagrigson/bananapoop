# NEXUS remote (Smoky Silver / Black) — mock

Joshua's 2026-11-07 redesign of the Grigson TV remote screen, built from his
handoff package as a runnable mock. It is a local demo: no TV, no network, no
microphone. The real app is the Swift/Android WebView shell in
`joshuagrigson/paper-plate` (branch `claude/tv-remote`, page
`TVRemote/Web/remote.html`); nothing there has been changed yet.

## Files

| File | Purpose |
|---|---|
| `NEXUS-Remote.html` | Standalone offline page: HTML, CSS, SVG icons and logic inline. Open it directly. `?mode=dpad` starts in D-pad; `?compare=1` shows both states side by side. |
| `index.html` + `styles.css` + `gesture-core.js` + `app.js` | The same interface as editable source files. `build.py` rebuilds the standalone from them. |
| `adapter.example.js` | The command contract for wiring the UI to the real TV service (`NexusRemote.setAdapter`, `NexusRemote.setState`). |
| `assets/approved-reference-black.png` | The design target (1328 × 1184, Trackpad left, D-pad right). |
| `tests/gesture-core.test.cjs` | 6 dependency-free gesture-logic tests (quick swipe = one move, extras by distance; slow pull steps as it creeps). |
| `tests/browser.test.cjs` | Playwright checks: mode isolation, stable layout, select routing, volume, tap-select, host state, no horizontal overflow. Writes `previews/`. |
| `previews/` | Screenshots produced by the browser test in this environment. |

## Validation record (2026-11-07, this repo)

```
node --check app.js                      OK
node --test tests/gesture-core.test.cjs  7 passed, 0 failed
node tests/browser.test.cjs              PASS (8 checks), previews written
```

The handoff shipped with the browser test unrun (Chromium was blocked where
it was authored). It passes here. `previews/code-comparison.png` is the
rendered code; compare it against `assets/approved-reference-black.png`.

## Wiring it into the real app (not done yet)

`remote.html` in paper-plate talks to Swift through
`window.webkit.messageHandlers.tv.postMessage(command)` and keeps a serial
`send()` queue; the Android page does the same through its bridge. The NEXUS
UI emits `{type, value, roomId, source}` commands through one adapter, so the
integration is one function: map `navigate/select/volume/power/mute/
playPause/rewind/fastForward/back/home/input/room/voice/apps` onto the
command strings `remote.html` already sends, and feed confirmed TV state back
with `NexusRemote.setState`. Rooms are `living` (LG) and `office` (Vizio);
the Vizio has no cursor, so the Trackpad tab should be hidden on Office.

## Integration (done 2026-11-07, paper-plate branch `claude/nexus-remote`)

`integrate-paper-plate.py` is the script that replaced the Simple layout in both
`TVRemote/Web/remote.html` and `TVRemoteAndroid/app/src/main/assets/remote.html`
with this design (run it with `styles.css` and the two pages as arguments). It
keeps every existing command string and page function, moves the smart row under
the status row, and leaves the full remote untouched. `previews/live-app-390.png`
is the patched iPhone page rendered with a stubbed TV bridge.

Patch order for a fresh rebuild from paper-plate d285b38: `integrate-paper-plate.py` (NEXUS layout), then `xbox-id-patch.py` (Xbox client ID in Settings, centred 10), then `all-in-settings-patch.py` (ALL screen inside Settings).
