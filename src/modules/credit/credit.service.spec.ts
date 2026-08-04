import { Test, TestingModule } from '@nestjs/testing';
import { CreditService } from './credit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreditSource,
  CreditStatus,
  CreditTransactionType,
} from '@prisma/client';
import { SortOrder } from '../../common/enums/sort-order.enum';

describe('CreditService', () => {
  let service: CreditService;
  let mockTx: {
    creditBalance: {
      updateMany: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    creditTransaction: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockTx = {
      creditBalance: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      creditTransaction: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) =>
              callback(mockTx),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<CreditService>(CreditService);
  });

  describe('provisionMonthlyCredits', () => {
    it('should provision paid plan monthly credits and unfreeze addons', async () => {
      const params = {
        userId: 'user_123',
        creditsIncluded: 1000,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-02-01'),
        sourceRef: 'event_123',
        planSlug: 'pro',
      };

      const newBalance = {
        id: 'balance_123',
        totalCredits: 1000,
        remainingCredits: 1000,
      };

      mockTx.creditBalance.updateMany.mockResolvedValue({ count: 1 });
      mockTx.creditBalance.create.mockResolvedValue(newBalance);
      mockTx.creditTransaction.create.mockResolvedValue({});

      await service.provisionMonthlyCredits(params);

      expect(mockTx.creditBalance.updateMany).toHaveBeenCalledWith({
        where: {
          userId: params.userId,
          source: CreditSource.MONTHLY,
          status: CreditStatus.ACTIVE,
        },
        data: { status: CreditStatus.EXHAUSTED },
      });

      expect(mockTx.creditBalance.create).toHaveBeenCalledWith({
        data: {
          userId: params.userId,
          source: CreditSource.MONTHLY,
          sourceRef: params.sourceRef,
          totalCredits: params.creditsIncluded,
          remainingCredits: params.creditsIncluded,
          status: CreditStatus.ACTIVE,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
        },
      });

      expect(mockTx.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          creditBalanceId: newBalance.id,
          type: CreditTransactionType.PROVISION,
          amount: params.creditsIncluded,
          balanceAfter: params.creditsIncluded,
          sourceRef: params.sourceRef,
          description: 'Monthly credit provision',
        },
      });

      expect(mockTx.creditBalance.updateMany).toHaveBeenCalledWith({
        where: {
          userId: params.userId,
          source: CreditSource.ADDON,
          status: CreditStatus.FROZEN,
        },
        data: {
          status: CreditStatus.ACTIVE,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          unfrozenAt: expect.any(Date),
        },
      });
    });

    it('should provision free plan monthly credits and freeze addons', async () => {
      const params = {
        userId: 'user_123',
        creditsIncluded: 100,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-02-01'),
        sourceRef: 'event_456',
        planSlug: 'free',
      };

      const newBalance = {
        id: 'balance_789',
        totalCredits: 100,
        remainingCredits: 100,
      };

      mockTx.creditBalance.updateMany.mockResolvedValue({ count: 1 });
      mockTx.creditBalance.create.mockResolvedValue(newBalance);
      mockTx.creditTransaction.create.mockResolvedValue({});

      await service.provisionMonthlyCredits(params);

      expect(mockTx.creditBalance.updateMany).toHaveBeenCalledWith({
        where: {
          userId: params.userId,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        data: {
          status: CreditStatus.FROZEN,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          frozenAt: expect.any(Date),
        },
      });
    });
  });

  describe('provisionAddonCredits', () => {
    it('should provision addon credits', async () => {
      const params = {
        userId: 'user_123',
        credits: 500,
        sourceRef: 'purchase_123',
      };

      const newBalance = {
        id: 'balance_456',
        totalCredits: 500,
        remainingCredits: 500,
      };

      mockTx.creditBalance.create.mockResolvedValue(newBalance);
      mockTx.creditTransaction.create.mockResolvedValue({});

      await service.provisionAddonCredits(params);

      expect(mockTx.creditBalance.create).toHaveBeenCalledWith({
        data: {
          userId: params.userId,
          source: CreditSource.ADDON,
          sourceRef: params.sourceRef,
          totalCredits: params.credits,
          remainingCredits: params.credits,
          status: CreditStatus.ACTIVE,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          purchasedAt: expect.any(Date),
        },
      });

      expect(mockTx.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          creditBalanceId: newBalance.id,
          type: CreditTransactionType.PROVISION,
          amount: params.credits,
          balanceAfter: params.credits,
          sourceRef: params.sourceRef,
          description: 'Add-on credit provision',
        },
      });
    });
  });

  describe('freezeAddonCredits', () => {
    it('should freeze active addon credits and create transactions', async () => {
      const userId = 'user_123';
      const sourceRef = 'event_456';

      const frozenBalances = [
        {
          id: 'balance_1',
          remainingCredits: 100,
          status: CreditStatus.FROZEN,
        },
        {
          id: 'balance_2',
          remainingCredits: 200,
          status: CreditStatus.FROZEN,
        },
      ];

      mockTx.creditBalance.updateMany.mockResolvedValue({ count: 2 });
      mockTx.creditBalance.findMany.mockResolvedValue(frozenBalances);
      mockTx.creditTransaction.create.mockResolvedValue({});

      await service.freezeAddonCredits(userId, sourceRef);

      expect(mockTx.creditBalance.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        data: {
          status: CreditStatus.FROZEN,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          frozenAt: expect.any(Date),
        },
      });

      expect(mockTx.creditTransaction.create).toHaveBeenCalledTimes(2);
      expect(mockTx.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          creditBalanceId: 'balance_1',
          type: CreditTransactionType.FREEZE,
          amount: 0,
          balanceAfter: 100,
          sourceRef,
          description: 'Add-on credits frozen',
        },
      });
    });
  });

  describe('unfreezeAddonCredits', () => {
    it('should unfreeze frozen addon credits and create transactions', async () => {
      const userId = 'user_123';
      const sourceRef = 'event_789';

      const unfrozenBalances = [
        {
          id: 'balance_1',
          remainingCredits: 100,
          status: CreditStatus.ACTIVE,
        },
      ];

      mockTx.creditBalance.updateMany.mockResolvedValue({ count: 1 });
      mockTx.creditBalance.findMany.mockResolvedValue(unfrozenBalances);
      mockTx.creditTransaction.create.mockResolvedValue({});

      await service.unfreezeAddonCredits(userId, sourceRef);

      expect(mockTx.creditBalance.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          source: CreditSource.ADDON,
          status: CreditStatus.FROZEN,
        },
        data: {
          status: CreditStatus.ACTIVE,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          unfrozenAt: expect.any(Date),
        },
      });

      expect(mockTx.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          creditBalanceId: 'balance_1',
          type: CreditTransactionType.UNFREEZE,
          amount: 0,
          balanceAfter: 100,
          sourceRef,
          description: 'Add-on credits unfrozen',
        },
      });
    });
  });

  describe('consumeCredits', () => {
    it('should consume credits from oldest active balance', async () => {
      const params = {
        userId: 'user_123',
        amount: 50,
        sourceRef: 'api_call_123',
      };

      const activeBalance = {
        id: 'balance_123',
        remainingCredits: 100,
      };

      mockTx.creditBalance.findFirst.mockResolvedValue(activeBalance);
      mockTx.creditBalance.update.mockResolvedValue({});
      mockTx.creditTransaction.create.mockResolvedValue({});

      await service.consumeCredits(params);

      expect(mockTx.creditBalance.findFirst).toHaveBeenCalledWith({
        where: {
          userId: params.userId,
          status: CreditStatus.ACTIVE,
          remainingCredits: { gte: params.amount },
        },
        orderBy: { createdAt: SortOrder.ASC },
      });

      expect(mockTx.creditBalance.update).toHaveBeenCalledWith({
        where: { id: activeBalance.id },
        data: { remainingCredits: 50 },
      });

      expect(mockTx.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          creditBalanceId: activeBalance.id,
          type: CreditTransactionType.CONSUME,
          amount: -params.amount,
          balanceAfter: 50,
          sourceRef: params.sourceRef,
          description: 'Credit consumption',
        },
      });
    });

    it('should throw error if insufficient credits', async () => {
      const params = {
        userId: 'user_123',
        amount: 1000,
        sourceRef: 'api_call_123',
      };

      mockTx.creditBalance.findFirst.mockResolvedValue(null);

      await expect(service.consumeCredits(params)).rejects.toThrow(
        'Insufficient credits',
      );

      expect(mockTx.creditBalance.update).not.toHaveBeenCalled();
      expect(mockTx.creditTransaction.create).not.toHaveBeenCalled();
    });
  });
});
