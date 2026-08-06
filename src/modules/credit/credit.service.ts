import { Injectable, Logger } from '@nestjs/common';
import { CreditUoW } from './credit.uow';
import {
  CreditSource,
  CreditStatus,
  CreditTransactionType,
} from '@prisma/client';
import { PLAN_SLUGS } from '@/modules/billing/constants/billing.constants';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly uow: CreditUoW) {}

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

    await this.uow.execute(async (repos) => {
      if (await repos.inbox.isEventProcessed(eventId)) {
        return;
      }

      await repos.balance.updateManyStatus(
        {
          userId,
          source: CreditSource.MONTHLY,
          status: CreditStatus.ACTIVE,
        },
        { status: CreditStatus.EXHAUSTED },
      );

      const balance = await repos.balance.create({
        userId,
        source: CreditSource.MONTHLY,
        sourceRef,
        totalCredits: creditsIncluded,
        remainingCredits: creditsIncluded,
        status: CreditStatus.ACTIVE,
        periodStart,
        periodEnd,
      });

      await repos.transaction.create({
        creditBalanceId: balance.id,
        type: CreditTransactionType.PROVISION,
        amount: creditsIncluded,
        balanceAfter: creditsIncluded,
        sourceRef,
        description: 'Monthly credit provision',
      });

      if (planSlug === PLAN_SLUGS.FREE) {
        await repos.balance.updateManyStatus(
          {
            userId,
            source: CreditSource.ADDON,
            status: CreditStatus.ACTIVE,
          },
          { status: CreditStatus.FROZEN, frozenAt: new Date() },
        );
      } else {
        await repos.balance.updateManyStatus(
          {
            userId,
            source: CreditSource.ADDON,
            status: CreditStatus.FROZEN,
          },
          { status: CreditStatus.ACTIVE, unfrozenAt: new Date() },
        );
      }

      await repos.inbox.markAsProcessed(eventId, eventType);
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

    await this.uow.execute(async (repos) => {
      if (await repos.inbox.isEventProcessed(eventId)) {
        return;
      }

      const balance = await repos.balance.create({
        userId,
        source: CreditSource.ADDON,
        sourceRef,
        totalCredits: credits,
        remainingCredits: credits,
        status: CreditStatus.ACTIVE,
        purchasedAt: new Date(),
      });

      await repos.transaction.create({
        creditBalanceId: balance.id,
        type: CreditTransactionType.PROVISION,
        amount: credits,
        balanceAfter: credits,
        sourceRef,
        description: 'Add-on credit provision',
      });

      await repos.inbox.markAsProcessed(eventId, eventType);
    });

    this.logger.log(`Provisioned ${credits} add-on credits for user ${userId}`);
  }

  async freezeAddonCredits(
    eventId: string,
    eventType: string,
    userId: string,
    sourceRef: string,
  ): Promise<void> {
    await this.uow.execute(async (repos) => {
      if (await repos.inbox.isEventProcessed(eventId)) {
        return;
      }

      const frozenBalances = await repos.balance.updateManyStatus(
        {
          userId,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        { status: CreditStatus.FROZEN, frozenAt: new Date() },
      );

      if (frozenBalances.count > 0) {
        const activeAddons = await repos.balance.findFrozenAddons(userId);

        for (const balance of activeAddons) {
          await repos.transaction.create({
            creditBalanceId: balance.id,
            type: CreditTransactionType.FREEZE,
            amount: 0,
            balanceAfter: balance.remainingCredits,
            sourceRef,
            description: 'Add-on credits frozen',
          });
        }
      }

      await repos.inbox.markAsProcessed(eventId, eventType);
    });

    this.logger.log(`Frozen add-on credits for user ${userId}`);
  }

  async unfreezeAddonCredits(
    eventId: string,
    eventType: string,
    userId: string,
    sourceRef: string,
  ): Promise<void> {
    await this.uow.execute(async (repos) => {
      if (await repos.inbox.isEventProcessed(eventId)) {
        return;
      }

      const unfrozenBalances = await repos.balance.updateManyStatus(
        {
          userId,
          source: CreditSource.ADDON,
          status: CreditStatus.FROZEN,
        },
        { status: CreditStatus.ACTIVE, unfrozenAt: new Date() },
      );

      if (unfrozenBalances.count > 0) {
        const activeAddons = await repos.balance.findActiveAddons(userId);

        for (const balance of activeAddons) {
          await repos.transaction.create({
            creditBalanceId: balance.id,
            type: CreditTransactionType.UNFREEZE,
            amount: 0,
            balanceAfter: balance.remainingCredits,
            sourceRef,
            description: 'Add-on credits unfrozen',
          });
        }
      }

      await repos.inbox.markAsProcessed(eventId, eventType);
    });

    this.logger.log(`Unfrozen add-on credits for user ${userId}`);
  }

  async consumeCredits(params: {
    userId: string;
    amount: number;
    sourceRef: string;
  }): Promise<void> {
    const { userId, amount, sourceRef } = params;

    await this.uow.execute(async (repos) => {
      const activeBalance = await repos.balance.findActiveBalanceForConsumption(
        userId,
        amount,
      );

      if (!activeBalance) {
        throw new Error('Insufficient credits');
      }

      const newRemaining = activeBalance.remainingCredits - amount;

      await repos.balance.updateRemaining(activeBalance.id, newRemaining);

      await repos.transaction.create({
        creditBalanceId: activeBalance.id,
        type: CreditTransactionType.CONSUME,
        amount: -amount,
        balanceAfter: newRemaining,
        sourceRef,
        description: 'Credit consumption',
      });
    });

    this.logger.log(`Consumed ${amount} credits for user ${userId}`);
  }
}
