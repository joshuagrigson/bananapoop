# Fling

Fling files between an iPhone and a Windows laptop. Pick photos, videos or files on the phone and fling them left; they fly onto the laptop screen and stay there as cards. Throw a card off the laptop's right edge and it lands on the phone.

## Parts

| Part | Where | Job |
|---|---|---|
| Windows app | `desktop/` (Electron) | Receiver on port 47777, the desk overlay where cards land, the edge tab for sending to the phone, pairing window, tray |
| Phone page | `phone/` | Served by the laptop; add it to the iPhone Home Screen. Pick, fling, catch |
| Anywhere mode | `desktop/tunnel.js` | Free Cloudflare quick tunnel so the phone can reach the laptop from any network |
| Fling Web | `web/` | For laptops where you can't install anything: a relay on Render plus a desk page at `/desk` in the browser. Both sides connect out, so any network works |

## How the connection works

- **Same Wi-Fi:** the phone talks straight to `http://<laptop-ip>:47777`.
- **No Wi-Fi:** the laptop joins the iPhone's Personal Hotspot and the same direct link works, with no internet needed.
- **Different networks:** turn on Anywhere in the pairing window. It gives the laptop a `https://….trycloudflare.com` address. That address changes whenever Fling restarts, so you rescan the code.

Every request carries the pairing key from the QR code. Files are uploaded in 8 MB chunks (the tunnel caps single requests at 100 MB) and land in `Downloads\Fling`.

## On the laptop

- Cards fly in from the right edge while the file uploads; a ring shows progress.
- Drag a card around or throw it. Off the **right edge** sends it to the phone. Off the **bottom** clears it (the file stays in the folder).
- **⇱** on a card: drag it into any app (email, Explorer, Slack). **↗** opens it, **📁** shows it in the folder.
- Drop files on the glowing tab at the right edge to send them to the phone.
- Text and links flung from the phone are copied to the clipboard.

## Build

GitHub Actions (`.github/workflows/fling-desktop.yml`) builds `Fling-Setup-<version>.exe` on every push that touches `fling/` and publishes it to the `fling-latest` release. The installer adds a Windows Firewall rule for TCP 47777 (private and public profiles, because Windows puts the iPhone hotspot under Public).

Local: `cd desktop && npm install && npm test && npm start`.

## Fling Web (no install)

`web/server.js` is a relay that serves the phone page at `/` and the laptop desk at `/desk`. The phone uses the same API as the Windows receiver; the desk is a browser tab where cards land and stay (kept in IndexedDB), with drag-out (⇱), Save, throw-back off the right edge, drop-to-send, and background alerts.

- Pairing key: the `FLING_KEY` environment variable (16+ characters). Open `/desk#k=<key>` once on the laptop; **Pair phone** shows the QR code for the phone.
- Files sit in temporary storage only until the other side picks them up (deleted then, or after a day). Render's free plan wipes that storage whenever the server sleeps, which happens after 15 idle minutes.
- Run locally: `cd web && npm install && FLING_KEY=… npm start`.
