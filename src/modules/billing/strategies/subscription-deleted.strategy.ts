import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { WebhookStrategy } from './webhook-strategy.interface';
import { SUBSCRIPTION_DELETED } from '../../../events/event.constants';
import { SubscriptionStatus, CreditSource, CreditStatus } from '@prisma/client';

@Injectable()
export class SubscriptionDeletedStrategy implements WebhookStrategy {
  private readonly logger = new Logger(SubscriptionDeletedStrategy.name);

  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  canHandle(eventType: string): boolean {
    return eventType === 'customer.subscription.deleted';
  }

  async handle(event: Stripe.Event): Promise<void> {
    const stripeSub = event.data.object as Stripe.Subscription;

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId: stripeSub.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription ${stripeSub.id} not found for customer.subscription.deleted`,
      );
      return;
    }

    const freePlan = await this.prisma.plan.findUnique({
      where: { slug: 'free' },
      include: { prices: true },
    });
    if (!freePlan || freePlan.prices.length === 0) {
      throw new Error('Free plan not found');
    }
    const freePlanPrice = freePlan.prices[0];

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
          stripeSubscriptionId: null, // Local free subscription has no Stripe ID
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(
            new Date().setMonth(new Date().getMonth() + 1),
          ), // 1 month
        },
      });

      // Freeze active add-on credits
      await tx.creditBalance.updateMany({
        where: {
          userId: subscription.userId,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        data: { status: CreditStatus.FROZEN, frozenAt: new Date() },
      });

      // Create MONTHLY for Free
      await tx.creditBalance.create({
        data: {
          userId: subscription.userId,
          source: CreditSource.MONTHLY,
          sourceRef: newSub.id,
          totalCredits: freePlan.creditsIncluded,
          remainingCredits: freePlan.creditsIncluded,
          status: CreditStatus.ACTIVE,
          periodStart: newSub.currentPeriodStart,
          periodEnd: newSub.currentPeriodEnd,
        },
      });
    });

    this.eventEmitter.emit(SUBSCRIPTION_DELETED, {
      subscriptionId: subscription.id,
    });
  }
}
