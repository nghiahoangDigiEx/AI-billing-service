/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@prisma/client';

jest.setTimeout(30000);

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let adminAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    await prisma.user.deleteMany();

    // Create a regular user and admin user for tests
    const userRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user@test.com', password: 'password123' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'password123' });
    accessToken = loginRes.body.data.accessToken;

    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'admin@test.com', password: 'password123' });

    await prisma.user.update({
      where: { email: 'admin@test.com' },
      data: { role: Role.ADMIN },
    });

    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminAccessToken = adminLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
    // Let NestJS lifecycle handle Prisma disconnect, or do it after app close
    await prisma.$disconnect();
  });

  describe('/users/me (GET)', () => {
    it('returns current user profile', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('email', 'user@test.com');
        });
    });
  });

  describe('/users (GET)', () => {
    it('with ADMIN role returns paginated user list', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('with USER role returns 403 status', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });
});
