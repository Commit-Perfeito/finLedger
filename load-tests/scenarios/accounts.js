// ── Accounts Scenario ──
// Standalone: k6 run load-tests/scenarios/accounts.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  DEFAULT_THRESHOLDS,
  SEED_USERS,
  SEED_ACCOUNTS,
} from '../config.js';
import { makeAccountPayload, jsonParams, randomItem } from '../helpers.js';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: DEFAULT_THRESHOLDS,
};

const seedAccountIds = Object.values(SEED_ACCOUNTS);
const seedUserIds = Object.values(SEED_USERS);
const accountTypes = ['WALLET', 'SAVINGS'];

export default function () {
  // ── POST /api/accounts ──
  const userId = randomItem(seedUserIds);
  const accType = randomItem(accountTypes);
  const createRes = http.post(
    `${BASE_URL}/accounts`,
    makeAccountPayload(userId, accType),
    jsonParams({ tags: { name: 'POST /api/accounts' } }),
  );
  check(createRes, {
    'create account: status 201': (r) => r.status === 201,
  });

  // ── GET /api/accounts ──
  const listRes = http.get(`${BASE_URL}/accounts`, {
    tags: { name: 'GET /api/accounts' },
  });
  check(listRes, {
    'list accounts: status 200': (r) => r.status === 200,
    'list accounts: is array': (r) => Array.isArray(r.json()),
  });

  // ── GET /api/accounts/:id ──
  const accountId = randomItem(seedAccountIds);
  const getRes = http.get(`${BASE_URL}/accounts/${accountId}`, {
    tags: { name: 'GET /api/accounts/:id' },
  });
  check(getRes, {
    'get account: status 200': (r) => r.status === 200,
  });

  // ── GET /api/accounts/:id/balance ──
  const balanceRes = http.get(`${BASE_URL}/accounts/${accountId}/balance`, {
    tags: { name: 'GET /api/accounts/:id/balance' },
  });
  check(balanceRes, {
    'get balance: status 200': (r) => r.status === 200,
  });

  sleep(0.3);
}
