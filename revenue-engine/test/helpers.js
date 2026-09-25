import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Ledger } from '../src/ledger.js';

export function tmpLedger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revenue-engine-'));
  return { dir, ledger: new Ledger(path.join(dir, 'ledger.jsonl')) };
}

// A tiny catalog so tests do not depend on the seeded one drifting.
export const TEST_CATALOG = [
  {
    id: 'alpha', rank: 1, name: 'Alpha path', bucket: 'test', thesis: 't', month12Usd: [100, 200], firstDollarWeeks: [1, 2],
    gate: 'employment-agreement', budgetUsd: 1, constraints: ['no tour operators'], killTest: 'k',
    stages: { prospect: { target: 2 }, conversation: { target: 1 }, demo: { target: 1 }, pilot: { target: 1 }, paid: { target: 1 }, retained: { target: 1 } },
  },
  {
    id: 'beta', rank: 2, name: 'Beta path', bucket: 'test', thesis: 't', month12Usd: [100, 200], firstDollarWeeks: [1, 2],
    budgetUsd: 5, constraints: [], killTest: 'k',
    stages: { prospect: { target: 1 }, conversation: { target: 1 }, demo: { target: 1 }, pilot: { target: 1 }, paid: { target: 1 }, retained: { target: 1 } },
  },
];
