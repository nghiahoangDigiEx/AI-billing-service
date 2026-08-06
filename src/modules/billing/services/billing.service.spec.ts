import { Test, TestingModule } from '@nestjs/testing';
import { AppException } from '@/common/exceptions';
import { BillingService } from '@/modules/billing/services/billing.service';
import { BillingUoW } from '../billing.uow';
import { PaymentProviderFactory } from '@/modules/payment/factories/payment-provider.factory';
import { PaymentProviderAdapter } from '@/modules/payment/interfaces/payment-provider-adapter.interface';
import { PaymentProvider } from '@/modules/payment/enums/payment-provider.enum';
import { SubscriptionInterval } from '@/modules/payment/enums/subscription-interval.enum';
import { BillingInterval } from '@prisma/client';

describe('BillingService', () => {
  let service: BillingService;

  const mockPlanRepo = {
    findBySlug: jest.fn(),
    findByIdWithPrices: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findAllActive: jest.fn(),
    update: jest.fn(),
  };

  const mockPlanPriceRepo = {
    findFirstActive: jest.fn(),
    findByIdAndPlanId: jest.fn(),
    findById: jest.fn(),
    countActivePrices: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockCreditBalanceRepo = {
    findUserAddonPurchases: jest.fn(),
    findUserAddonHistory: jest.fn(),
  };

  const mockAddonPackageRepo = {
    findById: jest.fn(),
    findAllActive: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepo = {
    findById: jest.fn(),
  };

  const mockSubscriptionRepo = {
    findCurrentActive: jest.fn(),
    findHistory: jest.fn(),
  };

  const mockRepos = {
    plan: mockPlanRepo,
    planPrice: mockPlanPriceRepo,
    creditBalance: mockCreditBalanceRepo,
    addonPackage: mockAddonPackageRepo,
    user: mockUserRepo,
    subscription: mockSubscriptionRepo,
  };

  const mockBillingUoW = {
    execute: jest
      .fn()
      .mockImplementation((cb: (repos: typeof mockRepos) => Promise<any>) =>
        cb(mockRepos),
      ),
    readOnly: mockRepos,
  };

  let paymentProviderFactory: PaymentProviderFactory;
  let paymentAdapter: PaymentProviderAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: BillingUoW,
          useValue: mockBillingUoW,
        },
        {
          provide: PaymentProviderFactory,
          useValue: {
            getAdapter: jest.fn().mockReturnValue({
              createProduct: jest.fn(),
              updateProduct: jest.fn(),
              createPrice: jest.fn(),
              archiveProduct: jest.fn(),
              createSubscription: jest.fn(),
              createPaymentIntent: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);

    paymentProviderFactory = module.get<PaymentProviderFactory>(
      PaymentProviderFactory,
    );
    paymentAdapter = paymentProviderFactory.getAdapter(PaymentProvider.STRIPE);
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

      mockPlanRepo.findBySlug.mockResolvedValue(null);
      (paymentAdapter.createProduct as jest.Mock).mockResolvedValue(
        mockStripeProduct,
      );
      (paymentAdapter.createPrice as jest.Mock).mockResolvedValue(
        mockStripePrice,
      );
      mockPlanRepo.create.mockResolvedValue(mockPlan);

      const result = await service.createPlan(createPlanDto);

      expect(result).toEqual(mockPlan);
      expect(mockPlanRepo.findBySlug).toHaveBeenCalledWith('pro');
      expect(paymentAdapter.createProduct).toHaveBeenCalledWith('Pro Plan');
      expect(paymentAdapter.createPrice).toHaveBeenCalledWith(
        'prod_123',
        1000,
        'usd',
        SubscriptionInterval.MONTH,
      );
      expect(mockPlanRepo.create).toHaveBeenCalled();
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

      mockPlanRepo.findBySlug.mockResolvedValue({});

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

      mockPlanRepo.findAllActive.mockResolvedValue(mockPlans);

      const result = await service.getAllPlans();

      expect(result).toEqual(mockPlans);
      expect(mockPlanRepo.findAllActive).toHaveBeenCalledWith();
    });
  });

  describe('getPlanById', () => {
    it('should return plan by ID', async () => {
      const mockPlan = {
        id: 'plan_123',
        name: 'Pro Plan',
        prices: [{ id: 'price_123' }],
      };

      mockPlanRepo.findByIdWithPrices.mockResolvedValue(mockPlan);

      const result = await service.getPlanById('plan_123');

      expect(result).toEqual(mockPlan);
      expect(mockPlanRepo.findByIdWithPrices).toHaveBeenCalledWith('plan_123');
    });

    it('should throw AppException if plan not found', async () => {
      mockPlanRepo.findByIdWithPrices.mockResolvedValue(null);

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

      mockPlanRepo.findById.mockResolvedValue(mockPlan);
      (paymentAdapter.updateProduct as jest.Mock).mockResolvedValue({});
      mockPlanRepo.update.mockResolvedValue(updatedPlan);

      const result = await service.updatePlan('plan_123', { name: 'New Name' });

      expect(result).toEqual(updatedPlan);
      expect(paymentAdapter.updateProduct).toHaveBeenCalledWith(
        'prod_123',
        'New Name',
      );
      expect(mockPlanRepo.update).toHaveBeenCalledWith('plan_123', {
        name: 'New Name',
      });
    });

    it('should throw AppException if plan not found', async () => {
      mockPlanRepo.findById.mockResolvedValue(null);

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

      mockPlanRepo.findById.mockResolvedValue(mockPlan);
      mockPlanPriceRepo.findFirstActive.mockResolvedValue(null);
      (paymentAdapter.createPrice as jest.Mock).mockResolvedValue(
        mockStripePrice,
      );
      mockPlanPriceRepo.create.mockResolvedValue(mockPrice);

      const result = await service.addPriceToPlan('plan_123', {
        billingInterval: 'YEAR',
        amount: 10000,
        currency: 'usd',
      });

      expect(result).toEqual(mockPrice);
      expect(mockPlanRepo.findById).toHaveBeenCalledWith('plan_123');
      expect(mockPlanPriceRepo.findFirstActive).toHaveBeenCalledWith(
        'plan_123',
        BillingInterval.YEAR,
      );
      expect(paymentAdapter.createPrice).toHaveBeenCalledWith(
        'prod_123',
        10000,
        'usd',
        SubscriptionInterval.YEAR,
      );
      expect(mockPlanPriceRepo.create).toHaveBeenCalled();
    });

    it('should throw AppException if plan not found', async () => {
      mockPlanRepo.findById.mockResolvedValue(null);

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

      mockPlanRepo.findById.mockResolvedValue(mockPlan);
      mockPlanPriceRepo.findFirstActive.mockResolvedValue(existingPrice);

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

      mockPlanRepo.findById.mockResolvedValue(mockPlan);
      mockPlanPriceRepo.findByIdAndPlanId.mockResolvedValue(mockPrice);
      mockPlanPriceRepo.countActivePrices.mockResolvedValue(2);
      mockPlanPriceRepo.updateStatus.mockResolvedValue(updatedPrice);

      const result = await service.deactivatePlanPrice('plan_123', 'price_123');

      expect(result).toEqual(updatedPrice);
      expect(mockPlanRepo.findById).toHaveBeenCalledWith('plan_123');
      expect(mockPlanPriceRepo.findByIdAndPlanId).toHaveBeenCalledWith(
        'price_123',
        'plan_123',
      );
      expect(mockPlanPriceRepo.countActivePrices).toHaveBeenCalledWith(
        'plan_123',
      );
      expect(mockPlanPriceRepo.updateStatus).toHaveBeenCalledWith(
        'price_123',
        'INACTIVE',
      );
    });

    it('should throw AppException if plan not found', async () => {
      mockPlanRepo.findById.mockResolvedValue(null);

      await expect(
        service.deactivatePlanPrice('nonexistent', 'price_123'),
      ).rejects.toThrow(AppException);
    });

    it('should throw AppException if price not found', async () => {
      const mockPlan = { id: 'plan_123' };

      mockPlanRepo.findById.mockResolvedValue(mockPlan);
      mockPlanPriceRepo.findByIdAndPlanId.mockResolvedValue(null);

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

      mockPlanRepo.findById.mockResolvedValue(mockPlan);
      mockPlanPriceRepo.findByIdAndPlanId.mockResolvedValue(mockPrice);
      mockPlanPriceRepo.countActivePrices.mockResolvedValue(1);

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

      (paymentAdapter.createProduct as jest.Mock).mockResolvedValue(
        mockProduct,
      );
      (paymentAdapter.createPrice as jest.Mock).mockResolvedValue(mockPrice);
      mockAddonPackageRepo.create.mockResolvedValue(mockAddon);

      const result = await service.createAddonPackage(dto);

      expect(result).toEqual(mockAddon);
      expect(paymentAdapter.createProduct).toHaveBeenCalledWith('100 Credits');
      expect(paymentAdapter.createPrice).toHaveBeenCalledWith(
        'prod_addon',
        1000,
        'usd',
      );
      expect(mockAddonPackageRepo.create).toHaveBeenCalled();
    });
  });

  describe('getAllAddonPackages', () => {
    it('should return active addon packages', async () => {
      const mockAddons = [{ id: 'addon_1' }];
      mockAddonPackageRepo.findAllActive.mockResolvedValue(mockAddons);

      const result = await service.getAllAddonPackages();

      expect(result).toEqual(mockAddons);
      expect(mockAddonPackageRepo.findAllActive).toHaveBeenCalledWith();
    });
  });

  describe('getAddonPackageById', () => {
    it('should return addon package by id', async () => {
      const mockAddon = { id: 'addon_1' };
      mockAddonPackageRepo.findById.mockResolvedValue(mockAddon);

      const result = await service.getAddonPackageById('addon_1');

      expect(result).toEqual(mockAddon);
    });

    it('should throw AppException if not found', async () => {
      mockAddonPackageRepo.findById.mockResolvedValue(null);
      await expect(service.getAddonPackageById('missing')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('updateAddonPackage', () => {
    it('should update addon package name', async () => {
      const mockAddon = { id: 'addon_1', stripeProductId: 'prod_addon' };
      const updated = { ...mockAddon, name: 'New Name' };

      mockAddonPackageRepo.findById.mockResolvedValue(mockAddon);
      (paymentAdapter.updateProduct as jest.Mock).mockResolvedValue({});
      mockAddonPackageRepo.update.mockResolvedValue(updated);

      const result = await service.updateAddonPackage('addon_1', {
        name: 'New Name',
      });

      expect(result).toEqual(updated);
      expect(paymentAdapter.updateProduct).toHaveBeenCalledWith(
        'prod_addon',
        'New Name',
      );
      expect(mockAddonPackageRepo.update).toHaveBeenCalled();
    });

    it('should throw AppException if not found', async () => {
      mockAddonPackageRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateAddonPackage('missing', { name: 'New Name' }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('deactivateAddonPackage', () => {
    it('should deactivate addon package', async () => {
      const mockAddon = { id: 'addon_1', stripeProductId: 'prod_addon' };
      const updated = { ...mockAddon, status: 'INACTIVE' };

      mockAddonPackageRepo.findById.mockResolvedValue(mockAddon);
      (paymentAdapter.archiveProduct as jest.Mock).mockResolvedValue({});
      mockAddonPackageRepo.update.mockResolvedValue(updated);

      const result = await service.deactivateAddonPackage('addon_1');

      expect(result).toEqual(updated);
      expect(paymentAdapter.archiveProduct).toHaveBeenCalledWith('prod_addon');
      expect(mockAddonPackageRepo.update).toHaveBeenCalledWith('addon_1', {
        status: 'INACTIVE',
      });
    });

    it('should throw AppException if not found', async () => {
      mockAddonPackageRepo.findById.mockResolvedValue(null);
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

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockPlanPriceRepo.findById.mockResolvedValue(mockPrice);
      (paymentAdapter.createSubscription as jest.Mock).mockResolvedValue(
        mockSub,
      );

      const result = await service.upgradeSubscription('user_1', 'price_1');

      expect(result).toEqual({
        status: 'Accepted',
        stripeSubscriptionId: 'sub_123',
      });
      expect(paymentAdapter.createSubscription).toHaveBeenCalledWith(
        'cus_123',
        'stripe_price_123',
      );
    });

    it('should throw AppException if no stripeCustomerId', async () => {
      const mockUser = { id: 'user_1', stripeCustomerId: null };
      const mockPrice = { id: 'price_1' };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockPlanPriceRepo.findById.mockResolvedValue(mockPrice);

      await expect(
        service.upgradeSubscription('user_1', 'price_1'),
      ).rejects.toThrow(AppException);
    });
  });

  describe('getCurrentSubscription', () => {
    it('should return current active subscription', async () => {
      const mockSub = { id: 'sub_1' };
      mockSubscriptionRepo.findCurrentActive.mockResolvedValue(mockSub);

      const result = await service.getCurrentSubscription('user_1');

      expect(result).toEqual(mockSub);
      expect(mockSubscriptionRepo.findCurrentActive).toHaveBeenCalledWith(
        'user_1',
      );
    });

    it('should throw AppException if no active subscription', async () => {
      mockSubscriptionRepo.findCurrentActive.mockResolvedValue(null);
      await expect(service.getCurrentSubscription('user_1')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('getSubscriptionHistory', () => {
    it('should return subscription history', async () => {
      const mockSubs = [{ id: 'sub_1' }];
      mockSubscriptionRepo.findHistory.mockResolvedValue(mockSubs);

      const result = await service.getSubscriptionHistory('user_1');

      expect(result).toEqual(mockSubs);
      expect(mockSubscriptionRepo.findHistory).toHaveBeenCalledWith('user_1');
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
      const mockPaymentIntent = { id: 'pi_123', clientSecret: 'secret_123' };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockAddonPackageRepo.findById.mockResolvedValue(mockAddon);
      (paymentAdapter.createPaymentIntent as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );

      const result = await service.purchaseAddon('user_1', 'addon_1');

      expect(result).toEqual({
        status: 'Accepted',
        paymentIntentId: 'pi_123',
        clientSecret: 'secret_123',
      });
      expect(paymentAdapter.createPaymentIntent).toHaveBeenCalledWith(
        500,
        'usd',
        'cus_123',
        { addonId: 'addon_1', userId: 'user_1' },
      );
    });

    it('should throw AppException if addon is not active', async () => {
      const mockUser = { id: 'user_1', stripeCustomerId: 'cus_123' };
      const mockAddon = { id: 'addon_1', status: 'INACTIVE' };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockAddonPackageRepo.findById.mockResolvedValue(mockAddon);

      await expect(service.purchaseAddon('user_1', 'addon_1')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('getUserAddonPurchases', () => {
    it('should return active and frozen addon purchases', async () => {
      const mockBalances = [{ id: 'balance_1' }];
      mockCreditBalanceRepo.findUserAddonPurchases.mockResolvedValue(
        mockBalances,
      );

      const result = await service.getUserAddonPurchases('user_1');

      expect(result).toEqual(mockBalances);
      expect(mockCreditBalanceRepo.findUserAddonPurchases).toHaveBeenCalledWith(
        'user_1',
      );
    });
  });

  describe('getUserAddonHistory', () => {
    it('should return all addon history', async () => {
      const mockBalances = [{ id: 'balance_1' }];
      mockCreditBalanceRepo.findUserAddonHistory.mockResolvedValue(
        mockBalances,
      );

      const result = await service.getUserAddonHistory('user_1');

      expect(result).toEqual(mockBalances);
      expect(mockCreditBalanceRepo.findUserAddonHistory).toHaveBeenCalledWith(
        'user_1',
      );
    });
  });
});
