import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { CreditService } from '@/modules/credit/credit.service';
import {
  CreditSource,
  CreditStatus,
  SubscriptionStatus,
  BillingInterval,
} from '@prisma/client';

@Injectable()
export class CreditCronService {
  private readonly logger = new Logger(CreditCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAnnualSubscriptionCreditResets() {
    this.logger.log('Starting annual subscription credit reset check');
    const now = new Date();

    try {
      const expiredBalances = await this.prisma.creditBalance.findMany({
        where: {
          source: CreditSource.MONTHLY,
          status: CreditStatus.ACTIVE,
          periodEnd: { lte: now },
          user: {
            subscriptions: {
              some: {
                status: SubscriptionStatus.ACTIVE,
                planPrice: {
                  billingInterval: BillingInterval.YEAR,
                },
              },
            },
          },
        },
        include: {
          user: {
            include: {
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE },
                include: {
                  plan: true,
                  planPrice: true,
                },
              },
            },
          },
        },
      });

      for (const balance of expiredBalances) {
        try {
          const activeSubscription = balance.user.subscriptions[0];

          if (
            !activeSubscription ||
            activeSubscription.planPrice.billingInterval !==
              BillingInterval.YEAR
          ) {
            continue;
          }

          if (!balance.periodEnd) {
            this.logger.warn(
              `Credit balance ${balance.id} has no periodEnd. Skipping.`,
            );
            continue;
          }

          const periodStart = balance.periodEnd;

          // Calculate exact next month anchored to the subscription start date to avoid day-drift
          const subStart = activeSubscription.currentPeriodStart;
          const monthsElapsed = Math.round(
            (periodStart.getTime() - subStart.getTime()) /
              (1000 * 60 * 60 * 24 * 30.436875),
          );

          const periodEnd = new Date(subStart.getTime());
          const targetMonth = subStart.getMonth() + monthsElapsed + 1;
          periodEnd.setMonth(targetMonth);
          if (periodEnd.getMonth() !== ((targetMonth % 12) + 12) % 12) {
            periodEnd.setDate(0);
          }

          if (periodEnd > activeSubscription.currentPeriodEnd) {
            this.logger.log(
              `Reached end of annual subscription cycle for user ${balance.userId}. Waiting for Stripe webhook to renew.`,
            );
            continue;
          }

          const eventId = `cron-monthly-reset-${balance.id}-${periodStart.getTime()}`;

          await this.creditService.provisionMonthlyCredits({
            eventId,
            eventType: 'cron.monthly_reset',
            userId: balance.userId,
            creditsIncluded: activeSubscription.plan.creditsIncluded,
            periodStart,
            periodEnd,
            sourceRef: activeSubscription.id,
            planSlug: activeSubscription.plan.slug,
          });

          this.logger.log(
            `Successfully reset credits for user ${balance.userId}, subscription ${activeSubscription.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to reset credits for balance ${balance.id} / user ${balance.userId}`,
            error instanceof Error ? error.stack : 'Unknown error',
          );
        }
      }

      this.logger.log(
        `Finished annual subscription credit reset check. Processed ${expiredBalances.length} balances.`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to run annual subscription credit reset check',
        error instanceof Error ? error.stack : 'Unknown error',
      );
    }
  }
}
