import { Test, TestingModule } from '@nestjs/testing';
import { BillingScheduler } from './billing.scheduler';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentProviderFactory } from '../../payment/factories/payment-provider.factory';
import { PaymentProviderAdapter } from '../../payment/interfaces/payment-provider-adapter.interface';
import { PaymentProvider } from '../../payment/enums/payment-provider.enum';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('BillingScheduler', () => {
  let scheduler: BillingScheduler;
  let prisma: jest.Mocked<PrismaService>;
  let paymentProviderFactory: PaymentProviderFactory;
  let paymentAdapter: jest.Mocked<PaymentProviderAdapter>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      plan: {
        findUnique: jest.fn(),
      },
      subscription: {
        create: jest.fn(),
      },
      creditBalance: {
        create: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (p: any) => Promise<unknown>) =>
          cb(mockPrisma),
        ),
    };

    const mockPaymentAdapter = {
      createCustomer: jest.fn(),
    };

    const mockPaymentProviderFactory = {
      getAdapter: jest.fn().mockReturnValue(mockPaymentAdapter),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(3),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: PaymentProviderFactory,
          useValue: mockPaymentProviderFactory,
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    scheduler = module.get<BillingScheduler>(BillingScheduler);
    prisma = module.get(PrismaService);
    paymentProviderFactory = module.get(PaymentProviderFactory);
    paymentAdapter = paymentProviderFactory.getAdapter(
      PaymentProvider.STRIPE,
    ) as jest.Mocked<PaymentProviderAdapter>;
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('processPendingStripeSetup', () => {
    it('should do nothing if no pending users', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      await scheduler.processPendingStripeSetup();
      expect(prisma.plan.findUnique).not.toHaveBeenCalled();
    });

    it('should skip if max retries exceeded', async () => {
      const mockUser = {
        id: 'user_1',
        pendingStripeSetup: true,
        retryCount: 3,
        updatedAt: new Date(),
      };
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'free',
        prices: [{ id: 'price_1' }],
      });

      await scheduler.processPendingStripeSetup();

      expect(paymentAdapter.createCustomer).not.toHaveBeenCalled();
    });

    it('should skip if next retry time not reached', async () => {
      // updatedAt is now, retryCount is 1 -> next retry is in 5 mins
      const mockUser = {
        id: 'user_1',
        pendingStripeSetup: true,
        retryCount: 1,
        updatedAt: new Date(),
      };
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'free',
        prices: [{ id: 'price_1' }],
      });

      await scheduler.processPendingStripeSetup();

      expect(paymentAdapter.createCustomer).not.toHaveBeenCalled();
    });

    it('should process pending setup successfully', async () => {
      // updatedAt is 10 mins ago, retryCount is 1 -> next retry was 5 mins ago
      const updatedAt = new Date(new Date().getTime() - 10 * 60000);
      const mockUser = {
        id: 'user_1',
        email: 'test@test.com',
        pendingStripeSetup: true,
        retryCount: 1,
        updatedAt,
        name: 'Test',
      };
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'free',
        creditsIncluded: 100,
        prices: [{ id: 'price_1' }],
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (paymentAdapter.createCustomer as jest.Mock).mockResolvedValue({
        id: 'cus_1',
      });
      (prisma.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub_1',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      await scheduler.processPendingStripeSetup();

      expect(paymentAdapter.createCustomer).toHaveBeenCalledWith(
        'test@test.com',
        'Test',
      );
      expect(prisma.subscription.create).toHaveBeenCalled();
      expect(prisma.creditBalance.create).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { pendingStripeSetup: false, stripeCustomerId: 'cus_1' },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.registered.success',
        { userId: 'user_1' },
      );
    });

    it('should increment retry count on failure', async () => {
      const mockUser = {
        id: 'user_1',
        email: 'test@test.com',
        pendingStripeSetup: true,
        retryCount: 0,
        updatedAt: new Date(),
        name: 'Test',
      };
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'free',
        prices: [{ id: 'price_1' }],
      });

      paymentAdapter.createCustomer.mockRejectedValue(
        new Error('Stripe API error'),
      );

      await scheduler.processPendingStripeSetup();

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { retryCount: { increment: 1 } },
      });
    });
  });
});
