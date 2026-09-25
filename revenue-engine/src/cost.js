// Model pricing in USD per 1M tokens. VOLATILE: verify at https://platform.claude.com/docs/en/about-claude/pricing
// An unpriced model is refused at run start rather than recorded as $0; a zero on the ledger would be a lie.
export const PRICING = Object.freeze({
  'claude-opus-5': { in: 5, out: 25 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-fable-5-1': { in: 10, out: 50 },
});

// Cache multipliers are the published defaults (write 1.25x, read 0.1x). Some models read cheaper; that only
// makes this estimate conservative, never optimistic.
const CACHE_WRITE = 1.25;
const CACHE_READ = 0.1;

export function priceFor(model, override) {
  if (override && Number.isFinite(override.in) && Number.isFinite(override.out)) return { in: override.in, out: override.out };
  return PRICING[model] || null;
}

export function costUsd(model, usage, override) {
  const p = priceFor(model, override);
  if (!p || !usage) return null;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  return (inTok * p.in + outTok * p.out + cacheWrite * p.in * CACHE_WRITE + cacheRead * p.in * CACHE_READ) / 1e6;
}
