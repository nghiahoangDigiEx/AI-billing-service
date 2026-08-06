import { Prisma, PlanStatus, AddonPackage } from '@prisma/client';

export class AddonPackageRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async create(data: Prisma.AddonPackageCreateInput): Promise<AddonPackage> {
    return this.tx.addonPackage.create({ data });
  }

  async findAllActive(): Promise<AddonPackage[]> {
    return this.tx.addonPackage.findMany({
      where: { status: PlanStatus.ACTIVE },
    });
  }

  async findById(id: string): Promise<AddonPackage | null> {
    return this.tx.addonPackage.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.AddonPackageUpdateInput) {
    return this.tx.addonPackage.update({
      where: { id },
      data,
    });
  }
}
