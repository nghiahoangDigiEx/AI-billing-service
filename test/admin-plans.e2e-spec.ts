/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { StripeService } from './../src/modules/billing/stripe.service';
import { Role } from '@prisma/client';

jest.setTimeout(30000);

describe('Admin Plans API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockStripeService: Partial<StripeService>;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    mockStripeService = {
      createProduct: jest.fn().mockResolvedValue({ id: 'prod_mock123' }),
      createPrice: jest.fn().mockResolvedValue({ id: 'price_mock123' }),
      archiveProduct: jest.fn().mockResolvedValue({ id: 'prod_mock123', active: false }),
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
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.user.deleteMany();

    // Create Admin User
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'admin-plan@example.com', password: 'password123' });
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin-plan@example.com' } });
    await prisma.user.update({ where: { id: adminUser!.id }, data: { role: Role.ADMIN } });
    const adminLogin = await request(app.getHttpServer()).post('/auth/login').send({ email: 'admin-plan@example.com', password: 'password123' });
    adminToken = adminLogin.body.accessToken;

    // Create Normal User
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'user-plan@example.com', password: 'password123' });
    const userLogin = await request(app.getHttpServer()).post('/auth/login').send({ email: 'user-plan@example.com', password: 'password123' });
    userToken = userLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.planPrice.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /admin/plans', () => {
    it('should reject non-admin users', () => {
      return request(app.getHttpServer())
        .post('/admin/plans')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Pro Plan',
          slug: 'pro-plan-1',
          creditsIncluded: 1000,
          billingInterval: 'MONTH',
          amount: 2000,
          currency: 'usd',
        })
        .expect(403);
    });

    it('should create a plan if user is admin', () => {
      return request(app.getHttpServer())
        .post('/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pro Plan',
          slug: 'pro-plan-2',
          creditsIncluded: 1000,
          billingInterval: 'MONTH',
          amount: 2000,
          currency: 'usd',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Pro Plan');
          expect(res.body.slug).toBe('pro-plan-2');
          expect(res.body.stripeProductId).toBe('prod_mock123');
        });
    });
  });

  describe('GET /admin/plans', () => {
    it('should return all plans for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
