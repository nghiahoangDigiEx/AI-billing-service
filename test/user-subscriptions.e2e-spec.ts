/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { StripeService } from './../src/modules/billing/stripe.service';

jest.setTimeout(30000);

describe('User Subscriptions API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockStripeService: Partial<StripeService>;
  let userToken: string;
  let userId: string;
  let planId: string;
  let planPriceId: string;

  beforeAll(async () => {
    mockStripeService = {
      createSubscription: jest.fn().mockResolvedValue({ id: 'sub_mock123' }),
      createPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_mock123', client_secret: 'secret_mock123' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeService)
      .useValue(mockStripeService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Clean up DB before test
    await prisma.creditBalance.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.addonPackage.deleteMany();
    await prisma.user.deleteMany();

    // Create Normal User
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'user-sub@example.com', password: 'password123' });
    const userLogin = await request(app.getHttpServer()).post('/auth/login').send({ email: 'user-sub@example.com', password: 'password123' });
    userToken = userLogin.body.accessToken;

    const user = await prisma.user.findUnique({ where: { email: 'user-sub@example.com' } });
    userId = user!.id;
    // Provide a dummy stripeCustomerId so the upgrade can proceed
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: 'cus_dummy123' } });

    // Seed a plan and price
    const plan = await prisma.plan.create({
      data: {
        name: 'Pro Plan',
        slug: 'sub-pro-plan',
        creditsIncluded: 1000,
        stripeProductId: 'prod_sub_mock123',
        status: 'ACTIVE',
        prices: {
          create: {
            billingInterval: 'MONTH',
            amount: 2000,
            currency: 'usd',
            stripePriceId: 'price_sub_mock123',
            status: 'ACTIVE',
          },
        },
      },
      include: { prices: true },
    });
    planId = plan.id;
    planPriceId = plan.prices[0].id;
  });

  afterAll(async () => {
    await prisma.creditBalance.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.addonPackage.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /subscriptions/upgrade', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer())
        .post('/subscriptions/upgrade')
        .send({ planPriceId })
        .expect(401);
    });

    it('should initiate subscription upgrade', () => {
      return request(app.getHttpServer())
        .post('/subscriptions/upgrade')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ planPriceId })
        .expect(202)
        .expect((res) => {
          expect(res.body.status).toBe('Accepted');
          expect(res.body.stripeSubscriptionId).toBe('sub_mock123');
        });
    });
  });

  describe('GET /subscriptions/current', () => {
    it('should throw NotFoundException if no active subscription', () => {
      return request(app.getHttpServer())
        .get('/subscriptions/current')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return current active subscription', async () => {
      // Seed an active subscription
      await prisma.subscription.create({
        data: {
          userId,
          planId,
          planPriceId,
          stripeSubscriptionId: 'sub_mock123',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        },
      });



      return request(app.getHttpServer())
        .get('/subscriptions/current')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ACTIVE');
          expect(res.body.stripeSubscriptionId).toBe('sub_mock123');
        });
    });
  });

  describe('GET /subscriptions/history', () => {
    it('should return subscription history', async () => {
      return request(app.getHttpServer())
        .get('/subscriptions/history')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0].stripeSubscriptionId).toBe('sub_mock123');
        });
    });
  });

  describe('POST /addons/:id/purchase', () => {
    let addonId: string;

    beforeAll(async () => {
      const addon = await prisma.addonPackage.create({
        data: {
          name: 'Test Addon',
          amount: 1000,
          currency: 'usd',
          credits: 100,
          stripeProductId: 'prod_addon123',
          stripePriceId: 'price_addon123',
          status: 'ACTIVE',
        },
      });
      addonId = addon.id;
    });

    it('should purchase addon successfully with paid subscription', async () => {
      // The user already has an ACTIVE subscription from the previous tests
      return request(app.getHttpServer())
        .post(`/subscriptions/addons/${addonId}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(202)
        .expect((res) => {
          expect(res.body).toEqual({
            status: 'Accepted',
            paymentIntentId: 'pi_mock123',
            clientSecret: 'secret_mock123',
          });
        });
    });

    it('should reject purchase if user has no paid subscription', async () => {
      // Delete the user's subscription
      await prisma.subscription.deleteMany({ where: { userId } });

      return request(app.getHttpServer())
        .post(`/subscriptions/addons/${addonId}/purchase`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
  describe('GET /subscriptions/addons/purchases', () => {
    it('should return user active addon purchases', async () => {
      // Seed a credit balance
      await prisma.creditBalance.create({
        data: {
          userId,
          source: 'ADDON',
          sourceRef: 'addon_ref_1',
          totalCredits: 100,
          remainingCredits: 100,
          status: 'ACTIVE',
        },
      });

      return request(app.getHttpServer())
        .get(`/subscriptions/addons/purchases`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0].source).toBe('ADDON');
          expect(res.body[0].status).toBe('ACTIVE');
        });
    });
  });

  describe('GET /subscriptions/addons/purchases/history', () => {
    it('should return user addon purchase history', async () => {
      return request(app.getHttpServer())
        .get(`/subscriptions/addons/purchases/history`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0].source).toBe('ADDON');
        });
    });
  });
});
