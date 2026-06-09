// ── Transactions Scenario (Critical Path) ──
// Standalone: k6 run load-tests/scenarios/transactions.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, DEFAULT_THRESHOLDS, SEED_TRANSACTIONS } from '../config.js';
import {
  makeTransferPayload,
  jsonParams,
  randomItem,
  TRANSFER_PAIRS,
} from '../helpers.js';

// ── Custom metrics ──
const txCreateDuration = new Trend('transaction_create_duration', true);
const txCreateFailRate = new Rate('transaction_create_fail_rate');

export const options = {
  vus: 30,
  duration: '30s',
  thresholds: Object.assign({}, DEFAULT_THRESHOLDS, {
    transaction_create_duration: ['p(95)<1000'],
    transaction_create_fail_rate: ['rate<0.05'],
  }),
};

const seedTxIds = Object.values(SEED_TRANSACTIONS);

export default function () {
  // ── POST /api/transactions (TRANSFER, double-entry) ──
  const pair = randomItem(TRANSFER_PAIRS);
  const amount = parseFloat((Math.random() * 10 + 0.01).toFixed(2));
  const payload = makeTransferPayload(pair.from, pair.to, amount);

  const createRes = http.post(
    `${BASE_URL}/transactions`,
    payload,
    jsonParams({ tags: { name: 'POST /api/transactions' } }),
  );

  txCreateDuration.add(createRes.timings.duration);
  txCreateFailRate.add(createRes.status !== 201);

  check(createRes, {
    'create tx: status 201': (r) => r.status === 201,
    'create tx: has id': (r) => {
      try {
        return !!r.json('id');
      } catch (_) {
        return false;
      }
    },
    'create tx: status COMPLETED': (r) => {
      try {
        return r.json('status') === 'COMPLETED';
      } catch (_) {
        return false;
      }
    },
  });

  // ── GET /api/transactions ──
  const listRes = http.get(`${BASE_URL}/transactions`, {
    tags: { name: 'GET /api/transactions' },
  });
  check(listRes, {
    'list tx: status 200': (r) => r.status === 200,
  });

  // ── GET /api/transactions/:id (seed tx) ──
  const txId = randomItem(seedTxIds);
  const getRes = http.get(`${BASE_URL}/transactions/${txId}`, {
    tags: { name: 'GET /api/transactions/:id' },
  });
  check(getRes, {
    'get tx: status 200': (r) => r.status === 200,
  });

  sleep(0.2);
}
