import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { StripeEventStrategy } from './stripe-event.strategy';
import { SubscriptionStatus, CreditSource, CreditStatus } from '@prisma/client';

@Injectable()
export class InvoicePaidStrategy implements StripeEventStrategy {
  private readonly logger = new Logger(InvoicePaidStrategy.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async handle(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const invoiceWithSub = invoice as Stripe.Invoice & {
      subscription?: string;
    };
    if (!invoiceWithSub.subscription) return;
    const stripeSubscriptionId = invoiceWithSub.subscription;

    const stripeCustomerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (!stripeCustomerId) {
      this.logger.warn(`Invoice ${invoice.id} has no customer ID.`);
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId },
    });

    if (!user) {
      this.logger.warn(
        `User with stripeCustomerId ${stripeCustomerId} not found.`,
      );
      return;
    }

    const lineItem = invoice.lines.data[0] as Stripe.InvoiceLineItem & {
      price?: Stripe.Price | string | null;
    };
    const priceId =
      typeof lineItem.price === 'string' ? lineItem.price : lineItem.price?.id;
    if (!priceId) {
      this.logger.warn(`Invoice ${invoice.id} has no price ID in lines.`);
      return;
    }

    const planPrice = await this.prisma.planPrice.findFirst({
      where: { stripePriceId: priceId },
      include: { plan: true },
    });

    if (!planPrice) {
      this.logger.warn(`PlanPrice with stripePriceId ${priceId} not found.`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const activeSubscription = await tx.subscription.findFirst({
        where: { stripeSubscriptionId, status: SubscriptionStatus.ACTIVE },
      });

      let subscriptionId: string;

      const periodStart = new Date(invoice.lines.data[0].period.start * 1000);
      const periodEnd = new Date(invoice.lines.data[0].period.end * 1000);

      if (!activeSubscription) {
        // Create new
        const newSub = await tx.subscription.create({
          data: {
            userId: user.id,
            planId: planPrice.planId,
            planPriceId: planPrice.id,
            stripeSubscriptionId,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
        });
        subscriptionId = newSub.id;
      } else {
        // If it exists, check if the price changed (upgrade/downgrade history tracking)
        if (activeSubscription.planPriceId !== planPrice.id) {
          await tx.subscription.update({
            where: { id: activeSubscription.id },
            data: { status: SubscriptionStatus.CANCELLED },
          });

          const newSub = await tx.subscription.create({
            data: {
              userId: user.id,
              planId: planPrice.planId,
              planPriceId: planPrice.id,
              stripeSubscriptionId,
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            },
          });
          subscriptionId = newSub.id;
        } else {
          // Normal renewal or recovery from PAST_DUE
          await tx.subscription.update({
            where: { id: activeSubscription.id },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            },
          });
          subscriptionId = activeSubscription.id;
        }
      }

      // Mark previous MONTHLY CreditBalance as EXHAUSTED
      await tx.creditBalance.updateMany({
        where: {
          userId: user.id,
          source: CreditSource.MONTHLY,
          status: CreditStatus.ACTIVE,
        },
        data: { status: CreditStatus.EXHAUSTED },
      });

      // Unfreeze add-on balances if recovering
      await tx.creditBalance.updateMany({
        where: {
          userId: user.id,
          source: CreditSource.ADDON,
          status: CreditStatus.FROZEN,
        },
        data: { status: CreditStatus.ACTIVE, unfrozenAt: new Date() },
      });

      // Create new MONTHLY CreditBalance
      const creditsIncluded = Number(planPrice.plan.creditsIncluded) || 0;

      await tx.creditBalance.create({
        data: {
          userId: user.id,
          source: CreditSource.MONTHLY,
          sourceRef: invoice.id,
          totalCredits: creditsIncluded,
          remainingCredits: creditsIncluded,
          status: CreditStatus.ACTIVE,
          periodStart,
          periodEnd,
        },
      });

      this.eventEmitter.emit('invoice.paid', { subscriptionId });
    });
  }
}
