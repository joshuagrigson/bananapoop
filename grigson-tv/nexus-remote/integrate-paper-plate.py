#!/usr/bin/env python3
"""Replace the Simple layout in paper-plate's remote pages with the NEXUS remote.
Run: python3 nexus-patch.py <styles.css from the mock> <remote.html> [<remote.html> ...]
Every anchor must match exactly once per page, or the page is left untouched."""
import re, sys

css_src = open(sys.argv[1]).read()

# ---------- 1. CSS: NEXUS rules scoped under #simpleRemote, classes prefixed nx- ----------
NAMES = ['icon','chrome','header','brand','settings','rooms','room','status-source','status-alias','status','dot','off',
 'power','inputs-heading','edit','inputs','input-card','port','state-line','on-screen','hidden-count','navigation',
 'mode-selector','mode','track-surface','contact','touching','track-copy','dpad-art','dpad',
 'direction','triangle','up','down','left','right','is-pressed','center-select','primary','okay','volume-row',
 'volume-strip','volume-key','volume-readout','volume-label','volume-number','meter-fill','meter','mute','playback',
 'media-icon','bottom','voice']
DROP = ('root','*','body','button','#remotes','.remote','.comparison','[hidden]','.toast','dialog','@media')
rules=[]
for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', re.sub(r'/\*.*?\*/','',css_src,flags=re.S)):
    sel,body=m.group(1).strip(),m.group(2).strip()
    if sel.startswith(DROP) or sel.startswith('.close') or sel in ('.remote-inner',): continue
    for n in sorted(NAMES,key=len,reverse=True):
        sel=re.sub(r'\.'+re.escape(n)+r'(?![\w-])','.nx-'+n,sel)
    sel=','.join('#simpleRemote '+s.strip() for s in sel.split(','))
    rules.append(sel+'{'+body+'}')
