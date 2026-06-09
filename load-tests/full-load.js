// ── FinLedger Full Load Test ──
// Usage: k6 run load-tests/full-load.js
//        k6 run --out json=load-tests/results.json load-tests/full-load.js

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  BASE_URL,
  SEED_ACCOUNTS,
  SEED_TRANSACTIONS,
  SEED_USERS,
} from './config.js';
import {
  jsonParams,
  makeAccountPayload,
  makeTransferPayload,
  makeUserPayload,
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
    // ── Warm-up: light smoke test ──
    warmup: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      exec: 'warmup',
      startTime: '0s',
      gracefulStop: '5s',
    },

    // ── Sustained load: ramp up to 500 VUs ──
    sustained_reads: {
      executor: 'ramping-vus',
      exec: 'readScenario',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 }, // ramp up
        { duration: '3m', target: 200 }, // sustain
        { duration: '1m', target: 0 }, // ramp down
      ],
      startTime: '35s',
      gracefulStop: '10s',
    },

    sustained_writes: {
      executor: 'ramping-vus',
      exec: 'writeScenario',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 }, // ramp up
        { duration: '3m', target: 200 }, // sustain
        { duration: '1m', target: 0 }, // ramp down
      ],
      startTime: '35s',
      gracefulStop: '10s',
    },

    // ── Spike: burst of transaction creation ──
    spike: {
      executor: 'ramping-vus',
      exec: 'spikeTransactions',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 }, // quick ramp
        { duration: '20s', target: 100 }, // hold spike
        { duration: '10s', target: 0 }, // cool down
      ],
      startTime: '3m35s',
      gracefulStop: '10s',
    },
  },

  thresholds: {
    // ── Global ──
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.05'],

    // ── Transaction-specific ──
    tx_create_duration: ['p(95)<1000', 'p(99)<2000'],
    tx_create_fail_rate: ['rate<0.05'],

    // ── Balance query ──
    balance_query_duration: ['p(95)<300'],

    // ── Per-endpoint (tag-based) ──
    'http_req_duration{name:POST /api/transactions}': ['p(95)<1000'],
    'http_req_duration{name:GET /api/accounts/:id/balance}': ['p(95)<300'],
    'http_req_duration{name:GET /api/transactions}': ['p(95)<500'],
    'http_req_duration{name:POST /api/users}': ['p(95)<500'],
  },
};

// ── Seed data arrays ──
const seedUserIds = Object.values(SEED_USERS);
const seedAccountIds = Object.values(SEED_ACCOUNTS);
const seedTxIds = Object.values(SEED_TRANSACTIONS);

// ════════════════════════════════════════════════════════════════
//  SCENARIO: warmup
// ════════════════════════════════════════════════════════════════
export function warmup() {
  group('warmup', () => {
    // Health check
    const healthRes = http.get(`${BASE_URL}`, {
      tags: { name: 'GET /api' },
    });
    check(healthRes, { 'warmup health: 200': (r) => r.status === 200 });

    // List users
    const usersRes = http.get(`${BASE_URL}/users`, {
      tags: { name: 'GET /api/users' },
    });
    check(usersRes, { 'warmup users: 200': (r) => r.status === 200 });

    // List accounts
    const accountsRes = http.get(`${BASE_URL}/accounts`, {
      tags: { name: 'GET /api/accounts' },
    });
    check(accountsRes, { 'warmup accounts: 200': (r) => r.status === 200 });

    // Get a balance
    const balRes = http.get(
      `${BASE_URL}/accounts/${SEED_ACCOUNTS.aliceWallet}/balance`,
      { tags: { name: 'GET /api/accounts/:id/balance' } },
    );
    check(balRes, { 'warmup balance: 200': (r) => r.status === 200 });

    // List transactions
    const txRes = http.get(`${BASE_URL}/transactions`, {
      tags: { name: 'GET /api/transactions' },
    });
    check(txRes, { 'warmup transactions: 200': (r) => r.status === 200 });
  });

  sleep(0.5);
}

