// Fling for Windows: the desk overlay where files land, the edge portal for
// throwing files back, the pairing window, and the tray.

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, clipboard, nativeImage, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { FlingServer } = require('./server');
const { Tunnel } = require('./tunnel');

const PORT = 47777; // fixed so the firewall rule and the phone's Home Screen link never change

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const userDir = app.getPath('userData');
const configPath = path.join(userDir, 'config.json');
const cardsPath = path.join(userDir, 'cards.json');
const assetsDir = path.join(__dirname, 'assets');
const phoneDir = app.isPackaged ? path.join(process.resourcesPath, 'phone') : path.join(__dirname, '..', 'phone');

function readJson(file, dflt) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return dflt; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const config = Object.assign({ firstRun: true }, readJson(configPath, {}));
if (!config.token) config.token = crypto.randomBytes(18).toString('base64url');
if (!config.inbox) config.inbox = path.join(app.getPath('downloads'), 'Fling');
writeJson(configPath, config);

let overlay, portal, pairWin, tray, server, tunnel;
let phoneCount = 0;

// Private LAN addresses only; the iPhone hotspot hands out 172.20.10.x.
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (/^169\.254\./.test(a.address)) continue;
      if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) continue;
      if (/vEthernet|VirtualBox|VMware|WSL|Hyper-V/i.test(name)) continue;
      out.push({ name, address: a.address });
    }
  }
  return out;
}

function pairLinks() {
  const k = config.token;
  const lan = lanAddresses().map((a) => ({ ...a, url: `http://${a.address}:${PORT}/#k=${k}` }));
  const anywhere = tunnel && tunnel.url ? `${tunnel.url}/#k=${k}` : null;
  return { lan, anywhere, tunnel: tunnel ? tunnel.state : 'off' };
}

async function pairInfo() {
  const links = pairLinks();
  const qr = async (text) => QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: '#0b0b12', light: '#ffffff' } });
  return {
    deviceName: os.hostname(),
    phones: phoneCount,
    inbox: config.inbox,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    lan: await Promise.all(links.lan.map(async (l) => ({ ...l, qr: await qr(l.url) }))),
    anywhere: links.anywhere ? { url: links.anywhere, qr: await qr(links.anywhere) } : null,
    tunnel: links.tunnel,
    tunnelError: tunnel && tunnel.lastError,
  };
}

