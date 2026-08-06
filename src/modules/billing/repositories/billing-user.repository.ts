import { Prisma, User } from '@prisma/client';

export class BillingUserRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async findById(id: string): Promise<User | null> {
    return this.tx.user.findUnique({ where: { id } });
  }
}
