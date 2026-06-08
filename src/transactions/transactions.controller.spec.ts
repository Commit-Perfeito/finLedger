/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Transaction } from './entities/transaction.entity';
import { TransactionType, TransactionStatus, EntryType } from '../common/enums';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: jest.Mocked<TransactionsService>;

  const mockTransaction: Transaction = {
    id: 'tx-1',
    type: TransactionType.TRANSFER,
    status: TransactionStatus.COMPLETED,
    idempotencyKey: 'txn-abc-123',
    metadata: { description: 'Test' },
    createdAt: new Date(),
    entries: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get(TransactionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a transaction', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionType.TRANSFER,
        idempotencyKey: 'txn-abc-123',
        entries: [
          { accountId: 'acc-1', amount: 100, type: EntryType.DEBIT },
          { accountId: 'acc-2', amount: 100, type: EntryType.CREDIT },
        ],
      };
      service.create.mockResolvedValue(mockTransaction);

      const result = await controller.create(dto);

      expect(result).toEqual(mockTransaction);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all transactions', async () => {
      service.findAll.mockResolvedValue([mockTransaction]);

      const result = await controller.findAll();

      expect(result).toEqual([mockTransaction]);
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', async () => {
      service.findOne.mockResolvedValue(mockTransaction);

      const result = await controller.findOne('tx-1');

      expect(result).toEqual(mockTransaction);
      expect(service.findOne).toHaveBeenCalledWith('tx-1');
    });
  });
});
