import { Prisma, CreditSource, CreditStatus } from '@prisma/client';
import { SortOrder } from '@/common/enums/sort-order.enum';

export class BillingCreditBalanceRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async findUserAddonPurchases(userId: string) {
    return this.tx.creditBalance.findMany({
      where: {
        userId,
        source: CreditSource.ADDON,
        status: { in: [CreditStatus.ACTIVE, CreditStatus.FROZEN] },
      },
      orderBy: { createdAt: SortOrder.DESC },
    });
  }

  async findUserAddonHistory(userId: string) {
    return this.tx.creditBalance.findMany({
      where: {
        userId,
        source: CreditSource.ADDON,
      },
      orderBy: { createdAt: SortOrder.DESC },
    });
  }

  async freezeActiveAddons(userId: string) {
    return this.tx.creditBalance.updateMany({
      where: {
        userId,
        source: CreditSource.ADDON,
        status: CreditStatus.ACTIVE,
      },
      data: {
        status: CreditStatus.FROZEN,
        frozenAt: new Date(),
      },
    });
  }

  async unfreezeFrozenAddons(userId: string) {
    return this.tx.creditBalance.updateMany({
      where: {
        userId,
        source: CreditSource.ADDON,
        status: CreditStatus.FROZEN,
      },
      data: {
        status: CreditStatus.ACTIVE,
        unfrozenAt: new Date(),
        frozenAt: null,
      },
    });
  }
}
