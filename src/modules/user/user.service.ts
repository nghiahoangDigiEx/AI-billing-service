import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User, Role, Provider } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserAlreadyExistsException } from '../../common/exceptions/user-already-exists.exception';
import { UserNotFoundException } from '../../common/exceptions/user-not-found.exception';
import { USER_REGISTERED } from '../../events/event.constants';

export type UserWithoutPassword = Omit<User, 'password' | 'providerId'>;

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByProviderId(providerId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { providerId },
    });
  }

  async updateUserProvider(
    userId: string,
    data: {
      name: string;
      avatar?: string;
      providerId: string;
      provider: Provider;
    },
  ): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.excludePasswordFromUser(user);
  }

  async createUser(data: {
    email: string;
    password?: string;
    name?: string;
    provider?: Provider;
    providerId?: string;
    avatar?: string;
  }): Promise<UserWithoutPassword> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new UserAlreadyExistsException();
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        provider: data.provider || Provider.LOCAL,
        providerId: data.providerId,
        avatar: data.avatar,
        pendingStripeSetup: true,
      },
    });

    this.eventEmitter.emit(USER_REGISTERED, {
      userId: user.id,
      email: user.email,
    });

    return this.excludePasswordFromUser(user);
  }

  async getProfile(userId: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserNotFoundException();
    return this.excludePasswordFromUser(user);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
    });
    return this.excludePasswordFromUser(user);
  }

  async findAll(): Promise<UserWithoutPassword[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.excludePasswordFromUser(user));
  }

  async updateRole(userId: string, role: Role): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserNotFoundException();

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    return this.excludePasswordFromUser(updatedUser);
  }

  private excludePasswordFromUser(user: User): UserWithoutPassword {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, providerId, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
