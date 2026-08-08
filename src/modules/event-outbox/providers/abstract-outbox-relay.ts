import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { OutboxStatus, Prisma } from '@prisma/client';
import type { DomainEvent } from '@/events/domain-event';
import { OutboxRepository } from './outbox.repository';
import { type EventPublisher } from '../interfaces/event-publisher.interface';
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

export abstract class AbstractOutboxRelay {
  protected abstract readonly logger: Logger;
  protected abstract readonly tableName: string;
  protected abstract readonly modelName: 'billingOutbox' | 'userOutbox';

  constructor(
    protected readonly repository: OutboxRepository,
    protected readonly publisher: EventPublisher,
    protected readonly configService: ConfigService,
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
    const rows = await this.repository.claimPendingEvents(
      this.tableName,
      this.maxAttempts,
      this.staleTimeoutSeconds,
      this.batchSize,
    );

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

      await this.repository.updateEventStatus(this.modelName, id, {
        status: OutboxStatus.PROCESSED,
        processedAt: new Date(),
        lockedAt: null,
        errorMessage: null,
      });
    } catch (error: unknown) {
      const classification = this.classifyError(error);

      if (classification === ErrorClassification.DUPLICATE) {
        this.logger.log(
          `Outbox event ${event.id} (${event.type}) already processed via idempotency key`,
        );
        await this.repository.updateEventStatus(this.modelName, id, {
          status: OutboxStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          errorMessage: null,
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

        await this.repository.moveToDlq(
          this.modelName,
          event,
          attempts,
          message,
        );

        return;
      }

      // Transient: schedule retry.
      const nextAttemptAt = new Date(Date.now() + this.backoffMs(attempts));

      this.logger.warn(
        `Outbox event ${event.id} (${event.type}) transient failure (attempt ${attempts}), retry at ${nextAttemptAt.toISOString()}: ${message}`,
      );

      await this.repository.updateEventStatus(this.modelName, id, {
        status: OutboxStatus.PENDING,
        nextAttemptAt,
        lockedAt: null,
        errorMessage: message,
      });
    }
  }

  async purgeProcessedEvents(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const deletedCount = await this.repository.purgeProcessedEvents(
      this.modelName,
      cutoff,
    );

    if (deletedCount > 0) {
      this.logger.log(
        `Purged ${deletedCount} processed outbox rows from ${this.tableName} older than ${this.retentionDays} days`,
      );
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async runRelay(): Promise<void> {
    this.logger.debug(`Running ${this.tableName} relay...`);
    await this.processPendingEvents();
    await this.purgeProcessedEvents();
  }

  async kick(): Promise<void> {
    try {
      await this.processPendingEvents();
    } catch (error: unknown) {
      this.logger.warn(
        `Outbox kick failed for ${this.tableName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
