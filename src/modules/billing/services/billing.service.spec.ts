import { Test, TestingModule } from '@nestjs/testing';
import { AppException } from '../../../common/exceptions';
import { BillingService } from './billing.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { BillingInterval } from '@prisma/client';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: PrismaService;
  let stripeService: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: PrismaService,
          useValue: {
            plan: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            planPrice: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
              findUnique: jest.fn(),
            },
            creditBalance: {
              findMany: jest.fn(),
            },
            addonPackage: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            subscription: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            createProduct: jest.fn(),
            updateProduct: jest.fn(),
            createPrice: jest.fn(),
            archiveProduct: jest.fn(),
            createSubscription: jest.fn(),
            createPaymentIntent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    prisma = module.get<PrismaService>(PrismaService);
    stripeService = module.get<StripeService>(StripeService);
  });

  describe('createPlan', () => {
    it('should create a plan successfully', async () => {
      const createPlanDto = {
        name: 'Pro Plan',
        slug: 'pro',
        creditsIncluded: 1000,

        billingInterval: BillingInterval.MONTH,
        amount: 1000,
        currency: 'usd',
      };

      const mockStripeProduct = { id: 'prod_123', name: 'Pro Plan' };
      const mockStripePrice = { id: 'price_123', product: 'prod_123' };
      const mockPlan = {
        id: 'plan_123',
        name: 'Pro Plan',
        slug: 'pro',
        stripeProductId: 'prod_123',
        prices: [{ id: 'price_123', stripePriceId: 'price_123' }],
      };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(null);
      (stripeService.createProduct as jest.Mock).mockResolvedValue(
        mockStripeProduct,
      );
      (stripeService.createPrice as jest.Mock).mockResolvedValue(
        mockStripePrice,
      );
      (prisma.plan.create as jest.Mock).mockResolvedValue(mockPlan);

      const result = await service.createPlan(createPlanDto);

      expect(result).toEqual(mockPlan);
      expect(prisma.plan.findUnique).toHaveBeenCalledWith({
        where: { slug: 'pro' },
      });
      expect(stripeService.createProduct).toHaveBeenCalledWith('Pro Plan');
      expect(stripeService.createPrice).toHaveBeenCalledWith(
        'prod_123',
        1000,
        'usd',
        'month',
      );
      expect(prisma.plan.create).toHaveBeenCalled();
    });

    it('should throw AppException if slug already exists', async () => {
      const createPlanDto = {
        name: 'Pro Plan',
        slug: 'pro',
        creditsIncluded: 1000,

        billingInterval: BillingInterval.MONTH,
        amount: 1000,
        currency: 'usd',
      };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
      });

      await expect(service.createPlan(createPlanDto)).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('getAllPlans', () => {
    it('should return all active plans with active prices', async () => {
      const mockPlans = [
        {
          id: 'plan_1',
          name: 'Free Plan',
          slug: 'free',
          status: 'ACTIVE',
          prices: [{ id: 'price_1', status: 'ACTIVE' }],
        },
      ];

      (prisma.plan.findMany as jest.Mock).mockResolvedValue(mockPlans);

      const result = await service.getAllPlans();

      expect(result).toEqual(mockPlans);
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: {
          prices: {
            where: { status: 'ACTIVE' },
          },
        },
      });
    });
  });

  describe('getPlanById', () => {
    it('should return plan by ID', async () => {
      const mockPlan = {
        id: 'plan_123',
        name: 'Pro Plan',
        prices: [{ id: 'price_123' }],
      };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

      const result = await service.getPlanById('plan_123');

      expect(result).toEqual(mockPlan);
      expect(prisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan_123' },
        include: { prices: true },
      });
    });

    it('should throw AppException if plan not found', async () => {
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getPlanById('nonexistent')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('updatePlan', () => {
    it('should update plan name', async () => {
      const mockPlan = {
        id: 'plan_123',
        name: 'Old Name',
        stripeProductId: 'prod_123',
      };
      const updatedPlan = {
        ...mockPlan,
        name: 'New Name',
        prices: [],
      };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (stripeService.updateProduct as jest.Mock).mockResolvedValue({});
      (prisma.plan.update as jest.Mock).mockResolvedValue(updatedPlan);

      const result = await service.updatePlan('plan_123', { name: 'New Name' });

      expect(result).toEqual(updatedPlan);
      expect(stripeService.updateProduct).toHaveBeenCalledWith(
        'prod_123',
        'New Name',
      );
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: 'plan_123' },
        data: { name: 'New Name' },
        include: { prices: true },
      });
    });

    it('should throw AppException if plan not found', async () => {
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updatePlan('nonexistent', { name: 'New' }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('addPriceToPlan', () => {
    it('should add a new price to plan', async () => {
      const mockPlan = {
        id: 'plan_123',
        stripeProductId: 'prod_123',
      };
      const mockStripePrice = { id: 'price_123' };
      const mockPrice = {
        id: 'price_123',
        planId: 'plan_123',

        billingInterval: BillingInterval.YEAR,
        amount: 10000,
        currency: 'usd',
      };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.planPrice.findFirst as jest.Mock).mockResolvedValue(null);
      (stripeService.createPrice as jest.Mock).mockResolvedValue(
        mockStripePrice,
      );
      (prisma.planPrice.create as jest.Mock).mockResolvedValue(mockPrice);

      const result = await service.addPriceToPlan('plan_123', {
        billingInterval: 'YEAR',
        amount: 10000,
        currency: 'usd',
      });

      expect(result).toEqual(mockPrice);
      expect(prisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan_123' },
      });
      expect(prisma.planPrice.findFirst).toHaveBeenCalledWith({
        where: {
          planId: 'plan_123',

          billingInterval: BillingInterval.YEAR,
          status: 'ACTIVE',
        },
      });
      expect(stripeService.createPrice).toHaveBeenCalledWith(
        'prod_123',
        10000,
        'usd',
        'year',
      );
      expect(prisma.planPrice.create).toHaveBeenCalled();
    });

    it('should throw AppException if plan not found', async () => {
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addPriceToPlan('nonexistent', {
          billingInterval: BillingInterval.YEAR,
          amount: 10000,
          currency: 'usd',
        }),
      ).rejects.toThrow(AppException);
    });

    it('should throw AppException if billing interval already exists', async () => {
      const mockPlan = { id: 'plan_123' };
      const existingPrice = { id: 'existing_price' };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.planPrice.findFirst as jest.Mock).mockResolvedValue(
        existingPrice,
      );

      await expect(
        service.addPriceToPlan('plan_123', {
          billingInterval: BillingInterval.YEAR,
          amount: 10000,
          currency: 'usd',
        }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('deactivatePlanPrice', () => {
    it('should deactivate a plan price', async () => {
      const mockPlan = { id: 'plan_123' };
      const mockPrice = {
        id: 'price_123',
        planId: 'plan_123',
        status: 'ACTIVE',
      };
      const updatedPrice = { ...mockPrice, status: 'INACTIVE' };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.planPrice.findFirst as jest.Mock).mockResolvedValue(mockPrice);
      (prisma.planPrice.count as jest.Mock).mockResolvedValue(2);
      (prisma.planPrice.update as jest.Mock).mockResolvedValue(updatedPrice);

      const result = await service.deactivatePlanPrice('plan_123', 'price_123');

      expect(result).toEqual(updatedPrice);
      expect(prisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan_123' },
      });
      expect(prisma.planPrice.findFirst).toHaveBeenCalledWith({
        where: { id: 'price_123', planId: 'plan_123' },
      });
      expect(prisma.planPrice.count).toHaveBeenCalledWith({
        where: { planId: 'plan_123', status: 'ACTIVE' },
      });
      expect(prisma.planPrice.update).toHaveBeenCalledWith({
        where: { id: 'price_123' },
        data: { status: 'INACTIVE' },
      });
    });

    it('should throw AppException if plan not found', async () => {
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deactivatePlanPrice('nonexistent', 'price_123'),
      ).rejects.toThrow(AppException);
    });

    it('should throw AppException if price not found', async () => {
      const mockPlan = { id: 'plan_123' };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.planPrice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deactivatePlanPrice('plan_123', 'nonexistent'),
      ).rejects.toThrow(AppException);
    });

    it('should throw AppException if trying to deactivate last active price', async () => {
      const mockPlan = { id: 'plan_123' };
      const mockPrice = {
        id: 'price_123',
        planId: 'plan_123',
        status: 'ACTIVE',
      };

      (prisma.plan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.planPrice.findFirst as jest.Mock).mockResolvedValue(mockPrice);
      (prisma.planPrice.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.deactivatePlanPrice('plan_123', 'price_123'),
      ).rejects.toThrow(AppException);
    });
  });
  describe('createAddonPackage', () => {
    it('should create an addon package', async () => {
      const dto = {
        name: '100 Credits',
        credits: 100,
        amount: 1000,
        currency: 'usd',
      };
      const mockProduct = { id: 'prod_addon' };
      const mockPrice = { id: 'price_addon' };
      const mockAddon = { id: 'addon_1', ...dto };

      (stripeService.createProduct as jest.Mock).mockResolvedValue(mockProduct);
      (stripeService.createPrice as jest.Mock).mockResolvedValue(mockPrice);
      (prisma.addonPackage.create as jest.Mock).mockResolvedValue(mockAddon);

      const result = await service.createAddonPackage(dto);

      expect(result).toEqual(mockAddon);
      expect(stripeService.createProduct).toHaveBeenCalledWith('100 Credits');
      expect(stripeService.createPrice).toHaveBeenCalledWith(
        'prod_addon',
        1000,
        'usd',
        'month',
      );
      expect(prisma.addonPackage.create).toHaveBeenCalled();
    });
  });

  describe('getAllAddonPackages', () => {
    it('should return active addon packages', async () => {
      const mockAddons = [{ id: 'addon_1' }];
      (prisma.addonPackage.findMany as jest.Mock).mockResolvedValue(mockAddons);

      const result = await service.getAllAddonPackages();

      expect(result).toEqual(mockAddons);
      expect(prisma.addonPackage.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
    });
  });

  describe('getAddonPackageById', () => {
    it('should return addon package by id', async () => {
      const mockAddon = { id: 'addon_1' };
      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(
        mockAddon,
      );

      const result = await service.getAddonPackageById('addon_1');

      expect(result).toEqual(mockAddon);
    });

    it('should throw AppException if not found', async () => {
      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getAddonPackageById('missing')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('updateAddonPackage', () => {
    it('should update addon package name', async () => {
      const mockAddon = { id: 'addon_1', stripeProductId: 'prod_addon' };
      const updated = { ...mockAddon, name: 'New Name' };

      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(
        mockAddon,
      );
      (stripeService.updateProduct as jest.Mock).mockResolvedValue({});
      (prisma.addonPackage.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateAddonPackage('addon_1', {
        name: 'New Name',
      });

      expect(result).toEqual(updated);
      expect(stripeService.updateProduct).toHaveBeenCalledWith(
        'prod_addon',
        'New Name',
      );
      expect(prisma.addonPackage.update).toHaveBeenCalled();
    });

    it('should throw AppException if not found', async () => {
      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateAddonPackage('missing', { name: 'New Name' }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('deactivateAddonPackage', () => {
    it('should deactivate addon package', async () => {
      const mockAddon = { id: 'addon_1', stripeProductId: 'prod_addon' };
      const updated = { ...mockAddon, status: 'INACTIVE' };

      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(
        mockAddon,
      );
      (stripeService.archiveProduct as jest.Mock).mockResolvedValue({});
      (prisma.addonPackage.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.deactivateAddonPackage('addon_1');

      expect(result).toEqual(updated);
      expect(stripeService.archiveProduct).toHaveBeenCalledWith('prod_addon');
      expect(prisma.addonPackage.update).toHaveBeenCalledWith({
        where: { id: 'addon_1' },
        data: { status: 'INACTIVE' },
      });
    });

    it('should throw AppException if not found', async () => {
      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.deactivateAddonPackage('missing')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription successfully', async () => {
      const mockUser = { id: 'user_1', stripeCustomerId: 'cus_123' };
      const mockPrice = { id: 'price_1', stripePriceId: 'stripe_price_123' };
      const mockSub = { id: 'sub_123' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.planPrice.findUnique as jest.Mock).mockResolvedValue(mockPrice);
      (stripeService.createSubscription as jest.Mock).mockResolvedValue(
        mockSub,
      );

      const result = await service.upgradeSubscription('user_1', 'price_1');

      expect(result).toEqual({
        status: 'Accepted',
        stripeSubscriptionId: 'sub_123',
      });
      expect(stripeService.createSubscription).toHaveBeenCalledWith(
        'cus_123',
        'stripe_price_123',
      );
    });

    it('should throw AppException if no stripeCustomerId', async () => {
      const mockUser = { id: 'user_1', stripeCustomerId: null };
      const mockPrice = { id: 'price_1' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.planPrice.findUnique as jest.Mock).mockResolvedValue(mockPrice);

      await expect(
        service.upgradeSubscription('user_1', 'price_1'),
      ).rejects.toThrow(AppException);
    });
  });

  describe('getCurrentSubscription', () => {
    it('should return current active subscription', async () => {
      const mockSub = { id: 'sub_1' };
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSub);

      const result = await service.getCurrentSubscription('user_1');

      expect(result).toEqual(mockSub);
      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user_1', status: 'ACTIVE' },
        include: { plan: true, planPrice: true },
      });
    });

    it('should throw AppException if no active subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.getCurrentSubscription('user_1')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('getSubscriptionHistory', () => {
    it('should return subscription history', async () => {
      const mockSubs = [{ id: 'sub_1' }];
      (prisma.subscription.findMany as jest.Mock).mockResolvedValue(mockSubs);

      const result = await service.getSubscriptionHistory('user_1');

      expect(result).toEqual(mockSubs);
      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user_1' },
        include: { plan: true, planPrice: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('purchaseAddon', () => {
    it('should purchase addon successfully', async () => {
      const mockUser = { id: 'user_1', stripeCustomerId: 'cus_123' };
      const mockAddon = {
        id: 'addon_1',
        status: 'ACTIVE',
        amount: 500,
        currency: 'usd',
      };
      const mockPaymentIntent = { id: 'pi_123', client_secret: 'secret_123' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(
        mockAddon,
      );
      (stripeService.createPaymentIntent as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );

      const result = await service.purchaseAddon('user_1', 'addon_1');

      expect(result).toEqual({
        status: 'Accepted',
        paymentIntentId: 'pi_123',
        clientSecret: 'secret_123',
      });
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        500,
        'usd',
        'cus_123',
        { addonId: 'addon_1', userId: 'user_1' },
      );
    });

    it('should throw AppException if addon is not active', async () => {
      const mockUser = { id: 'user_1', stripeCustomerId: 'cus_123' };
      const mockAddon = { id: 'addon_1', status: 'INACTIVE' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(
        mockAddon,
      );

      await expect(service.purchaseAddon('user_1', 'addon_1')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('getUserAddonPurchases', () => {
    it('should return active and frozen addon purchases', async () => {
      const mockBalances = [{ id: 'balance_1' }];
      (prisma.creditBalance.findMany as jest.Mock).mockResolvedValue(
        mockBalances,
      );

      const result = await service.getUserAddonPurchases('user_1');

      expect(result).toEqual(mockBalances);
      expect(prisma.creditBalance.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_1',
          source: 'ADDON',
          status: { in: ['ACTIVE', 'FROZEN'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getUserAddonHistory', () => {
    it('should return all addon history', async () => {
      const mockBalances = [{ id: 'balance_1' }];
      (prisma.creditBalance.findMany as jest.Mock).mockResolvedValue(
        mockBalances,
      );

      const result = await service.getUserAddonHistory('user_1');

      expect(result).toEqual(mockBalances);
      expect(prisma.creditBalance.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_1',
          source: 'ADDON',
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
