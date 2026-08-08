import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '@/events/payment.events';
import type { SubscriptionDeletedEvent } from '@/events/payment.events';
import { SubscriptionStatus } from '@prisma/client';
import { SUBSCRIPTION_DELETED } from '@/events/event.constants';
import { createDomainEvent } from '@/events/domain-event';
import type { SubscriptionDeletedPayload } from '@/events/payloads';
import { BillingOutboxWriter } from '@/modules/event-outbox/services/billing-outbox-writer.service';
import { BillingOutboxRelay } from '@/modules/event-outbox/providers/outbox-relay.service';
import { PLAN_SLUGS } from '@/modules/billing/constants/billing.constants';

@Injectable()
export class SubscriptionDeletedListener {
  private readonly logger = new Logger(SubscriptionDeletedListener.name);

  constructor(
    private prisma: PrismaService,
    private readonly outboxWriter: BillingOutboxWriter,
    private readonly relay: BillingOutboxRelay,
  ) {}

  @OnEvent(PaymentEvents.SUBSCRIPTION_DELETED)
  async handle(event: SubscriptionDeletedEvent): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId: event.subscriptionId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription ${event.subscriptionId} not found for subscription.deleted`,
      );
      return;
    }

    const freePlan = await this.prisma.plan.findUnique({
      where: { slug: PLAN_SLUGS.FREE },
      include: { prices: true },
    });

    if (!freePlan || freePlan.prices.length === 0) {
      throw new Error('Free plan not found');
    }
    const freePlanPrice = freePlan.prices[0];

    const periodStart = new Date();
    const periodEnd = new Date(new Date().setMonth(new Date().getMonth() + 1));

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.CANCELLED,
        },
      });

      const newSub = await tx.subscription.create({
        data: {
          userId: subscription.userId,
          planId: freePlan.id,
          planPriceId: freePlanPrice.id,
          stripeSubscriptionId: null,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });

      const domainEvent = createDomainEvent<SubscriptionDeletedPayload>(
        SUBSCRIPTION_DELETED,
        {
          userId: subscription.userId,
          freePlanCredits: freePlan.creditsIncluded,
          periodStart,
          periodEnd,
          sourceRef: newSub.id,
        },
        {
          providerEventId: event.providerEventId,
          causationId: event.providerEventId,
          correlationId: event.providerEventId,
        },
        { id: event.providerEventId },
      );

      await this.outboxWriter.insert(tx, domainEvent);
    });

    this.logger.log(
      `Subscription ${subscription.id} cancelled and downgraded to free for user ${subscription.userId}`,
    );

    await this.relay.kick();
  }
}
