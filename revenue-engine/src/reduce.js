// The pure reducer: ledger events in, state out. Nothing here invents a number.
// Outcomes are deduplicated by (path, stage, ref) so logging the same prospect twice counts once.
// Spend is counted from money.out only; agent.run.end.usd is descriptive and never double-counted.
import { STAGES } from './ledger.js';
import { CATALOG } from './paths.js';

function emptyPath(id, spec) {
  return {
    id,
    name: spec ? spec.name : id,
    known: Boolean(spec),
    status: 'active',
    statusReason: null,
    earnedUsd: 0,
    spentUsd: 0,
    budgetUsd: spec ? spec.budgetUsd : 0,
    outcomes: Object.fromEntries(STAGES.map((s) => [s, 0])),
    refs: Object.fromEntries(STAGES.map((s) => [s, []])),
    moneyIn: [],
    runs: [],
    lastRunAt: null,
  };
}

const byTs = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);

export function reduce(events, catalog = CATALOG) {
  const sorted = [...events].sort(byTs);
  const st = {
    earnedUsd: 0,
    spentUsd: 0,
    yieldRatio: null,
    moneyIn: [],
    moneyOut: [],
    paths: {},
    gates: {},
    runs: [],
    running: [],
    notes: [],
    eventCount: sorted.length,
    lastEventAt: sorted.length ? sorted[sorted.length - 1].ts : null,
  };
  for (const spec of catalog) st.paths[spec.id] = emptyPath(spec.id, spec);
  const pathOf = (id) => {
    if (!st.paths[id]) st.paths[id] = emptyPath(id, null);
    return st.paths[id];
  };
  const seenOutcome = new Set();
  const openRuns = new Map();

  for (const ev of sorted) {
    switch (ev.kind) {
      case 'money.in': {
        const p = pathOf(ev.path);
        p.earnedUsd += ev.usd;
        p.moneyIn.push(ev.id);
        st.earnedUsd += ev.usd;
        st.moneyIn.push(ev);
        break;
      }
      case 'money.out': {
        const p = pathOf(ev.path || 'general');
        p.spentUsd += ev.usd;
        st.spentUsd += ev.usd;
        st.moneyOut.push(ev);
        break;
      }
      case 'outcome': {
        const key = `${ev.path}|${ev.stage}|${String(ev.ref).trim().toLowerCase()}`;
        if (seenOutcome.has(key)) break;
        seenOutcome.add(key);
        const p = pathOf(ev.path);
        p.outcomes[ev.stage] += 1;
        p.refs[ev.stage].push({ id: ev.id, ref: ev.ref, evidence: ev.evidence, by: ev.by, ts: ev.ts, note: ev.note || null });
        break;
      }
      case 'agent.run.start': {
        openRuns.set(ev.runId, {
          runId: ev.runId, path: ev.path, role: ev.role, model: ev.model, maxUsd: ev.maxUsd,
          startedAt: ev.ts, endedAt: null, usd: 0, iterations: 0, reason: 'running', tokens: null,
        });
        break;
      }
      case 'agent.run.end': {
        const r = openRuns.get(ev.runId) || {
          runId: ev.runId, path: ev.path, role: ev.role, model: ev.model, maxUsd: null, startedAt: null,
        };
        openRuns.delete(ev.runId);
        Object.assign(r, { usd: ev.usd, reason: ev.reason, iterations: ev.iterations, endedAt: ev.ts, tokens: ev.tokens || null });
        st.runs.push(r);
        const p = pathOf(ev.path);
        p.runs.push(r);
        p.lastRunAt = ev.ts;
        break;
      }
      case 'path.status': {
        const p = pathOf(ev.path);
        p.status = ev.status;
        p.statusReason = ev.reason;
        break;
      }
      case 'gate':
        st.gates[ev.gate] = { cleared: ev.cleared, evidence: ev.evidence, ts: ev.ts, id: ev.id };
        break;
      case 'note':
        st.notes.push(ev);
        break;
      default:
        break;
    }
  }
  st.running = [...openRuns.values()];
  st.yieldRatio = st.spentUsd > 0 ? st.earnedUsd / st.spentUsd : null;
  return st;
}
