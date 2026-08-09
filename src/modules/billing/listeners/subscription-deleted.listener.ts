import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '@/events/payment.events';
import type { SubscriptionDeletedEvent } from '@/events/payment.events';
import { SubscriptionStatus } from '@prisma/client';
import { BillingOutboxRelay } from '@/modules/event-outbox/providers/outbox-relay.service';
import { BillingService } from '@/modules/billing/services/billing.service';

@Injectable()
export class SubscriptionDeletedListener {
  private readonly logger = new Logger(SubscriptionDeletedListener.name);

  constructor(
    private prisma: PrismaService,
    private readonly relay: BillingOutboxRelay,
    private readonly billingService: BillingService,
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

    await this.billingService.downgradeToFree(
      subscription.userId,
      event.subscriptionId,
      event.providerEventId,
      event.providerEventId,
    );

    this.logger.log(
      `Subscription ${subscription.id} cancelled and downgraded to free for user ${subscription.userId}`,
    );

    await this.relay.kick();
  }
}
