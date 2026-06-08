# FinLedger — Documentação Arquitetural C4

**FinLedger** é uma API de ledger financeiro com suporte a **partidas dobradas** (double-entry bookkeeping), construída com NestJS. O sistema garante que toda transação financeira tenha débitos e créditos balanceados, registrando um log de auditoria imutável via event sourcing.

## Índice

1. [Visão Geral](01-visao-geral.md)
2. [Nível 1 — Diagrama de Contexto](02-contexto.md)
3. [Nível 2 — Diagrama de Containers](03-containers.md)
4. [Nível 3 — Diagrama de Componentes](04-componentes.md)
5. [Modelo de Dados](05-modelo-de-dados.md)
6. [Fluxos Principais](06-fluxos-principais.md)
7. [Decisões Arquiteturais](07-decisoes-arquiteturais.md)
