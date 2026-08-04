import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '../../../events/payment.events';
import type { SubscriptionDeletedEvent } from '../../../events/payment.events';
import { SubscriptionStatus, CreditSource, CreditStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SUBSCRIPTION_DELETED } from '../../../events/event.constants';

@Injectable()
export class SubscriptionDeletedListener {
  private readonly logger = new Logger(SubscriptionDeletedListener.name);

  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
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
          stripeSubscriptionId: null,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(
            new Date().setMonth(new Date().getMonth() + 1),
          ),
        },
      });

      await tx.creditBalance.updateMany({
        where: {
          userId: subscription.userId,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        data: { status: CreditStatus.FROZEN, frozenAt: new Date() },
      });

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