function sendAll(channel, data) {
  for (const w of [overlay, portal, pairWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, data);
}

function createOverlay() {
  const { workArea } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    ...workArea,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  overlay.setAlwaysOnTop(true, 'floating');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(path.join(__dirname, 'ui', 'overlay.html'));
  const fit = () => {
    if (!overlay || overlay.isDestroyed()) return;
    overlay.setBounds(screen.getPrimaryDisplay().workArea);
    placePortal();
  };
  screen.on('display-metrics-changed', fit);
  screen.on('display-added', fit);
  screen.on('display-removed', fit);
}

const PORTAL_W = 76;
const PORTAL_H = 230;
function placePortal() {
  if (!portal || portal.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea;
  portal.setBounds({ x: wa.x + wa.width - PORTAL_W, y: Math.round(wa.y + wa.height / 2 - PORTAL_H / 2), width: PORTAL_W, height: PORTAL_H });
}

function createPortal() {
  portal = new BrowserWindow({
    width: PORTAL_W, height: PORTAL_H,
    transparent: true, frame: false, resizable: false, movable: false,
    skipTaskbar: true, hasShadow: false, focusable: false, alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  portal.setAlwaysOnTop(true, 'pop-up-menu'); // one level above the overlay
  portal.loadFile(path.join(__dirname, 'ui', 'portal.html'));
  placePortal();
}

function showPair() {
  if (pairWin && !pairWin.isDestroyed()) { pairWin.show(); pairWin.focus(); return; }
  pairWin = new BrowserWindow({
    width: 860, height: 640, minWidth: 620, minHeight: 520,
    title: 'Fling', backgroundColor: '#0b0b12', autoHideMenuBar: true,
    icon: path.join(assetsDir, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  pairWin.loadFile(path.join(__dirname, 'ui', 'pair.html'));
  pairWin.on('closed', () => { pairWin = null; });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(assetsDir, 'tray.png')));
  tray.setToolTip('Fling');
  const menu = Menu.buildFromTemplate([
    { label: 'Pair phone / settings', click: showPair },
    { label: 'Send files to phone…', click: pickAndSend },
    { label: 'Open Fling folder', click: () => shell.openPath(config.inbox) },
    { label: 'Clear cards off the screen', click: () => sendAll('clear-cards') },
    { type: 'separator' },
    { label: 'Quit Fling', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showPair);
}

async function pickAndSend() {
  const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
  if (!r.canceled) for (const f of r.filePaths) sendToPhone(f);
}

function sendToPhone(filePath, source = 'tray') {
  const r = server.offer(filePath);
  if (r.ok && r.phones === 0) r.queued = true; // held until the phone page reconnects
  sendAll('sent', { path: filePath, source, ...r });
  return r;
}

// Card thumbnails: images and videos load directly; everything else gets the shell thumbnail or icon.
const thumbs = new Map(); // path -> data URL, reused as the drag image
async function thumbFor(file) {
  if (thumbs.has(file)) return thumbs.get(file);
  let url = null;
  try {
    const img = await nativeImage.createThumbnailFromPath(file, { width: 320, height: 320 });
    if (!img.isEmpty()) url = img.toDataURL();
  } catch {}
  if (!url) { try { url = (await app.getFileIcon(file, { size: 'large' })).toDataURL(); } catch {} }
  if (url) thumbs.set(file, url);
  return url;
}

function wireIpc() {
  ipcMain.on('mouse', (_e, capture) => {
    if (overlay && !overlay.isDestroyed()) overlay.setIgnoreMouseEvents(!capture, { forward: true });
  });
  ipcMain.on('open', (_e, p) => { if (p && fs.existsSync(p)) shell.openPath(p); });
  ipcMain.on('reveal', (_e, p) => { if (p && fs.existsSync(p)) shell.showItemInFolder(p); });
  ipcMain.on('copy', (_e, text) => clipboard.writeText(String(text || '')));
  ipcMain.on('show-pair', showPair);
  // startDrag has to run right away, while the mouse button is still down, so it only uses a cached thumbnail.
  ipcMain.on('drag-out', (e, p) => {
    if (!p || !fs.existsSync(p)) return;
    let icon = nativeImage.createFromPath(path.join(assetsDir, 'drag.png'));
    const cached = thumbs.get(p);
    if (cached) {
      const t = nativeImage.createFromDataURL(cached);
      if (!t.isEmpty()) icon = t.resize({ width: 96 });
    }
    e.sender.startDrag({ file: p, icon });
  });
  ipcMain.handle('send-to-phone', (_e, p, source) => sendToPhone(p, source === 'card' ? 'card' : 'portal'));
  ipcMain.handle('send-text', (_e, text) => server.offerText(text));
  ipcMain.handle('thumb', (_e, p) => thumbFor(p));
  ipcMain.handle('exists', (_e, p) => !!p && fs.existsSync(p));
  ipcMain.handle('load-cards', () => readJson(cardsPath, []));
  ipcMain.on('save-cards', (_e, cards) => writeJson(cardsPath, Array.isArray(cards) ? cards.slice(0, 200) : []));
  ipcMain.handle('pair-info', () => pairInfo());
  ipcMain.handle('phones', () => phoneCount);
  ipcMain.handle('set-anywhere', async (_e, on) => {
    config.anywhere = !!on;
    writeJson(configPath, config);
    if (on) tunnel.start(); else tunnel.stop();
    return true;
  });
  ipcMain.handle('set-login', (_e, on) => {
    app.setLoginItemSettings({ openAtLogin: !!on });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('open-inbox', () => shell.openPath(config.inbox));
}

async function startServer() {
  server = new FlingServer({ port: PORT, token: config.token, inboxDir: config.inbox, phoneDir, deviceName: os.hostname() });
  for (const ev of ['incoming', 'progress', 'cancel', 'text', 'delivered']) server.on(ev, (d) => sendAll(ev, d));
  server.on('arrive', (d) => sendAll('arrive', d));
  server.on('phones', (n) => { phoneCount = n; sendAll('phones', n); });
  try {
    await server.start();
  } catch (err) {
    const busy = err && err.code === 'EADDRINUSE';
    dialog.showErrorBox('Fling', busy
      ? `Port ${PORT} is already in use. Close the other program using it (or another copy of Fling) and start Fling again.`
      : `Fling couldn't start its receiver: ${err.message}`);
    app.quit();
    return false;
  }
  tunnel = new Tunnel({ binDir: path.join(userDir, 'bin'), port: PORT });
  tunnel.on('state', (s) => { tunnel.lastError = s.error || null; sendAll('tunnel', s); });
  if (config.anywhere) tunnel.start();
  return true;
}

app.on('second-instance', showPair);
app.on('window-all-closed', () => {}); // keep running in the tray
app.on('before-quit', () => { if (tunnel) tunnel.stop(); if (server) server.stop(); });

app.whenReady().then(async () => {
  app.setAppUserModelId('com.jgrigson.fling');
  if (!(await startServer())) return;
  wireIpc();
  createOverlay();
  createPortal();
  createTray();
  if (config.firstRun) {
    app.setLoginItemSettings({ openAtLogin: true });
    config.firstRun = false;
    writeJson(configPath, config);
    showPair();
  }
});
