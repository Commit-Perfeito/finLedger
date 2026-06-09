// ── Helpers and payload factories for k6 load tests ──

import { SEED_ACCOUNTS, JSON_HEADERS } from './config.js';

/**
 * Generate a unique idempotency key per VU + iteration.
 */
export function uniqueKey(prefix) {
  return `${prefix}-${__VU}-${__ITER}-${Date.now()}`;
}

/**
 * Generate a unique email per VU + iteration.
 */
export function uniqueEmail(prefix) {
  return `${prefix}-${__VU}-${__ITER}-${Date.now()}@loadtest.dev`;
}

/**
 * Build a POST request params object with JSON headers.
 */
export function jsonParams(extra) {
  return Object.assign({}, JSON_HEADERS, extra || {});
}

/**
 * Pick a random element from an array.
 */
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Transfer pairs for transaction scenarios ──

export const TRANSFER_PAIRS = [
  { from: SEED_ACCOUNTS.aliceWallet, to: SEED_ACCOUNTS.bobWallet },
  { from: SEED_ACCOUNTS.bobWallet, to: SEED_ACCOUNTS.carolWallet },
  { from: SEED_ACCOUNTS.carolWallet, to: SEED_ACCOUNTS.aliceWallet },
  { from: SEED_ACCOUNTS.aliceWallet, to: SEED_ACCOUNTS.aliceSavings },
  { from: SEED_ACCOUNTS.bobWallet, to: SEED_ACCOUNTS.aliceWallet },
  { from: SEED_ACCOUNTS.carolWallet, to: SEED_ACCOUNTS.carolSavings },
];

/**
 * Build a CreateTransactionDto payload for a TRANSFER.
 */
export function makeTransferPayload(fromAccountId, toAccountId, amount) {
  return JSON.stringify({
    type: 'TRANSFER',
    idempotencyKey: uniqueKey('lt-tx'),
    metadata: { description: 'Load test transfer', vu: __VU, iter: __ITER },
    entries: [
      { accountId: fromAccountId, amount: amount || 1.0, type: 'DEBIT' },
      { accountId: toAccountId, amount: amount || 1.0, type: 'CREDIT' },
    ],
  });
}

/**
 * Build a CreateUserDto payload.
 */
export function makeUserPayload() {
  return JSON.stringify({
    name: `LoadTest User ${__VU}-${__ITER}`,
    email: uniqueEmail('lt-user'),
  });
}

/**
 * Build a CreateAccountDto payload.
 */
export function makeAccountPayload(userId, type) {
  return JSON.stringify({
    userId: userId,
    type: type || 'WALLET',
    currency: 'BRL',
  });
}
