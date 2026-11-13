// Side effects that leave the agent: phone notifications (ntfy), the vertical cut (ffmpeg),
// and the Google Drive drop (Apps Script web app in Joshua's own account).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

// ---- ntfy: push to Joshua's phone (ntfy app subscribed to the topic) ----
export async function notify(topic, { title, message, tags = [], click, priority } = {}) {
  if (!topic) return false;
  const headers = { Title: title || 'Xbox agent' };
  if (tags.length) headers.Tags = tags.join(',');
  if (click) headers.Click = click;
  if (priority) headers.Priority = String(priority);
  const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: 'POST', headers, body: message || '' });
  return r.ok;
}

// ---- download a clip ----
export async function download(url, path) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`clip download ${r.status}`);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  return statSync(path).size;
}

// ---- 9:16 vertical cut, same recipe as the 11-04 TheGamerzFeed batch:
// blurred full-frame fill behind the 1080-wide source, centered, 30 fps, faststart. Capped at 60 s.
export function ensureFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return; } catch {}
  execFileSync('sudo', ['apt-get', 'install', '-y', '-qq', 'ffmpeg'], { stdio: 'inherit' });
}

export function vertical(src, dst, { maxSeconds = 60 } = {}) {
  const vf = [
    '[0:v]split=2[bg][fg]',
    '[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[b]',
    '[fg]scale=1080:-2[f]',
    '[b][f]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p[v]',
  ].join(';');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', src, '-t', String(maxSeconds),
    '-filter_complex', vf, '-map', '[v]', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', dst,
  ]);
  return statSync(dst).size;
}

// ---- Drive drop: POST the file to the Apps Script web app (drop/Code.gs) ----
// Apps Script caps a request at ~50 MB, base64 adds a third, so files over 36 MB are skipped.
export const DROP_LIMIT = 36 * 1024 * 1024;

export async function drop(dropUrl, dropKey, { path, name, folder }) {
  const size = statSync(path).size;
  if (size > DROP_LIMIT) return { ok: false, error: `too big for the Drive drop (${(size / 1048576).toFixed(1)} MB)` };
  const r = await fetch(dropUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: dropKey, name, folder, mime: 'video/mp4', b64: readFileSync(path).toString('base64') }),
    redirect: 'follow',
  });
  const j = await r.json().catch(() => ({ ok: false, error: `drop HTTP ${r.status}` }));
  return j;
}
