import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { StripeEventStrategy } from './stripe-event.strategy';
import { ADDON_PURCHASED } from '../../../events/event.constants';
import { CreditSource, CreditStatus } from '@prisma/client';

@Injectable()
export class PaymentIntentSucceededStrategy implements StripeEventStrategy {
  private readonly logger = new Logger(PaymentIntentSucceededStrategy.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async handle(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
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
          source: CreditSource.ADDON,
          sourceRef: purchase.id,
          totalCredits: addonPackage.credits,
          remainingCredits: addonPackage.credits,
          status: CreditStatus.ACTIVE,
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
