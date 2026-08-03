import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { WebhookStrategy } from './webhook-strategy.interface';
import { SubscriptionStatus, CreditSource, CreditStatus } from '@prisma/client';
import { SUBSCRIPTION_PAYMENT_FAILED } from '../../../events/event.constants';

@Injectable()
export class InvoicePaymentFailedStrategy implements WebhookStrategy {
  private readonly logger = new Logger(InvoicePaymentFailedStrategy.name);

  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  canHandle(eventType: string): boolean {
    return eventType === 'invoice.payment_failed';
  }

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

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId,
        userId: user.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription ${stripeSubscriptionId} not found or not active for invoice.payment_failed`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark subscription as PAST_DUE
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.PAST_DUE },
      });

      // Freeze add-on credits
      await tx.creditBalance.updateMany({
        where: {
          userId: user.id,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        data: { status: CreditStatus.FROZEN, frozenAt: new Date() },
      });
    });

    this.eventEmitter.emit(SUBSCRIPTION_PAYMENT_FAILED, {
      subscriptionId: subscription.id,
    });
  }
}
