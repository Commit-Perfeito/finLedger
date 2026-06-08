/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { AccountsService } from './accounts.service';
import { Account } from './entities/account.entity';
import { AccountBalance } from './entities/account-balance.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountType } from '../common/enums/account-type.enum';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountsRepository: jest.Mocked<Repository<Account>>;
  let balancesRepository: jest.Mocked<Repository<AccountBalance>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockAccount: Account = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '660e8400-e29b-41d4-a716-446655440000',
    type: AccountType.WALLET,
    currency: 'BRL',
    createdAt: new Date(),
    user: null,
    entries: [],
    balance: null,
  };

  const mockBalance: AccountBalance = {
    accountId: mockAccount.id,
    balance: 100.5,
    account: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AccountBalance),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    accountsRepository = module.get(getRepositoryToken(Account));
    balancesRepository = module.get(getRepositoryToken(AccountBalance));
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateAccountDto = {
      userId: '660e8400-e29b-41d4-a716-446655440000',
      type: AccountType.WALLET,
      currency: 'BRL',
    };

    it('should create an account with balance in a transaction', async () => {
      const mockManager = {
        create: jest.fn(),
        save: jest.fn(),
      };
      mockManager.create
        .mockReturnValueOnce(mockAccount)
        .mockReturnValueOnce(mockBalance);
      mockManager.save
        .mockResolvedValueOnce(mockAccount)
        .mockResolvedValueOnce(mockBalance);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(mockManager);
      });

      const result = await service.create(dto);

      expect(result).toEqual(mockAccount);
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockManager.create).toHaveBeenCalledTimes(2);
      expect(mockManager.create).toHaveBeenCalledWith(Account, dto);
      expect(mockManager.create).toHaveBeenCalledWith(AccountBalance, {
        accountId: mockAccount.id,
        balance: 0,
      });
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('should return all accounts with balance relation', async () => {
      accountsRepository.find.mockResolvedValue([mockAccount]);

      const result = await service.findAll();

      expect(result).toEqual([mockAccount]);
      expect(accountsRepository.find).toHaveBeenCalledWith({
        relations: { balance: true },
      });
    });

    it('should return empty array when no accounts exist', async () => {
      accountsRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return an account by id', async () => {
      accountsRepository.findOne.mockResolvedValue(mockAccount);

      const result = await service.findOne(mockAccount.id);

      expect(result).toEqual(mockAccount);
      expect(accountsRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        relations: { balance: true },
      });
    });

    it('should throw NotFoundException when account not found', async () => {
      accountsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        'Account nonexistent-id not found',
      );
    });
  });

  describe('getBalance', () => {
    it('should return the balance for an account', async () => {
      balancesRepository.findOne.mockResolvedValue(mockBalance);

      const result = await service.getBalance(mockAccount.id);

      expect(result).toEqual({
        accountId: mockAccount.id,
        balance: 100.5,
      });
      expect(balancesRepository.findOne).toHaveBeenCalledWith({
        where: { accountId: mockAccount.id },
      });
    });

    it('should throw NotFoundException when balance not found', async () => {
      balancesRepository.findOne.mockResolvedValue(null);

      await expect(service.getBalance('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getBalance('nonexistent-id')).rejects.toThrow(
        'Balance for account nonexistent-id not found',
      );
    });
  });
});
