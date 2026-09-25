// Commander level = cumulative evidenced revenue. Every rung cites the money.in event that crossed it.
// StarNet's moat, applied to dollars: any level drills down to the exact payment that earned it.
export const LADDER = Object.freeze([
  { level: 0, usd: 0, title: 'No revenue yet' },
  { level: 1, usd: 1, title: 'First dollar' },
  { level: 2, usd: 1_000, title: '$1K earned' },
  { level: 3, usd: 10_000, title: '$10K earned' },
  { level: 4, usd: 100_000, title: '$100K earned' },
  { level: 5, usd: 1_000_000, title: '$1M earned' },
]);

export function commanderLevel(state) {
  const sorted = [...state.moneyIn].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const citations = [];
  let cum = 0;
  let rung = 1;
  for (const ev of sorted) {
    cum += ev.usd;
    while (rung < LADDER.length && cum >= LADDER[rung].usd) {
      citations.push({
        level: LADDER[rung].level, title: LADDER[rung].title, usd: LADDER[rung].usd,
        crossedBy: ev.id, source: ev.source, evidence: ev.evidence, path: ev.path, ts: ev.ts, cumulativeUsd: cum,
      });
      rung += 1;
    }
  }
  const level = citations.length ? citations[citations.length - 1].level : 0;
  const next = LADDER[level + 1] || null;
  return {
    level,
    title: LADDER[level].title,
    earnedUsd: cum,
    next: next ? { level: next.level, title: next.title, usd: next.usd, remainingUsd: next.usd - cum } : null,
    citations,
  };
}
