// Jobs: standing orders that dispatch a role against a path on an interval.
// Jobs live on the ledger (kind "job"; latest line per jobId wins), so the schedule is as auditable as the money.
// The scheduler never exceeds a daily spend cap, never runs a job twice at once, and the runner's own
// gates, kill switches and path budgets still apply to every dispatch.
import { reduce } from './reduce.js';
import { CATALOG } from './paths.js';
import { ROLES } from './agent.js';
import { listItems } from './inbox.js';

const HOUR = 3600e3;

export function spentOnDay(state, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return state.moneyOut.filter((e) => String(e.ts).slice(0, 10) === day).reduce((s, e) => s + e.usd, 0);
}

// Pure: which enabled jobs are due right now, oldest-first.
export function dueJobs(state, now = new Date()) {
  const busy = new Set(state.running.map((r) => r.jobId).filter(Boolean));
  return Object.values(state.jobs)
    .filter((j) => j.enabled && !busy.has(j.jobId))
    .filter((j) => !j.lastRunAt || now.getTime() - Date.parse(j.lastRunAt) >= j.everyHours * HOUR)
    .sort((a, b) => String(a.lastRunAt || '').localeCompare(String(b.lastRunAt || '')));
}

export function createScheduler({ ledger, runAgent, makeProvider, dataDir, catalog = CATALOG, dailyCapUsd = 5, log = () => {} }) {
  const inFlight = new Set();
  const lastError = new Map();

  async function tick(now = new Date()) {
    const state = reduce(ledger.readAll(), catalog);
    const spent = spentOnDay(state, now);
    // Inbox roles with an empty inbox have nothing to do; drop them here so they never block other jobs.
    const hasWork = (j) => { const r = ROLES[j.role]; return !(r && r.inbox) || listItems(dataDir, j.path, { type: r.inbox }).length > 0; };
    const due = dueJobs(state, now).filter((j) => !inFlight.has(j.jobId) && hasWork(j));
    if (!due.length) return { dispatched: null, reason: 'nothing due' };
    if (spent >= dailyCapUsd) {
      const msg = `daily cap reached: $${spent.toFixed(2)} of $${dailyCapUsd} spent today`;
      if (lastError.get('__cap') !== now.toISOString().slice(0, 10)) {
        lastError.set('__cap', now.toISOString().slice(0, 10));
        ledger.append({ kind: 'note', text: `scheduler paused: ${msg}` });
      }
      return { dispatched: null, reason: msg };
    }
    const job = due[0];
    inFlight.add(job.jobId);
    let provider;
    try {
      provider = await makeProvider();
    } catch (e) {
      inFlight.delete(job.jobId);
      return { dispatched: null, reason: e.message };
    }
    const maxUsd = Math.min(job.maxUsd, dailyCapUsd - spent);
    log({ type: 'job', jobId: job.jobId, role: job.role, path: job.path, maxUsd });
    const running = runAgent({ role: job.role, pathId: job.path, jobId: job.jobId, ledger, dataDir, provider, catalog, maxUsd })
      .then((result) => { lastError.delete(job.jobId); return result; })
      .catch((e) => {
        // Refusals (gated, killed, budget spent) are recorded once per distinct message, not every tick.
        if (lastError.get(job.jobId) !== e.message) {
          lastError.set(job.jobId, e.message);
          ledger.append({ kind: 'note', path: job.path, text: `job ${job.jobId} not run: ${e.message}` });
        }
        return { error: e.message };
      })
      .finally(() => inFlight.delete(job.jobId));
    return { dispatched: job.jobId, running };
  }

  let timer = null;
  return {
    tick,
    start(intervalMs = 60e3) { if (!timer) { timer = setInterval(() => tick().catch((e) => log({ type: 'error', message: e.message })), intervalMs); timer.unref?.(); } return this; },
    stop() { if (timer) clearInterval(timer); timer = null; },
  };
}
