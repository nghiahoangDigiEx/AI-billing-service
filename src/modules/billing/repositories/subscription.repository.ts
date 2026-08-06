import { Prisma, SubscriptionStatus } from '@prisma/client';
import { SortOrder } from '@/common/enums/sort-order.enum';

export class SubscriptionRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async findCurrentActive(userId: string) {
    return this.tx.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true, planPrice: true },
    });
  }

  async findHistory(userId: string) {
    return this.tx.subscription.findMany({
      where: { userId },
      include: { plan: true, planPrice: true },
      orderBy: { createdAt: SortOrder.DESC },
    });
  }
}
