import { Injectable } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import type { DomainEvent } from '@/events/domain-event';

@Injectable()
export class BillingOutboxWriter {
  toCreateInput<T>(event: DomainEvent<T>): Prisma.BillingOutboxCreateInput {
    return {
      eventId: event.id,
      type: event.type,
      payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
      status: OutboxStatus.PENDING,
      attempts: 0,
      nextAttemptAt: new Date(),
    };
  }

  async insert<T>(
    tx: Prisma.TransactionClient,
    event: DomainEvent<T>,
  ): Promise<void> {
    await tx.billingOutbox.create({
      data: this.toCreateInput(event),
    });
  }
}
