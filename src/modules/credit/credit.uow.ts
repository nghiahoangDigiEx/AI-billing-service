import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreditBalanceRepository } from './repositories/credit-balance.repository';
import { CreditTransactionRepository } from './repositories/credit-transaction.repository';
import { CreditInboxRepository } from './repositories/credit-inbox.repository';

export class CreditRepoFactory {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  get balance() {
    return new CreditBalanceRepository(this.tx);
  }

  get transaction() {
    return new CreditTransactionRepository(this.tx);
  }

  get inbox() {
    return new CreditInboxRepository(this.tx);
  }
}

@Injectable()
export class CreditUoW {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(work: (repos: CreditRepoFactory) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        const repos = new CreditRepoFactory(tx);
        return await work(repos);
      },
      { maxWait: 10000, timeout: 20000 },
    );
  }
}
