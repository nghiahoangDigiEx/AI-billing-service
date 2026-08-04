import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../../user/services/user.service';
import { AppException } from '../../../common/exceptions';
import * as bcrypt from 'bcrypt';
import { Provider } from '@prisma/client';

jest.mock('bcrypt');

describe('AuthService', () => {
  const mockPrismaService = {
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockUserService = {
    createUser: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    validateOAuthUser: jest.fn(),
    updateUserProvider: jest.fn(),
  };

  let service: AuthService;
  let prisma: typeof mockPrismaService;
  let jwtService: typeof mockJwtService;
  let userService: typeof mockUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('hashes password and calls userService.createUser', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      userService.createUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password', 10);
      expect(userService.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test',
        provider: Provider.LOCAL,
      });
      expect(result).toEqual({ id: '1', email: 'test@example.com' });
    });
  });

  describe('login', () => {
    it('validates credentials and returns tokens', async () => {
      userService.findByEmailWithPassword.mockResolvedValue({
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
      userService.findByEmailWithPassword.mockResolvedValue({
        id: '1',
        password: 'hashed_password',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(AppException);
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
  });
});
