import { Prisma, OutboxStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

export class UserOutboxRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async publish(type: string, payload: Prisma.InputJsonValue) {
    return this.tx.userOutbox.create({
      data: {
        eventId: randomUUID(),
        type,
        payload,
        status: OutboxStatus.PENDING,
      },
    });
  }
}
