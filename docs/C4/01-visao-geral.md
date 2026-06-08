# Visão Geral

**FinLedger** é uma API de ledger financeiro com suporte a **partidas dobradas** (double-entry bookkeeping), construída com NestJS. O sistema garante que toda transação financeira tenha débitos e créditos balanceados, registrando um log de auditoria imutável via event sourcing.

| Aspecto           | Detalhe                       |
| ----------------- | ----------------------------- |
| **Linguagem**     | TypeScript 5.x                |
| **Framework**     | NestJS 11                     |
| **Banco OLTP**    | PostgreSQL 16                 |
| **Banco de Logs** | MongoDB 7                     |
| **Mensageria**    | NATS 2                        |
| **API Docs**      | Swagger/OpenAPI (`/api/docs`) |
| **Prefixo API**   | `/api`                        |

---

## Estrutura de Módulos

```
src/
├── main.ts                          # Bootstrap: ValidationPipe, AllExceptionsFilter, Swagger, prefix /api
├── app.module.ts                    # Root module: ConfigModule, TypeORM, Mongoose + domain modules
├── data-source.ts                   # DataSource para CLI de migrations
│
├── common/
│   ├── enums/                       # AccountType, EntryType, TransactionType, TransactionStatus
│   └── filters/
│       └── all-exceptions.filter.ts # Filtro global de exceções (padroniza resposta de erro)
│
├── users/
│   ├── users.module.ts              # TypeORM: User
│   ├── users.controller.ts          # POST, GET, GET/:id
│   ├── users.service.ts             # create (unique email), findAll, findOne
│   ├── dto/create-user.dto.ts       # name, email (validação)
│   └── entities/user.entity.ts      # id, name, email, createdAt, accounts[]
│
├── accounts/
│   ├── accounts.module.ts           # TypeORM: Account, AccountBalance
│   ├── accounts.controller.ts       # POST, GET, GET/:id, GET/:id/balance
│   ├── accounts.service.ts          # create (atomic + balance), findAll, findOne, getBalance
│   ├── dto/create-account.dto.ts    # userId, type, currency
│   └── entities/
│       ├── account.entity.ts        # id, userId, type, currency, createdAt
│       └── account-balance.entity.ts # accountId, balance
│
├── transactions/
│   ├── transactions.module.ts       # TypeORM: Transaction, Entry + imports LedgerModule
│   ├── transactions.controller.ts   # POST, GET, GET/:id
│   ├── transactions.service.ts      # create (double-entry + idempotency + NATS emit), findAll, findOne
│   ├── dto/create-transaction.dto.ts # type, idempotencyKey, metadata, entries[]
│   └── entities/
│       ├── transaction.entity.ts    # id, type, status, idempotencyKey, metadata, createdAt
│       └── entry.entity.ts          # id, transactionId, accountId, amount, type, createdAt
│
├── ledger/
│   ├── ledger.module.ts             # Mongoose: LedgerEvent + providers: NatsClientService, LedgerService
│   ├── ledger.controller.ts         # GET, GET/:transactionId
│   ├── ledger.service.ts            # subscribe NATS, processWithRetry, recordEvent (idempotent), findAll, findByTransactionId
│   ├── nats-client.service.ts       # connect, emit, subscribe, drain
│   └── schemas/
│       └── ledger-event.schema.ts   # transactionId, type, status, idempotencyKey, metadata, entries[], processedAt
│
└── migrations/
    └── 1733400000000-CreateSchema.ts # DDL: users, accounts, transactions, entries, account_balances + indexes
```

---

## Endpoints da API

| Método | Rota                         | Descrição                           | Módulo       |
| ------ | ---------------------------- | ----------------------------------- | ------------ |
| GET    | `/api`                       | Health check                        | App          |
| POST   | `/api/users`                 | Criar usuário                       | Users        |
| GET    | `/api/users`                 | Listar usuários                     | Users        |
| GET    | `/api/users/:id`             | Buscar usuário por ID               | Users        |
| POST   | `/api/accounts`              | Criar conta (+ saldo zero)          | Accounts     |
| GET    | `/api/accounts`              | Listar contas                       | Accounts     |
| GET    | `/api/accounts/:id`          | Buscar conta por ID                 | Accounts     |
| GET    | `/api/accounts/:id/balance`  | Consultar saldo da conta            | Accounts     |
| POST   | `/api/transactions`          | Criar transação (partidas dobradas) | Transactions |
| GET    | `/api/transactions`          | Listar transações                   | Transactions |
| GET    | `/api/transactions/:id`      | Buscar transação por ID             | Transactions |
| GET    | `/api/ledger`                | Listar eventos de auditoria         | Ledger       |
| GET    | `/api/ledger/:transactionId` | Buscar evento por transactionId     | Ledger       |

---

## Infraestrutura (Docker Compose)

| Serviço    | Imagem               | Porta      | Volume      |
| ---------- | -------------------- | ---------- | ----------- |
| PostgreSQL | `postgres:16-alpine` | 5432       | `pgdata`    |
| MongoDB    | `mongo:7`            | 27017      | `mongodata` |
| NATS       | `nats:2-alpine`      | 4222, 8222 | —           |
