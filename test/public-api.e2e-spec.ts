/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';

jest.setTimeout(30000);

describe('Public API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up DB before test
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.addonPurchase.deleteMany();
    await prisma.addonPackage.deleteMany();

    // Seed some data
    await prisma.plan.create({
      data: {
        name: 'Public Pro Plan',
        slug: 'public-pro',
        creditsIncluded: 1000,
        stripeProductId: 'prod_123',
        status: 'ACTIVE',
        prices: {
          create: {
            billingInterval: 'MONTH',
            amount: 1000,
            currency: 'usd',
            stripePriceId: 'price_public123',
            status: 'ACTIVE',
          },
        },
      },
    });

    await prisma.addonPackage.create({
      data: {
        name: 'Public Addon',
        credits: 50,
        amount: 500,
        currency: 'usd',
        stripeProductId: 'prod_addon_public',
        stripePriceId: 'price_addon_public',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.addonPurchase.deleteMany();
    await prisma.addonPackage.deleteMany();
    await app.close();
    // Let NestJS lifecycle handle Prisma disconnect, or do it after app close
    await prisma.$disconnect();
  });

  describe('GET /plans', () => {
    it('should return all active plans without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/plans').expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toBe('Public Pro Plan');
    });
  });

  describe('GET /addons', () => {
    it('should return all active addons without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/addons').expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toBe('Public Addon');
    });
  });
});
