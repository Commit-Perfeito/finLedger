import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LedgerService } from './ledger.service.js';

@ApiTags('Ledger')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  findAll() {
    return this.ledgerService.findAll();
  }

  @Get(':transactionId')
  findByTransaction(@Param('transactionId') transactionId: string) {
    return this.ledgerService.findByTransactionId(transactionId);
  }
}
