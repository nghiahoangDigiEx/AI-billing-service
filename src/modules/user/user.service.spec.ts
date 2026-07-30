import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserAlreadyExistsException } from '../../common/exceptions/user-already-exists.exception';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';
import { InvalidRefreshTokenException } from '../../common/exceptions/invalid-refresh-token.exception';
import { UserNotFoundException } from '../../common/exceptions/user-not-found.exception';
import * as bcrypt from 'bcrypt';
import { Role, Provider } from '@prisma/client';
import { USER_REGISTERED } from '../../events/event.constants';

jest.mock('bcrypt');

describe('UserService', () => {
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  let service: UserService;
  let prisma: typeof mockPrismaService;
  let jwtService: typeof mockJwtService;
  let eventEmitter: typeof mockEventEmitter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates user with hashed password and emits event', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      prisma.user.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashed_password',
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'password',
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
        service.register({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(UserAlreadyExistsException);
    });
  });

  describe('login', () => {
    it('validates credentials and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashed_password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('access_token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result).toHaveProperty('accessToken', 'access_token');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws InvalidCredentialsException for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        password: 'hashed_password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('throws InvalidCredentialsException for OAuth user (no password)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', password: null });

      await expect(
        service.login({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  describe('refreshToken', () => {
    it('validates token and returns new tokens', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token_id',
        token: 'valid_token',
        expiresAt: futureDate,
        user: { id: '1' },
      });
      jwtService.signAsync.mockResolvedValue('new_access');
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.refreshToken.delete.mockResolvedValue({});

      const result = await service.refreshToken('valid_token');

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'token_id' },
      });
      expect(result).toHaveProperty('accessToken', 'new_access');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws InvalidRefreshTokenException for expired token', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token_id',
        token: 'valid_token',
        expiresAt: pastDate,
      });

      await expect(service.refreshToken('valid_token')).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });

    it('throws InvalidRefreshTokenException for non-existent token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refreshToken('invalid')).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });
  });

  describe('validateOAuthUser', () => {
    it('creates new user for first-time OAuth login', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: '1',
        email: 'test@google.com',
      });
      jwtService.signAsync.mockResolvedValue('access');

      const result = await service.validateOAuthUser({
        providerId: 'google123',
        email: 'test@google.com',
        name: 'Test',
        avatar: 'avatar.jpg',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(USER_REGISTERED, {
        userId: '1',
        email: 'test@google.com',
      });
      expect(result).toHaveProperty('accessToken');
    });

    it('updates existing user on subsequent OAuth login', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        provider: Provider.LOCAL,
      });
      prisma.user.update.mockResolvedValue({ id: '1' });
      jwtService.signAsync.mockResolvedValue('access');

      await service.validateOAuthUser({
        providerId: 'google123',
        email: 'test@google.com',
        name: 'Test',
        avatar: 'avatar.jpg',
      });

      expect(prisma.user.update).toHaveBeenCalled();
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
