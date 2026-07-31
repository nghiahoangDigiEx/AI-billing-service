import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService, UserWithoutPassword } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Provider, User } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';
import { InvalidRefreshTokenException } from '../../common/exceptions/invalid-refresh-token.exception';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto): Promise<UserWithoutPassword> {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    return this.userService.createUser({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
      provider: Provider.LOCAL,
    });
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userService.findByEmailWithPassword(loginDto.email);

    if (!user || !user.password) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async refreshToken(
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new InvalidRefreshTokenException();
    }

    const user = storedToken.user;
    const newAccessToken = await this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async validateOAuthUser(profile: {
    providerId: string;
    email: string;
    name: string;
    avatar?: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ providerId: profile.providerId }, { email: profile.email }],
      },
    });

    if (!user) {
      user = (await this.userService.createUser({
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        provider: Provider.GOOGLE,
        providerId: profile.providerId,
      })) as User;
    } else {
      user = (await this.userService.updateUserProvider(user.id, {
        name: profile.name,
        avatar: profile.avatar,
        providerId: profile.providerId,
        provider:
          user.provider === Provider.LOCAL ? Provider.GOOGLE : user.provider,
      })) as User;
    }

    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  private async generateAccessToken(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<string> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = randomUUID();
    const expiresInDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }
}
