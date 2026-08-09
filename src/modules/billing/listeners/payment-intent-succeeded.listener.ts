import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentEvents } from '@/events/payment.events';
import type { PaymentIntentSucceededEvent } from '@/events/payment.events';
import { ADDON_PURCHASED } from '@/events/event.constants';
import { createDomainEvent } from '@/events/domain-event';
import type { AddonPurchasedPayload } from '@/events/payloads/billing-payloads';
import { BillingOutboxWriter } from '@/modules/event-outbox/services/billing-outbox-writer.service';
import { BillingOutboxRelay } from '@/modules/event-outbox/providers/outbox-relay.service';

@Injectable()
export class PaymentIntentSucceededListener {
  private readonly logger = new Logger(PaymentIntentSucceededListener.name);

  constructor(
    private prisma: PrismaService,
    private readonly outboxWriter: BillingOutboxWriter,
    private readonly relay: BillingOutboxRelay,
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

    const domainEventPayload: AddonPurchasedPayload = {
      userId,
      credits: addonPackage.credits,
      sourceRef: event.paymentIntentId,
    };

    await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.addonPurchase.create({
        data: {
          userId,
          addonPackageId,
          stripePaymentIntentId: event.paymentIntentId,
        },
      });

      const domainEvent = createDomainEvent<AddonPurchasedPayload>(
        ADDON_PURCHASED,
        {
          ...domainEventPayload,
          sourceRef: purchase.id,
        },
        {
          providerEventId: event.providerEventId,
          causationId: event.providerEventId,
          correlationId: event.providerEventId,
        },
        { id: purchase.id },
      );

      await this.outboxWriter.insert(tx, domainEvent);
    });

    this.logger.log(
      `Successfully processed add-on purchase for user ${userId}`,
    );

    await this.relay.kick();
  }
}
