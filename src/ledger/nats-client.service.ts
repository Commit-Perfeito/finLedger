import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection, JSONCodec, Codec } from 'nats';

@Injectable()
export class NatsClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsClientService.name);
  private connection: NatsConnection;
  private readonly codec = JSONCodec();
  private connectPromise: Promise<void>;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>(
      'NATS_URL',
      'nats://localhost:4222',
    );
    this.connectPromise = connect({ servers: url }).then((conn) => {
      this.connection = conn;
      this.logger.log(`Connected to NATS at ${url}`);
    });
    await this.connectPromise;
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.drain();
      this.logger.log('NATS connection drained');
    }
  }

  emit(subject: string, data: unknown): void {
    this.connection.publish(subject, this.codec.encode(data));
    this.logger.debug(`Published to ${subject}`);
  }

  async ensureConnected(): Promise<void> {
    await this.connectPromise;
  }

  getConnection(): NatsConnection {
    return this.connection;
  }

  getCodec(): Codec<unknown> {
    return this.codec;
  }
}
