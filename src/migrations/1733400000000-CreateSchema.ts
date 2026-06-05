import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchema1733400000000 implements MigrationInterface {
  name = 'CreateSchema1733400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "email" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" text NOT NULL,
        "currency" text NOT NULL DEFAULT 'BRL',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_accounts_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" text NOT NULL,
        "status" text NOT NULL DEFAULT 'PENDING',
        "idempotency_key" text NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_transactions_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transaction_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "type" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_entries_transaction" FOREIGN KEY ("transaction_id")
          REFERENCES "transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_entries_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "account_balances" (
        "account_id" uuid NOT NULL,
        "balance" numeric(18,2) NOT NULL DEFAULT 0,
        CONSTRAINT "PK_account_balances" PRIMARY KEY ("account_id"),
        CONSTRAINT "FK_account_balances_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_accounts_user_id" ON "accounts" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_entries_transaction_id" ON "entries" ("transaction_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_entries_account_id" ON "entries" ("account_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_entries_account_id"`);
    await queryRunner.query(`DROP INDEX "IDX_entries_transaction_id"`);
    await queryRunner.query(`DROP INDEX "IDX_accounts_user_id"`);
    await queryRunner.query(`DROP TABLE "account_balances"`);
    await queryRunner.query(`DROP TABLE "entries"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
