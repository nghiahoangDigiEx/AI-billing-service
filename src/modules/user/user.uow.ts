import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UserRepository } from './repositories/user.repository';
import { UserOutboxRepository } from './repositories/user-outbox.repository';

export class UserRepoFactory {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  get user() {
    return new UserRepository(this.tx);
  }

  get outbox() {
    return new UserOutboxRepository(this.tx);
  }
}

@Injectable()
export class UserUoW {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(work: (repos: UserRepoFactory) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        const repos = new UserRepoFactory(tx);
        return await work(repos);
      },
      { maxWait: 10000, timeout: 20000 },
    );
  }

  get readOnly() {
    return new UserRepoFactory(this.prisma);
  }
}
