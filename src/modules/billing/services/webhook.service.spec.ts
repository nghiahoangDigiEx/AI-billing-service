import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';

describe('WebhookService', () => {
  let service: WebhookService;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockPrisma = {
      webhookEvent: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      creditBalance: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      plan: {
        findUnique: jest.fn(),
      },
      addonPackage: {
        findUnique: jest.fn(),
      },
      addonPurchase: {
        create: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (p: any) => Promise<unknown>) =>
          cb(mockPrisma),
        ),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    prisma = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processEvent', () => {
    it('should skip if event was already processed', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue({
        status: 'PROCESSED',
      });

      const mockEvent = { id: 'evt_1', type: 'invoice.paid' } as Stripe.Event;
      await service.processEvent(mockEvent);

      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.update).not.toHaveBeenCalled();
    });

    it('should handle invoice.paid event', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      const mockSub = {
        id: 'sub_1',
        userId: 'user_1',
        status: 'PAST_DUE',
        plan: { creditsIncluded: 1000 },
      };
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSub);

      const mockEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            subscription: 'sub_stripe_1',
            lines: { data: [{ period: { start: 1000, end: 2000 } }] },
          },
        },
      } as unknown as Stripe.Event;

      await service.processEvent(mockEvent);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: { status: 'ACTIVE' },
      });
      expect(prisma.creditBalance.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_1', source: 'MONTHLY', status: 'ACTIVE' },
        data: { status: 'EXHAUSTED' },
      });
      expect(prisma.creditBalance.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_1', source: 'ADDON', status: 'FROZEN' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { status: 'ACTIVE', unfrozenAt: expect.any(Date) },
      });
      expect(prisma.creditBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            source: 'MONTHLY',
            sourceRef: 'inv_1',
            totalCredits: 1000,
          }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('invoice.paid', {
        subscriptionId: 'sub_1',
      });
      expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { stripeEventId: 'evt_1' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { status: 'PROCESSED', processedAt: expect.any(Date) },
      });
    });

    it('should handle invoice.payment_failed event', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      const mockSub = { id: 'sub_1', userId: 'user_1' };
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSub);

      const mockEvent = {
        id: 'evt_2',
        type: 'invoice.payment_failed',
        data: { object: { subscription: 'sub_stripe_1' } },
      } as unknown as Stripe.Event;

      await service.processEvent(mockEvent);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: { status: 'PAST_DUE' },
      });
      expect(prisma.creditBalance.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_1', source: 'ADDON', status: 'ACTIVE' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { status: 'FROZEN', frozenAt: expect.any(Date) },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'subscription.payment_failed',
        { subscriptionId: 'sub_1' },
      );
    });

    it('should handle customer.subscription.deleted event', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      const mockSub = { id: 'sub_1', userId: 'user_1' };
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSub);
      (prisma.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'plan_free',
        creditsIncluded: 100,
        prices: [{ id: 'price_free' }],
      });
      (prisma.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub_free',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      const mockEvent = {
        id: 'evt_3',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_stripe_1' } },
      } as unknown as Stripe.Event;

      await service.processEvent(mockEvent);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.subscription.create).toHaveBeenCalled();
      expect(prisma.creditBalance.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_1', source: 'ADDON', status: 'ACTIVE' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { status: 'FROZEN', frozenAt: expect.any(Date) },
      });
      expect(prisma.creditBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            source: 'MONTHLY',
            sourceRef: 'sub_free',
            totalCredits: 100,
          }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('subscription.deleted', {
        subscriptionId: 'sub_1',
      });
    });

    it('should handle payment_intent.succeeded event', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      const mockAddon = { id: 'addon_1', credits: 50 };
      (prisma.addonPackage.findUnique as jest.Mock).mockResolvedValue(
        mockAddon,
      );
      (prisma.addonPurchase.create as jest.Mock).mockResolvedValue({
        id: 'purchase_1',
      });

      const mockEvent = {
        id: 'evt_4',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            metadata: { userId: 'user_1', addonPackageId: 'addon_1' },
          },
        },
      } as unknown as Stripe.Event;

      await service.processEvent(mockEvent);

      expect(prisma.addonPurchase.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_1',
          addonPackageId: 'addon_1',
          stripePaymentIntentId: 'pi_1',
        },
      });
      expect(prisma.creditBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            source: 'ADDON',
            sourceRef: 'purchase_1',
            totalCredits: 50,
          }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('addon.purchased', {
        userId: 'user_1',
        addonPackageId: 'addon_1',
      });
    });
  });
});
