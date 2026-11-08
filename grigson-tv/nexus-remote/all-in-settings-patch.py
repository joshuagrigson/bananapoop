#!/usr/bin/env python3
"""ALL (every TV on one screen, plus the Xbox card) lives inside Settings; the smart row loses its ALL key.
Run after nexus-patch.py and xbox-id-patch.py: python3 all-in-settings-patch.py <remote.html> [...]"""
import re, sys

TVS_CARD = ('<div id="glanceScreen" class="set-card"><div class="set-row"><span>TVs</span></div>'
            '<div id="glanceRows" style="display:flex;flex-direction:column;gap:10px"></div>'
            '<div class="set-sub">USE THIS TV points the remote at it. MOVE IT HERE opens the same app on this TV '
            'and pauses the other one; you pick the show again.</div></div>\n')

def patch(path):
    s = open(path).read()
    def rep(old, new, what):
        nonlocal s
        n = s.count(old)
        if n != 1: raise SystemExit('%s: anchor "%s" found %d times' % (path, what, n))
        s = s.replace(old, new)
    m = re.search(r'<div id="glanceScreen">\n <div class="apps-head">.*?</div>\n <div id="glanceRows"[^\n]*</div>\n <div class="set-sub">[^\n]*</div>\n</div>\n', s, flags=re.S)
    if not m: raise SystemExit(path + ': glance screen block not found')
    s = s[:m.start()] + s[m.end():]
    head = '<path d="M15 6l-6 6 6 6"/></svg>Back</button><div class="apps-title">Settings</div></div>\n'
    rep(head, head + ' ' + TVS_CARD, 'settings header')
    rep("#glanceScreen{display:none;width:100%;max-width:400px;flex-direction:column;gap:10px}\n", "", 'glance css')
    rep("  if(!kid())b.push({l:'◉ ALL',fn:'openGlance'});\n", "", 'ALL key')
    # UNDO key removed from the smart row (Joshua 2026-11-08); the snapshot logic stays dormant for smart_test.
    rep("var b=[{l:'↶ UNDO',fn:'smartUndo',off:!smUndo.length}].concat(SMART.contextFor(key));", "var b=[].concat(SMART.contextFor(key));", 'UNDO key')
    m = re.search(r"function openGlance\(\)\{\n.*?\n\}\nfunction closeGlance\(\)\{[^\n]*\n[^\n]*\}\n", s, flags=re.S)
    if not m: raise SystemExit(path + ': openGlance/closeGlance not found')
    s = s[:m.start()] + ("// ALL now lives in Settings: opening it opens Settings, closing it closes Settings.\n"
                         "function openGlance(){openSettings()}\nfunction closeGlance(){closeSettings()}\n") + s[m.end():]
    rep("paintXboxSet();\n// ===== XBOX END",
        "paintXboxSet();\n// Settings opens with every TV (and the Xbox card) on top, the way ALL used to.\n"
        "var __setAll=openSettings;\nopenSettings=function(){__setAll();paintGlance(smOther,false);\n"
        "  window.__ask('other:status').then(function(d){smOther=d&&d.ok?d:null;smOtherT=Date.now();if(smOther)smOtherFail=0;"
        "paintGlance(smOther,!!(d&&d.needPair));paintSmart()},function(){})};\n// ===== XBOX END", 'settings glance')
    open(path, 'w').write(s); print('patched', path)

for p in sys.argv[1:]: patch(p)
