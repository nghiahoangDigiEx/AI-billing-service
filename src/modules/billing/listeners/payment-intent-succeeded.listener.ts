import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '@/events/payment.events';
import type { PaymentIntentSucceededEvent } from '@/events/payment.events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ADDON_PURCHASED } from '@/events/event.constants';

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

    const purchase = await this.prisma.addonPurchase.create({
      data: {
        userId,
        addonPackageId,
        stripePaymentIntentId: event.paymentIntentId,
      },
    });

    this.logger.log(
      `Successfully processed add-on purchase for user ${userId}`,
    );

    this.eventEmitter.emit(ADDON_PURCHASED, {
      userId,
      credits: addonPackage.credits,
      sourceRef: purchase.id,
    });
  }
}
