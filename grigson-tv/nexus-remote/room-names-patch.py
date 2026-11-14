#!/usr/bin/env python3
"""Room names anyone can set: Settings renames the LG and the Vizio (the Samsung already could),
and every "Office TV" / "Living room" the app says follows the name. Applied to the live tree directly."""
import sys
R = '/home/user/paper-plate/'

def patch(path, pairs):
    s = open(R + path).read()
    for old, new, n in pairs:
        c = s.count(old)
        if c != n: raise SystemExit('%s: "%s" found %d times, wanted %d' % (path, old[:60], c, n))
        s = s.replace(old, new)
    open(R + path, 'w').write(s); print('patched', path)

# ---- Swift ----
NATIVE = "--native" in sys.argv
if NATIVE: patch('TVRemote/Shared/Remote.swift', [
    ('        case .lg: return "Living room"\n        case .vizio: return "Office"\n',
     '        case .lg: return SharedStore.get("lg.name") ?? "Living room"\n        case .vizio: return SharedStore.get("vizio.name") ?? "Office"\n', 1),
    ('    static func press(_ b: TVButton) async throws -> String? {\n',
     '    /// Settings can call any TV by its room ("Den", "Bedroom"). The Samsung keeps its own name store.\n'
     '    static func rename(_ k: TVKind, _ n: String) async {\n'
     '        if k == .samsung { await SamsungLink.shared.rename(n); return }\n'
     '        let t = n.trimmingCharacters(in: .whitespacesAndNewlines)\n'
     '        SharedStore.set("\\(k.rawValue).name", t.isEmpty ? nil : String(t.prefix(24)))\n'
     '    }\n\n'
     '    static func press(_ b: TVButton) async throws -> String? {\n', 1),
])
if NATIVE: patch('TVRemote/Shared/RoomWords.swift', [
    ('        case .lg: return ["living room", "livingroom", "living", "front room", "lg"]\n        case .vizio: return ["office", "vizio"]\n',
     '        case .lg: return named(k) + ["living room", "livingroom", "living", "front room", "lg"]\n        case .vizio: return named(k) + ["office", "vizio"]\n', 1),
    ('    /// The room named in the text (if any) and the text with the room words taken out.\n',
     '    /// The name Settings gave a TV, if any, so "mute the den" works once the Vizio is called Den.\n'
     '    private static func named(_ k: TVKind) -> [String] {\n'
     '        let n = (SharedStore.get("\\(k.rawValue).name") ?? "").lowercased().trimmingCharacters(in: .whitespaces)\n'
     '        return n.isEmpty ? [] : [n]\n'
     '    }\n\n'
     '    /// The room named in the text (if any) and the text with the room words taken out.\n', 1),
])
if NATIVE: patch('TVRemote/Shared/VizioLink.swift', [
    ('    private let session: URLSession\n',
     '    private let session: URLSession\n    /// What this house calls the Vizio ("Office" unless Settings renamed it).\n    private var room: String { TVKind.vizio.label }\n', 1),
    ('"The office TV ', '"The \\(room) TV ', 10),
    ('"Office TV not answering.', '"\\(room) TV not answering.', 1),
    ('"Office TV · standby"', '"\\(room) TV · standby"', 1),
    ('return ("Office TV", "")', 'return ("\\(room) TV", "")', 1),
    ('"No \\(name) app on the office TV list."', '"No \\(name) app on the \\(room) TV list."', 1),
    ('That one only works on the living-room LG.', 'That one only works on the LG.', 1),
])
if NATIVE: patch('TVRemote/Shared/TVLink.swift', [
    ('Enter the code on the office TV to pair it', 'Enter the code on the Vizio to pair it', 1),
])
if NATIVE: patch('TVRemote/App/WatchBridge.swift', [
    ('"Pair the office TV on the iPhone"', '"Pair the Vizio on the iPhone"', 1),
])
if NATIVE: patch('TVRemote/App/RemoteWebView.swift', [
    ('"Type the code on the office TV"', '"Type the code on the \\(TVKind.vizio.label) TV"', 3),
    ('"Code is on the office TV"', '"Code is on the \\(TVKind.vizio.label) TV"', 1),
    ('"Paired with the office TV"', '"Paired with the \\(TVKind.vizio.label) TV"', 1),
    ('        if c.hasPrefix("samsung:") { return await handleSamsung(String(c.dropFirst(8))) }\n',
     '        if c.hasPrefix("samsung:") { return await handleSamsung(String(c.dropFirst(8))) }\n'
     '        if c.hasPrefix("tv:name:") {\n'
     '            // tv:name:<tv>:<room> — what Settings calls that TV; the rooms, Siri and the watch follow.\n'
     '            let p = c.dropFirst(8).split(separator: ":", maxSplits: 1).map(String.init)\n'
     '            guard p.count == 2, let k = TVKind(rawValue: p[0]) else { return ["ok": false, "say": "Which TV?"] }\n'
     '            await Remote.rename(k, p[1])\n'
     '            return which()\n'
     '        }\n', 1),
])

