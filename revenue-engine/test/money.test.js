import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, LedgerError } from '../src/ledger.js';
import { reduce } from '../src/reduce.js';
import { quests } from '../src/quests.js';
import { dueJobs, spentOnDay, createScheduler } from '../src/scheduler.js';
import { seedDemo } from '../src/demo.js';
import { ROLES, DEFAULT_MODEL } from '../src/agent.js';
import { tmpLedger, TEST_CATALOG } from './helpers.js';

const ev = (o) => validate(o);
const CAT = [...TEST_CATALOG, { ...TEST_CATALOG[1], id: 'gamma', rank: 3, name: 'Gamma content', postTarget: 2 }];

test('a post needs a live URL; drafts are not posts', () => {
  assert.throws(() => validate({ kind: 'post', path: 'gamma', platform: 'x', url: 'draft.md', title: 't', by: 'user' }), /live http/);
  assert.ok(validate({ kind: 'post', path: 'gamma', platform: 'x', url: 'https://x.com/1', title: 't', by: 'user' }));
});

test('money attributed to a post rolls up by post and platform, even if logged before the post line', () => {
  const events = [
    ev({ kind: 'money.in', usd: 30, path: 'gamma', source: 'Affiliate', evidence: 'payout 1', postId: 'p1', ts: '2026-01-01T00:00:00Z' }),
    ev({ kind: 'post', id: 'p1', path: 'gamma', platform: 'YouTube', url: 'https://y/1', title: 'a', by: 'user', ts: '2026-01-02T00:00:00Z' }),
    ev({ kind: 'post', id: 'p2', path: 'gamma', platform: 'x', url: 'https://x/2', title: 'b', by: 'user', ts: '2026-01-03T00:00:00Z' }),
    ev({ kind: 'money.in', usd: 5, path: 'gamma', source: 'Client', evidence: 'inv 9' }),
    ev({ kind: 'money.in', usd: 7, path: 'gamma', source: 'Ghost', evidence: 'inv 10', postId: 'nope' }),
  ];
  const st = reduce(events, CAT);
  assert.equal(st.posts.find((p) => p.id === 'p1').earnedUsd, 30);
  assert.deepEqual(st.byPlatform.youtube, { posts: 1, earnedUsd: 30 });
  assert.equal(st.byPlatform.x.earnedUsd, 0);
  assert.equal(st.unattributedUsd, 12);
  assert.equal(st.earnedUsd, 42);
  const q = quests(st, CAT).find((x) => x.id === 'posts:gamma');
  assert.equal(q.status, 'done');
  assert.deepEqual(q.cites, ['p1', 'p2']);
});

test('jobs: latest line wins, run starts carry jobId, due logic respects interval and busy runs', () => {
  const t0 = '2026-01-01T00:00:00Z';
  const events = [
    ev({ kind: 'job', jobId: 'j1', role: 'creator', path: 'beta', everyHours: 24, maxUsd: 1, enabled: true, ts: t0 }),
    ev({ kind: 'job', jobId: 'j2', role: 'prospector', path: 'beta', everyHours: 2, maxUsd: 1, enabled: false, ts: t0 }),
    ev({ kind: 'agent.run.start', runId: 'r1', jobId: 'j1', path: 'beta', role: 'creator', model: 'm', maxUsd: 1, ts: '2026-01-01T01:00:00Z' }),
    ev({ kind: 'agent.run.end', runId: 'r1', path: 'beta', role: 'creator', model: 'm', usd: 0.2, iterations: 2, reason: 'done', ts: '2026-01-01T01:05:00Z' }),
  ];
  const st = reduce(events, CAT);
  assert.equal(st.jobs.j1.runs, 1);
  assert.equal(st.jobs.j2.enabled, false);
  assert.deepEqual(dueJobs(st, new Date('2026-01-01T12:00:00Z')), []);
  assert.deepEqual(dueJobs(st, new Date('2026-01-02T02:00:00Z')).map((j) => j.jobId), ['j1']);
  const busy = reduce([...events, ev({ kind: 'agent.run.start', runId: 'r2', jobId: 'j1', path: 'beta', role: 'creator', model: 'm', maxUsd: 1, ts: '2026-01-02T01:30:00Z' })], CAT);
  assert.deepEqual(dueJobs(busy, new Date('2026-01-03T02:00:00Z')), []);
});

test('the scheduler dispatches a due job with the capped budget, and stops at the daily cap', async () => {
  const { dir, ledger } = tmpLedger();
  ledger.append({ kind: 'job', jobId: 'j1', role: 'creator', path: 'beta', everyHours: 24, maxUsd: 3, enabled: true });
  const calls = [];
  const fakeRun = async (o) => { calls.push(o); ledger.append({ kind: 'agent.run.start', runId: 'x', jobId: o.jobId, path: o.pathId, role: o.role, model: 'm', maxUsd: o.maxUsd }); ledger.append({ kind: 'money.out', usd: 2.5, category: 'api', path: o.pathId, runId: 'x' }); ledger.append({ kind: 'agent.run.end', runId: 'x', path: o.pathId, role: o.role, model: 'm', usd: 2.5, iterations: 1, reason: 'done' }); return { reason: 'done' }; };
  const sch = createScheduler({ ledger, runAgent: fakeRun, makeProvider: async () => ({ kind: 'replay', script: [] }), dataDir: dir, catalog: CAT, dailyCapUsd: 2.5 });
  const first = await sch.tick();
  assert.equal(first.dispatched, 'j1');
  await first.running;
  assert.equal(calls[0].maxUsd, 2.5, 'run budget is clipped to what is left of the daily cap');
  assert.equal(calls[0].jobId, 'j1');
  ledger.append({ kind: 'job', jobId: 'j2', role: 'creator', path: 'beta', everyHours: 1, maxUsd: 1, enabled: true });
  const second = await sch.tick();
  assert.equal(second.dispatched, null);
  assert.match(second.reason, /daily cap/);
  assert.equal(spentOnDay(reduce(ledger.readAll(), CAT)), 2.5);
});

test('a refused job is noted once, not every tick', async () => {
  const { dir, ledger } = tmpLedger();
  ledger.append({ kind: 'job', jobId: 'j1', role: 'creator', path: 'alpha', everyHours: 1, maxUsd: 1, enabled: true });
  const sch = createScheduler({ ledger, runAgent: async () => { throw new Error('gated'); }, makeProvider: async () => ({}), dataDir: dir, catalog: CAT });
  for (let i = 0; i < 3; i++) { const r = await sch.tick(); await r.running; }
  assert.equal(ledger.readAll().filter((e) => e.kind === 'note').length, 1);
});

test('demo seeding refuses a real ledger and labels itself', () => {
  const { dir, ledger } = tmpLedger();
  seedDemo(ledger, dir);
  assert.equal(reduce(ledger.readAll()).demo, true);
  const { dir: d2, ledger: real } = tmpLedger();
  real.append({ kind: 'money.in', usd: 5, path: 'x', source: 'y', evidence: 'inv' });
  assert.throws(() => seedDemo(real, d2), LedgerError);
});

test('routine roles default to cheap models; nothing defaults to Opus', () => {
  assert.equal(DEFAULT_MODEL, 'claude-sonnet-5');
  assert.equal(ROLES.outreach.model, 'claude-haiku-4-5');
  for (const r of Object.values(ROLES)) assert.notEqual(r.model, 'claude-opus-5');
});
