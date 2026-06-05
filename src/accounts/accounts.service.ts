import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account } from './entities/account.entity.js';
import { AccountBalance } from './entities/account-balance.entity.js';
import { CreateAccountDto } from './dto/create-account.dto.js';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(AccountBalance)
    private readonly balancesRepository: Repository<AccountBalance>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateAccountDto): Promise<Account> {
    return this.dataSource.transaction(async (manager) => {
      const account = manager.create(Account, dto);
      const savedAccount = await manager.save(account);

      const balance = manager.create(AccountBalance, {
        accountId: savedAccount.id,
        balance: 0,
      });
      await manager.save(balance);

      return savedAccount;
    });
  }

  async findAll(): Promise<Account[]> {
    return this.accountsRepository.find({ relations: { balance: true } });
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accountsRepository.findOne({
      where: { id },
      relations: { balance: true },
    });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return account;
  }

  async getBalance(id: string): Promise<{ accountId: string; balance: number }> {
    const balance = await this.balancesRepository.findOne({
      where: { accountId: id },
    });
    if (!balance) {
      throw new NotFoundException(`Balance for account ${id} not found`);
    }
    return { accountId: balance.accountId, balance: Number(balance.balance) };
  }
}
