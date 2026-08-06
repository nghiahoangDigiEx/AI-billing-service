import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PlanRepository } from './repositories/plan.repository';
import { PlanPriceRepository } from './repositories/plan-price.repository';
import { AddonPackageRepository } from './repositories/addon-package.repository';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { BillingCreditBalanceRepository } from './repositories/billing-credit-balance.repository';
import { BillingUserRepository } from './repositories/billing-user.repository';

export class BillingRepoFactory {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  get plan() {
    return new PlanRepository(this.tx);
  }

  get planPrice() {
    return new PlanPriceRepository(this.tx);
  }

  get addonPackage() {
    return new AddonPackageRepository(this.tx);
  }

  get subscription() {
    return new SubscriptionRepository(this.tx);
  }

  get creditBalance() {
    return new BillingCreditBalanceRepository(this.tx);
  }

  get user() {
    return new BillingUserRepository(this.tx);
  }
}

@Injectable()
export class BillingUoW {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    work: (repos: BillingRepoFactory) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        const repos = new BillingRepoFactory(tx);
        return await work(repos);
      },
      { maxWait: 10000, timeout: 20000 },
    );
  }

  get readOnly() {
    return new BillingRepoFactory(this.prisma);
  }
}
