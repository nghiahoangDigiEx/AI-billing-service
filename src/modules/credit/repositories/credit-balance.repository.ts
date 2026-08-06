import { Prisma, CreditSource, CreditStatus } from '@prisma/client';
import { SortOrder } from '@/common/enums/sort-order.enum';

export class CreditBalanceRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async create(data: Prisma.CreditBalanceUncheckedCreateInput) {
    return this.tx.creditBalance.create({ data });
  }

  async updateManyStatus(
    where: Prisma.CreditBalanceWhereInput,
    data: Prisma.CreditBalanceUpdateInput,
  ) {
    return this.tx.creditBalance.updateMany({ where, data });
  }

  async findActiveAddons(userId: string) {
    return this.tx.creditBalance.findMany({
      where: {
        userId,
        source: CreditSource.ADDON,
        status: CreditStatus.ACTIVE,
      },
    });
  }

  async findFrozenAddons(userId: string) {
    return this.tx.creditBalance.findMany({
      where: {
        userId,
        source: CreditSource.ADDON,
        status: CreditStatus.FROZEN,
      },
    });
  }

  async findActiveBalanceForConsumption(userId: string, amount: number) {
    return this.tx.creditBalance.findFirst({
      where: {
        userId,
        status: CreditStatus.ACTIVE,
        remainingCredits: { gte: amount },
      },
      orderBy: { createdAt: SortOrder.ASC },
    });
  }

  async updateRemaining(id: string, remainingCredits: number) {
    return this.tx.creditBalance.update({
      where: { id },
      data: { remainingCredits },
    });
  }
}
