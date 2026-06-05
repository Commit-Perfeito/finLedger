import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './account.entity.js';

@Entity('account_balances')
export class AccountBalance {
  @PrimaryColumn({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  balance: number;

  @OneToOne(() => Account, (account) => account.balance)
  @JoinColumn({ name: 'account_id' })
  account: Account;
}
