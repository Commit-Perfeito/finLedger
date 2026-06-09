import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transaction } from './entities/transaction.entity.js';
import { Entry } from './entities/entry.entity.js';
import { AccountBalance } from '../accounts/entities/account-balance.entity.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { EntryType, TransactionStatus } from '../common/enums/index.js';
import { NatsClientService } from '../ledger/nats-client.service.js';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly natsClient: NatsClientService,
  ) {}

  private validateDoubleEntry(dto: CreateTransactionDto): void {
    const totalDebits = dto.entries
      .filter((e) => e.type === EntryType.DEBIT)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCredits = dto.entries
      .filter((e) => e.type === EntryType.CREDIT)
      .reduce((sum, e) => sum + e.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new BadRequestException(
        `Double-entry violation: debits (${totalDebits}) must equal credits (${totalCredits})`,
      );
    }
  }

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    const existing = await this.transactionsRepository.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
      relations: { entries: true },
    });

    if (existing) {
      this.logger.log(`Idempotent hit for key: ${dto.idempotencyKey}`);
      return existing;
    }

    this.validateDoubleEntry(dto);

    const transaction = await this.dataSource.transaction(async (manager) => {
      const tx = manager.create(Transaction, {
        type: dto.type,
        idempotencyKey: dto.idempotencyKey,
        metadata: dto.metadata,
        status: TransactionStatus.PENDING,
      });
      const savedTx = await manager.save(tx);

      const entries = dto.entries.map((e) =>
        manager.create(Entry, {
          transactionId: savedTx.id,
          accountId: e.accountId,
          amount: e.amount,
          type: e.type,
        }),
      );
      await manager.save(entries);

      for (const entry of dto.entries) {
        const delta =
          entry.type === EntryType.DEBIT ? -entry.amount : entry.amount;
        await manager
          .createQueryBuilder()
          .update(AccountBalance)
          .set({ balance: () => `balance + ${delta}` })
          .where('account_id = :accountId', { accountId: entry.accountId })
          .execute();
      }

      savedTx.status = TransactionStatus.COMPLETED;
      await manager.save(savedTx);

      savedTx.entries = entries;
      return savedTx;
    });

    this.natsClient.emit('transaction.completed', {
      transactionId: transaction.id,
      type: transaction.type,
      status: transaction.status,
      idempotencyKey: transaction.idempotencyKey,
      metadata: transaction.metadata,
      entries: transaction.entries.map((e) => ({
        accountId: e.accountId,
        amount: Number(e.amount),
        type: e.type,
      })),
      completedAt: new Date().toISOString(),
    });

    return transaction;
  }

  async findAll(): Promise<Transaction[]> {
    return this.transactionsRepository.find({ relations: { entries: true } });
  }

  async findOne(id: string): Promise<Transaction> {
    const tx = await this.transactionsRepository.findOne({
      where: { id },
      relations: { entries: true },
    });
    if (!tx) {
      throw new BadRequestException(`Transaction ${id} not found`);
    }
    return tx;
  }
}
