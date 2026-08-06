import { Test, TestingModule } from '@nestjs/testing';
import { CreditService } from '@/modules/credit/credit.service';
import { CreditUoW } from './credit.uow';
import {
  CreditSource,
  CreditStatus,
  CreditTransactionType,
} from '@prisma/client';

describe('CreditService', () => {
  let service: CreditService;
  let mockBalanceRepo: {
    updateManyStatus: jest.Mock;
    create: jest.Mock;
    findActiveAddons: jest.Mock;
    findFrozenAddons: jest.Mock;
    findActiveBalanceForConsumption: jest.Mock;
    updateRemaining: jest.Mock;
  };
  let mockTransactionRepo: {
    create: jest.Mock;
  };
  let mockInboxRepo: {
    isEventProcessed: jest.Mock;
    markAsProcessed: jest.Mock;
  };

  beforeEach(async () => {
    mockBalanceRepo = {
      updateManyStatus: jest.fn(),
      create: jest.fn(),
      findActiveAddons: jest.fn(),
      findFrozenAddons: jest.fn(),
      findActiveBalanceForConsumption: jest.fn(),
      updateRemaining: jest.fn(),
    };
    mockTransactionRepo = {
      create: jest.fn(),
    };
    mockInboxRepo = {
      isEventProcessed: jest.fn(),
      markAsProcessed: jest.fn(),
    };

    const mockRepos = {
      balance: mockBalanceRepo,
      transaction: mockTransactionRepo,
      inbox: mockInboxRepo,
    };

    const mockCreditUoW = {
      execute: jest
        .fn()
        .mockImplementation((cb: (repos: typeof mockRepos) => Promise<any>) =>
          cb(mockRepos),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditService,
        {
          provide: CreditUoW,
          useValue: mockCreditUoW,
        },
      ],
    }).compile();

    service = module.get<CreditService>(CreditService);
  });

  describe('provisionMonthlyCredits', () => {
    it('should provision paid plan monthly credits and unfreeze addons', async () => {
      const params = {
        eventId: 'event_123',
        eventType: 'invoice.paid',
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

      mockInboxRepo.isEventProcessed.mockResolvedValue(false);
      mockBalanceRepo.updateManyStatus.mockResolvedValue({ count: 1 });
      mockBalanceRepo.create.mockResolvedValue(newBalance);
      mockTransactionRepo.create.mockResolvedValue({});

      await service.provisionMonthlyCredits(params);

      expect(mockBalanceRepo.updateManyStatus).toHaveBeenCalledWith(
        {
          userId: params.userId,
          source: CreditSource.MONTHLY,
          status: CreditStatus.ACTIVE,
        },
        { status: CreditStatus.EXHAUSTED },
      );

      expect(mockBalanceRepo.create).toHaveBeenCalledWith({
        userId: params.userId,
        source: CreditSource.MONTHLY,
        sourceRef: params.sourceRef,
        totalCredits: params.creditsIncluded,
        remainingCredits: params.creditsIncluded,
        status: CreditStatus.ACTIVE,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      });

      expect(mockTransactionRepo.create).toHaveBeenCalledWith({
        creditBalanceId: newBalance.id,
        type: CreditTransactionType.PROVISION,
        amount: params.creditsIncluded,
        balanceAfter: params.creditsIncluded,
        sourceRef: params.sourceRef,
        description: 'Monthly credit provision',
      });

      expect(mockBalanceRepo.updateManyStatus).toHaveBeenCalledWith(
        {
          userId: params.userId,
          source: CreditSource.ADDON,
          status: CreditStatus.FROZEN,
        },
        {
          status: CreditStatus.ACTIVE,
          unfrozenAt: expect.any(Date) as unknown,
        },
      );

      expect(mockInboxRepo.markAsProcessed).toHaveBeenCalledWith(
        params.eventId,
        params.eventType,
      );
    });

    it('should provision free plan monthly credits and freeze addons', async () => {
      const params = {
        eventId: 'event_456',
        eventType: 'invoice.paid',
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

      mockInboxRepo.isEventProcessed.mockResolvedValue(false);
      mockBalanceRepo.updateManyStatus.mockResolvedValue({ count: 1 });
      mockBalanceRepo.create.mockResolvedValue(newBalance);
      mockTransactionRepo.create.mockResolvedValue({});

      await service.provisionMonthlyCredits(params);

      expect(mockBalanceRepo.updateManyStatus).toHaveBeenCalledWith(
        {
          userId: params.userId,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        {
          status: CreditStatus.FROZEN,
          frozenAt: expect.any(Date) as unknown,
        },
      );

      expect(mockInboxRepo.markAsProcessed).toHaveBeenCalledWith(
        params.eventId,
        params.eventType,
      );
    });

    it('should skip processing if event already in inbox', async () => {
      const params = {
        eventId: 'event_123',
        eventType: 'invoice.paid',
        userId: 'user_123',
        creditsIncluded: 1000,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-02-01'),
        sourceRef: 'event_123',
        planSlug: 'pro',
      };

      mockInboxRepo.isEventProcessed.mockResolvedValue(true);

      await service.provisionMonthlyCredits(params);

      expect(mockInboxRepo.isEventProcessed).toHaveBeenCalledWith(
        params.eventId,
      );
      expect(mockBalanceRepo.updateManyStatus).not.toHaveBeenCalled();
      expect(mockBalanceRepo.create).not.toHaveBeenCalled();
      expect(mockInboxRepo.markAsProcessed).not.toHaveBeenCalled();
    });
  });

  describe('provisionAddonCredits', () => {
    it('should provision addon credits', async () => {
      const params = {
        eventId: 'purchase_123',
        eventType: 'addon.purchased',
        userId: 'user_123',
        credits: 500,
        sourceRef: 'purchase_123',
      };

      const newBalance = {
        id: 'balance_456',
        totalCredits: 500,
        remainingCredits: 500,
      };

      mockInboxRepo.isEventProcessed.mockResolvedValue(false);
      mockBalanceRepo.create.mockResolvedValue(newBalance);
      mockTransactionRepo.create.mockResolvedValue({});

      await service.provisionAddonCredits(params);

      expect(mockBalanceRepo.create).toHaveBeenCalledWith({
        userId: params.userId,
        source: CreditSource.ADDON,
        sourceRef: params.sourceRef,
        totalCredits: params.credits,
        remainingCredits: params.credits,
        status: CreditStatus.ACTIVE,
        //
        purchasedAt: expect.any(Date) as unknown,
      });

      expect(mockTransactionRepo.create).toHaveBeenCalledWith({
        creditBalanceId: newBalance.id,
        type: CreditTransactionType.PROVISION,
        amount: params.credits,
        balanceAfter: params.credits,
        sourceRef: params.sourceRef,
        description: 'Add-on credit provision',
      });

      expect(mockInboxRepo.markAsProcessed).toHaveBeenCalledWith(
        params.eventId,
        params.eventType,
      );
    });

    it('should skip processing if event already in inbox', async () => {
      const params = {
        eventId: 'purchase_123',
        eventType: 'addon.purchased',
        userId: 'user_123',
        credits: 500,
        sourceRef: 'purchase_123',
      };

      mockInboxRepo.isEventProcessed.mockResolvedValue(true);

      await service.provisionAddonCredits(params);

      expect(mockBalanceRepo.create).not.toHaveBeenCalled();
      expect(mockInboxRepo.markAsProcessed).not.toHaveBeenCalled();
    });
  });

  describe('freezeAddonCredits', () => {
    it('should freeze active addon credits and create transactions', async () => {
      const eventId = 'event_456';
      const eventType = 'subscription.payment_failed';
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

      mockInboxRepo.isEventProcessed.mockResolvedValue(false);
      mockBalanceRepo.updateManyStatus.mockResolvedValue({ count: 2 });
      mockBalanceRepo.findFrozenAddons.mockResolvedValue(frozenBalances);
      mockTransactionRepo.create.mockResolvedValue({});

      await service.freezeAddonCredits(eventId, eventType, userId, sourceRef);

      expect(mockBalanceRepo.updateManyStatus).toHaveBeenCalledWith(
        {
          userId,
          source: CreditSource.ADDON,
          status: CreditStatus.ACTIVE,
        },
        {
          status: CreditStatus.FROZEN,
          frozenAt: expect.any(Date) as unknown,
        },
      );

      expect(mockTransactionRepo.create).toHaveBeenCalledTimes(2);
      expect(mockTransactionRepo.create).toHaveBeenCalledWith({
        creditBalanceId: 'balance_1',
        type: CreditTransactionType.FREEZE,
        amount: 0,
        balanceAfter: 100,
        sourceRef,
        description: 'Add-on credits frozen',
      });

      expect(mockInboxRepo.markAsProcessed).toHaveBeenCalledWith(
        eventId,
        eventType,
      );
    });

    it('should skip processing if event already in inbox', async () => {
      const eventId = 'event_456';
      const eventType = 'subscription.payment_failed';
      const userId = 'user_123';
      const sourceRef = 'event_456';

      mockInboxRepo.isEventProcessed.mockResolvedValue(true);

      await service.freezeAddonCredits(eventId, eventType, userId, sourceRef);

      expect(mockBalanceRepo.updateManyStatus).not.toHaveBeenCalled();
      expect(mockInboxRepo.markAsProcessed).not.toHaveBeenCalled();
    });
  });

  describe('unfreezeAddonCredits', () => {
    it('should unfreeze frozen addon credits and create transactions', async () => {
      const eventId = 'event_789';
      const eventType = 'subscription.recovered';
      const userId = 'user_123';
      const sourceRef = 'event_789';

      const unfrozenBalances = [
        {
          id: 'balance_1',
          remainingCredits: 100,
          status: CreditStatus.ACTIVE,
        },
      ];

      mockInboxRepo.isEventProcessed.mockResolvedValue(false);
      mockBalanceRepo.updateManyStatus.mockResolvedValue({ count: 1 });
      mockBalanceRepo.findActiveAddons.mockResolvedValue(unfrozenBalances);
      mockTransactionRepo.create.mockResolvedValue({});

      await service.unfreezeAddonCredits(eventId, eventType, userId, sourceRef);

      expect(mockBalanceRepo.updateManyStatus).toHaveBeenCalledWith(
        {
          userId,
          source: CreditSource.ADDON,
          status: CreditStatus.FROZEN,
        },
        {
          status: CreditStatus.ACTIVE,
          unfrozenAt: expect.any(Date) as unknown,
        },
      );

      expect(mockTransactionRepo.create).toHaveBeenCalledWith({
        creditBalanceId: 'balance_1',
        type: CreditTransactionType.UNFREEZE,
        amount: 0,
        balanceAfter: 100,
        sourceRef,
        description: 'Add-on credits unfrozen',
      });

      expect(mockInboxRepo.markAsProcessed).toHaveBeenCalledWith(
        eventId,
        eventType,
      );
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

      mockBalanceRepo.findActiveBalanceForConsumption.mockResolvedValue(
        activeBalance,
      );
      mockBalanceRepo.updateRemaining.mockResolvedValue({});
      mockTransactionRepo.create.mockResolvedValue({});

      await service.consumeCredits(params);

      expect(
        mockBalanceRepo.findActiveBalanceForConsumption,
      ).toHaveBeenCalledWith(params.userId, params.amount);

      expect(mockBalanceRepo.updateRemaining).toHaveBeenCalledWith(
        activeBalance.id,
        50,
      );

      expect(mockTransactionRepo.create).toHaveBeenCalledWith({
        creditBalanceId: activeBalance.id,
        type: CreditTransactionType.CONSUME,
        amount: -params.amount,
        balanceAfter: 50,
        sourceRef: params.sourceRef,
        description: 'Credit consumption',
      });
    });

    it('should throw error if insufficient credits', async () => {
      const params = {
        userId: 'user_123',
        amount: 1000,
        sourceRef: 'api_call_123',
      };

      mockBalanceRepo.findActiveBalanceForConsumption.mockResolvedValue(null);

      await expect(service.consumeCredits(params)).rejects.toThrow(
        'Insufficient credits',
      );

      expect(mockBalanceRepo.updateRemaining).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).not.toHaveBeenCalled();
    });
  });
});
