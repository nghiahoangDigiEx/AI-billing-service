/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { OutboxStatus, Prisma } from '@prisma/client';
import { BillingOutboxRelay } from './outbox-relay.service';
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from '../interfaces/event-publisher.interface';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createDomainEvent } from '@/events/domain-event';
import { INVOICE_PAID } from '@/events/event.constants';
import type { InvoicePaidPayload } from '@/events/payloads';

const makeEvent = (id = 'event_123'): ReturnType<typeof createDomainEvent> =>
  createDomainEvent<InvoicePaidPayload>(
    INVOICE_PAID,
    {
      userId: 'user_123',
      creditsIncluded: 1000,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-02-01'),
      sourceRef: 'event_123',
    },
    { providerEventId: 'event_123' },
    { id },
  );

describe('BillingOutboxRelay', () => {
  let relay: BillingOutboxRelay;
  let mockPrisma: {
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
    billingOutbox: {
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
    eventDlq: {
      create: jest.Mock;
    };
  };
  let mockPublisher: jest.Mocked<EventPublisher>;

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn(),
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(mockPrisma),
      ),
      billingOutbox: {
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      eventDlq: {
        create: jest.fn(),
      },
    };

    mockPublisher = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingOutboxRelay,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockPublisher,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    relay = module.get<BillingOutboxRelay>(BillingOutboxRelay);
  });

  describe('claimPendingEvents', () => {
    it('should return claimed rows with parsed payloads', async () => {
      const event = makeEvent();
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'outbox_1',
          attempts: 0,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.JsonValue,
        },
      ]);

      const result = await relay.claimPendingEvents();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('outbox_1');
      expect(result[0].attempts).toBe(0);
      expect(result[0].payload.id).toBe('event_123');
      expect(result[0].payload.occurredAt).toBeInstanceOf(Date);
    });
  });

  describe('processPendingEvents', () => {
    it('should mark event PROCESSED on successful publish', async () => {
      const event = makeEvent();
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'outbox_1',
          attempts: 1,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.JsonValue,
        },
      ]);
      mockPublisher.publish.mockResolvedValue(undefined);

      await relay.processPendingEvents();

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'event_123' }),
      );
      expect(mockPrisma.billingOutbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox_1' },
        data: expect.objectContaining({
          status: OutboxStatus.PROCESSED,
          lockedAt: null,
          errorMessage: null,
        }),
      });
    });

    it('should treat P2002 duplicate violation as already processed', async () => {
      const event = makeEvent();
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'outbox_1',
          attempts: 1,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.JsonValue,
        },
      ]);
      mockPublisher.publish.mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
      );

      await relay.processPendingEvents();

      expect(mockPrisma.billingOutbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox_1' },
        data: expect.objectContaining({
          status: OutboxStatus.PROCESSED,
        }),
      });
      expect(mockPrisma.eventDlq.create).not.toHaveBeenCalled();
    });

    it('should schedule retry with backoff on transient error', async () => {
      const event = makeEvent();
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'outbox_1',
          attempts: 1,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.JsonValue,
        },
      ]);
      mockPublisher.publish.mockRejectedValue(
        Object.assign(new Error('Timeout'), { code: 'P2024' }),
      );

      const before = Date.now();
      await relay.processPendingEvents();
      const after = Date.now();

      expect(mockPrisma.billingOutbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox_1' },
        data: expect.objectContaining({
          status: OutboxStatus.PENDING,
          lockedAt: null,
          errorMessage: 'Timeout',
          nextAttemptAt: expect.any(Date),
        }),
      });

      const call = mockPrisma.billingOutbox.update.mock.calls[0][0];
      const nextAttemptAt = call.data.nextAttemptAt.getTime();
      expect(nextAttemptAt).toBeGreaterThanOrEqual(before + 5000);
      expect(nextAttemptAt).toBeLessThanOrEqual(after + 5000 + 1000);
    });

    it('should move event to DLQ on permanent error', async () => {
      const event = makeEvent();
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'outbox_1',
          attempts: 1,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.JsonValue,
        },
      ]);
      mockPublisher.publish.mockRejectedValue(
        Object.assign(new Error('Foreign key violation'), { code: 'P2003' }),
      );

      await relay.processPendingEvents();

      expect(mockPrisma.eventDlq.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: 'event_123',
          type: INVOICE_PAID,
          errorMessage: 'Foreign key violation',
          attempts: 1,
        }),
      });
      expect(mockPrisma.billingOutbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox_1' },
        data: expect.objectContaining({
          status: OutboxStatus.DEAD_LETTERED,
          lockedAt: null,
          errorMessage: 'Foreign key violation',
        }),
      });
    });

    it('should move event to DLQ after max attempts', async () => {
      const event = makeEvent();
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'outbox_1',
          attempts: 5,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.JsonValue,
        },
      ]);
      mockPublisher.publish.mockRejectedValue(
        Object.assign(new Error('Timeout'), { code: 'P2024' }),
      );

      await relay.processPendingEvents();

      expect(mockPrisma.eventDlq.create).toHaveBeenCalled();
      expect(mockPrisma.billingOutbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox_1' },
        data: expect.objectContaining({
          status: OutboxStatus.DEAD_LETTERED,
        }),
      });
    });

    it('should handle concurrent claim races by returning disjoint sets', async () => {
      const event = makeEvent();
      let callCount = 0;
      mockPrisma.$queryRaw.mockImplementation(() => {
        callCount += 1;
        return Promise.resolve([
          {
            id: `outbox_${callCount}`,
            attempts: 0,
            payload: JSON.parse(JSON.stringify(event)) as Prisma.JsonValue,
          },
        ]);
      });
      mockPublisher.publish.mockResolvedValue(undefined);

      const [first, second] = await Promise.all([
        relay.claimPendingEvents(),
        relay.claimPendingEvents(),
      ]);

      expect(first[0].id).not.toBe(second[0].id);
    });
  });

  describe('purgeProcessedEvents', () => {
    it('should delete processed rows older than retention', async () => {
      mockPrisma.billingOutbox.deleteMany.mockResolvedValue({ count: 3 });

      await relay.purgeProcessedEvents();

      expect(mockPrisma.billingOutbox.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: OutboxStatus.PROCESSED,
          processedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      });
    });
  });
});
