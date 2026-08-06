import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { StripeWebhookStrategy } from '@/modules/stripe/strategies/stripe-webhook.strategy';
import { StripeWebhookService } from '@/modules/stripe/services/stripe-webhook.service';
import { OutboxRelay } from '@/modules/event-outbox/providers/outbox-relay.service';
import { ParsedWebhookEvent } from '@/modules/payment/interfaces/webhook-strategy.interface';
import {
  BillingOutboxStatus,
  CreditSource,
  SubscriptionStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

jest.setTimeout(30000);

describe('WebhookController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let stripeWebhookStrategy: StripeWebhookStrategy;
  let stripeWebhookService: StripeWebhookService;
  let outboxRelay: OutboxRelay;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    stripeWebhookStrategy = app.get<StripeWebhookStrategy>(
      StripeWebhookStrategy,
    );
    stripeWebhookService = app.get<StripeWebhookService>(StripeWebhookService);
    outboxRelay = app.get<OutboxRelay>(OutboxRelay);

    // Clean up DB before test
    await prisma.eventDlq.deleteMany();
    await prisma.creditInbox.deleteMany();
    await prisma.billingOutbox.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.creditTransaction.deleteMany();
    await prisma.creditBalance.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.addonPurchase.deleteMany();
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.addonPackage.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.eventDlq.deleteMany();
    await prisma.creditInbox.deleteMany();
    await prisma.billingOutbox.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.creditTransaction.deleteMany();
    await prisma.creditBalance.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.addonPurchase.deleteMany();
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.addonPackage.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
    // Let NestJS lifecycle handle Prisma disconnect, or do it after app close
    await prisma.$disconnect();
  });

  describe('POST /webhooks/stripe', () => {
    it('should reject requests without signature', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({ type: 'invoice.paid' })
        .expect(400);
    });

    it('should process a valid webhook event idempotently', async () => {
      const eventId = 'evt_test_1';
      const mockEvent = {
        id: eventId,
        type: 'some.unsupported.event',
        data: { object: {} },
      };

      jest
        .spyOn(stripeWebhookStrategy, 'parseEvent')
        .mockReturnValue(mockEvent as unknown as ParsedWebhookEvent);

      const handleEventSpy = jest.spyOn(stripeWebhookService, 'handleEvent');

      // First request (should process)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send(mockEvent)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ received: true });
        });

      // Wait for background webhook processing to complete
      await handleEventSpy.mock.results[0].value;

      // Verify it was recorded
      const dbEvent = await prisma.webhookEvent.findUnique({
        where: { stripeEventId: eventId },
      });
      expect(dbEvent).toBeDefined();
      expect(dbEvent?.processedAt).toBeDefined();

      // Second request (should skip but return 200)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send(mockEvent)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ received: true });
        });
    });

    it('should provision subscription and credits on invoice.paid', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'webhook-user@example.com',
          password: 'password123',
          stripeCustomerId: 'cus_webhook_1',
        },
      });

      const plan = await prisma.plan.create({
        data: {
          stripeProductId: 'prod_webhook_1',
          name: 'Pro',
          slug: 'pro',
          creditsIncluded: 1000,
        },
      });

      await prisma.planPrice.create({
        data: {
          stripePriceId: 'price_webhook_1',
          planId: plan.id,
          billingInterval: 'MONTH',
          amount: 1000,
          currency: 'usd',
        },
      });

      const eventId = `evt_invoice_paid_${randomUUID()}`;
      const mockEvent = {
        id: eventId,
        type: 'invoice.paid',
        data: {
          customer: 'cus_webhook_1',
          subscription: 'sub_webhook_1',
          lines: {
            data: [
              {
                price: { id: 'price_webhook_1' },
                period: {
                  start: 1704067200,
                  end: 1706745600,
                },
              },
            ],
          },
        },
      };

      jest
        .spyOn(stripeWebhookStrategy, 'parseEvent')
        .mockReturnValue(mockEvent as unknown as ParsedWebhookEvent);

      const handleEventSpy = jest.spyOn(stripeWebhookService, 'handleEvent');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send(mockEvent)
        .expect(200);

      // Wait for webhook handler and then run relay to deliver the outbox event
      await handleEventSpy.mock.results[0].value;
      await outboxRelay.processPendingEvents();

      const subscription = await prisma.subscription.findFirst({
        where: { userId: user.id },
      });
      expect(subscription).not.toBeNull();
      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);

      const creditBalance = await prisma.creditBalance.findFirst({
        where: { userId: user.id, source: CreditSource.MONTHLY },
      });
      expect(creditBalance).not.toBeNull();
      expect(creditBalance?.totalCredits).toBe(1000);
      expect(creditBalance?.sourceRef).toBe(eventId);

      const outbox = await prisma.billingOutbox.findFirst({
        where: { eventId },
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.status).toBe(BillingOutboxStatus.PROCESSED);

      const creditInbox = await prisma.creditInbox.findFirst({
        where: { eventId },
      });
      expect(creditInbox).not.toBeNull();
    });

    it('should not double-provision credits on duplicate webhook delivery', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'webhook-dup@example.com',
          password: 'password123',
          stripeCustomerId: 'cus_webhook_dup',
        },
      });

      const plan = await prisma.plan.create({
        data: {
          stripeProductId: 'prod_webhook_dup',
          name: 'Pro Dup',
          slug: 'pro-dup',
          creditsIncluded: 500,
        },
      });

      await prisma.planPrice.create({
        data: {
          stripePriceId: 'price_webhook_dup',
          planId: plan.id,
          billingInterval: 'MONTH',
          amount: 1000,
          currency: 'usd',
        },
      });

      const eventId = `evt_invoice_paid_dup_${randomUUID()}`;
      const mockEvent = {
        id: eventId,
        type: 'invoice.paid',
        data: {
          customer: 'cus_webhook_dup',
          subscription: 'sub_webhook_dup',
          lines: {
            data: [
              {
                price: { id: 'price_webhook_dup' },
                period: { start: 1704067200, end: 1706745600 },
              },
            ],
          },
        },
      };

      jest
        .spyOn(stripeWebhookStrategy, 'parseEvent')
        .mockReturnValue(mockEvent as unknown as ParsedWebhookEvent);

      const handleEventSpy = jest.spyOn(stripeWebhookService, 'handleEvent');

      // First delivery
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send(mockEvent)
        .expect(200);

      await handleEventSpy.mock.results[0].value;
      await outboxRelay.processPendingEvents();

      // Second delivery (same stripe event id)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send(mockEvent)
        .expect(200);

      await handleEventSpy.mock.results[1].value;
      await outboxRelay.processPendingEvents();

      const balances = await prisma.creditBalance.findMany({
        where: { userId: user.id, source: CreditSource.MONTHLY },
      });
      expect(balances).toHaveLength(1);
      expect(balances[0].totalCredits).toBe(500);
    });

    it('should handle verification errors', async () => {
      jest.spyOn(stripeWebhookStrategy, 'parseEvent').mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_sig')
        .send({})
        .expect(400);
    });
  });
});
