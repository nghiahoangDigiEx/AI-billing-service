import { Prisma, PlanStatus, Plan } from '@prisma/client';

export class PlanRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async findBySlug(slug: string): Promise<Plan | null> {
    return this.tx.plan.findUnique({ where: { slug } });
  }

  async findByIdWithPrices(id: string) {
    return this.tx.plan.findUnique({
      where: { id },
      include: { prices: true },
    });
  }

  async findById(id: string) {
    return this.tx.plan.findUnique({ where: { id } });
  }

  async create(data: Prisma.PlanCreateInput) {
    return this.tx.plan.create({
      data,
      include: { prices: true },
    });
  }

  async findAllActive() {
    return this.tx.plan.findMany({
      where: { status: PlanStatus.ACTIVE },
      include: {
        prices: {
          where: { status: PlanStatus.ACTIVE },
        },
      },
    });
  }

  async update(id: string, data: Prisma.PlanUpdateInput) {
    return this.tx.plan.update({
      where: { id },
      data,
      include: { prices: true },
    });
  }
}
