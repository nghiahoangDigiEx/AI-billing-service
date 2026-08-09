import { Test, TestingModule } from '@nestjs/testing';
import { CreditCronService } from './credit.cron.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreditService } from '@/modules/credit/credit.service';
import {
  CreditSource,
  CreditStatus,
  SubscriptionStatus,
  BillingInterval,
} from '@prisma/client';

describe('CreditCronService', () => {
  let service: CreditCronService;
  let prismaService: PrismaService;
  let creditService: CreditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditCronService,
        {
          provide: PrismaService,
          useValue: {
            creditBalance: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: CreditService,
          useValue: {
            provisionMonthlyCredits: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CreditCronService>(CreditCronService);
    prismaService = module.get<PrismaService>(PrismaService);
    creditService = module.get<CreditService>(CreditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleAnnualSubscriptionCreditResets', () => {
    it('should provision new credits for expired balances of annual subscriptions', async () => {
      const subStart = new Date('2025-01-01T00:00:00Z');
      const subEnd = new Date('2026-01-01T00:00:00Z');
      const pastDate = new Date('2025-02-01T00:00:00Z'); // 1 month passed

      const mockBalance = {
        id: 'balance-1',
        userId: 'user-1',
        source: CreditSource.MONTHLY,
        status: CreditStatus.ACTIVE,
        periodEnd: pastDate,
        user: {
          subscriptions: [
            {
              id: 'sub-1',
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: subStart,
              currentPeriodEnd: subEnd,
              planPrice: {
                billingInterval: BillingInterval.YEAR,
              },
              plan: {
                slug: 'pro',
                creditsIncluded: 1000,
              },
            },
          ],
        },
      };

      (prismaService.creditBalance.findMany as jest.Mock).mockResolvedValue([
        mockBalance,
      ]);

      await service.handleAnnualSubscriptionCreditResets();

      expect(prismaService.creditBalance.findMany).toHaveBeenCalledTimes(1);

      const expectedPeriodStart = pastDate;
      const expectedPeriodEnd = new Date('2025-03-01T00:00:00Z');
      const expectedEventId = `cron-monthly-reset-${mockBalance.id}-${expectedPeriodStart.getTime()}`;

      expect(creditService.provisionMonthlyCredits).toHaveBeenCalledTimes(1);
      expect(creditService.provisionMonthlyCredits).toHaveBeenCalledWith({
        eventId: expectedEventId,
        eventType: 'cron.monthly_reset',
        userId: 'user-1',
        creditsIncluded: 1000,
        periodStart: expectedPeriodStart,
        periodEnd: expectedPeriodEnd,
        sourceRef: 'sub-1',
        planSlug: 'pro',
      });
    });

    it('should skip provisioning if it reached the end of the annual subscription cycle', async () => {
      const subStart = new Date('2025-01-01T00:00:00Z');
      const subEnd = new Date('2026-01-01T00:00:00Z');
      const pastDate = new Date('2026-01-01T00:00:00Z'); // Last month expired!

      const mockBalance = {
        id: 'balance-1',
        userId: 'user-1',
        source: CreditSource.MONTHLY,
        status: CreditStatus.ACTIVE,
        periodEnd: pastDate,
        user: {
          subscriptions: [
            {
              id: 'sub-1',
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: subStart,
              currentPeriodEnd: subEnd,
              planPrice: {
                billingInterval: BillingInterval.YEAR,
              },
              plan: {
                slug: 'pro',
                creditsIncluded: 1000,
              },
            },
          ],
        },
      };

      (prismaService.creditBalance.findMany as jest.Mock).mockResolvedValue([
        mockBalance,
      ]);

      await service.handleAnnualSubscriptionCreditResets();

      expect(creditService.provisionMonthlyCredits).not.toHaveBeenCalled();
    });

    it('should not provision credits if the active subscription is not yearly', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 1000 * 60 * 60 * 24);

      const mockBalance = {
        id: 'balance-1',
        userId: 'user-1',
        source: CreditSource.MONTHLY,
        status: CreditStatus.ACTIVE,
        periodEnd: pastDate,
        user: {
          subscriptions: [
            {
              id: 'sub-1',
              status: SubscriptionStatus.ACTIVE,
              planPrice: {
                billingInterval: BillingInterval.MONTH, // Monthly subscription!
              },
              plan: {
                slug: 'pro',
                creditsIncluded: 1000,
              },
            },
          ],
        },
      };

      (prismaService.creditBalance.findMany as jest.Mock).mockResolvedValue([
        mockBalance,
      ]);

      await service.handleAnnualSubscriptionCreditResets();

      expect(creditService.provisionMonthlyCredits).not.toHaveBeenCalled();
    });

    it('should continue processing if one provision fails', async () => {
      const subStart = new Date('2025-01-01T00:00:00Z');
      const subEnd = new Date('2026-01-01T00:00:00Z');
      const pastDate = new Date('2025-02-01T00:00:00Z');

      const mockBalance1 = {
        id: 'balance-1',
        userId: 'user-1',
        periodEnd: pastDate,
        user: {
          subscriptions: [
            {
              id: 'sub-1',
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: subStart,
              currentPeriodEnd: subEnd,
              planPrice: { billingInterval: BillingInterval.YEAR },
              plan: { slug: 'pro', creditsIncluded: 1000 },
            },
          ],
        },
      };

      const mockBalance2 = {
        id: 'balance-2',
        userId: 'user-2',
        periodEnd: pastDate,
        user: {
          subscriptions: [
            {
              id: 'sub-2',
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: subStart,
              currentPeriodEnd: subEnd,
              planPrice: { billingInterval: BillingInterval.YEAR },
              plan: { slug: 'pro', creditsIncluded: 1000 },
            },
          ],
        },
      };

      (prismaService.creditBalance.findMany as jest.Mock).mockResolvedValue([
        mockBalance1,
        mockBalance2,
      ]);

      // First call fails, second succeeds
      (creditService.provisionMonthlyCredits as jest.Mock)
        .mockRejectedValueOnce(new Error('Provision failed'))
        .mockResolvedValueOnce(undefined);

      await service.handleAnnualSubscriptionCreditResets();

      expect(creditService.provisionMonthlyCredits).toHaveBeenCalledTimes(2);
    });
  });
});
