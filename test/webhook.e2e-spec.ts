import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import Stripe from 'stripe';
import { PrismaService } from '../src/prisma/prisma.service';
import { StripeService } from '../src/modules/billing/stripe.service';

jest.setTimeout(30000);

describe('WebhookController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let stripeService: StripeService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    stripeService = app.get<StripeService>(StripeService);

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

      // Mock verifyWebhookSignature
      jest
        .spyOn(stripeService, 'verifyWebhookSignature')
        .mockReturnValue(mockEvent as unknown as Stripe.Event);

      // First request (should process)
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
      jest
        .spyOn(stripeService, 'verifyWebhookSignature')
        .mockImplementation(() => {
          throw new Error('Invalid signature');
        });

      return request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_sig')
        .send({})
        .expect(400);
    });
  });
});
