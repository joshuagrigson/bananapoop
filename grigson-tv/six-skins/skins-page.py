#!/usr/bin/env python3
"""Six-skin remote (Joshua's 2026-11-11 handoff): one shared thumb-first layout with theme tokens,
Glass by default, skin picked in Settings. Every data-c / data-fn, id and page function stays."""
import re, sys
R = '/home/user/paper-plate/'

CSS = r'''/* ===== Six-skin remote (Joshua's handoff 2026-11-11). One layout, theme tokens on <body data-skin>. Art unit --u = 1/504 of the card; nxFit() pins it once per launch. ===== */
body[data-skin]{font-family:system-ui,-apple-system,"SF Pro Text","Segoe UI",Roboto,sans-serif;background:var(--canvas);color:var(--text)}
body[data-skin=dark]{color-scheme:dark;--canvas:#080A0C;--surface:#101316;--control:#24282C;--text:#F5F5F2;--muted:#A8AFB6;--accent:#4F9CF5;--on-accent:#08121F;--border:#383D43;--voice:#C5F6CF;--mute:#FFB7B7;--vol:#1253FA;--knob:#fff;--shadow:0 3px 7px rgb(0 0 0/35%);--field:#17191c;--divider:#2a2e33}
body[data-skin=light]{color-scheme:light;--canvas:#F8FAFC;--surface:#FFFFFF;--control:#EAF0F5;--text:#111827;--muted:#526171;--accent:#124CF0;--on-accent:#FFFFFF;--border:#CFD8E2;--voice:#145C2B;--mute:#A51B1B;--vol:#1253FA;--knob:#fff;--shadow:0 3px 7px rgb(17 24 39/10%);--field:#F3F6F9;--divider:#E3E9EF}
body[data-skin=ivory]{color-scheme:light;--canvas:#E7DDD2;--surface:#F7EFE3;--control:#F4EBDD;--text:#4C2A14;--muted:#79604A;--accent:#603317;--on-accent:#FFF9F0;--border:#DED0BE;--voice:#245327;--mute:#A01C18;--vol:#603317;--knob:#FFF9F0;--shadow:0 3px 7px rgb(76 42 20/14%);--field:#FBF5EC;--divider:#E8DCCB}
body[data-skin=navy]{color-scheme:dark;--canvas:#061127;--surface:#0C1B33;--control:#354F70;--text:#F6F8FF;--muted:#B8C7DC;--accent:#B5E6FA;--on-accent:#082137;--border:#486787;--voice:#C8FFE0;--mute:#FFB8B8;--vol:#1253FA;--knob:#fff;--shadow:0 3px 7px rgb(0 0 0/35%);--field:#13264a;--divider:#24395a}
body[data-skin=bw]{color-scheme:light;--canvas:#FFFFFF;--surface:#FFFFFF;--control:#F5F6F7;--text:#08090A;--muted:#444B55;--accent:#08090A;--on-accent:#FFFFFF;--border:#979FA9;--voice:#135323;--mute:#991515;--vol:#1253FA;--knob:#fff;--shadow:0 2px 5px rgb(0 0 0/12%);--field:#F5F6F7;--divider:#D7DBE0}
body[data-skin=glass]{color-scheme:light;--canvas:#9DB2C6;--surface:rgba(240,248,255,.28);--control:rgba(240,248,255,.30);--text:#172333;--muted:#344456;--accent:rgba(239,248,255,.68);--on-accent:#172333;--border:rgba(255,255,255,.68);--voice:#17552B;--mute:#9A3330;--vol:#1253FA;--knob:#fff;--shadow:0 3px 7px rgb(20 42 64/15%);--field:rgba(255,255,255,.42);--divider:rgba(255,255,255,.55);
  background:radial-gradient(ellipse 70% 50% at 20% 15%,#c9d9e8 0%,#9DB2C600 60%),radial-gradient(ellipse 60% 45% at 85% 70%,#b7c8d9 0%,#9DB2C600 60%),radial-gradient(ellipse 50% 40% at 50% 100%,#8aa0b6 0%,#9DB2C600 70%),#9DB2C6;background-attachment:fixed}
/* The card */
#simpleRemote{display:none;position:relative;--u:min(calc((100vw - 32px) / 504),1px);width:calc(504 * var(--u));max-width:100%;
  --s8:calc(8 * var(--u));--s12:calc(12 * var(--u));--s16:calc(16 * var(--u));--s24:calc(24 * var(--u));--r:calc(18 * var(--u));--press-ms:110ms;
  border-radius:calc(34 * var(--u));background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow),0 14px 36px rgb(0 0 0/14%);color:var(--text)}
body[data-skin=glass] #simpleRemote{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:inset 0 1px 0 rgb(255 255 255/55%),0 6px 18px rgb(20 42 64/14%)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){body[data-skin=glass] #simpleRemote{background:#DCE7F0}}
#simpleRemote .nx-inner{padding:var(--s24);font-size:calc(17 * var(--u));display:flex;flex-direction:column;gap:var(--s16)}
#simpleRemote button{height:auto;min-height:0;border:0;border-radius:0;background:none;box-shadow:none;color:inherit;font:inherit;font-weight:500;letter-spacing:0;padding:0;touch-action:manipulation;transition:filter 110ms,transform 110ms;-webkit-tap-highlight-color:transparent}
#simpleRemote button:active,#simpleRemote button.pressed{filter:brightness(.92);transform:scale(.985)}
body[data-skin=dark] #simpleRemote button:active,body[data-skin=navy] #simpleRemote button:active,body[data-skin=dark] #simpleRemote button.pressed,body[data-skin=navy] #simpleRemote button.pressed{filter:brightness(1.18)}
#simpleRemote h1,#simpleRemote h2,#simpleRemote p{margin:0}
#simpleRemote #nxSmart,#simpleRemote #smartRow{display:none}
#simpleRemote .nx-icon{width:1.2em;height:1.2em;vertical-align:middle;flex-shrink:0;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
/* Control surface: every key, tile and panel */
#simpleRemote .nx-chrome{background:var(--control);border:1px solid var(--border);box-shadow:var(--shadow);border-radius:var(--r)}
body[data-skin=glass] #simpleRemote .nx-chrome{box-shadow:inset 0 1px 0 rgb(255 255 255/55%),0 3px 7px rgb(20 42 64/15%)}
body[data-skin=bw] #simpleRemote .nx-chrome{box-shadow:none}
#simpleRemote .nx-key{display:flex;align-items:center;justify-content:center;gap:calc(10 * var(--u));height:calc(56 * var(--u));font-size:calc(19 * var(--u));font-weight:500}
/* 1. Header: room ▾ + Connected, gear, power */
#simpleRemote .nx-header{display:flex;align-items:center;gap:var(--s12);height:calc(56 * var(--u));position:relative}
#simpleRemote .nx-room-btn{display:flex;flex-direction:column;align-items:flex-start;gap:calc(4 * var(--u));flex:1;min-width:0;text-align:left}
#simpleRemote .nx-room-name{display:flex;align-items:center;gap:calc(8 * var(--u));font-size:calc(26 * var(--u));font-weight:700;letter-spacing:-.01em;max-width:100%}
#simpleRemote .nx-room-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#simpleRemote .nx-room-name .nx-chev{width:calc(16 * var(--u));height:calc(16 * var(--u));stroke-width:2.2;opacity:.85;flex:0 0 auto}
#simpleRemote .nx-room-btn.nx-one .nx-chev{display:none}
#simpleRemote .nx-conn{display:flex;align-items:center;gap:calc(8 * var(--u));font-size:calc(15 * var(--u));color:var(--muted)}
#simpleRemote .nx-dot{width:calc(10 * var(--u));height:calc(10 * var(--u));border-radius:50%;background:#2ECC71;box-shadow:0 0 6px rgb(46 204 113/55%);display:inline-block;flex:0 0 auto}
#simpleRemote .nx-dot.nx-off{background:var(--muted);box-shadow:none;opacity:.6}
#simpleRemote .nx-round{width:calc(56 * var(--u));height:calc(56 * var(--u));border-radius:50%;display:grid;place-items:center;font-size:calc(22 * var(--u));flex:0 0 auto}
#simpleRemote .nx-power[aria-pressed=true]{color:var(--text)}
#simpleRemote .nx-power[aria-pressed=false]{color:var(--muted)}
#simpleRemote .nx-rooms{position:absolute;left:0;top:calc(100% + var(--s8));z-index:20;min-width:60%;max-width:100%;display:flex;flex-direction:column;padding:calc(6 * var(--u));gap:calc(4 * var(--u));background:var(--surface);border:1px solid var(--border);border-radius:var(--r);box-shadow:0 12px 30px rgb(0 0 0/22%)}
body[data-skin=glass] #simpleRemote .nx-rooms{background:rgba(236,244,252,.88);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
#simpleRemote .nx-rooms[hidden]{display:none}
#simpleRemote .nx-room{height:calc(48 * var(--u));padding:0 var(--s16);border-radius:calc(12 * var(--u));text-align:left;font-size:calc(18 * var(--u));white-space:nowrap;display:flex;align-items:center;justify-content:space-between;gap:var(--s12)}
#simpleRemote .nx-room[aria-pressed=true]{background:var(--accent);color:var(--on-accent);font-weight:600}
#simpleRemote .nx-room[aria-pressed=true]::after{content:'\2713';font-size:.9em}
/* 2. Source | Inputs */
#simpleRemote .nx-source{display:flex;align-items:center;height:calc(52 * var(--u));padding:0 calc(6 * var(--u)) 0 calc(8 * var(--u));border-radius:var(--r)}
#simpleRemote .nx-source-main{flex:1;min-width:0;display:flex;align-items:center;gap:calc(12 * var(--u));height:100%;padding:0 calc(4 * var(--u));cursor:pointer;text-align:left}
#simpleRemote .nx-app-badge{width:calc(40 * var(--u));height:calc(40 * var(--u));border-radius:calc(10 * var(--u));display:grid;place-items:center;font-size:calc(16 * var(--u));font-weight:700;color:#fff;background:#1B2B4A;flex:0 0 auto;box-shadow:inset 0 1px 0 rgb(255 255 255/18%)}
#simpleRemote .nx-status-source{font-size:calc(19 * var(--u));font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#simpleRemote .nx-status-alias{color:var(--muted);font-size:calc(15 * var(--u));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#simpleRemote .nx-status-alias:empty{display:none}
#simpleRemote .nx-source .nx-chev{width:calc(16 * var(--u));height:calc(16 * var(--u));margin-left:auto;opacity:.6;flex:0 0 auto}
#simpleRemote .nx-vsep{width:1px;height:60%;background:var(--divider);margin:0 calc(8 * var(--u));flex:0 0 auto}
#simpleRemote .nx-inputs-btn{display:flex;align-items:center;gap:calc(10 * var(--u));height:100%;padding:0 calc(12 * var(--u)) 0 calc(8 * var(--u));font-size:calc(19 * var(--u));font-weight:500;border-radius:calc(12 * var(--u));flex:0 0 auto}
#simpleRemote .nx-inputs-btn[aria-expanded=true]{background:var(--accent);color:var(--on-accent)}
#simpleRemote .nx-inputs-panel{position:absolute;left:var(--s24);right:var(--s24);top:calc(24px + 56 * var(--u) + 16 * var(--u) + 60 * var(--u));z-index:15;padding:var(--s12);display:flex;flex-direction:column;gap:var(--s12);box-shadow:0 14px 34px rgb(0 0 0/24%)}
body[data-skin=glass] #simpleRemote .nx-inputs-panel{background:rgba(236,244,252,.9);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
#simpleRemote .nx-inputs-panel[hidden]{display:none}
#simpleRemote .nx-inputs-heading{display:flex;align-items:center;justify-content:space-between;height:calc(28 * var(--u))}
#simpleRemote .nx-inputs-heading h2{font-size:calc(15 * var(--u));font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
#simpleRemote .nx-edit{display:flex;align-items:center;gap:.4em;font-size:calc(16 * var(--u));color:var(--accent)}
body[data-skin=glass] #simpleRemote .nx-edit{color:var(--text)}
#simpleRemote .nx-inputs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s8)}
#simpleRemote .nx-input-card{position:relative;overflow:hidden;height:calc(72 * var(--u));border-radius:calc(14 * var(--u));padding:calc(4 * var(--u)) calc(3 * var(--u));display:flex;align-items:center;justify-content:center;flex-direction:column;font-size:calc(15 * var(--u));line-height:1.15;font-weight:500}
#simpleRemote .nx-input-card > .nx-icon{width:calc(30 * var(--u));height:calc(20 * var(--u));stroke-width:1.6}
#simpleRemote .nx-input-card .nx-port{color:var(--muted);font-size:calc(12 * var(--u))}
#simpleRemote .nx-input-card .nx-name{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#simpleRemote .nx-input-card[aria-pressed=true]{background:var(--accent);color:var(--on-accent);border-color:transparent}
#simpleRemote .nx-input-card[aria-pressed=true] .nx-port{color:inherit;opacity:.75}
#simpleRemote .nx-led{position:absolute;top:calc(7 * var(--u));right:calc(8 * var(--u));width:calc(8 * var(--u));height:calc(8 * var(--u));border-radius:50%;background:#2ECC71;box-shadow:0 0 6px rgb(46 204 113/70%)}
#simpleRemote .nx-hidden-count{text-align:center;font-size:calc(13 * var(--u));color:var(--muted);margin:0}
#simpleRemote .nx-hidden-count:empty{display:none}
/* 3. Volume: label, then quieter | slider | louder */
#simpleRemote .nx-volume-row{display:flex;flex-direction:column;gap:calc(6 * var(--u));height:calc(72 * var(--u));justify-content:center}
#simpleRemote .nx-volume-label{display:flex;align-items:baseline;gap:calc(6 * var(--u));font-size:calc(16 * var(--u));color:var(--muted);padding-left:calc(14 * var(--u))}
#simpleRemote .nx-volume-number{font-size:calc(19 * var(--u));font-weight:700;color:var(--text);font-variant-numeric:tabular-nums}
#simpleRemote .nx-volume-strip{display:grid;grid-template-columns:calc(44 * var(--u)) minmax(0,1fr) calc(44 * var(--u));align-items:center;gap:var(--s8);height:calc(44 * var(--u))}
#simpleRemote .nx-volume-key{height:calc(44 * var(--u));width:calc(44 * var(--u));display:grid;place-items:center;border-radius:calc(12 * var(--u));color:var(--text);touch-action:none}
#simpleRemote .nx-volume-key .nx-icon{width:calc(24 * var(--u));height:calc(24 * var(--u))}
#simpleRemote .nx-volume-key:active,#simpleRemote .nx-volume-key.pressed{background:var(--control)}
#simpleRemote .nx-volume-readout{height:100%;display:flex;align-items:center;touch-action:none;cursor:ew-resize;padding:0 calc(10 * var(--u))}
#simpleRemote .nx-meter{position:relative;width:100%;height:calc(6 * var(--u));border-radius:20px;background:var(--border);overflow:visible}
body[data-skin=glass] #simpleRemote .nx-meter{background:rgba(255,255,255,.55)}
#simpleRemote .nx-meter-fill{position:relative;height:100%;border-radius:20px;background:var(--vol)}
#simpleRemote .nx-meter-fill::after{content:'';position:absolute;right:calc(-11 * var(--u));top:50%;width:calc(22 * var(--u));height:calc(22 * var(--u));margin-top:calc(-11 * var(--u));border-radius:50%;background:var(--knob);border:1px solid rgb(0 0 0/10%);box-shadow:0 2px 5px rgb(0 0 0/25%)}
#simpleRemote .nx-volume-readout.nx-dragging .nx-meter-fill::after{transform:scale(1.15)}
/* 4. Playback */
#simpleRemote .nx-playback{display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--s12);height:calc(56 * var(--u))}
#simpleRemote .nx-playback button{display:grid;place-items:center;color:var(--text)}
#simpleRemote .nx-media-icon{width:calc(46 * var(--u));height:calc(26 * var(--u));fill:currentColor}
/* 5+6. Mode switch, then the navigation surface (38:25, same in every skin) */
#simpleRemote .nx-navigation{display:flex;flex-direction:column;gap:var(--s12)}
#simpleRemote .nx-mode-selector{display:flex;height:calc(44 * var(--u));padding:calc(3 * var(--u));border-radius:calc(22 * var(--u))}
#simpleRemote .nx-mode{flex:1;border-radius:calc(19 * var(--u));font-size:calc(17 * var(--u));font-weight:600;color:var(--muted)}
#simpleRemote .nx-mode[aria-selected=true]{background:var(--accent);color:var(--on-accent)}
body[data-skin=glass] #simpleRemote .nx-mode[aria-selected=true]{box-shadow:inset 0 1px 0 rgb(255 255 255/70%),0 2px 6px rgb(20 42 64/14%)}
#simpleRemote .nx-surface{position:relative;width:100%;aspect-ratio:38 / 25;border-radius:calc(28 * var(--u));overflow:hidden}
#simpleRemote .nx-track-surface{position:absolute;inset:0;touch-action:none;cursor:grab;outline:none;display:grid;place-items:center}
#simpleRemote .nx-track-surface:active{cursor:grabbing}
#simpleRemote .nx-corners{display:none}
#simpleRemote .nx-contact{position:absolute;left:50%;top:50%;width:calc(72 * var(--u));height:calc(72 * var(--u));border-radius:50%;background:radial-gradient(circle,rgb(255 255 255/60%) 0%,rgb(255 255 255/22%) 40%,transparent 70%);transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity 160ms}
body[data-skin=light] #simpleRemote .nx-contact,body[data-skin=bw] #simpleRemote .nx-contact,body[data-skin=ivory] #simpleRemote .nx-contact{background:radial-gradient(circle,rgb(17 24 39/22%) 0%,rgb(17 24 39/8%) 40%,transparent 70%)}
#simpleRemote .nx-contact.nx-touching{opacity:1;transition:opacity 60ms}
#simpleRemote .nx-track-copy{position:static;text-align:center;margin:0;font-size:calc(19 * var(--u));line-height:1.45;pointer-events:none;color:var(--text)}
#simpleRemote .nx-track-copy.used{display:none}
#simpleRemote .nx-finger{display:block;margin:0 auto calc(10 * var(--u));width:calc(56 * var(--u));height:calc(56 * var(--u));fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
/* D-pad: one raised disc, four fine diagonal dividers, open chevrons, round OK */
#simpleRemote .nx-dpad{position:absolute;inset:0;display:grid;place-items:center}
#simpleRemote .nx-dpad[hidden],#simpleRemote .nx-track-surface[hidden]{display:none}
#simpleRemote .nx-disc{position:relative;width:calc(276 * var(--u));height:calc(276 * var(--u));max-width:92%;max-height:92%;aspect-ratio:1;border-radius:50%;background:var(--control);border:1px solid var(--border);
  box-shadow:0 3px 7px rgb(0 0 0/18%),inset 0 1px 0 rgb(255 255 255/18%)}
body[data-skin=glass] #simpleRemote .nx-disc{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:inset 0 1px 0 rgb(255 255 255/55%),0 3px 7px rgb(20 42 64/15%)}
#simpleRemote .nx-disc::before{content:'';position:absolute;inset:0;border-radius:50%;background:linear-gradient(45deg,transparent calc(50% - .5px),var(--divider) calc(50% - .5px),var(--divider) calc(50% + .5px),transparent calc(50% + .5px)),linear-gradient(-45deg,transparent calc(50% - .5px),var(--divider) calc(50% - .5px),var(--divider) calc(50% + .5px),transparent calc(50% + .5px));pointer-events:none}
#simpleRemote .nx-direction{position:absolute;display:grid;place-items:center;color:var(--text);touch-action:none;border-radius:50%}
#simpleRemote .nx-direction .nx-icon{width:calc(26 * var(--u));height:calc(26 * var(--u));stroke-width:2}
#simpleRemote .nx-direction.nx-up{top:3%;left:30%;width:40%;height:28%}
#simpleRemote .nx-direction.nx-down{bottom:3%;left:30%;width:40%;height:28%}
#simpleRemote .nx-direction.nx-left{left:3%;top:30%;width:28%;height:40%}
#simpleRemote .nx-direction.nx-right{right:3%;top:30%;width:28%;height:40%}
#simpleRemote .nx-direction:active,#simpleRemote .nx-direction.nx-is-pressed{background:rgb(127 127 127/14%);transform:none}
#simpleRemote .nx-center-select{position:absolute;left:32%;top:32%;width:36%;height:36%;border-radius:50%;background:var(--control);border:1px solid var(--border);font-size:calc(19 * var(--u));font-weight:700;color:var(--text);box-shadow:0 2px 5px rgb(0 0 0/18%),inset 0 1px 0 rgb(255 255 255/30%);touch-action:none}
body[data-skin=glass] #simpleRemote .nx-center-select{background:rgba(255,255,255,.42)}
/* 7. Back / Home / Mute — 8. Voice / Apps */
#simpleRemote .nx-primary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--s12)}
#simpleRemote .nx-bottom{display:grid;grid-template-columns:1fr 1fr;gap:var(--s12)}
#simpleRemote .nx-glow-mute{color:var(--mute);text-shadow:0 0 5px rgb(235 77 77/22%)}
#simpleRemote .nx-glow-mute .nx-icon{filter:drop-shadow(0 0 3px rgb(235 77 77/24%))}
#simpleRemote .nx-glow-voice{color:var(--voice);text-shadow:0 0 5px rgb(69 204 107/24%)}
#simpleRemote .nx-glow-voice .nx-icon{filter:drop-shadow(0 0 3px rgb(69 204 107/26%))}
#simpleRemote .nx-mute[aria-pressed=true]{background:var(--accent)}
#simpleRemote .nx-mute[aria-pressed=true] .nx-glow-mute{color:var(--on-accent);text-shadow:none}
#simpleRemote .nx-mute[aria-pressed=true] .nx-state{display:inline}
#simpleRemote .nx-mute .nx-state{display:none}
#simpleRemote .nx-mute[aria-pressed=true] .nx-base{display:none}
#simpleRemote .nx-voice.live,#simpleRemote .nx-voice[aria-pressed=true]{background:var(--accent)}
/* SWITCH TO sheet */
#simpleRemote .nx-sheet{position:fixed;inset:0;z-index:30;background:rgb(0 0 0/40%);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 16px)}
#simpleRemote .nx-sheet[hidden]{display:none}
#simpleRemote .nx-sheet-card{width:min(400px,100%);background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:16px;box-shadow:0 20px 60px rgb(0 0 0/35%)}
body[data-skin=glass] #simpleRemote .nx-sheet-card{background:rgba(236,244,252,.92)}
#simpleRemote .nx-sheet-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;letter-spacing:.14em;color:var(--muted);margin:2px 4px 12px}
#simpleRemote .nx-sheet-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
#simpleRemote .nx-app-tile{height:88px;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;font-size:14px;padding:0 6px;min-width:0}
#simpleRemote .nx-app-tile[aria-pressed=true]{background:var(--accent);color:var(--on-accent)}
#simpleRemote .nx-app-ico{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#fff;background:#2c2c30;box-shadow:inset 0 1px 0 #ffffff30}
#simpleRemote .nx-app-name{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#simpleRemote .nx-sheet-all{margin-top:12px;height:50px;width:100%;border-radius:16px;font-size:16px;display:flex;align-items:center;justify-content:center;gap:10px}
/* The other screens (Settings, Apps, Setup, Pair) take the skin too */
body[data-skin] button{background:var(--control);border:1px solid var(--border);color:var(--text);box-shadow:var(--shadow)}
body[data-skin] .select,body[data-skin] .nav,body[data-skin] .apps-btn{background:var(--accent);color:var(--on-accent);border-color:transparent;-webkit-backdrop-filter:none;backdrop-filter:none}
body[data-skin] .set-card,body[data-skin] .gl-row,body[data-skin] .in-row,body[data-skin] .status{background:var(--surface);border-color:var(--border)}
body[data-skin=glass] .set-card,body[data-skin=glass] .gl-row,body[data-skin=glass] .in-row{background:rgba(240,248,255,.36)}
body[data-skin] .gl-row.on{border-color:#2ECC71}
body[data-skin] .set-row,body[data-skin] .gl-tv,body[data-skin] .gl-what,body[data-skin] .apps-title,body[data-skin] .apps-name,body[data-skin] .app-check{color:var(--text)}
body[data-skin] .set-sub,body[data-skin] .gl-vol,body[data-skin] .gl-here,body[data-skin] .type-hint,body[data-skin] .apps-empty,body[data-skin] .su-tv small,body[data-skin] .in-pt,body[data-skin] .kidbar{color:var(--muted)}
body[data-skin] .apps-search,body[data-skin] .set-row input[type=number],body[data-skin] .set-row select,body[data-skin] .in-row input,body[data-skin] .in-row select{background:var(--field);border-color:var(--border);color:var(--text)}
body[data-skin] .apps-search::placeholder{color:var(--muted)}
body[data-skin] .apps-row{border-bottom-color:var(--divider)}
body[data-skin] .apps-row:active{background:var(--control)}
body[data-skin] #note{background:var(--text);color:var(--canvas)}
body[data-skin] .su-brands .app[aria-pressed=true]{outline:2px solid var(--accent)}
body[data-skin] .nx-skins{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
body[data-skin] .nx-skin{height:64px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:600;padding:0 4px;width:auto}
body[data-skin] .nx-skin[aria-pressed=true]{outline:2px solid var(--accent);outline-offset:-2px}
body[data-skin] .nx-swatch{width:26px;height:26px;border-radius:50%;border:1px solid rgb(0 0 0/15%);box-shadow:inset 0 1px 0 rgb(255 255 255/40%)}
'''

