// ── Health Check Scenario ──
// Standalone: k6 run load-tests/scenarios/health-check.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_THRESHOLDS } from '../config.js';

export const options = {
  vus: 10,
  duration: '10s',
  thresholds: DEFAULT_THRESHOLDS,
};

export default function () {
  const res = http.get(`${BASE_URL}`);
  check(res, {
    'health: status 200': (r) => r.status === 200,
  });
  sleep(0.1);
}
