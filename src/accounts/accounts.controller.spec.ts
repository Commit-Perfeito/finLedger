/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { Account } from './entities/account.entity';
import { AccountType } from '../common/enums/account-type.enum';

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: jest.Mocked<AccountsService>;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            getBalance: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
    service = module.get(AccountsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an account', async () => {
      const dto: CreateAccountDto = {
        userId: '660e8400-e29b-41d4-a716-446655440000',
        type: AccountType.WALLET,
        currency: 'BRL',
      };
      service.create.mockResolvedValue(mockAccount);

      const result = await controller.create(dto);

      expect(result).toEqual(mockAccount);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all accounts', async () => {
      service.findAll.mockResolvedValue([mockAccount]);

      const result = await controller.findAll();

      expect(result).toEqual([mockAccount]);
    });
  });

  describe('findOne', () => {
    it('should return an account by id', async () => {
      service.findOne.mockResolvedValue(mockAccount);

      const result = await controller.findOne(mockAccount.id);

      expect(result).toEqual(mockAccount);
      expect(service.findOne).toHaveBeenCalledWith(mockAccount.id);
    });
  });

  describe('getBalance', () => {
    it('should return the balance for an account', async () => {
      const balanceResponse = { accountId: mockAccount.id, balance: 100.5 };
      service.getBalance.mockResolvedValue(balanceResponse);

      const result = await controller.getBalance(mockAccount.id);

      expect(result).toEqual(balanceResponse);
      expect(service.getBalance).toHaveBeenCalledWith(mockAccount.id);
    });
  });
});
