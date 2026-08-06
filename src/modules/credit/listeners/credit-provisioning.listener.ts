import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CreditService } from '@/modules/credit/credit.service';
import type { DomainEvent } from '@/events/domain-event';
import {
  INVOICE_PAID,
  ADDON_PURCHASED,
  SUBSCRIPTION_PAYMENT_FAILED,
  SUBSCRIPTION_DELETED,
} from '@/events/event.constants';
import type {
  InvoicePaidPayload,
  AddonPurchasedPayload,
  SubscriptionPaymentFailedPayload,
  SubscriptionDeletedPayload,
} from '@/events/payloads';

@Injectable()
export class CreditProvisioningListener {
  private readonly logger = new Logger(CreditProvisioningListener.name);

  constructor(private readonly creditService: CreditService) {}

  @OnEvent(INVOICE_PAID)
  async handleInvoicePaid(
    event: DomainEvent<InvoicePaidPayload>,
  ): Promise<void> {
    const payload = event.payload;

    this.logger.log(
      `Processing invoice.paid event ${event.id} for user ${payload.userId}`,
    );

    await this.creditService.provisionMonthlyCredits({
      eventId: event.id,
      eventType: event.type,
      userId: payload.userId,
      creditsIncluded: payload.creditsIncluded,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      sourceRef: payload.sourceRef,
      planSlug: payload.planSlug,
    });
  }

  @OnEvent(ADDON_PURCHASED)
  async handleAddonPurchased(
    event: DomainEvent<AddonPurchasedPayload>,
  ): Promise<void> {
    const payload = event.payload;

    this.logger.log(
      `Processing addon.purchased event ${event.id} for user ${payload.userId}`,
    );

    await this.creditService.provisionAddonCredits({
      eventId: event.id,
      eventType: event.type,
      userId: payload.userId,
      credits: payload.credits,
      sourceRef: payload.sourceRef,
    });
  }

  @OnEvent(SUBSCRIPTION_PAYMENT_FAILED)
  async handlePaymentFailed(
    event: DomainEvent<SubscriptionPaymentFailedPayload>,
  ): Promise<void> {
    const payload = event.payload;

    this.logger.log(
      `Processing subscription.payment_failed event ${event.id} for user ${payload.userId}`,
    );

    await this.creditService.freezeAddonCredits(
      event.id,
      event.type,
      payload.userId,
      payload.sourceRef,
    );
  }

  @OnEvent(SUBSCRIPTION_DELETED)
  async handleSubscriptionDeleted(
    event: DomainEvent<SubscriptionDeletedPayload>,
  ): Promise<void> {
    const payload = event.payload;

    this.logger.log(
      `Processing subscription.deleted event ${event.id} for user ${payload.userId}`,
    );

    await this.creditService.freezeAddonCredits(
      event.id,
      event.type,
      payload.userId,
      payload.sourceRef,
    );

    await this.creditService.provisionMonthlyCredits({
      eventId: event.id,
      eventType: event.type,
      userId: payload.userId,
      creditsIncluded: payload.freePlanCredits,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      sourceRef: payload.sourceRef,
      planSlug: 'free',
    });
  }
}
