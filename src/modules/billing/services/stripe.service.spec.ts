import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_mock';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCustomer', () => {
    it('should create a Stripe customer', async () => {
      const mockCustomer = { id: 'cus_mock', email: 'test@example.com' };
      (service as unknown as { stripe: any }).stripe = {
        customers: {
          create: jest.fn().mockResolvedValue(mockCustomer),
        },
      };

      const result = await service.createCustomer('test@example.com');
      expect(result).toEqual(mockCustomer);
    });
  });

  describe('createSubscription', () => {
    it('should create a Stripe subscription', async () => {
      const mockSubscription = { id: 'sub_mock', customer: 'cus_mock' };
      (service as unknown as { stripe: any }).stripe = {
        subscriptions: {
          create: jest.fn().mockResolvedValue(mockSubscription),
        },
      };

      const result = await service.createSubscription('cus_mock', 'price_mock');
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel a Stripe subscription', async () => {
      const mockSubscription = { id: 'sub_mock', status: 'canceled' };
      (service as unknown as { stripe: any }).stripe = {
        subscriptions: {
          cancel: jest.fn().mockResolvedValue(mockSubscription),
        },
      };

      const result = await service.cancelSubscription('sub_mock');
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('createProduct', () => {
    it('should create a Stripe product', async () => {
      const mockProduct = { id: 'prod_mock', name: 'Test Product' };
      (service as unknown as { stripe: any }).stripe = {
        products: {
          create: jest.fn().mockResolvedValue(mockProduct),
        },
      };

      const result = await service.createProduct('Test Product');
      expect(result).toEqual(mockProduct);
    });
  });

  describe('createPrice', () => {
    it('should create a Stripe price', async () => {
      const mockPrice = { id: 'price_mock', product: 'prod_mock' };
      (service as unknown as { stripe: any }).stripe = {
        prices: {
          create: jest.fn().mockResolvedValue(mockPrice),
        },
      };

      const result = await service.createPrice(
        'prod_mock',
        1000,
        'usd',
        'month',
      );
      expect(result).toEqual(mockPrice);
    });
  });

  describe('archiveProduct', () => {
    it('should archive a Stripe product', async () => {
      const mockProduct = { id: 'prod_mock', active: false };
      (service as unknown as { stripe: any }).stripe = {
        products: {
          update: jest.fn().mockResolvedValue(mockProduct),
        },
      };

      const result = await service.archiveProduct('prod_mock');
      expect(result).toEqual(mockProduct);
    });
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent', async () => {
      const mockPaymentIntent = { id: 'pi_mock', amount: 1000 };
      (service as unknown as { stripe: any }).stripe = {
        paymentIntents: {
          create: jest.fn().mockResolvedValue(mockPaymentIntent),
        },
      };

      const result = await service.createPaymentIntent(1000, 'usd', 'cus_123', {
        userId: 'user_123',
      });
      expect(result).toEqual(mockPaymentIntent);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature', () => {
      const mockEvent = { id: 'evt_mock', type: 'invoice.paid' };
      (service as unknown as { stripe: any }).stripe = {
        webhooks: {
          constructEvent: jest.fn().mockReturnValue(mockEvent),
        },
      };

      const result = service.verifyWebhookSignature('payload', 'signature');
      expect(result).toEqual(mockEvent);
    });
  });
});
