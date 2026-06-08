import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity.js';
import { Entry } from './entities/entry.entity.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionsController } from './transactions.controller.js';
import { LedgerModule } from '../ledger/ledger.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Entry]), LedgerModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
