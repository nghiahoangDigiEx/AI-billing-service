import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentProviderFactory } from '@/modules/payment/factories/payment-provider.factory';
import { PaymentProvider } from '@/modules/payment/enums/payment-provider.enum';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { USER_REGISTERED_SUCCESS } from '@/events/event.constants';
import { CONFIG_KEYS } from '@/common/constants/config.constants';
import { CreditSource, CreditStatus, SubscriptionStatus } from '@prisma/client';
import { PLAN_SLUGS } from '@/modules/billing/constants/billing.constants';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(process.env[CONFIG_KEYS.BILLING_RETRY_INTERVAL] || '*/5 * * * *')
  async processPendingStripeSetup() {
    this.logger.debug(
      'Running background job to process pending Stripe setup...',
    );

    const maxRetries =
      this.configService.get<number>(CONFIG_KEYS.BILLING_MAX_RETRIES) || 5;

    const users = await this.prisma.user.findMany({
      where: {
        pendingStripeSetup: true,
      },
    });

    if (users.length === 0) return;

    this.logger.log(`Found ${users.length} users pending Stripe setup`);

    // Fetch free plan
    const freePlan = await this.prisma.plan.findUnique({
      where: { slug: PLAN_SLUGS.FREE },
      include: { prices: true },
    });

    if (!freePlan || freePlan.prices.length === 0) {
      this.logger.error(
        'Free plan not found in database. Skipping Stripe setup.',
      );
      return;
    }
    const freePlanPrice = freePlan.prices[0];

    for (const user of users) {
      const backoffMinutes =
        user.retryCount === 0 ? 0 : Math.pow(5, user.retryCount - 1) * 5;
      const nextRetryTime = new Date(
        user.updatedAt.getTime() + backoffMinutes * 60 * 1000,
      );

      if (user.retryCount >= maxRetries) {
        this.logger.error(
          `Max retries exceeded for user ${user.id} during Stripe setup.`,
        );
        continue;
      }

      if (new Date() < nextRetryTime) {
        continue; // Wait for next retry window
      }

      try {
        let stripeCustomerId = user.stripeCustomerId;

        // 1. Create Stripe Customer if missing
        if (!stripeCustomerId) {
          const adapter = this.paymentProviderFactory.getAdapter(
            PaymentProvider.STRIPE,
          );
          const customer = await adapter.createCustomer(
            user.email,
            user.name || '',
          );
          stripeCustomerId = customer.id;
        }

        // 2. Create Free Subscription
        await this.prisma.$transaction(async (tx) => {
          const currentUser = await tx.user.findUnique({
            where: { id: user.id },
          });
          if (!currentUser?.pendingStripeSetup) return;

          const newSub = await tx.subscription.create({
            data: {
              userId: user.id,
              planId: freePlan.id,
              planPriceId: freePlanPrice.id,
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(
                new Date().setMonth(new Date().getMonth() + 1),
              ), // 1 month
            },
          });

          // Create CreditBalance
          await tx.creditBalance.create({
            data: {
              userId: user.id,
              source: CreditSource.MONTHLY,
              sourceRef: newSub.id,
              totalCredits: freePlan.creditsIncluded,
              remainingCredits: freePlan.creditsIncluded,
              status: CreditStatus.ACTIVE,
              periodStart: newSub.currentPeriodStart,
              periodEnd: newSub.currentPeriodEnd,
            },
          });

          // Update user
          await tx.user.update({
            where: { id: user.id },
            data: {
              pendingStripeSetup: false,
              stripeCustomerId,
            },
          });
        });

        this.logger.log(
          `Successfully completed pending Stripe setup for user ${user.id}`,
        );
        this.eventEmitter.emit(USER_REGISTERED_SUCCESS, { userId: user.id });
      } catch (error) {
        this.logger.error(
          `Failed to process Stripe setup for user ${user.id}`,
          error,
        );

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            retryCount: { increment: 1 },
          },
        });
      }
    }
  }
}
