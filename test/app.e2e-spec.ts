/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { NatsClientService } from './../src/ledger/nats-client.service';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { DataSource } from 'typeorm';

describe('FinLedger (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const natsClientMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    emit: jest.fn(),
    ensureConnected: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn().mockReturnValue({
      subscribe: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }),
      }),
      publish: jest.fn(),
    }),
    getCodec: jest
      .fn()
      .mockReturnValue({ encode: jest.fn(), decode: jest.fn() }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NatsClientService)
      .useValue(natsClientMock)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api');

    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query('DELETE FROM entries');
      await dataSource.query('DELETE FROM transactions');
      await dataSource.query('DELETE FROM account_balances');
      await dataSource.query('DELETE FROM accounts');
      await dataSource.query('DELETE FROM users');
    }
    await app.close();
  });

  // ─── Saúde ───────────────────────────────────────────────

  describe('GET /api', () => {
    it('should return hello message', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect('Hello World!');
    });
  });

  // ─── Usuários ────────────────────────────────────────────

  describe('Users /api/users', () => {
    let userId: string;

    it('POST /api/users — should create a user', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Alice Test', email: 'alice-e2e@test.com' })
        .expect(201);

      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Alice Test');
      expect(body.email).toBe('alice-e2e@test.com');
      expect(body).toHaveProperty('createdAt');
      userId = body.id;
    });

    it('POST /api/users — should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Alice Dup', email: 'alice-e2e@test.com' })
        .expect(409);
    });

    it('POST /api/users — should reject invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: '' })
        .expect(400);
    });

    it('POST /api/users — should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Bob', email: 'not-an-email' })
        .expect(400);
    });

    it('POST /api/users — should reject extra fields', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Bob', email: 'bob@test.com', role: 'admin' })
        .expect(400);
    });

    it('GET /api/users — should list users', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/users')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/users/:id — should find user by id', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/users/${userId}`)
        .expect(200);

      expect(body.id).toBe(userId);
      expect(body.name).toBe('Alice Test');
      expect(body).toHaveProperty('accounts');
    });

    it('GET /api/users/:id — should return 404 for unknown id', async () => {
      await request(app.getHttpServer())
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('GET /api/users/:id — should return 400 for invalid uuid', async () => {
      await request(app.getHttpServer())
        .get('/api/users/not-a-uuid')
        .expect(400);
    });
  });

  // ─── Contas ──────────────────────────────────────────────

  describe('Accounts /api/accounts', () => {
    let userIdForAccounts: string;
    let walletAccountId: string;

    beforeAll(async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Bob Accounts', email: 'bob-accounts-e2e@test.com' });
      userIdForAccounts = body.id;
    });

    it('POST /api/accounts — should create a WALLET account', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ userId: userIdForAccounts, type: 'WALLET' })
        .expect(201);

      expect(body).toHaveProperty('id');
      expect(body.userId).toBe(userIdForAccounts);
      expect(body.type).toBe('WALLET');
      expect(body.currency).toBe('BRL');
      walletAccountId = body.id;
    });

    it('POST /api/accounts — should create a SAVINGS account with custom currency', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ userId: userIdForAccounts, type: 'SAVINGS', currency: 'USD' })
        .expect(201);

      expect(body.type).toBe('SAVINGS');
      expect(body.currency).toBe('USD');
    });

    it('POST /api/accounts — should reject invalid account type', async () => {
      await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ userId: userIdForAccounts, type: 'INVALID' })
        .expect(400);
    });

    it('POST /api/accounts — should reject missing userId', async () => {
      await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ type: 'WALLET' })
        .expect(400);
    });

    it('GET /api/accounts — should list all accounts', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/accounts')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/accounts/:id — should find account with balance', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/accounts/${walletAccountId}`)
        .expect(200);

      expect(body.id).toBe(walletAccountId);
      expect(body).toHaveProperty('balance');
    });

    it('GET /api/accounts/:id — should return 404 for unknown account', async () => {
      await request(app.getHttpServer())
        .get('/api/accounts/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('GET /api/accounts/:id/balance — should return zero balance for new account', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/accounts/${walletAccountId}/balance`)
        .expect(200);

      expect(body.accountId).toBe(walletAccountId);
      expect(body.balance).toBe(0);
    });

    it('GET /api/accounts/:id/balance — should return 404 for unknown account', async () => {
      await request(app.getHttpServer())
        .get('/api/accounts/00000000-0000-0000-0000-000000000000/balance')
        .expect(404);
    });
  });

  // ─── Transações ──────────────────────────────────────────

  describe('Transactions /api/transactions', () => {
    let accountA: string;
    let accountB: string;
    let transactionId: string;

    beforeAll(async () => {
      const { body: user } = await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Charlie Txn', email: 'charlie-txn-e2e@test.com' });

      const { body: accA } = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ userId: user.id, type: 'WALLET' });
      accountA = accA.id;

      const { body: accB } = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ userId: user.id, type: 'SAVINGS' });
      accountB = accB.id;
    });

    it('POST /api/transactions — should create a valid double-entry transaction', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'TRANSFER',
          idempotencyKey: 'e2e-txn-001',
          metadata: { description: 'E2E test transfer' },
          entries: [
            { accountId: accountA, amount: 100, type: 'DEBIT' },
            { accountId: accountB, amount: 100, type: 'CREDIT' },
          ],
        })
        .expect(201);

      expect(body).toHaveProperty('id');
      expect(body.type).toBe('TRANSFER');
      expect(body.status).toBe('COMPLETED');
      expect(body.idempotencyKey).toBe('e2e-txn-001');
      expect(body.entries).toHaveLength(2);
      transactionId = body.id;

      expect(natsClientMock.emit).toHaveBeenCalledWith(
        'transaction.completed',
        expect.objectContaining({ transactionId: body.id }),
      );
    });

    it('POST /api/transactions — should return same transaction for duplicate idempotencyKey', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'TRANSFER',
          idempotencyKey: 'e2e-txn-001',
          entries: [
            { accountId: accountA, amount: 100, type: 'DEBIT' },
            { accountId: accountB, amount: 100, type: 'CREDIT' },
          ],
        })
        .expect(201);

      expect(body.id).toBe(transactionId);
    });

    it('POST /api/transactions — should reject unbalanced entries (double-entry violation)', async () => {
      await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'TRANSFER',
          idempotencyKey: 'e2e-txn-unbalanced',
          entries: [
            { accountId: accountA, amount: 100, type: 'DEBIT' },
            { accountId: accountB, amount: 50, type: 'CREDIT' },
          ],
        })
        .expect(400);
    });

    it('POST /api/transactions — should reject less than 2 entries', async () => {
      await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'DEPOSIT',
          idempotencyKey: 'e2e-txn-single',
          entries: [{ accountId: accountA, amount: 100, type: 'CREDIT' }],
        })
        .expect(400);
    });

    it('POST /api/transactions — should reject invalid transaction type', async () => {
      await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'INVALID_TYPE',
          idempotencyKey: 'e2e-txn-invalid-type',
          entries: [
            { accountId: accountA, amount: 10, type: 'DEBIT' },
            { accountId: accountB, amount: 10, type: 'CREDIT' },
          ],
        })
        .expect(400);
    });

    it('POST /api/transactions — should reject entry with amount zero', async () => {
      await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'TRANSFER',
          idempotencyKey: 'e2e-txn-zero',
          entries: [
            { accountId: accountA, amount: 0, type: 'DEBIT' },
            { accountId: accountB, amount: 0, type: 'CREDIT' },
          ],
        })
        .expect(400);
    });

    it('POST /api/transactions — should reject missing idempotencyKey', async () => {
      await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'TRANSFER',
          entries: [
            { accountId: accountA, amount: 10, type: 'DEBIT' },
            { accountId: accountB, amount: 10, type: 'CREDIT' },
          ],
        })
        .expect(400);
    });

    it('GET /api/transactions — should list transactions', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/transactions')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0]).toHaveProperty('entries');
    });

    it('GET /api/transactions/:id — should find transaction by id', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/transactions/${transactionId}`)
        .expect(200);

      expect(body.id).toBe(transactionId);
      expect(body.entries).toHaveLength(2);
    });

    it('GET /api/transactions/:id — should return 400 for unknown transaction', async () => {
      await request(app.getHttpServer())
        .get('/api/transactions/00000000-0000-0000-0000-000000000000')
        .expect(400);
    });

    it('should update account balances after a transaction', async () => {
      const { body: balanceA } = await request(app.getHttpServer())
        .get(`/api/accounts/${accountA}/balance`)
        .expect(200);

      const { body: balanceB } = await request(app.getHttpServer())
        .get(`/api/accounts/${accountB}/balance`)
        .expect(200);

      expect(balanceA.balance).toBe(-100);
      expect(balanceB.balance).toBe(100);
    });

    it('should correctly accumulate balances across multiple transactions', async () => {
      await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'TRANSFER',
          idempotencyKey: 'e2e-txn-002',
          entries: [
            { accountId: accountA, amount: 50, type: 'DEBIT' },
            { accountId: accountB, amount: 50, type: 'CREDIT' },
          ],
        })
        .expect(201);

      const { body: balanceA } = await request(app.getHttpServer())
        .get(`/api/accounts/${accountA}/balance`)
        .expect(200);

      const { body: balanceB } = await request(app.getHttpServer())
        .get(`/api/accounts/${accountB}/balance`)
        .expect(200);

      expect(balanceA.balance).toBe(-150);
      expect(balanceB.balance).toBe(150);
    });
  });

  // ─── Livro-razão ─────────────────────────────────────────

  describe('Ledger /api/ledger', () => {
    it('GET /api/ledger — should return ledger events', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/ledger')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
    });

    it('GET /api/ledger/:transactionId — should return events for a transaction id', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/ledger/00000000-0000-0000-0000-000000000000')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ─── Fluxo Completo ──────────────────────────────────────

  describe('Full flow: user → account → transaction → balance', () => {
    it('should complete the entire lifecycle', async () => {
      // 1. Criar usuário
      const { body: user } = await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Diana Flow', email: 'diana-flow-e2e@test.com' })
        .expect(201);

      // 2. Criar duas contas
      const { body: checking } = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ userId: user.id, type: 'WALLET' })
        .expect(201);

      const { body: savings } = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ userId: user.id, type: 'SAVINGS' })
        .expect(201);

      // 3. Depósito (crédito na conta corrente, débito da conta interna)
      const { body: internalUser } = await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Internal System', email: 'internal-e2e@system.com' })
        .expect(201);

      const { body: internalAcc } = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ userId: internalUser.id, type: 'INTERNAL' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'DEPOSIT',
          idempotencyKey: 'e2e-flow-deposit',
          metadata: { description: 'Initial deposit' },
          entries: [
            { accountId: internalAcc.id, amount: 1000, type: 'DEBIT' },
            { accountId: checking.id, amount: 1000, type: 'CREDIT' },
          ],
        })
        .expect(201);

      // 4. Transferência da conta corrente para poupança
      await request(app.getHttpServer())
        .post('/api/transactions')
        .send({
          type: 'TRANSFER',
          idempotencyKey: 'e2e-flow-transfer',
          metadata: { description: 'Move to savings' },
          entries: [
            { accountId: checking.id, amount: 300, type: 'DEBIT' },
            { accountId: savings.id, amount: 300, type: 'CREDIT' },
          ],
        })
        .expect(201);

      // 5. Verificar saldos finais
      const { body: checkingBalance } = await request(app.getHttpServer())
        .get(`/api/accounts/${checking.id}/balance`)
        .expect(200);
      expect(checkingBalance.balance).toBe(700);

      const { body: savingsBalance } = await request(app.getHttpServer())
        .get(`/api/accounts/${savings.id}/balance`)
        .expect(200);
      expect(savingsBalance.balance).toBe(300);

      // 6. Verificar que o usuário possui as contas
      const { body: fullUser } = await request(app.getHttpServer())
        .get(`/api/users/${user.id}`)
        .expect(200);
      expect(fullUser.accounts).toHaveLength(2);

      // 7. Verificar que as transações estão listadas
      const { body: txns } = await request(app.getHttpServer())
        .get('/api/transactions')
        .expect(200);
      const flowTxns = txns.filter(
        (t: { idempotencyKey: string }) =>
          t.idempotencyKey === 'e2e-flow-deposit' ||
          t.idempotencyKey === 'e2e-flow-transfer',
      );
      expect(flowTxns).toHaveLength(2);
      expect(
        flowTxns.every((t: { status: string }) => t.status === 'COMPLETED'),
      ).toBe(true);
    });
  });
});