OVERRIDES = """/* Layout 2 (Joshua 2026-11-07): rooms and the smart row at the bottom, shorter input tiles, bigger lower keys. Same 1192-unit stack. */
#simpleRemote .nx-input-card{height:calc(72 * var(--u));font-size:calc(19 * var(--u));padding:calc(4 * var(--u)) calc(3 * var(--u))}
#simpleRemote .nx-input-card > .nx-icon{width:calc(34 * var(--u));height:calc(22 * var(--u));margin-bottom:0}
#simpleRemote .nx-input-card .nx-port{font-size:calc(14 * var(--u));margin-top:0}
#simpleRemote .nx-input-card{position:relative;overflow:hidden}
#simpleRemote .nx-led{position:absolute;top:calc(8 * var(--u));right:calc(9 * var(--u));width:calc(10 * var(--u));height:calc(10 * var(--u));border-radius:50%;background:var(--green);box-shadow:0 0 8px #22e72aa0,0 0 2px #fff6}
#simpleRemote .nx-input-card .nx-name{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#simpleRemote .nx-hidden-count{height:calc(18 * var(--u));font-size:calc(14 * var(--u))}
#simpleRemote .nx-primary{height:calc(78 * var(--u));margin-top:calc(14 * var(--u))}
#simpleRemote .nx-primary button{font-size:calc(24 * var(--u))}
#simpleRemote .nx-primary .nx-okay{font-size:calc(34 * var(--u))}
#simpleRemote .nx-volume-row{height:calc(82 * var(--u));margin-top:calc(21 * var(--u))}
#simpleRemote .nx-volume-key{font-size:calc(50 * var(--u))}
#simpleRemote .nx-mute{font-size:calc(23 * var(--u))}
#simpleRemote .nx-playback{height:calc(86 * var(--u))}
#simpleRemote .nx-media-icon{width:calc(70 * var(--u));height:calc(40 * var(--u))}
#simpleRemote .nx-bottom{height:calc(92 * var(--u))}
#simpleRemote .nx-bottom button{font-size:calc(28 * var(--u))}
/* Power is its own pill, a clear gap from the info bar. */
#simpleRemote .nx-status{background:none;border:0;box-shadow:none;padding:0;gap:calc(14 * var(--u));height:calc(60 * var(--u))}
#simpleRemote .nx-status-bar{flex:1;min-width:0;height:100%;display:flex;align-items:center;gap:calc(16 * var(--u));padding-left:calc(21 * var(--u));border-radius:calc(22 * var(--u))}
#simpleRemote .nx-status-source{overflow:hidden;text-overflow:ellipsis}
#simpleRemote .nx-power{margin-left:0;height:100%;width:calc(130 * var(--u));font-size:calc(34 * var(--u));border-radius:calc(22 * var(--u));color:#ffcbc2;border:1px solid #ff978f;background:radial-gradient(ellipse at top,#a25751,#742b28 65%,#562421);box-shadow:inset 0 1px 3px #ffdfc080,0 0 15px #ff67565c,0 5px 12px #000a}
#simpleRemote .nx-power[aria-pressed=false]{background:#342120;box-shadow:0 0 5px #ff675628,0 5px 12px #000a}
/* Settings is one gear beside the room switch at the bottom; Edit is plain text in the INPUTS line. Power stands alone up top. */
#simpleRemote .nx-foot{display:flex;gap:calc(12 * var(--u));margin-top:calc(10 * var(--u));height:calc(48 * var(--u))}
#simpleRemote .nx-foot .nx-rooms{flex:1;min-width:0;margin-top:0;height:100%}
#simpleRemote .nx-settings{width:calc(60 * var(--u));height:100%;padding:0;justify-content:center;border-radius:calc(24 * var(--u));font-size:calc(26 * var(--u))}
#simpleRemote .nx-inputs-heading{height:calc(44 * var(--u));justify-content:flex-start;gap:calc(18 * var(--u))}
#simpleRemote .nx-edit{height:100%;padding:0 calc(6 * var(--u));border:0;background:none;box-shadow:none;color:var(--muted);font-size:calc(19 * var(--u));gap:.4em;border-radius:0}
#simpleRemote .nx-navigation{height:calc(366 * var(--u))}
#simpleRemote .nx-volume-readout{touch-action:none;cursor:ew-resize;transition:none}
#simpleRemote .nx-volume-readout.nx-dragging .nx-volume-number{color:#fff;text-shadow:0 0 8px #fff8}
#simpleRemote .nx-volume-readout.nx-dragging .nx-meter-fill{background:linear-gradient(#ffffff,#d9dddd);box-shadow:0 0 10px #ffffffa0}
#simpleRemote #smartRow{margin-top:calc(12 * var(--u))}
"""
NX_CSS = """/* ----- NEXUS layout (Smoky Silver / Black). Art units: --u = 1/558 of the remote's width. ----- */
#simpleRemote{display:none;border-radius:20px;
/* One art unit = 1/558 of the remote's width. nxFit() pins --u once per launch so the 1192-unit stack fits the screen without ever re-flowing live. */
--u:min(calc((100vw - 32px) / 558),calc(400px / 558));
width:calc(558 * var(--u));max-width:100%;
background:radial-gradient(ellipse at 50% 45%,#0b0d0e 0%,#08090a 75%,#0b0c0d 100%);border:1px solid #121416;box-shadow:0 12px 40px #0007;color:#f3f3f1;
--page:#070809;--text:#f3f3f1;--muted:#b7b8b8;--silver:#c5c8ca;--silver-light:#eff1f1;--green:#19ee30;--voice:#04e58b;--coral:#ff8177;--press-ms:110ms}
#simpleRemote .nx-inner{padding:calc(6 * var(--u)) calc(24 * var(--u)) calc(40 * var(--u));font-size:calc(24 * var(--u))}
#simpleRemote button{height:auto;min-height:0;border:0;border-radius:0;background:none;box-shadow:none;color:inherit;font:inherit;font-weight:400;letter-spacing:0;padding:0;touch-action:manipulation;transition:filter 110ms,transform 110ms,box-shadow 180ms}
#simpleRemote button:active,#simpleRemote button.pressed{filter:brightness(1.2);transform:scale(.98)}
#simpleRemote h1,#simpleRemote h2,#simpleRemote p{margin:0}
#simpleRemote #smartRow{display:flex;gap:calc(8 * var(--u));margin-top:calc(9 * var(--u))}
#simpleRemote #smartRow:empty{display:none}
#simpleRemote #smartRow button{flex:1 1 0;min-width:0;height:calc(44 * var(--u));border-radius:calc(22 * var(--u));padding:0 calc(4 * var(--u));font-size:calc(16 * var(--u));letter-spacing:.04em;white-space:nowrap;
background:linear-gradient(160deg,#5a5953 0%,#3a3935 28%,#232220 72%,#2d2c2a);border:1px solid #8e8e8a8c;box-shadow:inset 0 1px 0 #ffffff26,0 3px 7px #0006}
#simpleRemote #smartRow button[disabled]{opacity:.35}
#simpleRemote .nx-voice.live{filter:brightness(1.35)}
body.nx{background:radial-gradient(ellipse at 50% 30%,#111315 0%,#070809 65%)}
""" + '\n'.join(rules) + '\n' + OVERRIDES

