#!/usr/bin/env python3
"""Edit nexus-patch.py and all-in-settings-patch.py in place: rooms from the TV list the app reports,
'other:<tv>:' commands for any number of TVs, and the Add-a-Samsung flow in Settings."""
S = '/tmp/claude-0/-home-user-bananapoop/8de4ff27-26c8-59aa-9e0e-c28db626e956/scratchpad/'
p = open(S + 'nexus-patch.py').read()

def rep(a, b):
    global p
    n = p.count(a)
    if n != 1: raise SystemExit('nexus-patch anchor found %d times: %s' % (n, a[:70]))
    p = p.replace(a, b)

# rooms row is built from the list the app reports
rep('<div id="nxRooms" class="nx-rooms" role="group" aria-label="TV"><button class="nx-room" data-fn="nxLiving" data-tv="lg" aria-pressed="true">Living room</button><button class="nx-room" data-fn="nxOffice" data-tv="vizio" aria-pressed="false">Office</button></div>',
    '<div id="nxRooms" class="nx-rooms" role="group" aria-label="TV"></div>')
rep("function nxLiving(){useTV('lg')}\nfunction nxOffice(){useTV('vizio')}\n",
    """// The rooms come from the app ("which" lists them); the Samsung joins the list once it's added.
var tvList=[{id:'lg',label:'Living room'},{id:'vizio',label:'Office'}];
function nxLabel(id){var t=tvList.filter(function(x){return x.id===(id||tvKind)})[0];return t?t.label:(id||tvKind)==='vizio'?'Office':(id||tvKind)==='lg'?'Living room':'TV'}
function nxOthers(){return tvList.filter(function(t){return t.id!==tvKind})}
function nxPaintRooms(){var box=document.getElementById('nxRooms');if(!box)return;box.innerHTML='';box.classList.toggle('nx-rooms-many',tvList.length>2);
  tvList.forEach(function(t){var b=document.createElement('button');b.className='nx-room';b.setAttribute('data-fn','nxRoom');b.dataset.tv=t.id;
    b.setAttribute('aria-pressed',t.id===tvKind?'true':'false');b.textContent=t.label;box.appendChild(b)})}
function nxRoom(el){var id=el&&el.dataset?el.dataset.tv:'';if(id&&id!==tvKind)useTV(id)}
""")
rep("src.textContent=(tvKind==='vizio'?'Office TV':'TV')+' off or not on home Wi-Fi';",
    "src.textContent=nxLabel()+(tvKind==='lg'?' TV':'')+' off or not on home Wi-Fi';")
rep("  document.getElementById('nxSwitchTv').textContent=tvKind==='vizio'?'Office':'Living room';",
    "  document.getElementById('nxSwitchTv').textContent=nxLabel();")
rep("""applyTV=function(d){__applyTVs(d);tvInputs=null;inT=0;\\n  document.querySelectorAll('#nxRooms .nx-room').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.tv===tvKind?'true':'false')});\\n  if(simpleOn()){paintNexus(null);paintInputs()}};""",
    """applyTV=function(d){__applyTVs(d);tvInputs=null;inT=0;\\n  if(d&&d.tvs&&d.tvs.length)tvList=d.tvs;nxPaintRooms();\\n  if(simpleOn()){paintNexus(null);paintInputs()}};""")
# input editor title
rep("rep(\"paintStatus=function(d){__paintS(d);if(simpleOn()){paintInputs();\",",
    "rep(\"document.getElementById('inTv').textContent=tvKind==='vizio'?'Office':'Living room';\",\"document.getElementById('inTv').textContent=nxLabel();\",'inTv label')\n    rep(\"paintStatus=function(d){__paintS(d);if(simpleOn()){paintInputs();\",")

