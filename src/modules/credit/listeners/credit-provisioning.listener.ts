import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CreditService } from '@/modules/credit/credit.service';
import {
  INVOICE_PAID,
  ADDON_PURCHASED,
  SUBSCRIPTION_PAYMENT_FAILED,
  SUBSCRIPTION_DELETED,
} from '@/events/event.constants';

export interface InvoicePaidPayload {
  userId: string;
  creditsIncluded: number;
  periodStart: Date;
  periodEnd: Date;
  sourceRef: string;
  planSlug?: string;
}

export interface AddonPurchasedPayload {
  userId: string;
  credits: number;
  sourceRef: string;
}

export interface SubscriptionPaymentFailedPayload {
  userId: string;
  sourceRef: string;
}

export interface SubscriptionDeletedPayload {
  userId: string;
  freePlanCredits: number;
  periodStart: Date;
  periodEnd: Date;
  sourceRef: string;
}

@Injectable()
export class CreditProvisioningListener {
  private readonly logger = new Logger(CreditProvisioningListener.name);

  constructor(private readonly creditService: CreditService) {}

  @OnEvent(INVOICE_PAID)
  async handleInvoicePaid(payload: InvoicePaidPayload): Promise<void> {
    try {
      await this.creditService.provisionMonthlyCredits({
        userId: payload.userId,
        creditsIncluded: payload.creditsIncluded,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        sourceRef: payload.sourceRef,
        planSlug: payload.planSlug,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to provision monthly credits for user ${payload.userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent(ADDON_PURCHASED)
  async handleAddonPurchased(payload: AddonPurchasedPayload): Promise<void> {
    try {
      await this.creditService.provisionAddonCredits({
        userId: payload.userId,
        credits: payload.credits,
        sourceRef: payload.sourceRef,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to provision add-on credits for user ${payload.userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent(SUBSCRIPTION_PAYMENT_FAILED)
  async handlePaymentFailed(
    payload: SubscriptionPaymentFailedPayload,
  ): Promise<void> {
    try {
      await this.creditService.freezeAddonCredits(
        payload.userId,
        payload.sourceRef,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to freeze add-on credits for user ${payload.userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent(SUBSCRIPTION_DELETED)
  async handleSubscriptionDeleted(
    payload: SubscriptionDeletedPayload,
  ): Promise<void> {
    try {
      await this.creditService.freezeAddonCredits(
        payload.userId,
        payload.sourceRef,
      );

      await this.creditService.provisionMonthlyCredits({
        userId: payload.userId,
        creditsIncluded: payload.freePlanCredits,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        sourceRef: payload.sourceRef,
        planSlug: 'free',
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to handle subscription deleted for user ${payload.userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
