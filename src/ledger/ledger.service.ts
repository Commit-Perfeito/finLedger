/* eslint-disable @typescript-eslint/no-base-to-string */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LedgerEvent,
  LedgerEventDocument,
} from './schemas/ledger-event.schema.js';
import { NatsClientService } from './nats-client.service.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

@Injectable()
export class LedgerService implements OnModuleInit {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectModel(LedgerEvent.name)
    private readonly ledgerEventModel: Model<LedgerEventDocument>,
    private readonly natsClient: NatsClientService,
  ) {}

  async onModuleInit() {
    await this.subscribeToTransactions();
  }

  private async subscribeToTransactions(): Promise<void> {
    await this.natsClient.ensureConnected();
    const connection = this.natsClient.getConnection();
    const codec = this.natsClient.getCodec();
    const subscription = connection.subscribe('transaction.completed');

    this.logger.log('Subscribed to transaction.completed');

    for await (const msg of subscription) {
      const data = codec.decode(msg.data) as Record<string, unknown>;
      await this.processWithRetry(data);
    }
  }

  private async processWithRetry(
    data: Record<string, unknown>,
    attempt = 1,
  ): Promise<void> {
    try {
      await this.recordEvent(data);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        this.logger.warn(
          `Retry ${attempt}/${MAX_RETRIES} for tx ${String(data['transactionId'])}`,
        );
        await this.delay(RETRY_DELAY_MS * attempt);
        return this.processWithRetry(data, attempt + 1);
      }
      this.logger.error(
        `Failed to record ledger event after ${MAX_RETRIES} retries: ${(error as Error).message}`,
      );
    }
  }

  private async recordEvent(data: Record<string, unknown>): Promise<void> {
    const existing = await this.ledgerEventModel.findOne({
      idempotencyKey: data['idempotencyKey'],
    });

    if (existing) {
      this.logger.debug(
        `Ledger event already recorded for key: ${String(data['idempotencyKey'])}`,
      );
      return;
    }

    await this.ledgerEventModel.create({
      transactionId: data['transactionId'] as string,
      type: data['type'] as string,
      status: data['status'] as string,
      idempotencyKey: data['idempotencyKey'] as string,
      metadata: data['metadata'] as Record<string, unknown>,
      entries: data['entries'] as Array<{
        accountId: string;
        amount: number;
        type: string;
      }>,
      processedAt: new Date(),
    });

    this.logger.log(
      `Ledger event recorded for tx: ${String(data['transactionId'])}`,
    );
  }

  async findAll(): Promise<LedgerEventDocument[]> {
    return this.ledgerEventModel.find().sort({ processedAt: -1 }).exec();
  }

  async findByTransactionId(
    transactionId: string,
  ): Promise<LedgerEventDocument | null> {
    return this.ledgerEventModel.findOne({ transactionId }).exec();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
