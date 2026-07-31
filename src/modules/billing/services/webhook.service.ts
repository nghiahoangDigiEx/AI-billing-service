import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, WebhookEventStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import {
  INVOICE_PAID,
  SUBSCRIPTION_PAYMENT_FAILED,
  SUBSCRIPTION_DELETED,
  ADDON_PURCHASED,
} from '../../../events/event.constants';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async processEvent(event: Stripe.Event) {
    // Idempotency check
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
      return;
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

    try {
      switch (event.type) {
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        default:
          this.logger.log(`Unsupported event type: ${event.type}`);
      }

      // Record successful processing
      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error processing webhook event ${event.id}:`, error);
      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: {
          status: WebhookEventStatus.FAILED,
          errorMessage: error.message || 'Unknown error',
        },
      });
      throw error; // Let the controller catch this and return 500
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const invoiceWithSub = invoice as Stripe.Invoice & {
      subscription?: string;
    };
    if (!invoiceWithSub.subscription) return;
    const stripeSubscriptionId = invoiceWithSub.subscription;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription ${stripeSubscriptionId} not found for invoice.paid`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // If recovering from PAST_DUE
      if (subscription.status === 'PAST_DUE') {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: 'ACTIVE' },
        });
      }

      // Mark previous MONTHLY CreditBalance as EXHAUSTED
      await tx.creditBalance.updateMany({
        where: {
          userId: subscription.userId,
          source: 'MONTHLY',
          status: 'ACTIVE',
        },
        data: { status: 'EXHAUSTED' },
      });

      // Unfreeze add-on balances if recovering
      if (subscription.status === 'PAST_DUE') {
        await tx.creditBalance.updateMany({
          where: {
            userId: subscription.userId,
            source: 'ADDON',
            status: 'FROZEN',
          },
          data: { status: 'ACTIVE', unfrozenAt: new Date() },
        });
      }

      // Create new MONTHLY CreditBalance
      const periodStart = new Date(invoice.lines.data[0].period.start * 1000);
      const periodEnd = new Date(invoice.lines.data[0].period.end * 1000);

      await tx.creditBalance.create({
        data: {
          userId: subscription.userId,
          source: 'MONTHLY',
          sourceRef: invoice.id,
          totalCredits: subscription.plan.creditsIncluded,
          remainingCredits: subscription.plan.creditsIncluded,
          status: 'ACTIVE',
          periodStart,
          periodEnd,
        },
      });
    });

    this.logger.log(
      `Successfully processed invoice.paid for ${subscription.id}`,
    );
    this.eventEmitter.emit(INVOICE_PAID, { subscriptionId: subscription.id });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const invoiceWithSub = invoice as Stripe.Invoice & {
      subscription?: string;
    };
    if (!invoiceWithSub.subscription) return;
    const stripeSubscriptionId = invoiceWithSub.subscription;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription ${stripeSubscriptionId} not found for invoice.payment_failed`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark subscription as PAST_DUE
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAST_DUE' },
      });

      // Freeze add-on credits
      await tx.creditBalance.updateMany({
        where: {
          userId: subscription.userId,
          source: 'ADDON',
          status: 'ACTIVE',
        },
        data: { status: 'FROZEN', frozenAt: new Date() },
      });
    });

    this.logger.log(
      `Successfully handled payment failure for ${subscription.id}`,
    );
    this.eventEmitter.emit(SUBSCRIPTION_PAYMENT_FAILED, {
      subscriptionId: subscription.id,
    });
  }

  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
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

    this.logger.log(`Successfully cancelled subscription ${subscription.id}`);
    this.eventEmitter.emit(SUBSCRIPTION_DELETED, {
      subscriptionId: subscription.id,
    });
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const { userId, addonPackageId } = paymentIntent.metadata;
    if (!userId || !addonPackageId) {
      this.logger.log(
        `PaymentIntent ${paymentIntent.id} missing addon metadata. Skipping.`,
      );
      return; // Might not be an addon purchase
    }

    const addonPackage = await this.prisma.addonPackage.findUnique({
      where: { id: addonPackageId },
    });

    if (!addonPackage) {
      this.logger.warn(
        `Addon package ${addonPackageId} not found for payment_intent.succeeded`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.addonPurchase.create({
        data: {
          userId,
          addonPackageId,
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      await tx.creditBalance.create({
        data: {
          userId,
          source: 'ADDON',
          sourceRef: purchase.id,
          totalCredits: addonPackage.credits,
          remainingCredits: addonPackage.credits,
          status: 'ACTIVE',
          purchasedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `Successfully processed add-on purchase for user ${userId}`,
    );
    this.eventEmitter.emit(ADDON_PURCHASED, { userId, addonPackageId });
  }
}
