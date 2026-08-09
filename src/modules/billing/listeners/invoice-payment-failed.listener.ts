import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '@/events/payment.events';
import type { InvoicePaymentFailedEvent } from '@/events/payment.events';
import { SubscriptionStatus } from '@prisma/client';
import { SUBSCRIPTION_PAYMENT_FAILED } from '@/events/event.constants';
import { createDomainEvent } from '@/events/domain-event';
import type { SubscriptionPaymentFailedPayload } from '@/events/payloads/billing-payloads';
import { BillingOutboxWriter } from '@/modules/event-outbox/services/billing-outbox-writer.service';
import { BillingOutboxRelay } from '@/modules/event-outbox/providers/outbox-relay.service';

@Injectable()
export class InvoicePaymentFailedListener {
  private readonly logger = new Logger(InvoicePaymentFailedListener.name);

  constructor(
    private prisma: PrismaService,
    private readonly outboxWriter: BillingOutboxWriter,
    private readonly relay: BillingOutboxRelay,
  ) {}

  @OnEvent(PaymentEvents.INVOICE_PAYMENT_FAILED)
  async handle(event: InvoicePaymentFailedEvent): Promise<void> {
    if (!event.subscriptionId) return;

    if (!event.customerId) {
      this.logger.warn(
        `Invoice event ${event.providerEventId} has no customer ID.`,
      );
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: event.customerId },
    });

    if (!user) {
      this.logger.warn(
        `User with stripeCustomerId ${event.customerId} not found.`,
      );
      return;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId: event.subscriptionId,
        userId: user.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription ${event.subscriptionId} not found or not active for payment failed`,
      );
      return;
    }

    const domainEvent = createDomainEvent<SubscriptionPaymentFailedPayload>(
      SUBSCRIPTION_PAYMENT_FAILED,
      {
        userId: user.id,
        sourceRef: event.providerEventId,
      },
      {
        providerEventId: event.providerEventId,
        causationId: event.providerEventId,
        correlationId: event.providerEventId,
      },
      { id: event.providerEventId },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.PAST_DUE },
      });

      await this.outboxWriter.insert(tx, domainEvent);
    });

    await this.relay.kick();
  }
}
