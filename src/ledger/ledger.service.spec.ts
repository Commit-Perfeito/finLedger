/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LedgerService } from './ledger.service';
import { LedgerEvent } from './schemas/ledger-event.schema';
import { NatsClientService } from './nats-client.service';

describe('LedgerService', () => {
  let service: LedgerService;
  let ledgerEventModel: any;

  const mockLedgerEvent = {
    transactionId: 'tx-1',
    type: 'TRANSFER',
    status: 'COMPLETED',
    idempotencyKey: 'txn-abc-123',
    metadata: { description: 'Test' },
    entries: [
      { accountId: 'acc-1', amount: 100, type: 'DEBIT' },
      { accountId: 'acc-2', amount: 100, type: 'CREDIT' },
    ],
    processedAt: new Date(),
  };

  beforeEach(async () => {
    ledgerEventModel = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockLedgerEvent]),
        }),
      }),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: getModelToken(LedgerEvent.name),
          useValue: ledgerEventModel,
        },
        {
          provide: NatsClientService,
          useValue: {
            ensureConnected: jest.fn().mockResolvedValue(undefined),
            getConnection: jest.fn().mockReturnValue({
              subscribe: jest.fn().mockReturnValue({
                [Symbol.asyncIterator]: () => ({
                  next: jest.fn().mockResolvedValue({ done: true }),
                }),
              }),
            }),
            getCodec: jest.fn().mockReturnValue({
              decode: jest.fn(),
            }),
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all ledger events sorted by processedAt descending', async () => {
      const result = await service.findAll();

      expect(result).toEqual([mockLedgerEvent]);
      expect(ledgerEventModel.find).toHaveBeenCalled();
    });
  });

  describe('findByTransactionId', () => {
    it('should return a ledger event by transactionId', async () => {
      ledgerEventModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockLedgerEvent),
      });

      const result = await service.findByTransactionId('tx-1');

      expect(result).toEqual(mockLedgerEvent);
      expect(ledgerEventModel.findOne).toHaveBeenCalledWith({
        transactionId: 'tx-1',
      });
    });

    it('should return null when event not found', async () => {
      ledgerEventModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findByTransactionId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('recordEvent (via processWithRetry)', () => {
    it('should skip recording when event already exists', async () => {
      ledgerEventModel.findOne.mockResolvedValue(mockLedgerEvent);

      // Access private method via bracket notation for testing
      await (service as any).recordEvent({
        idempotencyKey: 'txn-abc-123',
        transactionId: 'tx-1',
      });

      expect(ledgerEventModel.create).not.toHaveBeenCalled();
    });

    it('should create a new ledger event when not existing', async () => {
      ledgerEventModel.findOne.mockResolvedValue(null);
      ledgerEventModel.create.mockResolvedValue(mockLedgerEvent);

      const data = {
        transactionId: 'tx-1',
        type: 'TRANSFER',
        status: 'COMPLETED',
        idempotencyKey: 'txn-new',
        metadata: { description: 'Test' },
        entries: [{ accountId: 'acc-1', amount: 100, type: 'DEBIT' }],
      };

      await (service as any).recordEvent(data);

      expect(ledgerEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-1',
          type: 'TRANSFER',
          status: 'COMPLETED',
          idempotencyKey: 'txn-new',
        }),
      );
    });
  });

  describe('processWithRetry', () => {
    it('should retry on failure up to MAX_RETRIES', async () => {
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'recordEvent')
        .mockRejectedValueOnce(new Error('DB error'))
        .mockRejectedValueOnce(new Error('DB error'))
        .mockRejectedValueOnce(new Error('DB error'));

      await (service as any).processWithRetry({ transactionId: 'tx-1' });

      expect((service as any).recordEvent).toHaveBeenCalledTimes(3);
    });

    it('should succeed on retry', async () => {
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'recordEvent')
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);

      await (service as any).processWithRetry({ transactionId: 'tx-1' });

      expect((service as any).recordEvent).toHaveBeenCalledTimes(2);
    });
  });
});