JS = r'''// MANY TVS: the other TVs (for HERE and the Settings card) are asked one by one as other:<tv>:...
var smOthersMap={},smOtherId=null;
otherKind=function(){return smOtherId||(nxOthers()[0]||{}).id||'vizio'};
otherLabel=function(){return nxLabel(otherKind())};
pollOther=function(force){
  if(document.hidden)return Promise.resolve(smOther);
  var wait=smOtherFail>=3?300000:60000;
  if(!force&&Date.now()-smOtherT<wait)return Promise.resolve(smOther);
  smOtherT=Date.now();
  return Promise.all(nxOthers().map(function(t){return window.__ask('other:'+t.id+':status').then(function(d){smOthersMap[t.id]=d&&d.ok?d:(d&&d.needPair?{needPair:true}:null)},function(){smOthersMap[t.id]=null})})).then(function(){
    var live=nxOthers().filter(function(t){return smOthersMap[t.id]&&smOthersMap[t.id].ok});
    var pick=live.filter(function(t){return SMART.movable(t.id,smOthersMap[t.id])})[0]||live[0];
    smOther=pick?smOthersMap[pick.id]:null;smOtherId=pick?pick.id:null;smOtherFail=smOther?0:smOtherFail+1;paintSmart();return smOther});
};
moveHere=function(el){var id=el&&el.dataset&&el.dataset.tv?el.dataset.tv:otherKind();
  pollOther(true).then(function(){var o=smOthersMap[id];var k=SMART.movable(id,o);
    if(!k){note('Nothing playing on the '+nxLabel(id).toLowerCase()+' TV');return}
    return doCmd('launch',[k]).then(function(){
      return window.__ask('other:'+id+':run:'+JSON.stringify({cmd:'pause',args:[],text:''}))
    }).then(function(){note(o.app+' is on here now. '+nxLabel(id)+' is paused.');closeGlance();pollStatus()});
  });
};
glanceUse=function(el){var id=el&&el.dataset&&el.dataset.tv?el.dataset.tv:otherKind();closeGlance();useTV(id)};
paintGlance=function(){var box=document.getElementById('glanceRows');if(!box)return;
  var html=glanceRow(nxLabel(),lastStatus,true,false);
  nxOthers().forEach(function(t){var st=smOthersMap[t.id];var pair=!!(st&&st.needPair);
    html+=glanceRow(t.label,pair?null:st,false,pair).replace('data-fn="glanceUse"','data-fn="glanceUse" data-tv="'+t.id+'"').replace('data-fn="moveHere"','data-fn="moveHere" data-tv="'+t.id+'"')});
  box.innerHTML=html;
  var w=box.querySelectorAll('.gl-what');
  w[0].textContent=lastStatus&&lastStatus.ok?(lastStatus.app||''):'Off or not on home Wi-Fi';
  nxOthers().forEach(function(t,i){var st=smOthersMap[t.id];if(w[i+1])w[i+1].textContent=st&&st.needPair?'Not paired yet':st&&st.ok?(st.app||''):'Off or not on home Wi-Fi'});
  nxPaintTvAdd();
};
// SAMSUNG: added from Settings. Scan the Wi-Fi, pick it, choose Allow on the TV, done.
var nxFound=[];
function nxHasSamsung(){return tvList.some(function(t){return t.id==='samsung'})}
function nxPaintTvAdd(){var box=document.getElementById('nxTvAdd');if(!box)return;
  if(nxHasSamsung()){box.innerHTML='<div class="set-row"><span>'+nxLabel('samsung')+' (Samsung)</span><span style="display:flex;gap:8px"><button class="app" style="height:40px;width:auto;padding:0 12px;font-size:12px" data-fn="nxSamsungRename">Rename</button><button class="app" style="height:40px;width:auto;padding:0 12px;font-size:12px" data-fn="nxSamsungForget">Remove</button></span></div><div id="nxSamsungName" style="display:none" class="type-row"><input id="nxSamsungNameBox" class="apps-search" maxlength="24" placeholder="Room name" autocomplete="off"><button class="app" style="height:44px;width:auto;padding:0 14px" data-fn="nxSamsungSaveName">Save</button></div>';return}
  box.innerHTML='<button class="app" style="height:46px;width:100%" data-fn="nxSamsungScan">+ Add a Samsung TV</button><div id="nxSamsungList" style="display:flex;flex-direction:column;gap:8px"></div><div id="nxSamsungNote" class="set-sub"></div>';
}
function nxSamsungScan(){var list=document.getElementById('nxSamsungList'),n=document.getElementById('nxSamsungNote');if(!n)return;
  n.textContent='Looking on your Wi-Fi… (about 5 seconds)';list.innerHTML='';
  window.__ask('samsung:scan').then(function(d){nxFound=(d&&d.found)||[];
    if(!d||!d.ok){n.textContent=(d&&d.say)||'Samsung setup is on the iPhone app for now';return}
    if(!nxFound.length){n.textContent='No Samsung TV answered. Is it on, on the same Wi-Fi, with "IP remote" allowed in its settings?';return}
    n.textContent='Tap yours:';
    nxFound.forEach(function(f,i){var b=document.createElement('button');b.className='app';b.style.cssText='height:48px;width:100%;font-size:13px';b.setAttribute('data-fn','nxSamsungPick');b.dataset.i=i;
      b.textContent=(f.name||'Samsung TV')+(f.model?' · '+f.model:'')+' · '+f.ip;list.appendChild(b)})},function(){n.textContent='Could not scan'})}
function nxSamsungPick(el){var f=nxFound[+(el&&el.dataset?el.dataset.i:-1)];if(!f)return;var n=document.getElementById('nxSamsungNote');
  n.textContent='Adding '+(f.name||f.ip)+'…';
  window.__ask('samsung:add:'+f.ip).then(function(d){if(!d||!d.ok){n.textContent=(d&&d.say)||'Could not add it';return}
    n.textContent='On the Samsung, choose ALLOW for Grigson TV (up to 30 seconds)…';
    return window.__ask('samsung:pair').then(function(r){n.textContent=(r&&r.say)||'';
      return window.__ask('which').then(function(w){applyTV(w);note(nxLabel('samsung')+' added');paintGlance()})})})}
function nxSamsungRename(){var r=document.getElementById('nxSamsungName');if(r){r.style.display='flex';document.getElementById('nxSamsungNameBox').value=nxLabel('samsung');document.getElementById('nxSamsungNameBox').focus()}}
function nxSamsungSaveName(){var v=(document.getElementById('nxSamsungNameBox').value||'').trim();if(!v)return;
  window.__ask('samsung:name:'+v).then(function(){return window.__ask('which')}).then(function(w){applyTV(w);paintGlance();note('Renamed')})}
function nxSamsungForget(){window.__ask('samsung:forget').then(function(d){if(d&&d.say)note(d.say);return window.__ask('which')}).then(function(w){applyTV(w);paintGlance()})}
// Hold a direction or volume key:'''
rep("// Hold a direction or volume key:", JS)

