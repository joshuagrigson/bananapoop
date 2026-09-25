// Quests are a pure projection over ledger state. There is no "mark complete" button anywhere:
// a quest is done when the ledger proves it, and every done quest cites the events that did.
import { CATALOG, GATES, stagesFor } from './paths.js';
import { LADDER, commanderLevel } from './level.js';

const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export function quests(state, catalog = CATALOG) {
  const gates = [];
  const stages = [];
  const ladder = [];
  const yields = [];

  // 1) Gates: legal or ethical preconditions. Open gates lead, because they block spend.
  const gateNames = [...new Set(catalog.filter((p) => p.gate).map((p) => p.gate))];
  for (const g of gateNames) {
    const st = state.gates[g];
    const spec = GATES[g] || { title: g, why: '' };
    const dependents = catalog.filter((p) => p.gate === g).map((p) => p.id);
    const cleared = Boolean(st && st.cleared);
    gates.push({
      id: `gate:${g}`, kind: 'gate', title: spec.title,
      desc: cleared ? `cleared: ${st.evidence}` : st ? `BLOCKED: ${st.evidence}` : spec.why,
      reward: `agent runs unlock on ${dependents.join(', ')}`,
      status: cleared ? 'done' : 'open', progress: null, cites: st ? [st.id] : [], blocked: Boolean(st && !st.cleared),
    });
  }

  // 2) Stage quests: only the NEXT open stage per active path is actionable (the arc pattern).
  for (const spec of catalog) {
    const p = state.paths[spec.id];
    if (!p || spec.kind === 'service') continue;
    const gated = Boolean(spec.gate && !(state.gates[spec.gate] && state.gates[spec.gate].cleared));
    let nextShown = false;
    for (const s of stagesFor(spec)) {
      const n = s.id === 'paid' ? Math.max(p.outcomes.paid, p.moneyIn.length) : p.outcomes[s.id];
      const cites = p.refs[s.id].map((r) => r.id);
      if (n >= s.target) {
        stages.push({
          id: `stage:${spec.id}:${s.id}`, kind: 'stage', path: spec.id, stage: s.id,
          title: `${spec.name}: ${s.label}`, desc: `${n}/${s.target}`, reward: 'next stage surfaces',
          status: 'done', progress: { n, target: s.target }, cites,
        });
        continue;
      }
      if (nextShown || p.status !== 'active') continue;
      nextShown = true;
      stages.push({
        id: `stage:${spec.id}:${s.id}`, kind: 'stage', path: spec.id, stage: s.id,
        title: `${spec.name}: ${s.label}`,
        desc: gated
          ? `${n}/${s.target}. Agent runs are blocked until gate "${spec.gate}" is cleared; outcomes can still be logged by hand.`
          : `${n}/${s.target}`,
        reward: s.id === 'paid' ? 'real revenue on the ledger' : 'next stage surfaces',
        status: 'open', progress: { n, target: s.target }, cites, gated,
      });
    }
  }

  // 2b) Publishing: a post counts only once its live URL is on the ledger. Drafts in the outbox do not count.
  for (const spec of catalog) {
    const p = state.paths[spec.id];
    if (!p || !spec.postTarget) continue;
    const n = p.posts.length;
    const done = n >= spec.postTarget;
    if (!done && p.status !== 'active') continue;
    stages.push({
      id: `posts:${spec.id}`, kind: 'posts', path: spec.id,
      title: `${spec.name}: publish ${spec.postTarget} posts`,
      desc: `${n}/${spec.postTarget} live posts logged${p.posts.length ? `, ${fmt(p.posts.reduce((s, x) => s + x.earnedUsd, 0))} attributed` : ''}`,
      reward: 'an audience the paid paths can sell to', status: done ? 'done' : 'open',
      progress: { n, target: spec.postTarget }, cites: p.posts.map((x) => x.id),
    });
  }

  // 3) The money ladder: $1 -> $1K -> $10K -> $100K -> $1M, each citing the payment that crossed it.
  const lvl = commanderLevel(state);
  for (const rung of LADDER.slice(1)) {
    const c = lvl.citations.find((x) => x.level === rung.level);
    ladder.push({
      id: `ladder:${rung.usd}`, kind: 'ladder', title: rung.title,
      desc: c
        ? `crossed ${c.ts.slice(0, 10)} via ${c.path}, paid by ${c.source} (${c.evidence})`
        : `${fmt(state.earnedUsd)} of ${fmt(rung.usd)} recorded with evidence`,
      reward: `Commander level ${rung.level}`, status: c ? 'done' : 'open',
      progress: { n: Math.min(state.earnedUsd, rung.usd), target: rung.usd }, cites: c ? [c.crossedBy] : [],
    });
  }

  // 4) Yield: earned / spent. Undefined until something is spent; never shown as zero when it is undefined.
  for (const t of [1, 10]) {
    const ok = state.spentUsd > 0 && state.yieldRatio >= t;
    yields.push({
      id: `yield:${t}`, kind: 'yield',
      title: t === 1 ? 'The machine pays for itself (yield >= 1)' : 'Yield >= 10',
      desc: state.spentUsd > 0
        ? `yield ${state.yieldRatio.toFixed(2)} = ${fmt(state.earnedUsd)} earned / ${fmt(state.spentUsd)} spent`
        : 'nothing spent yet, so yield is undefined, not zero',
      reward: 'proof the spend is worth it', status: ok ? 'done' : 'open', progress: null, cites: [],
    });
  }

  const all = [...gates, ...stages, ...ladder, ...yields];
  return [...all.filter((q) => q.status === 'open'), ...all.filter((q) => q.status === 'done')];
}

export function summary(list) {
  let open = 0;
  let done = 0;
  for (const q of list) (q.status === 'done' ? done++ : open++);
  return { open, done, total: open + done };
}
