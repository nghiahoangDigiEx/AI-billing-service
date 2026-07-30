import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { User, Role, Provider } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserAlreadyExistsException } from '../../common/exceptions/user-already-exists.exception';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';
import { InvalidRefreshTokenException } from '../../common/exceptions/invalid-refresh-token.exception';
import { UserNotFoundException } from '../../common/exceptions/user-not-found.exception';
import { USER_REGISTERED } from '../../events/event.constants';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private eventEmitter: EventEmitter2,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new UserAlreadyExistsException();
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        name: registerDto.name,
        pendingStripeSetup: true,
      },
    });

    this.eventEmitter.emit(USER_REGISTERED, {
      userId: user.id,
      email: user.email,
    });

    return this.excludePasswordFromUser(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

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

  async refreshToken(token: string) {
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
  }) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ providerId: profile.providerId }, { email: profile.email }],
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          provider: Provider.GOOGLE,
          providerId: profile.providerId,
          pendingStripeSetup: true,
        },
      });
      this.eventEmitter.emit(USER_REGISTERED, {
        userId: user.id,
        email: user.email,
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.name,
          avatar: profile.avatar,
          providerId: profile.providerId,
          provider:
            user.provider === Provider.LOCAL ? Provider.GOOGLE : user.provider,
        },
      });
    }

    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserNotFoundException();
    return this.excludePasswordFromUser(user);
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
    });
    return this.excludePasswordFromUser(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.excludePasswordFromUser(user));
  }

  async updateRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserNotFoundException();

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    return this.excludePasswordFromUser(updatedUser);
  }

  private async generateAccessToken(user: User): Promise<string> {
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

  private excludePasswordFromUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, providerId, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
