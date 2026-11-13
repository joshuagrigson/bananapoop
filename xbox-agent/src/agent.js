#!/usr/bin/env node
// Xbox agent entry point.  node src/agent.js <command> [arg]
//   login            one-time Microsoft sign-in (code goes to the phone via ntfy, never the log)
//   tick             every 30 min: friends, idle-off, bedtime, warmup, clips, digest (each decides if due)
//   clips | digest   force that job now
//   wake | off       power the console
//   launch <name>    wake + launch a game from recently played (e.g. "Call of Duty")
//   status           console power + what's running (counts only in the log)
// Env: XBOX_CLIENT_ID, XBOX_STATE_KEY, NTFY_TOPIC, DRIVE_DROP_URL, DRIVE_DROP_KEY, STATE_FILE
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as xbl from './xbl.js';
import * as store from './state.js';
import * as jobs from './jobs.js';
import * as realIo from './io.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function run(cmd, arg, {
  env = process.env,
  cfg = JSON.parse(readFileSync(join(here, '..', 'config.json'), 'utf8')),
  now = () => new Date(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  io = realIo,
  log = (...a) => console.log(...a),
} = {}) {
  for (const k of ['XBOX_CLIENT_ID', 'XBOX_STATE_KEY']) if (!env[k]) throw new Error(`${k} is not set`);
  const statePath = env.STATE_FILE || join(here, '..', '.state', 'state.enc');
  const state = store.load(statePath, env.XBOX_STATE_KEY);
  const persist = () => store.save(statePath, state, env.XBOX_STATE_KEY);

  if (cmd === 'login') {
    const dc = await xbl.startDeviceLogin(env.XBOX_CLIENT_ID);
    const sent = await io.notify(env.NTFY_TOPIC, {
      title: `Xbox agent sign-in code: ${dc.user_code}`,
      message: `Open ${dc.verification_uri} and enter ${dc.user_code}. Use the same Microsoft account as your Xbox. Expires in ${Math.round(dc.expires_in / 60)} min.`,
      click: dc.verification_uri, tags: ['key'], priority: 4,
    });
    log(sent ? 'login: code sent to the phone (ntfy); waiting for sign-in' : 'login: NTFY_TOPIC not set, cannot deliver the code');
    if (!sent) throw new Error('set NTFY_TOPIC first');
    const tok = await xbl.pollDeviceLogin(env.XBOX_CLIENT_ID, dc, { sleep, now: () => now().getTime() });
    state.refreshToken = tok.refresh_token;
    const t = await xbl.xboxTokens(tok.access_token);
    persist();
    await io.notify(env.NTFY_TOPIC, { title: 'Xbox agent is signed in', message: `Parked on ${t.gamertag}. It runs every 30 minutes from now on.`, tags: ['white_check_mark'] });
    log('login: signed in, refresh token sealed into state');
    return { signedIn: true };
  }

  if (!state.refreshToken) throw new Error('not signed in: run the Login action first');
  let ms;
  try {
    ms = await xbl.refreshMs(env.XBOX_CLIENT_ID, state.refreshToken);
  } catch (e) {
    if (e.needsLogin && state.lastRun.reloginNag !== new Date(now()).toISOString().slice(0, 10)) {
      state.lastRun.reloginNag = new Date(now()).toISOString().slice(0, 10);
      persist();
      await io.notify(env.NTFY_TOPIC, { title: 'Xbox agent needs you to sign in again', message: 'GitHub > bananapoop > Actions > Xbox agent > Run workflow > login.', tags: ['warning'] });
    }
    throw e;
  }
  if (ms.refresh_token) state.refreshToken = ms.refresh_token; // rotation
  persist();
  const x = new xbl.Xbox(await xbl.xboxTokens(ms.access_token));
  const ctx = { x, cfg, state, env, now, sleep, io, log, tmp: mkdtempSync(join(tmpdir(), 'xbox-')) };

  const out = {};
  const safe = async (name, fn) => {
    try { out[name] = await fn(); } catch (e) { out[name] = { error: e.message }; log(`${name}: ERROR ${e.message}`); }
  };
  try {
    switch (cmd) {
      case 'tick':
        await safe('friends', () => jobs.friends(ctx));
        await safe('bedtime', () => jobs.bedtime(ctx));
        await safe('idle', () => jobs.idle(ctx));
        await safe('warmup', () => jobs.warmup(ctx));
        await safe('clips', () => jobs.clips(ctx));
        await safe('digest', () => jobs.digest(ctx));
        break;
      case 'clips': await safe('clips', () => jobs.clips(ctx, { force: true })); break;
      case 'digest': await safe('digest', () => jobs.digest(ctx, { force: true })); break;
      case 'launch': await safe('warmup', () => jobs.warmup(ctx, { force: true, game: arg || undefined })); break;
      case 'wake':
      case 'off': {
        const list = await x.consoles();
        const c = list.find((d) => d.name === cfg.console || d.id === cfg.console) || list[0];
        if (cmd === 'wake') await x.wake(c.id); else await x.turnOff(c.id);
        await io.notify(env.NTFY_TOPIC, { title: cmd === 'wake' ? 'Xbox: waking up' : 'Xbox: turning off', tags: ['video_game'] });
        out[cmd] = { ok: true };
        break;
      }
      case 'status': {
        const list = await x.consoles();
        const me = await x.myPresence();
        log(`status: ${list.length} console(s), power ${list.map((c) => c.power).join('/')}, running ${me.game ? 'a game/app' : 'nothing'}`);
        out.status = { consoles: list.length, power: list.map((c) => c.power) };
        break;
      }
      default: throw new Error(`unknown command ${cmd}`);
    }
  } finally {
    persist();
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv[2] || 'tick', process.argv.slice(3).join(' '))
    .then((o) => { const bad = Object.values(o).some((v) => v && v.error); process.exit(bad ? 1 : 0); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
