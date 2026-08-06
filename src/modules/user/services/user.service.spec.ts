import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '@/modules/user/services/user.service';
import { UserUoW } from '@/modules/user/user.uow';
import { AppException } from '@/common/exceptions';
import { Role } from '@prisma/client';
import { USER_REGISTERED } from '@/events/event.constants';

describe('UserService', () => {
  const mockUserRepo = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByProviderId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  };

  const mockOutboxRepo = {
    publish: jest.fn(),
  };

  const mockUserUoW = {
    execute: jest
      .fn()
      .mockImplementation((cb: (repos: any) => Promise<any>) => {
        return cb({
          user: mockUserRepo,
          outbox: mockOutboxRepo,
        });
      }),
    readOnly: {
      user: mockUserRepo,
      outbox: mockOutboxRepo,
    },
  };

  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: UserUoW, useValue: mockUserUoW }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('creates user and emits event', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      mockUserRepo.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashed_password',
      });

      const result = await service.createUser({
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test',
      });

      expect(mockUserRepo.create).toHaveBeenCalled();
      expect(mockOutboxRepo.publish).toHaveBeenCalledWith(USER_REGISTERED, {
        userId: '1',
        email: 'test@example.com',
      });
      expect(result).toEqual({ id: '1', email: 'test@example.com' });
    });

    it('throws UserAlreadyExistsException when email exists', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: '1' });
      await expect(
        service.createUser({
          email: 'test@example.com',
          name: 'Test',
          password: 'pass',
        }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('findByEmailWithPassword', () => {
    it('returns the user including password', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ id: '1', password: 'hash' });
      const result = await service.findByEmailWithPassword('test@test.com');
      expect(result).toHaveProperty('password', 'hash');
    });
  });

  describe('getProfile', () => {
    it('returns user data excluding password and providerId', async () => {
      mockUserRepo.findById.mockResolvedValue({
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
      mockUserRepo.update.mockResolvedValue({ id: '1', name: 'New Name' });
      const result = await service.updateProfile('1', { name: 'New Name' });
      expect(result).toHaveProperty('name', 'New Name');
    });
  });

  describe('findAll', () => {
    it('returns paginated user list for admin', async () => {
      mockUserRepo.findAll.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('updateRole', () => {
    it('updates user role and returns updated user', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: '1' });
      mockUserRepo.update.mockResolvedValue({ id: '1', role: Role.ADMIN });
      const result = await service.updateRole('1', Role.ADMIN);
      expect(result).toHaveProperty('role', Role.ADMIN);
    });

    it('throws UserNotFoundException for non-existent user', async () => {
      mockUserRepo.findById.mockResolvedValue(null);
      await expect(service.updateRole('1', Role.ADMIN)).rejects.toThrow(
        AppException,
      );
    });
  });
});
