import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserAlreadyExistsException } from '../../common/exceptions/user-already-exists.exception';
import { UserNotFoundException } from '../../common/exceptions/user-not-found.exception';
import { Role } from '@prisma/client';
import { USER_REGISTERED } from '../../events/event.constants';

describe('UserService', () => {
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  let service: UserService;
  let prisma: typeof mockPrismaService;
  let eventEmitter: typeof mockEventEmitter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('creates user and emits event', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      prisma.user.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashed_password',
      });

      const result = await service.createUser({
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(USER_REGISTERED, {
        userId: '1',
        email: 'test@example.com',
      });
      expect(result).toEqual({ id: '1', email: 'test@example.com' });
    });

    it('throws UserAlreadyExistsException when email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' });
      await expect(
        service.createUser({
          email: 'test@example.com',
          name: 'Test',
          password: 'pass',
        }),
      ).rejects.toThrow(UserAlreadyExistsException);
    });
  });

  describe('findByEmailWithPassword', () => {
    it('returns the user including password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', password: 'hash' });
      const result = await service.findByEmailWithPassword('test@test.com');
      expect(result).toHaveProperty('password', 'hash');
    });
  });

  describe('getProfile', () => {
    it('returns user data excluding password and providerId', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'pass',
        providerId: '123',
      });

      const result = await service.getProfile('1');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('providerId');
      expect(result).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('updateProfile', () => {
    it('updates name and avatar fields', async () => {
      prisma.user.update.mockResolvedValue({ id: '1', name: 'New Name' });
      const result = await service.updateProfile('1', { name: 'New Name' });
      expect(result).toHaveProperty('name', 'New Name');
    });
  });

  describe('findAll', () => {
    it('returns paginated user list for admin', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('updateRole', () => {
    it('updates user role and returns updated user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' });
      prisma.user.update.mockResolvedValue({ id: '1', role: Role.ADMIN });
      const result = await service.updateRole('1', Role.ADMIN);
      expect(result).toHaveProperty('role', Role.ADMIN);
    });

    it('throws UserNotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateRole('1', Role.ADMIN)).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });
});
