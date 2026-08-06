import { Prisma } from '@prisma/client';

export class CreditTransactionRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async create(data: Prisma.CreditTransactionUncheckedCreateInput) {
    return this.tx.creditTransaction.create({ data });
  }
}
