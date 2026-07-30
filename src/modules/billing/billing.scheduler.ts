import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(process.env.BILLING_RETRY_INTERVAL || '*/5 * * * *')
  async processPendingStripeSetup() {
    this.logger.debug(
      'Running background job to process pending Stripe setup...',
    );

    const maxRetries =
      this.configService.get<number>('BILLING_MAX_RETRIES') || 5;

    const users = await this.prisma.user.findMany({
      where: {
        pendingStripeSetup: true,
      },
    });

    if (users.length === 0) return;

    this.logger.log(`Found ${users.length} users pending Stripe setup`);

    // Fetch free plan
    const freePlan = await this.prisma.plan.findUnique({
      where: { slug: 'free' },
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
      // Exponential backoff logic based on retryCount
      // Backoff times: 0 -> immediate, 1 -> 5m, 2 -> 25m, 3 -> 125m, 4 -> 625m
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
          const customer = await this.stripeService.createCustomer(
            user.email,
            user.name || '',
          );
          stripeCustomerId = customer.id;
        }

        // 2. Create Free Subscription
        await this.prisma.$transaction(async (tx) => {
          // Verify user hasn't setup Stripe in another process
          const currentUser = await tx.user.findUnique({
            where: { id: user.id },
          });
          if (!currentUser?.pendingStripeSetup) return;

          // Create free subscription in DB
          const newSub = await tx.subscription.create({
            data: {
              userId: user.id,
              planId: freePlan.id,
              planPriceId: freePlanPrice.id,
              status: 'ACTIVE',
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
              source: 'MONTHLY',
              sourceRef: newSub.id,
              totalCredits: 100, // Hardcoded fallback based on webhook logic
              remainingCredits: 100,
              status: 'ACTIVE',
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
        this.eventEmitter.emit('user.registered.success', { userId: user.id });
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
