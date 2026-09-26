import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from '../src/server.js';
import { runAgent } from '../src/agent.js';
import { tmpLedger, TEST_CATALOG } from './helpers.js';

const script = JSON.parse(fs.readFileSync(new URL('../replay/prospector-demo.json', import.meta.url), 'utf8'));

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

test('dashboard, state, event validation and a replayed run over HTTP', async () => {
  const { dir, ledger } = tmpLedger();
  const server = createServer({ ledger, catalog: TEST_CATALOG, dataDir: dir, runAgent, makeProvider: async () => ({ kind: 'replay', script }) });
  const base = await listen(server);
  try {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Proxyfolk/);
    const money = await fetch(base + '/ledger');
    assert.equal(money.status, 200);
    assert.match(await money.text(), /Money Dashboard/);
    const term = await fetch(base + '/terminal');
    assert.match(await term.text(), /Production Terminal/);
    const job = await fetch(base + '/api/jobs', { method: 'POST', body: JSON.stringify({ role: 'creator', path: 'beta', everyHours: 24, maxUsd: 1 }) });
    assert.equal(job.status, 201);
    const badJob = await fetch(base + '/api/jobs', { method: 'POST', body: JSON.stringify({ role: 'wizard', path: 'beta', everyHours: 24, maxUsd: 1 }) });
    assert.equal(badJob.status, 400);

    let s = await (await fetch(base + '/api/state')).json();
    assert.equal(s.state.earnedUsd, 0);
    assert.equal(s.level.level, 0);
    assert.equal(s.catalog.length, 2);

    const bad = await fetch(base + '/api/events', { method: 'POST', body: JSON.stringify({ kind: 'money.in', usd: 100, path: 'beta', source: 'X' }) });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /evidence/);

    const good = await fetch(base + '/api/events', { method: 'POST', body: JSON.stringify({ kind: 'money.in', usd: 100, path: 'beta', source: 'X', evidence: 'inv-7' }) });
    assert.equal(good.status, 201);

    const notJson = await fetch(base + '/api/events', { method: 'POST', body: '{nope' });
    assert.equal(notJson.status, 500);

    const run = await fetch(base + '/api/run', { method: 'POST', body: JSON.stringify({ role: 'prospector', path: 'beta', maxUsd: 5, model: 'claude-opus-5' }) });
    assert.equal(run.status, 202);
    const { runId } = await run.json();
    for (let i = 0; i < 50; i += 1) {
      const runs = await (await fetch(base + '/api/runs')).json();
      const mine = runs.find((r) => r.runId === runId);
      if (mine && mine.status !== 'running') { assert.equal(mine.status, 'ended'); assert.equal(mine.result.reason, 'done'); break; }
      await new Promise((r) => setTimeout(r, 20));
    }

    s = await (await fetch(base + '/api/state')).json();
    assert.equal(s.state.earnedUsd, 100);
    assert.equal(s.level.level, 1);
    assert.equal(s.state.paths.beta.outcomes.prospect, 2);
    assert.equal(s.state.runs.length, 1);
    assert.equal(Object.keys(s.state.jobs).length, 1);
    assert.equal(s.outbox.beta, 1);
    const ob = await (await fetch(base + '/api/outbox')).json();
    assert.equal(ob[0].file, 'prospects.md');
    assert.ok(s.quests.some((q) => q.id === 'ladder:1' && q.status === 'done'));

    const cl = await fetch(base + '/api/clients', { method: 'POST', body: JSON.stringify({ path: 'beta', name: 'Demo Salon', city: 'Texarkana' }) });
    assert.equal(cl.status, 201);
    const cls = await (await fetch(base + '/api/clients')).json();
    assert.equal(cls.beta[0].due, true);
    const badCl = await fetch(base + '/api/clients', { method: 'POST', body: JSON.stringify({ path: 'beta', name: 'x' }) });
    assert.equal(badCl.status, 400);

    const nf = await fetch(base + '/nope');
    assert.equal(nf.status, 404);
  } finally {
    server.close();
  }
});

test('a server without an agent wired answers 501 on /api/run', async () => {
  const { dir, ledger } = tmpLedger();
  const server = createServer({ ledger, catalog: TEST_CATALOG, dataDir: dir });
  const base = await listen(server);
  try {
    const r = await fetch(base + '/api/run', { method: 'POST', body: '{}' });
    assert.equal(r.status, 501);
  } finally {
    server.close();
  }
});
