import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CreditService } from '@/modules/credit/credit.service';
import type { DomainEvent } from '@/events/domain-event';
import {
  INVOICE_PAID,
  ADDON_PURCHASED,
  SUBSCRIPTION_PAYMENT_FAILED,
  SUBSCRIPTION_DOWNGRADED,
  SUBSCRIPTION_CREATED,
  SUBSCRIPTION_RECOVERED,
} from '@/events/event.constants';
import type {
  InvoicePaidPayload,
  AddonPurchasedPayload,
  SubscriptionPaymentFailedPayload,
  SubscriptionDowngradedPayload,
  SubscriptionCreatedPayload,
  SubscriptionRecoveredPayload,
} from '@/events/payloads/billing-payloads';

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

  @OnEvent(SUBSCRIPTION_DOWNGRADED)
  async handleSubscriptionDowngraded(
    event: DomainEvent<SubscriptionDowngradedPayload>,
  ): Promise<void> {
    const payload = event.payload;

    this.logger.log(
      `Processing subscription.downgraded event ${event.id} for user ${payload.userId}`,
    );

    await this.creditService.freezeAddonCredits(
      event.id,
      event.type,
      payload.userId,
      payload.newSubscriptionId,
    );

    await this.creditService.provisionMonthlyCredits({
      eventId: event.id,
      eventType: event.type,
      userId: payload.userId,
      creditsIncluded: payload.freePlanCredits,
      periodStart: new Date(),
      periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Rough estimate, webhook corrects this
      sourceRef: payload.newSubscriptionId,
      planSlug: 'free',
    });
  }

  @OnEvent(SUBSCRIPTION_CREATED)
  async handleSubscriptionCreated(
    event: DomainEvent<SubscriptionCreatedPayload>,
  ): Promise<void> {
    const payload = event.payload;

    this.logger.log(
      `Processing subscription.created event ${event.id} for user ${payload.userId}`,
    );

    // In a real app we'd fetch the free plan credits from DB. For now, hardcode or fetch.
    await this.creditService.provisionMonthlyCredits({
      eventId: event.id,
      eventType: event.type,
      userId: payload.userId,
      creditsIncluded: 100, // Assuming 100 for Free plan
      periodStart: new Date(),
      periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      sourceRef: event.id,
      planSlug: 'free',
    });
  }

  @OnEvent(SUBSCRIPTION_RECOVERED)
  async handleSubscriptionRecovered(
    event: DomainEvent<SubscriptionRecoveredPayload>,
  ): Promise<void> {
    const payload = event.payload;

    this.logger.log(
      `Processing subscription.recovered event ${event.id} for user ${payload.userId}`,
    );

    await this.creditService.unfreezeAddonCredits(
      event.id,
      event.type,
      payload.userId,
      payload.sourceRef,
    );
  }
}
