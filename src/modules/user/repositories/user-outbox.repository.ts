import { Prisma, BillingOutboxStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

export class UserOutboxRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async publish(type: string, payload: Prisma.InputJsonValue) {
    return this.tx.billingOutbox.create({
      data: {
        eventId: randomUUID(),
        type,
        payload,
        status: BillingOutboxStatus.PENDING,
      },
    });
  }
}
