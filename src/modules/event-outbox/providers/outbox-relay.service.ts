import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BillingOutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { DomainEvent } from '@/events/domain-event';
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from '../interfaces/event-publisher.interface';
import { Inject } from '@nestjs/common';
import { CONFIG_KEYS } from '@/common/constants/config.constants';

const MAX_ATTEMPTS_DEFAULT = 5;
const STALE_TIMEOUT_SECONDS_DEFAULT = 600; // 10 minutes
const BATCH_SIZE_DEFAULT = 100;
const RETENTION_DAYS_DEFAULT = 7;
const BACKOFF_BASE_SECONDS = 5;

export enum ErrorClassification {
  DUPLICATE = 'duplicate',
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
}

@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    private readonly configService: ConfigService,
  ) {}

  private get maxAttempts(): number {
    return (
      this.configService.get<number>(CONFIG_KEYS.OUTBOX_MAX_ATTEMPTS) ??
      MAX_ATTEMPTS_DEFAULT
    );
  }

  private get staleTimeoutSeconds(): number {
    return (
      this.configService.get<number>(
        CONFIG_KEYS.OUTBOX_STALE_TIMEOUT_SECONDS,
      ) ?? STALE_TIMEOUT_SECONDS_DEFAULT
    );
  }

  private get batchSize(): number {
    return (
      this.configService.get<number>(CONFIG_KEYS.OUTBOX_BATCH_SIZE) ??
      BATCH_SIZE_DEFAULT
    );
  }

  private get retentionDays(): number {
    return (
      this.configService.get<number>(CONFIG_KEYS.OUTBOX_RETENTION_DAYS) ??
      RETENTION_DAYS_DEFAULT
    );
  }

  private classifyError(error: unknown): ErrorClassification {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? (error as { code: string }).code
        : undefined;

    if (!code) {
      // Non-Prisma errors are treated as transient (network, temporary runtime).
      return ErrorClassification.TRANSIENT;
    }

    if (code === 'P2002') {
      return ErrorClassification.DUPLICATE;
    }

    if (
      code === 'P2024' ||
      code === 'P1001' ||
      code === 'P1017' ||
      code === 'P2034'
    ) {
      return ErrorClassification.TRANSIENT;
    }

    return ErrorClassification.PERMANENT;
  }

  private backoffMs(attempts: number): number {
    return Math.pow(BACKOFF_BASE_SECONDS, attempts) * 1000;
  }

  private parsePayload(raw: Prisma.JsonValue): DomainEvent<unknown> {
    const event = raw as unknown as DomainEvent<unknown>;
    return {
      ...event,
      occurredAt: new Date(event.occurredAt),
    };
  }

  async claimPendingEvents(): Promise<
    Array<{
      id: string;
      attempts: number;
      payload: DomainEvent<unknown>;
    }>
  > {
    const now = new Date();
    const staleThreshold = new Date(
      now.getTime() - this.staleTimeoutSeconds * 1000,
    );

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        attempts: number;
        payload: Prisma.JsonValue;
      }>
    >`
      WITH claim AS (
        SELECT id
        FROM "BillingOutbox"
        WHERE status = 'PENDING'
          AND attempts < ${this.maxAttempts}
          AND "nextAttemptAt" <= ${now}
          AND ("lockedAt" IS NULL OR "lockedAt" < ${staleThreshold})
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "BillingOutbox" b
      SET "lockedAt" = ${now},
          attempts = attempts + 1,
          "updatedAt" = ${now}
      FROM claim
      WHERE b.id = claim.id
      RETURNING b.id, b.attempts, b.payload;
    `;

    return rows.map((row) => ({
      id: row.id,
      attempts: row.attempts,
      payload: this.parsePayload(row.payload),
    }));
  }

  async processPendingEvents(): Promise<void> {
    const claimed = await this.claimPendingEvents();

    for (const row of claimed) {
      await this.processRow(row.id, row.attempts, row.payload);
    }
  }

  private async processRow(
    id: string,
    attempts: number,
    event: DomainEvent<unknown>,
  ): Promise<void> {
    try {
      await this.publisher.publish(event);

      await this.prisma.billingOutbox.update({
        where: { id },
        data: {
          status: BillingOutboxStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          errorMessage: null,
        },
      });
    } catch (error: unknown) {
      const classification = this.classifyError(error);

      if (classification === ErrorClassification.DUPLICATE) {
        this.logger.log(
          `Outbox event ${event.id} (${event.type}) already processed via idempotency key`,
        );
        await this.prisma.billingOutbox.update({
          where: { id },
          data: {
            status: BillingOutboxStatus.PROCESSED,
            processedAt: new Date(),
            lockedAt: null,
            errorMessage: null,
          },
        });
        return;
      }

      const message = error instanceof Error ? error.message : String(error);

      if (
        classification === ErrorClassification.PERMANENT ||
        attempts >= this.maxAttempts
      ) {
        this.logger.error(
          `Outbox event ${event.id} (${event.type}) moved to DLQ after ${attempts} attempt(s): ${message}`,
          error instanceof Error ? error.stack : undefined,
        );

        await this.prisma.$transaction(async (tx) => {
          await tx.eventDlq.create({
            data: {
              eventId: event.id,
              type: event.type,
              payload: JSON.parse(
                JSON.stringify(event),
              ) as Prisma.InputJsonValue,
              errorMessage: message,
              attempts,
            },
          });

          await tx.billingOutbox.update({
            where: { id },
            data: {
              status: BillingOutboxStatus.DEAD_LETTERED,
              lockedAt: null,
              errorMessage: message,
            },
          });
        });

        return;
      }

      // Transient: schedule retry.
      const nextAttemptAt = new Date(Date.now() + this.backoffMs(attempts));

      this.logger.warn(
        `Outbox event ${event.id} (${event.type}) transient failure (attempt ${attempts}), retry at ${nextAttemptAt.toISOString()}: ${message}`,
      );

      await this.prisma.billingOutbox.update({
        where: { id },
        data: {
          status: BillingOutboxStatus.PENDING,
          nextAttemptAt,
          lockedAt: null,
          errorMessage: message,
        },
      });
    }
  }

  async purgeProcessedEvents(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const result = await this.prisma.billingOutbox.deleteMany({
      where: {
        status: BillingOutboxStatus.PROCESSED,
        processedAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Purged ${result.count} processed outbox rows older than ${this.retentionDays} days`,
      );
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async runRelay(): Promise<void> {
    this.logger.debug('Running outbox relay...');
    await this.processPendingEvents();
    await this.purgeProcessedEvents();
  }

  async kick(): Promise<void> {
    try {
      await this.processPendingEvents();
    } catch (error: unknown) {
      this.logger.warn(
        `Outbox kick failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
