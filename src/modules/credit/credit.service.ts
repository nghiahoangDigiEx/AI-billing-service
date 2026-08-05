import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreditSource,
  CreditStatus,
  CreditTransactionType,
  Prisma,
} from '@prisma/client';
import { PLAN_SLUGS } from '@/modules/billing/constants/billing.constants';
import { SortOrder } from '@/common/enums/sort-order.enum';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async isEventProcessed(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<boolean> {
    const existing = await tx.creditInbox.findUnique({
      where: { eventId },
    });

    return existing !== null;
  }

  async provisionMonthlyCredits(params: {
    eventId: string;
    eventType: string;
    userId: string;
    creditsIncluded: number;
    periodStart: Date;
    periodEnd: Date;
    sourceRef: string;
    planSlug?: string;
  }): Promise<void> {
    const {
      eventId,
      eventType,
      userId,
      creditsIncluded,
      periodStart,
      periodEnd,
      sourceRef,
      planSlug,
    } = params;

    await this.prisma.$transaction(async (tx) => {
      if (await this.isEventProcessed(tx, eventId)) {
        return;
      }

      await tx.creditBalance.updateMany({
        where: {
          userId,
          source: CreditSource.MONTHLY,
          status: CreditStatus.ACTIVE,
        },
        data: { status: CreditStatus.EXHAUSTED },
      });

      const balance = await tx.creditBalance.create({
        data: {
          userId,
          source: CreditSource.MONTHLY,
          sourceRef,
          totalCredits: creditsIncluded,
          remainingCredits: creditsIncluded,
          status: CreditStatus.ACTIVE,
          periodStart,
          periodEnd,
        },
      });

      await tx.creditTransaction.create({
        data: {
          creditBalanceId: balance.id,
          type: CreditTransactionType.PROVISION,
          amount: creditsIncluded,
          balanceAfter: creditsIncluded,
          sourceRef,
          description: 'Monthly credit provision',
        },
      });

      if (planSlug === PLAN_SLUGS.FREE) {
        await tx.creditBalance.updateMany({
          where: {
            userId,
            source: CreditSource.ADDON,
            status: CreditStatus.ACTIVE,
          },
          data: { status: CreditStatus.FROZEN, frozenAt: new Date() },
        });
      } else {
        await tx.creditBalance.updateMany({
          where: {
            userId,
            source: CreditSource.ADDON,
            status: CreditStatus.FROZEN,
          },
          data: { status: CreditStatus.ACTIVE, unfrozenAt: new Date() },
        });
      }

      await tx.creditInbox.create({
        data: {
          eventId,
          type: eventType,
        },
      });
    });

    this.logger.log(
      `Provisioned ${creditsIncluded} monthly credits for user ${userId}`,
    );
  }

  async provisionAddonCredits(params: {
    eventId: string;
    eventType: string;
    userId: string;
    credits: number;
    sourceRef: string;
  }): Promise<void> {
    const { eventId, eventType, userId, credits, sourceRef } = params;

    await this.prisma.$transaction(async (tx) => {
      if (await this.isEventProcessed(tx, eventId)) {
        return;
      }

      const balance = await tx.creditBalance.create({
        data: {
          userId,
          source: CreditSource.ADDON,
          sourceRef,
          totalCredits: credits,
          remainingCredits: credits,
          status: CreditStatus.ACTIVE,
          purchasedAt: new Date(),
        },
      });

      await tx.creditTransaction.create({
        data: {
          creditBalanceId: balance.id,
          type: CreditTransactionType.PROVISION,
          amount: credits,
          balanceAfter: credits,
          sourceRef,
          description: 'Add-on credit provision',
        },
      });

      await tx.creditInbox.create({
        data: {
          eventId,
          type: eventType,
        },
      });
    });

    this.logger.log(`Provisioned ${credits} add-on credits for user ${userId}`);
  }

  async freezeAddonCredits(
    eventId: string,
    eventType: string,
    userId: string,
    sourceRef: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (await this.isEventProcessed(tx, eventId)) {
        return;
      }

      const frozenBalances = await tx.creditBalance.updateMany({
        where: {
          userId,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        data: { status: CreditStatus.FROZEN, frozenAt: new Date() },
      });

      if (frozenBalances.count > 0) {
        const activeAddons = await tx.creditBalance.findMany({
          where: {
            userId,
            source: CreditSource.ADDON,
            status: CreditStatus.FROZEN,
          },
        });

        for (const balance of activeAddons) {
          await tx.creditTransaction.create({
            data: {
              creditBalanceId: balance.id,
              type: CreditTransactionType.FREEZE,
              amount: 0,
              balanceAfter: balance.remainingCredits,
              sourceRef,
              description: 'Add-on credits frozen',
            },
          });
        }
      }

      await tx.creditInbox.create({
        data: {
          eventId,
          type: eventType,
        },
      });
    });

    this.logger.log(`Frozen add-on credits for user ${userId}`);
  }

  async unfreezeAddonCredits(
    eventId: string,
    eventType: string,
    userId: string,
    sourceRef: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (await this.isEventProcessed(tx, eventId)) {
        return;
      }

      const unfrozenBalances = await tx.creditBalance.updateMany({
        where: {
          userId,
          source: CreditSource.ADDON,
          status: CreditStatus.FROZEN,
        },
        data: { status: CreditStatus.ACTIVE, unfrozenAt: new Date() },
      });

      if (unfrozenBalances.count > 0) {
        const activeAddons = await tx.creditBalance.findMany({
          where: {
            userId,
            source: CreditSource.ADDON,
            status: CreditStatus.ACTIVE,
          },
        });

        for (const balance of activeAddons) {
          await tx.creditTransaction.create({
            data: {
              creditBalanceId: balance.id,
              type: CreditTransactionType.UNFREEZE,
              amount: 0,
              balanceAfter: balance.remainingCredits,
              sourceRef,
              description: 'Add-on credits unfrozen',
            },
          });
        }
      }

      await tx.creditInbox.create({
        data: {
          eventId,
          type: eventType,
        },
      });
    });

    this.logger.log(`Unfrozen add-on credits for user ${userId}`);
  }

  async consumeCredits(params: {
    userId: string;
    amount: number;
    sourceRef: string;
  }): Promise<void> {
    const { userId, amount, sourceRef } = params;

    await this.prisma.$transaction(async (tx) => {
      const activeBalance = await tx.creditBalance.findFirst({
        where: {
          userId,
          status: CreditStatus.ACTIVE,
          remainingCredits: { gte: amount },
        },
        orderBy: { createdAt: SortOrder.ASC },
      });

      if (!activeBalance) {
        throw new Error('Insufficient credits');
      }

      const newRemaining = activeBalance.remainingCredits - amount;

      await tx.creditBalance.update({
        where: { id: activeBalance.id },
        data: { remainingCredits: newRemaining },
      });

      await tx.creditTransaction.create({
        data: {
          creditBalanceId: activeBalance.id,
          type: CreditTransactionType.CONSUME,
          amount: -amount,
          balanceAfter: newRemaining,
          sourceRef,
          description: 'Credit consumption',
        },
      });
    });

    this.logger.log(`Consumed ${amount} credits for user ${userId}`);
  }
}
