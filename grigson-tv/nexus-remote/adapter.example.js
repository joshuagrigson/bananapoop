/* CONTRACT EXAMPLE ONLY. No vendor transport is supplied or invented.
 * Load after app.js, then call connectNexus(yourExistingTvApi).
 * Keep credentials/pairing in your existing app's secure integration layer.
 */
function connectNexus(tv) {
  let queue=Promise.resolve();
  window.NexusRemote.setAdapter(command=>{
    // Serialize commands to preserve swipe order on high-latency connections.
    const next=queue.catch(()=>{}).then(async()=>{
      const room=command.roomId;
      switch(command.type) {
        case 'navigate': await tv.navigate(room,command.value);break;
        case 'select': await tv.select(room);break;
        case 'volume': await tv.adjustVolume(room,command.value);break;
        case 'room': await tv.selectRoom(command.value);break;
        case 'input': await tv.selectInput(room,command.value);break;
        case 'power': await tv.togglePower(room);break;
        case 'mute': await tv.toggleMute(room);break;
        case 'playPause': await tv.playPause(room);break;
        case 'rewind': await tv.rewind(room);break;
        case 'fastForward': await tv.fastForward(room);break;
        case 'back': await tv.back(room);break;
        case 'home': await tv.home(room);break;
        case 'apps': await tv.openApps(room);break;
        case 'voice': await tv.openVoice(room);break;
        case 'settings': await tv.openSettings();break;
        case 'edit': await tv.openInputEditor(room);break;
        case 'editInputs': await tv.updateInputs(room,command.value);break;
        default: throw new Error('Unhandled command: '+command.type);
      }
    });
    queue=next;return next;
  });
  // Your API must supply the documented state shape in HANDOFF.md.
  const unsubscribe=tv.onState(patch=>window.NexusRemote.setState(patch));
  return ()=>{unsubscribe?.();window.NexusRemote.cancelMotion();window.NexusRemote.setAdapter(null);};
}
