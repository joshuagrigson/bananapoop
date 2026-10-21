const { contextBridge, ipcRenderer, webUtils } = require('electron');

const EVENTS = ['incoming', 'progress', 'arrive', 'cancel', 'text', 'delivered', 'sent', 'phones', 'tunnel', 'clear-cards'];

contextBridge.exposeInMainWorld('fling', {
  on(channel, fn) {
    if (EVENTS.includes(channel)) ipcRenderer.on(channel, (_e, d) => fn(d));
  },
  mouse: (capture) => ipcRenderer.send('mouse', !!capture),
  open: (p) => ipcRenderer.send('open', p),
  reveal: (p) => ipcRenderer.send('reveal', p),
  copy: (text) => ipcRenderer.send('copy', text),
  dragOut: (p) => ipcRenderer.send('drag-out', p),
  showPair: () => ipcRenderer.send('show-pair'),
  sendToPhone: (p, source) => ipcRenderer.invoke('send-to-phone', p, source),
  sendText: (t) => ipcRenderer.invoke('send-text', t),
  thumb: (p) => ipcRenderer.invoke('thumb', p),
  exists: (p) => ipcRenderer.invoke('exists', p),
  loadCards: () => ipcRenderer.invoke('load-cards'),
  saveCards: (c) => ipcRenderer.send('save-cards', c),
  pairInfo: () => ipcRenderer.invoke('pair-info'),
  phones: () => ipcRenderer.invoke('phones'),
  setAnywhere: (on) => ipcRenderer.invoke('set-anywhere', on),
  setLogin: (on) => ipcRenderer.invoke('set-login', on),
  openInbox: () => ipcRenderer.invoke('open-inbox'),
  pathFor: (file) => webUtils.getPathForFile(file),
  fileUrl: (p) => 'file:///' + String(p).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')
    .replace(/^\/+/, '').replace(/^([A-Za-z])%3A/, '$1:'),
});
