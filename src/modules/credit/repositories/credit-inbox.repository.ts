import { Prisma } from '@prisma/client';

export class CreditInboxRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async isEventProcessed(eventId: string): Promise<boolean> {
    const existing = await this.tx.creditInbox.findUnique({
      where: { eventId },
    });
    return existing !== null;
  }

  async markAsProcessed(eventId: string, type: string) {
    return this.tx.creditInbox.create({
      data: { eventId, type },
    });
  }
}
