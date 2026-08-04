import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '../../../events/payment.events';
import type { PaymentIntentSucceededEvent } from '../../../events/payment.events';
import { CreditSource, CreditStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ADDON_PURCHASED } from '../../../events/event.constants';

@Injectable()
export class PaymentIntentSucceededListener {
  private readonly logger = new Logger(PaymentIntentSucceededListener.name);

  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(PaymentEvents.PAYMENT_INTENT_SUCCEEDED)
  async handle(event: PaymentIntentSucceededEvent): Promise<void> {
    const { userId, addonId: addonPackageId } = event.metadata;
    if (!userId || !addonPackageId) {
      this.logger.log(
        `PaymentIntent ${event.paymentIntentId} missing addon metadata. Skipping.`,
      );
      return;
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
          stripePaymentIntentId: event.paymentIntentId,
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
