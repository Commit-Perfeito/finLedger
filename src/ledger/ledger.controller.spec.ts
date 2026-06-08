/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

describe('LedgerController', () => {
  let controller: LedgerController;
  let service: jest.Mocked<LedgerService>;

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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LedgerController],
      providers: [
        {
          provide: LedgerService,
          useValue: {
            findAll: jest.fn(),
            findByTransactionId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LedgerController>(LedgerController);
    service = module.get(LedgerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all ledger events', async () => {
      service.findAll.mockResolvedValue([mockLedgerEvent] as any);

      const result = await controller.findAll();

      expect(result).toEqual([mockLedgerEvent]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findByTransaction', () => {
    it('should return a ledger event by transactionId', async () => {
      service.findByTransactionId.mockResolvedValue(mockLedgerEvent as any);

      const result = await controller.findByTransaction('tx-1');

      expect(result).toEqual(mockLedgerEvent);
      expect(service.findByTransactionId).toHaveBeenCalledWith('tx-1');
    });

    it('should return null when no event found', async () => {
      service.findByTransactionId.mockResolvedValue(null);

      const result = await controller.findByTransaction('nonexistent');

      expect(result).toBeNull();
    });
  });
});