MARKUP = r'''<div id="simpleRemote"><div class="nx-inner">
 <header class="nx-header">
  <button id="nxRoomBtn" class="nx-room-btn" data-fn="nxRoomsToggle" aria-haspopup="listbox" aria-expanded="false"><span class="nx-room-name"><span id="nxRoomName">TV</span><svg class="nx-icon nx-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span><span class="nx-conn"><span id="nxDot" class="nx-dot nx-off" aria-hidden="true"></span><span id="nxConn">Connecting…</span></span></button>
  <button class="nx-round nx-chrome nx-settings" data-fn="openSettings" aria-label="Settings"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2v-3l-1-2 2-3 2 .2z"/><circle cx="12" cy="10.5" r="3.4"/></svg></button>
  <button id="sPower" class="nx-round nx-chrome nx-power" data-c="power" aria-label="Power" aria-pressed="false"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v10M6.4 5.2a9 9 0 1 0 11.2 0"/></svg></button>
  <div id="nxRooms" class="nx-rooms" role="listbox" aria-label="TV" hidden></div>
 </header>
 <div id="nxStatus" class="nx-source nx-chrome"><div class="nx-source-main" role="button" data-fn="nxSwitch" aria-label="What is on. Tap to switch to a favourite app."><span id="nxAppBadge" class="nx-app-badge" aria-hidden="true">TV</span><span id="nxSource" class="nx-status-source">Connecting…</span><span id="nxAlias" class="nx-status-alias"></span><svg class="nx-icon nx-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></div><span class="nx-vsep" aria-hidden="true"></span><button class="nx-inputs-btn" data-fn="nxInputsToggle" aria-expanded="false"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>Inputs</button></div>
 <div id="nxInputsPanel" class="nx-inputs-panel nx-chrome" hidden><div class="nx-inputs-heading"><h2>Inputs</h2><button class="nx-edit" data-fn="openInEdit"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-1 5 5-1L21 7l-4-4zM14.5 5.5l4 4"/></svg>Edit</button></div><div id="sInputs" class="nx-inputs" aria-label="TV inputs"></div><p id="nxHidden" class="nx-hidden-count"></p></div>
 <div class="nx-volume-row"><div class="nx-volume-label">Volume<span id="nxVol" class="nx-volume-number">–</span></div><div class="nx-volume-strip"><button class="nx-volume-key" data-c="volumeDown" data-repeat="1" aria-label="Quieter"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 12h5"/></svg></button><div id="nxReadout" class="nx-volume-readout" aria-label="Volume. Press and drag to set."><div class="nx-meter" role="meter" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="nxMeter" class="nx-meter-fill" style="width:0%"></div></div></div><button class="nx-volume-key" data-c="volumeUp" data-repeat="1" aria-label="Louder"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/></svg></button></div></div>
 <div class="nx-playback"><button class="nx-chrome" data-c="rewind" aria-label="Rewind"><svg class="nx-media-icon" viewBox="0 0 52 30" aria-hidden="true"><path d="M23 4 3 15l20 11zM46 4 26 15l20 11z"/></svg></button><button class="nx-chrome" data-c="pause" aria-label="Play or pause"><svg class="nx-media-icon" viewBox="0 0 52 30" aria-hidden="true"><path d="m4 3 18 12L4 27z"/><path d="M31 3h4v24h-4zM44 3h4v24h-4z"/></svg></button><button class="nx-chrome" data-c="fastForward" aria-label="Fast forward"><svg class="nx-media-icon" viewBox="0 0 52 30" aria-hidden="true"><path d="m6 4 20 11L6 26zM29 4l20 11-20 11z"/></svg></button></div>
 <section id="nxNav" class="nx-navigation" aria-label="Navigation">
  <div class="nx-mode-selector nx-chrome" role="tablist" aria-label="Navigation mode"><button class="nx-mode" role="tab" data-mode="trackpad" aria-selected="true">Trackpad</button><button class="nx-mode" role="tab" data-mode="dpad" aria-selected="false">D-pad</button></div>
  <div class="nx-surface nx-chrome">
   <div id="nxTrack" class="nx-track-surface" role="tabpanel"><span class="nx-corners" aria-hidden="true"></span><span id="nxContact" class="nx-contact"></span><p id="nxCopy" class="nx-track-copy"><svg class="nx-finger" viewBox="0 0 48 48" aria-hidden="true"><circle cx="21" cy="17" r="13" opacity=".35"/><circle cx="21" cy="17" r="8.5" opacity=".6"/><path d="M18 34V15a3 3 0 0 1 6 0v11l1-.2a3 3 0 0 1 3.5 2.5 3 3 0 0 1 3.5 2l.2.7a3 3 0 0 1 4 2.3l.3 3.5a11 11 0 0 1-2.5 7.7L32 46H22l-6.6-8.6a3 3 0 0 1 .5-4.2 3 3 0 0 1 2.1-.6"/></svg>Swipe to navigate<br>Tap to select</p></div>
   <div id="nxDpad" class="nx-dpad" role="tabpanel" hidden><div class="nx-disc"><button class="nx-direction nx-up" data-c="up" data-repeat="1" aria-label="Up"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button><button class="nx-direction nx-left" data-c="left" data-repeat="1" aria-label="Left"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button><button class="nx-direction nx-right" data-c="right" data-repeat="1" aria-label="Right"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button><button class="nx-direction nx-down" data-c="down" data-repeat="1" aria-label="Down"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><button class="nx-center-select" data-c="ok">OK</button></div></div>
  </div>
 </section>
 <div class="nx-primary"><button class="nx-key nx-chrome" data-c="back"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5-6 6 6 6M2 11h13a5 5 0 0 1 0 10h-3"/></svg>Back</button><button class="nx-key nx-chrome" data-c="home"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m1 11 11-9 11 9M4 9v13h6v-8h4v8h6V9"/></svg>Home</button><button id="nxMute" class="nx-key nx-chrome nx-mute" data-c="mute" aria-pressed="false"><span class="nx-glow-mute nx-key"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 5 0 5-5v16l-5-5H3zM16 9l5 6M21 9l-5 6"/></svg><span class="nx-base">Mute</span><span class="nx-state">Muted</span></span></button></div>
 <div class="nx-bottom"><button id="sMic" class="nx-key nx-chrome nx-voice" data-fn="talk"><span class="nx-glow-voice nx-key"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="1" width="6" height="14" rx="3"/><path d="M5 10v3a7 7 0 0 0 14 0v-3M12 20v3M8 23h8"/></svg>Voice</span></button><button class="nx-key nx-chrome" data-fn="openApps"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Apps</button></div>
 <div id="nxSwitchSheet" class="nx-sheet" data-fn="nxCloseSwitch" hidden><div class="nx-sheet-card" data-fn="nxNoop"><div class="nx-sheet-head"><span>SWITCH TO</span><span id="nxSwitchTv"></span></div><div id="nxSwitchGrid" class="nx-sheet-grid"></div><button class="nx-sheet-all nx-chrome" data-fn="nxAllApps"><svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>All apps</button></div></div>
 <div id="nxSmart"></div>
</div></div>
'''

