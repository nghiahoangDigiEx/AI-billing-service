import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionDeletedStrategy } from './subscription-deleted.strategy';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';

describe('SubscriptionDeletedStrategy', () => {
  let strategy: SubscriptionDeletedStrategy;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockPrisma = {
      subscription: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      plan: { findUnique: jest.fn() },
      creditBalance: { updateMany: jest.fn(), create: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (p: any) => Promise<unknown>) =>
          cb(mockPrisma),
        ),
    };

    const mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionDeletedStrategy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    strategy = module.get<SubscriptionDeletedStrategy>(
      SubscriptionDeletedStrategy,
    );
    prisma = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should handle customer.subscription.deleted event', async () => {
    // @ts-expect-error type override for testing
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub_1',
      userId: 'user_1',
    });

    // @ts-expect-error type override for testing
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan_free',
      prices: [{ id: 'price_free' }],
      creditsIncluded: 10,
    });

    // @ts-expect-error type override for testing
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    prisma.subscription.create.mockResolvedValue({
      id: 'sub_2',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    });

    const mockEvent = {
      data: {
        object: {
          id: 'sub_stripe_1',
        },
      },
    } as unknown as Stripe.Event;

    await strategy.handle(mockEvent);

    expect(prisma.subscription.update as jest.Mock).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: { status: 'CANCELLED' },
    });
    expect(prisma.subscription.create as jest.Mock).toHaveBeenCalled();
    expect(prisma.creditBalance.updateMany as jest.Mock).toHaveBeenCalled();
    expect(prisma.creditBalance.create as jest.Mock).toHaveBeenCalled();
    expect(eventEmitter.emit as jest.Mock).toHaveBeenCalledWith(
      'subscription.deleted',
      {
        subscriptionId: 'sub_1',
      },
    );
  });
});
