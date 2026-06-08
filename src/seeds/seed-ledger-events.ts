import 'reflect-metadata';
import mongoose from 'mongoose';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/finledger';

const ledgerEventSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    status: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    metadata: { type: Object },
    entries: [
      {
        accountId: String,
        amount: Number,
        type: String,
      },
    ],
    processedAt: { type: Date },
  },
  { collection: 'ledger_events', timestamps: true },
);

const LedgerEvent = mongoose.model('LedgerEvent', ledgerEventSchema);

const events = [
  {
    transactionId: 'c3000000-0000-4000-8000-000000000001',
    type: 'DEPOSIT',
    status: 'COMPLETED',
    idempotencyKey: 'seed-deposit-alice-001',
    metadata: { description: 'Depósito inicial Alice' },
    entries: [
      {
        accountId: 'b2000000-0000-4000-8000-000000000099',
        amount: 5000.0,
        type: 'DEBIT',
      },
      {
        accountId: 'b2000000-0000-4000-8000-000000000001',
        amount: 5000.0,
        type: 'CREDIT',
      },
    ],
    processedAt: new Date('2025-12-06T10:00:00Z'),
  },
  {
    transactionId: 'c3000000-0000-4000-8000-000000000002',
    type: 'DEPOSIT',
    status: 'COMPLETED',
    idempotencyKey: 'seed-deposit-bob-001',
    metadata: { description: 'Depósito inicial Bob' },
    entries: [
      {
        accountId: 'b2000000-0000-4000-8000-000000000099',
        amount: 3000.0,
        type: 'DEBIT',
      },
      {
        accountId: 'b2000000-0000-4000-8000-000000000003',
        amount: 3000.0,
        type: 'CREDIT',
      },
    ],
    processedAt: new Date('2025-12-06T10:05:00Z'),
  },
  {
    transactionId: 'c3000000-0000-4000-8000-000000000003',
    type: 'DEPOSIT',
    status: 'COMPLETED',
    idempotencyKey: 'seed-deposit-carol-001',
    metadata: { description: 'Depósito inicial Carol' },
    entries: [
      {
        accountId: 'b2000000-0000-4000-8000-000000000099',
        amount: 1500.0,
        type: 'DEBIT',
      },
      {
        accountId: 'b2000000-0000-4000-8000-000000000004',
        amount: 1500.0,
        type: 'CREDIT',
      },
    ],
    processedAt: new Date('2025-12-06T10:10:00Z'),
  },
  {
    transactionId: 'c3000000-0000-4000-8000-000000000004',
    type: 'TRANSFER',
    status: 'COMPLETED',
    idempotencyKey: 'seed-transfer-alice-bob-001',
    metadata: { description: 'Alice → Bob transferência' },
    entries: [
      {
        accountId: 'b2000000-0000-4000-8000-000000000001',
        amount: 750.0,
        type: 'DEBIT',
      },
      {
        accountId: 'b2000000-0000-4000-8000-000000000003',
        amount: 750.0,
        type: 'CREDIT',
      },
    ],
    processedAt: new Date('2025-12-06T11:00:00Z'),
  },
  {
    transactionId: 'c3000000-0000-4000-8000-000000000005',
    type: 'TRANSFER',
    status: 'COMPLETED',
    idempotencyKey: 'seed-transfer-alice-savings-001',
    metadata: { description: 'Alice wallet → savings' },
    entries: [
      {
        accountId: 'b2000000-0000-4000-8000-000000000001',
        amount: 2000.0,
        type: 'DEBIT',
      },
      {
        accountId: 'b2000000-0000-4000-8000-000000000002',
        amount: 2000.0,
        type: 'CREDIT',
      },
    ],
    processedAt: new Date('2025-12-06T11:30:00Z'),
  },
  {
    transactionId: 'c3000000-0000-4000-8000-000000000006',
    type: 'WITHDRAW',
    status: 'COMPLETED',
    idempotencyKey: 'seed-withdraw-bob-001',
    metadata: { description: 'Saque Bob' },
    entries: [
      {
        accountId: 'b2000000-0000-4000-8000-000000000003',
        amount: 500.0,
        type: 'DEBIT',
      },
      {
        accountId: 'b2000000-0000-4000-8000-000000000099',
        amount: 500.0,
        type: 'CREDIT',
      },
    ],
    processedAt: new Date('2025-12-06T12:00:00Z'),
  },
  {
    transactionId: 'c3000000-0000-4000-8000-000000000007',
    type: 'TRANSFER',
    status: 'COMPLETED',
    idempotencyKey: 'seed-transfer-carol-alice-001',
    metadata: { description: 'Carol → Alice transferência' },
    entries: [
      {
        accountId: 'b2000000-0000-4000-8000-000000000004',
        amount: 250.0,
        type: 'DEBIT',
      },
      {
        accountId: 'b2000000-0000-4000-8000-000000000001',
        amount: 250.0,
        type: 'CREDIT',
      },
    ],
    processedAt: new Date('2025-12-06T12:30:00Z'),
  },
];

async function seed() {
  console.log(`Connecting to MongoDB: ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);

  const existing = await LedgerEvent.countDocuments({
    idempotencyKey: { $regex: /^seed-/ },
  });

  if (existing > 0) {
    console.log(`Seed data already exists (${existing} events). Skipping.`);
  } else {
    await LedgerEvent.insertMany(events);
    console.log(`Inserted ${events.length} ledger events.`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
