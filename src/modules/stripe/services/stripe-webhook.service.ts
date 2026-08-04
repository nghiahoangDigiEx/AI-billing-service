import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, WebhookEventStatus } from '@prisma/client';
import { ParsedWebhookEvent } from '../../payment/interfaces/webhook-strategy.interface';
import { StripeEventHandlerFactory } from '../factories/stripe-event-handler.factory';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private readonly stripeEventHandlerFactory: StripeEventHandlerFactory,
  ) {}

  async claimEvent(event: ParsedWebhookEvent): Promise<boolean> {
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (
      existingEvent &&
      (existingEvent.status === WebhookEventStatus.PROCESSED ||
        existingEvent.status === WebhookEventStatus.PENDING)
    ) {
      this.logger.log(
        `Event ${event.id} already ${existingEvent.status}. Skipping.`,
      );
      return false;
    }

    if (!existingEvent) {
      await this.prisma.webhookEvent.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
          status: WebhookEventStatus.PENDING,
        },
      });
    } else {
      await this.prisma.webhookEvent.update({
        where: { id: existingEvent.id },
        data: { status: WebhookEventStatus.PENDING, errorMessage: null },
      });
    }
    return true;
  }

  async markProcessed(
    eventId: string,
    status: WebhookEventStatus,
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { stripeEventId: eventId },
      data: {
        status,
        processedAt: new Date(),
      },
    });
  }

  async markFailed(eventId: string, message: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { stripeEventId: eventId },
      data: {
        status: WebhookEventStatus.FAILED,
        errorMessage: message,
      },
    });
  }

  async handleEvent(event: ParsedWebhookEvent): Promise<void> {
    const claimed = await this.claimEvent(event);

    if (!claimed) {
      return;
    }

    try {
      const handler = this.stripeEventHandlerFactory.getHandler(event.type);
      if (!handler) {
        this.logger.log(`Unhandled event type: ${event.type}`);
        await this.markProcessed(event.id, WebhookEventStatus.UNHANDLED);
        return;
      }

      await handler.handle(event);

      await this.markProcessed(event.id, WebhookEventStatus.PROCESSED);
    } catch (error) {
      const err = error as Error;
      await this.markFailed(event.id, err.message || String(err));

      const isUniqueViolation = (e: unknown) =>
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: string }).code === 'P2002';

      if (isUniqueViolation(err)) {
        throw err;
      }

      this.logger.error(
        `Logic error in webhook ${event.id}, not throwing to prevent retry.`,
        err.stack || String(err),
      );
    }
  }
}
