// Xbox Live client: Microsoft sign-in (device code) -> Xbox user token -> XSTS -> API calls.
// No dependencies. Uses global fetch (Node 18+). Endpoints are the ones the Xbox app and
// Home Assistant's xbox integration use; they are unofficial and can change.

const MS = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const SCOPE = 'XboxLive.signin offline_access';

function form(obj) {
  return new URLSearchParams(obj).toString();
}

async function postForm(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function postJson(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = { raw: text }; }
  if (!r.ok) {
    const e = new Error(`POST ${url} -> ${r.status}`);
    e.status = r.status; e.body = j;
    throw e;
  }
  return j;
}

// ---- Microsoft account (device code flow; needs "Allow public client flows" = Yes) ----

export async function startDeviceLogin(clientId) {
  const { status, body } = await postForm(`${MS}/devicecode`, { client_id: clientId, scope: SCOPE });
  if (status !== 200) throw new Error(`devicecode ${status}: ${body.error_description || body.error}`);
  return body; // { device_code, user_code, verification_uri, expires_in, interval, message }
}

export async function pollDeviceLogin(clientId, dc, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = {}) {
  const until = now() + dc.expires_in * 1000;
  let wait = (dc.interval || 5) * 1000;
  while (now() < until) {
    await sleep(wait);
    const { status, body } = await postForm(`${MS}/token`, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: clientId,
      device_code: dc.device_code,
    });
    if (status === 200) return body;
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') { wait += 5000; continue; }
    throw new Error(`device login: ${body.error}: ${body.error_description || ''}`);
  }
  throw new Error('device login: code expired before sign-in');
}

export async function refreshMs(clientId, refreshToken) {
  const { status, body } = await postForm(`${MS}/token`, {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    scope: SCOPE,
  });
  if (status !== 200) {
    const e = new Error(`refresh ${status}: ${body.error}: ${body.error_description || ''}`);
    e.needsLogin = body.error === 'invalid_grant';
    throw e;
  }
  return body; // { access_token, refresh_token, expires_in }
}

// ---- Xbox Live token chain ----

export async function xboxTokens(msAccessToken) {
  const user = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  }, { 'x-xbl-contract-version': '1' });
  const xsts = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [user.Token] },
    RelyingParty: 'http://xboxlive.com',
    TokenType: 'JWT',
  }, { 'x-xbl-contract-version': '1' });
  const claims = xsts.DisplayClaims.xui[0];
  return {
    auth: `XBL3.0 x=${claims.uhs};${xsts.Token}`,
    xuid: claims.xid,
    gamertag: claims.gtg,
    expires: xsts.NotAfter,
  };
}

// ---- API client ----

export class Xbox {
  constructor(tokens) {
    this.t = tokens;
  }

  async call(method, url, { contract = '2', body, headers = {} } = {}) {
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: this.t.auth,
        'x-xbl-contract-version': contract,
        'Accept-Language': 'en-US',
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch { j = { raw: text }; }
    if (!r.ok) {
      const e = new Error(`${method} ${new URL(url).host}${new URL(url).pathname} -> ${r.status}`);
      e.status = r.status; e.body = j;
      throw e;
    }
    return j;
  }

  // Consoles on the account. powerState: On | ConnectedStandby | Off | Unknown
  async consoles() {
    const j = await this.call('GET', 'https://xccs.xboxlive.com/lists/devices?queryCurrentDevicesOnly=false&includeStorageDevices=true', { contract: '4' });
    return (j.result || []).map((d) => ({ id: d.id, name: d.name, type: d.consoleType, power: d.powerState }));
  }

  async command(consoleId, type, command, parameters = [{}]) {
    return this.call('POST', 'https://xccs.xboxlive.com/commands', {
      contract: '4',
      body: {
        destination: 'Xbox',
        type,
        command,
        sessionId: crypto.randomUUID(),
        sourceId: 'com.microsoft.smartglass',
        parameters,
        linkedXboxId: consoleId,
      },
    });
  }

  wake(id) { return this.command(id, 'Power', 'WakeUp'); }
  turnOff(id) { return this.command(id, 'Power', 'TurnOff'); }
  launch(id, productId) { return this.command(id, 'Shell', 'ActivationApp', [{ oneStoreProductId: productId }]); }

  // My own presence: { state: Online|Offline|Away, game: 'Call of Duty...' | null }
  async myPresence() {
    const j = await this.call('GET', 'https://userpresence.xboxlive.com/users/me?level=all', { contract: '3' });
    return parsePresence(j);
  }

  // Friends with presence. Returns [{ xuid, gamertag, favorite, online, game }]
  async friends() {
    const j = await this.call('GET', 'https://peoplehub.xboxlive.com/users/me/people/social/decoration/presencedetail', { contract: '5' });
    return (j.people || []).map((p) => {
      const playing = (p.presenceDetails || []).find((d) => d.IsGame && d.IsPrimary) || (p.presenceDetails || []).find((d) => d.IsGame);
      return {
        xuid: p.xuid,
        gamertag: p.gamertag || p.modernGamertag,
        favorite: !!p.isFavorite,
        online: p.presenceState === 'Online',
        game: p.presenceState === 'Online' && playing ? (playing.PresenceText || playing.TitleName || null) : null,
        titleId: playing ? playing.TitleId : null,
      };
    });
  }

  // Game clips (Game DVR) newest first. contentLocators carry signed download URLs.
  async clips(max = 25) {
    const j = await this.call('POST', 'https://mediahub.xboxlive.com/gameclips/search', {
      contract: '3',
      body: { max, skip: 0, query: `OwnerXuid eq ${this.t.xuid}` },
    });
    return (j.values || []).map((c) => ({
      id: c.contentId,
      title: c.titleName,
      recorded: c.uploadDate || c.dateRecorded || c.dateUploaded,
      seconds: c.durationInSeconds,
      url: ((c.contentLocators || []).find((l) => l.locatorType === 'Download') || {}).uri || null,
    }));
  }

  async titleHistory(max = 25) {
    const j = await this.call('GET', `https://titlehub.xboxlive.com/users/xuid(${this.t.xuid})/titles/titlehistory/decoration/achievement,productid?maxItems=${max}`, { contract: '2' });
    return (j.titles || []).map((t) => ({
      titleId: t.titleId,
      name: t.name,
      productId: t.productId || (t.productIds || [])[0] || null,
      lastPlayed: t.titleHistory ? t.titleHistory.lastTimePlayed : null,
      achievements: t.achievement ? { earned: t.achievement.currentAchievements, total: t.achievement.totalAchievements, score: t.achievement.currentGamerscore } : null,
    }));
  }

  async gamerscore() {
    const j = await this.call('GET', 'https://profile.xboxlive.com/users/me/profile/settings?settings=Gamerscore,Gamertag', { contract: '3' });
    const s = Object.fromEntries((j.profileUsers[0].settings || []).map((x) => [x.id, x.value]));
    return Number(s.Gamerscore || 0);
  }
}

export function parsePresence(j) {
  const devices = (j && j.devices) || [];
  for (const d of devices) {
    for (const t of d.titles || []) {
      // The dashboard ("Home") is a title too; anything with placement Full that isn't Home counts as a game.
      if (t.placement === 'Full' && t.name && !/^home$/i.test(t.name) && t.name !== 'Xbox App') {
        return { state: j.state, game: t.name, titleId: t.id, device: d.type, detail: (t.activity && t.activity.richPresence) || '' };
      }
    }
  }
  return { state: (j && j.state) || 'Offline', game: null, device: devices[0] ? devices[0].type : null };
}
