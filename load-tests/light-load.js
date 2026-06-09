// ── FinLedger Light Load Test ──
// Fast validation (~1min) with low VU count. Ideal for dev and CI pipelines.
// Usage: npm run test:load:light

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import {
  BASE_URL,
  SEED_USERS,
  SEED_ACCOUNTS,
  SEED_TRANSACTIONS,
} from './config.js';
import {
  makeUserPayload,
  makeAccountPayload,
  makeTransferPayload,
  jsonParams,
  randomItem,
  TRANSFER_PAIRS,
} from './helpers.js';

// ── Custom Metrics ──
const txCreateDuration = new Trend('tx_create_duration', true);
const txCreateFailRate = new Rate('tx_create_fail_rate');
const balanceQueryDuration = new Trend('balance_query_duration', true);
const totalTransactions = new Counter('total_transactions_created');

// ── Options ──
export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 10,
      duration: '15s',
      exec: 'smokeTest',
      startTime: '0s',
    },

    mixed_load: {
      executor: 'ramping-vus',
      exec: 'mixedScenario',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 }, // ramp up
        { duration: '30s', target: 50 }, // sustain
        { duration: '10s', target: 0 }, // ramp down
      ],
      startTime: '15s',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.05'],
    tx_create_duration: ['p(95)<1000'],
    tx_create_fail_rate: ['rate<0.05'],
    balance_query_duration: ['p(95)<300'],
  },
};

// ── Seed data arrays ──
const seedUserIds = Object.values(SEED_USERS);
const seedAccountIds = Object.values(SEED_ACCOUNTS);
const seedTxIds = Object.values(SEED_TRANSACTIONS);

// ════════════════════════════════════════════════════════════════
//  SCENARIO: smokeTest — validate all endpoints respond
// ════════════════════════════════════════════════════════════════
export function smokeTest() {
  group('smoke', () => {
    const healthRes = http.get(`${BASE_URL}`, {
      tags: { name: 'GET /api' },
    });
    check(healthRes, { 'health: 200': (r) => r.status === 200 });

    const usersRes = http.get(`${BASE_URL}/users`, {
      tags: { name: 'GET /api/users' },
    });
    check(usersRes, { 'users: 200': (r) => r.status === 200 });

    const accountsRes = http.get(`${BASE_URL}/accounts`, {
      tags: { name: 'GET /api/accounts' },
    });
    check(accountsRes, { 'accounts: 200': (r) => r.status === 200 });

    const balRes = http.get(
      `${BASE_URL}/accounts/${SEED_ACCOUNTS.aliceWallet}/balance`,
      { tags: { name: 'GET /api/accounts/:id/balance' } },
    );
    balanceQueryDuration.add(balRes.timings.duration);
    check(balRes, { 'balance: 200': (r) => r.status === 200 });

    const txRes = http.get(`${BASE_URL}/transactions`, {
      tags: { name: 'GET /api/transactions' },
    });
    check(txRes, { 'transactions: 200': (r) => r.status === 200 });

    const ledgerRes = http.get(`${BASE_URL}/ledger`, {
      tags: { name: 'GET /api/ledger' },
    });
    check(ledgerRes, { 'ledger: 200': (r) => r.status === 200 });
  });

  sleep(0.5);
}

// ════════════════════════════════════════════════════════════════
//  SCENARIO: mixedScenario — reads + writes at low concurrency
// ════════════════════════════════════════════════════════════════
export function mixedScenario() {
  const action = Math.random();

  if (action < 0.1) {
    // ── Create user ──
    const res = http.post(
      `${BASE_URL}/users`,
      makeUserPayload(),
      jsonParams({ tags: { name: 'POST /api/users' } }),
    );
    check(res, { 'create user: 201': (r) => r.status === 201 });
  } else if (action < 0.2) {
    // ── Create account ──
    const userId = randomItem(seedUserIds);
    const res = http.post(
      `${BASE_URL}/accounts`,
      makeAccountPayload(userId, 'WALLET'),
      jsonParams({ tags: { name: 'POST /api/accounts' } }),
    );
    check(res, { 'create account: 201': (r) => r.status === 201 });
  } else if (action < 0.45) {
    // ── Create transaction ──
    const pair = randomItem(TRANSFER_PAIRS);
    const amount = parseFloat((Math.random() * 10 + 0.01).toFixed(2));
    const res = http.post(
      `${BASE_URL}/transactions`,
      makeTransferPayload(pair.from, pair.to, amount),
      jsonParams({ tags: { name: 'POST /api/transactions' } }),
    );
    txCreateDuration.add(res.timings.duration);
    txCreateFailRate.add(res.status !== 201);
    if (check(res, { 'create tx: 201': (r) => r.status === 201 })) {
      totalTransactions.add(1);
    }
  } else if (action < 0.6) {
    // ── Get balance ──
    const id = randomItem(seedAccountIds);
    const res = http.get(`${BASE_URL}/accounts/${id}/balance`, {
      tags: { name: 'GET /api/accounts/:id/balance' },
    });
    balanceQueryDuration.add(res.timings.duration);
    check(res, { 'balance: 200': (r) => r.status === 200 });
  } else if (action < 0.75) {
    // ── List transactions ──
    const res = http.get(`${BASE_URL}/transactions`, {
      tags: { name: 'GET /api/transactions' },
    });
    check(res, { 'list tx: 200': (r) => r.status === 200 });
  } else if (action < 0.85) {
    // ── Get user ──
    const id = randomItem(seedUserIds);
    const res = http.get(`${BASE_URL}/users/${id}`, {
      tags: { name: 'GET /api/users/:id' },
    });
    check(res, { 'get user: 200': (r) => r.status === 200 });
  } else if (action < 0.92) {
    // ── Get transaction ──
    const id = randomItem(seedTxIds);
    const res = http.get(`${BASE_URL}/transactions/${id}`, {
      tags: { name: 'GET /api/transactions/:id' },
    });
    check(res, { 'get tx: 200': (r) => r.status === 200 });
  } else {
    // ── Ledger ──
    const res = http.get(`${BASE_URL}/ledger`, {
      tags: { name: 'GET /api/ledger' },
    });
    check(res, { 'ledger: 200': (r) => r.status === 200 });
  }

  sleep(0.1);
}