# ---------- 2. HTML ----------
ICON = {
 'settings':'<path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2v-3l-1-2 2-3 2 .2z"/><circle cx="12" cy="10.5" r="3.4"/>',
 'power':'<path d="M12 2v10M6.4 5.2a9 9 0 1 0 11.2 0"/>',
 'edit':'<path d="m4 16-1 5 5-1L21 7l-4-4zM14.5 5.5l4 4"/>',
 'back':'<path d="m8 5-6 6 6 6M2 11h13a5 5 0 0 1 0 10h-3"/>',
 'home':'<path d="m1 11 11-9 11 9M4 9v13h6v-8h4v8h6V9"/>',
 'mute':'<path d="m3 9 5 0 5-5v16l-5-5H3zM17 7a8 8 0 0 1 3 8M2 2l20 20"/>',
 'mic':'<rect x="9" y="1" width="6" height="14" rx="3"/><path d="M5 10v3a7 7 0 0 0 14 0v-3M12 20v3M8 23h8"/>',
 'apps':'<g fill="currentColor" stroke="none"><rect x="2" y="2" width="8" height="8" rx=".7"/><rect x="14" y="2" width="8" height="8" rx=".7"/><rect x="2" y="14" width="8" height="8" rx=".7"/><rect x="14" y="14" width="8" height="8" rx=".7"/></g>',
}
def icon(n): return '<svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true">'+ICON[n]+'</svg>'
def media(n):
    p={'rewind':'<path d="M23 4 3 15l20 11zM46 4 26 15l20 11z"/>','forward':'<path d="m6 4 20 11L6 26zM29 4l20 11-20 11z"/>','play':'<path d="m4 3 18 12L4 27z"/><path d="M31 3h4v24h-4zM44 3h4v24h-4z"/>'}[n]
    return '<svg class="nx-media-icon" viewBox="0 0 52 30" aria-hidden="true">'+p+'</svg>'
