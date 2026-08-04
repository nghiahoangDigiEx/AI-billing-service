import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { StripeWebhookStrategy } from '@/modules/stripe/strategies/stripe-webhook.strategy';
import { ParsedWebhookEvent } from '@/modules/payment/interfaces/webhook-strategy.interface';

jest.setTimeout(30000);

describe('WebhookController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let stripeWebhookStrategy: StripeWebhookStrategy;

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

    // Clean up DB before test
    await prisma.webhookEvent.deleteMany();
    await prisma.creditBalance.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.addonPurchase.deleteMany();
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.addonPackage.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany();
    await prisma.creditBalance.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.addonPurchase.deleteMany();
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.addonPackage.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
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

      // Mock parseEvent
      jest
        .spyOn(stripeWebhookStrategy, 'parseEvent')
        .mockReturnValue(mockEvent as unknown as ParsedWebhookEvent);

      // First request (should process)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send(mockEvent)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({ received: true });
        });

      // Verify it was recorded
      const dbEvent = await prisma.webhookEvent.findUnique({
        where: { stripeEventId: eventId },
      });
      expect(dbEvent).toBeDefined();
      expect(dbEvent?.processedAt).toBeDefined();

      // Second request (should skip but return 201)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send(mockEvent)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({ received: true });
        });
    });

    it('should handle verification errors', async () => {
      jest.spyOn(stripeWebhookStrategy, 'parseEvent').mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_sig')
        .send({})
        .expect(400);
    });
  });
});
