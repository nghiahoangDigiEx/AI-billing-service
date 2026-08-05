/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { BillingOutboxStatus, Prisma } from '@prisma/client';
import { BillingOutboxWriter } from './billing-outbox-writer.service';
import { createDomainEvent } from '@/events/domain-event';
import { INVOICE_PAID } from '@/events/event.constants';
import type { InvoicePaidPayload } from '@/events/payloads';

describe('BillingOutboxWriter', () => {
  let service: BillingOutboxWriter;
  let mockTx: {
    billingOutbox: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockTx = {
      billingOutbox: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingOutboxWriter],
    }).compile();

    service = module.get<BillingOutboxWriter>(BillingOutboxWriter);
  });

  it('should convert a domain event to a billing outbox create input', () => {
    const event = createDomainEvent<InvoicePaidPayload>(
      INVOICE_PAID,
      {
        userId: 'user_123',
        creditsIncluded: 1000,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-02-01'),
        sourceRef: 'event_123',
      },
      { providerEventId: 'event_123' },
      { id: 'event_123' },
    );

    const input = service.toCreateInput(event);

    expect(input.eventId).toBe('event_123');
    expect(input.type).toBe(INVOICE_PAID);
    expect(input.status).toBe(BillingOutboxStatus.PENDING);
    expect(input.attempts).toBe(0);
    expect(input.payload).toEqual(
      expect.objectContaining({
        id: 'event_123',
        type: INVOICE_PAID,
        version: 1,
        payload: expect.objectContaining({
          userId: 'user_123',
          creditsIncluded: 1000,
          sourceRef: 'event_123',
        }),
        metadata: { providerEventId: 'event_123' },
      }),
    );
  });

  it('should insert a billing outbox row inside a transaction', async () => {
    const event = createDomainEvent<InvoicePaidPayload>(
      INVOICE_PAID,
      {
        userId: 'user_123',
        creditsIncluded: 1000,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-02-01'),
        sourceRef: 'event_123',
      },
      { providerEventId: 'event_123' },
      { id: 'event_123' },
    );

    await service.insert(mockTx as unknown as Prisma.TransactionClient, event);

    expect(mockTx.billingOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'event_123',
        type: INVOICE_PAID,
        status: BillingOutboxStatus.PENDING,
      }),
    });
  });
});