CROSS="M184 1H326Q340 1 340 15V76Q340 90 354 90H495Q509 90 509 104V196Q509 210 495 210H354Q340 210 340 224V285Q340 299 326 299H184Q170 299 170 285V224Q170 210 156 210H15Q1 210 1 196V104Q1 90 15 90H156Q170 90 170 76V15Q170 1 184 1Z"
DPAD_ART=('<svg class="dpad-art" viewBox="0 0 510 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="plate-nx" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#9a9d9e"/><stop offset=".2" stop-color="#5e6263"/><stop offset=".6" stop-color="#424546"/><stop offset="1" stop-color="#353839"/></linearGradient><linearGradient id="bevel-nx" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient><radialGradient id="void-nx"><stop stop-color="#121415"/><stop offset="1" stop-color="#070909"/></radialGradient><filter id="bloom-nx" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="8"/></filter><filter id="glow-nx" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.5"/></filter><clipPath id="clip-nx"><path d="'+CROSS+'"/></clipPath></defs><rect x="1" y="1" width="508" height="298" rx="22" fill="url(#void-nx)" stroke="#2c2f30"/><g fill="#151717" stroke="#242727"><rect x="8" y="8" width="156" height="78" rx="16"/><rect x="346" y="8" width="156" height="78" rx="16"/><rect x="8" y="214" width="156" height="78" rx="16"/><rect x="346" y="214" width="156" height="78" rx="16"/></g><path d="'+CROSS+'" fill="none" stroke="#ffffff" stroke-width="13" filter="url(#bloom-nx)" opacity=".32"/><path d="'+CROSS+'" fill="none" stroke="#f4f7f7" stroke-width="3" filter="url(#glow-nx)" opacity=".7"/><path d="'+CROSS+'" fill="url(#plate-nx)" stroke="#f3f6f6" stroke-width="2"/><path d="'+CROSS+'" fill="url(#bevel-nx)"/><path d="'+CROSS+'" fill="none" stroke="#ffffff" stroke-width="5" opacity=".28" clip-path="url(#clip-nx)" filter="url(#glow-nx)"/></svg>').replace('class="dpad-art"','class="nx-dpad-art"')
DIRS=''.join('<button class="nx-direction nx-%s" data-c="%s" data-repeat="1" aria-label="%s"><span class="nx-triangle">%s</span><span>%s</span></button>'%(d,d,d,g,d.upper()) for d,g in [('up','&#9650;'),('left','&#9664;'),('right','&#9654;'),('down','&#9660;')])
NX_HTML = f"""<div id="simpleRemote"><div class="nx-inner">
 <header class="nx-header"><h1 class="nx-brand">REMOTE</h1></header>
 <div id="nxStatus" class="nx-status"><div class="nx-status-bar nx-chrome"><span id="nxDot" class="nx-dot nx-off" aria-hidden="true"></span><span id="nxSource" class="nx-status-source">Connecting…</span><span id="nxAlias" class="nx-status-alias"></span></div><button id="sPower" class="nx-power nx-chrome" data-c="power" aria-label="Power" aria-pressed="false">{icon('power')}</button></div>
 <div class="nx-inputs-heading"><h2>INPUTS</h2><button class="nx-edit" data-fn="openInEdit">{icon('edit')}Edit</button></div>
 <div id="sInputs" class="nx-inputs" aria-label="TV inputs"></div><p id="nxHidden" class="nx-hidden-count"></p>
 <section id="nxNav" class="nx-navigation" aria-label="Navigation">
  <div class="nx-mode-selector" role="tablist" aria-label="Navigation mode"><button class="nx-mode" role="tab" data-mode="trackpad" aria-selected="true">Trackpad</button><button class="nx-mode" role="tab" data-mode="dpad" aria-selected="false">D-pad</button></div>
  <div id="nxTrack" class="nx-track-surface" role="tabpanel"><span id="nxContact" class="nx-contact"></span><p id="nxCopy" class="nx-track-copy">Swipe to navigate<br>Tap to select</p></div>
  <div id="nxDpad" class="nx-dpad" role="tabpanel" hidden>{DPAD_ART}{DIRS}<button class="nx-center-select" data-c="ok">SELECT</button></div>
 </section>
 <div class="nx-volume-row"><div class="nx-volume-strip"><button class="nx-volume-key nx-chrome" data-c="volumeDown" data-repeat="1" aria-label="Volume down">&minus;</button><div id="nxReadout" class="nx-volume-readout" aria-label="Volume. Press and drag to set."><div class="nx-volume-label">VOLUME<span id="nxVol" class="nx-volume-number">–</span></div><div class="nx-meter" role="meter" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="nxMeter" class="nx-meter-fill" style="width:0%"></div></div></div><button class="nx-volume-key nx-chrome" data-c="volumeUp" data-repeat="1" aria-label="Volume up">+</button></div><button id="nxMute" class="nx-mute nx-chrome" data-c="mute" aria-pressed="false">{icon('mute')}Mute</button></div>
 <div class="nx-primary"><button class="nx-chrome" data-c="back">{icon('back')}Back</button><button class="nx-okay" data-c="ok">OK</button><button class="nx-chrome" data-c="home">{icon('home')}Home</button></div>
 <div class="nx-playback"><button class="nx-chrome" data-c="rewind" aria-label="Rewind">{media('rewind')}</button><button class="nx-chrome" data-c="pause" aria-label="Play or pause">{media('play')}</button><button class="nx-chrome" data-c="fastForward" aria-label="Fast forward">{media('forward')}</button></div>
 <div class="nx-bottom"><button id="sMic" class="nx-voice" data-fn="talk">{icon('mic')}Say it</button><button class="nx-chrome" data-fn="openApps">{icon('apps')}Apps</button></div>
 <div id="nxSmart"></div>
 <div class="nx-foot"><div id="nxRooms" class="nx-rooms" role="group" aria-label="TV"><button class="nx-room" data-fn="nxLiving" data-tv="lg" aria-pressed="true">Living room</button><button class="nx-room" data-fn="nxOffice" data-tv="vizio" aria-pressed="false">Office</button></div><button class="nx-settings nx-chrome" data-fn="openSettings" aria-label="Settings">{icon('settings')}</button></div>
</div></div>
"""