# ---- Kotlin ----
if NATIVE: patch('TVRemoteAndroid/app/src/main/java/com/jgrigson/tvremote/VizioLink.kt', [
    ('class VizioNeedsPin : Exception("Type the code on the office TV")', 'class VizioNeedsPin : Exception("Type the code on the Vizio")', 1),
    ('    private var playing = true\n    private var pairType: Int? = null\n',
     '    private var playing = true\n    /** What this house calls the Vizio ("Office" unless Settings renamed it). */\n    private val room: String get() = Remote.label("vizio")\n    private var pairType: Int? = null\n', 1),
    ('"The office TV ', '"The $room TV ', 10),
    ('"Office TV not answering.', '"$room TV not answering.', 2),
    ('"Office TV · standby"', '"$room TV · standby"', 1),
    ('return "Office TV" to ""', 'return "$room TV" to ""', 1),
    ('"No $name app on the office TV list."', '"No $name app on the $room TV list."', 1),
    ('ok("Code is on the office TV")', 'ok("Code is on the $room TV")', 1),
    ('ok("Paired with the office TV")', 'ok("Paired with the $room TV")', 1),
    ('That one only works on the living-room LG.', 'That one only works on the LG.', 1),
    # Remote: labels from prefs, a rename command, and the spoken names follow.
    ('    private var active: String\n        get() = prefs.getString("tv", "lg") ?: "lg"\n        set(v) = prefs.edit().putString("tv", v).apply()\n',
     '    private var active: String\n        get() = prefs.getString("tv", "lg") ?: "lg"\n        set(v) = prefs.edit().putString("tv", v).apply()\n\n'
     '    /** What this house calls each TV. Settings can rename them; the default is Joshua\'s layout. */\n'
     '    fun label(kind: String): String = prefs.getString("$kind.name", null)?.takeIf { it.isNotBlank() }\n'
     '        ?: if (kind == "vizio") "Office" else if (kind == "samsung") "Samsung" else "Living room"\n'
     '    private fun rename(kind: String, name: String) {\n'
     '        val t = name.trim().take(24)\n'
     '        prefs.edit().apply { if (t.isEmpty()) remove("$kind.name") else putString("$kind.name", t) }.apply()\n'
     '    }\n', 1),
    ('            .put(JSONObject().put("id", "lg").put("label", "Living room"))\n            .put(JSONObject().put("id", "vizio").put("label", "Office"))\n'
     '        return JSONObject().put("ok", true).put("tv", active).put("label", if (vz) "Office" else "Living room")\n',
     '            .put(JSONObject().put("id", "lg").put("label", label("lg")))\n            .put(JSONObject().put("id", "vizio").put("label", label("vizio")))\n'
     '        return JSONObject().put("ok", true).put("tv", active).put("label", label(active))\n', 1),
    ('        val names = listOf("living room" to "lg", "livingroom" to "lg", "front room" to "lg", "living" to "lg", "office" to "vizio", "vizio" to "vizio", "lg" to "lg")\n',
     '        val names = listOf("lg", "vizio").mapNotNull { k -> prefs.getString("$k.name", null)?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }?.let { it to k } } +\n'
     '            listOf("living room" to "lg", "livingroom" to "lg", "front room" to "lg", "living" to "lg", "office" to "vizio", "vizio" to "vizio", "lg" to "lg")\n', 1),
    ('                done(which(if (active == "vizio") "Office TV" else "Living room TV"))\n',
     '                done(which(label(active) + " TV"))\n', 1),
    ('            cmd.startsWith("samsung:") -> done(notHere("Samsung setup is on the iPhone app for now"))\n',
     '            cmd.startsWith("samsung:") -> done(notHere("Samsung setup is on the iPhone app for now"))\n'
     '            // tv:name:<tv>:<room> — what Settings calls that TV.\n'
     '            cmd.startsWith("tv:name:") -> {\n'
     '                val p = cmd.removePrefix("tv:name:").split(":", limit = 2)\n'
     '                if (p.size == 2 && p[0] in setOf("lg", "vizio")) rename(p[0], p[1])\n'
     '                done(which())\n'
     '            }\n', 1),
    ('                    done(which("Using the " + (if (kind == "vizio") "Office" else "Living room") + " TV")); return\n',
     '                    done(which("Using the " + label(kind) + " TV")); return\n', 1),
])

