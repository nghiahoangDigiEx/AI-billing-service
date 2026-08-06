import { Injectable, HttpStatus } from '@nestjs/common';
import { UserUoW } from '../user.uow';
import { User, Role, Provider } from '@prisma/client';
import { UpdateProfileDto } from '@/modules/user/dto/update-profile.dto';
import { AppException } from '@/common/exceptions';
import { ErrorCode } from '@/common/enums';
import { USER_REGISTERED } from '@/events/event.constants';

export type UserWithoutPassword = Omit<User, 'password' | 'providerId'>;

@Injectable()
export class UserService {
  constructor(private readonly uow: UserUoW) {}

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.uow.readOnly.user.findByEmail(email);
  }

  async findByProviderId(providerId: string): Promise<User | null> {
    return this.uow.readOnly.user.findByProviderId(providerId);
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
    const user = await this.uow.execute(async (repos) => {
      return repos.user.update(userId, data);
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
    const user = await this.uow.execute(async (repos) => {
      const existingUser = await repos.user.findByEmail(data.email);

      if (existingUser) {
        throw new AppException(
          ErrorCode.CONFLICT,
          'User already exists',
          HttpStatus.CONFLICT,
        );
      }

      const newUser = await repos.user.create({
        email: data.email,
        password: data.password,
        name: data.name,
        provider: data.provider || Provider.LOCAL,
        providerId: data.providerId,
        avatar: data.avatar,
        pendingStripeSetup: true,
      });

      await repos.outbox.publish(USER_REGISTERED, {
        userId: newUser.id,
        email: newUser.email,
      });

      return newUser;
    });

    return this.excludePasswordFromUser(user);
  }

  async getProfile(userId: string): Promise<UserWithoutPassword> {
    const user = await this.uow.readOnly.user.findById(userId);
    if (!user) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.excludePasswordFromUser(user);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserWithoutPassword> {
    const user = await this.uow.execute(async (repos) => {
      return repos.user.update(userId, updateProfileDto);
    });
    return this.excludePasswordFromUser(user);
  }

  async findAll(): Promise<UserWithoutPassword[]> {
    const users = await this.uow.readOnly.user.findAll();
    return users.map((user) => this.excludePasswordFromUser(user));
  }

  async updateRole(userId: string, role: Role): Promise<UserWithoutPassword> {
    const updatedUser = await this.uow.execute(async (repos) => {
      const user = await repos.user.findById(userId);
      if (!user) {
        throw new AppException(
          ErrorCode.NOT_FOUND,
          'User not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return repos.user.update(userId, { role });
    });
    return this.excludePasswordFromUser(updatedUser);
  }

  private excludePasswordFromUser(user: User): UserWithoutPassword {
    const userWithoutPassword = { ...user } as Partial<User>;
    delete userWithoutPassword.password;
    delete userWithoutPassword.providerId;
    return userWithoutPassword as UserWithoutPassword;
  }
}
