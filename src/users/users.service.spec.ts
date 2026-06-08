/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'João Silva',
    email: 'joao@email.com',
    createdAt: new Date(),
    accounts: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateUserDto = { name: 'João Silva', email: 'joao@email.com' };

    it('should create a user successfully', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUser);
      repository.save.mockResolvedValue(mockUser);

      const result = await service.create(dto);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(mockUser);
    });

    it('should throw ConflictException when email already exists', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(
        'Email already registered',
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      repository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toEqual([mockUser]);
      expect(repository.find).toHaveBeenCalled();
    });

    it('should return an empty array when no users exist', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: { accounts: true },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        'User nonexistent-id not found',
      );
    });
  });
});
