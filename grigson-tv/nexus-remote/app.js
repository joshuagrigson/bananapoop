/* NEXUS 1.0.0 — complete framework-free UI.
 * Local demo by default. No TV endpoints, credentials, analytics or network calls.
 * Production: NexusRemote.setAdapter(async command => { ... });
 * Confirmed device data enters via NexusRemote.setState(patch).
 */
(() => {
  'use strict';
  const gestureMath = window.NexusGesture;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const copy = value => JSON.parse(JSON.stringify(value));
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    settings: '<path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2v-3l-1-2 2-3 2 .2z"/><circle cx="12" cy="10.5" r="3.4"/>',
    power: '<path d="M12 2v10M6.4 5.2a9 9 0 1 0 11.2 0"/>',
    edit: '<path d="m4 16-1 5 5-1L21 7l-4-4zM14.5 5.5l4 4"/>',
    cable: '<rect x="2" y="6" width="20" height="12" rx="1.5"/><path d="M6 12h.1M15 12h.1M19 12h.1"/>',
    game: '<path d="M7 5h10q3 0 4 4l2 10q0 3-3 1l-4-4H8l-4 4q-3 2-3-1L3 9q1-4 4-4zM7 8v6M4 11h6M16 10h.1M19 13h.1"/>',
    hdmi: '<rect x="1.5" y="7" width="21" height="10" rx="3"/><path d="M6 12h12"/>',
    back: '<path d="m8 5-6 6 6 6M2 11h13a5 5 0 0 1 0 10h-3"/>',
    home: '<path d="m1 11 11-9 11 9M4 9v13h6v-8h4v8h6V9"/>',
    mute: '<path d="m3 9 5 0 5-5v16l-5-5H3zM17 7a8 8 0 0 1 3 8M2 2l20 20"/>',
    mic: '<rect x="9" y="1" width="6" height="14" rx="3"/><path d="M5 10v3a7 7 0 0 0 14 0v-3M12 20v3M8 23h8"/>',
    apps: '<g fill="currentColor" stroke="none"><rect x="2" y="2" width="8" height="8" rx=".7"/><rect x="14" y="2" width="8" height="8" rx=".7"/><rect x="2" y="14" width="8" height="8" rx=".7"/><rect x="14" y="14" width="8" height="8" rx=".7"/></g>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
  const media = name => `<svg class="media-icon" viewBox="0 0 52 30" aria-hidden="true">${name === 'rewind' ? '<path d="M23 4 3 15l20 11zM46 4 26 15l20 11z"/>' : name === 'forward' ? '<path d="m6 4 20 11L6 26zM29 4l20 11-20 11z"/>' : '<path d="m4 3 18 12L4 27z"/><path d="M31 3h4v24h-4zM44 3h4v24h-4z"/>'}</svg>`;
  const inputs = [
    {id:'hdmi1',name:'Cable',port:'HDMI 1',icon:'cable',on:true,hidden:false},
    {id:'hdmi2',name:'PS5',port:'HDMI 2',icon:'game',on:true,hidden:false},
    {id:'hdmi3',name:'HDMI 3',port:'HDMI 3',icon:'hdmi',on:false,hidden:false},
    // Original only specifies one hidden input; no invented device identity.
    {id:'hidden-input',name:'Hidden input',port:'',icon:'hdmi',on:false,hidden:true}
  ];
  const state = {room:'living',rooms:{
    living:{power:true,volume:18,muted:false,playing:false,activeInput:'hdmi2',inputs:copy(inputs)},
    office:{power:true,volume:18,muted:false,playing:false,activeInput:'hdmi2',inputs:copy(inputs)}
  }};
  const current = () => state.rooms[state.room];
  const settings = {haptics:false};
  const modes = new Map();
  const query = new URLSearchParams(location.search);
  const comparison = query.get('compare') === '1';
  const host = $('#remotes');
  host.classList.toggle('comparison',comparison);
  let adapter = null;
  let toastTimer, holdDelay, holdTimer, inertiaTimer;
  let requestSequence = 0;
  let voiceActive = false;
  const commandLog = [];
  const gestureConfig = Object.freeze({tapSlop:9,tapMaxMs:350,swipePx:30,axisRatio:1.25,heavyPx:140,veryHeavyPx:230,extraIntervalMs:90,slowSpeed:.45,pullPx:36,holdDelayMs:420,holdIntervalMs:120});

  function notify(message) {
    const node=$('#toast'); node.textContent=message; node.classList.add('visible');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove('visible'),2200);
  }
  function cancelMotion() {
    clearTimeout(holdDelay); clearInterval(holdTimer); clearInterval(inertiaTimer);
    $$('.is-pressed').forEach(b=>b.classList.remove('is-pressed'));
  }
  function haptic() { if(settings.haptics && navigator.vibrate) navigator.vibrate(8); }
  function inputCards() {
    const s=current();
    return s.inputs.filter(item=>!item.hidden).map(item=>{
      const selected=item.id===s.activeInput;
      return `<button class="input-card chrome" data-action="input" data-value="${escapeHTML(item.id)}" aria-pressed="${selected}" aria-label="${escapeHTML(item.name)}, ${escapeHTML(item.port)}, ${item.on?'device on':'device off'}${selected?', on screen':''}">
      ${icon(item.icon)}<span>${escapeHTML(item.name)}</span>${item.name!==item.port?`<span class="port">${escapeHTML(item.port)}</span>`:''}
      ${(item.on||selected)?`<span class="state-line">${item.on?'<span class="dot"></span>On':''}${selected?'<span class="on-screen">On screen</span>':''}</span>`:''}</button>`;
    }).join('');
  }
  function dpadArt(id) {
    const cross='M184 1H326Q340 1 340 15V76Q340 90 354 90H495Q509 90 509 104V196Q509 210 495 210H354Q340 210 340 224V285Q340 299 326 299H184Q170 299 170 285V224Q170 210 156 210H15Q1 210 1 196V104Q1 90 15 90H156Q170 90 170 76V15Q170 1 184 1Z';
    return `<svg class="dpad-art" viewBox="0 0 510 300" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="plate-${id}" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#9a9d9e"/><stop offset=".2" stop-color="#5e6263"/><stop offset=".6" stop-color="#424546"/><stop offset="1" stop-color="#353839"/></linearGradient>
      <linearGradient id="bevel-${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
      <radialGradient id="void-${id}"><stop stop-color="#121415"/><stop offset="1" stop-color="#070909"/></radialGradient>
      <filter id="bloom-${id}" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="8"/></filter>
      <filter id="glow-${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.5"/></filter>
      <clipPath id="clip-${id}"><path d="${cross}"/></clipPath></defs>
      <rect x="1" y="1" width="508" height="298" rx="22" fill="url(#void-${id})" stroke="#2c2f30"/><g fill="#151717" stroke="#242727"><rect x="8" y="8" width="156" height="78" rx="16"/><rect x="346" y="8" width="156" height="78" rx="16"/><rect x="8" y="214" width="156" height="78" rx="16"/><rect x="346" y="214" width="156" height="78" rx="16"/></g>
      <path d="${cross}" fill="none" stroke="#ffffff" stroke-width="13" filter="url(#bloom-${id})" opacity=".32"/>
      <path d="${cross}" fill="none" stroke="#f4f7f7" stroke-width="3" filter="url(#glow-${id})" opacity=".7"/>
      <path d="${cross}" fill="url(#plate-${id})" stroke="#f3f6f6" stroke-width="2"/>
      <path d="${cross}" fill="url(#bevel-${id})"/>
      <path d="${cross}" fill="none" stroke="#ffffff" stroke-width="5" opacity=".28" clip-path="url(#clip-${id})" filter="url(#glow-${id})"/>
    </svg>`;
  }
  function markup(id) {
    return `<article class="remote" data-remote="${id}" aria-label="${id==='second'?'D-pad comparison remote':'Remote control'}"><div class="remote-inner">
      <header class="header"><h1 class="brand">REMOTE</h1><button class="settings chrome" data-action="settings">${icon('settings')}Settings</button></header>
      <div class="rooms" role="group" aria-label="Room"><button class="room" data-action="room" data-value="living" aria-pressed="true">Living room</button><button class="room" data-action="room" data-value="office" aria-pressed="false">Office</button></div>
      <div class="status chrome"><span class="dot connection" aria-label="TV on"></span><span class="status-source">HDMI 2</span><span class="status-alias">PS5</span><button class="power" data-action="power" aria-label="Power" aria-pressed="true">${icon('power')}</button></div>
      <div class="inputs-heading"><h2>INPUTS</h2><button class="edit chrome" data-action="edit">${icon('edit')}Edit</button></div>
      <div class="inputs" aria-label="TV inputs">${inputCards()}</div><p class="hidden-count">1 hidden</p>
      <section class="navigation" aria-label="Navigation controls">
        <div class="mode-selector" role="tablist" aria-label="Navigation mode"><button class="mode" role="tab" id="${id}-track-tab" data-mode="trackpad" aria-selected="true" aria-controls="${id}-track">Trackpad</button><button class="mode" role="tab" id="${id}-dpad-tab" data-mode="dpad" aria-selected="false" aria-controls="${id}-dpad" tabindex="-1">D-pad</button></div>
        <div class="track-surface" id="${id}-track" role="tabpanel" aria-labelledby="${id}-track-tab" tabindex="0" aria-description="A quick swipe moves the selection one step; a slow pull steps as you go. Tap to select. Arrow keys navigate and Enter selects."><span class="contact"></span><p class="track-copy">Swipe to navigate<br>Tap to select</p></div>
        <div class="dpad" id="${id}-dpad" role="tabpanel" aria-labelledby="${id}-dpad-tab" hidden>${dpadArt(id)}
          ${[['up','▲'],['left','◀'],['right','▶'],['down','▼']].map(([direction,glyph])=>`<button class="direction ${direction}" data-action="navigate" data-value="${direction}" data-repeat="true" aria-label="${direction}"><span class="triangle">${glyph}</span><span>${direction.toUpperCase()}</span></button>`).join('')}
          <button class="center-select" data-action="select">SELECT</button>
        </div>
      </section>
      <div class="primary"><button class="chrome" data-action="back">${icon('back')}Back</button><button class="okay" data-action="select">OK</button><button class="chrome" data-action="home">${icon('home')}Home</button></div>
      <div class="volume-row"><div class="volume-strip"><button class="volume-key chrome" data-action="volume" data-value="-1" data-repeat="true" aria-label="Volume down">−</button><div class="volume-readout"><div class="volume-label">VOLUME<span class="volume-number">18</span></div><div class="meter" role="meter" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="18"><div class="meter-fill" style="width:18%"></div></div></div><button class="volume-key chrome" data-action="volume" data-value="1" data-repeat="true" aria-label="Volume up">+</button></div><button class="mute chrome" data-action="mute" aria-pressed="false">${icon('mute')}Mute</button></div>
      <div class="playback"><button class="chrome" data-action="rewind" aria-label="Rewind">${media('rewind')}</button><button class="chrome" data-action="playPause" aria-label="Play or pause">${media('play')}</button><button class="chrome" data-action="fastForward" aria-label="Fast forward">${media('forward')}</button></div>
      <div class="bottom"><button class="voice" data-action="voice" aria-pressed="false">${icon('mic')}Say it</button><button class="chrome" data-action="apps">${icon('apps')}Apps</button></div>
    </div></article>`;
  }
  host.innerHTML=markup('first')+(comparison?markup('second'):'');
  // One fixed size per load (and per width change), never a live function of the viewport height.
  let fitWidth=0;
  function fit(){if(comparison||window.innerWidth===fitWidth)return;fitWidth=window.innerWidth;
    const w=Math.min(558,window.innerWidth-24,(window.innerHeight-46)*558/1145);
    $$('.remote').forEach(r=>{r.style.width=Math.max(240,w).toFixed(1)+'px';});}
  fit();window.addEventListener('resize',fit);window.addEventListener('orientationchange',()=>setTimeout(fit,80));
  function updateUI(rebuildInputs=false) {
    const s=current(); const active=s.inputs.find(i=>i.id===s.activeInput);
    $$('.remote').forEach(root=>{
      $$('.room',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===state.room)));
      $('.status-source',root).textContent=active?.port || active?.name || 'No input';
      $('.status-alias',root).textContent=active?.name!==active?.port ? active?.name || '' : '';
      $('.connection',root).classList.toggle('off',!s.power);
      $('.connection',root).setAttribute('aria-label',s.power?'TV on':'TV off');
      $('.power',root).setAttribute('aria-pressed',String(s.power));
      $('.volume-number',root).textContent=s.volume;
      $('.meter',root).setAttribute('aria-valuenow',s.volume);
      $('.meter-fill',root).style.width=s.volume+'%';
      $('.mute',root).setAttribute('aria-pressed',String(s.muted));
      $('.voice',root).setAttribute('aria-pressed',String(voiceActive));
      $('.hidden-count',root).textContent=s.inputs.filter(i=>i.hidden).length+' hidden';
      if(rebuildInputs) $('.inputs',root).innerHTML=inputCards();
    });
  }
  function setMode(root,mode) {
    if(!['trackpad','dpad'].includes(mode)) throw new Error('Unknown navigation mode');
    cancelMotion(); modes.set(root.dataset.remote,mode);
    $$('.mode',root).forEach(b=>{
      const active=b.dataset.mode===mode; b.setAttribute('aria-selected',String(active)); b.tabIndex=active?0:-1;
    });
    $('.track-surface',root).hidden=mode!=='trackpad'; $('.dpad',root).hidden=mode!=='dpad';
    root.dispatchEvent(new CustomEvent('nexus:modechange',{bubbles:true,detail:{mode}}));
    // This function intentionally does not call send(), change rooms, or mutate TV state.
  }
  $$('.remote').forEach((root,i)=>setMode(root,i===1?'dpad':query.get('mode')==='dpad'?'dpad':'trackpad'));

  async function send(type,value,source='button') {
    const command=Object.freeze({id:++requestSequence,type,value,roomId:state.room,source,time:Date.now()});
    commandLog.push(command); if(commandLog.length>500) commandLog.shift();
    document.dispatchEvent(new CustomEvent('nexus:command',{detail:command})); haptic();
    if(adapter) {
      try { await adapter(command); }
      catch(error) { cancelMotion(); notify('Command failed. Check TV connection.'); document.dispatchEvent(new CustomEvent('nexus:error',{detail:{command,error}})); }
      return;
    }
    const s=current();
    switch(type) {
      case 'room': cancelMotion(); state.room=value; updateUI(true); break;
      case 'input': s.activeInput=value; updateUI(true); break;
      case 'power': s.power=!s.power; updateUI(); break;
      case 'volume': s.volume=gestureMath.clampVolume(s.volume+value); updateUI(); break;
      case 'mute': s.muted=!s.muted; updateUI(); break;
      case 'playPause': s.playing=!s.playing; notify('Demo: '+(s.playing?'play':'pause')); break;
      case 'settings': showSettings(); break;
      case 'edit': showEdit(); break;
      case 'apps': showDialog('Apps','<p>The Apps command is ready to connect to your existing TV app launcher. No TV apps are connected in this local demo.</p>'); break;
      case 'voice': showDialog('Voice control','<p>The Say it command is ready for your existing voice service. This demo does not access your microphone or invent a speech-recognition backend.</p>'); break;
      case 'editInputs': break;
      default: notify('Demo: '+(type==='navigate'?value:type));
    }
  }
  function showDialog(title,html) { $('#dialog-title').textContent=title; $('#dialog-body').innerHTML=html; $('#dialog').showModal(); }
  function showSettings() {
    showDialog('Settings','<p>NEXUS Smoky Silver Black · Local interface demo.</p><label><input type="checkbox" id="haptics-setting"> Button haptics where supported</label><p>Connect a command adapter to use your existing device settings and TV controls.</p>');
    $('#haptics-setting').checked=settings.haptics; $('#haptics-setting').onchange=e=>settings.haptics=e.target.checked;
  }
  function showEdit() {
    showDialog('Edit inputs',`<p>Demo names and visibility for this room. The active input stays visible.</p><form id="edit-inputs">${current().inputs.map((item,i)=>`<label><input type="text" name="name-${i}" aria-label="Input ${i+1} name" value="${escapeHTML(item.name)}" maxlength="32"><input type="checkbox" name="visible-${i}" aria-label="Show input ${i+1}" ${!item.hidden?'checked':''} ${item.id===current().activeInput?'disabled':''}></label>`).join('')}<button class="save">Save</button></form>`);
    $('#edit-inputs').onsubmit=e=>{ e.preventDefault(); const form=e.currentTarget;
      current().inputs.forEach((item,i)=>{ item.name=form.elements['name-'+i].value.trim()||item.name; item.hidden=item.id===current().activeInput?false:!form.elements['visible-'+i].checked; });
      updateUI(true); send('editInputs',copy(current().inputs),'dialog'); $('#dialog').close();
    };
  }
  function buttonAction(button) {
    const {action,value}=button.dataset;
    send(action,action==='volume'?Number(value):value,'button');
  }
  host.addEventListener('click',event=>{
    const mode=event.target.closest('[data-mode]');
    if(mode) {setMode(mode.closest('.remote'),mode.dataset.mode);return;}
    const b=event.target.closest('[data-action]'); if(!b) return;
    // Repeating keys fire on pointerdown; detail=0 is native keyboard activation.
    if(b.dataset.repeat && event.detail!==0) return;
    buttonAction(b);
  });
  host.addEventListener('pointerdown',event=>{
    cancelMotion(); if(!event.isPrimary || (event.pointerType==='mouse'&&event.button!==0)) return;
    const b=event.target.closest('[data-repeat]'); if(!b) return;
    b.setPointerCapture(event.pointerId); b.classList.add('is-pressed'); buttonAction(b);
    holdDelay=setTimeout(()=>{holdTimer=setInterval(()=>buttonAction(b),gestureConfig.holdIntervalMs);},gestureConfig.holdDelayMs);
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>host.addEventListener(type,event=>{
    if(event.target.closest('[data-repeat]')) {clearTimeout(holdDelay);clearInterval(holdTimer);event.target.closest('[data-repeat]').classList.remove('is-pressed');}
  }));

  // The 'Swipe to navigate / Tap to select' copy shows until the trackpad has been used once on this device.
  function trackUsed(){try{return localStorage.getItem('nexusTrackUsed')==='1';}catch(e){return false;}}
  function markTrackUsed(){try{localStorage.setItem('nexusTrackUsed','1');}catch(e){}$$('.track-copy').forEach(p=>p.classList.add('used'));}
  if(trackUsed())$$('.track-copy').forEach(p=>p.classList.add('used'));
  $$('.navigation').forEach(panel=>{
    let gesture=null;
    const root=panel.closest('.remote'); const pad=$('.track-surface',panel); const contact=$('.contact',panel);
    panel.addEventListener('pointerdown',event=>{
      if(!event.isPrimary || (event.pointerType==='mouse'&&event.button!==0)) return;
      if(event.target!==pad && !pad.contains(event.target)) return;
      if(pad.hidden) return;
      cancelMotion(); panel.setPointerCapture(event.pointerId); event.preventDefault();
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,lastT:event.timeStamp,startT:event.timeStamp,ax:event.clientX,ay:event.clientY,steps:0,moved:false,direction:null,velocity:0};
      const r=pad.getBoundingClientRect();contact.style.left=(event.clientX-r.left)+'px';contact.style.top=(event.clientY-r.top)+'px';contact.classList.add('touching');
    });
    panel.addEventListener('pointermove',event=>{
      const g=gesture; if(!g||g.id!==event.pointerId) return;
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(Math.hypot(dx,dy)>gestureConfig.tapSlop) g.moved=true;
      const dt=Math.max(1,event.timeStamp-g.lastT);
      const instant=Math.hypot(event.clientX-g.lastX,event.clientY-g.lastY)/dt;
      g.velocity=g.velocity?g.velocity*.5+instant*.5:instant;
      g.lastX=event.clientX;g.lastY=event.clientY;g.lastT=event.timeStamp;
      const r=pad.getBoundingClientRect();contact.style.left=Math.max(0,Math.min(r.width,event.clientX-r.left))+'px';contact.style.top=Math.max(0,Math.min(r.height,event.clientY-r.top))+'px';
      if(!g.direction){
        const direction=gestureMath.swipeDirection(dx,dy,gestureConfig.swipePx,gestureConfig.axisRatio);
        if(!direction)return; // Ambiguous diagonal or too short stays inert.
        g.direction=direction;g.steps=1;g.ax=event.clientX;g.ay=event.clientY;send('navigate',direction,'trackpad');return;
      }
      // Slow pull: steady steps while the finger creeps. Fast movement only moves the anchor.
      const sx=event.clientX-g.ax,sy=event.clientY-g.ay;
      if(g.velocity>gestureConfig.slowSpeed){g.ax=event.clientX;g.ay=event.clientY;return;}
      const pull=gestureMath.pullStep(sx,sy,g.velocity,gestureConfig.slowSpeed,gestureConfig.pullPx);
      if(!pull)return;
      g.pulled=true;g.ax=event.clientX;g.ay=event.clientY;send('navigate',pull,'pull');
    });
    function finish(event,cancelled=false) {
      const g=gesture; if(!g||g.id!==event.pointerId)return;
      gesture=null;contact.classList.remove('touching');contact.style.left='';contact.style.top='';
      if(cancelled)return;
      markTrackUsed();
      if(gestureMath.isTap(g.moved,event.timeStamp-g.startT,gestureConfig.tapMaxMs)){send('select',undefined,'trackpad');return;}
      if(!g.direction||g.pulled)return;
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      const along={right:dx,left:-dx,down:dy,up:-dy}[g.direction];
      let remaining=gestureMath.extraSteps(along,gestureConfig.heavyPx,gestureConfig.veryHeavyPx);
      if(remaining)inertiaTimer=setInterval(()=>{if(remaining--<=0){clearInterval(inertiaTimer);return;}send('navigate',g.direction,'flick');},gestureConfig.extraIntervalMs);
    }
    panel.addEventListener('pointerup',event=>finish(event));
    panel.addEventListener('pointercancel',event=>finish(event,true));
    panel.addEventListener('lostpointercapture',event=>finish(event,true));
    panel.addEventListener('keydown',event=>{
      const mode=event.target.closest('.mode');
      if(mode&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
        event.preventDefault();const next=['ArrowLeft','Home'].includes(event.key)?'trackpad':'dpad';setMode(root,next);$(`[data-mode="${next}"]`,root).focus();return;
      }
      if(event.target!==pad)return;
      const direction={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[event.key];
      if(direction){event.preventDefault();send('navigate',direction,'keyboard');}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();send('select',undefined,'keyboard');}
    });
  });
  window.addEventListener('blur',cancelMotion);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelMotion();});
  // Update only confirmed host state in adapter mode; never infer TV availability.
  function setState(patch) {
    if(patch.room && !state.rooms[patch.room])throw new Error('Unknown room');
    if(patch.room && patch.room!==state.room)cancelMotion();
    if(patch.room)state.room=patch.room;
    if(patch.rooms) Object.entries(patch.rooms).forEach(([id,data])=>{
      if(!state.rooms[id])throw new Error('Unknown room: '+id);
      const next={...state.rooms[id],...copy(data)};
      if(!Number.isFinite(next.volume))throw new Error('volume must be finite');
      next.volume=Math.max(0,Math.min(100,Math.round(next.volume)));
      state.rooms[id]=next;
    });
    if(typeof patch.voiceActive==='boolean')voiceActive=patch.voiceActive;
    updateUI(true);
  }
  window.NexusRemote=Object.freeze({
    version:'1.0.0',
    setAdapter(fn){if(fn!==null&&typeof fn!=='function')throw new TypeError('Adapter must be a function or null');cancelMotion();adapter=fn;},
    setState,
    getState:()=>copy(state),
    getCommands:()=>copy(commandLog),
    clearCommands:()=>{commandLog.length=0;},
    setMode(mode,index=0){const root=$$('.remote')[index];if(!root)throw new Error('Unknown remote index');setMode(root,mode);},
    getModes:()=>Object.fromEntries(modes),
    cancelMotion,
    gestureConfig
  });
  updateUI();
})();
