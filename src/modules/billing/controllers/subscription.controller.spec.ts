import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController } from './subscription.controller';
import { BillingService } from '../services/billing.service';
import { RequirePaidSubscriptionGuard } from '../guards/require-paid-subscription.guard';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let billingService: Partial<BillingService>;

  beforeEach(async () => {
    billingService = {
      upgradeSubscription: jest.fn().mockResolvedValue({
        status: 'Accepted',
        stripeSubscriptionId: 'sub_123',
      }),
      getCurrentSubscription: jest.fn().mockResolvedValue({ id: 'sub_1' }),
      getSubscriptionHistory: jest.fn().mockResolvedValue([{ id: 'sub_1' }]),
      purchaseAddon: jest.fn().mockResolvedValue({
        status: 'Accepted',
        paymentIntentId: 'pi_123',
        clientSecret: 'secret_123',
      }),
      getUserAddonPurchases: jest
        .fn()
        .mockResolvedValue([{ id: 'addon_purchase_1' }]),
      getUserAddonHistory: jest
        .fn()
        .mockResolvedValue([
          { id: 'addon_purchase_1' },
          { id: 'addon_purchase_2' },
        ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        {
          provide: BillingService,
          useValue: billingService,
        },
      ],
    })
      .overrideGuard(RequirePaidSubscriptionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SubscriptionController>(SubscriptionController);
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription', async () => {
      const result = await controller.upgradeSubscription(
        { id: 'user_1' },
        { planPriceId: 'price_1' },
      );
      expect(result).toEqual({
        status: 'Accepted',
        stripeSubscriptionId: 'sub_123',
      });
      expect(billingService.upgradeSubscription).toHaveBeenCalledWith(
        'user_1',
        'price_1',
      );
    });
  });

  describe('getCurrentSubscription', () => {
    it('should get current subscription', async () => {
      const result = await controller.getCurrentSubscription({ id: 'user_1' });
      expect(result).toEqual({ id: 'sub_1' });
      expect(billingService.getCurrentSubscription).toHaveBeenCalledWith(
        'user_1',
      );
    });
  });

  describe('getSubscriptionHistory', () => {
    it('should get subscription history', async () => {
      const result = await controller.getSubscriptionHistory({ id: 'user_1' });
      expect(result).toEqual([{ id: 'sub_1' }]);
      expect(billingService.getSubscriptionHistory).toHaveBeenCalledWith(
        'user_1',
      );
    });
  });

  describe('purchaseAddon', () => {
    it('should purchase addon', async () => {
      const result = await controller.purchaseAddon(
        { id: 'user_1' },
        'addon_1',
      );
      expect(result).toEqual({
        status: 'Accepted',
        paymentIntentId: 'pi_123',
        clientSecret: 'secret_123',
      });
      expect(billingService.purchaseAddon).toHaveBeenCalledWith(
        'user_1',
        'addon_1',
      );
    });
  });

  describe('getUserAddonPurchases', () => {
    it('should get user active addon purchases', async () => {
      const result = await controller.getUserAddonPurchases({ id: 'user_1' });
      expect(result).toEqual([{ id: 'addon_purchase_1' }]);
      expect(billingService.getUserAddonPurchases).toHaveBeenCalledWith(
        'user_1',
      );
    });
  });

  describe('getUserAddonHistory', () => {
    it('should get user addon history', async () => {
      const result = await controller.getUserAddonHistory({ id: 'user_1' });
      expect(result).toEqual([
        { id: 'addon_purchase_1' },
        { id: 'addon_purchase_2' },
      ]);
      expect(billingService.getUserAddonHistory).toHaveBeenCalledWith('user_1');
    });
  });
});
