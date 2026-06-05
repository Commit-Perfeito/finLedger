import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerEvent, LedgerEventSchema } from './schemas/ledger-event.schema.js';
import { LedgerService } from './ledger.service.js';
import { LedgerController } from './ledger.controller.js';
import { NatsClientService } from './nats-client.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LedgerEvent.name, schema: LedgerEventSchema },
    ]),
  ],
  controllers: [LedgerController],
  providers: [NatsClientService, LedgerService],
  exports: [NatsClientService],
})
export class LedgerModule {}
