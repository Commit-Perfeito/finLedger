import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedData1733500000000 implements MigrationInterface {
  name = 'SeedData1733500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Users ──────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "users" ("id", "name", "email") VALUES
        ('a1000000-0000-4000-8000-000000000001', 'Alice Santos', 'alice@finledger.dev'),
        ('a1000000-0000-4000-8000-000000000002', 'Bob Oliveira', 'bob@finledger.dev'),
        ('a1000000-0000-4000-8000-000000000003', 'Carol Mendes', 'carol@finledger.dev'),
        ('a1000000-0000-4000-8000-000000000004', 'FinLedger Ops', 'ops@finledger.dev')
    `);

    // ── Accounts ───────────────────────────────────────────────
    // Alice: wallet + savings
    await queryRunner.query(`
      INSERT INTO "accounts" ("id", "user_id", "type", "currency") VALUES
        ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'WALLET',   'BRL'),
        ('b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'SAVINGS',  'BRL'),
        ('b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', 'WALLET',   'BRL'),
        ('b2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', 'WALLET',   'BRL'),
        ('b2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000003', 'SAVINGS',  'BRL'),
        ('b2000000-0000-4000-8000-000000000099', 'a1000000-0000-4000-8000-000000000004', 'INTERNAL', 'BRL')
    `);

    // ── Account Balances (initial zero, updated after transactions) ─
    await queryRunner.query(`
      INSERT INTO "account_balances" ("account_id", "balance") VALUES
        ('b2000000-0000-4000-8000-000000000001', 0),
        ('b2000000-0000-4000-8000-000000000002', 0),
        ('b2000000-0000-4000-8000-000000000003', 0),
        ('b2000000-0000-4000-8000-000000000004', 0),
        ('b2000000-0000-4000-8000-000000000005', 0),
        ('b2000000-0000-4000-8000-000000000099', 0)
    `);

    // ────────────────────────────────────────────────────────────
    // Transação 1: DEPOSIT — R$5.000,00 na wallet da Alice
    //   INTERNAL(ops) → CREDIT  +5000   (fonte dos fundos)
    //   WALLET(alice)  → DEBIT  -5000   ... wait, DEPOSIT:
    //     A conta INTERNAL é debitada (saída) e a WALLET é creditada (entrada)
    // ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "type", "status", "idempotency_key", "metadata") VALUES
        ('c3000000-0000-4000-8000-000000000001', 'DEPOSIT', 'COMPLETED', 'seed-deposit-alice-001',
         '{"description": "Depósito inicial Alice"}')
    `);
    await queryRunner.query(`
      INSERT INTO "entries" ("id", "transaction_id", "account_id", "amount", "type") VALUES
        ('d4000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001',
         'b2000000-0000-4000-8000-000000000099', 5000.00, 'DEBIT'),
        ('d4000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000001',
         'b2000000-0000-4000-8000-000000000001', 5000.00, 'CREDIT')
    `);

    // ────────────────────────────────────────────────────────────
    // Transação 2: DEPOSIT — R$3.000,00 na wallet do Bob
    // ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "type", "status", "idempotency_key", "metadata") VALUES
        ('c3000000-0000-4000-8000-000000000002', 'DEPOSIT', 'COMPLETED', 'seed-deposit-bob-001',
         '{"description": "Depósito inicial Bob"}')
    `);
    await queryRunner.query(`
      INSERT INTO "entries" ("id", "transaction_id", "account_id", "amount", "type") VALUES
        ('d4000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000002',
         'b2000000-0000-4000-8000-000000000099', 3000.00, 'DEBIT'),
        ('d4000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000002',
         'b2000000-0000-4000-8000-000000000003', 3000.00, 'CREDIT')
    `);

    // ────────────────────────────────────────────────────────────
    // Transação 3: DEPOSIT — R$1.500,00 na wallet da Carol
    // ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "type", "status", "idempotency_key", "metadata") VALUES
        ('c3000000-0000-4000-8000-000000000003', 'DEPOSIT', 'COMPLETED', 'seed-deposit-carol-001',
         '{"description": "Depósito inicial Carol"}')
    `);
    await queryRunner.query(`
      INSERT INTO "entries" ("id", "transaction_id", "account_id", "amount", "type") VALUES
        ('d4000000-0000-4000-8000-000000000005', 'c3000000-0000-4000-8000-000000000003',
         'b2000000-0000-4000-8000-000000000099', 1500.00, 'DEBIT'),
        ('d4000000-0000-4000-8000-000000000006', 'c3000000-0000-4000-8000-000000000003',
         'b2000000-0000-4000-8000-000000000004', 1500.00, 'CREDIT')
    `);

    // ────────────────────────────────────────────────────────────
    // Transação 4: TRANSFER — Alice envia R$750,00 para Bob
    // ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "type", "status", "idempotency_key", "metadata") VALUES
        ('c3000000-0000-4000-8000-000000000004', 'TRANSFER', 'COMPLETED', 'seed-transfer-alice-bob-001',
         '{"description": "Alice → Bob transferência"}')
    `);
    await queryRunner.query(`
      INSERT INTO "entries" ("id", "transaction_id", "account_id", "amount", "type") VALUES
        ('d4000000-0000-4000-8000-000000000007', 'c3000000-0000-4000-8000-000000000004',
         'b2000000-0000-4000-8000-000000000001', 750.00, 'DEBIT'),
        ('d4000000-0000-4000-8000-000000000008', 'c3000000-0000-4000-8000-000000000004',
         'b2000000-0000-4000-8000-000000000003', 750.00, 'CREDIT')
    `);

    // ────────────────────────────────────────────────────────────
    // Transação 5: TRANSFER — Alice move R$2.000,00 da wallet para savings
    // ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "type", "status", "idempotency_key", "metadata") VALUES
        ('c3000000-0000-4000-8000-000000000005', 'TRANSFER', 'COMPLETED', 'seed-transfer-alice-savings-001',
         '{"description": "Alice wallet → savings"}')
    `);
    await queryRunner.query(`
      INSERT INTO "entries" ("id", "transaction_id", "account_id", "amount", "type") VALUES
        ('d4000000-0000-4000-8000-000000000009', 'c3000000-0000-4000-8000-000000000005',
         'b2000000-0000-4000-8000-000000000001', 2000.00, 'DEBIT'),
        ('d4000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000005',
         'b2000000-0000-4000-8000-000000000002', 2000.00, 'CREDIT')
    `);

    // ────────────────────────────────────────────────────────────
    // Transação 6: WITHDRAW — Bob saca R$500,00
    // ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "type", "status", "idempotency_key", "metadata") VALUES
        ('c3000000-0000-4000-8000-000000000006', 'WITHDRAW', 'COMPLETED', 'seed-withdraw-bob-001',
         '{"description": "Saque Bob"}')
    `);
    await queryRunner.query(`
      INSERT INTO "entries" ("id", "transaction_id", "account_id", "amount", "type") VALUES
        ('d4000000-0000-4000-8000-000000000011', 'c3000000-0000-4000-8000-000000000006',
         'b2000000-0000-4000-8000-000000000003', 500.00, 'DEBIT'),
        ('d4000000-0000-4000-8000-000000000012', 'c3000000-0000-4000-8000-000000000006',
         'b2000000-0000-4000-8000-000000000099', 500.00, 'CREDIT')
    `);

    // ────────────────────────────────────────────────────────────
    // Transação 7: TRANSFER — Carol envia R$250,00 para Alice
    // ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "type", "status", "idempotency_key", "metadata") VALUES
        ('c3000000-0000-4000-8000-000000000007', 'TRANSFER', 'COMPLETED', 'seed-transfer-carol-alice-001',
         '{"description": "Carol → Alice transferência"}')
    `);
    await queryRunner.query(`
      INSERT INTO "entries" ("id", "transaction_id", "account_id", "amount", "type") VALUES
        ('d4000000-0000-4000-8000-000000000013', 'c3000000-0000-4000-8000-000000000007',
         'b2000000-0000-4000-8000-000000000004', 250.00, 'DEBIT'),
        ('d4000000-0000-4000-8000-000000000014', 'c3000000-0000-4000-8000-000000000007',
         'b2000000-0000-4000-8000-000000000001', 250.00, 'CREDIT')
    `);

    // ────────────────────────────────────────────────────────────
    // Atualiza saldos finais conforme as transações acima
    //
    // INTERNAL (ops):  -5000 -3000 -1500 +500 = -9000
    // Alice wallet:    +5000 -750 -2000 +250  =  2500
    // Alice savings:   +2000                  =  2000
    // Bob wallet:      +3000 +750 -500        =  3250
    // Carol wallet:    +1500 -250             =  1250
    // Carol savings:   0                      =     0
    // ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "account_balances" SET "balance" = -9000.00
      WHERE "account_id" = 'b2000000-0000-4000-8000-000000000099'
    `);
    await queryRunner.query(`
      UPDATE "account_balances" SET "balance" = 2500.00
      WHERE "account_id" = 'b2000000-0000-4000-8000-000000000001'
    `);
    await queryRunner.query(`
      UPDATE "account_balances" SET "balance" = 2000.00
      WHERE "account_id" = 'b2000000-0000-4000-8000-000000000002'
    `);
    await queryRunner.query(`
      UPDATE "account_balances" SET "balance" = 3250.00
      WHERE "account_id" = 'b2000000-0000-4000-8000-000000000003'
    `);
    await queryRunner.query(`
      UPDATE "account_balances" SET "balance" = 1250.00
      WHERE "account_id" = 'b2000000-0000-4000-8000-000000000004'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "entries" WHERE "transaction_id" LIKE 'c3000000-%'`,
    );
    await queryRunner.query(
      `DELETE FROM "transactions" WHERE "id" LIKE 'c3000000-%'`,
    );
    await queryRunner.query(
      `DELETE FROM "account_balances" WHERE "account_id" LIKE 'b2000000-%'`,
    );
    await queryRunner.query(
      `DELETE FROM "accounts" WHERE "id" LIKE 'b2000000-%'`,
    );
    await queryRunner.query(`DELETE FROM "users" WHERE "id" LIKE 'a1000000-%'`);
  }
}
