import { Injectable } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { DomainEvent } from '@/events/domain-event';

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimPendingEvents(
    tableName: string,
    maxAttempts: number,
    staleTimeoutSeconds: number,
    batchSize: number,
  ): Promise<
    Array<{
      id: string;
      attempts: number;
      payload: Prisma.JsonValue;
    }>
  > {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - staleTimeoutSeconds * 1000);

    return this.prisma.$queryRaw<
      Array<{
        id: string;
        attempts: number;
        payload: Prisma.JsonValue;
      }>
    >`
      WITH claim AS (
        SELECT id
        FROM ${Prisma.raw('"' + tableName + '"')}
        WHERE status = 'PENDING'
          AND attempts < ${maxAttempts}
          AND "nextAttemptAt" <= ${now}
          AND ("lockedAt" IS NULL OR "lockedAt" < ${staleThreshold})
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ${Prisma.raw('"' + tableName + '"')} b
      SET "lockedAt" = ${now},
          attempts = attempts + 1,
          "updatedAt" = ${now}
      FROM claim
      WHERE b.id = claim.id
      RETURNING b.id, b.attempts, b.payload;
    `;
  }

  async updateEventStatus(
    modelName: 'billingOutbox' | 'userOutbox',
    id: string,
    data: Prisma.BillingOutboxUpdateInput | Prisma.UserOutboxUpdateInput,
  ): Promise<void> {
    if (modelName === 'billingOutbox') {
      await this.prisma.billingOutbox.update({
        where: { id },
        data,
      });
    } else {
      await this.prisma.userOutbox.update({
        where: { id },
        data,
      });
    }
  }

  async purgeProcessedEvents(
    modelName: 'billingOutbox' | 'userOutbox',
    cutoff: Date,
  ): Promise<number> {
    if (modelName === 'billingOutbox') {
      const result = await this.prisma.billingOutbox.deleteMany({
        where: {
          status: OutboxStatus.PROCESSED,
          processedAt: { lt: cutoff },
        },
      });
      return result.count;
    } else {
      const result = await this.prisma.userOutbox.deleteMany({
        where: {
          status: OutboxStatus.PROCESSED,
          processedAt: { lt: cutoff },
        },
      });
      return result.count;
    }
  }

  async moveToDlq(
    modelName: 'billingOutbox' | 'userOutbox',
    event: DomainEvent<unknown>,
    attempts: number,
    message: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.eventDlq.create({
        data: {
          eventId: event.id,
          type: event.type,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
          errorMessage: message,
          attempts,
        },
      });

      if (modelName === 'billingOutbox') {
        await tx.billingOutbox.update({
          where: { eventId: event.id },
          data: {
            status: OutboxStatus.DEAD_LETTERED,
            lockedAt: null,
            errorMessage: message,
          },
        });
      } else {
        await tx.userOutbox.update({
          where: { eventId: event.id },
          data: {
            status: OutboxStatus.DEAD_LETTERED,
            lockedAt: null,
            errorMessage: message,
          },
        });
      }
    });
  }
}
