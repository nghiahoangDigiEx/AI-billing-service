import { Prisma, PlanStatus, BillingInterval } from '@prisma/client';

export class PlanPriceRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async findFirstActive(planId: string, billingInterval: BillingInterval) {
    return this.tx.planPrice.findFirst({
      where: {
        planId,
        billingInterval,
        status: PlanStatus.ACTIVE,
      },
    });
  }

  async findByIdAndPlanId(id: string, planId: string) {
    return this.tx.planPrice.findFirst({
      where: { id, planId },
    });
  }

  async findById(id: string) {
    return this.tx.planPrice.findUnique({ where: { id } });
  }

  async countActivePrices(planId: string) {
    return this.tx.planPrice.count({
      where: {
        planId,
        status: PlanStatus.ACTIVE,
      },
    });
  }

  async create(data: Prisma.PlanPriceUncheckedCreateInput) {
    return this.tx.planPrice.create({ data });
  }

  async updateStatus(id: string, status: PlanStatus) {
    return this.tx.planPrice.update({
      where: { id },
      data: { status },
    });
  }
}