SKIN_JS = r'''// ===== SKINS (Joshua's six-skin handoff 2026-11-11): one layout, tokens per skin on <body data-skin>. Glass is the default. =====
var NX_SKINS=[{id:'glass',name:'Glass',sw:'linear-gradient(135deg,#c9d9e8,#9DB2C6)'},{id:'dark',name:'Dark',sw:'#101316'},{id:'light',name:'Light',sw:'#F8FAFC'},
  {id:'ivory',name:'Ivory',sw:'#F7EFE3'},{id:'navy',name:'Navy',sw:'#0C1B33'},{id:'bw',name:'Black/White',sw:'linear-gradient(90deg,#fff 50%,#08090A 50%)'}];
var NX_THEME_COLOR={glass:'#9DB2C6',dark:'#080A0C',light:'#F8FAFC',ivory:'#E7DDD2',navy:'#061127',bw:'#FFFFFF'};
function nxSkin(){var s=ls('skin','glass');return NX_SKINS.some(function(x){return x.id===s})?s:'glass'}
function applySkin(s){if(!NX_SKINS.some(function(x){return x.id===s}))s='glass';lsSet('skin',s);document.body.dataset.skin=s;
  var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',NX_THEME_COLOR[s]);nxPaintSkins()}
function nxPaintSkins(){var box=document.getElementById('nxSkins');if(!box)return;var cur=nxSkin();box.innerHTML='';
  NX_SKINS.forEach(function(x){var b=document.createElement('button');b.className='nx-skin';b.setAttribute('data-fn','nxSkinPick');b.dataset.skin=x.id;b.setAttribute('aria-pressed',x.id===cur?'true':'false');
    b.innerHTML='<span class="nx-swatch" style="background:'+x.sw+'"></span><span></span>';b.lastChild.textContent=x.name;box.appendChild(b)})}
function nxSkinPick(el){var s=el&&el.dataset?el.dataset.skin:'';if(s){applySkin(s);note(NX_SKINS.filter(function(x){return x.id===s})[0].name+' skin')}}
applySkin(nxSkin());
// Room name in the header; the list drops down under it. One TV: no chevron, nothing to drop.
function nxRoomsToggle(){var l=document.getElementById('nxRooms'),b=document.getElementById('nxRoomBtn');if(!l||tvList.length<2)return;
  l.hidden=!l.hidden;b.setAttribute('aria-expanded',l.hidden?'false':'true')}
function nxRoomsClose(){var l=document.getElementById('nxRooms'),b=document.getElementById('nxRoomBtn');if(l){l.hidden=true}if(b)b.setAttribute('aria-expanded','false')}
var __paintRoomsSk=nxPaintRooms;
nxPaintRooms=function(){__paintRoomsSk();var n=document.getElementById('nxRoomName'),b=document.getElementById('nxRoomBtn');
  if(n)n.textContent=tvList.length?nxLabel():'No TV yet';if(b)b.classList.toggle('nx-one',tvList.length<2);nxRoomsClose()};
var __roomSk=nxRoom;nxRoom=function(el){nxRoomsClose();__roomSk(el)};
// Inputs drop down from the source row instead of living on the face of the remote.
function nxInputsToggle(){var p=document.getElementById('nxInputsPanel'),b=document.querySelector('.nx-inputs-btn');if(!p)return;
  p.hidden=!p.hidden;if(b)b.setAttribute('aria-expanded',p.hidden?'false':'true');if(!p.hidden){nxRoomsClose();paintInputs()}}
function nxInputsClose(){var p=document.getElementById('nxInputsPanel'),b=document.querySelector('.nx-inputs-btn');if(p)p.hidden=true;if(b)b.setAttribute('aria-expanded','false')}
document.addEventListener('pointerdown',function(e){
  if(!e.target.closest('#nxInputsPanel,.nx-inputs-btn'))nxInputsClose();
  if(!e.target.closest('#nxRooms,#nxRoomBtn'))nxRoomsClose()},{passive:true});
// Connected line and the app badge follow the same status the source row shows.
var __paintSk=paintNexus;
paintNexus=function(d){__paintSk(d);var c=document.getElementById('nxConn'),bd=document.getElementById('nxAppBadge');
  if(c)c.textContent=d&&d.needPin?'Tap to pair':d&&d.ok?'Connected':'Not connected';
  if(bd){var cur=nxCur();var ic=cur?[null,'HDMI']:iconFor(d&&d.ok?String(d.app||'TV'):'TV');bd.style.background=ic[0]||'#1B2B4A';bd.textContent=cur?cur:ic[1]}};
var __setSk=openSettings;openSettings=function(){__setSk();nxPaintSkins()};
'''

