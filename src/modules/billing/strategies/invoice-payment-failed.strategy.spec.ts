import { Test, TestingModule } from '@nestjs/testing';
import { InvoicePaymentFailedStrategy } from './invoice-payment-failed.strategy';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';

describe('InvoicePaymentFailedStrategy', () => {
  let strategy: InvoicePaymentFailedStrategy;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockPrisma = {
      user: { findFirst: jest.fn() },
      subscription: { findFirst: jest.fn(), update: jest.fn() },
      creditBalance: { updateMany: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (p: any) => Promise<unknown>) =>
          cb(mockPrisma),
        ),
    };

    const mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicePaymentFailedStrategy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    strategy = module.get<InvoicePaymentFailedStrategy>(
      InvoicePaymentFailedStrategy,
    );
    prisma = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should handle invoice.payment_failed event', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user_1' });

    (prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
      id: 'sub_1',
    });

    const mockEvent = {
      data: {
        object: {
          id: 'inv_1',
          customer: 'cus_1',
          subscription: 'sub_stripe_1',
        },
      },
    } as unknown as Stripe.Event;

    await strategy.handle(mockEvent);

    expect(prisma.subscription.update as jest.Mock).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: { status: 'PAST_DUE' },
    });
    expect(prisma.creditBalance.updateMany as jest.Mock).toHaveBeenCalled();
    expect(eventEmitter.emit as jest.Mock).toHaveBeenCalledWith(
      'subscription.payment_failed',
      { subscriptionId: 'sub_1' },
    );
  });
});
