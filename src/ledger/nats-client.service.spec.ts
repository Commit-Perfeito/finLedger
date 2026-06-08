/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NatsClientService } from './nats-client.service';

// Mock the nats module
jest.mock('nats', () => ({
  connect: jest.fn(),
  JSONCodec: jest.fn().mockReturnValue({
    encode: jest.fn((data) => Buffer.from(JSON.stringify(data))),
    decode: jest.fn((data) => JSON.parse(data.toString())),
  }),
}));

import { connect } from 'nats';

describe('NatsClientService', () => {
  let service: NatsClientService;
  const mockConnection = {
    publish: jest.fn(),
    drain: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  };

  beforeEach(async () => {
    (connect as jest.Mock).mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NatsClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('nats://localhost:4222'),
          },
        },
      ],
    }).compile();

    service = module.get<NatsClientService>(NatsClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to NATS', async () => {
      await service.onModuleInit();

      expect(connect).toHaveBeenCalledWith({
        servers: 'nats://localhost:4222',
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should drain the NATS connection', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockConnection.drain).toHaveBeenCalled();
    });

    it('should handle missing connection gracefully', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('emit', () => {
    it('should publish message to a subject', async () => {
      await service.onModuleInit();

      service.emit('test.subject', { key: 'value' });

      expect(mockConnection.publish).toHaveBeenCalledWith(
        'test.subject',
        expect.anything(),
      );
    });
  });

  describe('ensureConnected', () => {
    it('should wait for the connection to be established', async () => {
      await service.onModuleInit();

      await expect(service.ensureConnected()).resolves.not.toThrow();
    });
  });

  describe('getConnection', () => {
    it('should return the NATS connection', async () => {
      await service.onModuleInit();

      expect(service.getConnection()).toBe(mockConnection);
    });
  });

  describe('getCodec', () => {
    it('should return the JSON codec', () => {
      const codec = service.getCodec();

      expect(codec).toBeDefined();
      expect(codec.encode).toBeDefined();
      expect(codec.decode).toBeDefined();
    });
  });
});