LOOK_CARD = ('<div class="set-card"><div class="set-row"><span>Look</span></div><div id="nxSkins" class="nx-skins"></div>'
             '<div class="set-sub">Six skins, same remote. Glass is the one it starts on.</div></div>\n')

def patch(path):
    s = open(R + path).read()
    def rep(old, new, n=1):
        nonlocal s
        c = s.count(old)
        if c != n: raise SystemExit('%s: "%s" found %d times, wanted %d' % (path, old[:70], c, n))
        s = s.replace(old, new)
    # CSS: the whole NEXUS block (layouts 1-4) becomes the six-skin block
    a = s.index('/* ----- NEXUS layout (Smoky Silver / Black).')
    b = s.index('#inEditScreen{display:none;')
    s = s[:a] + CSS + s[b:]
    # Markup
    a = s.index('<div id="simpleRemote"><div class="nx-inner">')
    b = s.index('<div id="fullRemote">')
    s = s[:a] + MARKUP + s[b:]
    # Settings: the Look card after the TVs card
    rep('<div class="set-sub">USE THIS TV points the remote at it. MOVE IT HERE opens the same app on this TV and pauses the other one; you pick the show again.</div><div id="nxTvAdd" style="display:flex;flex-direction:column;gap:8px"></div></div>\n',
        '<div class="set-sub">USE THIS TV points the remote at it. MOVE IT HERE opens the same app on this TV and pauses the other one; you pick the show again.</div><div id="nxTvAdd" style="display:flex;flex-direction:column;gap:8px"></div></div>\n ' + LOOK_CARD)
    # Fit: 504-unit card, 848-unit stack
    rep("  var u=Math.min((w-32)/558,400/558,(h-pt-pb-4)/1192);\n  el.style.setProperty('--u',u.toFixed(4)+'px');el.style.width=(558*u).toFixed(1)+'px'}",
        "  var u=Math.min((w-32)/504,1,(h-pt-pb-4)/848);\n  el.style.setProperty('--u',u.toFixed(4)+'px');el.style.width=(504*u).toFixed(1)+'px'}")
    # Skins + header/inputs behaviour, after the trackpad block
    rep("// The 'Swipe to navigate / Tap to select' copy shows until the trackpad has been used once on this phone.\n",
        SKIN_JS + "// The 'Swipe to navigate / Tap to select' copy shows until the trackpad has been used once on this phone.\n")
    # The old dark page chrome: body.nx background no longer applies (skins own the canvas)
    open(R + path, 'w').write(s); print('patched', path)

for p in ['TVRemote/Web/remote.html', 'TVRemoteAndroid/app/src/main/assets/remote.html']: patch(p)
