/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentProviderFactory } from '@/modules/payment/factories/payment-provider.factory';
import { Role } from '@prisma/client';

jest.setTimeout(30000);

describe('Admin Addons API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockPaymentProviderFactory: any;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const mockAdapter = {
      createProduct: jest.fn().mockResolvedValue({ id: 'prod_mock123' }),
      createPrice: jest.fn().mockResolvedValue({ id: 'price_mock123' }),
      archiveProduct: jest
        .fn()
        .mockResolvedValue({ id: 'prod_mock123', active: false }),
    };
    mockPaymentProviderFactory = {
      getAdapter: jest.fn().mockReturnValue(mockAdapter),
      registerAdapter: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentProviderFactory)
      .useValue(mockPaymentProviderFactory)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up DB before test
    await prisma.addonPurchase.deleteMany();
    await prisma.addonPackage.deleteMany();
    await prisma.user.deleteMany();

    // Create Admin User
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'admin-addon@example.com', password: 'password123' });
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin-addon@example.com' },
    });
    await prisma.user.update({
      where: { id: adminUser!.id },
      data: { role: Role.ADMIN },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin-addon@example.com', password: 'password123' });
    adminToken = adminLogin.body.data.accessToken;

    // Create Normal User
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user-addon@example.com', password: 'password123' });
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user-addon@example.com', password: 'password123' });
    userToken = userLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.addonPurchase.deleteMany();
    await prisma.addonPackage.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
    // Let NestJS lifecycle handle Prisma disconnect, or do it after app close
    await prisma.$disconnect();
  });

  describe('POST /admin/addons', () => {
    it('should reject non-admin users', () => {
      return request(app.getHttpServer())
        .post('/admin/addons')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: '100 Credits',
          credits: 100,
          amount: 1000,
          currency: 'usd',
        })
        .expect(403);
    });

    it('should create an addon if user is admin', () => {
      return request(app.getHttpServer())
        .post('/admin/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '100 Credits',
          credits: 100,
          amount: 1000,
          currency: 'usd',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data.name).toBe('100 Credits');
          expect(res.body.data.credits).toBe(100);
          expect(res.body.data.stripeProductId).toBe('prod_mock123');
        });
    });
  });

  describe('GET /admin/addons', () => {
    it('should return all addons for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
