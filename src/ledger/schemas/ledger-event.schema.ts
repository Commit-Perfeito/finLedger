import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LedgerEventDocument = HydratedDocument<LedgerEvent>;

@Schema({ collection: 'ledger_events', timestamps: true })
export class LedgerEvent {
  @Prop({ required: true, index: true })
  transactionId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  status: string;

  @Prop({ required: true, unique: true })
  idempotencyKey: string;

  @Prop({ type: Object })
  metadata: Record<string, unknown>;

  @Prop({
    type: [
      {
        accountId: String,
        amount: Number,
        type: String,
      },
    ],
    required: true,
  })
  entries: Array<{
    accountId: string;
    amount: number;
    type: string;
  }>;

  @Prop()
  processedAt: Date;
}

export const LedgerEventSchema = SchemaFactory.createForClass(LedgerEvent);
