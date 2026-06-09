// ── Shared configuration for all k6 load test scenarios ──

export const BASE_URL = 'http://192.168.69.62:3000/api';

// ── Seed data IDs (from migration 1733500000000-SeedData.ts) ──

export const SEED_USERS = {
  alice: 'a1000000-0000-4000-8000-000000000001',
  bob: 'a1000000-0000-4000-8000-000000000002',
  carol: 'a1000000-0000-4000-8000-000000000003',
  ops: 'a1000000-0000-4000-8000-000000000004',
};

export const SEED_ACCOUNTS = {
  aliceWallet: 'b2000000-0000-4000-8000-000000000001',
  aliceSavings: 'b2000000-0000-4000-8000-000000000002',
  bobWallet: 'b2000000-0000-4000-8000-000000000003',
  carolWallet: 'b2000000-0000-4000-8000-000000000004',
  carolSavings: 'b2000000-0000-4000-8000-000000000005',
  internal: 'b2000000-0000-4000-8000-000000000099',
};

export const SEED_TRANSACTIONS = {
  depositAlice: 'c3000000-0000-4000-8000-000000000001',
  depositBob: 'c3000000-0000-4000-8000-000000000002',
  depositCarol: 'c3000000-0000-4000-8000-000000000003',
  transferAliceBob: 'c3000000-0000-4000-8000-000000000004',
  transferAliceSavings: 'c3000000-0000-4000-8000-000000000005',
  withdrawBob: 'c3000000-0000-4000-8000-000000000006',
  transferCarolAlice: 'c3000000-0000-4000-8000-000000000007',
};

// ── Default thresholds ──

export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  http_req_failed: ['rate<0.05'],
};

// ── Common headers ──

export const JSON_HEADERS = {
  headers: { 'Content-Type': 'application/json' },
};
