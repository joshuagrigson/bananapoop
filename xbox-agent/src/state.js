// Encrypted agent state (refresh token, seen clips, presence history).
// The repo is PUBLIC, so the file is AES-256-GCM sealed with XBOX_STATE_KEY (base64, 32 bytes).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function seal(obj, keyB64) {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('state key must be 32 bytes, base64');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}

export function open(text, keyB64) {
  const key = Buffer.from(keyB64, 'base64');
  const { iv, tag, data } = JSON.parse(text);
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'));
}

export function emptyState() {
  return {
    refreshToken: null,
    seenClips: [],          // contentIds already delivered
    friendsOnline: {},      // xuid -> game name (or '' when online, no game) at last tick
    idleTicks: 0,           // consecutive ticks: console On, no game running
    lastRun: {},            // job -> local date string (YYYY-MM-DD) it last ran
    playLog: [],            // [{ at: iso, game }] one sample per tick while a game is up
    gamerscoreAtDigest: null,
  };
}

export function load(path, keyB64) {
  if (!existsSync(path)) return emptyState();
  return { ...emptyState(), ...open(readFileSync(path, 'utf8'), keyB64) };
}

export function save(path, state, keyB64) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, seal(state, keyB64));
}
