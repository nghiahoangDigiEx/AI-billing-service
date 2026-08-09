import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '@/events/payment.events';
import type { InvoicePaidEvent } from '@/events/payment.events';
import { SubscriptionStatus } from '@prisma/client';
import { INVOICE_PAID } from '@/events/event.constants';
import { createDomainEvent } from '@/events/domain-event';
import type { InvoicePaidPayload } from '@/events/payloads';
import { BillingOutboxWriter } from '@/modules/event-outbox/services/billing-outbox-writer.service';
import { BillingOutboxRelay } from '@/modules/event-outbox/providers/outbox-relay.service';

@Injectable()
export class InvoicePaidListener {
  private readonly logger = new Logger(InvoicePaidListener.name);

  constructor(
    private prisma: PrismaService,
    private readonly outboxWriter: BillingOutboxWriter,
    private readonly relay: BillingOutboxRelay,
  ) {}

  @OnEvent(PaymentEvents.INVOICE_PAID)
  async handle(event: InvoicePaidEvent): Promise<void> {
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

    if (!event.priceId) {
      this.logger.warn(
        `Invoice event ${event.providerEventId} has no price ID.`,
      );
      return;
    }

    const planPrice = await this.prisma.planPrice.findFirst({
      where: { stripePriceId: event.priceId },
      include: { plan: true },
    });

    if (!planPrice) {
      this.logger.warn(
        `PlanPrice with stripePriceId ${event.priceId} not found.`,
      );
      return;
    }

    const creditsIncluded = Number(planPrice.plan.creditsIncluded) || 0;

    const domainEvent = createDomainEvent<InvoicePaidPayload>(
      INVOICE_PAID,
      {
        userId: user.id,
        creditsIncluded,
        periodStart: event.periodStart,
        periodEnd: event.periodEnd,
        sourceRef: event.providerEventId,
        planSlug: planPrice.plan.slug,
      },
      {
        providerEventId: event.providerEventId,
        causationId: event.providerEventId,
        correlationId: event.providerEventId,
      },
      { id: event.providerEventId },
    );

    await this.prisma.$transaction(async (tx) => {
      const activeSubscription = await tx.subscription.findFirst({
        where: {
          stripeSubscriptionId: event.subscriptionId,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (!activeSubscription) {
        await tx.subscription.create({
          data: {
            userId: user.id,
            planId: planPrice.planId,
            planPriceId: planPrice.id,
            stripeSubscriptionId: event.subscriptionId,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: event.periodStart,
            currentPeriodEnd: event.periodEnd,
          },
        });
      } else {
        if (activeSubscription.planPriceId !== planPrice.id) {
          await tx.subscription.update({
            where: { id: activeSubscription.id },
            data: { status: SubscriptionStatus.CANCELLED },
          });

          await tx.subscription.create({
            data: {
              userId: user.id,
              planId: planPrice.planId,
              planPriceId: planPrice.id,
              stripeSubscriptionId: event.subscriptionId,
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: event.periodStart,
              currentPeriodEnd: event.periodEnd,
            },
          });
        } else {
          await tx.subscription.update({
            where: { id: activeSubscription.id },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: event.periodStart,
              currentPeriodEnd: event.periodEnd,
            },
          });
        }
      }

      await this.outboxWriter.insert(tx, domainEvent);
    });

    await this.relay.kick();
  }
}
