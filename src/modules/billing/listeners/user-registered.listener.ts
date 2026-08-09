import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { USER_REGISTERED } from '@/events/event.constants';
import type { DomainEvent } from '@/events/domain-event';
import { createDomainEvent } from '@/events/domain-event';
import { BillingUoW } from '../billing.uow';
import { BillingOutboxWriter } from '@/modules/event-outbox/services/billing-outbox-writer.service';
import { BillingOutboxRelay } from '@/modules/event-outbox/providers/outbox-relay.service';
import { PaymentProviderFactory } from '@/modules/payment/factories/payment-provider.factory';
import { PaymentProvider } from '@/modules/payment/enums/payment-provider.enum';
import { SubscriptionStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '@/common/constants/config.constants';

import { SUBSCRIPTION_CREATED } from '@/events/event.constants';
import type { SubscriptionCreatedPayload } from '@/events/payloads/billing-payloads';

@Injectable()
export class UserRegisteredListener {
  private readonly logger = new Logger(UserRegisteredListener.name);

  constructor(
    private readonly uow: BillingUoW,
    private readonly outboxWriter: BillingOutboxWriter,
    private readonly relay: BillingOutboxRelay,
    private readonly paymentFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent(USER_REGISTERED)
  async handle(
    event: DomainEvent<{ userId: string; email: string }>,
  ): Promise<void> {
    const { userId, email } = event.payload;

    try {
      await this.uow.execute(async (repos) => {
        const existingInbox = await repos.tx.billingInbox.findUnique({
          where: { eventId: event.id },
        });

        if (existingInbox) {
          this.logger.debug(`Event ${event.id} already processed. Skipping.`);
          return;
        }

        await repos.tx.billingInbox.create({
          data: {
            eventId: event.id,
            type: event.type,
          },
        });

        const freePlanPriceId = this.configService.get<string>(
          CONFIG_KEYS.STRIPE_FREE_PLAN_PRICE_ID,
        );
        if (!freePlanPriceId) {
          throw new Error('STRIPE_FREE_PLAN_PRICE_ID is not configured');
        }

        const planPrice =
          await repos.planPrice.findByStripePriceId(freePlanPriceId);
        if (!planPrice) {
          throw new Error(
            `PlanPrice with stripePriceId ${freePlanPriceId} not found`,
          );
        }

        const plan = await repos.plan.findById(planPrice.planId);
        if (!plan) {
          throw new Error(`Plan with id ${planPrice.planId} not found`);
        }

        const paymentAdapter = this.paymentFactory.getAdapter(
          PaymentProvider.STRIPE,
        );
        const customer = await paymentAdapter.createCustomer(email);

        const stripeSub = await paymentAdapter.createSubscription(
          customer.id,
          freePlanPriceId,
        );

        await repos.subscription.create({
          userId,
          planId: planPrice.planId,
          planPriceId: planPrice.id,
          stripeSubscriptionId: stripeSub.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(
            new Date().setMonth(new Date().getMonth() + 1),
          ), // Rough estimate, webhook will correct it
        });

        const successEvent = createDomainEvent<SubscriptionCreatedPayload>(
          SUBSCRIPTION_CREATED,
          {
            userId,
            stripeCustomerId: customer.id,
            freePlanCredits: plan.creditsIncluded,
          },
          {
            causationId: event.id,
            correlationId: event.metadata.correlationId,
          },
        );
        await this.outboxWriter.insert(repos.tx, successEvent);
      });

      await this.relay.kick();
    } catch (error) {
      this.logger.error(
        `Failed to handle USER_REGISTERED for user ${userId}`,
        error,
      );
    }
  }
}
