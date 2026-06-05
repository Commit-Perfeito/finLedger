import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Entry } from './entry.entity.js';
import { TransactionType, TransactionStatus } from '../../common/enums/index.js';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'text', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Column({ name: 'idempotency_key', type: 'text', unique: true })
  idempotencyKey: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Entry, (entry) => entry.transaction, { cascade: true })
  entries: Entry[];
}