# ---------- 3. JS ----------
NX_JS = r"""// ===== NEXUS: the Smoky Silver remote (Joshua's 2026-11-07 design) in place of the old Simple layout.
// Rooms, status, inputs, volume and mute are painted from the same TV status the strip used; every
// button sends the same command strings as before (data-c) or calls the same page functions (data-fn).
function nxLiving(){useTV('lg')}
function nxOffice(){useTV('vizio')}
var NX_ICONS={cable:'<rect x="2" y="6" width="20" height="12" rx="1.5"/><path d="M6 12h.1M15 12h.1M19 12h.1"/>',
  game:'<path d="M7 5h10q3 0 4 4l2 10q0 3-3 1l-4-4H8l-4 4q-3 2-3-1L3 9q1-4 4-4zM7 8v6M4 11h6M16 10h.1M19 13h.1"/>',
  stream:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  pc:'<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M1 20h22"/>',
  antenna:'<path d="M12 22V10M5 3a10 10 0 0 1 14 0M8 6a6 6 0 0 1 8 0"/><circle cx="12" cy="9" r="1.5"/>',
  other:'<rect x="1.5" y="7" width="21" height="10" rx="3"/><path d="M6 12h12"/>'};
function nxIcon(k){return '<svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true">'+(NX_ICONS[k]||NX_ICONS.other)+'</svg>'}
function nxCur(){return lastStatus&&lastStatus.ok&&lastStatus.app?(String(lastStatus.app).match(/HDMI[ _-]?(\d)/i)||[])[1]||null:null}
// Status row: dot, what's on (HDMI 2 | PS5), power. Volume and mute live in their own row.
var nxVolDrag=false;
function paintNexus(d){
  var dot=document.getElementById('nxDot'),src=document.getElementById('nxSource'),al=document.getElementById('nxAlias'),st=document.getElementById('nxStatus');
  if(!dot)return;
  var vol=document.getElementById('nxVol'),met=document.getElementById('nxMeter');
  function volume(v,m){if(nxVolDrag)return;vol.textContent=v>=0?v:'–';met.style.width=Math.max(0,Math.min(100,v>=0?v:0))+'%';met.parentNode.setAttribute('aria-valuenow',v>=0?v:0);
    document.getElementById('nxMute').setAttribute('aria-pressed',m?'true':'false')}
  if(d&&d.needPin){dot.className='nx-dot nx-off';src.textContent='Office TV: tap to pair';al.textContent='';st.onclick=function(){pinShown=false;openPin()};volume(-1,false);
    document.getElementById('sPower').setAttribute('aria-pressed','false');return}
  st.onclick=null;
  if(!d||!d.ok){dot.className='nx-dot nx-off';src.textContent=(tvKind==='vizio'?'Office TV':'TV')+' off or not on home Wi-Fi';al.textContent='';volume(-1,false);
    document.getElementById('sPower').setAttribute('aria-pressed','false');return}
  dot.className='nx-dot';document.getElementById('sPower').setAttribute('aria-pressed','true');
  var cur=nxCur(),named='';
  if(cur){var x=inSaved().filter(function(y){return String(y.n)===String(cur)})[0];if(x)named=inLabel(x);if(named==='HDMI '+cur)named=''}
  src.textContent=cur?'HDMI '+cur:(d.app||'TV');al.textContent=named;
  volume(d.volume,!!d.muted);
}
// Input tiles: name, port, green dot when the TV says something is plugged in and on, "On screen" for the current one.
function paintInputs(){var box=document.getElementById('sInputs');if(!box)return;
  var cur=nxCur(),all=inSaved(),list=all.filter(function(x){return x.show});
  box.style.gridTemplateColumns='repeat('+Math.min(Math.max(list.length,1),4)+',minmax(0,1fr))';
  box.innerHTML='';
  list.forEach(function(x){var t=tvInputs&&tvInputs[x.n],on=!!(t&&t.connected),label=inLabel(x),sel=String(x.n)===String(cur),port='HDMI '+x.n;
    var b=document.createElement('button');b.className='nx-input-card nx-chrome';
    b.setAttribute('data-c','hdmi'+x.n);b.setAttribute('aria-pressed',sel?'true':'false');
    b.setAttribute('aria-label',label+', '+port+(on?', device on':'')+(sel?', on screen':''));
    // A device that is on gets a small green light in the corner; the current input is the lit tile.
    b.innerHTML=nxIcon(x.icon)+'<span class="nx-name"></span>'+(label!==port?'<span class="nx-port">'+port+'</span>':'')+(on?'<span class="nx-led" aria-hidden="true"></span>':'');
    b.querySelector('.nx-name').textContent=label;
    box.appendChild(b)});
  var hid=all.length-list.length;document.getElementById('nxHidden').textContent=hid?hid+' hidden':'';
}
// Volume: − and + are the keys. Press and drag across the meter to set a level; the number follows
// the finger and ONE command goes out on release. A tap on the meter does nothing (no accidental blasts).
(function(){
  var area=document.getElementById('nxReadout'),met=document.getElementById('nxMeter'),num=document.getElementById('nxVol');if(!area)return;
  var g=null;
  function level(x){var r=met.parentNode.getBoundingClientRect();return Math.max(0,Math.min(100,Math.round((x-r.left)/r.width*100)))}
  area.addEventListener('pointerdown',function(e){if(!e.isPrimary)return;area.setPointerCapture(e.pointerId);g={id:e.pointerId,x:e.clientX,v:null}},{passive:true});
  area.addEventListener('pointermove',function(e){if(!g||g.id!==e.pointerId)return;
    if(g.v===null&&Math.abs(e.clientX-g.x)<10)return;
    g.v=level(e.clientX);nxVolDrag=true;area.classList.add('nx-dragging');num.textContent=g.v;met.style.width=g.v+'%'});
  function end(e){if(!g||g.id!==e.pointerId)return;var v=g.v;g=null;area.classList.remove('nx-dragging');
    if(v===null)return;
    doCmd('vol',[String(v)]).then(function(){nxVolDrag=false;pollStatus()},function(){nxVolDrag=false})}
  area.addEventListener('pointerup',end);area.addEventListener('pointercancel',function(e){if(g&&g.id===e.pointerId){g=null;nxVolDrag=false;area.classList.remove('nx-dragging');paintNexus(lastStatus)}});
})();
// Hold a direction or volume key: it repeats after 420 ms, every 120 ms, until the finger lifts.
// The press itself still fires on release through tapGuard, unless the hold already fired.
(function(){
  var delay=null,timer=null,el=null;
  function stop(){clearTimeout(delay);clearInterval(timer);delay=timer=null;el=null}
  document.addEventListener('pointerdown',function(e){
    var b=e.target.closest('[data-repeat]');if(!b)return;stop();el=b;
    delay=setTimeout(function(){b.dataset.held='1';go(b.dataset.c);timer=setInterval(function(){go(b.dataset.c)},120)},420)},{passive:true});
  ['pointerup','pointercancel'].forEach(function(t){document.addEventListener(t,stop,{passive:true})});
  window.addEventListener('blur',stop);document.addEventListener('visibilitychange',function(){if(document.hidden)stop()});
})();
// Size: one fixed scale per launch (and per rotation), never a live function of the viewport.
// A remote that re-flows with every viewport twitch feels loose; this one is measured once and pinned.
function nxFit(){var el=document.getElementById('simpleRemote');if(!el)return;
  var cs=getComputedStyle(document.body),pt=parseFloat(cs.paddingTop)||0,pb=parseFloat(cs.paddingBottom)||0;
  var w=window.innerWidth,h=window.innerHeight;
  var u=Math.min((w-32)/558,400/558,(h-pt-pb-4)/1192);
  el.style.setProperty('--u',u.toFixed(4)+'px');el.style.width=(558*u).toFixed(1)+'px'}
var nxFitW=0;
function nxFitMaybe(){if(window.innerWidth!==nxFitW){nxFitW=window.innerWidth;nxFit()}}
nxFitMaybe();
window.addEventListener('orientationchange',function(){setTimeout(nxFitMaybe,80)});
window.addEventListener('resize',nxFitMaybe);
// Trackpad / D-pad. The selector switches only this panel.
var nxMode='trackpad';
function nxSetMode(m){nxMode=m;lsSet('nxMode',m);
  document.querySelectorAll('#nxNav .nx-mode').forEach(function(b){b.setAttribute('aria-selected',b.dataset.mode===m?'true':'false')});
  document.getElementById('nxTrack').hidden=m!=='trackpad';document.getElementById('nxDpad').hidden=m!=='dpad'}
(function(){
  var panel=document.getElementById('nxNav');if(!panel)return;
  var pad=document.getElementById('nxTrack'),contact=document.getElementById('nxContact'),g=null,inertia=null;
  // TWO WAYS TO MOVE. A quick swipe: the first clear movement sends one press and locks the
  // direction; a long swipe adds +1 past 140 px, +2 past 230 px at release, by distance only.
  // A slow steady pull: while the finger creeps (under 0.45 px/ms) it steps every 36 px in
  // whatever direction it is creeping, for fine control. A pull never earns release extras.
  var SWIPE=30,RATIO=1.25,SLOP=9,TAPMS=350,HEAVY=140,VERYHEAVY=230,EXTRAMS=90,SLOWV=.45,PULL=36;
  function swipeDir(sx,sy){var h=Math.abs(sx)>Math.abs(sy)*RATIO,v=Math.abs(sy)>Math.abs(sx)*RATIO;if(!h&&!v)return null;
    var d=h?sx:sy;if(Math.abs(d)<SWIPE)return null;return h?(d>0?'right':'left'):(d>0?'down':'up')}
  function extraSteps(dist){return dist>=VERYHEAVY?2:dist>=HEAVY?1:0}
  panel.addEventListener('click',function(e){var m=e.target.closest('[data-mode]');if(m)nxSetMode(m.dataset.mode)});
  panel.addEventListener('pointerdown',function(e){
    if(!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
    if(!(e.target===pad||pad.contains(e.target)))return;
    if(pad.hidden)return;
    clearInterval(inertia);panel.setPointerCapture(e.pointerId);e.preventDefault();
    g={id:e.pointerId,x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,lt:e.timeStamp,t0:e.timeStamp,ax:e.clientX,ay:e.clientY,steps:0,moved:false,dir:null,v:0};
    var r=pad.getBoundingClientRect();contact.style.left=(e.clientX-r.left)+'px';contact.style.top=(e.clientY-r.top)+'px';contact.classList.add('nx-touching')});
  panel.addEventListener('pointermove',function(e){
    if(!g||g.id!==e.pointerId)return;
    if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>SLOP)g.moved=true;
    var dt=Math.max(1,e.timeStamp-g.lt),iv=Math.hypot(e.clientX-g.lx,e.clientY-g.ly)/dt;g.v=g.v?g.v*.5+iv*.5:iv;g.lx=e.clientX;g.ly=e.clientY;g.lt=e.timeStamp;
    var r=pad.getBoundingClientRect();contact.style.left=Math.max(0,Math.min(r.width,e.clientX-r.left))+'px';contact.style.top=Math.max(0,Math.min(r.height,e.clientY-r.top))+'px';
    if(!g.dir){var d=swipeDir(e.clientX-g.x,e.clientY-g.y);if(!d)return;g.dir=d;g.steps=1;g.ax=e.clientX;g.ay=e.clientY;go(d);return}
    // Slow pull: steady steps while the finger creeps. Fast movement only moves the anchor.
    var sx=e.clientX-g.ax,sy=e.clientY-g.ay;
    if(g.v>SLOWV){g.ax=e.clientX;g.ay=e.clientY;return}
    var hz=Math.abs(sx)>=Math.abs(sy),dist=hz?sx:sy;if(Math.abs(dist)<PULL)return;
    g.pulled=true;g.ax=e.clientX;g.ay=e.clientY;go(hz?(sx>0?'right':'left'):(sy>0?'down':'up'))});
  function finish(e,cancelled){
    if(!g||g.id!==e.pointerId)return;var x=g;g=null;
    contact.classList.remove('nx-touching');contact.style.left='';contact.style.top='';
    if(cancelled)return;
    nxTrackUsed();
    if(!x.moved&&e.timeStamp-x.t0<=TAPMS){go('ok');return}
    if(!x.dir||x.pulled)return;
    var along={right:e.clientX-x.x,left:x.x-e.clientX,down:e.clientY-x.y,up:x.y-e.clientY}[x.dir];
    var left=extraSteps(along);
    if(left)inertia=setInterval(function(){if(left--<=0){clearInterval(inertia);return}go(x.dir)},EXTRAMS)}
  panel.addEventListener('pointerup',function(e){finish(e,false)});
  panel.addEventListener('pointercancel',function(e){finish(e,true)});
  nxSetMode(ls('nxMode','trackpad')==='dpad'?'dpad':'trackpad');
  if(ls('nxTrackUsed','0')==='1')nxTrackUsed();
})();
// The 'Swipe to navigate / Tap to select' copy shows until the trackpad has been used once on this phone.
function nxTrackUsed(){lsSet('nxTrackUsed','1');var c=document.getElementById('nxCopy');if(c)c.classList.add('used')}
"""