CSS = '''#simpleRemote .nx-rooms-many{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
#simpleRemote .nx-rooms-many::-webkit-scrollbar{display:none}
#simpleRemote .nx-rooms-many .nx-room{flex:0 0 auto;min-width:calc(150 * var(--u));padding:0 calc(18 * var(--u))}
#simpleRemote .nx-room{white-space:nowrap}
#simpleRemote #smartRow{margin-top:calc(12 * var(--u))}'''
rep("#simpleRemote #smartRow{margin-top:calc(12 * var(--u))}", CSS)
open(S + 'nexus-patch.py', 'w').write(p)

q = open(S + 'all-in-settings-patch.py').read()
def rq(a, b):
    global q
    n = q.count(a)
    if n != 1: raise SystemExit('all-in-settings anchor found %d times: %s' % (n, a[:70]))
    q = q.replace(a, b)
rq("'and pauses the other one; you pick the show again.</div></div>\\n')",
   "'and pauses the other one; you pick the show again.</div><div id=\"nxTvAdd\" style=\"display:flex;flex-direction:column;gap:8px\"></div></div>\\n')")
rq('''        "var __setAll=openSettings;\\nopenSettings=function(){__setAll();paintGlance(smOther,false);\\n"
        "  window.__ask('other:status').then(function(d){smOther=d&&d.ok?d:null;smOtherT=Date.now();if(smOther)smOtherFail=0;"
        "paintGlance(smOther,!!(d&&d.needPair));paintSmart()},function(){})};\\n// ===== XBOX END", 'settings glance')''',
   '''        "var __setAll=openSettings;\\nopenSettings=function(){__setAll();paintGlance();\\n"
        "  pollOther(true).then(function(){paintGlance()},function(){})};\\n// ===== XBOX END", 'settings glance')''')
open(S + 'all-in-settings-patch.py', 'w').write(q)
print('patch scripts updated')
