import { Test, TestingModule } from '@nestjs/testing';
import { PaymentIntentSucceededStrategy } from './payment-intent-succeeded.strategy';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';

describe('PaymentIntentSucceededStrategy', () => {
  let strategy: PaymentIntentSucceededStrategy;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockPrisma = {
      addonPackage: { findUnique: jest.fn() },
      addonPurchase: { create: jest.fn() },
      creditBalance: { create: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (p: any) => Promise<unknown>) =>
          cb(mockPrisma),
        ),
    };

    const mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentIntentSucceededStrategy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    strategy = module.get<PaymentIntentSucceededStrategy>(
      PaymentIntentSucceededStrategy,
    );
    prisma = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should handle payment_intent.succeeded event', async () => {
    // @ts-expect-error type override for testing
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    prisma.addonPackage.findUnique.mockResolvedValue({
      id: 'addon_1',
      credits: 50,
    });

    // @ts-expect-error type override for testing
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    prisma.addonPurchase.create.mockResolvedValue({
      id: 'purchase_1',
    });

    const mockEvent = {
      data: {
        object: {
          id: 'pi_1',
          metadata: { userId: 'user_1', addonPackageId: 'addon_1' },
        },
      },
    } as unknown as Stripe.Event;

    await strategy.handle(mockEvent);

    expect(prisma.addonPurchase.create as jest.Mock).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        addonPackageId: 'addon_1',
        stripePaymentIntentId: 'pi_1',
      },
    });
    expect(prisma.creditBalance.create as jest.Mock).toHaveBeenCalled();
    expect(eventEmitter.emit as jest.Mock).toHaveBeenCalledWith(
      'addon.purchased',
      {
        userId: 'user_1',
        addonPackageId: 'addon_1',
      },
    );
  });
});
