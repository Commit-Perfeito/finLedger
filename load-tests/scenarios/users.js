// ── Users Scenario ──
// Standalone: k6 run load-tests/scenarios/users.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_THRESHOLDS, SEED_USERS } from '../config.js';
import { makeUserPayload, jsonParams, randomItem } from '../helpers.js';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: DEFAULT_THRESHOLDS,
};

const seedUserIds = Object.values(SEED_USERS);

export default function () {
  // ── POST /api/users ──
  const createRes = http.post(
    `${BASE_URL}/users`,
    makeUserPayload(),
    jsonParams({ tags: { name: 'POST /api/users' } }),
  );
  check(createRes, {
    'create user: status 201': (r) => r.status === 201,
  });

  // ── GET /api/users ──
  const listRes = http.get(`${BASE_URL}/users`, {
    tags: { name: 'GET /api/users' },
  });
  check(listRes, {
    'list users: status 200': (r) => r.status === 200,
    'list users: is array': (r) => Array.isArray(r.json()),
  });

  // ── GET /api/users/:id (seed user) ──
  const userId = randomItem(seedUserIds);
  const getRes = http.get(`${BASE_URL}/users/${userId}`, {
    tags: { name: 'GET /api/users/:id' },
  });
  check(getRes, {
    'get user: status 200': (r) => r.status === 200,
    'get user: has id': (r) => r.json('id') === userId,
  });

  sleep(0.3);
}