# ---- the page (both copies carry the same text here) ----
NEW_ADD = r'''function nxPaintTvAdd(){var box=document.getElementById('nxTvAdd');if(!box)return;
  var kinds={lg:'LG',vizio:'Vizio',samsung:'Samsung'},btn='class="app" style="height:40px;width:auto;padding:0 12px;font-size:12px"';
  var h=tvList.map(function(t){return '<div class="set-row"><span>'+t.label+' ('+(kinds[t.id]||t.id)+')</span><span style="display:flex;gap:8px"><button '+btn+' data-fn="nxTvRename" data-tv="'+t.id+'">Rename</button>'+(t.id==='samsung'?'<button '+btn+' data-fn="nxSamsungForget">Remove</button>':'')+'</span></div>'}).join('');
  h+='<div id="nxTvName" style="display:none" class="type-row"><input id="nxTvNameBox" class="apps-search" maxlength="24" placeholder="Room name" autocomplete="off"><button class="app" style="height:44px;width:auto;padding:0 14px" data-fn="nxTvSaveName">Save</button></div>';
  if(!nxHasSamsung())h+='<button class="app" style="height:46px;width:100%" data-fn="nxSamsungScan">+ Add a Samsung TV</button><div id="nxSamsungList" style="display:flex;flex-direction:column;gap:8px"></div><div id="nxSamsungNote" class="set-sub"></div>';
  box.innerHTML=h;
}
// Any TV can be called by its room: "Den", "Bedroom". The rooms row, Siri and the watch follow.
var nxRenaming='';
function nxTvRename(el){nxRenaming=el&&el.dataset?el.dataset.tv:'';var r=document.getElementById('nxTvName');if(!r||!nxRenaming)return;r.style.display='flex';var b=document.getElementById('nxTvNameBox');b.value=nxLabel(nxRenaming);b.focus()}
function nxTvSaveName(){var v=(document.getElementById('nxTvNameBox').value||'').trim();if(!v||!nxRenaming)return;
  window.__ask('tv:name:'+nxRenaming+':'+v).then(function(w){return w&&w.tvs?w:window.__ask('which')}).then(function(w){applyTV(w);paintGlance();note('Renamed')})}
'''
import re
for page in ['TVRemote/Web/remote.html', 'TVRemoteAndroid/app/src/main/assets/remote.html']:
    s = open(R + page).read()
    m = re.search(r"function nxPaintTvAdd\(\)\{.*?\n\}\n", s, flags=re.S)
    if not m: raise SystemExit(page + ': nxPaintTvAdd not found')
    s = s[:m.start()] + NEW_ADD + s[m.end():]
    m = re.search(r"function nxSamsungRename\(\)\{[^\n]*\nfunction nxSamsungSaveName\(\)\{[^\n]*\n[^\n]*\n", s)
    if not m: raise SystemExit(page + ': samsung rename fns not found')
    s = s[:m.start()] + s[m.end():]
    open(R + page, 'w').write(s)
    patch(page, [
        ("Pair the office TV</div></div>", "Pair the Vizio</div></div>", 1),
        ("The office TV is showing a 4-digit code.", "The Vizio is showing a 4-digit code.", 1),
        ("WORK switches the office TV to this input", "WORK switches the Vizio to this input", 1),
        ("Living room TV: when something plugged in turns on", "LG TV: when something plugged in turns on", 1),
        ("textContent='Office TV: tap to pair'", "textContent=nxLabel('vizio')+' TV: tap to pair'", 2),
        ("(tvKind==='vizio'?'Office TV':'TV')+' off or not on home Wi-Fi'", "(tvKind==='vizio'?nxLabel('vizio')+' TV':'TV')+' off or not on home Wi-Fi'", 1),
        ("function otherLabel(){return tvKind==='lg'?'Office':'Living room'}", "function otherLabel(){return nxLabel(otherKind())}", 1),
        ("note('That was on the '+(b.tv==='lg'?'living room':'office')+' TV')", "note('That was on the '+nxLabel(b.tv)+' TV')", 1),
        ("  var mine=tvKind==='lg'?'Living room':'Office';\n", "  var mine=nxLabel(tvKind);\n", 1),
    ])