APPLY_LAYOUT_OLD = """function applyLayout(){var s=simpleOn();
  document.getElementById('simpleRemote').style.display=s?'flex':'none';
  document.getElementById('fullRemote').style.display=s?'none':'flex';
  var cb=document.getElementById('simpleOn');if(cb)cb.checked=s;
  if(s){paintInputs();inT=0}}"""
APPLY_LAYOUT_NEW = """function applyLayout(){var s=simpleOn();
  document.getElementById('simpleRemote').style.display=s?'block':'none';
  document.getElementById('fullRemote').style.display=s?'none':'flex';
  // NEXUS carries its own room selector and status row; the strip and the switch above are for the full remote.
  document.getElementById('tvSeg').style.display=s||kid()?'none':'';
  document.getElementById('status').style.display=s?'none':'';
  document.body.classList.toggle('nx',s);
  var sr=document.getElementById('smartRow');
  if(s)document.getElementById('nxSmart').appendChild(sr);else document.getElementById('mainScreen').insertBefore(sr,document.getElementById('simpleRemote'));
  var cb=document.getElementById('simpleOn');if(cb)cb.checked=s;
  if(s){paintNexus(lastStatus);paintInputs();inT=0}}"""

def patch(path):
    s=open(path).read()
    def rep(old,new,what):
        nonlocal s
        n=s.count(old)
        if n!=1: raise SystemExit('%s: anchor "%s" found %d times' % (path,what,n))
        s=s.replace(old,new)
    # CSS
    rep("#simpleRemote{display:none;width:100%;max-width:400px;flex-direction:column;gap:12px}\n","","old #simpleRemote rule")
    m=re.search(r"\.sdwrap\{.*?\.sgear\{align-self:center\}\n",s,flags=re.S); assert m, path+': simple css block'
    s=s[:m.start()]+NX_CSS+s[m.end():]
    # HTML
    m=re.search(r'<div id="simpleRemote">.*?<button class="gear sgear" onclick="openSettings\(\)">&#9881; Settings</button>\n</div>\n',s,flags=re.S); assert m, path+': simple html block'
    s=s[:m.start()]+NX_HTML+s[m.end():]
    rep('<div class="set-row"><span>Simple remote</span><input type="checkbox" id="simpleOn" onchange="layoutToggle(this.checked)"></div>\n  <div class="set-sub">Big buttons, a cursor pad, named inputs, SAY IT and APPS. Turn off for the full remote with scenes, typing, Photo on TV and Send from anywhere.</div>',
        '<div class="set-row"><span>NEXUS remote</span><input type="checkbox" id="simpleOn" onchange="layoutToggle(this.checked)"></div>\n  <div class="set-sub">The silver remote: trackpad or D-pad, named inputs, SAY IT and APPS. Turn off for the full remote with scenes, typing, the LG pointer, Photo on TV and Send from anywhere.</div>',
        'settings copy')
    # tapGuard: a held key already fired through the repeat timer
    rep("if(!t||e.pointerId!==t.id)return;var el=t.el;t=null;el.classList.remove('pressed');\n    if(el.dataset.c)go(el.dataset.c);",
        "if(!t||e.pointerId!==t.id)return;var el=t.el;t=null;el.classList.remove('pressed');\n    if(el.dataset.held){delete el.dataset.held;return}\n    if(el.dataset.c)go(el.dataset.c);",'tapGuard')
    rep(APPLY_LAYOUT_OLD,APPLY_LAYOUT_NEW,'applyLayout')
    rep("function layoutToggle(on){lsSet('layout',on?'simple':'full');applyLayout();note(on?'Simple remote':'Full remote')}",
        "function layoutToggle(on){lsSet('layout',on?'simple':'full');applyLayout();note(on?'NEXUS remote':'Full remote')}",'layoutToggle')
    # old paintInputs -> gone (NEXUS defines its own)
    m=re.search(r"function paintInputs\(\)\{var box=document\.getElementById\('sInputs'\);if\(!box\)return;\n  var cur=lastStatus.*?\n\}\n",s,flags=re.S); assert m, path+': old paintInputs'
    s=s[:m.start()]+s[m.end():]
    # old Simple cursor pad + caps -> NEXUS block
    m=re.search(r"// The Simple cursor pad: .*?\n\(function\(\)\{\n  var pad=document\.getElementById\('sPad'\).*?\n\}\)\(\);\n",s,flags=re.S); assert m, path+': old simple pad'
    s=s[:m.start()]+NX_JS+s[m.end():]
    rep("applyTV=function(d){__applyTVs(d);tvInputs=null;inT=0;applySimpleCaps();if(simpleOn())paintInputs()};",
        "applyTV=function(d){__applyTVs(d);tvInputs=null;inT=0;\n  document.querySelectorAll('#nxRooms .nx-room').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.tv===tvKind?'true':'false')});\n  if(simpleOn()){paintNexus(null);paintInputs()}};",'applyTV override')
    rep("applyKid=function(){__applyKidS();var p=document.getElementById('sPower');if(p)p.style.visibility=kid()?'hidden':''};",
        "applyKid=function(){__applyKidS();var k=kid();var p=document.getElementById('sPower');if(p)p.style.visibility=k?'hidden':'';\n  var r=document.getElementById('nxRooms');if(r)r.style.visibility=k?'hidden':'';if(simpleOn())document.getElementById('tvSeg').style.display='none'};",'applyKid override')
    rep("paintStatus=function(d){__paintS(d);if(simpleOn()){paintInputs();",
        "paintStatus=function(d){__paintS(d);if(simpleOn()){paintNexus(d);paintInputs();",'paintStatus override')
    rep("(function(){if(ls('layout',null)===null)lsSet('layout',ls('tvMode',null)===null?'simple':'full');\n  applySimpleCaps();applyLayout()})();",
        "(function(){if(ls('layout',null)===null)lsSet('layout',ls('tvMode',null)===null?'simple':'full');\n  applyLayout()})();",'layout init')
    open(path,'w').write(s)
    print('patched',path)

for p in sys.argv[2:]: patch(p)
