import { Test, TestingModule } from '@nestjs/testing';
import { InvoicePaidStrategy } from './invoice-paid.strategy';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';

describe('InvoicePaidStrategy', () => {
  let strategy: InvoicePaidStrategy;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockPrisma = {
      user: { findFirst: jest.fn() },
      planPrice: { findFirst: jest.fn() },
      subscription: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
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
        InvoicePaidStrategy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    strategy = module.get<InvoicePaidStrategy>(InvoicePaidStrategy);
    prisma = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should handle invoice.paid event', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user_1' });

    (prisma.planPrice.findFirst as jest.Mock).mockResolvedValue({
      id: 'price_1',
      planId: 'plan_1',
      plan: { creditsIncluded: 100 },
    });

    (prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
      id: 'sub_1',
      planPriceId: 'price_1',
    });

    const mockEvent = {
      data: {
        object: {
          id: 'inv_1',
          customer: 'cus_1',
          subscription: 'sub_stripe_1',
          lines: {
            data: [
              { price: { id: 'price_1' }, period: { start: 1000, end: 2000 } },
            ],
          },
        },
      },
    } as unknown as Stripe.Event;

    await strategy.handle(mockEvent);

    const callArgs = (
      prisma.subscription.update as jest.Mock<
        any,
        [Prisma.SubscriptionUpdateArgs]
      >
    ).mock.calls[0][0];
    expect(callArgs.where).toEqual({ id: 'sub_1' });
    expect(callArgs.data.status).toEqual('ACTIVE');
    expect(callArgs.data.currentPeriodStart).toBeInstanceOf(Date);
    expect(callArgs.data.currentPeriodEnd).toBeInstanceOf(Date);
    expect(prisma.creditBalance.updateMany as jest.Mock).toHaveBeenCalledTimes(
      2,
    );
    expect(prisma.creditBalance.create as jest.Mock).toHaveBeenCalled();
    expect(eventEmitter.emit as jest.Mock).toHaveBeenCalledWith(
      'invoice.paid',
      {
        subscriptionId: 'sub_1',
      },
    );
  });
});
