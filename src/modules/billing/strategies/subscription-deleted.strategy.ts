import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { StripeEventStrategy } from './stripe-event.strategy';

@Injectable()
export class SubscriptionDeletedStrategy implements StripeEventStrategy {
  private readonly logger = new Logger(SubscriptionDeletedStrategy.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async handle(event: Stripe.Event): Promise<void> {
    const stripeSub = event.data.object as Stripe.Subscription;

    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSub.id, status: 'ACTIVE' },
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
          status: 'CANCELLED',
        },
      });

      const newSub = await tx.subscription.create({
        data: {
          userId: subscription.userId,
          planId: freePlan.id,
          planPriceId: freePlanPrice.id,
          stripeSubscriptionId: null, // Local free subscription has no Stripe ID
          status: 'ACTIVE',
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
          source: 'ADDON',
          status: 'ACTIVE',
        },
        data: { status: 'FROZEN', frozenAt: new Date() },
      });

      // Create MONTHLY for Free
      await tx.creditBalance.create({
        data: {
          userId: subscription.userId,
          source: 'MONTHLY',
          sourceRef: newSub.id,
          totalCredits: freePlan.creditsIncluded,
          remainingCredits: freePlan.creditsIncluded,
          status: 'ACTIVE',
          periodStart: newSub.currentPeriodStart,
          periodEnd: newSub.currentPeriodEnd,
        },
      });
    });

    this.eventEmitter.emit('subscription.deleted', {
      subscriptionId: subscription.id,
    });
  }
}
