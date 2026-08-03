import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhookStrategyFactory } from '../strategies/webhook-strategy.factory';
import Stripe from 'stripe';
import { WebhookEventStatus, Prisma } from '@prisma/client';

describe('WebhookService', () => {
  let service: WebhookService;
  let prisma: jest.Mocked<PrismaService>;
  let strategyFactory: jest.Mocked<WebhookStrategyFactory>;

  beforeEach(async () => {
    const mockPrisma = {
      webhookEvent: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockStrategyFactory = {
      getStrategy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: WebhookStrategyFactory, useValue: mockStrategyFactory },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    prisma = module.get(PrismaService);
    strategyFactory = module.get(WebhookStrategyFactory);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleEvent', () => {
    it('should skip if event was already processed', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue({
        status: WebhookEventStatus.PROCESSED,
      });

      const mockEvent = { id: 'evt_1', type: 'invoice.paid' } as Stripe.Event;
      await service.handleEvent(mockEvent);

      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.update).not.toHaveBeenCalled();
      expect(strategyFactory.getStrategy).not.toHaveBeenCalled();
    });

    it('should call strategy and update status to PROCESSED', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);

      const mockStrategy = {
        canHandle: jest.fn().mockReturnValue(true),
        handle: jest.fn().mockResolvedValue(undefined),
      };
      strategyFactory.getStrategy.mockReturnValue(mockStrategy);

      const mockEvent = { id: 'evt_1', type: 'invoice.paid' } as Stripe.Event;
      await service.handleEvent(mockEvent);

      expect(strategyFactory.getStrategy).toHaveBeenCalledWith('invoice.paid');
      expect(mockStrategy.handle).toHaveBeenCalledWith(mockEvent);

      const callArgs = (
        prisma.webhookEvent.update as jest.Mock<
          any,
          [Prisma.WebhookEventUpdateArgs]
        >
      ).mock.calls[0][0];
      expect(callArgs.where).toEqual({ stripeEventId: 'evt_1' });
      expect(callArgs.data.status).toEqual(WebhookEventStatus.PROCESSED);
    });

    it('should mark event as UNHANDLED if no strategy is found', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);

      strategyFactory.getStrategy.mockReturnValue(undefined);

      const mockEvent = {
        id: 'evt_1',
        type: 'unknown.event',
      } as unknown as Stripe.Event;
      await service.handleEvent(mockEvent);

      expect(strategyFactory.getStrategy).toHaveBeenCalledWith('unknown.event');

      const callArgs = (
        prisma.webhookEvent.update as jest.Mock<
          any,
          [Prisma.WebhookEventUpdateArgs]
        >
      ).mock.calls[0][0];
      expect(callArgs.where).toEqual({ stripeEventId: 'evt_1' });
      expect(callArgs.data.status).toEqual(WebhookEventStatus.UNHANDLED);
    });

    it('should mark event as FAILED if strategy throws error', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);

      const mockStrategy = {
        canHandle: jest.fn().mockReturnValue(true),
        handle: jest.fn().mockRejectedValue(new Error('Strategy Error')),
      };
      strategyFactory.getStrategy.mockReturnValue(mockStrategy);

      const mockEvent = { id: 'evt_1', type: 'invoice.paid' } as Stripe.Event;

      await service.handleEvent(mockEvent);

      const callArgs = (
        prisma.webhookEvent.update as jest.Mock<
          any,
          [Prisma.WebhookEventUpdateArgs]
        >
      ).mock.calls[0][0];
      expect(callArgs.where).toEqual({ stripeEventId: 'evt_1' });
      expect(callArgs.data.status).toEqual(WebhookEventStatus.FAILED);
      expect(callArgs.data.errorMessage).toEqual('Strategy Error');
    });

    it('should throw if error is a unique constraint violation', async () => {
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);

      const error = new Error('Unique constraint failed') as Error & {
        code: string;
      };
      error.code = 'P2002';

      const mockStrategy = {
        canHandle: jest.fn().mockReturnValue(true),
        handle: jest.fn().mockRejectedValue(error),
      };
      strategyFactory.getStrategy.mockReturnValue(mockStrategy);

      const mockEvent = { id: 'evt_2', type: 'invoice.paid' } as Stripe.Event;

      await expect(service.handleEvent(mockEvent)).rejects.toThrow(
        'Unique constraint failed',
      );
    });
  });
});
