# Decisões Arquiteturais

## ADR-1: Partidas Dobradas (Double-Entry Bookkeeping)

|                  |                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- |
| **Contexto**     | Sistema financeiro exige rastreabilidade completa de movimentações monetárias         |
| **Decisão**      | Toda transação deve ter entries onde `Σ débitos = Σ créditos` (tolerância < 0.001)    |
| **Consequência** | Validação explícita em `TransactionsService.validateDoubleEntry()` antes de persistir |

## ADR-2: Idempotência

|                  |                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **Contexto**     | Operações financeiras não podem ser duplicadas por retentativas de rede                       |
| **Decisão**      | Campo `idempotency_key` único em `transactions` e `ledger_events`. Verificação antes de criar |
| **Consequência** | Retentativas seguras tanto no fluxo síncrono (API) quanto assíncrono (NATS→MongoDB)           |

## ADR-3: CQRS Parcial com Event Log

|                  |                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Contexto**     | Necessidade de log de auditoria imutável separado do banco transacional                        |
| **Decisão**      | PostgreSQL para escrita/leitura OLTP; MongoDB para log de auditoria via eventos NATS           |
| **Consequência** | Consistência eventual no log de auditoria. Retry com backoff (3 tentativas) no `LedgerService` |

## ADR-4: Atualização Atômica de Saldos

|                  |                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- |
| **Contexto**     | Saldos devem ser consistentes com os lançamentos                                      |
| **Decisão**      | Atualização de `account_balances` dentro da mesma transação de banco que cria entries |
| **Consequência** | Saldo sempre consistente. Update via `balance + delta` evita race conditions          |

## ADR-5: Separação de Datastores

|                  |                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------- |
| **Contexto**     | Dados transacionais exigem ACID; log de auditoria exige schema flexível e alta escrita |
| **Decisão**      | PostgreSQL para domínio transacional, MongoDB para event store                         |
| **Consequência** | Complexidade operacional de dois bancos, compensada por melhor adequação de cada store |