// ════════════════════════════════════════════════════════════════
//  SCENARIO: readScenario
//  Mixed read operations across all endpoints
// ════════════════════════════════════════════════════════════════
export function readScenario() {
  const action = Math.random();

  if (action < 0.2) {
    // ── GET /api/users ──
    group('read: list users', () => {
      const res = http.get(`${BASE_URL}/users`, {
        tags: { name: 'GET /api/users' },
      });
      check(res, { 'list users: 200': (r) => r.status === 200 });
    });
  } else if (action < 0.35) {
    // ── GET /api/users/:id ──
    group('read: get user', () => {
      const id = randomItem(seedUserIds);
      const res = http.get(`${BASE_URL}/users/${id}`, {
        tags: { name: 'GET /api/users/:id' },
      });
      check(res, { 'get user: 200': (r) => r.status === 200 });
    });
  } else if (action < 0.5) {
    // ── GET /api/accounts ──
    group('read: list accounts', () => {
      const res = http.get(`${BASE_URL}/accounts`, {
        tags: { name: 'GET /api/accounts' },
      });
      check(res, { 'list accounts: 200': (r) => r.status === 200 });
    });
  } else if (action < 0.7) {
    // ── GET /api/accounts/:id/balance (most queried) ──
    group('read: get balance', () => {
      const id = randomItem(seedAccountIds);
      const res = http.get(`${BASE_URL}/accounts/${id}/balance`, {
        tags: { name: 'GET /api/accounts/:id/balance' },
      });
      balanceQueryDuration.add(res.timings.duration);
      check(res, { 'get balance: 200': (r) => r.status === 200 });
    });
  } else if (action < 0.85) {
    // ── GET /api/transactions ──
    group('read: list transactions', () => {
      const res = http.get(`${BASE_URL}/transactions`, {
        tags: { name: 'GET /api/transactions' },
      });
      check(res, { 'list tx: 200': (r) => r.status === 200 });
    });
  } else if (action < 0.92) {
    // ── GET /api/transactions/:id ──
    group('read: get transaction', () => {
      const id = randomItem(seedTxIds);
      const res = http.get(`${BASE_URL}/transactions/${id}`, {
        tags: { name: 'GET /api/transactions/:id' },
      });
      check(res, { 'get tx: 200': (r) => r.status === 200 });
    });
  } else {
    // ── GET /api/ledger ──
    group('read: ledger', () => {
      const res = http.get(`${BASE_URL}/ledger`, {
        tags: { name: 'GET /api/ledger' },
      });
      check(res, { 'list ledger: 200': (r) => r.status === 200 });
    });
  }

  sleep(0.1);
}

// ════════════════════════════════════════════════════════════════
//  SCENARIO: writeScenario
//  Mixed write operations: create users, accounts, transactions
// ════════════════════════════════════════════════════════════════
export function writeScenario() {
  const action = Math.random();

  if (action < 0.15) {
    // ── POST /api/users ──
    group('write: create user', () => {
      const res = http.post(
        `${BASE_URL}/users`,
        makeUserPayload(),
        jsonParams({ tags: { name: 'POST /api/users' } }),
      );
      check(res, { 'create user: 201': (r) => r.status === 201 });
    });
  } else if (action < 0.3) {
    // ── POST /api/accounts ──
    group('write: create account', () => {
      const userId = randomItem(seedUserIds);
      const types = ['WALLET', 'SAVINGS'];
      const res = http.post(
        `${BASE_URL}/accounts`,
        makeAccountPayload(userId, randomItem(types)),
        jsonParams({ tags: { name: 'POST /api/accounts' } }),
      );
      check(res, { 'create account: 201': (r) => r.status === 201 });
    });
  } else {
    // ── POST /api/transactions (70% of writes → transactions) ──
    group('write: create transaction', () => {
      const pair = randomItem(TRANSFER_PAIRS);
      const amount = parseFloat((Math.random() * 10 + 0.01).toFixed(2));
      const res = http.post(
        `${BASE_URL}/transactions`,
        makeTransferPayload(pair.from, pair.to, amount),
        jsonParams({ tags: { name: 'POST /api/transactions' } }),
      );

      txCreateDuration.add(res.timings.duration);
      txCreateFailRate.add(res.status !== 201);

      const ok = check(res, {
        'create tx: 201': (r) => r.status === 201,
        'create tx: COMPLETED': (r) => {
          try {
            return r.json('status') === 'COMPLETED';
          } catch (_) {
            return false;
          }
        },
      });

      if (ok) {
        totalTransactions.add(1);
      }
    });
  }

  sleep(0.1);
}

// ════════════════════════════════════════════════════════════════
//  SCENARIO: spikeTransactions
//  Burst of transaction creation to test system under spike
// ════════════════════════════════════════════════════════════════
export function spikeTransactions() {
  const pair = randomItem(TRANSFER_PAIRS);
  const amount = parseFloat((Math.random() * 5 + 0.01).toFixed(2));

  const res = http.post(
    `${BASE_URL}/transactions`,
    makeTransferPayload(pair.from, pair.to, amount),
    jsonParams({ tags: { name: 'POST /api/transactions' } }),
  );

  txCreateDuration.add(res.timings.duration);
  txCreateFailRate.add(res.status !== 201);

  check(res, {
    'spike tx: 201': (r) => r.status === 201,
  });

  if (res.status === 201) {
    totalTransactions.add(1);
  }

  sleep(0.05);
}
