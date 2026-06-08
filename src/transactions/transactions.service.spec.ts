/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import { Entry } from './entities/entry.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionType, TransactionStatus, EntryType } from '../common/enums';
import { NatsClientService } from '../ledger/nats-client.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionsRepository: jest.Mocked<Repository<Transaction>>;
  let dataSource: jest.Mocked<DataSource>;
  let natsClient: jest.Mocked<NatsClientService>;

  const mockEntries: Entry[] = [
    {
      id: 'entry-1',
      transactionId: 'tx-1',
      accountId: 'acc-1',
      amount: 100,
      type: EntryType.DEBIT,
      createdAt: new Date(),
      transaction: null,
      account: null,
    },
    {
      id: 'entry-2',
      transactionId: 'tx-1',
      accountId: 'acc-2',
      amount: 100,
      type: EntryType.CREDIT,
      createdAt: new Date(),
      transaction: null,
      account: null,
    },
  ];

  const mockTransaction: Transaction = {
    id: 'tx-1',
    type: TransactionType.TRANSFER,
    status: TransactionStatus.COMPLETED,
    idempotencyKey: 'txn-abc-123',
    metadata: { description: 'Test' },
    createdAt: new Date(),
    entries: mockEntries,
  };

  const validDto: CreateTransactionDto = {
    type: TransactionType.TRANSFER,
    idempotencyKey: 'txn-abc-123',
    metadata: { description: 'Test' },
    entries: [
      { accountId: 'acc-1', amount: 100, type: EntryType.DEBIT },
      { accountId: 'acc-2', amount: 100, type: EntryType.CREDIT },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
        {
          provide: NatsClientService,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    transactionsRepository = module.get(getRepositoryToken(Transaction));
    dataSource = module.get(DataSource);
    natsClient = module.get(NatsClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should return existing transaction for idempotent key', async () => {
      transactionsRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.create(validDto);

      expect(result).toEqual(mockTransaction);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(natsClient.emit).not.toHaveBeenCalled();
    });

    it('should create a new transaction with double-entry bookkeeping', async () => {
      transactionsRepository.findOne.mockResolvedValue(null);

      const savedTx = { ...mockTransaction, status: TransactionStatus.PENDING };
      const mockManager = {
        create: jest.fn(),
        save: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({}),
        }),
      };

      mockManager.create
        .mockReturnValueOnce(savedTx)
        .mockReturnValueOnce(mockEntries[0])
        .mockReturnValueOnce(mockEntries[1]);

      mockManager.save
        .mockResolvedValueOnce({ ...savedTx, id: 'tx-1' })
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce({
          ...savedTx,
          id: 'tx-1',
          status: TransactionStatus.COMPLETED,
        });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const result = await cb(mockManager);
        return result;
      });

      const result = await service.create(validDto);

      expect(result).toBeDefined();
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(natsClient.emit).toHaveBeenCalledWith(
        'transaction.completed',
        expect.objectContaining({
          transactionId: 'tx-1',
          type: TransactionType.TRANSFER,
        }),
      );
    });

    it('should throw BadRequestException when debits do not equal credits', async () => {
      transactionsRepository.findOne.mockResolvedValue(null);

      const invalidDto: CreateTransactionDto = {
        type: TransactionType.TRANSFER,
        idempotencyKey: 'txn-invalid',
        entries: [
          { accountId: 'acc-1', amount: 100, type: EntryType.DEBIT },
          { accountId: 'acc-2', amount: 50, type: EntryType.CREDIT },
        ],
      };

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(invalidDto)).rejects.toThrow(
        'Double-entry violation',
      );
    });

    it('should pass validation when debits equal credits within tolerance', async () => {
      transactionsRepository.findOne.mockResolvedValue(null);

      const dtoWithSmallDiff: CreateTransactionDto = {
        type: TransactionType.TRANSFER,
        idempotencyKey: 'txn-tolerance',
        entries: [
          { accountId: 'acc-1', amount: 100.001, type: EntryType.DEBIT },
          { accountId: 'acc-2', amount: 100.001, type: EntryType.CREDIT },
        ],
      };

      const savedTx = {
        ...mockTransaction,
        idempotencyKey: 'txn-tolerance',
        status: TransactionStatus.PENDING,
      };
      const mockManager = {
        create: jest.fn().mockReturnValue(savedTx),
        save: jest.fn().mockResolvedValue({ ...savedTx, id: 'tx-1' }),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({}),
        }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      await expect(service.create(dtoWithSmallDiff)).resolves.toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all transactions with entries', async () => {
      transactionsRepository.find.mockResolvedValue([mockTransaction]);

      const result = await service.findAll();

      expect(result).toEqual([mockTransaction]);
      expect(transactionsRepository.find).toHaveBeenCalledWith({
        relations: { entries: true },
      });
    });

    it('should return empty array when no transactions exist', async () => {
      transactionsRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', async () => {
      transactionsRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findOne('tx-1');

      expect(result).toEqual(mockTransaction);
      expect(transactionsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        relations: { entries: true },
      });
    });

    it('should throw BadRequestException when transaction not found', async () => {
      transactionsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Transaction nonexistent not found',
      );
    });
  });
});
