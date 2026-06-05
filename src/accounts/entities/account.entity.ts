import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Entry } from '../../transactions/entities/entry.entity.js';
import { AccountBalance } from './account-balance.entity.js';
import { AccountType } from '../../common/enums/index.js';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text', enum: AccountType })
  type: AccountType;

  @Column({ type: 'text', default: 'BRL' })
  currency: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.accounts)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Entry, (entry) => entry.account)
  entries: Entry[];

  @OneToOne(() => AccountBalance, (balance) => balance.account)
  balance: AccountBalance;
}
