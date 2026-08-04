import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '../../../events/payment.events';
import type { InvoicePaymentFailedEvent } from '../../../events/payment.events';
import { SubscriptionStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SUBSCRIPTION_PAYMENT_FAILED } from '../../../events/event.constants';

@Injectable()
export class InvoicePaymentFailedListener {
  private readonly logger = new Logger(InvoicePaymentFailedListener.name);

  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
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

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.PAST_DUE },
    });

    this.eventEmitter.emit(SUBSCRIPTION_PAYMENT_FAILED, {
      userId: user.id,
      sourceRef: event.providerEventId,
    });
  }
}
