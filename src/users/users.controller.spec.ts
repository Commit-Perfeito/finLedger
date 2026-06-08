/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'João Silva',
    email: 'joao@email.com',
    createdAt: new Date(),
    accounts: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const dto: CreateUserDto = {
        name: 'João Silva',
        email: 'joao@email.com',
      };
      service.create.mockResolvedValue(mockUser);

      const result = await controller.create(dto);

      expect(result).toEqual(mockUser);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      service.findAll.mockResolvedValue([mockUser]);

      const result = await controller.findAll();

      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      service.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(service.findOne).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
