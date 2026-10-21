// "Anywhere" mode: a free Cloudflare quick tunnel (no account) that gives the
// laptop a public https address, so the phone can reach it from any network.
// The address changes every time the tunnel starts.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

const DOWNLOAD_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

function download(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Fling' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        resolve(download(res.headers.location, dest, redirects - 1));
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`download failed (${res.statusCode})`)); return; }
      const tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(tmp, dest); resolve(); }));
      out.on('error', reject);
    }).on('error', reject);
  });
}

class Tunnel extends EventEmitter {
  constructor({ binDir, port }) {
    super();
    this.binDir = binDir;
    this.port = port;
    this.url = null;
    this.proc = null;
    this.state = 'off'; // off | starting | on | error
  }

  set(state, extra = {}) {
    this.state = state;
    this.emit('state', { state, url: this.url, ...extra });
  }

  async start() {
    if (this.proc) return;
    this.set('starting');
    const exe = path.join(this.binDir, 'cloudflared.exe');
    try {
      if (!fs.existsSync(exe)) {
        fs.mkdirSync(this.binDir, { recursive: true });
        await download(DOWNLOAD_URL, exe);
      }
    } catch (err) {
      this.set('error', { error: `Couldn't download the tunnel tool: ${err.message}` });
      return;
    }
    const proc = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${this.port}`], { windowsHide: true });
    this.proc = proc;
    const scan = (buf) => {
      const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !this.url) { this.url = m[0]; this.set('on'); }
    };
    proc.stdout.on('data', scan);
    proc.stderr.on('data', scan);
    proc.on('error', (err) => { this.proc = null; this.url = null; this.set('error', { error: err.message }); });
    proc.on('exit', () => {
      const wasOn = this.state === 'on' || this.state === 'starting';
      this.proc = null;
      this.url = null;
      if (wasOn && !this.stopping) this.set('error', { error: 'Tunnel closed' });
      else this.set('off');
      this.stopping = false;
    });
  }

  stop() {
    if (!this.proc) { this.set('off'); return; }
    this.stopping = true;
    this.proc.kill();
  }
}

module.exports = { Tunnel };
