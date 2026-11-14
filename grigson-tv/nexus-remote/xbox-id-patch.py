#!/usr/bin/env python3
"""Post-NEXUS touch-ups: Xbox client ID pasted in Settings; centred "10" in the replay icon. Let the Xbox client ID be pasted in Settings (kept on the phone) instead of baked into the page.
Run after nexus-patch.py: python3 xbox-id-patch.py <remote.html> [<remote.html> ...]"""
import sys

def patch(path):
    s=open(path).read()
    def rep(old,new,what):
        nonlocal s
        n=s.count(old)
        if n!=1: raise SystemExit('%s: anchor "%s" found %d times' % (path,what,n))
        s=s.replace(old,new)
    rep("function xbReady(){return !!XBOX.CLIENT_ID}",
        "// The Microsoft app registration's Application (client) ID: baked in, or pasted once in Settings and kept on this phone.\n"
        "function xbClientId(){return XBOX.CLIENT_ID||ls('xboxClientId','')}\n"
        "function xbReady(){return !!xbClientId()}\n"
        "function xbSaveId(){var b=document.getElementById('xbIdBox');if(!b)return;var v=b.value.trim();\n"
        "  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)){note('That is not an Application (client) ID');return}\n"
        "  lsSet('xboxClientId',v.toLowerCase());note('Xbox ID saved. Now sign in.');paintXboxSet();paintSmart()}\n"
        "function xbClearId(){lsSet('xboxClientId','');xbSignOut();paintXboxSet()}",'xbReady')
    rep("body:XBOX.refreshBody(XBOX.CLIENT_ID,r)","body:XBOX.refreshBody(xbClientId(),r)",'refresh')
    rep("window.__ask('xsignin:'+XBOX.authUrl(XBOX.CLIENT_ID,verifier,state))","window.__ask('xsignin:'+XBOX.authUrl(xbClientId(),verifier,state))",'authUrl')
    rep("body:XBOX.codeBody(XBOX.CLIENT_ID,cb.code,verifier)","body:XBOX.codeBody(xbClientId(),cb.code,verifier)",'codeBody')
    rep("""  if(!xbReady()){b.innerHTML='<div class="set-row"><span>Xbox</span><span style="color:#7a7a82">Setup not finished</span></div>';return}
  secretGet('xbox.refresh').then(function(r){
    b.innerHTML=r?'<div class="set-row"><span>Xbox'+(xb.console?' · '+xb.console.name:'')+'</span><button class="app" style="height:40px;width:auto;padding:0 14px" onclick="xbSignOut()">Sign out</button></div>'
      :'<div class="set-row"><span>Xbox</span><button class="app" style="height:40px;width:auto;padding:0 14px" onclick="xbSignIn()">Sign in</button></div>'})}""",
        """  if(!xbReady()){b.innerHTML='<div class="set-row"><span>Xbox</span></div><div class="set-sub">Paste the Application (client) ID from the Microsoft app registration (Grigson TV, personal accounts, redirect grigsontv://xbox). Kept on this phone only.</div>'+
      '<div class="type-row"><input id="xbIdBox" class="apps-search" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" onkeydown="if(event.key===\\'Enter\\'){event.preventDefault();xbSaveId()}"><button class="app" style="height:44px;width:auto;padding:0 14px" onclick="xbSaveId()">Save</button></div>';return}
  secretGet('xbox.refresh').then(function(r){
    var change=XBOX.CLIENT_ID?'':'<button class="app" style="height:40px;width:auto;padding:0 12px;font-size:12px" onclick="xbClearId()">Change ID</button>';
    b.innerHTML=r?'<div class="set-row"><span>Xbox'+(xb.console?' · '+xb.console.name:'')+'</span><button class="app" style="height:40px;width:auto;padding:0 14px" onclick="xbSignOut()">Sign out</button></div>'
      :'<div class="set-row"><span>Xbox</span><span style="display:flex;gap:8px">'+change+'<button class="app" style="height:40px;width:auto;padding:0 14px" onclick="xbSignIn()">Sign in</button></span></div>'})}""",'settings card')
    # Smart row: the "10" sits dead centre of the replay ring (ring centre 12,12), with equal room all round.
    rep('<path d="M4.6 13.5A7.6 7.6 0 1 0 7 5.9"/><path d="M7.4 2.6 6.6 6.2l3.6.9"/><text x="12.4" y="16.3" text-anchor="middle" font-size="8.2" font-weight="800" fill="currentColor" stroke="none"',
        '<path d="M4.6 13.5A7.6 7.6 0 1 0 7 5.9"/><path d="M7.4 2.6 6.6 6.2l3.6.9"/><text x="12" y="12" text-anchor="middle" dominant-baseline="central" font-size="7.6" font-weight="800" fill="currentColor" stroke="none"','replay10')
    open(path,'w').write(s); print('patched',path)

for p in sys.argv[1:]: patch(p)
