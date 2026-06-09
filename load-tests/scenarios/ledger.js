// ── Ledger Scenario ──
// Standalone: k6 run load-tests/scenarios/ledger.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_THRESHOLDS, SEED_TRANSACTIONS } from '../config.js';
import { randomItem } from '../helpers.js';

export const options = {
  vus: 15,
  duration: '30s',
  thresholds: DEFAULT_THRESHOLDS,
};

const seedTxIds = Object.values(SEED_TRANSACTIONS);

export default function () {
  // ── GET /api/ledger ──
  const listRes = http.get(`${BASE_URL}/ledger`, {
    tags: { name: 'GET /api/ledger' },
  });
  check(listRes, {
    'list ledger: status 200': (r) => r.status === 200,
  });

  // ── GET /api/ledger/:transactionId ──
  const txId = randomItem(seedTxIds);
  const getRes = http.get(`${BASE_URL}/ledger/${txId}`, {
    tags: { name: 'GET /api/ledger/:transactionId' },
  });
  check(getRes, {
    'get ledger event: status 200 or 404': (r) =>
      r.status === 200 || r.status === 404,
  });

  sleep(0.3);
}
