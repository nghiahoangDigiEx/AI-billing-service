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
}
